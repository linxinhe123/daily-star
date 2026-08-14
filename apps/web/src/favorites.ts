const favoritesKey = 'daily-star:favorites:v1'

export function loadFavoriteSlugs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
    if (Array.isArray(parsed)) return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {}
  return new Set<string>()
}

export function saveFavoriteSlugs(slugs: Set<string>) {
  localStorage.setItem(favoritesKey, JSON.stringify([...slugs]))
}

export function toggleFavoriteSlug(slugs: Set<string>, slug: string) {
  const next = new Set(slugs)
  if (next.has(slug)) next.delete(slug)
  else next.add(slug)
  saveFavoriteSlugs(next)
  return next
}

