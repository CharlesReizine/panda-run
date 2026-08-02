// Vérifie dans un VRAI navigateur que les SONS CLÉS partent bien sur les événements clés.
//
// POURQUOI CE SCRIPT EXISTE. Un son qui ne part plus est INVISIBLE : aucun test ne le voit, rien ne
// sort d'un contexte Web Audio qu'on puisse lire, et le seul détecteur est l'oreille du joueur. Cette
// session a connu six allers-retours sur des sons (bulles inaudibles, musique sous l'eau, coups reçus
// trop discrets, plouf), et à chaque fois la première question était la même : « est-ce que ça part, ou
// est-ce que c'est juste trop faible ? » Ce script répond à cette question sans déranger personne.
//
// Il ne juge PAS le volume — ça, seule une oreille le fait. Il prouve que l'appel a lieu.
//
// ⚠️ Réseau Google coupé : on amorce une partie « sonde », qui pousserait sinon sa sauvegarde au cloud.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5202
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

  const r = await page.evaluate(async () => {
    const g = window.__pandaGame
    const audio = window.__pandaAudio
    if (!audio) return { err: 'crochet __pandaAudio absent (cf. src/main.ts)' }
    g.scene.getScene('Title').startFresh('sonde', 'panda-run:sonde')
    await new Promise((r) => setTimeout(r, 400))

    // premier terrain contenant de l'eau
    for (const levelId of window.__pandaLevelIds ?? []) {
      g.scene.start('Level', { levelId, fromNode: levelId, targetNode: levelId, dir: 'forward' })
      await new Promise((r) => setTimeout(r, 1800))
      const sc = g.scene.getScene('Level')
      const eaux = sc.waterRects ?? []
      if (!eaux.length) continue

      const appels = []
      const orig = audio.playSfx.bind(audio)
      audio.playSfx = (n, gain) => { appels.push(n); return orig(n, gain) }
      const w = eaux[0]
      sc.player.setPosition(w.x + w.width / 2, w.y + w.height / 2)
      sc.player.inWater = false // force le FRONT MONTANT, sinon on entre déjà mouillé
      // ⚠️ FENÊTRE LARGE, ET IL FAUT QU'ELLE LE RESTE. 800 ms suffisaient quand une bulle partait toutes
      // les 170 ms ; la cadence est passée à BUBBLE_INTERVAL_MS = 520 ms, et le panda met en plus quelques
      // dizaines de frames à se stabiliser sous l'eau après le repositionnement. La sonde annonçait donc
      // « aucune bulle » sur un jeu parfaitement sain — un faux positif coûte la confiance qu'on met dans
      // la sonde, ce qui est bien pire que pas de sonde du tout. 2,5 s = quatre bulles attendues.
      await new Promise((r) => setTimeout(r, 2500))
      audio.playSfx = orig
      const b = sc.player.body
      return { levelId, splash: appels.filter((a) => a === 'splash').length, bulles: appels.filter((a) => a === 'bubble').length, tous: [...new Set(appels)],
        diag: { cuve: { x: Math.round(w.x), y: Math.round(w.y), w: Math.round(w.width), h: Math.round(w.height) },
                tete: Math.round(b.top), immerge: b.top >= w.y + 4, inWater: sc.player.inWater } }
    }
    return { err: 'aucun terrain avec de l\'eau' }
  })

  // ─── LE « SCHLOUNG » DU TRAMPOLINE ───────────────────────────────────────────────────────────
  // Demande du user, mot pour mot. Même raison que le plouf : un son qui ne part pas est invisible, et
  // celui-ci a en plus une histoire — le rebond lui-même ne partait pas du tout (overlap déclaré avant
  // l'existence du joueur, cf. R315). On vérifie donc les deux d'un coup : le rebond a lieu, ET il sonne.
  const tramp = await page.evaluate(async () => {
    const g = window.__pandaGame
    const audio = window.__pandaAudio
    const L = window.__pandaLevels ?? {}
    const levelId = Object.keys(L).find((id) => (L[id].trampolines ?? []).length)
    if (!levelId) return { err: 'aucun terrain à trampoline' }
    g.scene.start('Level', { levelId, test: true })
    await new Promise((r) => setTimeout(r, 1600))
    const sc = g.scene.getScene('Level')
    const appels = []
    const orig = audio.playSfx.bind(audio)
    audio.playSfx = (n, gain) => { appels.push(n); return orig(n, gain) }
    const tr = sc.levelDef.trampolines[0]
    sc.player.setPosition(tr.x * 32 + 16, (tr.y - 4) * 32)
    sc.player.body.setVelocity(0, 300)
    await new Promise((r) => setTimeout(r, 1200))
    audio.playSfx = orig
    return { levelId, schloung: appels.filter((a) => a === 'schloung').length, tous: [...new Set(appels)] }
  })
  if (tramp.err) problems.push(tramp.err)
  else {
    console.log(`terrain ${tramp.levelId} · rebond : ${tramp.schloung} schloung (sons émis : ${tramp.tous.join(', ') || 'aucun'})`)
    if (tramp.schloung < 1) problems.push('AUCUN « schloung » en tombant sur le trampoline')
  }

  if (r.err) problems.push(r.err)
  else {
    console.log(`terrain ${r.levelId} · sons émis : ${r.tous.join(', ') || 'aucun'}`)
    console.log('  diag eau :', JSON.stringify(r.diag))
    if (r.splash < 1) problems.push('AUCUN « plouf » à l\'entrée dans l\'eau (front montant de inWater)')
    if (r.splash > 1) problems.push(`${r.splash} plouf pour UNE entrée dans l'eau — le front montant se déclenche plusieurs fois`)
    if (r.bulles < 1) problems.push('aucune bulle en restant sous l\'eau')
  }
} catch (e) {
  problems.push(`sonde en échec : ${String(e.message).split('\n')[0]}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

if (problems.length) {
  console.error('\n❌ SONS :')
  for (const p of [...new Set(problems)]) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ plouf, bulles et schloung partent bien')
