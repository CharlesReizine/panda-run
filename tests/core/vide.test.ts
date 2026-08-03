import { describe, it, expect } from 'vitest'
import { silhouetteSousSol, percerPourEchelles, TROU_ECHELLE_W, RESTE_MIN } from '../../src/core/vide'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE SOUS-SOL SOMBRE, ET LE TROU AU CROISEMENT DES ÉCHELLES
//
// ⚠️ DEUX VERSIONS EN VOILES TRANSLUCIDES ONT ÉCHOUÉ AVANT CELLE-CI, et c'est ce que ces tests protègent.
// La première n'assombrissait que les colonnes trouées : rayures verticales entre les dalles, fond éclatant
// SOUS chacune d'elles. La seconde étendait le dégradé à toute surface élevée : patchwork de rectangles
// translucides sur la jungle (« graphiquement ça fait des choses bizarres, des strates moches »). Un
// rectangle semi-transparent sur un fond illustré lumineux se lit toujours comme un rectangle.
//
// La bonne approche est un sous-sol OPAQUE dont la limite suit EXACTEMENT la silhouette du terrain. Ce qui
// compte ici : la limite épouse le point le PLUS HAUT de chaque colonne (sinon une arête apparaît là où
// aucune plateforme ne la cache), la couverture est totale (sinon le fond réapparaît en bandes), et le ciel
// n'est jamais peint en noir.

describe('silhouetteSousSol', () => {
  const SOL = 40

  it('suit le sol du monde quand il n\'y a aucun relief', () => {
    expect(silhouetteSousSol(10, SOL, [], [])).toEqual([{ x: 0, w: 10, top: SOL }])
  })

  it('remonte sous une corniche élevée : c\'est là que le vide doit commencer', () => {
    const s = silhouetteSousSol(10, SOL, [{ x: 3, y: 30, w: 4 }], [])
    expect(s.map((p) => [p.x, p.w, p.top])).toEqual([[0, 3, SOL], [3, 4, 30], [7, 3, SOL]])
  })

  it('retient TOUJOURS la surface la plus haute d\'une colonne', () => {
    // sinon la limite passerait sous une plateforme sans être cachée par elle, et l'arête se verrait
    const s = silhouetteSousSol(6, SOL, [{ x: 0, y: 30, w: 6 }, { x: 0, y: 20, w: 6 }, { x: 0, y: 35, w: 6 }], [])
    expect(s).toHaveLength(1)
    expect(s[0]!.top).toBe(20)
  })

  it('compte la ROCHE comme du dessus de terrain', () => {
    expect(silhouetteSousSol(8, SOL, [{ x: 2, y: 25, w: 4 }], [])[1]!.top).toBe(25)
  })

  it('ne peint JAMAIS le ciel en noir au-dessus d\'un trou à ciel ouvert', () => {
    const s = silhouetteSousSol(10, SOL, [], [{ x: 4, w: 3 }])
    expect(s).toEqual([{ x: 0, w: 10, top: SOL }])
  })

  it('au-dessus d\'un trou SURPLOMBÉ, part de la corniche', () => {
    const s = silhouetteSousSol(10, SOL, [{ x: 4, y: 28, w: 3 }], [{ x: 4, w: 3 }])
    expect(s.find((p) => p.x === 4)!.top).toBe(28)
  })

  it('couvre exactement la largeur, sans trou, en peu de rectangles', () => {
    // garde-fou de coût ET de correction : un rectangle par palier, et zéro colonne oubliée
    const s = silhouetteSousSol(200, SOL, [{ x: 10, y: 30, w: 80 }, { x: 120, y: 25, w: 40 }], [])
    expect(s.reduce((a, p) => a + p.w, 0)).toBe(200)
    expect(s.length).toBeLessThanOrEqual(5)
  })
})

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
