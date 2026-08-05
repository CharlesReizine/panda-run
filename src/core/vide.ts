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
// LE TROU DE PASSAGE AU CROISEMENT D'UNE ÉCHELLE A ÉTÉ RETIRÉ — QUATRIÈME TENTATIVE, MÊME LEÇON
//
// Il perçait la corniche à la colonne de l'échelle, « pour que le passage se VOIE » : sans quoi, disait
// le raisonnement, rien n'indique au joueur qu'on peut franchir la marche, et l'échelle a l'air de
// buter dans le sol.
//
// ⚠️ MAIS UN TROU DANS LE DÉCOR EST UN TROU DANS LA COLLISION. Retour du joueur : « on passe à travers
// le sol quand on est sur de la terre sous une échelle (même quand l'échelle monte), sans être agrippé
// ou quoi, juste en marchant ou en sautant là ». Marcher sur cette corniche, c'était tomber.
//
// Et le perçage ne servait à rien : traverser était DÉJÀ permis, et mieux — agrippé à une échelle, les
// corniches de terre ne bloquent plus (`LevelScene.landsFromAbove`). Le montant dessiné par-dessus la
// corniche dit où l'on passe ; il n'y avait pas besoin d'ouvrir le sol pour le dire.
//
// C'est la QUATRIÈME fois que ce fichier apprend la même chose : on ne fabrique pas du vide en le
// dessinant. Le vide se creuse dans la génération, là où les validateurs et la physique le voient
// ensemble — jamais à la pose, dans le dos du modèle.
//
// Conséquence à garder en tête : une corniche traversée par une échelle ne doit JAMAIS porter la
// collision pleine (`ancree`, cf. data/levels), car celle-ci ignore `landsFromAbove` et bloquerait le
// grimpeur. C'est garanti à l'assemblage.

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE ÉCHELLE NE SE DESSINE PAS PAR-DESSUS LA TERRE
//
// Demande du joueur : « fais en sorte que l'échelle ne se superpose pas avec de la terre. Genre
// l'échelle arrive collée à une plateforme où y a de la terre, mais passe pas à travers. »
//
// Le montant était UN seul TileSprite, à la profondeur −1 — donc DEVANT les plateformes (−4) : les
// barreaux se dessinaient par-dessus l'herbe, et l'ouvrage avait l'air de traverser la matière. Or il
// la traverse bel et bien en JEU (agrippé, les corniches ne bloquent plus), et c'est voulu ; ce qui
// n'allait pas, c'était de le MONTRER.
//
// ⚠️ ON COUPE LE DESSIN, PAS L'ÉCHELLE. La zone d'accroche et la hauteur restent intactes : rien ne
// change à la jouabilité. Reculer simplement la profondeur derrière les plateformes aurait aussi
// masqué le montant, mais aussi derrière les socles de pierre et les décors — on perdrait l'échelle de
// vue dans les puits. Un montant interrompu PILE à la rangée de terre dit exactement ce qu'il faut :
// « ça s'arrête là, et ça reprend en dessous ».

/** Segment vertical de montant à dessiner : `y` = rangée du haut, `h` = nombre de rangées. */
export interface SegmentEchelle { y: number; h: number }

/**
 * Découpe le montant d'une échelle en segments visibles, en sautant les rangées PLEINES (une corniche
 * de terre, un pont). Rend au moins un segment si rien ne la coupe.
 */
export function segmentsEchelle(y: number, h: number, rangeesPleines: number[]): SegmentEchelle[] {
  const pleines = new Set(rangeesPleines)
  const out: SegmentEchelle[] = []
  let debut = -1
  for (let r = y; r <= y + h; r++) {
    const coupe = r === y + h || pleines.has(r)
    if (!coupe && debut < 0) debut = r
    if (coupe && debut >= 0) { out.push({ y: debut, h: r - debut }); debut = -1 }
  }
  return out
}
