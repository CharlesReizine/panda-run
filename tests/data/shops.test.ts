import { describe, it, expect } from 'vitest'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, HAT_SHOP, SHOP_BY_TOWN, getTownStock, QUESTS, buyPrice, sellPrice } from '../../src/data/shops'
import { ITEMS, RARITY_PRICE } from '../../src/data/items'
import { newPlayer } from '../../src/core/player-state'
import { sellItem, sellValue } from '../../src/core/reforge'
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

describe('stock par ville (Prontera ≠ Morocc)', () => {
  const ids = (entries: { itemId: string }[]) => entries.map((e) => e.itemId).sort()

  it('Prontera et Morocc existent et exposent chacun armes / armures / chapeaux', () => {
    for (const town of ['prontera', 'morocc'] as const) {
      const stock = SHOP_BY_TOWN[town]!
      expect(stock.weapons.length).toBeGreaterThan(0)
      expect(stock.armors.length).toBeGreaterThan(0)
      expect(stock.hats.length).toBeGreaterThan(0)
    }
  })

  it('les deux villes proposent des listes DIFFÉRENTES (armes, armures, chapeaux)', () => {
    const pro = SHOP_BY_TOWN['prontera']!
    const mor = SHOP_BY_TOWN['morocc']!
    expect(ids(pro.weapons)).not.toEqual(ids(mor.weapons))
    expect(ids(pro.armors)).not.toEqual(ids(mor.armors))
    expect(ids(pro.hats)).not.toEqual(ids(mor.hats))
  })

  it('Morocc (mid) ne revend PAS les armes de base de Prontera (early)', () => {
    const proWeapons = new Set(ids(SHOP_BY_TOWN['prontera']!.weapons))
    for (const e of SHOP_BY_TOWN['morocc']!.weapons) expect(proWeapons.has(e.itemId)).toBe(false)
    // et Prontera n'écoule aucun objet purement commun de… en fait ses trois armes de base sont bien communes
    const baseIds = ['epee-bambou', 'arc-souple', 'baton-feuillu']
    for (const b of baseIds) expect(proWeapons.has(b)).toBe(true)
  })

  it('chaque objet en stock existe dans ITEMS et est du bon emplacement', () => {
    for (const stock of Object.values(SHOP_BY_TOWN)) {
      for (const e of stock.weapons) expect(ITEMS[e.itemId]!.slot).toBe('weapon')
      for (const e of stock.armors) expect(['armor', 'accessory']).toContain(ITEMS[e.itemId]!.slot)
      for (const e of stock.hats) expect(ITEMS[e.itemId]!.slot).toBe('hat')
      for (const e of [...stock.weapons, ...stock.armors, ...stock.hats]) expect(e.price).toBeGreaterThan(0)
    }
  })

  it('getTownStock retombe proprement sur Prontera pour une ville inconnue', () => {
    expect(getTownStock('ville-inexistante')).toBe(SHOP_BY_TOWN['prontera'])
    expect(getTownStock('morocc')).toBe(SHOP_BY_TOWN['morocc'])
  })
})

describe('vente accessible hors forge (n\'importe quelle boutique)', () => {
  it('un objet acheté à l\'armurerie se revend à 50 % du prix boutique', () => {
    // une arme vendue à l'armurerie de Prontera (échoppe NON-forge) doit pouvoir être revendue
    const armWeapon = SHOP_BY_TOWN['prontera']!.weapons[0]!
    const p = newPlayer('Panda')
    p.gold = 0
    p.inventory = [armWeapon.itemId]
    const expected = Math.round(armWeapon.price * 0.5)
    expect(sellValue(ITEMS[armWeapon.itemId]!)).toBe(expected)
    expect(sellItem(p, 0)).toBe(true)
    expect(p.gold).toBe(expected)
    expect(p.inventory).toHaveLength(0)
  })

  it('la revente ne dépend pas de la ville : même objet, même valeur partout', () => {
    // amulette-pharaon est en stock à Morocc ; sa revente = 50 % de son prix, indépendamment du lieu
    const entry = SHOP_BY_TOWN['morocc']!.armors.find((e) => e.itemId === 'amulette-pharaon')!
    expect(sellValue(ITEMS['amulette-pharaon']!)).toBe(Math.round(entry.price * 0.5))
  })
})
