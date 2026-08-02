import { CARD } from './bestiary-layout'

// Géométrie PURE de la GRILLE de monstres de l'écran de début de terrain.
//
// ⚠️ POURQUOI ON REVIENT À UNE GRILLE APRÈS L'AVOIR ABANDONNÉE. La première version entassait, pour
// CHAQUE monstre, image + nom + butin complet + compétences : sur un terrain à quatre espèces, chaque
// carte faisait 90 px de large et tout débordait. On avait donc basculé sur une fiche par page, avec
// navigation ‹ ›. Le user demande maintenant l'inverse — « des images juste de tous les monstres + leur
// niveau et si élite ou pas, et juste un petit "i" à côté avec la sous-page dédiée » — et cette fois
// c'est tenable, parce que le contenu n'est plus le même : quatre informations minuscules au lieu d'une
// fiche entière. Le détail n'a pas disparu, il est derrière le « i ». C'est la grille qui a changé de
// nature, pas l'avis sur les grilles.
//
// Le plafond « 8 espèces » du jeu porte sur les SPAWNS ; le boss et les mobs injectés pour la couverture
// du bestiaire s'y ajoutent. Mesuré : jusqu'à onze espèces sur un terrain. Deux rangées de six couvrent
// donc le pire cas. On calcule la disposition à partir du nombre RÉEL pour qu'une rangée incomplète soit
// centrée, pas alignée à gauche avec des trous.

export interface CelluleGrille {
  /** centre de la vignette */
  x: number
  y: number
  /** côté du cadre carré de la vignette */
  taille: number
  /** centre du petit bouton « i » */
  infoX: number
  infoY: number
  /** ordonnée du libellé de niveau, sous la vignette */
  niveauY: number
}

/** Rayon du bouton « i » — assez grand pour le pouce, assez petit pour ne pas manger la vignette. */
export const RAYON_INFO = 13

/** Zone allouée à la grille : celle de la fiche, puisque la fiche passe derrière le « i ». */
export const GRILLE = {
  top: CARD.top + 8,
  bottom: CARD.bottom - 8,
  /** Espace de conception : la grille est centrée sur 480 comme le reste de l'écran. */
  centreX: 480,
  largeur: 900,
}

/**
 * Dispose `n` monstres en une grille centrée.
 *
 * Deux rangées au maximum : au-delà de quatre par rangée les vignettes deviennent trop petites pour
 * qu'on distingue un monstre d'un autre — or c'est le seul but de cet écran.
 */
export function grilleMonstres(n: number): CelluleGrille[] {
  if (n <= 0) return []
  // ⚠️ JUSQU'À SIX PAR RANGÉE, PAS QUATRE. Le plafond « 8 espèces » est appliqué AUX SPAWNS, au moment
  // de peupler le terrain ; le boss s'y ajoute, et les mobs injectés pour la couverture du bestiaire
  // aussi. Mesuré sur le vrai roster : jusqu'à onze espèces sur cimetiere-1. Une grille dimensionnée sur
  // la règle plutôt que sur la mesure aurait débordé exactement là où personne ne regardait.
  const parRangee = Math.min(6, Math.ceil(n / 2))
  const rangees = Math.ceil(n / parRangee)
  const hDispo = GRILLE.bottom - GRILLE.top
  // hauteur d'une cellule = vignette + libellé de niveau ; on garde 12 px de gouttière verticale
  const hCellule = hDispo / rangees
  const taille = Math.min(
    Math.floor(GRILLE.largeur / parRangee) - 24, // gouttière horizontale
    Math.floor(hCellule) - 34, // place pour le libellé sous la vignette
    150,
  )
  const pasX = GRILLE.largeur / parRangee
  const out: CelluleGrille[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / parRangee)
    const dansRangee = Math.min(parRangee, n - r * parRangee)
    const c = i - r * parRangee
    // chaque rangée est centrée sur ce qu'elle contient réellement (une rangée de 2 n'est pas cadrée
    // à gauche avec deux trous à droite)
    const largeurRangee = dansRangee * pasX
    const x0 = GRILLE.centreX - largeurRangee / 2 + pasX / 2
    const x = x0 + c * pasX
    const y = GRILLE.top + hCellule * r + hCellule / 2 - 10
    out.push({
      x, y, taille,
      infoX: x + taille / 2 - 2,
      infoY: y - taille / 2 + 2,
      niveauY: y + taille / 2 + 14,
    })
  }
  return out
}

/** La grille tient-elle dans sa zone, sans chevauchement entre vignettes ? */
export function grilleTient(n: number): boolean {
  const cells = grilleMonstres(n)
  if (cells.length === 0) return true
  for (const c of cells) {
    if (c.y - c.taille / 2 < GRILLE.top) return false
    if (c.niveauY + 8 > GRILLE.bottom) return false
    if (c.x - c.taille / 2 < GRILLE.centreX - GRILLE.largeur / 2) return false
    if (c.x + c.taille / 2 > GRILLE.centreX + GRILLE.largeur / 2) return false
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]!, b = cells[j]!
      const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y)
      if (dx < a.taille && dy < a.taille) return false
    }
  }
  return true
}
