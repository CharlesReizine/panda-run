// Décision de synchronisation entre la sauvegarde LOCALE (localStorage) et la sauvegarde CLOUD
// (Firestore). Module PUR : aucune I/O, aucune dépendance Firebase ni Phaser → entièrement testable.
// C'est le seul endroit du système de sauvegarde où une erreur fait PERDRE une partie.
//
// LE PIÈGE. Comparer `local.savedAt` à `cloud.savedAt` dit seulement lequel est le plus récent,
// jamais si les deux ont DIVERGÉ. Scénario qui perd des données avec une simple comparaison :
// je joue sur l'iPhone (le local avance), puis sur le Mac (le cloud avance encore plus) ; le cloud
// est le plus récent, donc « prendre le cloud », et ma progression iPhone disparaît sans un mot.
//
// LA PARADE. On mémorise `lastSyncedAt` : l'horodatage du dernier état réellement échangé avec le
// cloud. Il sert de point de référence commun, ce qui permet une décision à TROIS branches —
// « le local a bougé », « le cloud a bougé », « les deux ont bougé » — au lieu d'un simple « lequel
// est le plus récent ». Le cas « les deux » est le seul qu'on ne tranche pas soi-même.
//
// Cf. docs/specs/2026-07-28-authent-google-sauvegarde-cloud-design.md

export type SyncAction =
  | 'rien' // les deux côtés sont à jour (ou il n'y a rien)
  | 'prendre-le-cloud' // écraser le local avec le cloud
  | 'garder-le-local' // le local fait foi ; l'appelant pousse ensuite
  | 'pousser-le-local' // aucune sauvegarde cloud : on crée la première
  | 'demander' // divergence réelle : c'est au joueur de choisir

// Tout ce dont la décision a besoin : un horodatage. `savedAt` vaut 0 pour une sauvegarde
// d'avant la version 9 (pas d'horodatage) → elle est alors toujours considérée comme la plus ancienne.
export interface Stamped {
  savedAt: number
}

/**
 * @param local sauvegarde locale, ou null s'il n'y en a pas
 * @param cloud sauvegarde cloud, ou null s'il n'y en a pas
 * @param lastSyncedAt horodatage du dernier état échangé avec le cloud (0 = jamais synchronisé)
 */
export function decideSync(local: Stamped | null, cloud: Stamped | null, lastSyncedAt: number): SyncAction {
  if (!local && !cloud) return 'rien'
  if (local && !cloud) return 'pousser-le-local'
  if (!local && cloud) return 'prendre-le-cloud'

  // les deux existent
  const l = local!.savedAt
  const c = cloud!.savedAt

  // même horodatage = même état : rien à faire, et surtout rien à demander (ce court-circuit doit
  // passer AVANT le test de divergence, sinon deux côtés identiques jamais synchronisés — lastSyncedAt
  // à 0 — seraient comptés comme « tous les deux modifiés » et déclencheraient un panneau inutile)
  if (l === c) return 'rien'

  const localChanged = l > lastSyncedAt
  const cloudChanged = c > lastSyncedAt

  if (localChanged && cloudChanged) return 'demander'
  if (cloudChanged) return 'prendre-le-cloud'
  if (localChanged) return 'garder-le-local'

  // Ni l'un ni l'autre n'est postérieur à lastSyncedAt, mais ils diffèrent : incohérent (horloge
  // reculée, lastSyncedAt bricolé). On ne devine pas — le joueur tranche, aucune donnée n'est perdue.
  return 'demander'
}
