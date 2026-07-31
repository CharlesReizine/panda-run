// Bornes VERTICALES RÉELLES de chaque créature dans sa texture bakée, mesurées au chargement.
//
// LE BUG QUE ÇA CORRIGE : « le poring vole, les lapins volent aussi un peu ». La hitbox d'un ennemi
// était dérivée de la HAUTEUR DE LA TEXTURE (`this.height - 8` dans Enemy) et non des pixels
// réellement opaques. Or les illustrations ont été générées avec des marges transparentes VARIABLES :
// un mob dont l'art a beaucoup de vide sous lui se retrouvait avec un bas de hitbox bien plus bas que
// ses pieds, donc à corps posé au sol, la créature flottait — d'une hauteur différente selon le mob,
// ce qui explique qu'on en voie « certains » voler et pas tous.
//
// On mesure donc l'alpha une fois au bake (PreloadScene.artMonster) et on en déduit une hitbox collée
// à la créature. Même approche que PANDA_HEAD_ANCHORS, qui mesure déjà la tête de chaque pose.
//
// Fractions rapportées à la HAUTEUR de la texture bakée : 0 = tout en haut, 1 = tout en bas.
export interface MonsterBounds {
  top: number
  bottom: number
}

export const MONSTER_BOUNDS: Record<string, MonsterBounds> = {}

/**
 * Bornes opaques d'une image, en fractions de sa hauteur. `null` si la mesure est impossible
 * (canvas indisponible, image cross-origin non lisible) ou si l'image est entièrement transparente —
 * l'appelant retombe alors sur l'ancien comportement plutôt que de poser une hitbox absurde.
 *
 * `alphaMin` écarte les pixels quasi transparents : les illustrations générées ont souvent un halo
 * d'antialiasing très faible qui, compté comme opaque, ferait retrouver la marge entière.
 */
export function measureOpaqueBounds(
  src: HTMLImageElement | HTMLCanvasElement,
  alphaMin = 24,
): MonsterBounds | null {
  const w = src.width, h = src.height
  if (!w || !h) return null
  let cv: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D | null
  try {
    cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(src, 0, 0)
  } catch {
    return null
  }
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return null // canvas « tainted » : on ne devine pas
  }
  let top = -1, bottom = -1
  for (let y = 0; y < h; y++) {
    let opaque = false
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3]! >= alphaMin) { opaque = true; break }
    }
    if (opaque) {
      if (top < 0) top = y
      bottom = y
    }
  }
  if (top < 0) return null // image entièrement transparente
  return { top: top / h, bottom: (bottom + 1) / h }
}
