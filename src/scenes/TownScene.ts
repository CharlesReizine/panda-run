import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { buyPotion, buyItem } from '../core/shop'
import { canCraft, doCraft } from '../core/craft'
import { canReforge, doReforge, reforgeCost, upgradedBonus, sellItem, sellValue, MAX_REFORGE_LEVEL } from '../core/reforge'
import { acceptQuest, refreshQuestProgress, claimQuest } from '../core/quests'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, HAT_SHOP, QUESTS } from '../data/shops'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import { RECIPES } from '../data/recipes'
import { audio } from '../audio/audio-engine'

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

type SpotKind = 'potions' | 'armes' | 'vetements' | 'forge' | 'quete'

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

// Disposition « place de village » : 4 boutiques aux quatre coins (toutes entièrement visibles
// dans le viewport 960×540), château décoratif au centre en fond, garde de quête planté au
// centre devant. Les zones d'interaction (SPOTS) suivent automatiquement ces coordonnées.
const BUILDINGS: TownBuilding[] = [
  { id: 'potions', name: 'Herboristerie', x: 150, y: 195, w: 148, h: 100, roofColor: 0xc62828, wallColor: 0xffca28 },
  { id: 'vetements', name: 'Boutique de vêtements', x: 810, y: 195, w: 148, h: 100, roofColor: 0x6a1b9a, wallColor: 0xce93d8 },
  { id: 'forge', name: 'Forge', x: 240, y: 405, w: 150, h: 98, roofColor: 0x37474f, wallColor: 0x8d6e63 },
  { id: 'armes', name: 'Armurerie', x: 720, y: 405, w: 150, h: 98, roofColor: 0x455a64, wallColor: 0xb0bec5 },
]

// zone d'interaction du garde, centrée sur son sprite (le PNJ personnage npc-garde)
const QUEST_DOOR = { x: 480, y: 385 }

const SPOTS: TownSpot[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, label: b.name, doorX: b.x, doorY: b.y + b.h / 2 + 10 })),
  { id: 'quete', label: QUESTS['chasse-aux-monstres']!.npcName, doorX: QUEST_DOOR.x, doorY: QUEST_DOOR.y },
]

// illustration rastérisée (public/art/town-*.png) associée à chaque bâtiment ; la porte de
// l'image est calée sur le bas, alignée sur doorY pour rester cohérente avec la zone d'interaction
const BUILDING_TEXTURE: Record<'potions' | 'armes' | 'vetements' | 'forge', string> = {
  potions: 'town-potion',
  armes: 'town-armes',
  vetements: 'town-vetements',
  forge: 'town-forge',
}

// boutiquier posté devant chaque façade (illustration panda détourée npc-<id>, bakée en Preload)
const SHOP_NPC: Record<'potions' | 'armes' | 'vetements' | 'forge', string> = {
  potions: 'npc-herboriste',
  armes: 'npc-armurier',
  vetements: 'npc-tailleur',
  forge: 'npc-forgeron',
}

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private joystick!: TopDownJoystick
  private nearSpot: SpotKind | null = null
  private interactBtn?: Phaser.GameObjects.Text
  private panel?: Phaser.GameObjects.Container
  private feedback?: Phaser.GameObjects.Text

  constructor() { super('Town') }

  preload() {
    this.load.image('town-bg', 'town/bg.png')
    // façades illustrées + PNJ + décors (public/art/town-*.png)
    this.load.image('town-potion', 'art/town-potion.png')
    this.load.image('town-armes', 'art/town-armes.png')
    this.load.image('town-vetements', 'art/town-vetements.png')
    this.load.image('town-forge', 'art/town-forge.png')
    this.load.image('town-chateau', 'art/town-chateau.png')
    this.load.image('town-maison', 'art/town-maison.png')
  }

  create() {
    this.panel = undefined
    this.nearSpot = null

    audio.playMusic('ville')

    this.physics.world.setBounds(0, 0, 960, 540)
    this.cameras.main.setBounds(0, 0, 960, 540)

    // fond illustré (rue pavée + collines) — remplace les anciens aplats de couleur
    this.add.image(480, 270, 'town-bg').setDisplaySize(960, 540)

    // décors non interactifs (pas de collision) posés AVANT les bâtiments : le château au
    // centre en fond, deux maisons dans les intervalles entre boutiques. Placés en premier,
    // ils passent derrière les façades interactives et le panda joueur.
    const placeDecor = (key: string, x: number, baseY: number, width: number) => {
      const img = this.add.image(x, baseY, key).setOrigin(0.5, 1)
      img.setDisplaySize(width, width * (img.height / img.width))
    }
    // château central entièrement visible (taille/baseline bornées sous la bannière) + deux
    // maisons dans les intervalles hauts pour équilibrer la place
    placeDecor('town-chateau', 480, 258, 205)
    placeDecor('town-maison', 320, 182, 104)
    placeDecor('town-maison', 640, 182, 104)

    // bannière du bourg, calée tout en haut au-dessus du château (aucun chevauchement)
    this.add.text(480, 8, 'Prontera', {
      fontSize: '26px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 4,
    }).setOrigin(0.5, 0)

    const wallsGroup = this.physics.add.staticGroup()
    for (const b of BUILDINGS) {
      // corps de collision invisible — emprise identique à l'ancien mur (x, y, w, h)
      const wall = this.add.rectangle(b.x, b.y, b.w, b.h).setVisible(false)
      this.physics.add.existing(wall, true)
      wallsGroup.add(wall)
      // illustration du bâtiment, base (porte) calée sur le bas de la façade (aligne l'entrée
      // visuelle sur la zone d'interaction — inchangée). Hauteur bornée pour que le toit ET le
      // label tiennent dans le viewport (le bâtiment central laisse de la place sous « Prontera »).
      const bottom = b.y + b.h / 2 + 12
      const img = this.add.image(b.x, bottom, BUILDING_TEXTURE[b.id as keyof typeof BUILDING_TEXTURE]).setOrigin(0.5, 1)
      const topClearance = b.x === 480 ? 74 : 40
      const maxH = bottom - topClearance
      let dispW = b.w + 40
      let dispH = dispW * (img.height / img.width)
      if (dispH > maxH) { const s = maxH / dispH; dispW *= s; dispH *= s }
      img.setDisplaySize(dispW, dispH)
      this.add.text(b.x, bottom - dispH - 4, b.name, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 3,
      }).setOrigin(0.5, 1)
      // boutiquier PNJ décoratif planté devant la façade (aucune collision : l'interaction
      // reste sur la zone du bâtiment). Ajouté après la façade → rendu par-dessus.
      this.placeNpc(SHOP_NPC[b.id as keyof typeof SHOP_NPC], b.x, bottom + 34, 96)
    }

    // PNJ de quête : le PERSONNAGE garde (panda à la lance), planté au centre devant sa zone.
    // Décor uniquement — la zone d'interaction reste QUEST_DOOR (voir SPOTS).
    this.placeNpc('npc-garde', QUEST_DOOR.x, 452, 120)
    this.add.text(QUEST_DOOR.x, 328, QUESTS['chasse-aux-monstres']!.npcName, {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 3,
    }).setOrigin(0.5)

    // panneau de sortie — toujours accessible, ramène directement à la carte (coin haut-droit,
    // au-dessus des façades ; le label « Boutique de vêtements » passe nettement dessous)
    this.add.text(900, 22, 'Sortie →', { fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 10, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('WorldMap'))

    // panda joueur — posé un peu en avant du garde pour ne pas le masquer à l'arrivée
    const p = getPlayer()
    this.player = this.physics.add.sprite(560, 480, `panda-${p.classId}`)
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

  // pose un PNJ panda (texture détourée npc-<id>) planté au sol (origine bas-centre), à la
  // hauteur cible voulue en px, aspect conservé. Sans collision : purement décoratif.
  private placeNpc(key: string, x: number, footY: number, height: number) {
    if (!this.textures.exists(key)) return
    const img = this.add.image(x, footY, key).setOrigin(0.5, 1)
    img.setDisplaySize(height * (img.width / img.height), height)
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
    else if (kind === 'vetements') this.openItemShop('vetements', [...ARMOR_SHOP, ...HAT_SHOP])
    else if (kind === 'forge') this.openForge()
    else if (kind === 'quete') this.openQuestNpc()
  }

  private closePanel() {
    this.panel?.destroy()
    this.panel = undefined
  }

  private flash(container: Phaser.GameObjects.Container, x: number, y: number, msg: string, color: string) {
    const txt = this.add.text(x, y, msg, { fontSize: '14px', color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(60)
    container.add(txt)
    this.tweens.add({ targets: txt, y: y - 24, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
  }

  // fond de panneau façon coffre/parchemin, commun aux boutiques — bordure dorée sur bois sombre
  private drawPanelFrame(c: Phaser.GameObjects.Container, w: number, h: number, title: string) {
    c.add(this.add.rectangle(480, 270, 960, 540, 0x000000, 0.45)) // voile derrière le panneau
    c.add(this.add.rectangle(480, 270, w, h, 0x3e2723, 0.97).setStrokeStyle(4, 0xd7a86e, 1))
    c.add(this.add.rectangle(480, 270, w - 12, h - 12, 0xffffff, 0).setStrokeStyle(1, 0xffd54f, 0.35))
    const top = 270 - h / 2
    c.add(this.add.rectangle(480, top + 30, w, 52, 0x2a1a17, 0.9))
    c.add(this.add.text(480, top + 30, title, { fontSize: '22px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5))
    return top
  }

  // pastille or joueur, en haut à droite du panneau — renvoie le texte pour le rafraîchir sans
  // reconstruire tout le panneau (évite de détruire un bouton en pleine animation d'achat)
  private drawGoldBadge(c: Phaser.GameObjects.Container, x: number, y: number, gold: number): Phaser.GameObjects.Text {
    c.add(this.add.rectangle(x, y, 108, 28, 0x1b0f0d, 0.85).setStrokeStyle(1, 0xffd700, 0.7))
    c.add(this.add.image(x - 38, y, 'coin').setScale(1.4))
    const txt = this.add.text(x - 16, y, `${gold} or`, { fontSize: '14px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0, 0.5)
    c.add(txt)
    return txt
  }

  // carte d'objet réutilisable (boutique d'armes/vêtements/potions) : icône, nom, sous-texte,
  // prix + bouton Acheter, avec retour visuel vert/rouge selon le résultat de l'achat ;
  // `onBuy` applique l'achat et renvoie le succès, `onBought` rafraîchit l'affichage (or, stock)
  private drawItemCard(
    c: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number,
    icon: { texture: string } | { pastille: number; glyph: string },
    name: string, sub: string, price: number,
    onBuy: () => boolean,
    onBought: () => void,
  ) {
    const card = this.add.rectangle(x, y, w, h, 0x4e342e, 0.9).setStrokeStyle(2, 0x8d6e63, 1)
    c.add(card)
    const iy = y - h / 2 + 30
    if ('texture' in icon) {
      c.add(this.add.image(x, iy, icon.texture).setDisplaySize(30, 30))
    } else {
      // pas de visuel dédié pour cet objet : pastille colorée par emplacement (arme/armure/accessoire)
      c.add(this.add.circle(x, iy, 15, icon.pastille).setStrokeStyle(2, 0xffffff, 0.6))
      c.add(this.add.text(x, iy, icon.glyph, { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
    }
    c.add(this.add.text(x, y - h / 2 + 52, name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5, 0))
    if (sub) c.add(this.add.text(x, y - h / 2 + 74, sub, { fontSize: '10px', color: '#90a4ae', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5, 0))
    const buyBtn = this.add.text(x, y + h / 2 - 18, `${price} or`, {
      fontSize: '13px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    c.add(buyBtn)
    buyBtn.on('pointerdown', () => {
      if (onBuy()) {
        audio.playSfx('buy')
        onBought()
        this.flash(c, x, y - h / 2 - 4, 'Acheté !', '#66bb6a')
        buyBtn.setBackgroundColor('#66bb6a')
        this.time.delayedCall(150, () => buyBtn.setBackgroundColor('#2e7d32'))
      } else {
        this.flash(c, x, y - h / 2 - 4, "Pas assez d'or !", '#ff5252')
        card.setStrokeStyle(2, 0xff5252, 1)
        this.time.delayedCall(300, () => card.setStrokeStyle(2, 0x8d6e63, 1))
      }
    })
  }

  private openPotionShop() {
    this.closePanel()
    const w = 380, h = 300
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    const top = this.drawPanelFrame(c, w, h, 'Herboristerie')
    const p = getPlayer()
    const goldText = this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
    const stockText = this.add.text(480, top + 96, `Potions en réserve : ${p.potions}`, { fontSize: '14px', color: '#cfd8dc' }).setOrigin(0.5)
    c.add(stockText)
    this.drawItemCard(
      c, 480, top + 190, 200, 130,
      { texture: 'potion-drop' }, 'Potion de soin', 'Restaure des PV en combat', POTION_PRICE,
      () => { const pl = getPlayer(); return buyPotion(pl) },
      () => {
        const pl = getPlayer()
        save(pl)
        goldText.setText(`${pl.gold} or`)
        stockText.setText(`Potions en réserve : ${pl.potions}`)
      },
    )
    c.add(
      this.add.text(480, top + h - 30, '← Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
    )
  }

  // icône par emplacement d'objet : on privilégie l'icône illustrée item-<id> si elle a été
  // bakée ; à défaut les chapeaux ont un visuel dédié (cosmetic-<id>) ; les armes/armures/
  // accessoires retombent sur une pastille colorée + glyphe par slot.
  private iconFor(itemId: string): { texture: string } | { pastille: number; glyph: string } {
    if (this.textures.exists(`item-${itemId}`)) return { texture: `item-${itemId}` }
    const item = ITEMS[itemId]!
    if (item.slot === 'hat') return { texture: `cosmetic-${itemId}` }
    const bySlot = {
      weapon: { pastille: 0xe64a19, glyph: 'ATK' },
      armor: { pastille: 0x1e88e5, glyph: 'DEF' },
      accessory: { pastille: 0x43a047, glyph: 'PV' },
    } as const
    return bySlot[item.slot]
  }

  private openItemShop(kind: 'armes' | 'vetements', list: { itemId: string; price: number }[]) {
    this.closePanel()
    const title = kind === 'armes' ? 'Armurerie' : 'Boutique de vêtements'
    const cols = list.length <= 1 ? 1 : list.length <= 4 ? 2 : 3
    const rows = Math.ceil(list.length / cols)
    const cardW = 168, cardH = 128, gapX = 16, gapY = 14
    const w = Math.max(360, cols * cardW + (cols - 1) * gapX + 60)
    const headerH = 100, footerH = 60
    const h = headerH + rows * cardH + (rows - 1) * gapY + footerH
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    const top = this.drawPanelFrame(c, w, h, title)
    const p = getPlayer()
    const goldText = this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)

    const gridTop = top + headerH
    const gridLeft = 480 - (cols * cardW + (cols - 1) * gapX) / 2 + cardW / 2
    list.forEach((entry, i) => {
      const item = ITEMS[entry.itemId]!
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gridLeft + col * (cardW + gapX)
      const y = gridTop + row * (cardH + gapY) + cardH / 2
      const bonus = Object.entries(item.bonus).map(([k, v]) => `${k} +${v}`).join(' / ')
      this.drawItemCard(
        c, x, y, cardW, cardH,
        this.iconFor(entry.itemId), item.name, bonus, entry.price,
        () => { const pl = getPlayer(); return buyItem(pl, entry.itemId, entry.price) },
        () => { const pl = getPlayer(); save(pl); goldText.setText(`${pl.gold} or`) },
      )
    })

    c.add(
      this.add.text(480, top + h - 28, '← Fermer', {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
    )
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

  // libellé court d'un matériau (premier mot du nom) pour les puces de coût de la forge
  private shortMat(id: string): string {
    const m = MATERIALS[id]
    return (m?.name ?? id).split(' ')[0]!
  }

  // Forge : trois onglets partagent le même bâtiment — Forger (craft), Réforger (améliorer une
  // pièce) et Vendre (revendre un objet de l'inventaire). openForge() ouvre l'onglet craft.
  private openForge() { this.openForgePanel('craft') }

  private openForgePanel(tab: 'craft' | 'reforge' | 'sell') {
    this.closePanel()
    const c = this.add.container(0, 0).setDepth(50)
    this.panel = c
    if (tab === 'craft') this.renderCraft(c)
    else if (tab === 'reforge') this.renderReforge(c)
    else this.renderSell(c)
  }

  // barre d'onglets commune aux trois panneaux de la forge, sous le titre
  private drawForgeTabs(c: Phaser.GameObjects.Container, top: number, active: 'craft' | 'reforge' | 'sell') {
    const tabs: { id: 'craft' | 'reforge' | 'sell'; label: string }[] = [
      { id: 'craft', label: 'Forger' },
      { id: 'reforge', label: 'Réforger' },
      { id: 'sell', label: 'Vendre' },
    ]
    const tw = 128, gap = 10
    const totalW = tabs.length * tw + (tabs.length - 1) * gap
    let x = 480 - totalW / 2 + tw / 2
    for (const tab of tabs) {
      const on = tab.id === active
      const btn = this.add.text(x, top + 74, tab.label, {
        fontSize: '15px', color: on ? '#ffd54f' : '#cfd8dc',
        backgroundColor: on ? '#5d4037' : '#3a2b28', fontStyle: on ? 'bold' : 'normal',
        padding: { x: 14, y: 6 },
      }).setOrigin(0.5)
      c.add(btn)
      if (!on) btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openForgePanel(tab.id))
      x += tw + gap
    }
  }

  // Forger : transforme les matériaux collectés en équipement. Une ligne par recette avec
  // icône du résultat, nom + bonus, coût (possédé/requis en vert/rouge + or) et bouton Forger
  // actif seulement si canCraft. renderCraft() reconstruit tout après un craft pour rafraîchir.
  private renderCraft(c: Phaser.GameObjects.Container, msg?: string, ok?: boolean) {
    const w = 860
    const rowH = 44
    const headerH = 140, footerH = 56
    const h = headerH + RECIPES.length * rowH + footerH

    {
      c.removeAll(true)
      const top = this.drawPanelFrame(c, w, h, 'Forge')
      const p = getPlayer()
      this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
      this.drawForgeTabs(c, top, 'craft')

      // récap des matériaux possédés
      const owned = Object.entries(p.materials).filter(([, q]) => q > 0)
      const recap = owned.length
        ? owned.map(([id, q]) => `${this.shortMat(id)} x${q}`).join('   ·   ')
        : 'Aucun matériau collecté — va combattre pour en récolter !'
      c.add(this.add.text(480, top + 108, recap, {
        fontSize: '12px', color: '#cfd8dc', align: 'center', wordWrap: { width: w - 48 },
      }).setOrigin(0.5))

      const render = (m?: string, o?: boolean) => this.renderCraft(c, m, o)
      const rowsTop = top + headerH
      const rowLeft = 480 - w / 2 + 16
      RECIPES.forEach((recipe, i) => {
        const y = rowsTop + i * rowH + rowH / 2
        const item = ITEMS[recipe.resultItemId]!
        const craftable = canCraft(p, recipe)

        if (i > 0) c.add(this.add.rectangle(480, y - rowH / 2, w - 40, 1, 0xffffff, 0.08))

        // icône du résultat
        const icon = this.iconFor(recipe.resultItemId)
        if ('texture' in icon) c.add(this.add.image(rowLeft + 18, y, icon.texture).setDisplaySize(28, 28))
        else {
          c.add(this.add.circle(rowLeft + 18, y, 13, icon.pastille).setStrokeStyle(2, 0xffffff, 0.6))
          c.add(this.add.text(rowLeft + 18, y, icon.glyph, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
        }

        // nom + bonus
        c.add(this.add.text(rowLeft + 42, y - 10, item.name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5))
        const bonus = Object.entries(item.bonus).map(([k, v]) => `${k} +${v}`).join(' / ')
        c.add(this.add.text(rowLeft + 42, y + 9, bonus, { fontSize: '10px', color: '#90a4ae' }).setOrigin(0, 0.5))

        // coût : puces matériaux + or
        let cx = rowLeft + 250
        for (const [matId, qty] of Object.entries(recipe.materials)) {
          const have = p.materials[matId] ?? 0
          const enough = have >= qty
          const t = this.add.text(cx, y, `${this.shortMat(matId)} ${have}/${qty}`, {
            fontSize: '11px', color: enough ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
          }).setOrigin(0, 0.5)
          c.add(t)
          cx += t.width + 14
        }
        if (recipe.gold) {
          const t = this.add.text(cx, y, `${recipe.gold} or`, {
            fontSize: '11px', color: p.gold >= recipe.gold ? '#ffd54f' : '#ff5252', fontStyle: 'bold',
          }).setOrigin(0, 0.5)
          c.add(t)
        }

        // bouton Forger
        const btn = this.add.text(480 + w / 2 - 24, y, 'Forger', {
          fontSize: '13px', color: craftable ? '#ffffff' : '#9e9e9e',
          backgroundColor: craftable ? '#2e7d32' : '#3a2b28', padding: { x: 12, y: 6 },
        }).setOrigin(1, 0.5)
        c.add(btn)
        if (craftable) {
          btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (doCraft(p, recipe)) {
              audio.playSfx('buy')
              save(p)
              render(`Forgé : ${item.name} !`, true)
            } else render('Ressources insuffisantes', false)
          })
        } else {
          btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => render('Ressources insuffisantes', false))
        }
      })

      // message de retour (résultat du dernier craft)
      if (msg) c.add(this.add.text(480, top + h - 54, msg, {
        fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
      }).setOrigin(0.5))

      c.add(this.add.text(480, top + h - 28, '← Fermer', {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
    }
  }

  // pièces réforçables : itemIds uniques de l'équipement porté + de l'inventaire
  private reforgeableIds(): string[] {
    const p = getPlayer()
    const ids = [...Object.values(p.equipment), ...p.inventory].filter((id): id is string => !!id && !!ITEMS[id])
    return [...new Set(ids)]
  }

  // Réforger : améliore une pièce d'un cran (+20 % de bonus / niveau, cap au niveau max). Une
  // ligne par pièce avec son niveau, l'effet actuel → suivant, le coût (or + matériaux) et un
  // bouton actif si canReforge. renderReforge() reconstruit tout après une réforge.
  private renderReforge(c: Phaser.GameObjects.Container, msg?: string, ok?: boolean) {
    c.removeAll(true)
    const w = 860
    const rowH = 46
    const headerH = 140, footerH = 56
    const ids = this.reforgeableIds()
    const rows = Math.max(ids.length, 1)
    const h = headerH + rows * rowH + footerH
    const top = this.drawPanelFrame(c, w, h, 'Forge')
    const p = getPlayer()
    this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
    this.drawForgeTabs(c, top, 'reforge')

    const owned = Object.entries(p.materials).filter(([, q]) => q > 0)
    const recap = owned.length
      ? owned.map(([id, q]) => `${this.shortMat(id)} x${q}`).join('   ·   ')
      : 'Aucun matériau collecté — va combattre pour en récolter !'
    c.add(this.add.text(480, top + 108, recap, {
      fontSize: '12px', color: '#cfd8dc', align: 'center', wordWrap: { width: w - 48 },
    }).setOrigin(0.5))

    const render = (m?: string, o?: boolean) => this.renderReforge(c, m, o)
    const rowsTop = top + headerH
    const rowLeft = 480 - w / 2 + 16

    if (ids.length === 0) {
      c.add(this.add.text(480, rowsTop + rowH / 2, 'Aucune pièce à réforger.', {
        fontSize: '14px', color: '#90a4ae',
      }).setOrigin(0.5))
    }

    ids.forEach((id, i) => {
      const y = rowsTop + i * rowH + rowH / 2
      const item = ITEMS[id]!
      const level = p.upgrades[id] ?? 0
      const atMax = level >= MAX_REFORGE_LEVEL
      const canDo = canReforge(p, id)

      if (i > 0) c.add(this.add.rectangle(480, y - rowH / 2, w - 40, 1, 0xffffff, 0.08))

      // icône
      const icon = this.iconFor(id)
      if ('texture' in icon) c.add(this.add.image(rowLeft + 18, y, icon.texture).setDisplaySize(28, 28))
      else {
        c.add(this.add.circle(rowLeft + 18, y, 13, icon.pastille).setStrokeStyle(2, 0xffffff, 0.6))
        c.add(this.add.text(rowLeft + 18, y, icon.glyph, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
      }

      // nom + niveau, puis effet actuel → suivant
      const nameTxt = level > 0 ? `${item.name} +${level}` : item.name
      c.add(this.add.text(rowLeft + 42, y - 10, `${nameTxt}  (Nv ${level}/${MAX_REFORGE_LEVEL})`, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0, 0.5))
      const cur = upgradedBonus(item.bonus, level)
      const bonusStr = atMax
        ? Object.entries(cur).map(([k, v]) => `${k} +${v}`).join(' / ')
        : (() => {
            const next = upgradedBonus(item.bonus, level + 1)
            return Object.keys(item.bonus).map((k) => `${k} +${cur[k as keyof typeof cur]}→+${next[k as keyof typeof next]}`).join(' / ')
          })()
      c.add(this.add.text(rowLeft + 42, y + 9, bonusStr, { fontSize: '10px', color: '#90a4ae' }).setOrigin(0, 0.5))

      // coût de la prochaine réforge
      if (!atMax) {
        const cost = reforgeCost(level)
        let cx = rowLeft + 330
        for (const [matId, qty] of Object.entries(cost.materials)) {
          const have = p.materials[matId] ?? 0
          const t = this.add.text(cx, y, `${this.shortMat(matId)} ${have}/${qty}`, {
            fontSize: '11px', color: have >= qty ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
          }).setOrigin(0, 0.5)
          c.add(t)
          cx += t.width + 14
        }
        const g = this.add.text(cx, y, `${cost.gold} or`, {
          fontSize: '11px', color: p.gold >= cost.gold ? '#ffd54f' : '#ff5252', fontStyle: 'bold',
        }).setOrigin(0, 0.5)
        c.add(g)
      } else {
        c.add(this.add.text(rowLeft + 330, y, 'Niveau max', { fontSize: '11px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0, 0.5))
      }

      // bouton Réforger
      const btn = this.add.text(480 + w / 2 - 24, y, atMax ? 'Max' : 'Réforger', {
        fontSize: '13px', color: canDo ? '#ffffff' : '#9e9e9e',
        backgroundColor: canDo ? '#2e7d32' : '#3a2b28', padding: { x: 12, y: 6 },
      }).setOrigin(1, 0.5)
      c.add(btn)
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (doReforge(p, id)) {
          audio.playSfx('buy')
          save(p)
          render(`${item.name} réforgé au +${(p.upgrades[id] ?? 0)} !`, true)
        } else render(atMax ? 'Niveau max atteint' : 'Ressources insuffisantes', false)
      })
    })

    if (msg) c.add(this.add.text(480, top + h - 54, msg, {
      fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
    }).setOrigin(0.5))

    c.add(this.add.text(480, top + h - 28, '← Fermer', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
  }

  // Vendre : revend un objet de l'inventaire contre de l'or (selon sa rareté). Une ligne par
  // objet avec son prix de vente et un bouton Vendre. renderSell() reconstruit tout après une vente.
  private renderSell(c: Phaser.GameObjects.Container, msg?: string, ok?: boolean) {
    c.removeAll(true)
    const w = 860
    const rowH = 44
    const headerH = 132, footerH = 56
    const p = getPlayer()
    const rows = Math.max(p.inventory.length, 1)
    const h = headerH + rows * rowH + footerH
    const top = this.drawPanelFrame(c, w, h, 'Forge')
    this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
    this.drawForgeTabs(c, top, 'sell')
    c.add(this.add.text(480, top + 104, 'Revends les objets de ton inventaire non équipé.', {
      fontSize: '12px', color: '#cfd8dc', align: 'center',
    }).setOrigin(0.5))

    const render = (m?: string, o?: boolean) => this.renderSell(c, m, o)
    const rowsTop = top + headerH
    const rowLeft = 480 - w / 2 + 16

    if (p.inventory.length === 0) {
      c.add(this.add.text(480, rowsTop + rowH / 2, 'Inventaire vide.', {
        fontSize: '14px', color: '#90a4ae',
      }).setOrigin(0.5))
    }

    p.inventory.forEach((id, i) => {
      const y = rowsTop + i * rowH + rowH / 2
      const item = ITEMS[id]!
      const level = p.upgrades[id] ?? 0

      if (i > 0) c.add(this.add.rectangle(480, y - rowH / 2, w - 40, 1, 0xffffff, 0.08))

      const icon = this.iconFor(id)
      if ('texture' in icon) c.add(this.add.image(rowLeft + 18, y, icon.texture).setDisplaySize(28, 28))
      else {
        c.add(this.add.circle(rowLeft + 18, y, 13, icon.pastille).setStrokeStyle(2, 0xffffff, 0.6))
        c.add(this.add.text(rowLeft + 18, y, icon.glyph, { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
      }

      const nameTxt = level > 0 ? `${item.name} +${level}` : item.name
      c.add(this.add.text(rowLeft + 42, y - 10, nameTxt, { fontSize: '13px', color: `#${rarityColor(item.rarity).toString(16).padStart(6, '0')}`, fontStyle: 'bold' }).setOrigin(0, 0.5))
      const bonus = Object.entries(item.bonus).map(([k, v]) => `${k} +${v}`).join(' / ')
      c.add(this.add.text(rowLeft + 42, y + 9, bonus, { fontSize: '10px', color: '#90a4ae' }).setOrigin(0, 0.5))

      c.add(this.add.text(rowLeft + 360, y, `${sellValue(item)} or`, {
        fontSize: '12px', color: '#ffd54f', fontStyle: 'bold',
      }).setOrigin(0, 0.5))

      const btn = this.add.text(480 + w / 2 - 24, y, 'Vendre', {
        fontSize: '13px', color: '#ffffff', backgroundColor: '#8e2f2f', padding: { x: 12, y: 6 },
      }).setOrigin(1, 0.5)
      c.add(btn)
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const value = sellValue(item)
        if (sellItem(p, i)) {
          audio.playSfx('buy')
          save(p)
          render(`Vendu : ${item.name} (+${value} or)`, true)
        }
      })
    })

    if (msg) c.add(this.add.text(480, top + h - 54, msg, {
      fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
    }).setOrigin(0.5))

    c.add(this.add.text(480, top + h - 28, '← Fermer', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
  }
}
