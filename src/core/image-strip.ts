// Retire le fond uni (style « polaroïd ») autour d'une illustration en effaçant
// UNIQUEMENT les pixels de fond connectés aux bords, par flood-fill 4-connexe.
//
// Un blanc/gris à l'intérieur de l'illustration (non connecté au bord) est préservé,
// car le flood-fill ne part que des 4 bords. Aucune récursion : on utilise une pile
// explicite, pour tenir des images de 256² et plus sans exploser la stack.

export interface StripImage {
  width: number
  height: number
  // RGBA entrelacé, 4 octets par pixel (comme ImageData.data)
  data: Uint8ClampedArray | number[]
}

export interface StripOptions {
  // Distance euclidienne RGB max (0-441) sous laquelle un pixel est considéré « fond »
  tolerance?: number
}

// Tolérance par défaut : assez large pour absorber un fond gris/blanc légèrement bruité,
// assez serrée pour ne pas manger les aplats clairs de l'illustration.
export const DEFAULT_STRIP_TOLERANCE = 40

// Couleurs de fond échantillonnées : chacun des 4 pixels de coin sert de référence.
// On garde les 4 (au lieu d'une simple moyenne) car un cadre « polaroïd » réel n'est
// pas forcément uni : ici le coin haut-gauche est gris (~202) et les trois autres
// quasi blancs (~254). Une moyenne tomberait entre les deux teintes et n'en effacerait
// aucune correctement ; comparer au coin le PLUS proche gère les fonds bi-tons.
function sampleBackgroundColors(img: StripImage): Array<[number, number, number]> {
  const { width, height, data } = img
  const offsets = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ]
  return offsets.map((c) => [data[c] ?? 0, data[c + 1] ?? 0, data[c + 2] ?? 0])
}

/**
 * Efface (alpha = 0) le fond uni connecté aux bords de l'image.
 * Mute `img.data` sur place ET retourne le même objet.
 */
export function stripBorderBackground(img: StripImage, opts: StripOptions = {}): StripImage {
  const { width, height, data } = img
  const tolerance = opts.tolerance ?? DEFAULT_STRIP_TOLERANCE
  if (width <= 0 || height <= 0) return img

  const bgColors = sampleBackgroundColors(img)
  const tol2 = tolerance * tolerance

  // un pixel est « fond » s'il est déjà transparent, ou proche d'AU MOINS une des
  // couleurs de coin échantillonnées (distance euclidienne RGB <= tolerance)
  const isBg = (px: number): boolean => {
    const i = px * 4
    if ((data[i + 3] ?? 0) === 0) return true
    const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0
    for (const [br, bg, bb] of bgColors) {
      const dr = r - br, dg = g - bg, db = b - bb
      if (dr * dr + dg * dg + db * db <= tol2) return true
    }
    return false
  }

  const visited = new Uint8Array(width * height)
  const stack: number[] = []

  const push = (px: number) => {
    if (visited[px]) return
    visited[px] = 1
    if (isBg(px)) {
      data[px * 4 + 3] = 0 // efface le fond
      stack.push(px)
    }
  }

  // amorce depuis tous les pixels de bord
  for (let x = 0; x < width; x++) {
    push(x) // bord haut
    push((height - 1) * width + x) // bord bas
  }
  for (let y = 0; y < height; y++) {
    push(y * width) // bord gauche
    push(y * width + (width - 1)) // bord droit
  }

  // propagation 4-connexe
  while (stack.length > 0) {
    const px = stack.pop()!
    const x = px % width
    const y = (px - x) / width
    if (x > 0) push(px - 1)
    if (x < width - 1) push(px + 1)
    if (y > 0) push(px - width)
    if (y < height - 1) push(px + width)
  }

  return img
}
