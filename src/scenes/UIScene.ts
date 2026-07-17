import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { getPlayer } from '../state'
import { xpToNext } from '../core/progression'
import { SKILLS } from '../data/skills'
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
  private slotLabels: Phaser.GameObjects.Text[] = []
  private cooldownUntil: number[] = [0, 0, 0, 0]

  constructor() { super('UI') }

  create() {
    // Scène réutilisée à chaque niveau (launch depuis LevelScene) : ces tableaux sont des
    // class fields initialisés une seule fois à l'instanciation, pas à chaque create().
    // Sans reset, refresh()/update() continuent de cibler les objets détruits du niveau précédent.
    this.slotLabels = []
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

    // Haut-droite : les 4 slots de skills côte à côte
    for (let i = 0; i < 4; i++) {
      const x = 706 + i * 60
      const slot = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff, 0.6).setInteractive()
      slot.on('pointerdown', () => { this.pressFx(slot); this.game.events.emit('input-skill', i) })
      this.add.text(x, SLOT_Y - SLOT_SIZE / 2 - 8, `${i + 1}`, { fontSize: '11px', color: '#ffd54f' }).setOrigin(0.5)
      this.slotLabels.push(this.add.text(x, SLOT_Y, '', { fontSize: '9px', color: '#fff', align: 'center', wordWrap: { width: SLOT_SIZE - 6 } }).setOrigin(0.5))
      const ov = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.7).setVisible(false)
      this.slotCooldownOverlays.push(ov)
    }

    // Bas-droite : contrôles saut / attaque
    const jump = this.add.circle(884, 468, 36, 0x1e88e5, 0.6).setInteractive()
    this.add.text(884, 468, '⬆', { fontSize: '28px', color: '#fff' }).setOrigin(0.5)
    this.add.text(884, 510, 'SAUT', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    jump.on('pointerdown', () => { this.pressFx(jump); this.game.events.emit('input-jump-down') })
    jump.on('pointerup', () => this.game.events.emit('input-jump-up'))
    jump.on('pointerout', () => this.game.events.emit('input-jump-up'))
    const atk = this.add.circle(792, 496, 32, 0xfb8c00, 0.7).setInteractive()
    this.add.text(792, 496, '⚔', { fontSize: '26px', color: '#fff' }).setOrigin(0.5)
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
    this.events.once('shutdown', () => {
      level.events.off('player-hp', this.onPlayerHp)
      this.game.events.off('hud-refresh', this.refresh, this)
      this.game.events.off('skill-cooldown', this.onCooldown, this)
    })
    this.refresh()
  }

  // pulse visuel au tap pour que chaque bouton réponde sous le doigt
  private pressFx(target: Phaser.GameObjects.Shape | Phaser.GameObjects.Image) {
    this.tweens.add({ targets: target, scale: target.scale * 0.85, duration: 60, yoyo: true })
  }

  private onPlayerHp = (hp: number, max: number) => this.hpBar.setDisplaySize(BAR_W * (hp / max), 12)

  private onCooldown(slot: number, untilMs: number) {
    this.cooldownUntil[slot] = untilMs
  }

  refresh() {
    const p = getPlayer()
    this.levelText.setText(`Nv ${p.level}`)
    this.goldText.setText(`${p.gold} or`)
    this.potionText.setText(`×${p.potions}`)
    this.xpBar.setDisplaySize(BAR_W * (p.xp / xpToNext(p.level)), 4)
    for (let i = 0; i < 4; i++) {
      const sid = p.equippedSkills[i]
      this.slotLabels[i]!.setText(sid ? SKILLS[sid]!.name : '—')
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
