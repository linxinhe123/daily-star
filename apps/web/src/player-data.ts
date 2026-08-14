import generatedSeasonStats from './generated/season-stats.json'
import generatedPlayerProfiles from './generated/player-profiles.json'
import generatedFootballAssets from './generated/football-assets.json'
import generatedStatbunkerStats from './generated/statbunker-stats.json'
import generatedStatbunkerRosterStats from './generated/statbunker-roster-stats.json'
import generatedPlayerIdentities from './generated/player-identities.json'
import generatedPlayerValuations from './generated/player-valuations.json'
import generatedPlayerCareers from './generated/player-careers.json'

export type SeasonStat = { season: string; club: string; appearances: number; goals: number; assists: number; starts?: number | null; averageRating?: number | null; source?: string }
export type ClubSpell = { club: string; period: string; appearances?: number; goals?: number; note?: string }
export type MarketValuePoint = { date?: string; year: number; value: number; club: string }
export type HonorGroup = { category: string; total: number; items: { title: string; count: number; years: string }[] }
export type PlayerData = {
  currentClub: string
  retired?: boolean
  currentValue?: string
  caps?: number
  nationalGoals?: number
  birthDate?: string
  height?: string
  foot?: string
  theme: { primary: string; secondary: string; accent: string }
  seasons: SeasonStat[]
  clubs: ClubSpell[]
  marketValues: MarketValuePoint[]
  honorGroups: HonorGroup[]
  sources: { label: string; url: string }[]
}

export type VisualAsset = { src: string; short: string; kind: 'crest' | 'competition' | 'trophy' }

const wiki = (path: string) => `https://upload.wikimedia.org/wikipedia/${path}`

export const footballAssets: Record<string, VisualAsset> = {
  '萨格勒布迪纳摩': { src: '/assets/football/dinamo-zagreb.png', short: 'DIN', kind: 'crest' },
  '日林斯基': { src: '/assets/football/zrinjski.png', short: 'ZRI', kind: 'crest' },
  '国际扎普雷希奇': { src: '/assets/football/inter-zapresic.png', short: 'INT', kind: 'crest' },
  '托特纳姆热刺': { src: '/assets/football/tottenham.png', short: 'TOT', kind: 'crest' },
  '热刺': { src: '/assets/football/tottenham.png', short: 'TOT', kind: 'crest' },
  '皇家马德里': { src: '/assets/football/real-madrid.png', short: 'RMA', kind: 'crest' },
  'AC 米兰': { src: '/assets/football/ac-milan.png', short: 'ACM', kind: 'crest' },
  '克罗地亚': { src: '/assets/football/croatia.png', short: 'CRO', kind: 'crest' },
  '欧洲冠军联赛': { src: '/assets/football/champions-league.png', short: 'UCL', kind: 'trophy' },
  '西班牙甲级联赛': { src: '/assets/football/la-liga.png', short: 'LAL', kind: 'trophy' },
  '国际足联俱乐部世界杯': { src: '/assets/football/club-world-cup.png', short: 'CWC', kind: 'competition' },
  '欧洲超级杯': { src: '/assets/football/uefa-super-cup.png', short: 'USC', kind: 'competition' },
  '西班牙国王杯': { src: '/assets/football/copa-del-rey.png', short: 'CDR', kind: 'trophy' },
  '西班牙超级杯': { src: '/assets/football/supercopa.png', short: 'SCE', kind: 'trophy' },
  '克罗地亚甲级联赛': { src: '/assets/football/dinamo-zagreb.png', short: 'HNL', kind: 'competition' },
  '世界杯亚军': { src: '/assets/football/world-cup.jpg', short: 'WC', kind: 'trophy' },
  '世界杯季军': { src: '/assets/football/world-cup.jpg', short: 'WC', kind: 'trophy' },
  '欧国联亚军': { src: '/assets/football/nations-league.png', short: 'UNL', kind: 'competition' },
  '金球奖': { src: '/assets/football/ballon-dor.jpg', short: 'B.D', kind: 'trophy' },
  'FIFA 世界足球先生': { src: '/assets/football/fifa-the-best.png', short: 'FIFA', kind: 'trophy' },
  '欧足联年度最佳球员': { src: wiki('commons/thumb/7/72/UEFA_Best_Player_in_Europe_Trophy_CR7Museum.jpg/160px-UEFA_Best_Player_in_Europe_Trophy_CR7Museum.jpg'), short: 'UEFA', kind: 'trophy' },
  '世界杯金球奖': { src: '/assets/football/ballon-dor.jpg', short: 'G.B', kind: 'trophy' },
  '世界杯铜球奖': { src: '/assets/football/world-cup.jpg', short: 'B.B', kind: 'trophy' },
}

const generatedAssets = Object.fromEntries(Object.entries(generatedFootballAssets.assets).map(([name, asset]) => [name, {
  src: asset.path,
  short: name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || name.slice(0, 2),
  kind: asset.kind as VisualAsset['kind'],
}])) as Record<string, VisualAsset>

export const getFootballAsset = (name: string) => footballAssets[name] ?? generatedAssets[name]

type GeneratedSeason = SeasonStat & { seasonStart: number; clubId: number }
type GeneratedPlayerStats = { coverage: 'partial'; updatedAt: string; seasons: GeneratedSeason[] }
const generatedStats = generatedSeasonStats as Record<string, GeneratedPlayerStats>
const clubNames: Record<string, string> = {
  'Real Madrid': '皇家马德里',
  'AC Milan': 'AC 米兰',
  'FC Barcelona': '巴塞罗那',
  'Paris Saint-Germain': '巴黎圣日耳曼',
  'Club Internacional de Futbol Miami': '迈阿密国际',
  'Club Internacional de Fútbol Miami': '迈阿密国际',
}

export function getVerifiedSeasonStats(slug: string, fallback: SeasonStat[] = []) {
  const rosterSeasons = (generatedStatbunkerRosterStats.players as Record<string, { seasons: SeasonStat[] }>)[slug]?.seasons ?? []
  if (rosterSeasons.length) return {
    seasons: rosterSeasons.map((row) => ({ ...row, club: clubNames[row.club] ?? row.club })),
    coverage: 'configured-competitions' as const,
    updatedAt: generatedStatbunkerRosterStats.generatedAt,
  }
  const snapshot = generatedStats[slug]
  const statbunker = (generatedStatbunkerStats as Record<string, { seasons: SeasonStat[] }>)[slug]?.seasons ?? []
  if (!snapshot?.seasons.length && !statbunker.length) return { seasons: fallback, coverage: 'curated' as const, updatedAt: undefined }
  const seasons: SeasonStat[] = (snapshot?.seasons ?? []).map(({ season, club, appearances, goals, assists, starts, averageRating, source }) => ({
    season, club: clubNames[club] ?? club, appearances, goals, assists, starts, averageRating, source,
  }))
  for (const row of statbunker) {
    const normalized = { ...row, club: clubNames[row.club] ?? row.club }
    const index = seasons.findIndex((season) => season.season === normalized.season && season.club === normalized.club)
    if (index >= 0) seasons[index] = normalized
    else seasons.push(normalized)
  }
  seasons.sort((a, b) => a.season.localeCompare(b.season))
  return {
    seasons,
    coverage: statbunker.length ? 'listed-competitions' as const : snapshot?.coverage,
    updatedAt: snapshot?.updatedAt,
  }
}

const curatedPlayerData: Record<string, PlayerData> = {
  'luka-modric': {
    currentClub: 'AC 米兰', currentValue: '€3.5m', caps: 202, nationalGoals: 29,
    birthDate: '1985-09-09', height: '1.72m', foot: '右脚',
    theme: { primary: '#16181d', secondary: '#252a33', accent: '#d7b56d' },
    seasons: [
      { season: '20/21', club: '皇家马德里', appearances: 47, starts: 42, goals: 6, assists: 6, source: 'statbunker' },
      { season: '21/22', club: '皇家马德里', appearances: 41, starts: 37, goals: 2, assists: 12, source: 'statbunker' },
      { season: '22/23', club: '皇家马德里', appearances: 43, starts: 28, goals: 6, assists: 4, source: 'statbunker' },
      { season: '23/24', club: '皇家马德里', appearances: 42, starts: 20, goals: 2, assists: 6, source: 'statbunker' },
      { season: '24/25', club: '皇家马德里', appearances: 49, starts: 24, goals: 2, assists: 9, source: 'statbunker' },
    ],
    clubs: [
      { club: '萨格勒布迪纳摩', period: '2003–2008', appearances: 94, goals: 26, note: '含外租成长阶段' },
      { club: '日林斯基', period: '2003–2004', appearances: 22, goals: 8, note: '外租' },
      { club: '国际扎普雷希奇', period: '2004–2005', appearances: 18, goals: 4, note: '外租' },
      { club: '托特纳姆热刺', period: '2008–2012', appearances: 159, goals: 17 },
      { club: '皇家马德里', period: '2012–2025', appearances: 597, goals: 43 },
      { club: 'AC 米兰', period: '2025–至今', note: '自由转会加盟' },
    ],
    marketValues: [
      { year: 2006, value: 5, club: '萨格勒布迪纳摩' }, { year: 2008, value: 20, club: '热刺' },
      { year: 2010, value: 25, club: '热刺' }, { year: 2012, value: 40, club: '皇家马德里' },
      { year: 2014, value: 55, club: '皇家马德里' }, { year: 2016, value: 45, club: '皇家马德里' },
      { year: 2018, value: 25, club: '皇家马德里' }, { year: 2020, value: 12, club: '皇家马德里' },
      { year: 2022, value: 10, club: '皇家马德里' }, { year: 2024, value: 6, club: '皇家马德里' },
      { year: 2026, value: 3.5, club: 'AC 米兰' },
    ],
    honorGroups: [
      { category: '俱乐部荣誉', total: 30, items: [
        { title: '欧洲冠军联赛', count: 6, years: '2014, 2016, 2017, 2018, 2022, 2024' },
        { title: '西班牙甲级联赛', count: 4, years: '2017, 2020, 2022, 2024' },
        { title: '国际足联俱乐部世界杯', count: 5, years: '2014, 2016, 2017, 2018, 2022' },
        { title: '欧洲超级杯', count: 5, years: '2014, 2016, 2017, 2022, 2024' },
        { title: '西班牙国王杯', count: 2, years: '2014, 2023' },
        { title: '西班牙超级杯', count: 5, years: '2012, 2017, 2020, 2022, 2024' },
        { title: '克罗地亚甲级联赛', count: 3, years: '2006, 2007, 2008' },
      ]},
      { category: '国家队成绩', total: 3, items: [
        { title: '世界杯亚军', count: 1, years: '2018' },
        { title: '世界杯季军', count: 1, years: '2022' },
        { title: '欧国联亚军', count: 1, years: '2023' },
      ]},
      { category: '个人奖项', total: 5, items: [
        { title: '金球奖', count: 1, years: '2018' },
        { title: 'FIFA 世界足球先生', count: 1, years: '2018' },
        { title: '欧足联年度最佳球员', count: 1, years: '2018' },
        { title: '世界杯金球奖', count: 1, years: '2018' },
        { title: '世界杯铜球奖', count: 1, years: '2022' },
      ]},
    ],
    sources: [
      { label: 'TheSportsDB 俱乐部与国家队标识', url: 'https://www.thesportsdb.com/' },
      { label: 'Transfermarkt 球员资料与身价', url: 'https://www.transfermarkt.com/luka-modric/profil/spieler/27992' },
      { label: 'Real Madrid 球员档案', url: 'https://www.realmadrid.com/' },
      { label: 'UEFA 球员资料', url: 'https://www.uefa.com/' },
    ],
  },
}

type GeneratedIdentity = {
  birthDate?: string
  height?: string
  foot?: string
  position?: string
  currentClub?: string
  active?: boolean
  sources?: { label: string; url: string }[]
}

type RosterProfile = {
  lastSeason?: number
  seasons: { season: string; club: string }[]
  clubTotals: { club: string; appearances: number; goals: number }[]
}

type GeneratedCareer = {
  spells: { club: string; start?: string; end?: string }[]
}

const profileThemes = [
  { primary: '#17223a', secondary: '#2e4c70', accent: '#8fc5e8' },
  { primary: '#2b1c24', secondary: '#6a3445', accent: '#efb2bf' },
  { primary: '#172923', secondary: '#315d4c', accent: '#a8d8bf' },
  { primary: '#292319', secondary: '#65543a', accent: '#e5c98e' },
]

function seasonStart(label: string) {
  const value = Number.parseInt(label.slice(0, 2), 10)
  return value > 70 ? 1900 + value : 2000 + value
}

const clubAliases: Record<string, string> = {
  'FC Barcelona': 'Barcelona',
  'Paris Saint-Germain': 'PSG',
  'Manchester City': 'Man City',
  'Manchester United': 'Man Utd',
  'Tottenham Hotspur': 'Tottenham',
  'Bayer Leverkusen': 'Leverkusen',
  'Borussia Dortmund': 'Dortmund',
  'Bayern Munich': 'Bayern Munich',
  'Atletico Madrid': 'Atletico Madrid',
  'Atlético': 'Atletico Madrid',
  'Inter Milan': 'Inter',
  'AS Roma': 'Roma',
  'Olympique Lyon': 'Lyon',
  'Los Angeles FC': 'LAFC',
  'Sao Paulo': 'São Paulo',
}

function normalizedClub(value: string) {
  const aliased = clubAliases[value] ?? value
  return aliased.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function formatCareerPeriod(start = '', end = '') {
  const startYear = start.slice(0, 4) || '未知'
  const endYear = end.slice(0, 4)
  return `${startYear}–${endYear || '至今'}`
}

function buildCareerClubs(slug: string, record: RosterProfile, fallback: ClubSpell[]) {
  const career = (generatedPlayerCareers.players as Record<string, GeneratedCareer>)[slug]
  if (!career?.spells.length) return fallback

  const occurrenceCount = new Map<string, number>()
  career.spells.forEach((spell) => {
    const key = normalizedClub(spell.club)
    occurrenceCount.set(key, (occurrenceCount.get(key) ?? 0) + 1)
  })

  return career.spells.map((spell): ClubSpell => {
    const key = normalizedClub(spell.club)
    const total = record.clubTotals.find((candidate) => normalizedClub(candidate.club) === key)
    const canAttachAggregate = Boolean(total) && occurrenceCount.get(key) === 1
    return {
      club: spell.club,
      period: formatCareerPeriod(spell.start, spell.end),
      appearances: canAttachAggregate ? total!.appearances : undefined,
      goals: canAttachAggregate ? total!.goals : undefined,
      note: canAttachAggregate ? '已覆盖赛事统计' : undefined,
    }
  })
}

const automaticPlayerData = Object.fromEntries(Object.entries(generatedStatbunkerRosterStats.players as Record<string, RosterProfile>).map(([slug, record]) => {
  const identity = (generatedPlayerIdentities.players as Record<string, GeneratedIdentity>)[slug] ?? {}
  const latest = record.seasons[record.seasons.length - 1]
  const retired = identity.currentClub === '_Retired Soccer' && (record.lastSeason ?? 0) < 2025
  const currentClub = normalizeCurrentClub(identity.currentClub || latest?.club || '')
  const fallbackClubs = record.clubTotals.map((total): ClubSpell => {
    const seasons = record.seasons.filter(row => row.club === total.club).map(row => seasonStart(row.season))
    const first = Math.min(...seasons)
    const last = Math.max(...seasons) + 1
    return {
      club: total.club,
      period: `${first}–${!retired && total.club === currentClub ? '至今' : last}`,
      appearances: total.appearances,
      goals: total.goals,
      note: '已覆盖赛事统计',
    }
  })
  const themeIndex = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % profileThemes.length
  return [slug, {
    currentClub,
    retired,
    birthDate: identity.birthDate || undefined,
    height: identity.height || undefined,
    foot: identity.foot || undefined,
    theme: profileThemes[themeIndex]!,
    seasons: [],
    clubs: buildCareerClubs(slug, record, fallbackClubs),
    marketValues: [],
    honorGroups: [],
    sources: [...(identity.sources ?? []), { label: 'StatBunker 俱乐部比赛数据', url: 'https://www.statbunker.com/' }],
  } satisfies PlayerData]
}))

const mergedPlayerData: Record<string, PlayerData> = {
  ...automaticPlayerData,
  ...Object.fromEntries(Object.entries(generatedPlayerProfiles.players).map(([slug, profile]) => [slug, { ...profile, seasons: [] }])),
  ...curatedPlayerData,
}

export function normalizeCurrentClub(value = '') {
  if (value === '_Retired Soccer' || value === '_Free Agent Soccer') return ''
  return value
}

export const playerData: Record<string, PlayerData> = Object.fromEntries(Object.entries(mergedPlayerData).map(([slug, data]) => {
  const identity = (generatedPlayerIdentities.players as Record<string, GeneratedIdentity>)[slug]
  const record = (generatedStatbunkerRosterStats.players as Record<string, RosterProfile>)[slug]
  const retired = (identity?.currentClub === '_Retired Soccer' && (record?.lastSeason ?? 0) < 2025) || data.retired === true
  const valuation = slug === 'kaka' ? [] : (generatedPlayerValuations.players as Record<string, { points: MarketValuePoint[] }>)[slug]?.points ?? []
  const latestValue = valuation[valuation.length - 1]?.value
  return [slug, {
    ...data,
    currentClub: normalizeCurrentClub(data.currentClub),
    currentValue: retired ? undefined : latestValue ? `€${latestValue}m` : data.currentValue,
    marketValues: valuation.length ? valuation : data.marketValues,
    retired,
  }]
}))
