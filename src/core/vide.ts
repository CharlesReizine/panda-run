// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE SOUS-SOL EST SOMBRE, ET SA LIMITE SUIT LA SILHOUETTE DU TERRAIN
//
// « J'aimerais que quand y a des plateformes en hauteur ou autre trou, en dessous ça soit TJR TJR du vide. »
//
// ⚠️ DEUX TENTATIVES EN VOILES TRANSLUCIDES ONT ÉCHOUÉ AVANT CELLE-CI, et leur échec dit pourquoi celle-ci
// marche. D'abord un dégradé sur les seules colonnes trouées : ça dessinait des RAYURES verticales entre
// les dalles, en laissant le fond éclatant sous chacune d'elles. Puis le même dégradé sous toute surface
// élevée : un PATCHWORK de rectangles translucides posés sur la jungle (« graphiquement ça fait des choses
// bizarres, des strates moches »). La leçon : un rectangle semi-transparent sur un fond illustré lumineux
// se lit toujours comme un rectangle. On ne fabrique pas du vide en le teintant.
//
// La bonne approche est l'inverse : rendre le sous-sol OPAQUE, et faire passer sa limite EXACTEMENT sur la
// silhouette du terrain. Là où une plateforme couvre la limite, il n'y a aucune arête à voir — elle est
// cachée sous la plateforme. Là où la silhouette décroche (bord d'une corniche), l'arête verticale qui
// apparaît est précisément ce à quoi ressemble une falaise. Le ciel reste intact au-dessus du relief, et
// tout ce qui est dessous est sombre : c'est la lecture classique d'un jeu de plateformes.

/** Surface marchable ou matière : tout ce qui définit le dessus du terrain. Tuiles. */
export interface Dessus { x: number; y: number; w: number }

/** Pan de sous-sol : de la rangée `top` (le dessus du terrain) jusqu'au bas du monde. Tuiles. */
export interface PanSousSol { x: number; w: number; top: number }

/**
 * Silhouette du sous-sol : pour chaque colonne, la rangée du DESSUS du terrain ; colonnes voisines de même
 * altitude fusionnées en un seul rectangle (les terrains font 600 tuiles de large — un objet par colonne
 * serait absurde).
 */
export function silhouetteSousSol(
  largeur: number,
  groundRow: number,
  dessus: Dessus[],
  trous: { x: number; w: number }[],
): PanSousSol[] {
  const tops: number[] = []
  for (let x = 0; x < largeur; x++) {
    const troue = trous.some((t) => t.x <= x && t.x + t.w > x)
    let top = troue ? Infinity : groundRow
    for (const d of dessus) if (d.x <= x && d.x + d.w > x) top = Math.min(top, d.y)
    // Colonne trouée ET sans rien au-dessus : on repart du sol du monde plutôt que de remonter à l'infini.
    // Sans ce garde-fou on peindrait le CIEL en noir au-dessus des trous à ciel ouvert.
    tops.push(Number.isFinite(top) ? top : groundRow)
  }
  const out: PanSousSol[] = []
  for (let x = 0; x < largeur; x++) {
    const prec = out[out.length - 1]
    if (prec && prec.top === tops[x] && prec.x + prec.w === x) prec.w++
    else out.push({ x, w: 1, top: tops[x]! })
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// TROU DE PASSAGE AU CROISEMENT D'UNE ÉCHELLE
//
// « Une échelle que je peux pas descendre » puis « faut élargir un peu pour laisser un trou à côté de
// l'échelle pour remonter ». Une échelle traverse souvent une corniche de terre : en descendant, le panda
// se posait dessus et le voyage s'arrêtait là.
//
// Deux réponses, complémentaires, et il faut les deux :
//   · agrippé à une échelle, les corniches de terre ne bloquent plus (LevelScene.landsFromAbove) ;
//   · et la corniche est PERCÉE au croisement, pour que le passage se VOIE — sans quoi le joueur n'a
//     aucune raison de croire qu'on peut traverser, et l'échelle a toujours l'air de buter dans le sol.
//
// ⚠️ ON NE PERCE QUE SI LA CORNICHE RESTE PRATICABLE DES DEUX CÔTÉS. Percer une corniche de trois tuiles
// la couperait en deux moignons, et percer à son extrémité la raccourcirait sans rien ouvrir. D'où les
// gardes sur la largeur restante : le trou ne doit jamais transformer un chemin en piège.

/** Segment de plateforme après perçage. Tuiles. */
export interface Segment { x: number; w: number }

/** Largeur du trou percé au croisement : l'échelle plus une colonne, « un peu élargi » comme demandé. */
export const TROU_ECHELLE_W = 2

/** Tuiles minimales à conserver de chaque côté du trou pour que la corniche reste un chemin. */
export const RESTE_MIN = 2

/**
 * Perce une plateforme aux colonnes des échelles qui la traversent.
 *
 * Renvoie les segments à conserver (la plateforme d'origine si aucun perçage n'est possible).
 */
export function percerPourEchelles(
  plat: { x: number; w: number },
  echellesX: number[],
): Segment[] {
  let segments: Segment[] = [{ x: plat.x, w: plat.w }]
  for (const lx of echellesX) {
    const trouDebut = lx
    const trouFin = lx + TROU_ECHELLE_W
    const suivants: Segment[] = []
    for (const s of segments) {
      const fin = s.x + s.w
      if (trouFin <= s.x || trouDebut >= fin) { suivants.push(s); continue } // le trou est ailleurs
      const gauche = trouDebut - s.x
      const droite = fin - trouFin
      // le trou toucherait un bord, ou laisserait un moignon : on ne perce pas ce segment
      if (gauche < RESTE_MIN || droite < RESTE_MIN) { suivants.push(s); continue }
      suivants.push({ x: s.x, w: gauche }, { x: trouFin, w: droite })
    }
    segments = suivants
  }
  return segments
}
