import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import type { DropEntry, MonsterDef } from '../core/types'

// Bestiaire — page en lecture seule listant tous les monstres, leurs stats et leur table de drop.
// Aucune écriture dans la sauvegarde ni dans les données du jeu.
const MONSTER_LIST: MonsterDef[] = Object.values(MONSTERS)

const BEHAVIOR_LABELS: Record<MonsterDef['behavior'], string> = {
  contact: 'Contact',
  projectile: 'À distance',
  charge: 'Charge',
  caster: 'Lanceur de sorts',
}

const PER_PAGE = 24 // 6 colonnes × 4 rangées
const COLS = 6
const ROWS = 4

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`

// Type d'un monstre pour l'affichage : badge et couleur.
function monsterKind(m: MonsterDef): { label: string; color: number } {
  if (m.boss) return { label: 'BOSS', color: 0xff5252 }
  if (m.mvp) return { label: 'MVP', color: 0xffd54f }
  return { label: 'Normal', color: 0x90a4ae }
}

// Libellé du comportement en clair (+ note "immobile" quand la vitesse est nulle).
function behaviorLabel(m: MonsterDef): string {
  const base = BEHAVIOR_LABELS[m.behavior]
  return m.speed === 0 ? `${base} · immobile` : base
}

// Une ligne de butin : libellé, couleur, pourcentage de chance, quantité.
function dropLine(d: DropEntry): { label: string; color: number; chance: string; qty: string } {
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
  const chance = `${+(d.chance * 100).toFixed(1)}%`
  const qty = d.min === d.max ? `×${d.min}` : `×${d.min}–${d.max}`
  return { label, color, chance, qty }
}

export class BestiaryScene extends Phaser.Scene {
  private page = 0

  constructor() { super('Bestiary') }

  create() {
    this.renderList()
  }

  private clear() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a, 0.97)
  }

  private btn(x: number, y: number, label: string, bg: number, onTap: () => void) {
    return this.add.text(x, y, label, { fontSize: '16px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 12, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  }

  private badge(x: number, y: number, m: MonsterDef, fontSize: string) {
    const { label, color } = monsterKind(m)
    return this.add.text(x, y, label, { fontSize, color: '#0d1b2a', backgroundColor: css(color), fontStyle: 'bold', padding: { x: 5, y: 2 } })
      .setOrigin(0.5)
  }

  private renderList() {
    this.clear()
    const pages = Math.ceil(MONSTER_LIST.length / PER_PAGE)
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1)

    this.add.text(480, 24, 'Bestiaire', { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 52, `${MONSTER_LIST.length} monstres — tape un monstre pour son butin`, { fontSize: '13px', color: '#b0bec5' }).setOrigin(0.5)

    const start = this.page * PER_PAGE
    const slice = MONSTER_LIST.slice(start, start + PER_PAGE)
    const cellW = 150
    const cellH = 96
    const gridLeft = 105
    const gridTop = 108

    slice.forEach((m, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const cx = gridLeft + col * cellW
      const cy = gridTop + row * cellH

      this.add.rectangle(cx, cy, cellW - 8, cellH - 8, 0x000000, 0.3).setStrokeStyle(1, 0xffffff, 0.15)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.renderDetail(m))
      this.add.image(cx, cy - 18, `monster-${m.id}`).setDisplaySize(40, 40)
      this.add.text(cx, cy + 18, m.name, { fontSize: '12px', color: '#ffffff', align: 'center', wordWrap: { width: cellW - 14 } }).setOrigin(0.5, 0)
      this.badge(cx, cy - 40, m, '10px')
    })

    // Navigation de page
    if (pages > 1) {
      if (this.page > 0) this.btn(360, 508, '◀ Préc.', 0x37474f, () => { this.page--; this.renderList() })
      this.add.text(480, 508, `Page ${this.page + 1}/${pages}`, { fontSize: '14px', color: '#b0bec5' }).setOrigin(0.5)
      if (this.page < pages - 1) this.btn(600, 508, 'Suiv. ▶', 0x37474f, () => { this.page++; this.renderList() })
    }

    this.btn(60, 24, '✕ Fermer', 0x8e2f2f, () => this.scene.start('Menu'))
  }

  private renderDetail(m: MonsterDef) {
    this.clear()
    const { label: kindLabel } = monsterKind(m)

    // Colonne gauche : gros sprite, nom, type
    this.add.image(160, 175, `monster-${m.id}`).setDisplaySize(130, 130)
    this.add.text(160, 265, m.name, { fontSize: '26px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0)
    this.badge(160, 330, m, '15px')

    // Stats
    this.add.text(360, 70, 'CARACTÉRISTIQUES', { fontSize: '16px', color: '#80cbc4', fontStyle: 'bold' })
    const rows: [string, string][] = [
      ['Type', kindLabel],
      ['PV', `${m.hp}`],
      ['ATK', `${m.atk}`],
      ['DEF', `${m.def}`],
      ['XP', `${m.xp}`],
      ['Comportement', behaviorLabel(m)],
    ]
    rows.forEach(([k, v], i) => {
      const y = 104 + i * 30
      this.add.text(360, y, k, { fontSize: '15px', color: '#b0bec5' })
      this.add.text(560, y, v, { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
    })

    // Table de butin
    this.add.text(650, 70, 'BUTIN', { fontSize: '16px', color: '#80cbc4', fontStyle: 'bold' })
    m.drops.forEach((d, i) => {
      const { label, color, chance, qty } = dropLine(d)
      const y = 104 + i * 28
      this.add.circle(658, y + 9, 5, color)
      this.add.text(672, y, label, { fontSize: '14px', color: css(color), wordWrap: { width: 180 } })
      this.add.text(860, y, chance, { fontSize: '13px', color: '#ffd54f' })
      this.add.text(915, y, qty, { fontSize: '13px', color: '#cfd8dc' }).setOrigin(1, 0)
    })

    // Boutons
    this.btn(360, 508, '◀ Retour', 0x37474f, () => this.renderList())
    this.btn(600, 508, '✕ Fermer', 0x8e2f2f, () => this.scene.start('Menu'))
  }
}
