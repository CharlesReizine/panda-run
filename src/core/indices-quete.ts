import type { QuestDef } from '../data/shops'
import { MONSTERS } from '../data/monsters'
import { MATERIALS } from '../data/materials'
import { LEVELS } from '../data/levels'
import { WORLD_NODES } from '../data/worldmap'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// OÙ TROUVER CE QU'UNE QUÊTE DEMANDE
//
// Demande du joueur : « dans les quêtes tu peux mettre un petit "i" sur chaque quête, et on peut voir
// dans quelles maps on peut trouver les mobs ou autres indices. Ça peut être vachement plus sympa pour
// l'utilisateur. »
//
// ⚠️ L'INFORMATION EXISTE DÉJÀ, ELLE N'EST NULLE PART. Un joueur à qui l'on demande quinze Gloopy doit
// aujourd'hui les CHERCHER : rien, dans le jeu, ne dit où ils vivent. Il reparcourt donc des terrains
// au hasard — et comme la carte est longue, il finit par jouer à autre chose. Le croisement
// « monstre → terrains qui le posent » se calcule pourtant en deux boucles sur des données qu'on a sous
// la main depuis toujours.
//
// ⚠️ ET ON NOMME LES TERRAINS COMME LA CARTE LES NOMME. `levels.ts` connaît « jungle-5 », la carte
// affiche « Marais ». Un indice qui répondrait « jungle-5 » ferait chercher sur la carte un nom qui n'y
// figure pas — l'indice serait un second problème plutôt qu'une aide.

/** Nom affiché d'un terrain sur la carte du monde (« Marais »), ou son id à défaut. */
export function nomDeTerrain(levelId: string): string {
  return WORLD_NODES.find((n) => n.levelId === levelId)?.name ?? LEVELS[levelId]?.name ?? levelId
}

/** L'ordre de la carte, pour citer les terrains du plus proche au plus lointain. */
const RANG = new Map(WORLD_NODES.filter((n) => n.levelId).map((n, i) => [n.levelId!, i]))

/** Les terrains où ce monstre apparaît, dans l'ordre de la carte. */
export function terrainsDuMonstre(monsterId: string): string[] {
  const ids = Object.values(LEVELS)
    .filter((l) => l.spawns.some((s) => s.monsterId === monsterId) || l.boss === monsterId)
    .map((l) => l.id)
  return ids.sort((a, b) => (RANG.get(a) ?? 999) - (RANG.get(b) ?? 999))
}

/**
 * Les terrains où récolter ce matériau, du plus généreux au moins généreux.
 *
 * ⚠️ ON CLASSE PAR CHANCE DE BUTIN, PAS PAR PROXIMITÉ. Un matériau qui tombe à 2 % sur le terrain
 * d'à côté et à 40 % trois cartes plus loin s'y farme trois fois plus vite malgré le trajet : citer le
 * plus proche d'abord enverrait le joueur au mauvais endroit avec la bénédiction du jeu.
 */
export function terrainsDuMateriau(materialId: string): { levelId: string; chance: number }[] {
  const parTerrain = new Map<string, number>()
  for (const l of Object.values(LEVELS)) {
    let best = 0
    const idsPresents = new Set(l.spawns.map((s) => s.monsterId))
    if (l.boss) idsPresents.add(l.boss)
    for (const id of idsPresents) {
      for (const d of MONSTERS[id]?.drops ?? []) {
        if (d.kind === 'material' && d.materialId === materialId) best = Math.max(best, d.chance)
      }
    }
    if (best > 0) parTerrain.set(l.id, best)
  }
  return [...parTerrain.entries()]
    .map(([levelId, chance]) => ({ levelId, chance }))
    .sort((a, b) => b.chance - a.chance || (RANG.get(a.levelId) ?? 999) - (RANG.get(b.levelId) ?? 999))
}

export interface IndiceQuete {
  /** Une phrase qui dit QUOI chercher. */
  quoi: string
  /** Les terrains à visiter, déjà nommés comme sur la carte. Vide = on ne sait pas dire. */
  ou: string[]
  /** Une ligne de conseil, ou undefined quand il n'y a rien d'utile à ajouter. */
  astuce?: string
}

/** Combien de terrains on cite au plus : au-delà, la liste cesse d'être un indice. */
export const MAX_TERRAINS_CITES = 4

/**
 * L'indice affiché derrière le « i » d'une quête.
 *
 * ⚠️ « PARTOUT » EST UNE RÉPONSE, ET C'EN EST UNE BONNE. Les quêtes `kill-any` n'ont pas de cible : leur
 * indice n'est pas une liste vide (qui se lirait comme un bug) mais la phrase qui dit exactement ce
 * qu'il faut savoir — n'importe quel monstre compte, joue le terrain que tu veux.
 */
export function indiceDe(def: QuestDef): IndiceQuete {
  if (def.type === 'kill-any') {
    return {
      quoi: `${def.targetCount} monstres, quels qu'ils soient`,
      ou: [],
      astuce: 'Tout monstre compte, sur n\'importe quel terrain.',
    }
  }

  if (def.type === 'fetch' && def.targetId) {
    const mat = MATERIALS[def.targetId]
    const sources = terrainsDuMateriau(def.targetId)
    return {
      quoi: `${def.targetCount} × ${mat?.name ?? def.targetId}`,
      ou: sources.slice(0, MAX_TERRAINS_CITES).map((s) => `${nomDeTerrain(s.levelId)} (${Math.round(s.chance * 100)} %)`),
      astuce: sources.length === 0
        ? 'Aucune source connue — signale-le, c\'est un défaut de données.'
        : sources.length > MAX_TERRAINS_CITES
          ? `Et ${sources.length - MAX_TERRAINS_CITES} autres terrains, moins généreux.`
          : undefined,
    }
  }

  // kill-type et kill-boss : une cible nommée, des terrains qui la posent
  const mob = def.targetId ? MONSTERS[def.targetId] : undefined
  const terrains = def.targetId ? terrainsDuMonstre(def.targetId) : []
  return {
    quoi: mob ? `${def.targetCount} × ${mob.name} (niveau ${mob.level})` : `${def.targetCount} cibles`,
    ou: terrains.slice(0, MAX_TERRAINS_CITES).map(nomDeTerrain),
    astuce: terrains.length === 0
      ? 'Introuvable sur la carte actuelle — signale-le, c\'est un défaut de données.'
      : def.type === 'kill-boss'
        ? 'Un boss : il n\'apparaît qu\'une fois par traversée du terrain.'
        : terrains.length > MAX_TERRAINS_CITES
          ? `Et ${terrains.length - MAX_TERRAINS_CITES} autres terrains.`
          : undefined,
  }
}
