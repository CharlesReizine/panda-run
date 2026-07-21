import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf } from '../data/skills'
import { MATERIALS } from '../data/materials'
import { computeStats } from '../core/stats'
import { MAX_SKILL_RANK } from '../core/player-state'

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
    this.add.text(30, 20, `${p.name} — Nv ${p.level} — ATK ${stats.atk} / DEF ${Math.round(stats.def)} / PV ${stats.maxHp} / VIT ${stats.attackSpeed.toFixed(2)}`, { fontSize: '18px', color: '#ffffff' })
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

    // Colonne stats réparties (STR/AGI/INT)
    this.add.text(760, 85, 'STATS', { fontSize: '18px', color: '#80cbc4' })
    this.add.text(760, 108, `Points : ${p.statPoints}`, { fontSize: '14px', color: '#ffd700' })
    const STAT_ROWS: { key: 'str' | 'agi' | 'int'; label: string; effet: string }[] = [
      { key: 'str', label: 'STR', effet: '+2 ATK' },
      { key: 'agi', label: 'AGI', effet: '+VIT/DEF' },
      { key: 'int', label: 'INT', effet: '+4 PV' },
    ]
    STAT_ROWS.forEach((row, i) => {
      const y = 135 + i * 40
      this.add.text(760, y, `${row.label} ${p.allocated[row.key]}`, { fontSize: '16px', color: '#ffffff' })
      this.add.text(760, y + 18, row.effet, { fontSize: '11px', color: '#78909c' })
      if (p.statPoints > 0) {
        btn(880, y, '+', 0x8d6e00, () => {
          p.statPoints--; p.allocated[row.key]++; save(p); this.render()
        })
      }
    })

    // L'équipement et l'inventaire se gèrent désormais dans l'écran Inventaire dédié
    // (InventoryScene), accessible depuis la carte et en jeu — retirés d'ici.

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

    this.add.text(770, 500, '📖 Bestiaire', { fontSize: '18px', color: '#ffffff', backgroundColor: '#37474f', padding: { x: 14, y: 8 } })
      .setOrigin(0.5).setInteractive().on('pointerdown', () => this.scene.start('Bestiary'))

    this.add.text(770, 458, '⚔ Entraînement', { fontSize: '18px', color: '#ffffff', backgroundColor: '#37474f', padding: { x: 14, y: 8 } })
      .setOrigin(0.5).setInteractive().on('pointerdown', () => this.scene.start('Training'))
  }
}
