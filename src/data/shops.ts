// Données des boutiques et quêtes de ville. Prix d'ACHAT calés sur un barème croissant par rareté
// (cf. RARITY_PRICE) : quelques dizaines d'or pour un commun, des centaines pour un rare, des
// milliers pour un épique, une petite fortune pour un légendaire. La REVENTE vaut 50 % du prix
// d'achat (sellPrice), ce qui rend les surplus (matériaux, doublons) intéressants à écouler.

import { ITEMS, RARITY_PRICE } from './items'

export interface ShopItemDef { itemId: string; price: number }

export const POTION_PRICE = 20

// Armes vendues à l'armurerie : palette par archétype (épée / arc / bâton / contondant) et montée
// en gamme calée sur la rareté (communes bon marché → rares → épiques → légendaires hors de prix).
export const WEAPON_SHOP: ShopItemDef[] = [
  { itemId: 'epee-bambou', price: 60 },
  { itemId: 'arc-souple', price: 75 },
  { itemId: 'baton-feuillu', price: 90 },
  { itemId: 'sabre-acier', price: 420 },
  { itemId: 'arc-long', price: 460 },
  { itemId: 'arc-composite', price: 480 },
  { itemId: 'epee-large', price: 520 },
  { itemId: 'baton-cristal', price: 560 },
  { itemId: 'baton-runique', price: 620 },
  { itemId: 'masse-etoilee', price: 660 },
  { itemId: 'arbalete', price: 720 },
  { itemId: 'griffe-royale', price: 2000 },
  { itemId: 'sceptre-flamme', price: 2600 },
  { itemId: 'faux-sombre', price: 8500 },
  { itemId: 'katana-eclair', price: 9500 },
]

export const ARMOR_SHOP: ShopItemDef[] = [
  { itemId: 'plastron-feuilles', price: 120 },
  { itemId: 'grelot-porte-bonheur', price: 480 },
  { itemId: 'carapace-scarabee', price: 620 },
  { itemId: 'amulette-pharaon', price: 2200 },
]

// Chapeaux triés du moins cher au plus cher : le prix suit la rareté ET l'allure (plus c'est cher,
// plus le dessin est spectaculaire — cf. drawCosmetic). Barème calé sur la même échelle par rareté.
export const HAT_SHOP: ShopItemDef[] = [
  { itemId: 'ruban', price: 80 },
  { itemId: 'sakkat', price: 110 },
  { itemId: 'chapeau-poring', price: 140 },
  { itemId: 'bonnet-champi', price: 150 },
  { itemId: 'casque-orc', price: 700 },
  { itemId: 'ailes-angeling', price: 800 },
  { itemId: 'casque-croc', price: 2200 },
  { itemId: 'couronne-royale', price: 2800 },
  { itemId: 'corne-kaho', price: 12000 },
]

// Prix d'achat de référence, source unique pour la boutique ET la revente. On lit le prix affiché
// en boutique s'il existe, sinon on retombe sur le barème par rareté (objets forgés / butin non
// vendus en ville). Garantit que la revente = 50 % de ce que coûte réellement l'objet.
const SHOP_PRICE: Record<string, number> = {}
for (const e of [...WEAPON_SHOP, ...ARMOR_SHOP, ...HAT_SHOP]) SHOP_PRICE[e.itemId] = e.price

export function buyPrice(itemId: string): number {
  if (SHOP_PRICE[itemId] !== undefined) return SHOP_PRICE[itemId]!
  const item = ITEMS[itemId]
  return RARITY_PRICE[item?.rarity ?? 'commun']
}

// Prix de REVENTE : 50 % du prix d'achat, arrondi.
export function sellPrice(itemId: string): number {
  return Math.round(buyPrice(itemId) * 0.5)
}

// ————————————————————————— Quêtes de ville (chaîne du garde) —————————————————————————
//
// Quatre types de quêtes, tous suivis via player-state.quests[id] (cf. core/quests) :
//  - kill-any  : tuer N monstres, n'importe lesquels (snapshot de monstersKilled à l'acceptation).
//  - kill-type : tuer N monstres d'un type précis (snapshot de killsByMonster[targetId]).
//  - kill-boss : tuer un boss précis (fini dès killsByMonster[targetId] ≥ 1 depuis l'acceptation).
//  - fetch     : rapporter N matériaux (targetId) ; vérifié à la remise et CONSOMMÉ.
// Le garde propose la première quête de QUEST_CHAIN non encore réclamée (ordre croissant), avec des
// récompenses de plus en plus généreuses (or + objet de rareté croissante).

export type QuestType = 'kill-any' | 'kill-type' | 'kill-boss' | 'fetch'

export interface QuestDef {
  id: string
  type: QuestType
  order: number
  name: string
  npcName: string
  description: string
  targetCount: number
  targetId?: string // kill-type/kill-boss : id de monstre ; fetch : id de matériau
  rewardGold: number
  rewardItemId?: string // objet d'équipement offert (poussé dans l'inventaire)
  rewardPotions?: number // potions offertes
}

const GARDE = 'Garde du village'

// Chaîne ordonnée. Ids de monstres/boss/matériaux vérifiés dans monsters.ts / materials.ts.
export const QUEST_CHAIN: QuestDef[] = [
  {
    id: 'chasse-aux-monstres', type: 'kill-any', order: 1, name: 'Chasse aux monstres', npcName: GARDE,
    description: 'Élimine 10 monstres, quels qu\'ils soient, pour prouver ta valeur.',
    targetCount: 10, rewardGold: 150, rewardPotions: 2,
  },
  {
    id: 'nettoyage-plaine', type: 'kill-type', order: 2, name: 'Nettoyage de la plaine', npcName: GARDE,
    description: 'Les Gloopy pullulent dans la plaine. Écrase-en 15 pour rassurer les villageois.',
    targetCount: 15, targetId: 'gloopy', rewardGold: 300, rewardItemId: 'baton-feuillu',
  },
  {
    id: 'chasse-corbeaux', type: 'kill-type', order: 3, name: 'Les corbeaux de mauvais augure', npcName: GARDE,
    description: 'Les corbeaux harcèlent les voyageurs. Abats-en 20 en plein vol.',
    targetCount: 20, targetId: 'corbeau', rewardGold: 550, rewardItemId: 'carapace-scarabee',
  },
  {
    id: 'collecte-crocs', type: 'fetch', order: 4, name: 'Trophées de loup', npcName: GARDE,
    description: 'Rapporte-moi 4 crocs de loup — il m\'en faut pour un talisman de protection.',
    targetCount: 4, targetId: 'croc-de-loup', rewardGold: 900, rewardItemId: 'grelot-porte-bonheur',
  },
  {
    id: 'grand-chasseur', type: 'kill-type', order: 5, name: 'Le grand chasseur', npcName: GARDE,
    description: 'Deviens une légende vivante : terrasse 50 Fabre à travers la contrée.',
    targetCount: 50, targetId: 'fabre', rewardGold: 1600, rewardItemId: 'sceptre-flamme',
  },
  {
    id: 'traque-gardien-sylve', type: 'kill-boss', order: 6, name: 'L\'éveil de la Sylve', npcName: GARDE,
    description: 'Le Gardien de la Sylve s\'est éveillé au plus profond de la forêt, du côté des Ronces. Abats-le.',
    targetCount: 1, targetId: 'boss-sylve', rewardGold: 2500, rewardItemId: 'casque-croc',
  },
  {
    id: 'fin-du-monde', type: 'kill-boss', order: 7, name: 'La fin du règne', npcName: GARDE,
    description: 'Seul le Seigneur Déchu, tapi tout au fond des Enfers, reste debout. Mets fin à son règne.',
    targetCount: 1, targetId: 'seigneur-dechu', rewardGold: 6000, rewardItemId: 'katana-eclair',
  },
]

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(QUEST_CHAIN.map((q) => [q.id, q]))
