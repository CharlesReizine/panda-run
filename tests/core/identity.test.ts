import { describe, it, expect } from 'vitest'
import { PSEUDO_MAX, pseudoKey, sanitizePseudo } from '../../src/cloud/identity'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NORMALISATION DU PSEUDO — c'est la fonction d'IDENTITÉ du jeu.
//
// Le pseudo est la seule clé de la sauvegarde en ligne : si `sanitizePseudo` n'est pas parfaitement
// stable, un joueur tape son nom et ne retrouve pas sa partie. D'où ces tests, et notamment
// l'IDEMPOTENCE : la fonction est appliquée à CHAQUE FRAPPE dans le champ de saisie, donc l'appliquer
// deux fois doit donner exactement le même résultat qu'une fois.

describe('sanitizePseudo', () => {
  it('met en minuscules', () => {
    expect(sanitizePseudo('Charles')).toBe('charles')
    expect(sanitizePseudo('PANDA')).toBe('panda')
  })

  it('retire les accents (« Léo » et « leo » sont le MÊME joueur)', () => {
    expect(sanitizePseudo('Léo')).toBe('leo')
    expect(sanitizePseudo('Ève')).toBe('eve')
    expect(sanitizePseudo('Nöel')).toBe('noel')
  })

  it('retire les espaces', () => {
    expect(sanitizePseudo('jean pierre')).toBe('jeanpierre')
    expect(sanitizePseudo('  bord  ')).toBe('bord')
  })

  it('retire ponctuation et emoji', () => {
    expect(sanitizePseudo('pan.da!')).toBe('panda')
    expect(sanitizePseudo('panda🐼')).toBe('panda')
    expect(sanitizePseudo('a/b')).toBe('ab') // '/' est interdit dans une clé Firestore
  })

  it('garde chiffres, tiret et souligné', () => {
    expect(sanitizePseudo('panda_99-x')).toBe('panda_99-x')
  })

  it('borne la longueur', () => {
    expect(sanitizePseudo('a'.repeat(50))).toHaveLength(PSEUDO_MAX)
  })

  it('est IDEMPOTENTE (appliquée à chaque frappe)', () => {
    for (const raw of ['Léo', 'Jean Pierre', 'PANDA🐼', 'a'.repeat(50), '', '...']) {
      const once = sanitizePseudo(raw)
      expect(sanitizePseudo(once)).toBe(once)
    }
  })
})

describe('pseudoKey', () => {
  it('vaut exactement le pseudo normalisé (aucune divergence possible)', () => {
    for (const raw of ['Charles', 'Léo', 'jean pierre', 'panda_99']) {
      expect(pseudoKey(raw)).toBe(sanitizePseudo(raw))
    }
  })

  it('retombe sur une clé valide quand la saisie ne donne rien', () => {
    // Firestore refuse un identifiant de document vide → il FAUT un repli
    expect(pseudoKey('')).toBe('panda')
    expect(pseudoKey('🐼🐼')).toBe('panda')
    expect(pseudoKey('...')).toBe('panda')
  })
})
