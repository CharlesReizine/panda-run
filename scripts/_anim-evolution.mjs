// Capture TEMPORAIRE (non versionnée) — pellicule de l'animation d'évolution de classe.
// Démarre le jeu en dev, place un novice éligible, ouvre l'écran de changement de classe, choisit une
// classe, puis photographie la séquence à intervalles réguliers. Sert à MONTRER l'animation.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT ?? '/tmp/anim-evolution'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PORT = 5297
const server = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: '/Users/charlesreizine/panda-run', stdio: 'ignore', env: { ...process.env, FORCE_COLOR: '0' },
})
const base = `http://127.0.0.1:${PORT}`
for (let i = 0; i < 60; i++) { try { const r = await fetch(base); if (r.ok) break } catch {} await sleep(500) }

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
const page = await context.newPage()
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
await page.addInitScript(() => { try { localStorage.setItem('panda-run:tuto-vu', '1') } catch {} })
await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => !!window.__panda, { timeout: 30000 })
// ⚠️ ON ATTEND QUE LES TEXTURES SOIENT CUITES. `scene.start('ClassChange')` court-circuite l'écran de
// préchargement : sans cette attente, les pandas sortent en carré vert « texture manquante » — un défaut
// du harnais, pas du jeu.
await page.waitForFunction(() => window.__panda.game.textures.exists('panda-novice')
  && window.__panda.game.textures.exists('panda-mage'), { timeout: 60000 })

// novice au niveau requis → l'écran propose les trois classes
await page.evaluate(() => {
  const { setPlayer, newPlayer } = window.__panda
  const p = newPlayer('Cap')
  p.classId = 'novice'
  p.level = 12
  setPlayer(p)
  window.__panda.game.scene.start('ClassChange')
})
await sleep(1200)
await page.screenshot({ path: `${OUT}/00-ecran.png` })

// clique la carte du milieu (mage) : les cartes sont posées par cardRect, la scène gère le clic
const box = page.viewportSize()
await page.mouse.click(box.width / 2, 260)

// ⚠️ ON LIT L'HEURE DANS LA SCÈNE, ON NE LA DÉDUIT PAS DU RYTHME DES CAPTURES. Chaque screenshot coûte
// 100 à 300 ms : nommer les images d'après un sleep de 180 ms donnait des horodatages FAUX (la « frame 10 »
// tombait en réalité sur la révélation). On demande donc à la scène où elle en est.
const heure = () => page.evaluate(() => {
  const sc = window.__panda.game.scene.getScene('ClassChange')
  return sc && sc.anim ? Math.round(sc.time.now - sc.anim.t0) : -1
})
for (let i = 0; i < 30; i++) {
  const t = await heure()
  if (t < 0 && i > 2) break // séquence terminée
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, '0')}-t${String(Math.max(0, t)).padStart(4, '0')}.png` })
  await sleep(30)
}
console.error(`pellicule dans ${OUT}`)
await browser.close()
server.kill()
process.exit(0)
