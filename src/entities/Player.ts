import Phaser from 'phaser'
import type { StatBlock } from '../core/types'
import type { ControlsState } from '../core/controls'
import { computeStats } from '../core/stats'
import { getPlayer } from '../state'
import { PANDA_BODY } from './player-body'
import { JUMP_SPEED, RUN_SPEED } from '../core/platforming'

const JUMP_VELOCITY = -JUMP_SPEED // source unique (partagée avec le test d'atteignabilité)
const MAX_ENERGY = 100
const ENERGY_REGEN_PER_SEC = 22
const ENERGY_PER_BASIC_HIT = 6
const HAT_OFFSET_Y = -34 // place le chapeau au-dessus de la tête du panda

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock
  hp: number
  energy = MAX_ENERGY
  readonly maxEnergy = MAX_ENERGY
  facing: 1 | -1 = 1
  private wasGrounded = true
  private attacking = false
  private hatImage: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, `panda-${getPlayer().classId}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    // hitbox calée sur le panda visible (pas la texture entière qui a de la marge)
    this.setSize(PANDA_BODY.w, PANDA_BODY.h)
    this.setOffset(PANDA_BODY.offsetX, PANDA_BODY.offsetY)
    this.setCollideWorldBounds(true)
    this.stats = computeStats(getPlayer())
    this.hp = this.stats.maxHp
    this.play(this.anim('idle'))
    this.emitHp()
    this.refreshHat()
  }

  // (ré)affiche le chapeau cosmétique équipé (ou le retire si le slot est vide)
  private refreshHat() {
    const hatId = getPlayer().equipment.hat
    this.hatImage?.destroy()
    this.hatImage = hatId ? this.scene.add.image(this.x, this.y + HAT_OFFSET_Y, `cosmetic-${hatId}`).setDepth(this.depth + 1) : null
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    if (this.hatImage) {
      this.hatImage.setPosition(this.x, this.y + HAT_OFFSET_Y)
      this.hatImage.setFlipX(this.facing === -1)
    }
  }

  destroy(fromScene?: boolean) {
    this.hatImage?.destroy()
    super.destroy(fromScene)
  }

  // clé d'animation selon la classe courante (le visuel change au changement de classe)
  private anim(suffix: string): string {
    return `panda-${getPlayer().classId}-${suffix}`
  }

  // joue l'animation d'attaque ; pendant ce temps run/idle sont suspendus
  playAttack() {
    this.attacking = true
    this.play(this.anim('attack'), true)
    this.scene.time.delayedCall(160, () => { this.attacking = false })
  }

  refreshStats() {
    const ratio = this.hp / this.stats.maxHp
    this.stats = computeStats(getPlayer())
    this.hp = Math.round(this.stats.maxHp * ratio)
    this.play(this.anim('idle')) // reprend l'allure de la nouvelle classe
    this.emitHp()
    this.refreshHat()
  }

  updateFromControls(c: ControlsState) {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (c.left) { this.setVelocityX(-RUN_SPEED); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(RUN_SPEED); this.facing = 1; this.setFlipX(false) }
    else this.setVelocityX(0)
    if (c.jump && body.blocked.down) {
      this.setVelocityY(JUMP_VELOCITY)
      this.scene.events.emit('player-jump')
    }

    if (body.blocked.down && !this.wasGrounded) {
      this.setScale(1.1, 0.9)
      this.scene.time.delayedCall(100, () => this.setScale(1, 1))
    }
    this.wasGrounded = body.blocked.down

    // animations : attaque > saut (en l'air) > course > idle
    if (!this.attacking) {
      if (!body.blocked.down) this.play(this.anim('jump'), true)
      else if (c.left || c.right) this.play(this.anim('run'), true)
      else this.play(this.anim('idle'), true)
    }
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.setTint(0xff5555)
    this.scene.time.delayedCall(100, () => this.clearTint())
    this.emitHp()
  }

  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount)
    this.emitHp()
  }

  // true si l'énergie suffisait (et a été dépensée), false sinon
  spendEnergy(amount: number): boolean {
    if (this.energy < amount) return false
    this.energy -= amount
    return true
  }

  gainEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount)
  }

  regenEnergy(deltaMs: number) {
    this.gainEnergy((ENERGY_REGEN_PER_SEC * deltaMs) / 1000)
  }

  private emitHp() {
    this.scene.events.emit('player-hp', this.hp, this.stats.maxHp)
  }
}

export const ENERGY_ON_BASIC_HIT = ENERGY_PER_BASIC_HIT
