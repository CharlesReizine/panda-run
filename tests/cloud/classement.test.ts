import { describe, it, expect } from 'vitest'
import { unParJoueur } from '../../src/cloud/leaderboard'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE LIGNE PAR JOUEUR AU CLASSEMENT — ET C'EST LA BONNE
//
// Deux retours successifs, et le second corrige le premier :
//   1. « J'ai changé de classe et ça me fait deux lignes dans le classement, moi archer et moi
//      chasseur, y a un prob. »  → on dédoublonne par pseudo.
//   2. « Tu m'as supprimé mon chasseur niveau 32, tu as supprimé le mauvais. » → on gardait la ligne
//      la plus RÉCENTE. Une ligne fantôme peut porter un horodatage plus frais (sa dernière écriture
//      avant que la clé ne change) tout en décrivant un personnage moins avancé.
//
// ⚠️ LE CRITÈRE EST LE NIVEAU, PAS LA DATE, et c'est ce que ce test protège. Le niveau ne redescend
// jamais : c'est la seule grandeur qui dise laquelle des deux lignes raconte la vraie partie.

const e = (pseudo: string, level: number, classId: string, updatedAt: number) =>
  ({ key: `${pseudo}-${classId}`, pseudo, level, classId, updatedAt })

describe('classement — une ligne par joueur', () => {
  it('garde le personnage le PLUS AVANCÉ, même si l\'autre ligne est plus récente', () => {
    // le cas exact du user : un chasseur 32 doublé par une ligne d'archer plus fraîche
    const out = unParJoueur([
      e('Charles', 20, 'archer', 9_000),
      e('Charles', 32, 'chasseur', 1_000),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.level).toBe(32)
    expect(out[0]!.classId).toBe('chasseur')
  })

  it('à niveau égal, garde la plus récente', () => {
    const out = unParJoueur([
      e('Charles', 32, 'archer', 1_000),
      e('Charles', 32, 'chasseur', 9_000),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.classId).toBe('chasseur')
  })

  it('dédoublonne malgré une casse ou des espaces différents', () => {
    // c'est précisément par là que les lignes fantômes sont entrées : une clé non normalisée
    const out = unParJoueur([e('Charles', 10, 'archer', 1), e(' charles ', 12, 'chasseur', 2)])
    expect(out).toHaveLength(1)
    expect(out[0]!.level).toBe(12)
  })

  it('ne touche pas aux joueurs distincts, et rend le classement trié', () => {
    const out = unParJoueur([e('Bob', 5, 'mage', 1), e('Charles', 32, 'chasseur', 1), e('Alice', 18, 'archer', 1)])
    expect(out.map((x) => x.pseudo)).toEqual(['Charles', 'Alice', 'Bob'])
  })

  it('supporte une liste vide sans se plaindre', () => {
    expect(unParJoueur([])).toEqual([])
  })
})
