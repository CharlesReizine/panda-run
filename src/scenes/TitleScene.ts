import Phaser from 'phaser'
import { load } from '../core/save'
import { newPlayer } from '../core/player-state'
import { setPlayer } from '../state'

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title') }

  create() {
    this.add.text(480, 140, 'Panda-Run', { fontSize: '64px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.image(480, 250, 'panda').setScale(3)

    const mkButton = (y: number, label: string, onTap: () => void) => {
      const t = this.add.text(480, y, label, {
        fontSize: '28px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 24, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      t.on('pointerdown', onTap)
      return t
    }

    mkButton(370, 'Nouvelle partie', () => {
      setPlayer(newPlayer('Panda'))
      this.scene.start('WorldMap')
    })

    const existing = load()
    if (existing) {
      mkButton(440, 'Continuer', () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
    }
  }
}
