import { describe, it, expect } from 'vitest'
import { GRILLE, RAYON_INFO, grilleMonstres, grilleTient } from '../../src/scenes/intro-grille-layout'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA GRILLE DE MONSTRES DE L'ÉCRAN DE DÉBUT DE TERRAIN NE DÉBORDE JAMAIS
//
// Demande du user : « au niveau des monstres qu'on affiche en commençant un niveau, chaud que tu mettes
// des images juste de tous les monstres + leur niveau et si élite ou pas, et juste un petit "i" à côté
// avec la sous-page dédiée ».
//
// ⚠️ CE TEST EXISTE PARCE QU'UNE GRILLE A DÉJÀ ÉCHOUÉ ICI. La première version de cet écran entassait
// pour chaque monstre image + nom + butin + compétences : sur quatre espèces, les cartes tombaient à
// 90 px de large et tout sortait du cadre (« là ça déborde complet »). On était passé à une fiche par
// page. La grille revient parce que son contenu a changé — quatre informations minuscules, le détail
// derrière le « i » — mais la leçon reste : on vérifie la géométrie sur le VRAI roster, terrain par
// terrain, avant de la croire.

const especesDe = (id: string): number => {
  const l = LEVELS[id]
  if (!l) return 0
  const ids = new Set<string>()
  for (const s of l.spawns) if (MONSTERS[s.monsterId]) ids.add(s.monsterId)
  if (l.boss && MONSTERS[l.boss]) ids.add(l.boss)
  return ids.size
}

describe('grille de monstres — début de terrain', () => {
  it('tient pour tout nombre d\'espèces, de 1 à 12', () => {
    for (let n = 1; n <= 12; n++) {
      expect(grilleTient(n), `${n} monstre(s) : la grille déborde ou se chevauche`).toBe(true)
    }
  })

  it('tient sur le roster RÉEL de chaque terrain', () => {
    const fautifs: string[] = []
    for (const id of Object.keys(LEVELS)) {
      const n = especesDe(id)
      if (n > 0 && !grilleTient(n)) fautifs.push(`${id} (${n} espèces)`)
    }
    expect(fautifs, fautifs.slice(0, 5).join(', ')).toEqual([])
  })

  it('aucun terrain ne dépasse ce que la grille sait afficher', () => {
    // Le jeu plafonne les espèces de SPAWN à huit (« pas plus de 8 mobs différents, trop ») — mais le
    // BOSS et les mobs injectés s'y ajoutent : cimetiere-1 en compte onze. La grille tient jusqu'à douze ; ce
    // test le dira si un terrain franchit la limite avant que l'écran ne déborde.
    for (const id of Object.keys(LEVELS)) {
      expect(especesDe(id), `${id} : trop d'espèces pour la grille`).toBeLessThanOrEqual(12)
    }
  })

  it('les vignettes restent assez grandes pour distinguer un monstre d\'un autre', () => {
    // Le seul but de cet écran est de RECONNAÎTRE les monstres qu'on va croiser. En dessous de 70 px
    // une vignette devient une tache de couleur — autant ne rien afficher.
    for (let n = 1; n <= 12; n++) {
      for (const c of grilleMonstres(n)) expect(c.taille, `${n} monstres`).toBeGreaterThanOrEqual(70)
    }
  })

  it('le bouton « i » reste dans le cadre de sa vignette et se touche au pouce', () => {
    for (let n = 1; n <= 12; n++) {
      for (const c of grilleMonstres(n)) {
        expect(c.infoX + RAYON_INFO).toBeLessThanOrEqual(c.x + c.taille / 2 + RAYON_INFO)
        expect(c.infoY - RAYON_INFO).toBeGreaterThanOrEqual(GRILLE.top - RAYON_INFO)
        expect(RAYON_INFO * 2).toBeGreaterThanOrEqual(24) // cible tactile minimale
      }
    }
  })

  it('une rangée incomplète est CENTRÉE, pas alignée à gauche', () => {
    // Sept monstres = 4 + 3 : la seconde rangée doit être centrée sur l'écran, pas collée au bord
    // gauche avec un trou à droite.
    const c = grilleMonstres(7)
    const r2 = c.slice(4)
    expect((r2[0]!.x + r2[r2.length - 1]!.x) / 2).toBeCloseTo(GRILLE.centreX, 0)
  })
})
