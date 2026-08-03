// SAUVEGARDE / RECHARGEMENT — la sonde qui reproduit la panne du 3 août.
//
// POURQUOI ELLE EXISTE. Le user, après une matinée de correctifs : « rajoute des tests sur tout ce qui a
// cassé là c'est insupportable, toutes tes itérations de ce matin ont pas arrêté de péter le jeu, je veux
// qu'on teste les sauvegardes, les loads ». Il avait raison sur le fond ET sur la cause : à chacun des cinq
// épisodes de perte de sauvegarde, les tests unitaires étaient VERTS. Ils couvraient les fonctions pures
// (`plusAvancee`, `memeJoueur`, `pseudoKey`) ; le défaut vivait dans l'enchaînement — un `catch` qui avale,
// un `null` qui veut dire deux choses, un délai qui expire — et dans le comportement RÉEL du SDK Firestore
// quand le réseau tombe. Rien de tout cela ne s'observe sans navigateur.
//
// ⚠️ ELLE TOURNE CONTRE LE SERVEUR DE DÉVELOPPEMENT, PAS CONTRE LA PRÉVISUALISATION, et c'est nécessaire :
// on doit pouvoir importer `/src/cloud/cloud-save.ts` pour interroger la vraie fonction. La build ne
// contient plus les chemins de source.
//
// CE QUI EST VÉRIFIÉ :
//   1. cloud injoignable → `chercher` répond `echec`, JAMAIS `absent` (le bug exact de la capture) ;
//   2. clé inconnue, cloud joignable → `absent` (sinon plus personne ne pourrait créer de partie) ;
//   3. une sauvegarde locale fait l'aller-retour sans rien perdre ;
//   4. la décision de reprise refuse de proposer une nouvelle partie sur un échec ;
//   5. on progresse, on RECHARGE LA PAGE, et la progression est toujours là (niveau, or, terrains finis) ;
//   6. une sauvegarde corrompue est traitée comme absente et ne plante pas l'écran d'accueil.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5298
const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const browser = await chromium.launch()
const pbs = []

const verifie = (ok, message) => { if (!ok) pbs.push(message) }

try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break } catch {}
    await sleep(500)
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 460 } })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).split('\n')[0]))

  // ─── 1) CLOUD INJOIGNABLE : « echec », et surtout PAS « absent » ────────────────────────────
  await page.route('**://*.googleapis.com/**', (r) => r.abort())
  await page.route('**://*.firebaseio.com/**', (r) => r.abort())
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )

  const horsLigne = await page.evaluate(async () => {
    const cs = await import('/src/cloud/cloud-save.ts')
    const id = await import('/src/cloud/auth.ts')
    try { await id.ensureUser() } catch {}
    // délai généreux : on veut la VRAIE réponse du SDK, pas notre propre chronomètre
    const r = await Promise.race([
      cs.chercher('charlychoulove'),
      new Promise((res) => setTimeout(() => res({ etat: 'delai-sonde' }), 25000)),
    ])
    return r
  })
  console.log(`  cloud coupé → chercher() rend « ${horsLigne.etat} »`)
  verifie(horsLigne.etat !== 'absent',
    'RÉGRESSION MAJEURE : cloud injoignable et `chercher` répond « absent ». C\'est le bug du 3 août — '
    + 'l\'écran d\'accueil annonce alors « ce pseudo n\'existe pas » et propose d\'écraser la partie.')
  verifie(horsLigne.etat === 'echec' || horsLigne.etat === 'delai-sonde',
    `état inattendu hors ligne : « ${horsLigne.etat} » (attendu « echec »)`)

  // ─── 4) la décision de reprise, sur cet échec réel ──────────────────────────────────────────
  const decision = await page.evaluate(async () => {
    const { decideReprise, decideNouvelle } = await import('/src/core/reprise.ts')
    const echec = { etat: 'echec', raison: 'sonde' }
    return {
      sansLocal: decideReprise(echec, null).action,
      nouvelle: decideNouvelle(echec),
    }
  })
  verifie(decision.sansLocal === 'reessayer',
    `sur échec sans sauvegarde locale, la décision est « ${decision.sansLocal} » au lieu de « reessayer »`)
  verifie(decision.nouvelle === 'reessayer',
    `« Nouvelle partie » sur une vérification ratée rend « ${decision.nouvelle} » au lieu de « reessayer »`)
  console.log(`  décision sur échec → reprise: ${decision.sansLocal} · nouvelle partie: ${decision.nouvelle}`)

  // ─── 3) aller-retour d'une sauvegarde locale ────────────────────────────────────────────────
  const allerRetour = await page.evaluate(async () => {
    const save = await import('/src/core/save.ts')
    const ps = await import('/src/core/player-state.ts')
    const p = ps.newPlayer('charlychoulove')
    p.level = 29
    p.classId = 'archer'
    p.gold = 4242
    p.statPoints = 7
    save.save(p)
    const relu = save.load()
    const tampon = save.loadStamped()
    return {
      nom: relu?.name, niveau: relu?.level, classe: relu?.classId, or: relu?.gold, points: relu?.statPoints,
      horodate: !!tampon && tampon.savedAt > 0,
    }
  })
  verifie(allerRetour.nom === 'charlychoulove', `nom perdu à l'aller-retour : ${allerRetour.nom}`)
  verifie(allerRetour.niveau === 29, `niveau perdu : ${allerRetour.niveau}`)
  verifie(allerRetour.classe === 'archer', `classe perdue : ${allerRetour.classe}`)
  verifie(allerRetour.or === 4242, `or perdu : ${allerRetour.or}`)
  verifie(allerRetour.points === 7, `points de stat perdus : ${allerRetour.points}`)
  verifie(allerRetour.horodate, 'la sauvegarde relue n\'a pas d\'horodatage (loadStamped)')
  console.log(`  aller-retour local → ${allerRetour.nom} niv ${allerRetour.niveau} ${allerRetour.classe}, ${allerRetour.or} or`)

  // ─── échec au cloud MAIS un local présent : le jeu doit démarrer sans rien demander ─────────
  const avecLocal = await page.evaluate(async () => {
    const { decideReprise } = await import('/src/core/reprise.ts')
    const save = await import('/src/core/save.ts')
    const r = decideReprise({ etat: 'echec', raison: 'sonde' }, save.loadStamped())
    return { action: r.action, source: r.source, niveau: r.save?.player?.level }
  })
  verifie(avecLocal.action === 'reprendre' && avecLocal.source === 'local',
    `hors ligne avec un local, on obtient ${avecLocal.action}/${avecLocal.source} au lieu de reprendre/local`)
  verifie(avecLocal.niveau === 29, `hors ligne avec un local, niveau chargé = ${avecLocal.niveau}`)
  console.log(`  hors ligne + local → ${avecLocal.action} (${avecLocal.source}, niv ${avecLocal.niveau})`)


  // ─── 5) PROGRESSER, RECHARGER LA PAGE, RETROUVER SA PROGRESSION ──────────────────────────────
  // Le test que rien ne couvrait, et pourtant le seul qui dise si le jeu est jouable : la sauvegarde
  // sert à survivre à une FERMETURE D'ONGLET. Sept appels à `save()` sont dispersés dans les scènes ;
  // ce qui compte n'est aucun d'eux en particulier, c'est que l'état écrit se retrouve après reload.
  const avant = await page.evaluate(async () => {
    const st = await import('/src/state.ts')
    const save = await import('/src/core/save.ts')
    const prog = await import('/src/core/progression.ts')
    const ps = await import('/src/core/player-state.ts')
    const p = ps.newPlayer('sonde-persist')
    st.setPlayer(p)
    // on progresse par le VRAI chemin de progression (gain d'XP → montées de niveau en cascade)
    prog.grantXp(p, 5000)
    p.gold += 1234
    p.clearedNodes = ['plaine-1', 'plaine-2']
    save.save(p)
    return { niveau: p.level, or: p.gold, terrains: p.clearedNodes.length, xp: p.xp }
  })
  console.log(`  avant reload → niv ${avant.niveau}, ${avant.or} or, ${avant.terrains} terrains`)
  verifie(avant.niveau > 1, `grantXp n'a pas fait monter de niveau (niv ${avant.niveau})`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )
  const apres = await page.evaluate(async () => {
    const save = await import('/src/core/save.ts')
    const p = save.load()
    return { niveau: p?.level, or: p?.gold, terrains: (p?.clearedNodes ?? []).length, xp: p?.xp, nom: p?.name }
  })
  console.log(`  après reload → niv ${apres.niveau}, ${apres.or} or, ${apres.terrains} terrains`)
  verifie(apres.nom === 'sonde-persist', `nom perdu au reload : ${apres.nom}`)
  verifie(apres.niveau === avant.niveau, `NIVEAU PERDU au reload : ${avant.niveau} → ${apres.niveau}`)
  verifie(apres.or === avant.or, `OR PERDU au reload : ${avant.or} → ${apres.or}`)
  verifie(apres.xp === avant.xp, `XP PERDUE au reload : ${avant.xp} → ${apres.xp}`)
  verifie(apres.terrains === avant.terrains,
    `TERRAINS FINIS PERDUS au reload : ${avant.terrains} → ${apres.terrains} (c'est la carte du monde qui se vide)`)

  // ─── 6) une sauvegarde CORROMPUE ne doit pas planter le jeu ──────────────────────────────────
  // Politique documentée : un fichier illisible est traité comme absent, jamais comme une erreur fatale.
  // Sans ce filet, un octet de travers sur le téléphone du joueur rendait l'écran d'accueil inutilisable.
  const corrompue = await page.evaluate(async () => {
    const save = await import('/src/core/save.ts')
    const cles = Object.keys(localStorage).filter((k) => k.includes('panda'))
    for (const k of cles) localStorage.setItem(k, '{ceci n est pas du json')
    let plante = null
    let relu
    try { relu = save.load() } catch (e) { plante = String(e) }
    return { plante, relu: relu === null ? 'null' : typeof relu, cles: cles.length }
  })
  verifie(corrompue.cles > 0, 'aucune clé de sauvegarde trouvée dans localStorage (la sonde ne teste rien)')
  verifie(!corrompue.plante, `une sauvegarde corrompue fait PLANTER load() : ${corrompue.plante}`)
  verifie(corrompue.relu === 'null', `une sauvegarde corrompue rend « ${corrompue.relu} » au lieu de null`)
  console.log(`  sauvegarde corrompue → load() rend ${corrompue.relu}, sans planter`)

  // ─── 2) CLOUD JOIGNABLE, clé inconnue : « absent » ──────────────────────────────────────────
  // Sans ce contre-test, rendre « echec » en toute circonstance ferait passer les vérifications
  // ci-dessus tout en interdisant définitivement de créer une partie.
  await page.unrouteAll()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__pandaGame?.scene.getScenes(true).some((s) => s.scene.key === 'Title'),
    null, { timeout: 300000 },
  )
  const inconnu = await page.evaluate(async () => {
    const cs = await import('/src/cloud/cloud-save.ts')
    const id = await import('/src/cloud/auth.ts')
    try { await id.ensureUser() } catch (e) { return { etat: 'auth-impossible', raison: String(e) } }
    return await cs.chercher('zzz-pseudo-qui-nexiste-pas-sonde')
  })
  console.log(`  cloud OK, clé inconnue → « ${inconnu.etat} »`)
  if (inconnu.etat === 'auth-impossible') {
    console.log(`  (authentification indisponible ici : ${String(inconnu.raison).slice(0, 160)})`)
  } else {
    verifie(inconnu.etat === 'absent',
      `une clé inconnue rend « ${inconnu.etat} » au lieu de « absent » — plus personne ne peut créer de partie`)
  }

  // ─── et la vraie partie du user est bien lisible ─────────────────────────────────────────────
  const vraie = await page.evaluate(async () => {
    const cs = await import('/src/cloud/cloud-save.ts')
    const id = await import('/src/cloud/auth.ts')
    try { await id.ensureUser() } catch { return { etat: 'auth-impossible' } }
    const r = await cs.chercher('charlychoulove')
    return { etat: r.etat, niveau: r.save?.player?.level, nom: r.save?.player?.name, classe: r.save?.player?.classId }
  })
  if (vraie.etat === 'trouve') {
    console.log(`  saves/charlychoulove → ${vraie.nom} niv ${vraie.niveau} ${vraie.classe}`)
    verifie(vraie.niveau >= 29, `la partie du user est retombée à ${vraie.niveau} (attendu ≥ 29)`)
  } else if (vraie.etat !== 'auth-impossible') {
    pbs.push(`saves/charlychoulove introuvable alors que le cloud répond : « ${vraie.etat} »`)
  }

  if (erreurs.length) pbs.push('erreurs JS : ' + [...new Set(erreurs)].join(' | '))
} catch (e) {
  pbs.push('sonde interrompue : ' + String(e.message).split('\n')[0])
} finally {
  await browser.close()
  dev.kill('SIGKILL')
}

if (pbs.length) {
  console.error('\n❌ SAUVEGARDE EN ÉCHEC :')
  for (const p of [...new Set(pbs)]) console.error('   ' + p)
  process.exit(1)
}
console.log('✔ sauvegardes et rechargements : un échec de lecture ne se déguise jamais en « partie absente »')
