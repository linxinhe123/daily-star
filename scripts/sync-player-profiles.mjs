import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = join(root, 'data/player-profiles.json')
const outputFile = join(root, 'apps/web/src/generated/player-profiles.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const source = JSON.parse(await readFile(sourceFile, 'utf8'))
const profiles = source.players
const database = new DatabaseSync(databaseFile)

database.exec(`
  CREATE TABLE IF NOT EXISTS player_profiles (player_slug TEXT PRIMARY KEY, profile_json TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS player_club_history (player_slug TEXT NOT NULL, club_name TEXT NOT NULL, period TEXT NOT NULL, appearances INTEGER, goals INTEGER, note TEXT, PRIMARY KEY(player_slug, club_name, period));
  CREATE TABLE IF NOT EXISTS player_honors (player_slug TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, count INTEGER NOT NULL, years TEXT NOT NULL, PRIMARY KEY(player_slug, category, title));
`)
const profileStatement = database.prepare('INSERT OR REPLACE INTO player_profiles VALUES (?, ?, ?)')
const clubStatement = database.prepare('INSERT OR REPLACE INTO player_club_history VALUES (?, ?, ?, ?, ?, ?)')
const honorStatement = database.prepare('INSERT OR REPLACE INTO player_honors VALUES (?, ?, ?, ?, ?)')
const now = new Date().toISOString()
database.exec('BEGIN')
try {
  for (const [slug, profile] of Object.entries(profiles)) {
    database.prepare('DELETE FROM player_club_history WHERE player_slug = ?').run(slug)
    database.prepare('DELETE FROM player_honors WHERE player_slug = ?').run(slug)
    profileStatement.run(slug, JSON.stringify(profile), now)
    for (const club of profile.clubs) clubStatement.run(slug, club.club, club.period, club.appearances ?? null, club.goals ?? null, club.note ?? null)
    for (const group of profile.honorGroups) for (const honor of group.items) honorStatement.run(slug, group.category, honor.title, honor.count, honor.years)
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}
await mkdir(dirname(outputFile), { recursive: true })
await copyFile(sourceFile, outputFile)
console.log(`Synced ${Object.keys(profiles).length} player profiles to SQLite and web snapshot`)
