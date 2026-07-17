import Phaser from 'phaser'
import type { StatBlock } from '../core/types'
import type { ControlsState } from '../core/controls'
import { computeStats } from '../core/stats'
import { getPlayer } from '../state'
import { CLASSES } from '../data/classes'

const RUN_SPEED = 220
const JUMP_VELOCITY = -560

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock
  hp: number
  facing: 1 | -1 = 1
  private wasGrounded = true

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'panda')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.stats = computeStats(getPlayer())
    this.hp = this.stats.maxHp
    this.setTint(CLASSES[getPlayer().classId].tint)
    this.emitHp()
  }

  refreshStats() {
    const ratio = this.hp / this.stats.maxHp
    this.stats = computeStats(getPlayer())
    this.hp = Math.round(this.stats.maxHp * ratio)
    this.setTint(CLASSES[getPlayer().classId].tint)
    this.emitHp()
  }

  updateFromControls(c: ControlsState) {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (c.left) { this.setVelocityX(-RUN_SPEED); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(RUN_SPEED); this.facing = 1; this.setFlipX(false) }
    else this.setVelocityX(0)
    if (c.jump && body.blocked.down) this.setVelocityY(JUMP_VELOCITY)

    if (body.blocked.down && !this.wasGrounded) {
      this.setScale(1.1, 0.9)
      this.scene.time.delayedCall(100, () => this.setScale(1, 1))
    }
    this.wasGrounded = body.blocked.down
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.setTint(0xff0000)
    this.scene.time.delayedCall(100, () => this.setTint(CLASSES[getPlayer().classId].tint))
    this.emitHp()
  }

  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount)
    this.emitHp()
  }

  private emitHp() {
    this.scene.events.emit('player-hp', this.hp, this.stats.maxHp)
  }
}
