import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'

export async function readCsv(file, onRow) {
  const input = createReadStream(file)
  const stream = file.endsWith('.gz') ? input.pipe(createGunzip()) : input
  stream.setEncoding('utf8')
  let headers
  let pending = ''
  for await (const chunk of stream) {
    pending += chunk
    let newline
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '')
      pending = pending.slice(newline + 1)
      if (!headers) headers = parseCsvLine(line)
      else if (line) onRow(toRecord(headers, parseCsvLine(line)))
    }
  }
  if (pending && headers) onRow(toRecord(headers, parseCsvLine(pending)))
}

function toRecord(headers, values) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
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
