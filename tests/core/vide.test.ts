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

describe('le perçage ne touche pas la plateforme qui PORTE l\'échelle', () => {
  // « Un trou de terrain sous la première échelle », relevé sur Vallon. Le filtre des échelles qui
  // traversent une corniche utilisait `p.y <= l.y + l.h` : la borne INCLUSIVE prenait la corniche du pied
  // de l'échelle, celle sur laquelle elle repose, et on creusait donc le sol sous ses pieds.
  //
  // ⚠️ CE TEST PORTE SUR LA RÈGLE DE SÉLECTION, pas sur `percerPourEchelles`. Le perçage lui-même était
  // correct ; ce qui était faux, c'est la LISTE des échelles qu'on lui passait. C'est là qu'était le bug,
  // et c'est donc là qu'il faut le verrouiller.
  const traversantes = (p: { y: number }, echelles: { x: number; y: number; h: number }[]) =>
    echelles.filter((l) => p.y > l.y && p.y < l.y + l.h).map((l) => l.x)

  const ECHELLE = { x: 5, y: 10, h: 9 } // montant de la rangée 10 (haut) à 19 (pied)

  it('ignore la corniche du PIED (rangée y + h)', () => {
    expect(traversantes({ y: 19 }, [ECHELLE])).toEqual([])
  })

  it('ignore la corniche du SOMMET', () => {
    expect(traversantes({ y: 10 }, [ECHELLE])).toEqual([])
  })

  it('perce bien les corniches réellement traversées en chemin', () => {
    for (const y of [11, 14, 18]) expect(traversantes({ y }, [ECHELLE]), `y=${y}`).toEqual([5])
  })

  it('ignore ce qui est hors du montant', () => {
    for (const y of [5, 9, 20, 40]) expect(traversantes({ y }, [ECHELLE]), `y=${y}`).toEqual([])
  })
})
