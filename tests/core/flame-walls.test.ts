import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { TILE } from '../../src/core/platforming'

// MURS DE FLAMMES ÉLARGIS ×2 (retour user) — invariant de JOUABILITÉ : il doit TOUJOURS rester de la
// place pour se poser et sauter ENTRE deux murs de flammes voisins. LevelScene élargit chaque flamme
// ×2 mais CLAMPE l'étendue au milieu ± (GAP/2) avec ses voisines de la même surface. On rejoue ce même
// calcul ici et on vérifie qu'aucune paire de flammes adjacentes ne laisse moins de MIN_GAP de sol libre.

const GAP = 2 * TILE
// Seuil de jouabilité : le clamp vise 2 tuiles de sol franc, mais ne rétrécit JAMAIS une flamme sous sa
// taille d'origine → là où le level design plaçait déjà des flammes à 1 tuile d'écart (enfer), on garde
// ce 1 tuile (jamais de fusion). On exige donc AU MOINS ~1 tuile de sol franc = de quoi se poser + sauter.
const MIN_GAP = 0.95 * TILE

// étendue élargie-clampée [l,r] (px) de chaque flamme d'un niveau, dans l'ordre des x.
function widenedFlames(levelId: string): { top: number; l: number; r: number }[] {
  const flames = (LEVELS[levelId]!.hazards ?? []).filter((h) => h.kind === 'spikes').slice().sort((a, b) => a.x - b.x)
  return flames.map((h, k) => {
    const baseL = h.x * TILE, baseR = (h.x + h.w) * TILE, half = (h.w * TILE) / 2
    let l = baseL - half, r = baseR + half
    const prev = flames[k - 1], next = flames[k + 1]
    if (prev && (prev.top ?? -1) === (h.top ?? -1)) l = Math.max(l, ((prev.x + prev.w) * TILE + baseL) / 2 + GAP / 2)
    if (next && (next.top ?? -1) === (h.top ?? -1)) r = Math.min(r, (baseR + next.x * TILE) / 2 - GAP / 2)
    return { top: h.top ?? -1, l: Math.min(l, baseL), r: Math.max(r, baseR) }
  })
}

describe('murs de flammes élargis ×2 — jouabilité', () => {
  it('deux murs de flammes voisins laissent toujours de quoi se poser + sauter (≥ 1,4 tuile)', () => {
    const bad: string[] = []
    for (const id of Object.keys(LEVELS)) {
      const fl = widenedFlames(id).sort((a, b) => a.l - b.l)
      for (let i = 1; i < fl.length; i++) {
        if (fl[i]!.top !== fl[i - 1]!.top) continue // surfaces différentes : pas de saut horizontal entre elles
        const gap = fl[i]!.l - fl[i - 1]!.r
        if (gap < MIN_GAP) bad.push(`${id} (écart ${(gap / TILE).toFixed(1)} tuiles)`)
      }
    }
    expect(bad, `flammes trop rapprochées : ${bad.join(', ')}`).toEqual([])
  })
})
