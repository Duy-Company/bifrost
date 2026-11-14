import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PngParser } from '../electron/png'
import { videoProfile, airplayArgs } from '../electron/video-profile'
import { androidPacket } from '../electron/lan'
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function chunk(type: string, data: Buffer) {
  const h = Buffer.alloc(8)
  h.writeUInt32BE(data.length)
  h.write(type, 4)
  return Buffer.concat([h, data, Buffer.alloc(4)])
}
function png() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1920)
  header.writeUInt32BE(1080, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', Buffer.from('payload contains IEND and PNG signatures')),
    chunk('IEND', Buffer.alloc(0))
  ])
}
test('PNG frames preserve bytes at every TCP split and across multiple frames', () => {
  const frame = png(),
    stream = Buffer.concat([frame, frame])
  for (let split = 1; split < stream.length; split++) {
    const out: Buffer[] = []
    const p = new PngParser((f) => out.push(f))
    p.push(stream.subarray(0, split))
    p.push(stream.subarray(split))
    assert.deepEqual(out, [frame, frame])
  }
})
test('PNG parser supports bytewise input and bounds chunk lengths', () => {
  const out: Buffer[] = []
  const p = new PngParser((f) => out.push(f))
  for (const byte of png()) p.push(Buffer.from([byte]))
  assert.equal(out.length, 1)
  const bad = Buffer.alloc(8)
  bad.writeUInt32BE(0xffffffff)
  bad.write('IHDR', 4)
  assert.throws(() => new PngParser(() => {}).push(Buffer.concat([signature, bad])), /size limit/)
})
test('display profile uses physical 4K pixels and requests HEVC only above 1080p', () => {
  assert.deepEqual(videoProfile(1920, 1080), { width: 1920, height: 1080, fps: 60, hevc: false })
  assert.deepEqual(videoProfile(3840, 2160), { width: 3840, height: 2160, fps: 60, hevc: true })
  assert.equal(videoProfile(7680, 4320).width, 3840)
  const args = airplayArgs('DESKTOP', 1234, videoProfile(3840, 2160))
  assert.ok(args.includes('-h265'))
  assert.ok(args.includes('3840x2160@60'))
  assert.ok(args.some((a) => a.includes('pngenc compression-level=1')))
  assert.ok(!args.some((a) => a.includes('jpegenc')))
})
test('Android transport preserves flags and microsecond timestamps', () => {
  const bytes = Buffer.alloc(14)
  bytes[0] = 3
  bytes.writeBigUInt64BE(123456n, 1)
  bytes.set([0, 0, 0, 1, 103], 9)
  const frame = androidPacket(bytes)
  assert.equal(frame.config, true)
  assert.equal(frame.key, true)
  assert.equal(frame.timestamp, 123456)
  assert.deepEqual([...frame.data], [0, 0, 0, 1, 103])
  assert.throws(() => androidPacket(Buffer.from([0])), /Invalid/)
})
