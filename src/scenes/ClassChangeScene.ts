import Phaser from 'phaser'
import { CLASSES } from '../data/classes'
import { skillsOf } from '../data/skills'
import { changeClass, canEvolveClass, evolveClass, EVOLUTIONS } from '../core/progression'
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

    // deux modes : évolution (1 seule voie → confirmation) si le joueur y est éligible,
    // sinon choix de la 1re classe (3 cartes, novice)
    if (canEvolveClass(getPlayer())) this.buildEvolution()
    else this.buildFirstChoice()
  }

  private buildFirstChoice() {
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

  private buildEvolution() {
    const p = getPlayer()
    const target = EVOLUTIONS[p.classId]!
    const def = CLASSES[target]
    this.add.text(480, 50, '✦ Ton pouvoir s\'éveille ✦', { fontSize: '32px', color: '#ffd700' }).setOrigin(0.5)

    const card = this.add.rectangle(480, 290, 300, 380, 0x1b3a4b).setStrokeStyle(4, def.tint)
    this.add.image(480, 175, `panda-${target}`).setScale(2.4)
    this.add.text(480, 255, `${CLASSES[p.classId].name} → ${def.name}`, { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 300, `ATK ${def.baseStats.atk}  DEF ${def.baseStats.def}\nPV ${def.baseStats.maxHp}`, { fontSize: '15px', color: '#b0bec5', align: 'center' }).setOrigin(0.5)
    this.add.text(480, 380, 'Nouveaux skills :\n' + skillsOf(target).slice(0, 3).map((s) => `• ${s.name}`).join('\n'), { fontSize: '13px', color: '#80cbc4', align: 'center' }).setOrigin(0.5)

    const btn = this.add.text(480, 500, `Évoluer en ${def.name} !`, { fontSize: '24px', color: '#000000', backgroundColor: '#ffd700', padding: { x: 20, y: 10 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.tweens.add({ targets: btn, scale: 1.06, yoyo: true, repeat: -1, duration: 500 })
    btn.on('pointerdown', () => this.evolve())
  }

  private choose(id: ClassId) {
    if (this.chosen) return
    this.chosen = true
    const p = getPlayer()
    changeClass(p, id)
    const firstSkill = CLASSES[id].skillIds[0]!
    if (!p.skillLevels[firstSkill]) p.skillLevels[firstSkill] = 1
    // on GARDE les skills déjà appris/équipés (novice…) : on ajoute juste le 1er skill de la
    // nouvelle classe dans un slot LIBRE, sans écraser la barre
    if (!p.equippedSkills.includes(firstSkill)) {
      const free = p.equippedSkills.indexOf(null)
      if (free >= 0) p.equippedSkills[free] = firstSkill
    }
    save(p)
    this.finish(`Tu es maintenant ${CLASSES[id].name} !`)
  }

  private evolve() {
    if (this.chosen) return
    this.chosen = true
    const p = getPlayer()
    const to = evolveClass(p)
    save(p)
    this.finish(`Tu es maintenant ${CLASSES[to].name} !`)
  }

  private finish(message: string) {
    const flash = this.add.rectangle(480, 270, 960, 540, 0xffffff).setAlpha(0)
    this.tweens.add({
      targets: flash, alpha: 1, yoyo: true, duration: 300,
      onComplete: () => this.scene.start('WorldMap'),
    })
    this.add.text(480, 520, message, { fontSize: '24px', color: '#ffd700' }).setOrigin(0.5).setDepth(1)
  }
}
