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
// budget de jeu par niveau : GÉNÉREUX (≥ 30 s), proportionnel à la largeur du terrain, pour
// laisser le panda traverser tout le niveau jusqu'à la sortie même sur les cartes les plus
// larges. BUDGET_MS=... force une valeur fixe (utile pour un test rapide).
const FIXED_BUDGET_MS = process.env.BUDGET_MS ? Number(process.env.BUDGET_MS) : null
const MS_PER_TILE = Number(process.env.MS_PER_TILE ?? 240)
const MIN_BUDGET_MS = Number(process.env.MIN_BUDGET_MS ?? 30000)
const budgetFor = (widthTiles) => FIXED_BUDGET_MS ?? Math.max(MIN_BUDGET_MS, Math.round((widthTiles ?? 120) * MS_PER_TILE))
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

  // GOD MODE : le joueur ne perd jamais de PV (lu dans LevelScene.hitPlayer). On teste ici la
  // JOUABILITÉ PHYSIQUE des terrains, pas l'équilibrage : les monstres sont ignorés.
  await page.evaluate(() => { window.__pandaGodMode = true })
  console.error('[emu] god mode activé')

  const results = []

  for (const levelId of ids) {
    const started = Date.now()
    // (re)démarrer proprement : stopper toutes les scènes actives puis lancer Level en direct
    const startInfo = await page.evaluate((id) => {
      window.__pandaGodMode = true // (ré)affirme le god mode à chaque niveau
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
        // plateformes portant un coffre : {x du coffre, platTop = rangée de la plateforme}
        const chestPlatforms = (d.props ?? [])
          .filter((p) => p.kind === 'coffre' && p.y != null)
          .map((p) => {
            const pl = d.platforms.find((q) => p.x >= q.x && p.x < q.x + q.w && p.y === q.y - 1)
            return { x: p.x, platTop: pl ? pl.y : null }
          })
          .filter((c) => c.platTop != null)
        // cross-check statique in-page : échelles sans plateforme posable au sommet (±1 rangée,
        // adjacente à gauche/droite) — même règle que level-validator.laddersToNowhere
        const laddersToNowhere = (d.ladders ?? []).filter((l) =>
          !d.platforms.some((p) => Math.abs(p.y - l.y) <= 1 && l.x >= p.x - 1 && l.x <= p.x + p.w + 1),
        ).map((l) => ({ x: l.x, y: l.y, h: l.h }))
        return {
          widthTiles: d.widthTiles,
          boss: d.boss ?? null,
          ladders: (d.ladders ?? []).map((l) => ({ x: l.x, y: l.y, h: l.h })),
          chestPlatforms,
          laddersToNowhere,
        }
      } catch { return null }
    })

    const samples = []
    await page.keyboard.down('ArrowRight')
    let lastJump = 0
    let lastAttack = 0
    let completed = false
    let crashed = false

    const runUntil = Date.now() + budgetFor(meta?.widthTiles)
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

    // La traversée a pu TERMINER le niveau (retour WorldMap → scène Level arrêtée, joueur
    // détruit). Pour les tests d'échelles/paliers qui téléportent le joueur, on redémarre la
    // scène Level à froid (god mode réaffirmé).
    const needsRelive = meta && !crashed && (meta.ladders.length || meta.chestPlatforms.length)
    let reliveOk = true
    if (needsRelive) reliveOk = await ensureLevel(page, levelId)

    // ── Test échelles : on grimpe CHAQUE échelle (place à son x, presse Haut, vérifie montée) ──
    const ladderReports = []
    if (needsRelive && reliveOk) {
      for (const lad of meta.ladders) {
        ladderReports.push(await testLadder(page, levelId, lad, errors, started))
      }
    }
    const ladderReport = ladderReports[0] ?? null // compat rapport (1re échelle)

    // ── Test plateformes clés : on vérifie qu'on se pose bien sur chaque plateforme à coffre ──
    const landingReports = []
    if (needsRelive && reliveOk) {
      for (const chest of meta.chestPlatforms) {
        landingReports.push(await testPlatformLanding(page, chest))
      }
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

    const laddersKo = ladderReports.filter((r) => !r.ok).length
    const landingsKo = landingReports.filter((r) => !r.ok).length
    results.push({
      levelId, boss: meta?.boss ?? null, widthTiles: meta?.widthTiles ?? null,
      completed, died, crashed, fellThrough, fellSample, stuck, stuckAt,
      minX: isFinite(minX) ? minX : null, maxX: isFinite(maxX) ? maxX : null,
      maxY: isFinite(maxY) ? maxY : null, maxBeatIdle,
      startX: valid[0]?.x ?? null,
      errors: levelErrors,
      ladder: ladderReport,
      ladders: ladderReports,
      landings: landingReports,
      laddersToNowhere: meta?.laddersToNowhere ?? [],
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
      laddersKo ? `${laddersKo}échelle-KO` : null,
      landingsKo ? `${landingsKo}palier-KO` : null,
      (meta?.laddersToNowhere?.length) ? 'échelle-vide!' : null,
    ].filter(Boolean).join(' ')
    console.log(`• ${levelId.padEnd(14)} ${flags}`)
  }

  await browser.close()
  server.kill('SIGTERM')

  writeReport(results, consoleErrors)
  const broken = results.filter((r) => !isClean(r))
  console.log(`\nTerminé. ${results.length} niveaux testés, ${broken.length} avec problème physique.`)
  if (broken.length) console.log('À corriger : ' + broken.map((r) => r.levelId).join(', '))
  console.log('Rapport : emulator-report.md')
  process.exitCode = broken.length ? 1 : 0
}

// Un niveau est « propre » = physiquement jouable. Filet physique commun : aucune exception,
// aucun gel, aucune traversée du sol. Pour les TERRAINS (non-boss) on exige en plus : sortie
// atteinte, pas de blocage, échelles grimpables + débouchant sur plateforme, paliers à coffre
// atterrissables. Les ARÈNES de boss ne se « terminent » qu'en tuant le boss (monstres /
// équilibrage — hors périmètre) : on ne vérifie donc que le filet physique.
function isClean(r) {
  const physical = !r.crashed && !r.errors.length && !r.fellThrough && r.maxBeatIdle <= 3000
  if (r.boss) return physical
  return physical && r.completed && !r.stuck
    && (r.ladders ?? []).every((l) => l.ok)
    && (r.landings ?? []).every((l) => l.ok)
    && !(r.laddersToNowhere ?? []).length
}

// (Re)démarre la scène Level pour levelId et attend qu'un joueur vivant existe. Renvoie false
// si le joueur n'apparaît pas dans le délai (scène cassée).
async function ensureLevel(page, levelId) {
  await page.evaluate((id) => {
    window.__pandaGodMode = true
    const g = window.__pandaGame
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('Level', { levelId: id, dir: 'forward' })
  }, levelId)
  try {
    await page.waitForFunction(() => {
      const lvl = window.__pandaGame.scene.getScene('Level')
      return !!(lvl && lvl.player && lvl.player.body)
    }, { timeout: 8000 })
    await sleep(150)
    return true
  } catch { return false }
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
  return { ladderX, ladderY: lad.y, climbedPx: climbed, ok: climbed > 40 && !ladderCrash, crash: ladderCrash }
}

// Vérifie qu'on peut se POSER sur une plateforme clé (portant un coffre) : on téléporte le
// panda juste au-dessus du dessus de la plateforme, on le laisse retomber et on vérifie qu'il
// s'y arrête (collision one-way) au lieu de la traverser jusqu'au sol.
async function testPlatformLanding(page, chest) {
  const px = chest.x * TILE + TILE / 2
  const topY = chest.platTop * TILE // dessus de la plateforme (surface)
  // pieds du panda = centre + 40 (hitbox 62px, offsetY 24 sur texture 92px). On POSE le panda
  // pile sur le dessus (centre = topY-40) et on vérifie qu'il TIENT — la plateforme one-way
  // doit le retenir. Le téléport provoque parfois un micro-sursaut : on retente (≤3) et on
  // conclut KO seulement si le panda ne tient sur aucun essai (plateforme réellement fantôme).
  const expectRest = topY - 40
  let restY = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.evaluate(({ x, y }) => {
      const p = window.__pandaGame.scene.getScene('Level').player
      if (p) { p.setPosition(x, y); p.setVelocity(0, 0); p.hp = p.stats.maxHp }
    }, { x: px, y: expectRest })
    await sleep(600) // laisser passer le sursaut de téléportation
    const ys = []
    for (let i = 0; i < 8; i++) {
      await sleep(120)
      const y = await page.evaluate(() => {
        try { return Math.round(window.__pandaGame.scene.getScene('Level').player.y) } catch { return null }
      })
      ys.push(y)
    }
    restY = ys[ys.length - 1]
    // tient si les 4 derniers relevés restent près du dessus visé (pas de chute au sol)
    const held = ys.slice(-4).every((y) => y != null && Math.abs(y - expectRest) <= 20)
    if (held) return { x: chest.x, platTop: chest.platTop, restY, ok: true, attempts: attempt }
  }
  if (process.env.DEBUG_LAND) console.error(`[land x=${chest.x} top=${topY}] expect=${expectRest} rest=${restY} KO`)
  return { x: chest.x, platTop: chest.platTop, restY, ok: false, attempts: 3 }
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

  const broken = results.filter((r) => !isClean(r))
  const ladderCell = (r) => {
    if (!r.hasLadder) return 'n/a'
    const ls = r.ladders ?? (r.ladder ? [r.ladder] : [])
    const ko = ls.filter((l) => !l.ok).length
    return ko ? `${ko}/${ls.length} KO` : `${ls.length} ✓`
  }
  const landCell = (r) => {
    const ls = r.landings ?? []
    if (!ls.length) return 'n/a'
    const ko = ls.filter((l) => !l.ok).length
    return ko ? `${ko}/${ls.length} KO` : `${ls.length} ✓`
  }
  L.push('## Synthèse')
  L.push('')
  L.push('| Niveau | Propre | Fini | Exc | Gel | Traversée | Blocage | Échelles | Paliers |')
  L.push('|--------|--------|------|-----|-----|-----------|---------|----------|---------|')
  for (const r of results) {
    L.push(`| ${r.levelId} | ${isClean(r) ? '✅' : '❌'} | ${r.completed ? '✓' : (r.boss ? 'boss' : '—')} | ${r.errors.length || '—'} | ${r.maxBeatIdle > 3000 ? 'OUI' : '—'} | ${r.fellThrough ? 'OUI' : '—'} | ${r.stuck ? 'oui' : '—'} | ${ladderCell(r)} | ${landCell(r)} |`)
  }
  L.push('')
  L.push(`Niveaux avec problème physique : ${broken.length ? broken.map((r) => r.levelId).join(', ') : 'aucun'}.`)
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
    if (r.died) L.push('- Le panda est mort (PV ≤ 0) durant le test (inattendu en god mode).')
    for (const l of r.ladders ?? []) {
      L.push(`- Échelle @x≈${l.ladderX} (haut rangée ${l.ladderY}) : montée ${l.climbedPx}px → ${l.ok ? 'OK' : (l.crash ? 'CRASH/GEL' : 'ne grimpe pas')}`)
    }
    for (const l of r.landings ?? []) {
      L.push(`- Palier à coffre @x≈${l.x} (dessus rangée ${l.platTop}) : ${l.ok ? `tient (y=${l.restY}, essai ${l.attempts}) OK` : `ne tient pas (y=${l.restY}) — TRAVERSÉE`}`)
    }
    for (const l of r.laddersToNowhere ?? []) {
      L.push(`- **ÉCHELLE VERS LE VIDE** (cross-check statique) : x=${l.x} haut rangée ${l.y} h=${l.h} — aucune plateforme posable au sommet.`)
    }
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
