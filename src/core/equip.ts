import type { ClassId, WeaponType } from './types'
import { ITEMS } from '../data/items'

// Familles d'armes autorisées par classe. Une classe ne peut équiper que les armes de sa spécialité :
// les épéistes (sabreur/chevalier) les lames, les archers (archer/chasseur) les arcs, les mages
// (mage/sorcier) les bâtons. Le novice garde son arme de base (aucun objet weapon équipable).
export const CLASS_WEAPON_TYPES: Record<ClassId, WeaponType[]> = {
  novice: [],
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
  staff: 'mages',
}

// Famille d'arme AFFICHÉE : celle de l'objet équipé s'il y en a un, sinon la famille par défaut de
// la classe (arme de base). Le novice n'a pas de famille par défaut (aucune arme).
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
