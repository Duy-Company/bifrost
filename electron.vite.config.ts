import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
export default defineConfig({
  main: {
    build: { lib: { entry: 'electron/main/index.ts' } },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: { lib: { entry: 'electron/preload/index.ts' } },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve('renderer'),
    build: { rollupOptions: { input: resolve('renderer/index.html') } },
    resolve: { alias: { '@': resolve('renderer') } },
    plugins: [react()]
  }
})
