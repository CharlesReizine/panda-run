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
// ══════════════════════════════════════════════════════════════════════════════════════════════
// TROIS CANAUX D'ÉQUIPEMENT, TROIS RÔLES DISTINCTS — et aucun ne doit rendre les autres inutiles.
//
// Demande du user : « repense un peu le crafting et l'achat. En gros il faut qu'il y ait un intérêt à
// chacun. Il doit y avoir un peu de tous les niveaux partout, et les plus stylés ça ne peut être que du
// craft TRÈS TRÈS dur à faire, ou alors du farming. »
//
// Constat qui a motivé la refonte : 26 des 29 objets LÉGENDAIRES étaient simplement en vente. Le farm et
// la forge ne servaient donc à rien pour le haut du panier — il suffisait d'accumuler de l'or.
//
//   BOUTIQUE  → fiable, immédiat, sans hasard, MAIS PLAFONNÉE : commun, rare et épique uniquement.
//               C'est le canal qui garantit qu'on n'est jamais bloqué. Aucun légendaire, jamais.
//   FORGE     → à niveau égal, meilleur que la boutique ; et c'est l'un des deux seuls accès aux
//               légendaires, au prix de recettes très exigeantes (cf. data/recipes.ts).
//   FARM      → les élites et les boss lâchent des légendaires signature (cf. data/monsters.ts).
//
// Verrouillé par tests/data/economie-canaux.test.ts : aucun légendaire en vitrine, et tout légendaire a
// au moins une source (forge ou butin).
export const SHOP_BY_TOWN: Record<string, TownStock> = {
  prontera: {
    // Armes EARLY : les trois archétypes (épée / arc / bâton) en commun, plus les rares d'entrée.
    // Les six communes tiennent TOUTES sous le pécule d'arrivée dans le PIRE tirage de butin (~420 or) :
    // on ne doit jamais pouvoir atterrir à Prontera sans pouvoir s'armer, quelle que soit la classe.
    weapons: [
      { itemId: 'epee-bambou', price: 310 },
      { itemId: 'arc-souple', price: 340 },
      { itemId: 'baton-feuillu', price: 380 },
      { itemId: 'dague-jumelle', price: 350 },
      { itemId: 'arc-corne', price: 390 },
      { itemId: 'baton-noueux', price: 420 },
      { itemId: 'sabre-acier', price: 1170 },
      { itemId: 'arc-long', price: 1300 },
      { itemId: 'cimeterre-desert', price: 1560 },
      { itemId: 'baton-cristal', price: 1500 },
      { itemId: 'sceptre-glace', price: 1690 },
      // ── Roster élargi. Prix calculé DANS la bande de la rareté et ordonné par puissance : deux armes
      //    de même rareté ne coûtent pas pareil si l'une frappe plus fort. Aucune n'est moins chère que le
      //    kit de départ, sinon on s'offrirait un article de plus en arrivant (verrouillé par shop-economy).
      { itemId: 'fronde', price: 380 },
      { itemId: 'couteau-de-chasse', price: 400 },
      { itemId: 'branche-tordue', price: 420 },
      { itemId: 'baton-de-novice', price: 470 },
      { itemId: 'arc-de-chasse', price: 480 },
      { itemId: 'glaive-de-fer', price: 490 },
      { itemId: 'arc-en-if', price: 2280 },
    ],
    armors: [
      { itemId: 'veste-rembourree', price: 360 },
      { itemId: 'plastron-feuilles', price: 440 },
      { itemId: 'bracelet-cuir', price: 320 },
      { itemId: 'grelot-porte-bonheur', price: 1300 },
      // ── Roster élargi : l'armurerie était le rayon le plus pauvre du jeu — 6 armures et 6 accessoires
      //    contre 30 armes. On ne pouvait pas progresser en défense (« niveau armure il en faut bcp plus »).
      { itemId: 'pendentif-de-bois', price: 350 },
      { itemId: 'anneau-de-cuivre', price: 360 },
      { itemId: 'boucle-d-oreille', price: 360 },
      { itemId: 'gant-de-toile', price: 380 },
      { itemId: 'tunique-de-lin', price: 390 },
      { itemId: 'robe-d-apprenti', price: 400 },
      { itemId: 'brassard-de-fer', price: 400 },
      { itemId: 'gilet-de-cuir', price: 420 },
      { itemId: 'brigandine', price: 430 },
      { itemId: 'manteau-de-voyageur', price: 430 },
      { itemId: 'amulette-d-ambre', price: 1380 },
      { itemId: 'anneau-de-rubis', price: 1430 },
      { itemId: 'anneau-de-saphir', price: 1430 },
      { itemId: 'collier-de-crocs', price: 1510 },
      { itemId: 'broche-d-argent', price: 1520 },
      { itemId: 'gants-de-combat', price: 1770 },
      { itemId: 'ceinture-de-force', price: 1790 },
      { itemId: 'talisman-d-os', price: 2020 },
      { itemId: 'cuirasse-de-bronze', price: 2220 },
    ],
    hats: [
      // Les chapeaux COMMUNS restent une coquetterie qu'on s'offre au lieu d'une armure (arbitrage
      // volontaire : ~300 or, soit le même ordre que le kit de départ). Les chapeaux RARES, eux, sont
      // TOUS au-dessus de 1,5× le pécule d'arrivée : c'est exactement ce que le joueur reprochait au
      // barème d'avant, où le ruban à 300 or partait avec la monnaie du premier clear.
      { itemId: 'ruban', price: 320 },
      { itemId: 'sakkat', price: 420 },
      // 1450 et non 1300 : le pécule d'arrivée à Prontera a monté avec le contenu des terrains, et la
      // règle veut qu'un chapeau non commun coûte au moins une fois et demie ce pécule — un aller-retour
      // en plaine, minimum. Le prix suit le revenu du jeu, ce n'est pas un chiffre choisi à la main.
      { itemId: 'chapeau-poring', price: 1880 },
      { itemId: 'bonnet-champi', price: 470 },
      { itemId: 'bandeau-guerrier', price: 440 },
      { itemId: 'plume-eclaireur', price: 350 },
      { itemId: 'bonnet-laine', price: 380 },
      { itemId: 'oreilles-chat', price: 1880 },
      { itemId: 'lunettes-aviateur', price: 2340 },
      { itemId: 'chapeau-sorciere', price: 2540 },
      { itemId: 'casque-orc', price: 2140 },
      // Seul légendaire en vitrine dans le bourg de départ : il est là pour être REGARDÉ. À 22 000 or
      // il coûte plus que tout l'or de la campagne entière clearée une fois — on l'obtient bien plus
      // tôt en le faisant tomber de l'Angeling élite (2 %), la vitrine n'est que le lot de consolation
      // de celui qui n'a jamais eu la chance.
      // ── Roster élargi. Tout chapeau au-delà du commun reste au-dessus d'1,5× le pécule d'arrivée : la
      //    parure est le premier objectif de farm, jamais un achat d'étape.
      { itemId: 'casquette-de-toile', price: 340 },
      { itemId: 'foulard-de-pirate', price: 340 },
      { itemId: 'couronne-de-fleurs', price: 350 },
      { itemId: 'cagoule-de-voleur', price: 380 },
      { itemId: 'heaume-de-bronze', price: 400 },
      { itemId: 'masque-de-renard', price: 1820 },
      { itemId: 'mitre-du-clerc', price: 1820 },
      { itemId: 'bandeau-du-moine', price: 1770 },
    ],
  },
  morocc: {
    // armes MID : le haut de la bande rare, les épiques, et le haut de gamme légendaire (hors de prix)
    weapons: [
      { itemId: 'arc-composite', price: 2000 },
      { itemId: 'epee-large', price: 2190 },
      { itemId: 'baton-runique', price: 2500 },
      { itemId: 'griffe-royale', price: 6250 },
      { itemId: 'epee-cristal', price: 7250 },
      { itemId: 'arc-elfique', price: 7500 },
      { itemId: 'sceptre-arcane', price: 9000 },
      { itemId: 'sceptre-flamme', price: 9380 },
      // Légendaires : chacun vaut plus que la campagne entière clearée une fois. Ce sont des objectifs
      // de fin de partie, à atteindre en cumulant farm, quêtes et reventes — jamais un achat d'étape.
      // ── Roster élargi : haut de la bande rare, épiques, et légendaires hors de prix.
      { itemId: 'rapiere', price: 2350 },
      { itemId: 'baton-d-ebene', price: 2580 },
      { itemId: 'hache-de-guerre', price: 2680 },
      { itemId: 'arc-de-glace', price: 2700 },
      { itemId: 'epee-batarde', price: 2760 },
      { itemId: 'sceptre-de-jade', price: 2810 },
      { itemId: 'arbalete-lourde', price: 2840 },
      { itemId: 'epee-du-croise', price: 9200 },
      { itemId: 'arc-de-braise', price: 9400 },
      { itemId: 'claymore', price: 9640 },
      { itemId: 'baton-des-marees', price: 11000 },
    ],
    armors: [
      { itemId: 'carapace-scarabee', price: 3000 },
      { itemId: 'cotte-mailles', price: 2380 },
      { itemId: 'anneau-turquoise', price: 2120 },
      { itemId: 'amulette-pharaon', price: 8500 },
      // ── Roster élargi : c'est ici que la progression défensive se joue vraiment.
      { itemId: 'robe-de-mage', price: 2290 },
      { itemId: 'cotte-de-givre', price: 2350 },
      { itemId: 'armure-d-ecailles', price: 2360 },
      { itemId: 'plastron-d-os', price: 2390 },
      { itemId: 'jaque-de-mailles', price: 2450 },
      { itemId: 'justaucorps-d-ombre', price: 2490 },
      { itemId: 'carapace-de-tortue', price: 3090 },
      { itemId: 'anneau-du-mage', price: 6110 },
      { itemId: 'pendentif-du-loup', price: 6280 },
      { itemId: 'bracelet-de-mithril', price: 6940 },
      { itemId: 'toge-du-sage', price: 8220 },
      { itemId: 'harnois-de-fer', price: 8420 },
      { itemId: 'armure-de-lamelles', price: 8460 },
      { itemId: 'surcot-du-templier', price: 8500 },
      { itemId: 'cuirasse-du-croise', price: 9440 },
    ],
    hats: [
      { itemId: 'casque-croc', price: 6500 },
      { itemId: 'casque-viking', price: 6880 },
      { itemId: 'aureole-sacree', price: 7750 },
      { itemId: 'diademe-fee', price: 8120 },
      { itemId: 'couronne-royale', price: 10000 },
      // ── Roster élargi.
      { itemId: 'couronne-de-laurier', price: 7050 },
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
