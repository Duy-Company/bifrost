import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Radio, Snowflake, Minus, Airplay, Cast } from 'lucide-react'
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
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    let active = true
    const context = canvas.current!.getContext('2d', { alpha: false })!
    const unsubscribe = window.bifrost.onFrame((data) => {
      if (busy.current) return
      busy.current = true
      void createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/jpeg' }))
        .then((frame) => {
          const target = canvas.current
          if (active && target) {
            if (target.width !== frame.width || target.height !== frame.height) {
              target.width = frame.width
              target.height = frame.height
            }
            context.drawImage(frame, 0, 0)
          }
          frame.close()
        })
        .catch((error) => console.error('Frame decode failed:', error))
        .finally(() => {
          busy.current = false
        })
    })
    const resize = () => setFullscreen(window.innerHeight >= screen.height - 2)
    window.addEventListener('resize', resize)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('resize', resize)
    }
  }, [])
  return (
    <div className="stream">
      <canvas ref={canvas} aria-label="Mirrored screen" />
      <button
        className="fullscreen-button"
        title={fullscreen ? 'Exit full screen' : 'Full screen'}
        aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
        onClick={() => void window.bifrost.fullscreen()}
      >
        {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
      </button>
    </div>
  )
}
function Welcome() {
  const [state, setState] = useState(initial)
  useEffect(() => {
    void window.bifrost.state().then(setState)
    return window.bifrost.onState(setState)
  }, [])
  const ready = state.airplay.status === 'ready'
  return (
    <main className="welcome">
      <header className="welcome-header">
        <a className="brand" aria-label="Bifrost">
          <IceBolt />
          <span>Bifrost</span>
        </a>
        <button
          className="hide-button"
          title="Hide to tray"
          aria-label="Hide to tray"
          onClick={() => void window.bifrost.hide()}
        >
          <Minus size={17} />
        </button>
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
