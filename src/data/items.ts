import type { ItemDef } from '../core/types'

const list: ItemDef[] = [
  { id: 'epee-bambou', name: 'Épée en bambou', slot: 'weapon', bonus: { atk: 5 } },
  { id: 'baton-feuillu', name: 'Bâton feuillu', slot: 'weapon', bonus: { atk: 7 } },
  { id: 'arc-souple', name: 'Arc souple', slot: 'weapon', bonus: { atk: 6 } },
  { id: 'griffe-royale', name: 'Griffe royale', slot: 'weapon', bonus: { atk: 14 } },
  { id: 'plastron-feuilles', name: 'Plastron de feuilles', slot: 'armor', bonus: { def: 4, maxHp: 20 } },
  { id: 'carapace-scarabee', name: 'Carapace de scarabée', slot: 'armor', bonus: { def: 9, maxHp: 40 } },
  { id: 'grelot-porte-bonheur', name: 'Grelot porte-bonheur', slot: 'accessory', bonus: { maxHp: 30 } },
  { id: 'amulette-pharaon', name: 'Amulette du pharaon', slot: 'accessory', bonus: { atk: 6, maxHp: 25 } },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]))
