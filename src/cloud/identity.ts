// L'identité du joueur EST son pseudo. Choix explicite du user : retrouver sa partie sur n'importe
// quel appareil en tapant juste son pseudo, sans code ni mot de passe.
//
// ⚠️ CE QUE ÇA IMPLIQUE, ASSUMÉ. Sans secret, il n'y a aucune preuve d'identité : quiconque tape ton
// pseudo charge ta partie, peut l'écraser, et peut se déclarer niveau 99 sous ton nom au classement.
// C'est indissociable du « pas de mot de passe » — pas un oubli. Acceptable pour un jeu entre
// quelques personnes ; à revoir si le lien se met à circuler (la parade serait un code de
// récupération généré, cf. docs/specs/…-design.md).
//
// L'authentification anonyme reste branchée mais ne sert PLUS d'identité : elle est une simple
// barrière anti-abus (les règles Firestore exigent `request.auth != null`), pour qu'on ne puisse pas
// vider la base au curl sans même lancer le jeu.

// Clé de document Firestore dérivée du pseudo. Normalisée pour que « Charles », « charles » et
// « Charles  » désignent LA MÊME partie — sinon le joueur croit avoir perdu sa sauvegarde alors qu'il
// a juste tapé une majuscule. Contrainte Firestore : pas de '/', ni '.', ni '..'.
export function pseudoKey(pseudo: string): string {
  const k = pseudo
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents : « Léo » et « Leo » = même partie
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return k || 'panda' // pseudo entièrement exotique : on retombe sur une clé valide
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
