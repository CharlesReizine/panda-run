import type { PlayerState } from './player-state'
import type { ItemDef, StatBlock } from './types'
import { ITEMS } from '../data/items'
import { sellPrice } from '../data/shops'

// Réforge : améliore une pièce d'équipement d'un cran. Chaque niveau majore le bonus de base
// de l'objet de +20 % (voir upgradedBonus, appliqué dans computeStats). Coût croissant en or +
// matériaux communs. Vente : revend un objet de l'inventaire contre de l'or selon sa rareté.

export const MAX_REFORGE_LEVEL = 10

type Bonus = Partial<Pick<StatBlock, 'atk' | 'def' | 'maxHp'>>

// Bonus majoré selon le niveau de réforge : chaque niveau ajoute +20 % du bonus de base,
// arrondi. Ex. { atk: 5 } au niveau 3 → 5 * (1 + 0.2*3) = 8. Niveau plafonné à MAX_REFORGE_LEVEL.
export function upgradedBonus(baseBonus: Bonus, level: number): Bonus {
  const lv = Math.max(0, Math.min(level, MAX_REFORGE_LEVEL))
  const mult = 1 + 0.2 * lv
  const out: Bonus = {}
  for (const [k, v] of Object.entries(baseBonus) as [keyof Bonus, number][]) {
    out[k] = Math.round(v * mult)
  }
  return out
}

// Coût pour passer du niveau courant au niveau suivant : or + matériaux communs, en hausse.
export function reforgeCost(level: number): { gold: number; materials: Record<string, number> } {
  return {
    gold: 60 + 40 * level,
    materials: {
      'minerai-fer': 2 + level,
      'herbe-tendre': 1 + Math.floor(level / 2),
    },
  }
}

// Vrai si l'objet peut être réforgé : pas au niveau max ET assez d'or + matériaux.
export function canReforge(p: PlayerState, itemId: string): boolean {
  const level = p.upgrades[itemId] ?? 0
  if (level >= MAX_REFORGE_LEVEL) return false
  const cost = reforgeCost(level)
  if (p.gold < cost.gold) return false
  for (const [matId, qty] of Object.entries(cost.materials)) {
    if ((p.materials[matId] ?? 0) < qty) return false
  }
  return true
}

// Réforge l'objet : débite or + matériaux et incrémente son niveau. Ne mute rien et renvoie
// false si impossible (niveau max ou ressources insuffisantes).
export function doReforge(p: PlayerState, itemId: string): boolean {
  if (!canReforge(p, itemId)) return false
  const level = p.upgrades[itemId] ?? 0
  const cost = reforgeCost(level)
  p.gold -= cost.gold
  for (const [matId, qty] of Object.entries(cost.materials)) {
    p.materials[matId] = (p.materials[matId] ?? 0) - qty
  }
  p.upgrades[itemId] = level + 1
  return true
}

// Valeur de revente d'un objet : 50 % de son prix d'achat (cf. data/shops sellPrice — prix boutique
// s'il est vendu en ville, sinon repli sur le barème par rareté).
export function sellValue(item: ItemDef): number {
  return sellPrice(item.id)
}

// Vend l'objet à l'index donné de l'inventaire : le retire et crédite l'or. Renvoie false
// (sans effet) si l'index est invalide.
export function sellItem(p: PlayerState, index: number): boolean {
  if (index < 0 || index >= p.inventory.length) return false
  const item = ITEMS[p.inventory[index]!]
  if (!item) return false
  p.inventory.splice(index, 1)
  p.gold += sellValue(item)
  return true
}
