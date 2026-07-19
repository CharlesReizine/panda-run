import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { SKILLS } from '../data/skills'
import { BIOMES } from '../data/biomes'
import { ITEMS } from '../data/items'
import type { MonsterDef } from '../core/types'
import { stripBorderBackground } from '../core/image-strip'
import { PANDA_TEX, PANDA_HEAD_ANCHORS } from '../entities/player-body'

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
  'rugissement-panda': { color: 0xffb300, glyph: 'roar' },
  'estoc-rapide': { color: 0xe0e0e0, glyph: 'thrust' },
  'onde-tranchante': { color: 0x80deea, glyph: 'wave' },
  'soin-majeur': { color: 0x66bb6a, glyph: 'heart' },
  'rayon-arcanique': { color: 0xba68c8, glyph: 'ray' },
  'tir-instinctif': { color: 0xd7a86e, glyph: 'quickshot' },
  'tir-en-cloche': { color: 0x9ccc65, glyph: 'lob' },
  // Chevalier
  'jugement-royal': { color: 0xffd700, glyph: 'sword' },
  'garde-imperiale': { color: 0xffe082, glyph: 'target' },
  'sceau-du-heaume': { color: 0xffca28, glyph: 'wave' },
  // Sorcier
  'cataclysme': { color: 0xff5252, glyph: 'fireball' },
  'faille-du-neant': { color: 0x7e57c2, glyph: 'ray' },
  'benediction-du-panda': { color: 0x81c784, glyph: 'heart' },
  // Chasseur
  'fleche-mortelle': { color: 0xd32f2f, glyph: 'arrow' },
  'nuee-de-fleches': { color: 0xa5d6a7, glyph: 'rain' },
  'tir-du-faucon': { color: 0xffb74d, glyph: 'lob' },
}

type ClassId = 'novice' | 'swordsman' | 'mage' | 'archer' | 'chevalier' | 'sorcier' | 'chasseur'
const CLASSES: ClassId[] = ['novice', 'swordsman', 'mage', 'archer', 'chevalier', 'sorcier', 'chasseur']

// PNJ pandas de la ville (illustrations fond clair à détourer) : le garde de quête + les
// quatre boutiquiers. Bakés en textures npc-<id> (détourées + rognées) réutilisées par TownScene.
const NPC_IDS = ['garde', 'herboriste', 'forgeron', 'armurier', 'tailleur'] as const

// nom de fichier d'illustration par classe (public/art/panda-<nom>*.png) : le sabreur
// s'appelle « sabreur » côté art ; les autres classes gardent leur id.
const ART_NAME: Record<ClassId, string> = {
  novice: 'novice', swordsman: 'sabreur', mage: 'mage', archer: 'archer',
  chevalier: 'chevalier', sorcier: 'sorcier', chasseur: 'chasseur',
}

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

const OY = 14 // décalage vertical : laisse de la place au-dessus de la tête pour les coiffes

// Une VRAIE illustration (public/art/art-<id>.png) existe pour CHAQUE monstre (mapping 1:1
// avec les ids de MONSTERS). Chacune est "bakée" dans la texture monster-<id> → bestiaire,
// écran d'intro et combats utilisent l'illustration automatiquement. drawMonster reste en
// FALLBACK si une texture d'art venait à manquer au chargement.
const ART_MONSTERS = Object.keys(MONSTERS)

// gabarit d'illustration : les boss, MVP et gardiens sont dessinés plus grands (≈76×82) que
// les monstres normaux (≈40×46), comme le faisait drawMonster.
const isBigArt = (m: MonsterDef): boolean => !!m.boss || !!m.mvp || m.id.startsWith('gardien-')

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  preload() {
    this.load.image('splash', 'art/splash.png')
    for (const id of ART_MONSTERS) this.load.image(`art-${id}`, `art/art-${id}.png`)
    // fonds de biome illustrés (public/art/biome-<clé>.jpg), affichés par LevelScene
    for (const id of Object.keys(BIOMES)) this.load.image(`biome-${id}`, `art/biome-${id}.jpg`)
    // illustrations du panda joueur : 4 poses par classe (idle/course/saut/attaque).
    // Chargées ici puis « bakées » (rognées + mises à l'échelle + ancrées pieds au sol) en
    // textures panda-<classe>* par bakePandaClassFromArt ; repli sur le dessin procédural si absentes.
    for (const cls of CLASSES) {
      const art = ART_NAME[cls]
      this.load.image(`pandaart-${cls}`, `art/panda-${art}.png`)
      this.load.image(`pandaart-${cls}-course`, `art/panda-${art}-course.png`)
      this.load.image(`pandaart-${cls}-saut`, `art/panda-${art}-saut.png`)
      this.load.image(`pandaart-${cls}-attaque`, `art/panda-${art}-attaque.png`)
      // pose de grimpe (vue de dos, tête nue) : illustration dédiée par classe
      this.load.image(`pandaart-${cls}-echelle`, `art/panda-${art}-echelle.png`)
    }
    // PNJ pandas de la ville + illustration K.O. — détourés/rognés en create() (bakeCropped)
    for (const id of NPC_IDS) this.load.image(`npcart-${id}`, `art/npc-${id}.png`)
    this.load.image('deathart-panda', 'art/death-panda.png')
  }

  // Détoure (fond uni des bords → transparent, flood-fill) puis rogne une illustration chargée
  // à sa boîte englobante non transparente, et l'enregistre sous destKey à sa résolution native
  // (nette une fois mise à l'échelle). Sert aux PNJ pandas de la ville et à l'illustration K.O.
  // Renvoie false si la source manque ou si le canvas 2D échoue.
  private bakeCropped(srcKey: string, destKey: string): boolean {
    if (this.textures.exists(destKey)) return true
    if (!this.textures.exists(srcKey)) return false
    try {
      const src = this.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const w = src.width, h = src.height
      const work = document.createElement('canvas')
      work.width = w; work.height = h
      const wctx = work.getContext('2d')
      if (!wctx) return false
      wctx.drawImage(src as CanvasImageSource, 0, 0)
      const imageData = wctx.getImageData(0, 0, w, h)
      stripBorderBackground(imageData)
      const data = imageData.data
      let x0 = w, y0 = h, x1 = -1, y1 = -1
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if ((data[(y * w + x) * 4 + 3] ?? 0) >= 16) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1
      if (bw <= 0 || bh <= 0) return false
      wctx.putImageData(imageData, 0, 0)
      const out = document.createElement('canvas')
      out.width = bw; out.height = bh
      const octx = out.getContext('2d')
      if (!octx) return false
      octx.drawImage(work, x0, y0, bw, bh, 0, 0, bw, bh)
      this.textures.addCanvas(destKey, out)
      return true
    } catch {
      return false
    }
  }

  // Retire le fond uni (gris/blanc « polaroïd ») autour de l'illustration en effaçant
  // les pixels de fond connectés aux bords, puis recrée une texture nettoyée
  // `art-<id>-clean`. Renvoie la clé à utiliser pour le bake (fallback sur l'art brut
  // si le canvas / contexte 2D échoue).
  private cleanArtTexture(id: string): string {
    const src = `art-${id}`
    const clean = `${src}-clean`
    if (this.textures.exists(clean)) return clean
    try {
      const source = this.textures.get(src).getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const w = source.width, h = source.height
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return src
      ctx.drawImage(source as CanvasImageSource, 0, 0)
      const imageData = ctx.getImageData(0, 0, w, h)
      stripBorderBackground(imageData)
      ctx.putImageData(imageData, 0, 0)
      this.textures.addCanvas(clean, canvas)
      return clean
    } catch {
      return src // fallback : illustration brute (fond conservé, mais jamais de crash)
    }
  }

  // bake l'illustration fournie dans la texture monster-<id> à la taille standard (carrée, centrée)
  private artMonster(id: string, big: boolean) {
    const s = big ? 100 : 56
    const h = s + 6
    const img = this.add.image(0, 0, this.cleanArtTexture(id)).setOrigin(0, 0).setDisplaySize(s, s)
    img.setPosition(0, (h - s) / 2)
    const rt = this.make.renderTexture({ width: s, height: h }, false)
    rt.draw(img, 0, (h - s) / 2)
    // Phaser v4 : draw() ne fait qu'empiler des commandes dans un command buffer.
    // Sans render(), rien n'est réellement dessiné dans la texture → monster-<id> vide.
    rt.render()
    rt.saveTexture(`monster-${id}`)
    img.destroy()
  }

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
    } else if (cls === 'chevalier') {
      // heaume : calotte métallique + cimier + fente de visière
      g.fillStyle(0xb0bec5).fillEllipse(hx, hy - 14, 44, 26)
      g.fillStyle(0x90a4ae).fillEllipse(hx, hy - 10, 44, 18)
      g.fillStyle(0x263238).fillRect(hx - 16, hy - 12, 32, 4) // fente de visière
      g.fillStyle(0xeceff1).fillRect(hx - 2, hy - 30, 4, 12) // support du cimier
      g.fillStyle(0xd32f2f).fillTriangle(hx - 10, hy - 40, hx + 10, hy - 40, hx, hy - 26) // panache rouge
      g.fillStyle(0xffca28).fillCircle(hx, hy - 42, 3) // pommeau doré
    } else if (cls === 'sorcier') {
      // grand chapeau étoilé, plus imposant que celui du mage
      g.fillStyle(0x4527a0).fillEllipse(hx, hy - 13, 52, 12) // large bord
      g.fillStyle(0x5e35b1).fillTriangle(hx - 22, hy - 13, hx + 22, hy - 13, hx + 9, hy - 52) // cône haut, penché
      g.fillStyle(0x311b6b).fillTriangle(hx + 1, hy - 30, hx + 22, hy - 13, hx + 9, hy - 52) // ombre du cône
      g.fillStyle(0xffd54f).fillCircle(hx + 9, hy - 50, 3.5) // pompon doré
      // étoiles scintillantes
      g.fillStyle(0xfff59d).fillCircle(hx - 6, hy - 24, 2.2).fillCircle(hx + 4, hy - 34, 1.8).fillCircle(hx + 12, hy - 22, 1.6)
    } else if (cls === 'chasseur') {
      // capuche à grande plume
      g.fillStyle(0x1b5e20).fillTriangle(hx - 20, hy - 10, hx + 20, hy - 10, hx, hy - 34) // capuche haute
      g.fillStyle(0x2e7d32).fillTriangle(hx - 20, hy - 10, hx + 14, hy - 10, hx - 2, hy - 30)
      g.fillStyle(0x0d3311).fillRect(hx - 20, hy - 12, 40, 4) // bandeau sombre
      g.fillStyle(0xef5350).fillTriangle(hx + 8, hy - 30, hx + 30, hy - 44, hx + 12, hy - 24) // grande plume rouge
      g.fillStyle(0xffcdd2).fillTriangle(hx + 11, hy - 30, hx + 24, hy - 40, hx + 13, hy - 26) // reflet de la plume
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
    } else if (cls === 'chevalier') {
      // grande épée à deux mains, lame large et longue
      g.lineStyle(6, 0xeceff1).beginPath(); g.moveTo(hx, hy + 6); g.lineTo(hx + 9, hy - 34); g.strokePath()
      g.lineStyle(2, 0xffffff).beginPath(); g.moveTo(hx + 1, hy + 2); g.lineTo(hx + 8, hy - 30); g.strokePath() // arête brillante
      g.fillStyle(0xffca28).fillRect(hx - 5, hy + 2, 14, 4) // large garde dorée
      g.fillStyle(0x8d6e63).fillRect(hx - 2, hy + 5, 5, 8) // poignée
    } else if (cls === 'sorcier') {
      // long bâton surmonté d'un grand orbe rayonnant
      g.lineStyle(4, 0x5e35b1).beginPath(); g.moveTo(hx, hy - 24); g.lineTo(hx + 2, hy + 8); g.strokePath()
      g.fillStyle(0xaa66ff, 0.35).fillCircle(hx, hy - 28, 9) // halo
      g.fillStyle(0xba68c8).fillCircle(hx, hy - 28, 6)
      g.fillStyle(0xe1bee7).fillCircle(hx - 2, hy - 30, 2.5) // reflet de l'orbe
    } else if (cls === 'chasseur') {
      // grand arc recourbé, plus large que celui de l'archer
      g.lineStyle(4, 0x5d4037).beginPath(); g.arc(hx - 2, hy - 3, 15, Phaser.Math.DegToRad(-80), Phaser.Math.DegToRad(80), false); g.strokePath()
      const c = Phaser.Math.DegToRad(-80), d = Phaser.Math.DegToRad(80)
      g.lineStyle(1.5, 0xeeeeee).beginPath()
      g.moveTo(hx - 2 + 15 * Math.cos(c), hy - 3 + 15 * Math.sin(c)); g.lineTo(hx - 2 + 15 * Math.cos(d), hy - 3 + 15 * Math.sin(d)); g.strokePath() // corde
      g.fillStyle(0xffca28).fillCircle(hx + 12, hy - 3, 2) // renfort doré
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
      // illustration par classe si dispo, sinon panda dessiné en code (fallback complet)
      if (!this.bakePandaClassFromArt(cls)) this.drawProceduralClass(cls)
    }
    // alias pour les menus (écran titre) : le panda novice (illustration si dispo)
    if (!this.bakePandaPose(this.pandaArtKey('novice', ''), 'panda')) this.pandaFrame('panda', {}, 'novice')
  }

  // clé de la texture d'illustration chargée pour une classe/pose
  private pandaArtKey(cls: ClassId, pose: string): string {
    return pose ? `pandaart-${cls}-${pose}` : `pandaart-${cls}`
  }

  // « Bake » d'une illustration dans une texture 64×92 (PANDA_TEX) identique en dimensions à la
  // frame procédurale — donc hitbox PANDA_BODY inchangée. On rogne l'art à sa boîte englobante
  // non-transparente (comme cleanArtTexture le fait via getImageData), on le met à l'échelle
  // uniformément vers une hauteur cible constante (STAND_H) en bornant la largeur (MAX_W, pas de
  // débordement), puis on l'ANCRE BAS-CENTRE (pieds sur la ligne FEET_Y=86, la même que la hitbox)
  // pour une baseline identique dans toutes les poses → pieds stables, pas de tremblement.
  // Renvoie false si l'art manque ou si le canvas 2D échoue (repli procédural).
  private bakePandaPose(srcKey: string, destKey: string): boolean {
    if (this.textures.exists(destKey)) return true
    if (!this.textures.exists(srcKey)) return false
    try {
      const STAND_H = 80, MAX_W = 62, FEET_Y = 86, ALPHA_MIN = 16
      const src = this.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const sw = src.width, sh = src.height
      const probe = document.createElement('canvas')
      probe.width = sw; probe.height = sh
      const pctx = probe.getContext('2d')
      if (!pctx) return false
      pctx.drawImage(src as CanvasImageSource, 0, 0)
      const data = pctx.getImageData(0, 0, sw, sh).data
      // boîte englobante des pixels non (quasi) transparents (ignore les halos très légers)
      let x0 = sw, y0 = sh, x1 = -1, y1 = -1
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if ((data[(y * sw + x) * 4 + 3] ?? 0) >= ALPHA_MIN) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1
      if (bw <= 0 || bh <= 0) return false
      const scale = Math.min(STAND_H / bh, MAX_W / bw)
      const dw = bw * scale, dh = bh * scale
      const dx = (PANDA_TEX.w - dw) / 2, dy = FEET_Y - dh
      // Ancre de tête de CETTE pose : centre horizontal de la bande supérieure du contenu
      // (sommet = crâne/oreilles), transformé dans le repère de la texture bakée puis exprimé en
      // offset depuis le centre du sprite. Le chapeau s'y colle → il suit la vraie hauteur de
      // tête de chaque frame (plus de « saut » entre poses de hauteurs de tête différentes).
      const bandH = Math.max(1, Math.round(bh * 0.18))
      let hx0 = sw, hx1 = -1
      for (let y = y0; y < y0 + bandH; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((data[(y * sw + x) * 4 + 3] ?? 0) >= ALPHA_MIN) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x }
        }
      }
      const headSrcX = hx1 >= hx0 ? (hx0 + hx1) / 2 : (x0 + x1) / 2
      PANDA_HEAD_ANCHORS[destKey] = {
        dx: dx + (headSrcX - x0) * scale - PANDA_TEX.w / 2,
        dy: dy - PANDA_TEX.h / 2,
      }
      const c = document.createElement('canvas')
      c.width = PANDA_TEX.w; c.height = PANDA_TEX.h
      const ctx = c.getContext('2d')
      if (!ctx) return false
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(src as CanvasImageSource, x0, y0, bw, bh, dx, dy, dw, dh)
      this.textures.addCanvas(destKey, c)
      return true
    } catch {
      return false
    }
  }

  // Bake les 4 poses illustrées d'une classe + crée ses anims (mêmes clés que le procédural :
  // idle / run / jump / attack). Marche = alternance idle ↔ course (effet de pas, ~7 fps), pieds
  // ancrés au sol donc pas de tremblement. Renvoie false si une pose manque (repli procédural).
  private bakePandaClassFromArt(cls: ClassId): boolean {
    for (const p of ['', 'course', 'saut', 'attaque']) {
      if (!this.textures.exists(this.pandaArtKey(cls, p))) return false
    }
    const ok =
      this.bakePandaPose(this.pandaArtKey(cls, ''), `panda-${cls}`) &&
      this.bakePandaPose(this.pandaArtKey(cls, 'course'), `panda-${cls}-course`) &&
      this.bakePandaPose(this.pandaArtKey(cls, 'saut'), `panda-${cls}-saut`) &&
      this.bakePandaPose(this.pandaArtKey(cls, 'attaque'), `panda-${cls}-attaque`)
    if (!ok) return false
    // pose de grimpe optionnelle (même détourage/rognage/ancrage-pieds → taille cohérente) ;
    // absente = repli sur l'ancienne grimpe procédurale dans Player.animateClimb
    this.bakePandaPose(this.pandaArtKey(cls, 'echelle'), `panda-${cls}-echelle`)
    if (!this.anims.exists(`panda-${cls}-run`)) {
      this.anims.create({ key: `panda-${cls}-idle`, frames: [{ key: `panda-${cls}` }], frameRate: 1, repeat: -1 })
      this.anims.create({ key: `panda-${cls}-run`, frames: [{ key: `panda-${cls}` }, { key: `panda-${cls}-course` }], frameRate: 7, repeat: -1 })
      this.anims.create({ key: `panda-${cls}-jump`, frames: [{ key: `panda-${cls}-saut` }], frameRate: 1, repeat: -1 })
      this.anims.create({ key: `panda-${cls}-attack`, frames: [{ key: `panda-${cls}-attaque` }], frameRate: 1, repeat: 0 })
    }
    return true
  }

  // panda dessiné en code (fallback quand l'illustration d'une classe manque)
  private drawProceduralClass(cls: ClassId) {
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

  // arme cosmétique par classe (overlay dessiné par-dessus l'illustration, patte avant du panda).
  // Grip (point de préhension) ancré en (20,44) dans une texture 40×60 ; Player positionne
  // l'image sur la patte avant. Le novice n'a pas d'arme (drawClassWeapon ne dessine rien).
  private bakeClassWeapons() {
    for (const cls of CLASSES) {
      if (cls === 'novice') continue
      const g = this.add.graphics()
      this.drawClassWeapon(g, cls, 20, 44)
      g.generateTexture(`weapon-${cls}`, 40, 60)
      g.destroy()
    }
  }

  // panda K.O. : allongé sur le dos, pattes en l'air, yeux en croix et langue pendante.
  // Format allongé (80×56) réutilisé dans le monde (il s'écroule) et sur l'écran K.O.
  private drawPandaDead() {
    const g = this.add.graphics()
    const W = 0xf7f7f7, K = 0x2b2b2b, PINK = 0xff9ab0
    // les quatre pattes pointées vers le haut (dessinées d'abord, derrière le corps)
    g.fillStyle(K)
    g.fillEllipse(26, 16, 7, 15) // bras avant
    g.fillEllipse(37, 11, 8, 17)
    g.fillEllipse(49, 10, 8, 17)
    g.fillEllipse(60, 15, 8, 15) // patte arrière
    // coussinets roses au bout des pattes en l'air
    g.fillStyle(PINK, 0.85)
    g.fillCircle(26, 10, 2.4).fillCircle(37, 4, 3).fillCircle(49, 3, 3).fillCircle(60, 9, 2.6)
    // corps allongé sur le dos, ventre en l'air
    g.fillStyle(K).fillEllipse(43, 35, 56, 34)
    g.fillStyle(W).fillEllipse(43, 34, 50, 28)
    g.fillStyle(0xe4e4e4).fillEllipse(45, 37, 32, 16) // ventre clair
    // tête basculée à gauche
    g.fillStyle(K).fillCircle(7, 20, 6).fillCircle(25, 18, 6) // oreilles
    g.fillStyle(K).fillCircle(16, 30, 15)
    g.fillStyle(W).fillCircle(16, 30, 12)
    // yeux en croix (X X)
    g.lineStyle(2.5, K)
    const drawX = (cx: number, cy: number, s: number) => {
      g.beginPath()
      g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s)
      g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s)
      g.strokePath()
    }
    drawX(11, 28, 3.4)
    drawX(21, 28, 3.4)
    // joues roses + truffe + langue qui pend
    g.fillStyle(PINK, 0.6).fillCircle(6, 33, 3).fillCircle(26, 33, 3)
    g.fillStyle(0x333333).fillEllipse(16, 36, 5, 3.5)
    g.fillStyle(PINK).fillRoundedRect(13, 38, 6, 8, 2.5) // langue pendante
    g.fillStyle(0xd47a8f).fillRect(15, 40, 2, 6) // sillon de la langue
    g.generateTexture('panda-mort', 80, 56)
    g.destroy()
  }

  private drawMonster(m: MonsterDef) {
    const s = m.boss ? 76 : m.mvp ? 56 : 40
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
      case 'angeling':
        body(); eyes(); mouth()
        g.lineStyle(2, 0xffd54f).beginPath(); g.arc(r, -4, r / 2.2, 0, Phaser.Math.DegToRad(360), false); g.strokePath() // auréole
        g.fillStyle(0xffffff, 0.85).fillEllipse(3, r - 2, 6, 11).fillEllipse(s - 3, r - 2, 6, 11) // petites ailes
        break
      case 'fabre':
        g.fillStyle(dark).fillEllipse(r + 4, r + 8, r - 3, r - 7) // segment arrière
        g.fillStyle(m.color).fillEllipse(r + 4, r + 8, r - 5, r - 9)
        g.fillStyle(dark).fillCircle(r - 8, r, 9) // segment tête
        g.fillStyle(m.color).fillCircle(r - 8, r, 7)
        g.fillStyle(0xffffff).fillCircle(r - 11, r - 2, 2).fillCircle(r - 5, r - 2, 2)
        g.fillStyle(0x000000).fillCircle(r - 11, r - 2, 1).fillCircle(r - 5, r - 2, 1)
        g.lineStyle(1.5, dark).beginPath(); g.moveTo(r - 12, r - 8); g.lineTo(r - 16, r - 15); g.moveTo(r - 4, r - 8); g.lineTo(r, r - 15); g.strokePath() // antennes
        g.fillStyle(dark).fillCircle(r - 16, r - 15, 1.5).fillCircle(r, r - 15, 1.5)
        break
      case 'lunatic':
        g.fillStyle(m.color).fillTriangle(r - 7, 2, r - 2, 2, r - 5, -15) // oreille longue gauche
        g.fillStyle(m.color).fillTriangle(r + 2, 2, r + 7, 2, r + 5, -15) // oreille longue droite
        g.fillStyle(0xffe0ec, 0.9).fillTriangle(r - 5.5, 0, r - 3, 0, r - 4.5, -11).fillTriangle(r + 3, 0, r + 5.5, 0, r + 4.5, -11) // intérieur oreille
        body(); eyes()
        g.fillStyle(0x000000).fillEllipse(r, r + r / 2, 4, 3) // truffe
        g.fillStyle(0xffffff).fillRect(r - 4, r + r / 1.7, 3, 5).fillRect(r + 1, r + r / 1.7, 3, 5) // grandes dents
        break
      case 'poporing':
        body(); eyes(); mouth()
        g.fillStyle(0x1b5e20).fillTriangle(r - 14, 4, r - 10, 4, r - 12, -6)
        g.fillStyle(0x1b5e20).fillTriangle(r - 6, 2, r - 2, 2, r - 4, -9)
        g.fillStyle(0x1b5e20).fillTriangle(r + 2, 2, r + 6, 2, r + 4, -9)
        g.fillStyle(0x1b5e20).fillTriangle(r + 10, 4, r + 14, 4, r + 12, -6)
        g.fillStyle(0x1b5e20).fillTriangle(r - 4, 0, r + 4, 0, r, -11) // épines
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
      case 'rocker':
        g.fillStyle(m.color).fillTriangle(2, r + 12, r - 6, r + 4, 6, s - 2) // patte arrière pliée gauche
        g.fillStyle(m.color).fillTriangle(s - 2, r + 12, r + 6, r + 4, s - 6, s - 2) // patte arrière pliée droite
        body(); eyes()
        g.fillStyle(0x4e342e).fillRect(r - 3, r + 1, 7, 11) // violon
        g.lineStyle(1, 0xd7ccc8).beginPath(); g.moveTo(r - 9, r - 2); g.lineTo(r + 9, r + 13); g.strokePath() // archet
        break
      case 'willow':
        g.fillStyle(dark).fillRoundedRect(r - 10, r - 4, 20, s - r, 4)
        g.fillStyle(m.color).fillRoundedRect(r - 8, r - 2, 16, s - r - 4, 4) // tronc
        g.fillStyle(0x2e7d32).fillCircle(r - 11, 0, 12).fillCircle(r + 11, 0, 12).fillCircle(r, -8, 14) // feuillage
        g.fillStyle(0xffffff).fillCircle(r - 5, r + 4, 4).fillCircle(r + 5, r + 4, 4)
        g.fillStyle(0x000000).fillCircle(r - 5, r + 4, 2).fillCircle(r + 5, r + 4, 2)
        g.lineStyle(2, 0x000000, 0.7).beginPath(); g.arc(r, r + 14, 6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath()
        break
      case 'scorpion':
        body()
        g.fillStyle(m.color).fillCircle(r - r / 1.2, r - 2, r / 3).fillCircle(r + r / 1.2, r - 2, r / 3) // pinces
        g.fillStyle(dark).fillCircle(r - r / 1.05, r - 4, r / 6).fillCircle(r + r / 1.05, r - 4, r / 6)
        g.fillStyle(m.color).fillCircle(r, r - r / 1.1, r / 4) // queue
        g.fillStyle(0xffee58).fillCircle(r, r - r / 0.9, r / 8) // dard
        eyes()
        break
      case 'orc-guerrier':
        body(); eyes()
        g.fillStyle(0xffffff).fillTriangle(r - 8, r + r / 1.5, r - 3, r + r / 1.5, r - 6, r + r / 1) // croc gauche
        g.fillStyle(0xffffff).fillTriangle(r + 3, r + r / 1.5, r + 8, r + r / 1.5, r + 6, r + r / 1) // croc droit
        g.fillStyle(0xd32f2f).fillRect(2, r - 8, s - 4, 5) // bandeau
        g.fillStyle(0x6d4c41).fillRect(s - 7, r - 16, 3, 26) // manche de hache
        g.fillStyle(0x9e9e9e).fillTriangle(s - 5, r - 16, s - 2, r - 6, s - 5, r + 4) // lame
        break
      case 'zombie':
        g.fillStyle(dark).fillCircle(r, r + 2, r - 1)
        g.fillStyle(m.color).fillCircle(r, r + 2, r - 3)
        g.fillStyle(0x33691e, 0.6).fillCircle(r - r / 1.6, r - r / 6, r / 5) // tache de pourriture
        g.fillStyle(0xffffff).fillCircle(r - r / 3, r, r / 5); g.fillStyle(0x000000).fillCircle(r - r / 3, r, r / 10) // un œil valide
        g.lineStyle(2, 0x000000).beginPath()
        g.moveTo(r + r / 3 - 3, r - 3); g.lineTo(r + r / 3 + 3, r + 3); g.moveTo(r + r / 3 + 3, r - 3); g.lineTo(r + r / 3 - 3, r + 3) // œil en croix
        g.strokePath()
        for (let i = -2; i <= 1; i++) { g.beginPath(); g.moveTo(r - 6 + i * 3, r + r / 1.6); g.lineTo(r - 4 + i * 3, r + r / 1.4); g.strokePath() } // bouche recousue
        break
      case 'mini-baphomet':
        g.fillStyle(0x2b1b1b).fillTriangle(r - 14, 2, r - 4, 4, r - 9, -16) // corne gauche
        g.fillStyle(0x2b1b1b).fillTriangle(r + 14, 2, r + 4, 4, r + 9, -16) // corne droite
        g.fillStyle(0x2b1b1b, 0.85).fillTriangle(0, r, r - 10, r - 4, 2, r + 12) // aile gauche
        g.fillStyle(0x2b1b1b, 0.85).fillTriangle(s, r, r + 10, r - 4, s - 2, r + 12) // aile droite
        body()
        g.fillStyle(0xffe082).fillCircle(r - r / 3, r, r / 5).fillCircle(r + r / 3, r, r / 5) // yeux démoniaques
        g.fillStyle(0xb71c1c).fillEllipse(r - r / 3, r, 3, r / 6).fillEllipse(r + r / 3, r, 3, r / 6) // pupilles fendues
        g.fillStyle(0x2b1b1b).fillTriangle(r - 4, r + r / 1.3, r + 4, r + r / 1.3, r, r + r / 0.85) // barbiche
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
      case 'fantome':
        g.fillStyle(m.color, 0.25).fillCircle(r, r + 2, r + 2) // halo translucide
        g.fillStyle(m.color, 0.6).fillCircle(r, r - 2, r - 5) // tête flottante
        g.fillStyle(m.color, 0.6).fillRect(r - r + 5, r - 2, s - 10, r) // corps
        for (let i = -1; i <= 1; i++) g.fillStyle(m.color, 0.6).fillTriangle(r + i * 10 - 5, r + r - 4, r + i * 10 + 5, r + r - 4, r + i * 10, s - 2) // bas ondulé
        g.fillStyle(0xffffff, 0.8).fillCircle(r - r / 3, r - 4, 3).fillCircle(r + r / 3, r - 4, 3)
        g.fillStyle(0x263238).fillCircle(r - r / 3, r - 4, 1.5).fillCircle(r + r / 3, r - 4, 1.5)
        break
      case 'pharaon-scarabee':
        body()
        g.fillStyle(0x1a1a1a).fillRect(r - r / 8, 4, r / 4, s - 8) // ligne de carapace
        g.lineStyle(3, 0xffd54f); g.beginPath(); g.moveTo(r, 6); g.lineTo(r - r / 2, r); g.moveTo(r, 6); g.lineTo(r + r / 2, r); g.strokePath() // antennes dorées
        eyes()
        break
      case 'flora-vorace':
        g.fillStyle(0x1b5e20).fillTriangle(r - 16, 6, r - 4, 4, r - 10, -14) // pétales
        g.fillStyle(0x1b5e20).fillTriangle(r + 16, 6, r + 4, 4, r + 10, -14)
        g.fillStyle(0x2e7d32).fillTriangle(r - 6, 4, r + 6, 4, r, -18)
        body()
        g.fillStyle(0x1b1b1b).fillEllipse(r, r + r / 2.2, r / 1.3, r / 2.2) // grande gueule
        g.fillStyle(0xffffff).fillTriangle(r - 8, r + r / 3, r - 4, r + r / 3, r - 6, r + r / 1.3).fillTriangle(r + 4, r + r / 3, r + 8, r + r / 3, r + 6, r + r / 1.3) // crocs
        eyes(-4)
        break
      case 'frelon-geant':
        g.fillStyle(0xfff9c4, 0.7).fillEllipse(4, r - 6, 16, 22).fillEllipse(s - 4, r - 6, 16, 22) // ailes
        body()
        g.fillStyle(0x1b1b1b).fillRect(2, r - 4, s - 4, 5).fillRect(2, r + 6, s - 4, 5) // rayures
        g.fillStyle(m.color).fillTriangle(r - 3, s - 6, r + 3, s - 6, r, s + 6) // dard
        eyes()
        break
      case 'singe-grimpeur':
        g.fillStyle(m.color).fillCircle(r - 15, r - 4, 9).fillCircle(r + 15, r - 4, 9) // oreilles
        g.fillStyle(0xd7ccc8).fillCircle(r - 15, r - 4, 6).fillCircle(r + 15, r - 4, 6)
        body()
        g.fillStyle(0xd7ccc8).fillEllipse(r, r + 6, r / 1.1, r / 1.6) // museau clair
        eyes(2); mouth()
        g.lineStyle(3, m.color).beginPath(); g.moveTo(s - 4, r); g.arc(s + 6, r - 6, 12, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(220), false); g.strokePath() // queue
        break
      case 'crabe-geant':
        g.fillStyle(m.color).fillCircle(r - r / 1.1, r - 2, r / 2.4).fillCircle(r + r / 1.1, r - 2, r / 2.4) // pinces
        g.fillStyle(0xbf360c).fillCircle(r - r / 1.1, r - 2, r / 4).fillCircle(r + r / 1.1, r - 2, r / 4)
        for (let i = -1; i <= 1; i += 2) { g.fillStyle(m.color).fillTriangle(r + i * r / 1.4, r + 8, r + i * (r / 1.4 - 6), r + 6, r + i * (r / 1.4 - 2), r + 16) } // pattes
        body(); eyes(-6)
        break
      case 'meduse':
        g.fillStyle(m.color, 0.55).fillEllipse(r, r - 4, s - 10, r + 4) // ombrelle
        g.fillStyle(0xffffff, 0.35).fillEllipse(r, r - 8, s - 20, r / 1.4)
        for (let i = -2; i <= 2; i++) { g.lineStyle(2, m.color, 0.7).beginPath(); g.moveTo(r + i * 6, r + 6); g.lineTo(r + i * 8, s - 2); g.strokePath() } // tentacules
        g.fillStyle(0xffffff, 0.8).fillCircle(r - r / 3, r - 6, 3).fillCircle(r + r / 3, r - 6, 3)
        g.fillStyle(0x4a148c).fillCircle(r - r / 3, r - 6, 1.5).fillCircle(r + r / 3, r - 6, 1.5)
        break
      case 'harpie':
        g.fillStyle(m.color).fillTriangle(0, r, r - 4, r - 10, 4, r + 18) // aile gauche
        g.fillStyle(m.color).fillTriangle(s, r, r + 4, r - 10, s - 4, r + 18) // aile droite
        body(); eyes()
        g.fillStyle(0xffca28).fillTriangle(r - 4, r + r / 2, r + 4, r + r / 2, r, r + r / 1.1) // bec
        g.fillStyle(0xffca28).fillTriangle(2, s - 4, 8, s - 4, 5, s + 6).fillTriangle(s - 2, s - 4, s - 8, s - 4, s - 5, s + 6) // serres
        break
      case 'yeti':
        g.fillStyle(dark).fillCircle(r, r + 2, r - 1)
        g.fillStyle(m.color).fillCircle(r, r + 2, r - 3)
        for (let i = 0; i < 6; i++) g.fillStyle(0xdcdcdc).fillTriangle(4 + i * (s - 8) / 5, r - 2, 8 + i * (s - 8) / 5, r - 2, 6 + i * (s - 8) / 5, r - 10) // fourrure hérissée
        g.fillStyle(0x37474f).fillEllipse(r - r / 3, r, r / 5, r / 6).fillEllipse(r + r / 3, r, r / 5, r / 6) // yeux plissés
        g.lineStyle(2, 0x000000, 0.7).beginPath(); g.arc(r, r + r / 1.5, r / 3, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath()
        break
      case 'golem-de-pierre':
        g.fillStyle(0x5a5148).fillRoundedRect(6, 4, s - 12, s - 4, 4)
        g.fillStyle(m.color).fillRoundedRect(9, 7, s - 18, s - 10, 4)
        g.lineStyle(2, 0x5a5148).beginPath(); g.moveTo(10, r); g.lineTo(r, r - 6); g.lineTo(s - 10, r + 4); g.strokePath() // lézardes
        g.fillStyle(0xffca28).fillCircle(r - r / 3, r, r / 6).fillCircle(r + r / 3, r, r / 6) // yeux luminescents
        break
      case 'gobelin-mineur':
        g.fillStyle(m.color).fillTriangle(r - 16, 2, r - 4, 6, r - 12, -10) // oreille pointue gauche
        g.fillStyle(m.color).fillTriangle(r + 16, 2, r + 4, 6, r + 12, -10)
        body(); eyes()
        g.fillStyle(0xffffff).fillTriangle(r - 3, r + r / 1.6, r + 1, r + r / 1.6, r - 1, r + r / 1.1) // croc
        g.fillStyle(0x6d4c41).fillRect(s - 6, r - 18, 3, 24) // manche pioche
        g.fillStyle(0x9e9e9e).fillTriangle(s - 10, r - 18, s + 2, r - 18, s - 4, r - 10) // tête de pioche
        break
      case 'goule':
        body()
        g.fillStyle(0x33691e, 0.5).fillEllipse(r - r / 1.5, r - r / 4, r / 4, r / 5).fillEllipse(r + r / 2, r + r / 3, r / 5, r / 6) // taches nécrosées
        g.fillStyle(0xffffff).fillCircle(r - r / 3, r, r / 5).fillCircle(r + r / 3, r, r / 5)
        g.fillStyle(0xb71c1c).fillCircle(r - r / 3, r, r / 10).fillCircle(r + r / 3, r, r / 10) // yeux injectés
        for (let i = -1; i <= 1; i += 2) g.fillStyle(0x37474f).fillTriangle(r + i * r / 1.3, r + 6, r + i * (r / 1.3 - 4), r + 4, r + i * (r / 1.3 - 6), r + 16) // griffes
        break
      case 'banshee':
        g.fillStyle(m.color, 0.2).fillCircle(r, r + 2, r + 2)
        g.fillStyle(m.color, 0.6).fillCircle(r, r - 2, r - 5)
        g.fillStyle(m.color, 0.6).fillRect(5, r - 2, s - 10, r)
        for (let i = -1; i <= 1; i++) g.fillStyle(m.color, 0.6).fillTriangle(r + i * 10 - 5, r + r - 4, r + i * 10 + 5, r + r - 4, r + i * 10, s - 2)
        g.fillStyle(0x000000).fillEllipse(r, r + 2, r / 3, r / 2.2) // bouche hurlante
        g.fillStyle(0xffffff, 0.9).fillCircle(r - r / 3, r - 6, 3).fillCircle(r + r / 3, r - 6, 3)
        break
      case 'diablotin':
        g.fillStyle(0x8a1414).fillTriangle(r - 12, 2, r - 4, 4, r - 9, -12) // cornes
        g.fillStyle(0x8a1414).fillTriangle(r + 12, 2, r + 4, 4, r + 9, -12)
        body(); eyes()
        g.fillStyle(0xffee58).fillCircle(r - r / 3, r, r / 6).fillCircle(r + r / 3, r, r / 6)
        g.fillStyle(0xb71c1c).fillEllipse(r - r / 3, r, 2, r / 8).fillEllipse(r + r / 3, r, 2, r / 8)
        g.lineStyle(2, m.color).beginPath(); g.moveTo(s - 4, r + 10); g.arc(s + 4, r + 14, 8, Phaser.Math.DegToRad(160), Phaser.Math.DegToRad(320), false); g.strokePath() // queue fourchue
        break
      case 'gargouille':
        g.fillStyle(0x37474f).fillTriangle(2, r, r - 6, r - 10, 4, r + 20) // aile gauche
        g.fillStyle(0x37474f).fillTriangle(s - 2, r, r + 6, r - 10, s - 4, r + 20) // aile droite
        g.fillStyle(0x2b1b1b).fillTriangle(r - 12, 4, r - 4, 6, r - 10, -10) // cornes
        g.fillStyle(0x2b1b1b).fillTriangle(r + 12, 4, r + 4, 6, r + 10, -10)
        body()
        g.fillStyle(0xffee58).fillCircle(r - r / 3, r, r / 6).fillCircle(r + r / 3, r, r / 6)
        mouth()
        break
      case 'gardien-sylve':
        // tronc noueux massif : occupe presque tout le gabarit pour intimider, visage grimaçant
        // et yeux rouges luisants (contact = piège quasi mortel, bien distinct des monstres mobiles)
        g.fillStyle(0x2b1f1a).fillRoundedRect(1, -2, s - 2, s + 6, 6) // écorce sombre
        g.fillStyle(m.color).fillRoundedRect(4, 1, s - 8, s, 6) // tronc
        g.lineStyle(2, 0x2b1f1a); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(6 + i * 3, 2); g.lineTo(4 + i * 4, s + 2); g.strokePath() } // nervures d'écorce
        g.fillStyle(0x2b1f1a).fillTriangle(4, 2, 12, -12, 16, 4).fillTriangle(s - 4, 2, s - 12, -12, s - 16, 4) // moignons de branches menaçants
        g.fillStyle(0x1a1210).fillEllipse(r - r / 2.6, r, 7, 9).fillEllipse(r + r / 2.6, r, 7, 9) // orbites creusées
        g.fillStyle(0xff1744).fillCircle(r - r / 2.6, r, 4).fillCircle(r + r / 2.6, r, 4) // yeux rouges luisants
        g.fillStyle(0xffcdd2, 0.6).fillCircle(r - r / 2.6 - 1, r - 1, 1.3).fillCircle(r + r / 2.6 - 1, r - 1, 1.3)
        g.fillStyle(0x1a1210).fillEllipse(r, r + r / 1.3, r / 1.3, r / 3) // bouche grimaçante grande ouverte
        g.fillStyle(0xe8e0d0).fillTriangle(r - 9, r + r / 1.7, r - 4, r + r / 1.7, r - 6.5, r + r / 1.1).fillTriangle(r + 4, r + r / 1.7, r + 9, r + r / 1.7, r + 6.5, r + r / 1.1) // crocs de bois
        break
      case 'gardien-pierre':
        // totem de pierre massif et anguleux, fissuré, yeux gravés incandescents
        g.fillStyle(0x3d3a36).fillRoundedRect(1, -4, s - 2, s + 8, 3) // socle sombre
        g.fillStyle(m.color).fillRoundedRect(3, -1, s - 6, s + 2, 3) // bloc de pierre
        g.lineStyle(2, 0x3d3a36).beginPath(); g.moveTo(6, 4); g.lineTo(r, r - 4); g.lineTo(s - 8, r + 8); g.moveTo(r + 6, -2); g.lineTo(r - 4, r + 10); g.strokePath() // fissures
        g.fillStyle(0x2b2925).fillTriangle(2, 6, 10, -10, 16, 8).fillTriangle(s - 2, 6, s - 10, -10, s - 16, 8) // arêtes menaçantes du sommet
        g.fillStyle(0x1a1816).fillRect(r - r / 1.6, r - 3, r / 1.6 * 2, 8) // sourcil massif gravé
        g.fillStyle(0xff8f00).fillCircle(r - r / 2.6, r + 2, 4.5).fillCircle(r + r / 2.6, r + 2, 4.5) // yeux incandescents
        g.fillStyle(0xffe0b2, 0.7).fillCircle(r - r / 2.6, r + 2, 4.5).fillCircle(r + r / 2.6, r + 2, 4.5)
        g.fillStyle(0x1a1816).fillRect(r - 10, r + r / 1.4, 20, 5) // bouche taillée, fermée et rigide
        break
      case 'gardien-flamme':
        // totem embrasé, silhouette large cerclée de flammes, regard rouge perçant
        g.fillStyle(0x6d1b0a, 0.9).fillTriangle(0, s, r - 6, r - 12, 6, 4).fillTriangle(s, s, r + 6, r - 12, s - 6, 4) // flammes latérales
        g.fillStyle(0x2b1b16).fillRoundedRect(4, -2, s - 8, s + 6, 5) // corps du totem calciné
        g.fillStyle(m.color).fillRoundedRect(7, 1, s - 14, s, 5)
        g.fillStyle(0xff7043).fillTriangle(r - 10, 2, r + 10, 2, r, -16) // couronne de flammes
        g.fillStyle(0xffd54f).fillTriangle(r - 5, 2, r + 5, 2, r, -10)
        g.fillStyle(0x1a0e0a).fillEllipse(r - r / 2.6, r, 6.5, 8).fillEllipse(r + r / 2.6, r, 6.5, 8) // orbites noircies
        g.fillStyle(0xff1744).fillCircle(r - r / 2.6, r, 4).fillCircle(r + r / 2.6, r, 4) // regard rouge perçant
        g.fillStyle(0xffee58, 0.8).fillCircle(r - r / 2.6, r, 1.6).fillCircle(r + r / 2.6, r, 1.6)
        g.fillStyle(0x1a0e0a).fillEllipse(r, r + r / 1.3, r / 1.2, r / 3) // bouche béante incandescente
        g.fillStyle(0xff7043).fillEllipse(r, r + r / 1.2, r / 2, r / 5)
        g.fillStyle(0xff7043, 0.5).fillCircle(r, s + 2, r / 1.2) // aura de flammes au sol
        break
      case 'seigneur-liane':
        for (let i = 0; i < 5; i++) { const a = Phaser.Math.DegToRad(i * 72 - 90); g.fillStyle(0x1b5e20).fillTriangle(r, r - 6, r + Math.cos(a) * 34, r + Math.sin(a) * 34 - 6, r + Math.cos(a + 0.5) * 20, r + Math.sin(a + 0.5) * 20 - 6) } // grande fleur de pétales
        body()
        g.fillStyle(0x0d1b0d).fillEllipse(r, r + r / 2, r / 1.1, r / 2) // gueule béante
        g.fillStyle(0xffffff).fillTriangle(r - 12, r + r / 3, r - 6, r + r / 3, r - 9, r + r / 0.9).fillTriangle(r + 6, r + r / 3, r + 12, r + r / 3, r + 9, r + r / 0.9)
        eyes(-8)
        g.lineStyle(3, 0x2e7d32); g.beginPath(); g.arc(-6, s / 2, 26, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false); g.arc(s + 6, s / 2, 26, Phaser.Math.DegToRad(120), Phaser.Math.DegToRad(240), false); g.strokePath() // lianes latérales
        break
      case 'golem-ancien':
        g.fillStyle(0x37474f).fillRoundedRect(4, 2, s - 8, s + 2, 6)
        g.fillStyle(m.color).fillRoundedRect(8, 6, s - 16, s - 8, 6)
        g.lineStyle(2, 0x37474f).beginPath(); g.moveTo(10, r - 6); g.lineTo(r + 4, r); g.lineTo(s - 12, r + 10); g.moveTo(r - 10, 8); g.lineTo(r, r - 4); g.strokePath() // lézardes anciennes
        g.fillStyle(0x4fc3f7).fillCircle(r - r / 3, r, r / 5).fillCircle(r + r / 3, r, r / 5) // yeux runiques
        g.fillStyle(0x4fc3f7, 0.5).fillCircle(r - r / 3, r, r / 3).fillCircle(r + r / 3, r, r / 3)
        g.fillStyle(0x263238).fillRect(r - 10, s - 10, 20, 6) // mâchoire de pierre
        break
      case 'roi-liche':
        body()
        g.fillStyle(0x000000).fillCircle(r - r / 3, r, r / 4).fillCircle(r + r / 3, r, r / 4) // orbites
        g.fillStyle(0x9575cd).fillCircle(r - r / 3, r, r / 8).fillCircle(r + r / 3, r, r / 8) // lueur spectrale
        g.lineStyle(2, 0x000000).beginPath(); g.moveTo(r - r / 2, r + r / 1.4); g.lineTo(r + r / 2, r + r / 1.4); g.strokePath()
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(r + i * 4, r + r / 1.6); g.lineTo(r + i * 4, r + r / 1.2); g.strokePath() }
        g.fillStyle(0xffd54f).fillTriangle(r - 20, 6, r - 8, 6, r - 14, -14).fillTriangle(r - 4, 6, r + 4, 6, r, -18).fillTriangle(r + 8, 6, r + 20, 6, r + 14, -14) // couronne du roi-liche
        g.fillStyle(0x4527a0, 0.5).fillRect(0, r + 12, s, s - r - 8) // robe spectrale
        break
      case 'seigneur-dechu':
        g.fillStyle(0x2b1b1b).fillTriangle(r - 20, 6, r - 6, 8, r - 14, -22) // grandes cornes
        g.fillStyle(0x2b1b1b).fillTriangle(r + 20, 6, r + 6, 8, r + 14, -22)
        g.fillStyle(0x2b1b1b, 0.9).fillTriangle(0, r - 4, r - 12, r - 14, 2, r + 26) // ailes démoniaques
        g.fillStyle(0x2b1b1b, 0.9).fillTriangle(s, r - 4, r + 12, r - 14, s - 2, r + 26)
        body()
        g.fillStyle(0xffee58).fillCircle(r - r / 3, r, r / 5).fillCircle(r + r / 3, r, r / 5)
        g.fillStyle(0xb71c1c).fillEllipse(r - r / 3, r, 3, r / 6).fillEllipse(r + r / 3, r, 3, r / 6) // pupilles fendues
        g.fillStyle(0xffffff).fillTriangle(r - 10, r + r / 1.5, r - 4, r + r / 1.5, r - 7, r + r / 1) .fillTriangle(r + 4, r + r / 1.5, r + 10, r + r / 1.5, r + 7, r + r / 1) // crocs immenses
        g.fillStyle(0xff7043, 0.5).fillCircle(r, s + 2, r / 1.3) // aura de flammes au sol
        break
      case 'mage-noir':
        body(); eyes()
        g.fillStyle(0x311b6b).fillTriangle(r - 12, 2, r + 12, 2, r, -20) // grand chapeau pointu
        g.fillStyle(0x311b6b).fillEllipse(r, 3, r + 2, 6) // bord du chapeau
        g.fillStyle(0xffca28).fillCircle(r + 2, -8, 2) // étoile sur le chapeau
        g.fillStyle(0x5e35b1).fillRect(s - 6, r - 6, 3, s - r) // bâton
        g.fillStyle(0xba68c8, 0.9).fillCircle(s - 4, r - 8, 4) // orbe magique
        break
      case 'pretre-goule':
        g.fillStyle(0x263238).fillTriangle(r - r, r + 2, r + r, r + 2, r, -14) // capuche
        g.fillStyle(0x1a1210).fillCircle(r, r + 2, r - 6) // visage dans l'ombre
        g.fillStyle(0x69f0ae).fillCircle(r - r / 3, r, r / 6).fillCircle(r + r / 3, r, r / 6) // yeux luisants
        g.fillStyle(0x455a64).fillRect(r - 4, r + r / 2, 8, s - r) // pendentif/robe
        g.fillStyle(0xb0bec5).fillRect(r - 1, r + r / 2, 2, 8).fillRect(r - 3, r + r / 2 + 2, 6, 2) // petite croix
        break
      case 'poring-dore':
        // poring royal doré : slime bombé, épines dorées, brillance nacrée
        body(); eyes(); mouth()
        g.fillStyle(0xfff59d, 0.6).fillCircle(r - r / 2, r - r / 2, r / 5) // brillance
        g.fillStyle(0xffe082).fillTriangle(r - 12, 2, r - 6, 2, r - 9, -8).fillTriangle(r + 6, 2, r + 12, 2, r + 9, -8).fillTriangle(r - 3, 0, r + 3, 0, r, -11) // épines dorées
        break
      case 'orc-seigneur':
        // chef orc massif : peau sombre, défenses, casque à cornes et hache lourde
        body(); eyes()
        g.fillStyle(0xffffff).fillTriangle(r - 9, r + r / 1.5, r - 3, r + r / 1.5, r - 6, r + r / 0.9).fillTriangle(r + 3, r + r / 1.5, r + 9, r + r / 1.5, r + 6, r + r / 0.9) // défenses
        g.fillStyle(0x455a64).fillRect(2, r - 10, s - 4, 7) // casque
        g.fillStyle(0x263238).fillTriangle(2, r - 10, 10, r - 26, 14, r - 10).fillTriangle(s - 2, r - 10, s - 10, r - 26, s - 14, r - 10) // cornes du casque
        g.fillStyle(0x6d4c41).fillRect(s - 8, r - 20, 4, 34) // manche de hache
        g.fillStyle(0xb0bec5).fillTriangle(s - 6, r - 22, s + 6, r - 18, s - 6, r - 2) // lame de hache
        break
      case 'roi-crabe':
        // crabe monarque : grosses pinces, carapace bombée, petite couronne au sommet
        g.fillStyle(m.color).fillCircle(r - r / 1.05, r, r / 2).fillCircle(r + r / 1.05, r, r / 2) // pinces
        g.fillStyle(0xbf360c).fillCircle(r - r / 1.05, r, r / 3.5).fillCircle(r + r / 1.05, r, r / 3.5)
        for (let i = -1; i <= 1; i += 2) g.fillStyle(m.color).fillTriangle(r + i * r / 1.3, r + 10, r + i * (r / 1.3 - 7), r + 8, r + i * (r / 1.3 - 2), r + 20) // pattes
        body(); eyes(-6)
        g.fillStyle(0xffd700).fillRect(r - 9, 3, 18, 5).fillTriangle(r - 9, 3, r - 5, -6, r - 1, 3).fillTriangle(r - 1, 3, r + 4, -8, r + 9, 3) // couronne
        break
      case 'spectre-ancien':
        // spectre royal : voile fantomatique lumineux, yeux ardents, diadème spectral
        g.fillStyle(m.color, 0.22).fillCircle(r, r + 2, r + 3) // aura spectrale
        g.fillStyle(m.color, 0.6).fillCircle(r, r - 2, r - 5) // tête flottante
        g.fillStyle(m.color, 0.55).fillRect(r - r + 6, r - 2, s - 12, r) // voile
        for (let i = -1; i <= 1; i++) g.fillStyle(m.color, 0.55).fillTriangle(r + i * 12 - 6, r + r - 4, r + i * 12 + 6, r + r - 4, r + i * 12, s - 2) // bas ondulé
        g.fillStyle(0xede7f6, 0.9).fillCircle(r - r / 3, r - 4, 4).fillCircle(r + r / 3, r - 4, 4)
        g.fillStyle(0x7c4dff).fillCircle(r - r / 3, r - 4, 2).fillCircle(r + r / 3, r - 4, 2) // yeux ardents
        g.fillStyle(0xd1c4e9).fillTriangle(r - 12, 4, r - 5, 4, r - 8, -6).fillTriangle(r - 3, 3, r + 3, 3, r, -9).fillTriangle(r + 5, 4, r + 12, 4, r + 8, -6) // diadème spectral
        break
      case 'dragon-flamme':
        // dragon ardent : ailes membraneuses, cornes, gueule en feu
        g.fillStyle(0x7f1d1d, 0.9).fillTriangle(0, r - 6, r - 8, r - 12, 4, r + 22).fillTriangle(s, r - 6, r + 8, r - 12, s - 4, r + 22) // ailes
        g.fillStyle(0x2b1010).fillTriangle(r - 14, 4, r - 5, 6, r - 11, -14).fillTriangle(r + 14, 4, r + 5, 6, r + 11, -14) // cornes
        body()
        g.fillStyle(0xffee58).fillCircle(r - r / 3, r - 2, r / 5).fillCircle(r + r / 3, r - 2, r / 5) // yeux
        g.fillStyle(0xb71c1c).fillEllipse(r - r / 3, r - 2, 3, r / 6).fillEllipse(r + r / 3, r - 2, 3, r / 6) // pupilles fendues
        g.fillStyle(0x1a0a0a).fillEllipse(r, r + r / 1.6, r / 1.4, r / 3) // gueule
        g.fillStyle(0xff7043).fillEllipse(r, r + r / 1.5, r / 2, r / 6) // souffle de feu
        g.fillStyle(0xffca28, 0.7).fillCircle(r, s + 2, r / 1.4) // aura de braises au sol
        break
      default:
        body(); eyes(); mouth()
    }

    if (m.mvp) {
      // marque d'élite : double halo doré + étoiles scintillantes, distinct de la couronne des boss
      g.lineStyle(3, 0xffd54f, 0.85).strokeCircle(r, r + 2, r + 1)
      g.lineStyle(1.5, 0xfff59d, 0.5).strokeCircle(r, r + 2, r + 4)
      g.fillStyle(0xfff59d)
      for (const [sx, sy] of [[r - 13, 8], [r, 3], [r + 13, 8]] as [number, number][]) {
        g.fillTriangle(sx - 3, sy, sx + 3, sy, sx, sy - 5).fillTriangle(sx - 3, sy, sx + 3, sy, sx, sy + 5)
      }
    }

    if (m.boss) {
      g.fillStyle(0xffd54f).fillTriangle(r - 14, 8, r - 7, 18, r, 8).fillTriangle(r, 8, r + 7, 18, r + 14, 8)
      g.fillRect(r - 14, 15, 28, 5)
      g.fillStyle(0xff5252).fillCircle(r, 8, 2).fillCircle(r - 14, 8, 2).fillCircle(r + 14, 8, 2) // joyaux
    }
    g.generateTexture(`monster-${m.id}`, s, s + 6)
    g.destroy()
  }

  // chapeaux cosmétiques (slot 'hat') : dessinés pensés pour se poser sur le haut de la tête du panda
  private drawCosmetic(id: string) {
    const g = this.add.graphics()
    switch (id) {
      case 'chapeau-poring': {
        // petite tête de Poring : blob rose bombé, ventre plus clair, gros reflet, joues + frimousse
        g.fillStyle(0xd94f8a).fillEllipse(20, 19, 33, 25) // liseré rose foncé (donne le volume)
        g.fillStyle(0xff7fb2).fillEllipse(20, 17, 30, 22) // corps rose bombé
        g.fillStyle(0xff9fc8).fillEllipse(20, 21, 22, 13) // bas plus clair (dégradé)
        g.fillStyle(0xffffff, 0.55).fillEllipse(13, 9, 12, 7) // gros reflet brillant (haut-gauche)
        g.fillStyle(0xffffff, 0.8).fillCircle(27, 8, 1.8) // petit éclat
        g.fillStyle(0xff5a9e, 0.5).fillCircle(10, 21, 3).fillCircle(30, 21, 3) // joues roses
        g.fillStyle(0x2b2b2b).fillEllipse(14, 17, 4.5, 6).fillEllipse(26, 17, 4.5, 6) // yeux mignons
        g.fillStyle(0xffffff).fillCircle(12.6, 15, 1.5).fillCircle(24.6, 15, 1.5) // reflets des yeux
        g.lineStyle(1.8, 0x2b2b2b).beginPath() // petit sourire
        g.arc(20, 19, 4.5, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false)
        g.strokePath()
        break
      }
      case 'ailes-angeling':
        g.lineStyle(2, 0xffd54f).strokeCircle(20, 6, 9) // auréole
        g.fillStyle(0xffffff, 0.95).fillEllipse(6, 22, 12, 20).fillEllipse(34, 22, 12, 20) // ailes
        g.fillStyle(0xe0e0e0, 0.6).fillEllipse(6, 22, 6, 12).fillEllipse(34, 22, 6, 12)
        break
      case 'couronne-royale':
        g.fillStyle(0xffd700).fillRect(4, 18, 32, 8)
        g.fillStyle(0xffd700).fillTriangle(4, 18, 10, 4, 16, 18)
        g.fillStyle(0xffd700).fillTriangle(16, 18, 20, 0, 24, 18)
        g.fillStyle(0xffd700).fillTriangle(24, 18, 30, 4, 36, 18)
        g.fillStyle(0xd32f2f).fillCircle(10, 12, 2.5)
        g.fillStyle(0x1e88e5).fillCircle(20, 6, 2.5)
        g.fillStyle(0x43a047).fillCircle(30, 12, 2.5)
        break
      case 'bonnet-champi':
        g.fillStyle(0xd32f2f).fillEllipse(20, 16, 34, 22)
        g.fillStyle(0xf5f5f5).fillCircle(11, 10, 3).fillCircle(24, 8, 3).fillCircle(30, 16, 3).fillCircle(16, 20, 2.5)
        g.fillStyle(0xf5f5dc).fillRect(6, 24, 28, 5) // bord du bonnet
        break
      case 'casque-orc':
        g.fillStyle(0x546e5a).fillEllipse(20, 18, 32, 20)
        g.fillStyle(0x37474f).fillRect(4, 16, 32, 6) // bande frontale
        g.fillStyle(0x8d6e63).fillTriangle(4, 16, 0, 4, 10, 16) // corne gauche
        g.fillStyle(0x8d6e63).fillTriangle(36, 16, 40, 4, 30, 16) // corne droite
        g.fillStyle(0x263238).fillRect(14, 18, 12, 3) // fente visière
        break
      default:
        g.fillStyle(0xce93d8).fillEllipse(20, 16, 26, 18)
    }
    g.generateTexture(`cosmetic-${id}`, 40, 32)
    g.destroy()
  }

  private drawDecor() {
    for (const [id, b] of Object.entries(BIOMES)) {
      const g = this.add.graphics()
      let w = 40, h = 48
      switch (b.deco) {
        case 'buisson':
          w = 40; h = 36
          g.fillStyle(0x3f8f3f).fillEllipse(20, 26, 40, 24).fillEllipse(8, 30, 20, 16).fillEllipse(32, 30, 20, 16)
          g.fillStyle(0x5cb85c).fillEllipse(20, 22, 34, 18)
          break
        case 'arbre':
          w = 44; h = 64
          g.fillStyle(0x5d4037).fillRect(18, 44, 8, 20)
          g.fillStyle(0x2e5e30).fillCircle(22, 24, 20)
          g.fillStyle(0x3c7d3f).fillCircle(14, 20, 12).fillCircle(30, 22, 12).fillCircle(22, 13, 12)
          break
        case 'cactus':
          w = 34; h = 56
          g.fillStyle(0x3c7d3f).fillRoundedRect(12, 10, 10, 46, 4)
          g.fillStyle(0x4a9d4a).fillRoundedRect(2, 26, 8, 16, 3).fillRoundedRect(24, 20, 8, 22, 3)
          break
        case 'stalagmite':
          w = 32; h = 48
          g.fillStyle(0x50505c).fillTriangle(4, 48, 16, 4, 28, 48)
          g.fillStyle(0x6a6a78).fillTriangle(10, 48, 16, 18, 22, 48)
          break
        case 'palmier':
          w = 48; h = 64
          g.fillStyle(0x8d6e63).fillRoundedRect(20, 24, 7, 40, 3)
          g.fillStyle(0x2e7d32).fillEllipse(24, 20, 34, 10).fillEllipse(14, 16, 20, 8).fillEllipse(34, 16, 20, 8)
          g.fillStyle(0x3c9d42).fillEllipse(24, 14, 16, 8)
          break
        case 'pierre':
          w = 42; h = 34
          g.fillStyle(0x6f665e).fillEllipse(21, 22, 40, 22)
          g.fillStyle(0x8a8078).fillEllipse(16, 16, 20, 12).fillEllipse(30, 18, 16, 10)
          break
        case 'tombe':
          w = 34; h = 46
          g.fillStyle(0x455058).fillRoundedRect(6, 6, 22, 40, 8)
          g.fillStyle(0x6a7680).fillRoundedRect(8, 10, 18, 34, 6)
          g.fillStyle(0x2f363c).fillRect(15, 16, 4, 16).fillRect(9, 21, 16, 4)
          break
        case 'flamme':
          w = 36; h = 48
          g.fillStyle(0xb71c1c).fillTriangle(6, 48, 18, 2, 30, 48)
          g.fillStyle(0xff7043).fillTriangle(11, 48, 18, 16, 25, 48)
          g.fillStyle(0xffd54f).fillTriangle(15, 48, 18, 30, 21, 48)
          break
        case 'liane':
          w = 30; h = 64
          g.fillStyle(0x2f6f22).fillRect(13, 0, 4, 60)
          g.fillStyle(0x3f8f2f).fillEllipse(9, 18, 12, 7).fillEllipse(21, 34, 12, 7).fillEllipse(9, 50, 12, 7)
          break
        case 'sapin':
          w = 44; h = 64
          g.fillStyle(0x5d4037).fillRect(19, 50, 6, 14)
          g.fillStyle(0x1f5e32).fillTriangle(6, 50, 22, 12, 38, 50)
          g.fillStyle(0x2e7d42).fillTriangle(9, 36, 22, 8, 35, 36)
          break
      }
      g.generateTexture(`deco-${id}`, w, h)
      g.destroy()
    }
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
      case 'roar':
        g.fillStyle(c).fillCircle(cx, cy + 4, 7)
        g.fillStyle(0x2b2b2b).fillTriangle(cx - 4, cy + 2, cx + 4, cy + 2, cx, cy + 9) // gueule ouverte
        g.lineStyle(2, c); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, cy + 2, 10 + i * 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath() }
        break
      case 'thrust':
        g.lineStyle(4, c).beginPath(); g.moveTo(cx, 32); g.lineTo(cx, 10); g.strokePath()
        g.fillStyle(c).fillTriangle(cx - 5, 12, cx + 5, 12, cx, 4)
        g.lineStyle(2, 0x9e9e9e).beginPath(); g.moveTo(cx - 6, 27); g.lineTo(cx + 6, 27); g.strokePath() // garde
        break
      case 'wave':
        g.lineStyle(3, c); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(8 + i * 2, 22, 9 + i * 6, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false); g.strokePath() }
        break
      case 'heart':
        g.fillStyle(c).fillCircle(cx - 5, cy - 3, 6).fillCircle(cx + 5, cy - 3, 6).fillTriangle(cx - 10, cy - 1, cx + 10, cy - 1, cx, cy + 11)
        break
      case 'ray':
        g.fillStyle(c, 0.35).fillTriangle(cx - 9, 34, cx + 9, 34, cx, 6)
        g.lineStyle(3, c).beginPath(); g.moveTo(cx, 32); g.lineTo(cx, 8); g.strokePath()
        g.fillStyle(0xffffff).fillCircle(cx, 8, 3)
        break
      case 'quickshot':
        g.lineStyle(2, c).beginPath(); g.moveTo(11, 27); g.lineTo(25, 13); g.strokePath()
        g.fillStyle(c).fillTriangle(25, 13, 18, 15, 23, 20)
        g.lineStyle(2, c, 0.5).beginPath(); g.moveTo(6, 32); g.lineTo(15, 23); g.strokePath()
        break
      case 'lob':
        g.lineStyle(2, c).beginPath(); g.arc(cx, 30, 14, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false); g.strokePath()
        g.fillStyle(c).fillCircle(cx + 14, 30, 3)
        g.fillStyle(c, 0.4).fillCircle(cx - 14, 30, 2.5).fillCircle(cx - 2, 17, 2)
        break
    }
    g.generateTexture(`skill-${id}`, 44, 44)
    g.destroy()
  }

  // interpolation entre plusieurs paliers de couleur (dégradé fait main : fillGradientStyle est
  // WebGL only et ne rend pas en Canvas — on peint des bandes de fillRect interpolées)
  private lerpStops(stops: Array<[number, [number, number, number]]>, t: number): number {
    let a = stops[0]!, b = stops[stops.length - 1]!
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i]!, s1 = stops[i + 1]!
      if (t >= s0[0] && t <= s1[0]) { a = s0; b = s1; break }
    }
    const lt = (t - a[0]) / ((b[0] - a[0]) || 1)
    const r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * lt)
    const g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * lt)
    const bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * lt)
    return (r << 16) | (g << 8) | bl
  }

  // assets de l'écran titre : ciel dramatique en dégradé + halo, et lignes de vitesse (manga)
  private drawTitleAssets() {
    // ciel couché de soleil shōnen : violet profond → magenta → orangé → or pâle
    const sky = this.add.graphics()
    const stops: Array<[number, [number, number, number]]> = [
      [0.0, [0x2a, 0x17, 0x5e]],
      [0.34, [0x7b, 0x2d, 0x8e]],
      [0.58, [0xff, 0x5e, 0x3a]],
      [0.8, [0xff, 0xa0, 0x54]],
      [1.0, [0xff, 0xe1, 0x9a]],
    ]
    const bands = 90
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1)
      const y0 = Math.floor((540 / bands) * i)
      const h = Math.ceil(540 / bands) + 1
      sky.fillStyle(this.lerpStops(stops, t), 1).fillRect(0, y0, 960, h)
    }
    // halo de soleil bas-centre pour ancrer la lumière derrière le héros
    sky.fillStyle(0xffefc0, 0.22).fillCircle(480, 320, 300)
    sky.fillStyle(0xffe3a0, 0.22).fillCircle(480, 320, 200)
    sky.fillStyle(0xfff6de, 0.25).fillCircle(480, 320, 110)
    sky.generateTexture('title-sky', 960, 540)
    sky.destroy()

    // lignes de vitesse / concentration : rayons clairs partant du centre (un wedge sur deux)
    const RS = 1200, c = RS / 2, R = 900, N = 34
    const rays = this.add.graphics()
    for (let i = 0; i < N; i += 2) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2
      rays.fillStyle(0xfff6d5, 0.5)
      rays.fillTriangle(c, c, c + Math.cos(a0) * R, c + Math.sin(a0) * R, c + Math.cos(a1) * R, c + Math.sin(a1) * R)
    }
    rays.generateTexture('title-rays', RS, RS)
    rays.destroy()
  }

  create() {
    this.drawPandas()
    this.bakeClassWeapons()
    this.drawPandaDead()
    // PNJ pandas de la ville + illustration K.O. (détourés + rognés)
    for (const id of NPC_IDS) this.bakeCropped(`npcart-${id}`, `npc-${id}`)
    this.bakeCropped('deathart-panda', 'death-panda')
    this.drawDecor()
    for (const item of Object.values(ITEMS)) if (item.slot === 'hat') this.drawCosmetic(item.id)
    for (const m of Object.values(MONSTERS)) {
      // texture d'art disponible → on la bake ; sinon repli sur le dessin procédural
      if (this.textures.exists(`art-${m.id}`)) this.artMonster(m.id, isBigArt(m))
      else this.drawMonster(m)
    }
    for (const s of Object.values(SKILLS)) this.drawSkillIcon(s.id, SKILL_ICONS[s.id] ?? { color: 0xffd54f, glyph: 'sword' })

    // Tuiles de terrain illustrées (32×32, réutilisées à l'identique par le sol et les
    // plateformes) : dessus herbeux arrondi + terre en dessous. Le dessus (bande d'herbe) est
    // calé sur le HAUT de la texture = haut du corps de collision, donc le panda pose ses pieds
    // sur l'herbe. Le motif des touffes est régulier (pas de 8 px) → carrelage sans couture en
    // largeur. Les couleurs viennent du biome (b.tile.*) → teinte adaptée automatiquement.
    for (const [id, b] of Object.entries(BIOMES)) {
      const { soil, top, speck } = b.tile
      // --- SOL : bloc de terre continu, dessus herbeux
      const g = this.add.graphics()
      g.fillStyle(soil).fillRect(0, 0, 32, 32)
      // relief de terre : mouchetures + cailloux (loin des bords pour un raccord propre)
      g.fillStyle(speck).fillEllipse(9, 21, 6, 4).fillEllipse(23, 27, 7, 4).fillEllipse(17, 15, 4, 3)
      g.fillStyle(0x000000, 0.12).fillEllipse(23, 28, 5, 2)
      g.fillStyle(0xffffff, 0.05).fillEllipse(9, 20, 4, 2)
      // bande d'herbe (dessus) — calée sur le haut de la texture
      g.fillStyle(top).fillRect(0, 0, 32, 10)
      // touffes d'herbe qui débordent sur la terre + reflet clair au sommet
      for (let tx = 0; tx < 32; tx += 8) g.fillTriangle(tx, 10, tx + 6, 10, tx + 3, 15)
      g.fillStyle(0xffffff, 0.16).fillRect(0, 0, 32, 3)
      g.fillStyle(0x000000, 0.10).fillRect(0, 8, 32, 2) // ombre douce sous l'herbe
      g.fillStyle(0x000000, 0.10).fillRect(0, 30, 32, 2) // liseré bas (rangées empilées)
      g.generateTexture(`tile-${id}`, 32, 32)
      g.destroy()

      // --- PLATEFORME flottante : même dessus herbeux, mais tranche de terre marquée par une
      // sous-face sombre (effet de dalle qui flotte). Même taille 32×32 → corps identique.
      const p = this.add.graphics()
      p.fillStyle(soil).fillRect(0, 0, 32, 32)
      p.fillStyle(speck).fillEllipse(10, 20, 6, 4).fillEllipse(22, 24, 6, 4)
      p.fillStyle(0x000000, 0.16).fillRect(0, 24, 32, 8) // tranche de terre ombrée
      p.fillStyle(0x000000, 0.28).fillRect(0, 30, 32, 2) // sous-face sombre
      p.fillStyle(top).fillRect(0, 0, 32, 10) // dessus herbe = haut de collision
      for (let tx = 0; tx < 32; tx += 8) p.fillTriangle(tx, 10, tx + 6, 10, tx + 3, 15)
      p.fillStyle(0xffffff, 0.20).fillRect(0, 0, 32, 3)
      p.fillStyle(0x000000, 0.10).fillRect(0, 8, 32, 2)
      p.generateTexture(`platform-${id}`, 32, 32)
      p.destroy()
    }

    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.25).fillCircle(9, 9, 8); g.fillStyle(0xffee58).fillCircle(9, 9, 7); g.fillStyle(0xffffff).fillCircle(6, 6, 3); g.generateTexture('projectile', 18, 18); g.clear()
    // faisceau (flèche perçante / laser) : capsule allongée lumineuse
    g.fillStyle(0xffffff).fillRoundedRect(0, 5, 48, 8, 4)
    g.fillStyle(0xfff176).fillRoundedRect(2, 6, 44, 6, 3); g.generateTexture('beam', 48, 18); g.clear()
    // bambou lancé (bâton vert à nœuds)
    g.fillStyle(0x33691e).fillRoundedRect(0, 3, 26, 8, 3)
    g.fillStyle(0x7cb342).fillRoundedRect(1, 4, 24, 5, 2)
    g.fillStyle(0x33691e).fillRect(8, 3, 2, 8).fillRect(17, 3, 2, 8); g.generateTexture('bamboo', 26, 14); g.clear()
    // pics (rangée de pointes) — piège
    g.fillStyle(0x9e9e9e); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8, 16, i * 8 + 4, 2, i * 8 + 8, 16)
    g.fillStyle(0xcfd8dc); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8 + 2, 16, i * 8 + 4, 6, i * 8 + 6, 16)
    g.generateTexture('spikes', 32, 16); g.clear()
    // eau (zone nageable, translucide : on voit le panda dedans)
    g.fillStyle(0x1e88e5, 0.38).fillRect(0, 0, 32, 32)
    g.fillStyle(0x64b5f6, 0.45).fillRect(0, 0, 32, 5)
    g.fillStyle(0xbbdefb, 0.35).fillRect(4, 12, 8, 2).fillRect(18, 22, 9, 2); g.generateTexture('water', 32, 32); g.clear()
    // échelle en bois (montants + barreaux, répétée verticalement)
    g.fillStyle(0x8d6e63).fillRect(4, 0, 5, 32).fillRect(23, 0, 5, 32) // montants
    g.fillStyle(0xa1887f).fillRect(4, 0, 2, 32).fillRect(23, 0, 2, 32) // reflet clair des montants
    g.fillStyle(0xa1887f).fillRect(4, 4, 24, 4).fillRect(4, 20, 24, 4) // barreaux
    g.fillStyle(0x6d4c41).fillRect(4, 7, 24, 1).fillRect(4, 23, 24, 1); g.generateTexture('ladder', 32, 32); g.clear()
    // drapeau de checkpoint (mât + fanion), teinté vert une fois activé
    g.fillStyle(0x9e9e9e).fillRect(3, 0, 3, 44)
    g.fillStyle(0xffffff).fillTriangle(6, 2, 6, 18, 26, 10); g.generateTexture('flag', 30, 44); g.clear()
    // pont de planches en bois
    g.fillStyle(0x8d6e63).fillRect(0, 0, 32, 12)
    g.fillStyle(0xa1887f).fillRect(0, 0, 32, 3) // dessus clair (surface où l'on pose les pieds)
    g.fillStyle(0x6d4c41).fillRect(0, 10, 32, 2) // ombre basse
    g.fillStyle(0x5d4037).fillRect(10, 0, 2, 12).fillRect(21, 0, 2, 12) // séparations de planches
    g.fillStyle(0x4e342e).fillCircle(3, 6, 1).fillCircle(29, 6, 1); g.generateTexture('bridge', 32, 12); g.clear()
    // sortie : GRANDE porte-portail lumineux (≈ 2× la hauteur du panda). Arc de pierre + cœur
    // de lumière blanc→jaune. Le halo pulsant est ajouté en scène (createExit) par-dessus 'exit-glow'.
    {
      const EW = 140, EH = 210, cx = 70, archY = 74, Ro = 62, Ri = 46, baseY = 198
      // cadre de pierre (arrière) : arc plein + corps
      g.fillStyle(0x37474f).fillCircle(cx, archY, Ro).fillRect(cx - Ro, archY, Ro * 2, baseY - archY)
      g.fillStyle(0x546e7a).fillCircle(cx, archY, Ro - 5).fillRect(cx - Ro + 5, archY, (Ro - 5) * 2, baseY - archY)
      g.fillStyle(0x78909c).fillCircle(cx, archY, Ro - 9).fillRect(cx - Ro + 9, archY, (Ro - 9) * 2, baseY - archY) // biseau clair
      // cœur de lumière : arc blanc en haut, corps dégradé blanc→jaune vers le bas
      g.fillStyle(0xffffff).fillCircle(cx, archY, Ri)
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffd54f, 0xffe082, 1).fillRect(cx - Ri, archY, Ri * 2, baseY - archY)
      // colonne lumineuse centrale plus intense (appel du regard)
      g.fillStyle(0xffffff, 0.55).fillEllipse(cx, (archY + baseY) / 2, Ri * 0.9, (baseY - archY) * 0.95)
      g.fillStyle(0xfffde7, 0.9).fillEllipse(cx, (archY + baseY) / 2 - 6, Ri * 0.5, (baseY - archY) * 0.85)
      // clé de voûte + pommeaux décoratifs
      g.fillStyle(0xcfd8dc).fillCircle(cx, archY - Ro + 8, 7)
      g.fillStyle(0xffd54f).fillCircle(cx, archY - Ro + 8, 4)
      // étincelles blanches qui montent dans la lumière
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(cx - 12, archY + 30, 2.5).fillCircle(cx + 16, archY + 70, 2).fillCircle(cx - 6, archY + 100, 3).fillCircle(cx + 8, baseY - 30, 2.2)
      // socle de pierre au sol (la porte repose dessus)
      g.fillStyle(0x263238).fillRoundedRect(cx - Ro - 6, baseY - 4, (Ro + 6) * 2, 16, 4)
      g.fillStyle(0x455a64).fillRoundedRect(cx - Ro - 2, baseY - 2, (Ro + 2) * 2, 8, 3)
      g.generateTexture('exit', EW, EH); g.clear()
      // halo doux (dégradé radial simulé par ellipses concentriques) — teinté + pulsé en scène
      for (let i = 14; i >= 1; i--) {
        g.fillStyle(0xffffff, 0.05).fillEllipse(110, 130, (220 * i) / 14, (260 * i) / 14)
      }
      g.generateTexture('exit-glow', 220, 260); g.clear()
    }
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
    this.drawTitleAssets()
    this.scene.start('Title')
  }
}
