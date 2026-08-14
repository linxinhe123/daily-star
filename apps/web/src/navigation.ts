import type { Player } from './players'

export type NavigationView = 'today' | 'archive' | 'saved' | 'about'
export type NavigationState = { view: NavigationView; playerSlug?: string }

const validViews = new Set<NavigationView>(['today', 'archive', 'saved', 'about'])

export function parseLocation(players: Player[]): NavigationState {
  const params = new URLSearchParams(location.search)
  const playerSlug = params.get('player') || undefined
  if (playerSlug && players.some((player) => player.slug === playerSlug)) return { view: 'today', playerSlug }
  if (playerSlug) return { view: 'archive' }
  const requestedView = params.get('view') as NavigationView | null
  return { view: requestedView && validViews.has(requestedView) ? requestedView : 'today' }
}

const navigationUrl = (state: NavigationState) => {
  if (state.playerSlug) return `${location.pathname}?player=${encodeURIComponent(state.playerSlug)}`
  if (state.view !== 'today') return `${location.pathname}?view=${state.view}`
  return location.pathname
}

export function pushNavigation(state: NavigationState, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](state, '', navigationUrl(state))
}

export function playerUrl(slug: string) {
  return new URL(`${location.pathname}?player=${encodeURIComponent(slug)}`, location.origin).toString()
}

