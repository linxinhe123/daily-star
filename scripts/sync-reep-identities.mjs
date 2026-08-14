import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { readCsv } from './lib/csv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(join(root, 'data/transfermarkt-players.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/reep')
const peopleFile = join(cacheDir, 'people.csv')
const databaseFile = join(root, 'data/daily-star.sqlite')
const sourceUrl = 'https://raw.githubusercontent.com/withqwerty/reep/main/data/people.csv'
const providerColumns = {
  wikidata: 'key_wikidata', transfermarkt: 'key_transfermarkt', fbref: 'key_fbref',
  sofascore: 'key_sofascore', fotmob: 'key_fotmob', espn: 'key_espn', whoscored: 'key_whoscored',
  understat: 'key_understat', opta: 'key_opta', sportmonks: 'key_sportmonks',
  api_football: 'key_api_football', thesportsdb: 'key_thesportsdb', soccerway: 'key_soccerway',
}

await mkdir(cacheDir, { recursive: true })
await download(sourceUrl, peopleFile)

const trackedByTransfermarkt = new Map(config.players.map((player) => [String(player.transfermarktId), player]))
const identities = []
await readCsv(peopleFile, (row) => {
  const configured = trackedByTransfermarkt.get(row.key_transfermarkt)
  if (configured && row.type === 'player') identities.push({ configured, row })
})

const missing = config.players.filter((player) => !identities.some(({ configured }) => configured.slug === player.slug))
if (missing.length) throw new Error(`Reep identity missing for: ${missing.map((player) => player.slug).join(', ')}`)

const database = new DatabaseSync(databaseFile)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS player_identities (
    player_slug TEXT PRIMARY KEY,
    reep_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    reep_release TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_provider_ids (
    player_slug TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    PRIMARY KEY (player_slug, provider),
    FOREIGN KEY (player_slug) REFERENCES player_identities(player_slug) ON DELETE CASCADE
  );
`)
const columns = database.prepare('PRAGMA table_info(player_identities)').all().map((column) => column.name)
if (!columns.includes('display_name')) {
  database.exec('DROP TABLE player_provider_ids; DROP TABLE player_identities;')
  database.exec(`
    CREATE TABLE player_identities (
      player_slug TEXT PRIMARY KEY,
      reep_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      reep_release TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE player_provider_ids (
      player_slug TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      PRIMARY KEY (player_slug, provider),
      FOREIGN KEY (player_slug) REFERENCES player_identities(player_slug) ON DELETE CASCADE
    );
  `)
}
const upsertIdentity = database.prepare(`
  INSERT INTO player_identities VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(player_slug) DO UPDATE SET reep_id=excluded.reep_id, display_name=excluded.display_name,
    reep_release=excluded.reep_release, updated_at=excluded.updated_at
`)
const upsertProvider = database.prepare(`
  INSERT INTO player_provider_ids VALUES (?, ?, ?)
  ON CONFLICT(player_slug, provider) DO UPDATE SET external_id=excluded.external_id
`)
const clearProviders = database.prepare('DELETE FROM player_provider_ids WHERE player_slug = ?')
const now = new Date().toISOString()
database.exec('BEGIN')
try {
  for (const { configured, row } of identities) {
    upsertIdentity.run(configured.slug, row.reep_id, configured.name, '2026.25', now)
    clearProviders.run(configured.slug)
    for (const [provider, column] of Object.entries(providerColumns)) {
      if (row[column]) upsertProvider.run(configured.slug, provider, row[column])
    }
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

console.log(`Synced ${identities.length} Reep player identities into ${databaseFile}`)

async function download(url, destination) {
  try { if ((await stat(destination)).size > 0) return } catch {}
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`)
  const temporary = `${destination}.part`
  await pipeline(response.body, createWriteStream(temporary))
  await rename(temporary, destination)
}
