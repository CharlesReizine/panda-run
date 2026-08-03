// L'identité du joueur EST son pseudo. Choix explicite du user : retrouver sa partie sur n'importe
// quel appareil en tapant juste son pseudo, sans code ni mot de passe.
//
// ⚠️ CE QUE ÇA IMPLIQUE, ASSUMÉ. Sans secret, il n'y a aucune preuve d'identité : quiconque tape ton
// pseudo charge ta partie, peut l'écraser, et peut se déclarer niveau 99 sous ton nom au classement.
// C'est indissociable du « pas de mot de passe » — pas un oubli. Acceptable pour un jeu entre
// quelques personnes ; à revoir si le lien se met à circuler (la parade serait un code de
// récupération généré).
//
// L'authentification anonyme reste branchée mais ne sert PLUS d'identité : elle est une simple
// barrière anti-abus (les règles Firestore exigent `request.auth != null`).

export const PSEUDO_MAX = 14

/**
 * Format canonique d'un pseudo : minuscules, sans accent, sans espace, sans caractère exotique.
 *
 * ⚠️ C'EST LA SEULE FONCTION DE NORMALISATION DU PROJET, et elle est appliquée DÈS LA SAISIE (cf.
 * ui/pseudo-prompt.ts). Conséquence voulue : le pseudo AFFICHÉ est identique à la clé de stockage.
 * Tant qu'on normalisait seulement au moment d'écrire, « Léo » s'affichait mais cherchait « leo » —
 * et le joueur qui tapait une majuscule croyait avoir perdu sa sauvegarde. En bloquant au clavier,
 * l'écart ne peut plus exister.
 */
export function sanitizePseudo(raw: string): string {
  return raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // « é » → « e »
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') // supprime espaces, ponctuation, emoji…
    .slice(0, PSEUDO_MAX)
}

// Clé de document Firestore. Identique au pseudo canonique par construction : deux fonctions
// distinctes pourraient DIVERGER, une seule ne peut pas.
export function pseudoKey(pseudo: string): string {
  // ⚠️ LE REPLI « panda » A COÛTÉ UNE SAUVEGARDE, ET IL EST SUPPRIMÉ. Quand la saisie ne donnait rien
  // d'exploitable, tout le monde atterrissait dans le MÊME document — relevé dans la base :
  //   clé « panda » → nom « charlychoulove », archer 29, 23 terrains finis
  // Le joueur tapait ensuite son pseudo, le jeu cherchait « charlychoulove », ne trouvait rien à cet
  // endroit, et lui proposait de créer une nouvelle partie. Un repli silencieux qui range une partie
  // ailleurs que là où on la cherchera est un piège, pas une sécurité.
  //
  // On renvoie donc une chaîne VIDE, et l'appelant refuse d'aller plus loin (cf. TitleScene) : mieux vaut
  // redemander un pseudo que d'en inventer un. La contrainte Firestore (pas de '/', '.', '..') est de
  // toute façon respectée par sanitizePseudo, qui ne garde que [a-z0-9_-].
  return sanitizePseudo(pseudo)
}

const ACTIVE_KEY = 'panda-run-pseudo'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// Pseudo de la partie en cours sur CET appareil (pour resynchroniser au lancement sans redemander).
export function readActivePseudo(): string | null {
  return safeStorage()?.getItem(ACTIVE_KEY) ?? null
}

export function writeActivePseudo(pseudo: string): void {
  safeStorage()?.setItem(ACTIVE_KEY, pseudo)
}
