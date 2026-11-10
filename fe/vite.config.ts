import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WebContainer needs SharedArrayBuffer, which the browser only enables on
// cross-origin isolated pages, so these headers must be sent with the app.
const crossOriginIsolation = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: crossOriginIsolation,
    // Forward API calls to the backend (be/) so no CORS setup is needed.
    proxy: {
      '/template': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
    },
  },
  preview: {
    headers: crossOriginIsolation,
  },
})
