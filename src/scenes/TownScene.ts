import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { buyPotion, buyItem } from '../core/shop'
import { acceptQuest, refreshQuestProgress, claimQuest } from '../core/quests'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, QUESTS } from '../data/shops'
import { ITEMS } from '../data/items'

const TOWN_SPEED = 170
const INTERACT_RADIUS = 70

interface Town2DState { left: boolean; right: boolean; up: boolean; down: boolean }
const emptyTown2D = (): Town2DState => ({ left: false, right: false, up: false, down: false })

// Joystick tactile 2D (contrairement à src/ui/VirtualJoystick.ts qui ne gère que gauche/droite
// pour le side-scroller) : la ville se parcourt dans les 4 directions.
class TopDownJoystick {
  state: Town2DState = emptyTown2D()
  private origin: Phaser.Math.Vector2 | null = null
  private pointerId: number | null = null
  private base: Phaser.GameObjects.Arc
  private thumb: Phaser.GameObjects.Arc

  constructor(scene: Phaser.Scene, zone: Phaser.Geom.Rectangle) {
    const DEAD_ZONE = 15
    this.base = scene.add.circle(0, 0, 50, 0xffffff, 0.15).setVisible(false).setScrollFactor(0).setDepth(40)
    this.thumb = scene.add.circle(0, 0, 22, 0xffffff, 0.35).setVisible(false).setScrollFactor(0).setDepth(40)

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null) return
      if (!zone.contains(p.x, p.y)) return
      if (scene.input.hitTestPointer(p).length > 0) return
      this.pointerId = p.id
      this.origin = new Phaser.Math.Vector2(p.x, p.y)
      this.base.setPosition(p.x, p.y).setVisible(true)
      this.thumb.setPosition(p.x, p.y).setVisible(true)
    })
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.origin || p.id !== this.pointerId || !p.isDown) return
      const dx = p.x - this.origin.x
      const dy = p.y - this.origin.y
      this.thumb.setPosition(
        this.origin.x + Phaser.Math.Clamp(dx, -50, 50),
        this.origin.y + Phaser.Math.Clamp(dy, -50, 50),
      )
      this.state.left = dx < -DEAD_ZONE
      this.state.right = dx > DEAD_ZONE
      this.state.up = dy < -DEAD_ZONE
      this.state.down = dy > DEAD_ZONE
    })
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return
      this.origin = null
      this.pointerId = null
      this.state = emptyTown2D()
      this.base.setVisible(false)
      this.thumb.setVisible(false)
    }
    scene.input.on('pointerup', release)
  }
}

type SpotKind = 'potions' | 'armes' | 'vetements' | 'quete'

interface TownSpot {
  id: SpotKind
  label: string
  doorX: number
  doorY: number
}

interface TownBuilding {
  id: SpotKind
  name: string
  x: number
  y: number
  w: number
  h: number
  roofColor: number
  wallColor: number
}

const BUILDINGS: TownBuilding[] = [
  { id: 'potions', name: 'Herboristerie', x: 190, y: 150, w: 160, h: 110, roofColor: 0xc62828, wallColor: 0xffca28 },
  { id: 'armes', name: 'Armurerie', x: 480, y: 130, w: 180, h: 120, roofColor: 0x455a64, wallColor: 0xb0bec5 },
  { id: 'vetements', name: 'Boutique de vêtements', x: 770, y: 150, w: 160, h: 110, roofColor: 0x6a1b9a, wallColor: 0xce93d8 },
]

const SPOTS: TownSpot[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, label: b.name, doorX: b.x, doorY: b.y + b.h / 2 + 10 })),
  { id: 'quete', label: QUESTS['chasse-aux-monstres']!.npcName, doorX: 480, doorY: 360 },
]

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private joystick!: TopDownJoystick
  private nearSpot: SpotKind | null = null
  private interactBtn?: Phaser.GameObjects.Text
  private panel?: Phaser.GameObjects.Container
  private feedback?: Phaser.GameObjects.Text

  constructor() { super('Town') }

  create() {
    this.panel = undefined
    this.nearSpot = null

    this.physics.world.setBounds(0, 0, 960, 540)
    this.cameras.main.setBounds(0, 0, 960, 540)

    // sol
    this.add.rectangle(480, 270, 960, 540, 0x7cb342)
    this.add.rectangle(480, 270, 700, 340, 0x9ccc65) // place centrale, un peu plus claire
    this.add.text(480, 20, 'Prontera', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    const wallsGroup = this.physics.add.staticGroup()
    for (const b of BUILDINGS) {
      this.add.rectangle(b.x, b.y - b.h / 2 - 10, b.w + 20, 24, b.roofColor) // avant-toit
      const wall = this.add.rectangle(b.x, b.y, b.w, b.h, b.wallColor)
      this.physics.add.existing(wall, true)
      wallsGroup.add(wall)
      this.add.rectangle(b.x, b.y + b.h / 2 - 14, 26, 28, 0x5d4037) // porte
      this.add.text(b.x, b.y - b.h / 2 - 10, b.name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    }

    // PNJ de quête
    this.add.circle(480, 360, 16, 0xffd54f).setStrokeStyle(2, 0xffffff, 0.9)
    this.add.text(480, 336, QUESTS['chasse-aux-monstres']!.npcName, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5)

    // panneau de sortie — toujours accessible, ramène directement à la carte
    this.add.text(880, 30, 'Sortie →', { fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 10, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('WorldMap'))

    // panda joueur
    const p = getPlayer()
    this.player = this.physics.add.sprite(480, 460, `panda-${p.classId}`)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.player.setCollideWorldBounds(true)
    this.player.setSize(34, 40).setOffset(15, 46)
    this.player.play(`panda-${p.classId}-idle`)
    this.physics.add.collider(this.player, wallsGroup)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.addPointer(1)
    this.joystick = new TopDownJoystick(this, new Phaser.Geom.Rectangle(0, 100, 400, 440))

    this.events.once('shutdown', () => {
      this.panel?.destroy()
      this.interactBtn?.destroy()
      this.feedback?.destroy()
    })
  }

  private readControls(): Town2DState {
    const kb: Town2DState = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
    }
    const j = this.joystick.state
    return { left: kb.left || j.left, right: kb.right || j.right, up: kb.up || j.up, down: kb.down || j.down }
  }

  update() {
    if (this.panel) {
      this.player.setVelocity(0, 0)
      return
    }
    const p = getPlayer()
    const c = this.readControls()
    let vx = 0, vy = 0
    if (c.left) { vx = -TOWN_SPEED; this.player.setFlipX(true) }
    else if (c.right) { vx = TOWN_SPEED; this.player.setFlipX(false) }
    if (c.up) vy = -TOWN_SPEED
    else if (c.down) vy = TOWN_SPEED
    if (vx !== 0 && vy !== 0) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2 }
    this.player.setVelocity(vx, vy)
    const cls = p.classId
    if (vx !== 0 || vy !== 0) this.player.play(`panda-${cls}-run`, true)
    else this.player.play(`panda-${cls}-idle`, true)

    let closest: SpotKind | null = null
    let closestDist = INTERACT_RADIUS
    for (const s of SPOTS) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.doorX, s.doorY)
      if (d <= closestDist) { closest = s.id; closestDist = d }
    }
    if (closest !== this.nearSpot) {
      this.nearSpot = closest
      this.interactBtn?.destroy()
      this.interactBtn = undefined
      if (closest) {
        const spot = SPOTS.find((s) => s.id === closest)!
        this.interactBtn = this.add.text(480, 500, `Parler — ${spot.label}`, {
          fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 },
        }).setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openSpot(closest!))
      }
    }
  }

  private openSpot(kind: SpotKind) {
    if (kind === 'potions') this.openPotionShop()
    else if (kind === 'armes') this.openItemShop('armes', WEAPON_SHOP)
    else if (kind === 'vetements') this.openItemShop('vetements', ARMOR_SHOP)
    else if (kind === 'quete') this.openQuestNpc()
  }

  private closePanel() {
    this.panel?.destroy()
    this.panel = undefined
  }

  private flash(container: Phaser.GameObjects.Container, x: number, y: number, msg: string, color: string) {
    const txt = this.add.text(x, y, msg, { fontSize: '14px', color, fontStyle: 'bold' }).setOrigin(0.5)
    container.add(txt)
    this.tweens.add({ targets: txt, y: y - 24, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
  }

  private openPotionShop() {
    this.closePanel()
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    c.add(this.add.rectangle(480, 270, 520, 260, 0x0d1b2a, 0.96))
    c.add(this.add.text(480, 170, 'Herboristerie', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))

    const render = () => {
      const p = getPlayer()
      // on retire tout sauf le fond/titre (2 premiers éléments)
      for (const child of [...c.list].slice(2)) child.destroy()
      c.add(this.add.text(480, 210, `Potions : ${p.potions}  —  Or : ${p.gold}`, { fontSize: '16px', color: '#ffd54f' }).setOrigin(0.5))
      c.add(
        this.add.text(480, 250, `Acheter 1 potion (${POTION_PRICE} or)`, {
          fontSize: '16px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 14, y: 8 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (buyPotion(p)) { save(p); render() }
          else this.flash(c, 480, 285, "Pas assez d'or !", '#ff5252')
        }),
      )
      c.add(
        this.add.text(480, 340, '← Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 } })
          .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
      )
    }
    render()
  }

  private openItemShop(kind: 'armes' | 'vetements', list: { itemId: string; price: number }[]) {
    this.closePanel()
    const title = kind === 'armes' ? 'Armurerie' : 'Boutique de vêtements'
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    c.add(this.add.rectangle(480, 270, 620, 380, 0x0d1b2a, 0.96))
    c.add(this.add.text(480, 100, title, { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))

    const render = () => {
      const p = getPlayer()
      for (const child of [...c.list].slice(2)) child.destroy()
      c.add(this.add.text(480, 128, `Or : ${p.gold}`, { fontSize: '15px', color: '#ffd54f' }).setOrigin(0.5))
      list.forEach((entry, i) => {
        const item = ITEMS[entry.itemId]!
        const y = 165 + i * 44
        const bonus = Object.entries(item.bonus).map(([k, v]) => `${k} +${v}`).join(' / ')
        c.add(this.add.text(230, y, `${item.name}`, { fontSize: '15px', color: '#ffffff' }).setOrigin(0, 0.5))
        c.add(this.add.text(230, y + 16, bonus, { fontSize: '11px', color: '#90a4ae' }).setOrigin(0, 0.5))
        c.add(
          this.add.text(700, y, `${entry.price} or`, {
            fontSize: '15px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 12, y: 6 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (buyItem(p, entry.itemId, entry.price)) { save(p); render() }
            else this.flash(c, 480, y + 30, "Pas assez d'or !", '#ff5252')
          }),
        )
      })
      c.add(
        this.add.text(480, 165 + list.length * 44 + 20, '← Fermer', {
          fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
      )
    }
    render()
  }

  private openQuestNpc() {
    this.closePanel()
    const def = QUESTS['chasse-aux-monstres']!
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    c.add(this.add.rectangle(480, 270, 560, 280, 0x0d1b2a, 0.96))
    c.add(this.add.text(480, 160, def.npcName, { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))

    const render = () => {
      const p = getPlayer()
      refreshQuestProgress(p, def.id)
      for (const child of [...c.list].slice(2)) child.destroy()
      c.add(this.add.text(480, 195, def.name, { fontSize: '17px', color: '#ffd54f' }).setOrigin(0.5))
      c.add(
        this.add.text(480, 222, def.description, { fontSize: '14px', color: '#cfd8dc', wordWrap: { width: 480 } }).setOrigin(0.5),
      )

      const q = p.quests[def.id]
      if (!q) {
        c.add(
          this.add.text(480, 270, 'Accepter la quête', {
            fontSize: '16px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 14, y: 8 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            acceptQuest(p, def.id); save(p); render()
          }),
        )
      } else if (q.claimed) {
        c.add(this.add.text(480, 270, 'Quête terminée. Merci, panda !', { fontSize: '15px', color: '#80cbc4' }).setOrigin(0.5))
      } else if (q.done) {
        c.add(this.add.text(480, 260, `Progression : ${q.progress}/${def.targetCount} — terminée !`, { fontSize: '15px', color: '#ffd700' }).setOrigin(0.5))
        c.add(
          this.add.text(480, 300, `Réclamer la récompense (${def.rewardGold} or)`, {
            fontSize: '16px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 14, y: 8 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (claimQuest(p, def.id)) { save(p); render() }
          }),
        )
      } else {
        c.add(this.add.text(480, 270, `Progression : ${q.progress}/${def.targetCount}`, { fontSize: '15px', color: '#ffd54f' }).setOrigin(0.5))
      }

      c.add(
        this.add.text(480, 380, '← Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 } })
          .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
      )
    }
    render()
  }
}
