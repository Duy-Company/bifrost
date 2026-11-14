import { readdir, mkdir, copyFile, readFile, writeFile, cp } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import { createHash } from 'node:crypto'
const output = 'resources/receiver'
await mkdir(`${output}/bin`, { recursive: true })
await mkdir(`${output}/lib/gstreamer-1.0`, { recursive: true })
await mkdir(`${output}/source`, { recursive: true })
const directories = ['vendor/sysroot/ucrt64/bin', 'vendor/toolchain/x86_64-w64-mingw32/bin']
const available = new Map()
for (const directory of directories)
  for (const name of await readdir(directory))
    if (name.endsWith('.dll') && !available.has(name.toLowerCase()))
      available.set(name.toLowerCase(), join(directory, name))
const plugins = [
  'coreelements',
  'app',
  'typefindfunctions',
  'playback',
  'videoconvertscale',
  'videofilter',
  'videoparsersbad',
  'png',
  'tcp',
  'libav',
  'audioconvert',
  'audioresample',
  'audioparsers',
  'volume',
  'level',
  'autodetect',
  'wasapi',
  'wasapi2',
  'rtp',
  'rtpmanager',
  'pango'
]
const roots = [{ source: 'vendor/uxplay-build/uxplay.exe', target: `${output}/bin/uxplay.exe` }]
for (const name of plugins)
  roots.push({
    source: `vendor/sysroot/ucrt64/lib/gstreamer-1.0/libgst${name}.dll`,
    target: `${output}/lib/gstreamer-1.0/libgst${name}.dll`
  })
const system = new Set(
  'mmdevapi bcryptprimitives gdiplus kernel32 ntdll ucrtbase msvcrt msvcp_win advapi32 ws2_32 wsock32 user32 iphlpapi ole32 oleaut32 shell32 shlwapi secur32 crypt32 normaliz version winmm gdi32 setupapi bcrypt dwmapi dxgi d3d11 d3d12 dwrite d2d1 mfplat mf mfreadwrite propsys wintrust psapi comdlg32 uxtheme cfgmgr32 comctl32 shcore avrt msimg32 dcomp winhttp synchronization dnsapi powrprof windowscodecs opengl32 imm32 hid usp10 wininet cryptbase wtsapi32 dbghelp pdh ncrypt userenv rpcrt4'
    .split(' ')
    .map((n) => n + '.dll')
)
const done = new Set()
const missing = new Set()
const files = []
const queue = [...roots]
while (queue.length) {
  const { source, target } = queue.shift()
  const key = source.toLowerCase()
  if (done.has(key)) continue
  done.add(key)
  await copyFile(source, target)
  const bytes = await readFile(target)
  files.push({
    path: target.slice(output.length + 1),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length
  })
  const imports = execFileSync('vendor/toolchain/bin/llvm-readobj', ['--coff-imports', source], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  })
  for (const match of imports.matchAll(/^\s*Name: (.+\.dll)\s*$/gim)) {
    const name = match[1].trim().toLowerCase()
    if (system.has(name) || /^(api|ext)-ms-/.test(name)) continue
    const dependency = available.get(name)
    if (!dependency) {
      missing.add(name)
      continue
    }
    queue.push({ source: dependency, target: `${output}/bin/${basename(dependency)}` })
  }
}
if (missing.size) throw new Error('Unresolved native DLL imports: ' + [...missing].join(', '))
await cp('vendor/sysroot/ucrt64/share/licenses', `${output}/licenses`, { recursive: true })
await copyFile('vendor/uxplay/LICENSE', `${output}/UXPLAY-LICENSE`)
execFileSync('tar', ['-czf', `${output}/source/uxplay.tar.gz`, '-C', 'vendor/uxplay', '.'])
for (const name of ['windows-toolchain.cmake', 'patch-uxplay.py', 'assemble-receiver.mjs'])
  await copyFile(`scripts/${name}`, `${output}/source/${name}`)
const source = JSON.parse(await readFile('vendor/uxplay-source.json', 'utf8'))
source.sha256 = createHash('sha256')
  .update(await readFile('vendor/uxplay-source.tar.gz'))
  .digest('hex')
const packages = JSON.parse(await readFile('vendor/msys-packages.json', 'utf8'))
const manifest = {
  uxplay: source,
  toolchain: {
    version: '20261104',
    url: 'https://github.com/mstorsjo/llvm-mingw/releases/download/20261104/llvm-mingw-20261104-ucrt-macos-universal.tar.xz',
    sha256: createHash('sha256')
      .update(await readFile('vendor/llvm-mingw.tar.xz'))
      .digest('hex')
  },
  packages,
  files
}
await writeFile(`${output}/build-manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
await writeFile(
  'scripts/receiver-build-lock.json',
  JSON.stringify({ uxplay: source, toolchain: manifest.toolchain, packages }, null, 2) + '\n'
)
console.log(
  `Receiver assembled: ${files.length} binaries, ${(files.reduce((n, f) => n + f.bytes, 0) / 1024 / 1024).toFixed(1)} MiB; all native DLL imports resolved.`
)
