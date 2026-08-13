export type SeasonStat = { season: string; club: string; appearances: number; goals: number; assists: number }
export type ClubSpell = { club: string; period: string; appearances?: number; goals?: number; note?: string }
export type MarketValuePoint = { year: number; value: number; club: string }
export type HonorGroup = { category: string; total: number; items: { title: string; count: number; years: string }[] }
export type PlayerData = {
  currentClub: string
  currentValue: string
  caps: number
  nationalGoals: number
  birthDate: string
  height: string
  foot: string
  theme: { primary: string; secondary: string; accent: string }
  seasons: SeasonStat[]
  clubs: ClubSpell[]
  marketValues: MarketValuePoint[]
  honorGroups: HonorGroup[]
  sources: { label: string; url: string }[]
}

export const playerData: Record<string, PlayerData> = {
  'luka-modric': {
    currentClub: 'AC 米兰', currentValue: '€3.5m', caps: 202, nationalGoals: 29,
    birthDate: '1985-09-09', height: '1.72m', foot: '右脚',
    theme: { primary: '#16181d', secondary: '#252a33', accent: '#d7b56d' },
    seasons: [
      { season: '20/21', club: '皇家马德里', appearances: 48, goals: 6, assists: 8 },
      { season: '21/22', club: '皇家马德里', appearances: 45, goals: 3, assists: 12 },
      { season: '22/23', club: '皇家马德里', appearances: 52, goals: 6, assists: 8 },
      { season: '23/24', club: '皇家马德里', appearances: 46, goals: 2, assists: 8 },
      { season: '24/25', club: '皇家马德里', appearances: 57, goals: 4, assists: 9 },
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
      { label: 'Transfermarkt 球员资料与身价', url: 'https://www.transfermarkt.com/luka-modric/profil/spieler/27992' },
      { label: 'Real Madrid 球员档案', url: 'https://www.realmadrid.com/' },
      { label: 'UEFA 球员资料', url: 'https://www.uefa.com/' },
    ],
  },
}
