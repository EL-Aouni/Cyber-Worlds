import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { manusGameTuning } from './scripts/manus-tuning/vite.mjs'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

function copyAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    closeBundle() {
      const src = resolve('assets')
      const dest = resolve('dist', 'assets')
      if (existsSync(src)) {
        mkdirSync(dest, { recursive: true })
        cpSync(src, dest, { recursive: true, force: true })
      }
    },
  }
}

// Relative base keeps production output portable; the Session owns preview HOST/PORT.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['HOST', 'PORT'])
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
  return {
    base: './',
    plugins: [manusGameTuning(), copyAssetsPlugin()],
    server: {
      host: env.HOST ?? '127.0.0.1', port, strictPort: true,
      allowedHosts: ['.manuspre.computer', '.manus.computer', '.manus-asia.computer', '.manuscomputer.ai', '.manusvm.computer', 'localhost', '127.0.0.1'],
    },
    build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 4600, sourcemap: false },
    test: { environment: 'node', include: ['tests/**/*.test.{ts,mjs}'] },
  }
})
