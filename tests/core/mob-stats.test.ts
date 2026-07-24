import { describe, it, expect } from 'vitest'
import { statsForLevel, statPower, hpBase, atkBase, defBase, type MobRole } from '../../src/core/mob-stats'

const ROLES: MobRole[] = ['normal', 'costaud', 'tank', 'frele', 'distant', 'rapide', 'volant']

describe('courbe de base stats↔niveau', () => {
  it('hp/atk/def de base sont strictement croissants avec le niveau', () => {
    for (let L = 1; L < 80; L++) {
      expect(hpBase(L + 1)).toBeGreaterThan(hpBase(L))
      expect(atkBase(L + 1)).toBeGreaterThan(atkBase(L))
      expect(defBase(L + 1)).toBeGreaterThanOrEqual(defBase(L))
    }
  })
})

describe('statsForLevel', () => {
  it('pour un rôle donné, chaque stat croît avec le niveau', () => {
    for (const role of ROLES) {
      for (let L = 1; L < 79; L++) {
        const a = statsForLevel(L, role)
        const b = statsForLevel(L + 2, role)
        expect(b.hp).toBeGreaterThan(a.hp)
        expect(b.atk).toBeGreaterThan(a.atk)
      }
    }
  })

  it('le rôle de COMBAT ne fait que REDISTRIBUER la puissance : écart borné (≤ 20%) autour du niveau', () => {
    // La puissance globale est pilotée par le NIVEAU ; le rôle la répartit entre PV/ATK/DÉF sans la
    // créer. On borne donc l'écart entre le rôle le plus « puissant » et le plus « faible » d'un même
    // niveau → deux mobs de même niveau restent comparables (pas de tank 3× un rôle voisin du même niveau).
    // EXCEPTION : 'frele' est le tier CHAIR À CANON assumé (porings/slimes inoffensifs, cf. baisse ATK
    // demandée) — délibérément SOUS la courbe, testé à part juste en dessous.
    const combatRoles = ROLES.filter((r) => r !== 'frele')
    for (let L = 1; L <= 78; L++) {
      let lo = Infinity, hi = 0
      for (const role of combatRoles) { const s = statsForLevel(L, role); const p = statPower(s.hp, s.atk, s.def); lo = Math.min(lo, p); hi = Math.max(hi, p) }
      expect(hi / lo, `L${L}`).toBeLessThanOrEqual(1.2)
    }
  })

  it('le rôle « frele » est le tier le plus faible mais pas dérisoire (55–90 % de la courbe normale)', () => {
    for (let L = 1; L <= 78; L++) {
      const f = statsForLevel(L, 'frele'); const n = statsForLevel(L, 'normal')
      const ratio = statPower(f.hp, f.atk, f.def) / statPower(n.hp, n.atk, n.def)
      expect(ratio, `L${L} frele/normal`).toBeLessThanOrEqual(0.9)
      expect(ratio, `L${L} frele/normal`).toBeGreaterThanOrEqual(0.55)
    }
  })

  it('le gabarit géant est plus coriace (PV) qu\'un même niveau normal', () => {
    for (let L = 10; L <= 70; L += 10) {
      expect(statsForLevel(L, 'tank', true).hp).toBeGreaterThan(statsForLevel(L, 'tank', false).hp)
    }
  })
})
