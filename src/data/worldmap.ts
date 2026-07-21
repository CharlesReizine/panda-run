export interface MapNode {
  id: string
  name: string
  x: number // position sur l'écran carte (960×540)
  y: number
  levelId?: string
  type: 'town' | 'level' | 'boss'
  theme?: 'europeen' | 'marocain' // thème visuel de la ville (pilote TownScene) ; absent = terrain
}

// on démarre sur le premier terrain de plaine (Prairie, en haut-gauche), pas à Prontera :
// le tronc plaine-1 → … → plaine-5 → prontera reste le parcours pour atteindre la ville juste après.
export const START_NODE = 'plaine-1'

// NOUVEAU MONDE — carte A (docs/worldmap-spec.md). Repère 960×540. Un sentier principal serpente
// depuis la plaine de Prontera jusqu'aux enfers, en s'ouvrant régulièrement en branches (forêt, désert,
// jungle/cave, montagne/cimetière, plage/carrière) qui débouchent chacune sur un boss de biome.
export const WORLD_NODES: MapNode[] = [
  // plaine (avant Prontera)
  { id: 'plaine-1', name: 'Prairie', x: 40, y: 68, levelId: 'plaine-1', type: 'level' },
  { id: 'plaine-2', name: 'Champs', x: 93, y: 90, levelId: 'plaine-2', type: 'level' },
  { id: 'plaine-3', name: 'Vallon', x: 147, y: 68, levelId: 'plaine-3', type: 'level' },
  { id: 'plaine-4', name: 'Pré fleuri', x: 200, y: 90, levelId: 'plaine-4', type: 'level' },
  { id: 'plaine-5', name: 'Colline', x: 227, y: 68, levelId: 'plaine-5', type: 'level' },
  { id: 'prontera', name: 'Prontera', x: 307, y: 79, type: 'town', theme: 'europeen' },
  { id: 'plaine-6', name: 'Bocage', x: 333, y: 124, levelId: 'plaine-6', type: 'level' },
  // forêt (branche + tronc)
  { id: 'foret-1', name: 'Orée', x: 440, y: 101, levelId: 'foret-1', type: 'level' },
  { id: 'plaine-7', name: 'Clairière', x: 520, y: 124, levelId: 'plaine-7', type: 'level' },
  { id: 'foret-2', name: 'Sylve', x: 573, y: 124, levelId: 'foret-2', type: 'level' },
  { id: 'foret-3', name: 'Taillis', x: 600, y: 101, levelId: 'foret-3', type: 'level' },
  { id: 'foret-4', name: 'Sous-bois', x: 653, y: 79, levelId: 'foret-4', type: 'level' },
  { id: 'foret-5', name: 'Ronces', x: 707, y: 79, levelId: 'foret-5', type: 'level' },
  { id: 'foret-6', name: 'Halliers', x: 760, y: 101, levelId: 'foret-6', type: 'level' },
  { id: 'boss-01', name: 'Gardien Sylve', x: 707, y: 124, levelId: 'boss-01', type: 'boss' },
  { id: 'foret-7', name: 'Lisière', x: 547, y: 169, levelId: 'foret-7', type: 'level' },
  // désert (tronc central + branches)
  { id: 'desert-1', name: 'Piste', x: 547, y: 191, levelId: 'desert-1', type: 'level' },
  { id: 'desert-2', name: 'Dunes', x: 520, y: 236, levelId: 'desert-2', type: 'level' },
  { id: 'desert-3', name: 'Erg', x: 467, y: 236, levelId: 'desert-3', type: 'level' },
  { id: 'morocc', name: 'Morocc', x: 387, y: 259, type: 'town', theme: 'marocain' },
  { id: 'desert-4', name: 'Oasis', x: 307, y: 281, levelId: 'desert-4', type: 'level' },
  { id: 'desert-5', name: 'Ravin', x: 253, y: 259, levelId: 'desert-5', type: 'level' },
  { id: 'desert-6', name: 'Gorge', x: 200, y: 259, levelId: 'desert-6', type: 'level' },
  { id: 'boss-02', name: 'Pharaon', x: 147, y: 281, levelId: 'boss-02', type: 'boss' },
  { id: 'desert-7', name: 'Sables', x: 360, y: 304, levelId: 'desert-7', type: 'level' },
  { id: 'jungle-1', name: 'Palmeraie', x: 440, y: 326, levelId: 'jungle-1', type: 'level' },
  { id: 'desert-8', name: 'Carrefour', x: 493, y: 348, levelId: 'desert-8', type: 'level' },
  { id: 'cave-1', name: 'Caverne', x: 493, y: 304, levelId: 'cave-1', type: 'level' },
  { id: 'boss-03', name: 'Golem Cave', x: 520, y: 281, levelId: 'boss-03', type: 'boss' },
  // jungle (branche est)
  { id: 'jungle-2', name: 'Jungle', x: 573, y: 304, levelId: 'jungle-2', type: 'level' },
  { id: 'jungle-3', name: 'Canopée', x: 627, y: 281, levelId: 'jungle-3', type: 'level' },
  { id: 'jungle-4', name: 'Fourré', x: 707, y: 281, levelId: 'jungle-4', type: 'level' },
  { id: 'jungle-5', name: 'Marais', x: 760, y: 304, levelId: 'jungle-5', type: 'level' },
  { id: 'boss-04', name: 'Cœur Jungle', x: 840, y: 304, levelId: 'boss-04', type: 'boss' },
  // montagne / cimetière (branches sud)
  { id: 'desert-9', name: 'Col sec', x: 493, y: 371, levelId: 'desert-9', type: 'level' },
  { id: 'montagne-1', name: 'Cimes', x: 467, y: 416, levelId: 'montagne-1', type: 'level' },
  { id: 'montagne-2', name: 'Crête', x: 413, y: 394, levelId: 'montagne-2', type: 'level' },
  { id: 'montagne-3', name: 'Névé', x: 360, y: 394, levelId: 'montagne-3', type: 'level' },
  { id: 'boss-05', name: 'Yeti Géant', x: 333, y: 371, levelId: 'boss-05', type: 'boss' },
  { id: 'cimetiere-1', name: 'Tombes', x: 520, y: 394, levelId: 'cimetiere-1', type: 'level' },
  { id: 'cimetiere-2', name: 'Ossuaire', x: 547, y: 416, levelId: 'cimetiere-2', type: 'level' },
  { id: 'boss-06', name: 'Roi Liche', x: 627, y: 394, levelId: 'boss-06', type: 'boss' },
  // plage / carrière (branches sud-ouest)
  { id: 'desert-10', name: 'Fourche', x: 467, y: 452, levelId: 'desert-10', type: 'level' },
  { id: 'plage-1', name: 'Rivage', x: 360, y: 461, levelId: 'plage-1', type: 'level' },
  { id: 'plage-2', name: 'Lagon', x: 307, y: 484, levelId: 'plage-2', type: 'level' },
  { id: 'plage-3', name: 'Récif', x: 307, y: 439, levelId: 'plage-3', type: 'level' },
  { id: 'plage-4', name: 'Corail', x: 253, y: 394, levelId: 'plage-4', type: 'level' },
  { id: 'epave-1', name: 'Épave', x: 200, y: 352, levelId: 'epave-1', type: 'level' },
  { id: 'boss-07', name: 'Roi Crabe', x: 200, y: 394, levelId: 'boss-07', type: 'boss' },
  { id: 'carriere-1', name: 'Carrière', x: 493, y: 484, levelId: 'carriere-1', type: 'level' },
  { id: 'boss-08', name: 'Golem Ancien', x: 547, y: 484, levelId: 'boss-08', type: 'boss' },
  // enfer (zone finale, remontée dans le coin sud-est)
  { id: 'desert-11', name: 'Braise', x: 547, y: 461, levelId: 'desert-11', type: 'level' },
  { id: 'enfer-1', name: 'Sentier', x: 627, y: 461, levelId: 'enfer-1', type: 'level' },
  { id: 'enfer-2', name: 'Cendres', x: 680, y: 439, levelId: 'enfer-2', type: 'level' },
  { id: 'enfer-3', name: 'Fournaise', x: 733, y: 439, levelId: 'enfer-3', type: 'level' },
  { id: 'enfer-4', name: 'Coulée', x: 787, y: 484, levelId: 'enfer-4', type: 'level' },
  { id: 'enfer-5', name: 'Brasier', x: 840, y: 484, levelId: 'enfer-5', type: 'level' },
  { id: 'enfer-6', name: 'Abîme', x: 893, y: 461, levelId: 'enfer-6', type: 'level' },
  { id: 'enfer-7', name: 'Géhenne', x: 893, y: 416, levelId: 'enfer-7', type: 'level' },
  { id: 'boss-09', name: 'Seigneur Déchu', x: 867, y: 394, levelId: 'boss-09', type: 'boss' },
]

export const WORLD_EDGES: [string, string][] = [
  // tronc principal
  ['plaine-1', 'plaine-2'], ['plaine-2', 'plaine-3'], ['plaine-3', 'plaine-4'], ['plaine-4', 'plaine-5'],
  ['plaine-5', 'prontera'], ['prontera', 'plaine-6'], ['plaine-6', 'foret-1'], ['foret-1', 'plaine-7'],
  ['plaine-7', 'foret-7'], ['foret-7', 'desert-1'], ['desert-1', 'desert-2'], ['desert-2', 'desert-3'],
  ['desert-3', 'morocc'], ['morocc', 'desert-4'], ['desert-4', 'desert-7'], ['desert-7', 'jungle-1'],
  ['jungle-1', 'desert-8'], ['desert-8', 'desert-9'], ['montagne-1', 'desert-10'], ['desert-10', 'desert-11'],
  ['desert-11', 'enfer-1'], ['enfer-1', 'enfer-2'], ['enfer-2', 'enfer-3'], ['enfer-3', 'enfer-4'],
  ['enfer-4', 'enfer-5'], ['enfer-5', 'enfer-6'], ['enfer-6', 'enfer-7'], ['enfer-7', 'boss-09'],
  // branche forêt → boss-01
  ['plaine-7', 'foret-2'], ['foret-2', 'foret-3'], ['foret-3', 'foret-4'], ['foret-4', 'foret-5'],
  ['foret-5', 'foret-6'], ['foret-6', 'boss-01'],
  // branche désert-ouest → boss-02
  ['desert-4', 'desert-5'], ['desert-5', 'desert-6'], ['desert-6', 'boss-02'],
  // branche cave → boss-03
  ['desert-8', 'cave-1'], ['cave-1', 'boss-03'],
  // branche jungle → boss-04
  ['desert-8', 'jungle-2'], ['jungle-2', 'jungle-3'], ['jungle-3', 'jungle-4'], ['jungle-4', 'jungle-5'],
  ['jungle-5', 'boss-04'],
  // branche montagne → boss-05
  ['desert-9', 'montagne-1'], ['montagne-1', 'montagne-2'], ['montagne-2', 'montagne-3'], ['montagne-3', 'boss-05'],
  // branche cimetière → boss-06
  ['desert-9', 'cimetiere-1'], ['cimetiere-1', 'cimetiere-2'], ['cimetiere-2', 'boss-06'],
  // branche plage → boss-07
  ['desert-10', 'plage-1'], ['plage-1', 'plage-2'], ['plage-2', 'plage-3'], ['plage-3', 'plage-4'],
  ['plage-4', 'boss-07'],
  // branche sous-marine ÉPAVE (à gauche de Corail) — niveau entièrement immergé
  ['plage-4', 'epave-1'],
  // branche carrière → boss-08
  ['desert-10', 'carriere-1'], ['carriere-1', 'boss-08'],
]

const nodeById = new Map(WORLD_NODES.map((n) => [n.id, n]))

export function neighborsOf(nodeId: string): string[] {
  const out: string[] = []
  for (const [a, b] of WORLD_EDGES) {
    if (a === nodeId) out.push(b)
    if (b === nodeId) out.push(a)
  }
  return out
}

function isNodeCleared(nodeId: string, completedLevels: string[]): boolean {
  const n = nodeById.get(nodeId)
  if (!n) return false
  if (!n.levelId) return true // une ville est « acquise » dès qu'elle est atteignable…
  return completedLevels.includes(n.levelId)
}

export function isNodeUnlocked(nodeId: string, completedLevels: string[]): boolean {
  if (nodeId === START_NODE) return true
  // GATING de progression : on n'avance au-delà d'un nœud que s'il est « clearé » — y COMPRIS le
  // nœud de DÉPART. Tant que le premier terrain (Prairie) n'est pas complété, rien derrière lui
  // n'est atteignable : un niveau non fini bloque le terrain suivant (on peut le rejouer, pas le
  // contourner). Les villes/branches déjà faites restent traversables (isNodeCleared vrai).
  const visited = new Set<string>([START_NODE])
  const queue: string[] = []
  if (isNodeCleared(START_NODE, completedLevels)) queue.push(START_NODE)
  while (queue.length) {
    const cur = queue.shift()!
    for (const nb of neighborsOf(cur)) {
      if (visited.has(nb)) continue
      visited.add(nb)
      if (nb === nodeId) return true
      // on ne traverse un nœud que s'il est clearé (ville atteinte ou niveau complété)
      if (isNodeCleared(nb, completedLevels)) queue.push(nb)
    }
  }
  return false
}
