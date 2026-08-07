// Journal de quêtes — géométrie et TEXTES calculés PUREMENT (aucune dépendance Phaser), partagés
// entre `QuestLogScene` et son test de non-débordement.
//
// Retour du joueur : « il faut pouvoir suivre les quêtes en cours et tous les objectifs je pense »,
// après « pour le statut des quêtes il faut afficher la ville où je dois aller chercher la
// récompense ». Le bandeau du HUD ne montre qu'UNE quête — celle de la chaîne en cours — et rien ne
// disait ce qui restait à faire, ni ce qui avait déjà été rendu.
//
// ⚠️ L'OBJECTIF EST RÉÉCRIT, PAS RECOPIÉ. `QuestDef.description` est une phrase de PNJ (« Les Gloopy
// pullulent dans la plaine. Écrase-en 15 pour rassurer les villageois. ») : parfaite dans la bouche du
// garde, illisible dans une liste qu'on parcourt des yeux. Le journal affiche donc une ligne d'ACTION
// dérivée du type et de la cible — « Tuer 15 Gloopy » — et laisse la prose au dialogue.
//
// POURQUOI UNE GÉOMÉTRIE PURE : même raison qu'ailleurs (cf. bestiary-layout). Le user a exigé un test
// qui garantisse que rien ne déborde ; ce n'est calculable sans rendu que si la disposition vit ici.

import type { PlayerState } from '../core/player-state'
import type { QuestDef } from '../data/shops'
import { QUEST_CHAIN } from '../data/shops'
import { MONSTERS } from '../data/monsters'
import { MATERIALS } from '../data/materials'
import { ITEMS } from '../data/items'
import { charsPerLine, textWidth } from './text-metrics'

/** Zone utile du journal, dans l'espace de conception (0→960 × 0→540). */
export const JOURNAL = {
  left: 28,
  right: 932,
  top: 92,
  /** Rien ne descend sous cette ligne : la rangée de boutons commence là. */
  bottom: 486,
  /** hauteur d'une ligne de quête (titre + objectif + récompense) */
  rowH: 46,
  /** interligne entre deux quêtes */
  gap: 6,
  /** colonne où commence la jauge de progression, mesurée depuis la droite */
  gaugeW: 150,
  /** rayon du « i » cliquable, à gauche du titre de chaque quête */
  rayonInfo: 11,
  /** décalage du « i » depuis le bord gauche de la ligne */
  infoDx: 18,
}

// ⚠️ LE « i » MANGE DE LA LARGEUR DE TITRE, ET L'OUBLIER LE FERAIT DÉBORDER. Le titre commençait au
// bord de la ligne ; il commence maintenant après la pastille. Toute la géométrie de texte du journal
// se mesure donc depuis `titreLeft()`, jamais depuis `JOURNAL.left` — c'est la seule façon que le test
// de non-débordement reste vrai après l'ajout.
export const titreLeft = (): number => JOURNAL.left + JOURNAL.infoDx + JOURNAL.rayonInfo + 8

/** Centre du « i » de la ligne i, dans l'espace de conception. */
export const infoCentre = (i: number): { x: number; y: number } =>
  ({ x: JOURNAL.left + JOURNAL.infoDx, y: yLigne(i) + JOURNAL.rowH / 2 })

export const FONT = { titre: 16, detail: 12, jauge: 12 }

/**
 * État d'une quête du point de vue du joueur.
 *
 * ⚠️ « à-prendre » N'EST PAS « en-cours ». La chaîne du garde se débloque maillon par maillon : une
 * quête non encore acceptée doit se lire comme un objectif FUTUR, pas comme un objectif en retard.
 * Les confondre donnait un journal où tout semblait commencé et rien ne semblait avancer.
 */
export type EtatQuete = 'a-prendre' | 'en-cours' | 'a-rendre' | 'finie'

export interface LigneQuete {
  id: string
  ordre: number
  nom: string
  etat: EtatQuete
  /** ligne d'action, dérivée du type de quête (« Tuer 15 Gloopy ») */
  objectif: string
  /** « 7/15 », ou vide quand la quête n'est pas commencée */
  compteur: string
  /** avancement dans [0,1] — sert à la jauge */
  ratio: number
  /** ce que la quête rapporte, en une ligne */
  recompense: string
  /** où aller la rendre (ville la plus proche), seulement quand elle est à rendre */
  ou?: string
}

/** Nom lisible de la cible d'une quête, quel que soit son type. */
function nomCible(def: QuestDef): string {
  if (!def.targetId) return 'monstres'
  return MONSTERS[def.targetId]?.name ?? MATERIALS[def.targetId]?.name ?? def.targetId
}

/** Ligne d'ACTION : ce qu'il faut faire, en télégraphique. */
export function objectifDe(def: QuestDef): string {
  switch (def.type) {
    case 'kill-any': return `Vaincre ${def.targetCount} monstres, au choix`
    case 'kill-type': return `Vaincre ${def.targetCount} ${nomCible(def)}`
    case 'kill-boss': return `Terrasser ${nomCible(def)}`
    case 'fetch': return `Rapporter ${def.targetCount} ${nomCible(def)}`
  }
}

/** Ce que la quête rapporte, en une ligne. L'objet porte l'essentiel de la valeur, il passe en tête. */
export function recompenseDe(def: QuestDef): string {
  const bouts: string[] = []
  if (def.rewardItemId) bouts.push(ITEMS[def.rewardItemId]?.name ?? def.rewardItemId)
  bouts.push(`${def.rewardGold} or`)
  if (def.rewardPotions) bouts.push(`${def.rewardPotions} potion${def.rewardPotions > 1 ? 's' : ''}`)
  return bouts.join(' · ')
}

/**
 * Les lignes du journal, dans l'ordre de la chaîne.
 *
 * `ville` est le nom de la ville où rendre les quêtes terminées (cf. worldmap.villeLaPlusProche) ;
 * absente, la ligne se contente de dire que la récompense attend.
 */
export function lignesJournal(p: PlayerState, ville?: string | null): LigneQuete[] {
  return [...QUEST_CHAIN].sort((a, b) => a.order - b.order).map((def) => {
    const q = p.quests[def.id]
    const etat: EtatQuete = !q ? 'a-prendre' : q.claimed ? 'finie' : q.done ? 'a-rendre' : 'en-cours'
    // ⚠️ LE COMPTEUR EST BORNÉ À LA CIBLE. `QuestState.progress` peut la dépasser (on continue de
    // tuer après avoir fini) : afficher « 23/15 » ferait douter que la quête soit bien terminée.
    const fait = etat === 'finie' || etat === 'a-rendre' ? def.targetCount : Math.min(q?.progress ?? 0, def.targetCount)
    return {
      id: def.id,
      ordre: def.order,
      nom: def.name,
      etat,
      objectif: objectifDe(def),
      compteur: etat === 'a-prendre' ? '' : `${fait}/${def.targetCount}`,
      ratio: def.targetCount > 0 ? fait / def.targetCount : 0,
      recompense: recompenseDe(def),
      ...(etat === 'a-rendre' && ville ? { ou: `à rendre à ${ville}` } : {}),
    }
  })
}

/** Nombre de lignes qui tiennent dans la zone utile — au-delà, on pagine. */
export function lignesParPage(): number {
  return Math.max(1, Math.floor((JOURNAL.bottom - JOURNAL.top) / (JOURNAL.rowH + JOURNAL.gap)))
}

/** Ordonnée du haut de la i-ème ligne affichée sur la page. */
export function yLigne(i: number): number {
  return JOURNAL.top + i * (JOURNAL.rowH + JOURNAL.gap)
}

/** Largeur disponible pour les textes d'une ligne (le reste est pris par la jauge). */
export function largeurTexte(): number {
  // mesurée depuis `titreLeft()` : la pastille « i » occupe désormais le début de la ligne
  return JOURNAL.right - titreLeft() - JOURNAL.gaugeW - 16
}

/** Découpe un texte pour qu'il tienne sur une ligne de la largeur donnée, en coupant proprement. */
export function tronquer(texte: string, largeur: number, font: number): string {
  const max = charsPerLine(largeur, font)
  if (texte.length <= max) return texte
  return texte.slice(0, Math.max(1, max - 1)) + '…'
}

/** Vrai si ce texte tient dans la largeur donnée — c'est ce que le test vérifie ligne par ligne. */
export function tientDans(texte: string, largeur: number, font: number): boolean {
  return textWidth(texte, font) <= largeur
}
