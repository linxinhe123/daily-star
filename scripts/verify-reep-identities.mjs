import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPlayerIdentity } from './lib/player-identities.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const databaseFile = join(root, 'data/daily-star.sqlite')
const config = JSON.parse(await readFile(join(root, 'data/transfermarkt-players.json'), 'utf8'))

for (const configured of config.players) {
  const identity = findPlayerIdentity(databaseFile, configured.slug)
  assert(identity, `Missing identity for ${configured.slug}`)
  assert.equal(identity.display_name, configured.name)
  assert.equal(identity.providers.transfermarkt, String(configured.transfermarktId))
  assert(Object.keys(identity.providers).length > 1, `No cross-provider IDs for ${configured.slug}`)
}

assert.equal(findPlayerIdentity(databaseFile, 'missing-player'), undefined)
console.log(`Verified ${config.players.length} Reep identities and provider mappings`)
