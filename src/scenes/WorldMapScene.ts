import Phaser from 'phaser'
import { WORLD_NODES, WORLD_EDGES, isNodeUnlocked, neighborsOf, type MapNode } from '../data/worldmap'
import { getPlayer } from '../state'
import { canChangeClass, canEvolveClass } from '../core/progression'
import { save } from '../core/save'
import { audio } from '../audio/audio-engine'
import { isLevelSeen } from './LevelIntroScene'

const NODE_COLORS = { town: 0xffd700, level: 0x66bb6a, boss: 0xef5350 } as const
const LOCKED_COLOR = 0x555555
const RADIUS = { town: 22, level: 12, boss: 20 } as const

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap') }

  create() {
    audio.playMusic('carte')

    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))
    this.drawBackground()

    this.add.text(480, 26, 'Carte du monde', { fontSize: '26px', color: '#4e342e', fontStyle: 'bold' }).setOrigin(0.5)

    const p = getPlayer()
    const current = byId.get(p.currentNode)!
    const neighbors = new Set(neighborsOf(p.currentNode))
    const revealed = this.computeRevealed(p)

    this.drawRoads(byId)

    for (const n of WORLD_NODES) {
      const unlocked = isNodeUnlocked(n.id, p.completedLevels)
      const done = n.levelId ? p.completedLevels.includes(n.levelId) : false
      const isCurrent = n.id === p.currentNode
      // règles d'interaction : on n'avance QUE vers le front de progression (terrain voisin du
      // nœud courant, débloqué, PAS encore complété) ; interdit de revenir sur un terrain déjà
      // fait/derrière. EXCEPTION de VOYAGE : une ville déjà DÉCOUVERTE (révélée) et débloquée
      // reste accessible pour y RETOURNER (achat/craft), même après avoir avancé. Le nœud courant
      // ne se « rejoint » pas — sauf si c'est une ville, qu'on ouvre alors directement.
      const isForwardTerrain = !isCurrent && unlocked && neighbors.has(n.id) && !done && n.type !== 'town'
      const isReachedTown = !isCurrent && n.type === 'town' && unlocked && revealed.has(n.id)
      const canTravel = isForwardTerrain || isReachedTown
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

    // brouillard de guerre : couvre les nœuds encore non révélés (dessiné APRÈS les nœuds/labels
    // pour les masquer ; sous les boutons d'UI ci-dessous, remontés à un depth supérieur)
    this.drawFog(byId, revealed)

    // marqueur du panda sur le nœud courant
    const marker = this.add.image(current.x, current.y - RADIUS[current.type] - 14, `panda-${p.classId}`).setDisplaySize(26, 26).setDepth(8)
    this.tweens.add({ targets: marker, y: marker.y - 5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' })

    this.add.text(30, 495, 'Menu', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 14, y: 6 } }).setDepth(20)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Menu'))

    // pastille : points de skill à dépenser
    if (p.skillPoints > 0) {
      const b = this.add.text(96, 488, `${p.skillPoints}`, { fontSize: '14px', color: '#ffffff', backgroundColor: '#e53935', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(20)
      this.tweens.add({ targets: b, scale: 1.2, yoyo: true, repeat: -1, duration: 500 })
    }

    if (canChangeClass(p)) {
      const t = this.add.text(480, 495, '★ Changer de classe ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ffd700', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    } else if (canEvolveClass(p)) {
      const t = this.add.text(480, 495, '★ Évolution disponible ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ce93d8', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    }
  }

  // Ensemble des nœuds RÉVÉLÉS (hors brouillard). MÊME règle pour villes ET terrains : un nœud est
  // révélé s'il est complété, s'il est le nœud courant, ou s'il est adjacent à un nœud
  // complété/courant (les prochains choix visibles). Les villes ne sont PAS pré-révélées : elles
  // se découvrent comme le reste. (Une ville reste ensuite révélée en permanence car son terrain
  // voisin complété la maintient adjacente à un nœud complété → on peut y re-voyager, voir plus bas.)
  private computeRevealed(p: ReturnType<typeof getPlayer>): Set<string> {
    const done = (n: MapNode) => (n.levelId ? p.completedLevels.includes(n.levelId) : false)
    const anchors = new Set<string>()
    for (const n of WORLD_NODES) if (done(n) || n.id === p.currentNode) anchors.add(n.id)
    const revealed = new Set<string>(anchors)
    for (const id of anchors) for (const nb of neighborsOf(id)) revealed.add(nb)
    return revealed
  }

  // Brouillard de guerre : un nuage sombre couvre chaque nœud NON révélé (+ son étiquette + le
  // tronçon de chemin qui y mène). Les nœuds fraîchement révélés depuis la dernière visite voient
  // leur nuage se dissiper (fondu) : le brouillard « se lève » au fil des complétions.
  private drawFog(byId: Map<string, MapNode>, revealed: Set<string>) {
    const KEY = 'panda-run:map-revealed'
    let prev: string[] = []
    try { prev = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[] } catch { prev = [] }
    const prevSet = new Set(prev)
    for (const n of WORLD_NODES) {
      if (!revealed.has(n.id)) this.drawCloud(n, byId) // nœud encore masqué
    }
    // fondu de « lever du brouillard » sur les nœuds révélés depuis la dernière visite
    if (prev.length > 0) {
      for (const n of WORLD_NODES) {
        if (!revealed.has(n.id) || prevSet.has(n.id)) continue
        const cloud = this.drawCloud(n, byId)
        this.tweens.add({ targets: cloud, alpha: 0, duration: 900, delay: 200, ease: 'Sine.out', onComplete: () => cloud.destroy() })
      }
    }
    try { localStorage.setItem(KEY, JSON.stringify([...revealed])) } catch { /* stockage indispo : pas de persistance du fondu */ }
  }

  // Amas de disques sombres façon nuage, couvrant le nœud + son étiquette (dessous) + la moitié
  // des arêtes qui y mènent (côté brouillard). Renvoie l'objet pour pouvoir l'animer (fondu).
  private drawCloud(n: MapNode, byId: Map<string, MapNode>): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(6)
    const dark = 0x1e1e30
    g.lineStyle(16, dark, 0.9)
    for (const nbId of neighborsOf(n.id)) {
      const m = byId.get(nbId)!
      g.beginPath(); g.moveTo(n.x, n.y); g.lineTo((n.x + m.x) / 2, (n.y + m.y) / 2); g.strokePath()
    }
    const puffs: [number, number, number][] = [
      [n.x - 24, n.y - 4, 20], [n.x + 24, n.y - 4, 20], [n.x, n.y - 16, 24],
      [n.x - 6, n.y + 12, 30], [n.x - 28, n.y + 26, 20], [n.x + 28, n.y + 26, 20], [n.x, n.y + 36, 24],
    ]
    g.fillStyle(0x45456a, 0.5)
    for (const [cx, cy, r] of puffs) g.fillCircle(cx, cy, r * 1.18)
    g.fillStyle(dark, 0.95)
    for (const [cx, cy, r] of puffs) g.fillCircle(cx, cy, r)
    return g
  }

  // Fond illustré de la carte : la belle vue fantasy `map-monde.jpg`, mise à l'échelle « cover »
  // pour couvrir tout l'écran (960×540) centrée, très en arrière (depth -30). Un léger voile
  // sombre par-dessus assoit le contraste des labels/nœuds. Repli sur le parchemin procédural
  // si l'illustration manque au chargement.
  private drawBackground() {
    if (this.textures.exists('map-monde')) {
      const src = this.textures.get('map-monde').getSourceImage()
      const cover = Math.max(960 / src.width, 540 / src.height)
      this.add.image(480, 270, 'map-monde').setScale(cover).setDepth(-30)
      this.add.rectangle(480, 270, 960, 540, 0x1a1208, 0.2).setDepth(-29)
      return
    }
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
    const data = { levelId: target.levelId, fromNode: p.currentNode, targetNode: targetId, dir }
    // Première entrée dans ce terrain → écran d'intro (présentation des monstres et loots).
    // Les fois suivantes → directement le jeu, pas de re-présentation.
    const scene = target.levelId && !isLevelSeen(target.levelId) ? 'LevelIntro' : 'Level'
    this.scene.start(scene, data)
  }
}
