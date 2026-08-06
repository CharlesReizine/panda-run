import { describe, it, expect } from 'vitest'
import {
  rollDrops, rollChestRareItem, chestRarePool, CHEST_RARE_CHANCE, CHEST_RARE_POOL, MARGE_NIVEAU_COFFRE,
  rollMobLegendary, mobLegendaryPool, MOB_LEGENDARY_CHANCE, MOB_LEGENDARY_SOUS, MOB_LEGENDARY_SUR,
} from '../../src/core/loot'
import { minLevelOf } from '../../src/core/item-level'
import { ITEMS } from '../../src/data/items'
import type { DropEntry } from '../../src/core/types'

const drops: DropEntry[] = [
  { kind: 'gold', chance: 1, min: 5, max: 10 },
  { kind: 'potion', chance: 0.5, min: 1, max: 1 },
  { kind: 'item', itemId: 'epee-bambou', chance: 0.1, min: 1, max: 1 },
  { kind: 'material', materialId: 'minerai-fer', chance: 0.2, min: 1, max: 1 },
]

describe('rollDrops', () => {
  it('rng à 0 : tout drop, quantités min', () => {
    const r = rollDrops(drops, () => 0)
    expect(r.gold).toBe(5)
    expect(r.potions).toBe(1)
    expect(r.items).toEqual(['epee-bambou'])
    expect(r.materials).toEqual(['minerai-fer'])
  })

  it('rng à 0.99 : seul le drop garanti tombe, quantité max', () => {
    const r = rollDrops(drops, () => 0.99)
    expect(r.gold).toBe(10)
    expect(r.potions).toBe(0)
    expect(r.items).toEqual([])
    expect(r.materials).toEqual([])
  })

  it('un DropEntry material à chance 1 sort dans result.materials', () => {
    const r = rollDrops([{ kind: 'material', materialId: 'gemme-brute', chance: 1, min: 1, max: 1 }], () => 0)
    expect(r.materials).toEqual(['gemme-brute'])
  })
})

describe('rollChestRareItem', () => {
  it('le pool ne contient que des équipements épiques/légendaires', () => {
    expect(CHEST_RARE_POOL.length).toBeGreaterThan(0)
    for (const id of CHEST_RARE_POOL) {
      const item = ITEMS[id]!
      expect(item.slot).toBeTruthy()
      expect(['epique', 'legendaire']).toContain(item.rarity)
    }
  })

  it('rng au-dessus du seuil : aucun objet rare (tirage commun)', () => {
    expect(rollChestRareItem(45, () => 0.99)).toBeNull()
    expect(rollChestRareItem(45, () => CHEST_RARE_CHANCE)).toBeNull()
  })

  it('rng sous le seuil : un objet du pool rare est tiré', () => {
    const id = rollChestRareItem(45, () => 0)
    expect(id).not.toBeNull()
    expect(CHEST_RARE_POOL).toContain(id)
  })

  // ── LE COFFRE NE LÂCHE QUE CE QUI A DU SENS LÀ OÙ IL EST ────────────────────────────────────
  //
  // « J'ai l'impression qu'Émile a chopé des objets légendaires de niveau 30 alors qu'il était tout au
  // début du jeu, c'est absurde non ? » — puis la règle : « un monstre devrait pouvoir lâcher que des
  // objets pas trop loin de son niveau ». Le tirage était pire que soupçonné : SOIXANTE-SEPT objets du
  // niveau 1 au 45, uniformément, un coffre sur vingt-cinq.
  //
  // Le vrai dégât n'est pas l'objet inutilisable trente niveaux durant — c'est qu'une fois le niveau
  // atteint, on l'a DÉJÀ, et que tout ce qu'on aurait pu convoiter entre-temps ne vaut plus rien.
  it('un coffre de début de jeu ne lâche jamais un objet de fin de jeu', () => {
    for (const id of chestRarePool(1)) {
      expect(minLevelOf(ITEMS[id]!), `${id} tombe au niveau 1`).toBeLessThanOrEqual(1 + MARGE_NIVEAU_COFFRE)
    }
  })

  it('le pool grandit avec le niveau du lieu, et couvre tout à la fin', () => {
    const tailles = [1, 10, 20, 30, 45].map((n) => chestRarePool(n).length)
    expect(tailles).toEqual([...tailles].sort((a, b) => a - b)) // monotone croissante
    expect(chestRarePool(45).length).toBe(CHEST_RARE_POOL.length) // au bout, plus rien n'est retenu
    expect(tailles[0]).toBeLessThan(tailles[tailles.length - 1]!)
  })

  it("le pool n'est JAMAIS vide, même au niveau 1", () => {
    for (let n = 1; n <= 45; n++) expect(chestRarePool(n).length, `niveau ${n}`).toBeGreaterThan(0)
  })

  it('le tirage respecte le niveau du lieu', () => {
    // rng = 0 → on tire le premier du pool ; rng juste sous 1 → le dernier. Les deux bouts doivent
    // rester sous le plafond, sinon le filtre serait appliqué à la probabilité mais pas au choix.
    for (const alea of [0, 0.999]) {
      const id = rollChestRareItem(3, () => (alea === 0 ? 0 : 0.001 + alea * 0))
      if (id) expect(minLevelOf(ITEMS[id]!)).toBeLessThanOrEqual(3 + MARGE_NIVEAU_COFFRE)
    }
    const tires = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const id = rollChestRareItem(3, (() => { let k = 0; return () => (k++ === 0 ? 0 : (i % 97) / 97) })())
      if (id) tires.add(id)
    }
    for (const id of tires) expect(minLevelOf(ITEMS[id]!), id).toBeLessThanOrEqual(3 + MARGE_NIVEAU_COFFRE)
  })

  it('la probabilité reste basse (événement rare)', () => {
    expect(CHEST_RARE_CHANCE).toBeLessThanOrEqual(0.05)
  })

  // ── UN MONSTRE PEUT LÂCHER UN LÉGENDAIRE DE SON NIVEAU, TRÈS TRÈS RAREMENT ──────────────────
  //
  // « Les mobs peuvent peut-être également drop du légendaire de leur niveau avec un très très très
  // faible taux. » C'est la contrepartie du bornage des coffres : une porte plus étroite, mais méritée.
  it('le taux reste de l\'ordre du millième', () => {
    expect(MOB_LEGENDARY_CHANCE).toBeLessThanOrEqual(0.002)
    expect(MOB_LEGENDARY_CHANCE).toBeGreaterThan(0)
    // et il est BIEN plus rare que le coffre, sinon la bête volerait la vedette au trésor
    expect(MOB_LEGENDARY_CHANCE).toBeLessThan(CHEST_RARE_CHANCE / 5)
  })

  it('le coffre est devenu moins fréquent', () => {
    expect(CHEST_RARE_CHANCE).toBeLessThanOrEqual(0.02)
  })

  it('rien ne tombe au-dessus du seuil', () => {
    expect(rollMobLegendary(40, () => 0.5)).toBeNull()
    expect(rollMobLegendary(40, () => MOB_LEGENDARY_CHANCE)).toBeNull()
  })

  it('la fenêtre est bornée DES DEUX CÔTÉS — pas de trophée dérisoire sur une grosse bête', () => {
    for (const niveau of [1, 7, 15, 20, 25, 31, 38, 45]) {
      for (const id of mobLegendaryPool(niveau)) {
        const n = minLevelOf(ITEMS[id]!)
        expect(n, `${id} sur une bête de niveau ${niveau}`).toBeGreaterThanOrEqual(niveau - MOB_LEGENDARY_SOUS)
        expect(n, `${id} sur une bête de niveau ${niveau}`).toBeLessThanOrEqual(niveau + MOB_LEGENDARY_SUR)
      }
    }
  })

  it('ne lâche QUE du légendaire', () => {
    for (const niveau of [1, 10, 20, 30, 45]) {
      for (const id of mobLegendaryPool(niveau)) expect(ITEMS[id]!.rarity, id).toBe('legendaire')
    }
  })

  it("une fenêtre vide ne lâche rien, plutôt que n'importe quoi", () => {
    for (let n = 1; n <= 50; n++) {
      const tire = rollMobLegendary(n, () => 0)
      if (mobLegendaryPool(n).length === 0) expect(tire, `niveau ${n}`).toBeNull()
      else expect(mobLegendaryPool(n), `niveau ${n}`).toContain(tire)
    }
  })
})