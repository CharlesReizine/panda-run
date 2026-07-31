import type { ItemDef, StatBlock } from './types'

// NIVEAU MINIMUM D'UN ÉQUIPEMENT — CALCULÉ DEPUIS SES PERFORMANCES.
//
// Demandes du user, dans l'ordre : « rajoute un niveau min par objet », puis « niveau min par équipement
// SELON LES PERFS ». La deuxième précision change la conception, et pour de bonnes raisons.
//
// ⚠️ LE PALIER N'EST PAS UNE DONNÉE, C'EST UNE CONSÉQUENCE. Premier jet : un `minLevel` écrit à la main
// sur chacun des 61 objets, calé sur la RARETÉ. Deux défauts, tous deux réels dans les données :
//   · la rareté ne dit pas la puissance. Les « Ailes d'Angeling » sont légendaires avec +15 PV, soit
//     MOINS que le plastron de feuilles commun (+4 DÉF +20 PV) : elles exigeaient le niveau 38 pour un
//     bonus de début de partie. À l'inverse le « Chapeau Poring » rare (+5 PV) demandait le niveau 10.
//   · une valeur recopiée à côté des stats DÉRIVE dès qu'on retouche les stats, et rien ne le signale.
// En dérivant le palier des stats, les deux problèmes disparaissent par construction : retoucher un
// bonus ajuste automatiquement le palier, et un objet fort ne peut jamais se porter avant un objet
// faible.

type Bonus = Partial<Pick<StatBlock, 'atk' | 'def' | 'maxHp'>>

// Poids des trois statistiques dans la « puissance » d'un objet.
//
// ATK et DÉF pèsent pareil parce que les dégâts sont SOUSTRACTIFS dans ce jeu (dégât = atk − def) :
// un point de DÉF annule exactement un point d'ATK adverse, ils sont donc de même valeur.
// Les PV pèsent bien moins à l'unité — un objet en donne des dizaines là où il donne quelques points
// d'ATK — et 0,6 place un objet « +20 PV » au même rang qu'un « +3 ATK », ce qui correspond à ce que les
// deux apportent réellement en jeu.
const POIDS = { atk: 4, def: 4, maxHp: 0.6 } as const

/** Puissance d'un objet : combinaison pondérée de ses bonus. Sert d'unique base au palier de niveau. */
export function itemPower(bonus: Bonus): number {
  return (bonus.atk ?? 0) * POIDS.atk + (bonus.def ?? 0) * POIDS.def + (bonus.maxHp ?? 0) * POIDS.maxHp
}

// Paliers de puissance → niveau requis. Une COURBE, pas une droite, et c'est nécessaire aux deux bouts :
//   · en bas, l'épée en bambou (puissance 20) doit se porter au niveau 1-2, sinon on commence à mains
//     nues. Une droite l'aurait mise au niveau 10 ;
//   · en haut, l'écart de puissance entre deux légendaires est faible mais leur rareté est un objectif
//     de fin de partie : les derniers paliers s'espacent donc davantage.
// Le tableau est trié par puissance croissante et lu de haut en bas.
const PALIERS: { jusqua: number; niveau: number }[] = [
  { jusqua: 12, niveau: 1 },
  { jusqua: 20, niveau: 2 },
  { jusqua: 28, niveau: 4 },
  { jusqua: 36, niveau: 7 },
  { jusqua: 44, niveau: 11 },
  { jusqua: 52, niveau: 15 },
  { jusqua: 60, niveau: 19 },
  { jusqua: 70, niveau: 25 },
  { jusqua: 80, niveau: 31 },
  { jusqua: 90, niveau: 38 },
]
const NIVEAU_MAX = 45

/** Niveau requis pour une puissance donnée. Monotone croissante par construction. */
export function minLevelForPower(power: number): number {
  for (const p of PALIERS) if (power <= p.jusqua) return p.niveau
  return NIVEAU_MAX
}

/** Niveau requis pour porter cet objet, déduit de ses bonus. */
export const minLevelOf = (item: Pick<ItemDef, 'bonus'>): number => minLevelForPower(itemPower(item.bonus))

/** Les paliers utilisés, pour l'affichage et les tests. */
export const LEVEL_TIERS = (): number[] => [...PALIERS.map((p) => p.niveau), NIVEAU_MAX]
