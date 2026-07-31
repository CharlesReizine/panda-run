// Géométrie PURE (sans Phaser) de l'écran de changement / d'évolution de classe.
//
// LES DEUX DÉBORDEMENTS QUE ÇA CORRIGE, tous les deux mesurables :
//
//  1. L'ILLUSTRATION SORTAIT DE SA CARTE. Le portrait était posé à `y = 175` avec `setScale(2)` sur
//     une texture bakée de 96×92 (cf. entities/player-body.PANDA_TEX) : le cadre couvrait donc
//     y 83→267, alors que la carte commençait à y = 110 (centre 290, hauteur 360). Le panda dépassait
//     du haut de sa propre carte, et ses pieds (contenu utile jusqu'à y ≈ 255) empiétaient sur le nom
//     de la classe dessiné à y = 260 (bande 247→273). En mode évolution c'était pire : `setScale(2.4)`
//     → cadre y 64→286 pour une carte qui commence à y = 100.
//
//  2. LE MESSAGE DE FIN RECOUVRAIT LE BOUTON D'ÉVOLUTION. Le bouton « Évoluer en … » était à y = 500
//     (24 px + 10 de marge ⇒ bande 474→526) et `finish()` écrivait le message de confirmation à
//     y = 520 (bande 504→536), tous deux centrés en x = 480 : 22 px de recouvrement exactement au
//     moment le plus visible de l'écran, juste après le clic.
//
// LA RÈGLE APPLIQUÉE. Le portrait est déduit de sa BANDE (l'échelle est bornée par la carte, jamais
// l'inverse), les blocs de texte s'empilent en flux, la liste de compétences a une capacité CALCULÉE
// et annonce son surplus (« +N autres ») au lieu de le remplacer par un « … » muet, et les trois
// éléments de pied d'écran sont des rectangles que le test compare deux à deux.
//
// ⚠️ ESPACE DE CONCEPTION 0→960 × 0→540 : la largeur réelle varie (cf. core/viewport.ts) et la scène
// appelle `centerCamera`, donc on borne à 960 — pas à VIEW_W, qui décalerait l'interface à droite.

import { charsPerLine, lineH, textWidth, truncate } from './text-metrics'

export interface Rect { x: number; y: number; w: number; h: number }
export interface Band { y: number; h: number }

export const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export const DESIGN = { w: 960, h: 540 }

/** Taille de la texture bakée d'un panda — miroir de entities/player-body.PANDA_TEX. */
export const PANDA_TEX = { w: 96, h: 92 }

export const CC = {
  titleY: 50, titleFont: 32,
  /** haut des cartes */
  top: 88,
  /** RIEN dans une carte ne descend sous cette ligne : le bouton d'action commence en dessous */
  bottom: 448,
  pad: 10,
  /** trois voies au choix : cartes de 250 px séparées de 30 → centres 200 / 480 / 760 */
  choiceW: 250, choiceGap: 30,
  /** une seule carte en mode évolution : plus large, elle porte une ligne « X → Y » */
  evolveW: 320,
  /** échelle VOULUE du portrait ; elle est bornée par la largeur de la carte dans `portraitScale` */
  portraitScale: 2,
  nameFont: 22,
  statsFont: 14, statsLines: 2,
  skillFont: 12,
  actionY: 474, actionFont: 22, actionPadX: 20, actionPadY: 8,
  /** battement du bouton d'action : il grossit, donc la place réservée doit tenir compte du +6 % */
  actionPulse: 1.06,
  trainingX: 20, trainingY: 518, trainingFont: 16, trainingPadX: 10, trainingPadY: 6,
  messageY: 518, messageFont: 20,
}

/** Bas du titre : les cartes commencent en dessous. */
export const titleBottom = (): number => CC.titleY + lineH(CC.titleFont) / 2

/**
 * Carte n° `i` parmi `n`. `n === 1` ⇒ mode évolution (carte unique, plus large et centrée) ; sinon
 * rangée de cartes de choix centrée sur l'écran. Le calcul est le même dans les deux cas, ce qui
 * garantit qu'un futur 4e choix se recentrerait tout seul au lieu de sortir par la droite.
 */
export function cardRect(i: number, n: number): Rect {
  const w = n === 1 ? CC.evolveW : CC.choiceW
  const total = n * w + (n - 1) * CC.choiceGap
  const x0 = DESIGN.w / 2 - total / 2
  return { x: x0 + i * (w + CC.choiceGap), y: CC.top, w, h: CC.bottom - CC.top }
}

/** Largeur utile d'une carte (hors marges intérieures). */
export const cardInnerW = (card: Rect): number => card.w - 2 * CC.pad

/**
 * Échelle du portrait : l'échelle voulue, BORNÉE par la largeur utile de la carte. C'est le sens de
 * dépendance qui compte — l'image obéit à la carte. L'ancien code faisait l'inverse (échelle fixe,
 * carte fixe, et on croise les doigts).
 */
export const portraitScale = (card: Rect): number =>
  Math.min(CC.portraitScale, cardInnerW(card) / PANDA_TEX.w)

export interface CardFlow {
  /** cadre COMPLET de la texture du portrait (pas seulement le panda visible) */
  portrait: Rect
  name: Band
  stats: Band
  /** bande de la liste de compétences, hauteur = un multiple entier de la hauteur de ligne */
  skills: Band
}

export function cardFlow(card: Rect): CardFlow {
  const s = portraitScale(card)
  const pw = PANDA_TEX.w * s, ph = PANDA_TEX.h * s
  const portrait: Rect = { x: card.x + card.w / 2 - pw / 2, y: card.y + CC.pad, w: pw, h: ph }

  const name: Band = { y: portrait.y + portrait.h + 4, h: lineH(CC.nameFont) }
  const stats: Band = { y: name.y + name.h + 4, h: CC.statsLines * lineH(CC.statsFont) }

  const skillsY = stats.y + stats.h + 4
  const avail = card.y + card.h - CC.pad - skillsY
  const rows = Math.max(1, Math.floor(avail / lineH(CC.skillFont)))
  return { portrait, name, stats, skills: { y: skillsY, h: rows * lineH(CC.skillFont) } }
}

/** Nombre de lignes de compétence affichables dans une carte. */
export const maxSkillLines = (card: Rect): number =>
  Math.max(1, Math.floor(cardFlow(card).skills.h / lineH(CC.skillFont)))

/**
 * Découpe la liste de compétences en « affichées » et « comptées ».
 *
 * `reserved` retire des lignes de la capacité pour un en-tête éventuel (« Nouveaux skills : » en mode
 * évolution). Dès que ça dépasse, une ligne est SACRIFIÉE pour porter le « +N autres » : mieux vaut
 * une compétence de moins et un compte honnête qu'un « … » qui ne dit pas combien il en reste.
 */
export function splitSkills(names: string[], card: Rect, reserved = 0): { shown: string[]; hidden: number } {
  const cap = Math.max(1, maxSkillLines(card) - reserved)
  if (names.length <= cap) return { shown: names, hidden: 0 }
  return { shown: names.slice(0, cap - 1), hidden: names.length - (cap - 1) }
}

export const nameChars = (card: Rect): number => charsPerLine(cardInnerW(card), CC.nameFont)
export const statsChars = (card: Rect): number => charsPerLine(cardInnerW(card), CC.statsFont)
export const skillChars = (card: Rect): number => charsPerLine(cardInnerW(card), CC.skillFont)

/** Le nom de classe (ou la ligne « X → Y ») raccourci si jamais il ne tenait pas dans la carte. */
export const fitName = (label: string, card: Rect): string => truncate(label, nameChars(card))
export const fitSkill = (label: string, card: Rect): string => truncate(label, skillChars(card))

// ── pied d'écran : trois éléments qui se sont déjà marché dessus, donc trois rectangles ────────

/** Encombrement d'un texte encadré (police monospace + marges du style Phaser). */
const boxOf = (text: string, font: number, padX: number, padY: number): { w: number; h: number } => ({
  w: Math.ceil(textWidth(text, font)) + 2 * padX,
  h: lineH(font) + 2 * padY,
})

/** Bouton d'action (évolution), centré sous les cartes. */
export function actionRect(label: string): Rect {
  const { w, h } = boxOf(label, CC.actionFont, CC.actionPadX, CC.actionPadY)
  return { x: DESIGN.w / 2 - w / 2, y: CC.actionY - h / 2, w, h }
}

/** Bouton « Entraînement », ancré en bas à GAUCHE (origine 0, 0.5 côté Phaser). */
export function trainingRect(label: string): Rect {
  const { w, h } = boxOf(label, CC.trainingFont, CC.trainingPadX, CC.trainingPadY)
  return { x: CC.trainingX, y: CC.trainingY - h / 2, w, h }
}

/**
 * Message de confirmation affiché après le choix. Il partage sa LIGNE avec le bouton d'entraînement
 * (l'écran n'a plus de place ailleurs) : c'est la séparation HORIZONTALE qui garantit le non-
 * recouvrement, et le test la vérifie sur le message le plus long que le jeu puisse produire.
 */
export function messageRect(text: string): Rect {
  const { w, h } = boxOf(text, CC.messageFont, 0, 0)
  return { x: DESIGN.w / 2 - w / 2, y: CC.messageY - h / 2, w, h }
}
