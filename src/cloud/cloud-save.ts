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
/**
 * Retrouve la partie d'un pseudo — par sa clé, ou par le NOM inscrit dans la sauvegarde.
 *
 * ⚠️ LA CLÉ DU DOCUMENT A DÉRIVÉ, LE NOM DU JOUEUR NON. C'est la leçon de trois correctifs successifs,
 * et c'est la base qui l'a tranchée : « dans le classement on voit un archer de niveau 29 et pourtant
 * quand je load j'ai un novice de niveau 1 ». Relevé dans Firestore :
 *
 *   clé « panda »          → nom « charlychoulove », archer 29, 23 terrains finis   ← la vraie partie
 *   clé « charlychoulove » → nom « megastock »,      novice 1                       ← créée par erreur
 *
 * Le personnage était bien là ; il dormait sous « panda », qui est le REPLI de `pseudoKey` quand la
 * normalisation ne rend rien d'exploitable. Une clé technique peut changer de forme au fil des versions
 * (troncature, repli, identifiant d'authentification d'une ancienne build) ; le nom que le joueur a tapé,
 * lui, est écrit DANS la sauvegarde et ne bouge pas. C'est donc lui qui fait office d'identité.
 *
 * ⚠️ ET ON COMPARE TOUS LES CANDIDATS AVANT DE CHOISIR, y compris la correspondance exacte. C'est le
 * piège où je suis tombé : privilégier la clé exacte ramenait le novice 1 créé par erreur et laissait
 * l'archer 29 au placard. On garde la sauvegarde la plus AVANCÉE — dans un jeu solo la progression ne
 * redescend jamais, donc ce choix ne peut jamais faire perdre de progression.
 */
export async function pull(key: string): Promise<StampedSave | null> {
  const p = getDb()
  if (!p) return null
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])

  const candidats: StampedSave[] = []
  const snap = await mod.getDoc(mod.doc(db, 'saves', key))
  if (snap.exists()) {
    const s = lireDoc(snap.data() as CloudDoc)
    if (s) candidats.push(s)
  }
  candidats.push(...await autresCandidats(db, mod, key))
  if (candidats.length === 0) return null
  return plusAvancee(candidats)
}

/** La sauvegarde la plus avancée ; à niveau égal, la plus récente. */
export function plusAvancee(candidats: StampedSave[]): StampedSave {
  return candidats.reduce((a, b) => {
    if (b.player.level > a.player.level) return b
    if (b.player.level === a.player.level && b.savedAt > a.savedAt) return b
    return a
  })
}

function lireDoc(data: CloudDoc): StampedSave | null {
  try {
    if (typeof data.json !== 'string') return null
    return deserializeStamped(data.json)
  } catch {
    return null
  }
}

/** Forme canonique d'un pseudo, pour comparer un nom écrit dans une sauvegarde à une clé. */
export function canon(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

/** Une sauvegarde appartient-elle au joueur qui demande `key` ? */
export function memeJoueur(idDoc: string, nomDansLaSauvegarde: string, key: string): boolean {
  // Deux traces reconnues, et deux seulement :
  //  · le NOM du joueur dans la sauvegarde correspond au pseudo demandé (clé dérivée ou repliée) ;
  //  · la clé est un PRÉFIXE de la nôtre, ou l'inverse (trace d'un changement de troncature).
  // Rien d'autre : deux joueurs aux pseudos voisins ne doivent jamais hériter de la partie de l'autre.
  if (canon(nomDansLaSauvegarde) === key) return true
  return idDoc.startsWith(key) || key.startsWith(idDoc)
}

async function autresCandidats(
  db: import('firebase/firestore').Firestore,
  mod: typeof import('firebase/firestore'),
  key: string,
): Promise<StampedSave[]> {
  if (key.length < 3) return [] // trop court pour qu'un préfixe soit significatif
  try {
    const snap = await mod.getDocs(mod.collection(db, 'saves'))
    const out: StampedSave[] = []
    snap.forEach((d) => {
      if (d.id === key) return
      const s = lireDoc(d.data() as CloudDoc)
      if (s && memeJoueur(d.id, s.player.name ?? '', key)) out.push(s)
    })
    return out
  } catch {
    return [] // droits insuffisants ou hors ligne : on ne bloque pas l'écran d'accueil
  }
}

export async function push(key: string, player: PlayerState, savedAt: number, build: string): Promise<void> {
  const p = getDb()
  if (!p) return
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const payload: CloudDoc = { json: serialize(player, savedAt), savedAt, build }
  await mod.setDoc(mod.doc(db, 'saves', key), payload)
}
