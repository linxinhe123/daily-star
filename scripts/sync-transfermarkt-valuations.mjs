import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/transfermarkt')
const outputFile = join(root, 'apps/web/src/generated/player-valuations.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const baseUrl = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data'
const valuationFile = join(cacheDir, 'player_valuations.csv.gz')
const clubsFile = join(cacheDir, 'clubs.csv.gz')

await mkdir(cacheDir, { recursive: true })
await download(`${baseUrl}/player_valuations.csv.gz`, valuationFile)
await download(`${baseUrl}/clubs.csv.gz`, clubsFile)

const targets = new Map(roster.players.map((player) => [String(player.transfermarktId), player]))
const clubs = new Map()
await readCsvGzip(clubsFile, (row) => clubs.set(row.club_id, row.name))

const pointsBySlug = new Map(roster.players.map((player) => [player.slug, new Map()]))
await readCsvGzip(valuationFile, (row) => {
  const player = targets.get(row.player_id)
  if (!player || !row.date || !row.market_value_in_eur) return
  const value = Number(row.market_value_in_eur)
  if (!Number.isFinite(value) || value <= 0) return
  pointsBySlug.get(player.slug).set(row.date, {
    date: row.date,
    year: Number(row.date.slice(0, 4)),
    value: Math.round(value / 10000) / 100,
    clubId: Number(row.current_club_id || 0),
    club: clubs.get(row.current_club_id) || '',
  })
})

const generatedAt = new Date().toISOString()
const players = Object.fromEntries(roster.players.map((player) => [player.slug, {
  transfermarktId: player.transfermarktId,
  points: [...pointsBySlug.get(player.slug).values()].sort((a, b) => a.date.localeCompare(b.date)),
}]))

const database = new DatabaseSync(databaseFile)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS player_market_values (
    player_slug TEXT NOT NULL,
    transfermarkt_id INTEGER NOT NULL,
    value_date TEXT NOT NULL,
    market_value INTEGER NOT NULL,
    club_id INTEGER,
    club_name TEXT,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, value_date)
  );
`)
const upsert = database.prepare(`
  INSERT INTO player_market_values VALUES (?, ?, ?, ?, ?, ?, 'transfermarkt-datasets', ?)
  ON CONFLICT(player_slug, value_date) DO UPDATE SET
    market_value=excluded.market_value, club_id=excluded.club_id, club_name=excluded.club_name,
    source=excluded.source, updated_at=excluded.updated_at
`)
database.exec('BEGIN')
try {
  for (const [slug, player] of Object.entries(players)) {
    for (const point of player.points) {
      upsert.run(slug, player.transfermarktId, point.date, Math.round(point.value * 1_000_000), point.clubId || null, point.club || null, generatedAt)
    }
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

await writeFile(outputFile, `${JSON.stringify({ generatedAt, players }, null, 2)}\n`, 'utf8')
const covered = Object.values(players).filter((player) => player.points.length).length
const totalPoints = Object.values(players).reduce((sum, player) => sum + player.points.length, 0)
console.log(`Valuations: ${covered}/${roster.players.length} players, ${totalPoints} points`)

async function download(url, destination) {
  try { if ((await stat(destination)).size > 0) return } catch {}
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`)
  const temporary = `${destination}.part`
  await pipeline(response.body, createWriteStream(temporary))
  await rename(temporary, destination)
}

async function readCsvGzip(file, onRow) {
  let headers
  let pending = ''
  const stream = createReadStream(file).pipe(createGunzip())
  stream.setEncoding('utf8')
  for await (const chunk of stream) {
    pending += chunk
    let newline
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '')
      pending = pending.slice(newline + 1)
      if (!headers) headers = parseCsvLine(line)
      else if (line) onRow(Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])))
    }
  }
  if (pending && headers) onRow(Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(pending)[index] ?? ''])))
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { values.push(value); value = '' }
    else value += char
  }
  values.push(value)
  return values
}

