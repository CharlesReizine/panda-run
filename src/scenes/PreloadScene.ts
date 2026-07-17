import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { SKILLS } from '../data/skills'
import type { MonsterDef } from '../core/types'

// icône par skill : couleur + glyphe
const SKILL_ICONS: Record<string, { color: number; glyph: string }> = {
  'calin-brutal': { color: 0xff9ab0, glyph: 'paw' },
  'bambou-jete': { color: 0x9ccc65, glyph: 'bamboo' },
  'taillade': { color: 0xcfd8dc, glyph: 'sword' },
  'tourbillon': { color: 0x90caf9, glyph: 'tornado' },
  'charge-bambou': { color: 0xffcc80, glyph: 'dash' },
  'cri-de-guerre': { color: 0xffe082, glyph: 'shout' },
  'provocation': { color: 0xef9a9a, glyph: 'target' },
  'lame-ultime': { color: 0xffd54f, glyph: 'sword' },
  'boule-de-feu': { color: 0xff7043, glyph: 'fireball' },
  'eclair': { color: 0xfff176, glyph: 'bolt' },
  'nova-de-givre': { color: 0x4dd0e1, glyph: 'snow' },
  'meteore': { color: 0xff8a65, glyph: 'fireball' },
  'soin-du-panda': { color: 0x81c784, glyph: 'cross' },
  'tempete-arcanique': { color: 0xce93d8, glyph: 'star' },
  'fleche-percante': { color: 0xd7a86e, glyph: 'arrow' },
  'double-tir': { color: 0xd7a86e, glyph: 'arrow2' },
  'pluie-de-fleches': { color: 0xa5d6a7, glyph: 'rain' },
  'tir-charge': { color: 0xffb74d, glyph: 'arrow' },
  'fleche-de-bambou': { color: 0x9ccc65, glyph: 'arrow' },
  'salve-ultime': { color: 0xffd54f, glyph: 'rain' },
}

type ClassId = 'novice' | 'swordsman' | 'mage' | 'archer'
const CLASSES: ClassId[] = ['novice', 'swordsman', 'mage', 'archer']

interface Pose {
  bx?: number; by?: number
  lf?: [number, number]; rf?: [number, number]
  la?: [number, number]; ra?: [number, number]
  paw?: boolean
}

const POSES: Record<string, Pose> = {
  '': {},
  'run-0': { lf: [-3, -1], rf: [3, 1], la: [0, -2], ra: [0, 2] },
  'run-1': { by: -3, lf: [1, -2], rf: [-1, -2] },
  'run-2': { lf: [3, 1], rf: [-3, -1], la: [0, 2], ra: [0, -2] },
  'attack-0': { bx: -2, ra: [-3, -2] },
  'attack-1': { bx: 3, ra: [7, -4], paw: true },
  'jump': { lf: [3, -8], rf: [-3, -8], la: [0, -5], ra: [0, -5] }, // jambes repliées, bras levés
}

const TILE_PALETTES: Record<string, { soil: number; top: number; speck: number }> = {
  'tile-plaine': { soil: 0x6b4a2f, top: 0x5cb85c, speck: 0x4a9d4a },
  'tile-foret': { soil: 0x4a3320, top: 0x2e7d32, speck: 0x256528 },
  'tile-desert': { soil: 0xcaa85a, top: 0xe0c068, speck: 0xd4b46a },
  'tile-cave': { soil: 0x3f3f3f, top: 0x616161, speck: 0x525252 },
}

const OY = 14 // décalage vertical : laisse de la place au-dessus de la tête pour les coiffes

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  // coiffe/accessoire de classe, dessiné au-dessus de la tête (hx,hy = centre tête)
  private drawClassGear(g: Phaser.GameObjects.Graphics, cls: ClassId, hx: number, hy: number) {
    if (cls === 'swordsman') {
      g.fillStyle(0xd32f2f).fillRect(hx - 17, hy - 11, 34, 5)
      g.fillTriangle(hx - 17, hy - 11, hx - 28, hy - 14, hx - 25, hy - 4) // pan du bandeau
    } else if (cls === 'mage') {
      g.fillStyle(0x3949ab).fillEllipse(hx, hy - 15, 42, 10)
      g.fillTriangle(hx - 17, hy - 15, hx + 17, hy - 15, hx + 5, hy - 40)
      g.fillStyle(0xffd54f).fillCircle(hx + 5, hy - 38, 3) // pompon
      g.fillStyle(0xfff59d).fillCircle(hx - 4, hy - 22, 2) // étoile
    } else if (cls === 'archer') {
      g.fillStyle(0x2e7d32).fillTriangle(hx - 18, hy - 13, hx + 18, hy - 13, hx + 2, hy - 30)
      g.fillStyle(0x1b5e20).fillRect(hx - 18, hy - 14, 36, 4)
      g.fillStyle(0xffca28).fillTriangle(hx + 10, hy - 24, hx + 24, hy - 32, hx + 13, hy - 19) // plume
    } else {
      g.fillStyle(0x7cb342).fillEllipse(hx + 1, hy - 22, 7, 10) // petite pousse (novice)
      g.fillStyle(0x33691e).fillRect(hx, hy - 24, 2, 6)
    }
  }

  // arme tenue dans la patte droite (hx,hy = position de la patte)
  private drawClassWeapon(g: Phaser.GameObjects.Graphics, cls: ClassId, hx: number, hy: number) {
    if (cls === 'swordsman') {
      g.lineStyle(3, 0xcfd8dc).beginPath(); g.moveTo(hx, hy + 4); g.lineTo(hx + 5, hy - 20); g.strokePath()
      g.fillStyle(0x9e9e9e).fillRect(hx - 3, hy + 1, 10, 3)
    } else if (cls === 'archer') {
      g.lineStyle(3, 0x8d6e63).beginPath(); g.arc(hx - 1, hy - 2, 9, Phaser.Math.DegToRad(-75), Phaser.Math.DegToRad(75), false); g.strokePath()
      const c = Phaser.Math.DegToRad(-75), d = Phaser.Math.DegToRad(75)
      g.lineStyle(1, 0xeeeeee).beginPath()
      g.moveTo(hx - 1 + 9 * Math.cos(c), hy - 2 + 9 * Math.sin(c)); g.lineTo(hx - 1 + 9 * Math.cos(d), hy - 2 + 9 * Math.sin(d)); g.strokePath()
    } else if (cls === 'mage') {
      g.lineStyle(3, 0x8d6e63).beginPath(); g.moveTo(hx, hy - 16); g.lineTo(hx + 1, hy + 6); g.strokePath()
      g.fillStyle(0x64b5f6).fillCircle(hx, hy - 19, 4); g.fillStyle(0xbbdefb).fillCircle(hx - 1, hy - 20, 1.5)
    }
  }

  private pandaFrame(key: string, o: Pose, cls: ClassId) {
    const g = this.add.graphics()
    const W = 0xf7f7f7, K = 0x2b2b2b, PINK = 0xff9ab0, DARK = 0x3a2f2f
    const bx = o.bx ?? 0, by = (o.by ?? 0) + OY
    const [lfx, lfy] = o.lf ?? [0, 0], [rfx, rfy] = o.rf ?? [0, 0]
    const [lax, lay] = o.la ?? [0, 0], [rax, ray] = o.ra ?? [0, 0]
    g.fillStyle(K).fillEllipse(24 + lfx, 72 + lfy + OY, 15, 11).fillEllipse(40 + rfx, 72 + rfy + OY, 15, 11)
    g.fillStyle(K).fillEllipse(32 + bx, 54 + by, 46, 40)
    g.fillStyle(W).fillEllipse(32 + bx, 53 + by, 40, 33)
    g.fillStyle(0xe4e4e4).fillEllipse(32 + bx, 61 + by, 26, 14)
    g.fillStyle(K).fillEllipse(12 + bx + lax, 50 + by + lay, 13, 22).fillEllipse(52 + bx + rax, 50 + by + ray, 13, 22)
    if (o.paw) g.fillStyle(K).fillCircle(57 + rax, 46 + ray + OY, 7)
    this.drawClassWeapon(g, cls, 52 + bx + rax, 50 + by + ray)
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
    this.drawClassGear(g, cls, 32 + bx, 25 + by)
    g.generateTexture(key, 64, 92)
    g.destroy()
  }

  private drawPandas() {
    for (const cls of CLASSES) {
      for (const [pose, opts] of Object.entries(POSES)) {
        const key = pose ? `panda-${cls}-${pose}` : `panda-${cls}`
        this.pandaFrame(key, opts, cls)
      }
      if (!this.anims.exists(`panda-${cls}-run`)) {
        this.anims.create({ key: `panda-${cls}-idle`, frames: [{ key: `panda-${cls}` }], frameRate: 1, repeat: -1 })
        this.anims.create({
          key: `panda-${cls}-run`,
          frames: [{ key: `panda-${cls}-run-0` }, { key: `panda-${cls}-run-1` }, { key: `panda-${cls}-run-2` }, { key: `panda-${cls}-run-1` }],
          frameRate: 12, repeat: -1,
        })
        this.anims.create({
          key: `panda-${cls}-attack`,
          frames: [{ key: `panda-${cls}-attack-0` }, { key: `panda-${cls}-attack-1` }],
          frameRate: 14, repeat: 0,
        })
        this.anims.create({ key: `panda-${cls}-jump`, frames: [{ key: `panda-${cls}-jump` }], frameRate: 1, repeat: -1 })
      }
    }
    // alias pour les menus (écran titre) : le panda novice
    this.pandaFrame('panda', {}, 'novice')
  }

  private drawMonster(m: MonsterDef) {
    const s = m.boss ? 76 : 40
    const r = s / 2
    const g = this.add.graphics()
    const dark = 0x222222
    g.fillStyle(dark, 0.35).fillEllipse(r, s + 2, r * 1.4, 6) // ombre au sol

    const body = () => {
      g.fillStyle(dark).fillCircle(r, r + 2, r - 1)
      g.fillStyle(m.color).fillCircle(r, r + 2, r - 3)
      g.fillStyle(0xffffff, 0.28).fillEllipse(r - r / 3, r - r / 3, r / 2, r / 3)
    }
    const eyes = (dy = 0) => {
      const e = Math.max(3, r / 5)
      g.fillStyle(0xffffff).fillCircle(r - r / 3, r + dy, e).fillCircle(r + r / 3, r + dy, e)
      g.fillStyle(0x000000).fillCircle(r - r / 3 + 1, r + dy + 1, e / 2).fillCircle(r + r / 3 + 1, r + dy + 1, e / 2)
    }
    const mouth = () => {
      g.lineStyle(2, 0x000000, 0.6).beginPath()
      g.arc(r, r + r / 2, r / 4, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false)
      g.strokePath()
    }

    switch (m.id) {
      case 'gloopy':
      case 'roi-gloopy':
        body(); eyes(); mouth()
        g.fillStyle(0xffffff, 0.5).fillCircle(r - r / 2, r - r / 2, r / 6) // brillance slime
        break
      case 'mandragore':
        g.fillStyle(0x33691e).fillTriangle(r - 10, 6, r - 2, 6, r - 12, -6) // feuilles
        g.fillStyle(0x33691e).fillTriangle(r + 10, 6, r + 2, 6, r + 12, -6)
        body(); eyes()
        g.lineStyle(2, 0x000000, 0.7).beginPath(); g.arc(r, r + r / 1.6, r / 3, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath() // grimace
        break
      case 'louveteau':
        g.fillStyle(m.color).fillTriangle(r - 14, 4, r - 4, 2, r - 8, -10) // oreilles
        g.fillStyle(m.color).fillTriangle(r + 14, 4, r + 4, 2, r + 8, -10)
        body(); eyes()
        g.fillStyle(0x000000).fillEllipse(r, r + r / 2, 5, 4) // truffe
        g.fillStyle(0xffffff).fillTriangle(r - 4, r + r / 1.6, r - 1, r + r / 1.6, r - 2.5, r + r / 1.2) // croc
        break
      case 'scorpion':
        body()
        g.fillStyle(m.color).fillCircle(r - r / 1.2, r - 2, r / 3).fillCircle(r + r / 1.2, r - 2, r / 3) // pinces
        g.fillStyle(dark).fillCircle(r - r / 1.05, r - 4, r / 6).fillCircle(r + r / 1.05, r - 4, r / 6)
        g.fillStyle(m.color).fillCircle(r, r - r / 1.1, r / 4) // queue
        g.fillStyle(0xffee58).fillCircle(r, r - r / 0.9, r / 8) // dard
        eyes()
        break
      case 'momie':
        body()
        g.lineStyle(2, 0xbfae86, 0.9)
        for (let i = -1; i <= 2; i++) { g.beginPath(); g.moveTo(2, r + i * 6); g.lineTo(s - 2, r + i * 6 + 2); g.strokePath() } // bandages
        g.fillStyle(0xffffff).fillCircle(r + r / 4, r, r / 5); g.fillStyle(0x000000).fillCircle(r + r / 4, r, r / 10) // un œil
        break
      case 'vautour':
        g.fillStyle(m.color).fillTriangle(2, r, r, r - 6, r, r + 8) // aile gauche
        g.fillStyle(m.color).fillTriangle(s - 2, r, r, r - 6, r, r + 8) // aile droite
        body(); eyes()
        g.fillStyle(0xffb300).fillTriangle(r - 4, r + r / 2, r + 4, r + r / 2, r, r + r / 1.1) // bec
        break
      case 'squelette':
        g.fillStyle(0xf5f5f5).fillCircle(r, r + 2, r - 2)
        g.fillStyle(0x000000).fillCircle(r - r / 3, r, r / 4).fillCircle(r + r / 3, r, r / 4) // orbites
        g.fillStyle(0x000000).fillTriangle(r - 3, r + r / 2, r + 3, r + r / 2, r, r + r / 3) // nez
        g.lineStyle(2, 0x000000).beginPath(); g.moveTo(r - r / 2, r + r / 1.4); g.lineTo(r + r / 2, r + r / 1.4); g.strokePath()
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(r + i * 4, r + r / 1.6); g.lineTo(r + i * 4, r + r / 1.2); g.strokePath() } // dents
        break
      case 'chauve-souris':
        g.fillStyle(m.color).fillTriangle(0, r - 6, r, r, 2, r + 8) // ailes
        g.fillStyle(m.color).fillTriangle(s, r - 6, r, r, s - 2, r + 8)
        g.fillStyle(m.color).fillTriangle(r - 8, 6, r - 2, 4, r - 6, -6) // oreilles
        g.fillStyle(m.color).fillTriangle(r + 8, 6, r + 2, 4, r + 6, -6)
        body(); eyes()
        g.fillStyle(0xffffff).fillTriangle(r - 4, r + r / 2, r - 1, r + r / 2, r - 2.5, r + r / 1.3).fillTriangle(r + 1, r + r / 2, r + 4, r + r / 2, r + 2.5, r + r / 1.3) // crocs
        break
      case 'pharaon-scarabee':
        body()
        g.fillStyle(0x1a1a1a).fillRect(r - r / 8, 4, r / 4, s - 8) // ligne de carapace
        g.lineStyle(3, 0xffd54f); g.beginPath(); g.moveTo(r, 6); g.lineTo(r - r / 2, r); g.moveTo(r, 6); g.lineTo(r + r / 2, r); g.strokePath() // antennes dorées
        eyes()
        break
      default:
        body(); eyes(); mouth()
    }

    if (m.boss) {
      g.fillStyle(0xffd54f).fillTriangle(r - 14, 8, r - 7, 18, r, 8).fillTriangle(r, 8, r + 7, 18, r + 14, 8)
      g.fillRect(r - 14, 15, 28, 5)
      g.fillStyle(0xff5252).fillCircle(r, 8, 2).fillCircle(r - 14, 8, 2).fillCircle(r + 14, 8, 2) // joyaux
    }
    g.generateTexture(`monster-${m.id}`, s, s + 6)
    g.destroy()
  }

  private drawDecor() {
    let g = this.add.graphics()
    g.fillStyle(0x3f8f3f).fillEllipse(20, 26, 40, 24).fillEllipse(8, 30, 20, 16).fillEllipse(32, 30, 20, 16)
    g.fillStyle(0x5cb85c).fillEllipse(20, 22, 34, 18)
    g.generateTexture('deco-plaine', 40, 36); g.destroy()
    g = this.add.graphics()
    g.fillStyle(0x5d4037).fillRect(18, 44, 8, 20)
    g.fillStyle(0x2e5e30).fillCircle(22, 24, 20)
    g.fillStyle(0x3c7d3f).fillCircle(14, 20, 12).fillCircle(30, 22, 12).fillCircle(22, 13, 12)
    g.generateTexture('deco-foret', 44, 64); g.destroy()
    g = this.add.graphics()
    g.fillStyle(0x3c7d3f).fillRoundedRect(12, 10, 10, 46, 4)
    g.fillStyle(0x4a9d4a).fillRoundedRect(2, 26, 8, 16, 3).fillRoundedRect(24, 20, 8, 22, 3)
    g.generateTexture('deco-desert', 34, 56); g.destroy()
    g = this.add.graphics()
    g.fillStyle(0x50505c).fillTriangle(4, 48, 16, 4, 28, 48)
    g.fillStyle(0x6a6a78).fillTriangle(10, 48, 16, 18, 22, 48)
    g.generateTexture('deco-cave', 32, 48); g.destroy()
  }

  private drawSkillIcon(id: string, spec: { color: number; glyph: string }) {
    const g = this.add.graphics()
    const c = spec.color
    g.fillStyle(0x1b2631).fillRoundedRect(0, 0, 44, 44, 8)
    g.lineStyle(2, c, 0.9).strokeRoundedRect(1, 1, 42, 42, 8)
    const cx = 22, cy = 22
    switch (spec.glyph) {
      case 'sword':
        g.lineStyle(4, c).beginPath(); g.moveTo(13, 31); g.lineTo(31, 13); g.strokePath()
        g.lineStyle(3, 0x9e9e9e).beginPath(); g.moveTo(10, 28); g.lineTo(16, 34); g.strokePath() // garde
        break
      case 'paw':
        g.fillStyle(c).fillCircle(cx, cy + 3, 8)
        g.fillCircle(cx - 7, cy - 6, 3).fillCircle(cx, cy - 8, 3).fillCircle(cx + 7, cy - 6, 3)
        break
      case 'bamboo':
        g.fillStyle(c).fillRoundedRect(cx - 3, 8, 6, 28, 2)
        g.lineStyle(2, 0x33691e).beginPath(); g.moveTo(cx - 3, 18); g.lineTo(cx + 3, 18); g.moveTo(cx - 3, 27); g.lineTo(cx + 3, 27); g.strokePath()
        break
      case 'tornado':
        g.lineStyle(3, c); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, 12 + i * 8, 12 - i * 3, 0, Math.PI, false); g.strokePath() }
        break
      case 'dash':
        g.lineStyle(4, c).beginPath(); g.moveTo(15, 30); g.lineTo(31, 14); g.strokePath()
        g.lineStyle(2, c, 0.6).beginPath(); g.moveTo(8, 20); g.lineTo(16, 20); g.moveTo(8, 26); g.lineTo(14, 26); g.strokePath()
        break
      case 'shout':
        g.fillStyle(c).fillTriangle(12, 16, 12, 28, 22, 22)
        g.lineStyle(2, c); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(24, 22, 4 + i * 5, -0.7, 0.7, false); g.strokePath() }
        break
      case 'target':
        g.lineStyle(2, c).strokeCircle(cx, cy, 12).strokeCircle(cx, cy, 7); g.fillStyle(c).fillCircle(cx, cy, 3)
        break
      case 'fireball':
        g.fillStyle(c).fillCircle(cx, cy + 2, 9)
        g.fillStyle(0xffd54f).fillCircle(cx, cy + 2, 5)
        g.fillStyle(c).fillTriangle(cx - 6, cy - 6, cx, cy - 16, cx + 6, cy - 6)
        break
      case 'bolt':
        g.fillStyle(c).fillPoints([[24, 8], [16, 24], [22, 24], [18, 36], [30, 20], [23, 20]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true)
        break
      case 'snow':
        g.lineStyle(2, c); for (let a = 0; a < 6; a++) { const r = Phaser.Math.DegToRad(a * 60); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(r) * 13, cy + Math.sin(r) * 13); g.strokePath() }
        break
      case 'cross':
        g.fillStyle(c).fillRect(cx - 4, cy - 11, 8, 22).fillRect(cx - 11, cy - 4, 22, 8)
        break
      case 'star':
        g.fillStyle(c).fillCircle(cx, cy, 4)
        g.fillStyle(0xfff59d).fillCircle(14, 14, 2).fillCircle(30, 16, 2).fillCircle(28, 30, 2).fillCircle(15, 29, 2)
        break
      case 'arrow':
        g.lineStyle(3, c).beginPath(); g.moveTo(12, 32); g.lineTo(32, 12); g.strokePath()
        g.fillStyle(c).fillTriangle(32, 12, 24, 14, 30, 20)
        break
      case 'arrow2':
        g.lineStyle(2, c).beginPath(); g.moveTo(10, 30); g.lineTo(28, 12); g.moveTo(16, 34); g.lineTo(34, 16); g.strokePath()
        g.fillStyle(c).fillTriangle(28, 12, 21, 14, 26, 19).fillTriangle(34, 16, 27, 18, 32, 23)
        break
      case 'rain':
        g.fillStyle(c); for (const dx of [-9, 0, 9]) g.fillTriangle(cx + dx - 3, 12, cx + dx + 3, 12, cx + dx, 34)
        break
    }
    g.generateTexture(`skill-${id}`, 44, 44)
    g.destroy()
  }

  create() {
    this.drawPandas()
    this.drawDecor()
    for (const m of Object.values(MONSTERS)) this.drawMonster(m)
    for (const s of Object.values(SKILLS)) this.drawSkillIcon(s.id, SKILL_ICONS[s.id] ?? { color: 0xffd54f, glyph: 'sword' })

    for (const [key, pal] of Object.entries(TILE_PALETTES)) {
      const g = this.add.graphics()
      g.fillStyle(pal.soil).fillRect(0, 0, 32, 32)
      g.fillStyle(pal.top).fillRect(0, 0, 32, 9)
      g.fillStyle(pal.speck).fillEllipse(6, 5, 5, 4).fillEllipse(22, 6, 5, 4).fillEllipse(14, 3, 3, 3)
      g.fillStyle(0x000000, 0.15).fillRect(0, 0, 32, 1).fillRect(0, 0, 1, 32)
      g.generateTexture(key, 32, 32)
      g.destroy()
    }

    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.25).fillCircle(9, 9, 8); g.fillStyle(0xffee58).fillCircle(9, 9, 7); g.fillStyle(0xffffff).fillCircle(6, 6, 3); g.generateTexture('projectile', 18, 18); g.clear()
    // faisceau (flèche perçante / laser) : capsule allongée lumineuse
    g.fillStyle(0xffffff).fillRoundedRect(0, 5, 48, 8, 4)
    g.fillStyle(0xfff176).fillRoundedRect(2, 6, 44, 6, 3); g.generateTexture('beam', 48, 18); g.clear()
    // sortie : portail lumineux
    g.fillStyle(0x00695c).fillRoundedRect(0, 4, 32, 44, 10)
    g.fillStyle(0x4db6ac).fillRoundedRect(4, 8, 24, 38, 8)
    g.fillStyle(0xb2dfdb).fillEllipse(16, 26, 14, 26)
    g.fillStyle(0xffffff, 0.85).fillCircle(12, 18, 2).fillCircle(20, 32, 2).fillCircle(17, 24, 1.5); g.generateTexture('exit', 32, 48); g.clear()
    // icônes de boutons
    g.fillStyle(0xffffff).fillCircle(16, 19, 8).fillCircle(9, 10, 3).fillCircle(16, 8, 3).fillCircle(23, 10, 3); g.generateTexture('ui-attack', 32, 32); g.clear()
    g.lineStyle(4, 0xffffff).beginPath(); g.moveTo(6, 19); g.lineTo(16, 9); g.lineTo(26, 19); g.moveTo(6, 26); g.lineTo(16, 16); g.lineTo(26, 26); g.strokePath(); g.generateTexture('ui-jump', 32, 32); g.clear()
    g.fillStyle(0xb71c1c).fillRoundedRect(0, 4, 16, 12, 4)
    g.fillStyle(0xef5350).fillRoundedRect(1, 5, 14, 8, 3)
    g.fillStyle(0xffffff).fillRect(6, 0, 4, 6); g.generateTexture('potion-drop', 16, 16); g.clear()
    g.fillStyle(0xb8860b).fillCircle(6, 6, 6); g.fillStyle(0xffd700).fillCircle(6, 6, 5); g.fillStyle(0xfff59d).fillCircle(4, 4, 1); g.generateTexture('coin', 12, 12); g.clear()
    g.fillStyle(0x7b1fa2).fillRoundedRect(1, 1, 14, 14, 3); g.fillStyle(0xba68c8).fillRoundedRect(2, 2, 12, 12, 2); g.generateTexture('item-drop', 16, 16); g.clear()

    g.fillStyle(0x33691e).fillEllipse(12, 13, 22, 16)
    g.fillStyle(0x7cb342).fillEllipse(12, 11, 20, 13)
    g.fillStyle(0x9ccc65).fillEllipse(7, 8, 3, 7).fillEllipse(12, 6, 3, 9).fillEllipse(17, 8, 3, 7); g.generateTexture('prop-herbe', 24, 20); g.clear()
    g.fillStyle(0xf5f5dc).fillRoundedRect(9, 10, 6, 14, 2)
    g.fillStyle(0xb71c1c).fillEllipse(12, 9, 22, 15)
    g.fillStyle(0xef5350).fillEllipse(12, 8, 20, 12)
    g.fillStyle(0xffffff).fillCircle(6, 6, 2).fillCircle(18, 6, 2).fillCircle(12, 10, 2); g.generateTexture('prop-champignon', 24, 24); g.clear()
    g.fillStyle(0x616161).fillEllipse(14, 14, 28, 20)
    g.fillStyle(0x9e9e9e).fillEllipse(13, 11, 16, 9); g.generateTexture('prop-roche', 28, 24); g.clear()
    // coffre plus détaillé (couvercle bombé + serrure + ferrures)
    g.fillStyle(0x4e342e).fillRoundedRect(0, 6, 34, 22, 3)
    g.fillStyle(0x6d4c41).fillRect(2, 8, 30, 18)
    g.fillStyle(0x4e342e).fillEllipse(17, 6, 34, 14)
    g.fillStyle(0x8d6e63).fillEllipse(17, 6, 30, 10)
    g.fillStyle(0xffd54f).fillRect(0, 15, 34, 3).fillRect(15, 4, 4, 22)
    g.fillStyle(0xfff176).fillCircle(17, 16, 3); g.generateTexture('prop-coffre', 34, 30); g.clear()
    // coffre ouvert (couvercle relevé + lueur dorée)
    g.fillStyle(0x4e342e).fillRoundedRect(0, 12, 34, 18, 3)
    g.fillStyle(0x6d4c41).fillRect(2, 14, 30, 14)
    g.fillStyle(0xfff59d).fillRect(3, 11, 28, 5)
    g.fillStyle(0x4e342e).fillRect(1, 0, 32, 8)
    g.fillStyle(0x8d6e63).fillRect(3, 1, 28, 6); g.generateTexture('chest-open', 34, 32); g.clear()
    g.fillStyle(0xffffff).fillEllipse(7, 7, 12, 12); g.generateTexture('material-drop', 14, 14); g.clear()

    g.fillStyle(0xffffff).fillEllipse(120, 120, 260, 180); g.generateTexture('hill', 240, 130); g.clear()
    g.fillStyle(0xffffff).fillCircle(20, 20, 18).fillCircle(44, 22, 22).fillCircle(70, 20, 16); g.generateTexture('cloud', 90, 40); g.clear()
    // anneau pour les effets de zone (blanc, teinté à l'usage)
    g.lineStyle(4, 0xffffff).strokeCircle(32, 32, 28); g.generateTexture('ring', 64, 64); g.clear()

    g.destroy()
    this.scene.start('Title')
  }
}
