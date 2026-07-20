import type { EquipSlot, ItemDef, Rarity } from '../core/types'

// Ordre d'affichage fixe des types d'équipement (boutiques + inventaire) : chapeau → armure →
// arme → accessoire. Libellés pluriels pour les en-têtes de section.
export const SLOT_ORDER: EquipSlot[] = ['hat', 'armor', 'weapon', 'accessory']
export const SLOT_LABEL_PLURAL: Record<EquipSlot, string> = {
  hat: 'Chapeaux',
  armor: 'Armures',
  weapon: 'Armes',
  accessory: 'Accessoires',
}
export const SLOT_RANK: Record<EquipSlot, number> = { hat: 0, armor: 1, weapon: 2, accessory: 3 }

const list: ItemDef[] = [
  { id: 'epee-bambou', name: 'Épée en bambou', slot: 'weapon', bonus: { atk: 5 }, rarity: 'commun' },
  { id: 'baton-feuillu', name: 'Bâton feuillu', slot: 'weapon', bonus: { atk: 7 }, rarity: 'commun' },
  { id: 'arc-souple', name: 'Arc souple', slot: 'weapon', bonus: { atk: 6 }, rarity: 'commun' },
  { id: 'griffe-royale', name: 'Griffe royale', slot: 'weapon', bonus: { atk: 14 }, rarity: 'epique' },
  { id: 'plastron-feuilles', name: 'Plastron de feuilles', slot: 'armor', bonus: { def: 4, maxHp: 20 }, rarity: 'commun' },
  { id: 'carapace-scarabee', name: 'Carapace de scarabée', slot: 'armor', bonus: { def: 9, maxHp: 40 }, rarity: 'rare' },
  { id: 'grelot-porte-bonheur', name: 'Grelot porte-bonheur', slot: 'accessory', bonus: { maxHp: 30 }, rarity: 'rare' },
  { id: 'amulette-pharaon', name: 'Amulette du pharaon', slot: 'accessory', bonus: { atk: 6, maxHp: 25 }, rarity: 'epique' },
  { id: 'ruban', name: 'Ruban', slot: 'hat', bonus: { maxHp: 3 }, rarity: 'commun' },
  { id: 'sakkat', name: 'Sakkat', slot: 'hat', bonus: { maxHp: 8 }, rarity: 'commun' },
  { id: 'chapeau-poring', name: 'Chapeau Poring', slot: 'hat', bonus: { maxHp: 5 }, rarity: 'commun' },
  { id: 'ailes-angeling', name: "Ailes d'Angeling", slot: 'hat', bonus: { maxHp: 15 }, rarity: 'rare' },
  { id: 'couronne-royale', name: 'Couronne royale', slot: 'hat', bonus: { atk: 4, def: 4 }, rarity: 'epique' },
  { id: 'bonnet-champi', name: 'Bonnet champignon', slot: 'hat', bonus: { def: 3 }, rarity: 'commun' },
  { id: 'casque-orc', name: 'Casque orc', slot: 'hat', bonus: { def: 6 }, rarity: 'rare' },
  // équipements forgés (craft en ville) — distincts de ceux des boutiques, meilleurs bonus
  { id: 'epee-fer-forgee', name: 'Épée en fer forgé', slot: 'weapon', bonus: { atk: 12 }, rarity: 'epique' },
  { id: 'lame-scorpion', name: 'Lame du scorpion', slot: 'weapon', bonus: { atk: 17 }, rarity: 'legendaire' },
  { id: 'baton-lumineux', name: 'Bâton lumineux', slot: 'weapon', bonus: { atk: 11, maxHp: 20 }, rarity: 'epique' },
  { id: 'plastron-fer', name: 'Plastron de fer', slot: 'armor', bonus: { def: 8, maxHp: 25 }, rarity: 'epique' },
  { id: 'armure-carapace', name: 'Armure de carapace', slot: 'armor', bonus: { def: 13, maxHp: 55 }, rarity: 'legendaire' },
  { id: 'amulette-gemme', name: 'Amulette de gemme', slot: 'accessory', bonus: { atk: 8, maxHp: 40 }, rarity: 'epique' },
  { id: 'talisman-trefle', name: 'Talisman du trèfle', slot: 'accessory', bonus: { maxHp: 60 }, rarity: 'legendaire' },
  { id: 'casque-croc', name: 'Casque à crocs', slot: 'hat', bonus: { def: 5, atk: 4 }, rarity: 'epique' },
  { id: 'corne-kaho', name: 'Corne de Lord Kaho', slot: 'hat', bonus: { atk: 6, def: 6 }, rarity: 'legendaire' },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]))

// Couleur d'affichage par rareté (0xRRGGBB). 'commun' par défaut si la rareté est absente.
const RARITY_COLORS: Record<Rarity, number> = {
  commun: 0xb0bec5,
  rare: 0x42a5f5,
  epique: 0xba68c8,
  legendaire: 0xffb300,
}

export function rarityColor(rarity: Rarity = 'commun'): number {
  return RARITY_COLORS[rarity]
}
