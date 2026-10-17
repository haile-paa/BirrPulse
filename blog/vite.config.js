import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The 3D scenes are lazy-loaded (see Hero.jsx / DownloadCta.jsx), so Three.js
// is split into its own chunk automatically and does not slow the first paint.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
})
