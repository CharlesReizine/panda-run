// Vérifie dans un VRAI navigateur, au format d'un iPhone en paysage, que le HUD de jeu COLLE AUX
// BORDS DE L'ÉCRAN.
//
// POURQUOI CE SCRIPT EXISTE. Le jeu dessine dans un espace de conception 960×540 qui est CENTRÉ sur un
// écran plus large (centerCamera décale la caméra de −BLEED_X). Écrire `x = 8` ne place donc pas un
// objet à 8 px du bord : sur un écran 2,17:1 il apparaît à ~115 px. Le panneau vie/XP/or flottait
// ainsi au milieu-gauche — retour user : « les stats, la vie et tout, c'est pas tout à gauche de
// l'écran mais genre milieu gauche, pas ouf ». Aucun test unitaire ne pouvait le voir : en
// environnement node il n'y a pas de `window`, donc VIEW_W = 960, donc le débord vaut ZÉRO et le bug
// est mathématiquement invisible. Il faut un navigateur à un format large. D'où ce script.
//
// ⚠️ LE RÉSEAU EST COUPÉ POUR TOUT CE QUI EST GOOGLE. On amorce une partie « sonde » pour que le HUD
// ait un joueur à afficher, et une partie amorcée pousse sa sauvegarde dans le cloud : sans blocage,
// ce script polluerait le classement public à chaque exécution.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5198
// tolérances : le HUD a des marges internes assumées, on vérifie qu'il touche le bord, pas qu'il le colle
const MAX_LEFT = 20
const MAX_RIGHT = 30

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch()
const problems = []
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {}
    await sleep(500)
  }
  // 874×402 = le format d'un iPhone récent en paysage (~2,17:1), celui qui révèle le débord
  const page = await browser.newPage({ viewport: { width: 874, height: 402 } })
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  await page.route('**://*.firebaseio.com/**', (r) => r.abort())
  page.on('pageerror', (e) => problems.push(`erreur JS : ${e.message}`))

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )

  const m = await page.evaluate(async () => {
    const game = window.__pandaGame
    const title = game.scene.getScene('Title')
    if (typeof title.startFresh !== 'function') return { err: 'TitleScene.startFresh introuvable (renommée ?)' }
    title.startFresh('sonde', 'panda-run:sonde') // amorce un joueur : le HUD a besoin d'en afficher un
    await new Promise((r) => setTimeout(r, 400))
    game.scene.start('UI', { levelKey: 'Training', training: true })
    await new Promise((r) => setTimeout(r, 900))

    const ui = game.scene.getScene('UI')
    const scroll = ui.cameras.main.scrollX
    let left = Infinity, right = -Infinity
    for (const o of ui.children.list) {
      if (!o.getBounds || !o.visible) continue
      const b = o.getBounds()
      if (b.width <= 0 || b.width > 700) continue // on ignore les voiles plein écran
      left = Math.min(left, b.left - scroll)
      right = Math.max(right, b.right - scroll)
    }
    return { w: game.scale.width, bleed: Math.round(-scroll), left: Math.round(left), right: Math.round(right) }
  })

  if (m.err) problems.push(m.err)
  else {
    console.log(`largeur logique ${m.w} (débord ${m.bleed} px de chaque côté)`)
    console.log(`HUD : premier pixel à ${m.left}, dernier à ${m.right} sur ${m.w}`)
    if (m.bleed === 0) problems.push('aucun débord mesuré : le format de test ne révèle pas le bug')
    if (m.left > MAX_LEFT) problems.push(`HUD décollé du bord GAUCHE : ${m.left} px (max ${MAX_LEFT})`)
    if (m.w - m.right > MAX_RIGHT) problems.push(`HUD décollé du bord DROIT : ${m.w - m.right} px (max ${MAX_RIGHT})`)
  }
} catch (e) {
  problems.push(`sonde en échec : ${String(e.message).split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

if (problems.length) {
  console.error('\n❌ CADRAGE DU HUD :')
  for (const p of [...new Set(problems)]) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ le HUD colle bien aux deux bords de l\'écran')
