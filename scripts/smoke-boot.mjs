// Vérifie que le jeu DÉMARRE réellement dans un navigateur : sert dist/, charge la page, et échoue
// à la moindre erreur JS ou si l'écran-titre n'apparaît pas.
//
// Pourquoi ce script existe : la build R285 est partie en production avec un
// « ReferenceError: Can't find variable: Phaser » qui tuait le boot. Les tests unitaires et tsc
// étaient VERTS — aucun d'eux n'exécute le bundle dans un navigateur. C'est ce trou que ça ferme.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const preview = spawn('npx', ['vite', 'preview', '--port', '5197', '--strictPort'], { stdio: 'ignore' })
const errors = []
const browser = await chromium.launch()
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://localhost:5197/'); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
  page.on('pageerror', (e) => errors.push(String(e.message)))
  page.on('console', (m) => { if (m.type() === 'error' && /ReferenceError|TypeError|is not a function/.test(m.text())) errors.push(m.text()) })
  await page.goto('http://localhost:5197/', { waitUntil: 'domcontentloaded' })
  // le Preload décode des centaines d'assets : on laisse largement le temps
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )
  console.log('✔ écran-titre atteint')
} catch (e) {
  errors.push(`écran-titre jamais atteint : ${e.message.split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}
if (errors.length) {
  console.error('\n❌ ERREURS AU BOOT :')
  for (const e of [...new Set(errors)]) console.error('   ' + e)
  process.exit(1)
}
console.log('✔ aucune erreur JS au démarrage')
