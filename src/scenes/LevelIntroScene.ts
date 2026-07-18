import Phaser from 'phaser'
import { LEVELS } from '../data/levels'
import { MONSTERS } from '../data/monsters'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import { audio } from '../audio/audio-engine'
import type { DropEntry, MonsterDef } from '../core/types'

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
  if (m.mvp) return { label: 'MVP', color: 0xffd54f }
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

  create() {
    const level = LEVELS[this.intro.levelId]
    this.add.rectangle(480, 270, 960, 540, 0x10151f, 1)

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

    const areaLeft = 40, areaTop = 100, areaW = 880, areaH = 384
    const cellW = areaW / cols
    const cellH = areaH / rows
    const cardW = cellW - 14
    const cardH = cellH - 14

    // Nombre de lignes de butin qui tiennent dans la carte (au-dessus : sprite + nom + badge).
    const headerH = 96
    const lineH = 17
    const maxLines = Math.max(1, Math.floor((cardH - headerH) / lineH))

    monsters.forEach((m, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = areaLeft + col * cellW + cellW / 2
      const top = areaTop + row * cellH + 7

      const g = this.add.graphics()
      g.fillStyle(0x000000, 0.32).fillRoundedRect(cx - cardW / 2, top, cardW, cardH, 8)
      g.lineStyle(1, 0xffffff, 0.14).strokeRoundedRect(cx - cardW / 2, top, cardW, cardH, 8)

      this.add.image(cx, top + 32, `monster-${m.id}`).setDisplaySize(46, 46)
      // plaque « Nv X » en coin de carte (couleur selon boss / MVP / normal)
      const nvColor = m.boss ? '#ff5252' : m.mvp ? '#ffd54f' : '#ffffff'
      this.add.text(cx - cardW / 2 + 8, top + 8, `Nv ${m.level}`, { fontSize: '11px', color: nvColor, fontStyle: 'bold' }).setOrigin(0, 0)
      this.add.text(cx, top + 58, m.name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 12 } }).setOrigin(0.5, 0)
      const kind = monsterKind(m)
      this.add.text(cx, top + 78, kind.label, { fontSize: '10px', color: '#0d1b2a', backgroundColor: css(kind.color), fontStyle: 'bold', padding: { x: 5, y: 2 } }).setOrigin(0.5, 0)

      // Butins notables : objets + matériaux (l'or/potions, communs à tous, sont omis).
      const notable = m.drops.filter((d) => d.kind === 'item' || d.kind === 'material')
      const listLeft = cx - cardW / 2 + 10
      let y = top + headerH
      if (notable.length === 0) {
        this.add.text(cx, y, 'Butin courant (or, potions)', { fontSize: '11px', color: '#78909c', fontStyle: 'italic', align: 'center', wordWrap: { width: cardW - 16 } }).setOrigin(0.5, 0)
      } else {
        const shown = notable.slice(0, maxLines)
        shown.forEach((d) => {
          const { label, color, chance } = dropLine(d)
          this.add.circle(listLeft + 3, y + 6, 3, color)
          this.add.text(listLeft + 12, y, label, { fontSize: '11px', color: css(color), wordWrap: { width: cardW - 60 } }).setOrigin(0, 0)
          this.add.text(cx + cardW / 2 - 10, y, chance, { fontSize: '10px', color: '#ffd54f' }).setOrigin(1, 0)
          y += lineH
        })
        const hidden = notable.length - shown.length
        if (hidden > 0) this.add.text(listLeft + 12, y, `+${hidden} autre${hidden > 1 ? 's' : ''}…`, { fontSize: '10px', color: '#78909c' }).setOrigin(0, 0)
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
