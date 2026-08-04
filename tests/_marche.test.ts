import { describe, it, expect } from 'vitest'
import { LEVELS, PLANS_CHOISIS } from '../src/data/levels'
import type { Module } from '../src/data/level-modules'

describe('marches géantes', () => {
  it('où sont-elles, et à quel décor appartiennent-elles ?', () => {
    const out: string[] = []
    let total = 0
    for (const l of Object.values(LEVELS)) {
      const plats = [...l.platforms].sort((a, b) => a.x - b.x)
      for (let i = 1; i < plats.length; i++) {
        const a = plats[i - 1]!, b = plats[i]!
        const ecart = b.x - (a.x + a.w)
        const dy = Math.abs(a.y - b.y)
        if (ecart < 0 || ecart > 1 || dy < 6) continue // collées (ou presque) ET très décalées
        total++
        if (out.length < 14) {
          const mods = (PLANS_CHOISIS[l.id]?.modules ?? []) as Module[]
          let x = 2, dedans = '?'
          for (const m of mods) {
            const w = m.widthRange[0] + (0) // approximation : on cherche juste le voisinage
            if (b.x >= x && b.x < x + m.widthRange[1]) { dedans = m.kind; break }
            x += w
          }
          out.push(`${l.id} x${a.x}+${a.w}y${a.y} → x${b.x}+${b.w}y${b.y} (Δy ${dy}, écart ${ecart}) ~ ${dedans}`)
        }
      }
    }
    expect(0, `\nMARCHES ≥6 RANGÉES entre deux plateformes COLLÉES : ${total}\n   ${out.join('\n   ')}\n`).toBe(1)
  })
})
