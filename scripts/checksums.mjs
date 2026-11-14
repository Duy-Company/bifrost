import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const files = (await readdir('dist'))
  .filter(
    (n) =>
      n === 'latest.yml' || (n.startsWith(`Bifrost-${version}-`) && /\.(exe|zip|blockmap)$/.test(n))
  )
  .sort()
await writeFile(
  'dist/SHA256SUMS.txt',
  (
    await Promise.all(
      files.map(
        async (name) =>
          `${createHash('sha256')
            .update(await readFile(`dist/${name}`))
            .digest('hex')}  ${name}`
      )
    )
  ).join('\n') + '\n'
)
console.log(`Wrote checksums for ${files.length} release assets.`)
