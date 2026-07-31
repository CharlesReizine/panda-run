import { describe, it, expect } from 'vitest'
import { PROPS } from '../../src/data/props'
import { MATERIALS } from '../../src/data/materials'
import { ITEMS } from '../../src/data/items'

describe('données props', () => {
  it('les décors attendus sont là, coffres compris', () => {
    expect(Object.keys(PROPS).sort()).toEqual(['champignon', 'coffre', 'coffre-fer', 'coffre-or', 'herbe', 'roche'])
  })

  // ── LES TROIS PALIERS DE COFFRE ────────────────────────────────────────────────────────────────
  // Demande du user : « 3 types de coffres avec des raretés différentes, des styles différents ; plus c'est
  // rare plus ça a un glow stylé et une image stylée, et ça drop des trucs rares ».
  // Ce qui se teste ici, c'est la MONOTONIE du butin : un palier supérieur doit valoir davantage, sinon les
  // trois coffres ne se distinguent que par leur peinture.
  describe('paliers de coffre', () => {
    const paliers = ['coffre', 'coffre-fer', 'coffre-or'] as const
    const orMoyen = (id: string) => {
      const p = PROPS[id]!
      return p.drops.filter((d) => d.kind === 'gold').reduce((a, d) => a + d.chance * (d.min + d.max) / 2, 0)
    }
    const valeurObjets = (id: string) => {
      const p = PROPS[id]!
      const poids = { commun: 1, rare: 4, epique: 12, legendaire: 40 } as const
      return p.drops.filter((d) => d.kind === 'item').reduce((a, d) => a + d.chance * poids[ITEMS[d.itemId!]!.rarity ?? 'commun'], 0)
    }

    it('chaque palier a bien son marqueur — c\'est lui qui pilote texture, lueur ET butin', () => {
      expect(paliers.map((id) => PROPS[id]!.tier)).toEqual(['bois', 'fer', 'or'])
    })

    it('l\'or monte STRICTEMENT d\'un palier au suivant', () => {
      for (let i = 1; i < paliers.length; i++) {
        expect(orMoyen(paliers[i]!), paliers[i]).toBeGreaterThan(orMoyen(paliers[i - 1]!))
      }
    })

    it('la valeur des objets monte STRICTEMENT d\'un palier au suivant', () => {
      for (let i = 1; i < paliers.length; i++) {
        expect(valeurObjets(paliers[i]!), paliers[i]).toBeGreaterThan(valeurObjets(paliers[i - 1]!))
      }
    })

    it('seul le palier LE PLUS RARE peut contenir un légendaire, et rarement', () => {
      for (const id of paliers) {
        for (const d of PROPS[id]!.drops) {
          if (d.kind !== 'item' || ITEMS[d.itemId!]?.rarity !== 'legendaire') continue
          expect(PROPS[id]!.tier, `${id} lâche un légendaire`).toBe('or')
          expect(d.chance, `${id} → ${d.itemId} trop généreux`).toBeLessThanOrEqual(0.05)
        }
      }
    })

    it('un coffre ne lâche jamais un objet sans illustration : c\'est un moment mis en scène', () => {
      // les objets en attente d'illustration existent (docs/art-a-generer.md) ; un coffre qui révélerait
      // une pastille de couleur gâcherait précisément l'effet qu'il produit
      for (const id of paliers) {
        for (const d of PROPS[id]!.drops) {
          if (d.kind === 'item') expect(ITEMS[d.itemId!], `${id}:${d.itemId}`).toBeDefined()
        }
      }
    })
  })

  it('les drops material des props pointent des matériaux existants', () => {
    for (const p of Object.values(PROPS)) {
      for (const d of p.drops) {
        if (d.kind === 'material') expect(MATERIALS[d.materialId!], `${p.id}:${d.materialId}`).toBeDefined()
        if (d.kind === 'item') expect(ITEMS[d.itemId!], `${p.id}:${d.itemId}`).toBeDefined()
      }
    }
  })

  it('hp positifs', () => {
    for (const p of Object.values(PROPS)) expect(p.hp).toBeGreaterThan(0)
  })
})
