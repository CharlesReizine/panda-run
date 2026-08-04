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

  it('REFUSE une correspondance par préfixe — une lettre oubliée ne charge pas la partie d\'un autre', () => {
    // ⚠️ CE TEST DISAIT L'INVERSE, ET C'ÉTAIT UNE FAILLE. La règle acceptait qu'une clé soit le préfixe de
    // l'autre, pour rattraper d'anciennes troncatures. Relevé par le user : « j'ai écrit charlychoulov et
    // ça m'a chargé charlychoulove ». Une faute de frappe ouvrait la partie d'un autre joueur, que la
    // sauvegarde automatique écrasait ensuite sous le mauvais pseudo. Le pseudo est la seule identité du
    // jeu : seule l'égalité exacte peut faire foi.
    expect(memeJoueur('charlychoulo', 'peu importe', 'charlychoulove')).toBe(false)
    expect(memeJoueur('charlychoulove2', 'peu importe', 'charlychoulove')).toBe(false)
    expect(memeJoueur('charlychoulove', 'charlychoulov', 'charlychoulove')).toBe(false)
    // et le sens qui compte pour le joueur : taper une lettre en moins ne trouve rien
    expect(memeJoueur('charlychoulove', 'charlychoulove', 'charlychoulov')).toBe(false)
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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // LE DOCUMENT TROUVÉ À LA CLÉ EXACTE DOIT LUI AUSSI PORTER LE BON NOM
  //
  // Relevé dans la vraie base le 4 août — sixième perte de sauvegarde, et la seule où la donnée était
  // encore là pour raconter ce qui s'était passé :
  //
  //   saves/charlychoulov  → nom « charlychoulove », chasseur 30   ← la vraie partie, clé tronquée
  //   saves/charlychoulove → nom « megastock »,      novice 1      ← poussé par erreur sur cette clé
  //
  // `chercher('charlychoulove')` rendait le SECOND : le document existait à la clé exacte, donc il
  // était rendu sans un regard pour le nom écrit dedans. Le contrôle `memeJoueur` n'était appliqué
  // qu'au balayage de repli — lequel n'était jamais atteint. Le joueur voyait sa partie remplacée par
  // un novice niveau 1, alors que son chasseur 30 dormait deux lignes plus haut.
  it('un document à la clé exacte mais au NOM étranger n\'est pas la partie demandée', () => {
    expect(memeJoueur('charlychoulove', 'megastock', 'charlychoulove')).toBe(false)
    // et le repli, lui, retrouve bien la vraie partie sous sa clé tronquée
    expect(memeJoueur('charlychoulov', 'charlychoulove', 'charlychoulove')).toBe(true)
  })

  it('une clé courte ne revendique rien', () => {
    // le préfixe attrape-tout n'existe plus : « ab » ne peut plus prétendre à « abcdefgh »
    expect(memeJoueur('ab', 'quelconque', 'abcdefgh')).toBe(false)
  })
})
