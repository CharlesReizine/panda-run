import Phaser from 'phaser'
import type { PropDef } from '../data/props'

export class Prop extends Phaser.Physics.Arcade.Sprite {
  def: PropDef
  hp: number

  constructor(scene: Phaser.Scene, x: number, y: number, def: PropDef) {
    super(scene, x, y, `prop-${def.id}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.setImmovable(true)
    this.def = def
    this.hp = def.hp
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp -= amount
    const dying = this.hp <= 0
    if (this.def.id === 'coffre') {
      // le coffre s'ouvre visuellement (teinte or + léger grossissement) au lieu du flash blanc générique
      this.setTint(0xffd54f)
      this.setScale(this.scaleX + (dying ? 0.2 : 0.05))
    } else {
      this.setTint(0xffffff)
      if (!dying) this.scene.time.delayedCall(80, () => this.clearTint())
    }
    if (dying) {
      this.scene.events.emit('prop-broken', this)
      this.scene.time.delayedCall(this.def.id === 'coffre' ? 120 : 0, () => this.destroy())
    }
  }
}
