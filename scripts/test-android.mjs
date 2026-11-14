import { _electron as electron, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
const adbPath = process.env.ADB || `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
const device = process.env.ANDROID_SERIAL || 'emulator-5554'
const adb = (...args) =>
  execFileSync(adbPath, ['-s', device, ...args], { encoding: 'utf8', timeout: 30000 })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function nodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
  return [...adb('shell', 'cat', '/sdcard/window.xml').matchAll(/<node\s+([^>]+)/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
  )
}
async function tap(match) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const node = nodes().find(match)
    if (node) {
      const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number)
      adb('shell', 'input', 'tap', String(((x1 + x2) / 2) | 0), String(((y1 + y2) / 2) | 0))
      return node
    }
    await delay(500)
  }
  throw new Error(
    'Android UI element not found: ' +
      match +
      '\n' +
      nodes()
        .filter((n) => n.text)
        .map((n) => n.text)
        .join('\n')
  )
}
await mkdir('artifacts', { recursive: true })
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['.'], env, timeout: 30000 })
try {
  const welcome = await app.firstWindow()
  await welcome.waitForFunction(
    async () => (await window.bifrost.state()).android?.status === 'ready'
  )
  const state = await welcome.evaluate(() => window.bifrost.state())
  const port = state.android.detail.match(/:(\d+)/)[1]
  adb('install', '-r', 'dist/test/Bifrost-Sender-test.apk')
  adb('shell', 'pm', 'grant', 'com.bifrost.sender', 'android.permission.POST_NOTIFICATIONS')
  adb('shell', 'am', 'force-stop', 'com.bifrost.sender')
  adb('shell', 'cmd', 'statusbar', 'collapse')
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
  console.log(adb('shell', 'am', 'start', '-W', '-n', 'com.bifrost.sender/.MainActivity'))
  await tap((n) => n.text === 'Connect by address')
  await tap((n) => n.class === 'android.widget.EditText')
  adb('shell', 'input', 'text', `10.0.2.2:${port}`)
  await tap((n) => /^connect$/i.test(n.text))
  await tap((n) => /^(start now|start sharing|share screen)$/i.test(n.text))
  await expect.poll(() => app.windows().length, { timeout: 30000 }).toBe(2)
  const stream = app.windows().find((p) => p !== welcome)
  const errors = []
  stream.on('pageerror', (e) => errors.push(e.message))
  await stream.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frames) > 8, {
    timeout: 30000
  })
  const before = await stream.locator('canvas').screenshot()
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await delay(1800)
  const after = await stream.locator('canvas').screenshot()
  expect(before.equals(after)).toBe(false)
  const portrait = await stream
    .locator('canvas')
    .evaluate((c) => ({ width: c.width, height: c.height, frames: Number(c.dataset.frames) }))
  expect(portrait.height).toBeGreaterThan(portrait.width)
  const contentSize = () =>
    app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('view=stream'))
        .getContentSize()
    )
  const portraitWindow = await contentSize()
  expect(
    Math.abs(portraitWindow[0] / portraitWindow[1] - portrait.width / portrait.height)
  ).toBeLessThan(0.005)
  console.log('Portrait stream:', portrait)
  adb('shell', 'am', 'start', '-W', '-n', 'com.bifrost.sender/.MainActivity')
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
  await stream.waitForFunction(
    () => {
      const c = document.querySelector('canvas')
      return c.width > c.height
    },
    { timeout: 30000 }
  )
  const landscape = await stream
    .locator('canvas')
    .evaluate((c) => ({ width: c.width, height: c.height, frames: Number(c.dataset.frames) }))
  await expect
    .poll(async () => {
      const size = await contentSize()
      return Math.abs(size[0] / size[1] - landscape.width / landscape.height)
    })
    .toBeLessThan(0.005)
  const landscapeWindow = await contentSize()
  await stream.screenshot({ path: 'artifacts/android-stream.png' })
  await stream.keyboard.press('F11')
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('view=stream'))
          .isFullScreen()
      )
    )
    .toBe(true)
  await stream.keyboard.press('Escape')
  await stream.close()
  await expect
    .poll(async () => (await welcome.evaluate(() => window.bifrost.state())).streaming, {
      timeout: 10000
    })
    .toBe(false)
  expect(errors).toEqual([])
  const report = {
    name: state.name,
    portrait,
    landscape,
    portraitWindow,
    landscapeWindow,
    wholeScreenChanged: true,
    nativeCloseDisconnects: true,
    errors
  }
  await writeFile('artifacts/android-validation.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  adb('shell', 'am', 'force-stop', 'com.bifrost.sender')
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '1')
  await app.close()
}
