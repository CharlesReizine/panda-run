import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { echellesSansAppui } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE ÉCHELLE NE DÉBOUCHE JAMAIS SUR RIEN
//
// Règle énoncée par le joueur, après avoir vu des échelles flotter une fois de trop : « les échelles ça
// déconne souvent, tu me rajoutes un test. Il faut soit de la terre (pas loin du haut, sur le côté, pour
// pouvoir grimper dessus), soit de la pierre au-dessus, mais jamais RIEN. »
//
// ⚠️ LE VALIDATEUR EXISTANT NE POUVAIT PAS LES VOIR, ET C'EST UNE EXEMPTION QUI L'AVEUGLAIT.
// `laddersToNowhere` saute les échelles SUSPENDUES avec ce commentaire : « ni socle ni palier de sommet
// (coiffée d'une pierre) ». C'était une SUPPOSITION, jamais une vérification — rien ne s'assurait que la
// pierre était là. Quarante-neuf échelles sur cinq cent quatre-vingt-treize débouchaient donc sur le
// vide, et le test censé les attraper les écartait par principe.
//
// La leçon dépasse les échelles : une exemption écrite dans un validateur est un TROU, pas une nuance,
// tant que rien ne vérifie la raison qui la justifie.
//
// ⚠️ ET LE CORRECTIF A FAILLI S'ANNULER TOUT SEUL. La coiffe est un bloc d'une tuile qui ne touche rien
// d'autre que l'échelle : la règle « une pierre qui ne touche rien ne tient à rien » (elle aussi juste,
// elle aussi demandée par le joueur) l'effaçait aussitôt posée. Le compte restait à quarante-neuf sans
// que rien ne l'explique. Deux passes justes qui se défont l'une l'autre, c'est le défaut le plus
// difficile à voir de ce projet — il n'apparaît dans aucune des deux.

describe('échelles avec appui', () => {
  it('aucune échelle ne débouche sur le vide', () => {
    const orphelines = Object.values(LEVELS).flatMap((l) =>
      echellesSansAppui(l).map((e) => `${l.id} x${e.x} y${e.y} (hauteur ${e.h})`))
    expect(orphelines, `échelles sans appui :\n   ${orphelines.slice(0, 10).join('\n   ')}`).toEqual([])
  })

  // ⚠️ ET LE VALIDATEUR DOIT SAVOIR DIRE OUI. Un test qui ne trouve jamais rien peut être un test qui
  // ne cherche rien : on lui présente une échelle manifestement orpheline, il doit la signaler.
  it('une échelle qui pend dans le vide EST signalée', () => {
    const orpheline = {
      id: 'test', name: 'test', biome: 'plaine', widthTiles: 30, heightTiles: 26,
      platforms: [{ x: 0, y: 22, w: 6 }], spawns: [],
      ladders: [{ x: 15, y: 8, h: 10 }], // ni corniche à son sommet, ni roche au-dessus
    }
    expect(echellesSansAppui(orpheline as never)).toHaveLength(1)
  })

  it('une corniche à hauteur de sortie suffit, une pierre au-dessus aussi', () => {
    const base = { id: 'test', name: 'test', biome: 'plaine', widthTiles: 30, heightTiles: 26, spawns: [] }
    // 1) de la TERRE : une corniche une rangée sous le sommet, sur laquelle on enjambe
    const terre = { ...base, platforms: [{ x: 13, y: 9, w: 5 }], ladders: [{ x: 15, y: 8, h: 10 }] }
    expect(echellesSansAppui(terre as never), 'corniche de sortie').toEqual([])
    // 2) de la PIERRE : l'échelle y est accrochée, on comprend ce qui la tient
    const pierre = { ...base, platforms: [], ladders: [{ x: 15, y: 8, h: 10 }], rockBands: [{ x: 15, y: 7, w: 1, h: 1 }] }
    expect(echellesSansAppui(pierre as never), 'coiffe de roche').toEqual([])
  })
})
