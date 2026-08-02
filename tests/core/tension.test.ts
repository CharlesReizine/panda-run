import { describe, it, expect } from 'vitest'
import { PORTEE_MENACE, lisser, tensionDe, type EtatDanger } from '../../src/core/tension'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA BANDE-SON RÉAGIT AU DANGER
//
// Demande du user : « fais-moi […] l'ambiance ». Le jeu avait des bruitages et une musique, mais rien
// qui réagisse : la même boucle, indifférente, qu'on explore une plaine vide ou qu'on se fasse encercler
// à trois points de vie.
//
// Ce que ce test protège, ce n'est pas un chiffre mais un CLASSEMENT : ce qui doit faire plus peur doit
// produire plus de tension. Les valeurs se règlent à l'oreille et bougeront ; les inégalités, non.

const calme: EtatDanger = {
  distMobProche: Infinity, mobsProches: 0, eliteProche: false, fractionPv: 1, toucheRecemment: false,
}

describe('tension musicale', () => {
  it('un terrain vide et le joueur à pleine vie : silence complet', () => {
    expect(tensionDe(calme)).toBe(0)
  })

  it('plus le monstre est proche, plus la tension monte', () => {
    const a = tensionDe({ ...calme, mobsProches: 1, distMobProche: 800 })
    const b = tensionDe({ ...calme, mobsProches: 1, distMobProche: 300 })
    const c = tensionDe({ ...calme, mobsProches: 1, distMobProche: 40 })
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('au-delà d\'une largeur d\'écran, un monstre ne pèse plus rien', () => {
    expect(tensionDe({ ...calme, mobsProches: 1, distMobProche: PORTEE_MENACE })).toBe(0)
    expect(tensionDe({ ...calme, mobsProches: 1, distMobProche: PORTEE_MENACE + 500 })).toBe(0)
  })

  it('être encerclé pèse plus qu\'un seul adversaire, à distance égale', () => {
    const seul = tensionDe({ ...calme, mobsProches: 1, distMobProche: 200 })
    const trois = tensionDe({ ...calme, mobsProches: 3, distMobProche: 200 })
    expect(trois).toBeGreaterThan(seul)
  })

  it('la vie basse tend la musique même sans ennemi en vue', () => {
    expect(tensionDe({ ...calme, fractionPv: 0.15 })).toBeGreaterThan(0.5)
    // …mais au-dessus de la moitié, tout va bien : pas de musique dramatique pour une égratignure
    expect(tensionDe({ ...calme, fractionPv: 0.6 })).toBe(0)
  })

  it('un élite à l\'écran suffit, même loin et à pleine vie', () => {
    const t = tensionDe({ ...calme, eliteProche: true, distMobProche: 850, mobsProches: 1 })
    expect(t).toBeGreaterThanOrEqual(0.6)
  })

  it('un coup encaissé garde la musique tendue quelques secondes', () => {
    expect(tensionDe({ ...calme, toucheRecemment: true })).toBeGreaterThanOrEqual(0.5)
  })

  it('reste bornée à 1 même quand tout va mal en même temps', () => {
    const t = tensionDe({ distMobProche: 0, mobsProches: 9, eliteProche: true, fractionPv: 0.01, toucheRecemment: true })
    expect(t).toBeLessThanOrEqual(1)
    expect(t).toBeGreaterThan(0.9)
  })

  it('monte VITE et redescend LENTEMENT — c\'est ça qui empêche la musique de clignoter', () => {
    // même écart, même durée : la montée doit couvrir bien plus de chemin que la descente
    const monte = lisser(0, 1, 400)
    const descend = 1 - lisser(1, 0, 400)
    expect(monte).toBeGreaterThan(0.5)
    expect(descend).toBeLessThan(0.2)
  })

  it('le lissage converge vers la cible sans la dépasser', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = lisser(v, 0.7, 100)
    expect(v).toBeCloseTo(0.7, 3)
    for (let i = 0; i < 400; i++) v = lisser(v, 0.1, 100)
    expect(v).toBeCloseTo(0.1, 3)
  })
})
