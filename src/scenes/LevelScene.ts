import Phaser from 'phaser'
import { LEVELS, type LevelDef } from '../data/levels'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'
import { Prop } from '../entities/Prop'
import { MONSTERS } from '../data/monsters'
import { PROPS } from '../data/props'
import { MATERIALS } from '../data/materials'
import { physicalDamage, inMeleeReach } from '../core/combat'
import { grantXp } from '../core/progression'
import { emptyControls, mergeControls, type ControlsState } from '../core/controls'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { CooldownTracker, energyCostOf } from '../core/skill-executor'
import { ENERGY_ON_BASIC_HIT } from '../entities/Player'
import { SKILLS } from '../data/skills'
import { rollDrops } from '../core/loot'
import type { DropEntry } from '../core/types'
import type { UIScene } from './UIScene'
import { TILE, GROUND_ROW } from '../core/platforming'
import { BIOMES } from '../data/biomes'
import { audio, type MusicTrack } from '../audio/audio-engine'

// biomes → piste musicale ; 'carriere' n'a pas d'ambiance dédiée → repli sur 'montagne'
const BIOME_TRACKS: Record<string, MusicTrack> = {
  plaine: 'plaine', foret: 'foret', desert: 'desert', cave: 'cave', jungle: 'jungle',
  montagne: 'montagne', plage: 'plage', carriere: 'montagne', cimetiere: 'cimetiere', enfer: 'enfer',
}

export { TILE }

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  enemyProjectiles!: Phaser.Physics.Arcade.Group
  playerProjectiles!: Phaser.Physics.Arcade.Group
  pickups!: Phaser.Physics.Arcade.Group
  props!: Phaser.Physics.Arcade.Group
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  levelDef!: LevelDef
  private fromNode: string | null = null
  private targetNode: string | null = null
  private dir: 'forward' | 'backward' = 'forward'
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
  private bgFar?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite
  private bgClouds?: Phaser.GameObjects.TileSprite

  constructor() { super('Level') }

  init(data: { levelId: string; fromNode?: string; targetNode?: string; dir?: 'forward' | 'backward' }) {
    this.levelDef = LEVELS[data.levelId]!
    // fromNode/dir absents (ancienne save, accès direct) : entrée par défaut gauche→droite
    this.fromNode = data.fromNode ?? null
    this.targetNode = data.targetNode ?? null
    this.dir = data.dir ?? 'forward'
  }

  create() {
    // this.time.now est monotone sur toute la durée du jeu (partagé entre scènes) : sans reset,
    // les cooldowns de compétences posés dans un niveau précédent restent actifs dans le suivant.
    this.cooldowns = new CooldownTracker()

    const widthPx = this.levelDef.widthTiles * TILE
    this.physics.world.setBounds(0, 0, widthPx, 540)

    this.addBackground()

    audio.playMusic(this.levelDef.boss ? 'boss' : (BIOME_TRACKS[this.levelDef.biome] ?? 'plaine'))

    const platforms = (this.platforms = this.physics.add.staticGroup())
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
    // ponts de planches : plateformes fines traversables
    for (const br of this.levelDef.bridges ?? []) {
      for (let i = 0; i < br.w; i++) {
        const plank = platforms.create((br.x + i) * TILE + TILE / 2, br.y * TILE + 6, 'bridge') as Phaser.Physics.Arcade.Sprite
        // le visuel ne fait que 12px de haut ; à grande vitesse de chute le joueur peut
        // traverser cette fine tranche en un seul pas de physique (tunneling) — on épaissit
        // donc le corps de collision sans toucher au rendu
        ;(plank.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, 28)
      }
    }

    this.player = new Player(this, this.spawnX(), GROUND_ROW * TILE - 40)
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

    // le groupe applique ses defaults (allowGravity: true, immovable: false) à chaque ajout et
    // écraserait sinon les setAllowGravity(false)/setImmovable(true) posés dans Prop — sans ça,
    // un coffre "tombe" (gravité réactivée) dès qu'il rejoint le groupe
    this.props = this.physics.add.group({ allowGravity: false, immovable: true })
    for (const propDef of this.levelDef.props ?? []) {
      const yTile = propDef.y ?? GROUND_ROW - 1
      const prop = new Prop(this, propDef.x * TILE + TILE / 2, yTile * TILE + TILE / 2, PROPS[propDef.kind]!)
      this.props.add(prop)
      // les coffres attirent l'œil : petit rebond + éclat régulier
      if (propDef.kind === 'coffre') {
        this.tweens.add({ targets: prop, y: prop.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
        const glint = this.add.text(prop.x, prop.y - 22, '✦', { fontSize: '16px', color: '#fff59d' }).setOrigin(0.5)
        this.tweens.add({ targets: glint, alpha: 0.2, scale: 1.4, duration: 600, yoyo: true, repeat: -1 })
      }
    }

    // pièges (pics = dégâts, eau = noyade/K.O.)
    const hazards = this.physics.add.staticGroup()
    for (const hz of this.levelDef.hazards ?? []) {
      const tex = hz.kind === 'water' ? 'water' : 'spikes'
      const y = hz.kind === 'water' ? GROUND_ROW * TILE + 24 : GROUND_ROW * TILE + 8
      for (let i = 0; i < hz.w; i++) {
        const s = hazards.create((hz.x + i) * TILE + TILE / 2, y, tex) as Phaser.Physics.Arcade.Sprite
        s.setData('kind', hz.kind)
      }
    }
    this.physics.add.overlap(this.player, hazards, (_p, hzObj) => {
      this.hitPlayer((hzObj as Phaser.GameObjects.Sprite).getData('kind') === 'water' ? 9999 : 35)
    })

    // contact ennemi → joueur
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hitPlayer((e as Enemy).monster.atk))
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, proj) => {
      this.impactFx((proj as Projectile).x, (proj as Projectile).y, 0xff5252)
      this.hitPlayer((proj as Projectile).damage)
      ;(proj as Projectile).destroy()
    })
    this.physics.add.overlap(this.playerProjectiles, this.enemies, (projObj, eObj) => {
      const proj = projObj as Projectile, e = eObj as Enemy
      audio.playSfx('hit')
      if (proj.pierce) {
        if (proj.hitEnemies.has(e)) return
        proj.hitEnemies.add(e)
        e.takeDamage(physicalDamage(proj.damage, e.monster.def))
        this.impactFx(proj.x, proj.y, proj.tintTopLeft)
      } else {
        e.takeDamage(physicalDamage(proj.damage, e.monster.def))
        this.impactFx(proj.x, proj.y, proj.tintTopLeft)
        proj.destroy()
      }
    })
    this.physics.add.overlap(this.playerProjectiles, this.props, (projObj, propObj) => {
      const proj = projObj as Projectile, prop = propObj as Prop
      if (proj.pierce) {
        if (proj.hitEnemies.has(prop)) return
        proj.hitEnemies.add(prop)
        prop.takeDamage(1)
        this.impactFx(proj.x, proj.y, proj.tintTopLeft)
      } else {
        prop.takeDamage(1)
        this.impactFx(proj.x, proj.y, proj.tintTopLeft)
        proj.destroy()
      }
    })

    this.events.on('enemy-died', this.onEnemyDied, this)
    this.events.on('enemy-died', this.onBossDied, this)
    this.events.on('enemy-loot', this.onEnemyLoot, this)
    this.events.on('prop-broken', this.onPropBroken, this)
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

    this.add.text(480, 8, this.levelDef.name, { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5, 0).setScrollFactor(0)

    this.scene.launch('UI')
    this.jumpHeld = false
    this.game.events.on('input-jump-down', this.onJumpDown, this)
    this.game.events.on('input-jump-up', this.onJumpUp, this)
    this.events.on('player-jump', this.onPlayerJump, this)
    this.events.once('shutdown', () => {
      this.game.events.off('input-jump-down', this.onJumpDown, this)
      this.game.events.off('input-jump-up', this.onJumpUp, this)
      this.events.off('player-jump', this.onPlayerJump, this)
      this.game.events.off('input-attack', this.basicAttack, this)
      this.game.events.off('input-skill', this.castSkill, this)
      this.game.events.off('input-potion', this.usePotion, this)
      this.events.off('enemy-died', this.onEnemyDied, this)
      this.events.off('enemy-died', this.onBossDied, this)
      this.events.off('enemy-loot', this.onEnemyLoot, this)
      this.events.off('prop-broken', this.onPropBroken, this)
      this.bossVolley?.remove()
      this.scene.stop('UI')
    })
    this.game.events.emit('hud-refresh')
  }

  private addBackground() {
    const b = BIOMES[this.levelDef.biome] ?? BIOMES.plaine!
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30)
    sky.fillGradientStyle(b.skyTop, b.skyTop, b.skyBot, b.skyBot, 1).fillRect(0, 0, 960, 540)
    if (b.clouds) {
      this.bgClouds = this.add.tileSprite(0, 30, 960, 60, 'cloud').setOrigin(0).setScrollFactor(0).setDepth(-25).setAlpha(0.85)
    }
    this.bgFar = this.add.tileSprite(0, 300, 960, 240, 'hill').setOrigin(0).setScrollFactor(0).setDepth(-22).setTint(b.hillFar)
    this.bgNear = this.add.tileSprite(0, 360, 960, 200, 'hill').setOrigin(0).setScrollFactor(0).setDepth(-20).setTint(b.hillNear)

    // décors posés au sol pour remplir l'espace (défilent avec le monde, derrière le joueur)
    const widthPx = this.levelDef.widthTiles * TILE
    const groundY = GROUND_ROW * TILE
    const decoKey = `deco-${this.levelDef.biome}`
    if (this.textures.exists(decoKey)) {
      for (let x = 160; x < widthPx - 80; x += 250) {
        const jitter = ((x * 37) % 70) - 35 // pseudo-aléa déterministe
        this.add.image(x + jitter, groundY + 4, decoKey).setOrigin(0.5, 1).setDepth(-5)
      }
    }
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
  private onPlayerJump() { audio.playSfx('jump') }

  // apparition à gauche + sortie à droite en 'forward' (comportement historique) ;
  // en 'backward' (retour en arrière depuis la carte), on entre par la droite et on
  // ressort à gauche, vers le nœud d'où l'on vient
  private spawnX(): number { return this.dir === 'backward' ? (this.levelDef.widthTiles - 3) * TILE : 2 * TILE }
  private exitX(): number { return this.dir === 'backward' ? 2 * TILE : this.levelDef.widthTiles * TILE - 2 * TILE }

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
    // avance le marqueur vers le nœud visé ; si absent (accès direct/ancienne save), on ne le déplace pas
    if (this.targetNode) p.currentNode = this.targetNode
    save(p)
    this.scene.start('WorldMap')
  }

  hitPlayer(rawAtk: number) {
    if (this.time.now < this.invulnUntil || this.player.hp <= 0) return
    this.invulnUntil = this.time.now + 800
    this.player.takeDamage(physicalDamage(rawAtk, this.player.stats.def))
    this.player.setVelocity(-this.player.facing * 200, -200)
    audio.playSfx(this.player.hp <= 0 ? 'player-death' : 'player-hit')
    if (this.player.hp <= 0) {
      save(getPlayer())
      // écran K.O. clair avant de renvoyer à la carte
      this.add.rectangle(480, 270, 960, 540, 0x000000, 0.55).setScrollFactor(0).setDepth(20)
      this.add.text(480, 250, 'K.O. !', { fontSize: '64px', color: '#ff5252', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(21)
      this.add.text(480, 310, 'Retour à la carte…', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(21)
      this.time.delayedCall(1400, () => this.scene.start('WorldMap'))
    }
  }

  basicAttack() {
    if (this.player.hp <= 0) return
    if (this.time.now < this.nextBasicAttackAt) return
    this.nextBasicAttackAt = this.time.now + 1000 / this.player.stats.attackSpeed
    audio.playSfx('attack')
    this.player.playAttack()
    this.player.gainEnergy(ENERGY_ON_BASIC_HIT) // frapper recharge un peu l'énergie

    const cls = getPlayer().classId
    if (cls === 'archer' || cls === 'mage') {
      // attaque de base à distance : flèche (archer) ou orbe (mage)
      const proj = this.spawnPlayerProjectile(this.player.stats.atk, 420)
      proj.setTint(cls === 'archer' ? 0xd7a86e : 0x64b5f6)
    } else {
      this.slashFx(this.player.x + this.player.facing * 30, this.player.y, 60, 0xffffff)
      this.meleeHit(70, 1)
    }
  }

  // projectile allié tiré depuis la main, à hauteur des monstres
  private spawnPlayerProjectile(damage: number, rangePx: number): Projectile {
    const proj = new Projectile(this, this.player.x + this.player.facing * 22, this.player.y + 16, this.player.facing, 0, damage, true, rangePx)
    proj.setScale(1.5) // bien visible
    this.playerProjectiles.add(proj)
    return proj
  }

  // croissant de coup visible même dans le vide + petit élan du panda ; en mode "intense"
  // (gros coup), double croissant + léger tremblement de caméra
  private slashFx(cx: number, cy: number, w: number, color: number, intense = false) {
    const drawCrescent = (offsetDeg: number, scaleMul: number, alpha: number) => {
      const arc = this.add.graphics({ x: cx, y: cy }).setDepth(5)
      arc.lineStyle(intense ? 6 : 5, color, alpha).beginPath()
      arc.arc(0, 0, (w * 0.5) * scaleMul, Phaser.Math.DegToRad(-70 + offsetDeg), Phaser.Math.DegToRad(70 + offsetDeg), false)
      arc.strokePath()
      this.tweens.add({ targets: arc, scale: 1.4, alpha: 0, duration: 170, onComplete: () => arc.destroy() })
    }
    drawCrescent(0, 1, 0.95)
    if (intense) drawCrescent(16, 0.72, 0.55)
    this.tweens.add({ targets: this.player, x: this.player.x + this.player.facing * (intense ? 10 : 6), duration: 60, yoyo: true })
    if (intense) this.cameras.main.shake(60, 0.004)
  }

  // flash + petits éclats à l'endroit d'un impact (projectile touché, ou touché par un
  // projectile ennemi)
  private impactFx(x: number, y: number, color: number) {
    const flash = this.add.image(x, y, 'ring').setTint(color).setDepth(6).setScale(0.05)
    this.tweens.add({ targets: flash, scale: 0.4, alpha: 0, duration: 160, onComplete: () => flash.destroy() })
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3)
      const spark = this.add.rectangle(x, y, 3, 3, color).setDepth(6)
      this.tweens.add({ targets: spark, x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 16, alpha: 0, duration: 200, onComplete: () => spark.destroy() })
    }
  }

  // couleur d'effet selon l'élément du skill
  private skillColor(id: string): number {
    if (id.includes('feu') || id.includes('meteore')) return 0xff7043
    if (id.includes('givre')) return 0x4dd0e1
    if (id.includes('eclair')) return 0xfff176
    if (id === 'bambou-jete' || id === 'fleche-de-bambou') return 0x9ccc65 // bambou vert
    if (id.includes('fleche') || id.includes('tir') || id.includes('salve')) return 0xd7a86e
    if (id.includes('arcanique')) return 0xce93d8
    return 0xffd54f
  }

  // onde de choc de zone ; withShards ajoute une 2e onde plus rapide + des éclats
  // qui volent depuis le centre (utilisé pour les vrais sorts d'AoE, pas les petits effets)
  private aoeRing(x: number, y: number, radius: number, color: number, withShards = false) {
    const ring = this.add.image(x, y, 'ring').setTint(color).setDepth(5).setScale(0.2)
    this.tweens.add({ targets: ring, scale: radius / 28, alpha: 0, duration: 350, onComplete: () => ring.destroy() })
    if (withShards) {
      const shock = this.add.image(x, y, 'ring').setTint(color).setDepth(5).setScale(0.08).setAlpha(0.7)
      this.tweens.add({ targets: shock, scale: (radius / 28) * 1.35, alpha: 0, duration: 260, onComplete: () => shock.destroy() })
      const shardCount = 8
      for (let i = 0; i < shardCount; i++) {
        const a = (i / shardCount) * Math.PI * 2
        const dist = radius * Phaser.Math.FloatBetween(0.55, 1)
        const shard = this.add.rectangle(x, y, 4, 4, color).setDepth(6).setRotation(a)
        this.tweens.add({ targets: shard, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, duration: 380, onComplete: () => shard.destroy() })
      }
    }
  }

  private announceSkill(name: string, color = 0xffd700) {
    const hex = `#${color.toString(16).padStart(6, '0')}`
    const txt = this.add.text(this.player.x, this.player.y - 55, name + ' !', {
      fontSize: '16px', color: hex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.tweens.add({ targets: txt, y: txt.y - 25, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
  }

  castSkill(slot: number) {
    if (this.player.hp <= 0) return
    const p = getPlayer()
    const skillId = p.equippedSkills[slot]
    if (!skillId || !this.cooldowns.canUse(slot, this.time.now)) return
    const skill = SKILLS[skillId]!
    if (!this.player.spendEnergy(energyCostOf(skill))) {
      this.announceSkill('Pas assez d\'énergie', 0x4dd0e1)
      return
    }
    this.cooldowns.use(slot, this.time.now, skill.cooldownMs)
    this.game.events.emit('skill-cooldown', slot, this.time.now + skill.cooldownMs)
    audio.playSfx('skill')
    this.announceSkill(skill.name)

    const { atk, maxHp } = this.player.stats
    const color = this.skillColor(skill.id)
    // rang investi : +25% de puissance par point au-delà du 1er
    const rank = p.skillLevels[skill.id] ?? 1
    const mult = skill.multiplier * (1 + 0.25 * (rank - 1))
    if (skill.kind === 'melee') {
      this.player.playAttack()
      // gros coup (rang inclus) : double croissant + tremblement de caméra
      this.slashFx(this.player.x + (this.player.facing * skill.range) / 2, this.player.y, skill.range, color, mult >= 2)
      this.meleeHit(skill.range, mult)
    } else if (skill.kind === 'aoe') {
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= skill.range) {
          e.takeDamage(physicalDamage(atk, e.monster.def, mult))
        }
      }
      for (const obj of this.props.getChildren()) {
        const prop = obj as Prop
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, prop.x, prop.y) <= skill.range) {
          prop.takeDamage(1)
        }
      }
      this.aoeRing(this.player.x, this.player.y, skill.range, color, true)
    } else if (skill.kind === 'projectile') {
      const proj = this.spawnPlayerProjectile(atk * mult, skill.range)
      if (skill.arc) {
        // lancé en cloche : gravité + rebond + rotation (bambou)
        const b = proj.body as Phaser.Physics.Arcade.Body
        b.setAllowGravity(true)
        b.setVelocity(this.player.facing * 340, -430)
        b.setBounce(0.45)
        proj.setTexture('bamboo').setScale(1).setTint(color).setAngularVelocity(this.player.facing * 480)
        this.physics.add.collider(proj, this.platforms)
      } else if (skill.pierce) {
        // gros faisceau qui transperce tout sur son trajet
        proj.pierce = true
        proj.setTexture('beam').setTint(color).setDisplaySize(52, 16)
      } else {
        proj.setTint(color)
        if (skill.multiplier >= 2.5) proj.setScale(1.8)
        else if (skill.multiplier >= 1.6) proj.setScale(1.3)
      }
    } else if (skill.kind === 'heal') {
      this.player.heal(Math.round(maxHp * mult))
      this.aoeRing(this.player.x, this.player.y, 70, 0x66bb6a)
      // halo doux qui pulse sous le panda, en plus de l'onde
      const halo = this.add.image(this.player.x, this.player.y, 'ring').setTint(0x81ffa0).setAlpha(0.35).setDepth(3).setScale(1.6)
      this.tweens.add({ targets: halo, scale: 2.3, alpha: 0, duration: 620, onComplete: () => halo.destroy() })
      for (let i = 0; i < 8; i++) {
        const spark = this.add.text(
          this.player.x + Phaser.Math.Between(-26, 26), this.player.y + 14, '✦',
          { fontSize: `${Phaser.Math.Between(12, 18)}px`, color: '#8aff9a' },
        ).setOrigin(0.5).setDepth(6)
        this.tweens.add({ targets: spark, y: spark.y - Phaser.Math.Between(45, 75), alpha: 0, duration: 750, delay: i * 45, onComplete: () => spark.destroy() })
      }
    }
  }

  // Touche les ennemis/props devant le panda (ou pile sur lui), avec grande tolérance
  // verticale : le centre du grand sprite panda est plus haut que celui des monstres.
  meleeHit(reach: number, multiplier: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    const atk = this.player.stats.atk
    let touched = false
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active && inMeleeReach((e.x - px) * f, Math.abs(e.y - py), reach)) {
        e.takeDamage(physicalDamage(atk, e.monster.def, multiplier))
        touched = true
      }
    }
    if (touched) audio.playSfx('hit')
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      if (prop.active && inMeleeReach((prop.x - px) * f, Math.abs(prop.y - py), reach)) prop.takeDamage(1)
    }
  }

  // effet "level up" façon RO : rayons dorés + anneau + texte sur le perso
  private levelUpFx() {
    const x = this.player.x, y = this.player.y
    audio.playSfx('level-up')
    this.aoeRing(x, y, 90, 0xffd54f)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const ray = this.add.rectangle(x, y, 4, 26, 0xfff176).setDepth(6).setRotation(a)
      this.tweens.add({ targets: ray, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, alpha: 0, duration: 500, onComplete: () => ray.destroy() })
    }
    const txt = this.add.text(x, y - 70, 'LEVEL UP !', { fontSize: '26px', color: '#ffd700', fontStyle: 'bold', stroke: '#5d3a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(7)
    txt.setScale(0.4)
    this.tweens.add({ targets: txt, scale: 1, duration: 250, ease: 'Back.out' })
    this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, delay: 900, duration: 600, onComplete: () => txt.destroy() })
  }

  onEnemyLoot(e: Enemy) { this.spawnDrops(e.x, e.y, e.monster.drops) }

  onPropBroken(prop: Prop) {
    if (prop.def.id === 'coffre') {
      const open = this.add.image(prop.x, prop.y, 'chest-open').setDepth(4)
      this.aoeRing(prop.x, prop.y, 40, 0xffd54f)
      this.tweens.add({ targets: open, y: open.y - 8, scale: 1.15, duration: 160, yoyo: true, onComplete: () => open.destroy() })
    }
    this.spawnDrops(prop.x, prop.y, prop.def.drops)
  }

  spawnDrops(x: number, y: number, drops: DropEntry[]) {
    const result = rollDrops(drops)
    const spawn = (texture: string, data: Record<string, unknown>, tint?: number) => {
      const s = this.pickups.create(x + Phaser.Math.Between(-20, 20), y - 10, texture) as Phaser.Physics.Arcade.Sprite
      s.setVelocity(Phaser.Math.Between(-80, 80), -200)
      s.setData(data)
      if (tint !== undefined) s.setTint(tint)
    }
    if (result.gold > 0) spawn('coin', { gold: result.gold })
    for (let i = 0; i < result.potions; i++) spawn('potion-drop', { potion: 1 })
    for (const itemId of result.items) spawn('item-drop', { itemId })
    for (const materialId of result.materials) spawn('material-drop', { materialId }, MATERIALS[materialId]!.color)
  }

  collectPickup(s: Phaser.Physics.Arcade.Sprite) {
    const p = getPlayer()
    const gold = s.getData('gold') as number | undefined
    const potion = s.getData('potion') as number | undefined
    const itemId = s.getData('itemId') as string | undefined
    const materialId = s.getData('materialId') as string | undefined
    if (gold) {
      p.gold += gold
      audio.playSfx('coin')
      const txt = this.add.text(s.x, s.y - 10, `+${gold} or`, { fontSize: '16px', color: '#ffd700' }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    }
    if (potion) {
      p.potions += potion
      audio.playSfx('potion')
      const txt = this.add.text(s.x, s.y - 10, '♥', { fontSize: '20px', color: '#ff6b81' }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    }
    if (itemId) p.inventory.push(itemId)
    if (materialId) {
      p.materials[materialId] = (p.materials[materialId] ?? 0) + 1
      const def = MATERIALS[materialId]!
      const color = `#${def.color.toString(16).padStart(6, '0')}`
      const txt = this.add.text(s.x, s.y - 10, def.name, { fontSize: '14px', color }).setOrigin(0.5)
      this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    }
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
    audio.playSfx('enemy-death')
    p.monstersKilled += 1
    const { levelsGained } = grantXp(p, e.monster.xp)
    this.events.emit('enemy-loot', e) // consommé en Task 13
    if (levelsGained > 0) {
      this.player.refreshStats()
      this.game.events.emit('player-level-up', p.level)
      this.levelUpFx()
    }
    save(p)
    this.game.events.emit('hud-refresh')
  }

  // écoute permanente (voir shutdown) ; ne consomme rien tant que ce n'est pas le boss en cours
  onBossDied(e: Enemy) {
    if (e !== this.boss) return
    audio.playSfx('boss-victory')
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

  update(_time: number, delta: number) {
    const sx = this.cameras.main.scrollX
    if (this.bgClouds) this.bgClouds.tilePositionX = sx * 0.1
    if (this.bgFar) this.bgFar.tilePositionX = sx * 0.3
    if (this.bgNear) this.bgNear.tilePositionX = sx * 0.55
    if (this.player.hp <= 0) return
    this.player.regenEnergy(delta)
    const ui = this.scene.get('UI') as UIScene
    const joy = ui.joystick?.state ?? emptyControls()
    const touch: ControlsState = { ...joy, jump: this.jumpHeld }
    this.player.updateFromControls(mergeControls(this.keyboardControls(), touch))
    if (this.boss?.active && this.bossBar) {
      this.bossBar.setDisplaySize(600 * Math.max(0, this.boss.hp / this.boss.monster.hp), 18)
    }
  }
}
