import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf } from '../data/skills'
import { ITEMS } from '../data/items'
import { MATERIALS } from '../data/materials'
import type { EquipSlot } from '../core/types'
import { computeStats } from '../core/stats'
import { MAX_SKILL_RANK } from '../core/player-state'

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'accessory']
const SLOT_LABELS: Record<EquipSlot, string> = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire' }

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu') }

  create() {
    this.render()
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, 960, 540, 0x1b2631, 0.95)
    const p = getPlayer()
    const stats = computeStats(p)
    this.add.text(30, 20, `${p.name} — Nv ${p.level} — ATK ${stats.atk} / DEF ${stats.def} / PV ${stats.maxHp}`, { fontSize: '18px', color: '#ffffff' })
    this.add.text(30, 50, `Points de skill : ${p.skillPoints}`, { fontSize: '16px', color: '#ffd700' })

    // Colonne skills : rang (points investis), équiper/retirer
    this.add.text(30, 85, 'SKILLS', { fontSize: '18px', color: '#80cbc4' })
    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '13px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 6, y: 3 } })
        .setInteractive().on('pointerdown', onTap)

    skillsOf(p.classId).forEach((s, i) => {
      const y = 110 + i * 50
      const rank = p.skillLevels[s.id] ?? 0
      const unlocked = rank > 0
      const equippedAt = p.equippedSkills.indexOf(s.id)
      const icon = this.add.image(40, y + 10, `skill-${s.id}`).setDisplaySize(34, 34)
      if (!unlocked) icon.setAlpha(0.35)
      const rankTxt = unlocked ? `  Nv ${rank}/${MAX_SKILL_RANK}` : ''
      this.add.text(64, y, `${s.name}${rankTxt}`, { fontSize: '15px', color: unlocked ? '#ffffff' : '#78909c' })
      if (equippedAt >= 0) this.add.text(64, y + 20, `équipé — slot ${equippedAt + 1}`, { fontSize: '11px', color: '#80cbc4' })

      // bouton investir un point (débloque au rang 1, puis monte le rang)
      if (p.skillPoints > 0 && rank < MAX_SKILL_RANK) {
        btn(300, y, unlocked ? '+1 pt' : 'Débloquer', 0x8d6e00, () => {
          p.skillPoints--; p.skillLevels[s.id] = rank + 1; save(p); this.render()
        })
      }
      // équiper / retirer
      if (unlocked && equippedAt < 0) {
        btn(400, y, 'Équiper', 0x33691e, () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id; save(p); this.render()
        })
      } else if (equippedAt >= 0) {
        btn(400, y, 'Retirer', 0x8e2f2f, () => { p.equippedSkills[equippedAt] = null; save(p); this.render() })
      }
    })

    // Colonne équipement
    this.add.text(520, 85, 'ÉQUIPEMENT', { fontSize: '18px', color: '#80cbc4' })
    SLOTS.forEach((slot, i) => {
      const itemId = p.equipment[slot]
      this.add.text(520, 115 + i * 30, `${SLOT_LABELS[slot]} : ${itemId ? ITEMS[itemId]!.name : '—'}`, { fontSize: '16px', color: '#ffffff' })
    })
    this.add.text(520, 220, 'Inventaire (tap = équiper) :', { fontSize: '14px', color: '#b0bec5' })
    p.inventory.forEach((itemId, i) => {
      const item = ITEMS[itemId]!
      this.add.text(520, 245 + i * 26, `• ${item.name} (${SLOT_LABELS[item.slot]})`, { fontSize: '14px', color: '#ce93d8' })
        .setInteractive()
        .on('pointerdown', () => {
          const prev = p.equipment[item.slot]
          p.equipment[item.slot] = itemId
          p.inventory.splice(i, 1)
          if (prev) p.inventory.push(prev)
          save(p); this.render()
        })
    })

    // Colonne matériaux — collection pure en V1, le craft viendra plus tard
    this.add.text(520, 350, 'MATÉRIAUX', { fontSize: '18px', color: '#80cbc4' })
    const collected = Object.entries(p.materials).filter(([, count]) => count > 0)
    if (collected.length === 0) {
      this.add.text(520, 378, '(rien pour l\'instant)', { fontSize: '14px', color: '#78909c' })
    } else {
      collected.forEach(([id, count], i) => {
        const def = MATERIALS[id]!
        const color = `#${def.color.toString(16).padStart(6, '0')}`
        this.add.text(520, 378 + i * 20, `${def.name} ×${count}`, { fontSize: '14px', color })
      })
    }
    this.add.text(520, 378 + Math.max(collected.length, 1) * 20 + 4, 'Le craft arrive bientôt…', { fontSize: '12px', color: '#546e7a' })

    this.add.text(480, 500, '← Retour', { fontSize: '22px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 } })
      .setOrigin(0.5).setInteractive().on('pointerdown', () => this.scene.start('WorldMap'))
  }
}
