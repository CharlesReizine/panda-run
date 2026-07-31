import Phaser from 'phaser'
import { CLASSES } from '../data/classes'
import { skillsOf } from '../data/skills'
import { changeClass, canEvolveClass, evolveClass, EVOLUTIONS } from '../core/progression'
import { getPlayer } from '../state'
import { save } from '../core/save'
import type { ClassDef, ClassId } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import {
  CC, cardRect, cardFlow, portraitScale, splitSkills, fitName, fitSkill, trainingRect, type Rect,
} from './classchange-layout'

const CHOICES: ClassId[] = ['swordsman', 'mage', 'archer']

export class ClassChangeScene extends Phaser.Scene {
  private chosen = false

  constructor() { super('ClassChange') }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    this.chosen = false
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a)

    // deux modes : évolution (1 seule voie → confirmation) si le joueur y est éligible,
    // sinon choix de la 1re classe (3 cartes, novice)
    if (canEvolveClass(getPlayer())) this.buildEvolution()
    else this.buildFirstChoice()

    // accès à la page d'entraînement depuis le choix de classe (essayer les classes librement,
    // mana infini + dummy invincible) — coin bas-gauche, à l'écart des cartes ET du bouton
    // d'évolution : sa bande est comparée aux deux autres dans tests/core/classchange-layout.test.ts
    const training = '⚔ Entraînement'
    const tr = trainingRect(training)
    this.add.text(tr.x, CC.trainingY, training, {
      fontSize: `${CC.trainingFont}px`, color: '#ffd54f', fontStyle: 'bold', backgroundColor: '#00000066',
      padding: { x: CC.trainingPadX, y: CC.trainingPadY },
    }).setOrigin(0, 0.5).setDepth(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Training'))
  }

  private title(text: string) {
    this.add.text(480, CC.titleY, text, { fontSize: `${CC.titleFont}px`, color: '#ffd700' }).setOrigin(0.5)
  }

  // Peint le contenu commun d'une carte de classe : illustration BORNÉE par la carte, puis nom, stats
  // et liste de compétences bornée. Renvoie le rectangle de fond pour que l'appelant le rende cliquable.
  private paintCard(card: Rect, texture: string, name: string, def: ClassDef, skills: string[], heading?: string) {
    const f = cardFlow(card)
    const bg = this.add.rectangle(card.x + card.w / 2, card.y + card.h / 2, card.w, card.h, 0x1b3a4b)
      .setStrokeStyle(3, def.tint)

    // l'échelle vient de la carte, jamais l'inverse : c'est ce qui empêche le panda de ressortir par
    // le haut du cadre comme il le faisait (cadre 83→267 pour une carte commençant à 110)
    this.add.image(f.portrait.x + f.portrait.w / 2, f.portrait.y + f.portrait.h / 2, texture)
      .setScale(portraitScale(card))

    this.add.text(card.x + card.w / 2, f.name.y, fitName(name, card), {
      fontSize: `${CC.nameFont}px`, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.add.text(card.x + card.w / 2, f.stats.y, `ATK ${def.baseStats.atk}  DEF ${def.baseStats.def}\nPV ${def.baseStats.maxHp}`, {
      fontSize: `${CC.statsFont}px`, color: '#b0bec5', align: 'center',
    }).setOrigin(0.5, 0)

    // liste de compétences BORNÉE : le surplus est compté, pas remplacé par un « … » muet
    const { shown, hidden } = splitSkills(skills, card, heading ? 1 : 0)
    const lines = [
      ...(heading ? [fitSkill(heading, card)] : []),
      ...shown.map((s) => fitSkill(`• ${s}`, card)),
      ...(hidden > 0 ? [`+${hidden} autre${hidden > 1 ? 's' : ''}`] : []),
    ]
    this.add.text(card.x + card.w / 2, f.skills.y, lines.join('\n'), {
      fontSize: `${CC.skillFont}px`, color: '#80cbc4', align: 'center',
    }).setOrigin(0.5, 0)

    return bg
  }

  private buildFirstChoice() {
    this.title('✦ Choisis ta voie, petit panda ✦')

    CHOICES.forEach((id, i) => {
      const def = CLASSES[id]
      const card = cardRect(i, CHOICES.length)
      const bg = this.paintCard(card, `panda-${id}`, def.name, def, skillsOf(id).map((s) => s.name))
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(id))
    })
  }

  private buildEvolution() {
    const p = getPlayer()
    const target = EVOLUTIONS[p.classId]!
    const def = CLASSES[target]
    this.title('✦ Ton pouvoir s\'éveille ✦')

    const card = cardRect(0, 1)
    this.paintCard(card, `panda-${target}`, `${CLASSES[p.classId].name} → ${def.name}`, def,
      skillsOf(target).map((s) => s.name), 'Nouveaux skills :')

    // bouton d'action SOUS les cartes : il recouvrait le message de fin (bandes 474→526 et 504→536)
    const label = `Évoluer en ${def.name} !`
    const btn = this.add.text(480, CC.actionY, label, {
      fontSize: `${CC.actionFont}px`, color: '#000000', backgroundColor: '#ffd700',
      padding: { x: CC.actionPadX, y: CC.actionPadY },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    // le battement (+6 %) reste dans l'écran : le test vérifie que le rectangle réservé, grossi de 6 %,
    // tient encore dans les 960 px de l'espace de conception
    this.tweens.add({ targets: btn, scale: CC.actionPulse, yoyo: true, repeat: -1, duration: 500 })
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
    const flash = this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0xffffff).setAlpha(0)
    this.tweens.add({
      targets: flash, alpha: 1, yoyo: true, duration: 300,
      onComplete: () => this.scene.start('WorldMap'),
    })
    // le message partage sa ligne avec le bouton d'entraînement (l'écran n'a plus de place ailleurs) :
    // c'est l'écart HORIZONTAL qui garantit le non-recouvrement, et il est vérifié par le test
    this.add.text(480, CC.messageY, message, { fontSize: `${CC.messageFont}px`, color: '#ffd700' })
      .setOrigin(0.5).setDepth(1)
  }
}
