import { STATS, type StatId } from '../core/repartition'
import { charsPerLine, textWidth } from './text-metrics'

// Page STAT — géométrie et textes calculés PUREMENT (aucune dépendance Phaser), partagés entre
// `StatsScene` et son test de non-débordement.
//
// Demande du joueur : « je suis chaud si tu peux faire une page "Stat" et je peux changer les stats,
// et une jolie toile où je vois comment j'ai pondéré mon perso (en pourcentage de points affectés).
// Je veux aussi un bouton "Suggérer" qui suit un build un peu classique par classe. »
//
// POURQUOI UNE GÉOMÉTRIE PURE : même raison qu'ailleurs dans ce projet (cf. quest-log-layout,
// bestiary-layout). Le joueur a exigé une fois pour toutes « un test qui m'assure que rien ne dépasse,
// et tant que c'est pas bon tu déploies pas » — ce n'est calculable sans rendu que si la disposition
// vit ici.

/** Espace de conception : 0→960 × 0→540, comme tous les écrans du jeu. */
export const PAGE = {
  titreY: 34,
  /** Colonne de gauche : la liste des stats et leurs boutons. */
  listeX: 40,
  listeY: 92,
  listeW: 470,
  ligneH: 74,
  /** Colonne de droite : la toile. */
  toileCx: 720,
  toileCy: 270,
  toileR: 132,
  /** Rangée du bas. */
  basY: 496,
}

export const POLICE = { titre: 26, nom: 20, effet: 12, valeur: 22, pct: 13 }

/** Ordonnée du haut de la ligne `i` de la liste. */
export const yLigneStat = (i: number): number => PAGE.listeY + i * PAGE.ligneH

/** La liste tient-elle au-dessus de la rangée du bas ? */
export const listeTientDansLaPage = (): boolean =>
  yLigneStat(STATS.length - 1) + PAGE.ligneH <= PAGE.basY - 24

/** La toile tient-elle dans le cadre, sans mordre sur la liste ? */
export const toileTientDansLaPage = (): boolean =>
  PAGE.toileCx - PAGE.toileR > PAGE.listeX + PAGE.listeW
  && PAGE.toileCx + PAGE.toileR <= 960 - 16
  && PAGE.toileCy - PAGE.toileR >= PAGE.listeY - 40
  && PAGE.toileCy + PAGE.toileR <= PAGE.basY - 24

/**
 * Position de l'ÉTIQUETTE d'une branche de la toile : posée un peu au-delà du sommet, vers l'extérieur.
 *
 * ⚠️ ELLE SORT DU RAYON, DONC ELLE PEUT SORTIR DE L'ÉCRAN — c'est le piège de tout radar. On la place
 * sur le cercle `rayon + marge` et le test vérifie que les quatre tiennent dans le cadre ; sans ça,
 * l'étiquette du haut passe sous le titre et celle de droite déborde à 960.
 */
export function etiquetteToile(i: number, marge = 26): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length
  return {
    x: PAGE.toileCx + Math.cos(angle) * (PAGE.toileR + marge),
    y: PAGE.toileCy + Math.sin(angle) * (PAGE.toileR + marge),
  }
}

/** Toutes les étiquettes tiennent-elles dans le cadre visible ? */
export function etiquettesTiennent(): boolean {
  return STATS.every((s, i) => {
    const e = etiquetteToile(i)
    const demi = textWidth(s.nom, POLICE.nom) / 2
    return e.x - demi >= 8 && e.x + demi <= 952 && e.y >= 20 && e.y <= 520
  })
}

/** Découpe un libellé pour qu'il tienne dans la largeur donnée. */
export function tronquer(texte: string, largeur: number, police: number): string {
  const max = charsPerLine(largeur, police)
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1))}…`
}

export function tientDans(texte: string, largeur: number, police: number): boolean {
  return textWidth(texte, police) <= largeur
}

/** Largeur utile d'un libellé d'effet : la ligne, moins les boutons et la valeur. */
export const largeurEffet = (): number => PAGE.listeW - 190

export type { StatId }
