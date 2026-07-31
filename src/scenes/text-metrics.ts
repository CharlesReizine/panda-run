// Métriques de texte PURES (aucune dépendance Phaser) : largeur, hauteur de ligne, découpe.
//
// POURQUOI CE FICHIER PEUT EXISTER. Phaser fixe `Courier` comme famille par défaut
// (node_modules/phaser/src/gameobjects/text/TextStyle.js : `fontFamily: [ 'fontFamily', 'Courier' ]`)
// et aucun écran d'interface ne la surcharge — seuls PreloadScene et TitleScene passent une famille
// explicite. Courier est MONOSPACE : la largeur d'un texte vaut donc exactement
// `nbCaractères × 0,6 × taille`. C'est ce qui rend le non-débordement CALCULABLE sans rendu, donc
// vérifiable par un test qui tourne en Node, sans canvas ni navigateur.
//
// ⚠️ LIMITE ASSUMÉE. Le jour où un écran passera à une police proportionnelle, ces fonctions ne seront
// plus que des estimations et le test correspondant perdra sa garantie. On accepte ce couplage parce
// que l'alternative — mesurer au rendu — rend le test impossible à écrire, et qu'un test approximatif
// mais présent a déjà attrapé plus de bugs qu'un test parfait mais absent.

/** Avance d'un caractère Courier, en fraction de la taille de police. */
export const ADVANCE = 0.6

/** Largeur en pixels d'un texte tenant sur UNE ligne. */
export const textWidth = (text: string, font: number): number => text.length * font * ADVANCE

/** Nombre de caractères qui tiennent sur une ligne de `w` pixels (au moins 1, sinon rien ne s'affiche). */
export const charsPerLine = (w: number, font: number): number =>
  Math.max(1, Math.floor(w / (font * ADVANCE)))

/**
 * Hauteur d'une ligne de texte.
 *
 * Phaser mesure ascent + descent au rendu (≈ 1,3 × la taille pour Courier) ; on MAJORE à 1,35 et on
 * arrondit vers le haut. Le sens de l'erreur n'est pas symétrique : sur-réserver laisse un peu de
 * blanc, sous-réserver fait chevaucher deux blocs à l'écran ALORS QUE LE TEST EST VERT. On arrondit
 * donc toujours du côté qui ne peut pas mentir.
 */
export const lineH = (font: number): number => Math.ceil(font * 1.35)

/** Tronque avec une ellipse, en gardant la longueur totale ≤ `maxChars`. */
export function truncate(s: string, maxChars: number): string {
  const cap = Math.max(1, Math.floor(maxChars))
  return s.length <= cap ? s : `${s.slice(0, cap - 1).trimEnd()}…`
}

/**
 * Découpe `text` en lignes de `maxChars` caractères au plus, en coupant sur les espaces.
 *
 * Deux détails qui comptent :
 *  - un mot plus long qu'une ligne est coupé DANS le mot. Sans ça, un nom d'objet d'un seul tenant
 *    (« porte-bonheur » dans une case étroite) déborderait de sa case sans qu'aucun compte de lignes
 *    ne s'en aperçoive ;
 *  - au-delà de `maxLines`, le reste est replié sur la dernière ligne PUIS tronqué avec une ellipse.
 *    Rien ne disparaît en silence : le joueur voit qu'il manque quelque chose.
 */
export function wrapText(text: string, maxChars: number, maxLines = Number.POSITIVE_INFINITY): string[] {
  const cap = Math.max(1, Math.floor(maxChars))
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const lines: string[] = []
  let cur = ''
  const flush = () => { if (cur) { lines.push(cur); cur = '' } }

  for (let word of words) {
    while (word.length > cap) {
      flush()
      lines.push(word.slice(0, cap))
      word = word.slice(cap)
    }
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= cap) cur += ` ${word}`
    else { flush(); cur = word }
  }
  flush()

  if (lines.length === 0) return ['']
  if (lines.length <= maxLines) return lines
  const keep = Math.max(1, Math.floor(maxLines))
  const kept = lines.slice(0, keep)
  kept[keep - 1] = truncate([kept[keep - 1], ...lines.slice(keep)].join(' '), cap)
  return kept
}
