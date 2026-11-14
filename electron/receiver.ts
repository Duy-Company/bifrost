import { EventEmitter } from 'node:events'
import { createServer, createConnection, type Server, type Socket } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, appendFile, readFile } from 'node:fs/promises'
import { join, delimiter } from 'node:path'
import { hostname } from 'node:os'
import { JpegParser } from './jpeg'
import type { ReceiverState } from '../shared/types'
export class Receiver extends EventEmitter {
  readonly state: ReceiverState = {
    name: `Bifrost - ${hostname()}`,
    platform: process.platform,
    airplay: { status: 'starting' },
    miracast: { status: 'starting' },
    streaming: false
  }
  private server?: Server
  private engine?: ChildProcess
  private miracast?: ChildProcess
  private socket?: Socket
  private stopping = false
  private restarting = false
  private monitor?: ReturnType<typeof setInterval>
  private generation = 0
  private lastLog = ''
  constructor(
    private runtime: string,
    private data: string,
    private windowsScript: string
  ) {
    super()
  }
  private publish(): void {
    this.emit('state', structuredClone(this.state))
  }
  async start(): Promise<void> {
    this.stopping = false
    await mkdir(this.data, { recursive: true })
    if (process.platform !== 'win32') {
      this.state.airplay = {
        status: 'unavailable',
        detail: 'The bundled receiver is built for Windows.'
      }
      this.state.miracast = {
        status: 'unavailable',
        detail: 'Windows Wireless Display is required.'
      }
      this.publish()
      return
    }
    await Promise.allSettled([this.startAirPlay(), this.startMiracast()])
  }
  private async log(message: string): Promise<void> {
    await appendFile(
      join(this.data, 'receiver.log'),
      `${new Date().toISOString()} ${message}\n`
    ).catch(() => {})
  }
  private async startAirPlay(): Promise<void> {
    const generation = ++this.generation
    const executable = join(this.runtime, 'bin', 'uxplay.exe')
    if (!existsSync(executable)) {
      this.state.airplay = {
        status: 'unavailable',
        detail: 'The bundled AirPlay engine is missing.'
      }
      this.publish()
      return
    }
    this.state.airplay = { status: 'starting' }
    this.publish()
    this.server = createServer((socket) => {
      if (socket.remoteAddress !== '127.0.0.1') {
        socket.destroy()
        return
      }
      this.socket?.destroy()
      this.socket = socket
      const parser = new JpegParser((frame) => {
        if (!this.state.streaming) {
          this.state.streaming = true
          this.publish()
          this.emit('connected')
        }
        this.emit('frame', frame)
      })
      socket.on('data', (data) => {
        try {
          parser.push(Buffer.isBuffer(data) ? data : Buffer.from(data))
        } catch (error) {
          void this.log((error as Error).message)
          socket.destroy()
        }
      })
      socket.on('error', (error) => {
        void this.log(error.message)
      })
      socket.on('close', () => {
        if (this.socket === socket) {
          this.socket = undefined
          this.endStream()
        }
      })
    })
    this.server.on('error', (error) => {
      this.state.airplay = { status: 'error', detail: error.message }
      this.publish()
      void this.log(error.message)
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.removeListener('error', reject)
        resolve()
      })
    })
    const port = (this.server.address() as { port: number }).port
    const sink = `videoconvert ! jpegenc quality=85 ! tcpclientsink host=127.0.0.1 port=${port} sync=false`
    this.engine = spawn(
      executable,
      ['-n', this.state.name, '-nh', '-nofreeze', '-vs', sink, '-p', '7000'],
      {
        cwd: join(this.runtime, 'bin'),
        windowsHide: true,
        env: {
          ...process.env,
          PATH: `${join(this.runtime, 'bin')}${delimiter}${process.env.PATH || ''}`,
          GST_PLUGIN_PATH: join(this.runtime, 'lib/gstreamer-1.0'),
          GST_PLUGIN_SYSTEM_PATH: '',
          GST_REGISTRY: join(this.data, 'gstreamer-registry.bin'),
          GST_REGISTRY_FORK: 'no'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    this.lastLog = ''
    const output = (data: Buffer): void => {
      const line = data.toString()
      this.lastLog = (this.lastLog + line).slice(-6000)
      void this.log(line.trim())
    }
    this.engine.stdout?.on('data', output)
    this.engine.stderr?.on('data', output)
    this.engine.on('error', (error) => {
      if (generation === this.generation) {
        this.state.airplay = { status: 'error', detail: error.message }
        this.publish()
        void this.log(error.message)
      }
    })
    this.engine.on('exit', (code) => {
      if (generation !== this.generation || this.stopping) return
      this.state.airplay = {
        status: 'error',
        detail: `AirPlay engine stopped (${code}). ${this.lastLog.slice(-1200)}`
      }
      this.endStream()
      this.publish()
    })
    // Readiness follows a live engine listening on its configured RAOP endpoint.
    let attempts = 0
    this.monitor = setInterval(() => {
      if (
        generation !== this.generation ||
        this.stopping ||
        !this.engine ||
        this.engine.exitCode !== null
      ) {
        if (this.monitor) clearInterval(this.monitor)
        return
      }
      attempts++
      const probe = createConnection({ host: '127.0.0.1', port: 7000 })
      probe.setTimeout(700)
      probe.once('connect', () => {
        probe.destroy()
        if (generation !== this.generation) return
        if (this.monitor) clearInterval(this.monitor)
        this.state.airplay = { status: 'ready' }
        this.publish()
      })
      probe.once('error', () => {
        probe.destroy()
      })
      probe.once('timeout', () => probe.destroy())
      if (attempts > 60) {
        if (this.monitor) clearInterval(this.monitor)
        this.state.airplay = {
          status: 'error',
          detail: this.lastLog || 'AirPlay did not become ready.'
        }
        this.publish()
      }
    }, 1000)
  }
  private async startMiracast(): Promise<void> {
    const script = await readFile(this.windowsScript, 'utf8')
    this.miracast = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64')
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    this.miracast.stdin?.on('error', () => {})
    let buffer = ''
    this.miracast.stdout?.on('data', (data) => {
      buffer += data.toString()
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        try {
          const message = JSON.parse(line)
          if (['starting', 'ready', 'unavailable', 'error'].includes(message.status)) {
            this.state.miracast = message
            this.publish()
          }
        } catch {
          void this.log(line)
        }
      }
    })
    this.miracast.stderr?.on('data', (data) => {
      void this.log(data.toString())
    })
    this.miracast.on('error', (error) => {
      this.state.miracast = { status: 'error', detail: error.message }
      this.publish()
    })
    this.miracast.on('exit', (code) => {
      if (!this.stopping && code !== 0) {
        this.state.miracast = {
          status: 'unavailable',
          detail: 'Windows Wireless Display could not start.'
        }
        this.publish()
      }
    })
  }
  private endStream(): void {
    if (this.state.streaming) {
      this.state.streaming = false
      this.publish()
      this.emit('disconnected')
    }
  }
  async disconnect(): Promise<void> {
    if (this.stopping || this.restarting || process.platform !== 'win32') return
    this.restarting = true
    this.generation++
    if (this.monitor) clearInterval(this.monitor)
    this.engine?.kill()
    this.socket?.destroy()
    this.server?.close()
    this.endStream()
    await new Promise((resolve) => setTimeout(resolve, 500))
    try {
      await this.startAirPlay()
    } catch (error) {
      this.state.airplay = { status: 'error', detail: (error as Error).message }
      this.publish()
    } finally {
      this.restarting = false
    }
  }
  stop(): void {
    this.stopping = true
    this.generation++
    if (this.monitor) clearInterval(this.monitor)
    this.engine?.kill()
    this.miracast?.stdin?.end('stop\n')
    this.socket?.destroy()
    this.server?.close()
    this.endStream()
  }
}
