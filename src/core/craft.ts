import type { PlayerState } from './player-state'
import type { RecipeDef } from '../data/recipes'

// Vrai si le joueur possède assez de chaque matériau ET assez d'or pour forger la recette.
export function canCraft(p: PlayerState, recipe: RecipeDef): boolean {
  if (p.gold < (recipe.gold ?? 0)) return false
  for (const [matId, qty] of Object.entries(recipe.materials)) {
    if ((p.materials[matId] ?? 0) < qty) return false
  }
  return true
}

// Forge la recette : débite les matériaux et l'or, ajoute l'objet résultat à l'inventaire.
// Ne mute rien et renvoie false si les ressources sont insuffisantes.
export function doCraft(p: PlayerState, recipe: RecipeDef): boolean {
  if (!canCraft(p, recipe)) return false
  p.gold -= recipe.gold ?? 0
  for (const [matId, qty] of Object.entries(recipe.materials)) {
    p.materials[matId] = (p.materials[matId] ?? 0) - qty
  }
  p.inventory.push(recipe.resultItemId)
  return true
}
