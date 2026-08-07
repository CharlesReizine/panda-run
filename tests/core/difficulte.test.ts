import { describe, it, expect } from 'vitest'
import { statsForLevel, durcissement, hpBase, atkBase } from '../../src/core/mob-stats'
import { CLASSES } from '../../src/data/classes'
import type { ClassId } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DURCISSEMENT DE LA SECONDE MOITIÉ DE PARTIE
//
// Retour du user : « le jeu est un chouille trop facile ; passé le niveau 10 et le changement de classe tu
// peux y aller. Plus de PV et plus de dégâts pour les mobs. »
//
// Le problème mesuré était une DIVERGENCE DE PENTES, pas un niveau mal réglé : la puissance du joueur bondit
// au changement de classe puis croît de 18 à 29 PV par niveau, tandis que la courbe des mobs était linéaire
// de bout en bout. Au niveau 40, un mob normal frappait un chevalier pour 23 points sur 1369 PV.
//
// Ces tests figent l'INTENTION : rien ne change avant le niveau 10, ça durcit continûment ensuite, et ça
// reste borné (un facteur non borné finirait par produire des morts en un coup).

describe('le début de partie ne bouge pas', () => {
  it('aucun durcissement jusqu\'au niveau 10 inclus', () => {
    for (let l = 1; l <= 10; l++) {
      expect(durcissement(l).hp, `niveau ${l}`).toBe(1)
      expect(durcissement(l).atk, `niveau ${l}`).toBe(1)
    }
  })

  it('les stats d\'un mob de bas niveau sont EXACTEMENT celles de la courbe de base', () => {
    for (let l = 1; l <= 10; l++) {
      const s = statsForLevel(l, 'normal')
      expect(s.hp, `PV niveau ${l}`).toBe(Math.round(hpBase(l)))
      expect(s.atk, `ATK niveau ${l}`).toBe(Math.round(atkBase(l)))
    }
  })
})

describe('ça durcit continûment ensuite', () => {
  it('le facteur croît strictement après le seuil', () => {
    for (let l = 11; l < 60; l++) {
      expect(durcissement(l + 1).hp, `niveau ${l}`).toBeGreaterThan(durcissement(l).hp)
      expect(durcissement(l + 1).atk, `niveau ${l}`).toBeGreaterThan(durcissement(l).atk)
    }
  })

  it('les PV durcissent un peu PLUS VITE que l\'ATK — durcir sans créer de morts en un coup', () => {
    expect(durcissement(57).hp).toBeGreaterThan(durcissement(57).atk)
  })

  // ⚠️ LES BORNES ONT MONTÉ, SUR DEMANDE EXPLICITE. « Après le niveau 10 tu les rends 25 % plus forts, et
  // après le niveau 30, 50 % plus forts. » Ces paliers se MULTIPLIENT à la pente qui existait déjà (elle
  // répondait à un premier « le jeu est un chouille trop facile ») : au niveau le plus haut du jeu, les
  // PV font donc ×4 la courbe de base au lieu de ×2,6. Le plafond suit la demande, il ne la corrige pas.
  // ⚠️ LES BORNES SUIVENT LA RÈGLE DES CINQ COUPS, elles ne la contraignent pas. « Un mob de ton niveau
  // te tue en 5 coups quand tu as pas de stuff » : c'est cette cible qui fixe les paliers, et le plafond
  // ne fait que constater où elle mène. Mesuré nu au niveau 50 : 4 coups. Le voisin de gauche (niveau 10)
  // en tient 30 — le début reste un tutoriel.
  it('reste borné : au niveau le plus haut du jeu, on ne dépasse pas le sextuple', () => {
    const d = durcissement(57)
    expect(d.hp).toBeGreaterThan(4)
    expect(d.hp).toBeLessThan(7)
    expect(d.atk).toBeGreaterThan(3.5)
    expect(d.atk).toBeLessThan(6)
  })

  it('la DÉF n\'est PAS durcie : les dégâts sont soustractifs', () => {
    // monter la DÉF allongerait les combats sans les rendre dangereux — long n'est pas difficile
    const bas = statsForLevel(10, 'normal'), haut = statsForLevel(50, 'normal')
    const ratioDef = haut.def / bas.def
    const ratioPv = haut.hp / bas.hp
    expect(ratioDef).toBeLessThan(ratioPv)
  })

  it('un mob de fin de partie fait vraiment mal à un chevalier farmé', () => {
    // le chiffre qui a motivé le changement : 23 dégâts sur 1369 PV = 59 coups. On exige mieux que 25.
    const mob = statsForLevel(40, 'normal')
    const cls = CLASSES.chevalier
    const pv = cls.baseStats.maxHp + cls.growth.maxHp * 39
    const def = cls.baseStats.def + cls.growth.def * 39
    const degats = Math.max(1, mob.atk - def)
    expect(Math.ceil(pv / degats), 'nombre de coups pour tuer le joueur').toBeLessThan(25)
  })
})

describe('l\'archer est le plus fragile, et le chasseur avec lui', () => {
  it('l\'archer a MOINS de PV que le novice : la distance est un choix, pas un confort', () => {
    expect(CLASSES.archer.baseStats.maxHp).toBeLessThan(CLASSES.novice.baseStats.maxHp)
  })

  it('il est le plus fragile des trois classes de base', () => {
    const pv = (id: ClassId) => CLASSES[id].baseStats.maxHp
    expect(pv('archer')).toBeLessThan(pv('swordsman'))
    expect(pv('archer')).toBeLessThan(pv('mage'))
  })

  it('le chasseur reste le plus fragile des classes évoluées', () => {
    const pv = (id: ClassId) => CLASSES[id].baseStats.maxHp
    expect(pv('chasseur')).toBeLessThan(pv('chevalier'))
    expect(pv('chasseur')).toBeLessThan(pv('sorcier'))
  })

  it('mais fragile ne veut pas dire faible : son ATK compense', () => {
    // fragile ET peu mordant ne serait pas un archétype, juste un malus
    expect(CLASSES.archer.baseStats.atk).toBeGreaterThan(CLASSES.novice.baseStats.atk)
    expect(CLASSES.chasseur.baseStats.atk).toBeGreaterThan(CLASSES.chevalier.baseStats.atk)
  })
})
