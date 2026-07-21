import { describe, it, expect } from 'vitest'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, HAT_SHOP, QUESTS, buyPrice, sellPrice } from '../../src/data/shops'
import { ITEMS, RARITY_PRICE } from '../../src/data/items'
import type { Rarity } from '../../src/core/types'

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
    for (const entry of HAT_SHOP) {
      expect(ITEMS[entry.itemId]).toBeDefined()
      expect(ITEMS[entry.itemId]!.slot).toBe('hat')
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

describe('prix par rareté', () => {
  it('le barème croît strictement avec la rareté', () => {
    const order: Rarity[] = ['commun', 'rare', 'epique', 'legendaire']
    for (let i = 1; i < order.length; i++) {
      expect(RARITY_PRICE[order[i]!]).toBeGreaterThan(RARITY_PRICE[order[i - 1]!])
    }
  })

  it('buyPrice renvoie le prix boutique, sinon retombe sur le barème par rareté', () => {
    expect(buyPrice('epee-bambou')).toBe(WEAPON_SHOP[0]!.price)
    // objet forgé, absent des boutiques → repli sur la rareté
    expect(buyPrice('lame-scorpion')).toBe(RARITY_PRICE[ITEMS['lame-scorpion']!.rarity ?? 'commun'])
  })

  it('sellPrice vaut 50 % du prix d\'achat (arrondi)', () => {
    for (const id of Object.keys(ITEMS)) {
      expect(sellPrice(id)).toBe(Math.round(buyPrice(id) * 0.5))
    }
  })
})
