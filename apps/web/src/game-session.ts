import type { Player } from './players'
import { buildCluePool } from './player-clues'

export type GameStatus = 'playing' | 'won' | 'revealed'
export type GameSession = {
  id: string
  playerSlug: string
  clues: string[]
  attempt: number
  status: GameStatus
  message: string
}

export type GameStats = { played: number; won: number }

const sessionKey = 'daily-star:game-session:v2'
const statsKey = 'daily-star:game-stats:v2'

const shuffled = <T>(items: T[]) => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!]
  }
  return result
}

export const playablePlayers = (players: Player[]) => players.filter((player) => buildCluePool(player).length >= 5)

export function createRandomGame(players: Player[], previousSlug?: string): GameSession {
  const playable = playablePlayers(players)
  const alternatives = playable.filter((player) => player.slug !== previousSlug)
  const pool = alternatives.length ? alternatives : playable
  const selected = pool[Math.floor(Math.random() * pool.length)]
  if (!selected) throw new Error('暂无资料完整的可玩球员')
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    playerSlug: selected.slug,
    clues: shuffled(buildCluePool(selected)).slice(0, 5),
    attempt: 0,
    status: 'playing',
    message: '',
  }
}

export function loadGameSession(players: Player[]): GameSession {
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionKey) || '') as GameSession
    const player = players.find((item) => item.slug === parsed.playerSlug)
    const currentClues = player ? new Set(buildCluePool(player)) : new Set<string>()
    const cluesAreCurrent = parsed.clues?.length === 5 && parsed.clues.every((clue) => currentClues.has(clue))
    if (player && cluesAreCurrent && ['playing', 'won', 'revealed'].includes(parsed.status)) return parsed
  } catch {}
  return createRandomGame(players)
}

export function saveGameSession(session: GameSession) {
  localStorage.setItem(sessionKey, JSON.stringify(session))
}

export function loadGameStats(): GameStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(statsKey) || '') as GameStats
    if (Number.isFinite(parsed.played) && Number.isFinite(parsed.won)) return parsed
  } catch {}
  return { played: 0, won: 0 }
}

export function saveGameStats(stats: GameStats) {
  localStorage.setItem(statsKey, JSON.stringify(stats))
}
