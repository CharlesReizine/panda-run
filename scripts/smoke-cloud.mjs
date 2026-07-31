// Vérification de bout en bout de l'étage cloud, SANS navigateur : authent anonyme → écriture →
// lecture → requête de classement → nettoyage. Sert à prouver que le fournisseur « Anonymous » est
// activé et que les règles Firestore laissent passer ce qu'il faut (et bloquent le reste).
//
// Écrit un document de test clairement identifié puis LE SUPPRIME. Lancement : node scripts/smoke-cloud.mjs
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'

// Node ne lit pas les variables VITE_ : on parse .env à la main.
const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

const KEY = '_smoke-test'
let failed = false
const ok = (m) => console.log(`  ✔ ${m}`)
const ko = (m, e) => { failed = true; console.log(`  ✘ ${m} — ${e?.message ?? e}`) }

try {
  const auth = getAuth(app)
  const cred = await signInAnonymously(auth)
  ok(`authent anonyme : uid ${cred.user.uid.slice(0, 8)}…`)

  const db = getFirestore(app)

  // 1. écriture d'une ligne de classement
  try {
    await setDoc(doc(db, 'players', KEY), { pseudo: 'SMOKE', level: 1, classId: 'novice', updatedAt: Date.now() })
    ok('écriture players/_smoke-test')
  } catch (e) { ko('écriture players', e) }

  // 2. relecture
  try {
    const s = await getDoc(doc(db, 'players', KEY))
    s.exists() ? ok(`relecture (pseudo=${s.data().pseudo})`) : ko('relecture', 'document absent')
  } catch (e) { ko('relecture', e) }

  // 3. requête de classement (c'est CELLE-CI qui révèle un index manquant)
  try {
    const snap = await getDocs(query(collection(db, 'players'), orderBy('level', 'desc'), limit(50)))
    ok(`requête classement : ${snap.size} joueur(s)`)
  } catch (e) { ko('requête classement (index ?)', e) }

  // 4. sauvegarde privée
  try {
    await setDoc(doc(db, 'saves', KEY), { json: '{"version":8,"player":{},"savedAt":1}', savedAt: 1, build: 'smoke' })
    const s = await getDoc(doc(db, 'saves', KEY))
    s.exists() ? ok('écriture + relecture saves/_smoke-test') : ko('saves', 'document absent')
  } catch (e) { ko('saves', e) }

  // 5. les règles doivent REFUSER une collection non prévue
  try {
    await setDoc(doc(db, 'nimporte-quoi', KEY), { x: 1 })
    ko('règles trop permissives', 'une collection non prévue a accepté une écriture')
  } catch { ok('règles : collection non prévue bien refusée') }

  // nettoyage
  for (const c of ['players', 'saves']) {
    try { await deleteDoc(doc(db, c, KEY)) } catch { /* rien à nettoyer */ }
  }
  ok('documents de test supprimés')
} catch (e) {
  ko('authent anonyme', e)
}

console.log(failed ? '\nRÉSULTAT : au moins une étape a échoué.' : '\nRÉSULTAT : chaîne cloud OK de bout en bout.')
process.exit(failed ? 1 : 0)
