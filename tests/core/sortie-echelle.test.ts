import { describe, it, expect } from 'vitest'
import { releveApresEchelle, TILE, type Corniche } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LÂCHER UNE ÉCHELLE NE FAIT PAS TOMBER À TRAVERS LA CORNICHE
//
// Retour du joueur, capture à l'appui : « quand je suis en haut de l'échelle, je tombe encore même si
// je marche juste et je suis pas sur l'échelle », puis « l'échelle me permet de faire un bug graphique
// bizarre, je passe sous la terre ». Sur l'image, le panda est à MOITIÉ ENFONCÉ dans la corniche.
//
// La cause n'est pas le terrain : c'est la règle du one-way. Une corniche de terre ne bloque que si les
// pieds étaient AU-DESSUS d'elle à la frame précédente — ce qui empêche de se coincer contre la
// contremarche d'un escalier. Or, agrippé, on TRAVERSE les corniches : on lâche donc en étant déjà DANS
// la tuile, la condition est fausse pour toujours, et on passe au travers en marchant.
//
// On corrige à l'instant du lâcher, jamais dans la règle de collision — la relâcher rouvrirait le
// coincement d'escalier. Et la décision est PURE, parce qu'une scène Phaser ne s'instancie pas en test
// et que c'est exactement dans ces enchaînements-là que les défauts de ce projet se sont logés.

const corniche = (y: number, x = 0, w = 10): Corniche => ({ x, y, w })

describe('sortie d\'échelle', () => {
  it('repose le panda enfoncé dans la corniche sur son dessus', () => {
    // pieds à 12 px sous le dessus de la corniche (rangée 10 → dessus = 320)
    const dy = releveApresEchelle(320 + 12, 5 * TILE, [corniche(10)])
    expect(dy).toBe(12)
  })

  it('ne fait JAMAIS descendre : déjà posé dessus, on ne touche à rien', () => {
    expect(releveApresEchelle(10 * TILE, 5 * TILE, [corniche(10)])).toBe(0)
    expect(releveApresEchelle(10 * TILE - 5, 5 * TILE, [corniche(10)])).toBe(0)
  })

  it('ignore une corniche qui n\'est pas sous ses pieds', () => {
    // corniche trois rangées plus bas : le panda est franchement en l'air, il doit retomber
    expect(releveApresEchelle(10 * TILE + 4, 5 * TILE, [corniche(13)])).toBe(0)
    // corniche au-dessus de lui : hors sujet
    expect(releveApresEchelle(10 * TILE + 4, 5 * TILE, [corniche(6)])).toBe(0)
  })

  it('ignore une corniche d\'une autre colonne', () => {
    expect(releveApresEchelle(320 + 12, 5 * TILE, [corniche(10, 20, 4)])).toBe(0)
  })

  it('accepte la corniche dont le dessus est la tuile juste sous les pieds', () => {
    // pieds au tout début de la tuile 11 → la corniche 11 est bien celle sur laquelle se poser
    const dy = releveApresEchelle(11 * TILE + 2, 5 * TILE, [corniche(11)])
    expect(dy).toBe(2)
  })

  it('ne rend jamais de valeur négative, quelle que soit la position', () => {
    for (let bas = 300; bas < 400; bas += 3) {
      expect(releveApresEchelle(bas, 5 * TILE, [corniche(10), corniche(11)])).toBeGreaterThanOrEqual(0)
    }
  })
})
