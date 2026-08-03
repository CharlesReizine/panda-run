// Lecture/écriture de la sauvegarde dans Firestore : un document par joueur, `saves/{pseudoKey}`.
//
// ⚠️ PAS PRIVÉE, et c'est inhérent au modèle choisi : le pseudo étant la seule identité, « reprendre
// ma partie sur un autre téléphone » consiste exactement à lire la sauvegarde d'une clé qu'on ne
// possède pas. Tout joueur authentifié peut donc lire et écrire n'importe quelle sauvegarde
// (cf. firestore.rules).
//
// LA SAUVEGARDE EST STOCKÉE COMME UNE CHAÎNE JSON, pas comme un objet Firestore. C'est délibéré :
//   - Firestore REFUSE les champs `undefined` (or PlayerState a plein de champs optionnels :
//     equipment.hat, quests…), interdit les tableaux imbriqués, et contraint les noms de clés.
//     Sérialiser en amont supprime cette classe entière de plantages à l'écriture.
//   - le format de sauvegarde reste défini à UN SEUL endroit (core/save.ts), donc les migrations de
//     version valent aussi pour le cloud, gratuitement.
// Une save fait ~10 Ko, très loin de la limite de 1 Mio par document.

import { getApp } from './firebase'
import { deserializeStamped, serialize, type StampedSave } from '../core/save'
import type { PlayerState } from '../core/player-state'

type Firestore = import('firebase/firestore').Firestore

let dbPromise: Promise<Firestore> | null = null

function getDb(): Promise<Firestore> | null {
  const app = getApp()
  if (!app) return null
  if (!dbPromise) {
    dbPromise = Promise.all([app, import('firebase/firestore')]).then(([a, mod]) => mod.getFirestore(a))
  }
  return dbPromise
}

interface CloudDoc {
  json: string // fichier de sauvegarde sérialisé (core/save.ts)
  savedAt: number // epoch ms, dupliqué hors du JSON pour être lisible sans désérialiser
  build: string // repère de version du jeu qui a écrit — aide au diagnostic
}

// `null` = pas de sauvegarde cloud. Un document illisible est traité EXACTEMENT comme absent : on ne
// bloque jamais le jeu sur une sauvegarde corrompue (même politique que TitleScene.safeLoad en local).
export async function pull(key: string): Promise<StampedSave | null> {
  const p = getDb()
  if (!p) return null
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const snap = await mod.getDoc(mod.doc(db, 'saves', key))
  if (snap.exists()) {
    const s = lireDoc(snap.data() as CloudDoc)
    if (s) return s
  }
  return retrouverSousUneAutreCle(db, mod, key)
}

function lireDoc(data: CloudDoc): StampedSave | null {
  try {
    if (typeof data.json !== 'string') return null
    return deserializeStamped(data.json)
  } catch {
    return null
  }
}

/**
 * Dernier recours : la partie existe, mais sous une clé écrite par une ANCIENNE version.
 *
 * ⚠️ CE REPLI EXISTE PARCE QU'UNE SAUVEGARDE A ÉTÉ « PERDUE ». Retour du user : « quand je choisis
 * continuer avec charlychoulove, ça me remet niveau 1 au début du jeu ». La partie n'avait pas disparu :
 * elle dormait sous une clé que la normalisation d'aujourd'hui ne produit plus (la longueur maximale du
 * pseudo a changé en cours de route, et la troncature avec elle). Le jeu cherchait au bon endroit selon
 * ses règles actuelles, ne trouvait rien, et proposait donc de créer une nouvelle partie — un écran de
 * perte de données déguisé en écran d'accueil. C'est le même désalignement de clé qui faisait deux
 * lignes au classement.
 *
 * On parcourt donc les sauvegardes et on accepte une clé dont la forme canonique est un PRÉFIXE de la
 * nôtre, ou l'inverse : c'est exactement la trace que laisse un changement de troncature. Rien d'autre
 * n'est toléré — deux joueurs aux pseudos voisins ne doivent jamais hériter de la partie de l'autre.
 * En cas d'ambiguïté (plusieurs candidats), on prend la sauvegarde la plus AVANCÉE : c'est celle que le
 * joueur reconnaîtra, et la seule que perdre serait grave.
 */
async function retrouverSousUneAutreCle(
  db: import('firebase/firestore').Firestore,
  mod: typeof import('firebase/firestore'),
  key: string,
): Promise<StampedSave | null> {
  if (key.length < 3) return null // trop court pour qu'un préfixe soit significatif
  try {
    const snap = await mod.getDocs(mod.collection(db, 'saves'))
    let meilleur: StampedSave | null = null
    snap.forEach((d) => {
      const id = d.id
      if (id === key) return
      if (!(id.startsWith(key) || key.startsWith(id))) return
      const s = lireDoc(d.data() as CloudDoc)
      if (!s) return
      if (!meilleur || s.player.level > meilleur.player.level) meilleur = s
    })
    return meilleur
  } catch {
    return null // droits insuffisants ou hors ligne : on ne bloque pas l'écran d'accueil
  }
}

export async function push(key: string, player: PlayerState, savedAt: number, build: string): Promise<void> {
  const p = getDb()
  if (!p) return
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const payload: CloudDoc = { json: serialize(player, savedAt), savedAt, build }
  await mod.setDoc(mod.doc(db, 'saves', key), payload)
}
