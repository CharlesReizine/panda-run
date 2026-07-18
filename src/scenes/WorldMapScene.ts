import Phaser from 'phaser'
import { WORLD_NODES, WORLD_EDGES, isNodeUnlocked, neighborsOf, type MapNode } from '../data/worldmap'
import { getPlayer } from '../state'
import { canChangeClass, canEvolveClass } from '../core/progression'
import { save } from '../core/save'
import { audio } from '../audio/audio-engine'

const NODE_COLORS = { town: 0xffd700, level: 0x66bb6a, boss: 0xef5350 } as const
const LOCKED_COLOR = 0x555555
const RADIUS = { town: 22, level: 12, boss: 20 } as const

// Régions teintées par zone/biome (façon carte au trésor) : chaque bloc regroupe les nœuds
// d'une même zone narrative pour calculer une pastille de fond qui les englobe.
const ZONE_TINTS: { color: number; nodeIds: string[] }[] = [
  { color: 0x7cb342, nodeIds: ['prontera', 'plaine-1', 'plaine-2', 'foret-1', 'foret-2', 'boss-1'] },
  { color: 0xd7b56d, nodeIds: ['morroc', 'desert-1', 'desert-2', 'desert-3', 'cave-a', 'boss-2'] },
  { color: 0x2e9e8f, nodeIds: ['jungle-1', 'jungle-2', 'boss-jungle', 'plage-1', 'plage-2'] },
  { color: 0x8d6e63, nodeIds: ['montagne-1', 'montagne-2', 'boss-montagne', 'carriere-1', 'carriere-2'] },
  { color: 0x7e57c2, nodeIds: ['cimetiere-1', 'cimetiere-2', 'boss-cimetiere'] },
  { color: 0xb71c1c, nodeIds: ['enfer-1', 'boss-enfer'] },
]

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap') }

  create() {
    audio.playMusic('carte')

    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))
    this.drawBackground(byId)

    this.add.text(480, 26, 'Carte du monde', { fontSize: '26px', color: '#4e342e', fontStyle: 'bold' }).setOrigin(0.5)

    const p = getPlayer()
    const current = byId.get(p.currentNode)!
    const neighbors = new Set(neighborsOf(p.currentNode))

    this.drawRoads(byId)

    for (const n of WORLD_NODES) {
      const unlocked = isNodeUnlocked(n.id, p.completedLevels)
      const done = n.levelId ? p.completedLevels.includes(n.levelId) : false
      const isCurrent = n.id === p.currentNode
      // règles d'interaction : un voisin débloqué se rejoint en un tap (voyage) ; le nœud
      // courant, lui, ne se « rejoint » pas — sauf s'il s'agit d'une ville, qu'on peut alors
      // ouvrir directement (entrée en ville) sans passer par un bouton séparé
      const canTravel = unlocked && neighbors.has(n.id) && !isCurrent
      const canEnterTown = isCurrent && n.type === 'town'
      const interactive = canTravel || canEnterTown
      const radius = RADIUS[n.type]
      const color = interactive ? NODE_COLORS[n.type] : LOCKED_COLOR

      if (interactive) {
        // halo pulsant derrière l'icône pour signaler « c'est jouable »
        const halo = this.add.circle(n.x, n.y, radius + 8, NODE_COLORS[n.type], 0.25)
        this.tweens.add({ targets: halo, scale: 1.35, alpha: 0, yoyo: true, repeat: -1, duration: 900 })
      }

      const g = this.add.graphics()
      if (n.type === 'town') this.drawCastle(g, n.x, n.y, radius, color, interactive)
      else if (n.type === 'boss') this.drawSkull(g, n.x, n.y, radius, color, interactive)
      else this.drawTent(g, n.x, n.y, radius, color, interactive)

      const labelColor = interactive ? '#ffffff' : '#b8b8b8'
      // étiquette ancrée sous le nœud (origine haut-centre) : fond semi-opaque + retour à la
      // ligne pour rester lisible par-dessus les régions teintées et ne jamais déborder
      this.add.text(n.x, n.y + radius + 5, n.name, {
        fontSize: '11px', color: labelColor, fontStyle: isCurrent ? 'bold' : 'normal',
        align: 'center', wordWrap: { width: 96 },
        backgroundColor: 'rgba(43,26,16,0.6)', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 0).setDepth(4)

      if (done) {
        this.add.text(n.x + radius - 4, n.y - radius + 2, '✓', {
          fontSize: '14px', color: '#2e7d32', fontStyle: 'bold', backgroundColor: '#ffffff', padding: { x: 2, y: 0 },
        }).setOrigin(0.5)
      }

      if (interactive) {
        const hit = this.add.circle(n.x, n.y, radius + 10, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
        hit.on('pointerdown', () => {
          audio.playSfx('ui-tap')
          canEnterTown ? this.enterCurrentTown() : this.travelTo(n.id)
        })
      }
    }

    // marqueur du panda sur le nœud courant
    const marker = this.add.image(current.x, current.y - RADIUS[current.type] - 14, `panda-${p.classId}`).setDisplaySize(26, 26).setDepth(5)
    this.tweens.add({ targets: marker, y: marker.y - 5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' })

    this.add.text(30, 495, 'Menu', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 14, y: 6 } })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Menu'))

    // pastille : points de skill à dépenser
    if (p.skillPoints > 0) {
      const b = this.add.text(96, 488, `${p.skillPoints}`, { fontSize: '14px', color: '#ffffff', backgroundColor: '#e53935', padding: { x: 6, y: 3 } }).setOrigin(0.5)
      this.tweens.add({ targets: b, scale: 1.2, yoyo: true, repeat: -1, duration: 500 })
    }

    if (canChangeClass(p)) {
      const t = this.add.text(480, 495, '★ Changer de classe ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ffd700', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    } else if (canEvolveClass(p)) {
      const t = this.add.text(480, 495, '★ Évolution disponible ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ce93d8', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    }
  }

  // fond façon parchemin : dégradé de base (bandes interpolées à la main — fillGradientStyle
  // est WebGL only et ne s'affiche pas si le renderer bascule en Canvas) + régions teintées
  private drawBackground(byId: Map<string, MapNode>) {
    const bg = this.add.graphics()
    const top: [number, number, number] = [0xf1, 0xe2, 0xbd]
    const bottom: [number, number, number] = [0xc9, 0xa8, 0x6a]
    const bands = 24
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1)
      const r = Math.round(top[0] + (bottom[0] - top[0]) * t)
      const gg = Math.round(top[1] + (bottom[1] - top[1]) * t)
      const b = Math.round(top[2] + (bottom[2] - top[2]) * t)
      const color = (r << 16) | (gg << 8) | b
      const y0 = Math.floor((540 / bands) * i)
      const h = Math.ceil(540 / bands) + 1
      bg.fillStyle(color, 1).fillRect(0, y0, 960, h)
    }
    // quelques taches façon vieux papier
    for (let i = 0; i < 18; i++) {
      const x = 40 + ((i * 197) % 900)
      const y = 40 + ((i * 131) % 470)
      bg.fillStyle(0x8d6e3f, 0.05).fillEllipse(x, y, 90, 60)
    }
    bg.lineStyle(6, 0x8d6e3f, 0.5).strokeRect(6, 6, 948, 528)

    for (const zone of ZONE_TINTS) {
      const pts = zone.nodeIds.map((id) => byId.get(id)).filter((n): n is MapNode => !!n)
      if (!pts.length) continue
      const minX = Math.min(...pts.map((n) => n.x)) - 55
      const maxX = Math.max(...pts.map((n) => n.x)) + 55
      const minY = Math.min(...pts.map((n) => n.y)) - 55
      const maxY = Math.max(...pts.map((n) => n.y)) + 55
      const zg = this.add.graphics()
      zg.fillStyle(zone.color, 0.16)
      zg.fillRoundedRect(minX, minY, maxX - minX, maxY - minY, 40)
      zg.lineStyle(2, zone.color, 0.3)
      zg.strokeRoundedRect(minX, minY, maxX - minX, maxY - minY, 40)
    }
  }

  // routes en pointillés épais entre les nœuds reliés
  private drawRoads(byId: Map<string, MapNode>) {
    const g = this.add.graphics()
    for (const [a, b] of WORLD_EDGES) {
      const na = byId.get(a)!, nb = byId.get(b)!
      this.dashedLine(g, na.x, na.y, nb.x, nb.y, 0x6d4c37, 5, 14, 9)
    }
  }

  private dashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number, dash: number, gap: number) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    const step = dash + gap
    const nx = dx / len, ny = dy / len
    g.lineStyle(width, color, 0.55)
    for (let d = 0; d < len; d += step) {
      const segLen = Math.min(dash, len - d)
      g.beginPath()
      g.moveTo(x1 + nx * d, y1 + ny * d)
      g.lineTo(x1 + nx * (d + segLen), y1 + ny * (d + segLen))
      g.strokePath()
    }
  }

  // château crénelé : deux tourelles + tour centrale + drapeau — bien reconnaissable, en gros
  private drawCastle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x5d4037 : 0x3a3a3a
    const w = r * 1.7
    const towerW = w * 0.32
    const bodyH = r * 1.15
    const left = x - w / 2, right = x + w / 2
    // corps du château
    g.fillStyle(color).fillRect(left, y - bodyH * 0.15, w, bodyH * 0.75)
    g.lineStyle(2, dark, 0.9).strokeRect(left, y - bodyH * 0.15, w, bodyH * 0.75)
    // tourelles latérales
    for (const tx of [left, right - towerW]) {
      g.fillStyle(color).fillRect(tx, y - bodyH * 0.6, towerW, bodyH)
      g.lineStyle(2, dark, 0.9).strokeRect(tx, y - bodyH * 0.6, towerW, bodyH)
      // créneaux
      for (let i = 0; i < 3; i++) g.fillStyle(color).fillRect(tx + i * (towerW / 3), y - bodyH * 0.6 - 6, towerW / 3 - 2, 6)
    }
    // tour centrale + drapeau
    const cx = x - towerW * 0.45
    g.fillStyle(color).fillRect(cx, y - bodyH * 0.95, towerW * 0.9, bodyH * 0.5)
    g.lineStyle(2, dark, 0.9).strokeRect(cx, y - bodyH * 0.95, towerW * 0.9, bodyH * 0.5)
    g.lineStyle(2, dark, 0.9).lineBetween(x, y - bodyH * 0.95, x, y - bodyH * 1.35)
    g.fillStyle(lit ? 0xef5350 : 0x777777).fillTriangle(x, y - bodyH * 1.35, x, y - bodyH * 1.15, x + 12, y - bodyH * 1.25)
    // porte
    g.fillStyle(dark, 0.9).fillRoundedRect(x - 5, y + bodyH * 0.35, 10, bodyH * 0.25, 3)
  }

  // petite icône de terrain : tente à bannière
  private drawTent(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x2e7d32 : 0x3a3a3a
    g.fillStyle(color).fillTriangle(x - r, y + r * 0.6, x + r, y + r * 0.6, x, y - r * 0.7)
    g.lineStyle(2, dark, 0.9).strokeTriangle(x - r, y + r * 0.6, x + r, y + r * 0.6, x, y - r * 0.7)
    g.fillStyle(dark, 0.6).fillTriangle(x, y + r * 0.6, x + r * 0.35, y + r * 0.6, x, y - r * 0.2)
    g.lineStyle(2, dark, 0.9).lineBetween(x, y - r * 0.7, x, y - r * 1.3)
    g.fillStyle(lit ? 0xffeb3b : 0x777777).fillTriangle(x, y - r * 1.3, x, y - r * 1.05, x + r * 0.6, y - r * 1.17)
  }

  // crâne menaçant surmonté d'une couronne — pour les nœuds boss
  private drawSkull(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x1a1a1a : 0x2a2a2a
    const skullColor = lit ? 0xecebe4 : 0x8a8a8a
    g.fillStyle(skullColor).fillCircle(x, y - r * 0.15, r * 0.85)
    g.fillStyle(skullColor).fillRoundedRect(x - r * 0.5, y, r, r * 0.5, 4) // mâchoire
    g.fillStyle(dark).fillEllipse(x - r * 0.35, y - r * 0.15, r * 0.32, r * 0.42)
    g.fillStyle(dark).fillEllipse(x + r * 0.35, y - r * 0.15, r * 0.32, r * 0.42)
    g.fillStyle(color, 0.9).fillCircle(x - r * 0.35, y - r * 0.15, r * 0.12)
    g.fillStyle(color, 0.9).fillCircle(x + r * 0.35, y - r * 0.15, r * 0.12)
    g.fillStyle(dark).fillTriangle(x - r * 0.12, y + r * 0.05, x + r * 0.12, y + r * 0.05, x, y + r * 0.28) // nez
    for (let i = -2; i <= 2; i++) g.fillStyle(dark).fillRect(x + i * (r * 0.18) - 2, y + r * 0.32, 4, r * 0.16) // dents
    // couronne menaçante
    g.fillStyle(lit ? 0xffd700 : 0x8a8a3a)
      .fillTriangle(x - r * 0.7, y - r * 0.6, x - r * 0.35, y - r * 0.6, x - r * 0.5, y - r * 1.15)
      .fillTriangle(x - r * 0.15, y - r * 0.6, x + r * 0.15, y - r * 0.6, x, y - r * 1.35)
      .fillTriangle(x + r * 0.35, y - r * 0.6, x + r * 0.7, y - r * 0.6, x + r * 0.5, y - r * 1.15)
    g.fillRect(x - r * 0.7, y - r * 0.65, r * 1.4, r * 0.12)
  }

  // le joueur est déjà dans une ville (nœud courant) : on ouvre directement sans se déplacer
  private enterCurrentTown() {
    this.scene.start('Town')
  }

  // voyage vers un nœud voisin débloqué : ville → déplace le marqueur et va en ville,
  // niveau/boss → entre dans le niveau avec la direction déduite de la position relative
  private travelTo(targetId: string) {
    const p = getPlayer()
    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))
    const currentNode = byId.get(p.currentNode)!
    const target = byId.get(targetId)!

    if (target.type === 'town') {
      p.currentNode = targetId
      save(p)
      this.scene.start('Town')
      return
    }

    const dir: 'forward' | 'backward' = target.x > currentNode.x ? 'forward' : 'backward'
    this.scene.start('Level', { levelId: target.levelId, fromNode: p.currentNode, targetNode: targetId, dir })
  }
}
