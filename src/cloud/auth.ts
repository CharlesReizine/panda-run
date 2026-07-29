// Connexion Google. Ce module EXISTE pour isoler le choix de stratégie OAuth : c'est le point le
// plus fragile du projet, et personne d'autre ne doit en dépendre.
//
// POURQUOI popup ET PAS redirect. Depuis le 24 juin 2024, `signInWithRedirect` fait passer le flux
// par une iframe cross-origin servie depuis `authDomain` (ici panda-run-reizine.firebaseapp.com).
// Les navigateurs qui bloquent le stockage tiers — Safari 16.1+, donc l'iPhone — la cassent. Comme le
// jeu est servi depuis un AUTRE domaine (charlesreizine.github.io), le redirect est mort d'avance.
// Cf. https://firebase.google.com/docs/auth/web/redirect-best-practices
//
// `signInWithPopup` n'a pas ce problème d'iframe, mais la doc prévient que les popups sont parfois
// bloquées « par l'appareil ou la plateforme » — et le cas non tranché est justement la PWA installée
// en mode standalone sur iOS. C'est le test à faire en priorité.
//
// La parade de fond, si le popup ne passe pas : servir le jeu depuis le MÊME domaine que l'auth
// (Firebase Hosting) → plus d'iframe tierce, redirect et popup marchent tous les deux. Ce module
// change alors d'implémentation SANS toucher au reste du code.

import { getApp } from './firebase'

export interface CloudUser {
  uid: string
  email: string | null
}

type FbAuth = import('firebase/auth').Auth

let authPromise: Promise<FbAuth> | null = null

// Persistance LOCALE explicite : on reste connecté d'un lancement à l'autre (sinon il faudrait se
// reconnecter à chaque ouverture de la PWA, ce qui viderait l'intérêt de la sauvegarde cloud).
function getAuth(): Promise<FbAuth> | null {
  const app = getApp()
  if (!app) return null
  if (!authPromise) {
    authPromise = Promise.all([app, import('firebase/auth')]).then(async ([a, mod]) => {
      const auth = mod.getAuth(a)
      await mod.setPersistence(auth, mod.browserLocalPersistence)
      return auth
    })
  }
  return authPromise
}

export function cloudAvailable(): boolean {
  return getApp() !== null
}

const toUser = (u: { uid: string; email: string | null } | null): CloudUser | null =>
  u ? { uid: u.uid, email: u.email } : null

export async function signInWithGoogle(): Promise<CloudUser> {
  const p = getAuth()
  if (!p) throw new Error('cloud non configuré')
  const [auth, mod] = await Promise.all([p, import('firebase/auth')])
  const provider = new mod.GoogleAuthProvider()
  const res = await mod.signInWithPopup(auth, provider)
  return toUser(res.user)!
}

export async function signOutCloud(): Promise<void> {
  const p = getAuth()
  if (!p) return
  const [auth, mod] = await Promise.all([p, import('firebase/auth')])
  await mod.signOut(auth)
}

// Notifie à chaque changement d'état, y compris la restauration de session au démarrage (c'est
// ASYNCHRONE : au premier tick on ne sait pas encore si l'utilisateur est connecté — d'où un
// callback plutôt qu'un getter).
export async function onUser(cb: (u: CloudUser | null) => void): Promise<void> {
  const p = getAuth()
  if (!p) { cb(null); return }
  const [auth, mod] = await Promise.all([p, import('firebase/auth')])
  mod.onAuthStateChanged(auth, (u) => cb(toUser(u)))
}
