import { describe, it, expect } from 'vitest'
import {
  CC, DESIGN, PANDA_TEX, overlap, titleBottom, cardRect, cardInnerW, portraitScale, cardFlow,
  maxSkillLines, splitSkills, nameChars, statsChars, skillChars, fitName,
  actionRect, trainingRect, messageRect, type Rect,
} from '../../src/scenes/classchange-layout'
import { lineH } from '../../src/scenes/text-metrics'
import { CLASSES } from '../../src/data/classes'
import { skillsOf } from '../../src/data/skills'
import { EVOLUTIONS } from '../../src/core/progression'
import type { ClassId } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CHANGEMENT DE CLASSE — RIEN NE DÉBORDE DE SA CARTE NI DE L'ÉCRAN. TEST BLOQUANT.
//
// DEUX DÉBORDEMENTS MESURÉS dans l'ancienne version :
//
//  · Le portrait était dessiné à y = 175 avec `setScale(2)` sur une texture bakée de 96×92 : son cadre
//    couvrait 83 → 267 alors que la carte commençait à 110 (centre 290, hauteur 360). Le panda sortait
//    par le HAUT de sa propre carte, et son contenu utile (pieds à y ≈ 255) recouvrait le nom de la
//    classe posé à y = 260 (bande 247 → 273). En mode évolution, `setScale(2.4)` donnait un cadre
//    64 → 286 pour une carte qui commence à 100 : 36 px dehors.
//
//  · Le bouton « Évoluer en … » (y = 500, police 24 + marge 10 ⇒ bande 474 → 526) et le message de
//    confirmation de `finish()` (y = 520 ⇒ bande 504 → 536) étaient tous deux centrés en x = 480 :
//    22 px de recouvrement, pile après le clic.
//
// Les cartes sont maintenant déduites d'une bande et d'un flux vertical, et les trois éléments du pied
// d'écran sont des rectangles comparés deux à deux ci-dessous.

const CHOICES: ClassId[] = ['swordsman', 'mage', 'archer']
const ALL: ClassId[] = Object.keys(CLASSES) as ClassId[]
const statsText = (id: ClassId) => {
  const s = CLASSES[id].baseStats
  return [`ATK ${s.atk}  DEF ${s.def}`, `PV ${s.maxHp}`]
}

describe('cartes', () => {
  it('le titre s\'arrête au-dessus des cartes', () => {
    expect(titleBottom()).toBeLessThanOrEqual(CC.top)
  })

  it('les 3 cartes de choix sont centrées, disjointes et dans l\'écran', () => {
    const cartes = [0, 1, 2].map((i) => cardRect(i, 3))
    expect(cartes[0]!.x, 'marge à gauche').toBeGreaterThan(0)
    expect(cartes[2]!.x + cartes[2]!.w, 'marge à droite').toBeLessThan(DESIGN.w)
    // symétrie : la rangée est centrée sur 480 (donc elle le reste sur un écran élargi via centerCamera)
    expect(cartes[0]!.x).toBe(DESIGN.w - (cartes[2]!.x + cartes[2]!.w))
    for (const [i, c] of cartes.entries()) {
      expect(c.y).toBeGreaterThanOrEqual(CC.top)
      expect(c.y + c.h, `carte ${i} bas`).toBeLessThanOrEqual(CC.bottom)
      for (const autre of cartes.slice(i + 1)) expect(overlap(c, autre), `cartes ${i}`).toBe(false)
    }
  })

  it('la carte unique d\'évolution est centrée et dans l\'écran', () => {
    const c = cardRect(0, 1)
    expect(c.x + c.w / 2).toBe(DESIGN.w / 2)
    expect(c.x).toBeGreaterThan(0)
    expect(c.x + c.w).toBeLessThan(DESIGN.w)
    expect(c.y + c.h).toBeLessThanOrEqual(CC.bottom)
  })
})

describe('le portrait ne sort plus de sa carte', () => {
  for (const n of [1, 3]) {
    it(`mode ${n === 1 ? 'évolution' : '3 voies'} : le cadre de l'illustration est INCLUS dans la carte`, () => {
      const card = cardRect(0, n)
      const { portrait } = cardFlow(card)
      expect(portrait.x, 'gauche').toBeGreaterThanOrEqual(card.x)
      expect(portrait.x + portrait.w, 'droite').toBeLessThanOrEqual(card.x + card.w)
      expect(portrait.y, 'haut').toBeGreaterThanOrEqual(card.y)
      expect(portrait.y + portrait.h, 'bas').toBeLessThanOrEqual(card.y + card.h)
      // l'échelle est BORNÉE par la carte : c'est l'image qui obéit, pas la carte
      expect(portrait.w).toBe(PANDA_TEX.w * portraitScale(card))
      expect(portraitScale(card)).toBeLessThanOrEqual(cardInnerW(card) / PANDA_TEX.w)
    })
  }

  it('une carte étroite rapetisse l\'illustration au lieu de la laisser dépasser', () => {
    const etroite: Rect = { x: 0, y: CC.top, w: 60, h: CC.bottom - CC.top }
    const { portrait } = cardFlow(etroite)
    expect(portrait.w).toBeLessThanOrEqual(cardInnerW(etroite))
    expect(portraitScale(etroite)).toBeLessThan(CC.portraitScale)
  })
})

describe('flux vertical d\'une carte', () => {
  for (const n of [1, 3]) {
    it(`mode ${n === 1 ? 'évolution' : '3 voies'} : portrait, nom, stats et compétences ne se recouvrent pas`, () => {
      const card = cardRect(0, n)
      const f = cardFlow(card)
      const bandes = [
        ['portrait', { y: f.portrait.y, h: f.portrait.h }],
        ['nom', f.name], ['stats', f.stats], ['competences', f.skills],
      ] as const
      let bas = card.y
      for (const [nom, b] of bandes) {
        expect(b.y, `${nom} après ${bas}`).toBeGreaterThanOrEqual(bas)
        expect(b.h, `${nom} hauteur`).toBeGreaterThan(0)
        bas = b.y + b.h
      }
      expect(bas, 'bas du dernier bloc').toBeLessThanOrEqual(card.y + card.h)
    })
  }

  it('la bande de compétences est un multiple ENTIER de la hauteur de ligne', () => {
    // sinon la dernière ligne serait à moitié dans la bande, à moitié dehors — et « à moitié dehors »
    // se lit à l'écran comme un texte coupé net
    for (const n of [1, 3]) {
      const f = cardFlow(cardRect(0, n))
      expect(f.skills.h % lineH(CC.skillFont)).toBe(0)
      expect(maxSkillLines(cardRect(0, n))).toBe(f.skills.h / lineH(CC.skillFont))
    }
  })
})

describe('textes des cartes', () => {
  it('le nom de CHAQUE classe tient sur une ligne de carte de choix', () => {
    const card = cardRect(0, 3)
    const trop = CHOICES.filter((id) => CLASSES[id].name.length > nameChars(card))
    expect(trop, `noms trop longs (max ${nameChars(card)}) : ${trop.join(', ')}`).toEqual([])
  })

  it('la ligne « classe → évolution » tient dans la carte d\'évolution', () => {
    const card = cardRect(0, 1)
    const lignes = Object.entries(EVOLUTIONS).map(([from, to]) =>
      `${CLASSES[from as ClassId].name} → ${CLASSES[to!].name}`)
    expect(lignes.length).toBeGreaterThan(0)
    for (const l of lignes) {
      expect(l.length, `« ${l} » (${nameChars(card)} caractères disponibles)`).toBeLessThanOrEqual(nameChars(card))
      expect(fitName(l, card), 'aucune ellipse nécessaire').toBe(l)
    }
  })

  it('les deux lignes de stats tiennent dans toutes les cartes, pour toutes les classes', () => {
    for (const n of [1, 3]) {
      const card = cardRect(0, n)
      for (const id of ALL) {
        for (const l of statsText(id)) {
          expect(l.length, `${id} : « ${l} » (max ${statsChars(card)})`).toBeLessThanOrEqual(statsChars(card))
        }
      }
    }
  })

  it('aucun nom de compétence ne dépasse la largeur de sa carte', () => {
    for (const n of [1, 3]) {
      const card = cardRect(0, n)
      for (const id of ALL) {
        for (const s of skillsOf(id)) {
          expect(`• ${s.name}`.length, `${id} · ${s.name} (max ${skillChars(card)})`)
            .toBeLessThanOrEqual(skillChars(card))
        }
      }
    }
  })
})

describe('liste de compétences bornée', () => {
  it('n\'affiche jamais plus de lignes que la bande n\'en contient', () => {
    for (const n of [1, 3]) {
      const card = cardRect(0, n)
      for (const reserved of [0, 1]) {
        for (const id of ALL) {
          const { shown, hidden } = splitSkills(skillsOf(id).map((s) => s.name), card, reserved)
          const lignes = shown.length + (hidden > 0 ? 1 : 0) + reserved
          expect(lignes, `${id} (réservé ${reserved})`).toBeLessThanOrEqual(maxSkillLines(card))
          expect(shown.length + hidden, `${id} : total conservé`).toBe(skillsOf(id).length)
        }
      }
    }
  })

  it('annonce le surplus dès qu\'il y en a (les classes ont 8 à 9 sorts, la carte n\'en montre que 3-4)', () => {
    const card = cardRect(0, 3)
    const { shown, hidden } = splitSkills(skillsOf('mage').map((s) => s.name), card)
    expect(skillsOf('mage').length).toBeGreaterThan(shown.length)
    expect(hidden).toBe(skillsOf('mage').length - shown.length)
    expect(shown.length, 'une carte qui ne montrerait rien serait « correcte » et inutile').toBeGreaterThanOrEqual(2)
  })

  it('ne tronque rien quand tout tient', () => {
    const card = cardRect(0, 3)
    const { shown, hidden } = splitSkills(['a', 'b'], card)
    expect(shown).toEqual(['a', 'b'])
    expect(hidden).toBe(0)
  })
})

describe('pied d\'écran : les trois éléments qui se marchaient dessus', () => {
  // les libellés les plus longs que le jeu puisse produire
  const action = `Évoluer en ${CLASSES.chevalier.name} !`
  const training = '⚔ Entraînement'
  const message = ALL.map((id) => `Tu es maintenant ${CLASSES[id].name} !`)
    .sort((a, b) => b.length - a.length)[0]!

  it('bouton d\'action, bouton d\'entraînement et message de fin sont deux à deux disjoints', () => {
    const rects = { action: actionRect(action), entrainement: trainingRect(training), message: messageRect(message) }
    const paires = Object.entries(rects)
    for (const [i, [na, a]] of paires.entries()) {
      for (const [nb, b] of paires.slice(i + 1)) {
        expect(overlap(a, b), `${na} × ${nb}`).toBe(false)
      }
    }
  })

  it('aucun élément du pied d\'écran n\'empiète sur les cartes', () => {
    const cartes = [...[0, 1, 2].map((i) => cardRect(i, 3)), cardRect(0, 1)]
    for (const r of [actionRect(action), trainingRect(training), messageRect(message)]) {
      for (const c of cartes) expect(overlap(r, c)).toBe(false)
    }
  })

  it('tout le pied d\'écran reste dans l\'écran (0→960 × 0→540)', () => {
    for (const [nom, r] of Object.entries({
      action: actionRect(action), entrainement: trainingRect(training), message: messageRect(message),
    })) {
      expect(r.x, `${nom}.x`).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w, `${nom} droite`).toBeLessThanOrEqual(DESIGN.w)
      expect(r.y, `${nom}.y`).toBeGreaterThanOrEqual(0)
      expect(r.y + r.h, `${nom} bas`).toBeLessThanOrEqual(DESIGN.h)
    }
  })

  it('le bouton d\'action tient dans l\'écran MÊME au sommet de son battement', () => {
    // il grossit de 6 % en boucle : réserver sa taille au repos ne suffirait pas
    const r = actionRect(action)
    const grossi = { x: DESIGN.w / 2 - (r.w * CC.actionPulse) / 2, y: r.y, w: r.w * CC.actionPulse, h: r.h * CC.actionPulse }
    expect(grossi.x).toBeGreaterThanOrEqual(0)
    expect(grossi.x + grossi.w).toBeLessThanOrEqual(DESIGN.w)
    expect(overlap(grossi, trainingRect(training)), 'battement × entraînement').toBe(false)
  })

  it('le titre le plus long tient dans l\'écran', () => {
    const titre = '✦ Choisis ta voie, petit panda ✦'
    expect(titre.length * CC.titleFont * 0.6).toBeLessThanOrEqual(DESIGN.w - 40)
  })
})
