import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  powerSaveBlocker,
  nativeTheme
} from 'electron'
import { join } from 'node:path'
import { Receiver } from '../receiver'
import { UpdateController } from '../updater'
let welcome: BrowserWindow | null = null
let stream: BrowserWindow | null = null
let tray: Tray | undefined
let receiver: Receiver
let updater: UpdateController
let quitting = false
let blocker: number | undefined
let lastFrame: Buffer | undefined
const assets = () => (app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'))
function load(window: BrowserWindow, view: 'welcome' | 'stream'): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('view', view)
    void window.loadURL(url.toString())
  } else void window.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
}
function baseWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    icon: join(assets(), 'icon.png'),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    ...options
  })
  window.setMenu(null)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false))
  window.webContents.on('did-finish-load', () =>
    window.webContents.send('receiver:state', receiver.state)
  )
  return window
}
function showWelcome(): void {
  if (welcome && !welcome.isDestroyed()) {
    if (welcome.isMinimized()) welcome.restore()
    welcome.show()
    welcome.focus()
    return
  }
  welcome = baseWindow({
    width: 960,
    height: 760,
    minWidth: 680,
    minHeight: 600,
    title: 'Bifrost',
    show: false
  })
  load(welcome, 'welcome')
  welcome.once('ready-to-show', () => welcome?.show())
  welcome.on('close', (event) => {
    if (!quitting && tray) {
      event.preventDefault()
      welcome?.hide()
    }
  })
  welcome.on('closed', () => {
    welcome = null
  })
}
function openStream(): void {
  if (stream && !stream.isDestroyed()) {
    stream.show()
    stream.focus()
    return
  }
  stream = baseWindow({
    width: 1120,
    height: 760,
    minWidth: 360,
    minHeight: 260,
    title: 'Bifrost — AirPlay',
    backgroundColor: '#080b0e',
    show: false,
    fullscreenable: true,
    maximizable: true,
    minimizable: true,
    resizable: true
  })
  load(stream, 'stream')
  stream.once('ready-to-show', () => stream?.show())
  stream.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      event.preventDefault()
      stream?.setFullScreen(!stream.isFullScreen())
    } else if (input.key === 'Escape' && stream?.isFullScreen()) {
      event.preventDefault()
      stream.setFullScreen(false)
    }
  })
  stream.on('closed', () => {
    stream = null
    if (!quitting && receiver.state.streaming) void receiver.disconnect()
  })
  if (blocker === undefined) blocker = powerSaveBlocker.start('prevent-display-sleep')
}
function refreshTray(): void {
  if (!tray) return
  const ready = receiver.state.airplay.status === 'ready'
  tray.setToolTip(
    `Bifrost — ${receiver.state.streaming ? 'Connected' : ready ? 'Ready to receive' : receiver.state.airplay.status === 'starting' ? 'Starting receiver' : 'Receiver unavailable'}`
  )
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Bifrost', enabled: false },
      { label: receiver.state.name, enabled: false },
      { type: 'separator' },
      { label: `AirPlay: ${receiver.state.airplay.status}`, enabled: false },
      { label: `Miracast: ${receiver.state.miracast.status}`, enabled: false },
      { type: 'separator' },
      { label: 'Open Bifrost', click: showWelcome },
      ...(stream
        ? [
            {
              label: 'Show stream',
              click: () => {
                stream?.show()
                stream?.focus()
              }
            }
          ]
        : []),
      { type: 'separator' },
      {
        label:
          updater?.status === 'ready'
            ? `Restart to update to ${updater.version}`
            : updater?.status === 'checking'
              ? 'Checking for updates…'
              : updater?.status === 'downloading'
                ? `Downloading ${updater.version}…`
                : 'Check for updates…',
        enabled: !!updater?.supported && !['checking', 'downloading'].includes(updater.status),
        click: () => (updater.status === 'ready' ? updater.install() : updater.check())
      },
      { type: 'separator' },
      { label: 'Quit Bifrost', click: () => app.quit() }
    ])
  )
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.setName('Bifrost')
  app.on('second-instance', showWelcome)
  app
    .whenReady()
    .then(async () => {
      nativeTheme.themeSource = 'light'
      updater = new UpdateController(refreshTray)
      if (process.platform === 'win32') app.setAppUserModelId('com.bifrost.receiver')
      receiver = new Receiver(
        join(assets(), 'receiver'),
        app.getPath('userData'),
        join(assets(), 'windows/miracast.ps1')
      )
      receiver.on('state', (state) => {
        for (const window of BrowserWindow.getAllWindows())
          window.webContents.send('receiver:state', state)
        refreshTray()
      })
      receiver.on('connected', openStream)
      receiver.on('frame', (frame) => {
        lastFrame = frame
        if (stream && !stream.isDestroyed() && !stream.webContents.isLoadingMainFrame())
          stream.webContents.send('receiver:frame', frame)
      })
      receiver.on('disconnected', () => {
        lastFrame = undefined
        stream?.close()
        if (blocker !== undefined) {
          powerSaveBlocker.stop(blocker)
          blocker = undefined
        }
        refreshTray()
      })
      ipcMain.handle('receiver:state', () => receiver.state)
      ipcMain.on('receiver:subscribe', (event) => {
        if (stream?.webContents === event.sender && lastFrame)
          event.sender.send('receiver:frame', lastFrame)
      })
      ipcMain.handle('window:hide', (event) => BrowserWindow.fromWebContents(event.sender)?.hide())
      ipcMain.handle('window:fullscreen', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (window === stream) window?.setFullScreen(!window.isFullScreen())
      })
      const image = nativeImage
        .createFromPath(join(assets(), 'icon.png'))
        .resize({ width: 24, height: 24 })
      tray = new Tray(image)
      tray.on('double-click', showWelcome)
      if (process.platform !== 'win32') tray.on('click', showWelcome)
      refreshTray()
      showWelcome()
      await receiver.start()
      updater.start()
    })
    .catch((error) => {
      console.error(error)
      app.quit()
    })
  app.on('activate', showWelcome)
  app.on('window-all-closed', () => {
    /* Receiver stays alive in the tray. */
  })
  app.on('before-quit', () => {
    quitting = true
    receiver?.stop()
    updater?.stop()
    tray?.destroy()
    if (blocker !== undefined) powerSaveBlocker.stop(blocker)
  })
}
