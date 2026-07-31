// Anti-chevauchement d'étiquettes. Géométrie PURE (aucune dépendance Phaser) → testable seule.
//
// Le problème : les noms de bâtiments d'une ville sont posés chacun au-dessus de sa façade. Quand deux
// façades sont proches, ou qu'un nom est long, les textes se marchent dessus et l'écran fait amateur.
// Les décaler « à la main » dans les données de thème ne tient pas : le texte dépend de la police, de
// la longueur du nom et de l'échelle — c'est une contrainte de RENDU, elle se résout au rendu.
//
// La règle : on ne bouge JAMAIS en x (une étiquette doit rester au-dessus de ce qu'elle nomme), on
// remonte seulement. On traite de bas en haut : la plus basse garde sa place, chaque suivante remonte
// juste assez pour dégager celles déjà posées.

export interface LabelBox {
  x: number // centre horizontal
  y: number // bas de l'étiquette (origine 0.5, 1 côté Phaser)
  w: number
  h: number
}

const overlaps = (a: LabelBox, b: LabelBox, gapX: number, gapY: number): boolean => {
  const dx = Math.abs(a.x - b.x)
  if (dx >= (a.w + b.w) / 2 + gapX) return false // colonnes disjointes : aucun risque
  // y = BAS de l'étiquette, donc l'étiquette occupe [y - h, y]
  const aTop = a.y - a.h, bTop = b.y - b.h
  return aTop < b.y + gapY && bTop < a.y + gapY
}

/**
 * Renvoie le décalage VERTICAL (négatif = vers le haut) à appliquer à chaque étiquette, dans l'ordre
 * d'entrée. Un tableau de zéros signifie qu'il n'y avait aucun chevauchement.
 */
export function spreadLabels(boxes: LabelBox[], gapX = 6, gapY = 3): number[] {
  const dy = new Array<number>(boxes.length).fill(0)
  // ordre de traitement : du plus BAS au plus haut (le plus bas est prioritaire, il ne bouge pas)
  const order = boxes.map((b, i) => i).sort((i, j) => boxes[j]!.y - boxes[i]!.y)
  const placed: LabelBox[] = []

  for (const i of order) {
    const box = { ...boxes[i]! }
    // on remonte tant qu'on touche quelque chose de déjà posé ; la boucle est BORNÉE (au pire une
    // étiquette par voisin) pour qu'un cas dégénéré ne puisse pas tourner à l'infini
    let guard = boxes.length + 1
    while (guard-- > 0) {
      const hit = placed.find((q) => overlaps(box, q, gapX, gapY))
      if (!hit) break
      box.y = hit.y - hit.h - gapY // juste au-dessus de l'obstacle
    }
    dy[i] = box.y - boxes[i]!.y
    placed.push(box)
  }
  return dy
}
