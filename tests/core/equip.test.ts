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

  // ⚠️ LE NOVICE PORTE LE BÂTON — sa liste d'armes était VIDE, et c'était un vide, pas un choix.
  // « Il faut que le bâton devienne une arme de novice, sinon y en a pas et c'est booooring. » Il avait
  // raison sur les deux plans : on jouait les premiers niveaux à mains nues, et surtout TOUT le butin
  // d'arme était refusé — la découverte du jeu devenait une série de messages de blocage.
  //
  // Le bâton et pas l'épée : c'est l'arme la plus faible des trois familles, celle qu'on abandonne sans
  // regret en se spécialisant. Un novice qui garde son bâton en devenant épéiste PERD son arme, ce qui
  // rend le choix de classe lisible plutôt que gratuit.
  it('le novice porte le bâton, et lui seul', () => {
    expect(canEquipItem('novice', 'baton-feuillu')).toBe(true)
    expect(canEquipItem('novice', 'baton-de-novice')).toBe(true)
    expect(canEquipItem('novice', 'epee-bambou')).toBe(false)
    expect(canEquipItem('novice', 'arc-souple')).toBe(false)
  })

  it("le novice n'a toujours pas d'arme de BASE — il peut en porter une, il n'en a pas d'office", () => {
    expect(displayedWeaponType('novice', null)).toBeNull()
    expect(displayedWeaponType('novice', 'baton-feuillu')).toBe('staff')
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
    expect(equipRestrictionMessage('archer', 'baton-cristal')).toBe('Arme réservée aux mages et novices.')
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
