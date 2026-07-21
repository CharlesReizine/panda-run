// Données des boutiques et quêtes de ville. Prix calés sur l'or gagné en jeu (quelques
// pièces par monstre normal, dizaines pour un mini-boss) : un objet de boutique demande
// grosso modo 10 à 30 combats.

export interface ShopItemDef { itemId: string; price: number }

export const POTION_PRICE = 20

// Armes vendues à l'armurerie, une palette par archétype (épée / arc / bâton / contondant) et une
// montée en gamme : communes bon marché → rares milieu de tableau → épiques → légendaires en pièces
// de choix. Prix calés sur l'éco (croissants), triés par prix pour une progression lisible.
export const WEAPON_SHOP: ShopItemDef[] = [
  { itemId: 'epee-bambou', price: 90 },
  { itemId: 'arc-souple', price: 110 },
  { itemId: 'baton-feuillu', price: 140 },
  { itemId: 'sabre-acier', price: 260 },
  { itemId: 'arc-long', price: 290 },
  { itemId: 'arc-composite', price: 300 },
  { itemId: 'epee-large', price: 320 },
  { itemId: 'baton-cristal', price: 340 },
  { itemId: 'baton-runique', price: 440 },
  { itemId: 'masse-etoilee', price: 480 },
  { itemId: 'arbalete', price: 540 },
  { itemId: 'griffe-royale', price: 850 },
  { itemId: 'sceptre-flamme', price: 1300 },
  { itemId: 'faux-sombre', price: 4800 },
  { itemId: 'katana-eclair', price: 5200 },
]

export const ARMOR_SHOP: ShopItemDef[] = [
  { itemId: 'grelot-porte-bonheur', price: 300 },
  { itemId: 'plastron-feuilles', price: 180 },
  { itemId: 'amulette-pharaon', price: 700 },
  { itemId: 'carapace-scarabee', price: 650 },
]

// Chapeaux triés du moins cher au plus cher : le prix suit la rareté ET l'allure (plus c'est
// cher, plus le dessin est spectaculaire — cf. drawCosmetic). Barème calé sur l'éco du jeu.
export const HAT_SHOP: ShopItemDef[] = [
  { itemId: 'ruban', price: 120 },
  { itemId: 'sakkat', price: 250 },
  { itemId: 'bonnet-champi', price: 400 },
  { itemId: 'chapeau-poring', price: 900 },
  { itemId: 'casque-orc', price: 2200 },
  { itemId: 'casque-croc', price: 2600 },
  { itemId: 'ailes-angeling', price: 3800 },
  { itemId: 'couronne-royale', price: 7000 },
  { itemId: 'corne-kaho', price: 15000 },
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
