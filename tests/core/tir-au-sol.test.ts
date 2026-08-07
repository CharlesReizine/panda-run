import { describe, it, expect } from 'vitest'
import {
  PROJECTILES, TIR_OFFSET_Y, PIEDS_SOUS_CENTRE, hauteurCorps, mordLeSol, remonteeNecessaire, echelleMax,
} from '../../src/core/tir-au-sol'
import { SKILLS } from '../../src/data/skills'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN PROJECTILE NE NAÎT PAS DANS LE SOL
//
// Retour du joueur : « parfois (même quand y a pas de monstre et pas d'obstacle) ça écrit "lancer
// d'épée", mais il se passe rien ».
//
// ⚠️ IL AVAIT PAYÉ ET N'AVAIT RIEN REÇU, ce qui est le pire des deux symptômes. Le libellé s'affiche,
// l'énergie part et le temps de recharge s'arme AVANT que l'effet existe : quand l'effet échoue ensuite
// en silence, la ressource est perdue sans explication. Le joueur finit par croire que la compétence
// marche « au hasard ».
//
// LA CAUSE, mesurée : Arcade multiplie la taille du corps physique par l'ÉCHELLE du sprite. Le lancer
// d'épée pose un corps de 46 px puis une échelle de 1,4 → 64,4 px de haut, recentrés sur un lâcher à
// `joueur.y + 16`. Son bas tombe à `+48,2` quand les pieds du panda sont à `+40` : la lame naissait
// HUIT PIXELS SOUS LE SOL et le collider la détruisait dans la frame même. D'où le « parfois » — debout
// sur une surface pleine ça ratait toujours, en l'air ou sur une plateforme traversable ça marchait.
//
// ⚠️ TROIS COMPÉTENCES AVAIENT LE MÊME DÉFAUT SANS QUE PERSONNE NE LES RAPPROCHE, parce que chacune
// choisissait sa texture et son échelle dans son coin. C'est pour ça que la règle vit ici, et qu'elle
// est vérifiée sur une TABLE : celle qu'on ajoutera demain se fera attraper par ce test, pas par le
// joueur.

describe('tir au sol', () => {
  it('la géométrie du panda est celle qu\'on croit', () => {
    // 24 px de marge sous le point de lâcher : c'est tout ce dont dispose un projectile
    expect(PIEDS_SOUS_CENTRE - TIR_OFFSET_Y).toBe(24)
  })

  it('l\'échelle multiplie bien la hauteur du corps — c\'est là que tout se joue', () => {
    expect(hauteurCorps(46, 1.4)).toBeCloseTo(64.4, 5)
    expect(hauteurCorps(22, 1)).toBe(22)
  })

  it('reconnaît les trois projectiles qui naissaient dans le sol', () => {
    expect(mordLeSol(46, 1.4), 'lancer d\'épée').toBe(true)
    expect(mordLeSol(64, 1.4), 'sceau du heaume').toBe(true)
    expect(mordLeSol(22, 3.2), 'boule de feu à pleine charge').toBe(true)
  })

  it('et laisse tranquilles ceux qui passaient', () => {
    expect(mordLeSol(22, 1.2), 'flèche').toBe(false)
    expect(mordLeSol(22, 1.35), 'flèche explosive').toBe(false)
  })

  // ⚠️ LE CŒUR DU GARDE-FOU. Chaque projectile allié, remonté de ce que la règle exige, doit passer.
  it('AUCUN projectile allié ne naît dans le sol, remontée comprise', () => {
    const fautifs: string[] = []
    for (const p of PROJECTILES) {
      const offset = TIR_OFFSET_Y - (p.remonte ?? 0)
      if (mordLeSol(p.hauteurSource, p.echelle, offset)) {
        fautifs.push(`${p.id} : corps ${hauteurCorps(p.hauteurSource, p.echelle).toFixed(1)} px, remontée ${p.remonte ?? 0}`)
      }
    }
    expect(fautifs, `projectiles qui mordent le sol :\n   ${fautifs.join('\n   ')}`).toEqual([])
  })

  it('la remontée calculée est juste assez grande, pas davantage', () => {
    for (const p of PROJECTILES) {
      const r = remonteeNecessaire(p.hauteurSource, p.echelle)
      if (!mordLeSol(p.hauteurSource, p.echelle)) { expect(r, p.id).toBe(0); continue }
      expect(mordLeSol(p.hauteurSource, p.echelle, TIR_OFFSET_Y - r), p.id).toBe(false)
      // une tuile de moins et ça mordrait encore : la remontée n'est pas surdimensionnée
      expect(mordLeSol(p.hauteurSource, p.echelle, TIR_OFFSET_Y - r + 3), `${p.id} sur-remonté`).toBe(true)
    }
  })

  it('l\'échelle maximale et la morsure disent la même chose', () => {
    for (const h of [22, 46, 64]) {
      const max = echelleMax(h)
      expect(mordLeSol(h, max - 0.01), `hauteur ${h}`).toBe(false)
      expect(mordLeSol(h, max + 0.5), `hauteur ${h}`).toBe(true)
    }
  })

  // ⚠️ ET LA TABLE NE DOIT PAS DÉRIVER DU JEU. Elle ne sert à rien si elle décrit des compétences qui
  // n'existent plus — c'est le défaut classique d'un inventaire écrit à la main.
  it('la table ne cite que des compétences réelles', () => {
    for (const p of PROJECTILES) {
      if (['fleche', 'laser', 'mitraillette', 'double-fleche'].includes(p.id)) continue // familles génériques
      expect(SKILLS[p.id], `${p.id} n'existe plus dans les compétences`).toBeDefined()
    }
  })
})
