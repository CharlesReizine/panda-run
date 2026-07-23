import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { SKILLS } from '../../src/data/skills'
import { BD, bestiaryDetailBottom, truncate } from '../../src/scenes/bestiary-layout'

// NON-DÉBORDEMENT du Bestiaire (retour user : « crée des tests de non débordement sur chaque zone »).
// La fiche détail empile, à droite, la grille Compétences puis la grille Butin. On vérifie que, pour
// CHAQUE monstre, ces grilles ne débordent JAMAIS sous les boutons, restent dans la largeur du panneau,
// et que les descriptions de skills (parfois très longues) sont tronquées pour tenir dans leur carte.

const nSkills = (id: string) => (MONSTERS[id]!.skills ?? []).filter((s) => SKILLS[s]).length

describe('bestiaire — non débordement', () => {
  it('les grilles Compétences+Butin ne débordent jamais sous les boutons (marge ≥ 12 px)', () => {
    const bad = Object.values(MONSTERS)
      .map((m) => ({ id: m.id, bottom: bestiaryDetailBottom(nSkills(m.id), m.drops.length, !!m.boss) }))
      .filter((r) => r.bottom > BD.buttonsY - 12)
    expect(bad.map((r) => `${r.id} (bas ${r.bottom})`), 'fiches qui débordent').toEqual([])
  })

  it('la grille détail tient dans la largeur du panneau (2 colonnes ≤ 960)', () => {
    const rightEdge = BD.X0 + (BD.COLW + BD.GAP) + BD.COLW
    expect(rightEdge).toBeLessThanOrEqual(960)
  })

  it('toute description de skill affichée est bornée (tronquée ≤ descMax)', () => {
    for (const sk of Object.values(SKILLS)) {
      expect(truncate(sk.description, BD.descMax).length).toBeLessThanOrEqual(BD.descMax)
    }
  })

  it('truncate ajoute une ellipse uniquement au-delà de la limite', () => {
    expect(truncate('court', 66)).toBe('court')
    expect(truncate('x'.repeat(100), 66)).toMatch(/…$/)
    expect(truncate('x'.repeat(100), 66).length).toBe(66)
  })
})
