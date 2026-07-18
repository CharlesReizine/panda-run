import type { MonsterDef } from '../core/types'

const goldSmall = { kind: 'gold', chance: 1, min: 2, max: 6 } as const
const goldMid = { kind: 'gold', chance: 1, min: 5, max: 12 } as const
const potion = { kind: 'potion', chance: 0.25, min: 1, max: 1 } as const
const goldGardien = { kind: 'gold', chance: 1, min: 1, max: 3 } as const

const list: MonsterDef[] = [
  // Zone 1 — plaine / forêt
  { id: 'gloopy', name: 'Gloopy', color: 0xff9ecb, hp: 30, atk: 6, def: 0, xp: 220, speed: 40, behavior: 'contact', drops: [goldSmall, potion] },
  { id: 'angeling', name: 'Angeling', color: 0xffffff, hp: 32, atk: 5, def: 1, xp: 260, speed: 30, behavior: 'contact', drops: [goldSmall, potion, { kind: 'material', materialId: 'trefle-chance', chance: 0.03, min: 1, max: 1 }] },
  { id: 'fabre', name: 'Fabre', color: 0x8bc34a, hp: 38, atk: 7, def: 3, xp: 260, speed: 15, behavior: 'contact', drops: [goldSmall, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.08, min: 1, max: 1 }] },
  { id: 'mandragore', name: 'Mandragore', color: 0x7bc86c, hp: 45, atk: 9, def: 2, xp: 380, speed: 0, behavior: 'projectile', drops: [goldSmall, potion] },
  { id: 'lunatic', name: 'Lunatic', color: 0xff8fc0, hp: 50, atk: 11, def: 1, xp: 500, speed: 110, behavior: 'charge', drops: [goldMid, potion] },
  { id: 'poporing', name: 'Poporing', color: 0x2e7d32, hp: 60, atk: 14, def: 4, xp: 560, speed: 20, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'louveteau', name: 'Louveteau', color: 0x9a9a9a, hp: 55, atk: 12, def: 2, xp: 520, speed: 90, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  { id: 'rocker', name: 'Rocker', color: 0x558b2f, hp: 70, atk: 17, def: 5, xp: 640, speed: 40, behavior: 'projectile', drops: [goldMid, potion] },
  { id: 'willow', name: 'Willow', color: 0x6d4c41, hp: 95, atk: 15, def: 10, xp: 620, speed: 8, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'chapeau-champi', chance: 0.05, min: 1, max: 1 }] },
  // Zone 2 — désert
  { id: 'scorpion', name: 'Scorpion', color: 0xd98e32, hp: 100, atk: 70, def: 15, xp: 650, speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] },
  { id: 'orc-guerrier', name: 'Orc guerrier', color: 0x4a7c3f, hp: 145, atk: 90, def: 20, xp: 1050, speed: 50, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] },
  { id: 'momie', name: 'Momie', color: 0xd8cfae, hp: 150, atk: 60, def: 18, xp: 950, speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.05, min: 1, max: 1 }] },
  { id: 'vautour', name: 'Vautour', color: 0x8a6f5c, hp: 90, atk: 80, def: 10, xp: 750, speed: 110, behavior: 'charge', drops: [goldMid, potion, { kind: 'item', itemId: 'arc-souple', chance: 0.05, min: 1, max: 1 }] },
  { id: 'zombie', name: 'Zombie', color: 0x6b8e63, hp: 165, atk: 58, def: 16, xp: 900, speed: 22, behavior: 'contact', drops: [goldMid, potion] },
  {
    id: 'mini-baphomet', name: 'Mini Baphomet', color: 0x6a1b4d, hp: 240, atk: 100, def: 24, xp: 1500, speed: 80, behavior: 'charge',
    drops: [{ kind: 'gold', chance: 1, min: 20, max: 40 }, { kind: 'potion', chance: 0.4, min: 1, max: 1 }, { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 }],
  },
  // Route alternative — cave
  { id: 'squelette', name: 'Squelette', color: 0xe8e8e8, hp: 130, atk: 65, def: 16, xp: 900, speed: 50, behavior: 'contact', drops: [goldMid, potion] },
  { id: 'chauve-souris', name: 'Chauve-souris', color: 0x6b4f9e, hp: 70, atk: 85, def: 8, xp: 600, speed: 120, behavior: 'charge', drops: [goldMid, potion] },
  { id: 'fantome', name: 'Fantôme', color: 0xb2ebf2, hp: 80, atk: 60, def: 22, xp: 700, speed: 35, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.04, min: 1, max: 1 }] },
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
  // Zone 3 — jungle
  { id: 'flora-vorace', name: 'Flora vorace', color: 0xb0245e, hp: 190, atk: 95, def: 20, xp: 1450, speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'frelon-geant', name: 'Frelon géant', color: 0xf9a825, hp: 160, atk: 110, def: 12, xp: 1400, speed: 130, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'singe-grimpeur', name: 'Singe grimpeur', color: 0x795548, hp: 210, atk: 100, def: 18, xp: 1500, speed: 90, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.06, min: 1, max: 1 }] },
  // Route alternative — plage
  { id: 'crabe-geant', name: 'Crabe géant', color: 0xe64a19, hp: 230, atk: 90, def: 30, xp: 1400, speed: 40, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  { id: 'meduse', name: 'Méduse', color: 0xba68c8, hp: 150, atk: 100, def: 10, xp: 1350, speed: 25, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  // Zone 4 — montagne
  { id: 'harpie', name: 'Harpie', color: 0x8d6e63, hp: 260, atk: 130, def: 20, xp: 2200, speed: 140, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  { id: 'yeti', name: 'Yéti', color: 0xeceff1, hp: 380, atk: 140, def: 35, xp: 2600, speed: 45, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.04, min: 1, max: 1 }] },
  // Route alternative — carrière
  { id: 'golem-de-pierre', name: 'Golem de pierre', color: 0x8a8078, hp: 340, atk: 120, def: 40, xp: 2400, speed: 25, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.08, min: 1, max: 1 }, { kind: 'item', itemId: 'carapace-scarabee', chance: 0.03, min: 1, max: 1 }] },
  { id: 'gobelin-mineur', name: 'Gobelin mineur', color: 0x6d8a3f, hp: 220, atk: 110, def: 18, xp: 2000, speed: 60, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] },
  // Zone 5 — cimetière
  { id: 'goule', name: 'Goule', color: 0x556b2f, hp: 420, atk: 160, def: 30, xp: 3200, speed: 70, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.03, min: 1, max: 1 }] },
  { id: 'banshee', name: 'Banshee', color: 0x9575cd, hp: 320, atk: 180, def: 20, xp: 3000, speed: 50, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  // Zone 6 — enfer
  { id: 'diablotin', name: 'Diablotin', color: 0xd84315, hp: 480, atk: 190, def: 35, xp: 4200, speed: 150, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] },
  { id: 'gargouille', name: 'Gargouille', color: 0x546e7a, hp: 620, atk: 200, def: 55, xp: 4800, speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'arc-souple', chance: 0.03, min: 1, max: 1 }] },
  // Gardiens — obstacles immobiles, pièges vivants postés sur le chemin au sol : contact quasi
  // fatal (atk énorme), increvables en pratique (hp/def énormes), pas faits pour être combattus
  { id: 'gardien-sylve', name: 'Gardien Sylve', color: 0x4e342e, hp: 5000, atk: 999, def: 80, xp: 50, speed: 0, behavior: 'contact', drops: [goldGardien] },
  { id: 'gardien-pierre', name: 'Gardien Pierre', color: 0x707070, hp: 5500, atk: 999, def: 90, xp: 55, speed: 0, behavior: 'contact', drops: [goldGardien] },
  { id: 'gardien-flamme', name: 'Gardien Flamme', color: 0xbf360c, hp: 6000, atk: 999, def: 70, xp: 60, speed: 0, behavior: 'contact', drops: [goldGardien] },
  // Boss — zone 3 (jungle)
  {
    id: 'seigneur-liane', name: 'Seigneur Liane', color: 0x1b5e20, hp: 4200, atk: 65, def: 30, xp: 9000, speed: 40, behavior: 'charge', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 200, max: 320 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'plastron-feuilles', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss — zone 4 (montagne)
  {
    id: 'golem-ancien', name: 'Golem Ancien', color: 0x78909c, hp: 6500, atk: 90, def: 45, xp: 13000, speed: 30, behavior: 'contact', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 280, max: 420 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.4, min: 1, max: 1 },
    ],
  },
  // Boss — zone 5 (cimetière)
  {
    id: 'roi-liche', name: 'Roi Liche', color: 0x4527a0, hp: 9000, atk: 130, def: 40, xp: 18000, speed: 40, behavior: 'projectile', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 350, max: 520 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss final — zone 6 (enfer)
  {
    id: 'seigneur-dechu', name: 'Seigneur Déchu', color: 0x8a1414, hp: 14000, atk: 190, def: 55, xp: 30000, speed: 70, behavior: 'charge', boss: true,
    drops: [
      { kind: 'gold', chance: 1, min: 500, max: 800 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 1, min: 1, max: 1 },
    ],
  },
]

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]))
