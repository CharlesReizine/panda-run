// ══════════════════════════════════════════════════════════════════════════════════════════════
// TROUS DE PASSAGE — ce qui reste de src/core/vide.ts
//
// ⚠️ TROIS TENTATIVES POUR « FAIRE RESSEMBLER LE VIDE À DU VIDE » ONT ÉTÉ RETIRÉES, et le motif de leur
// échec vaut d'être gardé : la demande était « quand y a des plateformes en hauteur ou autre trou, en
// dessous ça soit TJR TJR du vide ».
//   1. dégradé translucide sur les colonnes trouées → RAYURES verticales entre les dalles, fond éclatant
//      sous chacune d'elles ;
//   2. le même sous toute surface élevée → PATCHWORK de rectangles translucides sur la jungle
//      (« graphiquement ça fait des choses bizarres, des strates moches ») ;
//   3. sous-sol OPAQUE suivant la silhouette du terrain → « y a des gros trucs noirs, on passe dedans on
//      tombe ». C'est la faute la plus grave des trois, et elle est de principe : un remplissage opaque
//      annonce de la MATIÈRE, alors qu'il n'apporte AUCUNE collision. Le rendu mentait sur le terrain, et
//      un joueur qui se fie à ce qu'il voit tombe dans le décor.
//
// La leçon, pour la prochaine tentative : le vide ne se peint pas par-dessus, il se CREUSE dans la
// génération. Tant que le socle de pierre est là, il est solide, et le montrer autrement est un piège.

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
