import { describe, it, expect } from 'vitest'
import { sanitizePseudo, suggestionPseudo } from '../../src/cloud/identity'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN NOM SUGGÉRÉ EST UN NOM LIBRE — SUGGÉRER N'EST PAS PRÉ-REMPLIR
//
// Retour du joueur : « le placeholder de prénom c'est Charly12 ou charly13 selon le nombre de comptes
// déjà créés, là c'est charlychoulove ». Le champ de « Nouvelle partie » était pré-rempli avec le
// pseudo MÉMORISÉ sur l'appareil, c'est-à-dire celui de la partie en cours : valider sans réfléchir
// visait la partie existante. Comme la clé du document EST le pseudo, ça se termine en écrasement —
// et c'est exactement ce qui est arrivé le 4 août.
//
// La règle tient en une phrase : ce qui est PRÉ-REMPLI peut être validé par erreur, donc on n'y met
// jamais le nom d'une partie qui existe. Une suggestion, elle, s'affiche en gris et doit être libre.

describe('pseudo suggéré pour une nouvelle partie', () => {
  it('ne propose JAMAIS un pseudo déjà pris', () => {
    const pris = ['panda1', 'panda2', 'panda3', 'charlychoulove']
    expect(pris).not.toContain(suggestionPseudo(pris))
  })

  it('suit le nombre de comptes déjà créés', () => {
    expect(suggestionPseudo([])).toBe('panda1')
    expect(suggestionPseudo(['a', 'b', 'c'])).toBe('panda4')
  })

  it('saute les trous : une liste incomplète ne fait pas resurgir un nom occupé', () => {
    // trois comptes connus → on vise panda4, mais il est pris : on monte jusqu'au premier libre
    expect(suggestionPseudo(['a', 'b', 'panda4'])).toBe('panda5')
    expect(suggestionPseudo(['a', 'b', 'panda4', 'panda5', 'panda6'])).toBe('panda7')
  })

  it('compare sur la forme canonique, comme les clés de sauvegarde', () => {
    // « Panda1 » et « panda1 » sont le MÊME document : la suggestion doit le savoir
    expect(suggestionPseudo(['PANDA1', 'Panda-2'])).not.toBe('panda1')
    expect(sanitizePseudo(suggestionPseudo(['PANDA1']))).toBe(suggestionPseudo(['PANDA1']))
  })

  it('rend toujours un pseudo valide et non vide', () => {
    for (const base of ['', '  ', '💥', 'Charly !']) {
      const s = suggestionPseudo(['x'], base)
      expect(s).not.toBe('')
      expect(sanitizePseudo(s)).toBe(s)
    }
  })
})
