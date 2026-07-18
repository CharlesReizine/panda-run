import { describe, it, expect } from 'vitest'
import { stripBorderBackground, DEFAULT_STRIP_TOLERANCE } from '../../src/core/image-strip'

type RGBA = [number, number, number, number]

// petite image RGBA remplie d'une couleur uniforme
function makeImage(width: number, height: number, fill: RGBA) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = fill[3]
  }
  return { width, height, data }
}

function setPixel(img: { width: number; data: Uint8ClampedArray }, x: number, y: number, c: RGBA) {
  const i = (y * img.width + x) * 4
  img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3]
}

function alphaAt(img: { width: number; data: Uint8ClampedArray }, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!
}
function rgbaAt(img: { width: number; data: Uint8ClampedArray }, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!]
}

const GRAY: RGBA = [128, 128, 128, 255]
const RED: RGBA = [220, 30, 30, 255]

describe('stripBorderBackground', () => {
  it('exporte une tolérance par défaut raisonnable', () => {
    expect(DEFAULT_STRIP_TOLERANCE).toBeGreaterThan(0)
  })

  it('efface le fond gris des bords et préserve le carré coloré au centre', () => {
    const img = makeImage(16, 16, GRAY)
    // carré rouge au centre (6..9)
    for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) setPixel(img, x, y, RED)

    const out = stripBorderBackground(img)
    expect(out).toBe(img) // mute sur place et retourne le même objet

    // les 4 coins deviennent transparents
    expect(alphaAt(img, 0, 0)).toBe(0)
    expect(alphaAt(img, 15, 0)).toBe(0)
    expect(alphaAt(img, 0, 15)).toBe(0)
    expect(alphaAt(img, 15, 15)).toBe(0)

    // le pixel central est intact (couleur + alpha)
    expect(rgbaAt(img, 8, 8)).toEqual(RED)
  })

  it('laisse intacte une image dont le fond est déjà transparent', () => {
    const img = makeImage(12, 12, [0, 0, 0, 0]) // tout transparent
    for (let y = 4; y <= 7; y++) for (let x = 4; x <= 7; x++) setPixel(img, x, y, RED)

    stripBorderBackground(img)

    expect(alphaAt(img, 0, 0)).toBe(0)
    expect(rgbaAt(img, 5, 5)).toEqual(RED) // centre intact, pas de crash
  })

  it('préserve un pixel de la couleur de fond enfermé au centre (non connecté au bord)', () => {
    const img = makeImage(9, 9, GRAY)
    // bloc d'illustration 3x3 (3..5) qui encercle le pixel central
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) setPixel(img, x, y, RED)
    // on remet le centre exact (4,4) à la couleur de fond → gris enfermé
    setPixel(img, 4, 4, GRAY)

    stripBorderBackground(img)

    // bords effacés
    expect(alphaAt(img, 0, 0)).toBe(0)
    // gris enfermé PRÉSERVÉ (non atteint par le flood-fill depuis les bords)
    expect(alphaAt(img, 4, 4)).toBe(255)
    expect(rgbaAt(img, 4, 4)).toEqual(GRAY)
    // l'anneau d'illustration reste opaque
    expect(alphaAt(img, 3, 3)).toBe(255)
  })

  it('efface une nuance de fond sous la tolérance mais garde une couleur franche', () => {
    // ligne : gris, nuance proche, couleur franche, gris, gris
    const img = makeImage(5, 1, GRAY)
    setPixel(img, 1, 0, [148, 128, 128, 255]) // distance 20 < 40 → fond
    setPixel(img, 2, 0, [255, 0, 0, 255]) // distance franche > 40 → illustration

    stripBorderBackground(img) // tolérance par défaut = 40

    expect(alphaAt(img, 0, 0)).toBe(0) // gris de bord
    expect(alphaAt(img, 1, 0)).toBe(0) // nuance sous tolérance : effacée
    expect(alphaAt(img, 2, 0)).toBe(255) // couleur franche : gardée
  })

  it('respecte une tolérance personnalisée', () => {
    const img = makeImage(3, 1, GRAY)
    setPixel(img, 1, 0, [158, 128, 128, 255]) // distance 30

    stripBorderBackground(img, { tolerance: 10 }) // 30 > 10 → gardé
    expect(alphaAt(img, 1, 0)).toBe(255)
  })
})
