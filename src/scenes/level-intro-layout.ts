import { CARD } from './bestiary-layout'

// Géométrie PURE de l'ossature de l'écran de début de terrain : le sur-titre en haut, et la rangée
// de navigation + « Commencer ! » en bas. La fiche du monstre elle-même occupe la zone `CARD` et est
// dessinée par scenes/monster-card.ts.
//
// POURQUOI C'EST UN FICHIER À PART. Cet écran a un contenu de PLEIN CADRE (la fiche) coincé entre deux
// bandes de chrome. C'est exactement la configuration où l'on finit par empiéter : l'ancienne version
// entassait titre + sous-titre + grille + bouton et débordait. Ici, un test vérifie que le chrome et la
// fiche ne se touchent JAMAIS, et que les quatre éléments du bas ne se recouvrent pas entre eux.

/** Bande de sur-titre, en haut (origine haut-gauche du texte). */
export const INTRO = {
  headerY: 16,
  headerH: 24,
  /** Centre vertical de la rangée du bas. */
  navY: 516,
  navH: 36,
}

/** Rangée du bas : navigation entre monstres à gauche, lancement à droite. Centres et largeurs. */
export const INTRO_ROW = {
  prev: { x: 120, w: 130 },
  counter: { x: 268, w: 150 },
  next: { x: 416, w: 130 },
  // ⚠️ IL MANQUAIT LA SORTIE. « Quand on arrive sur une map tu proposes Continuer mais pas Retour à la
  // carte. » Cet écran était un couloir à sens unique : une fois arrivé, la seule issue était de lancer
  // le terrain — ou de mettre en pause une fois dedans pour en ressortir. Voir le bestiaire d'un
  // terrain qu'on n'a pas envie de faire est une raison suffisante d'y venir, et repartir doit coûter
  // un geste, pas une partie.
  retour: { x: 534, w: 100 },
  start: { x: 720, w: 260 },
}

export const introHeaderBottom = (): number => INTRO.headerY + INTRO.headerH
export const introNavTop = (): number => INTRO.navY - INTRO.navH / 2
export const introNavBottom = (): number => INTRO.navY + INTRO.navH / 2

/** Le chrome laisse-t-il la zone de fiche entièrement libre, sans sortir du cadre ? */
export const introChromeClears = (): boolean =>
  introHeaderBottom() <= CARD.top && introNavTop() >= CARD.bottom && introNavBottom() <= 540

/** Segments horizontaux [gauche, droite] des éléments de la rangée du bas, dans l'ordre. */
export function introRowSpans(): { name: string; l: number; r: number }[] {
  return Object.entries(INTRO_ROW).map(([name, b]) => ({ name, l: b.x - b.w / 2, r: b.x + b.w / 2 }))
}
