export interface MapNode {
  id: string
  name: string
  x: number // position sur l'écran carte (960×540)
  y: number
  levelId?: string
  type: 'town' | 'level' | 'boss'
}

export const START_NODE = 'prontera'

export const WORLD_NODES: MapNode[] = [
  { id: 'prontera', name: 'Prontera', x: 80, y: 270, type: 'town' },
  { id: 'plaine-1', name: 'Prairie', x: 190, y: 210, levelId: 'zone1-1', type: 'level' },
  { id: 'plaine-2', name: 'Champs', x: 300, y: 170, levelId: 'zone1-2', type: 'level' },
  { id: 'foret-1', name: 'Orée', x: 300, y: 330, levelId: 'zone1-3', type: 'level' },
  { id: 'foret-2', name: 'Forêt', x: 410, y: 290, levelId: 'zone1-4', type: 'level' },
  { id: 'boss-1', name: 'Antre du Roi', x: 500, y: 230, levelId: 'zone1-boss', type: 'boss' },
  { id: 'morroc', name: 'Morroc', x: 590, y: 300, type: 'town' },
  { id: 'desert-1', name: 'Dunes', x: 680, y: 230, levelId: 'zone2-1', type: 'level' },
  { id: 'desert-2', name: 'Oasis', x: 770, y: 180, levelId: 'zone2-2', type: 'level' },
  { id: 'desert-3', name: 'Tombeaux', x: 800, y: 320, levelId: 'zone2-3', type: 'level' },
  { id: 'cave-a', name: 'Cave', x: 690, y: 380, levelId: 'cave-1', type: 'level' },
  { id: 'boss-2', name: 'Pyramide', x: 880, y: 250, levelId: 'zone2-boss', type: 'boss' },
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
