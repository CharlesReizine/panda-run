import Phaser from 'phaser'
import { load, serialize, deserialize, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'
import { audio } from '../audio/audio-engine'

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

    // ciel dramatique (dégradé fait main, texture générée au Preload)
    this.add.image(480, 270, 'title-sky')

    // lignes de vitesse derrière le héros : rotation lente + pulsation (façon splash manga)
    const rays = this.add.image(480, 250, 'title-rays').setAlpha(0.26)
    this.tweens.add({ targets: rays, angle: 360, duration: 44000, repeat: -1 })
    this.tweens.add({ targets: rays, scale: 1.08, yoyo: true, repeat: -1, duration: 2600, ease: 'Sine.inOut' })

    // nuages pour la profondeur (dérive douce)
    for (const [cx, cy, s, a, dur] of [[150, 120, 1.1, 0.5, 17000], [820, 170, 0.8, 0.4, 21000], [640, 90, 0.6, 0.35, 25000]] as const) {
      const cloud = this.add.image(cx, cy, 'cloud').setScale(s).setAlpha(a).setTint(0xffe8d0)
      this.tweens.add({ targets: cloud, x: cx + 40, yoyo: true, repeat: -1, duration: dur, ease: 'Sine.inOut' })
    }

    // ombre portée au sol + panda héroïque au centre, léger bob
    const shadow = this.add.ellipse(480, 415, 210, 34, 0x1a0e2e, 0.35)
    const panda = this.add.image(480, 250, 'panda').setScale(3.4)
    this.tweens.add({ targets: panda, y: 238, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' })
    this.tweens.add({ targets: shadow, scaleX: 0.86, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' })

    // étincelles scintillantes autour du héros
    for (const [sx, sy, r] of [[300, 150, 9], [672, 130, 7], [360, 330, 6], [620, 320, 8], [500, 96, 6], [235, 260, 5]] as const) {
      const star = this.add.star(sx, sy, 4, r * 0.34, r, 0xfff8d0).setAlpha(0.9)
      this.tweens.add({ targets: star, scale: 0.2, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 + r * 90, ease: 'Sine.inOut', delay: sx % 900 })
    }

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
    this.add.text(10, 8, 'build R46', { fontSize: '16px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0, 0)

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

    mkButton(existing ? 408 : 428, 'Nouvelle partie', () => {
      setPlayer(newPlayer('Panda'))
      this.scene.start('WorldMap')
    })

    if (existing) {
      mkButton(474, 'Continuer', () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
    }

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
