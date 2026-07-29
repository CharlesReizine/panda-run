import Phaser from 'phaser'
import { load, serialize, deserialize, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'
import { audio } from '../audio/audio-engine'
import { showLogsOverlay } from '../ui/error-overlay'
import { clearLogs, logEvent } from '../core/logger'
import { BUILD } from '../core/build'
import { cloudAvailable, prewarm, authReady, signInPopup, signInRedirect, completeRedirect, signOutCloud, onUser, PopupRefusedError, type CloudUser } from '../cloud/auth'
import { syncNow, adoptCloud, pushLocal, setAutoPushUser } from '../cloud/sync-service'
import type { StampedSave } from '../core/save'

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
    this.add.text(10, 8, `build ${BUILD}`, { fontSize: '16px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0, 0)

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

    this.addCloudRow()
  }

  // ─── SAUVEGARDE CLOUD (connexion Google) ────────────────────────────────────────────────────
  // Ligne d'état + bouton à la charte Google. Rien de bloquant : si le cloud n'est pas configuré
  // (pas de .env), on n'affiche RIEN et le jeu reste exactement celui d'avant.
  private addCloudRow() {
    if (!cloudAvailable()) return

    // ⚠️ ON PRÉCHARGE LE SDK TOUT DE SUITE. signInWithPopup doit être appelé synchronement dans le
    // geste utilisateur : si le clic doit d'abord attendre l'import dynamique du SDK, le navigateur
    // ne relie plus l'ouverture au clic et BLOQUE la popup (bug constaté en R275).
    void prewarm()

    const status = this.add.text(480, 236, '', { fontSize: '15px', color: '#e1f5fe', fontStyle: 'bold', align: 'center', wordWrap: { width: 640 } })
      .setOrigin(0.5).setShadow(0, 1, '#000000aa', 2)

    // Bouton « Se connecter avec Google » aux couleurs de la charte : fond blanc, texte #3c4043,
    // bordure #dadce0, logo G officiel à gauche.
    const btn = this.add.container(480, 300)
    const bw = 330, bh = 50
    const bg = this.add.graphics()
    const paint = (fill: number) => {
      bg.clear()
      bg.fillStyle(0x000000, 0.3).fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 6)
      bg.fillStyle(fill, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6)
      bg.lineStyle(1, 0xdadce0, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6)
    }
    paint(0xffffff)
    const logo = this.add.image(-bw / 2 + 30, 0, 'google-g').setDisplaySize(22, 22)
    const label = this.add.text(6, 0, 'Se connecter avec Google', {
      fontSize: '18px', color: '#3c4043', fontStyle: 'bold',
    }).setOrigin(0.5)
    btn.add([bg, logo, label])
    btn.setSize(bw, bh).setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => paint(0xf7f8f8))
    btn.on('pointerout', () => paint(0xffffff))

    // Avertissement EXPLICITE quand la partie n'existe qu'en local : c'est tout l'intérêt de la
    // fonctionnalité, et le joueur doit savoir qu'il joue sans filet.
    const showSignedOut = () => {
      status.setColor('#ffcc80').setText('⚠️ Sauvegarde locale uniquement — elle peut disparaître\n(cache vidé, réinstallation). Connecte-toi pour la mettre à l\'abri.')
      logo.setVisible(true)
      label.setText('Se connecter avec Google').setColor('#3c4043').setX(6)
      paint(0xffffff)
    }
    const showSignedIn = (u: CloudUser) => {
      status.setColor('#a5d6a7').setText(`☁️ Sauvegarde en ligne active — ${u.email ?? u.uid}`)
      logo.setVisible(false)
      label.setText('Se déconnecter').setColor('#ffffff').setX(0)
      paint(0x455a64)
    }

    let user: CloudUser | null = null
    let busy = false
    showSignedOut()

    // Un flux redirect entamé avant le rechargement se termine ici (repli quand la popup est refusée).
    void completeRedirect().then((u) => { if (u) { user = u; setAutoPushUser(u.uid); showSignedIn(u); void this.runSync(u, status) } })

    // La restauration de session est ASYNCHRONE : au premier affichage on ne sait pas encore si le
    // joueur est connecté. onUser recale l'affichage dès que Firebase a tranché.
    void onUser((u) => {
      user = u
      setAutoPushUser(u?.uid ?? null)
      if (u) { showSignedIn(u); void this.runSync(u, status) } else showSignedOut()
    })

    btn.on('pointerdown', () => {
      if (busy) return
      busy = true
      void (async () => {
        try {
          if (user) {
            await signOutCloud()
            user = null
            setAutoPushUser(null)
            showSignedOut()
            return
          }
          // Le SDK n'est pas encore prêt : impossible d'ouvrir une popup dans le geste, on part
          // directement en redirect plutôt que de se faire bloquer.
          if (!authReady()) {
            status.setColor('#e1f5fe').setText('Redirection vers Google…')
            await signInRedirect()
            return
          }
          status.setColor('#e1f5fe').setText('Connexion en cours…')
          const u = await signInPopup()
          user = u
          setAutoPushUser(u.uid)
          showSignedIn(u)
          await this.runSync(u, status)
        } catch (e) {
          if (e instanceof PopupRefusedError) {
            // la plateforme refuse les popups (cas possible en PWA iOS installée) → redirect
            logEvent('warn', 'cloud-auth', `popup refusée (${e.code}) → redirect`)
            status.setColor('#e1f5fe').setText('Popup bloquée — redirection vers Google…')
            try {
              await signInRedirect()
              return
            } catch (e2) {
              const m2 = e2 instanceof Error ? e2.message : String(e2)
              logEvent('error', 'cloud-auth', `redirect KO : ${m2}`)
              status.setColor('#ffab91').setText(`Connexion impossible : ${m2}`)
              return
            }
          }
          const msg = e instanceof Error ? e.message : String(e)
          // « popup-closed-by-user » = le joueur a fermé la fenêtre : ce n'est pas une erreur
          if ((e as { code?: string }).code === 'auth/cancelled-popup-request' || (e as { code?: string }).code === 'auth/popup-closed-by-user') {
            showSignedOut()
            return
          }
          logEvent('error', 'cloud-auth', msg)
          status.setColor('#ffab91').setText(`Échec de connexion : ${msg}`)
        } finally {
          busy = false
        }
      })()
    })
  }

  // Applique la décision de synchro. Le seul cas non automatique — les deux côtés ont divergé — passe
  // par un panneau de choix : on ne détruit JAMAIS une progression sans l'accord du joueur.
  private async runSync(u: CloudUser, status: Phaser.GameObjects.Text) {
    try {
      const out = await syncNow(u.uid)
      switch (out.action) {
        case 'prendre-le-cloud':
          status.setColor('#a5d6a7').setText('☁️ Partie du cloud récupérée')
          this.scene.restart() // la save locale a changé → l'écran-titre doit se reconstruire
          break
        case 'pousser-le-local':
        case 'garder-le-local':
          status.setColor('#a5d6a7').setText(`☁️ Partie sauvegardée en ligne — ${u.email ?? u.uid}`)
          break
        case 'rien':
          status.setColor('#a5d6a7').setText(`☁️ À jour — ${u.email ?? u.uid}`)
          break
        case 'demander':
          this.askWhichSave(u, out.local!, out.cloud!)
          break
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logEvent('error', 'cloud-sync', msg)
      status.setColor('#ffab91').setText(`Synchro impossible : ${msg}`)
    }
  }

  private describe(s: StampedSave): string {
    const d = s.savedAt ? new Date(s.savedAt).toLocaleString('fr-FR') : 'date inconnue'
    return `Niveau ${s.player.level} · ${s.player.gold} or · ${s.player.completedLevels.length} terrains\n${d}`
  }

  // Panneau de choix : les deux appareils ont progressé depuis la dernière synchro, aucune des deux
  // parties n'est « la bonne » — seul le joueur peut trancher.
  private askWhichSave(u: CloudUser, local: StampedSave, cloud: StampedSave) {
    const depth = 60
    const items: Phaser.GameObjects.GameObject[] = []
    items.push(this.add.rectangle(480, 270, 700, 380, 0x0d1b2a, 0.96).setDepth(depth).setStrokeStyle(2, 0xffd54f, 0.7))
    items.push(this.add.text(480, 120, 'Deux parties différentes', { fontSize: '26px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 1))
    items.push(this.add.text(480, 168, 'Tu as joué sur cet appareil ET ailleurs depuis la dernière\nsynchro. Laquelle veux-tu garder ? L\'autre sera écrasée.', { fontSize: '15px', color: '#e1f5fe', align: 'center' }).setOrigin(0.5).setDepth(depth + 1))

    const choice = (y: number, label: string, s: StampedSave, color: number, onPick: () => void) => {
      items.push(this.add.text(480, y, `${label}\n${this.describe(s)}`, {
        fontSize: '16px', color: '#ffffff', fontStyle: 'bold', align: 'center',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}`, padding: { x: 16, y: 10 },
      }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        for (const it of items) it.destroy()
        onPick()
      }))
    }

    choice(268, 'Garder celle de CET APPAREIL', local, 0x2e7d32, () => {
      void pushLocal(u.uid, local).catch(() => { /* réseau : sera repoussé plus tard */ })
    })
    choice(392, 'Prendre celle du CLOUD', cloud, 0x1565c0, () => {
      adoptCloud(cloud)
      this.scene.restart()
    })
  }

}
