import Phaser from 'phaser'
import { load, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'
import { audio } from '../audio/audio-engine'
import { logEvent } from '../core/logger'
import { BUILD } from '../core/build'
import { cloudAvailable, ensureUser } from '../cloud/auth'
import { pull } from '../cloud/cloud-save'
import { pseudoKey, readActivePseudo, writeActivePseudo } from '../cloud/identity'
import { adoptCloud, setAutoPushKey } from '../cloud/sync-service'
import { askPseudo } from '../ui/pseudo-prompt'
import type { StampedSave } from '../core/save'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'

// Écran-titre volontairement NU : quelques boutons, aucun texte explicatif.
//
// IDENTITÉ = LE PSEUDO (choix du user, cf. cloud/identity.ts). Taper son pseudo suffit à retrouver sa
// partie sur n'importe quel appareil ; il n'y a aucun mot de passe, donc aucune preuve d'identité —
// quiconque connaît un pseudo peut reprendre la partie correspondante. C'est assumé.
export class TitleScene extends Phaser.Scene {
  constructor() { super('Title') }

  private status?: Phaser.GameObjects.Text

  // Une sauvegarde corrompue ou d'une version future ferait planter load() ; on la traite comme
  // "pas de sauvegarde" plutôt que de bloquer le jeu au démarrage.
  private safeLoad(): PlayerState | null {
    try {
      return load()
    } catch {
      return null
    }
  }

  create() {
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts)
    centerCamera(this)
    // déblocage audio iOS/Safari : le contexte ne peut (re)démarrer que sur un geste utilisateur
    this.input.once('pointerdown', () => audio.unlock())
    audio.playMusic('titre')

    this.add.image(480, 270, 'splash').setDisplaySize(VIEW_W, VIEW_H)
    this.add.rectangle(480, 56, 960, 112, 0x000000, 0.18)

    const logo = this.add.text(480, 96, 'PANDA-RUN', {
      fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '82px', fontStyle: 'bold', color: '#ffd54f',
    }).setOrigin(0.5)
    logo.setStroke('#3a1d00', 11)
    logo.setShadow(0, 8, '#00000088', 10, true, true)
    try {
      const grad = logo.context.createLinearGradient(0, 0, 0, logo.height)
      grad.addColorStop(0, '#fffde7')
      grad.addColorStop(0.5, '#ffd54f')
      grad.addColorStop(1, '#ff8f00')
      logo.setColor(grad as unknown as string)
    } catch { /* fallback : couleur pleine */ }
    this.tweens.add({ targets: logo, scale: 1.03, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.inOut' })

    this.add.text(10, 8, `build ${BUILD}`, { fontSize: '16px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0, 0)

    const muteBtn = this.add.text(944, 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '22px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      audio.unlock()
      muteBtn.setText(audio.toggleMute() ? '🔇' : '🔊')
    })

    this.status = this.add.text(480, 496, '', { fontSize: '15px', color: '#e1f5fe', fontStyle: 'bold', align: 'center', wordWrap: { width: 700 } })
      .setOrigin(0.5).setShadow(0, 1, '#000000aa', 2)

    const existing = this.safeLoad()
    // Le pseudo de cet appareil est déjà connu : les sauvegardes en cours de partie partent
    // automatiquement au cloud, sans que le joueur ait à retaper quoi que ce soit.
    const active = readActivePseudo()
    if (active) setAutoPushKey(pseudoKey(active))
    // identité anonyme silencieuse : elle ne sert PAS d'identité (c'est le pseudo), seulement de
    // barrière anti-abus exigée par les règles Firestore
    if (cloudAvailable()) void ensureUser()

    let y = existing ? 196 : 226
    const step = 68

    if (existing) {
      this.mkButton(y, `Continuer${active ? ` — ${active}` : ''}`, () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
      y += step
    }

    this.mkButton(y, 'Nouvelle partie', () => void this.newGame())
    y += step

    if (cloudAvailable()) {
      this.mkButton(y, 'Reprendre mon pseudo', () => void this.resume())
      y += step
      this.mkButton(y, '🏆 Classement', () => this.scene.start('Leaderboard', { return: 'Title' }))
    }
  }

  private say(msg: string, color = '#e1f5fe') {
    this.status?.setColor(color).setText(msg)
  }

  // NOUVELLE PARTIE — on demande le pseudo, puis on vérifie s'il porte DÉJÀ une partie en ligne.
  // Sans ce garde-fou, taper un pseudo déjà utilisé écraserait la partie sans un mot.
  private async newGame() {
    const pseudo = await askPseudo(readActivePseudo() ?? '')
    if (pseudo === null) return
    const key = pseudoKey(pseudo)

    if (cloudAvailable()) {
      this.say('Vérification du pseudo…')
      try {
        await ensureUser()
        const cloud = await pull(key)
        if (cloud) {
          this.askExisting(pseudo, key, cloud)
          return
        }
      } catch (e) {
        // hors réseau : on ne bloque pas la création d'une partie locale
        logEvent('warn', 'cloud', `vérification pseudo impossible : ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    this.startFresh(pseudo, key)
  }

  private startFresh(pseudo: string, key: string) {
    const p = newPlayer(pseudo)
    setPlayer(p)
    save(p)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    this.scene.start('LevelIntro', { levelId: 'plaine-1', fromNode: 'plaine-1', targetNode: 'plaine-1', dir: 'forward' })
  }

  // REPRENDRE — le cœur du « je retrouve ma partie sur un autre téléphone ».
  private async resume() {
    const pseudo = await askPseudo(readActivePseudo() ?? '')
    if (pseudo === null) return
    const key = pseudoKey(pseudo)
    this.say('Recherche de ta partie…')
    try {
      await ensureUser()
      const cloud = await pull(key)
      if (!cloud) {
        this.say(`Aucune partie en ligne pour « ${pseudo} ».`, '#ffcc80')
        return
      }
      this.adopt(pseudo, key, cloud)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logEvent('error', 'cloud', msg)
      this.say(`Impossible de récupérer la partie : ${msg}`, '#ffab91')
    }
  }

  private adopt(pseudo: string, key: string, cloud: StampedSave) {
    adoptCloud(cloud)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    setPlayer(cloud.player)
    this.scene.start('WorldMap')
  }

  // Le pseudo demandé porte déjà une partie : on ne décide pas à la place du joueur.
  private askExisting(pseudo: string, key: string, cloud: StampedSave) {
    const depth = 60
    const items: Phaser.GameObjects.GameObject[] = []
    const d = cloud.savedAt ? new Date(cloud.savedAt).toLocaleString('fr-FR') : 'date inconnue'

    items.push(this.add.rectangle(480, 270, 700, 320, 0x0d1b2a, 0.97).setDepth(depth).setStrokeStyle(2, 0xffd54f, 0.7))
    items.push(this.add.text(480, 150, `« ${pseudo} » a déjà une partie`, { fontSize: '24px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 1))
    items.push(this.add.text(480, 196, `Niveau ${cloud.player.level} · ${cloud.player.gold} or · ${cloud.player.completedLevels.length} terrains\n${d}`, {
      fontSize: '16px', color: '#e1f5fe', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 1))

    const btn = (y: number, label: string, color: number, onTap: () => void) => {
      items.push(this.add.text(480, y, label, {
        fontSize: '19px', color: '#ffffff', fontStyle: 'bold',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}`, padding: { x: 18, y: 11 },
      }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        for (const it of items) it.destroy()
        onTap()
      }))
    }
    btn(266, 'Reprendre cette partie', 0x2e7d32, () => this.adopt(pseudo, key, cloud))
    btn(330, 'Recommencer à zéro (écrase)', 0x8e2f2f, () => this.startFresh(pseudo, key))
    btn(390, 'Annuler', 0x455a64, () => { /* le panneau est déjà détruit */ })
  }

  private mkButton(y: number, label: string, onTap: () => void) {
    const w = 400, h = 56
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
    const t = this.add.text(0, 0, label, { fontSize: '25px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    t.setShadow(0, 2, '#00000099', 3, false, true)
    c.add([bg, t])
    c.setSize(w, h).setInteractive({ useHandCursor: true })
    c.on('pointerover', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.04) })
    c.on('pointerout', () => { paint(0x2e7d32, 0xa5d6a7); c.setScale(1) })
    c.on('pointerdown', () => { paint(0x1b5e20, 0xa5d6a7); c.setScale(0.97); onTap() })
    c.on('pointerup', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.04) })
    return { container: c, label: t }
  }
}
