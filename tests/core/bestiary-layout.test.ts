import { describe, it, expect } from 'vitest'
import {
  CARD, BD, identityBox, skillsBox, lootBox, LOOT_COLS,
  lootRowH, lootBottom, lootFits, maxSkillRows, skillsBottom, skillsFit, truncate,
} from '../../src/scenes/bestiary-layout'
import { MONSTERS } from '../../src/data/monsters'
import { SKILLS } from '../../src/data/skills'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FICHE DU BESTIAIRE — RIEN NE DÉBORDE. TEST BLOQUANT.
//
// Exigence explicite du user : « un test qui m'assure que rien ne dépasse, et tant que c'est pas bon
// tu oses pas me déployer ta merde ». Il tourne sur le VRAI roster : c'est le seul moyen de savoir que
// le monstre le plus chargé du jeu (le plus de butins, le plus de compétences) rentre vraiment.
//
// Disposition demandée, en quatre quarts : identité (nom + niveau entre parenthèses + image dessous à
// gauche) en haut à gauche ; trait vertical ; compétences en haut à droite ; BUTIN fusionné sur toute
// la largeur en bas.

const skillCount = (id: string) => (MONSTERS[id]!.skills ?? []).filter((s) => SKILLS[s]).length

describe('les quatre quarts', () => {
  it('les deux quarts du haut ne se recouvrent pas, de part et d\'autre du trait', () => {
    const a = identityBox(), b = skillsBox()
    expect(a.x + a.w).toBeLessThanOrEqual(BD.splitX)
    expect(b.x).toBeGreaterThanOrEqual(BD.splitX)
    expect(a.y).toBe(b.y)
    expect(a.h).toBe(b.h)
  })

  it('la bande de butin est SOUS le haut et occupe TOUTE la largeur', () => {
    const top = identityBox(), loot = lootBox()
    expect(loot.y).toBeGreaterThanOrEqual(top.y + top.h)
    expect(loot.x).toBe(CARD.left)
    expect(loot.x + loot.w).toBe(CARD.right)
  })

  it('les trois zones tiennent dans la zone utile de la fiche', () => {
    const zones = { identite: identityBox(), competences: skillsBox(), butin: lootBox() }
    for (const [name, r] of Object.entries(zones)) {
      expect(r.x, `${name}.x`).toBeGreaterThanOrEqual(CARD.left)
      expect(r.x + r.w, `${name} droite`).toBeLessThanOrEqual(CARD.right)
      expect(r.y, `${name}.y`).toBeGreaterThanOrEqual(CARD.top)
      expect(r.y + r.h, `${name} bas`).toBeLessThanOrEqual(CARD.bottom)
    }
  })

  it('l\'illustration tient dans le quart d\'identité, sous la ligne du nom', () => {
    const box = identityBox()
    expect(BD.portrait).toBeLessThanOrEqual(box.w)
    expect(34 + BD.portrait, 'nom + image').toBeLessThanOrEqual(box.h)
  })
})

describe('aucun débordement sur le VRAI roster', () => {
  const all = Object.values(MONSTERS)

  it('le butin de CHAQUE monstre rentre dans sa bande', () => {
    const over = all
      .filter((m) => !lootFits(m.drops.length))
      .map((m) => `${m.id} : ${m.drops.length} butins → bas ${lootBottom(m.drops.length)} > ${CARD.bottom}`)
    expect(over, `butin débordant :\n  ${over.join('\n  ')}`).toEqual([])
  })

  it('les compétences de CHAQUE monstre rentrent dans leur quart', () => {
    const over = all
      .filter((m) => skillCount(m.id) > 0 && !skillsFit(skillCount(m.id)))
      .map((m) => `${m.id} : ${skillCount(m.id)} compétences (max affichable ${maxSkillRows()})`)
    expect(over, `compétences débordantes :\n  ${over.join('\n  ')}`).toEqual([])
  })

  it('la hauteur de ligne de butin reste LISIBLE, même pour le monstre le plus chargé', () => {
    const worst = Math.max(...all.map((m) => m.drops.length))
    expect(lootRowH(worst), `pire cas : ${worst} butins`).toBeGreaterThanOrEqual(18)
  })

  it('les compétences ne descendent pas sous leur quart', () => {
    for (const m of all) {
      const n = skillCount(m.id)
      if (!n) continue
      const box = skillsBox()
      expect(skillsBottom(n), `${m.id}`).toBeLessThanOrEqual(box.y + box.h)
    }
  })
})

describe('le butin s\'étale en largeur', () => {
  it('plusieurs colonnes, assez larges pour image + nom + probabilité', () => {
    expect(LOOT_COLS).toBeGreaterThanOrEqual(2)
    const colW = (lootBox().w - (LOOT_COLS - 1) * 10) / LOOT_COLS
    expect(colW, 'largeur de colonne de butin').toBeGreaterThanOrEqual(180)
  })
})

describe('troncature', () => {
  it('laisse court ce qui est court, coupe avec une ellipse au-delà', () => {
    expect(truncate('abc', 10)).toBe('abc')
    expect(truncate('a'.repeat(20), 10)).toHaveLength(10)
    expect(truncate('a'.repeat(20), 10).endsWith('…')).toBe(true)
  })
})
