import { describe, it, expect } from 'vitest'
import { SKILLS } from '../../src/data/skills'
import { skillSfx } from '../../src/audio/skill-sfx'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN SON PAR FAMILLE DE SORT
//
// Demande du user : « on peut rajouter des bruits sur certaines attaques du mage ou des autres ». Les 66
// compétences jouaient toutes le MÊME bruit `skill`.
//
// Le test qui compte est le premier : AUCUNE compétence ne doit retomber sur le son générique. Sans lui,
// une compétence ajoutée plus tard serait silencieusement sonorisée « comme avant » et personne ne le
// verrait — c'est précisément le mode de défaillance qu'un classement par motif peut avoir.

const all = Object.values(SKILLS)

describe('couverture', () => {
  it('aucune compétence ne retombe sur le son générique', () => {
    const orphelines = all.filter((s) => skillSfx(s) === 'skill').map((s) => `${s.id} (${s.classId}, ${s.kind})`)
    expect(orphelines, `sans famille de son :\n  ${orphelines.join('\n  ')}`).toEqual([])
  })

  it('plusieurs familles sont réellement utilisées — sinon autant garder un seul bruit', () => {
    const familles = new Set(all.map(skillSfx))
    expect(familles.size).toBeGreaterThanOrEqual(6)
  })
})

describe('l\'élément passe avant la classe', () => {
  it('une flèche enflammée sonne FEU, pas arc : c\'est le feu qu\'on voit à l\'écran', () => {
    expect(skillSfx(SKILLS['fleche-enflammee']!)).toBe('sort-feu')
  })

  it('une épée enflammée sonne FEU, pas lame', () => {
    expect(skillSfx(SKILLS['epee-enflammee']!)).toBe('sort-feu')
  })

  it('les éléments du mage sont bien distingués entre eux', () => {
    expect(skillSfx(SKILLS['boule-de-feu']!)).toBe('sort-feu')
    expect(skillSfx(SKILLS['nova-de-givre']!)).toBe('sort-glace')
    expect(skillSfx(SKILLS['blizzard']!)).toBe('sort-glace')
    expect(skillSfx(SKILLS['eclair']!)).toBe('sort-foudre')
    expect(skillSfx(SKILLS['rayon-arcanique']!)).toBe('sort-arcane')
  })
})

describe('familles par défaut', () => {
  it('un soin sonne soin, quelle que soit la classe', () => {
    for (const id of ['soin-du-panda', 'soin-majeur', 'benediction-du-panda']) {
      const s = SKILLS[id]
      if (s) expect(['sort-soin', 'sort-arcane'], id).toContain(skillSfx(s))
    }
    expect(skillSfx(SKILLS['soin-du-panda']!)).toBe('sort-soin')
  })

  it('un tir d\'archer sans élément sonne flèche', () => {
    expect(skillSfx(SKILLS['fleche-de-bambou']!)).toBe('tir-fleche')
    expect(skillSfx(SKILLS['tir-en-cloche']!)).toBe('tir-fleche')
  })

  it('une attaque d\'épéiste sans élément sonne lame', () => {
    expect(skillSfx(SKILLS['tourbillon']!)).toBe('coup-lame')
  })

  it('le même sort donne toujours le même son (classement déterministe)', () => {
    for (const s of all) expect(skillSfx(s)).toBe(skillSfx(s))
  })
})
