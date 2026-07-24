import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // on gère l'enregistrement nous-mêmes dans main.ts
      workbox: {
        // JEU JOUABLE HORS CONNEXION — stratégie HYBRIDE (fiable sur iPhone). Pré-cacher les ~173 Mo d'art
        // d'un coup à l'install faisait ÉCHOUER le service worker sur iOS (install trop longue/coupée →
        // le SW n'activait jamais son cache → en ligne OK mais hors ligne RIEN). À la place :
        //  1) PRÉCACHE LÉGER = seulement le cœur de l'app (js/css/html/manifest/icônes) → install instantanée
        //     et garantie → l'app se lance en standalone même hors ligne.
        //  2) RUNTIME CacheFirst = images (png/jpg) et sons (mp3…) mis en cache AU FIL du jeu : tout ce
        //     qui a été chargé une fois en ligne est ensuite dispo hors ligne (ex. dans l'avion).
        globPatterns: ['**/*.{js,css,html,ico,svg,webmanifest}', 'icon-*.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => /\.(?:png|jpg|jpeg|webp|gif|svg)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'panda-art',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => /\.(?:mp3|wav|ogg)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'panda-audio',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
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
