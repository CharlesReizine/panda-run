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
  { id: 'chapeau-poring', name: 'Chapeau Poring', slot: 'hat', bonus: { maxHp: 5 } },
  { id: 'ailes-angeling', name: "Ailes d'Angeling", slot: 'hat', bonus: { maxHp: 15 } },
  { id: 'couronne-royale', name: 'Couronne royale', slot: 'hat', bonus: { atk: 4, def: 4 } },
  { id: 'bonnet-champi', name: 'Bonnet champignon', slot: 'hat', bonus: { def: 3 } },
  { id: 'casque-orc', name: 'Casque orc', slot: 'hat', bonus: { def: 6 } },
  // équipements forgés (craft en ville) — distincts de ceux des boutiques, meilleurs bonus
  { id: 'epee-fer-forgee', name: 'Épée en fer forgé', slot: 'weapon', bonus: { atk: 12 } },
  { id: 'lame-scorpion', name: 'Lame du scorpion', slot: 'weapon', bonus: { atk: 17 } },
  { id: 'baton-lumineux', name: 'Bâton lumineux', slot: 'weapon', bonus: { atk: 11, maxHp: 20 } },
  { id: 'plastron-fer', name: 'Plastron de fer', slot: 'armor', bonus: { def: 8, maxHp: 25 } },
  { id: 'armure-carapace', name: 'Armure de carapace', slot: 'armor', bonus: { def: 13, maxHp: 55 } },
  { id: 'amulette-gemme', name: 'Amulette de gemme', slot: 'accessory', bonus: { atk: 8, maxHp: 40 } },
  { id: 'talisman-trefle', name: 'Talisman du trèfle', slot: 'accessory', bonus: { maxHp: 60 } },
  { id: 'casque-croc', name: 'Casque à crocs', slot: 'hat', bonus: { def: 5, atk: 4 } },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]))
