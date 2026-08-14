import type { Player } from './players'

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()

export function buildCluePool(player: Player): string[] {
  const clubs = [...new Set(player.timeline.map((item) => item.title).filter(Boolean))]
  const generated = [
    `我代表${player.nation}足球。`,
    `我主要司职${player.position}。`,
    `我的职业生涯年代跨度是 ${player.years}。`,
    clubs.length > 1 ? `已核验的生涯轨迹中包含 ${clubs.length} 家俱乐部。` : '',
    clubs.length ? `我曾效力于${clubs.slice(0, 2).join('和')}。` : '',
    player.number ? `我的档案球衣号码是 ${player.number} 号。` : '',
    player.fact && !player.fact.includes(player.zh) ? player.fact : '',
    player.kicker && !player.kicker.includes(player.zh) ? `技术档案评价：${player.kicker}。` : '',
  ]

  return [...new Set([...player.clues, ...generated].map(compact).filter(Boolean))]
}

