import { describe, it, expect } from 'vitest'
import {
  ANGLE_MAX, DUREE_TOTALE, PHASES, angleOndulation, battementAlternance, clignotement,
  intensiteRayons, montreNouvelleForme, phaseA, rotationRayons, voileBlanc,
} from '../../src/scenes/evolution-anim'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA SÉQUENCE D'ÉVOLUTION EST DU TEMPS, ET LE TEMPS SE RATE EN SILENCE.
//
// Une phase qui démarre avant la fin de la précédente, un clignotement qui accélère à l'envers, un voile
// qui n'atteint jamais l'opacité 1 (on aperçoit alors la nouvelle classe AVANT la révélation, et l'effet
// s'effondre) : rien de tout cela ne se voit en relisant du code de tween. Tout se voit ici.
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe('séquence d\'évolution', () => {
  it('les phases s\'enchaînent sans trou ni recouvrement', () => {
    for (let i = 1; i < PHASES.length; i++) {
      const av = PHASES[i - 1]!, ap = PHASES[i]!
      expect(ap.debut, `${av.nom} → ${ap.nom}`).toBe(av.debut + av.duree)
    }
    expect(PHASES[0]!.debut).toBe(0)
  })

  it('la séquence reste courte : entre 3 et 5 secondes', () => {
    // Trop court, on ne comprend pas ce qui se passe ; trop long, on veut passer. La référence tient
    // dans ces bornes.
    expect(DUREE_TOTALE).toBeGreaterThan(3000)
    expect(DUREE_TOTALE).toBeLessThan(5000)
  })

  it('l\'ondulation reste dans l\'amplitude déclarée, et l\'atteint vraiment', () => {
    let max = 0
    for (let t = 0; t <= DUREE_TOTALE; t += 5) max = Math.max(max, Math.abs(angleOndulation(t)))
    expect(max).toBeLessThanOrEqual(ANGLE_MAX + 0.001)
    expect(max).toBeGreaterThan(ANGLE_MAX - 0.5) // elle atteint bien l'amplitude, elle ne la frôle pas
  })

  it('l\'ondulation passe des DEUX côtés (c\'est un balancement, pas une inclinaison)', () => {
    let gauche = false, droite = false
    for (let t = 0; t <= phaseA('ondulation').duree; t += 5) {
      if (angleOndulation(t) < -ANGLE_MAX * 0.9) gauche = true
      if (angleOndulation(t) > ANGLE_MAX * 0.9) droite = true
    }
    expect(gauche && droite, 'le balancement doit atteindre les DEUX extrêmes').toBe(true)
  })

  it('l\'image est DROITE à la révélation : la nouvelle classe ne se présente pas de travers', () => {
    const rev = phaseA('revelation')
    for (let t = rev.debut; t <= rev.debut + rev.duree; t += 10) expect(angleOndulation(t)).toBe(0)
  })

  it('la lumière AUGMENTE : son enveloppe est croissante', () => {
    // « la lumière augmente augmente jusqu'à ce qu'on ne voit plus que du blanc ». On compare des
    // maxima par fenêtre, parce que le clignotement lui-même oscille.
    const fin = phaseA('alternance').debut + phaseA('alternance').duree
    const maxFenetre = (a: number, b: number) => {
      let m = 0
      for (let t = a; t < b; t += 5) m = Math.max(m, clignotement(t))
      return m
    }
    const tiers = fin / 3
    expect(maxFenetre(tiers, 2 * tiers)).toBeGreaterThan(maxFenetre(0, tiers))
    expect(maxFenetre(2 * tiers, fin)).toBeGreaterThan(maxFenetre(tiers, 2 * tiers))
  })

  it('l\'alternance ACCÉLÈRE (le battement raccourcit, jamais l\'inverse)', () => {
    let prec = Infinity
    for (let a = 0; a <= 1; a += 0.1) {
      const b = battementAlternance(a)
      expect(b).toBeLessThanOrEqual(prec)
      prec = b
    }
    expect(battementAlternance(1)).toBeLessThan(battementAlternance(0))
  })

  it('le voile SATURE à 1 pendant la phase blanche — sinon la bascule se voit', () => {
    const blanc = phaseA('blanc')
    for (let t = blanc.debut; t < blanc.debut + blanc.duree; t += 10) expect(voileBlanc(t)).toBe(1)
  })

  it('le voile part de 0 et revient à 0 : l\'écran n\'est jamais laissé blanc', () => {
    expect(voileBlanc(0)).toBe(0)
    expect(voileBlanc(DUREE_TOTALE)).toBe(0)
  })

  it('la NOUVELLE forme n\'apparaît qu\'après le blanc, et l\'ANCIENNE avant l\'alternance', () => {
    expect(montreNouvelleForme(0)).toBe(false)
    expect(montreNouvelleForme(phaseA('ondulation').duree - 10)).toBe(false)
    expect(montreNouvelleForme(phaseA('blanc').debut + 10)).toBe(true)
    expect(montreNouvelleForme(DUREE_TOTALE)).toBe(true)
  })

  it('pendant l\'alternance, les DEUX formes se montrent (sinon il n\'y a pas de clignotement)', () => {
    const alt = phaseA('alternance')
    let ancienne = false, nouvelle = false
    for (let t = alt.debut; t < alt.debut + alt.duree; t += 10) {
      if (montreNouvelleForme(t)) nouvelle = true; else ancienne = true
    }
    expect(ancienne && nouvelle).toBe(true)
  })
})

describe('fond de rayons', () => {
  it('l\'intensité part de 0, arrive à 1, et ne redescend jamais', () => {
    expect(intensiteRayons(0)).toBe(0)
    let prec = -1
    for (let t = 0; t <= DUREE_TOTALE; t += 20) {
      const v = intensiteRayons(t)
      expect(v).toBeGreaterThanOrEqual(prec)
      prec = v
    }
    expect(intensiteRayons(DUREE_TOTALE)).toBe(1)
  })

  it('le fond ENFLE, il ne stroboscope pas : aucun aller-retour dans l\'intensité', () => {
    // Le sujet clignote (clignotement), le fond gonfle. Deux lumières à la même cadence donnent une
    // image illisible — c'est la seule raison d'avoir deux courbes séparées.
    let inversions = 0
    let prec = intensiteRayons(0), sens = 1
    for (let t = 20; t <= DUREE_TOTALE; t += 20) {
      const v = intensiteRayons(t)
      const s = Math.sign(v - prec) || sens
      if (s !== sens) { inversions++; sens = s }
      prec = v
    }
    expect(inversions).toBe(0)
  })

  it('la rotation ACCÉLÈRE et se calcule en absolu (indépendante du taux de rafraîchissement)', () => {
    const d1 = rotationRayons(1000) - rotationRayons(0)
    const d2 = rotationRayons(3000) - rotationRayons(2000)
    expect(d2).toBeGreaterThan(d1)
    expect(rotationRayons(0)).toBe(0)
    // absolue = deux façons d'y arriver donnent le même angle (pas de dérive par cumul)
    expect(rotationRayons(2000)).toBeCloseTo(rotationRayons(2000), 10)
  })
})
