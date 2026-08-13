import { mkdir, writeFile } from 'node:fs/promises'

const teams = [
  ['Dinamo Zagreb', 'dinamo-zagreb.png'],
  ['Zrinjski Mostar', 'zrinjski.png'],
  ['Inter Zapresic', 'inter-zapresic.png'],
  ['Tottenham Hotspur', 'tottenham.png'],
  ['Real Madrid', 'real-madrid.png'],
  ['AC Milan', 'ac-milan.png'],
  ['Croatia', 'croatia.png'],
]
const competitions = [
  ['4480', 'champions-league.png'],
  ['4335', 'la-liga.png'],
  ['4483', 'copa-del-rey.png'],
  ['4511', 'supercopa.png'],
]
const output = new URL('../apps/web/public/assets/football/', import.meta.url)
await mkdir(output, { recursive: true })

for (const [query, filename] of teams) {
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(query)}`)
  const { teams: matches = [] } = await response.json()
  const team = matches.find(item => item.strSport === 'Soccer' && item.strGender === 'Male' && item.strBadge)
  if (!team) {
    console.warn(`No verified badge found for ${query}`)
    continue
  }
  const image = await fetch(team.strBadge)
  await writeFile(new URL(filename, output), Buffer.from(await image.arrayBuffer()))
  console.log(`${query} -> ${filename}`)
}

for (const [id, filename] of competitions) {
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/123/lookupleague.php?id=${id}`)
  const { leagues = [] } = await response.json()
  const competition = leagues.find(item => item.strTrophy)
  if (!competition) {
    console.warn(`No trophy found for competition ${id}`)
    continue
  }
  const image = await fetch(competition.strTrophy)
  await writeFile(new URL(filename, output), Buffer.from(await image.arrayBuffer()))
  console.log(`${competition.strLeague} -> ${filename}`)
}
