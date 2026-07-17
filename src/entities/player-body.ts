// Dimensions de la texture du panda et de sa boîte de collision.
// La texture a de la marge (place pour la coiffe au-dessus, ombrage) : la hitbox NE doit
// PAS être la texture entière, sinon le perso s'enfonce dans le sol, se coince et n'est
// plus aligné avec les monstres. Ces valeurs sont vérifiées par player-body.test.ts.

export const PANDA_TEX = { w: 64, h: 92 }

// hitbox centrée horizontalement, pieds collés au bas visible du sprite (~y86)
export const PANDA_BODY = { w: 34, h: 62, offsetX: 15, offsetY: 24 }

// Vrai si la hitbox est centrée et si ses pieds touchent le bas visible du sprite
// (tolérance 8px). Garde l'alignement au sol si la texture change un jour.
export function bodyIsGrounded(tex: { w: number; h: number }, body: { w: number; h: number; offsetX: number; offsetY: number }): boolean {
  const centered = body.offsetX * 2 + body.w === tex.w
  const feetGap = tex.h - (body.offsetY + body.h)
  return centered && feetGap >= 0 && feetGap <= 8
}
