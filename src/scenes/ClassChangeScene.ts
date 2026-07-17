import Phaser from 'phaser'
import { CLASSES } from '../data/classes'
import { skillsOf } from '../data/skills'
import { changeClass } from '../core/progression'
import { getPlayer } from '../state'
import { save } from '../core/save'
import type { ClassId } from '../core/types'

const CHOICES: ClassId[] = ['swordsman', 'mage', 'archer']

export class ClassChangeScene extends Phaser.Scene {
  private chosen = false

  constructor() { super('ClassChange') }

  create() {
    this.chosen = false
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a)
    this.add.text(480, 50, '✦ Choisis ta voie, petit panda ✦', { fontSize: '32px', color: '#ffd700' }).setOrigin(0.5)

    CHOICES.forEach((id, i) => {
      const def = CLASSES[id]
      const x = 200 + i * 280
      const card = this.add.rectangle(x, 290, 240, 360, 0x1b3a4b).setStrokeStyle(3, def.tint).setInteractive()
      this.add.image(x, 175, `panda-${id}`).setScale(2)
      this.add.text(x, 260, def.name, { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      this.add.text(x, 300, `ATK ${def.baseStats.atk}  DEF ${def.baseStats.def}\nPV ${def.baseStats.maxHp}`, { fontSize: '14px', color: '#b0bec5', align: 'center' }).setOrigin(0.5)
      this.add.text(x, 390, skillsOf(id).slice(0, 3).map((s) => `• ${s.name}`).join('\n') + '\n…', { fontSize: '12px', color: '#80cbc4', align: 'center' }).setOrigin(0.5)
      card.on('pointerdown', () => this.choose(id))
    })
  }

  private choose(id: ClassId) {
    if (this.chosen) return
    this.chosen = true
    const p = getPlayer()
    changeClass(p, id)
    const firstSkill = CLASSES[id].skillIds[0]!
    p.unlockedSkills.push(firstSkill)
    p.equippedSkills = [firstSkill, null, null, null]
    save(p)
    const flash = this.add.rectangle(480, 270, 960, 540, 0xffffff).setAlpha(0)
    this.tweens.add({
      targets: flash, alpha: 1, yoyo: true, duration: 300,
      onComplete: () => this.scene.start('WorldMap'),
    })
    this.add.text(480, 500, `Tu es maintenant ${CLASSES[id].name} !`, { fontSize: '24px', color: '#ffd700' }).setOrigin(0.5).setDepth(1)
  }
}
