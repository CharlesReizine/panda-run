import Phaser from 'phaser'
import { WORLD_NODES, WORLD_EDGES, isNodeUnlocked } from '../data/worldmap'
import { getPlayer } from '../state'
import { canChangeClass } from '../core/progression'

const NODE_COLORS = { town: 0xffd700, level: 0x66bb6a, boss: 0xef5350 } as const

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap') }

  create() {
    this.add.rectangle(480, 270, 960, 540, 0x264653)
    this.add.text(480, 28, 'Carte du monde', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5)

    const p = getPlayer()
    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))

    const g = this.add.graphics().lineStyle(3, 0xffffff, 0.35)
    for (const [a, b] of WORLD_EDGES) {
      const na = byId.get(a)!, nb = byId.get(b)!
      g.lineBetween(na.x, na.y, nb.x, nb.y)
    }

    for (const n of WORLD_NODES) {
      const unlocked = isNodeUnlocked(n.id, p.completedLevels)
      const done = n.levelId ? p.completedLevels.includes(n.levelId) : false
      const color = unlocked ? NODE_COLORS[n.type] : 0x555555
      const c = this.add.circle(n.x, n.y, n.type === 'boss' ? 18 : 14, color).setStrokeStyle(2, 0xffffff, 0.8)
      this.add.text(n.x, n.y + 26, n.name, { fontSize: '12px', color: unlocked ? '#ffffff' : '#888888' }).setOrigin(0.5)
      if (done) this.add.text(n.x, n.y, '✓', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5)
      if (unlocked && n.levelId) c.setInteractive().on('pointerdown', () => this.scene.start('Level', { levelId: n.levelId }))
    }

    this.add.text(30, 495, 'Menu', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 14, y: 6 } })
      .setInteractive().on('pointerdown', () => this.scene.start('Menu'))
    this.add.text(160, 495, 'Ville', { fontSize: '20px', color: '#ffffff', backgroundColor: '#8d6e00', padding: { x: 14, y: 6 } })
      .setInteractive().on('pointerdown', () => this.scene.start('Town'))
    // pastille : points de skill à dépenser
    if (p.skillPoints > 0) {
      const b = this.add.text(96, 488, `${p.skillPoints}`, { fontSize: '14px', color: '#ffffff', backgroundColor: '#e53935', padding: { x: 6, y: 3 } }).setOrigin(0.5)
      this.tweens.add({ targets: b, scale: 1.2, yoyo: true, repeat: -1, duration: 500 })
    }

    if (canChangeClass(p)) {
      const t = this.add.text(480, 495, '★ Changer de classe ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ffd700', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setInteractive().on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    }
  }
}
