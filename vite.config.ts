import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  // ⚠️ DÉLAI DE TEST RELEVÉ À 20 s, ET C'EST L'ASSEMBLAGE QUI L'EXIGE. Plusieurs fichiers construisent
  // les 58 terrains puis les parcourent (atteignabilité, poches closes, relief). Chaque lot de
  // corrections a alourdi cette construction — comblement des poches, rognage des doubles planchers,
  // contrôle des pièges avant creusement — et sous exécution parallèle certains fichiers frôlaient les
  // 5 s par défaut de vitest : ils échouaient en TIMEOUT, pas sur leur verdict. Un test qui devient
  // instable ne protège plus rien ; celui-ci reste strict sur ce qu'il vérifie, juste patient.
  test: { testTimeout: 20_000, hookTimeout: 20_000 },
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
        // clientsClaim : le SW prend le CONTRÔLE de la page dès sa 1re activation (pas seulement au
        // reload suivant). Sans ça, ajouter à l'écran d'accueil juste après la 1re visite donnait un
        // clip SANS SW contrôlant → lancement hors-ligne KO (« désactiver le mode avion »). Avec, la
        // coquille (index.html) est servie depuis le cache dès l'install → l'app se lance en avion.
        clientsClaim: true,
        skipWaiting: true,
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
