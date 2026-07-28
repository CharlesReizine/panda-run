import Phaser from 'phaser'
import { load, serialize, deserialize, save } from '../core/save'
import { newPlayer, type PlayerState } from '../core/player-state'
import { setPlayer } from '../state'
import { audio } from '../audio/audio-engine'
import { showLogsOverlay } from '../ui/error-overlay'
import { clearLogs, logEvent } from '../core/logger'

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
    this.add.text(10, 8, 'build R274', { fontSize: '16px', color: '#ffeb3b', fontStyle: 'bold' }).setOrigin(0, 0)

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

    // ─── TÉLÉCHARGER L'APP (met TOUT en cache pour jouer hors connexion, ex. en avion) ───────────
    const dlStatus = this.add.text(480, 214, '', { fontSize: '15px', color: '#e1f5fe', fontStyle: 'bold' })
      .setOrigin(0.5).setShadow(0, 1, '#000000aa', 2)
    const dl = this.add.container(480, 182)
    const dlbg = this.add.graphics()
    const dw = 380, dh = 46
    const paintDl = (fill: number) => {
      dlbg.clear()
      dlbg.fillStyle(0x000000, 0.3).fillRoundedRect(-dw / 2, -dh / 2 + 3, dw, dh, 12)
      dlbg.fillStyle(fill, 1).fillRoundedRect(-dw / 2, -dh / 2, dw, dh, 12)
      dlbg.lineStyle(2, 0x81d4fa, 1).strokeRoundedRect(-dw / 2, -dh / 2, dw, dh, 12)
    }
    paintDl(0x0277bd)
    const dlTxt = this.add.text(0, 0, '📥 Télécharger l\'app (hors-ligne)', { fontSize: '19px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    dlTxt.setShadow(0, 2, '#00000099', 3, false, true)
    dl.add([dlbg, dlTxt])
    dl.setSize(dw, dh).setInteractive({ useHandCursor: true })
    dl.on('pointerover', () => paintDl(0x0288d1))
    dl.on('pointerout', () => paintDl(0x0277bd))
    let dling = false
    dl.on('pointerdown', async () => {
      if (dling) return
      dling = true
      try {
        paintDl(0x01579b)
        dlTxt.setText('⏳ Téléchargement en cours…')
        await this.downloadOffline(dlStatus)
        this.showInstallHelp()
      } catch (e) {
        logEvent('error', 'download-btn', e instanceof Error ? e.message : String(e))
        dlStatus.setColor('#ffab91').setText(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        dlTxt.setText('📥 Re-télécharger')
        paintDl(0x0277bd)
        dling = false
      }
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

  // Télécharge TOUS les assets (art + audio) via le service worker → mis en cache CacheFirst, donc
  // ensuite dispo hors ligne, y compris les terrains/mobs jamais vus. Best-effort, 6 en parallèle,
  // progression affichée. À faire EN LIGNE une fois avant l'avion.
  private async downloadOffline(status: Phaser.GameObjects.Text) {
    try {
      const res = await fetch('asset-manifest.json', { cache: 'reload' })
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`)
      const list = (await res.json()) as string[]
      const total = list.length
      let done = 0
      let failed = 0
      status.setColor('#e1f5fe').setText(`0 / ${total}`)
      const queue = list.slice()
      const worker = async () => {
        while (queue.length) {
          const url = queue.shift()!
          try { const r = await fetch(url); await r.blob() } catch { failed++ }
          done++
          if (done % 4 === 0 || done === total) status.setText(`${done} / ${total}`)
        }
      }
      await Promise.all(Array.from({ length: 6 }, () => worker()))
      status.setColor(failed ? '#ffcc80' : '#a5d6a7')
        .setText(failed ? `Fini avec ${failed} échec(s) sur ${total} — réessaie` : `✓ ${total} fichiers en cache — prêt hors-ligne !`)
    } catch (e) {
      // On MONTRE la vraie erreur dans la ligne de statut (iOS masque souvent en « Script error. »)
      const msg = e instanceof Error ? e.message : String(e)
      logEvent('error', 'download', msg)
      status.setColor('#ffab91').setText(`Échec : ${msg}`)
    }
  }

  // Explique quoi faire APRÈS le téléchargement : installer en vraie app (Ajouter à l'écran d'accueil).
  private showInstallHelp() {
    const c = this.add.container(0, 0).setDepth(2000)
    const backdrop = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.82).setInteractive()
    const card = this.add.rectangle(480, 270, 660, 390, 0x102a3a, 0.99).setStrokeStyle(3, 0x4fc3f7, 0.95)
    const title = this.add.text(480, 112, '✓ Jeu téléchargé — installe l\'app', { fontSize: '23px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5)
    const body = this.add.text(480, 266,
      'Pour jouer hors connexion (avion) comme une vraie app :\n\n' +
      '1.   Bouton PARTAGER de Safari  (carré + flèche ⬆)\n' +
      '2.   « Sur l\'écran d\'accueil »   →   Ajouter\n' +
      '3.   Lance Panda-Run depuis la nouvelle icône\n' +
      '      (plein écran, sans barre Safari)\n\n' +
      'Tout est déjà en cache : ça tourne en mode Avion,\n' +
      'y compris les terrains et monstres jamais vus. 🛫', {
      fontSize: '16px', color: '#e8f4fb', align: 'center', lineSpacing: 5,
    }).setOrigin(0.5)
    const okBtn = this.add.rectangle(480, 414, 210, 46, 0x00838f, 0.98).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({ useHandCursor: true })
    const okTxt = this.add.text(480, 414, 'Compris !', { fontSize: '17px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    c.add([backdrop, card, title, body, okBtn, okTxt])
    const close = () => c.destroy()
    okBtn.on('pointerdown', close)
    backdrop.on('pointerdown', close)
  }
}
