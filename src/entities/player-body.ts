// Dimensions de la texture du panda et de sa boîte de collision.
// La texture a de la marge (place pour la coiffe au-dessus, ombrage) : la hitbox NE doit
// PAS être la texture entière, sinon le perso s'enfonce dans le sol, se coince et n'est
// plus aligné avec les monstres. Ces valeurs sont vérifiées par player-body.test.ts.

// Le cadre est plus LARGE que le corps du panda : les poses de course/saut/attaque écartent
// bras et jambes bien au-delà de la silhouette au repos. On met à l'échelle chaque pose par sa
// HAUTEUR uniquement (taille constante à l'écran, plus de « rapetissement » quand une pose large
// serait rabotée en largeur) — le cadre doit donc accueillir la pose la plus large sans rogner.
export const PANDA_TEX = { w: 96, h: 92 }

// hitbox centrée horizontalement, pieds collés au bas visible du sprite (~y86). Sa largeur ne
// couvre que le tronc (les membres écartés débordent hors hitbox, comme au repos) ; elle reste
// centrée dans le cadre élargi : offsetX*2 + w === PANDA_TEX.w.
export const PANDA_BODY = { w: 34, h: 62, offsetX: 31, offsetY: 24 }

// Ancre de tête par texture de pose (offset depuis le CENTRE du sprite), remplie au bake des
// poses dans PreloadScene. La tête n'est pas placée à la même hauteur d'une illustration à
// l'autre (idle vs course vs saut vs attaque vs échelle) : un offset fixe ferait « sauter » le
// chapeau d'une frame à l'autre. On colle donc le chapeau sur la vraie tête de CHAQUE pose.
export const PANDA_HEAD_ANCHORS: Record<string, { dx: number; dy: number }> = {}

// Vrai si la hitbox est centrée et si ses pieds touchent le bas visible du sprite
// (tolérance 8px). Garde l'alignement au sol si la texture change un jour.
export function bodyIsGrounded(tex: { w: number; h: number }, body: { w: number; h: number; offsetX: number; offsetY: number }): boolean {
  const centered = body.offsetX * 2 + body.w === tex.w
  const feetGap = tex.h - (body.offsetY + body.h)
  return centered && feetGap >= 0 && feetGap <= 8
}
