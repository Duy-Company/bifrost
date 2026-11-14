import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { copyFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join, delimiter } from 'node:path'
import { inflateSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { PngParser } from '../electron/png.ts'
if (process.platform !== 'win32') throw new Error('Windows is required')
const root = resolve(process.argv[2] || 'packaged', 'resources/receiver')
const bin = join(root, 'bin'),
  plugins = join(root, 'lib/gstreamer-1.0')
await copyFile('artifacts/native-test/gst-launch-1.0.exe', join(bin, 'gst-launch-test.exe'))
await copyFile(
  'artifacts/native-test/libgstvideotestsrc.dll',
  join(plugins, 'libgstvideotestsrc.dll')
)
function validate(frame, width, height) {
  const chunks = []
  for (let p = 8; p < frame.length;) {
    const n = frame.readUInt32BE(p),
      type = frame.toString('ascii', p + 4, p + 8)
    if (type === 'IHDR') {
      assert.equal(frame.readUInt32BE(p + 8), width)
      assert.equal(frame.readUInt32BE(p + 12), height)
      assert.equal(frame[p + 16], 8)
      assert.equal(frame[p + 17], 2)
    }
    if (type === 'IDAT') chunks.push(frame.subarray(p + 8, p + 8 + n))
    p += 12 + n
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * 3
  assert.equal(raw.length, (stride + 1) * height)
  let previous = Buffer.alloc(stride)
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? row[x - 3] : 0,
        b = previous[x],
        c = x >= 3 ? previous[x - 3] : 0
      row[x] = (row[x] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]) & 255
      assert.equal(row[x], [0x12, 0x7b, 0xc8][x % 3])
    }
    previous = row
  }
}
const report = []
for (const [width, height] of [
  [1920, 1080],
  [3840, 2160]
]) {
  let frames = 0,
    bytes = 0,
    first,
    last,
    log = '',
    failure,
    firstFrame
  const server = createServer((socket) => {
    const parser = new PngParser((frame) => {
      const now = performance.now()
      first ??= now
      last = now
      frames++
      bytes += frame.length
      firstFrame ??= frame
    })
    socket.on('data', (chunk) => {
      try {
        parser.push(chunk)
      } catch (e) {
        failure = e
        socket.destroy()
      }
    })
    socket.on('error', (e) => (failure = e))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const child = spawn(
    join(bin, 'gst-launch-test.exe'),
    [
      '-q',
      'videotestsrc',
      'num-buffers=60',
      'pattern=solid-color',
      'foreground-color=0xff127bc8',
      '!',
      `video/x-raw,format=RGB,width=${width},height=${height},framerate=60/1`,
      '!',
      'pngenc',
      'compression-level=1',
      '!',
      'tcpclientsink',
      'host=127.0.0.1',
      `port=${server.address().port}`,
      'sync=false'
    ],
    {
      cwd: bin,
      env: {
        ...process.env,
        PATH: bin + delimiter + process.env.PATH,
        GST_PLUGIN_PATH: plugins,
        GST_PLUGIN_SYSTEM_PATH: '',
        GST_REGISTRY_FORK: 'no',
        GST_REGISTRY: join(bin, 'test-registry.bin')
      }
    }
  )
  child.stderr.on('data', (data) => (log += data))
  const timer = setTimeout(() => child.kill(), 60000)
  try {
    await new Promise((r, j) => {
      child.on('error', j)
      child.on('exit', (code) =>
        code === 0 ? r() : j(new Error(`GStreamer exited ${code}: ${log}`))
      )
    })
  } finally {
    clearTimeout(timer)
    server.close()
  }
  if (failure) throw failure
  assert.equal(frames, 60)
  validate(firstFrame, width, height)
  report.push({
    width,
    height,
    frames,
    losslessRGBVerified: true,
    syntheticEncodeFPS: Number(((59 * 1000) / (last - first)).toFixed(1)),
    bytes
  })
}
await mkdir('artifacts', { recursive: true })
await writeFile(
  'artifacts/windows-png-validation.json',
  JSON.stringify({ report, physicalAirPlayTested: false }, null, 2) + '\n'
)
console.log(JSON.stringify(report, null, 2))
