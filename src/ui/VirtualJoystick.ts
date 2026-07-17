import Phaser from 'phaser'
import { emptyControls, type ControlsState } from '../core/controls'

const DEAD_ZONE = 15

export class VirtualJoystick {
  state: ControlsState = emptyControls()
  private origin: Phaser.Math.Vector2 | null = null
  private pointerId: number | null = null
  private base: Phaser.GameObjects.Arc
  private thumb: Phaser.GameObjects.Arc

  constructor(scene: Phaser.Scene, zone: Phaser.Geom.Rectangle) {
    this.base = scene.add.circle(0, 0, 50, 0xffffff, 0.15).setVisible(false).setScrollFactor(0)
    this.thumb = scene.add.circle(0, 0, 22, 0xffffff, 0.35).setVisible(false).setScrollFactor(0)

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null) return
      if (!zone.contains(p.x, p.y)) return
      this.pointerId = p.id
      this.origin = new Phaser.Math.Vector2(p.x, p.y)
      this.base.setPosition(p.x, p.y).setVisible(true)
      this.thumb.setPosition(p.x, p.y).setVisible(true)
    })
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.origin || p.id !== this.pointerId || !p.isDown) return
      const dx = p.x - this.origin.x
      this.thumb.setPosition(this.origin.x + Phaser.Math.Clamp(dx, -50, 50), this.origin.y)
      this.state.left = dx < -DEAD_ZONE
      this.state.right = dx > DEAD_ZONE
    })
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return
      this.origin = null
      this.pointerId = null
      this.state = emptyControls()
      this.base.setVisible(false)
      this.thumb.setVisible(false)
    }
    scene.input.on('pointerup', release)
  }
}
