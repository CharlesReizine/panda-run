import Phaser from 'phaser'
import { LEVELS, type LevelDef } from '../data/levels'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'
import { MONSTERS } from '../data/monsters'
import { physicalDamage } from '../core/combat'
import { grantXp } from '../core/progression'
import { emptyControls, mergeControls, type ControlsState } from '../core/controls'
import { getPlayer } from '../state'
import { save } from '../core/save'
import type { UIScene } from './UIScene'

export const TILE = 32
const GROUND_ROW = 14 // sol sur les 2 dernières lignes (480 → 540 px)

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  enemyProjectiles!: Phaser.Physics.Arcade.Group
  playerProjectiles!: Phaser.Physics.Arcade.Group
  levelDef!: LevelDef
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private jumpHeld = false
  private invulnUntil = 0
  private nextBasicAttackAt = 0

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

    this.enemyProjectiles = this.physics.add.group()
    this.playerProjectiles = this.physics.add.group()

    for (const s of this.levelDef.spawns) {
      this.enemies.add(new Enemy(this, s.x * TILE, GROUND_ROW * TILE - 40, MONSTERS[s.monsterId]!))
    }

    // contact ennemi → joueur
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hitPlayer((e as Enemy).monster.atk))
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, proj) => {
      this.hitPlayer((proj as Projectile).damage)
      ;(proj as Projectile).destroy()
    })
    this.physics.add.overlap(this.playerProjectiles, this.enemies, (proj, e) => {
      ;(e as Enemy).takeDamage(physicalDamage((proj as Projectile).damage, (e as Enemy).monster.def))
      ;(proj as Projectile).destroy()
    })

    this.events.on('enemy-died', this.onEnemyDied, this)
    this.game.events.on('input-attack', this.basicAttack, this)
    this.input.keyboard!.on('keydown-X', this.basicAttack, this)

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
    this.events.once('shutdown', () => {
      this.game.events.off('input-jump-down', this.onJumpDown, this)
      this.game.events.off('input-jump-up', this.onJumpUp, this)
      this.game.events.off('input-attack', this.basicAttack, this)
      this.events.off('enemy-died', this.onEnemyDied, this)
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

  hitPlayer(rawAtk: number) {
    if (this.time.now < this.invulnUntil || this.player.hp <= 0) return
    this.invulnUntil = this.time.now + 800
    this.player.takeDamage(physicalDamage(rawAtk, this.player.stats.def))
    this.player.setVelocity(-this.player.facing * 200, -200)
    if (this.player.hp <= 0) {
      save(getPlayer())
      this.time.delayedCall(600, () => this.scene.start('WorldMap'))
    }
  }

  basicAttack() {
    if (this.time.now < this.nextBasicAttackAt) return
    this.nextBasicAttackAt = this.time.now + 1000 / this.player.stats.attackSpeed
    this.damageEnemiesInRect(this.player.x + this.player.facing * 30, this.player.y, 60, 50, 1)
  }

  damageEnemiesInRect(cx: number, cy: number, w: number, h: number, multiplier: number) {
    const rect = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (rect.contains(e.x, e.y)) e.takeDamage(physicalDamage(this.player.stats.atk, e.monster.def, multiplier))
    }
  }

  onEnemyDied(e: Enemy) {
    const p = getPlayer()
    const { levelsGained } = grantXp(p, e.monster.xp)
    this.events.emit('enemy-loot', e) // consommé en Task 13
    if (levelsGained > 0) {
      this.player.refreshStats()
      this.game.events.emit('player-level-up', p.level)
      const txt = this.add.text(this.player.x, this.player.y - 60, 'NIVEAU +1 !', { fontSize: '20px', color: '#ffd700' }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, duration: 1200, onComplete: () => txt.destroy() })
    }
    save(p)
    this.game.events.emit('hud-refresh')
  }

  update() {
    const ui = this.scene.get('UI') as UIScene
    const joy = ui.joystick?.state ?? emptyControls()
    const touch: ControlsState = { ...joy, jump: this.jumpHeld }
    this.player.updateFromControls(mergeControls(this.keyboardControls(), touch))
  }
}
