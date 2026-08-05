/**
 * Dégâts physiques : attaque × multiplicateur, moins la défense, au minimum 1.
 *
 * ⚠️ TOUT EST DIVISÉ PAR DEUX, DES DEUX CÔTÉS. Retour du user : « divise par deux les dégâts faits et
 * reçus, je trouve que ça va trop vite là ». Les échanges se réglaient en deux ou trois coups : on
 * n'avait le temps ni d'esquiver, ni de choisir un sort, ni de reculer — le combat était tranché avant
 * d'avoir commencé.
 *
 * ⚠️ ET C'EST FAIT ICI, EN UN SEUL ENDROIT, VOLONTAIREMENT. Le facteur ne s'applique pas à l'attaque
 * (ce qui déséquilibrerait les monstres au profit du joueur, ou l'inverse) mais au RÉSULTAT de la
 * soustraction : joueur et monstres passent tous par cette fonction, donc le rythme ralentit sans que
 * le rapport de force bouge d'un pouce. Toucher aux fiches — atk des classes, atk des 90 monstres —
 * aurait demandé cent modifications et cassé la calibration des niveaux, qui dérive de ces chiffres.
 *
 * Le plancher reste à 1 : une attaque doit toujours faire quelque chose, sinon un adversaire trop blindé
 * devient invulnérable au lieu d'être difficile.
 */
export const RYTHME_COMBAT = 0.5

export function physicalDamage(atk: number, def: number, multiplier = 1): number {
  return Math.max(1, Math.round((atk * multiplier - def) * RYTHME_COMBAT))
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES MOBS TAPENT 10 % MOINS FORT
//
// Demande du joueur, dans le même souffle que les dix potions de départ : « baisse de 10 % les dégâts
// faits par les mobs ». Les deux visent la même chose — la prise en main.
//
// ⚠️ ON RÉDUIT LE DÉGÂT, PAS L'ATTAQUE. Passer le coefficient à `physicalDamage` l'appliquerait AVANT
// la soustraction de la défense : sur un joueur bien équipé, 10 % d'attaque en moins peut valoir 40 %
// de dégât en moins (la défense mange une part fixe), et sur un joueur nu presque rien. En le posant
// sur le RÉSULTAT, la baisse vaut exactement 10 % pour tout le monde, ce qui est ce qui a été demandé.
//
// Le plancher de 1 est conservé : un coup qui ne fait rien du tout ne se comprend pas.
export const DEGATS_MOBS_MULT = 0.9

/** Dégât subi par le JOUEUR d'un coup de monstre ou de boss (la seule voie qui porte la remise). */
export function degatsSubis(atk: number, def: number): number {
  return Math.max(1, Math.round(physicalDamage(atk, def) * DEGATS_MOBS_MULT))
}

// Une cible est à portée de mêlée si elle est devant (ou pile sur le perso) et pas trop
// décalée verticalement. La tolérance verticale (90) absorbe l'écart de hauteur entre le
// centre du panda (grand sprite) et celui des monstres (petits). dxFacing = (cible.x - perso.x) * facing.
export function inMeleeReach(dxFacing: number, dyAbs: number, reach: number): boolean {
  return dyAbs < 90 && dxFacing > -24 && dxFacing < reach + 20
}
