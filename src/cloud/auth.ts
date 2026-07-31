// Identité du joueur : authentification ANONYME Firebase, déclenchée en silence au démarrage.
//
// POURQUOI ANONYME ET PAS « JUSTE UN PSEUDO ». Un pseudo sans mot de passe n'authentifie RIEN : sans
// identité vérifiable, les règles Firestore ne peuvent pas savoir qui écrit, donc il faudrait ouvrir
// l'écriture à tout le monde — et n'importe qui pourrait écraser la sauvegarde d'un autre pseudo ou
// se mettre niveau 99 dans le classement. L'authent anonyme donne un `uid` vérifiable SANS rien
// demander au joueur : aucun écran, aucun mot de passe, aucune popup. Le pseudo redevient ce qu'il
// est vraiment — un nom d'AFFICHAGE — et l'uid protège les données.
//
// BÉNÉFICE DE BORD : plus aucune popup ni redirection, donc tout le problème d'OAuth en PWA iOS
// installée (l'iframe cross-origin de signInWithRedirect bloquée par Safari, la popup refusée par la
// plateforme) DISPARAÎT. C'est la raison technique pour laquelle ce choix est meilleur que Google ici.
//
// ⚠️ LE PRIX, ASSUMÉ : l'identité anonyme vit dans le stockage du navigateur. Vider le cache ou
// changer d'appareil = compte perdu, sans recours. C'est le prix du « pas de mot de passe ». Un code
// de récupération à noter reste possible plus tard (hors périmètre).

import { getApp } from './firebase'

export interface CloudUser {
  uid: string
}

type AuthMod = typeof import('firebase/auth')
type FbAuth = import('firebase/auth').Auth

let mod: AuthMod | null = null
let auth: FbAuth | null = null
let signing: Promise<CloudUser | null> | null = null

export function cloudAvailable(): boolean {
  return getApp() !== null
}

/**
 * Assure une identité : réutilise la session existante, ou en crée une anonyme.
 * Idempotent (la promesse est mémorisée) et TOLÉRANT : renvoie `null` si le cloud est absent, non
 * configuré ou injoignable — le jeu doit rester jouable hors ligne, en local seul.
 */
export function ensureUser(): Promise<CloudUser | null> {
  const app = getApp()
  if (!app) return Promise.resolve(null)
  if (!signing) {
    signing = (async () => {
      const [a, m] = await Promise.all([app, import('firebase/auth')])
      // persistance LOCALE : c'est ELLE qui fait qu'on retrouve son compte au lancement suivant.
      // Sans elle, chaque ouverture créerait un uid neuf — donc une partie neuve.
      const instance = m.getAuth(a)
      await m.setPersistence(instance, m.browserLocalPersistence)
      mod = m
      auth = instance
      if (instance.currentUser) return { uid: instance.currentUser.uid }
      const res = await m.signInAnonymously(instance)
      return { uid: res.user.uid }
    })().catch(() => {
      signing = null // réseau absent : on retentera au prochain appel
      return null
    })
  }
  return signing
}

export function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null
}

// Repart de zéro : nouvelle identité anonyme, donc nouvelle sauvegarde cloud et nouvelle ligne de
// classement. Utilisé par « recommencer une partie » — pas par un bouton « déconnexion », qui
// n'aurait aucun sens sans mot de passe (on ne pourrait jamais se reconnecter).
export async function resetIdentity(): Promise<CloudUser | null> {
  if (mod && auth) {
    try { await mod.signOut(auth) } catch { /* sans importance : on recrée juste après */ }
  }
  signing = null
  return ensureUser()
}
