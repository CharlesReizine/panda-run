// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE VIDE DOIT RESSEMBLER À DU VIDE
//
// Retour du user, capture à l'appui, sur un motif de plateformes suspendues : « ce motif j'aime pas, je
// préférais du vrai vide en dessous ». Sur l'image, deux rangées de corniches d'herbe flottent au-dessus
// de… une prairie peinte, une rivière et un château. Le fond illustré du biome se voit intégralement
// sous les plateformes : rien ne dit que tomber tue. Ça ne se lit pas comme un gouffre, ça se lit comme
// des dalles posées n'importe comment sur un joli paysage.
//
// D'où ce voile : sous les surfaces d'un module bâti AU-DESSUS DU VIDE, on assombrit progressivement
// jusqu'au bas du monde. Le fond reste visible en haut (le ciel, l'horizon) et s'enfonce dans le noir en
// descendant — la profondeur se voit, donc le danger se voit.
//
// ⚠️ UN DÉGRADÉ, PAS UN RECTANGLE NOIR. Un aplat opaque effacerait le décor et donnerait un trou plat et
// laid ; c'est la PROGRESSION qui raconte la chute. Phaser ne dégrade pas un rectangle, on empile donc
// quelques bandes d'opacité croissante — même procédé que le fondu déjà utilisé sous les aqueducs.
//
// Ce module ne calcule que des rectangles : la géométrie du voile est ainsi vérifiable sans Phaser
// (tests/core/vide.test.ts).

/** Une bande du voile : rectangle en pixels + opacité. */
export interface BandeDeVide { x: number; y: number; w: number; h: number; alpha: number }

/**
 * Nombre de bandes du dégradé.
 *
 * ⚠️ QUATRE NE SUFFISAIENT PAS, vérifié en capture : sur une colonne de gouffre haute de plusieurs
 * écrans, quatre bandes font des paliers visibles et l'entrée du voile dessine une arête horizontale
 * franche en plein ciel — on voit le truc au lieu de voir un gouffre. Huit lissent le passage sans coûter
 * quoi que ce soit (huit rectangles statiques par trou, masqués par le culling comme le reste du décor).
 */
export const BANDES: number = 8

/** Opacité de la bande la plus BASSE (le fond du gouffre). Pas 1 : on garde un reste de matière. */
export const ALPHA_MAX = 0.82

/** Opacité de la bande la plus HAUTE, juste sous la plateforme. Faible : l'entrée du gouffre est douce. */
export const ALPHA_MIN = 0.05 // l'entrée du gouffre doit être IMPERCEPTIBLE, sinon on voit une arête

/**
 * Bandes du voile pour UN trou, entre `yHaut` (px, juste sous la surface la plus haute qui le surplombe)
 * et `yBas` (px, bas du monde).
 *
 * Renvoie une liste vide si la hauteur est nulle ou négative : un trou sans profondeur n'a pas de gouffre
 * à montrer, et empiler des bandes de hauteur nulle ne ferait que des objets inutiles à masquer.
 */
export function bandesDeVide(xPx: number, wPx: number, yHaut: number, yBas: number): BandeDeVide[] {
  const hauteur = yBas - yHaut
  if (hauteur <= 0 || wPx <= 0) return []
  const out: BandeDeVide[] = []
  const hBande = hauteur / BANDES
  for (let i = 0; i < BANDES; i++) {
    // l'opacité croît vers le bas, du plus clair (entrée) au plus sombre (fond)
    const t = BANDES === 1 ? 1 : i / (BANDES - 1)
    out.push({
      x: xPx,
      y: yHaut + i * hBande,
      w: wPx,
      h: hBande,
      alpha: ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * t,
    })
  }
  return out
}
