import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const registryFile = join(root, 'data/football-assets.json')
const outputDir = join(root, 'apps/web/public/assets/football')
const generatedFile = join(root, 'apps/web/src/generated/football-assets.json')
const statbunkerStatsFile = join(root, 'apps/web/src/generated/statbunker-roster-stats.json')
const valuationFile = join(root, 'apps/web/src/generated/player-valuations.json')
const careerFile = join(root, 'apps/web/src/generated/player-careers.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const registry = JSON.parse(await readFile(registryFile, 'utf8'))
const previous = await readJson(generatedFile, { assets: {} })
const resolved = { ...previous.assets }
const activeReuseNames = new Set(Object.keys(registry.reuse ?? {}))
for (const [name, asset] of Object.entries(resolved)) {
  if (String(asset.source).startsWith('Reuses ') && !activeReuseNames.has(name)) delete resolved[name]
}
const clubQueries = {
  'AFC Bournemouth': 'Bournemouth',
  'AS Monaco': 'Monaco',
  'AS Saint-Etienne': 'Saint Etienne',
  'Angers SCO': 'Angers',
  'Brighton & Hove Albion': 'Brighton and Hove Albion',
  'CD Alaves': 'Deportivo Alaves',
  'En Avant Guingamp': 'Guingamp',
  'FC Schalke 04': 'Schalke 04',
  'Galatasaray SK': 'Galatasaray',
  'Hamburger SV': 'Hamburg',
  'Sporting Braga': 'Braga',
}

await mkdir(outputDir, { recursive: true })
await mkdir(dirname(generatedFile), { recursive: true })

for (const asset of registry.assets) {
  if (resolved[asset.name]) {
    for (const alias of asset.aliases ?? []) resolved[alias] = { ...resolved[asset.name], canonicalName: asset.name }
    console.log(`${asset.name} -> cached`)
    continue
  }
  let imageUrl
  let source
  if (asset.query) {
    const matches = (await fetchJson(`${registry.providers.theSportsDb}/searchteams.php?t=${encodeURIComponent(asset.query)}`)).teams ?? []
    const team = matches.find((item) => item.strSport === 'Soccer' && item.strGender !== 'Female' && item.strBadge)
    imageUrl = team?.strBadge
    source = team ? `TheSportsDB team ${team.idTeam}` : undefined
    asset.providerId = team?.idTeam
  } else if (asset.theSportsDbLeagueId) {
    const competition = ((await fetchJson(`${registry.providers.theSportsDb}/lookupleague.php?id=${asset.theSportsDbLeagueId}`)).leagues ?? []).find((item) => item.strTrophy)
    imageUrl = competition?.strTrophy
    source = competition ? `TheSportsDB league ${asset.theSportsDbLeagueId}` : undefined
  } else if (asset.wikimediaUrl) {
    imageUrl = asset.wikimediaUrl
    source = `Wikimedia Commons: ${asset.wikimediaUrl}`
  } else if (asset.existingPath) {
    source = `Existing verified local asset: ${asset.existingPath}`
  }

  if (imageUrl) {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Asset download failed (${response.status}): ${imageUrl}`)
    await writeFile(join(outputDir, asset.filename), Buffer.from(await response.arrayBuffer()))
  }
  const path = `/assets/football/${asset.filename}`
  resolved[asset.name] = { path, kind: asset.kind, source: source ?? 'Registry mapping', providerId: asset.providerId }
  for (const alias of asset.aliases ?? []) resolved[alias] = { ...resolved[asset.name], canonicalName: asset.name }
  console.log(`${asset.name} -> ${path}`)
}

for (const [name, canonicalName] of Object.entries(registry.reuse ?? {})) {
  const canonical = resolved[canonicalName]
  if (!canonical) throw new Error(`Reuse target not found: ${name} -> ${canonicalName}`)
  resolved[name] = { ...canonical, canonicalName, source: `Reuses ${canonicalName}; ${canonical.source}` }
}

// Valuation points already carry Transfermarkt's stable club ID. Use that ID
// directly so a fuzzy team-name search can never attach another club's badge.
const valuations = JSON.parse(await readFile(valuationFile, 'utf8'))
const valuationClubs = new Map()
for (const player of Object.values(valuations.players)) {
  for (const point of player.points ?? []) {
    if (point.club && point.clubId) valuationClubs.set(`${point.clubId}:${point.club}`, point)
  }
}
const careers = JSON.parse(await readFile(careerFile, 'utf8'))
for (const player of Object.values(careers.players)) {
  for (const spell of player.spells ?? []) {
    if (spell.club && spell.clubId) valuationClubs.set(`${spell.clubId}:${spell.club}`, spell)
  }
}
const valuationEntries = [...valuationClubs.values()]
for (let offset = 0; offset < valuationEntries.length; offset += 10) {
  await Promise.all(valuationEntries.slice(offset, offset + 10).map(async ({ club, clubId }) => {
    const filename = `club-tm-${clubId}.png`
    const target = join(outputDir, filename)
    try { await access(target) } catch {
      const imageUrl = `https://tmssl.akamaized.net/images/wappen/head/${clubId}.png`
      const image = await fetch(imageUrl)
      if (!image.ok) {
        console.warn(`${club} (${clubId}) -> Transfermarkt badge failed: ${image.status}`)
        return
      }
      await writeFile(target, Buffer.from(await image.arrayBuffer()))
    }
    resolved[club] = {
      path: `/assets/football/${filename}`,
      kind: 'crest',
      source: `Transfermarkt club ${clubId}`,
      canonicalName: club,
      providerId: `tm:${clubId}`,
    }
  }))
}

const statbunker = JSON.parse(await readFile(statbunkerStatsFile, 'utf8'))
const clubs = [...new Set(Object.values(statbunker.players).flatMap((player) => player.clubTotals.map((row) => row.club)))].sort()
const providerAssets = new Map(Object.entries(resolved).flatMap(([name, asset]) => asset.providerId ? [[asset.providerId, { name, asset }]] : []))
for (const club of clubs) {
  if (resolved[club]) continue
  try {
    const teams = (await fetchJson(`${registry.providers.theSportsDb}/searchteams.php?t=${encodeURIComponent(clubQueries[club] ?? club)}`)).teams ?? []
    const candidates = teams.filter((team) => team.strSport === 'Soccer' && team.strGender !== 'Female' && team.strBadge)
    const expectedName = clubQueries[club] ?? club
    const team = candidates.find((candidate) => [club, expectedName].some((name) => normalize(candidate.strTeam) === normalize(name)))
    if (!team) {
      console.warn(`${club} -> no crest found`)
      continue
    }
    const reused = providerAssets.get(team.idTeam)
    if (reused) {
      resolved[club] = { ...reused.asset, canonicalName: reused.name, source: `Reuses ${reused.name}; TheSportsDB team ${team.idTeam}` }
      console.log(`${club} -> reuses ${reused.name}`)
      continue
    }
    const extension = new URL(team.strBadge).pathname.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase() ?? 'png'
    const filename = `club-${team.idTeam}.${extension}`
    const target = join(outputDir, filename)
    try { await access(target) } catch {
      const image = await fetch(team.strBadge)
      if (!image.ok) throw new Error(`badge failed: ${image.status}`)
      await writeFile(target, Buffer.from(await image.arrayBuffer()))
    }
    resolved[club] = { path: `/assets/football/${filename}`, kind: 'crest', source: `TheSportsDB team ${team.idTeam}`, canonicalName: team.strTeam, providerId: team.idTeam }
    providerAssets.set(team.idTeam, { name: club, asset: resolved[club] })
    console.log(`${club} -> ${filename}`)
    await new Promise((resolve) => setTimeout(resolve, 2200))
  } catch (error) {
    console.warn(`${club} -> ${error.message}`)
  }
}

const output = { providers: registry.providers, assets: resolved }
await writeFile(generatedFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const database = new DatabaseSync(databaseFile)
database.exec('CREATE TABLE IF NOT EXISTS football_assets (asset_name TEXT PRIMARY KEY, local_path TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, canonical_name TEXT, provider_id TEXT, updated_at TEXT NOT NULL)')
for (const column of ['canonical_name TEXT', 'provider_id TEXT']) {
  try { database.exec(`ALTER TABLE football_assets ADD COLUMN ${column}`) } catch {}
}
const upsert = database.prepare('INSERT OR REPLACE INTO football_assets (asset_name, local_path, kind, source, canonical_name, provider_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
const now = new Date().toISOString()
database.exec('BEGIN')
try {
  database.exec('DELETE FROM football_assets')
  for (const [name, asset] of Object.entries(resolved)) upsert.run(name, asset.path, asset.kind, asset.source, asset.canonicalName ?? name, asset.providerId ?? null, now)
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}
console.log(`Synced ${Object.keys(resolved).length} asset names and aliases`)

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url)
    if (response.ok) return response.json()
    if (response.status !== 429 || attempt === 4) throw new Error(`search failed: ${response.status}`)
    const retryAfter = Number(response.headers.get('retry-after')) || 60
    console.warn(`TheSportsDB rate limit; retrying in ${retryAfter}s`)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
  }
}
