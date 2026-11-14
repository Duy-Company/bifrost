import { _electron as electron, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
await mkdir('artifacts', { recursive: true })
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['.'], env, timeout: 30000 })
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByRole('heading', { name: /Your screen/ })).toBeVisible()
  await page.waitForFunction(
    () => document.querySelector('.receiver-status')?.textContent !== 'Starting receiver'
  )
  const state = await page.evaluate(() => window.bifrost.state())
  if (process.platform !== 'win32') {
    expect(state.airplay.status).toBe('unavailable')
    expect(state.miracast.status).toBe('unavailable')
  }
  expect(await page.locator('html').getAttribute('lang')).toBe('en')
  expect(await page.getByRole('button').count()).toBe(0)
  expect(
    await page.getByText(/USB|debugging|Tutorial|Instructions|Settings|Pair device/).count()
  ).toBe(0)
  const windowInfo = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    return {
      minimizable: w.isMinimizable(),
      maximizable: w.isMaximizable(),
      fullscreenable: w.isFullScreenable()
    }
  })
  expect(windowInfo).toEqual({ minimizable: true, maximizable: true, fullscreenable: true })
  const layout = await page.evaluate(() => ({
    title: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
    caption: parseFloat(getComputedStyle(document.querySelector('.welcome-center > p')).fontSize),
    overflow:
      document.documentElement.scrollWidth > innerWidth ||
      document.documentElement.scrollHeight > innerHeight
  }))
  expect(layout.title).toBeGreaterThanOrEqual(42)
  expect(layout.caption).toBeGreaterThanOrEqual(15)
  expect(layout.overflow).toBe(false)
  await page.screenshot({ path: 'artifacts/bifrost-welcome.png' })
  // The main-window close action hides it, retaining the receiver and tray.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  expect(
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
  ).toBe(false)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  await app.evaluate(({ app }) => app.emit('second-instance'))
  await expect(page.locator('h1')).toBeVisible()
  expect(errors).toEqual([])
  console.log(
    'PASS: English welcome, no tutorials, native window controls, hide-to-tray, reopen, truthful platform state.'
  )
  console.log('Receiver state:', JSON.stringify(state))
} finally {
  await app.close()
}
