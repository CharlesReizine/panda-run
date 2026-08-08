import { describe, it, expect } from 'vitest'
import { coupsPortes, tuilesEntamees, detruitDUnCoup, COUPS_PAR_TUILE, type SourceDeCoup } from '../../src/core/casse-pierre'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE ATTAQUE ÉBRÈCHE, UNE COMPÉTENCE DÉTRUIT
//
// Retour du joueur, en deux temps. D'abord : « les briques à casser, quand je fais des skills dessus, ça
// me prend des plombes à détruire. Genre mitraillette, ça détruit pas en une seconde, c'est pas jouissif
// du tout. » Puis, une fois les tirs corrigés : « c'est pas tant l'attaque à distance, je veux que les
// SKILLS cassent bien les briques GLOBALEMENT. »
//
// ⚠️ LE PREMIER CORRECTIF N'AVAIT TRAITÉ QU'UN CANAL SUR TROIS. Un projectile détruisait sa tuile d'un
// coup ; le corps à corps, lui, continuait d'en ébrécher UNE SEULE d'un tiers, même porté par une
// ultime ; et les compétences de ZONE ne touchaient pas la pierre du tout. Une faille de lumière qui
// balaie l'écran et laisse un mur de briques intact, c'est le décor qui répond « ta compétence n'a
// servi à rien ».

const COMPETENCES: SourceDeCoup[] = ['competence-melee', 'competence-zone', 'projectile']
const GESTES_ORDINAIRES: SourceDeCoup[] = ['attaque', 'saut']

describe('ce qu\'un coup fait à la pierre fragile', () => {
  it('une compétence détruit une tuile intacte d\'un seul coup', () => {
    for (const s of COMPETENCES) {
      expect(detruitDUnCoup(s), s).toBe(true)
      expect(coupsPortes(s), s).toBeGreaterThanOrEqual(COUPS_PAR_TUILE)
    }
  })

  // ⚠️ ET L'ATTAQUE DE BASE GARDE SA RÉSISTANCE, CE QUI N'EST PAS UNE DEMI-MESURE. Les trois coups
  // racontent quelque chose au corps à corps ordinaire — la tuile se fissure, on sent la pierre céder.
  // C'est sur une compétence qu'ils ne racontent plus rien : on vient de payer de l'énergie et un
  // temps de recharge. Tout casser d'un coup partout ferait de la pierre fragile un rideau.
  it('une attaque de base et un saut ébrèchent, ils ne pulvérisent pas', () => {
    for (const s of GESTES_ORDINAIRES) {
      expect(detruitDUnCoup(s), s).toBe(false)
      expect(coupsPortes(s), s).toBe(1)
      expect(tuilesEntamees(s), s).toBe(1)
    }
  })

  it('une compétence emporte TOUTES les tuiles qu\'elle couvre, un coup normal une seule', () => {
    for (const s of COMPETENCES) expect(tuilesEntamees(s), s).toBe('toutes')
    for (const s of GESTES_ORDINAIRES) expect(tuilesEntamees(s), s).toBe(1)
  })

  it('une tuile plus dure résiste encore à une compétence', () => {
    expect(detruitDUnCoup('competence-melee', COUPS_PAR_TUILE + 2)).toBe(false)
  })

  // ⚠️ ET LE CÂBLAGE EST VÉRIFIÉ, PAS SEULEMENT LA RÈGLE. C'est exactement ce qui manquait la première
  // fois : la constante était juste, et deux canaux sur trois ne l'appelaient jamais. Ce test lit la
  // scène et exige que chaque famille de compétence ait bien un point d'entrée vers la pierre.
  it('chaque famille de compétence attaque VRAIMENT la pierre dans la scène', async () => {
    const mod = 'node:fs'
    const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync: (p: string, e: string) => string }
    const src = fs.readFileSync(new URL('../../src/scenes/LevelScene.ts', import.meta.url).pathname, 'utf8')
    expect(src, 'les compétences de corps à corps ne disent pas leur provenance')
      .toMatch(/meleeHit\(skill\.range[^)]*, *'competence-melee'\)/)
    expect(src, 'les compétences de zone ne cassent rien').toMatch(/pulveriserPierres\([^)]*'competence-zone'\)/)
    expect((src.match(/casserPierresSi\(|pulveriserPierres\(/g) ?? []).length,
      'trop peu de compétences branchées sur la pierre').toBeGreaterThanOrEqual(5)
  })
})
