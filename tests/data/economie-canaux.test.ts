import { describe, it, expect } from 'vitest'
import { ITEMS } from '../../src/data/items'
import { MATERIALS } from '../../src/data/materials'
import { RECIPES } from '../../src/data/recipes'
import { MONSTERS } from '../../src/data/monsters'
import { SHOP_BY_TOWN } from '../../src/data/shops'
import { minLevelOf, itemPower } from '../../src/core/item-level'
import type { ItemDef } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// TROIS CANAUX D'ÉQUIPEMENT — CHACUN DOIT AVOIR UN INTÉRÊT
//
// Demande du user : « repense un peu le crafting et l'achat. En gros il faut qu'il y ait un intérêt à
// chacun. Il doit y avoir un peu de tous les niveaux partout, et les plus stylés ça ne peut être que du
// craft TRÈS TRÈS dur à faire, ou alors du farming. »
//
// Constat qui a motivé la refonte, mesuré sur les données : 26 des 29 objets LÉGENDAIRES étaient
// simplement en vente. Accumuler de l'or suffisait donc à tout obtenir, et ni le farm ni la forge ne
// servaient pour le haut du panier.
//
//   BOUTIQUE → fiable, immédiat, sans hasard, mais PLAFONNÉE à l'épique. C'est le canal qui garantit
//              qu'on n'est jamais bloqué, à n'importe quel niveau.
//   FORGE    → des exclusivités à chaque palier, et l'un des deux seuls accès aux légendaires.
//   FARM     → butins signature légendaires sur les élites et les boss.
//
// Ces tests verrouillent le PARTAGE DES RÔLES, pas des valeurs : rééquilibrer un prix ou une quantité
// reste libre, remettre un légendaire en vitrine échoue.

const tous = Object.values(ITEMS)
const enVente = new Set(
  Object.values(SHOP_BY_TOWN).flatMap((t) => [...t.weapons, ...t.armors, ...t.hats].map((e) => e.itemId)),
)
const forgeables = new Set(RECIPES.map((r) => r.resultItemId))
const droppes = new Set(
  Object.values(MONSTERS).flatMap((m) => m.drops.filter((d) => d.kind === 'item').map((d) => d.itemId!)),
)

const legendaires = tous.filter((i) => i.rarity === 'legendaire')
const palier = (i: ItemDef) => minLevelOf(i)

describe('la boutique est plafonnée', () => {
  it('AUCUN légendaire en vitrine — l\'or n\'achète pas le haut du panier', () => {
    const vendus = legendaires.filter((i) => enVente.has(i.id)).map((i) => i.id)
    expect(vendus, `légendaire(s) en vente : ${vendus.join(', ')}`).toEqual([])
  })

  it('mais elle couvre tous les paliers : on n\'est jamais bloqué faute d\'équipement', () => {
    // Un palier « couvert » = au moins un objet achetable qui s'y débloque. Sans ça, retirer les
    // légendaires aurait pu laisser un trou de progression où plus rien n'est achetable.
    const paliers = new Set(tous.filter((i) => enVente.has(i.id)).map(palier))
    for (const p of [1, 2, 4, 7, 11, 15, 19, 25, 31]) {
      expect(paliers.has(p), `aucun objet achetable au palier Nv ${p}`).toBe(true)
    }
  })

  it('chaque emplacement est achetable à bas niveau : aucune classe ne démarre nue', () => {
    for (const slot of ['weapon', 'armor', 'hat', 'accessory'] as const) {
      const tot = tous.filter((i) => i.slot === slot && enVente.has(i.id) && palier(i) <= 4)
      expect(tot.length, `rien à acheter tôt en ${slot}`).toBeGreaterThan(0)
    }
  })
})

describe('la forge a un intérêt propre', () => {
  it('elle a des EXCLUSIVITÉS : des objets forgeables qu\'aucune boutique ne vend', () => {
    const exclusifs = [...forgeables].filter((id) => !enVente.has(id))
    expect(exclusifs.length, 'la forge ne fabrique que des objets déjà en vente').toBeGreaterThan(10)
  })

  it('ses exclusivités s\'étalent sur plusieurs paliers, pas seulement en fin de partie', () => {
    const paliers = new Set(
      [...forgeables].filter((id) => !enVente.has(id)).map((id) => palier(ITEMS[id]!)),
    )
    expect(paliers.size, `paliers couverts par la forge : ${[...paliers].sort((a, b) => a - b)}`).toBeGreaterThanOrEqual(4)
  })

  it('à palier égal, la forge propose au moins aussi puissant que la boutique', () => {
    // Sinon forger serait un détour coûteux pour un résultat inférieur, et le canal n'aurait aucun sens.
    const parPalier = new Map<number, { boutique: number; forge: number }>()
    for (const i of tous) {
      const p = palier(i)
      const e = parPalier.get(p) ?? { boutique: 0, forge: 0 }
      if (enVente.has(i.id)) e.boutique = Math.max(e.boutique, itemPower(i.bonus))
      if (forgeables.has(i.id)) e.forge = Math.max(e.forge, itemPower(i.bonus))
      parPalier.set(p, e)
    }
    for (const [p, e] of parPalier) {
      if (e.forge === 0) continue // pas de recette à ce palier : rien à comparer
      expect(e.forge, `au palier Nv ${p}, la forge est plus faible que la boutique`).toBeGreaterThanOrEqual(e.boutique)
    }
  })

  it('chaque emplacement a au moins une recette : aucune classe n\'est privée de forge', () => {
    for (const slot of ['weapon', 'armor', 'hat', 'accessory'] as const) {
      const n = [...forgeables].filter((id) => ITEMS[id]!.slot === slot).length
      expect(n, `aucune recette pour ${slot}`).toBeGreaterThan(0)
    }
  })
})

describe('les légendaires ne s\'obtiennent que par la forge ou le farm', () => {
  it('chaque légendaire a AU MOINS une source', () => {
    const orphelins = legendaires
      .filter((i) => !forgeables.has(i.id) && !droppes.has(i.id))
      .map((i) => i.id)
    expect(orphelins, `légendaire(s) inobtenable(s) : ${orphelins.join(', ')}`).toEqual([])
  })

  it('les deux voies sont réellement utilisées — pas 29 recettes et zéro butin', () => {
    const parForge = legendaires.filter((i) => forgeables.has(i.id)).length
    const parFarm = legendaires.filter((i) => droppes.has(i.id)).length
    expect(parForge, 'aucun légendaire forgeable').toBeGreaterThan(0)
    expect(parFarm, 'aucun légendaire à farmer').toBeGreaterThan(0)
  })

  it('un légendaire qui tombe ne tombe que sur une ÉLITE ou un BOSS, et rarement', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind !== 'item' || ITEMS[d.itemId!]?.rarity !== 'legendaire') continue
        expect(m.mvp || m.boss, `${m.id} n'est ni élite ni boss et lâche ${d.itemId}`).toBe(true)
        expect(d.chance, `${m.id} → ${d.itemId} trop généreux`).toBeLessThanOrEqual(0.03)
      }
    }
  })

  it('une recette légendaire est TRÈS dure : gros volume, deux trophées, or conséquent', () => {
    const legRecettes = RECIPES.filter((r) => ITEMS[r.resultItemId]!.rarity === 'legendaire')
    expect(legRecettes.length).toBeGreaterThan(0)
    for (const r of legRecettes) {
      const total = Object.values(r.materials).reduce((a, b) => a + b, 0)
      const rares = Object.entries(r.materials)
        .filter(([id]) => MATERIALS[id]!.rarity === 'rare')
        .reduce((a, [, q]) => a + q, 0)
      expect(total, `${r.id} : trop peu de matières (${total})`).toBeGreaterThanOrEqual(20)
      expect(rares, `${r.id} : pas assez de trophées rares (${rares})`).toBeGreaterThanOrEqual(5)
      expect(r.gold ?? 0, `${r.id} : or trop faible`).toBeGreaterThanOrEqual(2000)
    }
  })

  it('forger un légendaire coûte nettement plus qu\'un épique — l\'écart doit se sentir', () => {
    const or = (rar: string) => RECIPES.filter((r) => ITEMS[r.resultItemId]!.rarity === rar).map((r) => r.gold ?? 0)
    expect(Math.min(...or('legendaire'))).toBeGreaterThan(Math.max(...or('epique')) * 2)
  })
})
