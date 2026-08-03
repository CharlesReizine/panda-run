// ══════════════════════════════════════════════════════════════════════════════════════════════
// CORNICHES DE PIERRE NUE — « je peux marcher sur la pierre même si j'ai la terre au-dessus »
//
// Retour du user, capture à l'appui. Le motif fautif, mesuré sur les 48 terrains : 313 colonnes où le
// SOMMET d'une dalle de pierre solide est à nu (aucune coiffe de terre posée dessus) et où une
// plateforme de TERRE flotte 1 à 3 rangées plus haut. Le panda peut se poser sur cette dalle : il se
// retrouve debout sur de la maçonnerie, coincé sous une corniche de terre, dans un recoin où il ne
// peut rien faire.
//
// ⚠️ CE N'EST PAS UN PASSAGE, ET C'EST TOUT L'ARGUMENT DU CORRECTIF. Le panda mesure ~2 rangées et
// saute sur 4 : un espace de 1 à 3 rangées ne se traverse pas, ne s'habite pas, ne mène nulle part.
// La mesure est sans ambiguïté — sur les 313 colonnes, 201 offrent 1 rangée, 106 en offrent 2, 6 en
// offrent 3, et AUCUNE n'atteint 4. Il n'y a donc rien à préserver : on comble.
//
// D'où la règle : la pierre monte jusqu'à toucher la terre qui la coiffe. La coiffe reste la seule
// surface marchable, la pierre redevient ce qu'elle est — le CORPS sous la terre, pas un balcon.
//
// Combler plutôt que raboter : raboter la dalle (redescendre son sommet) ouvrirait un surplomb sous la
// terre, donc un deuxième recoin. Combler ne peut RIEN casser, puisque l'espace comblé était déjà
// impraticable, et se limite aux rangées d'air strictement entre les deux.

/** Dalle de roche (tuiles ; `y` = rangée du haut, `h` rangées vers le bas). */
export interface Dalle { x: number; y: number; w: number; h: number; solid?: boolean }
/** Plateforme (tuiles ; `y` = rangée de la surface). `solid` = pierre rigide, absent = terre one-way. */
export interface Marche { x: number; y: number; w: number; solid?: boolean }

/**
 * Rangées d'air en dessous desquelles un espace n'est plus un passage mais un recoin.
 * Le panda occupe ~2 rangées et saute sur ~4 : à 3 rangées il ne fait déjà que s'y coincer.
 */
export const PASSAGE_MIN_ROWS = 4

const couvre = (m: Marche, x: number) => m.x <= x && m.x + m.w > x
const dansDalle = (d: Dalle, x: number, y: number) => d.x <= x && d.x + d.w > x && y >= d.y && y < d.y + d.h

/** Corniche de pierre nue détectée sur une colonne. */
export interface CornicheNue {
  x: number
  /** rangée du sommet de pierre à nu (surface où le panda se pose) */
  pierre: number
  /** rangée de la plateforme de terre qui la surplombe */
  terre: number
}

/**
 * Colonnes où le sommet d'une dalle de pierre SOLIDE est marchable à nu tout en étant surplombé, de
 * trop près pour être un passage, par une plateforme de TERRE.
 *
 * Sert au validateur (le défaut ne doit pas revenir) ET à `comblements` (même parcours, même règle —
 * une seule définition du fautif, pas deux qui divergeraient).
 */
export function cornichesNues(rocks: Dalle[], plats: Marche[], minPassage = PASSAGE_MIN_ROWS): CornicheNue[] {
  const solides = rocks.filter((r) => r.solid)
  const out: CornicheNue[] = []
  for (const r of solides) {
    for (let x = r.x; x < r.x + r.w; x++) {
      // coiffée : une plateforme repose PILE sur le sommet → la pierre est bien un corps, pas un balcon
      if (plats.some((p) => couvre(p, x) && p.y === r.y - 1)) continue
      // sommet enterré sous une autre dalle : ce n'est pas une surface, on ne s'y pose pas
      if (solides.some((o) => o !== r && dansDalle(o, x, r.y - 1))) continue
      // la terre la PLUS BASSE au-dessus du sommet : c'est elle qui plafonne le recoin
      let terre = -1
      for (const p of plats) if (!p.solid && couvre(p, x) && p.y < r.y - 1 && p.y > terre) terre = p.y
      if (terre < 0) continue // sommet à ciel ouvert : c'est une mesa, elle a le droit d'être marchable
      if (r.y - terre - 1 >= minPassage) continue // vrai passage sous la corniche : on n'y touche pas
      out.push({ x, pierre: r.y, terre })
    }
  }
  return out
}

/**
 * Dalles de pierre à AJOUTER pour supprimer toutes les corniches nues : on remplit les rangées d'air
 * strictement comprises entre la terre et le sommet de pierre. Colonnes voisines de même géométrie
 * fusionnées en un seul rectangle (une dalle par recoin, pas une par colonne).
 */
export function comblements(rocks: Dalle[], plats: Marche[], minPassage = PASSAGE_MIN_ROWS): Dalle[] {
  const nues = cornichesNues(rocks, plats, minPassage).sort((a, b) => a.pierre - b.pierre || a.terre - b.terre || a.x - b.x)
  const out: Dalle[] = []
  for (const c of nues) {
    const y = c.terre + 1
    const h = c.pierre - c.terre - 1
    if (h <= 0) continue
    const prec = out[out.length - 1]
    if (prec && prec.y === y && prec.h === h && prec.x + prec.w === c.x) prec.w++
    else out.push({ x: c.x, y, w: 1, h, solid: true })
  }
  return out
}
