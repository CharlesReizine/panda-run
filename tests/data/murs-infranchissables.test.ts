import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { marchesInfranchissables } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE MUR QU'ON SE PREND EN MARCHANT TOUT DROIT
//
// Retour du joueur : « Colline, le terrain est infaisable dès le début, y a un giga mur trop haut pour
// être sauté. Comment ça passe tes tests ??? »
//
// ⚠️ IL AVAIT RAISON, ET AUCUN VALIDATEUR NE POUVAIT LE VOIR — c'est toute la leçon de ce fichier.
// Sur ce terrain, `unreachablePlatforms`, `strictReach`, `deadEndSurfaces` et `unreachableLadders`
// répondaient tous ZÉRO. Ils raisonnent en GRAPHE : « existe-t-il un chemin, quel qu'il soit, vers
// cette plateforme ? » — et il en existait un, par un enchaînement d'échelles suspendues à l'autre bout
// du module. Le joueur, lui, ne parcourt pas un graphe : il avance vers la droite et se cogne.
//
// UN TERRAIN PEUT ÊTRE ENTIÈREMENT « ATTEIGNABLE » ET PARFAITEMENT INFAISABLE. C'est le trou de tout
// notre outillage, et il aura fallu qu'un joueur se cogne pour qu'on le voie.
//
// ⚠️ CE QUE CE TEST NE PROUVE PAS. Il mesure la SILHOUETTE, pas la jouabilité complète : un mur compté
// ici peut être contournable (on retombe au sol et on remonte ailleurs). C'est le cas de la majorité
// du résidu — `escalier-pierre` en tête, dont les blocs isolés se sautent. Il sert donc de SEUIL : il
// ne dit pas « tout va bien », il dit « ça n'a pas empiré ». Les faire baisser est un progrès ; les
// monter demande une raison écrite.
//
// LA CAUSE PRINCIPALE A ÉTÉ CORRIGÉE : la rampe d'accroche des motifs INVERSÉS s'arrêtait en route
// quand la montée dépassait ce que six tuiles permettent, laissant un mur de huit rangées au début de
// Colline. Elle prend désormais la largeur que son dénivelé réclame, mesurée en deux passes (bâtir le
// motif pour connaître son sommet, puis rejouer). 202 murs → 172, et Colline commence par un chemin.
//
// ⚠️ CE LOT A UN PRIX, ET IL EST ÉCRIT : les paliers ajoutés retombent près du sol, donc les corniches
// collées au sol repassent de 77 à 136 (cf. relief-jouable). Un terrain infaisable dès sa première
// minute prime sur deux bandes d'herbe superposées — mais c'est une dette, pas un progrès net.

const nonBoss = Object.values(LEVELS).filter((l) => !l.boss)

// Comptes relevés le 5 août, terrain par terrain. Un terrain qui EMPIRE fait tomber le test avec son nom.
const SEUILS: Record<string, number> = {
  'plaine-1': 1, 'plaine-2': 1, 'plaine-3': 0, 'plaine-4': 1, 'plaine-5': 3, 'plaine-6': 2, 'plaine-7': 1,
}

describe('murs infranchissables', () => {
  it('le total ne remonte pas', () => {
    const total = nonBoss.reduce((n, l) => n + marchesInfranchissables(l).length, 0)
    expect(total, 'des murs sont apparus depuis la dernière mesure').toBeLessThanOrEqual(172)
  })

  it('aucun terrain de plaine n\'empire', () => {
    const pires: string[] = []
    for (const [id, seuil] of Object.entries(SEUILS)) {
      const l = LEVELS[id]
      if (!l) continue
      const murs = marchesInfranchissables(l)
      if (murs.length > seuil) {
        pires.push(`${id} : ${murs.length} (seuil ${seuil}) — ` +
          murs.slice(0, 3).map((m) => `x${m.x} ${m.de}→${m.a} (${m.hauteur} rangées)`).join(' · '))
      }
    }
    expect(pires, `terrains dégradés :\n   ${pires.join('\n   ')}`).toEqual([])
  })

  it('un mur signalé est bien plus haut qu\'un saut, et se lit', () => {
    for (const l of nonBoss) {
      for (const m of marchesInfranchissables(l)) {
        expect(m.hauteur, `${l.id} x${m.x}`).toBeGreaterThan(4) // au-delà de la hauteur de saut
        expect(m.de - m.a, `${l.id} x${m.x}`).toBe(m.hauteur)   // la mesure est cohérente avec ses bornes
        expect(m.x).toBeGreaterThan(0)
        expect(m.x).toBeLessThan(l.widthTiles)
      }
    }
  })
})
