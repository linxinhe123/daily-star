import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from '../apps/web/node_modules/vite/dist/node/index.js'

const root = join(import.meta.dirname, '..')
const webRoot = join(root, 'apps/web')
const outputFile = join(root, 'data/player-content.csv')
const identities = JSON.parse(await readFile(join(root, 'apps/web/src/generated/player-identities.json'), 'utf8')).players

const vite = await createServer({
  root: webRoot,
  configFile: join(webRoot, 'vite.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const [{ players }, { playerData, getVerifiedSeasonStats }, { buildCluePool }] = await Promise.all([
    vite.ssrLoadModule('/src/players.ts'),
    vite.ssrLoadModule('/src/player-data.ts'),
    vite.ssrLoadModule('/src/player-clues.ts'),
  ])

  const headers = [
    'slug', '中文名', '英文名', '别名', '国籍', '位置', '职业年代', '球衣号码', '状态',
    '一句话标签', '详细简介', '技术特点',
    '线索1', '线索2', '线索3', '线索4', '线索5', '线索6', '线索7', '线索8',
    '代表荣誉', '生涯时间线', '生涯俱乐部', '代表比赛', '冷知识',
    '当前俱乐部', '出生日期', '身高', '惯用脚', '赛季数据量', '身价数据点数', '数据来源',
  ]

  const rows = players.map((player) => {
    const details = playerData[player.slug] ?? {}
    const identity = identities[player.slug] ?? {}
    const clues = buildCluePool(player).slice(0, 8)
    const honors = details.honorGroups?.length
      ? details.honorGroups.flatMap((group) => group.items.map((item) => `${group.category}：${item.title}×${item.count}${item.years ? `（${item.years}）` : ''}`)).join('；')
      : player.honors.join('；')
    const clubs = (details.clubs ?? []).map((club) => [
      club.club,
      club.period,
      club.appearances == null ? '' : `出场${club.appearances}`,
      club.goals == null ? '' : `进球${club.goals}`,
      club.note ?? '',
    ].filter(Boolean).join('｜')).join('；')
    const timeline = player.timeline.map((item) => [item.year, item.title, item.text].filter(Boolean).join('｜')).join('；')
    const sources = [...new Map([...(details.sources ?? []), ...(identity.sources ?? [])].map((source) => [source.url, source])).values()]
      .map((source) => `${source.label}：${source.url}`).join('；')
    const seasonCount = getVerifiedSeasonStats(player.slug, details.seasons ?? []).seasons.length

    return [
      player.slug,
      player.zh,
      player.name,
      player.aliases.join('；'),
      player.nation,
      player.position,
      player.years,
      player.number || '',
      details.retired ? '已退役' : '现役',
      player.kicker,
      player.intro,
      identity.traits?.join('；') || player.kicker,
      ...Array.from({ length: 8 }, (_, index) => clues[index] ?? ''),
      honors,
      timeline,
      clubs,
      player.match,
      player.fact,
      details.currentClub ?? '',
      details.birthDate ?? identity.birthDate ?? '',
      details.height ?? identity.height ?? '',
      details.foot ?? identity.foot ?? '',
      seasonCount,
      details.marketValues?.length ?? 0,
      sources,
    ]
  })

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  await mkdir(join(root, 'data'), { recursive: true })
  await writeFile(outputFile, `\uFEFF${csv}\r\n`, 'utf8')
  console.log(`Exported ${rows.length} players to ${outputFile}`)
} finally {
  await vite.close()
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}
