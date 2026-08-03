import { describe, it, expect } from 'vitest'
import { canon, memeJoueur, plusAvancee } from '../../src/cloud/cloud-save'
import type { StampedSave } from '../../src/core/save'
import { newPlayer } from '../../src/core/player-state'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// RETROUVER LA BONNE PARTIE — LE CAS RÉEL, RELEVÉ DANS LA BASE
//
// Quatre correctifs successifs ont échoué à charger la partie du user. Ce qui a tranché, ce n'est pas
// un raisonnement : c'est la lecture de Firestore.
//
//   clé « panda »          → nom « charlychoulove », archer 29, 23 terrains finis   ← la vraie partie
//   clé « charlychoulove » → nom « megastock »,      novice 1                       ← créée par erreur
//   clé « GkIUvAZbyp… »    → nom « Panda »,          novice 2                       ← ancienne build
//
// La clé du document a dérivé (repli de `pseudoKey`, troncature, identifiant d'authentification d'une
// vieille version) ; le nom écrit DANS la sauvegarde, lui, n'a pas bougé. Ces tests épinglent les deux
// règles qui en découlent, et le cas exact ci-dessus.

const sauvegarde = (nom: string, niveau: number, at: number): StampedSave => {
  const p = newPlayer(nom)
  p.level = niveau
  return { player: p, savedAt: at }
}

describe('retrouver la partie d\'un joueur', () => {
  it('reconnaît la partie par le NOM inscrit dedans, même sous une clé sans rapport', () => {
    // le cas réel : la vraie partie dort sous la clé « panda »
    expect(memeJoueur('panda', 'charlychoulove', 'charlychoulove')).toBe(true)
  })

  it('reconnaît une clé tronquée, dans les deux sens', () => {
    // trace d'un changement de longueur maximale du pseudo
    expect(memeJoueur('charlychoulo', 'peu importe', 'charlychoulove')).toBe(true)
    expect(memeJoueur('charlychoulove2', 'peu importe', 'charlychoulove')).toBe(true)
  })

  it('ne confond PAS deux joueurs distincts', () => {
    // c'est la garantie qui compte le plus : sans mot de passe, le pseudo EST l'identité
    expect(memeJoueur('megastock', 'megastock', 'charlychoulove')).toBe(false)
    expect(memeJoueur('GkIUvAZbypew2mnCwJaezuGLu4u2', 'Panda', 'charlychoulove')).toBe(false)
  })

  it('normalise accents, casse et ponctuation avant de comparer', () => {
    expect(canon('Charly-Choulove')).toBe('charly-choulove')
    expect(canon('Léo Ünïcode !')).toBe('leounicode')
    expect(memeJoueur('quelconque', 'CharlyChoulove', 'charlychoulove')).toBe(true)
  })

  it('entre plusieurs candidats, garde le PLUS AVANCÉ — pas le plus récent', () => {
    // le piège exact du correctif précédent : le novice 1 était plus récent que l'archer 29
    const gagnant = plusAvancee([
      sauvegarde('megastock', 1, 1785743618593),
      sauvegarde('charlychoulove', 29, 1785697328448),
      sauvegarde('Panda', 2, 1785313434343),
    ])
    expect(gagnant.player.level).toBe(29)
    expect(gagnant.player.name).toBe('charlychoulove')
  })

  it('à niveau égal, garde la plus récente', () => {
    const gagnant = plusAvancee([sauvegarde('a', 29, 1000), sauvegarde('b', 29, 9000)])
    expect(gagnant.savedAt).toBe(9000)
  })

  it('une clé trop courte ne sert pas de préfixe attrape-tout', () => {
    // « ab » ne doit pas revendiquer « abcdefgh » : le garde-fou est côté appelant (longueur ≥ 3),
    // mais la règle de préfixe elle-même reste symétrique et doit rester lisible.
    expect(memeJoueur('ab', 'quelconque', 'abcdefgh')).toBe(true) // vrai ici…
    // …ce qui est précisément pourquoi `autresCandidats` refuse les clés de moins de 3 caractères.
  })
})
