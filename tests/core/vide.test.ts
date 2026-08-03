import { describe, it, expect } from 'vitest'
import { percerPourEchelles, TROU_ECHELLE_W, RESTE_MIN } from '../../src/core/vide'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// « UNE ÉCHELLE QUE JE PEUX PAS DESCENDRE » — le trou au croisement
//
// ⚠️ LE TEST QUI COMPTE EST CELUI QUI REFUSE DE PERCER. Une corniche trop courte percée en deux moignons,
// ou percée à son extrémité, transforme un chemin en piège : mieux vaut ne pas percer (la traversée reste
// possible, l'échelle rendant les corniches franchissables) que d'ouvrir un trou qui casse le passage.
describe('percerPourEchelles', () => {
  it('perce un trou de deux tuiles au croisement', () => {
    expect(percerPourEchelles({ x: 0, w: 12 }, [5])).toEqual([{ x: 0, w: 5 }, { x: 7, w: 5 }])
    expect(TROU_ECHELLE_W).toBe(2)
  })

  it('ne perce PAS si un côté deviendrait un moignon', () => {
    // il faut RESTE_MIN tuiles praticables de chaque côté
    expect(percerPourEchelles({ x: 0, w: 5 }, [0])).toEqual([{ x: 0, w: 5 }])
    expect(percerPourEchelles({ x: 0, w: 5 }, [3])).toEqual([{ x: 0, w: 5 }])
    expect(RESTE_MIN).toBe(2)
  })

  it('ne perce pas une corniche trop courte, quel que soit l\'endroit', () => {
    for (let lx = 0; lx < 4; lx++) expect(percerPourEchelles({ x: 0, w: 4 }, [lx]), `x=${lx}`).toEqual([{ x: 0, w: 4 }])
  })

  it('ignore une échelle qui ne croise pas la corniche', () => {
    expect(percerPourEchelles({ x: 10, w: 8 }, [2, 40])).toEqual([{ x: 10, w: 8 }])
  })

  it('perce plusieurs croisements sur la même corniche', () => {
    const segs = percerPourEchelles({ x: 0, w: 24 }, [5, 15])
    expect(segs).toEqual([{ x: 0, w: 5 }, { x: 7, w: 8 }, { x: 17, w: 7 }])
  })

  it('ne perd JAMAIS de tuile hors des trous réellement percés', () => {
    // propriété : la largeur conservée vaut la largeur d'origine moins deux tuiles par trou effectif
    for (const w of [4, 6, 9, 14, 30]) {
      for (const lx of [0, 2, 5, 8]) {
        const segs = percerPourEchelles({ x: 0, w }, [lx])
        const total = segs.reduce((a, s) => a + s.w, 0)
        const perce = segs.length > 1
        expect(total, `w=${w} lx=${lx}`).toBe(perce ? w - TROU_ECHELLE_W : w)
      }
    }
  })
})
