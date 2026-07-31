import { describe, it, expect } from 'vitest'
import { ITEMS } from '../../src/data/items'
import { itemPower, minLevelForPower, minLevelOf, LEVEL_TIERS } from '../../src/core/item-level'
import { itemMinLevel, meetsLevel, equipBlockReason } from '../../src/core/equip'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NIVEAU MINIMUM PAR ÉQUIPEMENT, SELON SES PERFORMANCES
//
// Demandes du user : « rajoute un niveau min par objet », puis « niveau min par équipement SELON LES
// PERFS ». Le palier n'est donc PAS une donnée écrite à côté des stats, il est calculé à partir d'elles.
//
// Le test central est la MONOTONIE : à puissance supérieure, palier supérieur ou égal, pour toutes les
// paires d'objets du jeu. C'est ce qui rend impossible le retour du défaut de la version précédente, où
// le palier suivait la rareté : des Ailes d'Angeling légendaires (+15 PV, plus faibles qu'un plastron
// commun) exigeaient le niveau 38, et un Chapeau Poring rare (+5 PV) le niveau 10.

const items = Object.values(ITEMS)

describe('la puissance ordonne les paliers', () => {
  it('à puissance supérieure, palier supérieur ou égal — pour TOUTES les paires d\'objets', () => {
    const fautes: string[] = []
    for (const a of items) {
      for (const b of items) {
        if (itemPower(a.bonus) > itemPower(b.bonus) && minLevelOf(a) < minLevelOf(b)) {
          fautes.push(`${a.id} (puiss ${itemPower(a.bonus)} → Nv ${minLevelOf(a)}) < ${b.id} (puiss ${itemPower(b.bonus)} → Nv ${minLevelOf(b)})`)
        }
      }
    }
    expect(fautes, `paliers incohérents :\n  ${fautes.slice(0, 10).join('\n  ')}`).toEqual([])
  })

  it('la fonction elle-même est croissante sur toute la plage utile', () => {
    for (let p = 0; p < 200; p++) {
      expect(minLevelForPower(p + 1), `puissance ${p} → ${p + 1}`).toBeGreaterThanOrEqual(minLevelForPower(p))
    }
  })

  it('deux objets de MÊME puissance demandent le même niveau, quelle que soit leur rareté', () => {
    const parPuissance = new Map<number, number[]>()
    for (const it of items) {
      const k = itemPower(it.bonus)
      parPuissance.set(k, [...(parPuissance.get(k) ?? []), minLevelOf(it)])
    }
    for (const [puiss, niveaux] of parPuissance) {
      expect(new Set(niveaux).size, `puissance ${puiss}`).toBe(1)
    }
  })
})

describe('pondération des statistiques', () => {
  it('ATK et DÉF pèsent pareil : les dégâts sont soustractifs, un point de DÉF annule un point d\'ATK', () => {
    expect(itemPower({ atk: 5 })).toBe(itemPower({ def: 5 }))
  })

  it('les PV pèsent moins à l\'unité, mais comptent réellement', () => {
    expect(itemPower({ maxHp: 10 })).toBeGreaterThan(0)
    expect(itemPower({ maxHp: 10 })).toBeLessThan(itemPower({ atk: 10 }))
  })

  it('un objet sans bonus est de puissance nulle et se porte au niveau 1', () => {
    expect(itemPower({})).toBe(0)
    expect(minLevelForPower(0)).toBe(1)
  })
})

describe('la courbe reste jouable aux deux bouts', () => {
  it('on peut s\'armer tôt : les trois armes de départ restent accessibles', () => {
    // 4 et pas 2 : le novice ne peut équiper AUCUNE arme (cf. CLASS_WEAPON_TYPES), la première arme
    // n'est donc utile qu'après le changement de classe. Ce qui compte est qu'elles restent du début
    // de partie, pas qu'elles soient portables à la première seconde.
    for (const id of ['epee-bambou', 'arc-souple', 'baton-feuillu']) {
      expect(minLevelOf(ITEMS[id]!), id).toBeLessThanOrEqual(4)
    }
  })

  it('au moins un chapeau au niveau 1 et une arme au niveau 2', () => {
    expect(items.some((it) => it.slot === 'hat' && minLevelOf(it) <= 1)).toBe(true)
    expect(items.some((it) => it.slot === 'weapon' && minLevelOf(it) <= 2)).toBe(true)
  })

  it('aucun objet ne demande un niveau hors d\'atteinte (le monstre le plus haut est Nv 57)', () => {
    for (const it of items) expect(minLevelOf(it), it.id).toBeLessThanOrEqual(57)
  })

  it('les objets les plus puissants du jeu sont bien du contenu de fin', () => {
    const max = Math.max(...items.map((it) => itemPower(it.bonus)))
    const top = items.filter((it) => itemPower(it.bonus) === max)[0]!
    expect(minLevelOf(top), top.id).toBeGreaterThanOrEqual(31)
  })

  it('les paliers sont assez étalés pour que la progression se sente', () => {
    const tiers = LEVEL_TIERS()
    expect(new Set(tiers).size).toBe(tiers.length)
    expect(tiers[tiers.length - 1]! - tiers[0]!).toBeGreaterThan(30)
  })
})

describe('application de la règle à l\'équipement', () => {
  it('bloque en dessous du palier, autorise à partir du palier', () => {
    const fort = items.reduce((a, b) => (itemPower(a.bonus) > itemPower(b.bonus) ? a : b))
    const n = itemMinLevel(fort.id)
    expect(meetsLevel(n - 1, fort.id)).toBe(false)
    expect(meetsLevel(n, fort.id)).toBe(true)
  })

  it('un objet inconnu ne bloque pas (vieille sauvegarde : on ne casse pas la partie)', () => {
    expect(itemMinLevel('objet-qui-nexiste-pas')).toBe(1)
    expect(meetsLevel(1, 'objet-qui-nexiste-pas')).toBe(true)
  })

  it('la RESTRICTION DE CLASSE passe avant le niveau : le message le plus utile d\'abord', () => {
    const baton = items.find((it) => it.weaponType === 'staff')!
    expect(equipBlockReason('swordsman', 99, baton.id)).toContain('mages')
  })

  it('au bon niveau et dans la bonne classe, rien ne bloque', () => {
    const baton = items.find((it) => it.weaponType === 'staff')!
    expect(equipBlockReason('mage', minLevelOf(baton), baton.id)).toBeNull()
  })

  it('sous le palier, le message donne le niveau exact', () => {
    const cible = items.find((i) => minLevelOf(i) >= 20)!
    expect(equipBlockReason('mage', 1, cible.id)).toBe(`Niveau ${minLevelOf(cible)} requis.`)
  })
})
