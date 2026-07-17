import type { PlayerState } from './player-state'
import { POTION_PRICE } from '../data/shops'

// Achète une potion contre de l'or ; renvoie false (sans effet) si l'or est insuffisant.
export function buyPotion(p: PlayerState): boolean {
  if (p.gold < POTION_PRICE) return false
  p.gold -= POTION_PRICE
  p.potions += 1
  return true
}

// Achète un objet (arme/armure/accessoire) contre de l'or ; ajouté à l'inventaire non équipé.
export function buyItem(p: PlayerState, itemId: string, price: number): boolean {
  if (p.gold < price) return false
  p.gold -= price
  p.inventory.push(itemId)
  return true
}
