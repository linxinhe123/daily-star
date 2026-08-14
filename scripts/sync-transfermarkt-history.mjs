import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(join(root, 'data/transfermarkt-players.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/transfermarkt')
const outputFile = join(root, 'apps/web/src/generated/season-stats.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const baseUrl = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data'
const requiredFiles = ['players.csv.gz', 'games.csv.gz', 'appearances.csv.gz', 'game_lineups.csv.gz']

await mkdir(cacheDir, { recursive: true })
await mkdir(dirname(outputFile), { recursive: true })

for (const file of requiredFiles) await download(`${baseUrl}/${file}`, join(cacheDir, file))

const trackedIds = new Set(config.players.map((player) => String(player.transfermarktId)))
const playerNames = new Map()
await readCsvGzip(join(cacheDir, 'players.csv.gz'), (row) => {
  if (trackedIds.has(row.player_id)) playerNames.set(row.player_id, row.name)
})

const games = new Map()
await readCsvGzip(join(cacheDir, 'games.csv.gz'), (row) => {
  const season = Number(row.season)
  if (season <= config.maxSeason && row.competition_type !== 'national_team_competition') {
    games.set(row.game_id, {
      season,
      homeClubId: row.home_club_id,
      awayClubId: row.away_club_id,
      homeClubName: row.home_club_name,
      awayClubName: row.away_club_name,
    })
  }
})

const rows = new Map()
await readCsvGzip(join(cacheDir, 'appearances.csv.gz'), (appearance) => {
  if (!trackedIds.has(appearance.player_id)) return
  const game = games.get(appearance.game_id)
  if (!game) return
  const clubId = appearance.player_club_id
  const club = clubId === game.homeClubId ? game.homeClubName : clubId === game.awayClubId ? game.awayClubName : `Club ${clubId}`
  const key = `${appearance.player_id}:${game.season}:${clubId}`
  const current = rows.get(key) ?? {
    playerId: Number(appearance.player_id), season: formatSeason(game.season), seasonStart: game.season,
    clubId: Number(clubId), club, appearances: 0, starts: null, goals: 0, assists: 0, minutes: 0,
    averageRating: null, source: 'transfermarkt-datasets',
  }
  current.appearances += 1
  current.goals += Number(appearance.goals || 0)
  current.assists += Number(appearance.assists || 0)
  current.minutes += Number(appearance.minutes_played || 0)
  rows.set(key, current)
})

const startsByPlayerGame = new Set()
await readCsvGzip(join(cacheDir, 'game_lineups.csv.gz'), (lineup) => {
  if (trackedIds.has(lineup.player_id) && lineup.type === 'starting_lineup') {
    startsByPlayerGame.add(`${lineup.player_id}:${lineup.game_id}`)
  }
})
await readCsvGzip(join(cacheDir, 'appearances.csv.gz'), (appearance) => {
  if (!startsByPlayerGame.has(`${appearance.player_id}:${appearance.game_id}`)) return
  const game = games.get(appearance.game_id)
  if (!game) return
  const key = `${appearance.player_id}:${game.season}:${appearance.player_club_id}`
  const current = rows.get(key)
  if (current) current.starts = (current.starts ?? 0) + 1
})

const bySlug = Object.fromEntries(config.players.map((player) => [player.slug, {
  transfermarktId: player.transfermarktId,
  playerName: playerNames.get(String(player.transfermarktId)) ?? player.playerCode,
  maxSeason: formatSeason(config.maxSeason),
  coverage: 'partial',
  updatedAt: new Date().toISOString(),
  seasons: [...rows.values()].filter((row) => row.playerId === player.transfermarktId).sort((a, b) => a.seasonStart - b.seasonStart),
}]))

const database = new DatabaseSync(databaseFile)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS player_season_stats (
    player_slug TEXT NOT NULL,
    transfermarkt_id INTEGER NOT NULL,
    season TEXT NOT NULL,
    season_start INTEGER NOT NULL,
    club_id INTEGER NOT NULL,
    club_name TEXT NOT NULL,
    appearances INTEGER NOT NULL,
    starts INTEGER,
    goals INTEGER NOT NULL,
    assists INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    average_rating REAL,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, season_start, club_id)
  );
`)
const upsert = database.prepare(`
  INSERT INTO player_season_stats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_slug, season_start, club_id) DO UPDATE SET
    appearances=excluded.appearances, starts=excluded.starts, goals=excluded.goals,
    assists=excluded.assists, minutes=excluded.minutes, average_rating=excluded.average_rating,
    source=excluded.source, updated_at=excluded.updated_at
`)
database.exec('BEGIN')
try {
  for (const [slug, player] of Object.entries(bySlug)) {
    for (const row of player.seasons) {
      upsert.run(slug, player.transfermarktId, row.season, row.seasonStart, row.clubId, row.club,
        row.appearances, row.starts, row.goals, row.assists, row.minutes, row.averageRating, row.source, player.updatedAt)
    }
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

await writeFile(outputFile, `${JSON.stringify(bySlug, null, 2)}\n`, 'utf8')
console.log(`Wrote ${Object.values(bySlug).reduce((total, player) => total + player.seasons.length, 0)} season-club rows to SQLite and ${outputFile}`)

function formatSeason(start) {
  return `${String(start).slice(-2)}/${String(start + 1).slice(-2)}`
}

async function download(url, destination) {
  try {
    if ((await stat(destination)).size > 0) return
  } catch {}
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
