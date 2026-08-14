import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCsv } from './lib/csv.mjs'

const root = join(import.meta.dirname, '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
const identities = JSON.parse(await readFile(join(root, 'data/player-identities.json'), 'utf8')).players
const targetIds = new Set(roster.map((player) => String(player.transfermarktId)))
const profiles = new Map()
await readCsv(join(root, 'data/cache/transfermarkt/players.csv.gz'), (row) => {
  if (targetIds.has(row.player_id)) profiles.set(row.player_id, row)
})

const exceptions = new Set(['pele', 'kaka'])
const mismatches = roster.flatMap((player) => {
  if (exceptions.has(player.slug)) return []
  const profile = profiles.get(String(player.transfermarktId))
  const expectedBirth = String(profile?.date_of_birth ?? '').slice(0, 10)
  const actualBirth = String(identities[player.slug]?.birthDate ?? '').slice(0, 10)
  return expectedBirth && actualBirth === expectedBirth ? [] : [{ slug: player.slug, expectedBirth, actualBirth }]
})

console.log(`Identity audit: ${roster.length - mismatches.length}/${roster.length} verified by Transfermarkt ID and birth date`)
if (mismatches.length) {
  console.error(JSON.stringify(mismatches, null, 2))
  process.exitCode = 1
}
