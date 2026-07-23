import Phaser from 'phaser'
import { LEVELS } from '../data/levels'
import { audio } from '../audio/audio-engine'

// TEST DE NIVEAUX : sélecteur donnant accès à TOUS les terrains (boss compris), lancés en mode
// INVINCIBLE (aucun dégât, aucune chute mortelle) pour se balader et inspecter la géométrie. Ne
// touche NI la sauvegarde NI la progression (cf. LevelScene.testMode). Au même rang qu'Entraînement.
export class LevelTestScene extends Phaser.Scene {
  private page = 0
  constructor() { super('LevelTest') }

  create() { this.render() }

  private render() {
    this.children.removeAll()
    this.cameras.main.setBackgroundColor('#12161f')
    this.add.text(480, 20, '🧪 Test de niveaux', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 48, 'Invincible · balade libre · tape un terrain pour l\'inspecter (atteindre la sortie = retour ici)', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)

    const ids = Object.keys(LEVELS)
    const cols = 6, rows = 8, perPage = cols * rows
    const pages = Math.max(1, Math.ceil(ids.length / perPage))
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1)
    const slice = ids.slice(this.page * perPage, this.page * perPage + perPage)
    const cellW = 150, cellH = 46, left = 32, top = 82

    slice.forEach((id, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const x = left + col * cellW, y = top + row * cellH
      const lvl = LEVELS[id]!
      const boss = !!lvl.boss
      const t = this.add.text(x, y, lvl.name, {
        fontSize: '11px', color: '#ffffff', backgroundColor: boss ? '#7a2f2f' : '#37474f',
        padding: { x: 4, y: 5 }, fixedWidth: cellW - 8, align: 'center', fontStyle: boss ? 'bold' : 'normal',
      }).setInteractive({ useHandCursor: true })
      t.on('pointerdown', () => {
        audio.playSfx('ui-tap')
        this.scene.start('Level', { levelId: id, test: true, targetNode: id, dir: 'forward' })
      })
      this.add.text(x + 2, y + 30, id, { fontSize: '8px', color: '#78909c' })
    })

    if (pages > 1) {
      const nav = (x: number, label: string, d: number) =>
        this.add.text(x, 508, label, { fontSize: '20px', color: '#ffffff', backgroundColor: '#455a64', padding: { x: 12, y: 4 } })
          .setOrigin(0.5).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { audio.playSfx('ui-tap'); this.page += d; this.render() })
      nav(430, '◀', -1)
      this.add.text(480, 508, `${this.page + 1}/${pages}`, { fontSize: '14px', color: '#b0bec5' }).setOrigin(0.5)
      nav(530, '▶', 1)
    }

    this.add.text(60, 508, '← Menu', { fontSize: '18px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 12, y: 6 } })
      .setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { audio.playSfx('ui-tap'); this.scene.start('Menu') })
  }
}
