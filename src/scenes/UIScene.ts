import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { getPlayer } from '../state'
import { xpToNext } from '../core/progression'
import { SKILLS } from '../data/skills'

export class UIScene extends Phaser.Scene {
  joystick?: VirtualJoystick
  private hpBar!: Phaser.GameObjects.Rectangle
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

    // Barres HP / XP
    this.add.rectangle(20, 20, 204, 18, 0x000000, 0.5).setOrigin(0)
    this.hpBar = this.add.rectangle(22, 22, 200, 14, 0xe53935).setOrigin(0)
    this.add.rectangle(20, 42, 204, 10, 0x000000, 0.5).setOrigin(0)
    this.xpBar = this.add.rectangle(22, 44, 200, 6, 0xfdd835).setOrigin(0)
    this.levelText = this.add.text(232, 20, '', { fontSize: '16px', color: '#ffffff' })
    this.goldText = this.add.text(232, 40, '', { fontSize: '14px', color: '#ffd700' })

    // Boutons A (saut) / B (attaque)
    const jump = this.add.circle(880, 470, 36, 0x1e88e5, 0.6).setInteractive()
    this.add.text(880, 470, 'A', { fontSize: '24px', color: '#fff' }).setOrigin(0.5)
    jump.on('pointerdown', () => this.game.events.emit('input-jump-down'))
    jump.on('pointerup', () => this.game.events.emit('input-jump-up'))
    jump.on('pointerout', () => this.game.events.emit('input-jump-up'))
    const atk = this.add.circle(795, 495, 32, 0xfb8c00, 0.7).setInteractive()
    this.add.text(795, 495, 'B', { fontSize: '22px', color: '#fff' }).setOrigin(0.5)
    atk.on('pointerdown', () => this.game.events.emit('input-attack'))

    // 4 slots de skills
    for (let i = 0; i < 4; i++) {
      const x = 700 + i * 62
      this.add.rectangle(x, 410, 52, 52, 0x000000, 0.5).setStrokeStyle(2, 0xffffff, 0.6)
        .setInteractive().on('pointerdown', () => this.game.events.emit('input-skill', i))
      this.slotLabels.push(this.add.text(x, 410, '', { fontSize: '10px', color: '#fff', align: 'center', wordWrap: { width: 48 } }).setOrigin(0.5))
      const ov = this.add.rectangle(x, 410, 52, 52, 0x000000, 0.7).setVisible(false)
      this.slotCooldownOverlays.push(ov)
    }

    // Potion
    const potion = this.add.image(60, 480, 'potion-drop').setScale(2.5).setInteractive()
    potion.on('pointerdown', () => this.game.events.emit('input-potion'))
    this.potionText = this.add.text(78, 470, '', { fontSize: '16px', color: '#ffffff' })

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

  private onPlayerHp = (hp: number, max: number) => this.hpBar.setDisplaySize(200 * (hp / max), 14)

  private onCooldown(slot: number, untilMs: number) {
    this.cooldownUntil[slot] = untilMs
  }

  refresh() {
    const p = getPlayer()
    this.levelText.setText(`Nv ${p.level}`)
    this.goldText.setText(`${p.gold} or`)
    this.potionText.setText(`×${p.potions}`)
    this.xpBar.setDisplaySize(200 * (p.xp / xpToNext(p.level)), 6)
    for (let i = 0; i < 4; i++) {
      const sid = p.equippedSkills[i]
      this.slotLabels[i]!.setText(sid ? SKILLS[sid]!.name : '—')
    }
  }

  update(time: number) {
    for (let i = 0; i < 4; i++) {
      this.slotCooldownOverlays[i]!.setVisible(time < (this.cooldownUntil[i] ?? 0))
    }
  }
}
