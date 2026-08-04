import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { LEVEL_ORDER } from '../../src/core/mob-level'
import { PROPS } from '../../src/data/props'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES TROIS PALIERS DE COFFRE EXISTENT VRAIMENT DANS LE JEU
//
// Retour joueur, et il a précédé les tests : « j'ai l'impression de jamais avoir voir les coffres plus
// stylés alors que j'ai beaucoup joué ». Mesuré à ce moment-là : **155 coffres de bois, 0 de fer, 0 d'or**.
// `attribuerPaliersDeCoffre` était écrite, commentée, déterministe — et JAMAIS APPELÉE. Les halos par
// palier, les étincelles en orbite, le butin rare : tout ce code existait et ne s'affichait nulle part.
//
// Aucun test ne pouvait le dire : ceux qui existaient vérifiaient la FONCTION (sa répartition est juste),
// pas le fait qu'elle TOURNE. C'est la même famille de bug que le `switch` dupliqué de `buildModule`, où
// un correctif avait été écrit dans une copie morte. On vérifie donc le RÉSULTAT dans les terrains.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const coffresDe = (id: string) => (LEVELS[id]?.props ?? []).filter((p) => p.kind.startsWith('coffre'))
const tousLesCoffres = LEVEL_ORDER.flatMap((l) => coffresDe(l.id))
const combien = (kind: string) => tousLesCoffres.filter((c) => c.kind === kind).length

describe('paliers de coffre', () => {
  it('les trois paliers sont POSÉS dans le jeu, pas seulement déclarés', () => {
    const compte = { bois: combien('coffre'), fer: combien('coffre-fer'), or: combien('coffre-or') }
    expect(compte.bois, `répartition : ${JSON.stringify(compte)}`).toBeGreaterThan(0)
    expect(compte.fer, `AUCUN coffre de fer dans tout le jeu — la passe de paliers tourne-t-elle ? ${JSON.stringify(compte)}`).toBeGreaterThan(0)
    expect(compte.or, `AUCUN coffre d'or dans tout le jeu — la passe de paliers tourne-t-elle ? ${JSON.stringify(compte)}`).toBeGreaterThan(0)
  })

  it('chaque palier posé existe dans le catalogue de props (donc a une texture et un butin)', () => {
    const inconnus = [...new Set(tousLesCoffres.map((c) => c.kind))].filter((k) => !PROPS[k])
    expect(inconnus, `paliers posés mais absents de PROPS : ${inconnus.join(', ')}`).toEqual([])
  })

  it('l\'OR reste un ÉVÉNEMENT : jamais plus d\'un par terrain, et jamais en début de jeu', () => {
    const debut = LEVEL_ORDER.slice(0, 12).map((l) => l.id)
    for (const l of LEVEL_ORDER) {
      const or = coffresDe(l.id).filter((c) => c.kind === 'coffre-or')
      expect(or.length, `${l.id} porte ${or.length} coffres d'or`).toBeLessThanOrEqual(1)
      if (debut.includes(l.id)) expect(or.length, `${l.id} est un terrain de début et porte de l'or`).toBe(0)
    }
  })

  it('le BOIS ne disparaît pas : il reste le palier commun du début de jeu', () => {
    // Sinon le palier perd son sens : si tout devient fer, « plus c'est rare, plus ça brille » ne veut
    // plus rien dire. Les douze premiers terrains doivent rester majoritairement en bois.
    const debut = LEVEL_ORDER.slice(0, 12).flatMap((l) => coffresDe(l.id))
    const bois = debut.filter((c) => c.kind === 'coffre').length
    expect(bois, `début de jeu : ${bois} bois sur ${debut.length} coffres`).toBeGreaterThan(debut.length / 2)
  })
})
