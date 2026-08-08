// ══════════════════════════════════════════════════════════════════════════════════════════════
// CE QU'UN COUP FAIT À LA PIERRE FRAGILE
//
// Retour du joueur : « les briques à casser, quand je fais des skills dessus, ça me prend des plombes à
// détruire. Genre mitraillette, ça détruit pas en une seconde, et c'est dommage, c'est pas jouissif du
// tout. » Puis, une fois les tirs corrigés : « c'est pas tant l'attaque à distance, je veux que les
// SKILLS cassent bien les briques GLOBALEMENT. »
//
// ⚠️ LE PREMIER CORRECTIF N'A TRAITÉ QU'UN CANAL SUR TROIS, et c'est ce que le second retour dit. Un
// projectile détruisait déjà sa tuile d'un coup ; le corps à corps, lui, continuait d'en ÉBRÉCHER UNE
// SEULE, d'un tiers, même porté par une compétence ultime — et les compétences de ZONE ne touchaient
// tout simplement PAS la pierre, jamais, quelle que soit leur puissance. Une faille de lumière qui
// balaie l'écran, traverse un mur de briques et le laisse intact : c'est le décor qui dit au joueur que
// sa compétence n'a servi à rien.
//
// La règle tient en une phrase, et c'est elle qu'on encode ici : UNE ATTAQUE DE BASE ÉBRÈCHE, UNE
// COMPÉTENCE DÉTRUIT. La résistance en trois coups garde tout son sens sur l'attaque normale et sur les
// sauts — on sent la pierre céder, la tuile se fissure sous les doigts. Sur une compétence, elle ne
// raconte plus rien : on vient de dépenser de l'énergie et un temps de recharge.

/** Coups nécessaires pour venir à bout d'une tuile de pierre fragile, sauf mention contraire. */
export const COUPS_PAR_TUILE = 3

export type SourceDeCoup =
  | 'attaque' // attaque de base au corps à corps
  | 'saut' // retombée sur la dalle, ou coup de tête par en dessous
  | 'competence-melee' // compétence au corps à corps (croissant, ultime, grand-croix…)
  | 'competence-zone' // compétence de ZONE centrée sur le joueur
  | 'projectile' // tir, boule de feu, lame lancée

/** Dégâts infligés à UNE tuile par un coup de cette provenance, en « coups ». */
export function coupsPortes(source: SourceDeCoup): number {
  return source === 'attaque' || source === 'saut' ? 1 : COUPS_PAR_TUILE
}

/**
 * Combien de tuiles ce coup entame-t-il À LA FOIS ?
 *
 * ⚠️ UNE ATTAQUE DE BASE N'EN ENTAME QU'UNE, ET CE N'EST PAS UN DÉTAIL D'ÉQUILIBRAGE. Un coup d'estoc
 * large ouvrirait le mur entier d'un seul geste, et la pierre fragile cesserait d'être un obstacle pour
 * devenir un rideau. La compétence, elle, a le droit : c'est la contrepartie de son coût.
 */
export function tuilesEntamees(source: SourceDeCoup): number | 'toutes' {
  return source === 'attaque' || source === 'saut' ? 1 : 'toutes'
}

/** Une seule frappe de cette provenance suffit-elle à détruire une tuile intacte ? */
export function detruitDUnCoup(source: SourceDeCoup, coupsDeLaTuile = COUPS_PAR_TUILE): boolean {
  return coupsPortes(source) >= coupsDeLaTuile
}
