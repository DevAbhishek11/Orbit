import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

/**
 * The web app talks to its OWN origin only (`/api/v1`, `/health/*`) and the
 * dev server forwards those to the API. That keeps the browser out of CORS
 * entirely and lets the httpOnly refresh cookie work, including behind a
 * preview/tunnel host — so `allowedHosts` is opened up and the bind address is
 * 0.0.0.0 rather than localhost.
 *
 * Point the proxy somewhere else with ORBIT_API_URL (e.g. a deployed API).
 */
const API_TARGET = process.env.ORBIT_API_URL ?? 'http://127.0.0.1:8010'

const proxy = {
  '/api': { target: API_TARGET, changeOrigin: true, headers: { origin: 'http://localhost:5173' } },
  '/health': { target: API_TARGET, changeOrigin: true, headers: { origin: 'http://localhost:5173' } },
  '/metrics': { target: API_TARGET, changeOrigin: true, headers: { origin: 'http://localhost:5173' } },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy,
  },
})
