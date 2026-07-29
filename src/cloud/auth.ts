// Connexion Google. Ce module EXISTE pour isoler la stratégie OAuth : c'est le point le plus fragile
// du projet, et personne d'autre ne doit en dépendre.
//
// ⚠️ LE PIÈGE QUI A CAUSÉ « POPUP BLOCKED ». `signInWithPopup` ouvre une fenêtre, donc il doit être
// appelé SYNCHRONEMENT dans le gestionnaire du geste utilisateur. La 1re version faisait
// `await import('firebase/auth')` puis `await setPersistence(...)` AVANT d'ouvrir la popup : le temps
// que le SDK se télécharge, le navigateur ne relie plus l'ouverture au clic et la bloque. Ce n'était
// donc pas une limite d'iOS — c'était l'import dynamique qui cassait la chaîne du geste.
// → `prewarm()` résout le SDK À L'AVANCE (dès l'écran-titre) ; `signInPopup()` n'a alors plus aucun
//   `await` devant l'appel à signInWithPopup.
//
// REPLI REDIRECT. Si la popup est quand même refusée (certaines plateformes la bloquent d'office, et
// le cas de la PWA iOS installée reste incertain), on bascule sur `signInWithRedirect`. Attention :
// depuis le 24/06/2024 le redirect passe par une iframe servie depuis `authDomain` et les navigateurs
// qui bloquent le stockage tiers (Safari 16.1+) la cassent — il ne fonctionne donc QUE si le jeu est
// servi depuis le MÊME domaine que `authDomain`.
// Cf. https://firebase.google.com/docs/auth/web/redirect-best-practices

import { getApp } from './firebase'

export interface CloudUser {
  uid: string
  email: string | null
}

type AuthMod = typeof import('firebase/auth')
type FbAuth = import('firebase/auth').Auth

let mod: AuthMod | null = null
let auth: FbAuth | null = null
let warming: Promise<void> | null = null

export function cloudAvailable(): boolean {
  return getApp() !== null
}

// Prêt à ouvrir une popup sans le moindre await ?
export function authReady(): boolean {
  return mod !== null && auth !== null
}

// Charge le SDK et prépare l'instance. À appeler DÈS l'affichage de l'écran-titre, pas au clic.
// Idempotent, et silencieux en cas d'échec : le cloud est une commodité, jamais un bloqueur.
export function prewarm(): Promise<void> {
  const app = getApp()
  if (!app) return Promise.resolve()
  if (!warming) {
    warming = (async () => {
      const [a, m] = await Promise.all([app, import('firebase/auth')])
      // persistance LOCALE : on reste connecté d'un lancement à l'autre (sinon il faudrait se
      // reconnecter à chaque ouverture de la PWA, ce qui viderait l'intérêt du cloud)
      const instance = m.getAuth(a)
      await m.setPersistence(instance, m.browserLocalPersistence)
      mod = m
      auth = instance
    })().catch(() => { warming = null })
  }
  return warming
}

const toUser = (u: { uid: string; email: string | null } | null): CloudUser | null =>
  u ? { uid: u.uid, email: u.email } : null

// Codes pour lesquels insister avec une popup est inutile : la plateforme la refuse.
const POPUP_REFUSED = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
])

export class PopupRefusedError extends Error {
  constructor(public readonly code: string) {
    super(`popup refusée (${code})`)
  }
}

// AUCUN await avant signInWithPopup : c'est toute la raison d'être de prewarm().
// Lève PopupRefusedError si la plateforme refuse la popup → l'appelant peut basculer sur le redirect.
export async function signInPopup(): Promise<CloudUser> {
  if (!mod || !auth) throw new Error('SDK non préchargé')
  const m = mod
  try {
    const res = await m.signInWithPopup(auth, new m.GoogleAuthProvider())
    return toUser(res.user)!
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    if (POPUP_REFUSED.has(code)) throw new PopupRefusedError(code)
    throw e
  }
}

// Quitte la page : la session revient via completeRedirect() au chargement suivant.
export async function signInRedirect(): Promise<void> {
  await prewarm()
  if (!mod || !auth) throw new Error('cloud non configuré')
  await mod.signInWithRedirect(auth, new mod.GoogleAuthProvider())
}

// À appeler au démarrage : termine un flux redirect entamé avant le rechargement.
// `null` = il n'y avait pas de redirect en cours (cas courant).
export async function completeRedirect(): Promise<CloudUser | null> {
  await prewarm()
  if (!mod || !auth) return null
  try {
    const res = await mod.getRedirectResult(auth)
    return res ? toUser(res.user) : null
  } catch {
    return null
  }
}

export async function signOutCloud(): Promise<void> {
  await prewarm()
  if (!mod || !auth) return
  await mod.signOut(auth)
}

// Notifie à chaque changement d'état, y compris la restauration de session au démarrage (c'est
// ASYNCHRONE : au premier tick on ne sait pas encore si l'utilisateur est connecté).
export async function onUser(cb: (u: CloudUser | null) => void): Promise<void> {
  await prewarm()
  if (!mod || !auth) { cb(null); return }
  mod.onAuthStateChanged(auth, (u) => cb(toUser(u)))
}
