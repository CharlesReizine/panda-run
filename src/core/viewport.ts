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
const MAX_W = Math.round(VIEW_H * 2.4) // 1296

function computeWidth(): number {
  if (typeof window === 'undefined') return DESIGN_W // tests (env node) : format de référence
  // On raisonne sur le PLUS GRAND côté / le plus petit : le jeu est verrouillé en paysage (overlay
  // « tourne ton téléphone » en portrait), donc le format utile est toujours celui du paysage, même
  // si la page est chargée téléphone à la verticale.
  const a = Math.max(window.innerWidth, window.innerHeight)
  const b = Math.min(window.innerWidth, window.innerHeight)
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
