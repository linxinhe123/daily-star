import { DatabaseSync } from 'node:sqlite'

export function findPlayerIdentity(databaseFile, slug) {
  const database = new DatabaseSync(databaseFile, { readOnly: true })
  try {
    const player = database.prepare('SELECT * FROM player_identities WHERE player_slug = ?').get(slug)
    if (!player) return undefined
    const providers = database.prepare('SELECT provider, external_id FROM player_provider_ids WHERE player_slug = ? ORDER BY provider').all(slug)
    return { ...player, providers: Object.fromEntries(providers.map((row) => [row.provider, row.external_id])) }
  } finally {
    database.close()
  }
}
