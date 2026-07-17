import Phaser from 'phaser'
import { LEVELS, type LevelDef } from '../data/levels'
import { Player } from '../entities/Player'
import { mergeControls, type ControlsState } from '../core/controls'
import { getPlayer } from '../state'
import { save } from '../core/save'
import type { UIScene } from './UIScene'

export const TILE = 32
const GROUND_ROW = 14 // sol sur les 2 dernières lignes (480 → 540 px)

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  levelDef!: LevelDef
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private jumpHeld = false

  constructor() { super('Level') }

  init(data: { levelId: string }) {
    this.levelDef = LEVELS[data.levelId]!
  }

  create() {
    const widthPx = this.levelDef.widthTiles * TILE
    this.physics.world.setBounds(0, 0, widthPx, 540)

    const platforms = this.physics.add.staticGroup()
    const tileKey = `tile-${this.levelDef.biome}`
    for (let x = 0; x < this.levelDef.widthTiles; x++) {
      platforms.create(x * TILE + TILE / 2, GROUND_ROW * TILE + TILE, tileKey)
      platforms.create(x * TILE + TILE / 2, (GROUND_ROW + 1) * TILE + TILE, tileKey)
    }
    for (const p of this.levelDef.platforms) {
      for (let i = 0; i < p.w; i++) {
        platforms.create((p.x + i) * TILE + TILE / 2, p.y * TILE + TILE / 2, tileKey)
      }
    }

    this.player = new Player(this, 2 * TILE, GROUND_ROW * TILE - 40)
    this.physics.add.collider(this.player, platforms)

    this.enemies = this.physics.add.group()
    this.physics.add.collider(this.enemies, platforms)

    // porte de sortie en fin de niveau
    const exit = this.physics.add.staticImage(widthPx - 2 * TILE, GROUND_ROW * TILE - 24 + TILE, 'exit')
    this.physics.add.overlap(this.player, exit, () => this.completeLevel())

    this.cameras.main.setBounds(0, 0, widthPx, 540)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.cursors = this.input.keyboard!.createCursorKeys()

    this.add.text(8, 8, this.levelDef.name, { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0)

    this.scene.launch('UI')
    this.jumpHeld = false
    this.game.events.on('input-jump-down', this.onJumpDown, this)
    this.game.events.on('input-jump-up', this.onJumpUp, this)
    this.events.on('shutdown', () => {
      this.game.events.off('input-jump-down', this.onJumpDown, this)
      this.game.events.off('input-jump-up', this.onJumpUp, this)
      this.scene.stop('UI')
    })
    this.game.events.emit('hud-refresh')
  }

  private keyboardControls(): ControlsState {
    return {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      jump: this.cursors.up.isDown || this.cursors.space.isDown,
    }
  }

  private onJumpDown() { this.jumpHeld = true }
  private onJumpUp() { this.jumpHeld = false }

  completeLevel() {
    const p = getPlayer()
    if (!p.completedLevels.includes(this.levelDef.id)) p.completedLevels.push(this.levelDef.id)
    save(p)
    this.scene.start('WorldMap')
  }

  update() {
    const ui = this.scene.get('UI') as UIScene
    const touch: ControlsState = { ...ui.joystick.state, jump: this.jumpHeld }
    this.player.updateFromControls(mergeControls(this.keyboardControls(), touch))
  }
}
