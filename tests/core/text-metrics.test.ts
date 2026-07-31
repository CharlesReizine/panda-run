import { describe, it, expect } from 'vitest'
import { ADVANCE, charsPerLine, lineH, textWidth, truncate, wrapText } from '../../src/scenes/text-metrics'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MÉTRIQUES DE TEXTE — la brique sur laquelle reposent les tests de non-débordement.
//
// Si `wrapText` mentait (une ligne plus longue que la largeur annoncée, une ligne de trop, un mot
// interminable laissé entier), TOUS les tests de mise en page qui l'utilisent deviendraient verts à
// tort. On la vérifie donc pour elle-même, en insistant sur les cas dégénérés — c'est exactement là
// que les débordements naissent.

describe('largeurs', () => {
  it('une police monospace rend la largeur exactement calculable', () => {
    expect(ADVANCE).toBe(0.6)
    expect(textWidth('abcde', 10)).toBe(30)
    // réciproque : ce qui tient dans 30 px à 10 px de police, c'est bien 5 caractères
    expect(charsPerLine(30, 10)).toBe(5)
  })

  it('ne renvoie jamais 0 caractère par ligne (sinon rien ne s\'afficherait)', () => {
    expect(charsPerLine(1, 40)).toBe(1)
    expect(charsPerLine(0, 40)).toBe(1)
  })

  it('la hauteur de ligne MAJORE la mesure réelle de Phaser (≈ 1,3 × la police)', () => {
    for (const f of [10, 11, 12, 13, 15, 16, 20, 22, 26, 32]) {
      expect(lineH(f), `police ${f}`).toBeGreaterThanOrEqual(Math.ceil(f * 1.3))
    }
  })
})

describe('troncature', () => {
  it('laisse court ce qui est court, coupe avec une ellipse au-delà', () => {
    expect(truncate('abc', 10)).toBe('abc')
    expect(truncate('a'.repeat(20), 10)).toHaveLength(10)
    expect(truncate('a'.repeat(20), 10).endsWith('…')).toBe(true)
  })
})

describe('découpe en lignes', () => {
  it('aucune ligne produite ne dépasse la largeur demandée, quel que soit le texte', () => {
    const textes = [
      '', 'court', 'deux mots', 'Carapace de scarabée', 'Grelot porte-bonheur',
      'Une paire de petites ailes angéliques qui insufflent un souffle de vie.',
      'motinterminablesansaucunespacepourcouperproprement',
      '   espaces    multiples   partout   ',
    ]
    for (const t of textes) {
      for (const cap of [1, 3, 8, 14, 31, 51]) {
        for (const line of wrapText(t, cap)) {
          expect(line.length, `« ${t} » cap=${cap} → « ${line} »`).toBeLessThanOrEqual(cap)
        }
      }
    }
  })

  it('coupe DANS un mot trop long : sans ça il déborderait sans que le compte de lignes le voie', () => {
    const lines = wrapText('porte-bonheur', 6)
    expect(lines).toEqual(['porte-', 'bonheu', 'r'])
  })

  it('respecte le plafond de lignes et signale le reste par une ellipse', () => {
    const lines = wrapText('un deux trois quatre cinq six sept huit', 10, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1]!.endsWith('…')).toBe(true)
    expect(lines[1]!.length).toBeLessThanOrEqual(10)
  })

  it('ne perd rien quand tout tient (aucune ellipse parasite)', () => {
    expect(wrapText('Épée en fer forgé', 12, 2)).toEqual(['Épée en fer', 'forgé'])
  })

  it('renvoie toujours au moins une ligne, même pour du vide', () => {
    expect(wrapText('', 10)).toEqual([''])
    expect(wrapText('   ', 10, 2)).toEqual([''])
  })
})
