import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'

// Palette du panda (pixel-art). '.' = transparent.
const PANDA_PALETTE: Record<string, number> = {
  o: 0x2b2b2b, // contour / fourrure noire
  W: 0xf7f7f7, // blanc
  p: 0xff9ab0, // joues
  e: 0xffffff, // reflet des yeux
  n: 0x555555, // museau
}

// 16 colonnes de large. Panda chibi de face.
const PANDA = [
  '...ooo..ooo.....',
  '...ooo..ooo.....',
  '..oooooooooooo..',
  '.oWWWWWWWWWWWWo.',
  '.oWWooWWWWooWWo.',
  '.oWWoeWWWWeoWWo.',
  '.oWWooWWWWooWWo.',
  '.oWWWWWnnWWWWWo.',
  '.opWWWWWWWWWWpo.',
  '..oWWWWWWWWWWo..',
  '...oWWWWWWWWo...',
  '..oWWWWWWWWWWo..',
  '..oWWWWWWWWWWo..',
  '..oWWWWWWWWWWo..',
  '..ooWWWWWWWWoo..',
  '....oo..oo......',
]

const TILE_PALETTES: Record<string, { soil: number; top: number; speck: number }> = {
  'tile-plaine': { soil: 0x6b4a2f, top: 0x5cb85c, speck: 0x4a9d4a },
  'tile-foret': { soil: 0x4a3320, top: 0x2e7d32, speck: 0x256528 },
  'tile-desert': { soil: 0xcaa85a, top: 0xe0c068, speck: 0xd4b46a },
  'tile-cave': { soil: 0x3f3f3f, top: 0x616161, speck: 0x525252 },
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  // dessine une grille de pixels (rows de même longueur) en texture
  private pixelArt(key: string, rows: string[], palette: Record<string, number>, px: number) {
    const g = this.add.graphics()
    const w = rows[0]!.length
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]!
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]!]
        if (color === undefined) continue
        g.fillStyle(color).fillRect(x * px, y * px, px, px)
      }
    }
    g.generateTexture(key, w * px, rows.length * px)
    g.destroy()
  }

  create() {
    // Panda en pixel-art (16×16 grille, ×2 → 32×32)
    this.pixelArt('panda', PANDA, PANDA_PALETTE, 2)

    // Tuiles par biome : terre + bande d'herbe/sable en haut + petits reliefs
    for (const [key, pal] of Object.entries(TILE_PALETTES)) {
      const g = this.add.graphics()
      g.fillStyle(pal.soil).fillRect(0, 0, 32, 32)
      g.fillStyle(pal.top).fillRect(0, 0, 32, 9)
      g.fillStyle(pal.speck).fillRect(4, 3, 3, 3).fillRect(20, 5, 3, 3).fillRect(13, 2, 2, 2)
      g.fillStyle(0x000000, 0.18).fillRect(0, 0, 32, 1).fillRect(0, 0, 1, 32)
      g.generateTexture(key, 32, 32)
      g.destroy()
    }

    // Monstres : blob contouré, yeux + bouche, couronne pour les boss
    for (const m of Object.values(MONSTERS)) {
      const s = m.boss ? 64 : 32
      const r = s / 2
      const g = this.add.graphics()
      g.fillStyle(0x222222).fillCircle(r, r + 2, r - 1)      // contour
      g.fillStyle(m.color).fillCircle(r, r + 2, r - 3)       // corps
      g.fillStyle(0xffffff, 0.25).fillCircle(r - r / 3, r - r / 4, r / 5) // reflet
      const eye = Math.max(2, r / 6)
      g.fillStyle(0xffffff).fillCircle(r - r / 3, r - 1, eye).fillCircle(r + r / 3, r - 1, eye)
      g.fillStyle(0x000000).fillCircle(r - r / 3, r - 1, eye / 2).fillCircle(r + r / 3, r - 1, eye / 2)
      g.fillStyle(0x000000, 0.6).fillRect(r - r / 4, r + r / 3, r / 2, Math.max(1, r / 12)) // bouche
      if (m.boss) {
        g.fillStyle(0xffd54f).fillTriangle(r - 12, 6, r - 6, 14, r, 6).fillTriangle(r, 6, r + 6, 14, r + 12, 6)
        g.fillRect(r - 12, 12, 24, 4)
      }
      g.generateTexture(`monster-${m.id}`, s, s + 4)
      g.destroy()
    }

    const g = this.add.graphics()
    // Divers
    g.fillStyle(0xffee58).fillCircle(6, 6, 6); g.fillStyle(0xfff59d).fillCircle(4, 4, 2); g.generateTexture('projectile', 12, 12); g.clear()
    g.fillStyle(0x5d4037).fillRect(0, 0, 32, 48)
    g.fillStyle(0x8d6e63).fillRect(2, 2, 28, 44)
    g.fillStyle(0xffd54f).fillCircle(26, 24, 3); g.generateTexture('exit', 32, 48); g.clear()
    g.fillStyle(0xb71c1c).fillRoundedRect(0, 4, 16, 12, 4)
    g.fillStyle(0xef5350).fillRoundedRect(1, 5, 14, 8, 3)
    g.fillStyle(0xffffff).fillRect(6, 0, 4, 6); g.generateTexture('potion-drop', 16, 16); g.clear()
    g.fillStyle(0xb8860b).fillCircle(6, 6, 6); g.fillStyle(0xffd700).fillCircle(6, 6, 5); g.fillStyle(0xfff59d).fillCircle(4, 4, 1); g.generateTexture('coin', 12, 12); g.clear()
    g.fillStyle(0x7b1fa2).fillRect(1, 1, 14, 14); g.fillStyle(0xba68c8).fillRect(2, 2, 12, 12); g.generateTexture('item-drop', 16, 16); g.clear()

    // Props destructibles
    g.fillStyle(0x33691e).fillEllipse(12, 13, 22, 16)
    g.fillStyle(0x7cb342).fillEllipse(12, 11, 20, 13)
    g.fillStyle(0x9ccc65).fillRect(6, 6, 2, 6).fillRect(11, 4, 2, 8).fillRect(16, 6, 2, 6); g.generateTexture('prop-herbe', 24, 20); g.clear()
    g.fillStyle(0xf5f5dc).fillRect(9, 10, 6, 14)
    g.fillStyle(0xb71c1c).fillEllipse(12, 9, 22, 15)
    g.fillStyle(0xef5350).fillEllipse(12, 8, 20, 12)
    g.fillStyle(0xffffff).fillCircle(6, 6, 2).fillCircle(18, 6, 2).fillCircle(12, 10, 2); g.generateTexture('prop-champignon', 24, 24); g.clear()
    const rockPts = [[14, 0], [26, 6], [28, 18], [18, 24], [6, 22], [0, 10]].map(([x, y]) => new Phaser.Math.Vector2(x, y))
    g.fillStyle(0x616161).fillPoints(rockPts, true)
    g.fillStyle(0x9e9e9e).fillEllipse(13, 11, 14, 8); g.generateTexture('prop-roche', 28, 24); g.clear()
    g.fillStyle(0x4e342e).fillRect(0, 0, 30, 24)
    g.fillStyle(0x795548).fillRect(1, 1, 28, 22)
    g.fillStyle(0xffd54f).fillRect(0, 9, 30, 6)
    g.fillStyle(0xfff176).fillRect(13, 8, 4, 8); g.generateTexture('prop-coffre', 30, 24); g.clear()
    const diamondPts = [[7, 0], [14, 7], [7, 14], [0, 7]].map(([x, y]) => new Phaser.Math.Vector2(x, y))
    g.fillStyle(0xffffff).fillPoints(diamondPts, true)
    g.generateTexture('material-drop', 14, 14); g.clear()

    // Fonds de parallaxe : bandes de collines (teintées par biome à l'usage)
    g.fillStyle(0xffffff).fillEllipse(120, 120, 260, 180); g.generateTexture('hill', 240, 130); g.clear()
    g.fillStyle(0xffffff).fillCircle(20, 20, 18).fillCircle(44, 22, 22).fillCircle(70, 20, 16); g.generateTexture('cloud', 90, 40); g.clear()

    g.destroy()
    this.scene.start('Title')
  }
}
