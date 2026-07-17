import Phaser from 'phaser'
import type { MonsterDef } from '../core/types'
import { Projectile } from './Projectile'
import type { LevelScene } from '../scenes/LevelScene'

const AGGRO_RANGE = 350
const CHARGE_COOLDOWN = 2500
const SHOOT_COOLDOWN = 2000

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  monster: MonsterDef
  hp: number
  private levelScene: LevelScene
  private nextActionAt = 0
  private bar: Phaser.GameObjects.Graphics

  constructor(scene: LevelScene, x: number, y: number, def: MonsterDef) {
    super(scene, x, y, `monster-${def.id}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.levelScene = scene
    this.monster = def
    this.hp = def.hp
    this.bar = scene.add.graphics()
  }

  takeDamage(amount: number) {
    this.hp -= amount
    // Phaser v4 : setTintFill() n'accepte plus de couleur en argument (silhouette blanche fixe)
    this.setTintFill()
    this.scene.time.delayedCall(80, () => this.clearTint())
    const txt = this.scene.add.text(this.x, this.y - 30, `${amount}`, { fontSize: '16px', color: '#ffee58' }).setOrigin(0.5)
    this.scene.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    if (this.hp <= 0) {
      this.scene.events.emit('enemy-died', this)
      this.bar.destroy()
      this.destroy()
    }
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    const player = this.levelScene.player
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
    const dir = Math.sign(player.x - this.x) || 1

    if (dist < AGGRO_RANGE) {
      if (this.monster.behavior === 'contact') {
        this.setVelocityX(dir * this.monster.speed)
      } else if (this.monster.behavior === 'charge' && t > this.nextActionAt) {
        this.setVelocityX(dir * this.monster.speed * 3)
        this.nextActionAt = t + CHARGE_COOLDOWN
      } else if (this.monster.behavior === 'projectile' && t > this.nextActionAt) {
        const p = new Projectile(this.scene, this.x, this.y - 10, player.x - this.x, player.y - this.y, this.monster.atk, false, 500)
        this.levelScene.enemyProjectiles.add(p)
        this.nextActionAt = t + SHOOT_COOLDOWN
      }
    } else if (this.monster.behavior !== 'charge') {
      this.setVelocityX(0)
    }

    // barre de vie flottante
    this.bar.clear()
    const w = this.monster.boss ? 60 : 30
    this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2, this.y - this.height / 2 - 12, w, 5)
    this.bar.fillStyle(0x66bb6a).fillRect(this.x - w / 2, this.y - this.height / 2 - 12, w * Math.max(0, this.hp / this.monster.hp), 5)
  }
}
