// Vérifie dans un VRAI navigateur que l'écran de début de terrain ne déborde JAMAIS — pour CHAQUE
// terrain et CHAQUE monstre présenté.
//
// POURQUOI CE SCRIPT EXISTE. Retour user : « y a un problème sur l'image au début de terrain pour
// décrire les monstres, là ça déborde complet ». Le test de géométrie (tests/core/level-intro-layout)
// vérifie les zones réservées, mais il ne peut pas voir ce qui déborde à cause d'un TEXTE plus long que
// prévu : un nom de monstre, un nom d'objet, une description de compétence. Seul un rendu réel mesure la
// largeur d'un texte. C'est le complément indispensable au test pur, pas son doublon.
//
// ⚠️ RÉSEAU GOOGLE COUPÉ : on amorce une partie « sonde » pour atteindre l'écran, et une partie amorcée
// pousse sa sauvegarde dans le cloud. Sans ce blocage, ce script polluerait le classement public.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5199
const MARGIN = 2 // tolérance : un contour de 1 px peut dépasser d'un demi-pixel

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch()
const problems = []
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 874, height: 402 } })
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  await page.route('**://*.firebaseio.com/**', (r) => r.abort())
  page.on('pageerror', (e) => problems.push(`erreur JS : ${e.message}`))

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )

  const report = await page.evaluate(async (margin) => {
    const game = window.__pandaGame
    const title = game.scene.getScene('Title')
    if (typeof title.startFresh !== 'function') return { err: 'TitleScene.startFresh introuvable (renommée ?)' }
    title.startFresh('sonde', 'panda-run:sonde')
    await new Promise((r) => setTimeout(r, 400))

    const bad = []
    let checked = 0
    const ids = window.__pandaLevelIds ?? []
    for (const levelId of ids) {
      game.scene.start('LevelIntro', { levelId, fromNode: levelId, targetNode: levelId, dir: 'forward' })
      await new Promise((r) => setTimeout(r, 120))
      const sc = game.scene.getScene('LevelIntro')
      const pages = sc.monsters?.length || 1
      for (let p = 0; p < pages; p++) {
        sc.page = p
        sc.render()
        await new Promise((r) => setTimeout(r, 30))
        const scroll = sc.cameras.main.scrollX
        // ⚠️ LES BORNES VISIBLES SONT [scrollX, scrollX + largeur], PAS L'INVERSE. Les limites des
        // objets sont en coordonnées de CONCEPTION ; la caméra recentrée a un scrollX NÉGATIF, donc le
        // bord gauche visible EST ce scrollX. (Premier jet inversé : la sonde signalait comme « hors
        // cadre » des éléments parfaitement placés.)
        const left = scroll, right = scroll + game.scale.width
        for (const o of sc.children.list) {
          if (!o.getBounds || !o.visible) continue
          const b = o.getBounds()
          if (b.width >= game.scale.width) continue // le fond plein cadre
          if (b.left < left - margin || b.right > right + margin || b.top < -margin || b.bottom > 540 + margin) {
            const what = o.text ? `"${String(o.text).slice(0, 24)}"` : (o.texture?.key ?? o.type)
            bad.push(`${levelId} p${p + 1}/${pages} : ${what} → [${Math.round(b.left)},${Math.round(b.top)}]–[${Math.round(b.right)},${Math.round(b.bottom)}]`)
          }
        }
        checked++
      }
    }
    return { checked, pages: checked, bad: bad.slice(0, 40), total: bad.length, levels: ids.length }
  }, MARGIN)

  if (report.err) problems.push(report.err)
  else if (!report.levels) problems.push('aucun terrain énuméré : la sonde n\'a rien vérifié')
  else {
    console.log(`${report.levels} terrains · ${report.checked} fiches rendues et mesurées`)
    if (report.total) {
      problems.push(`${report.total} élément(s) hors cadre :`)
      for (const b of report.bad) problems.push('  ' + b)
    }
  }
} catch (e) {
  problems.push(`sonde en échec : ${String(e.message).split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

if (problems.length) {
  console.error('\n❌ ÉCRAN DE DÉBUT DE TERRAIN :')
  for (const p of problems) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ aucune fiche de début de terrain ne déborde')
