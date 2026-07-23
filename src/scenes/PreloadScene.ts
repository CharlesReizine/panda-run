import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { SKILLS } from '../data/skills'
import { BIOMES } from '../data/biomes'
import { ITEMS, rarityColor } from '../data/items'
import { LEVELS } from '../data/levels'
import type { MonsterDef, WeaponType } from '../core/types'
import { stripBorderBackground } from '../core/image-strip'
import { PANDA_TEX, PANDA_HEAD_ANCHORS } from '../entities/player-body'

// icône par skill : couleur + glyphe
const SKILL_ICONS: Record<string, { color: number; glyph: string }> = {
  'calin-brutal': { color: 0xff9ab0, glyph: 'paw' },
  'bambou-jete': { color: 0x9ccc65, glyph: 'bamboo' },
  'taillade': { color: 0xcfd8dc, glyph: 'sword' },
  'estoc-rapide': { color: 0xe0e0e0, glyph: 'thrust' },
  'tourbillon': { color: 0x90caf9, glyph: 'tornado' },
  'attaque-chargee': { color: 0xffcc80, glyph: 'dash' },
  'lancer-epee': { color: 0xb0bec5, glyph: 'swordthrow' },
  'epee-enflammee': { color: 0xff7043, glyph: 'flamesword' },
  'folie-enragee': { color: 0xd50000, glyph: 'rage' },
  'plongeon': { color: 0xff8a65, glyph: 'slam' },
  'double-saut': { color: 0x81d4fa, glyph: 'jump' },
  'regeneration': { color: 0x66bb6a, glyph: 'regen' },
  'lame-ultime': { color: 0xffd54f, glyph: 'swordx' },
  'boule-de-feu': { color: 0xff7043, glyph: 'fireball' },
  'eclair': { color: 0x64b5ff, glyph: 'bolt' },
  'mur-de-flamme': { color: 0xff7043, glyph: 'flamewall' },
  'pluie-de-meteores': { color: 0xff8a65, glyph: 'meteors' },
  'fureur-arcanique': { color: 0xce93d8, glyph: 'aura' },
  'maitrise-arcanique': { color: 0xba68c8, glyph: 'star' },
  'vitalite-magique': { color: 0x66bb6a, glyph: 'heart' },
  'vol-arcanique': { color: 0xb388ff, glyph: 'jump' }, // vol du mage : réutilise le glyphe d'élévation (chevrons montants)
  'nova-de-givre': { color: 0x4dd0e1, glyph: 'snow' },
  'meteore': { color: 0xff8a65, glyph: 'meteor' },
  'soin-du-panda': { color: 0x81c784, glyph: 'cross' },
  'tempete-arcanique': { color: 0xce93d8, glyph: 'star' },
  'fleche-percante': { color: 0x40c4ff, glyph: 'arrow' },
  'double-tir': { color: 0xd7a86e, glyph: 'arrow2' },
  'piege': { color: 0xffca28, glyph: 'trap' },
  'fleche-enflammee': { color: 0xff7043, glyph: 'firearrow' },
  'fleche-explosive': { color: 0xff8a65, glyph: 'exploarrow' },
  'pluie-de-fleches': { color: 0xa5d6a7, glyph: 'rain' },
  'tir-charge': { color: 0xffb74d, glyph: 'arrow' },
  'fleche-autoguidee': { color: 0x64ffda, glyph: 'arrow2' },
  'oeil-de-lynx': { color: 0x69f0ae, glyph: 'eye' },
  'reflexes-felins': { color: 0x80deea, glyph: 'swift' },
  'fleche-de-bambou': { color: 0x9ccc65, glyph: 'arrow' },
  'salve-ultime': { color: 0xffd54f, glyph: 'rain' },
  'rugissement-panda': { color: 0xffb300, glyph: 'roar' },
  'soin-majeur': { color: 0x66bb6a, glyph: 'heart' },
  'rayon-arcanique': { color: 0xba68c8, glyph: 'ray' },
  'tir-instinctif': { color: 0xd7a86e, glyph: 'quickshot' },
  'tir-en-cloche': { color: 0x9ccc65, glyph: 'lob' },
  'aura-epines': { color: 0xb388ff, glyph: 'aura' },
  // Chevalier
  'jugement-royal': { color: 0xffd700, glyph: 'sword' },
  'garde-imperiale': { color: 0xffe082, glyph: 'target' },
  'sceau-du-heaume': { color: 0xffca28, glyph: 'wave' },
  'charge-lanciere': { color: 0xffd54f, glyph: 'thrust' },
  'grand-croix': { color: 0xfff3c0, glyph: 'cross' },
  'epee-fantome': { color: 0xd0bcff, glyph: 'swordx' },
  'devotion': { color: 0x64b5f6, glyph: 'target' },
  // Sorcier
  'cataclysme': { color: 0xff5252, glyph: 'meteors' },
  'faille-du-neant': { color: 0x7e57c2, glyph: 'ray' },
  'benediction-du-panda': { color: 0x81c784, glyph: 'heart' },
  'lance-flammes': { color: 0xff7043, glyph: 'fireball' },
  'tempete-foudroyante': { color: 0x82b1ff, glyph: 'bolt' },
  'blizzard': { color: 0x4dd0e1, glyph: 'snow' },
  // Chasseur
  'fleche-mortelle': { color: 0x448aff, glyph: 'arrow' },
  'nuee-de-fleches': { color: 0xa5d6a7, glyph: 'rain' },
  'tir-du-faucon': { color: 0xffb74d, glyph: 'boomarrow' },
  'mitraillette': { color: 0xa89968, glyph: 'gatling' },
  'blitz-faucon': { color: 0xffb74d, glyph: 'arrow2' },
  'fleche-grappin': { color: 0x80cbc4, glyph: 'arrow2' },
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

// Terrains disposant d'une VRAIE illustration de fond dédiée (public/art/bg-<id>.png) — un décor
// UNIQUE par niveau (nommé d'après le terrain). Les niveaux de BOSS retombent sur le fond de biome.
const LEVELS_WITH_BG = new Set<string>([
  'plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5', 'plaine-6', 'plaine-7',
  'foret-1', 'foret-2', 'foret-3', 'foret-4', 'foret-5', 'foret-6', 'foret-7',
  'desert-1', 'desert-2', 'desert-3', 'desert-4', 'desert-5', 'desert-6', 'desert-7', 'desert-8', 'desert-9', 'desert-10', 'desert-11',
  'jungle-1', 'jungle-2', 'jungle-3', 'jungle-4', 'jungle-5',
  'montagne-1', 'montagne-2', 'montagne-3',
  'cimetiere-1', 'cimetiere-2',
  'plage-1', 'plage-2', 'plage-3', 'plage-4',
  'cave-1', 'carriere-1', 'epave-1',
  'enfer-1', 'enfer-2', 'enfer-3', 'enfer-4', 'enfer-5', 'enfer-6', 'enfer-7',
])

// Tous les fonds de niveau sont désormais livrés en PNG → l'extension de chargement est .png.
const BG_PNG = LEVELS_WITH_BG

// POISSONS décoratifs des bassins : illustrations OPTIONNELLES (public/art/fish-<id>.png), chargées
// en BEST-EFFORT. Elles seront générées par l'user ; tant qu'un fichier manque, le loader échoue
// sans crash (aucune texture créée) et LevelScene.addFish retombe sur le cercle rouge de repli.
const FISH_IDS = ['poisson', 'poisson-tropical', 'piranha'] as const

// Sprites d'effet de sort (public/art/fx-<id>.png) câblés sur les sorts de la refonte. Chargés en
// PRELOAD sous la clé fx-<id> ; consommés par LevelScene / FlameWall (test d'existence à l'usage).
const FX_SPRITES = [
  'faille-neant', 'tempete', 'blizzard', 'lance-flammes', 'mur-de-flamme', 'aura-epines',
  'grand-croix', 'tir-faucon', 'blitz-faucon', 'meteore', 'fleche-enflammee',
  'mitraillette',
] as const

// gabarit d'illustration : les boss, MVP et gardiens sont dessinés plus grands (≈76×82) que
// les monstres normaux (≈40×46), comme le faisait drawMonster.
const isBigArt = (m: MonsterDef): boolean => !!m.boss || !!m.mvp || m.id.startsWith('gardien-')

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload') }

  preload() {
    this.load.image('splash', 'art/splash.png')
    // pièce d'or illustrée (optionnelle) : si art/coin.png existe, elle remplace la pièce procédurale
    this.load.image('art-coin', 'art/coin.png')
    // fond illustré de la carte du monde (vue du dessus fantasy), affiché par WorldMapScene
    this.load.image('map-monde', 'art/map-monde.jpg')
    for (const id of ART_MONSTERS) this.load.image(`art-${id}`, `art/art-${id}.png`)
    // fonds de biome illustrés (public/art/biome-<clé>.jpg), affichés par LevelScene en FALLBACK
    for (const id of Object.keys(BIOMES)) this.load.image(`biome-${id}`, `art/biome-${id}.jpg`)
    // fonds PROPRES AU NIVEAU (public/art/bg-<levelId>.jpg) : un décor unique par terrain, affiché
    // en PRIORITÉ par LevelScene.addBackground. On ne charge QUE ceux qui existent réellement sur
    // disque (LEVELS_WITH_BG) ; tous les autres niveaux retombent proprement sur le fond de biome
    // (biome-<clé>) — pas de requête 404 pour les terrains sans image dédiée.
    for (const lvl of Object.values(LEVELS)) {
      if (!lvl.boss && LEVELS_WITH_BG.has(lvl.id)) this.load.image(`bg-${lvl.id}`, `art/bg-${lvl.id}.${BG_PNG.has(lvl.id) ? 'png' : 'jpg'}`)
    }
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
      // poses de NAGE (2 frames de brasse, panda horizontal face à droite) : alternées au mouvement
      this.load.image(`pandaart-${cls}-nage1`, `art/panda-${art}-nage1.png`)
      this.load.image(`pandaart-${cls}-nage2`, `art/panda-${art}-nage2.png`)
    }
    // PNJ pandas de la ville + illustration K.O. — détourés/rognés en create() (bakeCropped)
    for (const id of NPC_IDS) this.load.image(`npcart-${id}`, `art/npc-${id}.png`)
    this.load.image('deathart-panda', 'art/death-panda.png')
    // POISSONS décoratifs (best-effort) : art/fish-<id>.png → textures fish-<id>. Si le fichier
    // n'existe pas encore, le chargement échoue silencieusement (aucun crash) et addFish garde le
    // cercle rouge — l'existence de la texture est testée à l'usage (cf. LevelScene.addFish).
    for (const id of FISH_IDS) this.load.image(`fish-${id}`, `art/fish-${id}.png`)
    // icônes d'objet (public/art/item-<id>.png, fond transparent) : une par entrée d'ITEMS,
    // rognées à leur boîte englobante en create() → textures item-<id> (boutiques, forge, inventaire).
    for (const id of Object.keys(ITEMS)) this.load.image(`itemart-${id}`, `art/item-${id}.png`)
    // Effets de sorts illustrés (public/art/fx-<id>.png) : utilisés directement comme visuel des sorts
    // correspondants (composés/animés en scène). Best-effort : si un fichier manque, le sort retombe
    // sur son visuel procédural (test d'existence de texture à l'usage).
    for (const id of FX_SPRITES) this.load.image(`fx-${id}`, `art/fx-${id}.png`)
    // illustration de la potion de soin (art/potion-drop.png, fond transparent). Détourée + rognée +
    // mise à l'échelle en create() → texture `potion-drop`, en remplacement du dessin procédural.
    // Best-effort : si le fichier manque ou si le canvas échoue, on retombe sur le dessin procédural.
    this.load.image('potionart-drop', 'art/potion-drop.png')
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

  // Bake l'illustration de potion (art/potion-drop.png) dans une PETITE texture carrée `potion-drop`,
  // remplaçante directe du dessin procédural 16×16 : le monde la lâche à sa taille native, la boutique
  // et le HUD la redimensionnent. On détoure le fond (flood-fill des bords → transparent, no-op si déjà
  // transparent), on rogne à la boîte englobante puis on met à l'échelle en conservant le ratio, centré.
  // Renvoie false si l'art manque ou si le canvas 2D échoue (repli sur le dessin procédural).
  private bakePotionDrop(size = 28): boolean {
    const src = 'potionart-drop'
    if (this.textures.exists('potion-drop')) return true
    if (!this.textures.exists(src)) return false
    try {
      const source = this.textures.get(src).getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const w = source.width, h = source.height
      const work = document.createElement('canvas')
      work.width = w; work.height = h
      const wctx = work.getContext('2d')
      if (!wctx) return false
      wctx.drawImage(source as CanvasImageSource, 0, 0)
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
      out.width = size; out.height = size
      const octx = out.getContext('2d')
      if (!octx) return false
      octx.imageSmoothingEnabled = true
      const scale = Math.min(size / bw, size / bh)
      const dw = bw * scale, dh = bh * scale
      octx.drawImage(work, x0, y0, bw, bh, (size - dw) / 2, (size - dh) / 2, dw, dh)
      this.textures.addCanvas('potion-drop', out)
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
    const s = big ? 120 : 70
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
    // le dessin procédural est calibré sur un cadre 64 de large ; on le recentre dans le cadre
    // (éventuellement élargi) PANDA_TEX en décalant tout le tracé de la demi-marge.
    g.translateCanvas((PANDA_TEX.w - 64) / 2, 0)
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
    g.generateTexture(key, PANDA_TEX.w, PANDA_TEX.h)
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

  // « Bake » d'une illustration dans une texture PANDA_TEX (même dimensions que la frame
  // procédurale → hitbox PANDA_BODY inchangée). On rogne l'art à sa boîte englobante
  // non-transparente (comme cleanArtTexture le fait via getImageData), on le met à l'échelle
  // uniformément par sa HAUTEUR vers une cible constante (STAND_H) — donc taille identique dans
  // toutes les poses, sans jamais raboter la largeur (le cadre est assez large pour les poses aux
  // membres écartés) — puis on l'ANCRE BAS-CENTRE (pieds sur la ligne FEET_Y=86, la même que la hitbox)
  // pour une baseline identique dans toutes les poses → pieds stables, pas de tremblement.
  // Renvoie false si l'art manque ou si le canvas 2D échoue (repli procédural).
  private bakePandaPose(srcKey: string, destKey: string): boolean {
    if (this.textures.exists(destKey)) return true
    if (!this.textures.exists(srcKey)) return false
    try {
      const STAND_H = 80, FEET_Y = 86, ALPHA_MIN = 16
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
      // Échelle par la HAUTEUR : toutes les poses debout font la même hauteur à l'écran. On BORNE
      // toutefois par la largeur du cadre (marge 4 px) : les poses debout (idle/course/saut/attaque/
      // échelle) tiennent toutes largement sous 96 px → borne inactive, aucun rapetissement. Seules les
      // poses de NAGE (horizontales, plus larges que hautes) la déclenchent → évite que le nageur soit
      // rogné à gauche/droite par le cadre (museau/queue coupés).
      const scale = Math.min(STAND_H / bh, (PANDA_TEX.w - 4) / bw)
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
    // poses de NAGE optionnelles (même bake) : absentes = repli sur la pose idle dans Player.animateSwim
    this.bakePandaPose(this.pandaArtKey(cls, 'nage1'), `panda-${cls}-nage1`)
    this.bakePandaPose(this.pandaArtKey(cls, 'nage2'), `panda-${cls}-nage2`)
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
      // Lignée du sabreur : GROSSE épée large (lame remplie, dédiée à l'overlay). Elle n'apparaît
      // qu'à l'attaque côté Player (masquée au repos) et est agrandie à l'affichage.
      if (cls === 'swordsman' || cls === 'chevalier') this.drawBigSword(g, cls, 20, 44)
      else this.drawClassWeapon(g, cls, 20, 44)
      g.generateTexture(`weapon-${cls}`, 40, 60)
      g.destroy()
    }
    this.bakeItemWeapons()
  }

  // Texture d'overlay PAR OBJET arme (`weapon-<itemId>`) : le panda affiche l'arme réellement
  // équipée (ex. « katana d'éclair ») et non plus une arme générique de classe. Silhouette par
  // famille (lame/arc/bâton), teintée par la rareté → chaque arme se reconnaît. Même cadre 40×60 et
  // même grip (20,44) que les armes de classe : ancrage et échelle inchangés côté Player.
  private bakeItemWeapons() {
    for (const item of Object.values(ITEMS)) {
      if (item.slot !== 'weapon' || !item.weaponType) continue
      const g = this.add.graphics()
      this.drawItemWeapon(g, item.id, item.weaponType, rarityColor(item.rarity), 20, 44)
      g.generateTexture(`weapon-${item.id}`, 40, 60)
      g.destroy()
    }
  }

  // GROSSE épée large du sabreur / chevalier (overlay d'attaque). Grip ancré en (hx, hy) dans le
  // cadre 40×60 (comme les autres armes) → Player conserve l'ancrage à la patte et l'échelle.
  // Silhouettes DISTINCTES : le SABREUR porte un sabre élancé à dos courbe (lame monotranchant,
  // tsuba ronde) ; le CHEVALIER une épée noble cruciforme (lame droite large à gouttière, garde
  // ailée dorée, pommeau serti) → on reconnaît la classe à la forme, pas seulement à la couleur.
  private drawBigSword(g: Phaser.GameObjects.Graphics, cls: ClassId, hx: number, hy: number) {
    if (cls === 'chevalier') { this.drawKnightSword(g, hx, hy); return }
    this.drawSabre(g, hx, hy)
  }

  // Sabre du sabreur : lame élancée monotranchant au dos légèrement courbe, tsuba (garde) ronde.
  private drawSabre(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    // poignée tressée + pommeau
    g.fillStyle(0x455a64).fillRect(hx - 2.5, hy + 2, 5, 11)
    g.fillStyle(0x263238).fillCircle(hx, hy + 14, 3)
    // tsuba ronde (garde circulaire typique du sabre)
    g.fillStyle(0xffd54f).fillCircle(hx, hy, 6)
    g.fillStyle(0xffecb3).fillCircle(hx, hy, 3)
    // lame monotranchant : tranchant droit à gauche, dos courbé à droite, pointe fine relevée
    g.fillStyle(0xcfd8dc)
    g.fillTriangle(hx - 4, hy - 2, hx - 4, hy - 38, hx + 3, hy - 34)
    g.fillTriangle(hx - 4, hy - 2, hx + 3, hy - 34, hx + 2, hy - 44)
    // fil tranchant brillant (bord gauche) + reflet du dos
    g.fillStyle(0xffffff, 0.9).fillRect(hx - 4, hy - 38, 1.8, 36)
    g.fillStyle(0x90a4ae).fillTriangle(hx + 1, hy - 6, hx + 2.5, hy - 33, hx + 1.5, hy - 40)
  }

  // Épée du chevalier : lame droite LARGE à gouttière centrale, longue garde AILÉE dorée et
  // pommeau serti — allure noble et lourde.
  private drawKnightSword(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    // poignée gainée + gros pommeau serti
    g.fillStyle(0x6d4c41).fillRect(hx - 2.5, hy + 2, 5, 11)
    g.fillStyle(0xffca28).fillCircle(hx, hy + 15, 3.4)
    g.fillStyle(0xfff59d).fillCircle(hx - 0.8, hy + 14, 1.4)
    // garde AILÉE : barre dorée remontant en ailerons aux extrémités (croix noble)
    g.fillStyle(0xffca28).fillRect(hx - 9, hy - 2, 20, 5)
    g.fillTriangle(hx - 9, hy - 2, hx - 12, hy - 8, hx - 6, hy - 2)
    g.fillTriangle(hx + 11, hy - 2, hx + 14, hy - 8, hx + 8, hy - 2)
    // lame droite large montant tout en haut, pointe symétrique
    g.fillStyle(0xeceff1)
    g.fillRect(hx - 6, hy - 38, 13, 38)
    g.fillTriangle(hx - 6, hy - 36, hx + 7, hy - 36, hx + 0.5, hy - 45)
    // gouttière (fuller) centrale sombre + arête brillante de chaque côté
    g.fillStyle(0x90a4ae).fillRect(hx - 1, hy - 38, 3, 34)
    g.fillStyle(0xffffff, 0.9).fillRect(hx - 4.5, hy - 38, 1.8, 34)
    g.fillStyle(0xffffff, 0.6).fillRect(hx + 4, hy - 38, 1.6, 34)
  }

  // Overlay d'arme PROPRE À UN OBJET équipé. Les armes qui ont une SILHOUETTE dédiée (cf. switch)
  // sont dessinées avec leur forme et leurs couleurs propres → aucun clone teinté ; les autres
  // retombent sur la silhouette générique de leur famille (lame/arc/bâton) teintée par la rareté.
  // Grip ancré en (hx, hy) dans le cadre 40×60, comme les armes de classe.
  private drawItemWeapon(g: Phaser.GameObjects.Graphics, id: string, type: WeaponType, tint: number, hx: number, hy: number) {
    switch (id) {
      case 'dague-jumelle': return this.drawTwinDaggers(g, hx, hy)
      case 'cimeterre-desert': return this.drawScimitar(g, hx, hy)
      case 'epee-cristal': return this.drawCrystalSword(g, hx, hy)
      case 'lame-solaire': return this.drawSolarBlade(g, hx, hy)
      case 'arc-corne': return this.drawHornBow(g, hx, hy)
      case 'arc-elfique': return this.drawElvenBow(g, hx, hy)
      case 'arc-tempete': return this.drawStormBow(g, hx, hy)
      case 'baton-noueux': return this.drawGnarledStaff(g, hx, hy)
      case 'sceptre-glace': return this.drawIceScepter(g, hx, hy)
      case 'sceptre-arcane': return this.drawArcaneScepter(g, hx, hy)
      case 'baton-cosmique': return this.drawCosmicStaff(g, hx, hy)
    }
    this.drawGenericWeapon(g, type, tint, hx, hy)
  }

  // silhouette générique par famille (repli pour les armes sans dessin dédié) — teintée par la rareté.
  private drawGenericWeapon(g: Phaser.GameObjects.Graphics, type: WeaponType, tint: number, hx: number, hy: number) {
    if (type === 'bow') {
      // arc recourbé : bois brun, corde claire, poignée + nock TEINTÉS par la rareté
      g.lineStyle(4, 0x6d4c41).beginPath()
      g.arc(hx - 2, hy - 3, 15, Phaser.Math.DegToRad(-80), Phaser.Math.DegToRad(80), false); g.strokePath()
      const c = Phaser.Math.DegToRad(-80), d = Phaser.Math.DegToRad(80)
      g.lineStyle(1.5, 0xeeeeee).beginPath()
      g.moveTo(hx - 2 + 15 * Math.cos(c), hy - 3 + 15 * Math.sin(c)); g.lineTo(hx - 2 + 15 * Math.cos(d), hy - 3 + 15 * Math.sin(d)); g.strokePath()
      g.fillStyle(tint).fillCircle(hx - 2, hy - 3, 3) // poignée sertie (rareté)
      g.fillStyle(tint).fillCircle(hx - 2 + 15 * Math.cos(c), hy - 3 + 15 * Math.sin(c), 2)
      g.fillStyle(tint).fillCircle(hx - 2 + 15 * Math.cos(d), hy - 3 + 15 * Math.sin(d), 2)
      return
    }
    if (type === 'staff') {
      // bâton : hampe de bois + orbe rayonnant TEINTÉ par la rareté (halo + reflet)
      g.lineStyle(4, 0x6d4c41).beginPath(); g.moveTo(hx, hy - 22); g.lineTo(hx + 2, hy + 10); g.strokePath()
      g.fillStyle(tint, 0.35).fillCircle(hx, hy - 27, 9)
      g.fillStyle(tint).fillCircle(hx, hy - 27, 6)
      g.fillStyle(0xffffff, 0.85).fillCircle(hx - 2, hy - 29, 2)
      return
    }
    // lame (épée / masse / faux / griffe) : grosse lame large TEINTÉE par la rareté, arête brillante
    g.fillStyle(0x6d4c41).fillRect(hx - 2.5, hy + 2, 5, 11) // poignée
    g.fillStyle(0x4e342e).fillCircle(hx, hy + 14, 3) // pommeau
    g.fillStyle(0xffd54f).fillRect(hx - 8, hy - 2, 18, 5) // garde dorée
    g.fillStyle(tint)
    g.fillRect(hx - 5, hy - 38, 11, 38)
    g.fillTriangle(hx - 5, hy - 36, hx + 6, hy - 36, hx + 0.5, hy - 43)
    g.fillStyle(0xffffff, 0.9).fillRect(hx - 0.5, hy - 38, 2.5, 34) // arête brillante
  }

  // ───────────── Silhouettes d'armes DÉDIÉES (grip ancré en (hx, hy), cadre 40×60) ─────────────
  // Chacune a une forme et des couleurs propres → deux armes de la même famille ne se confondent pas.

  // Dagues jumelles (commun) : deux lames courtes croisées, acier bleuté, courtes gardes.
  private drawTwinDaggers(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.fillStyle(0x37474f).fillRect(hx - 2, hy + 2, 4, 9) // poignée commune
    g.fillStyle(0x263238).fillCircle(hx, hy + 12, 2.5)
    for (const s of [-1, 1] as const) {
      g.fillStyle(0x9e9e9e).fillRect(hx - 5 * s, hy - 1, 4, 3) // garde
      g.fillStyle(0xb0bec5).fillTriangle(hx + s * 2, hy - 2, hx + s * 5, hy - 2, hx + s * 9, hy - 22) // lame courte oblique
      g.fillStyle(0xeceff1, 0.9).fillTriangle(hx + s * 2, hy - 2, hx + s * 3, hy - 2, hx + s * 8, hy - 21) // fil clair
    }
  }

  // Cimeterre du désert (rare) : longue lame CURVE monotranchant, garde et pommeau dorés.
  private drawScimitar(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.fillStyle(0x8d6e63).fillRect(hx - 2.5, hy + 2, 5, 11) // poignée bois
    g.fillStyle(0xffb300).fillCircle(hx, hy + 14, 3) // pommeau doré
    g.fillStyle(0xffd54f).fillRect(hx - 7, hy - 1, 16, 4) // garde dorée
    // lame en croissant : bord courbe convexe à droite, dos concave
    g.fillStyle(0xcfd8dc).fillTriangle(hx - 3, hy - 2, hx + 4, hy - 4, hx + 14, hy - 40)
    g.fillStyle(0xcfd8dc).fillTriangle(hx - 3, hy - 2, hx + 14, hy - 40, hx + 4, hy - 34)
    g.fillStyle(0xffffff, 0.9).fillTriangle(hx + 5, hy - 6, hx + 8, hy - 6, hx + 14, hy - 38) // fil brillant convexe
  }

  // Épée de cristal (épique) : lame translucide facettée cyan, halo froid, garde argentée.
  private drawCrystalSword(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.fillStyle(0x455a64).fillRect(hx - 2.5, hy + 2, 5, 11) // poignée
    g.fillStyle(0xb0bec5).fillCircle(hx, hy + 14, 3) // pommeau argenté
    g.fillStyle(0xcfd8dc).fillRect(hx - 8, hy - 2, 16, 4) // garde argentée
    this.bakeGlow(g, hx, hy - 20, 12, 0x40c4ff, 6, 0.4) // halo glacé
    // lame cristalline : deux facettes claires + arête centrale vive
    g.fillStyle(0x4dd0e1).fillTriangle(hx - 5, hy - 3, hx - 5, hy - 34, hx + 0.5, hy - 44)
    g.fillStyle(0x80deea).fillTriangle(hx + 5, hy - 3, hx + 5, hy - 34, hx + 0.5, hy - 44)
    g.fillStyle(0xe0f7fa, 0.95).fillTriangle(hx - 1.5, hy - 3, hx + 1.5, hy - 3, hx + 0.5, hy - 43) // arête centrale
    g.fillStyle(0xffffff, 0.8).fillCircle(hx - 2, hy - 20, 1.4) // éclat facette
  }

  // Lame solaire (légendaire) : large lame incandescente or/rouge, grand rayonnement, garde ailée.
  private drawSolarBlade(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    this.bakeGlow(g, hx, hy - 18, 17, 0xff7a1e, 8, 0.5) // aura solaire
    this.bakeGlow(g, hx, hy - 20, 9, 0xffe082, 6, 0.55)
    g.fillStyle(0x5d2c0a).fillRect(hx - 2.5, hy + 2, 5, 11) // poignée
    g.fillStyle(0xffca28).fillCircle(hx, hy + 14, 3.4) // pommeau or
    // garde ailée dorée
    g.fillStyle(0xffb300).fillRect(hx - 9, hy - 2, 20, 5)
    g.fillTriangle(hx - 9, hy - 2, hx - 12, hy - 8, hx - 6, hy - 2)
    g.fillTriangle(hx + 11, hy - 2, hx + 14, hy - 8, hx + 8, hy - 2)
    // lame : cœur braise → arête blanche-jaune
    g.fillStyle(0xff5a1e).fillRect(hx - 5, hy - 40, 11, 40)
    g.fillTriangle(hx - 5, hy - 38, hx + 6, hy - 38, hx + 0.5, hy - 47)
    g.fillStyle(0xffb547).fillRect(hx - 2.5, hy - 40, 6, 38)
    g.fillStyle(0xfff3c4, 0.95).fillRect(hx - 0.5, hy - 40, 2.2, 36) // cœur incandescent
  }

  // Arc de corne (commun) : petit arc court à double courbure, corne claire.
  private drawHornBow(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.lineStyle(3.5, 0xd7c9a8).beginPath()
    g.arc(hx - 1, hy - 3, 11, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false); g.strokePath()
    const c = Phaser.Math.DegToRad(-70), d = Phaser.Math.DegToRad(70)
    g.lineStyle(1, 0xf5f5f5).beginPath()
    g.moveTo(hx - 1 + 11 * Math.cos(c), hy - 3 + 11 * Math.sin(c)); g.lineTo(hx - 1 + 11 * Math.cos(d), hy - 3 + 11 * Math.sin(d)); g.strokePath()
    g.fillStyle(0x8d6e63).fillCircle(hx - 1, hy - 3, 2.5) // poignée bois
  }

  // Arc elfique (épique) : grand arc élancé vert émeraude à volutes, corde dorée, halo végétal.
  private drawElvenBow(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    this.bakeGlow(g, hx - 2, hy - 3, 13, 0x66bb6a, 6, 0.35) // halo végétal
    g.lineStyle(4, 0x2e7d32).beginPath()
    g.arc(hx - 2, hy - 3, 16, Phaser.Math.DegToRad(-82), Phaser.Math.DegToRad(82), false); g.strokePath()
    g.lineStyle(1.5, 0x81c784).beginPath()
    g.arc(hx - 2, hy - 3, 16, Phaser.Math.DegToRad(-82), Phaser.Math.DegToRad(82), false); g.strokePath() // liseré clair
    const c = Phaser.Math.DegToRad(-82), d = Phaser.Math.DegToRad(82)
    g.lineStyle(1.2, 0xffe082).beginPath()
    g.moveTo(hx - 2 + 16 * Math.cos(c), hy - 3 + 16 * Math.sin(c)); g.lineTo(hx - 2 + 16 * Math.cos(d), hy - 3 + 16 * Math.sin(d)); g.strokePath() // corde dorée
    // feuilles aux extrémités
    g.fillStyle(0x66bb6a).fillEllipse(hx - 2 + 16 * Math.cos(c), hy - 3 + 16 * Math.sin(c), 4, 7)
    g.fillStyle(0x66bb6a).fillEllipse(hx - 2 + 16 * Math.cos(d), hy - 3 + 16 * Math.sin(d), 4, 7)
    g.fillStyle(0xffca28).fillCircle(hx - 2, hy - 3, 2.5) // poignée sertie
  }

  // Arc de tempête (légendaire) : arc d'orage sombre nervuré d'éclairs, corde électrique, halo bleu.
  private drawStormBow(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    this.bakeGlow(g, hx - 2, hy - 3, 16, 0x40c4ff, 8, 0.45) // halo orageux
    g.lineStyle(4.5, 0x263238).beginPath()
    g.arc(hx - 2, hy - 3, 16, Phaser.Math.DegToRad(-82), Phaser.Math.DegToRad(82), false); g.strokePath()
    g.lineStyle(1.5, 0x82b1ff).beginPath()
    g.arc(hx - 2, hy - 3, 16, Phaser.Math.DegToRad(-82), Phaser.Math.DegToRad(82), false); g.strokePath()
    const c = Phaser.Math.DegToRad(-82), d = Phaser.Math.DegToRad(82)
    // corde en zigzag (éclair) entre les nocks
    const x0 = hx - 2 + 16 * Math.cos(c), y0 = hy - 3 + 16 * Math.sin(c)
    const x1 = hx - 2 + 16 * Math.cos(d), y1 = hy - 3 + 16 * Math.sin(d)
    g.lineStyle(1.6, 0xe1f5fe).beginPath()
    g.moveTo(x0, y0); g.lineTo((x0 + x1) / 2 + 5, (y0 + y1) / 2 - 4); g.lineTo((x0 + x1) / 2 - 3, (y0 + y1) / 2 + 3); g.lineTo(x1, y1); g.strokePath()
    g.fillStyle(0x40c4ff).fillCircle(hx - 2, hy - 3, 3) // poignée électrique
    g.fillStyle(0xfff59d).fillCircle(hx - 2, hy - 3, 1.4)
  }

  // Bâton noueux (commun) : hampe irrégulière brun clair, galet gris poli au sommet.
  private drawGnarledStaff(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.lineStyle(4, 0x8d6e63).beginPath(); g.moveTo(hx - 1, hy - 20); g.lineTo(hx + 1, hy - 6); g.lineTo(hx + 3, hy + 10); g.strokePath() // hampe coudée
    g.lineStyle(2, 0x6d4c41).beginPath(); g.moveTo(hx - 2, hy - 4); g.lineTo(hx - 5, hy - 1); g.strokePath() // nœud/branche
    g.fillStyle(0x78909c).fillCircle(hx - 1, hy - 23, 5) // galet
    g.fillStyle(0xb0bec5).fillCircle(hx - 2, hy - 24, 2) // reflet du galet
  }

  // Sceptre de glace (rare) : hampe bleu givré surmontée d'un éclat de glace anguleux, halo froid.
  private drawIceScepter(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.lineStyle(4, 0x5c6bc0).beginPath(); g.moveTo(hx, hy - 20); g.lineTo(hx + 2, hy + 10); g.strokePath()
    this.bakeGlow(g, hx, hy - 26, 11, 0x81d4fa, 6, 0.4)
    // cristal de glace : losange anguleux + éclats
    g.fillStyle(0x4fc3f7).fillTriangle(hx, hy - 36, hx - 6, hy - 26, hx + 6, hy - 26)
    g.fillStyle(0x4fc3f7).fillTriangle(hx, hy - 18, hx - 6, hy - 26, hx + 6, hy - 26)
    g.fillStyle(0xe1f5fe, 0.9).fillTriangle(hx, hy - 34, hx - 2, hy - 27, hx + 2, hy - 27) // arête claire
    g.fillStyle(0xb3e5fc).fillTriangle(hx - 9, hy - 24, hx - 12, hy - 30, hx - 6, hy - 27) // éclat latéral
    g.fillStyle(0xffffff, 0.85).fillCircle(hx - 2, hy - 28, 1.2)
  }

  // Sceptre arcanique (épique) : hampe violette, anneau runique flottant + gemme centrale, halo mauve.
  private drawArcaneScepter(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    g.lineStyle(4, 0x5e35b1).beginPath(); g.moveTo(hx, hy - 18); g.lineTo(hx + 2, hy + 10); g.strokePath()
    this.bakeGlow(g, hx, hy - 27, 13, 0xba68c8, 7, 0.42)
    g.lineStyle(2.5, 0xce93d8).strokeCircle(hx, hy - 27, 8) // anneau runique
    g.lineStyle(1.2, 0xf3e5f5).strokeCircle(hx, hy - 27, 8)
    // marques runiques sur l'anneau
    for (const a of [0, 90, 180, 270]) {
      const rad = Phaser.Math.DegToRad(a)
      g.fillStyle(0xf3e5f5).fillCircle(hx + 8 * Math.cos(rad), hy - 27 + 8 * Math.sin(rad), 1.4)
    }
    g.fillStyle(0x8e24aa).fillCircle(hx, hy - 27, 4) // gemme centrale
    g.fillStyle(0xffffff, 0.85).fillCircle(hx - 1.4, hy - 28.4, 1.3)
  }

  // Bâton cosmique (légendaire) : hampe indigo, étoile miniature à branches + halo stellaire, éclats.
  private drawCosmicStaff(g: Phaser.GameObjects.Graphics, hx: number, hy: number) {
    this.bakeGlow(g, hx, hy - 27, 18, 0x7c4dff, 8, 0.5) // nébuleuse
    this.bakeGlow(g, hx, hy - 27, 9, 0xe1bee7, 6, 0.55)
    g.lineStyle(4, 0x311b92).beginPath(); g.moveTo(hx, hy - 20); g.lineTo(hx + 2, hy + 10); g.strokePath()
    // étoile à 4 branches (astre)
    const star = (cx: number, cy: number, R: number, r: number, col: number) => {
      g.fillStyle(col)
      g.fillTriangle(cx, cy - R, cx - r, cy, cx + r, cy)
      g.fillTriangle(cx, cy + R, cx - r, cy, cx + r, cy)
      g.fillTriangle(cx - R, cy, cx, cy - r, cx, cy + r)
      g.fillTriangle(cx + R, cy, cx, cy - r, cx, cy + r)
    }
    star(hx, hy - 27, 10, 3.5, 0xb388ff)
    star(hx, hy - 27, 6, 2, 0xfff8e1)
    g.fillStyle(0xffffff).fillCircle(hx, hy - 27, 2)
    // petits astres satellites
    for (const [sx, sy, sr] of [[hx - 9, hy - 18, 1.3], [hx + 8, hy - 34, 1.1], [hx + 7, hy - 20, 1]] as const) {
      g.fillStyle(0xffffff, 0.95).fillCircle(sx, sy, sr)
      g.fillStyle(0xb388ff, 0.5).fillCircle(sx, sy, sr + 1.6)
    }
  }

  // panda K.O. : allongé sur le dos, pattes en l'air, yeux en croix et langue pendante.
  // Format allongé (80×56) réutilisé dans le monde (il s'écroule) et sur l'écran K.O.
  // Icône d'accès à l'inventaire : une « tenue » schématisée (chapeau + t-shirt + pantalon)
  // dessinée en code, texture ui-inventory (44×44, fond transparent). Affichée dans le HUD en
  // jeu et sur la carte du monde ; un clic ouvre la scène Inventory.
  private bakeUiInventory() {
    const g = this.add.graphics()
    const LINE = 0xffffff, FILL = 0xffca28
    // chapeau (petit galure en haut)
    g.fillStyle(FILL).fillEllipse(22, 9, 22, 5) // bord
    g.fillStyle(FILL).fillRoundedRect(15, 1, 14, 7, 2) // calotte
    g.lineStyle(1.5, LINE, 0.9).strokeRoundedRect(15, 1, 14, 7, 2)
    // t-shirt (corps + manches)
    g.fillStyle(0x42a5f5)
    g.fillRoundedRect(14, 15, 16, 13, 2) // buste
    g.fillTriangle(14, 15, 8, 22, 12, 24) // manche gauche
    g.fillTriangle(30, 15, 36, 22, 32, 24) // manche droite
    g.fillTriangle(18, 15, 26, 15, 22, 19) // encolure
    g.lineStyle(1.5, LINE, 0.9).strokeRoundedRect(14, 15, 16, 13, 2)
    // pantalon (deux jambes)
    g.fillStyle(0x8d6e63)
    g.fillRoundedRect(15, 29, 6, 13, 1.5) // jambe gauche
    g.fillRoundedRect(23, 29, 6, 13, 1.5) // jambe droite
    g.lineStyle(1.5, LINE, 0.9)
    g.strokeRoundedRect(15, 29, 6, 13, 1.5).strokeRoundedRect(23, 29, 6, 13, 1.5)
    g.generateTexture('ui-inventory', 44, 44)
    g.destroy()
  }

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
      case 'corbeau': {
        // oiseau (placeholder) : corps sombre fuselé, deux grandes ailes déployées en V, bec jaune,
        // œil vif. Silhouette clairement AÉRIENNE (distincte des mobs au sol). Art Gemini plus tard.
        g.fillStyle(this.shadeColor(m.color, 1.5)).fillTriangle(0, r - 4, r - 4, r - 2, 4, r + 10) // aile gauche déployée
        g.fillStyle(this.shadeColor(m.color, 1.5)).fillTriangle(s, r - 4, r + 4, r - 2, s - 4, r + 10) // aile droite déployée
        g.fillStyle(m.color).fillEllipse(r, r + 2, r / 1.3, r) // corps fuselé
        g.fillStyle(this.shadeColor(m.color, 1.4)).fillEllipse(r, r - 4, r / 1.8, r / 1.6) // tête
        g.fillStyle(0xffb300).fillTriangle(r + r / 3, r - 5, r + r / 3, r - 1, r + r / 1.3, r - 3) // bec
        g.fillStyle(0xffffff).fillCircle(r + 2, r - 5, 2.5); g.fillStyle(0x000000).fillCircle(r + 3, r - 5, 1.2) // œil
        g.fillStyle(this.shadeColor(m.color, 0.7)).fillTriangle(r - 2, s - 4, r + 2, s - 4, r, s + 4) // queue
        break
      }
      case 'faucon': {
        // rapace brun (placeholder) : ailes déployées en V, corps fuselé, bec crochu, regard vif.
        // Silhouette AÉRIENNE plus effilée et agressive que le corbeau (ailes plus pointues).
        g.fillStyle(this.shadeColor(m.color, 1.5)).fillTriangle(-2, r - 6, r - 4, r - 2, 6, r + 8) // aile gauche pointue
        g.fillStyle(this.shadeColor(m.color, 1.5)).fillTriangle(s + 2, r - 6, r + 4, r - 2, s - 6, r + 8) // aile droite pointue
        g.fillStyle(this.shadeColor(m.color, 0.85)).fillTriangle(2, r - 2, r - 4, r, 8, r + 4) // dessous d'aile (ombre)
        g.fillStyle(this.shadeColor(m.color, 0.85)).fillTriangle(s - 2, r - 2, r + 4, r, s - 8, r + 4)
        g.fillStyle(m.color).fillEllipse(r, r + 2, r / 1.4, r) // corps fuselé
        g.fillStyle(this.shadeColor(m.color, 1.35)).fillEllipse(r, r - 4, r / 1.9, r / 1.6) // tête
        g.fillStyle(0xf5e6c8).fillTriangle(r + r / 3, r - 6, r + r / 3, r - 1, r + r / 1.1, r - 2) // bec crochu
        g.fillStyle(0x4e2f14).fillTriangle(r + r / 1.4, r - 3, r + r / 1.1, r - 2, r + r / 1.4, r) // crochet du bec
        g.fillStyle(0xffd54f).fillCircle(r + 2, r - 5, 2.6); g.fillStyle(0x000000).fillCircle(r + 3, r - 5, 1.3) // œil perçant
        g.fillStyle(this.shadeColor(m.color, 0.6)).fillTriangle(r - 4, s - 4, r + 4, s - 4, r, s + 5) // queue en éventail
        break
      }
      case 'ara': {
        // perroquet tropical (placeholder) : plumage MULTICOLORE — corps bleu, ailes rouge/jaune/vert,
        // grand bec crochu clair, longue queue. Silhouette AÉRIENNE chatoyante et exotique.
        g.fillStyle(0xe53935).fillTriangle(-2, r - 6, r - 4, r - 2, 4, r + 6) // aile gauche rouge
        g.fillStyle(0xfdd835).fillTriangle(0, r - 2, r - 5, r, 6, r + 8) // bande jaune
        g.fillStyle(0x43a047).fillTriangle(2, r + 2, r - 5, r + 2, 8, r + 10) // bande verte
        g.fillStyle(0xe53935).fillTriangle(s + 2, r - 6, r + 4, r - 2, s - 4, r + 6) // aile droite rouge
        g.fillStyle(0xfdd835).fillTriangle(s, r - 2, r + 5, r, s - 6, r + 8) // bande jaune
        g.fillStyle(0x43a047).fillTriangle(s - 2, r + 2, r + 5, r + 2, s - 8, r + 10) // bande verte
        g.fillStyle(m.color).fillEllipse(r, r + 2, r / 1.35, r) // corps bleu vif
        g.fillStyle(this.shadeColor(m.color, 1.3)).fillEllipse(r, r - 4, r / 1.8, r / 1.6) // tête bleue
        g.fillStyle(0xfafafa).fillTriangle(r + r / 3.5, r - 6, r + r / 3.5, r + 1, r + r / 1.05, r - 2) // grand bec crochu clair
        g.fillStyle(0x9e9e9e).fillTriangle(r + r / 1.3, r - 3, r + r / 1.05, r - 2, r + r / 1.3, r + 1) // crochet
        g.fillStyle(0xffffff).fillCircle(r + 1, r - 5, 2.6); g.fillStyle(0x000000).fillCircle(r + 2, r - 5, 1.3) // œil
        g.fillStyle(0x00acc1).fillTriangle(r - 3, s - 6, r + 3, s - 6, r, s + 8) // longue queue turquoise
        break
      }
      case 'harfang-spectral': {
        // chouette fantomatique (placeholder) : plumage blanc-bleuté TRANSLUCIDE, aura pâle, grands
        // yeux lumineux, petit bec. Silhouette AÉRIENNE spectrale (alpha réduit, halo diffus).
        g.fillStyle(m.color, 0.2).fillCircle(r, r + 2, r + 4) // aura spectrale diffuse
        g.fillStyle(this.shadeColor(m.color, 0.92), 0.5).fillTriangle(-2, r - 4, r - 4, r - 2, 6, r + 10) // aile gauche large translucide
        g.fillStyle(this.shadeColor(m.color, 0.92), 0.5).fillTriangle(s + 2, r - 4, r + 4, r - 2, s - 6, r + 10) // aile droite
        g.fillStyle(m.color, 0.62).fillEllipse(r, r + 2, r / 1.15, r) // corps rondelet translucide
        g.fillStyle(this.shadeColor(m.color, 1.02), 0.72).fillEllipse(r, r - 3, r / 1.35, r / 1.4) // grosse tête ronde
        g.fillStyle(0xe1f5fe, 0.9).fillCircle(r - r / 3.2, r - 3, r / 4.5).fillCircle(r + r / 3.2, r - 3, r / 4.5) // grands disques oculaires
        g.fillStyle(0x4fc3f7).fillCircle(r - r / 3.2, r - 3, r / 8).fillCircle(r + r / 3.2, r - 3, r / 8) // yeux lumineux bleus
        g.fillStyle(0xb0bec5, 0.9).fillTriangle(r - 2, r - 1, r + 2, r - 1, r, r + 3) // petit bec
        g.fillStyle(m.color, 0.4).fillTriangle(r - 3, s - 4, r + 3, s - 4, r, s + 5) // queue diffuse
        break
      }
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

  // éclaircit (f>1) ou assombrit (f<1) une couleur 0xRRGGBB — sert à fabriquer rim light et ombres
  // à la main (fillGradientStyle est WebGL-only et ne bake pas en Canvas)
  private shadeColor(hex: number, f: number): number {
    const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * f))
    const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * f))
    const b = Math.min(255, Math.round((hex & 0xff) * f))
    return (r << 16) | (g << 8) | b
  }

  // halo lumineux baké : cercles concentriques du plus large (faible alpha) au plus petit (vif) →
  // lueur douce qui se fond vers le transparent aux bords (aucun cadre net)
  private bakeGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rMax: number, color: number, steps = 7, aMax = 0.5) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1) // 0 = extérieur diffus, 1 = cœur vif
      g.fillStyle(color, 0.05 + (aMax - 0.05) * t).fillCircle(cx, cy, rMax * (1 - t) + 2 * t)
    }
  }

  // chapeaux cosmétiques (slot 'hat') : dessinés pour se poser sur le haut de la tête du panda.
  // Règle de style : plus l'objet est rare/cher, plus le rendu est spectaculaire (dégradés peints
  // en couches, rim light, joyaux, halo/particules bakés). Texture 40×32, ancrée par le center.
  private drawCosmetic(id: string) {
    const g = this.add.graphics()
    switch (id) {
      case 'ruban': {
        // COMMUN (le moins cher) : petit nœud/ruban rouge mignon, simple mais net
        const base = 0xe53950
        g.fillStyle(this.shadeColor(base, 0.7)).fillTriangle(20, 18, 6, 10, 6, 26) // aile gauche (ombre)
        g.fillStyle(this.shadeColor(base, 0.7)).fillTriangle(20, 18, 34, 10, 34, 26) // aile droite (ombre)
        g.fillStyle(base).fillTriangle(20, 18, 7, 11, 7, 25)
        g.fillStyle(base).fillTriangle(20, 18, 33, 11, 33, 25)
        g.fillStyle(this.shadeColor(base, 1.35), 0.7).fillTriangle(20, 16, 9, 12, 12, 15) // reflet haut-gauche
        g.fillStyle(this.shadeColor(base, 1.35), 0.7).fillTriangle(20, 16, 31, 12, 28, 15) // reflet haut-droit
        g.fillStyle(this.shadeColor(base, 0.55)).fillEllipse(20, 18, 8, 12) // nœud central (ombré)
        g.fillStyle(base).fillEllipse(20, 17, 6, 9)
        g.fillStyle(this.shadeColor(base, 1.4), 0.8).fillEllipse(18, 15, 2.5, 4) // éclat sur le nœud
        break
      }
      case 'sakkat': {
        // COMMUN : chapeau conique en paille tressée, large bord, dégradé beige peint à la main
        g.fillStyle(0x7d5f3d).fillEllipse(20, 26, 40, 12) // dessous du bord (ombre portée)
        g.fillStyle(0xcaa574).fillEllipse(20, 24, 40, 10) // bord tressé
        g.fillStyle(0xe8d3a8, 0.6).fillEllipse(18, 22, 28, 5) // reflet clair sur le bord
        // cône en 3 bandes (foncé à droite → clair côté lumière) pour le volume
        g.fillStyle(0xb08d5c).fillTriangle(3, 25, 37, 25, 20, 2)
        g.fillStyle(0xc7a570).fillTriangle(3, 25, 20, 25, 20, 2)
        g.fillStyle(0xdcbd8e).fillTriangle(9, 25, 20, 25, 20, 4) // arête éclairée
        // brins de bambou rayonnant du sommet vers le bord
        g.lineStyle(1, 0x7d5f3d, 0.7).beginPath()
        for (const bx of [6, 13, 20, 27, 34]) { g.moveTo(20, 3); g.lineTo(bx, 24) }
        g.strokePath()
        g.lineStyle(1, 0x7d5f3d, 0.4).beginPath() // cerclages du tressage
        g.moveTo(12, 14); g.lineTo(28, 14); g.moveTo(8, 20); g.lineTo(32, 20)
        g.strokePath()
        g.fillStyle(0x7d5f3d).fillCircle(20, 3, 2) // pointe du sommet
        break
      }
      case 'bonnet-champi': {
        // COMMUN : chapeau champignon rouge à points blancs, dégradé + petit reflet, tige claire
        g.fillStyle(0xf5f5dc).fillRect(6, 23, 28, 6) // pied du champignon
        g.fillStyle(0xe4e4c4).fillRect(6, 27, 28, 2) // ombre sous le pied
        g.fillStyle(0xa41e1e).fillEllipse(20, 16, 36, 24) // chapeau (base sombre)
        g.fillStyle(0xd32f2f).fillEllipse(20, 15, 33, 21) // rouge vif
        g.fillStyle(0xf1584f, 0.8).fillEllipse(16, 11, 18, 9) // reflet supérieur
        // points blancs (plus gros au centre, ombrés en bas)
        for (const [px, py, pr] of [[11, 12, 3], [24, 8, 3.2], [30, 15, 2.8], [16, 19, 2.4], [20, 13, 2]] as const) {
          g.fillStyle(0xe0e0d0).fillCircle(px, py + 0.8, pr)
          g.fillStyle(0xffffff).fillCircle(px, py, pr)
        }
        break
      }
      case 'chapeau-poring': {
        // PEU COMMUN : tête de Poring rose bombée — dégradé riche (3 tons), gros reflet, frimousse
        const p = 0xff7fb2
        g.fillStyle(this.shadeColor(p, 0.72)).fillEllipse(20, 19, 34, 26) // liseré foncé (volume)
        g.fillStyle(p).fillEllipse(20, 17, 31, 23) // corps rose bombé
        g.fillStyle(this.shadeColor(p, 1.18)).fillEllipse(20, 21, 24, 14) // ventre plus clair
        g.fillStyle(0xffffff, 0.55).fillEllipse(13, 9, 13, 8) // gros reflet brillant
        g.fillStyle(0xffffff, 0.85).fillCircle(27, 8, 1.8) // petit éclat
        g.fillStyle(0xff5a9e, 0.5).fillCircle(10, 21, 3).fillCircle(30, 21, 3) // joues
        g.fillStyle(0x2b2b2b).fillEllipse(14, 17, 4.5, 6).fillEllipse(26, 17, 4.5, 6) // yeux
        g.fillStyle(0xffffff).fillCircle(12.6, 15, 1.5).fillCircle(24.6, 15, 1.5) // reflets des yeux
        g.lineStyle(1.8, 0x2b2b2b).beginPath()
        g.arc(20, 19, 4.5, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false)
        g.strokePath()
        break
      }
      case 'casque-orc': {
        // RARE : heaume de métal sombre, rivets, cornes claires, rim light bleuté
        const m = 0x556b60
        g.fillStyle(0x2f4038).fillEllipse(20, 18, 34, 22) // calotte (base sombre)
        g.fillStyle(m).fillEllipse(20, 17, 31, 19)
        g.fillStyle(this.shadeColor(m, 1.4), 0.7).fillEllipse(16, 12, 18, 7) // reflet supérieur
        g.fillStyle(0x9fb0a6, 0.6).fillEllipse(12, 11, 6, 3) // point de lumière vif
        g.fillStyle(0x2b3640).fillRect(4, 15, 32, 7) // bande frontale
        g.fillStyle(0x3d4a56).fillRect(4, 15, 32, 2) // arête éclairée de la bande
        // cornes (dégradé os)
        g.fillStyle(0x6d5a4a).fillTriangle(6, 17, 0, 3, 11, 17)
        g.fillStyle(0x9c8468).fillTriangle(6, 17, 3, 6, 9, 17)
        g.fillStyle(0x6d5a4a).fillTriangle(34, 17, 40, 3, 29, 17)
        g.fillStyle(0x9c8468).fillTriangle(34, 17, 37, 6, 31, 17)
        g.fillStyle(0x161c22).fillRect(14, 18, 12, 3) // fente de visière
        for (const rx of [8, 20, 32]) { g.fillStyle(0x161c22).fillCircle(rx, 20, 1.5); g.fillStyle(0x8fa39a).fillCircle(rx - 0.4, 19.6, 0.7) } // rivets
        break
      }
      case 'casque-croc': {
        // RARE : casque à crocs — métal froid, mâchoire de crocs, œil rougeoyant, rim light
        const m = 0x5a6472
        g.fillStyle(0x333b47).fillEllipse(20, 15, 34, 22) // dôme (base)
        g.fillStyle(m).fillEllipse(20, 14, 31, 19)
        g.fillStyle(this.shadeColor(m, 1.45), 0.7).fillEllipse(15, 9, 18, 7) // reflet
        g.fillStyle(0xb9c4d2, 0.6).fillEllipse(12, 8, 6, 3) // éclat vif
        g.fillStyle(0x232a33).fillRect(5, 16, 30, 4) // mâchoire supérieure
        // crocs pointant vers le bas (dégradé ivoire)
        for (let i = 0; i < 6; i++) {
          const cx = 8 + i * 4.6
          g.fillStyle(0xd7c9a8).fillTriangle(cx - 2, 19, cx + 2, 19, cx, 28)
          g.fillStyle(0xfff6e0).fillTriangle(cx - 2, 19, cx, 19, cx - 0.4, 25) // arête claire du croc
        }
        this.bakeGlow(g, 20, 12, 6, 0xff3d3d, 5, 0.55) // œil/visière rougeoyant
        g.fillStyle(0xff5252).fillEllipse(20, 12, 7, 3)
        g.fillStyle(0xffd0d0, 0.9).fillCircle(18, 11, 1) // éclat de l'œil
        break
      }
      case 'ailes-angeling': {
        // RARE (haut de gamme) : paire d'ailes blanches plumées + auréole rayonnante
        this.bakeGlow(g, 20, 6, 10, 0xfff3b0, 6, 0.4) // halo derrière l'auréole
        for (const side of [-1, 1] as const) {
          const bx = 20 + side * 13
          g.fillStyle(0xcfd6e0).fillEllipse(bx, 21, 15, 22) // aile (base ombrée)
          g.fillStyle(0xffffff).fillEllipse(bx, 20, 12, 19) // plume principale claire
          // rangées de plumes (arcs) pour le détail
          for (let r = 0; r < 3; r++) {
            const py = 13 + r * 6
            g.fillStyle(0xeef2f7).fillEllipse(bx - side * 1, py, 11 - r * 2, 5)
            g.fillStyle(0xffffff, 0.9).fillEllipse(bx - side * 2, py - 1, 8 - r * 2, 3)
          }
          g.fillStyle(0xb9c2d0, 0.5).fillEllipse(bx + side * 4, 26, 5, 9) // ombre du bord
        }
        g.lineStyle(3, 0xffe082).strokeCircle(20, 6, 9) // auréole dorée
        g.lineStyle(1.5, 0xfff8e1).strokeCircle(20, 6, 9)
        break
      }
      case 'couronne-royale': {
        // ÉPIQUE : couronne d'or à joyaux — halo doré, dégradé or (3 tons), reflets et éclats
        this.bakeGlow(g, 20, 12, 15, 0xffe27a, 7, 0.42) // halo doré (aura de prestige)
        const gold = 0xffd23f
        // bandeau + pointes (base foncée puis or vif + rim clair)
        g.fillStyle(this.shadeColor(gold, 0.6)).fillRect(4, 17, 32, 10)
        g.fillStyle(gold).fillRect(4, 17, 32, 8)
        for (const [x0, xm, x1, ty] of [[4, 10, 16, 3], [15, 20, 25, -1], [24, 30, 36, 3]] as const) {
          g.fillStyle(this.shadeColor(gold, 0.6)).fillTriangle(x0, 19, xm, ty + 2, x1, 19)
          g.fillStyle(gold).fillTriangle(x0, 18, xm, ty, x1, 18)
          g.fillStyle(this.shadeColor(gold, 1.35), 0.85).fillTriangle(xm - 3, 15, xm, ty, xm + 1, 14) // arête brillante
        }
        g.fillStyle(this.shadeColor(gold, 1.4), 0.8).fillRect(5, 18, 30, 1.6) // rim light du bandeau
        // joyaux avec facette claire
        for (const [jx, jy, col] of [[10, 22, 0xe6392f], [20, 22, 0x2f7de6], [30, 22, 0x2fb84a]] as const) {
          g.fillStyle(this.shadeColor(col, 0.6)).fillCircle(jx, jy + 0.6, 2.8)
          g.fillStyle(col).fillCircle(jx, jy, 2.6)
          g.fillStyle(0xffffff, 0.9).fillCircle(jx - 0.9, jy - 0.9, 0.9)
        }
        // éclats scintillants (petits + baké)
        for (const [sx, sy] of [[11, 6], [28, 5], [20, 2]] as const) {
          g.fillStyle(0xffffff, 0.95).fillCircle(sx, sy, 1.4)
          g.fillStyle(0xfff2b0, 0.6).fillCircle(sx, sy, 2.6)
        }
        break
      }
      case 'corne-kaho': {
        // LÉGENDAIRE (le plus cher, le plus spectaculaire) : corne unique ardente de Lord Kaho,
        // rayonnement de feu baké, dégradé braise → or, langues de flamme et éclats de gemme
        this.bakeGlow(g, 20, 12, 19, 0xff5a1e, 8, 0.5) // grand halo ardent
        this.bakeGlow(g, 20, 9, 10, 0xffd23f, 6, 0.55) // cœur doré plus vif
        // langues de flamme derrière la corne
        for (const [fx, tip, w] of [[11, -2, 5], [29, -1, 5], [20, -6, 6]] as const) {
          g.fillStyle(0xff3d00, 0.85).fillTriangle(fx - w, 16, fx + w, 16, fx, tip)
          g.fillStyle(0xffa726, 0.9).fillTriangle(fx - w * 0.6, 15, fx + w * 0.6, 15, fx, tip + 3)
          g.fillStyle(0xfff176, 0.9).fillTriangle(fx - w * 0.3, 13, fx + w * 0.3, 13, fx, tip + 6)
        }
        // socle métallique sombre (attache de la corne sur le front)
        g.fillStyle(0x2a1a12).fillEllipse(20, 24, 30, 10)
        g.fillStyle(0x4a2f1e).fillEllipse(20, 23, 26, 7)
        g.fillStyle(0x7a4a2c, 0.7).fillEllipse(16, 21, 12, 3) // reflet du socle
        // corne courbe : base braise → pointe incandescente (couches empilées)
        g.fillStyle(0x7a1500).fillTriangle(13, 24, 27, 24, 24, 1) // base sombre
        g.fillStyle(0xd42a00).fillTriangle(14, 23, 26, 23, 23, 3) // braise
        g.fillStyle(0xff5a1e).fillTriangle(16, 22, 25, 22, 22.5, 5) // rouge-orangé
        g.fillStyle(0xffb547).fillTriangle(19, 21, 24, 21, 22, 7) // arête chaude
        g.fillStyle(0xfff3c4, 0.95).fillTriangle(21, 19, 23, 19, 22.5, 8) // pointe incandescente
        // gemme ardente sur le socle + éclat
        g.fillStyle(0x7a0d0d).fillCircle(20, 24, 3.2)
        g.fillStyle(0xff2a2a).fillCircle(20, 23.6, 2.6)
        g.fillStyle(0xffd0a0, 0.95).fillCircle(19, 22.6, 1)
        // étincelles bakées qui montent
        for (const [sx, sy, sr] of [[11, 8, 1.3], [30, 7, 1.2], [24, 3, 1], [15, 4, 0.9]] as const) {
          g.fillStyle(0xffe082, 0.95).fillCircle(sx, sy, sr)
          g.fillStyle(0xff8a3d, 0.5).fillCircle(sx, sy, sr + 1.6)
        }
        break
      }
      case 'bandeau-guerrier': {
        // COMMUN : bandeau de tissu serré avec nœud sur le côté et pans flottants
        const base = 0x3949ab
        g.fillStyle(this.shadeColor(base, 0.7)).fillRoundedRect(4, 15, 32, 9, 3) // bande (ombre)
        g.fillStyle(base).fillRoundedRect(4, 14, 32, 8, 3)
        g.fillStyle(this.shadeColor(base, 1.4), 0.6).fillRect(6, 15, 28, 2) // reflet
        g.fillStyle(this.shadeColor(base, 0.55)).fillCircle(33, 19, 4) // nœud (ombre)
        g.fillStyle(base).fillCircle(33, 18, 3.5)
        g.fillStyle(this.shadeColor(base, 0.7)).fillTriangle(33, 20, 39, 24, 37, 28) // pan flottant
        g.fillStyle(base).fillTriangle(33, 20, 38, 26, 34, 27)
        break
      }
      case 'plume-eclaireur': {
        // COMMUN : bandeau de cuir avec une grande plume colorée fichée sur le côté
        g.fillStyle(0x5d4037).fillRoundedRect(5, 17, 30, 7, 2) // bandeau cuir
        g.fillStyle(0x795548, 0.8).fillRect(7, 18, 26, 2) // couture claire
        // plume : hampe + barbes vertes-turquoise dégradées
        g.fillStyle(0x00695c).fillTriangle(28, 20, 40, 2, 34, 20) // barbe extérieure (ombre)
        g.fillStyle(0x26a69a).fillTriangle(29, 19, 38, 3, 33, 19) // barbe vive
        g.fillStyle(0x80cbc4, 0.9).fillTriangle(31, 18, 37, 5, 34, 16) // reflet
        g.lineStyle(1.5, 0xede7f6).beginPath(); g.moveTo(30, 20); g.lineTo(38, 4); g.strokePath() // rachis
        break
      }
      case 'bonnet-laine': {
        // COMMUN : bonnet tricoté à revers et pompon, mailles suggérées par des rayures
        const base = 0xc62828
        g.fillStyle(this.shadeColor(base, 0.7)).fillEllipse(20, 15, 32, 20) // calotte (ombre)
        g.fillStyle(base).fillEllipse(20, 14, 30, 18)
        g.fillStyle(this.shadeColor(base, 1.25), 0.7).fillEllipse(15, 9, 14, 7) // reflet
        g.lineStyle(1, this.shadeColor(base, 0.6), 0.6).beginPath() // mailles verticales
        for (const mx of [10, 15, 20, 25, 30]) { g.moveTo(mx, 8); g.lineTo(mx, 22) }
        g.strokePath()
        g.fillStyle(0xf5f5f5).fillRoundedRect(4, 20, 32, 7, 3) // revers en laine claire
        g.fillStyle(0xe0e0e0, 0.7).fillRect(4, 24, 32, 3)
        g.fillStyle(0xf5f5f5).fillCircle(20, 5, 4) // pompon
        g.fillStyle(0xffffff, 0.8).fillCircle(18.5, 3.5, 1.5)
        break
      }
      case 'oreilles-chat': {
        // RARE : serre-tête à deux oreilles de chat triangulaires, intérieur rose
        const fur = 0x5d4037
        g.fillStyle(0x4e342e).fillRoundedRect(6, 20, 28, 5, 2) // serre-tête
        for (const s of [-1, 1] as const) {
          const cx = 20 + s * 10
          g.fillStyle(this.shadeColor(fur, 0.8)).fillTriangle(cx - 7, 22, cx + 7, 22, cx, 2) // oreille (ombre)
          g.fillStyle(fur).fillTriangle(cx - 6, 21, cx + 6, 21, cx, 4)
          g.fillStyle(0xf48fb1).fillTriangle(cx - 3, 19, cx + 3, 19, cx, 8) // intérieur rose
          g.fillStyle(0xffffff, 0.6).fillTriangle(cx - 4, 20, cx - 2, 20, cx - 1, 9) // reflet bord
        }
        break
      }
      case 'chapeau-sorciere': {
        // RARE : grand chapeau pointu à large bord, boucle dorée, dégradé violet nuit
        const base = 0x4a148c
        g.fillStyle(this.shadeColor(base, 0.55)).fillEllipse(20, 27, 40, 10) // bord (ombre)
        g.fillStyle(base).fillEllipse(20, 26, 38, 8)
        g.fillStyle(this.shadeColor(base, 1.3), 0.5).fillEllipse(15, 25, 20, 3) // reflet du bord
        // cône légèrement courbé à la pointe (3 bandes de volume)
        g.fillStyle(this.shadeColor(base, 0.65)).fillTriangle(9, 26, 31, 26, 26, 1)
        g.fillStyle(base).fillTriangle(9, 26, 24, 26, 24, 3)
        g.fillStyle(this.shadeColor(base, 1.25)).fillTriangle(12, 26, 20, 26, 23, 4) // arête éclairée
        g.fillStyle(0x2a0a52).fillRect(6, 22, 28, 4) // ruban sombre
        g.fillStyle(0xffca28).fillRect(17, 21, 7, 6) // boucle dorée
        g.fillStyle(0x2a0a52).fillRect(19, 22, 3, 4)
        break
      }
      case 'lunettes-aviateur': {
        // RARE : lunettes d'aviateur relevées sur le front — bandeau cuir, deux verres cerclés cuivre
        g.fillStyle(0x5d4037).fillRoundedRect(4, 12, 32, 8, 3) // bandeau cuir
        g.fillStyle(0x795548, 0.7).fillRect(6, 13, 28, 2)
        for (const cx of [13, 27] as const) {
          g.fillStyle(0xb87333).fillCircle(cx, 20, 7) // cerclage cuivre
          g.fillStyle(0x8d5a24).fillCircle(cx, 20, 6)
          g.fillStyle(0x4fc3f7).fillCircle(cx, 20, 4.5) // verre bleuté
          g.fillStyle(0xe1f5fe, 0.8).fillCircle(cx - 1.6, 18.4, 1.6) // reflet
        }
        g.fillStyle(0xb87333).fillRect(18, 19, 4, 2.5) // pont central
        break
      }
      case 'casque-viking': {
        // ÉPIQUE : casque de fer arrondi, bande rivetée, deux grandes cornes claires écartées
        const m = 0x607d8b
        g.fillStyle(0x37474f).fillEllipse(20, 18, 30, 20) // dôme (base)
        g.fillStyle(m).fillEllipse(20, 17, 27, 17)
        g.fillStyle(this.shadeColor(m, 1.45), 0.7).fillEllipse(15, 12, 16, 6) // reflet
        g.fillStyle(0x455a64).fillRect(6, 16, 28, 5) // bande frontale rivetée
        for (const rx of [10, 20, 30]) { g.fillStyle(0x263238).fillCircle(rx, 18, 1.4); g.fillStyle(0xb0bec5).fillCircle(rx - 0.4, 17.6, 0.6) }
        // cornes recourbées (dégradé os)
        for (const s of [-1, 1] as const) {
          g.fillStyle(0x8d6e5a).fillTriangle(20 + s * 8, 15, 20 + s * 20, 12, 20 + s * 13, 1)
          g.fillStyle(0xcbb494).fillTriangle(20 + s * 9, 14, 20 + s * 17, 11, 20 + s * 13, 3)
          g.fillStyle(0xf0e6d2, 0.8).fillTriangle(20 + s * 10, 13, 20 + s * 12, 11, 20 + s * 12.5, 4) // arête claire
        }
        break
      }
      case 'diademe-fee': {
        // ÉPIQUE : fin diadème d'argent à volutes, grande gemme rose lumineuse, halo doux
        this.bakeGlow(g, 20, 15, 12, 0xf48fb1, 6, 0.4) // aura féerique
        g.lineStyle(2.5, 0xcfd8dc).beginPath() // arceau
        g.arc(20, 26, 15, Phaser.Math.DegToRad(-152), Phaser.Math.DegToRad(-28), false); g.strokePath()
        g.lineStyle(1.2, 0xffffff).beginPath()
        g.arc(20, 26, 15, Phaser.Math.DegToRad(-152), Phaser.Math.DegToRad(-28), false); g.strokePath()
        // volutes latérales
        g.lineStyle(2, 0xcfd8dc).beginPath(); g.arc(11, 18, 3, 0, Math.PI * 2); g.moveTo(32, 18); g.arc(29, 18, 3, 0, Math.PI * 2); g.strokePath()
        // gemme centrale à facette
        g.fillStyle(0xad1457).fillCircle(20, 12, 4.4)
        g.fillStyle(0xf06292).fillCircle(20, 12, 3.4)
        g.fillStyle(0xffffff, 0.9).fillCircle(18.5, 10.5, 1.2)
        g.fillStyle(0xfff59d).fillCircle(11, 14, 1.6).fillCircle(29, 14, 1.6) // petites gemmes
        break
      }
      case 'aureole-sacree': {
        // ÉPIQUE : auréole dorée rayonnante flottant au-dessus de la tête, halo sacré et plumes
        this.bakeGlow(g, 20, 12, 16, 0xfff3b0, 8, 0.45) // grand halo
        this.bakeGlow(g, 20, 12, 8, 0xfffde7, 5, 0.5)
        // petites ailes légères de part et d'autre
        for (const s of [-1, 1] as const) {
          g.fillStyle(0xeceff1).fillEllipse(20 + s * 15, 20, 8, 5)
          g.fillStyle(0xffffff, 0.9).fillEllipse(20 + s * 15, 19, 5, 3)
        }
        // anneau doré (auréole)
        g.lineStyle(4, 0xffca28).strokeEllipse(20, 11, 26, 9)
        g.lineStyle(2, 0xfff59d).strokeEllipse(20, 11, 26, 9)
        // scintillements
        for (const [sx, sy] of [[8, 6], [32, 6], [20, 2]] as const) {
          g.fillStyle(0xffffff, 0.95).fillCircle(sx, sy, 1.3)
          g.fillStyle(0xfff2b0, 0.6).fillCircle(sx, sy, 2.5)
        }
        break
      }
      case 'couronne-glace': {
        // LÉGENDAIRE : couronne de glace à pics anguleux, dégradé cyan, halo froid, gemme saphir
        this.bakeGlow(g, 20, 13, 16, 0x40c4ff, 8, 0.48) // aura glaciale
        const ice = 0x81d4fa
        g.fillStyle(this.shadeColor(ice, 0.6)).fillRect(4, 18, 32, 9) // bandeau (ombre)
        g.fillStyle(ice).fillRect(4, 18, 32, 7)
        g.fillStyle(0xe1f5fe, 0.7).fillRect(5, 19, 30, 1.6) // rim clair
        // pics de glace irréguliers
        for (const [x0, xm, x1, ty] of [[4, 9, 14, 4], [12, 20, 28, -2], [26, 31, 36, 5]] as const) {
          g.fillStyle(this.shadeColor(ice, 0.7)).fillTriangle(x0, 20, xm, ty + 2, x1, 20)
          g.fillStyle(ice).fillTriangle(x0, 19, xm, ty, x1, 19)
          g.fillStyle(0xe1f5fe, 0.9).fillTriangle(xm - 2, 15, xm, ty, xm + 1, 14) // arête givrée
        }
        // saphir central
        g.fillStyle(0x0277bd).fillCircle(20, 22, 3)
        g.fillStyle(0x4fc3f7).fillCircle(20, 22, 2.2)
        g.fillStyle(0xffffff, 0.9).fillCircle(19, 21, 0.9)
        break
      }
      case 'masque-demon': {
        // LÉGENDAIRE : masque d'oni écarlate, cornes noires ardentes, crocs, yeux rougeoyants, feu
        this.bakeGlow(g, 20, 14, 17, 0xff3d00, 8, 0.5) // aura infernale
        const red = 0xc62828
        g.fillStyle(this.shadeColor(red, 0.6)).fillEllipse(20, 17, 32, 24) // face (ombre)
        g.fillStyle(red).fillEllipse(20, 16, 29, 21)
        g.fillStyle(this.shadeColor(red, 1.25), 0.6).fillEllipse(14, 11, 14, 7) // reflet
        // cornes noires recourbées, pointe braise
        for (const s of [-1, 1] as const) {
          g.fillStyle(0x1a1a1a).fillTriangle(20 + s * 9, 12, 20 + s * 19, 6, 20 + s * 12, -2)
          g.fillStyle(0x3a2a2a).fillTriangle(20 + s * 10, 11, 20 + s * 16, 6, 20 + s * 12.5, 0)
          g.fillStyle(0xff5a1e, 0.9).fillCircle(20 + s * 12.5, 0, 1.6) // pointe ardente
        }
        // yeux rougeoyants en amande
        this.bakeGlow(g, 13, 16, 4, 0xff5252, 4, 0.6)
        this.bakeGlow(g, 27, 16, 4, 0xff5252, 4, 0.6)
        g.fillStyle(0xffeb3b).fillEllipse(13, 16, 5, 3).fillEllipse(27, 16, 5, 3)
        g.fillStyle(0x1a1a1a).fillCircle(13, 16, 1.2).fillCircle(27, 16, 1.2)
        // rictus + crocs
        g.fillStyle(0x1a1a1a).fillRect(12, 23, 16, 3)
        for (const cx of [14, 18, 22, 26]) g.fillStyle(0xfff6e0).fillTriangle(cx - 1.5, 23, cx + 1.5, 23, cx, 28)
        break
      }
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
      case 'jump': // double saut : deux chevrons montants + petit souffle sous les pieds
        g.lineStyle(4, c).beginPath(); g.moveTo(12, 20); g.lineTo(22, 10); g.lineTo(32, 20); g.strokePath()
        g.lineStyle(4, c).beginPath(); g.moveTo(12, 30); g.lineTo(22, 20); g.lineTo(32, 30); g.strokePath()
        g.lineStyle(2, 0xe1f5fe, 0.7).beginPath(); g.moveTo(15, 37); g.lineTo(19, 37); g.moveTo(25, 37); g.lineTo(29, 37); g.strokePath()
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
      case 'firearrow': // flèche montée d'une flamme
        g.lineStyle(3, c).beginPath(); g.moveTo(12, 32); g.lineTo(30, 14); g.strokePath()
        g.fillStyle(c).fillTriangle(30, 14, 22, 16, 28, 22)
        g.fillStyle(0xffca28).fillCircle(14, 30, 4); g.fillStyle(0xff5252).fillTriangle(10, 30, 18, 30, 14, 22)
        break
      case 'boomarrow': // flèche en cloche + petite déflagration
        g.lineStyle(2, c).beginPath(); g.arc(cx, 24, 13, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(350), false); g.strokePath()
        g.fillStyle(0xffe082).fillCircle(cx + 13, 26, 4)
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillStyle(c).fillCircle(cx + 13 + Math.cos(a) * 8, 26 + Math.sin(a) * 8, 1.6) }
        break
      case 'exploarrow': { // FLÈCHE explosive : une vraie flèche + petite déflagration à la pointe (pas une grenade)
        g.lineStyle(3, c).beginPath(); g.moveTo(8, 30); g.lineTo(22, 16); g.strokePath() // hampe
        g.fillStyle(c).fillTriangle(27, 11, 19, 14, 23, 21) // pointe
        g.lineStyle(2, c).beginPath(); g.moveTo(8, 30); g.lineTo(5, 26); g.moveTo(8, 30); g.lineTo(12, 33); g.strokePath() // empennage
        g.lineStyle(2, 0xffca28) // déflagration = rayons courts à la pointe
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(26 + Math.cos(a) * 3, 12 + Math.sin(a) * 3); g.lineTo(26 + Math.cos(a) * 7, 12 + Math.sin(a) * 7); g.strokePath() }
        break
      }
      case 'gatling': // MITRAILLETTE : vue de face d'une gatling (cercle de canons) — SYMÉTRIQUE, teinte mate
        g.lineStyle(2, c).strokeCircle(cx, cy, 11)
        g.fillStyle(c).fillCircle(cx, cy, 3) // canon central
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillCircle(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 2.2) } // canons périphériques
        break
      case 'trap': // piège à mâchoires : deux demi-cercles dentés
        g.lineStyle(3, c).beginPath(); g.arc(cx, cy, 12, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath()
        g.beginPath(); g.arc(cx, cy, 12, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath()
        g.fillStyle(c); for (let i = 0; i < 5; i++) { const px = cx - 10 + i * 5; g.fillTriangle(px, cy - 4, px + 4, cy - 4, px + 2, cy); g.fillTriangle(px, cy + 4, px + 4, cy + 4, px + 2, cy) }
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
      case 'slam': // plongeon : flèche vers le bas percutant une onde au sol
        g.lineStyle(4, c).beginPath(); g.moveTo(cx, 6); g.lineTo(cx, 26); g.strokePath()
        g.fillStyle(c).fillTriangle(cx - 6, 24, cx + 6, 24, cx, 32)
        g.lineStyle(2, c); for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(cx, 34, 6 + i * 6, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath() }
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
      case 'flamesword': // épée dont la lame s'embrase (distincte de la boule de feu)
        g.lineStyle(4, 0xeceff1).beginPath(); g.moveTo(13, 31); g.lineTo(31, 13); g.strokePath() // lame
        g.lineStyle(3, 0x9e9e9e).beginPath(); g.moveTo(10, 28); g.lineTo(16, 34); g.strokePath() // garde
        // flammes qui lèchent la lame
        g.fillStyle(0xff7043).fillTriangle(20, 24, 26, 24, 24, 12)
        g.fillStyle(0xffca28).fillTriangle(22, 22, 26, 22, 25, 15)
        g.fillStyle(0xff5252).fillTriangle(28, 18, 33, 18, 31, 8)
        break
      case 'swordthrow': // épée lancée / tournoyante : lame horizontale + arcs de rotation
        g.lineStyle(4, c).beginPath(); g.moveTo(10, 26); g.lineTo(30, 18); g.strokePath() // lame filante
        g.fillStyle(c).fillTriangle(30, 18, 24, 15, 25, 22) // pointe
        g.lineStyle(2, 0x9e9e9e).beginPath(); g.moveTo(11, 22); g.lineTo(15, 30); g.strokePath() // garde
        g.lineStyle(2, c, 0.6); g.beginPath(); g.arc(22, 22, 15, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(320), false); g.strokePath()
        break
      case 'swordx': // ultime : deux lames croisées (X)
        g.lineStyle(4, c).beginPath(); g.moveTo(12, 32); g.lineTo(32, 12); g.strokePath()
        g.beginPath(); g.moveTo(12, 12); g.lineTo(32, 32); g.strokePath()
        g.lineStyle(3, 0x9e9e9e).beginPath(); g.moveTo(9, 29); g.lineTo(15, 35); g.moveTo(29, 35); g.lineTo(35, 29); g.strokePath()
        g.fillStyle(0xffffff).fillCircle(cx, cy, 2.5)
        break
      case 'flamewall': // mur de flammes : rangée de flammes dressées sur une base
        g.fillStyle(0x5d4037).fillRect(7, 33, 30, 4) // base / sol
        for (let i = 0; i < 3; i++) {
          const fx = 13 + i * 9, h = i === 1 ? 22 : 17
          g.fillStyle(0xff7043).fillTriangle(fx - 5, 34, fx + 5, 34, fx, 34 - h)
          g.fillStyle(0xffca28).fillTriangle(fx - 2.5, 34, fx + 2.5, 34, fx, 34 - h * 0.6)
        }
        break
      case 'meteor': // roche enflammée avec traînée (un seul météore)
        g.fillStyle(c, 0.35).fillTriangle(30, 8, 36, 10, 20, 24) // traînée
        g.fillStyle(0xffca28, 0.6).fillTriangle(28, 12, 33, 13, 22, 22)
        g.fillStyle(0x6d4c41).fillCircle(18, 26, 8) // roche
        g.fillStyle(0xff7043).fillCircle(15, 23, 3).fillCircle(21, 28, 2.5) // braises
        break
      case 'meteors': // plusieurs météores : pluie de roches enflammées
        for (const [mx, my, r] of [[13, 22, 6], [26, 30, 5], [30, 14, 4]] as const) {
          g.fillStyle(c, 0.35).fillTriangle(mx + r + 6, my - r - 6, mx + r + 10, my - r - 3, mx, my)
          g.fillStyle(0x6d4c41).fillCircle(mx, my, r)
          g.fillStyle(0xff7043).fillCircle(mx - r * 0.4, my - r * 0.3, r * 0.4)
        }
        break
      case 'rage': { // furie : crâne rouge cerné d'un éclat de rage
        g.fillStyle(0xd50000); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillTriangle(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, cx + Math.cos(a + 0.3) * 9, cy + Math.sin(a + 0.3) * 9, cx + Math.cos(a + 0.15) * 18, cy + Math.sin(a + 0.15) * 18) }
        g.fillStyle(0xffebee).fillCircle(cx, cy - 1, 8) // crâne pâle
        g.fillStyle(0xffebee).fillRect(cx - 4, cy + 4, 8, 5) // mâchoire
        g.fillStyle(0x7f0000).fillCircle(cx - 3, cy - 1, 2.3).fillCircle(cx + 3, cy - 1, 2.3) // orbites
        g.fillStyle(0x7f0000).fillRect(cx - 3, cy + 5, 1.5, 4).fillRect(cx + 1.5, cy + 5, 1.5, 4) // dents
        break
      }
      case 'regen': // régénération : cœur vert traversé d'une flèche montante (PV qui remontent)
        g.fillStyle(c).fillCircle(cx - 5, cy - 1, 6).fillCircle(cx + 5, cy - 1, 6).fillTriangle(cx - 10, cy + 1, cx + 10, cy + 1, cx, cy + 12)
        g.lineStyle(3, 0xe8f5e9).beginPath(); g.moveTo(cx, cy + 8); g.lineTo(cx, cy - 12); g.strokePath()
        g.fillStyle(0xe8f5e9).fillTriangle(cx - 5, cy - 8, cx + 5, cy - 8, cx, cy - 16)
        break
      case 'aura': { // fureur arcanique : anneaux d'arcanes concentriques + étincelle centrale
        g.lineStyle(2, c, 0.9).strokeCircle(cx, cy, 13).strokeCircle(cx, cy, 8)
        g.fillStyle(0xffffff).fillCircle(cx, cy, 3)
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillStyle(c).fillCircle(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 1.8) }
        break
      }
      case 'eye': // œil du lynx : œil en amande avec pupille verte
        g.lineStyle(2, c).beginPath(); g.arc(cx, cy, 13, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath()
        g.beginPath(); g.arc(cx, cy, 13, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath()
        g.fillStyle(c).fillCircle(cx, cy, 5); g.fillStyle(0x0d1b12).fillEllipse(cx, cy, 3, 7)
        break
      case 'swift': // réflexes félins : chevrons de vitesse enchaînés
        g.lineStyle(3, c); for (let i = 0; i < 3; i++) { const ox = 10 + i * 8; g.beginPath(); g.moveTo(ox, 14); g.lineTo(ox + 8, cy); g.lineTo(ox, 30); g.strokePath() }
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
    // icônes d'objet : rognées à leur boîte englobante → item-<id> (repli sur l'affichage
    // existant partout où la texture manque, cf. iconFor/InventoryScene)
    for (const id of Object.keys(ITEMS)) this.bakeCropped(`itemart-${id}`, `item-${id}`)
    // potion de soin illustrée → texture `potion-drop` (le dessin procédural plus bas est sauté si OK)
    this.bakePotionDrop()
    this.bakeUiInventory()
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
    // ─── Projectiles « refonte » (attaques à distance) ─────────────────────────
    // Tous orientés vers la DROITE par défaut (la trajectoire horizontale) ; Projectile les
    // fait pivoter dans l'axe de la vélocité, donc un tir vers la gauche est simplement retourné.
    // fx-fireball : VRAIE flamme vive (attaque de base mage/sorcier) — dégradé cœur blanc-chaud →
    // cyan → bleu → halo diffus, avec une longue queue de flamme dégradée derrière (à gauche =
    // arrière quand elle file vers la droite) et de petites étincelles. Un scintillement d'échelle
    // est ajouté à l'usage (LevelScene.fireballShimmer) pour la faire vibrer comme du feu.
    g.fillStyle(0x40c4ff, 0.28).fillCircle(19, 9, 10) // halo cyan large et diffus
    g.fillStyle(0x82b1ff, 0.22).fillCircle(19, 9, 8) // halo interne bleuté
    g.fillStyle(0x1565c0, 0.85).fillTriangle(0, 9, 14, 4, 14, 14) // queue de flamme profonde (bleu foncé)
    g.fillStyle(0x2196f3, 0.9).fillTriangle(3, 9, 15, 6, 15, 12) // langue de flamme bleue
    g.fillStyle(0x4fc3f7, 0.95).fillTriangle(6, 9, 15, 7, 15, 11) // cœur de la traînée cyan
    g.fillStyle(0x1e88e5).fillCircle(19, 9, 7) // manteau bleu
    g.fillStyle(0x40c4ff).fillCircle(19, 9, 5.2) // couche cyan
    g.fillStyle(0xb3e5fc).fillCircle(18, 8, 3.2) // cœur clair
    g.fillStyle(0xffffff).fillCircle(17, 7, 1.7) // point blanc-chaud
    g.fillStyle(0xe1f5fe, 0.95).fillCircle(23, 11, 1) // étincelle
    g.fillStyle(0x81d4fa, 0.9).fillCircle(22, 6, 0.9) // étincelle
    g.generateTexture('fx-fireball', 30, 18); g.clear()
    // fx-fireball-orange : variante ORANGE pour les SORTS de feu du mage (boule de feu, etc.),
    // afin de les distinguer clairement de l'attaque de BASE (bleue ci-dessus)
    g.fillStyle(0xffab40, 0.28).fillCircle(19, 9, 10)
    g.fillStyle(0xffcc80, 0.22).fillCircle(19, 9, 8)
    g.fillStyle(0xe65100, 0.85).fillTriangle(0, 9, 14, 4, 14, 14)
    g.fillStyle(0xff6d00, 0.9).fillTriangle(3, 9, 15, 6, 15, 12)
    g.fillStyle(0xffab40, 0.95).fillTriangle(6, 9, 15, 7, 15, 11)
    g.fillStyle(0xff7043).fillCircle(19, 9, 7)
    g.fillStyle(0xffb74d).fillCircle(19, 9, 5.2)
    g.fillStyle(0xfff3e0).fillCircle(18, 8, 3.2)
    g.fillStyle(0xffffff).fillCircle(17, 7, 1.7)
    g.fillStyle(0xfff8e1, 0.95).fillCircle(23, 11, 1)
    g.fillStyle(0xffe082, 0.9).fillCircle(22, 6, 0.9)
    g.generateTexture('fx-fireball-orange', 30, 18); g.clear()
    // fx-arrow : flèche (attaque de base archer/chasseur) — traînée de vitesse dorée, hampe bois,
    // pointe acier brillante à droite, empennage rouge à l'arrière
    g.fillStyle(0xffe082, 0.25).fillTriangle(0, 6, 22, 3, 22, 9) // traînée de vitesse (halo doré)
    g.fillStyle(0x8d6e63).fillRect(3, 5, 19, 2) // hampe bois
    g.fillStyle(0xa1887f).fillRect(3, 5, 19, 1) // reflet de la hampe
    g.fillStyle(0xcfd8dc).fillTriangle(20, 1, 30, 6, 20, 11) // pointe
    g.fillStyle(0xeceff1).fillTriangle(22, 4, 28, 6, 22, 8) // arête brillante de la pointe
    g.fillStyle(0xffffff).fillCircle(29, 6, 1) // éclat au bout de la pointe
    g.fillStyle(0xe53935).fillTriangle(0, 2, 8, 6, 0, 6) // empennage (arrière)
    g.fillStyle(0xef5350).fillTriangle(0, 6, 8, 6, 0, 10); g.generateTexture('fx-arrow', 30, 12); g.clear()
    // fx-arrow-pierce : GRANDE flèche perçante d'énergie (skill) — dessinée en blanc → teintée par la
    // couleur du skill à l'usage ; halo lumineux + traînée dégradée + grande pointe rayonnante
    g.fillStyle(0xffffff, 0.18).fillTriangle(0, 9, 40, 2, 40, 16) // large traînée d'énergie
    g.fillStyle(0xffffff, 0.32).fillRoundedRect(0, 5, 52, 8, 4) // halo
    g.fillStyle(0xffffff, 0.85).fillRect(4, 7, 38, 4) // hampe brillante
    g.fillStyle(0xffffff).fillRect(8, 8, 30, 2) // cœur incandescent
    g.fillStyle(0xffffff).fillTriangle(36, 0, 52, 9, 36, 18) // grande pointe rayonnante
    g.fillStyle(0xffffff, 0.5).fillTriangle(0, 2, 14, 9, 0, 16); g.generateTexture('fx-arrow-pierce', 52, 18); g.clear()
    // fx-laser : faisceau d'énergie horizontal (skill perçant) — capsule blanche lumineuse teintée à
    // l'usage ; halo large dégradé + cœur blanc incandescent + tête plus vive
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(0, 0, 72, 16, 8) // halo large diffus
    g.fillStyle(0xffffff, 0.45).fillRoundedRect(0, 2, 72, 12, 6) // halo interne
    g.fillStyle(0xffffff, 0.8).fillRoundedRect(0, 5, 72, 6, 3) // corps du faisceau
    g.fillStyle(0xffffff).fillRoundedRect(2, 6, 70, 4, 2) // cœur incandescent
    g.fillStyle(0xffffff).fillCircle(70, 8, 4); g.generateTexture('fx-laser', 72, 16); g.clear()
    // fx-lob : boule verte lancée en cloche (mandragore) — retombe et éclate au sol
    g.fillStyle(0x2e5e1e, 0.4).fillCircle(9, 9, 9)
    g.fillStyle(0x33691e).fillCircle(9, 9, 7)
    g.fillStyle(0x7bc86c).fillCircle(9, 9, 5)
    g.fillStyle(0xc5e1a5).fillCircle(7, 7, 2); g.generateTexture('fx-lob', 18, 18); g.clear()
    // fx-trap : piège à mâchoires posé au sol (archer) — plaque + deux rangées de dents + charnière
    g.fillStyle(0x5d4037).fillEllipse(28, 20, 52, 10) // plaque/ombre au sol
    g.fillStyle(0x9e9e9e).fillRect(6, 16, 44, 4) // barre centrale (ressort)
    g.fillStyle(0xbdbdbd).fillCircle(28, 18, 4) // charnière
    g.fillStyle(0xeceff1) // dents supérieures et inférieures
    for (let i = 0; i < 8; i++) { const px = 8 + i * 5; g.fillTriangle(px, 14, px + 5, 14, px + 2.5, 6); g.fillTriangle(px, 22, px + 5, 22, px + 2.5, 30) }
    g.lineStyle(2, 0xffca28, 0.9).strokeEllipse(28, 18, 46, 22) // liseré d'armement
    g.generateTexture('fx-trap', 56, 34); g.clear()
    // fx-bolt : éclair/bolt magique HORIZONTAL du mage noir (losange violet lumineux)
    g.fillStyle(0xb388ff, 0.4).fillEllipse(12, 6, 26, 12)
    g.fillStyle(0x7e57c2).fillTriangle(2, 6, 13, 1, 13, 11)
    g.fillStyle(0x7e57c2).fillTriangle(22, 6, 11, 1, 11, 11)
    g.fillStyle(0xd1c4e9).fillEllipse(12, 6, 9, 4); g.generateTexture('fx-bolt', 24, 12); g.clear()
    // fx-rock : petit projectile de pierre (rocker)
    g.fillStyle(0x616161).fillCircle(7, 7, 6)
    g.fillStyle(0x9e9e9e).fillCircle(6, 6, 4)
    g.fillStyle(0xbdbdbd).fillCircle(5, 5, 1.6); g.generateTexture('fx-rock', 14, 14); g.clear()
    // fx-shot : orbe d'attaque ennemi générique (rouge-orange, bien lisible comme un danger)
    g.fillStyle(0xff7043, 0.35).fillCircle(9, 9, 9)
    g.fillStyle(0xe53935).fillCircle(9, 9, 6)
    g.fillStyle(0xff8a65).fillCircle(9, 9, 3.5)
    g.fillStyle(0xfff3e0).fillCircle(7, 7, 1.8); g.generateTexture('fx-shot', 18, 18); g.clear()
    // fx-bubble : bulle d'eau bleue translucide (méduse) — membrane cerclée + reflet
    g.fillStyle(0x4fc3f7, 0.30).fillCircle(9, 9, 8) // halo aqueux
    g.fillStyle(0x29b6f6, 0.45).fillCircle(9, 9, 6) // corps translucide
    g.lineStyle(1.5, 0xb3e5fc, 0.9).strokeCircle(9, 9, 6) // membrane
    g.fillStyle(0xe1f5fe, 0.9).fillCircle(6, 6, 2) // reflet
    g.generateTexture('fx-bubble', 18, 18); g.clear()
    // fx-spectral : orbe spectral bleu pâle vaporeux (fantôme, spectre ancien) — traînée arrière
    g.fillStyle(0x80deea, 0.22).fillCircle(11, 9, 9) // brume large
    g.fillStyle(0xb2ebf2, 0.45).fillCircle(10, 9, 6) // orbe vaporeux
    g.fillStyle(0xe0f7fa, 0.85).fillCircle(9, 8, 3) // cœur pâle
    g.fillStyle(0xb2ebf2, 0.35).fillTriangle(0, 9, 6, 6, 6, 12) // traînée (arrière)
    g.generateTexture('fx-spectral', 20, 18); g.clear()
    // fx-scream : onde de cri (banshee) — arcs violet pâle concentriques ouverts vers la droite
    g.lineStyle(3, 0xb39ddb, 0.9).beginPath(); g.arc(2, 8, 7, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false); g.strokePath()
    g.lineStyle(2.5, 0xd1c4e9, 0.8).beginPath(); g.arc(-2, 8, 10, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55), false); g.strokePath()
    g.lineStyle(2, 0xede7f6, 0.7).beginPath(); g.arc(-6, 8, 13, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false); g.strokePath()
    g.generateTexture('fx-scream', 22, 16); g.clear()
    // fx-spore : épine / spore verte (flora vorace) — pointe acérée vers la droite + reflet
    g.fillStyle(0x33691e).fillTriangle(0, 3, 16, 7, 0, 11) // épine
    g.fillStyle(0x7cb342).fillTriangle(2, 5, 12, 7, 2, 9) // cœur clair
    g.fillStyle(0xc5e1a5, 0.85).fillCircle(4, 7, 1.6) // spore
    g.generateTexture('fx-spore', 18, 14); g.clear()
    // fx-sand : projectile de sable doré (pharaon scarabée) — nuée de grains dorés
    g.fillStyle(0xffca28, 0.35).fillEllipse(9, 7, 18, 12) // nuage doré
    g.fillStyle(0xffb300).fillCircle(11, 7, 4)
    g.fillStyle(0xffe082).fillCircle(9, 6, 2.5)
    g.fillStyle(0xfff8e1).fillCircle(6, 5, 1.4)
    g.fillStyle(0xffb300).fillCircle(4, 9, 1.6).fillCircle(14, 9, 1.4) // grains dispersés
    g.generateTexture('fx-sand', 18, 14); g.clear()
    // fx-necro : bolt nécrotique violet sombre (roi liche, prêtre-goule) — orbe ténébreux + orbites
    g.fillStyle(0x4527a0, 0.35).fillCircle(10, 8, 8) // halo nécrotique
    g.fillStyle(0x311b92).fillCircle(10, 8, 6) // orbe violet sombre
    g.fillStyle(0x1a0e40).fillCircle(10, 8, 4) // cœur ténébreux
    g.fillStyle(0xb39ddb, 0.9).fillCircle(8, 6, 2) // lueur froide
    g.fillStyle(0xd1c4e9, 0.85).fillCircle(9, 8, 1).fillCircle(12, 8, 1) // orbites (petit crâne suggéré)
    g.generateTexture('fx-necro', 20, 16); g.clear()
    // pics MORTELS GÉANTS (rangée de pointes) — piège clairement mortel : hautes pointes de métal
    // sombre à extrémité ROUGE vif, socle rocheux, halo rouge d'avertissement. Texture ~2 tuiles de
    // haut (32×60, ≈ hauteur du panda) → pics imposants qui tuent ONE-SHOT au contact (cf. hitSpikes).
    const SH = 60
    // halo d'avertissement (lueur rouge diffuse derrière chaque pointe)
    g.fillStyle(0xff1744, 0.14); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8 - 1, SH, i * 8 + 4, 2, i * 8 + 9, SH)
    // grande pointe : triangle de métal sombre, base au socle, sommet acéré tout en haut
    g.fillStyle(0x546e7a); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8, SH - 4, i * 8 + 4, 2, i * 8 + 8, SH - 4)
    // arête claire (relief métallique) sur toute la hauteur
    g.fillStyle(0xb0bec5); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8 + 2.4, SH - 4, i * 8 + 4, 5, i * 8 + 5.6, SH - 4)
    // extrémité ROUGE vif (danger) sur le tiers supérieur de chaque pointe
    g.fillStyle(0xff1744); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8 + 1.2, SH * 0.4, i * 8 + 4, 2, i * 8 + 6.8, SH * 0.4)
    g.fillStyle(0xff8a80); for (let i = 0; i < 4; i++) g.fillTriangle(i * 8 + 2.8, SH * 0.26, i * 8 + 4, 2, i * 8 + 5.2, SH * 0.26) // éclat sur la pointe
    // socle rocheux sombre au pied des pointes
    g.fillStyle(0x37474f).fillRect(0, SH - 8, 32, 8)
    g.fillStyle(0x263238).fillRect(0, SH - 3, 32, 3)
    g.generateTexture('spikes', 32, SH); g.clear()
    // eau (zone nageable, translucide : on voit le panda dedans)
    g.fillStyle(0x1e88e5, 0.38).fillRect(0, 0, 32, 32)
    g.fillStyle(0x64b5f6, 0.45).fillRect(0, 0, 32, 5)
    g.fillStyle(0xbbdefb, 0.35).fillRect(4, 12, 8, 2).fillRect(18, 22, 9, 2); g.generateTexture('water', 32, 32); g.clear()
    // basin-wall : PAROI ROCHEUSE rigide des bassins (cuve d'eau contenue). Bloc de pierre sombre
    // tuilable verticalement, arêtes marquées + mousse humide → lit tout de suite comme un mur de
    // puits/citerne qui retient l'eau. 32×32, corps de collision géré à part (rectangle par paroi).
    g.fillStyle(0x37474f).fillRect(0, 0, 32, 32) // fond pierre
    g.fillStyle(0x455a64).fillRect(2, 2, 28, 12).fillRect(2, 18, 28, 12) // deux assises de blocs
    g.fillStyle(0x263238).fillRect(0, 14, 32, 2).fillRect(0, 30, 32, 2) // joints horizontaux sombres
    g.fillStyle(0x263238).fillRect(15, 0, 2, 14).fillRect(7, 18, 2, 12).fillRect(23, 18, 2, 12) // joints verticaux
    g.fillStyle(0x546e7a, 0.6).fillRect(3, 3, 24, 2).fillRect(3, 19, 24, 2) // reflet clair sur l'assise
    g.fillStyle(0x33691e, 0.5).fillEllipse(8, 4, 10, 4).fillEllipse(25, 20, 9, 4) // mousse humide
    g.generateTexture('basin-wall', 32, 32); g.clear()
    // waterfall : CASCADE tuilable verticalement — rideau d'eau translucide, stries claires
    // d'écoulement + écume. Le rendu la fait défiler vers le bas (tilePositionY) pour l'effet de chute.
    g.fillStyle(0x1e88e5, 0.34).fillRect(0, 0, 32, 32)
    g.fillStyle(0x64b5f6, 0.42).fillRect(3, 0, 5, 32).fillRect(13, 0, 6, 32).fillRect(24, 0, 4, 32) // colonnes d'eau
    g.fillStyle(0xe3f2fd, 0.55).fillRect(4, 0, 2, 32).fillRect(15, 0, 2, 32).fillRect(25, 0, 1, 32) // stries vives
    g.fillStyle(0xffffff, 0.35).fillEllipse(6, 8, 4, 3).fillEllipse(17, 22, 5, 3).fillEllipse(26, 14, 3, 2) // écume
    g.generateTexture('waterfall', 32, 32); g.clear()
    // waterfall-source : rebord rocheux d'où jaillit la cascade (posé au sommet de la chute)
    g.fillStyle(0x4e342e).fillRoundedRect(0, 6, 64, 18, 5) // roche
    g.fillStyle(0x6d4c41).fillRoundedRect(2, 6, 60, 10, 4)
    g.fillStyle(0x33691e, 0.7).fillEllipse(14, 8, 20, 6).fillEllipse(46, 8, 22, 6) // mousse au bord
    g.fillStyle(0x64b5f6, 0.5).fillRect(20, 16, 24, 8) // nappe qui déborde
    g.fillStyle(0xe3f2fd, 0.6).fillRect(22, 16, 20, 3)
    g.generateTexture('waterfall-source', 64, 30); g.clear()
    // ─── Déco de FOND de bassin (légère, sans physique, depth arrière) ─────────────────
    // deco-pebble : amas de galets ronds au fond de l'eau
    g.fillStyle(0x546e7a).fillEllipse(7, 8, 12, 8).fillEllipse(18, 9, 11, 7).fillEllipse(27, 8, 9, 6)
    g.fillStyle(0x78909c).fillEllipse(7, 7, 8, 5).fillEllipse(18, 8, 7, 4).fillEllipse(27, 7, 6, 4)
    g.fillStyle(0x90a4ae, 0.8).fillEllipse(6, 6, 3, 2).fillEllipse(17, 7, 3, 2) // reflets
    g.generateTexture('deco-pebble', 34, 16); g.clear()
    // deco-algae : touffe d'algues vertes ondulantes
    g.fillStyle(0x2e7d32).fillRect(4, 6, 3, 22).fillRect(9, 2, 3, 26).fillRect(14, 8, 3, 20)
    g.fillStyle(0x43a047).fillRect(4, 6, 1, 22).fillRect(9, 2, 1, 26).fillRect(14, 8, 1, 20)
    g.fillStyle(0x66bb6a, 0.8).fillEllipse(10, 3, 5, 3) // pointe claire
    g.generateTexture('deco-algae', 20, 30); g.clear()
    // deco-shell : petit coquillage en éventail
    g.fillStyle(0xffab91).fillEllipse(8, 11, 16, 12)
    g.fillStyle(0xffccbc).fillEllipse(8, 11, 12, 9)
    g.lineStyle(1, 0xbf6a52, 0.8); g.beginPath(); g.moveTo(8, 11); g.lineTo(2, 3); g.moveTo(8, 11); g.lineTo(8, 1); g.moveTo(8, 11); g.lineTo(14, 3); g.strokePath()
    g.generateTexture('deco-shell', 18, 16); g.clear()
    // deco-coral : petit corail/racine rouge (variété de fond)
    g.fillStyle(0xc62828).fillRect(7, 8, 3, 16)
    g.fillStyle(0xe53935).fillRect(3, 12, 3, 12).fillRect(11, 10, 3, 14)
    g.fillStyle(0xff8a80, 0.8).fillCircle(8, 7, 3).fillCircle(4, 12, 2).fillCircle(13, 10, 2)
    g.generateTexture('deco-coral', 18, 26); g.clear()
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
    // épée (icône d'attaque claire) : lame acier diagonale + garde dorée + manche brun
    g.fillStyle(0xdfe6ee).fillTriangle(11, 22, 25, 5, 28, 8).fillTriangle(11, 22, 14, 25, 28, 8)
    g.fillStyle(0xffffff).fillTriangle(24, 4, 29, 9, 27, 3)
    g.lineStyle(4, 0xffca28).beginPath(); g.moveTo(7, 16); g.lineTo(16, 25); g.strokePath()
    g.lineStyle(5, 0x8d5a2b).beginPath(); g.moveTo(12, 21); g.lineTo(6, 27); g.strokePath()
    g.fillStyle(0xffca28).fillCircle(5, 28, 2); g.generateTexture('ui-attack', 32, 32); g.clear()
    g.lineStyle(4, 0xffffff).beginPath(); g.moveTo(6, 19); g.lineTo(16, 9); g.lineTo(26, 19); g.moveTo(6, 26); g.lineTo(16, 16); g.lineTo(26, 26); g.strokePath(); g.generateTexture('ui-jump', 32, 32); g.clear()
    // repli procédural : uniquement si l'illustration art/potion-drop.png n'a pas pu être bakée
    if (!this.textures.exists('potion-drop')) {
      g.fillStyle(0xb71c1c).fillRoundedRect(0, 4, 16, 12, 4)
      g.fillStyle(0xef5350).fillRoundedRect(1, 5, 14, 8, 3)
      g.fillStyle(0xffffff).fillRect(6, 0, 4, 6); g.generateTexture('potion-drop', 16, 16); g.clear()
    }
    // pièce d'or : art illustré (art/coin.png) si présent, sinon pastille procédurale (repli)
    if (this.textures.exists('art-coin')) this.bakeCropped('art-coin', 'coin')
    else { g.fillStyle(0xb8860b).fillCircle(6, 6, 6); g.fillStyle(0xffd700).fillCircle(6, 6, 5); g.fillStyle(0xfff59d).fillCircle(4, 4, 1); g.generateTexture('coin', 12, 12) }
    g.clear()
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
