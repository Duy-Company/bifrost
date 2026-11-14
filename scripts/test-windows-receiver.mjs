import { spawn, execFileSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
if (process.platform !== 'win32') throw new Error('This integration test requires Windows.')
const root = resolve(process.argv[2] || 'dist/win-unpacked')
const child = spawn(join(root, 'Bifrost.exe'), ['--disable-gpu'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
})
let log = ''
for (const stream of [child.stdout, child.stderr])
  stream?.on('data', (chunk) => {
    log = (log + chunk.toString()).slice(-64000)
  })
child.on('error', (error) => {
  log += error.message
})
async function probe() {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 7000 })
    let response = Buffer.alloc(0)
    socket.setTimeout(3000)
    socket.on('connect', () =>
      socket.write('GET /info RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: AirPlay/550.10\r\n\r\n')
    )
    socket.on('data', (data) => {
      response = Buffer.concat([response, data])
      const text = response.toString('latin1')
      const split = text.indexOf('\r\n\r\n')
      if (split >= 0) {
        const length = Number(/Content-Length: (\d+)/i.exec(text)?.[1] || 0)
        if (response.length >= split + 4 + length) {
          socket.destroy()
          resolve(response)
        }
      }
    })
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('AirPlay probe timed out'))
    })
    socket.on('error', reject)
  })
}
try {
  let response
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error('App exited: ' + log)
    try {
      response = await probe()
      break
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  if (!response) {
    for (const name of ['Bifrost', 'bifrost']) {
      try {
        log += '\n' + (await readFile(join(process.env.APPDATA, name, 'receiver.log'), 'utf8'))
      } catch {}
    }
    throw new Error('AirPlay did not respond on Windows. ' + log)
  }
  const text = response.toString('latin1')
  if (!/^(RTSP|HTTP)\/1.[01] 200/.test(text) || !text.includes('bplist00'))
    throw new Error('Invalid AirPlay /info response: ' + text.slice(0, 200))
  const manifest = JSON.parse(
    await readFile(join(root, 'resources/receiver/build-manifest.json'), 'utf8')
  )
  for (const file of manifest.files) {
    const bytes = await readFile(join(root, 'resources/receiver', file.path))
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
      throw new Error('Bundled receiver corruption: ' + file.path)
  }
  const checkUpdates = process.argv.includes('--updates')
  if (checkUpdates) {
    const pattern = /Update for version .* is not available \(latest version:/
    for (let attempt = 0; attempt < 90 && !pattern.test(log); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    if (!pattern.test(log))
      throw new Error('The packaged updater did not confirm the public release feed. ' + log)
    console.log(
      'PASS: the packaged Windows updater checked GitHub Releases and confirmed the installed version is current.'
    )
  }
  await writeFile(
    'windows-validation.json',
    JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        appStarted: true,
        airplayInfoStatus: 200,
        binaryPlist: true,
        nativeFiles: manifest.files.length,
        validatedAt: new Date().toISOString(),
        publicUpdateCheckPassed: checkUpdates,
        physicalAirPlayTested: false,
        physicalMiracastTested: false
      },
      null,
      2
    )
  )
  console.log(
    'PASS: Windows app starts its bundled AirPlay receiver; /info returns 200 with a binary plist; all receiver DLL checksums match.'
  )
} finally {
  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {}
}
