export type Availability = 'starting' | 'ready' | 'unavailable' | 'error'
export interface ReceiverState {
  name: string
  platform: NodeJS.Platform
  airplay: { status: Availability; detail?: string }
  miracast: { status: Availability; detail?: string }
  streaming: boolean
}
export interface ReceiverBridge {
  state(): Promise<ReceiverState>
  hide(): Promise<void>
  fullscreen(): Promise<void>
  onState(callback: (state: ReceiverState) => void): () => void
  onFrame(callback: (data: Uint8Array) => void): () => void
}
