// ══════════════════════════════════════════════════════════════════════════════════════════════
// REPRENDRE UNE PARTIE — LA DÉCISION, SORTIE DE LA SCÈNE POUR ÊTRE TESTABLE
//
// Cinq correctifs se sont succédé sur ce choix, et QUATRE ONT PERDU DES DONNÉES. À chaque fois, les
// fonctions pures qu'ils touchaient étaient déjà couvertes de tests verts : le défaut n'était jamais dans
// `plusAvancee`, `memeJoueur` ou `pseudoKey`, il était dans la façon dont `TitleScene.continueGame` les
// ENCHAÎNAIT — un `catch` qui avale, un `null` qui veut dire deux choses, un délai qui expire. Or une
// scène Phaser ne se teste pas : la suite ne pouvait rien voir venir.
//
// D'où ce module. Il ne fait ni réseau ni rendu : il reçoit ce qu'on a trouvé au cloud et ce qu'on a en
// local, et il rend UNE décision. Toute la matrice des cas est épinglée dans tests/core/reprise.test.ts.
//
// LES DEUX RÈGLES, et l'ordre compte :
//   1. On ne propose JAMAIS de nouvelle partie sur une recherche qui a échoué. « Je n'ai rien trouvé » et
//      « je n'ai pas pu chercher » sont deux réponses différentes ; les confondre transforme l'écran
//      d'accueil en écran d'effacement, et le joueur qui accepte écrase son personnage par un novice 1.
//   2. Entre deux sauvegardes, la PLUS AVANCÉE gagne, d'où qu'elle vienne. Dans un jeu solo la
//      progression ne redescend jamais : ce choix ne peut, par construction, pas faire perdre de niveaux.

import type { StampedSave } from './save'

/** Ce que la recherche au cloud a donné (miroir de `Recherche` dans cloud/cloud-save.ts). */
export type Trouvaille =
  | { etat: 'trouve'; save: StampedSave }
  | { etat: 'absent' }
  | { etat: 'echec'; raison: string }

export type Reprise =
  /** on a une partie à charger */
  | { action: 'reprendre'; save: StampedSave; source: 'cloud' | 'local' }
  /** aucune partie sous ce pseudo, et on en est SÛR : on peut proposer d'en créer une */
  | { action: 'proposer-nouvelle' }
  /** on n'a pas pu savoir : on ne propose que de réessayer, jamais d'écraser */
  | { action: 'reessayer'; raison: string }

const niveau = (s: StampedSave | null): number => s?.player.level ?? -1

/**
 * Décide quoi faire quand le joueur demande à reprendre `pseudo`.
 *
 * @param cloud  ce que la recherche au cloud a donné (trouvé / absent / échec)
 * @param local  la sauvegarde locale horodatée, s'il y en a une
 */
export function decideReprise(cloud: Trouvaille, local: StampedSave | null): Reprise {
  const distante = cloud.etat === 'trouve' ? cloud.save : null

  // 1) une sauvegarde à charger ? on prend la plus avancée, à niveau égal la plus récente.
  if (distante || local) {
    if (niveau(distante) > niveau(local)) return { action: 'reprendre', save: distante!, source: 'cloud' }
    if (niveau(local) > niveau(distante)) return { action: 'reprendre', save: local!, source: 'local' }
    // niveaux égaux (ou une seule des deux existe et l'autre vaut -1)
    const dAt = distante?.savedAt ?? -1
    const lAt = local?.savedAt ?? -1
    return dAt >= lAt
      ? { action: 'reprendre', save: distante!, source: 'cloud' }
      : { action: 'reprendre', save: local!, source: 'local' }
  }

  // 2) rien sous la main. Est-ce parce qu'il n'y a rien, ou parce qu'on n'a pas pu regarder ?
  if (cloud.etat === 'echec') return { action: 'reessayer', raison: cloud.raison }
  return { action: 'proposer-nouvelle' }
}

/**
 * Peut-on créer une partie neuve sous ce pseudo sans risquer d'en écraser une ?
 *
 * Utilisé par « Nouvelle partie ». L'ancien code démarrait quand même après une vérification ratée
 * (« hors connexion, la synchro suivra ») : la partie neuve écrasait ensuite, à la première
 * synchronisation, une sauvegarde distante qu'on n'avait jamais réussi à lire.
 */
export function decideNouvelle(cloud: Trouvaille): 'creer' | 'confirmer-ecrasement' | 'reessayer' {
  if (cloud.etat === 'trouve') return 'confirmer-ecrasement'
  if (cloud.etat === 'echec') return 'reessayer'
  return 'creer'
}
