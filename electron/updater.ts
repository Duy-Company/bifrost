import { app, dialog, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
export class UpdateController {
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'error' = 'idle'
  version = ''
  private manual = false
  private interval?: ReturnType<typeof setInterval>
  private initial?: ReturnType<typeof setTimeout>
  readonly supported = process.platform === 'win32' && app.isPackaged
  constructor(private changed: () => void) {}
  start(): void {
    if (!this.supported) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.allowDowngrade = false
    autoUpdater.logger = {
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: () => {}
    }
    autoUpdater.on('checking-for-update', () => {
      this.status = 'checking'
      this.changed()
    })
    autoUpdater.on('update-available', (info) => {
      this.status = 'downloading'
      this.version = info.version
      this.changed()
    })
    autoUpdater.on('update-not-available', () => {
      this.status = 'idle'
      this.changed()
      if (this.manual)
        void dialog.showMessageBox({
          type: 'info',
          title: 'Bifrost',
          message: "You're up to date.",
          detail: `Bifrost ${app.getVersion()}`,
          buttons: ['OK']
        })
      this.manual = false
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.status = 'ready'
      this.version = info.version
      this.manual = false
      this.changed()
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'Bifrost update ready',
          body: `Version ${info.version} is ready. Restart Bifrost to install it.`
        })
        notification.on('click', () => this.install())
        notification.show()
      }
    })
    autoUpdater.on('error', (error) => {
      this.status = 'error'
      this.changed()
      if (this.manual)
        void dialog.showMessageBox({
          type: 'error',
          title: 'Bifrost',
          message: 'Could not check for updates.',
          detail: error.message,
          buttons: ['OK']
        })
      this.manual = false
    })
    this.initial = setTimeout(() => this.check(false), 15000)
    this.interval = setInterval(() => this.check(false), 6 * 60 * 60 * 1000)
    this.initial.unref()
    this.interval.unref()
  }
  check(manual = true): void {
    if (!this.supported || ['checking', 'downloading', 'ready'].includes(this.status)) return
    this.manual = manual
    void autoUpdater.checkForUpdates().catch(() => {
      /* Reported by the updater error event. */
    })
  }
  install(): void {
    if (!this.supported || this.status !== 'ready') return
    void dialog
      .showMessageBox({
        type: 'question',
        title: 'Bifrost',
        message: `Install Bifrost ${this.version}?`,
        detail: 'Bifrost will restart and disconnect any active stream.',
        buttons: ['Restart and update', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall(false, true)
      })
  }
  stop(): void {
    if (this.initial) clearTimeout(this.initial)
    if (this.interval) clearInterval(this.interval)
  }
}
