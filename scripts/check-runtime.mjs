import { readFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = 'resources/receiver'
const manifest = JSON.parse(await readFile(`${root}/build-manifest.json`, 'utf8'))
for (const file of manifest.files) {
  const bytes = await readFile(`${root}/${file.path}`)
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
    throw new Error(`Receiver checksum mismatch: ${file.path}`)
}
await access(`${root}/source/uxplay.tar.gz`)
await access(`${root}/UXPLAY-LICENSE`)
console.log(`Verified ${manifest.files.length} native receiver binaries and corresponding source.`)
