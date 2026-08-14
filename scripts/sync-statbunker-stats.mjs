import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { load } from 'cheerio'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(join(root, 'data/statbunker-players.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/statbunker')
const outputFile = join(root, 'apps/web/src/generated/statbunker-stats.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const bySlug = Object.fromEntries(config.players.map((player) => [player.slug, { coverage: 'listed-competitions', seasons: [] }]))

await mkdir(cacheDir, { recursive: true })
await mkdir(dirname(outputFile), { recursive: true })

for (const season of config.seasons) {
  const totals = new Map(config.players.map((player) => [player.slug, {
    season: season.season, club: undefined, appearances: 0, starts: 0, goals: 0, assists: 0,
    competitions: [], source: 'statbunker',
  }]))
  for (const competition of season.competitions) {
    const html = await fetchCompetition(competition.id)
    const rows = parsePlayerRows(html)
    for (const player of config.players) {
      const row = rows.find((candidate) => normalize(candidate.name) === normalize(player.name)
        && (!player.club || normalize(candidate.club) === normalize(player.club)))
      if (!row) continue
      const total = totals.get(player.slug)
      total.club ??= row.club
      total.appearances += row.appearances
      total.starts += row.starts
      total.goals += row.goals
      total.assists += row.assists
      total.competitions.push({ name: competition.name, id: competition.id })
    }
  }
  for (const [slug, total] of totals) {
    if (total.competitions.length) bySlug[slug].seasons.push(total)
  }
}

const database = new DatabaseSync(databaseFile)
database.exec(`
  CREATE TABLE IF NOT EXISTS statbunker_season_stats (
    player_slug TEXT NOT NULL, season TEXT NOT NULL, club_name TEXT NOT NULL,
    appearances INTEGER NOT NULL, starts INTEGER NOT NULL, goals INTEGER NOT NULL, assists INTEGER NOT NULL,
    competitions_json TEXT NOT NULL, source TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, season, club_name)
  );
`)
const upsert = database.prepare('INSERT OR REPLACE INTO statbunker_season_stats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
const now = new Date().toISOString()
database.exec('BEGIN')
try {
  for (const [slug, player] of Object.entries(bySlug)) for (const season of player.seasons) {
    upsert.run(slug, season.season, season.club, season.appearances, season.starts, season.goals, season.assists,
      JSON.stringify(season.competitions), season.source, now)
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

await writeFile(outputFile, `${JSON.stringify(bySlug, null, 2)}\n`, 'utf8')
console.log(`Synced ${Object.values(bySlug).reduce((sum, player) => sum + player.seasons.length, 0)} Statbunker season rows`)

async function fetchCompetition(id) {
  const cacheFile = join(cacheDir, `${id}.html`)
  try { return await readFile(cacheFile, 'utf8') } catch {}
  const response = await fetch(`https://www.statbunker.com/competitions/PlayerStandings?comp_id=${id}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyStar/1.0)' },
  })
  if (!response.ok) throw new Error(`Statbunker ${id} failed: ${response.status}`)
  const html = await response.text()
  await writeFile(cacheFile, html, 'utf8')
  return html
}

function parsePlayerRows(html) {
  const $ = load(html)
  return $('table tbody tr').map((_, row) => {
    const cells = $(row).find('td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get()
    return cells.length >= 12 ? {
      name: cells[0], club: cells[1], appearances: number(cells[3]), goals: number(cells[4]),
      assists: number(cells[5]), starts: number(cells[9]),
    } : undefined
  }).get().filter(Boolean)
}

function number(value) { return Number(String(value).replace(/[^0-9-]/g, '')) || 0 }
function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') }
