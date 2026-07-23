import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import { getPlayer } from '../state'
import type { DropEntry, MonsterDef } from '../core/types'
import { playerXpForMobLevel } from '../core/progression'
import { SKILLS } from '../data/skills'
import { BD, truncate } from './bestiary-layout'

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
  if (m.mvp) return { label: 'ÉLITE', color: 0xffd54f }
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

// Teinte de silhouette pour un monstre non découvert (sprite assombri en ombre).
const SILHOUETTE_TINT = 0x101820

export class BestiaryScene extends Phaser.Scene {
  private page = 0
  private kills: Record<string, number> = {}

  constructor() { super('Bestiary') }

  create() {
    // lecture seule du suivi de kills ; robuste si aucun joueur n'est chargé
    try { this.kills = getPlayer().killsByMonster ?? {} } catch { this.kills = {} }
    this.renderList()
  }

  // Un monstre est « découvert » (révélé) dès qu'il a été tué au moins une fois.
  private discovered(m: MonsterDef): boolean {
    return (this.kills[m.id] ?? 0) > 0
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
    // monstre non découvert : badge neutre masqué (ne révèle pas boss/élite)
    if (!this.discovered(m)) {
      return this.add.text(x, y, '???', { fontSize, color: '#cfd8dc', backgroundColor: css(0x455a64), fontStyle: 'bold', padding: { x: 5, y: 2 } })
        .setOrigin(0.5)
    }
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

      const seen = this.discovered(m)
      this.add.rectangle(cx, cy, cellW - 8, cellH - 8, 0x000000, 0.3).setStrokeStyle(1, 0xffffff, 0.15)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.renderDetail(m))
      const sprite = this.add.image(cx, cy - 18, `monster-${m.id}`).setDisplaySize(40, 40)
      if (!seen) sprite.setTint(SILHOUETTE_TINT).setAlpha(0.85) // silhouette sombre tant que pas tué
      this.add.text(cx, cy + 18, seen ? m.name : '???', { fontSize: '12px', color: seen ? '#ffffff' : '#78909c', align: 'center', wordWrap: { width: cellW - 14 } }).setOrigin(0.5, 0)
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

  // Texture d'icône d'un butin (vraie image, plus de rond coloré) + teinte de repli éventuelle.
  private lootIcon(d: DropEntry): { key: string; tint?: number } {
    if (d.kind === 'gold') return { key: 'coin' }
    if (d.kind === 'potion') return { key: 'potion-drop' }
    if (d.kind === 'item') {
      const k = d.itemId && this.textures.exists(`item-${d.itemId}`) ? `item-${d.itemId}` : 'item-drop'
      return { key: k }
    }
    if (d.materialId && this.textures.exists(`material-${d.materialId}`)) return { key: `material-${d.materialId}` }
    return { key: 'material-drop', tint: d.materialId ? MATERIALS[d.materialId]?.color : 0xffffff }
  }

  // Carte de la grille (icône + titre + sous-titre) — brique commune Compétences / Butin.
  private gridCard(x: number, y: number, w: number, h: number, iconKey: string, tint: number | undefined, title: string, titleColor: number, sub: string, subColor: string) {
    this.add.rectangle(x, y, w, h, 0x000000, 0.32).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.12)
    if (this.textures.exists(iconKey)) {
      const img = this.add.image(x + 6, y, iconKey).setOrigin(0, 0.5).setDisplaySize(h - 12, h - 12)
      if (tint !== undefined) img.setTint(tint)
    }
    const tx = x + h + 2
    this.add.text(tx, y - (sub ? 9 : 7), title, { fontSize: '14px', color: css(titleColor), fontStyle: 'bold', wordWrap: { width: w - h - 10 } }).setOrigin(0, 0.5)
    if (sub) this.add.text(tx, y + 9, sub, { fontSize: '11px', color: subColor, wordWrap: { width: w - h - 10 } }).setOrigin(0, 0.5)
  }

  private renderDetail(m: MonsterDef) {
    this.clear()
    const seen = this.discovered(m)
    const { label: kindLabel } = monsterKind(m)

    // ── COLONNE GAUCHE : portrait + identité + stats compactes ──
    const big = this.add.image(158, 138, `monster-${m.id}`).setDisplaySize(150, 150)
    if (!seen) big.setTint(SILHOUETTE_TINT).setAlpha(0.85)
    this.add.text(158, 224, seen ? m.name : '???', { fontSize: '26px', color: seen ? '#ffffff' : '#78909c', fontStyle: 'bold', align: 'center', wordWrap: { width: 290 } }).setOrigin(0.5, 0)
    this.badge(158, 262, m, '14px')
    if (seen) {
      this.add.text(158, 286, m.lore, { fontSize: '12px', color: '#cfd8dc', align: 'center', fontStyle: 'italic', wordWrap: { width: 292 }, lineSpacing: 2 }).setOrigin(0.5, 0)
      // stats compactes (2 par ligne) + kills
      const stats: [string, string][] = [
        ['Niveau', `${m.level}`], ['XP', `${playerXpForMobLevel(m.level)}`],
        ['PV', `${m.hp}`], ['ATK', `${m.atk}`],
        ['DEF', `${m.def}`], ['Type', kindLabel],
      ]
      stats.forEach(([k, v], i) => {
        const sx = 30 + (i % 2) * 150, sy = 386 + Math.floor(i / 2) * 24
        this.add.text(sx, sy, k, { fontSize: '13px', color: '#78909c' })
        this.add.text(sx + 132, sy, v, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(1, 0)
      })
      this.add.text(158, 464, `${behaviorLabel(m)} · vaincu ${this.kills[m.id]}×`, { fontSize: '12px', color: '#80cbc4', align: 'center' }).setOrigin(0.5, 0)
    } else {
      this.add.text(158, 292, 'Monstre non découvert.\nVaincs-le pour révéler sa fiche.', { fontSize: '13px', color: '#78909c', align: 'center', fontStyle: 'italic', wordWrap: { width: 292 }, lineSpacing: 2 }).setOrigin(0.5, 0)
    }

    // ── COLONNE DROITE : Compétences (si le mob en a) puis Butin, en GRILLE 2 colonnes ──
    const colX = (c: number) => BD.X0 + c * (BD.COLW + BD.GAP)
    let y = BD.top

    if (!seen) {
      this.add.text(BD.X0, y, 'Fiche verrouillée', { fontSize: '16px', color: '#607d8b', fontStyle: 'bold' })
    } else {
      // COMPÉTENCES
      const skills = (m.skills ?? []).map((sid) => SKILLS[sid]).filter((s): s is NonNullable<typeof s> => !!s)
      if (skills.length) {
        this.add.text(BD.X0, y, 'COMPÉTENCES', { fontSize: '16px', color: '#80cbc4', fontStyle: 'bold' }); y += BD.titleGap
        const rowH = m.boss ? BD.skillRowHBoss : BD.skillRowH
        skills.forEach((sk, i) => {
          const c = i % 2, r = Math.floor(i / 2)
          // description TRONQUÉE (boss only) → ne déborde jamais de la carte (retour user : « trop de trucs »).
          this.gridCard(colX(c), y + r * (rowH + BD.rowGap) + rowH / 2, BD.COLW, rowH, `skill-${sk.id}`, undefined, sk.name, 0xffffff, m.boss ? truncate(sk.description, BD.descMax) : '', '#b0bec5')
        })
        y += Math.ceil(skills.length / 2) * (rowH + BD.rowGap) + BD.sectionGap
      }

      // BUTIN
      this.add.text(BD.X0, y, 'BUTIN', { fontSize: '16px', color: '#80cbc4', fontStyle: 'bold' }); y += BD.titleGap
      const rowH = BD.butinRowH
      m.drops.forEach((d, i) => {
        const c = i % 2, r = Math.floor(i / 2)
        const { label, color } = dropLine(d)
        const { key, tint } = this.lootIcon(d)
        const chance = `${+(d.chance * 100).toFixed(1)}%`
        const qty = d.min === d.max ? `×${d.min}` : `×${d.min}–${d.max}`
        this.gridCard(colX(c), y + r * (rowH + BD.rowGap) + rowH / 2, BD.COLW, rowH, key, tint, label, color, `${chance}  ${qty}`, '#ffd54f')
      })
    }

    // Boutons
    this.btn(360, 512, '◀ Retour', 0x37474f, () => this.renderList())
    this.btn(600, 512, '✕ Fermer', 0x8e2f2f, () => this.scene.start('Menu'))
  }
}
