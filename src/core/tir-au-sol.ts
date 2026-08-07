// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN PROJECTILE NE DOIT PAS NAÎTRE DANS LE SOL
//
// Retour du joueur : « parfois (même quand y a pas de monstre et pas d'obstacle) ça écrit "lancer
// d'épée", mais il se passe rien ».
//
// ⚠️ IL AVAIT PAYÉ, ET IL N'AVAIT RIEN REÇU — c'est le pire des deux symptômes possibles. Le libellé
// s'affiche, l'énergie est débitée et le temps de recharge est armé AVANT que le moindre effet existe :
// quand l'effet échoue ensuite en silence, le joueur perd sa ressource sans comprendre pourquoi, et
// finit par croire que la compétence est cassée « au hasard ».
//
// LA CAUSE. Arcade multiplie la taille du corps physique par l'ÉCHELLE du sprite. Le lancer d'épée pose
// `setSize(46, 46)` puis `setScale(1.4)` : le corps fait donc 64,4 px de haut, recentré sur un sprite
// lâché à `joueur.y + 16`. Son bas tombe à `joueur.y + 48,2`, alors que les pieds du panda sont à
// `joueur.y + 40` — la lame naît HUIT PIXELS SOUS LE SOL, et le collider sol la détruit dans la frame
// même où elle apparaît. D'où le « parfois » : debout sur une surface pleine, ça rate toujours ; en
// l'air ou sur une plateforme traversable (qui n'est pas dans le groupe de collision), ça marche.
//
// ⚠️ LA RÈGLE EST ICI, PAS DANS CHAQUE SORT. Trois compétences avaient le même défaut sans que personne
// ne les rapproche : chacune choisissait sa texture et son échelle dans son coin, et rien ne vérifiait
// que le corps qui en résultait tenait dans la place disponible. C'est le même raisonnement que pour
// les colliders, posés sur les GROUPES et non projectile par projectile.

/** Décalage vertical du point de lâcher d'un projectile allié, sous le centre du panda. */
export const TIR_OFFSET_Y = 16

/**
 * Distance entre le centre du panda et ses pieds.
 *
 * Dérivée de sa boîte physique : `offsetY + h − TEX.h / 2` = 24 + 62 − 46 = 40 (cf. entities/player-body).
 * Écrite ici comme une constante NOMMÉE plutôt que recalculée : c'est la seule chose qui décide de la
 * place disponible sous le point de lâcher, et elle mérite d'être lisible.
 */
export const PIEDS_SOUS_CENTRE = 40

/** Hauteur réelle du corps physique d'un projectile : Arcade applique l'échelle à la taille posée. */
export function hauteurCorps(hauteurSource: number, echelle: number): number {
  return hauteurSource * echelle
}

/**
 * Le projectile mordrait-il le sol sur lequel se tient le lanceur ?
 *
 * Le corps est RECENTRÉ sur le sprite : son bas descend donc d'une demi-hauteur sous le point de
 * lâcher. Il mord dès que ce bas passe sous les pieds.
 */
export function mordLeSol(hauteurSource: number, echelle: number, offsetY = TIR_OFFSET_Y): boolean {
  return offsetY + hauteurCorps(hauteurSource, echelle) / 2 > PIEDS_SOUS_CENTRE
}

/**
 * De combien faut-il REMONTER le point de lâcher pour que ce projectile passe, marge comprise ?
 *
 * ⚠️ ON REMONTE LE TIR, ON NE RÉTRÉCIT PAS LA HITBOX — et c'est un arbitrage, pas une commodité. La
 * hitbox généreuse du lancer d'épée avait été posée EXPRÈS : sans elle, « la lame passait à travers les
 * mobs ». La rogner pour régler un problème vertical reprendrait d'une main ce qu'on avait donné de
 * l'autre, et le défaut réapparaîtrait sous une autre forme.
 */
export function remonteeNecessaire(hauteurSource: number, echelle: number, marge = 2): number {
  const bas = TIR_OFFSET_Y + hauteurCorps(hauteurSource, echelle) / 2
  return Math.max(0, Math.ceil(bas - PIEDS_SOUS_CENTRE + marge))
}

/** Échelle maximale admissible pour une hauteur de corps donnée, sans remonter le tir. */
export function echelleMax(hauteurSource: number, marge = 2): number {
  return (2 * (PIEDS_SOUS_CENTRE - TIR_OFFSET_Y - marge)) / hauteurSource
}

/**
 * Les projectiles alliés du jeu, avec la géométrie qu'ils s'imposent.
 *
 * ⚠️ CETTE TABLE EST LE GARDE-FOU, PAS UNE DOCUMENTATION. Elle existe pour qu'un test puisse vérifier
 * d'un coup que AUCUN projectile ne naît dans le sol — y compris ceux qu'on ajoutera demain. Les trois
 * premiers y sont entrés parce qu'ils étaient CASSÉS ; les autres, pour que la règle ait un sens.
 */
export const PROJECTILES: { id: string; hauteurSource: number; echelle: number; remonte?: number }[] = [
  // ── les trois qui échouaient ────────────────────────────────────────────────────────────────
  { id: 'lancer-epee', hauteurSource: 46, echelle: 1.4, remonte: 26 },
  { id: 'sceau-du-heaume', hauteurSource: 64, echelle: 1.4, remonte: 48 },
  // la boule de feu grossit avec la charge : on déclare son PIRE cas (charge pleine)
  { id: 'boule-de-feu', hauteurSource: 22, echelle: 3.2, remonte: 14 },
  // ── ceux qui passaient déjà, gardés pour que la règle couvre tout ───────────────────────────
  { id: 'fleche', hauteurSource: 22, echelle: 1.2 },
  { id: 'fleche-percante', hauteurSource: 22, echelle: 1.3 },
  { id: 'fleche-mortelle', hauteurSource: 22, echelle: 1.35 },
  { id: 'fleche-explosive', hauteurSource: 22, echelle: 1.35 },
  { id: 'laser', hauteurSource: 22, echelle: 1 },
  { id: 'mitraillette', hauteurSource: 22, echelle: 1.1 },
  { id: 'double-fleche', hauteurSource: 22, echelle: 1.05 },
]
