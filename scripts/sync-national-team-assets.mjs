import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const identitiesFile = join(root, 'apps/web/src/generated/player-identities.json')
const outputFile = join(root, 'apps/web/src/generated/national-team-assets.json')
const outputDir = join(root, 'apps/web/public/assets/nations')
const databaseFile = join(root, 'data/daily-star.sqlite')
const apiBase = 'https://www.thesportsdb.com/api/v1/json/3'

const nationQueries = {
  阿根廷: ['Argentina'], 埃及: ['Egypt'], 奥地利: ['Austria'], 巴西: ['Brazil'], 比利时: ['Belgium'],
  波兰: ['Poland'], 波斯尼亚和黑塞哥维那: ['Bosnia', 'Bosnia-Herzegovina', 'Bosnia and Herzegovina'], 丹麦: ['Denmark'],
  德国: ['Germany'], 厄瓜多尔: ['Ecuador'], 法国: ['France'], 哥伦比亚: ['Colombia'], 格鲁吉亚: ['Georgia'],
  荷兰: ['Netherlands'], 加拿大: ['Canada'], 加纳: ['Ghana'], 加蓬: ['Gabon'], 喀麦隆: ['Cameroon'],
  克罗地亚: ['Croatia'], 摩洛哥: ['Morocco'], 尼日利亚: ['Nigeria'], 挪威: ['Norway'], 葡萄牙: ['Portugal'],
  瑞典: ['Sweden'], 塞尔维亚: ['Serbia'], 塞内加尔: ['Senegal'], 斯洛伐克: ['Slovakia'],
  斯洛文尼亚: ['Slovenia'], 苏格兰: ['Scotland'], 威尔士: ['Wales'], 乌拉圭: ['Uruguay'],
  西班牙: ['Spain'], 匈牙利: ['Hungary'], 意大利: ['Italy'], 英格兰: ['England'], 智利: ['Chile'],
  "Cote d'Ivoire": ['Ivory Coast', "Cote d'Ivoire"], 'Korea, South': ['South Korea', 'Korea Republic'], Türkiye: ['Turkey', 'Turkiye'],
}
const verifiedFallbackTeams = {
  格鲁吉亚: {
    idTeam: 'uefa-57157',
    strTeam: 'Georgia',
    strBadge: 'https://img.uefa.com/imgml/TP/teams/logos/240x240/57157.png',
    source: 'UEFA national team 57157',
  },
}

const identities = JSON.parse(await readFile(identitiesFile, 'utf8')).players
const nations = [...new Set(Object.values(identities).map((player) => player.nation))].sort()
const previous = await readJson(outputFile, { assets: {} })
const assets = {}
await mkdir(outputDir, { recursive: true })

for (const nation of nations) {
  const cached = previous.assets[nation]
  if (cached && await exists(join(root, 'apps/web/public', cached.src.replace(/^\//, '')))) {
    assets[nation] = cached
    console.log(`${nation} -> cached`)
    continue
  }

  const team = await findNationalTeam(nationQueries[nation] ?? [nation]) ?? verifiedFallbackTeams[nation]
  if (!team?.strBadge) {
    console.warn(`${nation} -> no national-team badge found`)
    continue
  }

  const extension = new URL(team.strBadge).pathname.match(/\.(png|jpe?g|webp|svg)$/i)?.[1]?.toLowerCase() ?? 'png'
  const filename = `nation-${team.idTeam}.${extension}`
  const target = join(outputDir, filename)
  if (!await exists(target)) {
    const response = await fetch(team.strBadge, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`${nation}: badge download failed (${response.status})`)
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
  }
  assets[nation] = {
    src: `/assets/nations/${filename}`,
    providerId: team.idTeam,
    team: team.strTeam,
    source: team.source ?? `TheSportsDB national team ${team.idTeam}`,
  }
  console.log(`${nation} -> ${team.strTeam}`)
  await new Promise((resolve) => setTimeout(resolve, 350))
}

const output = { generatedAt: new Date().toISOString(), source: 'TheSportsDB national-team badges', assets }
await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const database = new DatabaseSync(databaseFile)
database.exec('CREATE TABLE IF NOT EXISTS national_team_assets (nation TEXT PRIMARY KEY, asset_json TEXT NOT NULL, updated_at TEXT NOT NULL)')
const upsert = database.prepare('INSERT OR REPLACE INTO national_team_assets (nation, asset_json, updated_at) VALUES (?, ?, ?)')
database.exec('BEGIN')
try {
  database.exec('DELETE FROM national_team_assets')
  for (const [nation, asset] of Object.entries(assets)) upsert.run(nation, JSON.stringify(asset), output.generatedAt)
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}
console.log(`Synced ${Object.keys(assets).length}/${nations.length} national-team badges`)

async function findNationalTeam(queries) {
  for (const query of queries) {
    const data = await fetchJson(`${apiBase}/searchteams.php?t=${encodeURIComponent(query)}`)
    const teams = (data.teams ?? []).filter((team) => team.strSport === 'Soccer' && team.strGender !== 'Female' && team.strBadge)
    const exact = teams.find((team) => normalize(team.strTeam) === normalize(query) && /FIFA World Cup/i.test(team.strLeague ?? ''))
      ?? teams.find((team) => normalize(team.strTeam) === normalize(query))
      ?? teams.find((team) => /FIFA World Cup/i.test(team.strLeague ?? ''))
    if (exact) return exact
  }
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (response.ok) return response.json()
      if (response.status !== 429 || attempt === 4) throw new Error(`request failed (${response.status})`)
      const retryAfter = Number(response.headers.get('retry-after')) || 15
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    } catch (error) {
      if (attempt === 4) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200))
    }
  }
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}
