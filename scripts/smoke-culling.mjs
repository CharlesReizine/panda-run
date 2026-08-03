// CULLING PAR TRANCHES — « le sol disparaît parfois », « le trampoline vole au-dessus du sol ».
//
// POURQUOI CETTE SONDE EXISTE. Le découpage du décor en tranches de 480 px a introduit DEUX FOIS le même
// défaut, avec deux symptômes qui n'avaient l'air de rien en commun : des morceaux de sol qui
// s'évanouissaient, et un trampoline invisible. Même cause : un objet qui chevauche plusieurs tranches
// était masqué avec la tranche qu'on quittait, puis jamais rendu à la tranche qu'on gardait — la boucle
// ne révélait que la tranche NOUVELLEMENT entrée au lieu de toute la fenêtre visible.
//
// ⚠️ AUCUN TEST UNITAIRE NE PEUT VOIR ÇA. Le défaut n'est pas dans une fonction de géométrie mais dans
// l'état accumulé d'une scène Phaser au fil des déplacements de caméra : il faut vraiment balayer le
// terrain. D'où cette sonde, qui déplace la caméra d'un bout à l'autre de chaque terrain et vérifie
// l'invariant unique qui compte :
//
//     tout objet de décor qui CHEVAUCHE LA VUE doit être VISIBLE.
//
// Elle contrôle aussi l'inverse à titre indicatif (ce qui est loin de la vue doit être masqué), mais sans
// en faire un échec : masquer trop peu ne casse rien, ça coûte juste des dessins.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5299
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch()
const pbs = []

// Un échantillon qui couvre les cas à risque : terrains longs, verticaux, avec trampoline, avec grottes
// et avec pierre cassable (objets nombreux et petits, donc nombreux chevauchements de tranches).
const TERRAINS = ['plaine-3', 'plaine-5', 'foret-6', 'desert-5', 'jungle-3', 'montagne-1', 'cave-1', 'enfer-7']

try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 460 } })
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).split('\n')[0]))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )
  await page.evaluate(() => window.__pandaGame.scene.getScene('Title').startFresh('sonde', 'panda-run:sonde'))
  await sleep(600)

  for (const id of TERRAINS) {
    const r = await page.evaluate(async (levelId) => {
      const g = window.__pandaGame
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
      g.scene.start('Level', { levelId, test: true })
      await new Promise((res) => setTimeout(res, 2200))
      const sc = g.scene.getScene('Level')
      const cam = sc.cameras.main
      const largeur = sc.levelDef.widthTiles * 32

      // Tout le décor indexé en tranches, avec ses bornes figées une fois pour toutes.
      const suivis = []
      for (const [, liste] of sc.tranchesDecor) {
        for (const o of liste) {
          if (suivis.some((s) => s.o === o)) continue
          if (typeof o.getBounds !== 'function') continue
          const b = o.getBounds()
          suivis.push({ o, left: b.left, right: b.right, top: b.top, bottom: b.bottom })
        }
      }

      let fautes = 0
      let pire = null
      let masquesInutiles = 0
      const pas = 240
      for (let x = 0; x < largeur; x += pas) {
        cam.setScroll(x, cam.scrollY)
        sc.majTranchesVisibles()
        const vg = x, vd = x + cam.width
        for (const s of suivis) {
          const chevauche = s.right > vg && s.left < vd
          if (chevauche && !s.o.visible) {
            fautes++
            if (!pire) pire = { x, type: s.o.type, texture: s.o.texture?.key ?? '?', left: Math.round(s.left), right: Math.round(s.right) }
          }
          // très loin de la vue (plus de trois écrans) et pourtant visible : masquage trop timide
          if (!chevauche && s.o.visible && (s.left > vd + 3 * cam.width || s.right < vg - 3 * cam.width)) masquesInutiles++
        }
      }
      return { objets: suivis.length, fautes, pire, masquesInutiles, largeur }
    }, id)

    if (r.fautes) {
      pbs.push(`${id} : ${r.fautes} objet(s) MASQUÉ(S) alors qu'ils sont dans la vue — ex. à scrollX=${r.pire.x}, `
        + `${r.pire.type} « ${r.pire.texture} » (x ${r.pire.left}→${r.pire.right})`)
      console.log(`  ✘ ${id} — ${r.fautes} objets masqués à tort sur ${r.objets}`)
    } else {
      console.log(`  ✔ ${id} — ${r.objets} objets suivis sur ${Math.round(r.largeur / 32)} tuiles, aucun masqué à tort`)
    }
  }
  if (erreurs.length) pbs.push('erreurs JS : ' + [...new Set(erreurs)].join(' | '))
} catch (e) {
  pbs.push('sonde interrompue : ' + String(e.message).split('\n')[0])
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

if (pbs.length) {
  console.error('\n❌ CULLING EN ÉCHEC :')
  for (const p of [...new Set(pbs)]) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ culling : tout ce qui est dans la vue est bien affiché, sur tout l\'échantillon')
