// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA RÈGLE DU JEU, DITE UNE BONNE FOIS
//
// Demande du joueur : « au début, explique CLAIREMENT qu'il FAUT tuer un maxxx de monstres pour gagner
// l'XP et devenir fort. C'est pas clair pour tous les joueurs. »
//
// ⚠️ RIEN NE LE DISAIT, ET C'EST LA BOUCLE ENTIÈRE DU JEU. On arrivait sur le premier terrain avec une
// sortie à droite : tout invitait à courir vers elle. Or courir vers la sortie ne fait pas monter d'un
// niveau — et le terrain suivant, lui, monte en difficulté. Le joueur qui traverse sans combattre
// arrive donc systématiquement sous-niveau, meurt, et n'a aucun moyen de comprendre POURQUOI : rien ne
// lui a jamais dit que l'XP vient des monstres et pas de la progression sur la carte.
//
// C'est le genre d'évidence qu'on ne voit plus quand on a écrit le jeu. Il aura fallu qu'un joueur le
// signale — et il parlait des AUTRES joueurs, pas de lui, ce qui est encore plus juste : celui qui
// connaît le jeu ne peut pas mesurer ce qui manque à celui qui le découvre.
//
// ⚠️ ET ON L'ÉCRIT EN IMPÉRATIF, PAS EN DESCRIPTION. « Les monstres donnent de l'expérience » est une
// note de bas de page. « Tue tout ce que tu croises » est une consigne. La différence décide si le
// message est lu ou parcouru.

export interface PanneauPremiersPas {
  titre: string
  lignes: string[]
  pied: string
}

export const PREMIERS_PAS: PanneauPremiersPas = {
  titre: 'AVANT DE PARTIR',
  lignes: [
    '⚔  TUE UN MAXIMUM DE MONSTRES.',
    "C'est la SEULE façon de gagner de l'expérience et de monter de niveau.",
    '',
    "Traverser un terrain sans combattre ne rapporte presque RIEN — et le terrain",
    "suivant, lui, sera plus dur. On arrive sous-niveau, et on meurt.",
    '',
    '💪  Monter de niveau augmente tes PV, ton attaque et ta défense,',
    'et débloque des compétences dans l\'arbre.',
    '',
    '🔁  Un terrain se rejoue autant de fois que tu veux : les monstres reviennent.',
    'Bloqué quelque part ? Reviens farmer deux niveaux, et repars.',
  ],
  pied: 'Toucher pour commencer',
}

/** Clé de mémorisation : le panneau ne s'impose qu'une fois. */
export const CLE_PREMIERS_PAS = 'panda-premiers-pas-vu'

/**
 * Faut-il imposer le panneau ?
 *
 * ⚠️ LA CONDITION EST « NIVEAU 1 », PAS « PREMIER TERRAIN ». Un joueur qui recommence une partie sur un
 * autre pseudo, ou qui revient après avoir tout perdu, a autant besoin de la consigne que le tout
 * premier jour — et un joueur de niveau 20 qui rejoue la Prairie n'a pas besoin qu'on la lui répète.
 * C'est l'état du personnage qui décide, pas l'historique de la carte.
 */
export function doitMontrerPremiersPas(niveauJoueur: number, dejaVu: boolean): boolean {
  return !dejaVu && niveauJoueur <= 1
}
