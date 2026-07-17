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
import { CooldownTracker } from '../core/skill-executor'
import { SKILLS } from '../data/skills'
import { rollDrops } from '../core/loot'
import type { UIScene } from './UIScene'

export const TILE = 32
const GROUND_ROW = 14 // sol sur les 2 dernières lignes (480 → 540 px)

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  enemyProjectiles!: Phaser.Physics.Arcade.Group
  playerProjectiles!: Phaser.Physics.Arcade.Group
  pickups!: Phaser.Physics.Arcade.Group
  levelDef!: LevelDef
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private jumpHeld = false
  private invulnUntil = 0
  private nextBasicAttackAt = 0
  private cooldowns = new CooldownTracker()
  private boss: Enemy | null = null
  private bossBar: Phaser.GameObjects.Rectangle | null = null
  private bossBarBg: Phaser.GameObjects.Rectangle | null = null
  private bossName: Phaser.GameObjects.Text | null = null
  private bossVolley: Phaser.Time.TimerEvent | null = null

  constructor() { super('Level') }

  init(data: { levelId: string }) {
    this.levelDef = LEVELS[data.levelId]!
  }

  create() {
    // this.time.now est monotone sur toute la durée du jeu (partagé entre scènes) : sans reset,
    // les cooldowns de compétences posés dans un niveau précédent restent actifs dans le suivant.
    this.cooldowns = new CooldownTracker()

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

    this.pickups = this.physics.add.group()
    this.physics.add.collider(this.pickups, platforms)
    this.physics.add.overlap(this.player, this.pickups, (_p, pk) => this.collectPickup(pk as Phaser.Physics.Arcade.Sprite))

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
    this.events.on('enemy-died', this.onBossDied, this)
    this.events.on('enemy-loot', this.spawnLoot, this)
    this.game.events.on('input-attack', this.basicAttack, this)
    this.input.keyboard!.on('keydown-X', this.basicAttack, this)
    this.game.events.on('input-skill', this.castSkill, this)
    this.game.events.on('input-potion', this.usePotion, this)
    this.input.keyboard!.on('keydown-P', this.usePotion, this)
    for (const [key, slot] of [['ONE', 0], ['TWO', 1], ['THREE', 2], ['FOUR', 3]] as const) {
      this.input.keyboard!.on(`keydown-${key}`, () => this.castSkill(slot))
    }

    // porte de sortie en fin de niveau (sauf arène de boss : elle n'apparaît qu'à sa mort)
    this.boss = null
    this.bossBar = null
    this.bossBarBg = null
    this.bossName = null
    this.bossVolley = null
    if (this.levelDef.boss) {
      this.spawnBoss()
    } else {
      this.createExit()
    }

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
      this.game.events.off('input-skill', this.castSkill, this)
      this.game.events.off('input-potion', this.usePotion, this)
      this.events.off('enemy-died', this.onEnemyDied, this)
      this.events.off('enemy-died', this.onBossDied, this)
      this.events.off('enemy-loot', this.spawnLoot, this)
      this.bossVolley?.remove()
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

  private exitX(): number { return this.levelDef.widthTiles * TILE - 2 * TILE }

  createExit() {
    const exit = this.physics.add.staticImage(this.exitX(), GROUND_ROW * TILE - 24 + TILE, 'exit')
    this.physics.add.overlap(this.player, exit, () => this.completeLevel())
  }

  spawnBoss() {
    const def = MONSTERS[this.levelDef.boss!]!
    const boss = new Enemy(this, this.levelDef.widthTiles * TILE * 0.7, GROUND_ROW * TILE - 80, def)
    this.enemies.add(boss)
    this.boss = boss

    // barre de vie géante
    this.bossBarBg = this.add.rectangle(480, 70, 604, 22, 0x000000, 0.6).setScrollFactor(0)
    this.bossBar = this.add.rectangle(480 - 300, 70, 600, 18, 0xef5350).setOrigin(0, 0.5).setScrollFactor(0)
    this.bossName = this.add.text(480, 45, def.name, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0)

    // salve de projectiles toutes les 5 s
    this.bossVolley = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (!boss.active) return
        for (const dy of [-0.3, 0, 0.3]) {
          const proj = new Projectile(this, boss.x, boss.y - 20, this.player.x - boss.x, this.player.y - boss.y + dy * 200, def.atk, false, 600)
          this.enemyProjectiles.add(proj)
        }
      },
    })
  }

  completeLevel() {
    if (this.player.hp <= 0) return
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
    if (this.player.hp <= 0) return
    if (this.time.now < this.nextBasicAttackAt) return
    this.nextBasicAttackAt = this.time.now + 1000 / this.player.stats.attackSpeed
    this.slashFx(this.player.x + this.player.facing * 30, this.player.y, 60, 0xffffff)
    this.damageEnemiesInRect(this.player.x + this.player.facing * 30, this.player.y, 60, 50, 1)
  }

  // arc de coup visible même dans le vide + petit élan du panda
  private slashFx(cx: number, cy: number, w: number, color: number) {
    const fx = this.add.ellipse(cx, cy, w, 44, color, 0.45)
    this.tweens.add({ targets: fx, scaleX: 1.3, alpha: 0, duration: 150, onComplete: () => fx.destroy() })
    this.tweens.add({ targets: this.player, x: this.player.x + this.player.facing * 6, duration: 60, yoyo: true })
  }

  private announceSkill(name: string) {
    const txt = this.add.text(this.player.x, this.player.y - 55, name + ' !', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.tweens.add({ targets: txt, y: txt.y - 25, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
  }

  castSkill(slot: number) {
    if (this.player.hp <= 0) return
    const p = getPlayer()
    const skillId = p.equippedSkills[slot]
    if (!skillId || !this.cooldowns.canUse(slot, this.time.now)) return
    const skill = SKILLS[skillId]!
    this.cooldowns.use(slot, this.time.now, skill.cooldownMs)
    this.game.events.emit('skill-cooldown', slot, this.time.now + skill.cooldownMs)
    this.announceSkill(skill.name)

    const { atk, maxHp } = this.player.stats
    if (skill.kind === 'melee') {
      this.slashFx(this.player.x + (this.player.facing * skill.range) / 2, this.player.y, skill.range, 0xffd54f)
      this.damageEnemiesInRect(this.player.x + (this.player.facing * skill.range) / 2, this.player.y, skill.range, 60, skill.multiplier)
    } else if (skill.kind === 'aoe') {
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= skill.range) {
          e.takeDamage(physicalDamage(atk, e.monster.def, skill.multiplier))
        }
      }
      const fx = this.add.circle(this.player.x, this.player.y, skill.range, 0xffffff, 0.25)
      this.tweens.add({ targets: fx, alpha: 0, duration: 300, onComplete: () => fx.destroy() })
    } else if (skill.kind === 'projectile') {
      this.playerProjectiles.add(new Projectile(this, this.player.x, this.player.y - 6, this.player.facing, 0, atk * skill.multiplier, true, skill.range))
    } else if (skill.kind === 'heal') {
      this.player.heal(Math.round(maxHp * skill.multiplier))
      const fx = this.add.text(this.player.x, this.player.y - 50, '+PV', { fontSize: '18px', color: '#66bb6a' }).setOrigin(0.5)
      this.tweens.add({ targets: fx, y: fx.y - 30, alpha: 0, duration: 800, onComplete: () => fx.destroy() })
    }
  }

  damageEnemiesInRect(cx: number, cy: number, w: number, h: number, multiplier: number) {
    const rect = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (rect.contains(e.x, e.y)) e.takeDamage(physicalDamage(this.player.stats.atk, e.monster.def, multiplier))
    }
  }

  spawnLoot(e: Enemy) {
    const drops = rollDrops(e.monster.drops)
    const spawn = (texture: string, data: Record<string, unknown>) => {
      const s = this.pickups.create(e.x + Phaser.Math.Between(-20, 20), e.y - 10, texture) as Phaser.Physics.Arcade.Sprite
      s.setVelocity(Phaser.Math.Between(-80, 80), -200)
      s.setData(data)
    }
    if (drops.gold > 0) spawn('coin', { gold: drops.gold })
    for (let i = 0; i < drops.potions; i++) spawn('potion-drop', { potion: 1 })
    for (const itemId of drops.items) spawn('item-drop', { itemId })
  }

  collectPickup(s: Phaser.Physics.Arcade.Sprite) {
    const p = getPlayer()
    const gold = s.getData('gold') as number | undefined
    const potion = s.getData('potion') as number | undefined
    const itemId = s.getData('itemId') as string | undefined
    if (gold) {
      p.gold += gold
      const txt = this.add.text(s.x, s.y - 10, `+${gold} or`, { fontSize: '16px', color: '#ffd700' }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    }
    if (potion) {
      p.potions += potion
      const txt = this.add.text(s.x, s.y - 10, '♥', { fontSize: '20px', color: '#ff6b81' }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    }
    if (itemId) p.inventory.push(itemId)
    s.destroy()
    save(p)
    this.game.events.emit('hud-refresh')
  }

  usePotion() {
    if (this.player.hp <= 0) return
    const p = getPlayer()
    if (p.potions <= 0 || this.player.hp >= this.player.stats.maxHp) return
    p.potions -= 1
    this.player.heal(Math.round(this.player.stats.maxHp * 0.5))
    save(p)
    this.game.events.emit('hud-refresh')
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

  // écoute permanente (voir shutdown) ; ne consomme rien tant que ce n'est pas le boss en cours
  onBossDied(e: Enemy) {
    if (e !== this.boss) return
    this.bossVolley?.remove()
    this.bossBarBg?.destroy()
    this.bossBar?.destroy()
    this.bossName?.destroy()
    this.boss = null
    this.bossBar = null
    this.bossBarBg = null
    this.bossName = null
    this.bossVolley = null
    const txt = this.add.text(480, 200, 'VICTOIRE !', { fontSize: '56px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0)
    this.tweens.add({ targets: txt, scale: 1.2, yoyo: true, repeat: 3, duration: 300 })
    this.createExit()
  }

  update() {
    if (this.player.hp <= 0) return
    const ui = this.scene.get('UI') as UIScene
    const joy = ui.joystick?.state ?? emptyControls()
    const touch: ControlsState = { ...joy, jump: this.jumpHeld }
    this.player.updateFromControls(mergeControls(this.keyboardControls(), touch))
    if (this.boss?.active && this.bossBar) {
      this.bossBar.setDisplaySize(600 * Math.max(0, this.boss.hp / this.boss.monster.hp), 18)
    }
  }
}
