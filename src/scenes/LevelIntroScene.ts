import Phaser from 'phaser'
import { LEVELS } from '../data/levels'
import { MONSTERS } from '../data/monsters'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import { SKILLS } from '../data/skills'
import { audio } from '../audio/audio-engine'
import type { DropEntry, MonsterDef } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'

// Écran de présentation d'un NOUVEAU terrain : montré une seule fois par levelId (la première
// entrée), il présente les monstres uniques du niveau et leurs loots notables avant de lancer
// le jeu. Reçoit les mêmes données que la scène 'Level' et les lui transmet à l'identique.
interface IntroData {
  levelId: string
  fromNode: string
  targetNode: string
  dir: 'forward' | 'backward'
}

const SEEN_KEY = 'panda-run:vus'

// Marque un levelId comme déjà vu (persistant). Silencieux si localStorage est inaccessible.
export function markLevelSeen(levelId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
    seen.add(levelId)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch { /* localStorage inaccessible : on n'empêche pas de jouer */ }
}

// Vrai si ce levelId a déjà été introduit (donc pas de re-présentation).
export function isLevelSeen(levelId: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return seen.includes(levelId)
  } catch { return false }
}

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`

function monsterKind(m: MonsterDef): { label: string; color: number } {
  if (m.boss) return { label: 'BOSS', color: 0xff5252 }
  if (m.mvp) return { label: 'ÉLITE', color: 0xffd54f }
  return { label: 'Normal', color: 0x90a4ae }
}

// Une ligne de butin : libellé coloré + pourcentage de chance. Même logique d'affichage que
// le Bestiaire (Or/Potion/objet coloré par rareté/matériau coloré).
function dropLine(d: DropEntry): { label: string; color: number; chance: string } {
  let label = ''
  let color = 0xffffff
  if (d.kind === 'gold') { label = 'Or'; color = 0xffd700 }
  else if (d.kind === 'potion') { label = 'Potion'; color = 0xff6f91 }
  else if (d.kind === 'item') {
    const item = d.itemId ? ITEMS[d.itemId] : undefined
    label = item ? item.name : d.itemId ?? 'Objet'
    color = rarityColor(item?.rarity)
  } else {
    const mat = d.materialId ? MATERIALS[d.materialId] : undefined
    label = mat ? mat.name : d.materialId ?? 'Matériau'
    color = mat ? mat.color : 0xffffff
  }
  return { label, color, chance: `${+(d.chance * 100).toFixed(1)}%` }
}

export class LevelIntroScene extends Phaser.Scene {
  private intro!: IntroData

  constructor() { super('LevelIntro') }

  init(data: IntroData) {
    this.intro = data
  }

  // Icône d'un butin (aperçu de carte) : texture à afficher + teinte éventuelle. Objet illustré →
  // item-<id> ; chapeau sans illustration → cosmetic-<id> (procédural) ; matériau → material-drop
  // teinté de sa couleur ; repli générique item-drop.
  private dropIconInfo(d: DropEntry): { texture: string; tint?: number } {
    if (d.kind === 'gold') return { texture: this.textures.exists('art-coin') ? 'art-coin' : 'coin' }
    if (d.kind === 'potion') return { texture: 'potion-drop' }
    if (d.kind === 'item') {
      const id = d.itemId
      if (id && this.textures.exists(`item-${id}`)) return { texture: `item-${id}` }
      if (id && this.textures.exists(`cosmetic-${id}`)) return { texture: `cosmetic-${id}` }
      return { texture: 'item-drop' }
    }
    // ⚠️ LA VRAIE ICÔNE DE MATÉRIAU D'ABORD. Cet écran sautait directement à la pastille générique
    // `material-drop` teintée alors que `material-<id>` est dessinée au chargement pour CHAQUE
    // matériau (PreloadScene) — d'où les « vieux cercles de couleurs » signalés. Le bestiaire, lui,
    // utilisait déjà la bonne clé : c'était une incohérence entre les deux écrans, pas un asset absent.
    if (d.materialId && this.textures.exists(`material-${d.materialId}`)) return { texture: `material-${d.materialId}` }
    const mat = d.materialId ? MATERIALS[d.materialId] : undefined
    return { texture: 'material-drop', tint: mat?.color }
  }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    const level = LEVELS[this.intro.levelId]
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x10151f, 1)

    // Bandeau titre
    this.add.text(480, 30, 'Nouveau terrain', { fontSize: '16px', color: '#80cbc4', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 58, level?.name ?? this.intro.levelId, { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    const monsters = this.uniqueMonsters(level)
    if (monsters.length === 0) {
      this.add.text(480, 260, 'Aucun monstre répertorié.', { fontSize: '18px', color: '#b0bec5' }).setOrigin(0.5)
    } else {
      this.add.text(480, 84, 'Monstres du niveau et butins', { fontSize: '13px', color: '#b0bec5' }).setOrigin(0.5)
      this.renderGrid(monsters)
    }

    this.startButton()
  }

  // Monstres UNIQUES du niveau : dérivés des spawns (dédup, ordre préservé) + le boss en dernier.
  private uniqueMonsters(level: typeof LEVELS[string] | undefined): MonsterDef[] {
    const ids: string[] = []
    for (const s of level?.spawns ?? []) if (!ids.includes(s.monsterId)) ids.push(s.monsterId)
    if (level?.boss && !ids.includes(level.boss)) ids.push(level.boss)
    return ids.map((id) => MONSTERS[id]).filter((m): m is MonsterDef => !!m)
  }

  private renderGrid(monsters: MonsterDef[]) {
    const n = monsters.length
    const cols = n <= 4 ? n : n <= 6 ? 3 : 4
    const rows = Math.ceil(n / cols)

    // on exploite la largeur réelle de l'écran : les cartes respirent au lieu d'être tassées dans 880
    const areaW = Math.min(VIEW_W - 60, 1340)
    const areaLeft = 480 - areaW / 2
    const areaTop = 100, areaH = 384
    const cellW = areaW / cols
    const cellH = areaH / rows
    const cardW = cellW - 14
    const cardH = cellH - 14

    // TOUT le butin doit tenir : on ne tronque PLUS avec un « +1 autre… » (retour user : « le (1 et
    // autre pour les drop) c'est nul »). On calcule donc la hauteur de ligne pour que le monstre le
    // plus chargé du terrain rentre entièrement, bornée pour rester lisible.
    const headerH = 92
    const maxDrops = Math.max(1, ...monsters.map((mm) => mm.drops.length))
    const lineH = Math.max(11, Math.min(17, Math.floor((cardH - headerH - 4) / maxDrops)))

    monsters.forEach((m, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = areaLeft + col * cellW + cellW / 2
      const top = areaTop + row * cellH + 7

      const g = this.add.graphics()
      g.fillStyle(0x000000, 0.32).fillRoundedRect(cx - cardW / 2, top, cardW, cardH, 8)
      g.lineStyle(1, 0xffffff, 0.14).strokeRoundedRect(cx - cardW / 2, top, cardW, cardH, 8)

      this.add.image(cx, top + 28, `monster-${m.id}`).setDisplaySize(44, 44)
      // plaque « Nv X » en coin de carte (couleur selon boss / MVP / normal)
      const nvColor = m.boss ? '#ff5252' : m.mvp ? '#ffd54f' : '#ffffff'
      this.add.text(cx - cardW / 2 + 8, top + 8, `Nv ${m.level}`, { fontSize: '11px', color: nvColor, fontStyle: 'bold' }).setOrigin(0, 0)
      // badge ÉLITE/BOSS AU-DESSUS du nom (retour user : « trop de trucs entre le badge, les loots et
      // les skills ») — et SEULEMENT pour les élites/boss (les mobs normaux n'affichent aucun badge,
      // ça dégage la carte). Puis le nom, puis loots, puis compétences : lecture verticale claire.
      if (m.boss || m.mvp) {
        const kind = monsterKind(m)
        this.add.text(cx, top + 52, kind.label, { fontSize: '10px', color: '#0d1b2a', backgroundColor: css(kind.color), fontStyle: 'bold', padding: { x: 5, y: 1 } }).setOrigin(0.5, 0)
      }
      this.add.text(cx, top + 66, m.name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 12 } }).setOrigin(0.5, 0)

      // BUTIN COMPLET, avec NOM et PROBA. Avant, l'or et les potions étaient OMIS (« communs à
      // tous ») et seule l'icône + la chance s'affichaient, sans nom. Or leur probabilité DIFFÈRE
      // d'un monstre à l'autre — retour user : « quand y a or et tout tu le mets, proba pour l'or,
      // proba pour les potions, personne a le même ». On trie objets/matériaux d'abord (le butin
      // rare, celui qu'on cherche), puis or et potions.
      const rank = (d: DropEntry) => (d.kind === 'item' ? 0 : d.kind === 'material' ? 1 : d.kind === 'gold' ? 2 : 3)
      const allDrops = [...m.drops].sort((a, b) => rank(a) - rank(b))
      const listLeft = cx - cardW / 2 + 8
      let y = top + headerH
      allDrops.forEach((d) => {
        const { color, chance, label } = dropLine(d)
        const info = this.dropIconInfo(d)
        const size = Math.min(20, lineH - 2)
        const fs = `${Math.max(8, Math.min(10, lineH - 6))}px`
        this.add.rectangle(listLeft, y + 1, size + 2, size + 2, color, 0.28).setOrigin(0, 0)
        const img = this.add.image(listLeft + 1, y + 2, info.texture).setOrigin(0, 0).setDisplaySize(size, size)
        if (info.tint !== undefined) img.setTint(info.tint)
        // la proba est ancrée à DROITE, le nom occupe la place restante et se fait tronquer : ainsi la
        // proba reste toujours lisible, quelle que soit la longueur du nom
        const chanceTxt = this.add.text(cx + cardW / 2 - 8, y + size / 2, chance, {
          fontSize: fs, color: '#ffd54f', fontStyle: 'bold',
        }).setOrigin(1, 0.5)
        const nameW = cardW - 22 - size - chanceTxt.width
        this.add.text(listLeft + size + 5, y + size / 2, label, {
          fontSize: fs, color: css(color), wordWrap: { width: Math.max(24, nameW) }, maxLines: 1,
        }).setOrigin(0, 0.5)
        y += lineH
      })

      // COMPÉTENCES (seulement pour les mobs qui EN ONT : boss/élites) : rangée d'icônes skill + petit
      // nom dessous, en bas de la carte → contexte immédiat sur ce que fait le monstre.
      if (m.skills?.length) {
        const sy = top + cardH - 26
        const gap = 34
        let sx = cx - (m.skills.length - 1) * gap / 2
        for (const sid of m.skills) {
          const sk = SKILLS[sid]
          if (!sk) continue
          if (this.textures.exists(`skill-${sid}`)) this.add.image(sx, sy, `skill-${sid}`).setOrigin(0.5).setDisplaySize(20, 20)
          this.add.text(sx, sy + 12, sk.name, { fontSize: '8px', color: '#cfd8dc', align: 'center', wordWrap: { width: gap - 1 }, lineSpacing: 0 }).setOrigin(0.5, 0)
          sx += gap
        }
      }
    })
  }

  // Bouton « Commencer ! » : marque le niveau comme vu puis lance la partie avec les mêmes data.
  private startButton() {
    const w = 260, h = 52
    const c = this.add.container(480, 512)
    const bg = this.add.graphics()
    const paint = (fill: number, line: number) => {
      bg.clear()
      bg.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 12)
      bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12)
      bg.lineStyle(3, line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
    }
    paint(0x2e7d32, 0xa5d6a7)
    const t = this.add.text(0, 0, 'Commencer !', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    c.add([bg, t])
    c.setSize(w, h).setInteractive({ useHandCursor: true })
    c.on('pointerover', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.05) })
    c.on('pointerout', () => { paint(0x2e7d32, 0xa5d6a7); c.setScale(1) })
    c.on('pointerdown', () => {
      audio.playSfx('ui-tap')
      markLevelSeen(this.intro.levelId)
      this.scene.start('Level', this.intro)
    })
  }
}
