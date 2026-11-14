import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const files = (await readdir('dist')).filter((n) => /\.(exe|zip|blockmap|yml)$/.test(n)).sort()
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
