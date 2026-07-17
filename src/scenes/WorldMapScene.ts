import Phaser from 'phaser'

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap') }
  create() {
    this.add.text(480, 270, 'Carte du monde (à venir)', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
    this.input.once('pointerdown', () => this.scene.start('Level', { levelId: 'zone1-1' }))
  }
}
