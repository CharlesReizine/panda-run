import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { sealedVoids } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUNE POCHE DE VIDE SANS ENTRÉE
//
// Retour joueur, deux captures : « j'avais de l'herbe et une poche d'air entourée par un carré
// d'herbe mais inaccessible », puis « un carré de terre vide et bizarre, faut le refaire là ».
// À l'écran : deux piliers de pierre côte à côte, un trou rectangulaire entre les deux par lequel on
// voit le décor de fond, et une plateforme qui passe par-dessus et lui met un couvercle. Le terrain a
// littéralement un trou dedans, et on n'y entrera jamais.
//
// La cause est dans `addPedestals` : le socle de pierre ne se pose QUE sous les colonnes qui portent
// une plateforme. Une colonne sans plateforme coincée entre deux socles reste vide du sol au ciel, et
// la première plateforme qui passe au-dessus la referme. Mesuré à l'introduction : 142 poches sur les
// 58 terrains, dont `plaine-2 x372..377 y14..42` — six tuiles de large sur vingt-neuf de haut.
//
// ⚠️ CE TEST EST INUTILE SANS SON MODÈLE DIRECTIONNEL, et c'est le piège à ne pas refaire. Compter
// une plateforme de terre comme un MUR fait crier au loup sur toutes les corniches posées sur un
// socle (elles ont du vide sous elles, c'est normal) ; la compter comme du VIDE rate précisément le
// défaut signalé, puisque le couvercle EST une plateforme de terre. Le modèle de `sealedVoids`
// n'entre dans une plateforme qu'en MONTANT — ce que fait le panda (one-way, cf. landsFromAbove).
//
// Une poche d'UNE case est tolérée : c'est le résidu d'une couture entre deux surfaces, invisible à
// l'écran. Le défaut signalé se compte en dizaines de cases.
const TOLERANCE_CASES = 1

describe('poches de vide closes', () => {
  it("aucun terrain n'enferme une poche de vide sans entrée", () => {
    const fautes = Object.values(LEVELS).flatMap((l) =>
      sealedVoids(l)
        .filter((v) => v.cells > TOLERANCE_CASES)
        .map((v) => `${l.id} x${v.x}..${v.x + v.w - 1} y${v.y}..${v.y + v.h - 1} (${v.cells} cases)`),
    )
    expect(fautes, `${fautes.length} poche(s) close(s) :\n   ${fautes.slice(0, 10).join('\n   ')}`).toEqual([])
  })
})
