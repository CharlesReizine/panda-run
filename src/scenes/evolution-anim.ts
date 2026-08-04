// ══════════════════════════════════════════════════════════════════════════════════════════════
// ANIMATION D'ÉVOLUTION DE CLASSE — la grammaire Pokémon, en pur calcul
//
// Demande du joueur, affinée en deux temps. D'abord : « une animation en cas de changement de classe.
// genre cheap retro, on voit l'image de la classe actuelle qui bouge un peu et ça clignote de lumière, la
// lumière augmente augmente jusqu'à ce qu'on ne voit plus que du blanc, puis ça baisse et on voit la
// nouvelle classe. je veux comme pokémon, quand ça évolue. » Puis, plus précis : « juste l'image de base
// du truc debout et on fait un peu onduler +15 -15 degrés pas trop vite, et clignoter, c'est parfait. »
//
// C'est donc une ONDULATION (rotation de faible amplitude), pas une vibration en tous sens : l'image debout se balance
// lentement pendant que la lumière monte. Avant, le passage de classe était un flash blanc de 300 ms — le
// moment le plus marquant de la progression n'avait aucune mise en scène.
//
// POURQUOI CE FICHIER EST PUR. La séquence est du TEMPS, et le temps est ce qu'on rate le plus facilement :
// une phase qui commence avant la fin de la précédente, un clignotement qui accélère à l'envers, un voile
// blanc qui n'atteint jamais l'opacité 1 (donc on aperçoit la nouvelle classe avant la révélation). Aucun
// de ces défauts ne se voit en relisant du code de tween ; tous se voient en une ligne de test. La scène
// ne fait donc qu'OBÉIR à ce qui est décrit ici.
//
// Les quatre temps, dans l'ordre — la grammaire de l'évolution Pokémon :
//   1. ONDULATION   l'image debout se balance (±ANGLE_MAX), la lumière commence à battre ;
//   2. ALTERNANCE   elle clignote entre ANCIENNE et NOUVELLE forme, de plus en plus vite, lumière montante ;
//   3. BLANC        plus rien que du blanc — c'est là que la bascule est invisible, donc crédible ;
//   4. RÉVÉLATION   la lumière retombe sur la nouvelle classe, qui se pose à l'échelle.
// ══════════════════════════════════════════════════════════════════════════════════════════════

export interface Phase {
  nom: 'ondulation' | 'alternance' | 'blanc' | 'revelation'
  debut: number // ms depuis le début de la séquence
  duree: number // ms
}

// Durées réglées à l'oreille de la référence : ~1,1 s de balancement (« pas trop vite »), ~1,5 s de
// clignotement accéléré, un blanc COURT (au-delà, on croit à un bug d'affichage), et une révélation qui
// laisse le temps de voir la nouvelle classe avant de quitter l'écran.
export const PHASES: Phase[] = [
  { nom: 'ondulation', debut: 0, duree: 1100 },
  { nom: 'alternance', debut: 1100, duree: 1500 },
  { nom: 'blanc', debut: 2600, duree: 320 },
  { nom: 'revelation', debut: 2920, duree: 900 },
]

export const DUREE_TOTALE = PHASES[PHASES.length - 1]!.debut + PHASES[PHASES.length - 1]!.duree

export const phaseA = (nom: Phase['nom']): Phase => PHASES.find((p) => p.nom === nom)!

/**
 * Amplitude de l'ondulation, en degrés.
 * ⚠️ 7° ET NON 15°, ET C'EST LIÉ À LA TAILLE DU SUJET. Le joueur avait d'abord demandé « ±15 degrés »,
 * puis, le panda passé au triple : « angle de rotation plus faible aussi ». C'est cohérent — une même
 * amplitude angulaire déplace trois fois plus de pixels sur une image trois fois plus grande, et le
 * balancement devenait un essuie-glace. L'amplitude RESSENTIE est ce qu'on règle, pas le nombre.
 */
export const ANGLE_MAX = 7
/** Période d'un aller-retour complet, en ms. « pas trop vite » → un balancement lisible à l'œil. */
export const PERIODE_ONDULATION = 900

/**
 * Angle de l'image à l'instant `t` de la séquence (ms), en degrés. Sinusoïde : le balancement n'a ni
 * à-coup ni arrêt sec aux extrêmes — c'est ce qui distingue une ondulation d'une vibration.
 * L'ondulation CONTINUE pendant l'alternance : arrêter net le balancement au changement de phase se
 * verrait comme un bug.
 */
export function angleOndulation(t: number): number {
  const fin = phaseA('alternance').debut + phaseA('alternance').duree
  if (t < 0 || t > fin) return 0 // avant le début et après la bascule, l'image est droite
  return ANGLE_MAX * Math.sin((2 * Math.PI * t) / PERIODE_ONDULATION)
}

/**
 * Intensité du CLIGNOTEMENT posé sur l'image (0 → 1), à l'instant `t`. Elle bat, et son enveloppe CROÎT :
 * la lumière « augmente augmente » comme demandé. Distincte du voile plein écran : ici on éclaire le
 * sujet, là on noie l'écran.
 */
export function clignotement(t: number): number {
  const fin = phaseA('alternance').debut + phaseA('alternance').duree
  if (t < 0 || t > fin) return 0
  const enveloppe = Math.min(1, t / fin) // monte tout du long
  const battement = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 220) // clignote vite, lui
  return enveloppe * battement
}

/**
 * Durée d'un battement d'alternance, à l'avancement `a` (0 → 1) de la phase. Elle DÉCROÎT — c'est
 * l'accélération qui fait tout l'effet : on comprend que quelque chose se déclenche sans qu'on le dise.
 */
export const battementAlternance = (a: number): number =>
  Math.round(220 - 150 * Math.min(1, Math.max(0, a)))

/**
 * Opacité du voile blanc plein écran à l'instant `t`. Monte pendant l'alternance, SATURE À 1 sur le blanc,
 * redescend à 0 sur la révélation. Le plateau à 1 est essentiel : c'est lui qui cache la bascule d'une
 * forme à l'autre, donc qui rend l'évolution crédible.
 */
export function voileBlanc(t: number): number {
  const alt = phaseA('alternance'), blanc = phaseA('blanc'), rev = phaseA('revelation')
  if (t < alt.debut) return 0
  if (t < alt.debut + alt.duree) return 0.9 * ((t - alt.debut) / alt.duree)
  if (t < blanc.debut + blanc.duree) return 1
  if (t < rev.debut + rev.duree) return 1 - (t - rev.debut) / rev.duree
  return 0
}

/**
 * Intensité du FOND DE RAYONS (0 → 1). Enveloppe LISSE, sans battement : le fond enfle, il ne stroboscope
 * pas. Deux lumières qui clignotent à la même cadence donnent une image illisible — le sujet clignote, le
 * fond gonfle.
 */
export function intensiteRayons(t: number): number {
  const fin = phaseA('alternance').debut + phaseA('alternance').duree
  if (t <= 0) return 0
  if (t >= fin) return 1
  return Math.pow(t / fin, 1.4) // lent d'abord, puis ça vient vite
}

/**
 * Rotation cumulée du fond de rayons, en radians, à l'instant `t`. Elle ACCÉLÈRE : c'est ce qui donne
 * l'impression que la chose se déclenche. On la calcule en absolu (et non en incréments par frame) pour
 * que la séquence soit identique quel que soit le taux de rafraîchissement.
 */
export function rotationRayons(t: number): number {
  return 0.55 * Math.pow(Math.max(0, t) / 1000, 1.7)
}

/** À cet instant, montre-t-on la NOUVELLE forme ? (l'alternance bascule à chaque battement) */
export function montreNouvelleForme(t: number): boolean {
  const alt = phaseA('alternance')
  if (t < alt.debut) return false             // ondulation : encore l'ancienne
  if (t >= alt.debut + alt.duree) return true // blanc puis révélation : la nouvelle
  let curseur = alt.debut
  let compte = 0
  while (curseur < t) {
    curseur += battementAlternance((curseur - alt.debut) / alt.duree)
    compte++
  }
  return compte % 2 === 1
}
