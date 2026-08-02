// Vérifie que les TERRAINS se chargent et TOURNENT vraiment dans un navigateur.
//
// POURQUOI CE SCRIPT EXISTE. Le trampoline s'abonnait au joueur ~50 lignes avant que le joueur soit
// construit : `physics.add.overlap(undefined, groupe)` s'enregistre sans broncher, puis le moteur
// explose à la PREMIÈRE frame — « undefined is not an object (evaluating 'e.isParent') ». Tout terrain
// portant un trampoline était donc injouable, et RIEN ne l'a vu : tsc est content (le champ est
// déclaré `!`), les 1490 tests unitaires n'instancient aucune scène Phaser, et smoke-boot s'arrête à
// l'écran-titre. Le seul témoin possible, c'est de faire tourner le moteur sur un vrai terrain.
//
// On ne teste pas les 49 terrains (trop long) : un ÉCHANTILLON qui couvre chaque mécanique récente,
// plus quelques terrains tirés au sort de façon déterministe pour attraper ce qu'on n'a pas prévu.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const FRAMES_MS = 2500 // ~150 frames : largement assez pour que le monde se peuple et se collisionne

const preview = spawn('npx', ['vite', 'preview', '--port', '5198', '--strictPort'], { stdio: 'ignore' })
const echecs = []
const browser = await chromium.launch()
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://localhost:5198/'); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
  // le jeu ne doit jamais toucher au réseau Google depuis une sonde : la sauvegarde « sonde »
  // atterrirait dans le classement public.
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  let erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).split('\n')[0]))
  await page.goto('http://localhost:5198/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )

  // Un joueur doit exister avant d'entrer dans un terrain : `getPlayer()` lève sinon, et la scène
  // meurt avant d'avoir posé la moindre plateforme (le symptôme masquerait celui qu'on traque).
  await page.evaluate(() => window.__pandaGame.scene.getScene('Title').startFresh('sonde', 'panda-run:sonde'))
  await sleep(600)

  // Échantillon : les mécaniques neuves d'abord (elles n'ont jamais tourné en vrai), puis un tirage
  // déterministe sur le reste — un terrain sur cinq, toujours les mêmes, pour que l'échec soit
  // reproductible.
  const cibles = await page.evaluate(() => {
    const L = window.__pandaLevels
    const ids = Object.keys(L)
    const porte = (f) => ids.filter((id) => f(L[id])).slice(0, 3)
    const choisis = new Set([
      ...porte((l) => (l.trampolines ?? []).length),
      ...porte((l) => (l.arches ?? []).length),
      ...porte((l) => (l.hazards ?? []).some((h) => h.kind === 'water')),
      ...porte((l) => l.boss),
      ...ids.filter((_, i) => i % 5 === 0),
    ])
    return [...choisis]
  })
  if (cibles.length < 5) echecs.push(`échantillon vide (${cibles.length}) : window.__pandaLevels absent ?`)
  console.log(`→ ${cibles.length} terrains à faire tourner`)

  for (const id of cibles) {
    erreurs = []
    await page.evaluate((levelId) => {
      const g = window.__pandaGame
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
      g.scene.start('Level', { levelId, test: true })
    }, id)
    await sleep(FRAMES_MS)
    const vivant = await page.evaluate(() =>
      window.__pandaGame.scene.getScenes(true).some((s) => s.scene.key === 'Level'))
    if (!vivant) erreurs.push('la scène Level n\'est plus active après 2,5 s')
    if (erreurs.length) echecs.push(`${id} : ${[...new Set(erreurs)].join(' | ')}`)
    else console.log(`  ✔ ${id}`)
  }
  // ─── LE TRAMPOLINE REBONDIT-IL VRAIMENT ? ────────────────────────────────────────────────────
  // « Et enfin ça marche pas. » Il ne suffit pas que le terrain se charge : il faut que l'engin FASSE
  // quelque chose. On lâche le panda au-dessus du tapis et on mesure sa remontée. Un rebond ×3 doit le
  // renvoyer nettement plus haut qu'une chute libre ne le ferait remonter — c'est-à-dire : plus haut
  // que son point de départ.
  const niveauTrampo = await page.evaluate(() => {
    const L = window.__pandaLevels
    return Object.keys(L).find((id) => (L[id].trampolines ?? []).length)
  })
  if (!niveauTrampo) echecs.push('aucun terrain à trampoline : le motif a disparu des terrains')
  else {
    erreurs = []
    await page.evaluate((levelId) => {
      const g = window.__pandaGame
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
      g.scene.start('Level', { levelId, test: true })
    }, niveauTrampo)
    await sleep(1200)
    const mesure = await page.evaluate(() => {
      const sc = window.__pandaGame.scene.getScene('Level')
      const tr = sc.levelDef.trampolines[0]
      const TUILE = 32
      const depart = (tr.y - 3) * TUILE
      sc.player.setPosition(tr.x * TUILE + TUILE / 2, depart)
      sc.player.body.setVelocity(0, 0)
      return new Promise((res) => {
        let plusHaut = depart
        const t0 = performance.now()
        const tick = () => {
          plusHaut = Math.min(plusHaut, sc.player.y)
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
          else res({ depart, plusHaut: Math.round(plusHaut), gain: Math.round((depart - plusHaut) / TUILE) })
        }
        tick()
      })
    })
    console.log(`  trampoline (${niveauTrampo}) : remontée de ${mesure.gain} tuiles au-dessus du lâcher`)
    if (mesure.gain < 4) echecs.push(`le trampoline ne renvoie pas le panda (${mesure.gain} tuiles gagnées, attendu ≥ 4)`)
    if (erreurs.length) echecs.push(`trampoline : ${[...new Set(erreurs)].join(' | ')}`)
  }
} catch (e) {
  echecs.push(`sonde interrompue : ${e.message.split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}
if (echecs.length) {
  console.error('\n❌ TERRAINS EN ÉCHEC :')
  for (const e of echecs) console.error('   ' + e)
  process.exit(1)
}
console.log('✔ tous les terrains de l\'échantillon tournent sans erreur')
