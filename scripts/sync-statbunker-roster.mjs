import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { load } from 'cheerio'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
const careers = JSON.parse(await readFile(join(root, 'apps/web/src/generated/player-careers.json'), 'utf8')).players
const config = JSON.parse(await readFile(join(root, 'data/statbunker-competitions.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/statbunker')
const outputFile = join(root, 'apps/web/src/generated/statbunker-roster-stats.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const seasonRows = new Map()
const statbunkerNames = {
  gabriel: 'Gabriel Magalhaes',
  rodri: 'Rodri Hernandez',
  'martin-odegaard': 'Martin Odegaard',
  'rayan-cherki': 'Mathis Rayan Cherki',
  'josko-gvardiol': 'Joako Gvardiol',
  'willian-pacho': 'William Pacho',
  'kenan-yildiz': 'Kenan Yildiz',
  'arthur-melo': 'Arthur',
  'junior-kroupi': 'Eli Junior Kroupi',
}
const statbunkerClubAllowlist = {
  'arthur-melo': new Set(['Barcelona', 'Juventus', 'Liverpool', 'Fiorentina', 'Girona FC'].map(normalize)),
}

await mkdir(cacheDir, { recursive: true })
await mkdir(dirname(outputFile), { recursive: true })

for (const type of config.competitionTypes) {
  let competitions
  try {
    competitions = await discoverCompetitions(type)
  } catch (error) {
    console.warn(`Skipping ${type.name}: ${error.message}`)
    continue
  }
  for (const competition of competitions) {
    let html
    try {
      html = await fetchCached(`competition-${competition.id}.html`,
        `https://www.statbunker.com/competitions/PlayerStandings?comp_id=${competition.id}`)
    } catch (error) {
      console.warn(`Skipping ${competition.season} ${type.name}: ${error.message}`)
      continue
    }
    const rows = parsePlayerRows(html)
    const index = new Map()
    for (const row of rows) {
      const key = normalize(row.name)
      const matches = index.get(key) ?? []
      matches.push(row)
      index.set(key, matches)
    }
    for (const player of roster) {
      const candidates = index.get(normalize(statbunkerNames[player.slug] ?? player.name)) ?? []
      const careerClubs = careers[player.slug]?.spells.map((spell) => spell.club) ?? []
      const allowedClubs = new Set(careerClubs.map(normalizeClub))
      for (const club of statbunkerClubAllowlist[player.slug] ?? []) allowedClubs.add(normalizeClub(club))
      const row = candidates.find((candidate) => allowedClubs.has(normalizeClub(candidate.club)))
      if (!row) continue
      const key = `${player.slug}:${competition.season}:${normalize(row.club)}`
      const total = seasonRows.get(key) ?? {
        playerSlug: player.slug, playerName: player.name, season: competition.season, club: row.club,
        appearances: 0, starts: 0, goals: 0, assists: 0, competitions: [], source: 'statbunker', scope: 'configured-competitions',
      }
      total.appearances += row.appearances
      total.starts += row.starts
      total.goals += row.goals
      total.assists += row.assists
      total.competitions.push({ id: competition.id, name: type.name })
      seasonRows.set(key, total)
    }
    console.log(`${competition.season} ${type.name}: ${rows.length} players`)
  }
}

const bySlug = Object.fromEntries(roster.map((player) => [player.slug, {
  name: player.name,
  position: player.position,
  lastSeason: player.lastSeason,
  transfermarktId: player.transfermarktId,
  seasons: [],
  clubTotals: [],
}]))
for (const row of seasonRows.values()) bySlug[row.playerSlug].seasons.push(row)
for (const player of Object.values(bySlug)) {
  player.seasons.sort((a, b) => a.season.localeCompare(b.season))
  const totals = new Map()
  for (const row of player.seasons) {
    const total = totals.get(normalize(row.club)) ?? { club: row.club, appearances: 0, starts: 0, goals: 0, assists: 0 }
    total.appearances += row.appearances
    total.starts += row.starts
    total.goals += row.goals
    total.assists += row.assists
    totals.set(normalize(row.club), total)
  }
  player.clubTotals = [...totals.values()].sort((a, b) => b.appearances - a.appearances)
}

const database = new DatabaseSync(databaseFile)
database.exec(`
  CREATE TABLE IF NOT EXISTS statbunker_roster_stats (
    player_slug TEXT NOT NULL, season TEXT NOT NULL, club_name TEXT NOT NULL,
    appearances INTEGER NOT NULL, starts INTEGER NOT NULL, goals INTEGER NOT NULL, assists INTEGER NOT NULL,
    competitions_json TEXT NOT NULL, source TEXT NOT NULL, scope TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, season, club_name)
  );
  CREATE TABLE IF NOT EXISTS statbunker_club_totals (
    player_slug TEXT NOT NULL, club_name TEXT NOT NULL,
    appearances INTEGER NOT NULL, starts INTEGER NOT NULL, goals INTEGER NOT NULL, assists INTEGER NOT NULL,
    source TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, club_name)
  );
  DELETE FROM statbunker_roster_stats;
  DELETE FROM statbunker_club_totals;
`)
const insert = database.prepare('INSERT INTO statbunker_roster_stats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
const insertClubTotal = database.prepare('INSERT INTO statbunker_club_totals VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
const now = new Date().toISOString()
database.exec('BEGIN')
try {
  for (const row of seasonRows.values()) insert.run(row.playerSlug, row.season, row.club, row.appearances, row.starts,
    row.goals, row.assists, JSON.stringify(row.competitions), row.source, row.scope, now)
  for (const [playerSlug, player] of Object.entries(bySlug)) {
    for (const total of player.clubTotals) insertClubTotal.run(playerSlug, total.club, total.appearances, total.starts,
      total.goals, total.assists, 'statbunker', now)
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

await writeFile(outputFile, `${JSON.stringify({ generatedAt: now, competitionTypes: config.competitionTypes, players: bySlug }, null, 2)}\n`, 'utf8')
console.log(`Synced ${seasonRows.size} season-club rows for ${roster.length} players`)

async function discoverCompetitions(type) {
  const html = await fetchCached(`type-${type.code}.html`, `https://www.statbunker.com/competitions/PlayerStandings?comp_type=${type.code}`)
  const $ = load(html)
  return $('select[name=comp_id] option').map((_, option) => {
    const label = $(option).text().trim()
    const id = Number($(option).attr('value'))
    const match = label.match(/(\d{2})\/(\d{2})$/)
    if (!id || !match) return undefined
    const start = Number(match[1]) + (Number(match[1]) < 50 ? 2000 : 1900)
    return start >= config.seasonStart && start <= config.seasonEnd ? { id, season: `${match[1]}/${match[2]}` } : undefined
  }).get().filter(Boolean)
}

async function fetchCached(filename, url) {
  const file = join(cacheDir, filename)
  try { return await readFile(file, 'utf8') } catch {}
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyStar/1.0)' } })
      if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
      const html = await response.text()
      await writeFile(file, html, 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 1200))
      return html
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
    }
  }
  throw lastError
}

function parsePlayerRows(html) {
  const $ = load(html)
  return $('table tbody tr').map((_, row) => {
    const cells = $(row).find('td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get()
    return cells.length >= 12 ? { name: cells[0], club: cells[1], appearances: number(cells[3]), goals: number(cells[4]), assists: number(cells[5]), starts: number(cells[9]) } : undefined
  }).get().filter(Boolean)
}
function number(value) { return Number(String(value).replace(/[^0-9-]/g, '')) || 0 }
function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/[đð]/g, 'd').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeClub(value) {
  const compact = normalize(String(value).replace(/\b(?:FC|CF|AFC|SC)\b/gi, ' '))
  const aliases = {
    parisstgermain: 'parissaintgermain', parissg: 'parissaintgermain',
    manutd: 'manchesterunited', mancity: 'manchestercity',
    tottenham: 'tottenhamhotspur', newcastle: 'newcastleunited',
    inter: 'intermilan', leverkusen: 'bayerleverkusen', dortmund: 'borussiadortmund',
    bayernmunich: 'bayernmunchen', atleticomadrid: 'atletico',
    losangeles: 'losangelesfc', lafc: 'losangelesfc',
  }
  return aliases[compact] ?? compact
}
