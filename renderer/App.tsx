import { useEffect, useRef, useState } from 'react'
import { Radio, Snowflake, Airplay, Cast } from 'lucide-react'
import { IceBolt } from './components/IceBolt'
import type { ReceiverState } from '../shared/types'
const initial: ReceiverState = {
  name: 'Bifrost',
  platform: 'win32',
  airplay: { status: 'starting' },
  miracast: { status: 'starting' },
  streaming: false
}
function Stream() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const busy = useRef(false)
  useEffect(() => {
    let active = true
    const context = canvas.current!.getContext('2d', { alpha: false })!
    let decoder: VideoDecoder | undefined
    let configuration: Uint8Array | undefined
    let needsKey = true
    const draw = (frame: ImageBitmap | VideoFrame, width: number, height: number) => {
      const target = canvas.current
      if (active && target) {
        if (target.width !== width || target.height !== height) {
          target.width = width
          target.height = height
        }
        context.drawImage(frame, 0, 0)
        target.dataset.frames = String(Number(target.dataset.frames || 0) + 1)
      }
      frame.close()
    }
    const unsubscribe = window.bifrost.onFrame((packet) => {
      if (packet.kind === 'image') {
        if (busy.current) return
        busy.current = true
        void createImageBitmap(new Blob([new Uint8Array(packet.data)], { type: packet.mime }))
          .then((frame) => draw(frame, frame.width, frame.height))
          .catch((error) => console.error('Frame decode failed:', error))
          .finally(() => {
            busy.current = false
          })
        return
      }
      try {
        const data = new Uint8Array(packet.data)
        if (packet.config) {
          let codec = ''
          for (let i = 0; i < data.length - 6; i++) {
            const start =
              data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1
                ? i + 3
                : data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1
                  ? i + 4
                  : -1
            if (start >= 0 && (data[start] & 31) === 7) {
              codec =
                'avc1.' +
                Array.from(data.slice(start + 1, start + 4))
                  .map((n) => n.toString(16).padStart(2, '0'))
                  .join('')
              break
            }
          }
          if (!codec) throw new Error('Invalid Android AVC configuration.')
          if (decoder && decoder.state !== 'closed') decoder.close()
          decoder = new VideoDecoder({
            output: (frame) => draw(frame, frame.displayWidth, frame.displayHeight),
            error: (error) => {
              needsKey = true
              console.error(error.message)
            }
          })
          decoder.configure({ codec, optimizeForLatency: true })
          configuration = data
          needsKey = true
          return
        }
        if (!decoder || decoder.state !== 'configured' || (needsKey && !packet.key)) return
        if (decoder.decodeQueueSize > 6 && !packet.key) {
          needsKey = true
          return
        }
        let bytes = data
        if (packet.key && configuration) {
          bytes = new Uint8Array(configuration.length + data.length)
          bytes.set(configuration)
          bytes.set(data, configuration.length)
        }
        decoder.decode(
          new EncodedVideoChunk({
            type: packet.key ? 'key' : 'delta',
            timestamp: packet.timestamp,
            data: bytes
          })
        )
        needsKey = false
      } catch (error) {
        console.error('Android frame decode failed:', error)
      }
    })
    return () => {
      active = false
      unsubscribe()
      if (decoder && decoder.state !== 'closed') decoder.close()
    }
  }, [])
  return (
    <div className="stream">
      <canvas ref={canvas} aria-label="Mirrored screen" />
    </div>
  )
}
function Welcome() {
  const [state, setState] = useState(initial)
  useEffect(() => {
    void window.bifrost.state().then(setState)
    return window.bifrost.onState(setState)
  }, [])
  const ready = state.airplay.status === 'ready' || state.android?.status === 'ready'
  return (
    <main className="welcome">
      <header className="welcome-header">
        <a className="brand" aria-label="Bifrost">
          <IceBolt />
          <span>Bifrost</span>
        </a>
      </header>
      <section className="welcome-center">
        <div className="sculpture">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="orbit three" />
          <div className="ice-glow" />
          <span className="spark spark-one">+</span>
          <span className="spark spark-two">+</span>
          <IceBolt large />
        </div>
        <div className="eyebrow">A LITTLE CONNECTION. A BIGGER WORLD.</div>
        <h1>
          Your screen.
          <br />A little more <span>limitless.</span>
        </h1>
        <p>One quiet bridge. Every screen, closer.</p>
        <div className="receiver-name">
          <Radio size={14} />
          <span>{state.name}</span>
          <span className={`status-light ${ready ? 'ready' : state.airplay.status}`} />
        </div>
      </section>
      <footer className="welcome-footer">
        <div className="protocols">
          <span title={state.airplay.detail}>
            <Airplay size={14} />
            AirPlay
            <span className={`protocol-dot ${state.airplay.status}`} />
          </span>
          <span className="protocol-divider" />
          <span title={state.android?.detail}>
            <Cast size={14} />
            Android LAN
            <span className={`protocol-dot ${state.android?.status}`} />
          </span>
          <span className="protocol-divider" />
          <span title={state.miracast.detail}>
            <Cast size={14} />
            Miracast
            <span className={`protocol-dot ${state.miracast.status}`} />
          </span>
        </div>
        <span className="receiver-status">
          {state.streaming
            ? 'Connected'
            : ready
              ? 'Ready to receive'
              : state.airplay.status === 'starting'
                ? 'Starting receiver'
                : state.airplay.status === 'unavailable'
                  ? 'Windows receiver'
                  : 'Receiver unavailable'}
        </span>
        <span className="version">
          <Snowflake size={12} />
          BIFROST 1.0
        </span>
      </footer>
    </main>
  )
}
export default function App() {
  return new URLSearchParams(location.search).get('view') === 'stream' ? <Stream /> : <Welcome />
}
