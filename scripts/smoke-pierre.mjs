import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5297
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch()
const pbs = []
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {} await sleep(500) }
  const page = await browser.newPage({ viewport: { width: 900, height: 460 } })
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'), null, { timeout: 300000 })
  await page.evaluate(() => window.__pandaGame.scene.getScene('Title').startFresh('sonde', 'panda-run:sonde'))
  await sleep(600)

  // Terrains porteurs de pierre cassable. Liste PASSÉE EN DUR plutôt que lue depuis les sources : la
  // prévisualisation sert le bundle construit, où `/src/data/levels.ts` n'existe plus. La régénérer :
  //   npx vitest run <une sonde qui filtre LEVELS sur breakables>
  const IDS = 'plaine-4,plaine-5,cave-1,jungle-1,jungle-2,montagne-1,plage-1,carriere-1,enfer-3'.split(',')
  const cible = { ids: IDS, n: IDS.length }
  console.log(`  essai sur ${IDS.length} terrains porteurs de pierre cassable`)

  const r = await page.evaluate(async (id) => {
    const g = window.__pandaGame
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'UI') g.scene.stop(s.scene.key)
    g.scene.start('Level', { levelId: id, test: true })
    await new Promise((r) => setTimeout(r, 2500))
    const sc = g.scene.getScene('Level')
    const grp = sc.pierresFragiles
    if (!grp) return { err: 'aucun groupe pierresFragiles' }
    const avant = grp.getChildren().filter((b) => b.active).length
    // on téléporte le panda devant une tuile et on frappe jusqu'à la casser
    const cible = grp.getChildren().find((b) => b.active)
    if (!cible) return { err: 'aucune tuile active' }
    const tex0 = cible.texture.key
    sc.player.x = cible.x - 26; sc.player.y = cible.y
    sc.player.facing = 1
    const textures = [tex0]
    for (let i = 0; i < 3; i++) {
      sc.meleeHit(70, 1)
      await new Promise((r) => setTimeout(r, 120))
      if (cible.active) textures.push(cible.texture.key)
    }
    const apres = grp.getChildren().filter((b) => b.active).length
    return { avant, apres, casse: !cible.active, textures, coups: 3 }
  }, cible.ids[0])

  if (r.err) pbs.push(r.err)
  else {
    console.log(`  tuiles : ${r.avant} → ${r.apres} | textures traversées : ${r.textures.join(' → ')}`)
    if (!r.casse) pbs.push(`la tuile n'a pas cédé après ${r.coups} coups`)
    if (r.apres !== r.avant - 1) pbs.push(`${r.avant - r.apres} tuiles détruites au lieu d'une seule`)
    if (new Set(r.textures).size < 2) pbs.push('la pierre ne montre aucune usure entre les coups')
  }
  if (errs.length) pbs.push('erreurs JS : ' + [...new Set(errs)].join(' | '))
} catch (e) { if (e.message !== 'stop') pbs.push('sonde : ' + e.message.split('\n')[0]) }
finally { await browser.close(); preview.kill('SIGKILL') }

if (pbs.length) { console.error('\n❌ ' + pbs.join('\n❌ ')); process.exit(1) }
console.log('✔ la pierre fragile s\'use puis cède, une tuile à la fois')
