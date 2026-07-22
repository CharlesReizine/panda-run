import Phaser from 'phaser'
import { load, serialize, deserialize, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'
import { audio } from '../audio/audio-engine'
import { showLogsOverlay } from '../ui/error-overlay'
import { clearLogs } from '../core/logger'

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
    // déblocage audio iOS/Safari : le contexte ne peut (re)démarrer que sur un geste utilisateur
    this.input.once('pointerdown', () => audio.unlock())
    audio.playMusic('titre')

    // splash illustré (image fournie) en fond plein écran
    this.add.image(480, 270, 'splash').setDisplaySize(960, 540)
    // léger voile en haut pour la lisibilité du logo
    this.add.rectangle(480, 60, 960, 120, 0x000000, 0.18)

    // logo « PANDA-RUN » : gros, gras, contour épais + ombre portée + dégradé doré
    const logo = this.add.text(480, 108, 'PANDA-RUN', {
      fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '92px', fontStyle: 'bold', color: '#ffd54f',
    }).setOrigin(0.5)
    logo.setStroke('#3a1d00', 12)
    logo.setShadow(0, 8, '#00000088', 10, true, true)
    try {
      const grad = logo.context.createLinearGradient(0, 0, 0, logo.height)
      grad.addColorStop(0, '#fffde7')
      grad.addColorStop(0.5, '#ffd54f')
      grad.addColorStop(1, '#ff8f00')
      logo.setColor(grad as unknown as string)
    } catch { /* fallback : couleur pleine */ }
    this.tweens.add({ targets: logo, scale: 1.03, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.inOut' })

    // repère de version : dis-moi ce numéro pour qu'on sache si tu vois bien la dernière build
    this.add.text(10, 8, 'build R187', { fontSize: '16px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0, 0)

    // accès aux logs sur mobile (pas de console sur iPhone) : « Logs » ouvre l'overlay DOM,
    // « Vider » réinitialise le ring buffer + localStorage.
    this.add.text(10, 30, 'Logs', { fontSize: '14px', color: '#ffe0b2', fontStyle: 'bold' })
      .setShadow(0, 1, '#000000aa', 2, false, true)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => showLogsOverlay())
    const clearTxt = this.add.text(66, 30, 'Vider les logs', { fontSize: '14px', color: '#ffe0b2', fontStyle: 'bold' })
      .setShadow(0, 1, '#000000aa', 2, false, true)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        clearLogs()
        clearTxt.setText('Logs vidés')
      })

    // bouton muet discret (coin haut-droit)
    const muteBtn = this.add.text(944, 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '22px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      audio.unlock()
      muteBtn.setText(audio.toggleMute() ? '🔇' : '🔊')
    })

    // bouton stylé : cadre arrondi + effets hover/press, la logique passe par onTap
    const mkButton = (y: number, label: string, onTap: () => void) => {
      const w = 300, h = 58
      const c = this.add.container(480, y)
      const bg = this.add.graphics()
      const paint = (fill: number, line: number) => {
        bg.clear()
        bg.fillStyle(0x000000, 0.28).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14)
        bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14)
        bg.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 4, 10)
        bg.lineStyle(3, line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14)
      }
      paint(0x2e7d32, 0xa5d6a7)
      const t = this.add.text(0, 0, label, { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      t.setShadow(0, 2, '#00000099', 3, false, true)
      c.add([bg, t])
      c.setSize(w, h).setInteractive({ useHandCursor: true })
      c.on('pointerover', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.05) })
      c.on('pointerout', () => { paint(0x2e7d32, 0xa5d6a7); c.setScale(1) })
      c.on('pointerdown', () => { paint(0x1b5e20, 0xa5d6a7); c.setScale(0.97); onTap() })
      c.on('pointerup', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.05) })
      return c
    }

    const existing = this.safeLoad()

    mkButton(existing ? 384 : 400, 'Nouvelle partie', () => {
      setPlayer(newPlayer('Panda'))
      // ouvre DIRECTEMENT le 1er terrain (Prairie) plutôt que la carte — plus clean au démarrage.
      // Même data que la carte pour un niveau (fromNode=targetNode=le nœud de départ) ; LevelIntro
      // enchaîne sur le niveau, et à la sortie on retombe sur la carte (Prairie faite, voisins ouverts).
      this.scene.start('LevelIntro', { levelId: 'plaine-1', fromNode: 'plaine-1', targetNode: 'plaine-1', dir: 'forward' })
    })

    if (existing) {
      mkButton(446, 'Continuer', () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
    }

    // accès direct à la page d'entraînement (aucune partie requise : on choisit une classe sur place)
    mkButton(existing ? 508 : 468, 'Entraînement', () => {
      this.scene.start('Training')
    })

    this.add.text(20, 516, 'Exporter la sauvegarde', { fontSize: '14px', color: '#ffe0b2', fontStyle: 'bold' })
      .setShadow(0, 1, '#000000aa', 2, false, true)
      .setInteractive({ useHandCursor: true }).on('pointerdown', async () => {
        const p = this.safeLoad()
        if (!p) return
        await navigator.clipboard.writeText(serialize(p))
        this.add.text(20, 496, 'Copié !', { fontSize: '14px', color: '#a5d6a7', fontStyle: 'bold' })
      })

    this.add.text(940, 516, 'Importer une sauvegarde', { fontSize: '14px', color: '#ffe0b2', fontStyle: 'bold' })
      .setOrigin(1, 0).setShadow(0, 1, '#000000aa', 2, false, true)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
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
