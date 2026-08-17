import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const careers = JSON.parse(await readFile(join(root, 'apps/web/src/generated/player-careers.json'), 'utf8')).players
const assets = Object.values(JSON.parse(await readFile(join(root, 'apps/web/src/generated/football-assets.json'), 'utf8')).assets)
const content = JSON.parse(await readFile(join(root, 'apps/web/src/generated/player-content-overrides.json'), 'utf8')).players
const reversedPeriods = []
const missingCareerBadges = []
const directNameLeaks = []

for (const [slug, player] of Object.entries(careers)) {
  for (const spell of player.spells ?? []) {
    if (spell.start && spell.end && spell.start > spell.end) reversedPeriods.push({ slug, ...spell })
    if (spell.clubId && !assets.some((asset) => asset.providerId === `tm:${spell.clubId}`)) missingCareerBadges.push({ slug, ...spell })
  }
}

for (const [slug, player] of Object.entries(content)) {
  const names = [player.zh, player.name, ...(player.aliases ?? [])].map(normalize).filter((name) => name.length >= 2)
  for (const clue of player.clues ?? []) {
    if (names.some((name) => normalize(clue).includes(name))) directNameLeaks.push({ slug, clue })
  }
}

const deGea = careers['david-de-gea'].spells.map((spell) => ({
  club: spell.club,
  start: spell.start,
  end: spell.end,
  badge: assets.find((asset) => asset.providerId === `tm:${spell.clubId}`)?.path,
}))
const staleBaleClue = '我曾效力于加盟南安普顿，开启新的俱乐部阶段和贝尔的职业生涯始于南安普顿，司职左后卫，2007年转会热刺。'
const staleBaleAccepted = content['gareth-bale'].clues.includes(staleBaleClue)

console.log(JSON.stringify({
  careerPlayers: Object.keys(careers).length,
  reversedPeriods: reversedPeriods.length,
  missingCareerBadges: missingCareerBadges.length,
  directNameLeaks: directNameLeaks.length,
  staleBaleAccepted,
  deGea,
}, null, 2))

if (reversedPeriods.length || directNameLeaks.length || staleBaleAccepted || deGea.some((spell) => !spell.badge)) process.exitCode = 1

function normalize(value = '') {
  return String(value).toLowerCase().replace(/[\s·.\-_'’]/g, '')
}
