import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { buyPotion, buyItem } from '../../src/core/shop'
import { POTION_PRICE } from '../../src/data/shops'

describe('shop', () => {
  it('achète une potion si assez d\'or', () => {
    const p = newPlayer('Panda')
    p.gold = POTION_PRICE
    expect(buyPotion(p)).toBe(true)
    expect(p.gold).toBe(0)
    expect(p.potions).toBe(2) // 1 de départ + 1 achetée
  })

  it('refuse l\'achat de potion si pas assez d\'or', () => {
    const p = newPlayer('Panda')
    p.gold = POTION_PRICE - 1
    expect(buyPotion(p)).toBe(false)
    expect(p.gold).toBe(POTION_PRICE - 1)
    expect(p.potions).toBe(1)
  })

  it('achète un objet et l\'ajoute à l\'inventaire', () => {
    const p = newPlayer('Panda')
    p.gold = 100
    expect(buyItem(p, 'epee-bambou', 80)).toBe(true)
    expect(p.gold).toBe(20)
    expect(p.inventory).toEqual(['epee-bambou'])
  })

  it('refuse l\'achat d\'objet si pas assez d\'or', () => {
    const p = newPlayer('Panda')
    p.gold = 10
    expect(buyItem(p, 'griffe-royale', 300)).toBe(false)
    expect(p.gold).toBe(10)
    expect(p.inventory).toEqual([])
  })
})
