import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf, SKILLS } from '../data/skills'
import { MAX_SKILL_RANK } from '../core/player-state'

// Gestion des compétences DIRECTEMENT en jeu (pas besoin de la carte).
// Lancée par-dessus le niveau en pause ; à la fermeture, on reprend le jeu.
export class SkillEquipScene extends Phaser.Scene {
  constructor() { super('SkillEquip') }

  create() {
    this.render()
  }

  private close() {
    this.scene.resume('Level')
    this.scene.resume('UI')
    this.game.events.emit('hud-refresh')
    this.scene.stop('SkillEquip')
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    const p = getPlayer()
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a, 0.96)
    this.add.text(480, 24, 'Compétences', { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 56, `Points à dépenser : ${p.skillPoints}`, { fontSize: '16px', color: '#ffd54f' }).setOrigin(0.5)

    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '14px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 8, y: 4 } })
        .setOrigin(0.5).setInteractive().on('pointerdown', onTap)

    // Rangée des 4 slots équipés (tap = retirer)
    this.add.text(480, 92, 'Équipé (tape pour retirer)', { fontSize: '13px', color: '#b0bec5' }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = 372 + i * 72
      this.add.rectangle(x, 130, 60, 60, 0x000000, 0.5).setStrokeStyle(2, 0xffffff, 0.6)
      this.add.text(x, 104, `${i + 1}`, { fontSize: '12px', color: '#ffd54f' }).setOrigin(0.5)
      const sid = p.equippedSkills[i]
      if (sid) {
        this.add.image(x, 130, `skill-${sid}`).setDisplaySize(48, 48)
          .setInteractive().on('pointerdown', () => { p.equippedSkills[i] = null; save(p); this.render() })
      }
    }

    // Liste des compétences de la classe
    skillsOf(p.classId).forEach((s, i) => {
      const y = 190 + i * 46
      const rank = p.skillLevels[s.id] ?? 0
      const unlocked = rank > 0
      const equipped = p.equippedSkills.includes(s.id)
      const icon = this.add.image(180, y + 8, `skill-${s.id}`).setDisplaySize(34, 34)
      if (!unlocked) icon.setAlpha(0.35)
      const rankTxt = unlocked ? `  Nv ${rank}/${MAX_SKILL_RANK}` : '  (verrouillé)'
      this.add.text(210, y, `${s.name}${rankTxt}`, { fontSize: '15px', color: unlocked ? '#ffffff' : '#78909c' })

      if (p.skillPoints > 0 && rank < MAX_SKILL_RANK) {
        btn(560, y + 8, unlocked ? '+1 pt' : 'Débloquer', 0x8d6e00, () => {
          p.skillPoints--; p.skillLevels[s.id] = rank + 1; save(p); this.render()
        })
      }
      if (unlocked && !equipped) {
        btn(660, y + 8, 'Équiper', 0x33691e, () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id; save(p); this.render()
        })
      } else if (equipped) {
        this.add.text(640, y, 'équipé', { fontSize: '13px', color: '#80cbc4' })
      }
    })

    btn(480, 500, 'Reprendre ▶', 0x33691e, () => this.close())
  }
}
