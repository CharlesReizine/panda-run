// Sonde de PERF : enchaîne N terrains DIFFÉRENTS par le vrai chemin (WorldMap → Level), et mesure
// après chacun ce qui grossit ET le temps de frame réel. But : reproduire/mesurer le ralentissement
// progressif signalé par le joueur (injouable ~10 terrains) au lieu de le deviner.
//
// Mesures : temps de frame moyen (ms) sur ~2 s de jeu, textures uploadées en VRAM + octets estimés,
// tas JS, listeners de scène, objets d'affichage, corps physiques.
//
// Usage : node scripts/leak-probe.mjs   (lance `pnpm dev` tout seul)
//   CYCLES=12     nombre de terrains enchaînés
//   PLAY_MS=2000  durée de mesure de frame par terrain
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/Users/charlesreizine/panda-run'
const CYCLES = Number(process.env.CYCLES ?? 12)
const PLAY_MS = Number(process.env.PLAY_MS ?? 2000)

// Les LevelDef sont fabriqués par les fabriques terrain()/bigArena() : l'id est leur 1er argument.
function levelIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/levels.ts'), 'utf8')
  const ids = []
  const re = /\b(?:terrain|bigArena)\('([^']+)'/g
  let m
  while ((m = re.exec(src))) ids.push(m[1])
  return ids
}

const dev = spawn('pnpm', ['dev', '--port', '5199', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
dev.stdout.on('data', () => {})
dev.stderr.on('data', () => {})

async function waitServer() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch('http://localhost:5199/'); if (r.ok) return } catch { /* pas encore prêt */ }
    await sleep(500)
  }
  throw new Error('serveur dev injoignable')
}

// Compteurs. VRAM estimée = somme des sources de texture RÉELLEMENT uploadées (glTexture posée)
// × largeur × hauteur × 4 octets (RGBA non compressé = ce que WebGL garde en mémoire GPU).
const PROBE = `(() => {
  const g = window.__pandaGame
  const sum = (em) => {
    const ev = em && em._events
    if (!ev) return 0
    let n = 0
    for (const k of Object.keys(ev)) { const v = ev[k]; n += Array.isArray(v) ? v.length : 1 }
    return n
  }
  const lvl = g.scene.getScene('Level')
  let uploaded = 0, bytes = 0, sources = 0, allBytes = 0
  for (const key of Object.keys(g.textures.list)) {
    const t = g.textures.list[key]
    for (const s of (t.source ?? [])) {
      sources++
      allBytes += (s.width || 0) * (s.height || 0) * 4
      if (s.glTexture) { uploaded++; bytes += (s.width || 0) * (s.height || 0) * 4 }
    }
  }
  return {
    sceneListeners: sum(lvl.events),
    gameListeners: sum(g.events),
    displayList: lvl.children.list.length,
    updateList: lvl.sys.updateList.length,
    physBodies: lvl.physics.world.bodies.size + lvl.physics.world.staticBodies.size,
    textures: Object.keys(g.textures.list).length,
    sources,
    uploaded,
    vramMB: Math.round(bytes / 1048576),
    allTexMB: Math.round(allBytes / 1048576),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
  }
})()`

// Temps de frame moyen : POST_STEP de Phaser est émis une fois par frame de jeu.
const FRAME_START = `(() => {
  const g = window.__pandaGame
  window.__ft = { n: 0, total: 0, max: 0, last: performance.now() }
  window.__ftHandler = () => {
    const now = performance.now()
    const dt = now - window.__ft.last
    window.__ft.last = now
    if (dt < 500) { window.__ft.n++; window.__ft.total += dt; if (dt > window.__ft.max) window.__ft.max = dt }
  }
  g.events.on('poststep', window.__ftHandler)
})()`
const FRAME_STOP = `(() => {
  const g = window.__pandaGame
  g.events.off('poststep', window.__ftHandler)
  const f = window.__ft
  return { avgMs: f.n ? +(f.total / f.n).toFixed(2) : -1, maxMs: +f.max.toFixed(1), frames: f.n }
})()`

const browser = await chromium.launch()
try {
  await waitServer()
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!window.__panda && !!window.__pandaGame, null, { timeout: 120000 })
  await page.waitForFunction(() => window.__pandaGame.scene.getScenes(true).some((s) => s.scene.key === 'Title'), null, { timeout: 240000 })
  await page.evaluate(() => { const { setPlayer, newPlayer } = window.__panda; setPlayer(newPlayer('sonde')) })

  console.log('--- état juste après le Preload (avant tout terrain) ---')
  console.log(JSON.stringify(await page.evaluate(PROBE)))

  const ids = levelIds().slice(0, CYCLES)
  const rows = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    // vrai chemin de jeu : on repasse par la carte du monde entre deux terrains
    await page.evaluate(() => { window.__pandaGame.scene.start('WorldMap') })
    await sleep(500)
    await page.evaluate((lvl) => {
      window.__pandaGame.scene.start('Level', { levelId: lvl, fromNode: lvl, targetNode: lvl, dir: 'forward' })
    }, id)
    await sleep(900)
    await page.evaluate(FRAME_START)
    await sleep(PLAY_MS)
    const f = await page.evaluate(FRAME_STOP)
    const m = await page.evaluate(PROBE)
    rows.push({ n: i + 1, id, ...f, ...m })
    console.log(`#${String(i + 1).padStart(2)} ${id.padEnd(12)} frame=${String(f.avgMs).padStart(6)}ms max=${String(f.maxMs).padStart(6)} | vram=${String(m.vramMB).padStart(4)}MB up=${String(m.uploaded).padStart(4)}/${m.sources} heap=${String(m.heapMB).padStart(4)}MB tex=${m.textures} listeners=${m.sceneListeners} display=${m.displayList} bodies=${m.physBodies}`)
  }

  const first = rows[0], last = rows[rows.length - 1]
  console.log('\n=== DELTA terrain 1 → terrain ' + rows.length + ' ===')
  for (const k of ['avgMs', 'maxMs', 'vramMB', 'uploaded', 'heapMB', 'textures', 'sceneListeners', 'displayList', 'physBodies']) {
    const d = last[k] - first[k]
    console.log(`  ${k}: ${first[k]} → ${last[k]}  (${d > 0 ? '+' : ''}${d})`)
  }
} finally {
  await browser.close()
  dev.kill('SIGKILL')
}
