import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { changeClass, evolveClass, canEvolveClass, CLASS_CHANGE_LEVEL, CLASS_EVOLVE_LEVEL } from '../../src/core/progression'
import { CLASSES } from '../../src/data/classes'
import { unParJoueur } from '../../src/cloud/leaderboard'
import type { ClassId } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CHANGER DE CLASSE — LES DEUX CHOSES QUI ONT CASSÉ
//
// Deux retours du user, le même soir :
//   « je viens de passer chasseur et j'avais déjà un point sur un skill de classe 2, retire ça. Quand on
//     change de classe on a 0 skill de la nouvelle classe. »
//   « j'ai changé de classe et ça me fait deux lignes dans le classement. Moi archer et moi chasseur,
//     y a un prob. »
//
// ⚠️ LE PREMIER ÉTAIT DÉJÀ TESTÉ, MAIS SUR LE SEUL PREMIER SORT de la nouvelle classe. Un test qui vérifie
// `skillLevels[skillIds[0]] === 0` laisse passer un cadeau posé sur n'importe quel autre sort de l'arbre —
// et c'est exactement le genre de couverture partielle qui a laissé passer cinq régressions ce matin.
// On vérifie donc l'arbre ENTIER, pour les trois évolutions, dans les deux sens (rien d'offert, rien de
// perdu).

const EVOLUTIONS: [ClassId, ClassId][] = [
  ['swordsman', 'chevalier'],
  ['mage', 'sorcier'],
  ['archer', 'chasseur'],
]

const pretAEvoluer = (de: ClassId) => {
  const p = newPlayer('charly')
  p.classId = de
  p.level = CLASS_EVOLVE_LEVEL
  return p
}

describe('évolution : AUCUNE compétence offerte', () => {
  for (const [de, vers] of EVOLUTIONS) {
    it(`${de} → ${vers} : aucun sort de la nouvelle classe n'a le moindre rang`, () => {
      const p = pretAEvoluer(de)
      expect(evolveClass(p)).toBe(vers)
      const offerts = CLASSES[vers].skillIds.filter((id) => (p.skillLevels[id] ?? 0) > 0)
      expect(offerts, `sorts débloqués d'office : ${offerts.join(', ')}`).toEqual([])
    })

    it(`${de} → ${vers} : les points investis dans la classe de base RESTENT`, () => {
      // L'autre moitié de la règle, et celle qu'un correctif trop zélé casserait : « les points de skills
      // développés sur la classe inférieure, je peux pas les mettre sur la classe supérieure » — ils ont
      // payé pour des sorts qu'on continue d'utiliser, ils ne se recyclent pas et ne s'effacent pas.
      const p = pretAEvoluer(de)
      const base = CLASSES[de].skillIds.slice(0, 2)
      for (const id of base) p.skillLevels[id] = 3
      const avant = { ...p.skillLevels }
      evolveClass(p)
      for (const id of base) expect(p.skillLevels[id], id).toBe(avant[id])
    })

    it(`${de} → ${vers} : le solde de points de compétence n'est pas gonflé`, () => {
      const p = pretAEvoluer(de)
      p.skillPoints = 4
      evolveClass(p)
      expect(p.skillPoints, 'évoluer ne distribue pas de points en cadeau').toBe(4)
    })
  }

  it('un novice qui choisit sa première classe ne reçoit rien non plus', () => {
    const p = newPlayer('charly')
    p.level = CLASS_CHANGE_LEVEL
    changeClass(p, 'archer')
    const offerts = CLASSES.archer.skillIds.filter((id) => (p.skillLevels[id] ?? 0) > 0)
    expect(offerts, `sorts débloqués d'office : ${offerts.join(', ')}`).toEqual([])
  })

  it('on n\'évolue pas deux fois, et pas avant le niveau requis', () => {
    const p = pretAEvoluer('archer')
    p.level = CLASS_EVOLVE_LEVEL - 1
    expect(canEvolveClass(p)).toBe(false)
    expect(() => evolveClass(p)).toThrow()
    p.level = CLASS_EVOLVE_LEVEL
    evolveClass(p)
    expect(canEvolveClass(p)).toBe(false)
    expect(() => evolveClass(p)).toThrow()
  })
})

describe('classement : changer de classe ne crée pas une deuxième ligne', () => {
  it('la CLÉ de publication ne dépend pas de la classe', () => {
    // ⚠️ C'EST LA VRAIE CAUSE DU DOUBLON, et elle est structurelle : si la clé du document contenait la
    // classe, chaque évolution créerait un NOUVEAU document, et le dédoublonnage à la lecture ne serait
    // qu'un cache-misère sur une base qui grossit. `publish(key, …)` écrit sous le pseudo seul ; ce test
    // épingle la conséquence observable — deux lignes du même joueur fusionnent, quelle que soit la classe.
    const avant = { key: 'charlychoulove', pseudo: 'charlychoulove', level: 29, classId: 'archer', updatedAt: 9_000 }
    const apres = { key: 'charlychoulove', pseudo: 'charlychoulove', level: 32, classId: 'chasseur', updatedAt: 1_000 }
    const out = unParJoueur([avant, apres])
    expect(out).toHaveLength(1)
    // et c'est le personnage le PLUS AVANCÉ qui survit, pas le plus récemment écrit
    expect(out[0]!.level).toBe(32)
    expect(out[0]!.classId).toBe('chasseur')
  })

  it('fusionne même si une ligne fantôme traîne sous une ancienne clé', () => {
    // le cas réel relevé en base : players/panda et players/charlychoulove, même pseudo, même archer 29
    const out = unParJoueur([
      { key: 'panda', pseudo: 'charlychoulove', level: 29, classId: 'archer', updatedAt: 1_000 },
      { key: 'charlychoulove', pseudo: 'charlychoulove', level: 29, classId: 'archer', updatedAt: 9_000 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.updatedAt).toBe(9_000) // à niveau égal, la plus récente
  })
})
