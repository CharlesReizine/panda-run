// Courbes PURES de l'ambiance sonore des murs de flammes (le déclenchement est dans LevelScene).
//
// Demande du user : « même quand y a des petits murs de flamme tu peux mettre un petit bruit de fond
// flamme, ça me choquerait pas ».
//
// ⚠️ DEUX GRANDEURS VARIENT AVEC LA DISTANCE, PAS UNE. Le volume seul ne suffit pas : un crépitement
// qui se répète à cadence fixe sonne comme un métronome dès qu'on s'attarde à côté du feu. Un feu
// proche crépite SOUVENT et FORT, un feu lointain rarement et faiblement — c'est la combinaison des deux
// qui donne l'impression d'un foyer et non d'un effet déclenché.
//
// Isolé ici parce que ces deux courbes ont des propriétés qu'on veut tester sans audio ni rendu : elles
// sont monotones, bornées, et muettes au-delà de la portée (sinon un terrain truffé de flammes
// crépiterait en permanence d'un bout à l'autre de la carte).

/** Au-delà de cette distance en pixels, une flamme ne s'entend plus du tout. */
export const FLAMME_PORTEE = 420

/** En dessous de cette distance, on est « dans » le foyer : volume et cadence au maximum. */
const PROCHE = 90

const GAIN_MIN = 0.12
const GAIN_MAX = 0.5
const INTERVALLE_MIN = 260 // ms, au plus près
const INTERVALLE_MAX = 900 // ms, à la limite d'audibilité

/** Part de proximité, de 1 (collé au feu) à 0 (hors de portée). */
function proximite(dist: number): number {
  if (dist <= PROCHE) return 1
  if (dist >= FLAMME_PORTEE) return 0
  return 1 - (dist - PROCHE) / (FLAMME_PORTEE - PROCHE)
}

/** Volume du crépitement à cette distance. 0 = inaudible, on ne joue rien. */
export function flammeGain(dist: number): number {
  const p = proximite(dist)
  return p === 0 ? 0 : GAIN_MIN + (GAIN_MAX - GAIN_MIN) * p
}

/** Délai avant le prochain crépitement : court près du feu, long au loin. */
export function flammeIntervalle(dist: number): number {
  const p = proximite(dist)
  return Math.round(INTERVALLE_MAX - (INTERVALLE_MAX - INTERVALLE_MIN) * p)
}

/** Une flamme à cette distance s'entend-elle ? */
export const flammeAudible = (dist: number): boolean => dist < FLAMME_PORTEE
