import { describe, it, expect } from 'vitest'
import { canReach, canReachByBounce, maxJumpHeightPx, maxBounceHeightPx, BOUNCE_SPEED, BOUNCE_RUN_MULT } from '../../src/core/platforming'
import { JUMP_SPEED } from '../../src/core/platforming'
import { LEVELS } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// TRAMPOLINE
//
// Demande du user : « crée un nouvel élément graphique : le trampoline. Ça fait genre faire un saut 3 fois
// plus haut et ça permet aussi d'aller plus sur le côté. » Puis, en précision : « on peut marcher devant
// (et il se passe rien) ou sauter dessus / tomber dessus et là ça fait des trucs. »
//
// Le test central est le facteur DE HAUTEUR. La hauteur d'un saut vaut v²/2g : tripler la VITESSE
// multiplierait la hauteur par NEUF. Il faut donc √3 sur la vitesse — une erreur invisible dans le code et
// très visible à l'écran. Et le moteur comme les validateurs doivent lire la MÊME constante, sinon un
// motif jouable serait déclaré injouable, ou l'inverse.

describe('trois fois plus haut, pas neuf', () => {
  it('la hauteur de rebond vaut TROIS fois celle d\'un saut', () => {
    expect(maxBounceHeightPx() / maxJumpHeightPx()).toBeCloseTo(3, 5)
  })

  it('la vitesse de rebond est √3 fois la vitesse de saut, pas 3 fois', () => {
    expect(BOUNCE_SPEED / JUMP_SPEED).toBeCloseTo(Math.sqrt(3), 5)
    expect(BOUNCE_SPEED / JUMP_SPEED).toBeLessThan(2)
  })

  it('il porte aussi plus LOIN latéralement', () => {
    expect(BOUNCE_RUN_MULT).toBeGreaterThan(1)
  })
})

describe('portée du rebond', () => {
  const plat = (dy: number) => ({ x: 20, y: 20 - dy, w: 6 })

  it('atteint ce qu\'un saut simple n\'atteint pas', () => {
    // +8 rangées : hors de portée au saut (≈4), à portée au rebond (≈12)
    const cible = plat(8)
    expect(canReach(20, cible, 0)).toBe(false)
    expect(canReachByBounce(20, cible, 0)).toBe(true)
  })

  it('reste borné : il ne permet pas d\'atteindre n\'importe quelle hauteur', () => {
    expect(canReachByBounce(20, plat(30), 0)).toBe(false)
  })

  it('franchit un écart horizontal plus large qu\'un saut, à hauteur égale', () => {
    let dernierSaut = 0, dernierRebond = 0
    for (let g = 0; g < 40; g++) {
      if (canReach(20, { x: 20, y: 20, w: 4 }, g)) dernierSaut = g
      if (canReachByBounce(20, { x: 20, y: 20, w: 4 }, g)) dernierRebond = g
    }
    expect(dernierRebond).toBeGreaterThan(dernierSaut)
  })
})

describe('présence dans le jeu', () => {
  const avecTrampo = Object.values(LEVELS).filter((l) => (l.trampolines ?? []).length > 0)

  it('des trampolines existent réellement dans des terrains', () => {
    expect(avecTrampo.length).toBeGreaterThan(0)
  })

  it('ils sont répartis du DÉBUT à la FIN du jeu, pas groupés', () => {
    const ordre = Object.keys(LEVELS)
    const idx = avecTrampo.map((l) => ordre.indexOf(l.id))
    expect(Math.min(...idx), 'aucun trampoline en début de jeu').toBeLessThan(ordre.length / 3)
    expect(Math.max(...idx), 'aucun trampoline en fin de jeu').toBeGreaterThan(ordre.length / 2)
  })

  it('le PREMIER trampoline du jeu est sur du plat : on apprend l\'objet sans risque', () => {
    // découvrir un rebond ×3 au-dessus d'un trou serait une mort gratuite
    const ordre = Object.keys(LEVELS)
    const premier = avecTrampo.sort((a, b) => ordre.indexOf(a.id) - ordre.indexOf(b.id))[0]!
    for (const t of premier.trampolines ?? []) {
      const surTrou = (premier.gaps ?? []).some((g) => t.x >= g.x - 1 && t.x <= g.x + g.w + 1)
      expect(surTrou, `${premier.id}: trampoline au bord d'un trou dès le premier`).toBe(false)
    }
  })

  it('aucun trampoline n\'est posé dans le vide : on doit pouvoir y revenir', () => {
    for (const l of Object.values(LEVELS)) {
      for (const t of l.trampolines ?? []) {
        const dansTrou = (l.gaps ?? []).some((g) => t.x >= g.x && t.x < g.x + g.w)
        expect(dansTrou, `${l.id}: trampoline au-dessus d'un trou`).toBe(false)
      }
    }
  })
})
