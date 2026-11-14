import { contextBridge, ipcRenderer } from 'electron'
import type { ReceiverBridge } from '../../shared/types'
const bridge: ReceiverBridge = {
  state: () => ipcRenderer.invoke('receiver:state'),
  videoSize: (width, height) => ipcRenderer.send('receiver:video-size', width, height),
  onState: (callback) => {
    const listener = (_: unknown, value: Parameters<typeof callback>[0]) => callback(value)
    ipcRenderer.on('receiver:state', listener)
    return () => {
      ipcRenderer.removeListener('receiver:state', listener)
    }
  },
  onFrame: (callback) => {
    const listener = (_: unknown, value: Parameters<typeof callback>[0]) => callback(value)
    ipcRenderer.on('receiver:frame', listener)
    ipcRenderer.send('receiver:subscribe')
    return () => {
      ipcRenderer.removeListener('receiver:frame', listener)
    }
  }
}
contextBridge.exposeInMainWorld('bifrost', bridge)
