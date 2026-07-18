// Recettes de la forge : transforment des matériaux collectés (materials.ts) — plus parfois
// un peu d'or — en équipement forgé (items.ts). Coûts calés sur les quantités qu'on farm :
// une recette demande grosso modo autant de matériaux qu'une dizaine de combats en rapporte.

export interface RecipeDef {
  id: string
  resultItemId: string
  materials: Record<string, number>
  gold?: number
}

export const RECIPES: RecipeDef[] = [
  { id: 'craft-epee-fer-forgee', resultItemId: 'epee-fer-forgee', materials: { 'minerai-fer': 5 }, gold: 60 },
  { id: 'craft-lame-scorpion', resultItemId: 'lame-scorpion', materials: { 'dard-de-scorpion': 4, 'croc-de-loup': 3, 'gemme-brute': 1 }, gold: 130 },
  { id: 'craft-baton-lumineux', resultItemId: 'baton-lumineux', materials: { 'spore-lumineuse': 4, 'herbe-tendre': 3 }, gold: 80 },
  { id: 'craft-plastron-fer', resultItemId: 'plastron-fer', materials: { 'minerai-fer': 4, 'herbe-tendre': 2 }, gold: 70 },
  { id: 'craft-armure-carapace', resultItemId: 'armure-carapace', materials: { 'minerai-fer': 6, 'croc-de-loup': 2, 'gemme-brute': 2 }, gold: 160 },
  { id: 'craft-amulette-gemme', resultItemId: 'amulette-gemme', materials: { 'gemme-brute': 3, 'spore-lumineuse': 2 }, gold: 130 },
  { id: 'craft-talisman-trefle', resultItemId: 'talisman-trefle', materials: { 'trefle-chance': 4, 'herbe-tendre': 3 }, gold: 90 },
  { id: 'craft-casque-croc', resultItemId: 'casque-croc', materials: { 'croc-de-loup': 4, 'minerai-fer': 2 }, gold: 100 },
]
