export type Availability = 'starting' | 'ready' | 'unavailable' | 'error'
export interface ReceiverStatus {
  status: Availability
  detail?: string
}
export interface ReceiverState {
  name: string
  platform: NodeJS.Platform
  airplay: ReceiverStatus
  miracast: ReceiverStatus
  android?: ReceiverStatus
  streaming: boolean
}
export interface EncodedFrame {
  kind: 'h264'
  data: Uint8Array
  timestamp: number
  config: boolean
  key: boolean
}
export interface ImageFrame {
  kind: 'image'
  data: Uint8Array
  mime: 'image/png'
}
export type VideoFramePacket = EncodedFrame | ImageFrame
export interface ReceiverBridge {
  state(): Promise<ReceiverState>
  videoSize(width: number, height: number): void
  onState(callback: (state: ReceiverState) => void): () => void
  onFrame(callback: (frame: VideoFramePacket) => void): () => void
}
