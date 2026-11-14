import type { ReceiverBridge } from '../shared/types'
declare global {
  interface Window {
    bifrost: ReceiverBridge
  }
}
