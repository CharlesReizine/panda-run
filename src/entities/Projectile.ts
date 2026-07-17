import Phaser from 'phaser'

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number
  fromPlayer: boolean
  private startX: number
  private rangePx: number

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number, dirY: number, damage: number, fromPlayer: boolean, rangePx: number) {
    super(scene, x, y, 'projectile')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    const v = new Phaser.Math.Vector2(dirX, dirY).normalize().scale(420)
    this.setVelocity(v.x, v.y)
    this.damage = damage
    this.fromPlayer = fromPlayer
    this.startX = x
    this.rangePx = rangePx
    if (!fromPlayer) this.setTint(0xff5252)
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    if (Math.abs(this.x - this.startX) > this.rangePx) this.destroy()
  }
}
