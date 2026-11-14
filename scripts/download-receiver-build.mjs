import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const exists = (p) =>
  access(p).then(
    () => true,
    () => false
  )
async function fetchFile(url, target, sha) {
  if (await exists(target)) {
    if (
      !sha ||
      createHash('sha256')
        .update(await readFile(target))
        .digest('hex') === sha
    )
      return
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (sha && createHash('sha256').update(bytes).digest('hex') !== sha)
    throw new Error(`Checksum mismatch: ${target}`)
  await writeFile(target, bytes)
  console.log(target, `${Math.round(bytes.length / 1024)} KiB`)
}
await mkdir('vendor/packages', { recursive: true })
const lock = JSON.parse(await readFile('scripts/receiver-build-lock.json', 'utf8'))
const packages = lock.packages
await writeFile('vendor/msys-packages.json', JSON.stringify(packages, null, 2))
let cursor = 0
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < packages.length) {
      const p = packages[cursor++]
      await fetchFile(
        `https://repo.msys2.org/mingw/ucrt64/${p.FILENAME[0]}`,
        `vendor/packages/${p.FILENAME[0]}`,
        p.SHA256SUM[0]
      )
    }
  })
)
await fetchFile(lock.toolchain.url, 'vendor/llvm-mingw.tar.xz', lock.toolchain.sha256)
const source = lock.uxplay
await writeFile('vendor/uxplay-source.json', JSON.stringify(source, null, 2))
await fetchFile(
  `https://codeload.github.com/FDH2/UxPlay/tar.gz/${source.commit}`,
  'vendor/uxplay-source.tar.gz',
  source.sha256
)
await mkdir('vendor/sysroot', { recursive: true })
await mkdir('vendor/uxplay', { recursive: true })
await mkdir('vendor/toolchain', { recursive: true })
execFileSync('python3', ['scripts/extract-msys.py'], { stdio: 'inherit' })
execFileSync('tar', [
  '-xf',
  'vendor/llvm-mingw.tar.xz',
  '--strip-components=1',
  '-C',
  'vendor/toolchain'
])
execFileSync('tar', [
  '-xf',
  'vendor/uxplay-source.tar.gz',
  '--strip-components=1',
  '-C',
  'vendor/uxplay'
])
console.log('Windows cross-build dependencies prepared.')
