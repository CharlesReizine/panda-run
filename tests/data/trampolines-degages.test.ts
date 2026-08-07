import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { trampolinesSousPlafond, CLAIR_TRAMPOLINE } from '../../src/core/level-validator'
import { maxJumpTiles } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN TRAMPOLINE A LE CIEL AU-DESSUS DE LUI
//
// Retour du joueur : « il y a des trampolines qui sont mis juste en dessous d'un plateau, donc on peut
// juste pas sauter dessus. Faut peut-être rajouter un test de hauteur minimale entre trampoline et
// plateau juste au-dessus qui fait 2 sauts genre. »
//
// ⚠️ ET C'EST PIRE QU'INUTILE, C'EST TROMPEUR. Un trampoline annonce « d'ici, on monte » — c'est tout
// son propos, et le motif qui le pose a bâti son chemin autour. Sous un plateau, il ne fait que cogner :
// le joueur insiste, croit avoir raté son timing, et finit par croire que l'engin est cassé. Un objet
// qui ment sur ce qu'il fait coûte plus cher qu'un objet absent.
//
// Vingt-cinq cas mesurés, TOUS à trois tuiles de dégagement — de quoi cogner, pas de quoi décoller.
//
// ⚠️ AUCUN MOTIF N'EN ÉTAIT LA CAUSE, et c'est ce qui rend la correction générale. Les tapis arrivent
// sous les corniches des modules VOISINS, ou sous les résidus laissés par les passes de rognage : le
// trampoline est au bon endroit du point de vue de SON motif. L'assemblage le fait donc glisser sur sa
// propre surface porteuse jusqu'à une colonne dégagée, et ne le retire que si toute la surface est
// couverte — auquel cas il n'y avait rien à sauver.

describe('trampolines dégagés', () => {
  it('aucun trampoline ne cogne dans un plateau', () => {
    const coinces = Object.values(LEVELS).flatMap((l) =>
      trampolinesSousPlafond(l).map((t) => `${l.id} x${t.x} y${t.y} — plafond à ${t.plafond} (${t.libre} tuiles)`))
    expect(coinces, `trampolines coincés :\n   ${coinces.join('\n   ')}`).toEqual([])
  })

  it('le seuil vaut bien DEUX hauteurs de saut, comme demandé', () => {
    // le premier rebond vaut exactement un saut normal (BOUNCE_SPEED) : en exiger deux, c'est garantir
    // qu'on décolle vraiment — qu'il reste de la course une fois fait ce qu'un saut ordinaire faisait déjà
    expect(CLAIR_TRAMPOLINE).toBeCloseTo(2 * maxJumpTiles(), 5)
  })

  it('il reste des trampolines : on a dégagé, pas déblayé', () => {
    const total = Object.values(LEVELS).reduce((n, l) => n + (l.trampolines ?? []).length, 0)
    expect(total, 'plus un seul trampoline dans le jeu').toBeGreaterThan(20)
  })

  it('chaque trampoline repose bien sur une surface', () => {
    const flottants: string[] = []
    for (const l of Object.values(LEVELS)) {
      for (const t of l.trampolines ?? []) {
        const porte = l.platforms.some((p) => p.y === t.y + 1 && t.x >= p.x && t.x < p.x + p.w)
          || (l.rockBands ?? []).some((r) => t.x >= r.x && t.x < r.x + r.w && r.y === t.y + 1)
          || t.y + 1 >= (l.heightTiles ?? 16) - 2 // le sol du monde
        if (!porte) flottants.push(`${l.id} x${t.x} y${t.y}`)
      }
    }
    expect(flottants, `trampolines en l'air :\n   ${flottants.join('\n   ')}`).toEqual([])
  })
})
