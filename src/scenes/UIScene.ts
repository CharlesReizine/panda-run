import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { getPlayer } from '../state'
import { xpToNext } from '../core/progression'
import { audio } from '../audio/audio-engine'
import type { LevelScene } from './LevelScene'

const BAR_W = 200
const SLOT_SIZE = 50
const SLOT_Y = 54 // abaissé pour laisser la place au titre « Pouvoirs » au-dessus des 4 cases
// Barre de skills DÉCALÉE VERS LA GAUCHE : les slots empiétaient sur le bouton PAUSE (⏸ à ~908).
// Le 4e slot (i=3) se termine désormais à ~841px, bien à gauche de PAUSE.
const SLOT_X0 = 636

export class UIScene extends Phaser.Scene {
  joystick?: VirtualJoystick
  private hpBar!: Phaser.GameObjects.Rectangle
  private energyBar!: Phaser.GameObjects.Rectangle
  private xpBar!: Phaser.GameObjects.Rectangle
  private goldText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private potionText!: Phaser.GameObjects.Text
  private slotCooldownOverlays: Phaser.GameObjects.Rectangle[] = []
  private slotIcons: Phaser.GameObjects.Image[] = []
  private cooldownUntil: number[] = [0, 0, 0, 0]
  private cooldownDur: number[] = [0, 0, 0, 0] // durée totale du dernier cooldown par slot (pour le dégrisé)
  // indicateur de buff ATK (Cri de guerre)
  private buffParts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = []
  private buffBar!: Phaser.GameObjects.Rectangle
  private buffUntil = 0
  private buffDuration = 0
  // badge « points à dépenser » : pastille dorée pulsante collée au panneau de vie
  private spBadge!: Phaser.GameObjects.Container
  private spBadgeText!: Phaser.GameObjects.Text
  private skillsBtn!: Phaser.GameObjects.Rectangle
  private skillsBtnText!: Phaser.GameObjects.Text
  private skillsBtnBlink?: Phaser.Tweens.Tween

  // clé de la scène de jeu qui a lancé ce HUD ('Level' par défaut, 'Training' en entraînement) :
  // on branche barres/énergie et pauses dessus. `training` masque les overlays inadaptés (pause,
  // gestion des compétences, inventaire) dont le retour est câblé en dur sur 'Level'.
  private levelKey = 'Level'
  private training = false

  constructor() { super('UI') }

  init(data?: { levelKey?: string; training?: boolean }) {
    this.levelKey = data?.levelKey ?? 'Level'
    this.training = !!data?.training
  }

  create() {
    // Scène réutilisée à chaque niveau (launch depuis LevelScene) : ces tableaux sont des
    // class fields initialisés une seule fois à l'instanciation, pas à chaque create().
    // Sans reset, refresh()/update() continuent de cibler les objets détruits du niveau précédent.
    this.slotIcons = []
    this.slotCooldownOverlays = []
    this.cooldownUntil = [0, 0, 0, 0]
    this.cooldownDur = [0, 0, 0, 0]
    this.buffParts = []
    this.buffUntil = 0
    this.buffDuration = 0

    this.input.addPointer(3)
    this.joystick = new VirtualJoystick(this, new Phaser.Geom.Rectangle(0, 100, 400, 440))

    // Haut-gauche : panneau semi-opaque (lisibilité sur n'importe quel biome) regroupant
    // niveau + or, puis barres vie (rouge) / énergie (bleue) / XP (jaune) empilées et distinctes.
    this.add.rectangle(8, 2, BAR_W + 16, 78, 0x0d1b2a, 0.6).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.25)
    this.levelText = this.add.text(16, 6, '', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
    this.goldText = this.add.text(132, 7, '', { fontSize: '13px', color: '#ffd700' })

    this.add.rectangle(14, 26, BAR_W + 4, 14, 0x000000, 0.6).setOrigin(0)
    this.hpBar = this.add.rectangle(16, 27, BAR_W, 12, 0xe53935).setOrigin(0)
    this.add.rectangle(14, 44, BAR_W + 4, 12, 0x000000, 0.6).setOrigin(0)
    this.energyBar = this.add.rectangle(16, 46, BAR_W, 8, 0x29b6f6).setOrigin(0)
    this.add.rectangle(14, 60, BAR_W + 4, 6, 0x000000, 0.6).setOrigin(0)
    this.xpBar = this.add.rectangle(16, 61, BAR_W, 4, 0xfdd835).setOrigin(0)

    // toucher le panneau (barres) ouvre la gestion des skills en jeu — dispo AUSSI en entraînement
    // (on veut y tester/échanger ses skills) : SkillEquip reçoit désormais la clé de scène à reprendre
    // (Level ou Training) et n'écrit pas la sauvegarde en mode training → plus de soft-lock.
    this.add.rectangle(8, 2, BAR_W + 16, 78, 0xffffff, 0.001).setOrigin(0).setInteractive()
      .on('pointerdown', () => this.openSkillMenu())
    this.add.text(16, 68, 'compétences ▸', { fontSize: '10px', color: '#b0bec5' })

    // Badge « points à dépenser » : JUSTE à droite du panneau de vie, pastille dorée pulsante
    // avec une flèche qui pointe vers le panneau (où l'on ouvre le menu). Masqué s'il n'y a
    // aucun point. Cliquer dessus ouvre le même menu des compétences que la barre de vie.
    // badge « point(s) de compétence dispo » : placé SOUS les slots de skills / le bouton Compétences
    // (haut-droite), et non plus près de la barre de vie — c'est là qu'on gère les compétences.
    this.spBadge = this.add.container(40, 116).setDepth(60)
    const badgeBg = this.add.rectangle(76, 0, 152, 32, 0xffca28, 0.97).setStrokeStyle(2, 0x7a4f00, 1)
    const badgeArrow = this.add.text(-4, 0, '◀', { fontSize: '20px', color: '#ffca28', fontStyle: 'bold', stroke: '#3a2600', strokeThickness: 4 }).setOrigin(1, 0.5)
    this.spBadgeText = this.add.text(14, 0, '', { fontSize: '15px', color: '#3a2600', fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.spBadge.add([badgeBg, badgeArrow, this.spBadgeText])
    badgeBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.spBadge.visible) this.openSkillMenu() })
    this.spBadge.setVisible(false)
    // pulsation permanente (clignotement + gonflement) : impossible à rater sur tous les biomes
    this.tweens.add({ targets: this.spBadge, scale: 1.14, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.tweens.add({ targets: badgeBg, fillAlpha: 0.55, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    // pastille de buff ATK : masquée par défaut, affichée avec un compte à rebours tant que le buff est actif
    const bx = 12, by = 86, bw = 104, bh = 24
    const buffBg = this.add.rectangle(bx, by, bw, bh, 0xff8f00, 0.9).setOrigin(0).setStrokeStyle(2, 0xffe082, 0.8)
    const buffLabel = this.add.text(bx + 8, by + 4, '⚔ ATK+', { fontSize: '13px', color: '#3a2600', fontStyle: 'bold' }).setOrigin(0)
    this.buffBar = this.add.rectangle(bx + 2, by + bh - 5, bw - 4, 4, 0xfff176).setOrigin(0)
    this.buffParts = [buffBg, buffLabel, this.buffBar]
    for (const o of this.buffParts) o.setVisible(false)

    // bouton muet discret (coin haut-droit), au-dessus des slots de compétences
    const muteBtn = this.add.text(944, 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '20px' })
      .setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      const muted = audio.toggleMute()
      muteBtn.setText(muted ? '🔇' : '🔊')
    })

    // bouton pause discret, juste à gauche du mute : ouvre le menu de pause par-dessus le jeu gelé
    // (masqué en entraînement : PauseScene resume/quit sur 'Level' en dur, inadapté à 'Training')
    if (!this.training) {
      const pauseBtn = this.add.text(908, 6, '⏸', { fontSize: '20px' })
        .setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true })
      pauseBtn.on('pointerdown', () => {
        audio.playSfx('ui-tap')
        this.freezeLevelForOverlay()
        this.scene.launch('Pause')
        this.scene.pause(this.levelKey)
        this.scene.pause('UI')
      })
    }

    // Haut-droite : les 4 slots de skills côte à côte, décalés à GAUCHE du bouton PAUSE (SLOT_X0).
    // Titre « POUVOIRS » centré au-dessus des 4 cases.
    this.add.text(SLOT_X0 + 1.5 * 60, SLOT_Y - SLOT_SIZE / 2 - 20, 'POUVOIRS', {
      fontSize: '13px', color: '#ffd54f', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = SLOT_X0 + i * 60
      // Zone tactile ÉLARGIE au-delà du visuel (60×66 vs 50×50) pour toucher plus facilement au
      // doigt ; 60px = l'espacement des slots → les zones se touchent sans se chevaucher.
      const slot = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff, 0.6)
        .setInteractive(new Phaser.Geom.Rectangle(-5, -16, 60, 84), Phaser.Geom.Rectangle.Contains)
      slot.on('pointerdown', () => { this.pressFx(slot); this.game.events.emit('input-skill', i) })
      this.add.text(x, SLOT_Y - SLOT_SIZE / 2 - 8, `${i + 1}`, { fontSize: '11px', color: '#ffd54f' }).setOrigin(0.5)
      this.slotIcons.push(this.add.image(x, SLOT_Y, '__DEFAULT').setDisplaySize(SLOT_SIZE - 8, SLOT_SIZE - 8).setVisible(false))
      // overlay de cooldown ANCRÉ À DROITE (origine 1) : on le rétrécit vers la droite (scaleX) au fil
      // de la recharge → il « se dégrise » horizontalement de gauche à droite jusqu'à disparaître.
      const ov = this.add.rectangle(x + SLOT_SIZE / 2, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x0d1b2a, 0.72)
        .setOrigin(1, 0.5).setVisible(false)
      this.slotCooldownOverlays.push(ov)
    }

    // bouton EXPLICITE « compétences » sous les slots (le clic sur la barre de vie l'ouvre aussi,
    // mais un bouton dédié est bien plus découvrable) — disponible en jeu ET en entraînement.
    const skillsBtn = this.add.rectangle(116, 90, 138, 24, 0x37474f, 0.9)
      .setStrokeStyle(1, 0xffffff, 0.55)
      .setInteractive(new Phaser.Geom.Rectangle(-11, -13, 160, 50), Phaser.Geom.Rectangle.Contains)
    this.skillsBtn = skillsBtn
    this.skillsBtnText = this.add.text(116, 90, '⚙ Compétences', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    skillsBtn.on('pointerdown', () => { this.pressFx(skillsBtn); this.openSkillMenu() })

    // Bas-droite : contrôles saut / attaque. Zone tactile TRÈS ÉLARGIE au-delà du disque visuel pour
    // un tap tolérant au doigt — SAUT prioritaire (le plus gros). Le disque ATTAQUE est ajouté APRÈS
    // le SAUT : dans la zone où leurs hitboxes se recouvrent, c'est ATTAQUE qui prend le tap, donc le
    // SAUT s'étale surtout vers le coin bas-droite libre sans « voler » les taps de l'attaque.
    const jump = this.add.circle(884, 468, 36, 0x1e88e5, 0.6)
      .setInteractive(new Phaser.Geom.Circle(36, 36, 66), Phaser.Geom.Circle.Contains)
    this.add.image(884, 468, 'ui-jump').setDisplaySize(34, 34)
    this.add.text(884, 510, 'SAUT', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    jump.on('pointerdown', () => { this.pressFx(jump); this.game.events.emit('input-jump-down') })
    jump.on('pointerup', () => this.game.events.emit('input-jump-up'))
    jump.on('pointerout', () => this.game.events.emit('input-jump-up'))
    const atk = this.add.circle(792, 496, 32, 0xfb8c00, 0.7)
      .setInteractive(new Phaser.Geom.Circle(32, 32, 54), Phaser.Geom.Circle.Contains)
    this.add.image(792, 496, 'ui-attack').setDisplaySize(30, 30)
    this.add.text(792, 534, 'ATTAQUE', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    atk.on('pointerdown', () => { this.pressFx(atk); this.game.events.emit('input-attack') })

    // Bas-gauche : potion. Zone tactile élargie via un rectangle invisible plus grand que l'icône.
    // Taille FIXE (indépendante de la résolution native de la texture potion-drop, désormais
    // issue d'une illustration détourée et non plus d'un dessin 16px) → icône HUD nette et stable.
    const potion = this.add.image(52, 500, 'potion-drop').setDisplaySize(56, 56)
    const potionHit = this.add.rectangle(52, 500, 92, 100, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    potionHit.on('pointerdown', () => { this.pressFx(potion); this.game.events.emit('input-potion') })
    this.potionText = this.add.text(70, 490, '', { fontSize: '16px', color: '#ffffff' })

    // bouton inventaire (icône « tenue ») : EN HAUT À GAUCHE, juste à droite du panneau de vie
    // (masqué en entraînement : InventoryScene resume 'Level' en dur → soft-lock depuis 'Training')
    if (!this.training) {
      const invBtn = this.add.image(248, 40, 'ui-inventory').setDisplaySize(42, 42).setDepth(50).setInteractive({ useHandCursor: true })
      invBtn.on('pointerdown', () => { this.pressFx(invBtn); this.openInventoryMenu() })
      this.add.text(248, 64, 'SAC', { fontSize: '10px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(50)
    }

    // Écoute des mises à jour émises par la scène de jeu (Level ou Training)
    const level = this.scene.get(this.levelKey)
    level.events.on('player-hp', this.onPlayerHp)
    level.events.on('player-buff', this.onBuff)
    level.events.on('player-buff-end', this.onBuffEnd)
    this.game.events.on('hud-refresh', this.refresh, this)
    this.game.events.on('skill-cooldown', this.onCooldown, this)
    this.game.events.on('player-level-up', this.onLevelUp, this)
    this.events.once('shutdown', () => {
      level.events.off('player-hp', this.onPlayerHp)
      level.events.off('player-buff', this.onBuff)
      level.events.off('player-buff-end', this.onBuffEnd)
      this.game.events.off('hud-refresh', this.refresh, this)
      this.game.events.off('skill-cooldown', this.onCooldown, this)
      this.game.events.off('player-level-up', this.onLevelUp, this)
    })
    this.refresh()
  }

  // Avant d'ouvrir un overlay (Pause / compétences) on remet le monde physique du niveau à
  // l'état actif : si un hit-stop venait juste de le mettre en pause, l'horloge de Level
  // (gelée par la pause de scène) ne pourrait plus déclencher sa reprise et la physique
  // resterait figée tant que le menu est ouvert. Le niveau reste bien figé par la pause de
  // scène ; on évite seulement de laisser le flag physique bloqué.
  private freezeLevelForOverlay() {
    const level = this.scene.get(this.levelKey) as LevelScene | undefined
    level?.physics?.world?.resume()
  }

  // ouvre la gestion des compétences en jeu (partagé : clic sur le panneau de vie ET sur le badge)
  private openSkillMenu() {
    audio.playSfx('ui-tap')
    this.freezeLevelForOverlay()
    this.scene.launch('SkillEquip', { levelKey: this.levelKey, training: this.training })
    // SkillEquip est déclarée AVANT TrainingScene dans main.ts : sans ceci, ouverte depuis
    // l'entraînement elle se rend DERRIÈRE l'arène (invisible) alors que le jeu est en pause →
    // soft-lock instantané (bouton « Reprendre » inatteignable). On la force au premier plan.
    this.scene.bringToTop('SkillEquip')
    this.scene.pause(this.levelKey)
    this.scene.pause('UI')
  }

  // ouvre l'écran d'inventaire dédié en jeu (overlay par-dessus le niveau en pause)
  private openInventoryMenu() {
    audio.playSfx('ui-tap')
    this.freezeLevelForOverlay()
    this.scene.launch('Inventory', { return: 'game', overlay: true })
    this.scene.pause(this.levelKey)
    this.scene.pause('UI')
  }

  // affiche/masque le badge selon les points de COMPÉTENCE non dépensés (le badge ouvre le menu
  // des compétences ; les points de STAT se gèrent depuis la carte, menu à part → pas comptés ici
  // pour ne pas afficher un total qui ne correspond pas à ce qu'on peut dépenser dans ce menu)
  private updateSkillPointBadge() {
    const p = getPlayer()
    const n = p.skillPoints
    this.spBadge.setVisible(false) // plus de pastille jaune SÉPARÉE (retour user)
    // À la place : le BOUTON « Compétences » devient JAUNE + CLIGNOTANT tant qu'il reste des points.
    if (n > 0) {
      this.skillsBtn.setFillStyle(0xffca28, 0.97).setStrokeStyle(2, 0x7a4f00, 1)
      this.skillsBtnText.setColor('#3a2600').setText(`⚙ Compétences (${n})`)
      if (!this.skillsBtnBlink) {
        this.skillsBtnBlink = this.tweens.add({ targets: [this.skillsBtn, this.skillsBtnText], alpha: 0.45, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
    } else {
      this.skillsBtnBlink?.stop(); this.skillsBtnBlink = undefined
      this.skillsBtn.setAlpha(1).setFillStyle(0x37474f, 0.9).setStrokeStyle(1, 0xffffff, 0.55)
      this.skillsBtnText.setAlpha(1).setColor('#ffffff').setText('⚙ Compétences')
    }
  }

  // pulse visuel au tap pour que chaque bouton réponde sous le doigt
  private pressFx(target: Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Text) {
    this.tweens.add({ targets: target, scale: target.scale * 0.85, duration: 60, yoyo: true })
  }

  private onPlayerHp = (hp: number, max: number) => this.hpBar.setDisplaySize(BAR_W * (hp / max), 12)

  private onCooldown(slot: number, untilMs: number, durationMs = 0) {
    this.cooldownUntil[slot] = untilMs
    this.cooldownDur[slot] = durationMs
  }

  private onBuff = (untilMs: number, durationMs: number) => {
    this.buffUntil = untilMs
    this.buffDuration = durationMs
  }

  private onBuffEnd = () => { this.buffUntil = 0 }

  // notif de passage de niveau : grosse, sous le panneau de HUD (haut-gauche), façon RO
  private onLevelUp(level: number) {
    this.updateSkillPointBadge()
    // ONBOARDING : au TOUT PREMIER passage de niveau (Nv 2), le joueur débloque son 1er point de
    // compétence (il démarre sans aucune compétence). On ouvre un petit panneau explicatif au lieu du
    // simple bandeau — le moment idéal pour apprendre le système. Ensuite, bandeau classique.
    if (level === 2 && !this.training) { this.showFirstSkillOnboarding(); return }
    const bg = this.add.rectangle(14, 118, 372, 28, 0xffb300, 0.95).setOrigin(0)
    const txt = this.add.text(24, 122, `⭐ NIVEAU ${level} !  +1 compétence · +2 stats`, {
      fontSize: '15px', color: '#3a2600', fontStyle: 'bold',
    }).setOrigin(0, 0)
    bg.setScale(0.2, 1)
    this.tweens.add({ targets: bg, scaleX: 1, duration: 200, ease: 'Back.out' })
    this.tweens.add({ targets: [bg, txt], alpha: 0, delay: 2200, duration: 700, onComplete: () => { bg.destroy(); txt.destroy() } })
  }

  // Panneau d'onboarding « ta première compétence » (Nv 2). Gèle le niveau le temps de la lecture ;
  // deux issues : ouvrir le menu Compétences, ou reprendre. Dessiné DANS l'UI (donc on ne met en
  // pause QUE la scène de niveau — sinon les boutons du panneau ne répondraient plus).
  private showFirstSkillOnboarding() {
    audio.playSfx('level-up')
    this.freezeLevelForOverlay()
    this.scene.pause(this.levelKey)
    const panel = this.add.container(0, 0).setDepth(2000)
    const backdrop = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.78).setInteractive()
    const card = this.add.rectangle(480, 262, 640, 320, 0x102a3a, 0.99).setStrokeStyle(3, 0x4fc3f7, 0.95)
    const title = this.add.text(480, 138, '⭐ Niveau 2 — ta première compétence !', {
      fontSize: '24px', color: '#ffd54f', fontStyle: 'bold',
    }).setOrigin(0.5)
    const body = this.add.text(480, 258,
      'À chaque niveau tu gagnes un POINT DE COMPÉTENCE.\n\n' +
      'Tu viens d\'en gagner ton premier ! Ouvre ⚙ Compétences pour\n' +
      'APPRENDRE une compétence, puis ÉQUIPE-la dans un slot 1-4.\n\n' +
      'En jeu : touche le slot (ou tape 1-4 au clavier) pour la lancer.', {
      fontSize: '16px', color: '#e8f4fb', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5)
    const close = () => { panel.destroy(); if (this.scene.isPaused(this.levelKey)) this.scene.resume(this.levelKey) }
    const mkBtn = (x: number, w: number, fill: number, label: string, txtColor: string, onTap: () => void) => {
      const b = this.add.rectangle(x, 388, w, 48, fill, 0.98).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({ useHandCursor: true })
      const t = this.add.text(x, 388, label, { fontSize: '17px', color: txtColor, fontStyle: 'bold' }).setOrigin(0.5)
      b.on('pointerdown', () => { audio.playSfx('ui-tap'); this.pressFx(b); onTap() })
      panel.add([b, t])
    }
    panel.add([backdrop, card, title, body])
    mkBtn(378, 264, 0xffca28, '⚙ Voir mes compétences', '#3a2600', () => { panel.destroy(); this.openSkillMenu() })
    mkBtn(636, 176, 0x37474f, 'Plus tard', '#ffffff', close)
    card.setScale(0.7); title.setAlpha(0); body.setAlpha(0)
    this.tweens.add({ targets: card, scale: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({ targets: [title, body], alpha: 1, duration: 260, delay: 120 })
  }

  refresh() {
    const p = getPlayer()
    this.levelText.setText(`Nv ${p.level}`)
    this.goldText.setText(`${p.gold} or`)
    this.potionText.setText(`×${p.potions}`)
    this.xpBar.setDisplaySize(BAR_W * (p.xp / xpToNext(p.level)), 4)
    for (let i = 0; i < 4; i++) {
      const sid = p.equippedSkills[i]
      const icon = this.slotIcons[i]!
      if (sid) icon.setTexture(`skill-${sid}`).setDisplaySize(SLOT_SIZE - 8, SLOT_SIZE - 8).setVisible(true)
      else icon.setVisible(false)
    }
    this.updateSkillPointBadge()
  }

  update(time: number) {
    // l'énergie change en continu (régén) : on la lit directement sur le Player plutôt
    // que via un événement par frame
    const pl = (this.scene.get(this.levelKey) as LevelScene | undefined)?.player
    if (pl && this.energyBar) this.energyBar.setDisplaySize(BAR_W * (pl.energy / pl.maxEnergy), 8)
    for (let i = 0; i < 4; i++) {
      const ov = this.slotCooldownOverlays[i]!
      const until = this.cooldownUntil[i] ?? 0
      const dur = this.cooldownDur[i] ?? 0
      if (time < until && dur > 0) {
        // fraction RESTANTE (1 → 0) : l'overlay grisé couvre la part droite et se rétracte vers la
        // droite (dégrisé gauche→droite) jusqu'à retrouver la couleur du slot à la fin.
        const remain = Phaser.Math.Clamp((until - time) / dur, 0, 1)
        ov.setVisible(true).setScale(remain, 1)
      } else {
        ov.setVisible(false)
      }
    }
    // pastille de buff : visible + barre de compte à rebours tant que le buff court
    const buffActive = time < this.buffUntil
    for (const o of this.buffParts) o.setVisible(buffActive)
    if (buffActive && this.buffDuration > 0) {
      const remain = Phaser.Math.Clamp((this.buffUntil - time) / this.buffDuration, 0, 1)
      this.buffBar.setDisplaySize(100 * remain, 4)
    }
  }
}
