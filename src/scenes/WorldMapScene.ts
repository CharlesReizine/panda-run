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
    const anchors = this.computeAnchors(p)
    const revealed = this.computeRevealed(anchors)

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
      // voyage LIBRE vers tout nœud DÉBLOQUÉ + RÉVÉLÉ (plus seulement les voisins) : on peut faire
      // les branches parallèles (Orée ↔ Champs) et revisiter sans détour forcé. Le brouillard cache
      // toujours le lointain non découvert → pas de « balade » vers l'inconnu.
      const canTravel = !isCurrent && unlocked && revealed.has(n.id)
      const canEnterTown = isCurrent && n.type === 'town'
      // nœud COURANT qui est un TERRAIN (ou boss), pas une ville : on le LANCE directement, comme on
      // entre dans une ville. Indispensable pour (re)jouer le niveau courant NON complété — ex.
      // Prairie au tout début : c'est le nœud courant, on doit pouvoir le démarrer depuis la carte.
      const canEnterLevel = isCurrent && n.type !== 'town' && !!n.levelId
      const interactive = canTravel || canEnterTown || canEnterLevel
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

    // brouillard de guerre INVERSÉ : voile sombre plein écran, percé autour de chaque nœud ANCRE
    // (fait/courant) d'un double cercle de révélation (intérieur net + anneau à 50 %). Dessiné APRÈS
    // les nœuds/labels pour teinter le lointain ; sous les boutons d'UI ci-dessous (depth supérieur).
    this.drawFog(anchors)

    // marqueur du panda sur le nœud courant
    const marker = this.add.image(current.x, current.y - RADIUS[current.type] - 14, `panda-${p.classId}`).setDisplaySize(26, 26).setDepth(8)
    this.tweens.add({ targets: marker, y: marker.y - 5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' })

    this.add.text(30, 495, 'Menu', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 14, y: 6 } }).setDepth(20)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Menu'))

    // accès à l'inventaire dédié (icône « tenue ») — à droite du bouton Menu
    this.add.circle(148, 505, 24, 0x263238, 0.9).setStrokeStyle(2, 0xffca28, 0.8).setDepth(20)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Inventory', { return: 'WorldMap' }))
    this.add.image(148, 505, 'ui-inventory').setDisplaySize(34, 34).setDepth(21)

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
  private computeRevealed(anchors: Set<string>): Set<string> {
    const revealed = new Set<string>(anchors)
    for (const id of anchors) for (const nb of neighborsOf(id)) revealed.add(nb)
    return revealed
  }

  // Nœuds ANCRES : terrains complétés + nœud courant. Ce sont les seuls autour desquels on perce le
  // brouillard (double cercle) ; leurs voisins ne sont que devinés via l'anneau à 50 %.
  private computeAnchors(p: ReturnType<typeof getPlayer>): Set<string> {
    const done = (n: MapNode) => (n.levelId ? p.completedLevels.includes(n.levelId) : false)
    const anchors = new Set<string>()
    for (const n of WORLD_NODES) if (done(n) || n.id === p.currentNode) anchors.add(n.id)
    return anchors
  }

  // Brouillard INVERSÉ : tout est OBSCUR par défaut. On peint un voile sombre BIEN OPAQUE plein écran
  // dans une DynamicTexture, puis on perce autour de chaque nœud ANCRE (fait / courant) un DOUBLE
  // cercle de révélation : un disque INTÉRIEUR (rayon modéré) 100 % clair — terrain net —, entouré
  // d'un ANNEAU EXTÉRIEUR à ~50 % — on devine sans voir net. Au-delà : voile sombre opaque (lointain
  // vraiment caché). Aucun noir pur : gris bleuté profond, alpha global élevé → le reste de la map
  // est nettement masqué.
  private readonly DARK_COLOR = 0x060812 // bleu nuit très sombre, jamais 0x000000
  private readonly DARK_ALPHA = 0.97 // opacité du voile (bien plus opaque qu'avant : lointain masqué)
  private readonly REVEAL_IN = 66 // rayon du cercle INTÉRIEUR (net, 100 % clair) — découvre un peu plus loin
  private readonly REVEAL_OUT = 124 // rayon du cercle EXTÉRIEUR (anneau à 50 %, on devine) — portée élargie

  private drawFog(anchors: Set<string>) {
    this.ensurePuffTexture()
    const key = 'fog-dark'
    const dt = this.getFogTexture(key)
    dt.fill(this.DARK_COLOR, 1) // voile plein écran
    // double cercle de révélation autour de chaque nœud ancre
    for (const n of WORLD_NODES) if (anchors.has(n.id)) this.revealNode(dt, n)
    dt.render()
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(6).setAlpha(this.DARK_ALPHA)
  }

  // DynamicTexture pleine page (réutilisée entre scènes) sur laquelle composer le voile.
  private getFogTexture(key: string): Phaser.Textures.DynamicTexture {
    if (this.textures.exists(key)) {
      const t = this.textures.get(key) as Phaser.Textures.DynamicTexture
      t.clear()
      return t
    }
    return this.textures.addDynamicTexture(key, 960, 540)!
  }

  // Double cercle de révélation autour d'un nœud ancre : d'abord l'ANNEAU extérieur à 50 % (perce la
  // moitié du voile → on devine), puis par-dessus le disque INTÉRIEUR à 100 % (perce tout → net), plus
  // un petit disque net sous le nœud pour dégager son étiquette. Ordre important : le clair passe
  // APRÈS le devine, sinon le 50 % re-voilerait le centre.
  private revealNode(dt: Phaser.Textures.DynamicTexture, n: MapNode) {
    this.punch(dt, 'fog-guess', n.x, n.y, this.REVEAL_OUT) // anneau extérieur ~50 % clair
    this.punch(dt, 'fog-clear', n.x, n.y, this.REVEAL_IN) // disque intérieur 100 % clair
    this.punch(dt, 'fog-clear', n.x, n.y + 26, this.REVEAL_IN * 0.72) // étiquette dégagée
  }

  // efface un disque flou de rayon `radius` (px) centré en (x,y) via le puff `key` (blend ERASE) :
  // le puff `fog-clear` retire tout l'alpha (trou net) ; `fog-guess` n'en retire que ~50 % (voile
  // aminci → on devine). Le puff fait 128 px (rayon 64) → scale = radius/64.
  private punch(dt: Phaser.Textures.DynamicTexture, key: string, x: number, y: number, radius: number) {
    dt.stamp(key, undefined, x, y, {
      scale: (radius * 2) / 128, originX: 0.5, originY: 0.5, blendMode: Phaser.BlendModes.ERASE,
    })
  }

  // Deux textures « puff » (masques d'effacement à dégradé radial), plein au centre → transparent au
  // bord pour des contours flous : `fog-clear` (alpha 1 → efface tout, cercle net) et `fog-guess`
  // (alpha 0.5 → n'efface que la moitié, anneau où l'on devine). Palier presque plat jusqu'à 0.82 du
  // rayon puis chute → le rayon demandé ≈ le rayon vraiment perçu.
  private ensurePuffTexture() {
    this.makePuff('fog-clear', 1)
    this.makePuff('fog-guess', 0.5)
  }

  private makePuff(key: string, peak: number) {
    if (this.textures.exists(key)) return
    const size = 128
    const tex = this.textures.createCanvas(key, size, size)
    if (!tex) return
    const ctx = tex.getContext()
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grd.addColorStop(0, `rgba(255,255,255,${peak})`)
    grd.addColorStop(0.82, `rgba(255,255,255,${peak})`)
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    tex.refresh()
  }

  // Fond illustré de la carte : la belle vue fantasy `map-monde.jpg`, ÉTIRÉE pour remplir EXACTEMENT
  // le cadre 960×540 dans lequel vivent les nœuds (setDisplaySize, pas de « cover » qui croppait le
  // haut et décalait les points). Un nœud en (x,y) tombe ainsi pile sur la carte. Léger voile sombre
  // par-dessus pour le contraste. Repli sur le parchemin procédural si l'illustration manque.
  private drawBackground() {
    if (this.textures.exists('map-monde')) {
      this.add.image(480, 270, 'map-monde').setDisplaySize(960, 540).setDepth(-30)
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

    const dir = 'forward' as const // toujours gauche→droite : jouer un niveau « à l'envers » était contre-nature
    const data = { levelId: target.levelId, fromNode: p.currentNode, targetNode: targetId, dir }
    // Première entrée dans ce terrain → écran d'intro (présentation des monstres et loots).
    // Les fois suivantes → directement le jeu, pas de re-présentation.
    const scene = target.levelId && !isLevelSeen(target.levelId) ? 'LevelIntro' : 'Level'
    this.scene.start(scene, data)
  }
}
