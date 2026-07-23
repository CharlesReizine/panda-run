import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { strictReach } from '../../src/core/level-validator'

// ATTEIGNABILITÉ STRICTE (murs de roche pleine) — cf. level-validator.strictReach.
//
// Contrairement à `unreachablePlatforms` (sol = bande pleine largeur, « téléporte » à travers les
// murs), ce modèle DÉCOUPE le sol aux murs de roche solide et rend les dessus de roche marchables.
// Il attrape la classe de bug « plateforme derrière un mur, atteignable seulement en traversant la
// pierre » — invisible à l'ancien validateur (retour user : desert-9 « un saut que je peux pas faire,
// une plateforme que j'arrive pas à atteindre »). Résolu au niveau du composer (module escalier-saut :
// palier de sortie prolongé jusqu'au bord droit).

const nonBoss = Object.entries(LEVELS).filter(([, l]) => !l.boss)

describe('atteignabilité stricte (murs de roche pleine)', () => {
  it('AUCUN terrain n\'a de plateforme injoignable derrière un mur de roche', () => {
    const bad = nonBoss
      .map(([id, l]) => ({ id, plats: strictReach(l).badPlats }))
      .filter((r) => r.plats.length > 0)
    expect(
      bad.map((r) => `${r.id} (${r.plats.length} : ${r.plats.slice(0, 3).map((p) => `[${p.x},${p.y}]`).join(' ')})`),
      `terrains avec plateformes murées : ${bad.map((r) => r.id).join(', ')}`,
    ).toEqual([])
  })
})
