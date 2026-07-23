import { describe, it, expect } from 'vitest'
import { SKILLS } from '../../src/data/skills'
import { SKILL_ICONS } from '../../src/data/skill-icons'

// Chaque sort DOIT avoir sa propre icône (couleur + glyphe). Sans entrée, il retombait sur l'épée
// dorée générique (bug repéré : meditation-arcanique, fleches-entravantes affichaient une épée).
describe('icônes de sorts — complétude', () => {
  it('chaque sort a une entrée SKILL_ICONS dédiée', () => {
    const missing = Object.keys(SKILLS).filter((id) => !SKILL_ICONS[id])
    expect(missing, `sorts sans icône : ${missing.join(', ')}`).toEqual([])
  })

  it('chaque entrée SKILL_ICONS a une couleur et un glyphe non vides', () => {
    for (const [id, spec] of Object.entries(SKILL_ICONS)) {
      expect(typeof spec.color, id).toBe('number')
      expect(spec.glyph.length, id).toBeGreaterThan(0)
    }
  })
})
