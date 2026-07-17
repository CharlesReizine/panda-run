import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'

const TILE_COLORS: Record<string, number> = {
  'tile-plaine': 0x4caf50,
  'tile-foret': 0x2e7d32,
  'tile-desert': 0xe0c068,
  'tile-cave': 0x616161,
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  create() {
    const g = this.add.graphics()

    // Panda placeholder : corps blanc, oreilles/pattes noires (mignon plus tard)
    g.fillStyle(0x000000).fillCircle(8, 6, 6).fillCircle(24, 6, 6)
    g.fillStyle(0xffffff).fillCircle(16, 14, 12)
    g.fillStyle(0x000000).fillCircle(11, 12, 3).fillCircle(21, 12, 3)
    g.fillStyle(0xffffff).fillRect(6, 22, 20, 14)
    g.fillStyle(0x000000).fillRect(6, 32, 6, 8).fillRect(20, 32, 6, 8)
    g.generateTexture('panda', 32, 40)
    g.clear()

    // Tuiles par biome
    for (const [key, color] of Object.entries(TILE_COLORS)) {
      g.fillStyle(color).fillRect(0, 0, 32, 32)
      g.lineStyle(1, 0x000000, 0.2).strokeRect(0, 0, 32, 32)
      g.generateTexture(key, 32, 32)
      g.clear()
    }

    // Monstres : blob coloré avec yeux (64px pour les boss)
    for (const m of Object.values(MONSTERS)) {
      const s = m.boss ? 64 : 32
      const r = s / 2
      g.fillStyle(m.color).fillCircle(r, r + 2, r - 2)
      g.fillStyle(0x000000).fillCircle(r - r / 3, r - 2, 2).fillCircle(r + r / 3, r - 2, 2)
      g.generateTexture(`monster-${m.id}`, s, s)
      g.clear()
    }

    // Divers
    g.fillStyle(0xffee58).fillCircle(6, 6, 6); g.generateTexture('projectile', 12, 12); g.clear()
    g.fillStyle(0x8d6e63).fillRect(0, 0, 32, 48)
    g.fillStyle(0xffd54f).fillCircle(26, 24, 3); g.generateTexture('exit', 32, 48); g.clear()
    g.fillStyle(0xef5350).fillRoundedRect(0, 4, 16, 12, 4)
    g.fillStyle(0xffffff).fillRect(6, 0, 4, 6); g.generateTexture('potion-drop', 16, 16); g.clear()
    g.fillStyle(0xffd700).fillCircle(6, 6, 6); g.generateTexture('coin', 12, 12); g.clear()
    g.fillStyle(0xba68c8).fillRect(2, 2, 12, 12); g.generateTexture('item-drop', 16, 16); g.clear()

    g.destroy()
    this.scene.start('Title')
  }
}
