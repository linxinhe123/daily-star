import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { readCsv } from './lib/csv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
const localizations = JSON.parse(await readFile(join(root, 'data/player-localizations.json'), 'utf8')).players
const dataFile = join(root, 'data/player-identities.json')
const webFile = join(root, 'apps/web/src/generated/player-identities.json')
const assetDir = join(root, 'apps/web/public/assets/players')
const databaseFile = join(root, 'data/daily-star.sqlite')
const previous = existsSync(dataFile) ? JSON.parse(await readFile(dataFile, 'utf8')).players ?? {} : {}

const identityProfileIds = { kaka: '3366' }
const verifiedPortraits = {
  'adam-wharton': { providerId: '34217528', url: 'https://r2.thesportsdb.com/images/media/player/cutout/dierqf1761492318.png', credit: 'TheSportsDB 球员抠图' },
  antony: { providerId: '34172989', url: 'https://r2.thesportsdb.com/images/media/player/cutout/vmgket1761255257.png', credit: 'TheSportsDB 球员抠图' },
  gabriel: { providerId: '34172252', url: 'https://r2.thesportsdb.com/images/media/player/cutout/trz5x71769331076.png', credit: 'TheSportsDB 球员抠图' },
  gavi: { providerId: '34193417', url: 'https://r2.thesportsdb.com/images/media/player/cutout/amm91q1726510077.png', credit: 'TheSportsDB 球员抠图' },
  'joao-pedro': { providerId: '34169326', url: 'https://r2.thesportsdb.com/images/media/player/cutout/kdguq61757010204.png', credit: 'TheSportsDB 球员抠图' },
  pedri: { providerId: '34172243', url: 'https://r2.thesportsdb.com/images/media/player/cutout/82xtuu1726509836.png', credit: 'TheSportsDB 球员抠图' },
  'reece-james': { url: 'https://resources.premierleague.com/premierleague/photos/players/250x250/p225796.png', credit: '英超官方球员抠图' },
  rodri: { providerId: '34163415', url: 'https://r2.thesportsdb.com/images/media/player/cutout/6ggnc31769182523.png', credit: 'TheSportsDB 球员抠图' },
  'sandro-tonali': { providerId: '34168180', url: 'https://r2.thesportsdb.com/images/media/player/cutout/b9oang1766824727.png', credit: 'TheSportsDB 球员抠图' },
  'tijjani-reijnders': { providerId: '34170530', url: 'https://r2.thesportsdb.com/images/media/player/cutout/edgl5b1769182353.png', credit: 'TheSportsDB 球员抠图' },
}
const targetIds = new Set([...roster.map((player) => String(player.transfermarktId)), ...Object.values(identityProfileIds)])
const profiles = new Map()
await readCsv(join(root, 'data/cache/transfermarkt/players.csv.gz'), (row) => {
  if (targetIds.has(row.player_id)) profiles.set(row.player_id, row)
})

const nationLabels = {
  Argentina: ['阿根廷', '🇦🇷'], Australia: ['澳大利亚', '🇦🇺'], Austria: ['奥地利', '🇦🇹'], Belgium: ['比利时', '🇧🇪'],
  Brazil: ['巴西', '🇧🇷'], Cameroon: ['喀麦隆', '🇨🇲'], Canada: ['加拿大', '🇨🇦'], Chile: ['智利', '🇨🇱'],
  Colombia: ['哥伦比亚', '🇨🇴'], Croatia: ['克罗地亚', '🇭🇷'], Denmark: ['丹麦', '🇩🇰'], Ecuador: ['厄瓜多尔', '🇪🇨'],
  Egypt: ['埃及', '🇪🇬'], England: ['英格兰', '🏴'], France: ['法国', '🇫🇷'], Gabon: ['加蓬', '🇬🇦'],
  Georgia: ['格鲁吉亚', '🇬🇪'], Germany: ['德国', '🇩🇪'], Ghana: ['加纳', '🇬🇭'], Guinea: ['几内亚', '🇬🇳'],
  Hungary: ['匈牙利', '🇭🇺'], Italy: ['意大利', '🇮🇹'], 'Ivory Coast': ['科特迪瓦', '🇨🇮'], Jamaica: ['牙买加', '🇯🇲'],
  Japan: ['日本', '🇯🇵'], Mali: ['马里', '🇲🇱'], Mexico: ['墨西哥', '🇲🇽'], Morocco: ['摩洛哥', '🇲🇦'],
  Netherlands: ['荷兰', '🇳🇱'], Nigeria: ['尼日利亚', '🇳🇬'], Norway: ['挪威', '🇳🇴'], Poland: ['波兰', '🇵🇱'],
  Portugal: ['葡萄牙', '🇵🇹'], Scotland: ['苏格兰', '🏴'], Senegal: ['塞内加尔', '🇸🇳'], Serbia: ['塞尔维亚', '🇷🇸'],
  Slovakia: ['斯洛伐克', '🇸🇰'], Slovenia: ['斯洛文尼亚', '🇸🇮'], Spain: ['西班牙', '🇪🇸'], Sweden: ['瑞典', '🇸🇪'],
  Switzerland: ['瑞士', '🇨🇭'], Turkey: ['土耳其', '🇹🇷'], Ukraine: ['乌克兰', '🇺🇦'], Uruguay: ['乌拉圭', '🇺🇾'],
  USA: ['美国', '🇺🇸'], Wales: ['威尔士', '🏴'], 'Bosnia-Herzegovina': ['波斯尼亚和黑塞哥维那', '🇧🇦'],
}
const positionLabels = {
  Goalkeeper: '门将', 'Centre-Back': '中后卫', 'Left-Back': '左后卫', 'Right-Back': '右后卫', Defender: '后卫',
  'Defensive Midfield': '后腰', 'Central Midfield': '中前卫', 'Attacking Midfield': '前腰', Midfield: '中场',
  'Left Winger': '左边锋', 'Right Winger': '右边锋', 'Centre-Forward': '中锋', 'Second Striker': '影锋', Attack: '前锋',
}

await mkdir(assetDir, { recursive: true })
const players = {}
const rejectedProviders = []
for (const player of roster) {
  const cached = previous[player.slug] ?? {}
  if (player.slug === 'pele') {
    players[player.slug] = {
      name: 'Pelé', zh: localizations[player.slug], nation: '巴西', flag: '🇧🇷', birthDate: '1940-10-23',
      height: '1.73 m', foot: '', position: '影锋', currentClub: '_Retired Soccer', number: 10, active: false,
      image: '', imageSource: '', imageCredit: '', descriptionEn: '', traits: [], transfermarktId: null,
      sources: [{ label: 'FIFA 贝利档案', url: 'https://www.fifa.com/fifaplus/en/articles/pele-the-king-of-football' }],
    }
    continue
  }

  const profile = profiles.get(identityProfileIds[player.slug] ?? String(player.transfermarktId))
  if (!profile) throw new Error(`Missing Transfermarkt profile for ${player.slug}`)
  const expectedBirth = profile.date_of_birth.slice(0, 10)
  const cachedBirth = String(cached.birthDate ?? '').slice(0, 10)
  const providerValid = Boolean(expectedBirth && cachedBirth && expectedBirth === cachedBirth)
  if (cached.providerId && !providerValid) rejectedProviders.push(player.slug)

  const [nation, flag] = nationLabels[profile.country_of_citizenship] ?? [profile.country_of_citizenship || '国籍待核验', '⚽']
  const retired = cached.currentClub === '_Retired Soccer' && player.lastSeason < 2025
  const currentClub = retired ? '_Retired Soccer' : profile.current_club_name || cached.currentClub || ''
  const verifiedPortrait = verifiedPortraits[player.slug]
  let image = providerValid ? cached.image || '' : ''
  let imageSource = providerValid ? cached.imageSource || '' : profile.image_url || ''
  let imageCredit = providerValid ? cached.imageCredit || '' : imageSource ? 'Transfermarkt 球员图片' : ''
  if (verifiedPortrait) {
    imageSource = verifiedPortrait.url
    imageCredit = verifiedPortrait.credit
    try { image = await downloadImage(player.slug, imageSource) }
    catch (error) { console.warn(`${player.slug}: verified portrait skipped (${error.message})`) }
  } else if (!providerValid && imageSource) {
    try { image = await downloadImage(player.slug, imageSource) }
    catch (error) { console.warn(`${player.slug}: image skipped (${error.message})`) }
  }

  players[player.slug] = {
    providerId: verifiedPortrait?.providerId ?? (providerValid ? cached.providerId : undefined),
    transfermarktId: Number(profile.player_id), name: player.name, zh: localizations[player.slug], nation, flag,
    birthDate: expectedBirth, height: profile.height_in_cm ? `${(Number(profile.height_in_cm) / 100).toFixed(2)} m` : '',
    foot: profile.foot === 'right' ? '右脚' : profile.foot === 'left' ? '左脚' : profile.foot === 'both' ? '双脚' : '',
    position: positionLabels[profile.sub_position] ?? positionLabels[profile.position] ?? '职业球员',
    currentClub, number: providerValid ? cached.number ?? null : null, active: !retired,
    image, imageSource, imageCredit,
    descriptionEn: providerValid ? cached.descriptionEn || '' : '', traits: providerValid ? cached.traits ?? [] : [],
    caps: Number(profile.international_caps || 0) || undefined,
    nationalGoals: Number(profile.international_goals || 0) || undefined,
    sources: [
      { label: 'Transfermarkt 球员资料', url: profile.url },
      ...(verifiedPortrait?.providerId ? [{ label: 'TheSportsDB 球员资料', url: `https://www.thesportsdb.com/player/${verifiedPortrait.providerId}` }] : []),
      ...(!verifiedPortrait?.providerId && providerValid && cached.providerId ? [{ label: 'TheSportsDB 球员资料', url: `https://www.thesportsdb.com/player/${cached.providerId}` }] : []),
    ],
  }
}

const output = { generatedAt: new Date().toISOString(), source: 'transfermarkt-id-verified', players }
await writeFile(dataFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
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
console.log(`Synced ${roster.length} Transfermarkt-verified identities; rejected ${rejectedProviders.length} mismatched provider records`)
if (rejectedProviders.length) console.log(`Rejected: ${rejectedProviders.join(', ')}`)

async function downloadImage(slug, url) {
  const suffix = extname(new URL(url).pathname).toLowerCase() || '.jpg'
  const target = join(assetDir, `${slug}${suffix}`)
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  return `/assets/players/${slug}${suffix}`
}
