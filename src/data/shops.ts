// Données des boutiques et quêtes de ville.
//
// ─────────────────────── COURBE DE PRIX : d'où sortent les nombres ───────────────────────
// Les prix ne sont pas décoratifs, ils sont adossés à l'or que le jeu DISTRIBUE réellement (drops de
// data/monsters + coffres de data/props, cf. tests/data/shop-economy.test.ts qui recalcule ces
// montants depuis les données et verrouille les rapports) :
//   • clear des 5 terrains de plaine qui mènent à Prontera ................ ~730 or (pire chance ~420)
//   • traversée complète des 58 terrains, une fois chacun, hors quêtes .... ~15 900 or
//
// Conséquence assumée — À L'ARRIVÉE À PRONTERA ON S'ÉQUIPE, ON NE DÉVALISE PAS. Le pécule d'arrivée
// paye DEUX articles communs (une arme + une armure, ~500 or), pas plus : le 3ᵉ fait déjà déborder.
// Le précédent barème (arme de base à 60 or, chapeau rare à 300) laissait acheter la moitié de
// l'échoppe dès la première visite — d'où le retour joueur « les chapeaux ne sont pas du tout assez
// chers ». Aucun chapeau de rareté ≥ rare n'est désormais accessible en arrivant : c'est la première
// raison de RETOURNER farmer la plaine.
//
// Les prix sont étalés en BANDES DISJOINTES par rareté (aucun chevauchement d'un palier à l'autre) :
//   commun 240–360 · rare 900–2400 · épique 5000–8000 · légendaire 22 000–38 000
// Le barème d'origine mélangeait tout (bonnet-champi COMMUN à 700 or coûtait plus cher que le
// sabre-acier RARE à 420) : la rareté affichée ne voulait plus rien dire à la caisse. Dans une bande,
// on trie par puissance du bonus (atk pondéré, def, PV) puis par avancement de la ville.
//
// La REVENTE (sellPrice) applique un taux DÉGRESSIF par rareté — voir RESALE_RATE, le piège y est
// expliqué : à 50 % uniforme, la forge devenait une imprimerie à or.

import type { Rarity } from '../core/types'
import { ITEMS, RARITY_PRICE } from './items'

export interface ShopItemDef { itemId: string; price: number }

// Stock d'une ville, réparti par échoppe : armes (armurerie), armures + accessoires (armurerie),
// chapeaux (boutique de vêtements). Chaque ville a SON stock, calé sur la progression du joueur.
export interface TownStock {
  weapons: ShopItemDef[]
  armors: ShopItemDef[] // armures ET accessoires (regroupés à l'armurerie)
  hats: ShopItemDef[]
}

// Potion volontairement LAISSÉE bon marché (12 potions pour le prix d'une arme de base) alors que tout
// l'équipement a été renchéri : le filet de sécurité d'un débutant ne doit jamais être ce qui le ruine,
// et une potion se ramasse déjà sur un mob sur quatre. C'est le renchérissement RELATIF de la parure
// qui crée l'objectif de farm, pas la taxation de la survie.
export const POTION_PRICE = 20

// Stock PAR VILLE. Prontera (bourg de départ, atteint ~niveau 8) propose du matériel EARLY :
// communs (le kit de départ, seule chose qu'on s'offre en arrivant) + des rares qui demandent chacun
// deux à trois retours en plaine. Morocc (cité du désert, atteinte ~niveau 25) propose du matériel
// MID : rares du haut de la bande + épiques (+ le haut de gamme légendaire), et PAS les objets de base
// de Prontera. Extensible : ajouter une entrée par nouvelle ville.
export const SHOP_BY_TOWN: Record<string, TownStock> = {
  prontera: {
    // Armes EARLY : les trois archétypes (épée / arc / bâton) en commun, plus les rares d'entrée.
    // Les six communes tiennent TOUTES sous le pécule d'arrivée dans le PIRE tirage de butin (~420 or) :
    // on ne doit jamais pouvoir atterrir à Prontera sans pouvoir s'armer, quelle que soit la classe.
    weapons: [
      { itemId: 'epee-bambou', price: 240 },
      { itemId: 'arc-souple', price: 260 },
      { itemId: 'baton-feuillu', price: 290 },
      { itemId: 'dague-jumelle', price: 270 },
      { itemId: 'arc-corne', price: 300 },
      { itemId: 'baton-noueux', price: 320 },
      { itemId: 'sabre-acier', price: 900 },
      { itemId: 'arc-long', price: 1000 },
      { itemId: 'cimeterre-desert', price: 1200 },
      { itemId: 'baton-cristal', price: 1150 },
      { itemId: 'sceptre-glace', price: 1300 },
      // ── Roster élargi. Prix calculé DANS la bande de la rareté et ordonné par puissance : deux armes
      //    de même rareté ne coûtent pas pareil si l'une frappe plus fort. Aucune n'est moins chère que le
      //    kit de départ, sinon on s'offrirait un article de plus en arrivant (verrouillé par shop-economy).
      { itemId: 'fronde', price: 290 },
      { itemId: 'couteau-de-chasse', price: 310 },
      { itemId: 'branche-tordue', price: 320 },
      { itemId: 'baton-de-novice', price: 360 },
      { itemId: 'arc-de-chasse', price: 370 },
      { itemId: 'glaive-de-fer', price: 380 },
      { itemId: 'arc-en-if', price: 1750 },
    ],
    armors: [
      { itemId: 'veste-rembourree', price: 280 },
      { itemId: 'plastron-feuilles', price: 340 },
      { itemId: 'bracelet-cuir', price: 250 },
      { itemId: 'grelot-porte-bonheur', price: 1000 },
      // ── Roster élargi : l'armurerie était le rayon le plus pauvre du jeu — 6 armures et 6 accessoires
      //    contre 30 armes. On ne pouvait pas progresser en défense (« niveau armure il en faut bcp plus »).
      { itemId: 'pendentif-de-bois', price: 270 },
      { itemId: 'anneau-de-cuivre', price: 280 },
      { itemId: 'boucle-d-oreille', price: 280 },
      { itemId: 'gant-de-toile', price: 290 },
      { itemId: 'tunique-de-lin', price: 300 },
      { itemId: 'robe-d-apprenti', price: 310 },
      { itemId: 'brassard-de-fer', price: 310 },
      { itemId: 'gilet-de-cuir', price: 320 },
      { itemId: 'brigandine', price: 330 },
      { itemId: 'manteau-de-voyageur', price: 330 },
      { itemId: 'amulette-d-ambre', price: 1060 },
      { itemId: 'anneau-de-rubis', price: 1100 },
      { itemId: 'anneau-de-saphir', price: 1100 },
      { itemId: 'collier-de-crocs', price: 1160 },
      { itemId: 'broche-d-argent', price: 1170 },
      { itemId: 'gants-de-combat', price: 1360 },
      { itemId: 'ceinture-de-force', price: 1380 },
      { itemId: 'talisman-d-os', price: 1550 },
      { itemId: 'cuirasse-de-bronze', price: 1710 },
    ],
    hats: [
      // Les chapeaux COMMUNS restent une coquetterie qu'on s'offre au lieu d'une armure (arbitrage
      // volontaire : ~300 or, soit le même ordre que le kit de départ). Les chapeaux RARES, eux, sont
      // TOUS au-dessus de 1,5× le pécule d'arrivée : c'est exactement ce que le joueur reprochait au
      // barème d'avant, où le ruban à 300 or partait avec la monnaie du premier clear.
      { itemId: 'ruban', price: 250 },
      { itemId: 'sakkat', price: 320 },
      { itemId: 'chapeau-poring', price: 1300 },
      { itemId: 'bonnet-champi', price: 360 },
      { itemId: 'bandeau-guerrier', price: 340 },
      { itemId: 'plume-eclaireur', price: 270 },
      { itemId: 'bonnet-laine', price: 290 },
      { itemId: 'oreilles-chat', price: 1450 },
      { itemId: 'lunettes-aviateur', price: 1800 },
      { itemId: 'chapeau-sorciere', price: 1950 },
      { itemId: 'casque-orc', price: 1650 },
      // Seul légendaire en vitrine dans le bourg de départ : il est là pour être REGARDÉ. À 22 000 or
      // il coûte plus que tout l'or de la campagne entière clearée une fois — on l'obtient bien plus
      // tôt en le faisant tomber de l'Angeling élite (2 %), la vitrine n'est que le lot de consolation
      // de celui qui n'a jamais eu la chance.
      { itemId: 'ailes-angeling', price: 22000 },
      // ── Roster élargi. Tout chapeau au-delà du commun reste au-dessus d'1,5× le pécule d'arrivée : la
      //    parure est le premier objectif de farm, jamais un achat d'étape.
      { itemId: 'casquette-de-toile', price: 260 },
      { itemId: 'foulard-de-pirate', price: 260 },
      { itemId: 'couronne-de-fleurs', price: 270 },
      { itemId: 'cagoule-de-voleur', price: 290 },
      { itemId: 'heaume-de-bronze', price: 310 },
      { itemId: 'masque-de-renard', price: 1250 },
      { itemId: 'mitre-du-clerc', price: 1250 },
      { itemId: 'bandeau-du-moine', price: 1360 },
      { itemId: 'casque-a-plumet', price: 1380 },
    ],
  },
  morocc: {
    // armes MID : le haut de la bande rare, les épiques, et le haut de gamme légendaire (hors de prix)
    weapons: [
      { itemId: 'arc-composite', price: 1600 },
      { itemId: 'epee-large', price: 1750 },
      { itemId: 'baton-runique', price: 2000 },
      { itemId: 'masse-etoilee', price: 2050 },
      { itemId: 'arbalete', price: 2200 },
      { itemId: 'griffe-royale', price: 5000 },
      { itemId: 'epee-cristal', price: 5800 },
      { itemId: 'arc-elfique', price: 6000 },
      { itemId: 'sceptre-arcane', price: 7200 },
      { itemId: 'sceptre-flamme', price: 7500 },
      // Légendaires : chacun vaut plus que la campagne entière clearée une fois. Ce sont des objectifs
      // de fin de partie, à atteindre en cumulant farm, quêtes et reventes — jamais un achat d'étape.
      { itemId: 'faux-sombre', price: 28000 },
      { itemId: 'arc-tempete', price: 26000 },
      { itemId: 'lame-solaire', price: 32000 },
      { itemId: 'katana-eclair', price: 30000 },
      { itemId: 'baton-cosmique', price: 34000 },
      // ── Roster élargi : haut de la bande rare, épiques, et légendaires hors de prix.
      { itemId: 'rapiere', price: 1880 },
      { itemId: 'baton-d-ebene', price: 2060 },
      { itemId: 'hache-de-guerre', price: 2140 },
      { itemId: 'arc-de-glace', price: 2160 },
      { itemId: 'epee-batarde', price: 2210 },
      { itemId: 'sceptre-de-jade', price: 2250 },
      { itemId: 'arbalete-lourde', price: 2270 },
      { itemId: 'baton-de-tempete', price: 2600 },
      { itemId: 'sabre-de-samourai', price: 6460 },
      { itemId: 'arc-du-faucon', price: 7080 },
      { itemId: 'epee-du-croise', price: 7360 },
      { itemId: 'sceptre-d-ombre', price: 7490 },
      { itemId: 'arc-de-braise', price: 7520 },
      { itemId: 'claymore', price: 7710 },
      { itemId: 'baton-des-marees', price: 8800 },
      { itemId: 'lame-du-neant', price: 28740 },
      { itemId: 'epee-du-jugement', price: 29770 },
      { itemId: 'arc-du-crepuscule', price: 30810 },
      { itemId: 'sceptre-du-chaos', price: 31020 },
      { itemId: 'arc-des-etoiles', price: 31120 },
      { itemId: 'baton-de-l-aube', price: 39000 },
    ],
    armors: [
      { itemId: 'carapace-scarabee', price: 2400 },
      { itemId: 'cotte-mailles', price: 1900 },
      { itemId: 'anneau-turquoise', price: 1700 },
      { itemId: 'amulette-pharaon', price: 6800 },
      // ── Roster élargi : c'est ici que la progression défensive se joue vraiment.
      { itemId: 'robe-de-mage', price: 1830 },
      { itemId: 'cotte-de-givre', price: 1880 },
      { itemId: 'armure-d-ecailles', price: 1890 },
      { itemId: 'plastron-d-os', price: 1910 },
      { itemId: 'jaque-de-mailles', price: 1960 },
      { itemId: 'justaucorps-d-ombre', price: 1990 },
      { itemId: 'carapace-de-tortue', price: 2470 },
      { itemId: 'anneau-du-mage', price: 4890 },
      { itemId: 'pendentif-du-loup', price: 5020 },
      { itemId: 'bracelet-de-mithril', price: 5550 },
      { itemId: 'amulette-de-l-aube', price: 5680 },
      { itemId: 'robe-arcanique', price: 6300 },
      { itemId: 'oeil-de-basilic', price: 6360 },
      { itemId: 'toge-du-sage', price: 6580 },
      { itemId: 'harnois-de-fer', price: 6740 },
      { itemId: 'armure-de-lamelles', price: 6770 },
      { itemId: 'surcot-du-templier', price: 6800 },
      { itemId: 'cuirasse-du-croise', price: 7550 },
      { itemId: 'armure-de-mithril', price: 7890 },
      { itemId: 'cuirasse-de-magma', price: 8020 },
      { itemId: 'anneau-du-dragon', price: 22000 },
      { itemId: 'coeur-de-golem', price: 28740 },
      { itemId: 'robe-celeste', price: 31330 },
      { itemId: 'sceau-des-anciens', price: 31430 },
      { itemId: 'larme-d-etoile', price: 31850 },
      { itemId: 'plastron-de-dragon', price: 32880 },
      { itemId: 'armure-d-obsidienne', price: 33920 },
      { itemId: 'armure-du-valhalla', price: 36510 },
      { itemId: 'carapace-du-roi-scarabee', price: 38330 },
    ],
    hats: [
      { itemId: 'casque-croc', price: 5200 },
      { itemId: 'casque-viking', price: 5500 },
      { itemId: 'aureole-sacree', price: 6200 },
      { itemId: 'diademe-fee', price: 6500 },
      { itemId: 'couronne-royale', price: 8000 },
      { itemId: 'couronne-glace', price: 31000 },
      { itemId: 'masque-demon', price: 36000 },
      { itemId: 'corne-kaho', price: 38000 },
      // ── Roster élargi.
      { itemId: 'chapeau-du-magicien', price: 4800 },
      { itemId: 'heaume-du-chevalier', price: 5300 },
      { itemId: 'couronne-de-laurier', price: 5640 },
      { itemId: 'casque-de-dragon', price: 23550 },
      { itemId: 'couronne-du-roi-demon', price: 27290 },
    ],
  },
}

const DEFAULT_TOWN = 'prontera'

// Stock de la ville demandée, avec repli propre sur Prontera si la ville n'a pas de stock défini.
export function getTownStock(townId: string): TownStock {
  return SHOP_BY_TOWN[townId] ?? SHOP_BY_TOWN[DEFAULT_TOWN]!
}

// Catalogues GLOBAUX (union dédupliquée de toutes les villes), source du barème de prix et repli
// pratique. L'ordre suit celui des villes (Prontera d'abord), donc WEAPON_SHOP[0] = arme de départ.
function dedup(entries: ShopItemDef[]): ShopItemDef[] {
  const seen = new Set<string>()
  return entries.filter((e) => (seen.has(e.itemId) ? false : (seen.add(e.itemId), true)))
}
const TOWNS = Object.values(SHOP_BY_TOWN)
export const WEAPON_SHOP: ShopItemDef[] = dedup(TOWNS.flatMap((s) => s.weapons))
export const ARMOR_SHOP: ShopItemDef[] = dedup(TOWNS.flatMap((s) => s.armors))
export const HAT_SHOP: ShopItemDef[] = dedup(TOWNS.flatMap((s) => s.hats))

// Prix d'achat de référence, source unique pour la boutique ET la revente. On lit le prix affiché
// en boutique s'il existe, sinon on retombe sur le barème par rareté (objets forgés / butin non
// vendus en ville). Garantit que la revente est indexée sur ce que coûte RÉELLEMENT l'objet, et non
// sur un second barème qui dériverait du premier.
const SHOP_PRICE: Record<string, number> = {}
for (const e of [...WEAPON_SHOP, ...ARMOR_SHOP, ...HAT_SHOP]) SHOP_PRICE[e.itemId] = e.price

export function buyPrice(itemId: string): number {
  if (SHOP_PRICE[itemId] !== undefined) return SHOP_PRICE[itemId]!
  const item = ITEMS[itemId]
  return RARITY_PRICE[item?.rarity ?? 'commun']
}

// Taux de REVENTE par rareté, volontairement DÉGRESSIF.
//
// LE PIÈGE ÉVITÉ : garder les 50 % uniformes d'avant après avoir multiplié les prix d'achat des hauts
// paliers par ~4 aurait transformé la forge en imprimerie à or. Un légendaire FORGÉ (data/recipes) ne
// coûte que ~100 or plus des matériaux farmables ; le revendre à 50 % de 30 000 rapportait 15 000, soit
// une centaine de clears de terrain gagnés en quelques poignées de trèfles — la courbe de prix qu'on
// vient de poser s'effondrait par sa propre revente. À 12 %, écouler un légendaire reste un pactole
// (3 600 or) sans même financer le premier épique de la vitrine.
//
// Les bas paliers gardent les 50 % historiques : écouler ses doublons de début de partie doit rester
// franchement rentable, c'est le seul or d'appoint du novice et le taux qu'il a appris à connaître.
// Le barème reste STRICTEMENT croissant en valeur absolue (un épique se revend toujours plus cher que
// n'importe quel rare) : le taux baisse moins vite que le prix ne monte.
const RESALE_RATE: Record<Rarity, number> = {
  commun: 0.5,
  rare: 0.4,
  epique: 0.25,
  legendaire: 0.12,
}

// Prix de REVENTE : une fraction du prix d'achat qui dépend de la rareté (cf. RESALE_RATE), arrondie.
export function sellPrice(itemId: string): number {
  return Math.round(buyPrice(itemId) * RESALE_RATE[ITEMS[itemId]?.rarity ?? 'commun'])
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
//
// L'or des quêtes reste MODESTE face aux prix des vitrines (150 or pour la première, soit la moitié
// d'une arme de base) : c'est l'OBJET offert qui porte la valeur, et il grimpe bien plus vite que la
// prime en or (le dernier maillon offre un légendaire à 30 000 or de vitrine). Volontaire — la chaîne
// du garde est la voie « je joue le jeu » vers l'équipement de haut palier, l'or de la boutique en
// étant la voie « je farme », et les deux ne doivent pas se remplacer l'une l'autre.

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
