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
export const WORLD_NODES: MapNode[] = [
  // Zone 1 — plaine & forêt (rangée du haut, gauche → droite)
  { id: 'prontera', name: 'Prontera', x: 60, y: 145, type: 'town' },
  { id: 'plaine-1', name: 'Prairie', x: 195, y: 115, levelId: 'zone1-1', type: 'level' },
  { id: 'plaine-2', name: 'Champs', x: 330, y: 75, levelId: 'zone1-2', type: 'level' },
  { id: 'foret-1', name: 'Orée', x: 330, y: 190, levelId: 'zone1-3', type: 'level' },
  { id: 'foret-2', name: 'Forêt', x: 460, y: 135, levelId: 'zone1-4', type: 'level' },
  { id: 'boss-1', name: 'Antre du Roi', x: 595, y: 110, levelId: 'zone1-boss', type: 'boss' },
  { id: 'morroc', name: 'Morroc', x: 740, y: 150, type: 'town' },
  // Zone 2 — désert & cave (rangée du milieu, droite → gauche)
  { id: 'desert-1', name: 'Dunes', x: 790, y: 210, levelId: 'zone2-1', type: 'level' },
  { id: 'cave-a', name: 'Cave', x: 790, y: 340, levelId: 'cave-1', type: 'level' },
  { id: 'desert-2', name: 'Oasis', x: 650, y: 195, levelId: 'zone2-2', type: 'level' },
  { id: 'desert-3', name: 'Tombeaux', x: 650, y: 350, levelId: 'zone2-3', type: 'level' },
  { id: 'boss-2', name: 'Pyramide', x: 520, y: 270, levelId: 'zone2-boss', type: 'boss' },
  // Zone 3 — jungle (+ route alternative plage), toujours rangée du milieu
  { id: 'jungle-1', name: 'Lisière', x: 390, y: 250, levelId: 'zone3-1', type: 'level' },
  { id: 'jungle-2', name: 'Marécages', x: 260, y: 270, levelId: 'zone3-2', type: 'level' },
  { id: 'boss-jungle', name: 'Cœur de la Jungle', x: 140, y: 250, levelId: 'zone3-boss', type: 'boss' },
  { id: 'plage-1', name: 'Rivage', x: 350, y: 380, levelId: 'plage-1', type: 'level' },
  { id: 'plage-2', name: 'Récif', x: 280, y: 390, levelId: 'plage-2', type: 'level' },
  // Zone 4 — montagne (+ route alternative carrière), rangée du bas, gauche → droite
  { id: 'montagne-1', name: 'Cimes', x: 150, y: 430, levelId: 'zone4-1', type: 'level' },
  { id: 'montagne-2', name: 'Col glacé', x: 274, y: 415, levelId: 'zone4-2', type: 'level' },
  { id: 'boss-montagne', name: 'Pic du Golem', x: 379, y: 395, levelId: 'zone4-boss', type: 'boss' },
  { id: 'carriere-1', name: 'Carrière', x: 210, y: 360, levelId: 'carriere-1', type: 'level' },
  { id: 'carriere-2', name: 'Fosse', x: 270, y: 350, levelId: 'carriere-2', type: 'level' },
  // Zone 5 — cimetière, tronc commun rangée du bas
  { id: 'cimetiere-1', name: 'Nécropole', x: 483, y: 425, levelId: 'zone5-1', type: 'level' },
  { id: 'cimetiere-2', name: 'Cryptes', x: 587, y: 400, levelId: 'zone5-2', type: 'level' },
  { id: 'boss-cimetiere', name: 'Trône du Roi Liche', x: 691, y: 430, levelId: 'zone5-boss', type: 'boss' },
  // Zone 6 — enfer (zone finale)
  { id: 'enfer-1', name: 'Sentier des Damnés', x: 750, y: 405, levelId: 'zone6-1', type: 'level' },
  { id: 'boss-enfer', name: 'Antre du Seigneur Déchu', x: 862, y: 425, levelId: 'zone6-boss', type: 'boss' },
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
