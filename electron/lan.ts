import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:http'
import { networkInterfaces, hostname } from 'node:os'
import { getResponder, type CiaoService, type Responder } from '@homebridge/ciao'
import { WebSocketServer, WebSocket } from 'ws'
import type { ReceiverStatus, EncodedFrame } from '../shared/types'
export function androidPacket(bytes: Buffer): EncodedFrame {
  if (bytes.length < 10 || bytes.length > 8 * 1024 * 1024 || bytes[0] & ~3)
    throw new Error('Invalid Android video packet.')
  const timestamp = bytes.readBigUInt64BE(1)
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid video timestamp.')
  return {
    kind: 'h264',
    data: bytes.subarray(9),
    timestamp: Number(timestamp),
    config: !!(bytes[0] & 1),
    key: !!(bytes[0] & 2)
  }
}
export class LanReceiver extends EventEmitter {
  state: ReceiverStatus = { status: 'starting' }
  streaming = false
  port = 0
  private server?: Server
  private websocket?: WebSocketServer
  private responder?: Responder
  private service?: CiaoService
  private client?: WebSocket
  constructor(
    private busy: () => boolean,
    private discovery = true
  ) {
    super()
  }
  addresses(): string[] {
    return Object.values(networkInterfaces())
      .flatMap((entries) => entries || [])
      .filter(
        (item) => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.')
      )
      .map((item) => `${item.address}:${this.port}`)
  }
  private publish(state: ReceiverStatus): void {
    this.state = state
    this.emit('state', state)
  }
  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/info') {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(
        JSON.stringify({
          name: hostname(),
          protocol: 'bifrost.h264.v1',
          busy: this.busy() || !!this.client
        })
      )
    })
    this.websocket = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false,
      maxPayload: 8 * 1024 * 1024,
      handleProtocols: (protocols) => (protocols.has('bifrost.h264.v1') ? 'bifrost.h264.v1' : false)
    })
    this.server.on('upgrade', (request, socket, head) => {
      if (
        request.url !== '/stream' ||
        request.headers.origin ||
        request.headers['sec-websocket-protocol'] !== 'bifrost.h264.v1'
      ) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        return
      }
      if (this.busy() || this.client) {
        socket.end('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n')
        return
      }
      this.websocket!.handleUpgrade(request, socket, head, (client) => this.accept(client))
    })
    this.server.on('error', (error) => this.publish({ status: 'error', detail: error.message }))
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '0.0.0.0', () => {
        this.server!.removeListener('error', reject)
        resolve()
      })
    })
    this.port = (this.server.address() as { port: number }).port
    this.publish({ status: 'ready', detail: this.addresses().join(', ') })
    if (!this.discovery) return
    this.responder = getResponder()
    this.service = this.responder.createService({
      name: hostname(),
      type: 'bifrost',
      disabledIpv6: true,
      port: this.port,
      txt: { protocol: 'bifrost.h264.v1', name: hostname() }
    })
    void this.service.advertise().catch((error) => {
      this.publish({
        status: 'ready',
        detail: `Direct LAN connection available; discovery failed: ${error.message}`
      })
    })
  }
  private accept(client: WebSocket): void {
    this.client = client
    let initialized = false
    let name = 'Android'
    const timeout = setTimeout(() => client.close(1008, 'Handshake required'), 5000)
    client.on('message', (raw, binary) => {
      if (client.readyState !== WebSocket.OPEN) return
      try {
        const bytes = Buffer.isBuffer(raw) ? raw : Buffer.concat(raw as Buffer[])
        if (!binary) {
          if (initialized || bytes.length > 2048) throw new Error('Invalid handshake.')
          const hello = JSON.parse(bytes.toString('utf8'))
          if (
            hello.type !== 'hello' ||
            hello.protocol !== 1 ||
            typeof hello.name !== 'string' ||
            hello.name.length > 80
          )
            throw new Error('Unsupported sender.')
          initialized = true
          name = hello.name
          clearTimeout(timeout)
          client.send(JSON.stringify({ type: 'ready', name: hostname() }))
          return
        }
        if (!initialized) throw new Error('Handshake required.')
        const frame = androidPacket(bytes)
        if (!this.streaming && frame.key) {
          this.streaming = true
          this.publish(this.state)
          this.emit('connected', name)
        }
        this.emit('frame', frame)
      } catch {
        client.close(1008, 'Invalid video stream')
      }
    })
    client.on('error', () => client.close())
    client.on('close', () => {
      clearTimeout(timeout)
      if (this.client === client) {
        this.client = undefined
        const wasStreaming = this.streaming
        this.streaming = false
        this.publish(this.state)
        if (wasStreaming) this.emit('disconnected')
      }
    })
  }
  keyframe(): void {
    if (this.client?.readyState === WebSocket.OPEN)
      this.client.send(JSON.stringify({ type: 'keyframe' }))
  }
  disconnect(): void {
    this.client?.close(1000, 'Disconnected from receiver')
  }
  async stop(): Promise<void> {
    this.client?.terminate()
    this.websocket?.close()
    this.server?.close()
    await this.service?.destroy()
    await this.responder?.shutdown()
  }
}
