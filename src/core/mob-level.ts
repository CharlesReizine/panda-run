import { xpToNext } from './progression'
import { MONSTERS } from '../data/monsters'
import { LEVELS } from '../data/levels'
import type { LevelDef } from '../data/levels'
import { WORLD_NODES, WORLD_EDGES, START_NODE } from '../data/worldmap'
import type { MonsterDef } from './types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CALIBRAGE DU NIVEAU DES MONSTRES — modèle « distance sur la carte » (Dijkstra).
//
// Le niveau d'un terrain = sa DISTANCE sur la carte du monde depuis le tout premier terrain
// (Prairie), les villes comptant pour 0 (Dijkstra, arêtes = 1 par terrain traversé). La carte étant
// un ARBRE, deux terrains adjacents diffèrent TOUJOURS d'exactement 1 (invariant voulu). Le niveau
// d'un MONSTRE dérive du terrain où il apparaît le plus TÔT (rang mini) :
//
//     niveau = 2 × rang − 1   (+ bonus élite / boss / gardien)
//
// Le ×2 donne de la VARIANCE (les mobs recyclés d'un terrain antérieur se logent aux niveaux
// intermédiaires). L'XP réellement gagnée par le joueur est dérivée du niveau (progression.ts) et
// calée pour que « clear un terrain ≈ un palier » (cf. tests/core/xp-economy). Le champ
// `MonsterDef.xp` est désormais VESTIGIAL (plus aucun rôle dans la calibration).

// COURBE DE NIVEAU CONVEXE (retour user : « le début est trop dur, les nouveaux craquent »). Au lieu
// d'une droite (2×rang−1) qui montait vite dès la plaine, on utilise une PUISSANCE rang^LEVEL_P : départ
// TOUT DOUX (plaine ≈ niv 1-7) puis accélération progressive vers l'endgame (~niv 56 au dernier rang).
export const LEVEL_K = 0.6
export const LEVEL_P = 1.35
export function baseLevelForRank(rank: number): number {
  return Math.max(1, Math.round(LEVEL_K * Math.pow(rank, LEVEL_P)))
}
export const ELITE_LEVEL_BONUS = 2   // mvp (élite rare)
export const BOSS_LEVEL_BONUS = 4    // boss de map
export const GARDIEN_LEVEL_BONUS = 8 // gardien : obstacle de très haut niveau posté en barrage
// Les variantes de gabarit sont de VRAIES bêtes différentes, pas juste ±1 : un géant est nettement
// plus fort (+5 niveaux, une ÉNORME masse), un mini nettement plus faible (−5). Ça élargit la
// variance bien au-delà de la base impaire (2×rang−1). NB : si un géant à +5 détonne trop sur un
// terrain (gros pic), on ne le POSE simplement pas là (choix de level design, pas de calibration).
export const GRAND_LEVEL_BONUS = 5
export const PETIT_LEVEL_MALUS = 5

// Un gardien = obstacle immobile de très haut niveau (id préfixé « gardien- »).
const isGardien = (id: string): boolean => id.startsWith('gardien-')

// ── RANG DES TERRAINS : distance Dijkstra depuis Prairie (villes en poids 0) ──────────────────────
function computeTerrainRanks(): Record<string, number> {
  const byNode: Record<string, (typeof WORLD_NODES)[number]> = {}
  for (const n of WORLD_NODES) byNode[n.id] = n
  const adj: Record<string, string[]> = {}
  for (const [a, b] of WORLD_EDGES) { (adj[a] ??= []).push(b); (adj[b] ??= []).push(a) }
  const dist: Record<string, number> = {}
  for (const n of WORLD_NODES) dist[n.id] = Infinity
  dist[START_NODE] = 0
  const pq: [number, string][] = [[0, START_NODE]]
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()!
    if (d > dist[u]!) continue
    for (const v of adj[u] || []) {
      const w = byNode[v]?.type === 'town' ? 0 : 1 // les villes ne comptent pas comme un « pas » de niveau
      if (d + w < dist[v]!) { dist[v] = d + w; pq.push([dist[v]!, v]) }
    }
  }
  // niveau de terrain = dist + 1 (Prairie, dist 0 → rang 1). Terrains ET arènes de boss ont un nœud.
  const rank: Record<string, number> = {}
  for (const n of WORLD_NODES) if (n.levelId && dist[n.id] !== Infinity) rank[n.levelId] = dist[n.id]! + 1
  return rank
}

// Rang (= niveau de terrain) de chaque niveau, indexé par son id (levelId).
export const TERRAIN_RANK: Record<string, number> = computeTerrainRanks()

// Rang du terrain où un monstre apparaît le plus TÔT (min sur tous les terrains qui le contiennent).
function computeFirstRanks(): Record<string, number> {
  const first: Record<string, number> = {}
  for (const lv of Object.values(LEVELS)) {
    const r = TERRAIN_RANK[lv.id]
    if (r === undefined) continue
    for (const s of lv.spawns) first[s.monsterId] = Math.min(first[s.monsterId] ?? Infinity, r)
    if (lv.boss) first[lv.boss] = Math.min(first[lv.boss] ?? Infinity, r)
  }
  return first
}
const FIRST_RANK: Record<string, number> = computeFirstRanks()

// ── ORDRE DE PROGRESSION = ordre Dijkstra (rang croissant) ────────────────────────────────────────
// (et non plus l'ordre d'insertion du tableau `LEVELS`). Départage à rang égal par l'ordre du tableau
// pour rester déterministe.
const INSERT_INDEX: Record<string, number> = {}
Object.values(LEVELS).forEach((l, i) => { INSERT_INDEX[l.id] = i })
export const LEVEL_ORDER: LevelDef[] = Object.values(LEVELS).slice().sort((a, b) => {
  const ra = TERRAIN_RANK[a.id] ?? 999, rb = TERRAIN_RANK[b.id] ?? 999
  return ra - rb || (INSERT_INDEX[a.id]! - INSERT_INDEX[b.id]!)
})

// Niveau atteint en partant du niveau 1 avec `totalXp`, en consommant xpToNext palier par palier.
export function playerLevelForXp(totalXp: number): number {
  let level = 1
  let remaining = Math.max(0, totalXp)
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level += 1
  }
  return level
}

// ── NIVEAU CALIBRÉ DE CHAQUE MONSTRE ──────────────────────────────────────────────────────────────
export function computeMonsterLevels(): Record<string, number> {
  const result: Record<string, number> = {}
  for (const m of Object.values(MONSTERS)) {
    const r = FIRST_RANK[m.id]
    if (r === undefined) { result[m.id] = 1; continue }
    let level = baseLevelForRank(r)
    if (isGardien(m.id)) level += GARDIEN_LEVEL_BONUS
    else if (m.boss) level += BOSS_LEVEL_BONUS
    else if (m.mvp) level += ELITE_LEVEL_BONUS
    else if (m.size === 'grand') level += GRAND_LEVEL_BONUS
    else if (m.size === 'petit') level = Math.max(1, level - PETIT_LEVEL_MALUS)
    result[m.id] = level
  }
  return result
}
