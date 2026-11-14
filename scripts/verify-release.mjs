import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { load } from 'js-yaml'
const manifest = load(await readFile('dist/latest.yml', 'utf8'))
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
if (manifest.version !== pkg.version) throw new Error('Update feed version mismatch')
for (const file of manifest.files) {
  const name = decodeURIComponent(file.url)
  if (name.includes('/') || name.includes('\\')) throw new Error('Unexpected update URL')
  const data = await readFile(`dist/${name}`)
  if (
    data.length !== file.size ||
    createHash('sha512').update(data).digest('base64') !== file.sha512
  )
    throw new Error(`Invalid update artifact: ${name}`)
}
const config = load(await readFile('dist/win-unpacked/resources/app-update.yml', 'utf8'))
if (config.provider !== 'github' || config.owner !== 'Duy-Company' || config.repo !== 'bifrost')
  throw new Error('Packaged updater points to the wrong repository')
if ((await stat('dist/Bifrost-' + pkg.version + '-x64.exe.blockmap')).size < 100)
  throw new Error('Missing differential update blockmap')
console.log(
  `PASS: update feed ${manifest.version}, installer size/hash, blockmap and embedded GitHub provider.`
)
