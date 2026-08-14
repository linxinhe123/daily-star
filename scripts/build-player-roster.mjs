import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCsv } from './lib/csv.mjs'

const root = join(import.meta.dirname, '..')
const exclusions = JSON.parse(await readFile(join(root, 'data/player-exclusions.json'), 'utf8'))
const targetCount = exclusions.targetCount ?? 200
const excludedSlugs = new Set(exclusions.excludedSlugs ?? [])
const playersSource = await readFile(join(root, 'apps/web/src/players.ts'), 'utf8')
const preferredNames = [...playersSource.matchAll(/(?:^|[,\s{])name:\s*'([^']+)'/gm)].map((match) => match[1])
const players = []
await readCsv(join(root, 'data/cache/transfermarkt/players.csv.gz'), (row) => {
  players.push({
    slug: row.player_code,
    name: row.name,
    transfermarktId: Number(row.player_id),
    highestMarketValue: Number(row.highest_market_value_in_eur || 0),
    position: row.position,
    lastSeason: Number(row.last_season || 0),
  })
})

const byName = new Map(players.map((player) => [normalize(player.name), player]))
const selected = []
const selectedIds = new Set()
const selectedNames = new Set()
for (const name of preferredNames) add(byName.get(normalize(name)))
for (const player of players.sort((a, b) => b.highestMarketValue - a.highestMarketValue || b.lastSeason - a.lastSeason)) {
  if (selected.length >= targetCount) break
  add(player)
}

if (selected.length !== targetCount) throw new Error(`Expected ${targetCount} players, got ${selected.length}`)
await writeFile(join(root, 'data/statbunker-roster.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), selection: 'product-stars-then-highest-transfermarkt-market-value', players: selected }, null, 2)}\n`, 'utf8')
console.log(`Selected ${selected.length} players (${preferredNames.length} product names requested, ${selected.filter((player) => player.preferred).length} matched)`)

function add(player) {
  const normalizedName = player ? normalize(player.name) : ''
  if (!player || excludedSlugs.has(player.slug) || selectedIds.has(player.transfermarktId) || selectedNames.has(normalizedName) || selected.length >= targetCount) return
  selectedIds.add(player.transfermarktId)
  selectedNames.add(normalizedName)
  selected.push({ ...player, preferred: preferredNames.some((name) => normalize(name) === normalize(player.name)) })
}
function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') }
