import { describe, it, expect } from 'vitest'
import {
  canEquipItem,
  equipRestrictionMessage,
  displayedWeaponType,
  weaponTextureKeys,
  isBigWeapon,
} from '../../src/core/equip'

describe('restriction arme ↔ classe', () => {
  it('un mage ne peut équiper qu\'un bâton', () => {
    expect(canEquipItem('mage', 'baton-cristal')).toBe(true)
    expect(canEquipItem('mage', 'katana-eclair')).toBe(false) // épée
    expect(canEquipItem('mage', 'arc-souple')).toBe(false) // arc
  })

  it('un épéiste ne peut équiper qu\'une lame', () => {
    for (const cls of ['swordsman', 'chevalier'] as const) {
      expect(canEquipItem(cls, 'katana-eclair')).toBe(true)
      expect(canEquipItem(cls, 'arc-souple')).toBe(false)
      expect(canEquipItem(cls, 'baton-cristal')).toBe(false)
    }
  })

  it('un archer ne peut équiper qu\'un arc', () => {
    for (const cls of ['archer', 'chasseur'] as const) {
      expect(canEquipItem(cls, 'arc-souple')).toBe(true)
      expect(canEquipItem(cls, 'katana-eclair')).toBe(false)
      expect(canEquipItem(cls, 'baton-cristal')).toBe(false)
    }
  })

  it('le novice ne peut équiper aucune arme (arme de base seulement)', () => {
    expect(canEquipItem('novice', 'epee-bambou')).toBe(false)
    expect(canEquipItem('novice', 'arc-souple')).toBe(false)
    expect(canEquipItem('novice', 'baton-feuillu')).toBe(false)
  })

  it('les objets non-weapon ne sont jamais restreints', () => {
    for (const cls of ['novice', 'mage', 'archer', 'swordsman'] as const) {
      expect(canEquipItem(cls, 'sakkat')).toBe(true) // chapeau
      expect(canEquipItem(cls, 'plastron-fer')).toBe(true) // armure
      expect(canEquipItem(cls, 'amulette-gemme')).toBe(true) // accessoire
    }
  })

  it('le message de blocage cible la bonne famille, null si autorisé', () => {
    expect(equipRestrictionMessage('mage', 'katana-eclair')).toBe('Arme réservée aux épéistes.')
    expect(equipRestrictionMessage('swordsman', 'arc-souple')).toBe('Arme réservée aux archers.')
    expect(equipRestrictionMessage('archer', 'baton-cristal')).toBe('Arme réservée aux mages.')
    expect(equipRestrictionMessage('mage', 'baton-cristal')).toBeNull()
    expect(equipRestrictionMessage('swordsman', 'sakkat')).toBeNull()
  })
})

describe('overlay d\'arme reflète l\'item équipé', () => {
  it('la texture d\'arme préfère l\'objet équipé (weapon-<itemId>)', () => {
    expect(weaponTextureKeys('swordsman', 'katana-eclair')).toEqual({
      item: 'weapon-katana-eclair',
      fallback: 'weapon-swordsman',
    })
    // deux épées distinctes → deux clés de texture distinctes
    expect(weaponTextureKeys('swordsman', 'epee-bambou').item).toBe('weapon-epee-bambou')
  })

  it('sans objet équipé, repli sur l\'arme générique de classe', () => {
    expect(weaponTextureKeys('mage', null)).toEqual({ item: null, fallback: 'weapon-mage' })
  })

  it('la famille affichée suit l\'objet équipé, sinon la classe', () => {
    expect(displayedWeaponType('swordsman', 'baton-cristal')).toBe('staff') // objet prioritaire
    expect(displayedWeaponType('swordsman', null)).toBe('sword') // défaut classe
    expect(displayedWeaponType('archer', null)).toBe('bow')
    expect(displayedWeaponType('novice', null)).toBeNull()
  })

  it('grosse épée = lame portée par un épéiste uniquement', () => {
    expect(isBigWeapon('swordsman', 'sword')).toBe(true)
    expect(isBigWeapon('chevalier', 'sword')).toBe(true)
    expect(isBigWeapon('mage', 'sword')).toBe(false) // un mage ne porte pas de grosse épée
    expect(isBigWeapon('archer', 'bow')).toBe(false)
    expect(isBigWeapon('swordsman', 'staff')).toBe(false)
  })
})
