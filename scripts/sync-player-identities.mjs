import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
const localizations = JSON.parse(await readFile(join(root, 'data/player-localizations.json'), 'utf8')).players
const dataFile = join(root, 'data/player-identities.json')
const webFile = join(root, 'apps/web/src/generated/player-identities.json')
const assetDir = join(root, 'apps/web/public/assets/players')
const databaseFile = join(root, 'data/daily-star.sqlite')
const previous = existsSync(dataFile) ? JSON.parse(await readFile(dataFile, 'utf8')).players ?? {} : {}
const knownProviderIds = { 'alexander-isak': '34163447' }
const deepMode = process.argv.includes('--deep')

const nations = {
  Argentina: ['阿根廷', '🇦🇷'], Austria: ['奥地利', '🇦🇹'], Belgium: ['比利时', '🇧🇪'], Brazil: ['巴西', '🇧🇷'],
  Cameroon: ['喀麦隆', '🇨🇲'], Canada: ['加拿大', '🇨🇦'], Chile: ['智利', '🇨🇱'], Colombia: ['哥伦比亚', '🇨🇴'],
  Croatia: ['克罗地亚', '🇭🇷'], Denmark: ['丹麦', '🇩🇰'], Ecuador: ['厄瓜多尔', '🇪🇨'], Egypt: ['埃及', '🇪🇬'],
  England: ['英格兰', '🏴'], France: ['法国', '🇫🇷'], Gabon: ['加蓬', '🇬🇦'], Georgia: ['格鲁吉亚', '🇬🇪'],
  Germany: ['德国', '🇩🇪'], Ghana: ['加纳', '🇬🇭'], Guinea: ['几内亚', '🇬🇳'], Hungary: ['匈牙利', '🇭🇺'],
  Italy: ['意大利', '🇮🇹'], 'Ivory Coast': ['科特迪瓦', '🇨🇮'], Jamaica: ['牙买加', '🇯🇲'], Japan: ['日本', '🇯🇵'],
  Mali: ['马里', '🇲🇱'], Mexico: ['墨西哥', '🇲🇽'], Morocco: ['摩洛哥', '🇲🇦'], Netherlands: ['荷兰', '🇳🇱'],
  Nigeria: ['尼日利亚', '🇳🇬'], Norway: ['挪威', '🇳🇴'], Poland: ['波兰', '🇵🇱'], Portugal: ['葡萄牙', '🇵🇹'],
  Scotland: ['苏格兰', '🏴'], Senegal: ['塞内加尔', '🇸🇳'], Serbia: ['塞尔维亚', '🇷🇸'], Slovakia: ['斯洛伐克', '🇸🇰'],
  Slovenia: ['斯洛文尼亚', '🇸🇮'], 'South Korea': ['韩国', '🇰🇷'], Spain: ['西班牙', '🇪🇸'], Sweden: ['瑞典', '🇸🇪'],
  Switzerland: ['瑞士', '🇨🇭'], Turkey: ['土耳其', '🇹🇷'], Ukraine: ['乌克兰', '🇺🇦'], Uruguay: ['乌拉圭', '🇺🇾'],
  USA: ['美国', '🇺🇸'], Wales: ['威尔士', '🏴']
}
const positions = {
  Goalkeeper: '门将', Defender: '后卫', 'Centre-Back': '中后卫', 'Left-Back': '左后卫', 'Right-Back': '右后卫',
  Midfielder: '中场', Midfield: '中场', 'Central Midfield': '中前卫', 'Defensive Midfield': '后腰', 'Attacking Midfield': '前腰',
  Forward: '前锋', Attack: '前锋', 'Centre-Forward': '中锋', 'Left Winger': '左边锋', 'Right Winger': '右边锋', 'Second Striker': '影锋'
}

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))
let lastRequestAt = 0

async function waitForRateSlot() {
  const remaining = 2200 - (Date.now() - lastRequestAt)
  if (remaining > 0) await pause(remaining)
  lastRequestAt = Date.now()
}

async function requestJson(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await waitForRateSlot()
      const response = await fetch(url, { headers: { 'User-Agent': 'daily-star-profile-sync/1.0' }, signal: AbortSignal.timeout(20000) })
      if (response.status === 429) {
        await pause(20000)
        throw new Error('429 Too Many Requests')
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await pause(attempt * 700)
    }
  }
  throw lastError
}

async function downloadImage(slug, url) {
  if (!url) return ''
  const suffix = extname(new URL(url).pathname).toLowerCase() === '.png' ? '.png' : '.jpg'
  const target = join(assetDir, `${slug}${suffix}`)
  if (!existsSync(target)) {
    const response = await fetch(url, { headers: { 'User-Agent': 'daily-star-profile-sync/1.0' }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`image ${response.status}`)
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
  }
  return `/assets/players/${slug}${suffix}`
}

function extractTraits(description = '') {
  const rules = [
    [/finishing|clinical|goalscor/i, '门前终结'], [/pace|speed|quick/i, '速度与冲击'], [/dribbl/i, '盘带突破'],
    [/technical|technique/i, '技术能力'], [/passing|playmak/i, '传球组织'], [/vision/i, '比赛视野'],
    [/physical|strength|power/i, '身体对抗'], [/aerial|heading/i, '空中能力'], [/versatil/i, '多位置适应'],
    [/defensive|tackling/i, '防守判断'], [/leadership/i, '领导力'], [/creativ/i, '进攻创造力'],
    [/crossing/i, '传中'], [/shot.stop|reflex/i, '扑救反应']
  ]
  return rules.filter(([pattern]) => pattern.test(description)).map(([, label]) => label).slice(0, 3)
}

async function fetchIdentity(player) {
  const cached = previous[player.slug]
  if (cached?.providerId && cached?.nation && (!deepMode || cached?.descriptionEn)) return {
    ...cached,
    name: player.name,
    zh: localizations[player.slug],
    traits: cached.traits ?? extractTraits(cached.descriptionEn),
  }
  let providerId = cached?.providerId ?? knownProviderIds[player.slug]
  try {
    let record
    if (!providerId) {
      const search = await requestJson(`https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(player.name)}`)
      const candidates = search.player ?? []
      const match = candidates.find(item => normalize(item.strPlayer) === normalize(player.name)) ?? candidates[0]
      providerId = match?.idPlayer
      record = match
    }
    if (!providerId) throw new Error('no player match')
    if (!record && (deepMode || player.slug === 'alexander-isak' || cached?.providerId)) {
      const lookup = await requestJson(`https://www.thesportsdb.com/api/v1/json/123/lookupplayer.php?id=${providerId}`)
      record = lookup.players?.[0]
    }
    if (!record) throw new Error('empty player lookup')
    const imageSource = record.strCutout || record.strThumb || ''
    let image = cached?.image ?? ''
    try { image = await downloadImage(player.slug, imageSource) } catch (error) { console.warn(`${player.slug}: image skipped (${error.message})`) }
    const [nation, flag] = nations[record.strNationality] ?? [record.strNationality || '国籍未知', '⚽']
    return {
      providerId: String(providerId), transfermarktId: player.transfermarktId ?? null,
      name: player.name, zh: localizations[player.slug], nation, flag,
      birthDate: record.dateBorn || '', height: record.strHeight?.match(/[0-9.]+\s*m/i)?.[0] ?? '',
      foot: record.strSide === 'Right' ? '右脚' : record.strSide === 'Left' ? '左脚' : record.strSide === 'Both' ? '双脚' : '',
      position: positions[record.strPosition] ?? positions[player.position] ?? '职业球员',
      currentClub: record.strTeam || '', number: Number.parseInt(record.strNumber, 10) || null,
      active: record.strStatus === 'Active' || player.lastSeason >= 2025,
      image, imageSource, imageCredit: imageSource ? 'TheSportsDB 球员图片' : '',
      descriptionEn: record.strDescriptionEN || '',
      traits: extractTraits(record.strDescriptionEN),
      sources: [{ label: 'TheSportsDB 球员资料', url: `https://www.thesportsdb.com/player/${providerId}` }]
    }
  } catch (error) {
    console.warn(`${player.slug}: ${error.message}`)
    return {
      ...(cached ?? {}), transfermarktId: player.transfermarktId ?? cached?.transfermarktId ?? null,
      name: player.name, zh: localizations[player.slug], position: cached?.position ?? positions[player.position] ?? '职业球员',
      active: player.lastSeason >= 2025, sources: cached?.sources ?? []
    }
  }
}

const missingNames = roster.filter(player => !localizations[player.slug])
if (missingNames.length) throw new Error(`Missing Chinese names: ${missingNames.map(player => player.slug).join(', ')}`)

await mkdir(assetDir, { recursive: true })
const players = { ...previous }
let cursor = 0
async function worker() {
  while (cursor < roster.length) {
    const index = cursor++
    const player = roster[index]
    players[player.slug] = await fetchIdentity(player)
    console.log(`[${index + 1}/${roster.length}] ${player.slug} -> ${players[player.slug].zh}`)
    if ((index + 1) % 10 === 0) await writeFile(dataFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), players }, null, 2)}\n`)
  }
}
await worker()

const output = { generatedAt: new Date().toISOString(), players }
await mkdir(dirname(webFile), { recursive: true })
await writeFile(dataFile, `${JSON.stringify(output, null, 2)}\n`)
await copyFile(dataFile, webFile)

const database = new DatabaseSync(databaseFile)
database.exec('CREATE TABLE IF NOT EXISTS player_bio_profiles (player_slug TEXT PRIMARY KEY, identity_json TEXT NOT NULL, updated_at TEXT NOT NULL)')
const statement = database.prepare('INSERT OR REPLACE INTO player_bio_profiles (player_slug, identity_json, updated_at) VALUES (?, ?, ?)')
database.exec('BEGIN')
try {
  for (const [slug, identity] of Object.entries(players)) statement.run(slug, JSON.stringify(identity), output.generatedAt)
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

const withProvider = Object.values(players).filter(player => player.providerId).length
const withImage = Object.values(players).filter(player => player.image).length
console.log(`Synced ${roster.length} identities: ${withProvider} provider matches, ${withImage} local images, ${missingNames.length} missing Chinese names`)
