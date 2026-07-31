// Dimensions logiques du jeu, calculées UNE FOIS au chargement d'après le format de l'écran.
//
// LE PROBLÈME. Le jeu était figé en 960×540 (16:9). Un iPhone en paysage fait ~2,16:1 : avec
// `Scale.FIT`, Phaser conserve le format et laisse donc d'énormes bandes noires sur les côtés. Ce
// n'est pas un bug, c'est la conséquence mathématique d'un 16:9 sur un écran plus large.
//
// LA SOLUTION, ET POURQUOI ELLE EST FAITE COMME ÇA. On garde la HAUTEUR logique à 540 et on ÉLARGIT
// la largeur logique jusqu'au format réel de l'écran. Le jeu remplit alors tout l'écran sans bande
// et sans rien rogner — pour un jeu à défilement horizontal, la largeur en plus se traduit
// simplement par « on voit un peu plus loin », ce qui est un cadeau.
//
// ⚠️ CE QU'ON NE FAIT SURTOUT PAS : réécrire les coordonnées de l'interface. Il y a 217 littéraux
// `480`/`960` dans src/, et ils ne désignent PAS tous un centre ou une largeur — `skills.ts` a des
// `range: 480` (portée de sort), les entités ont des vitesses. Un remplacement global casserait le
// gameplay sans que rien ne le signale. L'espace de conception reste donc 0→960, et la largeur
// gagnée devient du DÉBORD symétrique de part et d'autre : `centerCamera()` décale la caméra de la
// scène pour que les 960 px de design tombent pile au milieu de l'écran. Une ligne par scène.

const DESIGN_W = 960
export const VIEW_H = 540

// Bornes du débord. En dessous de 16:9 (tablette 4:3) on retombe sur 960 et Phaser letterboxe
// verticalement — mieux que de déformer. Au-dessus de 2,4:1 on arrête d'élargir : au-delà, on
// dévoilerait tant de terrain que la difficulté en serait changée (on verrait venir tous les mobs).
const MIN_W = DESIGN_W
const MAX_W = Math.round(VIEW_H * 2.9) // 1566 — la zone visible d'un iPhone en paysage monte à 2,56:1
                                       // une fois les barres de Safari retirées ; plafonner à 2,6 aurait
                                       // laissé revenir des bandes noires sur ces formats.

function computeWidth(): number {
  if (typeof window === 'undefined') return DESIGN_W // tests (env node) : format de référence

  // ⚠️ ON MESURE LA ZONE RÉELLEMENT DISPONIBLE, PAS LE FORMAT DE L'APPAREIL. C'est la correction d'un
  // défaut visible sur capture d'écran iPhone 12 : le canvas n'occupait que ~69 % de la largeur, avec de
  // grosses bandes noires sur les côtés (« tu m'as réduit la largeur du screen »).
  //
  // La cause est une incohérence entre DEUX formats. La largeur logique était déduite du format de
  // l'ÉCRAN (844 / 390 = 2,16), alors que refit() met le canvas à l'échelle de la zone VISIBLE — plus
  // courte, parce que Safari y prend ses barres (844 / 330 = 2,56). Le facteur d'échelle est donc borné
  // par la hauteur, et il reste de la largeur inutilisée : mathématiquement, (844/1169) > (330/540), donc
  // la largeur n'est jamais le facteur limitant et le canvas ne remplit pas l'écran.
  // En calculant la largeur logique sur la MÊME zone que celle qui sert à la mise à l'échelle, les deux
  // rapports deviennent égaux et le canvas remplit exactement — sans déformation, puisque c'est le format
  // logique qui s'adapte, pas l'image qu'on étire.
  const vv = window.visualViewport
  const dispoW = vv?.width ?? window.innerWidth
  const dispoH = vv?.height ?? window.innerHeight

  // Le jeu est verrouillé en paysage (overlay « tourne ton téléphone » en portrait) : le format utile est
  // toujours celui du paysage, même si la page est chargée téléphone à la verticale — d'où max/min.
  const a = Math.max(dispoW, dispoH)
  const b = Math.min(dispoW, dispoH)
  if (!a || !b) return DESIGN_W
  const w = Math.round(VIEW_H * (a / b))
  return Math.min(MAX_W, Math.max(MIN_W, w))
}

export const VIEW_W = computeWidth()

// Débord total ajouté à la largeur de conception, et sa moitié (le décalage de chaque côté).
export const BLEED = VIEW_W - DESIGN_W
export const BLEED_X = BLEED / 2

// Centre de l'écran dans l'espace de conception : à utiliser pour tout élément qu'on veut vraiment
// centré à l'écran SANS passer par centerCamera (rare — la plupart des scènes utilisent 480).
export const CX = VIEW_W / 2
export const CY = VIEW_H / 2

/**
 * Recentre l'espace de conception 0→960 au milieu de l'écran élargi.
 *
 * Concrètement la caméra est décalée de −BLEED_X : la coordonnée de design 480 se retrouve donc au
 * centre réel de l'écran, et tout le reste de la scène suit sans qu'on touche une seule coordonnée.
 *
 * ⚠️ N'agit PAS sur les objets en `setScrollFactor(0)` (HUD épinglé) : par définition ils ignorent le
 * défilement de caméra. Ceux-là doivent être positionnés explicitement (cf. UIScene).
 */
export function centerCamera(scene: Phaser.Scene): void { // Phaser.Scene = TYPE seul (effacé à la compilation), aucun import requis
  if (BLEED_X === 0) return
  scene.cameras.main.setScroll(-BLEED_X, 0)
}

// ─── BORDS DE L'ÉCRAN DANS L'ESPACE DE CONCEPTION ────────────────────────────────────────────
//
// ⚠️ PIÈGE À COMPRENDRE AVANT DE POSITIONNER QUOI QUE CE SOIT.
// Dans une scène passée par `centerCamera()`, la caméra est décalée de −BLEED_X : une coordonnée de
// conception `x` apparaît donc à l'écran en `x + BLEED_X`. Conséquences contre-intuitives :
//   · le CENTRE de l'écran est la coordonnée 480 (et NON `CX`) ;
//   · `VIEW_W - 16` tombe HORS CADRE (il apparaîtrait à VIEW_W - 16 + BLEED_X) ;
//   · la coordonnée 960 n'est pas le bord droit : elle en reste à BLEED_X près.
// C'est exactement ce qui a rendu l'indicateur de défilement de l'arbre de compétences INVISIBLE.
//
// Utiliser ces bornes pour tout ce qu'on veut coller à un bord dans une scène RECENTRÉE. Dans les
// scènes NON recentrées (LevelScene, TownScene, dont la caméra suit le joueur), les éléments épinglés
// sont en coordonnées ÉCRAN : c'est là que `CX`/`VIEW_W` sont les bons repères.
export const DESIGN_LEFT = 480 - VIEW_W / 2
export const DESIGN_RIGHT = 480 + VIEW_W / 2

/**
 * `x` pixels depuis le BORD GAUCHE RÉEL de l'écran, dans une scène recentrée.
 *
 * ⚠️ À UTILISER POUR TOUT LE HUD COLLÉ À GAUCHE. Écrire `8` place l'objet à 8 px du bord de l'espace
 * de CONCEPTION, qui est centré : sur un écran 2,16:1 il apparaît à ~111 px du bord de l'écran.
 * Retour user : « les stats, la vie et tout, c'est pas tout à gauche de l'écran mais genre milieu
 * gauche, pas ouf ». Un HUD est une surcouche : il se colle à l'ÉCRAN, pas au cadre de dessin.
 */
export const fromLeft = (x: number): number => DESIGN_LEFT + x

/** `x` pixels depuis le BORD DROIT RÉEL de l'écran (même piège que `fromLeft`, en miroir). */
export const fromRight = (x: number): number => DESIGN_RIGHT - x
