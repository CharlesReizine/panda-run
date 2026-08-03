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
import { DESIGN_RIGHT, VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'

// Écran-titre volontairement NU : quelques boutons, aucun texte explicatif.
//
// IDENTITÉ = LE PSEUDO (choix du user, cf. cloud/identity.ts). Taper son pseudo suffit à retrouver sa
// partie sur n'importe quel appareil ; il n'y a aucun mot de passe, donc aucune preuve d'identité —
// quiconque connaît un pseudo peut reprendre la partie correspondante. C'est assumé.
/**
 * Délai au-delà duquel on cesse d'attendre le cloud.
 *
 * ⚠️ IL N'Y EN AVAIT AUCUN — c'est ça, le « ça met des plombes de retrouver la partie ». Un `await` sur
 * une lecture réseau n'a pas de fin : si la connexion anonyme traîne ou si Firestore ne répond pas,
 * l'écran reste sur « Recherche de… » indéfiniment, sans que rien n'indique quoi que ce soit. La taille
 * de la base n'y est pour rien (deux documents) : le coût est dans l'établissement de la connexion, pas
 * dans la requête. Passé ce délai, on reprend la sauvegarde LOCALE — qui est de toute façon la plus
 * récente neuf fois sur dix, la synchro se faisant en arrière-plan.
 */
const DELAI_CLOUD_MS = 6000

/** Renvoie `null` au lieu d'attendre indéfiniment. La promesse continue sa vie, on ne l'écoute plus. */
function avecDelai<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title') }

  private status?: Phaser.GameObjects.Text
  // Anti-réentrance : « Commencer » enchaîne des await (saisie du pseudo, réseau). Sans ce verrou, un
  // second appui lance un deuxième flux ; le premier part sur une autre scène et le second se réveille
  // ensuite pour écrire dans des objets DÉTRUITS → « null is not an object (this.data.drawImage) ».
  // C'est le garde que la fusion des deux anciens boutons en un seul avait fait disparaître.
  private busy = false
  // Vrai dès qu'on a quitté cet écran : toute continuation asynchrone en vol doit se taire.
  private left = false

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
    this.add.rectangle(480, 56, VIEW_W, 112, 0x000000, 0.18) // VIEW_W : la plaque s'arrêtait 209 px avant le bord droit

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


    const muteBtn = this.add.text(DESIGN_RIGHT - 16, 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '22px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      audio.unlock()
      muteBtn.setText(audio.toggleMute() ? '🔇' : '🔊')
    })

    this.busy = false
    this.left = false
    this.events.once('shutdown', () => { this.status = undefined })
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

    let y = existing ? 214 : 240
    const step = 70

    // DEUX chemins explicites (demande du user). Le bouton unique « Commencer » devinait tout seul,
    // mais du coup on ne pouvait plus dire « je veux repartir de zéro » — et surtout rien ne
    // prévenait avant d'écraser. Séparés, chaque bouton peut poser LA bonne question.
    this.mkButton(y, 'Continuer', () => void this.guard(() => this.continueGame()))
    y += step
    this.mkButton(y, 'Nouvelle partie', () => void this.guard(() => this.newGame()))
    y += step

    if (cloudAvailable()) {
      this.mkButton(y, '🏆 Classement', () => {
        if (this.busy || this.left) return
        this.left = true
        this.scene.start('Leaderboard', { return: 'Title' })
      })
    }
  }

  private say(msg: string, color = '#e1f5fe') {
    if (this.left || !this.status || !this.status.active || !this.scene.isActive()) return
    this.status.setColor(color).setText(msg)
  }

  // Verrou commun : ces flux enchaînent des await (saisie, réseau). Sans lui, deux appuis lancent
  // deux flux et le second écrit dans une scène déjà quittée.
  private async guard(fn: () => Promise<void>) {
    if (this.busy || this.left) return
    this.busy = true
    try { await fn() } finally { this.busy = false }
  }

  // CONTINUER — on cherche la partie du pseudo. Si elle n'existe pas, on ne se contente PAS d'un
  // message d'erreur : on propose d'en créer une avec ce pseudo (demande du user).
  private async continueGame() {
    const pseudo = await askPseudo(readActivePseudo() ?? '')
    if (pseudo === null) return
    const key = pseudoKey(pseudo)

    // pas de cloud configuré : on reprend la sauvegarde locale s'il y en a une
    if (!cloudAvailable()) {
      const local = this.safeLoad()
      if (local) { setPlayer(local); writeActivePseudo(pseudo); this.left = true; this.scene.start('WorldMap'); return }
      this.confirmNewGame(pseudo, key)
      return
    }

    this.say(`Recherche de « ${pseudo} »…`)
    try {
      const cloud = await avecDelai(ensureUser().then(() => pull(key)), DELAI_CLOUD_MS)
      if (cloud) { this.adopt(pseudo, key, cloud); return }
      // ⚠️ PAS DE CLOUD ≠ PAS DE PARTIE. On proposait directement d'en créer une : quand la recherche
      // échouait — réseau lent, coupure, connexion anonyme qui traîne — le joueur se voyait offrir un
      // écran « nouvelle partie » alors que sa sauvegarde existait, intacte, à quelques mètres de là.
      // On regarde donc TOUJOURS le local avant de conclure quoi que ce soit.
      const local = this.safeLoad()
      if (local) { setPlayer(local); writeActivePseudo(pseudo); setAutoPushKey(key); this.left = true; this.scene.start('WorldMap'); return }
      this.confirmNewGame(pseudo, key)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logEvent('error', 'cloud', msg)
      // même règle en cas d'erreur franche : la partie locale prime sur un message d'échec
      const local = this.safeLoad()
      if (local) { setPlayer(local); writeActivePseudo(pseudo); setAutoPushKey(key); this.left = true; this.scene.start('WorldMap'); return }
      this.say(`Impossible de vérifier : ${msg}`, '#ffab91')
    }
  }

  // NOUVELLE PARTIE — si le pseudo porte DÉJÀ une partie, on demande avant d'écraser.
  private async newGame() {
    const pseudo = await askPseudo(readActivePseudo() ?? '')
    if (pseudo === null) return
    const key = pseudoKey(pseudo)

    if (!cloudAvailable()) { this.startFresh(pseudo, key); return }

    this.say(`Vérification de « ${pseudo} »…`)
    try {
      const cloud = await avecDelai(ensureUser().then(() => pull(key)), DELAI_CLOUD_MS)
      if (cloud) { this.confirmOverwrite(pseudo, key, cloud); return }
      this.startFresh(pseudo, key)
    } catch (e) {
      // hors réseau : on ne bloque pas la création, la synchro suivra
      logEvent('warn', 'cloud', `vérification impossible : ${e instanceof Error ? e.message : String(e)}`)
      this.say('Hors connexion — partie locale, synchronisée plus tard.', '#ffcc80')
      this.startFresh(pseudo, key)
    }
  }

  // Panneau de confirmation générique : un titre, un corps, et deux à trois choix.
  private ask(title: string, body: string, choices: { label: string; color: number; onPick: () => void }[]) {
    const depth = 60
    const items: Phaser.GameObjects.GameObject[] = []
    items.push(this.add.rectangle(480, 270, 700, 300, 0x0d1b2a, 0.97).setDepth(depth).setStrokeStyle(2, 0xffd54f, 0.7))
    items.push(this.add.text(480, 160, title, { fontSize: '23px', color: '#ffd54f', fontStyle: 'bold', align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5).setDepth(depth + 1))
    items.push(this.add.text(480, 214, body, { fontSize: '15px', color: '#e1f5fe', align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5).setDepth(depth + 1))
    choices.forEach((c, i) => {
      items.push(this.add.text(480, 274 + i * 52, c.label, {
        fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
        backgroundColor: `#${c.color.toString(16).padStart(6, '0')}`, padding: { x: 18, y: 10 },
      }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        for (const it of items) it.destroy()
        c.onPick()
      }))
    })
  }

  private confirmNewGame(pseudo: string, key: string) {
    this.ask(
      `« ${pseudo} » n'existe pas`,
      'Aucune partie enregistrée sous ce nom.\nVeux-tu en commencer une nouvelle avec ce pseudo ?',
      [
        { label: 'Oui, nouvelle partie', color: 0x2e7d32, onPick: () => this.startFresh(pseudo, key) },
        { label: 'Annuler', color: 0x455a64, onPick: () => this.say('') },
      ],
    )
  }

  private confirmOverwrite(pseudo: string, key: string, cloud: StampedSave) {
    const d = cloud.savedAt ? new Date(cloud.savedAt).toLocaleString('fr-FR') : 'date inconnue'
    this.ask(
      `« ${pseudo} » a déjà une partie`,
      `Niveau ${cloud.player.level} · ${cloud.player.gold} or · ${cloud.player.completedLevels.length} terrains\n${d}`,
      [
        { label: 'Reprendre cette partie', color: 0x2e7d32, onPick: () => this.adopt(pseudo, key, cloud) },
        { label: 'Écraser et recommencer', color: 0x8e2f2f, onPick: () => this.startFresh(pseudo, key) },
        { label: 'Annuler', color: 0x455a64, onPick: () => this.say('') },
      ],
    )
  }

  private startFresh(pseudo: string, key: string) {
    const p = newPlayer(pseudo)
    setPlayer(p)
    save(p)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    this.left = true
    this.scene.start('LevelIntro', { levelId: 'plaine-1', fromNode: 'plaine-1', targetNode: 'plaine-1', dir: 'forward' })
  }

  private adopt(pseudo: string, key: string, cloud: StampedSave) {
    adoptCloud(cloud)
    writeActivePseudo(pseudo)
    setAutoPushKey(key)
    setPlayer(cloud.player)
    this.left = true
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
