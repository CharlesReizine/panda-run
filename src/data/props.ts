import type { DropEntry } from '../core/types'

export interface PropDef { id: string; name: string; hp: number; drops: DropEntry[] }

const list: PropDef[] = [
  {
    id: 'herbe', name: "Touffe d'herbe", hp: 1,
    drops: [
      { kind: 'gold', chance: 1, min: 1, max: 3 },
      { kind: 'material', materialId: 'herbe-tendre', chance: 0.25, min: 1, max: 1 },
      { kind: 'material', materialId: 'trefle-chance', chance: 0.04, min: 1, max: 1 },
    ],
  },
  {
    id: 'champignon', name: 'Champignon', hp: 1,
    drops: [
      { kind: 'gold', chance: 1, min: 1, max: 3 },
      { kind: 'material', materialId: 'chapeau-champi', chance: 0.25, min: 1, max: 1 },
      { kind: 'material', materialId: 'spore-lumineuse', chance: 0.04, min: 1, max: 1 },
    ],
  },
  {
    id: 'roche', name: 'Roche', hp: 3,
    drops: [
      { kind: 'gold', chance: 1, min: 2, max: 6 },
      { kind: 'material', materialId: 'minerai-fer', chance: 0.35, min: 1, max: 1 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 },
    ],
  },
  {
    id: 'coffre', name: 'Coffre', hp: 1,
    drops: [
      { kind: 'gold', chance: 1, min: 25, max: 60 },
      { kind: 'potion', chance: 0.6, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.05, min: 1, max: 1 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 },
    ],
  },
]

export const PROPS: Record<string, PropDef> = Object.fromEntries(list.map((p) => [p.id, p]))
