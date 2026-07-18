// Émulateur headless de Panda-Run.
//
// But : JOUER chaque niveau du jeu dans un vrai navigateur (Chromium headless) pour
// diagnostiquer les gels / crashs / traversées de plateforme que subit l'utilisateur sur
// iPhone, PREUVE À L'APPUI (exception + stack, coordonnées, timestamps).
//
// Chaîne : `vite build` (fait avant) → `vite preview` sert dist/ → Chromium paysage mobile →
// on pilote le jeu via window.__pandaGame (instance Phaser exposée par main.ts) et on lit le
// heartbeat window.__pandaBeat (posé par le watchdog) pour détecter un gel.
//
// Lancement : `pnpm emulator` (voir package.json). Options : LEVELS=zone1-1,zone1-2 pour
// restreindre, BUDGET_MS=12000 pour régler le temps de jeu par niveau.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUDGET_MS = Number(process.env.BUDGET_MS ?? 12000) // temps de jeu simulé par niveau
const LADDER_MS = 3500
const SAMPLE_MS = 200
const TILE = 32
const GROUND_ROW = 14
const GROUND_Y = GROUND_ROW * TILE // 448 : surface du sol (centre panda au repos ~ 440-450)

// ── Liste des niveaux (ids dans l'ordre) extraite de la source data ────────────────────────
function levelIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/levels.ts'), 'utf8')
  const ids = []
  const re = /\bid:\s*'([^']+)'/g
  let m
  while ((m = re.exec(src))) ids.push(m[1])
  return ids
}

// Lance `vite preview` et résout l'URL réelle en lisant « Local: http://localhost:PORT/ » sur
// sa sortie (le port n'est pas fiable en dur : il peut basculer si un autre est occupé).
function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', ['exec', 'vite', 'preview', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'pipe' })
    let done = false
    const onData = (d) => {
      const s = String(d)
      const m = s.match(/Local:\s*(http:\/\/[^\s]+)/)
      if (m && !done) { done = true; resolve({ proc, base: m[1].replace(/\/$/, '') + '/' }) }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`))
    setTimeout(() => { if (!done) reject(new Error('vite preview : URL non détectée')) }, 20000)
  })
}

async function main() {
  const only = process.env.LEVELS ? process.env.LEVELS.split(',').map((s) => s.trim()) : null
  const ids = levelIds().filter((id) => !only || only.includes(id))

  // ── Build de production (sauf SKIP_BUILD=1) ─────────────────────────────────────────────
  if (process.env.SKIP_BUILD !== '1') {
    console.log('Build de production…')
    await new Promise((resolve, reject) => {
      const b = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' })
      b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build a échoué (code ${code})`))))
    })
  }

  // ── Serveur statique : vite preview sur dist/ ───────────────────────────────────────────
  const { proc: server, base: BASE } = await startPreview()
  await sleep(500)
  console.error(`[emu] preview prêt sur ${BASE}, lancement de Chromium…`)

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  // paysage mobile ~ iPhone ; on bloque le service worker (sinon auto-reload de la PWA)
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  console.error('[emu] page créée')

  // ── Capture des erreurs (par niveau, via horodatage) ────────────────────────────────────
  // errors = VRAIES exceptions JS non gérées (pageerror) = ce qui fige la boucle Phaser.
  // consoleErrors = messages console.error (souvent du bruit de dépréciation Phaser), reportés
  // à part et JAMAIS comptés comme un crash.
  const errors = [] // { t, kind, message, stack }
  const consoleErrors = new Map() // message → count (dédup)
  page.on('pageerror', (err) => {
    errors.push({ t: Date.now(), kind: 'pageerror', message: err.message, stack: err.stack ?? '' })
    console.error('[emu:pageerror]', err.message)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.set(msg.text(), (consoleErrors.get(msg.text()) ?? 0) + 1)
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  console.error('[emu] page chargée, attente scène Title…')

  // Attendre que l'instance Phaser existe et que la scène Title soit active (assets préchargés)
  await page.waitForFunction(() => {
    const g = window.__pandaGame
    return !!g && g.scene.isActive('Title')
  }, { timeout: 30000 })
  console.error('[emu] Title actif, bootstrap joueur…')

  // Bootstrap joueur : le build de prod ne pose pas setPlayer/newPlayer sur window, donc on
  // déclenche le bouton « Nouvelle partie » de la scène Title (premier Container interactif),
  // ce qui appelle setPlayer(newPlayer(...)) exactement comme un vrai tap.
  await page.evaluate(() => {
    try { localStorage.setItem('panda-run:tuto-vu', '1') } catch {}
    const g = window.__pandaGame
    const title = g.scene.getScene('Title')
    const btn = title.children.list.find((o) => o.type === 'Container' && o.input)
    if (!btn) throw new Error('bouton Nouvelle partie introuvable sur Title')
    btn.emit('pointerdown')
  })
  await page.waitForFunction(() => window.__pandaGame.scene.isActive('WorldMap'), { timeout: 10000 })

  const results = []

  for (const levelId of ids) {
    const started = Date.now()
    // (re)démarrer proprement : stopper toutes les scènes actives puis lancer Level en direct
    const startInfo = await page.evaluate((id) => {
      const g = window.__pandaGame
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('Level', { levelId: id, dir: 'forward' })
      return true
    }, levelId)

    // laisser create() s'exécuter
    await sleep(300)

    // méta du niveau lues sur la scène vivante (largeur, échelles)
    const meta = await page.evaluate(() => {
      try {
        const lvl = window.__pandaGame.scene.getScene('Level')
        const d = lvl && lvl.levelDef
        if (!d) return null
        return {
          widthTiles: d.widthTiles,
          boss: d.boss ?? null,
          ladders: (d.ladders ?? []).map((l) => ({ x: l.x, y: l.y, h: l.h })),
        }
      } catch { return null }
    })

    const samples = []
    await page.keyboard.down('ArrowRight')
    let lastJump = 0
    let lastAttack = 0
    let completed = false
    let crashed = false

    const runUntil = Date.now() + BUDGET_MS
    while (Date.now() < runUntil) {
      const now = Date.now()
      if (now - lastJump > 650) { await page.keyboard.press('Space'); lastJump = now }
      if (now - lastAttack > 400) { await page.keyboard.press('x'); lastAttack = now }
      await sleep(SAMPLE_MS)

      const s = await page.evaluate((groundY) => {
        try {
          const g = window.__pandaGame
          const active = g.scene.getScenes(true).map((sc) => sc.scene.key)
          const lvl = g.scene.getScene('Level')
          const p = lvl && lvl.player
          const body = p && p.body
          const beat = window.__pandaBeat ?? 0
          return {
            t: performance.now(),
            active,
            levelActive: active.includes('Level'),
            worldmapActive: active.includes('WorldMap'),
            gameOverActive: active.includes('WorldMap') === false && active.includes('Level'),
            x: p ? Math.round(p.x) : null,
            y: p ? Math.round(p.y) : null,
            vy: body ? Math.round(body.velocity.y) : null,
            blockedDown: body ? body.blocked.down : null,
            hp: p ? p.hp : null,
            beatIdle: Math.round(performance.now() - beat),
            _g: groundY,
          }
        } catch (e) {
          return { t: performance.now(), evalError: String(e && e.message || e) }
        }
      }, GROUND_Y)

      samples.push(s)

      // arrêt anticipé : niveau terminé (retour carte), gel avéré, ou vraie exception JS
      if (s.worldmapActive && !s.levelActive) { completed = true; break }
      if (s.beatIdle > 3000) { crashed = true; break }
      if (errors.some((e) => e.t >= started)) { crashed = true; break }
    }
    await page.keyboard.up('ArrowRight')

    // entrées d'erreur consignées par le jeu lui-même (window.error / freeze) via __pandaLog
    const pandaLog = await page.evaluate((since) => {
      try {
        const fn = window.__pandaLog
        return (fn ? fn() : []).filter((e) => e.level === 'error' && e.t >= since)
      } catch { return [] }
    }, started)

    // ── Test échelle : on se place à l'x de la 1re échelle et on presse Haut ────────────────
    let ladderReport = null
    if (meta && meta.ladders.length > 0 && !crashed) {
      const lad = meta.ladders[0]
      ladderReport = await testLadder(page, levelId, lad, errors, started)
    }

    // ── Analyse des échantillons ───────────────────────────────────────────────────────────
    const levelErrors = [
      ...errors.filter((e) => e.t >= started),
      ...pandaLog.map((e) => ({ t: e.t, kind: `log:${e.tag}`, message: e.msg, stack: e.stack ?? '' })),
    ]
    if (levelErrors.length) crashed = true
    const valid = samples.filter((s) => s && s.y != null)
    const maxY = valid.reduce((m, s) => Math.max(m, s.y), -Infinity)
    const minX = valid.reduce((m, s) => Math.min(m, s.x), Infinity)
    const maxX = valid.reduce((m, s) => Math.max(m, s.x), -Infinity)
    const maxBeatIdle = samples.reduce((m, s) => Math.max(m, s?.beatIdle ?? 0), 0)
    const died = valid.some((s) => s.hp != null && s.hp <= 0)
    // traversée : centre du panda nettement SOUS le sol (> +64px) alors que le sol est solide
    const fellThrough = maxY > GROUND_Y + 64
    const fellSample = valid.find((s) => s.y > GROUND_Y + 64)

    // blocage : sur une fenêtre glissante, x n'avance quasiment plus alors qu'on est au sol,
    // vivant, et pas encore près de la sortie
    let stuck = false
    let stuckAt = null
    if (meta && valid.length > 10) {
      const exitX = (meta.widthTiles - 2) * TILE
      const W = Math.round(3000 / SAMPLE_MS) // ~3 s de fenêtre
      for (let i = W; i < valid.length; i++) {
        const a = valid[i - W], b = valid[i]
        const grounded = b.blockedDown === true
        const alive = b.hp == null || b.hp > 0
        if (grounded && alive && b.x < exitX - TILE * 3 && (b.x - a.x) < 8) {
          stuck = true; stuckAt = { x: b.x, y: b.y }
          break
        }
      }
    }

    results.push({
      levelId, boss: meta?.boss ?? null, widthTiles: meta?.widthTiles ?? null,
      completed, died, crashed, fellThrough, fellSample, stuck, stuckAt,
      minX: isFinite(minX) ? minX : null, maxX: isFinite(maxX) ? maxX : null,
      maxY: isFinite(maxY) ? maxY : null, maxBeatIdle,
      startX: valid[0]?.x ?? null,
      errors: levelErrors,
      ladder: ladderReport,
      hasLadder: !!(meta && meta.ladders.length),
    })

    const flags = [
      completed ? 'OK-fini' : 'non-fini',
      crashed ? 'CRASH' : null,
      levelErrors.length ? `${levelErrors.length}err` : null,
      fellThrough ? 'TRAVERSÉE' : null,
      stuck ? 'BLOCAGE' : null,
      died ? 'mort' : null,
      maxBeatIdle > 3000 ? 'GEL' : null,
    ].filter(Boolean).join(' ')
    console.log(`• ${levelId.padEnd(14)} ${flags}`)
  }

  await browser.close()
  server.kill('SIGTERM')

  writeReport(results, consoleErrors)
  const broken = results.filter((r) => r.crashed || r.errors.length || r.fellThrough || r.maxBeatIdle > 3000)
  console.log(`\nTerminé. ${results.length} niveaux testés, ${broken.length} avec exception/gel/traversée.`)
  console.log('Rapport : emulator-report.md')
}

// Grimpe une échelle : place le joueur à l'x de l'échelle (sur le sol au bas), presse Haut,
// vérifie qu'on monte (y diminue) sans exception ni gel.
async function testLadder(page, levelId, lad, errors, started) {
  const ladderX = lad.x * TILE + TILE / 2
  // téléporter le joueur au pied de l'échelle (au sol) + le soigner (un panda mort ne grimpe
  // pas : update() sort tôt si hp<=0) pour un test d'échelle déterministe
  await page.evaluate(({ x }) => {
    const p = window.__pandaGame.scene.getScene('Level').player
    if (p) { p.setPosition(x, 14 * 32 - 40); p.setVelocity(0, 0); p.hp = p.stats.maxHp }
  }, { x: ladderX })
  await sleep(200)
  const before = await page.evaluate(() => {
    const p = window.__pandaGame.scene.getScene('Level').player
    return p ? { y: Math.round(p.y) } : null
  })
  await page.keyboard.down('ArrowUp')
  let climbed = 0
  let ladderCrash = false
  const until = Date.now() + LADDER_MS
  let minY = before?.y ?? null
  while (Date.now() < until) {
    await sleep(SAMPLE_MS)
    const s = await page.evaluate(() => {
      try {
        const p = window.__pandaGame.scene.getScene('Level').player
        const beat = window.__pandaBeat ?? 0
        return { y: p ? Math.round(p.y) : null, beatIdle: Math.round(performance.now() - beat) }
      } catch (e) { return { evalError: String(e) } }
    })
    if (s.y != null && (minY == null || s.y < minY)) minY = s.y
    if (s.beatIdle > 3000) { ladderCrash = true; break }
    if (errors.some((e) => e.t >= started)) { ladderCrash = true; break }
  }
  await page.keyboard.up('ArrowUp')
  climbed = before && minY != null ? before.y - minY : 0
  return { ladderX, climbedPx: climbed, ok: climbed > 40 && !ladderCrash, crash: ladderCrash }
}

function writeReport(results, consoleErrors = new Map()) {
  const L = []
  L.push('# Rapport émulateur — Panda-Run')
  L.push('')
  L.push(`Généré le ${new Date().toISOString()} — navigateur : Chromium headless (Playwright), viewport 844×390 @2x paysage.`)
  L.push('')
  L.push('Pilotage : maintien de Droite + saut (Espace) + attaque (X) pendant le budget, échantillonnage 200 ms.')
  L.push('Détections : exceptions (pageerror + console + __pandaLog), gel (__pandaBeat figé > 3 s), traversée du sol/plateforme (y du panda > sol+64), blocage (x figé au sol), niveau non terminé, test d’échelle.')
  L.push('')

  const broken = results.filter((r) => r.crashed || r.errors.length || r.fellThrough || r.maxBeatIdle > 3000 || (r.ladder && r.ladder.crash))
  L.push('## Synthèse')
  L.push('')
  L.push('| Niveau | Fini | Exc | Gel | Traversée | Blocage | Mort | Échelle |')
  L.push('|--------|------|-----|-----|-----------|---------|------|---------|')
  for (const r of results) {
    L.push(`| ${r.levelId} | ${r.completed ? '✓' : '—'} | ${r.errors.length || (r.ladder && r.ladder.crash ? '?' : '—')} | ${r.maxBeatIdle > 3000 ? 'OUI' : '—'} | ${r.fellThrough ? 'OUI' : '—'} | ${r.stuck ? 'oui' : '—'} | ${r.died ? 'oui' : '—'} | ${!r.hasLadder ? 'n/a' : r.ladder ? (r.ladder.ok ? '✓' : 'KO') : '—'} |`)
  }
  L.push('')
  L.push(`Niveaux avec exception / gel / traversée : ${broken.length ? broken.map((r) => r.levelId).join(', ') : 'aucun'}.`)
  L.push('')

  L.push('## Détail par niveau')
  L.push('')
  for (const r of results) {
    L.push(`### ${r.levelId}${r.boss ? ` (boss: ${r.boss})` : ''}`)
    L.push('')
    L.push(`- Statut : ${r.completed ? 'terminé' : 'non terminé dans le budget'}`)
    L.push(`- Progression x : ${r.startX} → ${r.maxX} (sortie ≈ ${r.widthTiles != null ? (r.widthTiles - 2) * TILE : '?'})`)
    L.push(`- y max atteint : ${r.maxY} (sol ≈ ${GROUND_Y})`)
    L.push(`- Heartbeat idle max : ${r.maxBeatIdle} ms${r.maxBeatIdle > 3000 ? ' → **GEL**' : ''}`)
    if (r.fellThrough) L.push(`- **TRAVERSÉE** : le panda est descendu à y=${r.fellSample?.y} (bien sous le sol) — passage à travers une plateforme/sol.`)
    if (r.stuck) L.push(`- **BLOCAGE** : x figé au sol vers (${r.stuckAt?.x}, ${r.stuckAt?.y}).`)
    if (r.died) L.push('- Le panda est mort (PV ≤ 0) durant le test.')
    if (r.hasLadder && r.ladder) L.push(`- Échelle @x≈${r.ladder.ladderX} : montée ${r.ladder.climbedPx}px → ${r.ladder.ok ? 'OK' : (r.ladder.crash ? 'CRASH/GEL' : 'ne grimpe pas')}`)
    if (r.errors.length) {
      L.push(`- **EXCEPTIONS (${r.errors.length})** :`)
      for (const e of r.errors.slice(0, 5)) {
        L.push('')
        L.push('```')
        L.push(`[${e.kind}] ${e.message}`)
        if (e.stack) L.push(e.stack.split('\n').slice(0, 12).join('\n'))
        L.push('```')
      }
    }
    L.push('')
  }

  if (consoleErrors.size) {
    L.push('## Bruit console (non bloquant)')
    L.push('')
    L.push('Messages `console.error` — pas des exceptions non gérées, ne figent PAS la boucle :')
    L.push('')
    for (const [msg, n] of consoleErrors) L.push(`- (×${n}) ${msg}`)
    L.push('')
  }

  fs.writeFileSync(path.join(ROOT, 'emulator-report.md'), L.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
