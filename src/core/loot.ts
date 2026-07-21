import type { DropEntry, Rarity } from './types'
import { ITEMS } from '../data/items'

export interface DropResult { gold: number; potions: number; items: string[]; materials: string[] }

// Loot rare de coffre : probabilité (très basse) qu'un coffre lâche, en bonus, un équipement
// épique ou légendaire — un événement marquant, réutilisant la révélation brillante existante.
export const CHEST_RARE_CHANCE = 0.04
const CHEST_RARE_RARITIES: Rarity[] = ['epique', 'legendaire']
// Pool des équipements (arme/armure/chapeau/accessoire) épiques ou légendaires éligibles.
export const CHEST_RARE_POOL: string[] = Object.values(ITEMS)
  .filter((i) => i.slot && CHEST_RARE_RARITIES.includes(i.rarity ?? 'commun'))
  .map((i) => i.id)

// Tirage bonus d'un coffre : renvoie l'id d'un objet épique/légendaire tiré au hasard, ou null
// (cas courant). Ne remplace pas le butin habituel, il s'y ajoute.
export function rollChestRareItem(rng: () => number = Math.random): string | null {
  if (rng() >= CHEST_RARE_CHANCE || CHEST_RARE_POOL.length === 0) return null
  return CHEST_RARE_POOL[Math.floor(rng() * CHEST_RARE_POOL.length)] ?? null
}

export function rollDrops(drops: DropEntry[], rng: () => number = Math.random): DropResult {
  const result: DropResult = { gold: 0, potions: 0, items: [], materials: [] }
  for (const d of drops) {
    if (rng() >= d.chance) continue
    const qty = d.min + Math.floor(rng() * (d.max - d.min + 1))
    if (d.kind === 'gold') result.gold += qty
    else if (d.kind === 'potion') result.potions += qty
    else if (d.itemId) result.items.push(d.itemId)
    else if (d.kind === 'material' && d.materialId) {
      for (let i = 0; i < qty; i++) result.materials.push(d.materialId)
    }
  }
  return result
}
