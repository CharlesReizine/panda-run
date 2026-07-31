// Géométrie PURE du menu (sans Phaser), pour que le non-débordement soit TESTABLE.
//
// LE BUG QUE ÇA CORRIGE. Le menu listait les compétences à `y = 110 + i * 50` : pour l'archer et ses
// 15 sorts, la dernière ligne tombait à y = 810 sur un écran haut de 540. La moitié de l'écran était
// hors cadre — retour user : « le menu cata cata ». La liste de matériaux avait le même défaut
// (`y = 378 + i * 20`, sans plafond). Deux listes de longueur VARIABLE posées sans borne.
//
// La leçon, appliquée ici : toute liste dont la longueur dépend de la partie doit avoir une capacité
// CALCULÉE, et ce qui dépasse doit être annoncé (« +N autres ») plutôt que dessiné dans le vide.

export const MENU = {
  top: 96,
  bottom: 470, // au-dessus de la rangée de boutons
  left: 30,
  right: 930,
  /** colonne de séparation stats / matériaux */
  splitX: 470,
  rowH: 22,
  /** hauteur réservée au titre d'une colonne */
  titleH: 26,
  matCols: 2,
}

export interface Box { x: number; y: number; w: number; h: number }

export const statsBox = (): Box => ({
  x: MENU.left, y: MENU.top, w: MENU.splitX - MENU.left - 20, h: MENU.bottom - MENU.top,
})

export const materialsBox = (): Box => ({
  x: MENU.splitX, y: MENU.top, w: MENU.right - MENU.splitX, h: MENU.bottom - MENU.top,
})

/** Nombre de lignes de matériaux affichables par colonne. */
export function materialRowsPerCol(): number {
  return Math.max(1, Math.floor((materialsBox().h - MENU.titleH) / MENU.rowH))
}

/** Capacité totale d'affichage des matériaux (colonnes × lignes). */
export function materialCapacity(): number {
  return materialRowsPerCol() * MENU.matCols
}

/**
 * Découpe une collection de matériaux en ce qui est AFFICHÉ et ce qui est seulement compté.
 * `hidden > 0` ⇒ l'écran doit afficher « +N autres », jamais dessiner au-delà.
 */
export function splitMaterials<T>(all: T[]): { shown: T[]; hidden: number } {
  const cap = materialCapacity()
  return all.length <= cap
    ? { shown: all, hidden: 0 }
    : { shown: all.slice(0, cap - 1), hidden: all.length - (cap - 1) }
}

/** Y du bas de la dernière ligne de matériaux affichée — doit rester dans la boîte. */
export function materialsBottom(count: number): number {
  const box = materialsBox()
  const { shown } = splitMaterials(new Array(count).fill(0))
  const rows = Math.min(materialRowsPerCol(), Math.ceil(shown.length / MENU.matCols) || 1)
  return box.y + MENU.titleH + rows * MENU.rowH
}
