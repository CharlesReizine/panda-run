import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // on gère l'enregistrement nous-mêmes dans main.ts
      manifest: {
        name: 'Panda-Run',
        short_name: 'Panda-Run',
        description: 'RPG side-scroller tout mignon',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#4caf50',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
