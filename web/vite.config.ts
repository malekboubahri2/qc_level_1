import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// In dev, /api is proxied to the local API. In prod, Caddy serves the SPA and
// reverse-proxies /api/* — so the frontend never hardcodes a backend host.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'QC Level 1 — PMP',
        short_name: 'QC Niveau 1',
        description: 'Détection précoce et alerte qualité en production (PMP).',
        lang: 'fr-TN',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAEEE3',
        theme_color: '#1A5560',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
