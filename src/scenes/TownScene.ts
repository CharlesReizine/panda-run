import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { buyPotion, buyItem } from '../core/shop'
import { canCraft, doCraft } from '../core/craft'
import { canReforge, doReforge, reforgeCost, upgradedBonus, sellItem, sellValue, MAX_REFORGE_LEVEL } from '../core/reforge'
import { acceptQuest, refreshQuestProgress, claimQuest, currentChainQuest } from '../core/quests'
import { POTION_PRICE, WEAPON_SHOP, ARMOR_SHOP, HAT_SHOP, QUEST_CHAIN, type QuestDef, type ShopItemDef } from '../data/shops'
import { WORLD_NODES } from '../data/worldmap'
import { ITEMS, rarityColor, SLOT_ORDER, SLOT_LABEL_PLURAL } from '../data/items'
import type { EquipSlot } from '../core/types'
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
type BuildingKind = 'potions' | 'armes' | 'vetements' | 'forge'
type TownTheme = 'europeen' | 'marocain'

interface TownSpot {
  id: SpotKind
  label: string
  doorX: number
  doorY: number
}

interface TownBuilding {
  id: BuildingKind
  name: string
  x: number
  y: number
  w: number
  h: number
}

// Chaque ville est plus GRANDE que le viewport (960×540) : la caméra suit le panda et on se
// balade dans les 4 directions. Palette + disposition + décor sont propres au thème pour que
// Prontera (européen médiéval) et Morroc (marocain, désert) ne se ressemblent en rien.
interface ThemeConfig {
  worldW: number
  worldH: number
  buildings: TownBuilding[]
  questDoor: { x: number; y: number }
  playerStart: { x: number; y: number }
  subtitle: string
  groundTop: number
  groundBottom: number
  plaza: number
  plazaLine: number
  accent: number // bannières / dômes / auvents
  buildingTint: number // teinte des façades FALLBACK (art non encore thématisé)
  bannerFill: string
  bannerStroke: string
}

const BUILDING_NAME: Record<BuildingKind, string> = {
  potions: 'Herboristerie',
  vetements: 'Boutique de vêtements',
  forge: 'Forge',
  armes: 'Armurerie',
}

// Prontera — bourg européen médiéval : quatre boutiques disposées en carré autour d'une grande
// place pavée, château + maisons à colombage en fond, bannières bleu-sarcelle, arbres, fontaine.
const THEME_EUROPEEN: ThemeConfig = {
  worldW: 1440, worldH: 860,
  buildings: [
    { id: 'potions', name: BUILDING_NAME.potions, x: 300, y: 300, w: 152, h: 100 },
    { id: 'vetements', name: BUILDING_NAME.vetements, x: 1140, y: 300, w: 152, h: 100 },
    { id: 'forge', name: BUILDING_NAME.forge, x: 300, y: 660, w: 152, h: 100 },
    { id: 'armes', name: BUILDING_NAME.armes, x: 1140, y: 660, w: 152, h: 100 },
  ],
  questDoor: { x: 720, y: 600 },
  playerStart: { x: 720, y: 760 },
  subtitle: 'Cité royale',
  groundTop: 0x93c25a, groundBottom: 0x6fa03e,
  plaza: 0xbcb3a2, plazaLine: 0x8d8577,
  accent: 0x00838f,
  buildingTint: 0xffffff,
  bannerFill: '#00695c', bannerStroke: '#e0f2f1',
}

// Morroc — cité marocaine du désert : souk aux boutiques dispersées en biais, palais à dôme et
// arches en fond, palmiers, lanternes suspendues, auvents à rayures, sol d'adobe ocre.
const THEME_MAROCAIN: ThemeConfig = {
  worldW: 1440, worldH: 860,
  buildings: [
    { id: 'potions', name: BUILDING_NAME.potions, x: 250, y: 340, w: 152, h: 100 },
    { id: 'armes', name: BUILDING_NAME.armes, x: 480, y: 250, w: 152, h: 100 },
    { id: 'vetements', name: BUILDING_NAME.vetements, x: 1010, y: 320, w: 152, h: 100 },
    { id: 'forge', name: BUILDING_NAME.forge, x: 760, y: 690, w: 152, h: 100 },
  ],
  questDoor: { x: 330, y: 660 },
  playerStart: { x: 620, y: 780 },
  subtitle: 'Cité des sables',
  groundTop: 0xe6c27c, groundBottom: 0xcaa257,
  plaza: 0xd9a86a, plazaLine: 0xa9743b,
  accent: 0xd84315,
  buildingTint: 0xf3b878,
  bannerFill: '#bf360c', bannerStroke: '#ffe0b2',
}

const THEMES: Record<TownTheme, ThemeConfig> = { europeen: THEME_EUROPEEN, marocain: THEME_MAROCAIN }

// illustration rastérisée de secours (public/art/town-*.png) associée à chaque bâtiment ; sert de
// FALLBACK quand l'art thématisé town-<townId>-<bâtiment>.png n'existe pas encore.
const BUILDING_TEXTURE: Record<BuildingKind, string> = {
  potions: 'town-potion',
  armes: 'town-armes',
  vetements: 'town-vetements',
  forge: 'town-forge',
}

// boutiquier posté devant chaque façade (illustration panda détourée npc-<id>, bakée en Preload)
const SHOP_NPC: Record<BuildingKind, string> = {
  potions: 'npc-herboriste',
  armes: 'npc-armurier',
  vetements: 'npc-tailleur',
  forge: 'npc-forgeron',
}

// interpolation linéaire entre deux couleurs 0xRRGGBB (bandes de dégradé du sol)
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private joystick!: TopDownJoystick
  private nearSpot: SpotKind | null = null
  private interactBtn?: Phaser.GameObjects.Text
  private panel?: Phaser.GameObjects.Container
  private feedback?: Phaser.GameObjects.Text
  private townId = 'prontera'
  private cfg: ThemeConfig = THEME_EUROPEEN
  private spots: TownSpot[] = []

  constructor() { super('Town') }

  // ville courante (nœud carte) + son thème visuel ; défaut Prontera/européen si introuvable
  private resolveTown() {
    this.townId = getPlayer().currentNode
    const node = WORLD_NODES.find((n) => n.id === this.townId)
    const theme: TownTheme = node?.theme ?? 'europeen'
    this.cfg = THEMES[theme]
    return { node, theme }
  }

  preload() {
    this.resolveTown()
    this.load.image('town-bg', 'town/bg.png')
    // façades de secours + PNJ + décors (public/art/town-*.png)
    this.load.image('town-potion', 'art/town-potion.png')
    this.load.image('town-armes', 'art/town-armes.png')
    this.load.image('town-vetements', 'art/town-vetements.png')
    this.load.image('town-forge', 'art/town-forge.png')
    this.load.image('town-chateau', 'art/town-chateau.png')
    this.load.image('town-maison', 'art/town-maison.png')
    // art thématisé par ville (généré plus tard) : town-<townId>-<bâtiment>.png + fond. Chargé de
    // façon optionnelle — les 404 sont ignorés, le code retombe sur les façades de secours ci-dessus
    // et se met à niveau automatiquement dès que ces images existent.
    this.load.on('loaderror', () => { /* art thématisé pas encore fourni : fallback assuré */ })
    for (const b of ['potions', 'armes', 'vetements', 'forge'] as const) {
      this.load.image(`town-${this.townId}-${b}`, `art/town-${this.townId}-${b}.png`)
    }
    this.load.image(`town-${this.townId}-bg`, `art/town-${this.townId}-bg.png`)
  }

  create() {
    this.panel = undefined
    this.nearSpot = null
    const { node, theme } = this.resolveTown()
    const cfg = this.cfg
    const townName = node?.name ?? 'Ville'

    audio.playMusic('ville')

    this.physics.world.setBounds(0, 0, cfg.worldW, cfg.worldH)
    this.cameras.main.setBounds(0, 0, cfg.worldW, cfg.worldH)

    this.drawGround(cfg)
    this.drawThemeDecor(theme, cfg)

    // zones d'interaction dérivées de la disposition de CE thème (portes de boutiques + garde)
    this.spots = [
      ...cfg.buildings.map((b) => ({ id: b.id as SpotKind, label: b.name, doorX: b.x, doorY: b.y + b.h / 2 + 10 })),
      { id: 'quete', label: QUEST_CHAIN[0]!.npcName, doorX: cfg.questDoor.x, doorY: cfg.questDoor.y },
    ]

    const wallsGroup = this.physics.add.staticGroup()
    for (const b of cfg.buildings) {
      // corps de collision invisible — emprise du bâtiment (x, y, w, h)
      const wall = this.add.rectangle(b.x, b.y, b.w, b.h).setVisible(false)
      this.physics.add.existing(wall, true)
      wallsGroup.add(wall)
      // façade : art thématisé town-<townId>-<id> si présent, sinon secours town-<id> TEINTÉ au
      // thème (pour distinguer les villes dès maintenant). Base calée sur le bas = zone d'interaction.
      const bottom = b.y + b.h / 2 + 12
      const themedKey = `town-${this.townId}-${b.id}`
      const useThemed = this.textures.exists(themedKey)
      const img = this.add.image(b.x, bottom, useThemed ? themedKey : BUILDING_TEXTURE[b.id]).setOrigin(0.5, 1)
      if (!useThemed) img.setTint(cfg.buildingTint)
      let dispW = b.w + 44
      let dispH = dispW * (img.height / img.width)
      const maxH = 210
      if (dispH > maxH) { const s = maxH / dispH; dispW *= s; dispH *= s }
      img.setDisplaySize(dispW, dispH)
      this.add.text(b.x, bottom - dispH - 4, b.name, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 3,
      }).setOrigin(0.5, 1)
      // boutiquier PNJ décoratif planté devant la façade (aucune collision). Rendu par-dessus.
      this.placeNpc(SHOP_NPC[b.id], b.x, bottom + 34, 96)
    }

    // PNJ de quête : le garde (panda à la lance), planté devant sa zone. Décor uniquement.
    this.placeNpc('npc-garde', cfg.questDoor.x, cfg.questDoor.y + 66, 120)
    this.add.text(cfg.questDoor.x, cfg.questDoor.y - 58, QUEST_CHAIN[0]!.npcName, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 3,
    }).setOrigin(0.5)

    // marqueur de quête flottant au-dessus du garde : « ❗ » si la quête courante de la chaîne est à
    // PRENDRE, « ❓ » si sa récompense est PRÊTE à réclamer. Rien tant qu'elle est en cours ou que
    // toute la chaîne est accomplie.
    const qp = getPlayer()
    const qdef = currentChainQuest(qp)
    let questMark: string | null = null
    if (qdef) {
      refreshQuestProgress(qp, qdef.id)
      const qs = qp.quests[qdef.id]
      questMark = !qs ? '❗' : (qs.done && !qs.claimed ? '❓' : null)
    }
    if (questMark) {
      const mk = this.add.text(cfg.questDoor.x, cfg.questDoor.y - 88, questMark, {
        fontSize: '32px', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(6)
      this.tweens.add({ targets: mk, y: mk.y - 9, yoyo: true, repeat: -1, duration: 640, ease: 'Sine.inOut' })
    }

    // — HUD écran-fixe (scrollFactor 0) : la caméra suivant le panda, ces éléments restent collés —
    // bannière du bourg (nom + sous-titre thématique) en haut au centre
    this.add.text(480, 10, townName, {
      fontSize: '26px', color: '#ffffff', fontStyle: 'bold', stroke: '#3e2723', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(35)
    this.add.text(480, 40, cfg.subtitle, {
      fontSize: '13px', color: cfg.bannerStroke, fontStyle: 'italic', stroke: '#3e2723', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(35)

    // panneau de sortie — toujours accessible, ramène directement à la carte (coin haut-droit)
    this.add.text(900, 22, 'Sortie →', { fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 10, y: 6 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(35).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('WorldMap'))

    // panda joueur + caméra qui le suit (la ville est plus grande que l'écran → on se balade)
    const p = getPlayer()
    this.player = this.physics.add.sprite(cfg.playerStart.x, cfg.playerStart.y, `panda-${p.classId}`)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.player.setCollideWorldBounds(true)
    // hitbox recentrée dans le cadre élargi PANDA_TEX (w 96) : (96-34)/2 = 31
    this.player.setSize(34, 40).setOffset(31, 46)
    this.player.setDepth(5)
    this.player.play(`panda-${p.classId}-idle`)
    this.physics.add.collider(this.player, wallsGroup)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.addPointer(1)
    this.joystick = new TopDownJoystick(this, new Phaser.Geom.Rectangle(0, 80, 480, 460))

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
    const img = this.add.image(x, footY, key).setOrigin(0.5, 1).setDepth(2)
    img.setDisplaySize(height * (img.width / img.height), height)
  }

  // ————— Sol et décor procéduraux, teintés au thème (villes visuellement distinctes dès maintenant) —————

  private drawGround(cfg: ThemeConfig) {
    const g = this.add.graphics().setDepth(-10)
    const bands = 18
    for (let i = 0; i < bands; i++) {
      const col = lerpColor(cfg.groundTop, cfg.groundBottom, i / (bands - 1))
      g.fillStyle(col, 1).fillRect(0, (cfg.worldH / bands) * i, cfg.worldW, cfg.worldH / bands + 1)
    }
    // grande place centrale carrelée (pavés européens / adobe marocain selon la palette)
    const px = cfg.worldW / 2, py = cfg.worldH / 2
    const pw = cfg.worldW - 260, ph = cfg.worldH - 300
    g.fillStyle(cfg.plaza, 1).fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 28)
    g.lineStyle(2, cfg.plazaLine, 0.55)
    for (let x = px - pw / 2; x <= px + pw / 2; x += 64) g.lineBetween(x, py - ph / 2, x, py + ph / 2)
    for (let y = py - ph / 2; y <= py + ph / 2; y += 64) g.lineBetween(px - pw / 2, y, px + pw / 2, y)
    g.lineStyle(4, cfg.plazaLine, 0.8).strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 28)
  }

  private drawThemeDecor(theme: TownTheme, cfg: ThemeConfig) {
    const g = this.add.graphics().setDepth(-5)
    if (theme === 'europeen') {
      // château + maisons à colombage en fond
      this.placeDecor('town-chateau', cfg.worldW / 2, 250, 300)
      this.placeDecor('town-maison', cfg.worldW / 2 - 330, 210, 150)
      this.placeDecor('town-maison', cfg.worldW / 2 + 330, 210, 150)
      // fontaine au centre de la place
      const fx = cfg.worldW / 2, fy = cfg.worldH / 2 + 20
      g.fillStyle(0x9e9e9e, 1).fillCircle(fx, fy, 44)
      g.fillStyle(0x4fc3f7, 1).fillCircle(fx, fy, 32)
      g.fillStyle(0xbdbdbd, 1).fillCircle(fx, fy, 12)
      // bannières bleu-sarcelle plantées aux abords de la place + arbres en périphérie
      for (const [bx, by] of [[300, 470], [1140, 470], [560, 700], [880, 700]] as const) this.drawBanner(g, bx, by, cfg.accent)
      for (const [tx, ty] of [[150, 780], [1290, 780], [150, 470], [1290, 470], [720, 800]] as const) this.drawTree(g, tx, ty)
    } else {
      // palais à dôme + arches en fond (centre-haut laissé libre par la disposition du souk)
      this.drawPalace(g, cfg.worldW / 2, 220)
      // palmiers dispersés
      for (const [tx, ty] of [[150, 780], [1300, 760], [180, 500], [1280, 500], [470, 800], [900, 500]] as const) this.drawPalm(g, tx, ty)
      // lanternes suspendues (halo chaud) en haut de la place
      for (const lx of [560, 720, 880, 1040]) this.drawLantern(g, lx, 380)
      // auvents à rayures du souk au-dessus des boutiques
      for (const [ax, ay] of [[250, 288], [480, 198], [1010, 268], [760, 638]] as const) this.drawAwning(g, ax, ay, cfg.accent)
    }
  }

  private placeDecor(key: string, x: number, baseY: number, width: number) {
    if (!this.textures.exists(key)) return
    const img = this.add.image(x, baseY, key).setOrigin(0.5, 1).setDepth(-4)
    img.setDisplaySize(width, width * (img.height / img.width))
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x795548, 1).fillRect(x - 7, y - 30, 14, 30)
    g.fillStyle(0x2e7d32, 1).fillCircle(x, y - 46, 26)
    g.fillStyle(0x388e3c, 1).fillCircle(x - 20, y - 34, 18)
    g.fillStyle(0x43a047, 1).fillCircle(x + 20, y - 34, 18)
  }

  private drawPalm(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x8d6e3f, 1).fillRect(x - 6, y - 78, 12, 78)
    g.fillStyle(0x2e7d32, 1)
    const top = y - 78
    for (const dx of [-46, -26, 26, 46]) g.fillTriangle(x, top, x + dx, top - 16, x + dx * 0.7, top + 10)
    g.fillTriangle(x, top - 30, x - 14, top, x + 14, top)
    g.fillStyle(0x6d4c41, 1).fillCircle(x - 6, top + 4, 4).fillCircle(x + 6, top + 8, 4) // noix de coco
  }

  private drawLantern(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.lineStyle(2, 0x5d4037, 1).lineBetween(x, y - 34, x, y)
    g.fillStyle(0xffb300, 0.28).fillCircle(x, y + 8, 18) // halo
    g.fillStyle(0xffca28, 1).fillCircle(x, y + 8, 11)
    g.fillStyle(0xff8f00, 1).fillCircle(x, y + 8, 5)
    g.fillStyle(0x6d4c41, 1).fillRect(x - 6, y - 2, 12, 4).fillRect(x - 4, y + 16, 8, 5)
  }

  private drawBanner(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    g.lineStyle(4, 0x5d4037, 1).lineBetween(x, y, x, y - 66)
    g.fillStyle(color, 1).fillTriangle(x + 2, y - 66, x + 2, y - 42, x + 40, y - 54)
    g.fillStyle(0xffd54f, 1).fillCircle(x, y - 66, 4)
  }

  private drawAwning(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    const w = 108, stripes = 6, sw = w / stripes
    for (let i = 0; i < stripes; i++) {
      g.fillStyle(i % 2 === 0 ? color : 0xfff3e0, 1)
      g.fillTriangle(x - w / 2 + i * sw, y, x - w / 2 + (i + 1) * sw, y, x - w / 2 + i * sw + sw / 2, y + 20)
    }
    g.fillStyle(color, 1).fillRect(x - w / 2, y - 6, w, 8)
  }

  // dôme bulbe (« oignon ») : demi-ellipse pleine + pointe effilée + liseré, sur une base cubique
  private drawDome(g: Phaser.GameObjects.Graphics, x: number, baseY: number, rw: number, rh: number, fill: number) {
    g.fillStyle(fill, 1).fillEllipse(x, baseY, rw * 2, rh * 2)
    g.fillStyle(fill, 1).fillRect(x - rw, baseY, rw * 2, rh * 0.5) // raccord bombé/base
    g.fillTriangle(x - rw * 0.5, baseY - rh * 1.4, x + rw * 0.5, baseY - rh * 1.4, x, baseY - rh * 2) // pointe
    g.lineStyle(3, 0x7d3a17, 1).strokeEllipse(x, baseY, rw * 2, rh * 2)
  }

  private drawPalace(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // corps adobe
    g.fillStyle(0xcf9b5f, 1).fillRect(x - 150, y - 110, 300, 110)
    g.lineStyle(4, 0xa9743b, 1).strokeRect(x - 150, y - 110, 300, 110)
    // deux dômes latéraux puis le grand dôme central par-dessus + croissant doré
    for (const dx of [-118, 118]) this.drawDome(g, x + dx, y - 110, 46, 42, 0xd88a4a)
    this.drawDome(g, x, y - 110, 74, 66, 0xc85a2a)
    g.lineStyle(3, 0x7d3a17, 1).lineBetween(x, y - 110 - 132, x, y - 110 - 158)
    g.fillStyle(0xffd54f, 1).fillCircle(x, y - 110 - 164, 8)
    // arches sombres (portail + fenêtres)
    g.fillStyle(0x5d3a1a, 1)
    g.fillRoundedRect(x - 34, y - 92, 68, 92, { tl: 34, tr: 34, bl: 0, br: 0 })
    for (const dx of [-104, 104]) g.fillRoundedRect(x + dx - 22, y - 80, 44, 70, { tl: 22, tr: 22, bl: 0, br: 0 })
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
    for (const s of this.spots) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.doorX, s.doorY)
      if (d <= closestDist) { closest = s.id; closestDist = d }
    }
    if (closest !== this.nearSpot) {
      this.nearSpot = closest
      this.interactBtn?.destroy()
      this.interactBtn = undefined
      if (closest) {
        const spot = this.spots.find((s) => s.id === closest)!
        this.interactBtn = this.add.text(480, 500, `Parler — ${spot.label}`, {
          fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openSpot(closest!))
      }
    }
  }

  private openSpot(kind: SpotKind) {
    if (kind === 'potions') this.openPotionShop()
    // armurerie = ARMES + ARMURES (le tri par type les regroupe) ; tailleur = CHAPEAUX/cosmétiques
    else if (kind === 'armes') this.openItemShop('armes', [...WEAPON_SHOP, ...ARMOR_SHOP])
    else if (kind === 'vetements') this.openItemShop('vetements', HAT_SHOP)
    else if (kind === 'forge') this.openForge()
    else if (kind === 'quete') this.openQuestNpc()
  }

  private closePanel() {
    this.panel?.destroy()
    this.panel = undefined
  }

  // Croix de fermeture, position ÉCRAN FIXE en haut à droite du panneau (coordonnées absolues,
  // au-dessus de l'en-tête) : garantit une sortie du menu quel que soit le contenu. Ajoutée en
  // dernier dans le container pour rester au-dessus (rendu ET input).
  private drawCloseCross(c: Phaser.GameObjects.Container, w: number, h: number) {
    const x = 480 + w / 2 - 22
    const y = 270 - h / 2 + 22
    const bg = this.add.circle(x, y, 15, 0x8e2f2f, 1).setStrokeStyle(2, 0xffd54f, 0.95)
    const txt = this.add.text(x, y, '✕', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel())
    txt.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel())
    c.add(bg)
    c.add(txt)
    // La caméra suit le panda (monde 1440×860 > viewport) : le container est épinglé à l'écran via
    // scrollFactor 0, MAIS le hit-test Phaser d'un ENFANT utilise le scrollFactor de l'enfant, pas
    // celui du container. Resté à 1, il décale le hit-test de la valeur de scroll caméra → TOUS les
    // boutons du panneau (Acheter, Forger, Vendre…) deviennent incliquables dès qu'on s'éloigne du
    // point de départ. NB : `container.setScrollFactor(0, 0, true)` ne suffit PAS — son SetAll ignore
    // les enfants dont `scrollFactorX` n'est qu'hérité du prototype (hasOwnProperty=false). On force
    // donc explicitement chaque enfant à 0 (drawCloseCross est le dernier appel de chaque panneau).
    for (const o of c.list) (o as Partial<Phaser.GameObjects.Components.ScrollFactor>).setScrollFactor?.(0)
  }

  // Contrôles de pagination (◀ Page x/y ▶) centrés dans le pied du panneau. N'affiche rien s'il
  // n'y a qu'une page. `go(nouvellePage)` re-render le panneau sur la page demandée. La pagination
  // borne le contenu à ce qui tient à l'écran (Phaser 4 WebGL ne supporte pas les masques géo).
  private drawPager(
    c: Phaser.GameObjects.Container, cx: number, y: number,
    page: number, pageCount: number, go: (page: number) => void,
  ) {
    if (pageCount <= 1) return
    const arrow = (dx: number, glyph: string, target: number, enabled: boolean) => {
      const t = this.add.text(cx + dx, y, glyph, {
        fontSize: '18px', color: enabled ? '#ffd54f' : '#6d5b52', fontStyle: 'bold',
        backgroundColor: '#3a2b28', padding: { x: 10, y: 4 },
      }).setOrigin(0.5)
      c.add(t)
      if (enabled) t.setInteractive({ useHandCursor: true }).on('pointerdown', () => go(target))
    }
    arrow(-96, '◀', page - 1, page > 0)
    c.add(this.add.text(cx, y, `Page ${page + 1}/${pageCount}`, {
      fontSize: '14px', color: '#cfd8dc', fontStyle: 'bold',
    }).setOrigin(0.5))
    arrow(96, '▶', page + 1, page < pageCount - 1)
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
    owned = false,
  ) {
    const parts: Phaser.GameObjects.GameObject[] = []
    const card = this.add.rectangle(x, y, w, h, 0x4e342e, 0.9).setStrokeStyle(2, 0x8d6e63, 1)
    c.add(card); parts.push(card)
    const iy = y - h / 2 + 30
    if ('texture' in icon) {
      const img = this.add.image(x, iy, icon.texture).setDisplaySize(30, 30)
      c.add(img); parts.push(img)
    } else {
      // pas de visuel dédié pour cet objet : pastille colorée par emplacement (arme/armure/accessoire)
      const circ = this.add.circle(x, iy, 15, icon.pastille).setStrokeStyle(2, 0xffffff, 0.6)
      const glyph = this.add.text(x, iy, icon.glyph, { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      c.add(circ); c.add(glyph); parts.push(circ, glyph)
    }
    const nameTxt = this.add.text(x, y - h / 2 + 52, name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5, 0)
    c.add(nameTxt); parts.push(nameTxt)
    if (sub) { const subTxt = this.add.text(x, y - h / 2 + 74, sub, { fontSize: '10px', color: '#90a4ae', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5, 0); c.add(subTxt); parts.push(subTxt) }

    // objet déjà possédé (inventaire ou équipé) : carte grisée, achat bloqué, libellé « Possédé »
    if (owned) {
      for (const o of parts) (o as unknown as { setAlpha: (a: number) => void }).setAlpha(0.4)
      card.setStrokeStyle(2, 0x6d5b52, 1)
      const tag = this.add.text(x, y + h / 2 - 18, 'Possédé', {
        fontSize: '13px', color: '#cfd8dc', backgroundColor: '#3a2b28', padding: { x: 10, y: 5 },
      }).setOrigin(0.5)
      c.add(tag)
      return
    }

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
    const c = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
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
    this.drawCloseCross(c, w, h)
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

  // itemIds déjà possédés par le joueur (dans l'inventaire OU équipés) — sert à bloquer le rachat
  private ownedIds(): Set<string> {
    const p = getPlayer()
    const equipped = Object.values(p.equipment).filter((id): id is string => !!id)
    return new Set<string>([...p.inventory, ...equipped])
  }

  private openItemShop(kind: 'armes' | 'vetements', list: ShopItemDef[], page = 0) {
    this.closePanel()
    const title = kind === 'armes' ? 'Armurerie' : 'Boutique de vêtements'

    // regroupe les articles par type dans l'ordre fixe (chapeau → armure → arme → accessoire)
    const groups = SLOT_ORDER
      .map((slot) => ({ slot, entries: list.filter((e) => ITEMS[e.itemId]!.slot === slot) }))
      .filter((g) => g.entries.length > 0)
    const maxGroup = Math.max(...groups.map((g) => g.entries.length), 1)
    const cols = maxGroup <= 1 ? 1 : maxGroup <= 4 ? 2 : 3
    const cardW = 168, cardH = 128, gapX = 16, gapY = 14, sectionH = 28

    // aplatis en rangées de cartes étiquetées par type (une rangée ≤ cols cartes d'un même type)
    const cardRows: { slot: EquipSlot; entries: ShopItemDef[] }[] = []
    for (const g of groups)
      for (let i = 0; i < g.entries.length; i += cols)
        cardRows.push({ slot: g.slot, entries: g.entries.slice(i, i + cols) })

    // pagination : au plus 2 rangées de cartes visibles par page (viewport 960×540, hauteur ≤ 500)
    const rowsPerPage = 2
    const pageCount = Math.max(1, Math.ceil(cardRows.length / rowsPerPage))
    page = Phaser.Math.Clamp(page, 0, pageCount - 1)
    const pageRows = cardRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

    // hauteur du contenu : un en-tête de section à chaque changement de type sur la page
    let sections = 0
    let seen: EquipSlot | null = null
    for (const r of pageRows) { if (r.slot !== seen) { sections++; seen = r.slot } }
    const contentH = pageRows.length * cardH + Math.max(0, pageRows.length - 1) * gapY + sections * sectionH

    const w = Math.min(920, Math.max(360, cols * cardW + (cols - 1) * gapX + 60))
    const headerH = 100, footerH = 64
    const h = Math.min(500, headerH + contentH + footerH)
    const c = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    this.panel = c
    const top = this.drawPanelFrame(c, w, h, title)
    const p = getPlayer()
    const goldText = this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
    const owned = this.ownedIds()

    const gridLeft = 480 - (cols * cardW + (cols - 1) * gapX) / 2 + cardW / 2
    let y = top + headerH
    let lastSlot: EquipSlot | null = null
    for (const r of pageRows) {
      if (r.slot !== lastSlot) {
        // en-tête de section lisible + fin filet doré séparateur
        c.add(this.add.text(480 - w / 2 + 24, y + sectionH / 2, SLOT_LABEL_PLURAL[r.slot], {
          fontSize: '14px', color: '#ffd54f', fontStyle: 'bold',
        }).setOrigin(0, 0.5))
        c.add(this.add.rectangle(480, y + sectionH - 3, w - 44, 1, 0xffd54f, 0.3))
        y += sectionH
        lastSlot = r.slot
      }
      r.entries.forEach((entry, col) => {
        const item = ITEMS[entry.itemId]!
        const x = gridLeft + col * (cardW + gapX)
        const cy = y + cardH / 2
        const bonus = Object.entries(item.bonus).map(([k, v]) => `${k} +${v}`).join(' / ')
        this.drawItemCard(
          c, x, cy, cardW, cardH,
          this.iconFor(entry.itemId), item.name, bonus, entry.price,
          () => { const pl = getPlayer(); return buyItem(pl, entry.itemId, entry.price) },
          () => { const pl = getPlayer(); save(pl); goldText.setText(`${pl.gold} or`) },
          owned.has(entry.itemId),
        )
      })
      y += cardH + gapY
    }

    this.drawPager(c, 480, top + h - 44, page, pageCount, (pg) => this.openItemShop(kind, list, pg))
    c.add(
      this.add.text(480, top + h - 18, '← Fermer', {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
    )
    this.drawCloseCross(c, w, h)
  }

  // libellé de récompense d'une quête : or (+ potions) (+ objet nommé, coloré par rareté)
  private questRewardLabel(def: QuestDef): string {
    const parts = [`${def.rewardGold} or`]
    if (def.rewardPotions) parts.push(`${def.rewardPotions} potion${def.rewardPotions > 1 ? 's' : ''}`)
    if (def.rewardItemId) parts.push(ITEMS[def.rewardItemId]!.name)
    return parts.join(' + ')
  }

  private openQuestNpc() {
    this.closePanel()
    const c = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    this.panel = c
    c.add(this.add.rectangle(480, 270, 560, 300, 0x0d1b2a, 0.96))
    c.add(this.add.text(480, 150, QUEST_CHAIN[0]!.npcName, { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))

    const render = () => {
      const p = getPlayer()
      const def = currentChainQuest(p)
      for (const child of [...c.list].slice(2)) child.destroy()

      // toute la chaîne accomplie : plus rien à proposer
      if (!def) {
        c.add(this.add.text(480, 250, 'Tu as accompli toutes mes quêtes.\nLe pays te doit une fière chandelle, panda !', {
          fontSize: '16px', color: '#80cbc4', align: 'center', wordWrap: { width: 480 },
        }).setOrigin(0.5))
        c.add(
          this.add.text(480, 390, '← Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
        )
        this.drawCloseCross(c, 560, 300)
        return
      }

      refreshQuestProgress(p, def.id)
      c.add(this.add.text(480, 184, `Quête ${def.order}/${QUEST_CHAIN.length} — ${def.name}`, { fontSize: '17px', color: '#ffd54f' }).setOrigin(0.5))
      c.add(this.add.text(480, 220, def.description, { fontSize: '14px', color: '#cfd8dc', align: 'center', wordWrap: { width: 480 } }).setOrigin(0.5))
      c.add(this.add.text(480, 268, `Récompense : ${this.questRewardLabel(def)}`, { fontSize: '13px', color: '#ffb300', align: 'center', wordWrap: { width: 480 } }).setOrigin(0.5))

      const q = p.quests[def.id]
      if (!q) {
        c.add(
          this.add.text(480, 320, 'Accepter la quête', {
            fontSize: '16px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 14, y: 8 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            acceptQuest(p, def.id); save(p); render()
          }),
        )
      } else if (q.done) {
        c.add(this.add.text(480, 300, `Progression : ${q.progress}/${def.targetCount} — terminée !`, { fontSize: '15px', color: '#ffd700' }).setOrigin(0.5))
        c.add(
          this.add.text(480, 336, 'Réclamer la récompense', {
            fontSize: '16px', color: '#ffffff', backgroundColor: '#2e7d32', padding: { x: 14, y: 8 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (claimQuest(p, def.id)) { save(p); render() }
          }),
        )
      } else {
        const verb = def.type === 'fetch' ? 'Rapportés' : 'Progression'
        c.add(this.add.text(480, 320, `${verb} : ${q.progress}/${def.targetCount}`, { fontSize: '15px', color: '#ffd54f' }).setOrigin(0.5))
      }

      c.add(
        this.add.text(480, 390, '← Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 } })
          .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()),
      )
      this.drawCloseCross(c, 560, 300)
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

  private openForgePanel(tab: 'craft' | 'reforge' | 'sell', page = 0) {
    this.closePanel()
    const c = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    this.panel = c
    if (tab === 'craft') this.renderCraft(c, page)
    else if (tab === 'reforge') this.renderReforge(c, page)
    else this.renderSell(c, page)
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
  private renderCraft(c: Phaser.GameObjects.Container, page = 0, msg?: string, ok?: boolean) {
    c.removeAll(true)
    const w = 860
    const rowH = 44
    const headerH = 140, footerH = 90
    // pagination : autant de rangées que la hauteur bornée (≤ 500) le permet
    const rowsPerPage = Math.max(1, Math.floor((500 - headerH - footerH) / rowH))
    const pageCount = Math.max(1, Math.ceil(RECIPES.length / rowsPerPage))
    page = Phaser.Math.Clamp(page, 0, pageCount - 1)
    const pageRecipes = RECIPES.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    const rowsForH = pageCount > 1 ? rowsPerPage : pageRecipes.length
    const h = Math.min(500, headerH + rowsForH * rowH + footerH)
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

    const render = (m?: string, o?: boolean) => this.renderCraft(c, page, m, o)
    const rowsTop = top + headerH
    const rowLeft = 480 - w / 2 + 16

    pageRecipes.forEach((recipe, i) => {
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
    if (msg) c.add(this.add.text(480, top + h - 74, msg, {
      fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
    }).setOrigin(0.5))

    this.drawPager(c, 480, top + h - 46, page, pageCount, (pg) => this.renderCraft(c, pg))
    c.add(this.add.text(480, top + h - 18, '← Fermer', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
    this.drawCloseCross(c, w, h)
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
  private renderReforge(c: Phaser.GameObjects.Container, page = 0, msg?: string, ok?: boolean) {
    c.removeAll(true)
    const w = 860
    const rowH = 46
    const headerH = 140, footerH = 90
    const allIds = this.reforgeableIds()
    const rowsPerPage = Math.max(1, Math.floor((500 - headerH - footerH) / rowH))
    const pageCount = Math.max(1, Math.ceil(Math.max(allIds.length, 1) / rowsPerPage))
    page = Phaser.Math.Clamp(page, 0, pageCount - 1)
    const ids = allIds.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    const rowsForH = pageCount > 1 ? rowsPerPage : Math.max(ids.length, 1)
    const h = Math.min(500, headerH + rowsForH * rowH + footerH)
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

    const render = (m?: string, o?: boolean) => this.renderReforge(c, page, m, o)
    const rowsTop = top + headerH
    const rowLeft = 480 - w / 2 + 16

    if (allIds.length === 0) {
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

    if (msg) c.add(this.add.text(480, top + h - 74, msg, {
      fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
    }).setOrigin(0.5))

    this.drawPager(c, 480, top + h - 46, page, pageCount, (pg) => this.renderReforge(c, pg))
    c.add(this.add.text(480, top + h - 18, '← Fermer', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
    this.drawCloseCross(c, w, h)
  }

  // Vendre : revend un objet de l'inventaire contre de l'or (selon sa rareté). Une ligne par
  // objet avec son prix de vente et un bouton Vendre. renderSell() reconstruit tout après une vente.
  private renderSell(c: Phaser.GameObjects.Container, page = 0, msg?: string, ok?: boolean) {
    c.removeAll(true)
    const w = 860
    const rowH = 44
    const headerH = 132, footerH = 90
    const p = getPlayer()
    const rowsPerPage = Math.max(1, Math.floor((500 - headerH - footerH) / rowH))
    const pageCount = Math.max(1, Math.ceil(Math.max(p.inventory.length, 1) / rowsPerPage))
    page = Phaser.Math.Clamp(page, 0, pageCount - 1)
    const start = page * rowsPerPage
    const pageItems = p.inventory.slice(start, start + rowsPerPage)
    const rowsForH = pageCount > 1 ? rowsPerPage : Math.max(pageItems.length, 1)
    const h = Math.min(500, headerH + rowsForH * rowH + footerH)
    const top = this.drawPanelFrame(c, w, h, 'Forge')
    this.drawGoldBadge(c, 480 + w / 2 - 70, top + 30, p.gold)
    this.drawForgeTabs(c, top, 'sell')
    c.add(this.add.text(480, top + 104, 'Revends les objets de ton inventaire non équipé.', {
      fontSize: '12px', color: '#cfd8dc', align: 'center',
    }).setOrigin(0.5))

    const render = (m?: string, o?: boolean) => this.renderSell(c, page, m, o)
    const rowsTop = top + headerH
    const rowLeft = 480 - w / 2 + 16

    if (p.inventory.length === 0) {
      c.add(this.add.text(480, rowsTop + rowH / 2, 'Inventaire vide.', {
        fontSize: '14px', color: '#90a4ae',
      }).setOrigin(0.5))
    }

    pageItems.forEach((id, i) => {
      const invIndex = start + i // index réel dans p.inventory (nécessaire pour sellItem)
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
        if (sellItem(p, invIndex)) {
          audio.playSfx('buy')
          save(p)
          render(`Vendu : ${item.name} (+${value} or)`, true)
        }
      })
    })

    if (msg) c.add(this.add.text(480, top + h - 74, msg, {
      fontSize: '14px', color: ok ? '#66bb6a' : '#ff5252', fontStyle: 'bold',
    }).setOrigin(0.5))

    this.drawPager(c, 480, top + h - 46, page, pageCount, (pg) => this.renderSell(c, pg))
    c.add(this.add.text(480, top + h - 18, '← Fermer', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5d4037', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closePanel()))
    this.drawCloseCross(c, w, h)
  }
}
