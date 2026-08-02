// Calcul PUR de la tension musicale : « à quel point le joueur est-il en danger, là, maintenant ? »
//
// Sortie dans [0, 1], consommée par audio.setTension() qui ouvre ou referme la bande-son.
//
// ⚠️ POURQUOI UN MODULE À PART, ET PURE. Cette valeur pilote une sensation, pas une mécanique : elle
// se règle à l'oreille, donc elle va bouger. La laisser dans LevelScene, c'est la rendre intestable et
// la noyer dans six cents lignes de rendu. Ici, chaque ingrédient est nommé, borné, et vérifiable —
// on peut affirmer « un élite proche pèse plus que trois porings loin » et le prouver.

export interface EtatDanger {
  /** Distance en pixels du monstre NON-élite le plus proche (Infinity si aucun). */
  distMobProche: number
  /** Nombre de monstres à portée d'écran. */
  mobsProches: number
  /** Un élite ou un boss est-il à portée d'écran ? */
  eliteProche: boolean
  /** Points de vie restants, en fraction (0 = mort, 1 = intact). */
  fractionPv: number
  /** Le joueur a-t-il pris un coup dans les dernières secondes ? */
  toucheRecemment: boolean
}

/** Rayon au-delà duquel un monstre ne pèse plus rien : une largeur d'écran. */
export const PORTEE_MENACE = 900

/**
 * Trois sources, volontairement peu nombreuses — une tension qui réagit à tout ne réagit à rien.
 *
 * · LA PROXIMITÉ (jusqu'à 0,45) : un monstre à dix pixels n'est pas un monstre à l'autre bout de
 *   l'écran. Décroissance linéaire jusqu'à PORTEE_MENACE, puis zéro.
 * · LE NOMBRE (jusqu'à 0,2) : trois mobs autour de soi, ce n'est pas trois fois un mob — mais ce n'est
 *   pas non plus la même chose qu'un seul. Plafonné à quatre : au-delà, on est déjà au maximum.
 * · LA VIE (jusqu'à 0,35) : c'est le facteur qui monte quand tout va mal, même sans ennemi visible.
 *   Il ne se déclenche qu'en DESSOUS de la moitié — au-dessus, le joueur va bien et la musique aussi.
 *
 * Un élite ou un boss à l'écran pose un PLANCHER de 0,6 : sa seule présence change la scène, même s'il
 * est loin et qu'on est à pleine vie. Un coup encaissé récemment en pose un de 0,5 : la musique doit
 * rester tendue quelques secondes après l'échange, sinon elle retombe à chaque respiration et clignote.
 */
export function tensionDe(e: EtatDanger): number {
  const proximite = e.distMobProche >= PORTEE_MENACE
    ? 0
    : 0.45 * (1 - e.distMobProche / PORTEE_MENACE)
  const nombre = 0.2 * Math.min(1, Math.max(0, e.mobsProches - 1) / 3)
  const vie = e.fractionPv >= 0.5 ? 0 : 0.35 * (1 - e.fractionPv / 0.5)
  const somme = proximite + nombre + vie
  // ⚠️ LA VIE BASSE POSE UN PLANCHER, elle ne se contente pas d'ajouter. En simple addition, un joueur à
  // 15 % de vie SANS ennemi visible obtenait 0,24 — une musique paisible pendant qu'il cherche
  // désespérément une potion. C'est le moment le plus tendu du jeu ; il ne dépend pas de ce qu'on voit
  // à l'écran. Sous un quart de vie, la bande-son reste tendue quoi qu'il arrive.
  const plancher = Math.max(
    e.eliteProche ? 0.6 : 0,
    e.toucheRecemment ? 0.5 : 0,
    e.fractionPv < 0.25 ? 0.55 : 0,
  )
  return Math.max(0, Math.min(1, Math.max(somme, plancher)))
}

/**
 * Lissage : la tension MONTE vite et REDESCEND lentement.
 *
 * ⚠️ L'ASYMÉTRIE EST LE CŒUR DU RÉGLAGE, pas un détail. Avec une constante unique, la musique
 * clignote — un mob passe derrière un rocher, elle retombe ; il ressort, elle remonte. Une menace
 * s'installe d'un coup et se dissipe lentement : c'est vrai dans la réalité et c'est ce qu'on attend
 * d'une bande-son. Montée en ~0,4 s, descente en ~3 s.
 */
export function lisser(actuelle: number, cible: number, deltaMs: number): number {
  const tau = cible > actuelle ? 400 : 3000
  const k = 1 - Math.exp(-deltaMs / tau)
  return actuelle + (cible - actuelle) * k
}
