import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8'))
const identities = JSON.parse(await readFile(join(root, 'data/player-identities.json'), 'utf8')).players
const stats = JSON.parse(await readFile(join(root, 'apps/web/src/generated/statbunker-roster-stats.json'), 'utf8')).players
const careerOverrides = JSON.parse(await readFile(join(root, 'data/retired-career-overrides.json'), 'utf8'))
const cacheDir = join(root, 'data/cache/transfermarkt')
const transfersFile = join(cacheDir, 'transfers.csv.gz')
const outputFile = join(root, 'apps/web/src/generated/player-careers.json')
const databaseFile = join(root, 'data/daily-star.sqlite')
const baseUrl = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data'

await mkdir(cacheDir, { recursive: true })
await download(`${baseUrl}/transfers.csv.gz`, transfersFile)

const targets = new Map(roster.players.map((player) => [String(player.transfermarktId), player]))
const transfersBySlug = new Map(roster.players.map((player) => [player.slug, []]))
await readCsvGzip(transfersFile, (row) => {
  const player = targets.get(row.player_id)
  if (!player || !row.transfer_date) return
  transfersBySlug.get(player.slug).push({
    date: row.transfer_date,
    from: row.from_club_name || '',
    to: row.to_club_name || '',
  })
})

const generatedAt = new Date().toISOString()
const players = Object.fromEntries(roster.players.map((player) => {
  const identity = identities[player.slug] ?? {}
  const transfers = transfersBySlug.get(player.slug).sort((a, b) => a.date.localeCompare(b.date))
  const retired = identity.currentClub === '_Retired Soccer' && (stats[player.slug]?.lastSeason ?? 0) < 2025
  const override = careerOverrides[player.slug]
  return [player.slug, {
    transfermarktId: player.transfermarktId,
    spells: override?.map((spell) => ({ ...spell, source: 'curated-transfermarkt-career' })) ?? buildSpells(transfers, identity.descriptionEn || '', !retired),
  }]
}))

const database = new DatabaseSync(databaseFile)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS player_career_spells (
    player_slug TEXT NOT NULL,
    transfermarkt_id INTEGER NOT NULL,
    sequence INTEGER NOT NULL,
    club_name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (player_slug, sequence)
  );
`)
const clear = database.prepare('DELETE FROM player_career_spells WHERE player_slug = ?')
const insert = database.prepare('INSERT INTO player_career_spells VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
database.exec('BEGIN')
try {
  for (const [slug, player] of Object.entries(players)) {
    clear.run(slug)
    player.spells.forEach((spell, index) => insert.run(slug, player.transfermarktId, index, spell.club, spell.start || null, spell.end || null, spell.source, generatedAt))
  }
  database.exec('COMMIT')
} catch (error) {
  database.exec('ROLLBACK')
  throw error
} finally {
  database.close()
}

await writeFile(outputFile, `${JSON.stringify({ generatedAt, players }, null, 2)}\n`, 'utf8')
const covered = Object.values(players).filter((player) => player.spells.length).length
const retired = roster.players.filter((player) => identities[player.slug]?.currentClub === '_Retired Soccer' && (stats[player.slug]?.lastSeason ?? 0) < 2025)
const retiredCovered = retired.filter((player) => players[player.slug].spells.length).length
console.log(`Careers: ${covered}/${roster.players.length} players; retired ${retiredCovered}/${retired.length}`)

function buildSpells(transfers, description, active) {
  if (!transfers.length) return []
  const senior = transfers.filter((row) => isSeniorClub(row.from) || isSeniorClub(row.to))
  if (!senior.length) return []
  const spells = []
  let currentClub = isSeniorClub(senior[0].from) ? senior[0].from : senior[0].to
  let currentStart = inferCareerStart(description, senior[0].date)

  for (const transfer of senior) {
    if (!isSeniorClub(transfer.to)) continue
    if (currentClub === transfer.to) continue
    if (isSeniorClub(transfer.from) && currentClub !== transfer.from) {
      if (currentClub) spells.push({ club: currentClub, start: currentStart, end: transfer.date, source: 'transfermarkt-transfers' })
      currentClub = transfer.from
      currentStart = ''
    }
    if (currentClub && currentClub !== transfer.to) spells.push({ club: currentClub, start: currentStart, end: transfer.date, source: 'transfermarkt-transfers' })
    currentClub = transfer.to
    currentStart = transfer.date
  }
  if (currentClub) spells.push({ club: currentClub, start: currentStart, end: active ? '' : inferCareerEnd(description), source: 'transfermarkt-transfers' })
  return spells.filter((spell) => isSeniorClub(spell.club) && spell.club !== 'Without Club')
}

function inferCareerStart(description, fallbackDate) {
  const patterns = [
    /professional career began[^.]*? in (19\d{2}|20\d{2})/i,
    /began his professional career[^.]*? in (19\d{2}|20\d{2})/i,
    /made his (?:professional |first-team )?debut[^.]*? in (19\d{2}|20\d{2})/i,
  ]
  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) return `${match[1]}-01-01`
  }
  return `${fallbackDate.slice(0, 4)}-01-01`
}

function inferCareerEnd(description) {
  const match = description.match(/retir(?:ed|ement)[^.]*?\b(19\d{2}|20\d{2})\b/i)
  return match ? `${match[1]}-12-31` : ''
}

function isSeniorClub(name) {
  if (name === 'Willem II') return true
  return Boolean(name) && !/(?:\bU\d{2}\b|\bY(?:ou)?th\b|\bYouth\b|\bJugend\b|\bAcademy\b|\bAcad\.?(?:$|\s)|\bReserve(?:s)?\b|\bRes\.?(?:$|\s)|\bII\b|\bB\s*$|\bC\s*$|\bSub-?\d+\b|\bJgd\b|\bYout\b|\bJeugd\b|\bFor\.?(?:$|\s)|\bNext Gen\b|\bWithout Club\b|\bRetired\b)/i.test(name)
}

async function download(url, destination) {
  try { if ((await stat(destination)).size > 0) return } catch {}
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`)
  const temporary = `${destination}.part`
  await pipeline(response.body, createWriteStream(temporary))
  await rename(temporary, destination)
}

async function readCsvGzip(file, onRow) {
  let headers
  let pending = ''
  const stream = createReadStream(file).pipe(createGunzip())
  stream.setEncoding('utf8')
  for await (const chunk of stream) {
    pending += chunk
    let newline
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '')
      pending = pending.slice(newline + 1)
      if (!headers) headers = parseCsvLine(line)
      else if (line) onRow(Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])))
    }
  }
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { values.push(value); value = '' }
    else value += char
  }
  values.push(value)
  return values
}
