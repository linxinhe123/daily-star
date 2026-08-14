import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const root = join(import.meta.dirname, '..')
const config = JSON.parse(await readFile(join(root, 'data/player-exclusions.json'), 'utf8'))
const excluded = new Set(config.excludedSlugs ?? [])

const arrayFiles = ['data/statbunker-roster.json']
const objectFiles = [
  'data/player-identities.json',
  'data/player-localizations.json',
  'apps/web/src/generated/player-identities.json',
  'apps/web/src/generated/player-careers.json',
  'apps/web/src/generated/player-valuations.json',
  'apps/web/src/generated/statbunker-roster-stats.json',
]

for (const relativePath of arrayFiles) {
  const file = join(root, relativePath)
  const payload = JSON.parse(await readFile(file, 'utf8'))
  const before = payload.players.length
  payload.players = payload.players.filter((player) => !excluded.has(player.slug))
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`${relativePath}: ${before} -> ${payload.players.length}`)
}

for (const relativePath of objectFiles) {
  const file = join(root, relativePath)
  const payload = JSON.parse(await readFile(file, 'utf8'))
  const before = Object.keys(payload.players ?? {}).length
  for (const slug of excluded) delete payload.players?.[slug]
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`${relativePath}: ${before} -> ${Object.keys(payload.players ?? {}).length}`)
}

await copyFile(join(root, 'data/player-identities.json'), join(root, 'apps/web/src/generated/player-identities.json'))

const database = new DatabaseSync(join(root, 'data/daily-star.sqlite'))
const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
database.exec('BEGIN')
try {
  for (const { name } of tables) {
    const hasPlayerSlug = database.prepare(`PRAGMA table_info(${name})`).all().some((column) => column.name === 'player_slug')
    if (!hasPlayerSlug) continue
    const statement = database.prepare(`DELETE FROM ${name} WHERE player_slug = ?`)
    for (const slug of excluded) statement.run(slug)
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

console.log(`Pruned ${[...excluded].join(', ')}`)
