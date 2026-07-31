// Géométrie PURE des commandes tactiles du bas de l'écran (le rendu est dans UIScene).
//
// Demande du user, mot pour mot : « en bas à droite je veux pouvoir attaquer, sauter et prendre une
// potion. Tu mets ça comme un V qui a pivoté à 90 degrés à gauche. Donc d'abord tu as l'attaque à gauche,
// au-dessus et à droite tu mets le saut, et en dessous et ça tu mets la potion. Tu peux grossir aussi ça
// pour que le triangle remplisse le premier quart. »
//
//   Un V pivoté de 90° vers la gauche, c'est un « < » : une pointe à gauche, deux branches vers la droite.
//
//                                    ○ SAUT
//                                   ╱
//                       ATTAQUE ◉ ─┤
//                                   ╲
//                                    ○ POTION
//
// ⚠️ TOUT EST REPÉRÉ DEPUIS LE BORD DROIT, jamais depuis la largeur de conception. L'écran réel est plus
// large que les 960 px de dessin (cf. core/viewport.ts) : des coordonnées absolues placeraient les
// commandes au milieu de l'écran au lieu du coin. C'est le défaut qui avait mis tout le HUD « au milieu
// gauche ». Les valeurs ci-dessous sont donc des distances au bord.
//
// ⚠️ LA POTION CHANGE DE CÔTÉ, et ça libère de la place pour une autre demande. Elle était en bas à
// GAUCHE ; en la déplaçant ici, tout le quart bas-gauche devient disponible pour le joystick (« la zone à
// gauche où on contrôle les mouvements du panda doit être plus grande, tout le quart en bas à gauche »).

export interface Bouton {
  /** distance au bord DROIT de l'écran (centre du bouton) */
  droite: number
  /** ordonnée du centre, dans le cadre 0→540 */
  y: number
  /** rayon visuel */
  r: number
  /** rayon de la zone TACTILE, plus généreux que le visuel : on joue au pouce */
  rTap: number
  /** ordonnée du libellé sous le bouton */
  labelY: number
}

/**
 * Le SAUT est le plus gros : c'est l'action la plus fréquente d'un jeu de plateforme, et la plus
 * punitive à rater. L'ATTAQUE suit. La POTION est la plus petite — on la prend rarement, et un gros
 * bouton de potion invite à la toucher par erreur en pleine action.
 *
 * ⚠️ RESSERRÉ ET COLLÉ AU BORD après essai sur appareil. La première version étalait le triangle sur tout
 * le quart (attaque à 300 px du bord, 148 px entre le saut et la potion) : retour du user, « le triangle à
 * droite il faut le coller à droite, pas de marge, et rapprocher les touches, là c'est trop chiant ».
 * Un pouce ne parcourt pas un quart d'écran entre deux actions — il pivote autour de sa base. Les
 * distances sont donc réduites d'un tiers, et les valeurs `droite` ne portent PLUS de marge de sûreté :
 * les commandes touchent le bord, contrairement au HUD de gauche qui, lui, doit s'en écarter (la caméra de
 * l'iPhone mord dessus). Deux bords, deux règles, et c'est délibéré.
 */
export const PAD = {
  attaque: { droite: 196, y: 396, r: 44, rTap: 58, labelY: 448 } as Bouton,
  saut: { droite: 72, y: 336, r: 50, rTap: 64, labelY: 392 } as Bouton,
  potion: { droite: 72, y: 456, r: 38, rTap: 52, labelY: 502 } as Bouton,
}

export const PAD_ORDRE = ['attaque', 'saut', 'potion'] as const
export type PadKey = typeof PAD_ORDRE[number]

/** Hauteur de l'écran de conception. */
export const VUE_H = 540

/** Segment vertical occupé par un bouton, libellé compris. */
export const etendueY = (b: Bouton): [number, number] => [b.y - b.rTap, Math.max(b.y + b.rTap, b.labelY + 10)]

/** Distance entre les centres de deux boutons. */
export const ecart = (a: Bouton, b: Bouton): number =>
  Math.hypot(a.droite - b.droite, a.y - b.y)

/** Les zones tactiles de deux boutons se chevauchent-elles ? */
export const seChevauchent = (a: Bouton, b: Bouton): boolean => ecart(a, b) < a.rTap + b.rTap

/**
 * Zone du joystick, en coordonnées ÉCRAN — le quart bas-gauche.
 *
 * ⚠️ COORDONNÉES ÉCRAN, PAS COORDONNÉES DE SCÈNE. VirtualJoystick teste `pointer.x/y`, qui sont les
 * coordonnées du canevas et ignorent le décalage de caméra ; ses visuels sont d'ailleurs en
 * scrollFactor(0) pour la même raison. C'est le seul endroit du HUD où ce raisonnement est le bon.
 */
export const zoneJoystick = (largeurEcran: number): { x: number; y: number; w: number; h: number } => ({
  x: 0,
  y: VUE_H / 2,
  w: largeurEcran / 2,
  h: VUE_H / 2,
})

/**
 * Marge de sûreté au bord de l'écran.
 *
 * Retour du user sur iPhone 12 : « là avec la caméra de l'iPhone 12 je vois pas tout ». Les coins arrondis
 * et l'îlot de caméra mordent sur les premiers pixels en mode paysage, et le HUD y était collé (8 px).
 * C'est l'équivalent d'un safe-area, calculé en coordonnées de jeu plutôt que lu en CSS, parce que le
 * canevas est mis à l'échelle à la main.
 *
 * ⚠️ 12 ET PAS 26, ET ELLE NE S'APPLIQUE QU'À GAUCHE ET EN HAUT. Le premier jet la posait à 26 px sur les
 * quatre bords : le user a lu ça comme une perte de place (« tu as pas juste décalé légèrement la vie »),
 * et il veut les commandes de droite COLLÉES au bord. Une marge sert à esquiver l'encoche, pas à encadrer
 * l'écran. Deux bords, deux règles, et c'est délibéré.
 */
export const MARGE_SURE = 12
