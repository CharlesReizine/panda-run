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
    this.add.text(480, 20, 'Compétences', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 48, `Points à dépenser : ${p.skillPoints}`, { fontSize: '15px', color: '#ffd54f' }).setOrigin(0.5)

    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '13px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 8, y: 4 } })
        .setOrigin(0.5).setInteractive().on('pointerdown', onTap)

    // Rangée des 4 slots équipés (tap = retirer) — icônes agrandies, cases surlignées quand pleines
    this.add.text(480, 74, 'Équipé (tape pour retirer)', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = 360 + i * 80
      const sid = p.equippedSkills[i]
      this.add.rectangle(x, 116, 68, 68, 0x000000, 0.5).setStrokeStyle(2, sid ? 0xffd54f : 0xffffff, sid ? 0.9 : 0.5)
      this.add.text(x, 88, `${i + 1}`, { fontSize: '12px', color: '#ffd54f' }).setOrigin(0.5)
      if (sid) {
        this.add.image(x, 116, `skill-${sid}`).setDisplaySize(56, 56)
          .setInteractive().on('pointerdown', () => { p.equippedSkills[i] = null; save(p); this.render() })
      }
    }

    // Grille des compétences de la classe — 2 colonnes dès que ça ne tient plus en 1
    this.add.text(480, 168, 'Compétences de la classe', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)
    const skills = skillsOf(p.classId)
    const columns = skills.length > 4 ? 2 : 1
    const colW = columns === 2 ? 440 : 860
    const colX = columns === 2 ? [50, 500] : [50]
    const rowH = 70
    const gridTop = 184

    skills.forEach((s, i) => {
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = colX[col]!
      const y = gridTop + row * rowH
      const cardH = rowH - 8

      const rank = p.skillLevels[s.id] ?? 0
      const unlocked = rank > 0
      const equipped = p.equippedSkills.includes(s.id)

      this.add.rectangle(x, y, colW, cardH, 0x000000, equipped ? 0.55 : 0.32).setOrigin(0, 0)
        .setStrokeStyle(1, equipped ? 0x80cbc4 : 0xffffff, equipped ? 0.8 : 0.22)

      const icon = this.add.image(x + 34, y + cardH / 2, `skill-${s.id}`).setDisplaySize(46, 46)
      if (!unlocked) icon.setAlpha(0.35)

      const rankTxt = unlocked ? `Nv ${rank}/${MAX_SKILL_RANK}` : 'Verrouillé'
      this.add.text(x + 64, y + 8, s.name, { fontSize: '13px', color: unlocked ? '#ffffff' : '#78909c', fontStyle: 'bold' })
      this.add.text(x + 64, y + 27, rankTxt, { fontSize: '11px', color: unlocked ? '#ffd54f' : '#607d8b' })

      if (p.skillPoints > 0 && rank < MAX_SKILL_RANK) {
        btn(x + colW - 74, y + 17, unlocked ? '+1 pt' : 'Débloquer', 0x8d6e00, () => {
          p.skillPoints--; p.skillLevels[s.id] = rank + 1; save(p); this.render()
        })
      }
      if (unlocked && !equipped) {
        btn(x + colW - 74, y + 45, 'Équiper', 0x33691e, () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id; save(p); this.render()
        })
      } else if (equipped) {
        this.add.text(x + colW - 74, y + 45, 'Équipé ✓', { fontSize: '12px', color: '#80cbc4' }).setOrigin(0.5)
      }
    })

    btn(480, 505, 'Reprendre ▶', 0x33691e, () => this.close())
  }
}
