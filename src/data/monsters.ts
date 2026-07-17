import type { MonsterDef } from '../core/types'

const goldSmall = { kind: 'gold', chance: 1, min: 2, max: 6 } as const
const goldMid = { kind: 'gold', chance: 1, min: 5, max: 12 } as const
const potion = { kind: 'potion', chance: 0.25, min: 1, max: 1 } as const

const list: MonsterDef[] = [
  // Zone 1 — plaine / forêt
  { id: 'gloopy', name: 'Gloopy', color: 0xff9ecb, hp: 30, atk: 6, def: 0, xp: 220, speed: 40, behavior: 'contact', drops: [goldSmall, potion] },
  { id: 'mandragore', name: 'Mandragore', color: 0x7bc86c, hp: 45, atk: 9, def: 2, xp: 380, speed: 0, behavior: 'projectile', drops: [goldSmall, potion] },
  { id: 'louveteau', name: 'Louveteau', color: 0x9a9a9a, hp: 55, atk: 12, def: 2, xp: 520, speed: 90, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  // Zone 2 — désert
  { id: 'scorpion', name: 'Scorpion', color: 0xd98e32, hp: 100, atk: 70, def: 15, xp: 650, speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] },
  { id: 'momie', name: 'Momie', color: 0xd8cfae, hp: 150, atk: 60, def: 18, xp: 950, speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.05, min: 1, max: 1 }] },
  { id: 'vautour', name: 'Vautour', color: 0x8a6f5c, hp: 90, atk: 80, def: 10, xp: 750, speed: 110, behavior: 'charge', drops: [goldMid, potion, { kind: 'item', itemId: 'arc-souple', chance: 0.05, min: 1, max: 1 }] },
  // Route alternative — cave
  { id: 'squelette', name: 'Squelette', color: 0xe8e8e8, hp: 130, atk: 65, def: 16, xp: 900, speed: 50, behavior: 'contact', drops: [goldMid, potion] },
  { id: 'chauve-souris', name: 'Chauve-souris', color: 0x6b4f9e, hp: 70, atk: 85, def: 8, xp: 600, speed: 120, behavior: 'charge', drops: [goldMid, potion] },
  // Boss
  {
    id: 'roi-gloopy', name: 'Roi Gloopy', color: 0xff5fa8, hp: 380, atk: 18, def: 5, xp: 3200, speed: 55, behavior: 'charge', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 60, max: 100 },
      { kind: 'item', itemId: 'epee-bambou', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'arc-souple', chance: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'pharaon-scarabee', name: 'Pharaon Scarabée', color: 0x3fb7b0, hp: 2600, atk: 48, def: 20, xp: 6000, speed: 70, behavior: 'projectile', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 150, max: 250 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
]

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]))
