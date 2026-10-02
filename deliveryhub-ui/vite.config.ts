import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The backend picks the platform API from the Host header, so the proxy keeps it (changeOrigin: false).
// Open the panel at http://hub.localhost:5175. API_TARGET points the proxy at another backend if needed.
const backend = { target: process.env.API_TARGET ?? 'http://localhost:8100', changeOrigin: false }
const proxy = { '/api': backend, '/media': backend }
const server = { port: 5175, strictPort: true, host: true, allowedHosts: ['.localhost'], proxy }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server,
  preview: server,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Dates in the UI are local: test them in the platform's time zone.
    env: { TZ: 'Asia/Tashkent' },
  },
})
