// Données des boutiques et quêtes de ville. Prix calés sur l'or gagné en jeu (quelques
// pièces par monstre normal, dizaines pour un mini-boss) : un objet de boutique demande
// grosso modo 10 à 30 combats.

export interface ShopItemDef { itemId: string; price: number }

export const POTION_PRICE = 20

export const WEAPON_SHOP: ShopItemDef[] = [
  { itemId: 'epee-bambou', price: 80 },
  { itemId: 'arc-souple', price: 100 },
  { itemId: 'baton-feuillu', price: 120 },
  { itemId: 'griffe-royale', price: 300 },
]

export const ARMOR_SHOP: ShopItemDef[] = [
  { itemId: 'grelot-porte-bonheur', price: 120 },
  { itemId: 'plastron-feuilles', price: 150 },
  { itemId: 'amulette-pharaon', price: 250 },
  { itemId: 'carapace-scarabee', price: 350 },
]

export const HAT_SHOP: ShopItemDef[] = [
  { itemId: 'sakkat', price: 120 },
  { itemId: 'chapeau-poring', price: 100 },
  { itemId: 'bonnet-champi', price: 130 },
  { itemId: 'casque-orc', price: 220 },
  { itemId: 'ailes-angeling', price: 280 },
  { itemId: 'couronne-royale', price: 400 },
]

export interface QuestDef {
  id: string
  name: string
  npcName: string
  description: string
  targetCount: number
  rewardGold: number
}

const list: QuestDef[] = [
  {
    id: 'chasse-aux-monstres',
    name: 'Chasse aux monstres',
    npcName: 'Garde du village',
    description: 'Élimine 10 monstres pour prouver ta valeur.',
    targetCount: 10,
    rewardGold: 150,
  },
]

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(list.map((q) => [q.id, q]))
