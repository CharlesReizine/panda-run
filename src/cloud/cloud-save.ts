// Lecture/écriture de la sauvegarde dans Firestore : un document par joueur, `saves/{uid}`.
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
export async function pull(uid: string): Promise<StampedSave | null> {
  const p = getDb()
  if (!p) return null
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const snap = await mod.getDoc(mod.doc(db, 'saves', uid))
  if (!snap.exists()) return null
  try {
    const data = snap.data() as CloudDoc
    if (typeof data.json !== 'string') return null
    return deserializeStamped(data.json)
  } catch {
    return null
  }
}

export async function push(uid: string, player: PlayerState, savedAt: number, build: string): Promise<void> {
  const p = getDb()
  if (!p) return
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const payload: CloudDoc = { json: serialize(player, savedAt), savedAt, build }
  await mod.setDoc(mod.doc(db, 'saves', uid), payload)
}
