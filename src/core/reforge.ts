import type { PlayerState } from './player-state'
import type { ItemDef, StatBlock } from './types'
import { ITEMS } from '../data/items'
import { sellPrice } from '../data/shops'

// Bonus d'amélioration et vente. Chaque niveau majore le bonus de base de l'objet de +20 %
// (voir upgradedBonus, appliqué dans computeStats). Vente : revend un objet de l'inventaire contre
// de l'or selon sa rareté.

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

// ⚠️ LA RÉFORGE A ÉTÉ SUPPRIMÉE — il n'en reste que le CALCUL DU BONUS et la vente.
//
// Demande du joueur : « la forge faut reprendre, je veux plus de "reforger", tu dégages. » Ses trois
// fonctions (`reforgeCost`, `canReforge`, `doReforge`) sont parties avec l'onglet : améliorer se décide
// désormais dans core/amelioration, avec un coût lié à la pureté et un risque de casse au-delà de +3.
//
// Ce qui survit ici, et pourquoi : `upgradedBonus` traduit un NIVEAU en statistiques, et cette
// traduction ne dépend pas de la façon dont le niveau a été gagné — `computeStats` l'appelle à chaque
// calcul de fiche. Le champ `upgrades` du joueur, lui, n'a pas changé de sens : les parties déjà
// réforgées gardent exactement les bonus qu'elles avaient.

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
