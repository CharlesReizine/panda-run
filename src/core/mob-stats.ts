// COURBE STATS ↔ NIVEAU (retour playtest : « un mob niv7 aussi fragile qu'un niv1 = incohérent »).
//
// Les PV / ATK / DÉF d'un monstre normal ne sont plus posés à la main (source d'incohérences —
// un niv4 pouvait être aussi coriace qu'un niv20) : ils DÉRIVENT de son niveau calibré (core/mob-level)
// via une courbe MONOTONE croissante, modulée par un RÔLE (silhouette de combat). Deux monstres de
// niveaux distincts ont donc toujours des stats cohérentes avec leur niveau ; un même niveau peut
// abriter un « frêle » et un « tank », mais leur PUISSANCE GLOBALE reste comparable et croît avec le
// niveau (cf. tests core/mob-stats + data/monsters). Les BOSS / ÉLITES (MVP) / GARDIENS gardent leurs
// stats posées à la main (combats scriptés, calibrés à part) — ils n'ont pas de rôle.

// Rôle de combat = comment la puissance du niveau se répartit entre PV / ATK / DÉF.
export type MobRole =
  | 'normal'   // équilibré
  | 'costaud'  // brute : un peu plus de PV et d'ATK (poporing, orc, scorpion)
  | 'tank'     // coriace et lent : gros PV + grosse DÉF, ATK moindre (willow, golem, ours)
  | 'frele'    // fragile ET peu mordant : petites bêtes inoffensives (porings/slimes, lunatic)
  | 'distant'  // tireur/lanceur : peu de PV/DÉF, ATK correcte (mandragore, mage-noir, méduse)
  | 'rapide'   // fonceur : PV/DÉF modérés, ATK mordante (louveteau, harpie, diablotin)
  | 'volant'   // oiseau : léger (peu de PV/DÉF), pique fort (corbeau, faucon, ara)

// Courbe de PUISSANCE de base par niveau (croissante, ~linéaire). Chaque stat de base en dérive.
export function hpBase(level: number): number { return Math.round(24 + 10 * level) }
export function atkBase(level: number): number { return Math.round(6 + 3.6 * level) }
export function defBase(level: number): number { return Math.max(0, Math.round(0.75 * level)) }

// Multiplicateurs de rôle (bornés : le rôle REDISTRIBUE la puissance, il ne la crée pas — la
// puissance globale reste pilotée par le niveau, cf. monotonie testée).
const ROLE: Record<MobRole, { hp: number; atk: number; def: number }> = {
  normal:  { hp: 1.0,  atk: 1.0,  def: 1.0 },
  costaud: { hp: 1.15, atk: 1.05, def: 1.1 },
  tank:    { hp: 1.4,  atk: 0.85, def: 1.6 },
  frele:   { hp: 0.7,  atk: 0.78, def: 0.6 },
  distant: { hp: 0.85, atk: 1.1,  def: 0.85 },
  rapide:  { hp: 0.85, atk: 1.15, def: 0.8 },
  volant:  { hp: 0.75, atk: 1.1,  def: 0.7 },
}

// ÉLITE (mvp) : un mini-boss de map, pas un mob normal avec une aura dorée.
//
// ⚠️ CE MULTIPLICATEUR CORRIGE UN VRAI BUG, pas un réglage de confort. L'en-tête de ce fichier
// affirmait que « les BOSS / ÉLITES gardent leurs stats posées à la main » — c'était FAUX pour les
// élites : l'angeling est `mvp: true` avec le rôle `frele` (le profil le plus fragile du jeu) et
// AUCUNE stat manuelle, donc il héritait de statsForLevel(6, 'frele') ≈ 59 PV et 3 DÉF. Un joueur
// niveau 5 le tuait d'un coup — retour user : « pas du tout ce que j'attends d'un élite ».
//
// RÈGLE POSÉE PAR LE USER : un élite ne tape PAS monstrueusement plus fort que ses voisins de même
// niveau — il a 3 à 4 fois plus de VIE. Les PV sont donc le seul vrai levier, l'ATK reste quasi celle
// d'un mob normal (juste assez pour qu'on le sente).
//
// ⚠️ POURQUOI LA DÉF EST BASSE ICI : les dégâts sont SOUSTRACTIFS (`atk - def`, cf. core/combat.ts).
// Une DÉF doublée ajoute donc de la durabilité PAR-DESSUS les PV, et l'élite dépasserait largement le
// 3-4× demandé sans que ça se voie dans le chiffre de PV. On la garde à un cran modeste pour que la
// durabilité réelle corresponde à l'intention. Verrouillé par tests/core/mob-stats.test.ts.
const ELITE = { hp: 3.5, atk: 1.1, def: 1.3 }

// Stats finales d'un monstre de niveau `level` et de rôle `role`. `grand` (gabarit géant) épaissit
// légèrement les PV (silhouette imposante) sans casser la monotonie (borné, appliqué après le rôle).
// `elite` applique le palier mini-boss PAR-DESSUS le rôle : un élite « frêle » reste le plus frêle
// des élites, mais cesse d'être aussi fragile qu'un mob ordinaire.
export function statsForLevel(level: number, role: MobRole = 'normal', grand = false, elite = false): { hp: number; atk: number; def: number } {
  const r = ROLE[role]
  const g = grand ? 1.15 : 1
  const e = elite ? ELITE : { hp: 1, atk: 1, def: 1 }
  return {
    hp: Math.round(hpBase(level) * r.hp * g * e.hp),
    atk: Math.round(atkBase(level) * r.atk * e.atk),
    def: Math.round(defBase(level) * r.def * e.def),
  }
}

// Métrique de PUISSANCE GLOBALE d'un bloc de stats (sert aux tests de monotonie stats↔niveau).
export function statPower(hp: number, atk: number, def: number): number { return hp + 6 * atk + 6 * def }
