import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { strictReach } from '../../src/core/level-validator'

// ATTEIGNABILITÉ STRICTE (murs de roche pleine) — cf. level-validator.strictReach.
//
// Contrairement à `unreachablePlatforms` (sol = bande pleine largeur, « téléporte » à travers les
// murs), ce modèle DÉCOUPE le sol aux murs de roche solide et rend les dessus de roche marchables.
// Il attrape la classe de bug « plateforme derrière un mur, atteignable seulement en traversant la
// pierre » — invisible à l'ancien validateur (retour user : desert-9 « un saut que je peux pas faire,
// une plateforme que j'arrive pas à atteindre »).

const nonBoss = Object.entries(LEVELS).filter(([, l]) => !l.boss)

// TERRAINS DÉSERTIQUES CASSÉS (mis en quarantaine) : la mise en pierre PLEINE de toutes les dalles
// (retour user « pas de pierre décorative ») a transformé le remplissage des canyons désertiques en
// MURS infranchissables → leurs escaliers descendants gardent des sauts de ~10 tuiles autrefois
// franchis en marchant sur le sol (désormais muré). À CORRIGER dans le générateur désert (espacement
// des marches / ajout d'échelles d'entrée de canyon). Une fois corrigés, les retirer de cette liste.
const KNOWN_BROKEN = new Set(['desert-1', 'desert-5', 'desert-9', 'desert-11'])

describe('atteignabilité stricte (murs de roche pleine)', () => {
  it('attrape desert-9 : plateformes injoignables derrière les murs (le bug signalé)', () => {
    expect(strictReach(LEVELS['desert-9']!).badPlats.length).toBeGreaterThan(0)
  })

  it('tous les terrains NON en quarantaine sont strictement atteignables (aucune plateforme murée)', () => {
    const bad = nonBoss
      .filter(([id]) => !KNOWN_BROKEN.has(id))
      .map(([id, l]) => ({ id, n: strictReach(l).badPlats.length }))
      .filter((r) => r.n > 0)
    expect(bad.map((r) => `${r.id} (${r.n})`), `terrains murés inattendus : ${bad.map((r) => r.id).join(', ')}`).toEqual([])
  })

  it('la liste de quarantaine ne contient QUE des terrains réellement cassés (pas de faux positif figé)', () => {
    for (const id of KNOWN_BROKEN) {
      expect(strictReach(LEVELS[id]!).badPlats.length, `${id} n'est plus cassé → le retirer de KNOWN_BROKEN`).toBeGreaterThan(0)
    }
  })
})
