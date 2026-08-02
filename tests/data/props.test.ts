import { describe, it, expect } from 'vitest'
import { PROPS, estCoffre } from '../../src/data/props'
import { LEVELS } from '../../src/data/levels'
import { groundRowFor } from '../../src/core/platforming'
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUN PROP N'EST ENCHÂSSÉ DANS LA MATIÈRE
//
// Retour du user sur Vallon : « y a un trésor qui est collé à de la pierre et c'est bizarre ». Un prop
// sans altitude était lâché à `groundRow − 1` sans regarder ce qui s'y trouvait ; quand une dalle de
// roche occupait cette rangée, le coffre finissait dedans. Quatre coffres sur 132 étaient dans ce cas.
//
// Le test parcourt TOUS les terrains parce que le défaut n'était visible que sur quatre d'entre eux :
// une vérification par échantillon serait passée à côté, et c'est exactement ce qui s'est produit —
// personne ne l'a vu avant que le user tombe dessus en jouant.
describe('les props se posent sur la surface, jamais dedans', () => {
  const dansLaMatiere = (l: (typeof LEVELS)[string], pr: { x: number; y?: number }) => {
    const y = pr.y ?? groundRowFor(l.heightTiles) - 1
    return (l.rockBands ?? []).some((r) => pr.x >= r.x && pr.x < r.x + r.w && y >= r.y && y < r.y + r.h)
      || l.platforms.some((p) => pr.x >= p.x && pr.x < p.x + p.w && p.y === y)
  }

  it('aucun coffre n\'est enchâssé dans la roche ou dans une plateforme', () => {
    const fautifs: string[] = []
    for (const l of Object.values(LEVELS)) {
      for (const pr of (l.props ?? []).filter((p) => estCoffre(p.kind))) {
        if (dansLaMatiere(l, pr)) fautifs.push(`${l.id} : ${pr.kind} en x${pr.x} y${pr.y}`)
      }
    }
    expect(fautifs, fautifs.slice(0, 6).join(' | ')).toEqual([])
  })

  it('aucun prop posé au sol ne tombe sur un trou mortel', () => {
    const fautifs: string[] = []
    for (const l of Object.values(LEVELS)) {
      for (const pr of (l.props ?? []).filter((p) => p.y === undefined)) {
        if ((l.gaps ?? []).some((g) => pr.x >= g.x && pr.x < g.x + g.w)) fautifs.push(`${l.id} ${pr.kind} x${pr.x}`)
      }
    }
    expect(fautifs, fautifs.slice(0, 6).join(' | ')).toEqual([])
  })
})
