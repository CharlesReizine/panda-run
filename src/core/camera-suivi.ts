// ══════════════════════════════════════════════════════════════════════════════════════════════
// SUIVI DE CAMÉRA — HORIZONTAL COLLÉ, VERTICAL LÂCHE
//
// Deux demandes du user, dans cet ordre, et elles tirent en sens opposés :
//   « quand on saute, sur trampoline ou normal, je trouve fatigant que la caméra suive en hauteur à
//     chaque fois. Ça peut pas laisser monter un peu et réaligner de temps en temps ? »
//   « le terrain se décale plus assez vers la droite quand j'avance. Chaud que ça suive en direct dès que
//     je me déplace à droite, mais haut/bas pas forcément. »
//
// ⚠️ LA ZONE MORTE COUVRAIT TOUTE LA LARGEUR, ET C'ÉTAIT L'INVERSE DE L'INTENTION. Le commentaire d'origine
// affirmait « toute la largeur, le défilement horizontal doit rester continu » — or dans Phaser une zone
// morte est la région où la cible peut bouger SANS que la caméra ne suive. Large comme l'écran, elle
// supprime purement et simplement le suivi horizontal : le panda avançait jusqu'au bord du cadre avant que
// quoi que ce soit ne défile. En voulant assouplir le vertical, j'avais gelé l'horizontal.
//
// La règle est donc dissymétrique, et c'est volontaire :
//   · EN X : aucune zone morte, lissage à 1 → le décor suit le pas, immédiatement.
//   · EN Y : zone morte de 62 % de la hauteur → un saut entier et le premier rebond de trampoline ne
//     bougent rien ; au-delà, la caméra rattrape en douceur.
//
// Ce module ne touche pas à Phaser : il calcule des nombres, ce qui rend la dissymétrie vérifiable
// (tests/core/camera-suivi.test.ts) au lieu de reposer sur un commentaire qui peut mentir — c'est
// précisément ce qui s'est passé ici.

/** Part de la hauteur de l'écran où le panda peut monter/descendre sans que la caméra ne bouge. */
export const BANDE_MORTE_Y = 0.62

/** Lissage horizontal : 1 = collé au panda. Le décor doit suivre le pas, pas traîner derrière. */
export const LERP_X = 1

/** Lissage vertical au repos : doux, pour que les rattrapages ne soient jamais secs. */
export const LERP_Y_CALME = 0.1

/** Lissage vertical pendant une ascension rapide (trampoline) : plus vif, pour voir où l'on retombe. */
export const LERP_Y_MONTEE = 0.3

/** Vitesse de montée (px/s, valeur négative en Arcade) à partir de laquelle on durcit le suivi vertical. */
export const SEUIL_MONTEE = -450

/** Zone morte à appliquer à la caméra, en pixels. La largeur NULLE est le cœur du correctif. */
export function zoneMorte(hauteurEcran: number): { w: number; h: number } {
  return { w: 0, h: hauteurEcran * BANDE_MORTE_Y }
}

/**
 * Lissage vertical à appliquer selon la vitesse verticale du panda.
 *
 * Le confort de marche (0,1) traîne derrière une ascension de trampoline : on ne voit plus où l'on
 * retombe. On le durcit le temps de la montée, puis on le relâche. Ce comportement était DÉCRIT dans un
 * commentaire de LevelScene mais n'avait jamais été écrit ; il l'est ici, et il est testé.
 */
export function lerpVertical(vitesseY: number): number {
  return vitesseY <= SEUIL_MONTEE ? LERP_Y_MONTEE : LERP_Y_CALME
}
