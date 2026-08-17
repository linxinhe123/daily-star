import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readCsv } from './lib/csv.mjs'

const root = join(import.meta.dirname, '..')
const inputFile = resolve(process.argv[2] ?? join(root, 'data/player-content.csv'))
const canonicalCsv = join(root, 'data/player-content.csv')
const dataFile = join(root, 'data/player-content-overrides.json')
const webFile = join(root, 'apps/web/src/generated/player-content-overrides.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
const rosterSlugs = new Set(roster.map((player) => player.slug))

const requiredHeaders = [
  'slug', '中文名', '英文名', '别名', '国籍', '位置', '职业年代', '球衣号码', '状态',
  '一句话标签', '详细简介', '技术特点',
  '线索1', '线索2', '线索3', '线索4', '线索5', '线索6', '线索7', '线索8',
  '代表荣誉', '生涯时间线', '生涯俱乐部', '代表比赛', '冷知识',
  '当前俱乐部', '出生日期', '身高', '惯用脚', '赛季数据量', '身价数据点数', '数据来源',
]

const rows = []
await readCsv(inputFile, (row) => rows.push(row))
if (!rows.length) throw new Error('CSV contains no player rows')
const actualHeaders = Object.keys(rows[0])
const missingHeaders = requiredHeaders.filter((header) => !actualHeaders.includes(header))
if (missingHeaders.length) throw new Error(`Missing CSV headers: ${missingHeaders.join(', ')}`)

const seen = new Set()
for (const row of rows) {
  if (!row.slug) throw new Error('CSV contains a row without slug')
  if (seen.has(row.slug)) throw new Error(`Duplicate slug: ${row.slug}`)
  if (!rosterSlugs.has(row.slug)) throw new Error(`Unknown slug: ${row.slug}`)
  seen.add(row.slug)
}
const missingSlugs = [...rosterSlugs].filter((slug) => !seen.has(slug))
if (missingSlugs.length) throw new Error(`CSV is missing roster players: ${missingSlugs.join(', ')}`)

const generatedAt = new Date().toISOString()
const players = Object.fromEntries(rows.map((row) => [row.slug, toContent(row)]))
const payload = {
  generatedAt,
  source: basename(inputFile),
  playerCount: rows.length,
  players,
}

await mkdir(dirname(dataFile), { recursive: true })
await mkdir(dirname(webFile), { recursive: true })
await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
await copyFile(dataFile, webFile)
if (inputFile !== canonicalCsv) await copyFile(inputFile, canonicalCsv)

const database = new DatabaseSync(databaseFile)
database.exec(`
  CREATE TABLE IF NOT EXISTS player_content_overrides (
    player_slug TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,
    source_file TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  DELETE FROM player_content_overrides;
`)
const statement = database.prepare('INSERT INTO player_content_overrides VALUES (?, ?, ?, ?)')
database.exec('BEGIN')
try {
  for (const [slug, content] of Object.entries(players)) {
    statement.run(slug, JSON.stringify(content), payload.source, generatedAt)
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

console.log(`Imported ${rows.length} player content records from ${inputFile}`)

function toContent(row) {
  return {
    zh: row['中文名'].trim(),
    name: row['英文名'].trim(),
    aliases: split(row['别名']),
    nation: row['国籍'].trim(),
    position: row['位置'].trim(),
    years: row['职业年代'].trim(),
    number: numberOrZero(row['球衣号码']),
    retired: row['状态'].trim() === '已退役',
    kicker: row['一句话标签'].trim(),
    intro: row['详细简介'].trim(),
    traits: split(row['技术特点']),
    clues: Array.from({ length: 8 }, (_, index) => row[`线索${index + 1}`].trim()).filter(Boolean),
    // The CSV column is editorial prose, not a verified list of trophy records.
    honorsSummary: row['代表荣誉'].trim(),
    timeline: parseTimeline(row['生涯时间线']),
    clubs: parseClubs(row['生涯俱乐部']),
    match: row['代表比赛'].trim(),
    fact: row['冷知识'].trim(),
    currentClub: row['当前俱乐部'].trim(),
    birthDate: row['出生日期'].trim(),
    height: row['身高'].trim(),
    foot: row['惯用脚'].trim(),
    sourcesText: row['数据来源'].trim(),
  }
}

function split(value = '') {
  return value.split('；').map((item) => item.trim()).filter(Boolean)
}

function numberOrZero(value = '') {
  return Number.parseInt(value, 10) || 0
}

function parseTimeline(value = '') {
  return split(value).map((item) => {
    const [year = '', title = '', ...text] = item.split('｜')
    return { year: year.trim(), title: title.trim(), text: text.join('｜').trim() }
  }).filter((item) => item.year || item.title || item.text)
}

function parseClubs(value = '') {
  return split(value).map((item) => {
    const [club = '', period = '', ...details] = item.split('｜').map((part) => part.trim())
    const appearanceText = details.find((part) => /^出场\d+/.test(part))
    const goalText = details.find((part) => /^进球\d+/.test(part))
    const note = details.filter((part) => part !== appearanceText && part !== goalText).join('｜')
    return {
      club,
      period,
      appearances: appearanceText ? Number.parseInt(appearanceText.slice(2), 10) : undefined,
      goals: goalText ? Number.parseInt(goalText.slice(2), 10) : undefined,
      note: note || undefined,
    }
  }).filter((item) => item.club)
}
