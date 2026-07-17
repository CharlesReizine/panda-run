import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'

const TILE_PALETTES: Record<string, { soil: number; top: number; speck: number }> = {
  'tile-plaine': { soil: 0x6b4a2f, top: 0x5cb85c, speck: 0x4a9d4a },
  'tile-foret': { soil: 0x4a3320, top: 0x2e7d32, speck: 0x256528 },
  'tile-desert': { soil: 0xcaa85a, top: 0xe0c068, speck: 0xd4b46a },
  'tile-cave': { soil: 0x3f3f3f, top: 0x616161, speck: 0x525252 },
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  // Une frame du panda. bx/by décalent le corps+tête ; lf/rf les pieds ; la/ra les bras.
  // paw = patte avant tendue (attaque). Toutes les frames font 64×80 → même ancrage.
  private pandaFrame(key: string, o: {
    bx?: number; by?: number
    lf?: [number, number]; rf?: [number, number]
    la?: [number, number]; ra?: [number, number]
    paw?: boolean
  }) {
    const g = this.add.graphics()
    const W = 0xf7f7f7, K = 0x2b2b2b, PINK = 0xff9ab0, DARK = 0x3a2f2f
    const bx = o.bx ?? 0, by = o.by ?? 0
    const [lfx, lfy] = o.lf ?? [0, 0], [rfx, rfy] = o.rf ?? [0, 0]
    const [lax, lay] = o.la ?? [0, 0], [rax, ray] = o.ra ?? [0, 0]
    // pieds
    g.fillStyle(K).fillEllipse(24 + lfx, 72 + lfy, 15, 11).fillEllipse(40 + rfx, 72 + rfy, 15, 11)
    // corps
    g.fillStyle(K).fillEllipse(32 + bx, 54 + by, 46, 40)
    g.fillStyle(W).fillEllipse(32 + bx, 53 + by, 40, 33)
    g.fillStyle(0xe4e4e4).fillEllipse(32 + bx, 61 + by, 26, 14)
    // bras
    g.fillStyle(K).fillEllipse(12 + bx + lax, 50 + by + lay, 13, 22).fillEllipse(52 + bx + rax, 50 + by + ray, 13, 22)
    if (o.paw) g.fillStyle(K).fillCircle(57 + rax, 46 + ray, 7)
    // oreilles + tête
    g.fillStyle(K).fillCircle(15 + bx, 9 + by, 9).fillCircle(49 + bx, 9 + by, 9)
    g.fillStyle(K).fillCircle(32 + bx, 25 + by, 23)
    g.fillStyle(W).fillCircle(32 + bx, 25 + by, 20)
    g.fillStyle(K).fillEllipse(24 + bx, 25 + by, 13, 17).fillEllipse(40 + bx, 25 + by, 13, 17)
    g.fillStyle(0xffffff).fillCircle(24 + bx, 26 + by, 5).fillCircle(40 + bx, 26 + by, 5)
    g.fillStyle(0x222222).fillCircle(25 + bx, 27 + by, 3).fillCircle(41 + bx, 27 + by, 3)
    g.fillStyle(0xffffff).fillCircle(23 + bx, 25 + by, 1.5).fillCircle(39 + bx, 25 + by, 1.5)
    g.fillStyle(PINK, 0.7).fillCircle(16 + bx, 32 + by, 4).fillCircle(48 + bx, 32 + by, 4)
    g.fillStyle(0x333333).fillEllipse(32 + bx, 32 + by, 6, 4)
    g.lineStyle(2, DARK).beginPath()
    g.arc(32 + bx, 34 + by, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false)
    g.strokePath()
    g.generateTexture(key, 64, 80)
    g.destroy()
  }

  private drawPanda() {
    this.pandaFrame('panda', {})
    this.pandaFrame('panda-run-0', { lf: [-3, -1], rf: [3, 1], la: [0, -2], ra: [0, 2] })
    this.pandaFrame('panda-run-1', { by: -3, lf: [1, -2], rf: [-1, -2] })
    this.pandaFrame('panda-run-2', { lf: [3, 1], rf: [-3, -1], la: [0, 2], ra: [0, -2] })
    this.pandaFrame('panda-attack-0', { bx: -2, ra: [-3, -2] })
    this.pandaFrame('panda-attack-1', { bx: 3, ra: [7, -4], paw: true })

    if (!this.anims.exists('panda-run')) {
      this.anims.create({ key: 'panda-idle', frames: [{ key: 'panda' }], frameRate: 1, repeat: -1 })
      this.anims.create({
        key: 'panda-run',
        frames: [{ key: 'panda-run-0' }, { key: 'panda-run-1' }, { key: 'panda-run-2' }, { key: 'panda-run-1' }],
        frameRate: 12, repeat: -1,
      })
      this.anims.create({
        key: 'panda-attack',
        frames: [{ key: 'panda-attack-0' }, { key: 'panda-attack-1' }],
        frameRate: 14, repeat: 0,
      })
    }
  }

  private drawDecor() {
    let g = this.add.graphics()
    // buisson (plaine)
    g.fillStyle(0x3f8f3f).fillEllipse(20, 26, 40, 24).fillEllipse(8, 30, 20, 16).fillEllipse(32, 30, 20, 16)
    g.fillStyle(0x5cb85c).fillEllipse(20, 22, 34, 18)
    g.generateTexture('deco-plaine', 40, 36); g.destroy()
    // arbre (forêt)
    g = this.add.graphics()
    g.fillStyle(0x5d4037).fillRect(18, 44, 8, 20)
    g.fillStyle(0x2e5e30).fillCircle(22, 24, 20)
    g.fillStyle(0x3c7d3f).fillCircle(14, 20, 12).fillCircle(30, 22, 12).fillCircle(22, 13, 12)
    g.generateTexture('deco-foret', 44, 64); g.destroy()
    // cactus (désert)
    g = this.add.graphics()
    g.fillStyle(0x3c7d3f).fillRoundedRect(12, 10, 10, 46, 4)
    g.fillStyle(0x4a9d4a).fillRoundedRect(2, 26, 8, 16, 3).fillRoundedRect(24, 20, 8, 22, 3)
    g.generateTexture('deco-desert', 34, 56); g.destroy()
    // stalagmite (cave)
    g = this.add.graphics()
    g.fillStyle(0x50505c).fillTriangle(4, 48, 16, 4, 28, 48)
    g.fillStyle(0x6a6a78).fillTriangle(10, 48, 16, 18, 22, 48)
    g.generateTexture('deco-cave', 32, 48); g.destroy()
  }

  create() {
    this.drawPanda()
    this.drawDecor()

    // Tuiles par biome
    for (const [key, pal] of Object.entries(TILE_PALETTES)) {
      const g = this.add.graphics()
      g.fillStyle(pal.soil).fillRect(0, 0, 32, 32)
      g.fillStyle(pal.top).fillRect(0, 0, 32, 9)
      g.fillStyle(pal.speck).fillEllipse(6, 5, 5, 4).fillEllipse(22, 6, 5, 4).fillEllipse(14, 3, 3, 3)
      g.fillStyle(0x000000, 0.15).fillRect(0, 0, 32, 1).fillRect(0, 0, 1, 32)
      g.generateTexture(key, 32, 32)
      g.destroy()
    }

    // Monstres : corps rond ombré, yeux + bouche, couronne pour les boss
    for (const m of Object.values(MONSTERS)) {
      const s = m.boss ? 64 : 36
      const r = s / 2
      const g = this.add.graphics()
      g.fillStyle(0x222222, 0.4).fillEllipse(r, s + 1, r * 1.4, 6) // ombre portée
      g.fillStyle(0x222222).fillCircle(r, r + 2, r - 1)
      g.fillStyle(m.color).fillCircle(r, r + 2, r - 3)
      g.fillStyle(0xffffff, 0.3).fillEllipse(r - r / 3, r - r / 3, r / 2, r / 3)
      const eye = Math.max(2.5, r / 6)
      g.fillStyle(0xffffff).fillCircle(r - r / 3, r, eye).fillCircle(r + r / 3, r, eye)
      g.fillStyle(0x000000).fillCircle(r - r / 3 + 1, r + 1, eye / 2).fillCircle(r + r / 3 + 1, r + 1, eye / 2)
      g.lineStyle(2, 0x000000, 0.6).beginPath()
      g.arc(r, r + r / 2, r / 4, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false)
      g.strokePath()
      if (m.boss) {
        g.fillStyle(0xffd54f).fillTriangle(r - 12, 6, r - 6, 14, r, 6).fillTriangle(r, 6, r + 6, 14, r + 12, 6)
        g.fillRect(r - 12, 12, 24, 4)
      }
      g.generateTexture(`monster-${m.id}`, s, s + 6)
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
    g.fillStyle(0x7b1fa2).fillRoundedRect(1, 1, 14, 14, 3); g.fillStyle(0xba68c8).fillRoundedRect(2, 2, 12, 12, 2); g.generateTexture('item-drop', 16, 16); g.clear()

    // Props destructibles
    g.fillStyle(0x33691e).fillEllipse(12, 13, 22, 16)
    g.fillStyle(0x7cb342).fillEllipse(12, 11, 20, 13)
    g.fillStyle(0x9ccc65).fillEllipse(7, 8, 3, 7).fillEllipse(12, 6, 3, 9).fillEllipse(17, 8, 3, 7); g.generateTexture('prop-herbe', 24, 20); g.clear()
    g.fillStyle(0xf5f5dc).fillRoundedRect(9, 10, 6, 14, 2)
    g.fillStyle(0xb71c1c).fillEllipse(12, 9, 22, 15)
    g.fillStyle(0xef5350).fillEllipse(12, 8, 20, 12)
    g.fillStyle(0xffffff).fillCircle(6, 6, 2).fillCircle(18, 6, 2).fillCircle(12, 10, 2); g.generateTexture('prop-champignon', 24, 24); g.clear()
    g.fillStyle(0x616161).fillEllipse(14, 14, 28, 20)
    g.fillStyle(0x9e9e9e).fillEllipse(13, 11, 16, 9); g.generateTexture('prop-roche', 28, 24); g.clear()
    g.fillStyle(0x4e342e).fillRoundedRect(0, 0, 30, 24, 3)
    g.fillStyle(0x795548).fillRoundedRect(1, 1, 28, 22, 3)
    g.fillStyle(0xffd54f).fillRect(0, 9, 30, 6)
    g.fillStyle(0xfff176).fillCircle(15, 12, 3); g.generateTexture('prop-coffre', 30, 24); g.clear()
    g.fillStyle(0xffffff).fillEllipse(7, 7, 12, 12); g.generateTexture('material-drop', 14, 14); g.clear()

    // Collines et nuages de fond (teintés à l'usage)
    g.fillStyle(0xffffff).fillEllipse(120, 120, 260, 180); g.generateTexture('hill', 240, 130); g.clear()
    g.fillStyle(0xffffff).fillCircle(20, 20, 18).fillCircle(44, 22, 22).fillCircle(70, 20, 16); g.generateTexture('cloud', 90, 40); g.clear()

    g.destroy()
    this.scene.start('Title')
  }
}
