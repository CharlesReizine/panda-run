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

// ─── DURCISSEMENT APRÈS LE NIVEAU 10 ────────────────────────────────────────────────────────────
//
// Retour du user : « je pense que le jeu est un chouille trop facile ; passé le niveau 10 et le
// changement de classe tu peux y aller. Donc plus de PV et plus de dégâts pour les mobs. »
//
// ⚠️ LE PROBLÈME EST UN CHANGEMENT DE RÉGIME, PAS UN NIVEAU GLOBAL MAL RÉGLÉ. La puissance du joueur
// fait un BOND au changement de classe (85 PV / 10 ATK en novice → 136/13, puis 238/28 en chevalier),
// puis croît de 18 à 29 PV PAR NIVEAU. La courbe des mobs, elle, était linéaire du début à la fin.
// L'écart se creusait donc mécaniquement : chiffré au niveau 40, un mob normal frappait un chevalier
// pour 23 points sur 1369 PV — soit 59 coups pour le tuer. Ce n'était pas un réglage à ajuster de
// quelques pourcents, c'était une divergence de pentes.
//
// On applique donc un facteur qui CROÎT AVEC LE NIVEAU, et seulement au-delà de 10 : le début de partie
// est calibré et ne doit pas bouger. Les PV montent un peu plus vite que l'ATK, pour durcir sans créer
// de morts en un coup. Au niveau 57 (le mob le plus haut du jeu) : PV ×2,6 et ATK ×2,4.
const SEUIL_DURCISSEMENT = 10
const PENTE_PV = 0.035
const PENTE_ATK = 0.03

// ─── ET DEUX PALIERS PAR-DESSUS LA PENTE ────────────────────────────────────────────────────────
//
// Demande du joueur : « tu peux rendre les monstres plus forts aussi ? Plus d'attaque, plus de défense.
// Jusqu'au niveau 10 tu touches pas, mais après le niveau 10 tu les rends 25 % plus forts, et après le
// niveau 30, 50 % plus forts (donc plus de vie et plus de dégâts). Ou alors tu augmentes juste le
// niveau des mobs des terrains un peu plus avancés — peut-être plus propre. »
//
// ⚠️ J'AI PRIS LA PREMIÈRE OPTION, ET LA SECONDE AURAIT ÉTÉ PLUS SALE MALGRÉ L'INTUITION. Monter le
// niveau des mobs d'un terrain ne change pas que leur force : le niveau pilote aussi l'XP qu'ils
// donnent (économie d'XP par terrain, déjà sous surveillance), le palier de butin qu'ils peuvent
// lâcher, et la calibration d'espèce entière — un même monstre apparaît sur plusieurs terrains, et son
// niveau dérive du PREMIER où il vit. Bouger un chiffre là-bas fait remuer quatre systèmes. Un
// multiplicateur de stats, lui, ne touche qu'à la force, se lit en deux lignes et se retire en une.
//
// ⚠️ ET ÇA S'AJOUTE À LA PENTE, ÇA NE LA REMPLACE PAS. Le durcissement progressif existait déjà (il
// répondait à « le jeu est un chouille trop facile passé le niveau 10 ») ; le joueur en redemande, donc
// les paliers se multiplient à la pente au lieu de s'y substituer. Au niveau 40 : PV ×3,8 et ATK ×3,4
// par rapport à la courbe de base.
// ⚠️ CALIBRÉS SUR UNE RÈGLE DU JOUEUR, PAS SUR UN RESSENTI : « je pense qu'un mob de ton niveau te tue
// en 5 coups quand tu as pas de stuff, et du coup avec stuff et tout tu tiens mieux. » C'est la première
// cible CHIFFRABLE qu'on ait eue sur la difficulté, et elle vaut mieux que n'importe quel multiplicateur
// choisi à l'œil. Mesuré, personnage NU (aucun équipement, aucun point réparti), contre un mob normal de
// son niveau :
//     niv 5 → 14 coups · niv 10 → 30 · niv 15 → 4,5 · niv 20 → 6,6 · niv 30 → 4,8 · niv 40 → 4,9 · niv 50 → 4,0
// Le début reste intact (c'est demandé : « au début faut commencer en douceur »), et tout ce qui suit
// tourne autour de cinq coups. Avec de l'équipement, on tient nettement plus — c'est exactement la
// progression décrite.
//
// ⚠️ LE PALIER HAUT EST PLUS BAS QUE LE PALIER MOYEN (2,4 contre 3,0), ET CE N'EST PAS UNE ERREUR. La
// puissance du joueur fait des BONDS aux changements de classe : sans cette correction, le niveau 50 nu
// mourait en 3 coups quand le niveau 20 en tenait 10. On aplatit la courbe vers la cible au lieu de
// l'escalader — « plus fort » ne veut pas dire « toujours plus multiplié ».
//
// ⚠️ ET LA MESURE DE DIFFICULTÉ SATURE, ce qui vaut d'être su. Passer la tranche haute de 1,5 à 2,1 ne
// faisait bouger le score du moteur de jouabilité que de 0,425 à 0,485 : il plafonne le nombre de coups
// encaissés (on finit par se dégager ou boire une potion). C'est pour ça que la règle des cinq coups est
// un meilleur guide que ce score-là.
//
// (Relevé initial, avant tout cela : difficulté moyenne 0,42 avant le niveau 10, 0,55 entre 11 et 30, et
// RETOUR à 0,42 au-delà de 30 — le jeu redevenait plus facile en fin de partie qu'au milieu.)
//
// ⚠️ RELEVÉS SUR MESURE, PAS AU JUGÉ. Le joueur : « le jeu va pas être trop facile ?
// Rends les mobs plus forts encore si c'est nécessaire passé le niveau 10. » Le moteur de jouabilité a
// tranché — et il a montré autre chose que ce qu'on cherchait : la difficulté moyenne valait 0,42 avant
// le niveau 10, 0,55 entre 11 et 30, et RETOMBAIT à 0,42 au-delà de 30. Le jeu redevenait donc plus
// facile en fin de partie qu'au milieu, parce que la puissance du joueur croît plus vite que la courbe
// des mobs (c'est déjà ce que disait le commentaire du durcissement, en dessous).
// Après relèvement : 0,43 / 0,59 / 0,50. La bosse du milieu reste la plus dure — c'est le changement de
// classe qui la creuse — mais la fin de partie ne s'effondre plus.
//
// ⚠️ ET LA MESURE SATURE, ce qui vaut d'être su avant de pousser plus loin. Passer la tranche haute de
// 1,5 à 2,1 ne fait bouger la difficulté que de 0,425 à 0,485 : le modèle plafonne le nombre de coups
// encaissés (on finit par se dégager ou boire une potion), donc doubler les PV d'un mob ne double pas le
// danger. Au-delà, c'est l'ATK qu'il faudrait monter — et elle crée des morts en un coup, ce que la
// courbe s'interdit. Le prochain cran de difficulté ne viendra donc pas d'un multiplicateur.
//
// ⚠️ « APRÈS le niveau 10 » VEUT DIRE À PARTIR DE 11, PAS DE 10. Le début de partie est calibré au
// monstre près et un test l'exige explicitement (« aucun durcissement jusqu'au niveau 10 INCLUS ») :
// faire commencer la marche à 10 aurait durci le dernier palier du tutoriel, celui-là même que le
// joueur a demandé de ne pas toucher.
// ⚠️ UN SEUL PALIER, ET UNE PENTE QUI S'ADOUCIT — parce que DEUX paliers décroissants faisaient un mob
// de niveau 31 PLUS FAIBLE qu'un de niveau 30. C'était le prix d'avoir voulu aplatir la courbe en
// baissant la marche haute : la cible des cinq coups était atteinte, la monotonie « plus haut niveau =
// plus dangereux » était perdue. On garde donc une seule marche et on RALENTIT la pente au-delà de 30 :
// la courbe s'aplatit vers la cible sans jamais redescendre.
const PALIER_UNIQUE = 3.0
const SEUIL_PALIER = 11
/** Au-delà de ce niveau, la pente est divisée : le joueur bondit aux changements de classe, pas les mobs. */
const NIVEAU_ADOUCI = 30
const ADOUCISSEMENT = 0.35

/** Palier de difficulté à ce niveau : 1 sous le seuil, la marche au-delà. */
export function palierDifficulte(level: number): number {
  return level >= SEUIL_PALIER ? PALIER_UNIQUE : 1
}

/** Rangées de pente effectives : pleines jusqu'à 30, ralenties ensuite. */
function penteEffective(level: number): number {
  const au_dela = Math.max(0, level - SEUIL_DURCISSEMENT)
  const pleines = Math.min(au_dela, NIVEAU_ADOUCI - SEUIL_DURCISSEMENT)
  return pleines + Math.max(0, au_dela - pleines) * ADOUCISSEMENT
}

/** Facteurs de durcissement à ce niveau : 1 avant le seuil, croissants ensuite, par paliers au-delà. */
export function durcissement(level: number): { hp: number; atk: number; def: number } {
  const au_dela = penteEffective(level)
  const palier = palierDifficulte(level)
  return {
    hp: (1 + PENTE_PV * au_dela) * palier,
    atk: (1 + PENTE_ATK * au_dela) * palier,
    // ⚠️ LA DÉF EST DURCIE À SON TOUR, SUR ARBITRAGE EXPLICITE DU JOUEUR : « tu augmentes comme un ouf
    // l'attaque, la vie ET la défense et ça ira mieux ». Le compromis reste celui écrit plus bas — les
    // dégâts sont SOUSTRACTIFS (atk − def), donc une DÉF plus haute allonge les combats plus qu'elle ne
    // les rend dangereux. On l'applique donc au PALIER seulement, pas à la pente : la marche se sent,
    // sans transformer chaque mob de fin de partie en éponge.
    def: palier,
  }
}

// Stats finales d'un monstre de niveau `level` et de rôle `role`. `grand` (gabarit géant) épaissit
// légèrement les PV (silhouette imposante) sans casser la monotonie (borné, appliqué après le rôle).
// `elite` applique le palier mini-boss PAR-DESSUS le rôle : un élite « frêle » reste le plus frêle
// des élites, mais cesse d'être aussi fragile qu'un mob ordinaire.
export function statsForLevel(level: number, role: MobRole = 'normal', grand = false, elite = false): { hp: number; atk: number; def: number } {
  const r = ROLE[role]
  const g = grand ? 1.15 : 1
  const e = elite ? ELITE : { hp: 1, atk: 1, def: 1 }
  const d = durcissement(level)
  return {
    hp: Math.round(hpBase(level) * r.hp * g * e.hp * d.hp),
    atk: Math.round(atkBase(level) * r.atk * e.atk * d.atk),
    // ⚠️ LA DÉF SUIT LE PALIER, PAS LA PENTE — et c'est un arbitrage rendu par le joueur contre l'avis
    // écrit ici auparavant (« la DÉF n'est pas durcie, et c'est délibéré »). Les dégâts sont
    // soustractifs : une DÉF plus haute allonge les combats plus qu'elle ne les rend dangereux, et long
    // n'est pas difficile. On applique donc la marche, pas la croissance continue, pour que le mob de
    // fin de partie encaisse mieux sans devenir une éponge.
    def: Math.round(defBase(level) * r.def * e.def * d.def),
  }
}

// Métrique de PUISSANCE GLOBALE d'un bloc de stats (sert aux tests de monotonie stats↔niveau).
export function statPower(hp: number, atk: number, def: number): number { return hp + 6 * atk + 6 * def }
