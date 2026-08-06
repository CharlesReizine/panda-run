import type { DropEntry, Rarity } from './types'
import { ITEMS } from '../data/items'
import { minLevelOf } from './item-level'

export interface DropResult { gold: number; potions: number; items: string[]; materials: string[] }

// Loot rare de coffre : probabilité (très basse) qu'un coffre lâche, en bonus, un équipement
// épique ou légendaire — un événement marquant, réutilisant la révélation brillante existante.
// ⚠️ 4 % ÉTAIT TROP, ET LE COMPTE LE DIT. Le jeu compte 155 coffres : à 4 %, une traversée complète en
// lâchait six, et comme les coffres reviennent quand on rejoue un terrain, farmer en donnait autant
// qu'on voulait. « Légendaire ok pour les coffres mais peut-être moins fréquent. » À 1,5 %, une
// traversée complète en donne deux — un événement dont on se souvient, ce qui était l'intention.
export const CHEST_RARE_CHANCE = 0.015
const CHEST_RARE_RARITIES: Rarity[] = ['epique', 'legendaire']
// Pool des équipements (arme/armure/chapeau/accessoire) épiques ou légendaires éligibles.
export const CHEST_RARE_POOL: string[] = Object.values(ITEMS)
  .filter((i) => i.slot && CHEST_RARE_RARITIES.includes(i.rarity ?? 'commun'))
  .map((i) => i.id)

// ─── UN COFFRE NE LÂCHE QUE CE QUI A DU SENS LÀ OÙ IL EST ────────────────────────────────────
//
// Retour du joueur, sur la partie d'un autre : « j'ai l'impression qu'Émile a chopé des objets
// légendaires de niveau 30 alors qu'il était tout au début du jeu, c'est absurde non ? » — puis la
// règle, énoncée par lui : « un monstre devrait pouvoir lâcher que des objets pas trop loin de son
// niveau. »
//
// ⚠️ IL AVAIT RAISON, ET LE TIRAGE ÉTAIT PIRE QUE CE QU'IL CROYAIT. Le pool comptait SOIXANTE-SEPT
// équipements, du niveau 1 au niveau 45, tirés UNIFORMÉMENT — et un coffre sur vingt-cinq en lâche un.
// Sur le premier terrain, l'épée du Jugement (niveau 45) était donc aussi probable que les Ailes
// d'Angeling (niveau 1). Deux dégâts, et le second est le vrai :
//   · l'objet est inutilisable pendant trente niveaux (le palier de port le refuse) ;
//   · quand enfin on l'atteint, on l'a DÉJÀ — et tout ce qu'on aurait pu convoiter entre-temps ne
//     vaut plus rien. Un légendaire tombé trop tôt ne fait pas seulement plaisir trop tôt : il vide
//     de son sens la progression qui devait y mener.
//
// Le pool est donc borné par le niveau du LIEU (le monstre le plus fort qui l'habite), plus une marge
// d'aspiration : on peut trouver mieux que ce qu'on porte, jamais trente niveaux au-dessus.
export const MARGE_NIVEAU_COFFRE = 5

/** Les objets qu'un coffre peut lâcher à cet endroit du monde, du plus modeste au plus fort. */
export function chestRarePool(niveauRef: number): string[] {
  const plafond = niveauRef + MARGE_NIVEAU_COFFRE
  const eligibles = CHEST_RARE_POOL.filter((id) => minLevelOf(ITEMS[id]!) <= plafond)
  // ⚠️ JAMAIS VIDE : au niveau 1 le plafond vaut 6, et trois objets passent (Ailes d'Angeling, Auréole
  // sacrée, Diadème de fée). Si un jour retoucher les stats les faisait tous grimper, un coffre rare
  // ne lâcherait plus RIEN sans que rien ne le dise — d'où le repli sur le moins exigeant du pool.
  if (eligibles.length) return eligibles
  const mini = Math.min(...CHEST_RARE_POOL.map((id) => minLevelOf(ITEMS[id]!)))
  return CHEST_RARE_POOL.filter((id) => minLevelOf(ITEMS[id]!) === mini)
}

// ─── UN MONSTRE PEUT LÂCHER UN LÉGENDAIRE DE SON NIVEAU, TRÈS TRÈS RAREMENT ──────────────────
//
// Demande du joueur : « les mobs peuvent peut-être également drop du légendaire de leur niveau avec un
// très très très faible taux ». C'est la contrepartie du bornage des coffres : on ferme la porte au
// légendaire tombé du ciel trente niveaux trop tôt, on en ouvre une autre — plus étroite, et méritée,
// puisqu'il faut tuer la bête.
//
// ⚠️ « DE LEUR NIVEAU » SE LIT DANS LES DEUX SENS. Un plafond seul (rien au-dessus) ferait tomber des
// Ailes d'Angeling de niveau 1 sur un roi-liche de niveau 36 — un légendaire, oui, mais une déception.
// La fenêtre a donc un plancher : on ne rapporte d'une bête que ce qui vaut ce qu'elle valait.
export const MOB_LEGENDARY_CHANCE = 0.001
export const MOB_LEGENDARY_SOUS = 8 // niveaux sous la bête : en deçà, le trophée ne vaut plus rien
export const MOB_LEGENDARY_SUR = 2  // niveaux au-dessus : une pointe d'aspiration, pas un saut

const LEGENDAIRES: string[] = Object.values(ITEMS)
  .filter((i) => i.slot && i.rarity === 'legendaire')
  .map((i) => i.id)

/** Les légendaires qui ont du sens sur une bête de ce niveau. Peut être VIDE, et c'est honnête : à
 *  certains niveaux, aucun légendaire du jeu ne correspond — on ne lâche alors rien plutôt que n'importe quoi. */
export function mobLegendaryPool(mobLevel: number): string[] {
  return LEGENDAIRES.filter((id) => {
    const n = minLevelOf(ITEMS[id]!)
    return n >= mobLevel - MOB_LEGENDARY_SOUS && n <= mobLevel + MOB_LEGENDARY_SUR
  })
}

/** Tirage légendaire d'un monstre : un millième des mises à mort, et seulement à son niveau. */
export function rollMobLegendary(mobLevel: number, rng: () => number = Math.random): string | null {
  if (rng() >= MOB_LEGENDARY_CHANCE) return null
  const pool = mobLegendaryPool(mobLevel)
  return pool[Math.floor(rng() * pool.length)] ?? null
}

// Tirage bonus d'un coffre : renvoie l'id d'un objet épique/légendaire tiré au hasard parmi ceux qui
// ont du sens au niveau `niveauRef`, ou null (cas courant). Ne remplace pas le butin habituel.
export function rollChestRareItem(niveauRef: number, rng: () => number = Math.random): string | null {
  if (rng() >= CHEST_RARE_CHANCE) return null
  const pool = chestRarePool(niveauRef)
  return pool[Math.floor(rng() * pool.length)] ?? null
}

export function rollDrops(drops: DropEntry[], rng: () => number = Math.random): DropResult {
  const result: DropResult = { gold: 0, potions: 0, items: [], materials: [] }
  for (const d of drops) {
    if (rng() >= d.chance) continue
    const qty = d.min + Math.floor(rng() * (d.max - d.min + 1))
    if (d.kind === 'gold') result.gold += qty
    else if (d.kind === 'potion') result.potions += qty
    else if (d.itemId) result.items.push(d.itemId)
    else if (d.kind === 'material' && d.materialId) {
      for (let i = 0; i < qty; i++) result.materials.push(d.materialId)
    }
  }
  return result
}
