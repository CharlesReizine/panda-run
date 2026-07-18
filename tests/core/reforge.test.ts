import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import {
  MAX_REFORGE_LEVEL,
  upgradedBonus,
  reforgeCost,
  canReforge,
  doReforge,
  sellValue,
  sellItem,
} from '../../src/core/reforge'
import { ITEMS } from '../../src/data/items'

describe('reforgeCost', () => {
  it('croît strictement en or et en matériaux avec le niveau', () => {
    for (let lv = 0; lv < MAX_REFORGE_LEVEL - 1; lv++) {
      const a = reforgeCost(lv)
      const b = reforgeCost(lv + 1)
      expect(b.gold).toBeGreaterThan(a.gold)
      expect(b.materials['minerai-fer']!).toBeGreaterThan(a.materials['minerai-fer']!)
    }
  })
})

describe('upgradedBonus', () => {
  it('applique +20 % par niveau, arrondi (5 ATK à +3 → 8)', () => {
    expect(upgradedBonus({ atk: 5 }, 3)).toEqual({ atk: 8 })
  })

  it('niveau 0 = bonus de base', () => {
    expect(upgradedBonus({ atk: 5, def: 4 }, 0)).toEqual({ atk: 5, def: 4 })
  })

  it('plafonne le niveau à MAX_REFORGE_LEVEL', () => {
    expect(upgradedBonus({ atk: 10 }, 999)).toEqual(upgradedBonus({ atk: 10 }, MAX_REFORGE_LEVEL))
  })
})

describe('canReforge', () => {
  it('true avec assez d\'or et de matériaux', () => {
    const p = newPlayer('Panda')
    p.gold = 100
    p.materials = { 'minerai-fer': 5, 'herbe-tendre': 5 }
    expect(canReforge(p, 'epee-bambou')).toBe(true)
  })

  it('false sans assez de matériaux', () => {
    const p = newPlayer('Panda')
    p.gold = 100
    p.materials = { 'minerai-fer': 1 }
    expect(canReforge(p, 'epee-bambou')).toBe(false)
  })

  it('false sans assez d\'or', () => {
    const p = newPlayer('Panda')
    p.gold = 0
    p.materials = { 'minerai-fer': 5, 'herbe-tendre': 5 }
    expect(canReforge(p, 'epee-bambou')).toBe(false)
  })

  it('false au niveau max', () => {
    const p = newPlayer('Panda')
    p.gold = 100000
    p.materials = { 'minerai-fer': 1000, 'herbe-tendre': 1000 }
    p.upgrades = { 'epee-bambou': MAX_REFORGE_LEVEL }
    expect(canReforge(p, 'epee-bambou')).toBe(false)
  })
})

describe('doReforge', () => {
  it('débite or + matériaux et incrémente le niveau', () => {
    const p = newPlayer('Panda')
    p.gold = 100
    p.materials = { 'minerai-fer': 5, 'herbe-tendre': 5 }
    const cost = reforgeCost(0)
    expect(doReforge(p, 'epee-bambou')).toBe(true)
    expect(p.gold).toBe(100 - cost.gold)
    expect(p.materials['minerai-fer']).toBe(5 - cost.materials['minerai-fer']!)
    expect(p.materials['herbe-tendre']).toBe(5 - cost.materials['herbe-tendre']!)
    expect(p.upgrades['epee-bambou']).toBe(1)
  })

  it('refuse et ne mute rien si ressources insuffisantes', () => {
    const p = newPlayer('Panda')
    p.gold = 0
    p.materials = { 'minerai-fer': 5, 'herbe-tendre': 5 }
    expect(doReforge(p, 'epee-bambou')).toBe(false)
    expect(p.gold).toBe(0)
    expect(p.materials).toEqual({ 'minerai-fer': 5, 'herbe-tendre': 5 })
    expect(p.upgrades['epee-bambou']).toBeUndefined()
  })
})

describe('sellValue', () => {
  it('renvoie le prix selon la rareté', () => {
    expect(sellValue(ITEMS['epee-bambou']!)).toBe(20) // commun
    expect(sellValue(ITEMS['carapace-scarabee']!)).toBe(60) // rare
    expect(sellValue(ITEMS['griffe-royale']!)).toBe(150) // épique
    expect(sellValue(ITEMS['lame-scorpion']!)).toBe(400) // légendaire
  })
})

describe('sellItem', () => {
  it('retire l\'objet de l\'inventaire et crédite l\'or', () => {
    const p = newPlayer('Panda')
    p.gold = 10
    p.inventory = ['epee-bambou', 'griffe-royale']
    expect(sellItem(p, 0)).toBe(true)
    expect(p.inventory).toEqual(['griffe-royale'])
    expect(p.gold).toBe(10 + 20)
  })

  it('refuse un index invalide sans muter', () => {
    const p = newPlayer('Panda')
    p.gold = 10
    p.inventory = ['epee-bambou']
    expect(sellItem(p, 5)).toBe(false)
    expect(p.inventory).toEqual(['epee-bambou'])
    expect(p.gold).toBe(10)
  })
})
