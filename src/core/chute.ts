// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES ATTAQUES VENUES DU CIEL SONT DES CORPS SOUMIS À LA GRAVITÉ
//
// Demande du user, mot pour mot : « toutes les attaques venues du ciel (météorite, pluie de flèches
// etc...) je veux que ça se fasse bloquer par tout sol au-dessus, par contre ça descend jusqu'au sol en
// dessous » — puis, pour lever toute ambiguïté : « c'est comme des corps soumis à la gravité quoi ».
//
// Avant : chaque météore/flèche naissait 340 px au-dessus du point visé et s'arrêtait PILE à l'altitude
// visée, quoi qu'il y ait entre les deux. Une flèche traversait donc un plafond de grotte, et une salve
// tirée au-dessus d'un vide s'arrêtait en plein air. Les dégâts, eux, s'appliquaient dans un disque
// autour du point visé sans rien consulter : un monstre à l'abri sous une dalle prenait tout.
//
// Le modèle est maintenant celui d'un corps qui tombe : il part du HAUT DU MONDE, dans sa colonne, et
// s'arrête sur la PREMIÈRE surface rencontrée. Deux conséquences, voulues :
//   • un toit protège ce qui est dessous (le corps s'écrase sur le toit) ;
//   • sans toit, le corps descend jusqu'au sol — même bien plus bas que le point visé.
//
// ⚠️ CE MODULE NE CONNAÎT QUE DES RANGÉES, PAS DES PIXELS, ET NE TOUCHE À RIEN. C'est une pure
// interrogation de la géométrie du terrain, donc testable sans Phaser — le reste (tween, explosion,
// dégâts) demeure dans LevelScene. Il sert aussi bien au VISUEL (où s'écrase le sprite) qu'aux DÉGÂTS
// (qui est réellement atteignable depuis le ciel), et c'est ce partage qui garantit que l'image et
// l'effet racontent la même chose.

/** Ce que la géométrie d'un terrain doit fournir pour arbitrer une chute. Tuiles, y depuis le HAUT. */
export interface GeoChute {
  /** rangée du sol du monde (surface de la bande pleine du bas) */
  groundRow: number
  /** trous MORTELS dans le sol : la colonne n'a plus de fond, le corps sort du monde */
  gaps?: { x: number; w: number }[]
  /** plateformes : la terre one-way arrête ce qui tombe DESSUS, donc elle arrête aussi un météore */
  platforms: { x: number; y: number; w: number }[]
  /** ponts de planches : surface fine, arrête également ce qui tombe dessus */
  bridges?: { x: number; y: number; w: number }[]
  /** dalles de roche : seules les SOLIDES arrêtent (un socle décoratif enterré n'est pas une surface) */
  rockBands?: { x: number; y: number; w: number; h: number; solid?: boolean }[]
}

/** Aucune surface dans la colonne : le corps sort du monde par le bas (trou mortel). */
export const HORS_MONDE = null

/**
 * Rangée de la surface où s'écrase un corps lâché dans la colonne `col` depuis la rangée `depuis`
 * (incluse). Renvoie `HORS_MONDE` si la colonne n'a aucun fond (trou dans le sol).
 *
 * La valeur rendue est la rangée de la SURFACE (son dessus), dans le même repère que
 * `LevelDef.platforms[].y` — le pixel d'impact est donc `rangee * TILE`.
 */
export function rangeeImpact(geo: GeoChute, col: number, depuis = 0): number | typeof HORS_MONDE {
  let meilleure: number | null = null
  const retenir = (r: number) => { if (r >= depuis && (meilleure === null || r < meilleure)) meilleure = r }

  for (const p of geo.platforms) if (col >= p.x && col < p.x + p.w) retenir(p.y)
  for (const b of geo.bridges ?? []) if (col >= b.x && col < b.x + b.w) retenir(b.y)
  // une dalle solide arrête sur son DESSUS ; on ignore les dalles non solides (socles enterrés)
  for (const r of geo.rockBands ?? []) if (r.solid && col >= r.x && col < r.x + r.w) retenir(r.y)
  // le sol du monde, sauf s'il est troué à cette colonne
  const troue = (geo.gaps ?? []).some((g) => col >= g.x && col < g.x + g.w)
  if (!troue) retenir(geo.groundRow)

  return meilleure
}

/**
 * Une cible située dans la colonne `col` à la rangée `rangeeCible` est-elle ATTEIGNABLE depuis le ciel ?
 *
 * Vrai quand rien ne s'interpose : le corps tombe au moins jusqu'à l'altitude de la cible. Faux dès
 * qu'une surface l'arrête plus haut — c'est exactement « se faire bloquer par tout sol au-dessus ».
 * Une colonne sans fond reste atteignable : le corps la traverse de bout en bout.
 */
export function atteignableDuCiel(geo: GeoChute, col: number, rangeeCible: number): boolean {
  const impact = rangeeImpact(geo, col)
  if (impact === HORS_MONDE) return true
  return impact >= rangeeCible
}
