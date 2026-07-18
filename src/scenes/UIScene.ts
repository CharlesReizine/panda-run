import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { getPlayer } from '../state'
import { xpToNext } from '../core/progression'
import { audio } from '../audio/audio-engine'
import type { LevelScene } from './LevelScene'

const BAR_W = 200
const SLOT_SIZE = 50
const SLOT_Y = 38

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

  constructor() { super('UI') }

  create() {
    // Scène réutilisée à chaque niveau (launch depuis LevelScene) : ces tableaux sont des
    // class fields initialisés une seule fois à l'instanciation, pas à chaque create().
    // Sans reset, refresh()/update() continuent de cibler les objets détruits du niveau précédent.
    this.slotIcons = []
    this.slotCooldownOverlays = []
    this.cooldownUntil = [0, 0, 0, 0]

    this.input.addPointer(3)
    this.joystick = new VirtualJoystick(this, new Phaser.Geom.Rectangle(0, 100, 400, 440))

    // Haut-gauche : niveau + or, puis barres vie / énergie / XP empilées
    this.levelText = this.add.text(12, 6, '', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
    this.goldText = this.add.text(120, 7, '', { fontSize: '13px', color: '#ffd700' })

    this.add.rectangle(12, 24, BAR_W + 4, 16, 0x000000, 0.5).setOrigin(0)
    this.hpBar = this.add.rectangle(14, 26, BAR_W, 12, 0xe53935).setOrigin(0)
    this.add.rectangle(12, 42, BAR_W + 4, 12, 0x000000, 0.5).setOrigin(0)
    this.energyBar = this.add.rectangle(14, 44, BAR_W, 8, 0x29b6f6).setOrigin(0)
    this.add.rectangle(12, 56, BAR_W + 4, 6, 0x000000, 0.5).setOrigin(0)
    this.xpBar = this.add.rectangle(14, 57, BAR_W, 4, 0xfdd835).setOrigin(0)

    // toucher la zone des barres (vie/énergie) ouvre la gestion des skills en jeu
    this.add.rectangle(12, 22, BAR_W + 4, 42, 0xffffff, 0.001).setOrigin(0).setInteractive()
      .on('pointerdown', () => {
        audio.playSfx('ui-tap')
        this.scene.launch('SkillEquip')
        this.scene.pause('Level')
        this.scene.pause('UI')
      })
    this.add.text(12, 66, 'compétences ▸', { fontSize: '10px', color: '#b0bec5' })

    // bouton muet discret (coin haut-droit), au-dessus des slots de compétences
    const muteBtn = this.add.text(944, 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '20px' })
      .setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      const muted = audio.toggleMute()
      muteBtn.setText(muted ? '🔇' : '🔊')
    })

    // Haut-droite : les 4 slots de skills côte à côte
    for (let i = 0; i < 4; i++) {
      const x = 706 + i * 60
      const slot = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff, 0.6).setInteractive()
      slot.on('pointerdown', () => { this.pressFx(slot); this.game.events.emit('input-skill', i) })
      this.add.text(x, SLOT_Y - SLOT_SIZE / 2 - 8, `${i + 1}`, { fontSize: '11px', color: '#ffd54f' }).setOrigin(0.5)
      this.slotIcons.push(this.add.image(x, SLOT_Y, '__DEFAULT').setDisplaySize(SLOT_SIZE - 8, SLOT_SIZE - 8).setVisible(false))
      const ov = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.7).setVisible(false)
      this.slotCooldownOverlays.push(ov)
    }

    // Bas-droite : contrôles saut / attaque
    const jump = this.add.circle(884, 468, 36, 0x1e88e5, 0.6).setInteractive()
    this.add.image(884, 468, 'ui-jump').setDisplaySize(34, 34)
    this.add.text(884, 510, 'SAUT', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    jump.on('pointerdown', () => { this.pressFx(jump); this.game.events.emit('input-jump-down') })
    jump.on('pointerup', () => this.game.events.emit('input-jump-up'))
    jump.on('pointerout', () => this.game.events.emit('input-jump-up'))
    const atk = this.add.circle(792, 496, 32, 0xfb8c00, 0.7).setInteractive()
    this.add.image(792, 496, 'ui-attack').setDisplaySize(30, 30)
    this.add.text(792, 534, 'ATTAQUE', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    atk.on('pointerdown', () => { this.pressFx(atk); this.game.events.emit('input-attack') })

    // Bas-gauche : potion
    const potion = this.add.image(52, 500, 'potion-drop').setScale(2.5).setInteractive()
    potion.on('pointerdown', () => { this.pressFx(potion); this.game.events.emit('input-potion') })
    this.potionText = this.add.text(70, 490, '', { fontSize: '16px', color: '#ffffff' })

    // Écoute des mises à jour émises par LevelScene
    const level = this.scene.get('Level')
    level.events.on('player-hp', this.onPlayerHp)
    this.game.events.on('hud-refresh', this.refresh, this)
    this.game.events.on('skill-cooldown', this.onCooldown, this)
    this.game.events.on('player-level-up', this.onLevelUp, this)
    this.events.once('shutdown', () => {
      level.events.off('player-hp', this.onPlayerHp)
      this.game.events.off('hud-refresh', this.refresh, this)
      this.game.events.off('skill-cooldown', this.onCooldown, this)
      this.game.events.off('player-level-up', this.onLevelUp, this)
    })
    this.refresh()
  }

  // pulse visuel au tap pour que chaque bouton réponde sous le doigt
  private pressFx(target: Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Text) {
    this.tweens.add({ targets: target, scale: target.scale * 0.85, duration: 60, yoyo: true })
  }

  private onPlayerHp = (hp: number, max: number) => this.hpBar.setDisplaySize(BAR_W * (hp / max), 12)

  private onCooldown(slot: number, untilMs: number) {
    this.cooldownUntil[slot] = untilMs
  }

  // notif de passage de niveau : grosse, au niveau des PV (haut-gauche), façon RO
  private onLevelUp(level: number) {
    const bg = this.add.rectangle(14, 66, 250, 30, 0xffb300, 0.95).setOrigin(0)
    const txt = this.add.text(24, 71, `⭐ NIVEAU ${level} !  +1 point`, {
      fontSize: '18px', color: '#3a2600', fontStyle: 'bold',
    }).setOrigin(0, 0)
    bg.setScale(0.2, 1)
    this.tweens.add({ targets: bg, scaleX: 1, duration: 200, ease: 'Back.out' })
    this.tweens.add({ targets: [bg, txt], alpha: 0, delay: 2200, duration: 700, onComplete: () => { bg.destroy(); txt.destroy() } })
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
  }

  update(time: number) {
    // l'énergie change en continu (régén) : on la lit directement sur le Player plutôt
    // que via un événement par frame
    const pl = (this.scene.get('Level') as LevelScene | undefined)?.player
    if (pl && this.energyBar) this.energyBar.setDisplaySize(BAR_W * (pl.energy / pl.maxEnergy), 8)
    for (let i = 0; i < 4; i++) {
      this.slotCooldownOverlays[i]!.setVisible(time < (this.cooldownUntil[i] ?? 0))
    }
  }
}
