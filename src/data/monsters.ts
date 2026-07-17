import type { MonsterDef } from '../core/types'

const goldSmall = { kind: 'gold', chance: 1, min: 2, max: 6 } as const
const goldMid = { kind: 'gold', chance: 1, min: 5, max: 12 } as const
const potion = { kind: 'potion', chance: 0.15, min: 1, max: 1 } as const

const list: MonsterDef[] = [
  // Zone 1 — plaine / forêt
  { id: 'gloopy', name: 'Gloopy', color: 0xff9ecb, hp: 30, atk: 6, def: 0, xp: 25, speed: 40, behavior: 'contact', drops: [goldSmall, potion] },
  { id: 'mandragore', name: 'Mandragore', color: 0x7bc86c, hp: 45, atk: 9, def: 2, xp: 40, speed: 0, behavior: 'projectile', drops: [goldSmall, potion] },
  { id: 'louveteau', name: 'Louveteau', color: 0x9a9a9a, hp: 55, atk: 12, def: 2, xp: 55, speed: 90, behavior: 'charge', drops: [goldMid, potion] },
  // Zone 2 — désert
  { id: 'scorpion', name: 'Scorpion', color: 0xd98e32, hp: 80, atk: 16, def: 5, xp: 90, speed: 60, behavior: 'contact', drops: [goldMid, potion] },
  { id: 'momie', name: 'Momie', color: 0xd8cfae, hp: 120, atk: 20, def: 7, xp: 130, speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.05, min: 1, max: 1 }] },
  { id: 'vautour', name: 'Vautour', color: 0x8a6f5c, hp: 70, atk: 18, def: 3, xp: 100, speed: 110, behavior: 'charge', drops: [goldMid, potion] },
  // Route alternative — cave
  { id: 'squelette', name: 'Squelette', color: 0xe8e8e8, hp: 100, atk: 19, def: 6, xp: 120, speed: 50, behavior: 'contact', drops: [goldMid, potion] },
  { id: 'chauve-souris', name: 'Chauve-souris', color: 0x6b4f9e, hp: 50, atk: 14, def: 1, xp: 80, speed: 120, behavior: 'charge', drops: [goldMid, potion] },
  // Boss
  {
    id: 'roi-gloopy', name: 'Roi Gloopy', color: 0xff5fa8, hp: 500, atk: 22, def: 5, xp: 600, speed: 55, behavior: 'charge', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 60, max: 100 },
      { kind: 'item', itemId: 'epee-bambou', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  {
    id: 'pharaon-scarabee', name: 'Pharaon Scarabée', color: 0x3fb7b0, hp: 1100, atk: 34, def: 10, xp: 1500, speed: 70, behavior: 'projectile', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 150, max: 250 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
]

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]))
