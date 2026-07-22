import { describe, it, expect } from 'vitest'
import { SKILLS, maxRankOf, skillDamageMult, CHARGE_MIN_MULT } from '../../src/data/skills'
import { MAX_SKILL_RANK } from '../../src/core/player-state'

describe('rangs jusqu\'à 10 (signatures) + interpolation douce', () => {
  it('maxRankOf : défaut 5, signatures 10', () => {
    expect(maxRankOf(SKILLS['taillade']!)).toBe(MAX_SKILL_RANK)
    expect(maxRankOf(SKILLS['estoc-rapide']!)).toBe(5)
    for (const id of ['epee-fantome', 'grand-croix', 'faille-du-neant', 'tempete-foudroyante', 'blizzard', 'rayon-arcanique', 'pluie-de-meteores', 'fleche-mortelle', 'fleche-percante']) {
      expect(maxRankOf(SKILLS[id]!), id).toBe(10)
    }
  })

  it('skillDamageMult : rang 1 = base, rang max normal = 2× base', () => {
    const s = SKILLS['taillade']!
    expect(skillDamageMult(s, 1)).toBeCloseTo(s.multiplier)
    expect(skillDamageMult(s, 5)).toBeCloseTo(s.multiplier * 2)
  })

  it('skillDamageMult : rang 10 signature = 2,5× base, gain PAR RANG plus doux qu\'un skill normal', () => {
    const sig = SKILLS['faille-du-neant']!
    expect(skillDamageMult(sig, 1)).toBeCloseTo(sig.multiplier)
    expect(skillDamageMult(sig, 10)).toBeCloseTo(sig.multiplier * 2.5)
    // gain PAR RANG : signature (1,5/9 ≈ 0,167) < normal (1,0/4 = 0,25)
    const gainSig = (skillDamageMult(sig, 2) - skillDamageMult(sig, 1)) / sig.multiplier
    const norm = SKILLS['taillade']!
    const gainNorm = (skillDamageMult(norm, 2) - skillDamageMult(norm, 1)) / norm.multiplier
    expect(gainSig).toBeLessThan(gainNorm)
  })

  it('charge = plus de dégâts (min < plein)', () => {
    expect(CHARGE_MIN_MULT).toBeGreaterThan(0)
    expect(CHARGE_MIN_MULT).toBeLessThan(1)
    expect(SKILLS['boule-de-feu']!.chargeable).toBe(true)
  })
})

describe('mécaniques nouvelles : présence des flags', () => {
  it('canalisé : lance-flammes (haut+bas), eclair, mitraillette ont une config channel + drain', () => {
    for (const id of ['lance-flammes', 'eclair', 'mitraillette']) {
      const s = SKILLS[id]!
      expect(s.kind, id).toBe('channel')
      expect(s.channel!.manaPerTick, id).toBeGreaterThan(0)
      expect(s.channel!.tickMs, id).toBeGreaterThan(0)
    }
    expect(SKILLS['lance-flammes']!.channel!.tall).toBe(true) // couvre HAUT + BAS
  })

  it('estoc rapide : pas de cooldown réel + coût mana élevé par coup', () => {
    const s = SKILLS['estoc-rapide']!
    expect(s.spam).toBe(true)
    expect(s.cooldownMs).toBeLessThanOrEqual(1)
    expect(s.manaCost!).toBeGreaterThanOrEqual(20)
  })

  it('faille du néant : zone voidRift à courte portée (pas un projectile perçant)', () => {
    const s = SKILLS['faille-du-neant']!
    expect(s.voidRift).toBe(true)
    expect(s.kind).toBe('aoe')
    expect(s.pierce).toBeFalsy()
  })

  it('aura d\'épines : aura offensive (kind aura, pas un buff) avec tick + rayon', () => {
    const s = SKILLS['aura-epines']!
    expect(s.kind).toBe('aura')
    expect(s.aura!.radius).toBeGreaterThan(0)
    expect(s.buff).toBeUndefined()
  })

  it('dévotion : buff défensif qui réduit les dégâts subis', () => {
    const s = SKILLS['devotion']!
    expect(s.guard!.dmgTakenMult).toBeLessThan(1)
  })

  it('flèche-grappin (déplacement) et assaut du faucon (blitz) portent leurs flags', () => {
    expect(SKILLS['fleche-grappin']!.grapple).toBe(true)
    expect(SKILLS['blitz-faucon']!.falconBlitz).toBe(true)
  })
})
