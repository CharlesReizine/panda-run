import { describe, it, expect } from 'vitest'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, QUESTS } from '../../src/data/shops'
import { ITEMS } from '../../src/data/items'

describe('données boutiques', () => {
  it('prix de la potion positif', () => {
    expect(POTION_PRICE).toBeGreaterThan(0)
  })

  it('les objets en vente existent dans ITEMS et sont du bon slot', () => {
    for (const entry of WEAPON_SHOP) {
      expect(ITEMS[entry.itemId]).toBeDefined()
      expect(ITEMS[entry.itemId]!.slot).toBe('weapon')
      expect(entry.price).toBeGreaterThan(0)
    }
    for (const entry of ARMOR_SHOP) {
      expect(ITEMS[entry.itemId]).toBeDefined()
      expect(['armor', 'accessory']).toContain(ITEMS[entry.itemId]!.slot)
      expect(entry.price).toBeGreaterThan(0)
    }
  })

  it('au moins une quête définie, cible et récompense positives', () => {
    const all = Object.values(QUESTS)
    expect(all.length).toBeGreaterThan(0)
    for (const q of all) {
      expect(q.targetCount).toBeGreaterThan(0)
      expect(q.rewardGold).toBeGreaterThan(0)
    }
  })

  it('la clé du record de quêtes correspond à l id', () => {
    for (const [key, q] of Object.entries(QUESTS)) expect(q.id).toBe(key)
  })
})
