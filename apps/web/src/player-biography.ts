import { formatClubName } from './club-names'

type BiographySeason = { season: string; club: string; appearances?: number; goals?: number }
type BiographyClubTotal = { club: string; appearances?: number; goals?: number }

export type BiographyIdentity = {
  zh?: string
  nation?: string
  position?: string
  currentClub?: string
  birthDate?: string
  height?: string
  foot?: string
  traits?: string[]
  descriptionEn?: string
}

export type BiographyRecord = {
  seasons: BiographySeason[]
  clubTotals: BiographyClubTotal[]
}

const unavailableClubs = new Set(['_Retired Soccer', '_Free Agent Soccer'])
const nationNames: Record<string, string> = {
  Australia: '澳大利亚',
  'Bosnia and Herzegovina': '波斯尼亚和黑塞哥维那',
  Ireland: '爱尔兰',
  'The Netherlands': '荷兰',
}

const roleFocus: Record<string, string> = {
  '门将': '门线技术、出击判断和后场组织',
  '中后卫': '防守选位、空中对抗和后场出球',
  '后卫': '防守判断、对抗和阵型保护',
  '左后卫': '边路覆盖、一对一防守和向前推进',
  '右后卫': '边路覆盖、一对一防守和向前推进',
  '后腰': '中场保护、接应出球和节奏衔接',
  '中前卫': '接应、推进和比赛节奏组织',
  '中场': '接应、传球和中场覆盖',
  '前腰': '转身接球、机会创造和最后一传',
  '左边锋': '边路推进、一对一突破和内切终结',
  '右边锋': '边路推进、一对一突破和内切终结',
  '边锋': '边路推进、无球冲刺和一对一突破',
  '中锋': '无球跑位、禁区对抗和门前终结',
  '前锋': '向前跑位、进攻对抗和门前终结',
}

const cleanClub = (club?: string) => club && !unavailableClubs.has(club) ? formatClubName(club) : ''
export const formatNationName = (nation?: string) => nation ? nationNames[nation] ?? nation : '国籍待核验'

const uniqueCareerClubs = (seasons: BiographySeason[]) => {
  const seen = new Set<string>()
  return seasons.flatMap(({ club }) => {
    const label = cleanClub(club)
    if (!label || seen.has(label)) return []
    seen.add(label)
    return [label]
  })
}

const joinCareer = (clubs: string[]) => clubs.length <= 1
  ? clubs[0] || ''
  : clubs.length <= 5 ? clubs.join('、') : `${clubs.slice(0, 4).join('、')}等 ${clubs.length} 家俱乐部`

const researchedAchievement = (description = '') => {
  const achievements: string[] = []
  if (/won (?:the )?(?:\d{4} )?(?:FIFA )?World Cup|World Cup winner/i.test(description)) achievements.push('曾随国家队赢得世界杯')
  if (/won (?:the )?(?:\d{4} )?Ballon d'Or|Ballon d'Or winner/i.test(description)) achievements.push('曾获得金球奖')
  if (/won (?:the )?UEFA Champions League|Champions League title/i.test(description)) achievements.push('曾登上欧洲俱乐部之巅')
  return achievements.slice(0, 2)
}

export function buildPlayerBiography(identity: BiographyIdentity | undefined, record: BiographyRecord) {
  const zh = identity?.zh || '这名球员'
  const nation = formatNationName(identity?.nation)
  const position = identity?.position || '职业球员'
  const currentClub = cleanClub(identity?.currentClub)
  const physical = [identity?.height ? `身高 ${identity.height}` : '', identity?.foot ? identity.foot === '双脚' ? '双脚均衡' : `惯用${identity.foot}` : ''].filter(Boolean).join('，')
  const clubs = uniqueCareerClubs(record.seasons)
  const primaryClub = [...record.clubTotals].sort((a, b) => (b.appearances ?? 0) - (a.appearances ?? 0))[0]
  const primaryClubLabel = cleanClub(primaryClub?.club)
  const traits = identity?.traits?.filter(Boolean) ?? []
  const focus = traits.length ? traits.join('、') : Object.entries(roleFocus).find(([key]) => position.includes(key))?.[1]
  const achievements = researchedAchievement(identity?.descriptionEn)

  return [
    `${zh}是${nation}${position}${currentClub ? `，目前效力于${currentClub}` : ''}${physical ? `，${physical}` : ''}。`,
    clubs.length ? `已覆盖的俱乐部赛事资料显示，他的生涯轨迹先后经过${joinCareer(clubs)}。` : '',
    primaryClubLabel && primaryClub ? `其中在${primaryClubLabel}的数据最为集中：${primaryClub.appearances ?? 0} 次出场${position.includes('门将') ? '' : `、${primaryClub.goals ?? 0} 粒进球`}，这一阶段最能反映他的俱乐部定位。` : '',
    focus ? `从球员资料与位置特征看，${focus}是理解他比赛方式的关键。` : '',
    achievements.length ? `${achievements.join('，并')}，这些经历构成了他职业档案中的重要坐标。` : '',
    '当前数据口径聚合已覆盖的联赛与杯赛，不将国家队比赛混入俱乐部统计。',
  ].filter(Boolean).join('')
}

export function buildFeaturedBiographySupplement(identity: BiographyIdentity | undefined, record: BiographyRecord) {
  const clubs = uniqueCareerClubs(record.seasons)
  const primaryClub = [...record.clubTotals].sort((a, b) => (b.appearances ?? 0) - (a.appearances ?? 0))[0]
  const primaryClubLabel = cleanClub(primaryClub?.club)
  if (!clubs.length || !primaryClubLabel || !primaryClub) return ''
  return ` 已覆盖的俱乐部资料串联起${joinCareer(clubs)}的生涯轨迹；其中${primaryClubLabel}阶段记录了 ${primaryClub.appearances ?? 0} 次出场${identity?.position?.includes('门将') ? '' : `和 ${primaryClub.goals ?? 0} 粒进球`}。`
}
