import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }
  create() {
    this.add.text(480, 270, 'Panda-Run', { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5)
  }
}
