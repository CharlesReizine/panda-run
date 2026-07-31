import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUN MONSTRE POSÉ DANS UN DANGER.
//
// Retour user : « l'angeling dans Bocage est positionné sur des flammes ». Le placeur de spawns
// (level-modules.ts) ne vérifiait QUE la distance au point de départ — jamais les dangers. Un mob
// pouvait donc naître dans un mur de flammes : il y cuit, le joueur le voit clignoter et mourir tout
// seul, et un élite censé être un événement devient une farce.
//
// Ce test balaie TOUS les terrains, pas seulement celui signalé : c'est le seul moyen de savoir si
// le problème était isolé ou général.

const isFlame = (h: { kind: string }) => h.kind === 'spikes'
const isLava = (h: { kind: string; water?: string }) => h.kind === 'water' && h.water === 'lave'

describe('spawns et dangers', () => {
  it('aucun monstre terrestre ne naît dans des flammes ou de la lave', () => {
    const offenders: string[] = []
    for (const lv of Object.values(LEVELS)) {
      const dangers = (lv.hazards ?? []).filter((h) => isFlame(h) || isLava(h))
      if (!dangers.length) continue
      for (const s of lv.spawns) {
        const m = MONSTERS[s.monsterId]
        if (!m || m.aerial || m.aquatic) continue // volants et aquatiques ne posent pas les pieds là
        for (const h of dangers) {
          const sameColumn = s.x >= h.x && s.x < h.x + h.w
          if (!sameColumn) continue
          // le danger repose sur la surface `top` ; un spawn sur une plateforme BIEN au-dessus est sain
          const sameLevel = s.y === undefined || h.top === undefined || Math.abs(s.y - h.top) <= 1
          if (sameLevel) offenders.push(`${lv.id}: ${s.monsterId} en x=${s.x} sur ${h.kind}${isLava(h) ? '/lave' : ''} [${h.x}..${h.x + h.w})`)
        }
      }
    }
    expect(offenders, `${offenders.length} monstre(s) posé(s) dans un danger :\n  ${offenders.join('\n  ')}`).toEqual([])
  })
})
