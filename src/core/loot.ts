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

// ─── UN COFFRE DÉCEVANT MÉRITE SA PETITE HUMILIATION ─────────────────────────────────────────
//
// Demande du joueur : « on peut peut-être prévoir une petite anim pour les coffres quand on trouve
// rien dedans. Un truc qui fout un peu le seum ? »
//
// ⚠️ CE N'EST PAS QU'UNE BLAGUE, ÇA RÉPARE UN SILENCE. Un coffre qui ne donne presque rien produisait
// exactement la même chose qu'un coffre qui bugue : le couvercle s'ouvre, l'onde dorée part, et puis
// plus rien de notable. Impossible de savoir si le jeu a raté quelque chose ou si on n'a simplement
// pas eu de chance. Une déception MISE EN SCÈNE est une information ; une déception muette est un doute.
//
// ⚠️ « RIEN » NE POUVAIT PAS ÊTRE PRIS AU PIED DE LA LETTRE, ET LA MESURE L'A DIT. Aucun coffre du jeu
// ne peut être vide : l'or tombe à 100 % sur les trois paliers. Première tentative — descendre l'or du
// coffre de bois à 88 % — cassée par `shop-economy` : le pire tirage possible tombait à 334 pièces à
// l'arrivée à Prontera, sous les 350 de l'arme la moins chère. Le jeu PROMET qu'on puisse s'armer en
// arrivant, et un gag ne vaut pas qu'on la reprenne.
//
// Le seuil est donc DÉRISOIRE, pas nul : rien d'autre que de l'or, et de l'or dans le bas de sa
// fourchette. C'est exactement le moment qu'on voulait mettre en scène — on ouvre, on espère, on
// récolte vingt-six pièces — et il ne coûte pas une pièce à l'économie.
// ⚠️ RELEVÉ DE 0,25 À 0,5 SUR RETOUR DE JEU : « j'ai des coffres où quand je les ouvre ça fait pas
// d'anim même si y a rien ». Au quart, la moquerie ne tombait que sur un coffre de bois sur sept — le
// joueur en ouvrait cinq de suite sans jamais la voir, et une mise en scène qu'on ne rencontre pas
// n'existe pas. À la moitié, c'est environ un sur trois : assez pour faire partie du jeu, assez rare
// pour piquer encore.
const PART_DECEVANTE = 0.5

/**
 * Ce coffre a-t-il déçu ? Rien d'autre que de l'or, et de l'or au ras de sa fourchette.
 *
 * On passe la TABLE du coffre et pas seulement le résultat : « dérisoire » n'a de sens que rapporté à
 * ce qu'il pouvait donner. Vingt-six pièces sont une misère dans un coffre de bois (25 à 60) et une
 * aberration dans un coffre d'or (240 à 520) — le même nombre, deux verdicts.
 */
export function butinDecevant(r: DropResult, drops: DropEntry[], bonus: string | null = null): boolean {
  if (bonus || r.potions > 0 || r.items.length > 0 || r.materials.length > 0) return false
  if (r.gold === 0) return true // le cas littéral, s'il devient un jour possible
  const or = drops.find((d) => d.kind === 'gold')
  if (!or) return false
  return r.gold <= or.min + Math.floor((or.max - or.min) * PART_DECEVANTE)
}

// ─── LES LOTS DE CONSOLATION ─────────────────────────────────────────────────────────────────
//
// « Quand on trouve un objet tu l'affiches en gros. La même animation me va quand on trouve rien,
// mais on peut peut-être afficher une plume ou une toile d'araignée ou un truc comme ça. »
//
// C'est mieux qu'une mise en scène à part, et pour une raison qui n'est pas qu'esthétique : le joueur
// connaît DÉJÀ ce plan large — il l'a vu à chaque équipement ramassé. Le réutiliser ne lui demande
// rien à apprendre, et c'est la BANALITÉ de ce qu'on lui présente en grand, avec les mêmes égards
// qu'une épée légendaire, qui fait toute la blague.
//
// ⚠️ AUCUN N'ENTRE DANS L'INVENTAIRE. Ce sont des images, pas des objets : les faire ramasser
// obligerait à les définir dans ITEMS, où chaque entrée attend une illustration, un emplacement et un
// palier de niveau. Une plaisanterie ne doit pas coûter une ligne au modèle de données.
export interface LotConsolation { key: string; nom: string }

// ⚠️ LE NOM AFFICHÉ EST TOUJOURS « COFFRE VIDE », JAMAIS CELUI DE L'IMAGE. Demande explicite du
// joueur : « écris pas "plume, toile d'araignée…", si c'est vide tu écris "Coffre vide" et tu gardes
// les images ». Il a raison, et la raison est plus fine que le goût : nommer la plume la présentait
// comme un LOT — on cherchait à quoi elle servait, on la guettait dans l'inventaire où elle n'entre
// jamais. L'image fait la blague, le mot doit faire le constat.
export const NOM_COFFRE_VIDE = 'Coffre vide'

export const CONSOLATIONS: LotConsolation[] = [
  { key: 'lot-toile', nom: NOM_COFFRE_VIDE },
  { key: 'lot-plume', nom: NOM_COFFRE_VIDE },
  { key: 'lot-caillou', nom: NOM_COFFRE_VIDE },
]

/** Le lot de consolation présenté en grand quand un coffre a déçu. */
export function consolationDeCoffre(rng: () => number = Math.random): LotConsolation {
  return CONSOLATIONS[Math.floor(rng() * CONSOLATIONS.length)] ?? CONSOLATIONS[0]!
}
