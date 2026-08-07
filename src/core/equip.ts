import type { ClassId, WeaponType } from './types'
import { ITEMS } from '../data/items'
import { minLevelOf } from './item-level'

// Familles d'armes autorisées par classe. Une classe ne peut équiper que les armes de sa spécialité :
// les épéistes (sabreur/chevalier) les lames, les archers (archer/chasseur) les arcs, les mages
// (mage/sorcier) les bâtons. Le novice garde son arme de base (aucun objet weapon équipable).
export const CLASS_WEAPON_TYPES: Record<ClassId, WeaponType[]> = {
  // ⚠️ LE NOVICE PORTE LE BÂTON, ET C'ÉTAIT UN VIDE, PAS UN CHOIX. Sa liste était VIDE : aucune arme
  // équipable avant le premier changement de classe. « Il faut que le bâton devienne une arme de
  // novice, sinon y en a pas et c'est booooring. » Il avait raison sur les deux plans — on jouait les
  // premiers niveaux à mains nues, et surtout tout ce qui tombait de butin était refusé, ce qui
  // transforme la découverte du jeu en série de messages de blocage.
  // Le bâton et pas l'épée : c'est l'arme la plus faible des trois familles, celle qu'on abandonne
  // sans regret en se spécialisant — et un novice qui garde son bâton en devenant épéiste perd son
  // arme, ce qui rend le choix de classe lisible.
  novice: ['staff'],
  swordsman: ['sword'],
  chevalier: ['sword'],
  archer: ['bow'],
  chasseur: ['bow'],
  mage: ['staff'],
  sorcier: ['staff'],
}

// Libellé pluriel des classes qui peuvent porter chaque famille d'arme (message de restriction).
export const WEAPON_WEARERS_LABEL: Record<WeaponType, string> = {
  sword: 'épéistes',
  bow: 'archers',
  staff: 'mages et novices',
}

// Famille d'arme AFFICHÉE : celle de l'objet équipé s'il y en a un, sinon la famille par défaut de
// la classe (arme de base). Le novice n'a toujours PAS d'arme de base : il PEUT porter un bâton, il
// n'en a pas d'office. La différence compte — trouver son premier bâton reste un moment.
const CLASS_DEFAULT_WEAPON: Record<ClassId, WeaponType | null> = {
  novice: null,
  swordsman: 'sword',
  chevalier: 'sword',
  archer: 'bow',
  chasseur: 'bow',
  mage: 'staff',
  sorcier: 'staff',
}

// true si la classe peut équiper cet objet. Les objets non-weapon (chapeau/armure/accessoire) ne
// sont jamais restreints ; une arme n'est autorisée que si sa famille figure dans CLASS_WEAPON_TYPES.
export function canEquipItem(classId: ClassId, itemId: string): boolean {
  const item = ITEMS[itemId]
  if (!item || item.slot !== 'weapon') return true
  const type = item.weaponType
  if (!type) return true
  return CLASS_WEAPON_TYPES[classId].includes(type)
}

// Message de blocage clair quand une arme n'est pas autorisée pour la classe (« réservé aux mages »).
// Renvoie null si l'objet est en fait équipable (aucun blocage à afficher).
export function equipRestrictionMessage(classId: ClassId, itemId: string): string | null {
  if (canEquipItem(classId, itemId)) return null
  const type = ITEMS[itemId]?.weaponType
  if (!type) return 'Arme non équipable par cette classe.'
  return `Arme réservée aux ${WEAPON_WEARERS_LABEL[type]}.`
}

// Famille d'arme actuellement affichée par le panda (objet équipé prioritaire, sinon arme de base).
export function displayedWeaponType(classId: ClassId, weaponItemId?: string | null): WeaponType | null {
  if (weaponItemId) {
    const t = ITEMS[weaponItemId]?.weaponType
    if (t) return t
  }
  return CLASS_DEFAULT_WEAPON[classId]
}

// Clés de texture d'overlay d'arme : `item` = texture procédurale propre à l'objet équipé (si un
// objet est équipé), `fallback` = texture générique de la classe. Player affiche `item` si sa
// texture existe, sinon `fallback` → l'arme portée est visible, avec repli sûr sur l'arme de classe.
export function weaponTextureKeys(classId: ClassId, weaponItemId?: string | null): { item: string | null; fallback: string } {
  return {
    item: weaponItemId ? `weapon-${weaponItemId}` : null,
    fallback: `weapon-${classId}`,
  }
}

// GROSSE épée (masquée au repos, révélée à l'attaque) : uniquement une lame portée par un épéiste
// (sabreur/chevalier). Les arcs et bâtons restent visibles en permanence.
export function isBigWeapon(classId: ClassId, type: WeaponType | null): boolean {
  return type === 'sword' && (classId === 'swordsman' || classId === 'chevalier')
}

// ─── NIVEAU MINIMUM D'ÉQUIPEMENT ──────────────────────────────────────────────────────────────
//
// Demande du user : « rajoute un niveau min par objet ». Chaque objet porte un `minLevel` (données dans
// data/items.ts) et ne peut être ÉQUIPÉ qu'à partir de ce niveau.
//
// ⚠️ ON N'EMPÊCHE PAS L'ACHAT NI LE BUTIN, seulement le port. Acheter ou looter en avance pour plus tard
// est un plaisir de RPG ; le bloquer transformerait une boutique en mur. Le niveau requis est en revanche
// ÉCRIT sur la fiche de boutique et d'inventaire, pour qu'on ne dépense jamais son or à l'aveugle.

/**
 * Niveau requis pour porter cet objet — DÉDUIT DE SES PERFORMANCES (core/item-level.ts).
 * 1 si l'objet est inconnu : une vieille sauvegarde référençant un objet retiré ne doit pas se bloquer.
 */
export const itemMinLevel = (itemId: string): number => {
  const item = ITEMS[itemId]
  return item ? minLevelOf(item) : 1
}

/** Le joueur est-il assez haut niveau pour porter cet objet ? */
export const meetsLevel = (playerLevel: number, itemId: string): boolean =>
  playerLevel >= itemMinLevel(itemId)

/**
 * Raison unique de blocage à l'équipement, ou null si l'objet est portable.
 * Regroupe les DEUX règles (classe et niveau) : un seul appel, donc impossible d'en oublier une —
 * c'est exactement ce qui serait arrivé en ajoutant le niveau comme vérification séparée à côté.
 */
export function equipBlockReason(classId: ClassId, playerLevel: number, itemId: string): string | null {
  const classe = equipRestrictionMessage(classId, itemId)
  if (classe) return classe
  if (!meetsLevel(playerLevel, itemId)) return `Niveau ${itemMinLevel(itemId)} requis.`
  return null
}
