import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: {
      // API_TARGET lets a second copy point at another backend (e.g. a demo database).
      '/api': { target: process.env.API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
