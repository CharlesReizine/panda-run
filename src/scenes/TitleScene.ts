import Phaser from 'phaser'
import { load, serialize, deserialize, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title') }

  // Une sauvegarde corrompue ou d'une version future ferait planter load() (JSON.parse ou check
  // de version) ; on la traite comme "pas de sauvegarde" plutôt que de bloquer le jeu au démarrage.
  private safeLoad(): PlayerState | null {
    try {
      return load()
    } catch {
      return null
    }
  }

  create() {
    this.add.text(480, 140, 'Panda-Run', { fontSize: '64px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    // repère de version : dis-moi ce numéro pour qu'on sache si tu vois bien la dernière build
    this.add.text(480, 95, 'build R28', { fontSize: '22px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0.5)
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

    const existing = this.safeLoad()
    if (existing) {
      mkButton(440, 'Continuer', () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
    }

    this.add.text(20, 500, 'Exporter la sauvegarde', { fontSize: '14px', color: '#b0bec5' })
      .setInteractive().on('pointerdown', async () => {
        const p = this.safeLoad()
        if (!p) return
        await navigator.clipboard.writeText(serialize(p))
        this.add.text(20, 480, 'Copié !', { fontSize: '14px', color: '#66bb6a' })
      })

    this.add.text(760, 500, 'Importer une sauvegarde', { fontSize: '14px', color: '#b0bec5' })
      .setInteractive().on('pointerdown', () => {
        const json = window.prompt('Colle ta sauvegarde :')
        if (!json) return
        try {
          const p = deserialize(json)
          save(p)
          this.scene.restart()
        } catch {
          window.alert('Sauvegarde invalide')
        }
      })
  }
}
