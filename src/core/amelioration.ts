import type { PlayerState } from './player-state'
import type { Rarity } from './types'
import { ITEMS } from '../data/items'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AMÉLIORER UN ÉQUIPEMENT — SÛR JUSQU'À +3, PUIS ÇA CASSE
//
// Demande du joueur, mot pour mot : « la forge faut reprendre, je veux plus de "reforger", tu dégages.
// Par contre chaud d'un onglet "Améliorer" qui permet d'améliorer sans risque de casse jusqu'à +3 (et
// ça coûte un peu cher). Et le coût dépend de la pureté de l'objet. Et après ça casse. Genre +4 tu as
// 20 % de chance, +5 25 %, +6 28 % de chance de péter, +7 29 %, et après +8 c'est 30 % à chaque fois. »
//
// ⚠️ CE N'EST PAS UN RENOMMAGE DE LA RÉFORGE, C'EST UN AUTRE JEU. L'ancienne montait jusqu'à +10 sans
// le moindre risque : la seule question était « ai-je assez de minerai ? », et la réponse finissait
// toujours par être oui. Il n'y avait donc aucune DÉCISION — juste une file d'attente. Le risque
// change la nature de l'objet : à +3, on tient quelque chose qu'on peut perdre, et pousser plus loin
// devient un pari qu'on assume. C'est aussi pour ça que les trois premiers niveaux coûtent CHER : ce
// qu'on risque ensuite doit avoir coûté quelque chose.
//
// ⚠️ ET « ÇA CASSE » VEUT DIRE QUE L'OBJET DISPARAÎT. Pas « ça redescend d'un cran », pas « ça se
// bloque » : l'équipement quitte l'inventaire. C'est ce que le taux de 20 à 30 % annoncé par le joueur
// suppose — une punition tiède rendrait l'avertissement rouge ridicule, et l'avertissement est ce qui
// rend le pari honnête.

/** Le palier au-delà duquel une tentative peut détruire l'objet. Jusque-là, améliorer est sûr. */
export const NIVEAU_SUR = 3

/** Le plafond : au-delà, on n'améliore plus. */
export const NIVEAU_MAX = 10

// Barème de casse dicté par le joueur, niveau VISÉ → probabilité de destruction. Au-delà du dernier
// palier nommé, c'est 30 % à chaque tentative — un plateau, pas une pente : passé un certain point, le
// jeu ne cherche plus à rendre la marche suivante plus dure, il rend l'acharnement coûteux.
const CASSE: Record<number, number> = { 4: 0.20, 5: 0.25, 6: 0.28, 7: 0.29 }
export const CASSE_PLATEAU = 0.30

/** Probabilité que la tentative détruise l'objet, en visant `niveauVise` (= niveau actuel + 1). */
export function risqueDeCasse(niveauVise: number): number {
  if (niveauVise <= NIVEAU_SUR) return 0
  return CASSE[niveauVise] ?? CASSE_PLATEAU
}

// « Le coût dépend de la pureté de l'objet. » La pureté, ici, c'est la RARETÉ : c'est la seule
// propriété que le joueur lit sur la fiche, et celle qui dit déjà ce que l'objet vaut à ses yeux.
// L'écart est franc (×1 à ×6) parce qu'un barème mou ne se remarque pas : si améliorer un légendaire
// coûtait 20 % de plus qu'un commun, personne ne s'en apercevrait et la règle n'existerait pas.
const PURETE: Record<Rarity, number> = { commun: 1, rare: 2, epique: 3.5, legendaire: 6 }

export function pureteDe(itemId: string): number {
  return PURETE[ITEMS[itemId]?.rarity ?? 'commun']
}

export interface CoutAmelioration { gold: number; materials: Record<string, number> }

/**
 * Coût pour passer de `niveau` à `niveau + 1`, sur un objet de cette rareté.
 *
 * ⚠️ LA MARCHE EST BEAUCOUP PLUS RAIDE QU'À LA RÉFORGE, et c'est demandé : « ça coûte un peu cher ».
 * L'ancien barème (60 + 40×niveau) mettait le +3 à 180 pièces, une broutille passé le premier biome.
 * Ici le coût double presque à chaque cran, et la pureté le multiplie : amener un légendaire à +3
 * demande un vrai effort, ce qui est exactement la condition pour que le risque d'après ait du poids.
 */
export function coutAmelioration(niveau: number, purete: number): CoutAmelioration {
  const base = 120 * Math.pow(1.8, niveau)
  return {
    gold: Math.round(base * purete),
    materials: {
      'minerai-fer': Math.ceil((2 + niveau * 1.5) * Math.min(purete, 3)),
      'gemme-brute': niveau >= NIVEAU_SUR ? Math.ceil((niveau - NIVEAU_SUR + 1) * purete) : 0,
    },
  }
}

/** Le coût, matériaux à quantité nulle retirés (une ligne « 0 gemme » ne veut rien dire). */
export function coutLisible(niveau: number, purete: number): CoutAmelioration {
  const c = coutAmelioration(niveau, purete)
  return { gold: c.gold, materials: Object.fromEntries(Object.entries(c.materials).filter(([, n]) => n > 0)) }
}

export function niveauDe(p: PlayerState, itemId: string): number {
  return p.upgrades[itemId] ?? 0
}

/** Ce qui empêche d'améliorer cet objet, ou null si la tentative est possible. */
export function blocageAmelioration(p: PlayerState, itemId: string): string | null {
  if (!ITEMS[itemId]) return 'Objet inconnu.'
  const niveau = niveauDe(p, itemId)
  if (niveau >= NIVEAU_MAX) return `Déjà au maximum (+${NIVEAU_MAX}).`
  const cout = coutLisible(niveau, pureteDe(itemId))
  if (p.gold < cout.gold) return `Il manque ${cout.gold - p.gold} or.`
  for (const [mat, qte] of Object.entries(cout.materials)) {
    const dispo = p.materials[mat] ?? 0
    if (dispo < qte) return `Il manque ${qte - dispo} × ${mat}.`
  }
  return null
}

export function peutAmeliorer(p: PlayerState, itemId: string): boolean {
  return blocageAmelioration(p, itemId) === null
}

export type Issue = 'monte' | 'casse'

export interface ResultatAmelioration {
  issue: Issue
  niveau: number // le niveau APRÈS la tentative (inchangé si l'objet a cassé — il n'existe plus)
  risque: number // celui qui a été couru, pour que l'écran puisse le rappeler
}

/**
 * Tente l'amélioration : débite le coût, puis monte d'un cran ou DÉTRUIT l'objet.
 *
 * ⚠️ LE COÛT EST DÉBITÉ DANS LES DEUX CAS, et c'est le cœur du pari : une tentative ratée qui
 * rembourserait ne serait pas un risque, juste une attente. Renvoie null sans rien muter si la
 * tentative n'était pas possible — l'appelant n'a pas à vérifier deux fois.
 *
 * ⚠️ ET LA DESTRUCTION RETIRE L'OBJET PARTOUT : inventaire ET emplacement équipé. Ne nettoyer que
 * l'inventaire laisserait un objet fantôme porté par le panda, avec ses bonus, invendable et
 * inaméliorable — un état que rien dans le jeu ne sait plus défaire.
 */
export function tenterAmelioration(p: PlayerState, itemId: string, rng: () => number = Math.random): ResultatAmelioration | null {
  if (!peutAmeliorer(p, itemId)) return null
  const niveau = niveauDe(p, itemId)
  const cout = coutLisible(niveau, pureteDe(itemId))
  p.gold -= cout.gold
  for (const [mat, qte] of Object.entries(cout.materials)) p.materials[mat] = (p.materials[mat] ?? 0) - qte

  const risque = risqueDeCasse(niveau + 1)
  if (rng() < risque) {
    const i = p.inventory.indexOf(itemId)
    if (i >= 0) p.inventory.splice(i, 1)
    for (const [slot, porte] of Object.entries(p.equipment)) {
      if (porte === itemId) (p.equipment as Record<string, string | null>)[slot] = null
    }
    delete p.upgrades[itemId]
    return { issue: 'casse', niveau, risque }
  }
  p.upgrades[itemId] = niveau + 1
  return { issue: 'monte', niveau: niveau + 1, risque }
}
