import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JpegParser } from '../electron/jpeg'
const a = Buffer.from([255, 216, 1, 2, 255, 0, 3, 255, 217])
const b = Buffer.from([255, 216, 4, 5, 6, 255, 217])
test('JPEG stream preserves frames at every TCP split', () => {
  const bytes = Buffer.concat([a, b])
  for (let split = 1; split < bytes.length; split++) {
    const frames: Buffer[] = []
    const parser = new JpegParser((frame) => frames.push(frame))
    parser.push(bytes.subarray(0, split))
    parser.push(bytes.subarray(split))
    assert.deepEqual(frames, [a, b])
  }
})
test('handles bytewise reads and discards leading junk', () => {
  const frames: Buffer[] = []
  const parser = new JpegParser((f) => frames.push(f))
  for (const byte of Buffer.concat([Buffer.from([1, 2, 255]), a, b]))
    parser.push(Buffer.from([byte]))
  assert.deepEqual(frames, [a, b])
})
test('bounds incomplete frames to prevent unbounded accumulation', () => {
  const parser = new JpegParser(() => {}, 16)
  assert.throws(() => parser.push(Buffer.from([255, 216, ...Array(16).fill(1)])), /size limit/)
})
