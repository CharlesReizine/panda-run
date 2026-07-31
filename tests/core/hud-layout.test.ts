import { describe, it, expect } from 'vitest'
import { HUD_LEFT, overlap, type HudRect } from '../../src/scenes/hud-layout'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE HUD NE SE MARCHE PAS DESSUS.
//
// Retour user : « les buff d'attaque et tout overlap avec la touche compétence ». La pastille de buff
// (x 12→116, y 86→110) recouvrait le bouton « Compétences » (x 47→185, y 78→102) et le badge de
// points. Chaque élément était placé par des littéraux dispersés dans UIScene, sans que personne ne
// regarde les voisins.
//
// Ce test est le garde-fou : déplacer un élément du HUD sans vérifier ses voisins fait TOMBER la
// suite. C'est volontairement contraignant — c'est le deuxième chevauchement signalé par le joueur.

const entries = Object.entries(HUD_LEFT) as [string, HudRect][]

describe('disposition du HUD (colonne gauche)', () => {
  it('aucune paire d\'éléments ne se recouvre', () => {
    const clashes: string[] = []
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [na, a] = entries[i]!
        const [nb, b] = entries[j]!
        if (overlap(a, b)) clashes.push(`${na} × ${nb}`)
      }
    }
    expect(clashes, `chevauchement(s) : ${clashes.join(', ')}`).toEqual([])
  })

  it('tout tient dans l\'écran (les coordonnées du HUD sont en espace de conception 960×540)', () => {
    for (const [name, r] of entries) {
      expect(r.x, `${name}.x`).toBeGreaterThanOrEqual(0)
      expect(r.y, `${name}.y`).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w, `${name} droite`).toBeLessThanOrEqual(960)
      expect(r.y + r.h, `${name} bas`).toBeLessThanOrEqual(540)
    }
  })

  it('les rangées laissent au moins 8 px d\'interligne', () => {
    // empilement vertical attendu : panneau de vie → bouton → buff → badge
    const stack = [HUD_LEFT.lifePanel, HUD_LEFT.skillsBtn, HUD_LEFT.buffPill, HUD_LEFT.spBadge]
    for (let i = 1; i < stack.length; i++) {
      const above = stack[i - 1]!, below = stack[i]!
      expect(below.y - (above.y + above.h), `interligne rangée ${i}`).toBeGreaterThanOrEqual(8)
    }
  })
})
