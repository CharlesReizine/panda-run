import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { pierresFlottantes } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE PIERRE QUI NE TOUCHE RIEN NE TIENT À RIEN
//
// Troisième signalement du joueur sur ce thème : « on a encore un problème graphique avec des pierres
// qui volent (exemple le motif où y a une échelle qui descend et des pierres à casser à droite pour
// aller prendre un coffre, ça clairement ça vole) ».
//
// ⚠️ LA PASSE DES SOCLES NUS NE POUVAIT PAS LES VOIR, et c'est ce qui rendait le défaut increvable.
// Elle traque la pierre qui MONTE DU SOL sans rien porter — un pilier planté au milieu du décor. Ici
// c'est l'inverse exact : une masse EN L'AIR, sans appui dessous, sans coiffe dessus, sans rien sur
// les côtés. Et elle naît souvent de cette passe-là : on supprime un mur de grotte devenu inutile, et
// le plafond qu'il tenait latéralement reste suspendu. Un correctif fabriquait le défaut suivant, deux
// passes plus loin — c'est la raison d'être de ce fichier.
//
// Le critère est le CONTACT, sur les quatre côtés. Une dalle collée à quoi que ce soit se lit comme une
// avancée, un surplomb, un plafond de couloir : elle a l'air de tenir, et c'est tout ce qu'on demande.
// Une dalle qui ne touche rien ne se lit pas. Quatre-vingt-dix-neuf relevées avant correction.

describe('pierres flottantes', () => {
  it('aucune dalle de roche ne flotte sans rien toucher', () => {
    const volantes = Object.values(LEVELS).flatMap((l) =>
      pierresFlottantes(l).map((r) => `${l.id} x${r.x}+${r.w} y${r.y} h${r.h}`))
    expect(volantes, `${volantes.length} pierre(s) en l'air :\n   ${volantes.slice(0, 10).join('\n   ')}`).toEqual([])
  })

  // ⚠️ ET LE VALIDATEUR DOIT SAVOIR DIRE OUI. Un test qui ne trouve jamais rien peut être un test qui
  // ne cherche rien : celui-ci vérifie qu'une dalle manifestement suspendue est bien signalée.
  it('une dalle manifestement suspendue EST signalée', () => {
    const enLair = {
      id: 'test', name: 'test', biome: 'plaine', widthTiles: 40, heightTiles: 26,
      platforms: [], spawns: [],
      rockBands: [{ x: 10, y: 6, w: 4, h: 2 }], // rien autour, rien dessous, rien dessus
    }
    expect(pierresFlottantes(enLair as never)).toHaveLength(1)
  })

  it("une dalle posée sur le sol du monde, ou collée à une autre, ne l'est pas", () => {
    const posee = {
      id: 'test', name: 'test', biome: 'plaine', widthTiles: 40, heightTiles: 26,
      platforms: [], spawns: [],
      // sol du monde en rangée 24 : cette dalle s'appuie dessus
      rockBands: [{ x: 10, y: 20, w: 4, h: 4 }, { x: 14, y: 20, w: 3, h: 2 }],
    }
    expect(pierresFlottantes(posee as never)).toEqual([])
  })
})
