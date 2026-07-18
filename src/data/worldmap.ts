export interface MapNode {
  id: string
  name: string
  x: number // position sur l'écran carte (960×540)
  y: number
  levelId?: string
  type: 'town' | 'level' | 'boss'
}

export const START_NODE = 'prontera'

// Disposition en arborescence façon carte au trésor : trois rangées en serpentin
// (rangée 1 gauche→droite, rangée 2 droite→gauche, rangée 3 gauche→droite), chaque
// zone s'ouvrant en deux branches qui se rejoignent (plaine/orée, dunes/cave, jungle/plage,
// montagne/carrière) avant de repartir en tronc commun vers la zone suivante.
// Chaque rangée a un tronc central (y≈112 / 282 / 452) ; les branches d'un embranchement
// s'écartent au-dessus (≈-42) et au-dessous (≈+43) du tronc pour ne jamais se chevaucher,
// nœuds comme étiquettes (voir espacements ≥90px horizontal / ≥55px vertical).
export const WORLD_NODES: MapNode[] = [
  // Zone 1 — plaine & forêt (rangée du haut, gauche → droite)
  { id: 'prontera', name: 'Prontera', x: 60, y: 112, type: 'town' },
  { id: 'plaine-1', name: 'Prairie', x: 178, y: 112, levelId: 'zone1-1', type: 'level' },
  { id: 'plaine-2', name: 'Champs', x: 300, y: 70, levelId: 'zone1-2', type: 'level' },
  { id: 'foret-1', name: 'Orée', x: 300, y: 155, levelId: 'zone1-3', type: 'level' },
  { id: 'foret-2', name: 'Forêt', x: 422, y: 112, levelId: 'zone1-4', type: 'level' },
  { id: 'boss-1', name: 'Antre du Roi', x: 545, y: 112, levelId: 'zone1-boss', type: 'boss' },
  { id: 'morroc', name: 'Morroc', x: 690, y: 130, type: 'town' },
  // Zone 2 — désert & cave (rangée du milieu, droite → gauche)
  { id: 'desert-1', name: 'Dunes', x: 778, y: 240, levelId: 'zone2-1', type: 'level' },
  { id: 'cave-a', name: 'Cave', x: 778, y: 325, levelId: 'cave-1', type: 'level' },
  { id: 'desert-2', name: 'Oasis', x: 655, y: 240, levelId: 'zone2-2', type: 'level' },
  { id: 'desert-3', name: 'Tombeaux', x: 655, y: 325, levelId: 'zone2-3', type: 'level' },
  { id: 'boss-2', name: 'Pyramide', x: 525, y: 282, levelId: 'zone2-boss', type: 'boss' },
  // Zone 3 — jungle (+ route alternative plage), toujours rangée du milieu
  { id: 'jungle-1', name: 'Lisière', x: 398, y: 282, levelId: 'zone3-1', type: 'level' },
  { id: 'jungle-2', name: 'Marécages', x: 185, y: 240, levelId: 'zone3-2', type: 'level' },
  { id: 'boss-jungle', name: 'Cœur de la Jungle', x: 72, y: 288, levelId: 'zone3-boss', type: 'boss' },
  { id: 'plage-1', name: 'Rivage', x: 300, y: 324, levelId: 'plage-1', type: 'level' },
  { id: 'plage-2', name: 'Récif', x: 185, y: 324, levelId: 'plage-2', type: 'level' },
  // Zone 4 — montagne (+ route alternative carrière), rangée du bas, gauche → droite
  { id: 'montagne-1', name: 'Cimes', x: 105, y: 452, levelId: 'zone4-1', type: 'level' },
  { id: 'montagne-2', name: 'Col glacé', x: 375, y: 452, levelId: 'zone4-2', type: 'level' },
  { id: 'boss-montagne', name: 'Pic du Golem', x: 490, y: 452, levelId: 'zone4-boss', type: 'boss' },
  { id: 'carriere-1', name: 'Carrière', x: 195, y: 410, levelId: 'carriere-1', type: 'level' },
  { id: 'carriere-2', name: 'Fosse', x: 300, y: 410, levelId: 'carriere-2', type: 'level' },
  // Zone 5 — cimetière, tronc commun rangée du bas
  { id: 'cimetiere-1', name: 'Nécropole', x: 600, y: 452, levelId: 'zone5-1', type: 'level' },
  { id: 'cimetiere-2', name: 'Cryptes', x: 705, y: 452, levelId: 'zone5-2', type: 'level' },
  { id: 'boss-cimetiere', name: 'Trône du Roi Liche', x: 810, y: 452, levelId: 'zone5-boss', type: 'boss' },
  // Zone 6 — enfer (zone finale, remontée dans le coin droit)
  { id: 'enfer-1', name: 'Sentier des Damnés', x: 880, y: 375, levelId: 'zone6-1', type: 'level' },
  { id: 'boss-enfer', name: 'Antre du Seigneur Déchu', x: 905, y: 270, levelId: 'zone6-boss', type: 'boss' },
]

export const WORLD_EDGES: [string, string][] = [
  ['prontera', 'plaine-1'],
  ['plaine-1', 'plaine-2'],
  ['plaine-1', 'foret-1'],
  ['plaine-2', 'foret-2'],
  ['foret-1', 'foret-2'],
  ['foret-2', 'boss-1'],
  ['boss-1', 'morroc'],
  ['morroc', 'desert-1'],
  ['morroc', 'cave-a'],
  ['desert-1', 'desert-2'],
  ['cave-a', 'desert-3'],
  ['desert-2', 'boss-2'],
  ['desert-3', 'boss-2'],
  ['boss-2', 'jungle-1'],
  ['jungle-1', 'jungle-2'],
  ['jungle-2', 'boss-jungle'],
  ['jungle-1', 'plage-1'],
  ['plage-1', 'plage-2'],
  ['plage-2', 'jungle-2'],
  ['boss-jungle', 'montagne-1'],
  ['montagne-1', 'montagne-2'],
  ['montagne-2', 'boss-montagne'],
  ['montagne-1', 'carriere-1'],
  ['carriere-1', 'carriere-2'],
  ['carriere-2', 'montagne-2'],
  ['boss-montagne', 'cimetiere-1'],
  ['cimetiere-1', 'cimetiere-2'],
  ['cimetiere-2', 'boss-cimetiere'],
  ['boss-cimetiere', 'enfer-1'],
  ['enfer-1', 'boss-enfer'],
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
  // atteignable si un voisin est « clearé » ET lui-même débloqué (parcours depuis le départ)
  const visited = new Set<string>([START_NODE])
  const queue = [START_NODE]
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
