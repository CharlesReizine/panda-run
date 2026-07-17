import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf } from '../data/skills'
import { ITEMS } from '../data/items'
import type { EquipSlot } from '../core/types'
import { computeStats } from '../core/stats'

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'accessory']
const SLOT_LABELS: Record<EquipSlot, string> = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire' }

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu') }

  create() {
    this.add.rectangle(480, 270, 960, 540, 0x1b2631, 0.95)
    this.render()
  }

  private render() {
    this.children.removeAll()
    this.add.rectangle(480, 270, 960, 540, 0x1b2631, 0.95)
    const p = getPlayer()
    const stats = computeStats(p)
    this.add.text(30, 20, `${p.name} — Nv ${p.level} — ATK ${stats.atk} / DEF ${stats.def} / PV ${stats.maxHp}`, { fontSize: '18px', color: '#ffffff' })
    this.add.text(30, 50, `Points de skill : ${p.skillPoints}`, { fontSize: '16px', color: '#ffd700' })

    // Colonne skills
    this.add.text(30, 85, 'SKILLS', { fontSize: '18px', color: '#80cbc4' })
    skillsOf(p.classId).forEach((s, i) => {
      const y = 115 + i * 46
      const unlocked = p.unlockedSkills.includes(s.id)
      const equippedAt = p.equippedSkills.indexOf(s.id)
      const label = `${s.name}${equippedAt >= 0 ? `  [slot ${equippedAt + 1}]` : ''}`
      const t = this.add.text(30, y, label, { fontSize: '16px', color: unlocked ? '#ffffff' : '#78909c' }).setInteractive()
      if (!unlocked && p.skillPoints > 0) {
        this.add.text(320, y, '[Débloquer 1pt]', { fontSize: '14px', color: '#ffd700' }).setInteractive()
          .on('pointerdown', () => { p.skillPoints--; p.unlockedSkills.push(s.id); save(p); this.render() })
      }
      if (unlocked && equippedAt < 0) {
        t.on('pointerdown', () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id
          save(p); this.render()
        })
      } else if (equippedAt >= 0) {
        t.on('pointerdown', () => { p.equippedSkills[equippedAt] = null; save(p); this.render() })
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

    this.add.text(480, 500, '← Retour', { fontSize: '22px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 } })
      .setOrigin(0.5).setInteractive().on('pointerdown', () => this.scene.start('WorldMap'))
  }
}
