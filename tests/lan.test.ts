import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { hostname } from 'node:os'
import { WebSocket } from 'ws'
import { LanReceiver } from '../electron/lan'
test('LAN handshake, ownership, frames, keyframe requests and disconnect', async () => {
  let occupied = false
  const receiver = new LanReceiver(() => occupied)
  await receiver.start()
  const endpoint = `http://127.0.0.1:${receiver.port}`
  let client: WebSocket | undefined
  try {
    const info = await (await fetch(endpoint + '/info')).json()
    assert.equal(info.name, hostname())
    assert.equal(info.busy, false)
    assert.equal((await fetch(endpoint + '/missing')).status, 404)
    const rejected = async (options: object, code: number) => {
      const socket = new WebSocket(
        endpoint.replace('http:', 'ws:') + '/stream',
        'bifrost.h264.v1',
        options
      )
      const status = await new Promise<number>((resolve, reject) => {
        socket.on('unexpected-response', (_, response) => {
          response.resume()
          socket.terminate()
          resolve(response.statusCode!)
        })
        socket.on('error', () => {})
        socket.on('open', () => {
          socket.close()
          reject(new Error('Unexpected connection'))
        })
      })
      assert.equal(status, code)
    }
    await rejected({ origin: 'https://example.com' }, 403)
    occupied = true
    await rejected({}, 409)
    occupied = false
    client = new WebSocket(endpoint.replace('http:', 'ws:') + '/stream', 'bifrost.h264.v1')
    await once(client, 'open')
    const ready = once(client, 'message')
    client.send(JSON.stringify({ type: 'hello', protocol: 1, name: 'Android test' }))
    assert.equal(JSON.parse(String((await ready)[0])).name, hostname())
    assert.equal((await (await fetch(endpoint + '/info')).json()).busy, true)
    await rejected({}, 409)
    const connected = once(receiver, 'connected'),
      frame = once(receiver, 'frame')
    const bytes = Buffer.alloc(14)
    bytes[0] = 2
    bytes.writeBigUInt64BE(123n, 1)
    bytes.set([0, 0, 0, 1, 101], 9)
    client.send(bytes)
    assert.equal((await connected)[0], 'Android test')
    assert.equal((await frame)[0].timestamp, 123)
    const request = once(client, 'message')
    receiver.keyframe()
    assert.equal(JSON.parse(String((await request)[0])).type, 'keyframe')
    const disconnected = once(receiver, 'disconnected')
    receiver.disconnect()
    await disconnected
    assert.equal(receiver.streaming, false)
    assert.equal((await (await fetch(endpoint + '/info')).json()).busy, false)
  } finally {
    client?.terminate()
    await receiver.stop()
  }
})
