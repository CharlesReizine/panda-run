// Ouvre CHAQUE écran du jeu et TAPE sur chacun de ses boutons, en cherchant une seule chose :
// une erreur JS.
//
// POURQUOI CE SCRIPT EXISTE. Demande du user après une soirée de bugs : « teste tout le jeu, tous les
// boutons, et rajoute des tests de non-régression, on a des problèmes là ». Les 1570 tests unitaires
// n'instancient AUCUNE scène Phaser, et les sondes existantes ne couvrent que le terrain et le son.
// L'écran d'ENTRAÎNEMENT s'est ainsi mis à planter à chaque frame (« Cannot read properties of null
// (reading 'bodies') ») sans que rien ne le voie : il suffisait de l'ouvrir.
//
// ⚠️ ON NE VÉRIFIE PAS CE QUE FONT LES BOUTONS, on vérifie qu'aucun ne CASSE. C'est délibéré : un test
// qui affirmerait le comportement de chaque bouton serait un second jeu à maintenir, et il vieillirait
// mal. Ici, la valeur est ailleurs — cette sonde attrape la classe entière des « écran mort au
// chargement », qui est exactement ce qui a échappé à tout le reste.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5291
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const problemes = []
const browser = await chromium.launch()

// Les écrans qu'on sait ouvrir directement, avec les données minimales qu'ils attendent.
const ECRANS = [
  ['Title', undefined],
  ['WorldMap', undefined],
  ['Menu', undefined],
  ['Inventory', undefined],
  ['Bestiary', undefined],
  ['QuestLog', undefined],
  ['Leaderboard', undefined],
  ['SkillEquip', { standalone: true }],
  ['ClassChange', undefined],
  ['Training', undefined],
  ['Town', undefined],
  ['LevelIntro', { levelId: 'plaine-1', fromNode: 'plaine-1', targetNode: 'plaine-1', dir: 'forward' }],
  ['Level', { levelId: 'plaine-1', test: true }],
  ['Pause', undefined],
]

try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 460 } })
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  await page.route('**://*.firebaseio.com/**', (r) => r.abort())
  let erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).split('\n')[0]))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )
  await page.evaluate(() => window.__pandaGame.scene.getScene('Title').startFresh('sonde', 'panda-run:sonde'))
  await sleep(600)

  for (const [cle, data] of ECRANS) {
    erreurs = []
    const ouvert = await page.evaluate(async ({ cle, data }) => {
      const g = window.__pandaGame
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
      try { g.scene.start(cle, data) } catch (e) { return { err: String(e && e.message) } }
      await new Promise((r) => setTimeout(r, 1400))
      const sc = g.scene.getScene(cle)
      if (!g.scene.getScenes(true).some((s) => s.scene.key === cle)) return { err: 'scène inactive après démarrage' }
      // on laisse tourner quelques frames : les plantages d'update ne se voient pas au premier rendu
      await new Promise((r) => setTimeout(r, 900))
      return { objets: sc.children.list.length }
    }, { cle, data })
    if (ouvert.err) { problemes.push(`${cle} : ${ouvert.err}`); continue }
    if (erreurs.length) { problemes.push(`${cle} (ouverture) : ${[...new Set(erreurs)].join(' | ')}`); continue }

    // ─── ON TAPE SUR TOUT ────────────────────────────────────────────────────────────────────
    // Chaque objet interactif reçoit un pointerdown. On les prend un par un et on revient sur
    // l'écran entre deux : un bouton peut changer de scène, et on veut tester les SUIVANTS aussi.
    const n = await page.evaluate((cle) => {
      const sc = window.__pandaGame.scene.getScene(cle)
      return sc.children.list.filter((o) => o.input?.enabled).length
    }, cle)
    for (let k = 0; k < Math.min(n, 24); k++) {
      erreurs = []
      const r = await page.evaluate(async ({ cle, k, data }) => {
        const g = window.__pandaGame
        if (!g.scene.getScenes(true).some((s) => s.scene.key === cle)) {
          for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
          g.scene.start(cle, data)
          await new Promise((r2) => setTimeout(r2, 900))
        }
        const sc = g.scene.getScene(cle)
        const cibles = sc.children.list.filter((o) => o.input?.enabled)
        const cible = cibles[k]
        if (!cible) return { saute: true }
        const nom = cible.text ?? cible.texture?.key ?? cible.type
        try { cible.emit('pointerdown', { x: cible.x, y: cible.y }) } catch (e) { return { nom, err: String(e && e.message) } }
        await new Promise((r2) => setTimeout(r2, 500))
        return { nom }
      }, { cle, k, data })
      if (r.saute) break
      if (r.err) problemes.push(`${cle} → « ${r.nom} » : ${r.err}`)
      if (erreurs.length) problemes.push(`${cle} → « ${r.nom} » : ${[...new Set(erreurs)].join(' | ')}`)
    }
    console.log(`  ✔ ${cle} (${n} éléments interactifs)`)
  }
} catch (e) {
  problemes.push(`sonde interrompue : ${String(e.message).split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

if (problemes.length) {
  console.error('\n❌ ÉCRANS EN ÉCHEC :')
  for (const p of [...new Set(problemes)]) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ tous les écrans s\'ouvrent et tous leurs boutons répondent sans erreur')
