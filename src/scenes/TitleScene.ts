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
import { installUiClickSound } from '../ui/click-sound'

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
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
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

    let y = existing ? 226 : 256
    const step = 70

    // Chemin le plus rapide : la partie de cet appareil, sans réseau ni saisie.
    if (existing) {
      this.mkButton(y, `Continuer${active ? ` — ${active}` : ''}`, () => {
        setPlayer(existing)
        this.scene.start('WorldMap')
      })
      y += step
    }

    // UN SEUL bouton pour tout le reste. Avant, « Nouvelle partie » et « Reprendre mon pseudo »
    // faisaient taper le même nom deux fois pour deux chemins qui ne diffèrent que par l'existence
    // d'une partie — une question à laquelle le jeu peut répondre tout seul.
    this.mkButton(y, 'Commencer', () => void this.start())
    y += step

    if (cloudAvailable()) this.mkButton(y, '🏆 Classement', () => this.scene.start('Leaderboard', { return: 'Title' }))
  }

  private say(msg: string, color = '#e1f5fe') {
    this.status?.setColor(color).setText(msg)
  }

  // COMMENCER — on demande le nom une seule fois, puis le jeu décide : une partie existe pour ce
  // nom → on la reprend en le signalant ; sinon → on la crée. AUCUN des deux chemins ne détruit
  // quoi que ce soit, donc rien à faire confirmer.
  private async start() {
    const pseudo = await askPseudo(readActivePseudo() ?? '')
    if (pseudo === null) return
    const key = pseudoKey(pseudo)

    if (!cloudAvailable()) { this.startFresh(pseudo, key); return }

    this.say(`Recherche de « ${pseudo} »…`)
    try {
      await ensureUser()
      const cloud = await pull(key)
      if (cloud) {
        this.say(`Bon retour ${pseudo} — niveau ${cloud.player.level} retrouvé.`, '#a5d6a7')
        this.adopt(pseudo, key, cloud)
        return
      }
      this.say(`Nouveau joueur « ${pseudo} » — c'est parti !`, '#a5d6a7')
      this.startFresh(pseudo, key)
    } catch (e) {
      // hors réseau : on ne bloque pas le joueur, on démarre en local (la synchro suivra)
      const msg = e instanceof Error ? e.message : String(e)
      logEvent('warn', 'cloud', `recherche impossible : ${msg}`)
      this.say('Hors connexion — partie locale, elle sera synchronisée plus tard.', '#ffcc80')
      this.startFresh(pseudo, key)
    }
  }

  private startFresh(pseudo: string, key: string) {
    const p = newPlayer(pseudo)
    setPlayer(p)
    save(p)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    this.scene.start('LevelIntro', { levelId: 'plaine-1', fromNode: 'plaine-1', targetNode: 'plaine-1', dir: 'forward' })
  }

  private adopt(pseudo: string, key: string, cloud: StampedSave) {
    adoptCloud(cloud)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    setPlayer(cloud.player)
    this.scene.start('WorldMap')
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
