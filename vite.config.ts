import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // on gère l'enregistrement nous-mêmes dans main.ts
      workbox: {
        // JEU JOUABLE HORS CONNEXION (retour user : « je prends l'avion, je veux y jouer »). Sans ça, le
        // glob par défaut ne pré-cache que js/css/html (7 fichiers) → en mode avion les images/sons ne
        // chargent pas. On pré-cache TOUS les assets (art ~173 Mo + audio) : premier lancement sur wifi
        // télécharge tout, ensuite 100 % offline. maximumFileSize relevé (le plus gros PNG ~1,83 Mo).
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,mp3,wav,ogg,json,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
