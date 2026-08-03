// Classement public : un document par joueur dans `players/{pseudoKey}` (le pseudo EST l'identité,
// cf. cloud/identity.ts).
//
// SÉPARÉ de `saves/{pseudoKey}` À DESSEIN. Une sauvegarde pèse ~10 Ko (inventaire, kills, quêtes…) ;
// le classement n'a besoin que de la vitrine : pseudo, niveau, classe. Afficher un tableau de scores
// ne doit pas obliger à télécharger la partie complète de chaque joueur — ni à la rendre publique en
// lecture anonyme (les saves exigent au moins d'être authentifié, le classement non).
//
// ⚠️ L'écriture n'est PAS réservée au propriétaire, et c'est un choix assumé du user : le pseudo étant
// la seule identité (aucun mot de passe), quiconque le connaît peut écrire cette ligne. Les règles
// exigent seulement d'être authentifié (anonymement), ce qui bloque l'abus au curl mais pas un autre
// joueur. Acceptable pour un jeu entre proches ; la parade serait un code de récupération généré.

import { getApp } from './firebase'
import type { ClassId } from '../core/types'

export interface LeaderEntry {
  key: string
  pseudo: string
  level: number
  classId: string
  updatedAt: number
}

type Firestore = import('firebase/firestore').Firestore

let dbPromise: Promise<Firestore> | null = null

function getDb(): Promise<Firestore> | null {
  const app = getApp()
  if (!app) return null
  if (!dbPromise) {
    dbPromise = Promise.all([app, import('firebase/firestore')]).then(([a, m]) => m.getFirestore(a))
  }
  return dbPromise
}

// Longueur bornée + espaces rognés : un pseudo est affiché dans un tableau, il ne doit pas le défoncer.
export const PSEUDO_MAX = 14

export function cleanPseudo(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, PSEUDO_MAX)
}

export async function publish(key: string, pseudo: string, level: number, classId: ClassId, updatedAt: number): Promise<void> {
  const p = getDb()
  if (!p) return
  const [db, m] = await Promise.all([p, import('firebase/firestore')])
  const entry: Omit<LeaderEntry, 'key'> = { pseudo: cleanPseudo(pseudo), level, classId, updatedAt }
  await m.setDoc(m.doc(db, 'players', key), entry)
}

// Les N meilleurs, triés par niveau décroissant. Le tri et la limite sont faits par Firestore : on ne
// télécharge pas toute la collection pour n'en afficher que le haut (c'est aussi ce qui garde la
// consommation dans le quota gratuit quand le nombre de joueurs grandit).
export async function top(limitTo = 50): Promise<LeaderEntry[]> {
  const p = getDb()
  if (!p) return []
  const [db, m] = await Promise.all([p, import('firebase/firestore')])
  const q = m.query(m.collection(db, 'players'), m.orderBy('level', 'desc'), m.limit(limitTo))
  const snap = await m.getDocs(q)
  const out: LeaderEntry[] = []
  snap.forEach((d) => {
    const v = d.data() as Omit<LeaderEntry, 'key'>
    // un document mal formé ne doit pas faire tomber tout le tableau
    if (typeof v.pseudo === 'string' && typeof v.level === 'number') {
      out.push({ key: d.id, pseudo: v.pseudo, level: v.level, classId: String(v.classId ?? 'novice'), updatedAt: Number(v.updatedAt ?? 0) })
    }
  })
  return unParJoueur(out)
}

/**
 * UNE LIGNE PAR JOUEUR : on garde l'entrée la plus AVANCÉE de chaque pseudo.
 *
 * ⚠️ POURQUOI CE FILTRE EXISTE. Retour du user : « j'ai changé de classe et ça me fait deux lignes dans
 * le classement, moi archer et moi chasseur ». La clé du document est pourtant le pseudo, donc une
 * évolution RÉÉCRIT la même ligne — sauf que d'anciennes lignes, écrites avant que la clé ne soit
 * normalisée, traînent dans la collection sous une casse ou une ponctuation différentes. Personne ne les
 * met plus à jour, donc personne ne les corrige : le classement doit s'en protéger à la LECTURE.
 *
 * ⚠️ ON TRIE PAR NIVEAU, PAS PAR DATE — ET C'EST UNE CORRECTION. Le premier jet gardait la ligne la plus
 * RÉCENTE, en supposant qu'elle serait aussi la plus avancée. Faux : « tu m'as supprimé mon chasseur
 * niveau 32, tu as supprimé le mauvais ». Une ligne fantôme peut très bien porter un horodatage plus
 * frais (dernière écriture avant que la clé ne change) tout en décrivant un personnage moins avancé.
 * Le niveau, lui, ne redescend jamais : c'est le seul critère qui dit laquelle des deux lignes raconte
 * la vraie partie. La date ne sert plus qu'à départager deux lignes de même niveau.
 */
export function unParJoueur(entries: LeaderEntry[]): LeaderEntry[] {
  const meilleur = new Map<string, LeaderEntry>()
  for (const e of entries) {
    const cle = e.pseudo.trim().toLowerCase()
    const deja = meilleur.get(cle)
    if (!deja || e.level > deja.level || (e.level === deja.level && e.updatedAt > deja.updatedAt)) {
      meilleur.set(cle, e)
    }
  }
  return [...meilleur.values()].sort((a, b) => b.level - a.level)
}
