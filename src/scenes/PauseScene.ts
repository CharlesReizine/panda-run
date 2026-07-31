import Phaser from 'phaser'
import { audio } from '../audio/audio-engine'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'

// Menu de pause superposé au niveau gelé (Level + UI mis en pause par le bouton ⏸).
// Deux vues : le menu principal et le sous-panneau « Réglages » (volume + muet).
export class PauseScene extends Phaser.Scene {
  private showSettings = false

  constructor() { super('Pause') }

  create() {
    // ⚠️ PAS DE setScrollFactor(0) DANS CET ÉCRAN, ET C'EST VOLONTAIRE.
    // La scène appelle centerCamera() (core/viewport.ts), qui décale la caméra de −BLEED_X pour recentrer
    // l'espace de conception 0→960 sur un écran plus large. Or un objet en scrollFactor(0) ignore le
    // défilement de caméra PAR DÉFINITION : il restait donc à sa coordonnée brute, soit 105 px à gauche du
    // centre réel. Et dans un écran d'interface la caméra ne défile jamais, donc l'épinglage n'apportait
    // rien. C'est la cause unique du « c'est pas centré » constaté sur plusieurs écrans.
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    this.showSettings = false
    this.render()
  }

  private resumeGame() {
    this.scene.resume('Level')
    this.scene.resume('UI')
    this.scene.stop('Pause')
  }

  private quitToMap() {
    this.scene.stop('Level')
    this.scene.stop('UI')
    this.scene.start('WorldMap')
    this.scene.stop('Pause')
  }

  private btn(x: number, y: number, label: string, bg: number, onTap: () => void, w = 300) {
    const t = this.add.text(x, y, label, {
      fontSize: '24px', color: '#ffffff', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`,
      padding: { x: 20, y: 10 }, fixedWidth: w, align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    t.on('pointerdown', () => {
      audio.playSfx('ui-tap')
      this.tweens.add({ targets: t, scale: 0.92, duration: 60, yoyo: true })
      onTap()
    })
    return t
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()

    // voile semi-transparent (plein écran, non ancré à la caméra du niveau)
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.82)
    this.add.text(480, 90, 'Pause', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    if (this.showSettings) this.renderSettings()
    else this.renderMenu()
  }

  private renderMenu() {
    this.btn(480, 220, 'Reprendre', 0x33691e, () => this.resumeGame())
    this.btn(480, 290, 'Réglages', 0x1565c0, () => { this.showSettings = true; this.render() })
    this.btn(480, 360, 'Quitter → Carte', 0x8d1e1e, () => this.quitToMap())
  }

  private renderSettings() {
    // ---- Volume : boutons - / + autour d'une jauge remplie + pourcentage ----
    this.add.text(480, 190, 'Volume', { fontSize: '22px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5)

    const barX = 380, barY = 235, barW = 200, barH = 20
    this.add.rectangle(barX, barY, barW, barH, 0x000000, 0.6).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff, 0.4)
    const fill = this.add.rectangle(barX + 2, barY, (barW - 4) * audio.getVolume(), barH - 6, 0x29b6f6).setOrigin(0, 0.5)
    // ⚠️ ANCRÉ À DROITE, PAS À GAUCHE. Posé en origine (0, …) à barX+barW+20 = 600, « 100% » (4
    // caractères, ~48 px) s'étendait jusqu'à 648 alors que le bouton « + » commence à 632 : le signe
    // « % » passait dessous et le texte se lisait « 100 ». Ancré à droite juste avant le bouton, il ne
    // peut plus le toucher, quelle que soit la longueur de la valeur.
    const pct = this.add.text(626, barY, `${Math.round(audio.getVolume() * 100)}%`, { fontSize: '20px', color: '#ffffff' }).setOrigin(1, 0.5)

    const applyVolume = () => {
      fill.setDisplaySize((barW - 4) * audio.getVolume(), barH - 6)
      pct.setText(`${Math.round(audio.getVolume() * 100)}%`)
    }
    const step = (delta: number) => {
      audio.unlock()
      audio.setVolume(Math.round((audio.getVolume() + delta) * 20) / 20) // pas de 5 %
      applyVolume()
    }

    this.btn(300, barY, '−', 0x455a64, () => step(-0.1), 56)
    this.btn(668, barY, '+', 0x455a64, () => step(0.1), 56) // décalé de 8 px : laisse la place au pourcentage

    // ---- Muet : bascule ----
    const muteBtn = this.btn(480, 320, audio.isMuted() ? 'Son : coupé 🔇' : 'Son : activé 🔊', 0x37474f, () => {
      audio.unlock()
      const muted = audio.toggleMute()
      muteBtn.setText(muted ? 'Son : coupé 🔇' : 'Son : activé 🔊')
    }, 320)

    this.btn(480, 410, '◂ Retour', 0x33691e, () => { this.showSettings = false; this.render() })
  }
}
