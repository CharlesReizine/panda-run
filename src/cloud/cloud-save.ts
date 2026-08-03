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

// Un document ILLISIBLE est traité comme absent : on ne bloque jamais le jeu sur une sauvegarde
// corrompue (même politique que TitleScene.safeLoad en local). Un document qu'on n'a PAS PU LIRE, en
// revanche, n'est pas absent — cf. le type Recherche juste en dessous.
//
// ⚠️ LA CLÉ DU DOCUMENT A DÉRIVÉ PAR LE PASSÉ, LE NOM DU JOUEUR NON. C'est la leçon de quatre correctifs
// successifs, et c'est la base qui l'a tranchée : « dans le classement on voit un archer de niveau 29 et
// pourtant quand je load j'ai un novice de niveau 1 ». Relevé alors dans Firestore :
//
//   clé « panda »          → nom « charlychoulove », archer 29, 23 terrains finis   ← la vraie partie
//   clé « charlychoulove » → nom « megastock »,      novice 1                       ← créée par erreur
//
// Le personnage dormait sous « panda », le REPLI de `pseudoKey` quand la normalisation ne rendait rien
// d'exploitable. Ce repli a été supprimé depuis, et la clé vaut maintenant exactement le pseudo normalisé :
// le document exact est donc redevenu la source de vérité, et le rattrapage par le nom n'est plus qu'un
// FILET pour les sauvegardes écrites par les anciennes versions.

/**
 * Résultat d'une recherche de sauvegarde. TROIS états, et la distinction est vitale.
 *
 * ⚠️ « JE N'AI RIEN TROUVÉ » ET « JE N'AI PAS PU CHERCHER » NE SONT PAS LA MÊME CHOSE, et les confondre
 * a coûté une sauvegarde. `pull` rendait `null` dans les deux cas ; l'appelant en concluait que la partie
 * n'existait pas et proposait d'en créer une NOUVELLE — donc d'écraser, avec un novice niveau 1, une
 * partie bien vivante que la seule lecture avait échoué à voir. Le joueur a vu « charlychoulove n'existe
 * pas » alors que le document était là, intact, dans la base.
 *
 * Règle : seul `absent` autorise à proposer une nouvelle partie. `echec` n'autorise qu'à réessayer.
 */
export type Recherche =
  | { etat: 'trouve'; save: StampedSave }
  | { etat: 'absent' }
  | { etat: 'echec'; raison: string }

const raisonDe = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Cherche la sauvegarde de `key`.
 *
 * ⚠️ LA CLÉ EXACTE D'ABORD, ET ON S'ARRÊTE LÀ SI ELLE RÉPOND. La version précédente enchaînait
 * SYSTÉMATIQUEMENT un balayage de toute la collection (`autresCandidats`) même quand le document exact
 * venait d'être trouvé : deux allers-retours au lieu d'un, pour rien. C'est ce qui faisait dire au user
 * « ça met des plombes à retrouver la partie alors qu'on cherche dans une DB à deux lignes », et surtout
 * ce qui poussait l'opération au-delà du délai d'attente — d'où l'échec pris pour une absence.
 * Le balayage reste utile, mais UNIQUEMENT en repli : il rattrape les sauvegardes rangées sous une clé
 * dérivée (troncature, ancien identifiant d'authentification).
 */
export async function chercher(key: string): Promise<Recherche> {
  const p = getDb()
  if (!p) return { etat: 'echec', raison: 'cloud non configuré' }
  let db: import('firebase/firestore').Firestore
  let mod: typeof import('firebase/firestore')
  try {
    [db, mod] = await Promise.all([p, import('firebase/firestore')])
  } catch (e) {
    return { etat: 'echec', raison: raisonDe(e) }
  }

  try {
    const snap = await mod.getDoc(mod.doc(db, 'saves', key))
    if (snap.exists()) {
      const s = lireDoc(snap.data() as CloudDoc)
      if (s) return { etat: 'trouve', save: s }
    }
  } catch (e) {
    // on ne SAIT pas si la partie existe : surtout ne pas répondre « absent »
    return { etat: 'echec', raison: raisonDe(e) }
  }

  const autres = await autresCandidats(db, mod, key)
  if (autres === null) return { etat: 'echec', raison: 'balayage des clés dérivées impossible' }
  return autres.length ? { etat: 'trouve', save: plusAvancee(autres) } : { etat: 'absent' }
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

/**
 * Une sauvegarde appartient-elle au joueur qui demande `key` ?
 *
 * UNE SEULE trace reconnue : le NOM inscrit dans la sauvegarde vaut exactement le pseudo demandé, aux
 * accents et à la ponctuation près. Le pseudo étant la seule identité du jeu, l'égalité est le seul
 * critère défendable.
 *
 * ⚠️ LA CORRESPONDANCE PAR PRÉFIXE A ÉTÉ SUPPRIMÉE, ET C'ÉTAIT UNE FAILLE, PAS UN CONFORT. La règle
 * acceptait `idDoc.startsWith(key) || key.startsWith(idDoc)` pour rattraper d'anciennes clés tronquées.
 * Conséquence relevée par le user : « pour charger une partie c'est nom exact ? j'ai écrit
 * charlychoulov et ça m'a chargé charlychoulove ». Une lettre oubliée ouvrait donc la partie d'un autre
 * — et la sauvegarde automatique l'écrasait ensuite sous le mauvais pseudo. Le préfixe couvrait un cas
 * historique devenu vide (la clé vaut désormais le pseudo normalisé, le repli a disparu) au prix d'un
 * détournement de partie à chaque faute de frappe. Le compte est vite fait.
 */
export function memeJoueur(idDoc: string, nomDansLaSauvegarde: string, key: string): boolean {
  return canon(nomDansLaSauvegarde) === key
}

async function autresCandidats(
  db: import('firebase/firestore').Firestore,
  mod: typeof import('firebase/firestore'),
  key: string,
): Promise<StampedSave[] | null> {
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
    // ⚠️ `null`, PAS `[]`. Une liste vide signifie « la collection ne contient rien pour ce joueur », ce
    // qui autorise l'appelant à proposer une nouvelle partie ; un échec de lecture ne l'autorise pas.
    return null
  }
}

export async function push(key: string, player: PlayerState, savedAt: number, build: string): Promise<void> {
  const p = getDb()
  if (!p) return
  const [db, mod] = await Promise.all([p, import('firebase/firestore')])
  const payload: CloudDoc = { json: serialize(player, savedAt), savedAt, build }
  await mod.setDoc(mod.doc(db, 'saves', key), payload)
}
