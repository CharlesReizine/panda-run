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
import { TILE, GROUND_ROW, GRAVITY, landsOnOneWayPlatform } from '../core/platforming'
import { BIOMES } from '../data/biomes'
import { audio, type MusicTrack } from '../audio/audio-engine'

// biomes → piste musicale ; 'carriere' n'a pas d'ambiance dédiée → repli sur 'montagne'
const BIOME_TRACKS: Record<string, MusicTrack> = {
  plaine: 'plaine', foret: 'foret', desert: 'desert', cave: 'cave', jungle: 'jungle',
  montagne: 'montagne', plage: 'plage', carriere: 'montagne', cimetiere: 'cimetiere', enfer: 'enfer',
}

// largeur de la barre de vie du boss (centrée sous son nom)
const BOSS_BAR_W = 440

export { TILE }

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  enemyProjectiles!: Phaser.Physics.Arcade.Group
  playerProjectiles!: Phaser.Physics.Arcade.Group
  pickups!: Phaser.Physics.Arcade.Group
  props!: Phaser.Physics.Arcade.Group
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private oneWayPlatforms!: Phaser.Physics.Arcade.StaticGroup
  private ladderRects: Phaser.Geom.Rectangle[] = []
  private waterRects: Phaser.Geom.Rectangle[] = []
  private lastCheckpoint: { x: number; y: number } | null = null
  levelDef!: LevelDef
  private fromNode: string | null = null
  private targetNode: string | null = null
  private dir: 'forward' | 'backward' = 'forward'
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private jumpHeld = false
  private invulnUntil = 0
  private dashUntil = 0
  private dashCooldownUntil = 0
  private nextBasicAttackAt = 0
  private cooldowns = new CooldownTracker()
  private boss: Enemy | null = null
  private bossBar: Phaser.GameObjects.Rectangle | null = null
  private bossBarBg: Phaser.GameObjects.Rectangle | null = null
  private bossName: Phaser.GameObjects.Text | null = null
  private bossVolley: Phaser.Time.TimerEvent | null = null
  private bossPhase = 1
  private bgFar?: Phaser.GameObjects.TileSprite
  private bgNear?: Phaser.GameObjects.TileSprite
  private bgClouds?: Phaser.GameObjects.TileSprite
  private hitStopTimer: Phaser.Time.TimerEvent | null = null

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
    // la scène est réutilisée entre niveaux : ces états doivent repartir de zéro
    this.ladderRects = []
    this.waterRects = []
    this.lastCheckpoint = null

    const widthPx = this.levelDef.widthTiles * TILE
    this.physics.world.setBounds(0, 0, widthPx, 540)

    // Garde-fou anti-gel. Le hit-stop met le monde physique GLOBAL en pause puis programme
    // sa reprise via l'horloge de la scène ; or cette horloge se gèle dès qu'un overlay
    // (menu Pause / compétences) met la scène en pause. Un hit-stop déclenché juste avant
    // l'ouverture d'un menu laisserait donc la physique figée toute la durée du menu.
    // Deux filets : on repart toujours d'un monde actif à la (re)création, et on force la
    // reprise dès que la scène ressort d'une pause (reprise INSTANTANÉE, sans attendre le
    // timer), ce qui rend le monde physique impossible à laisser figé.
    this.physics.world.resume()
    this.hitStopTimer = null
    this.events.on(Phaser.Scenes.Events.RESUME, this.resumeWorld, this)

    this.addBackground()

    audio.playMusic(this.levelDef.boss ? 'boss' : (BIOME_TRACKS[this.levelDef.biome] ?? 'plaine'))

    const platforms = (this.platforms = this.physics.add.staticGroup())
    // plateformes traversables par le bas (one-way) : surélevées + ponts. Le SOL, lui,
    // reste dans `platforms` et donc solide dans les deux sens.
    const oneWay = (this.oneWayPlatforms = this.physics.add.staticGroup())
    const tileKey = `tile-${this.levelDef.biome}`
    // texture « dalle flottante » pour les plateformes surélevées (tranche de terre marquée) ;
    // même taille 32×32 que le sol → corps de collision identique, seul le rendu change
    const platformKey = `platform-${this.levelDef.biome}`
    for (let x = 0; x < this.levelDef.widthTiles; x++) {
      platforms.create(x * TILE + TILE / 2, GROUND_ROW * TILE + TILE, tileKey)
      platforms.create(x * TILE + TILE / 2, (GROUND_ROW + 1) * TILE + TILE, tileKey)
    }
    // plateformes surélevées : on les traverse en montant et on se pose dessus en
    // retombant (voir landsFromAbove). Sans ça, une plateforme qui en surplombe une
    // autre (escaliers) fait cogner son dessous au joueur qui saute → il retombe.
    for (const p of this.levelDef.platforms) {
      for (let i = 0; i < p.w; i++) {
        oneWay.create((p.x + i) * TILE + TILE / 2, p.y * TILE + TILE / 2, platformKey)
      }
    }
    // ponts de planches : plateformes fines, elles aussi traversables par le bas
    for (const br of this.levelDef.bridges ?? []) {
      for (let i = 0; i < br.w; i++) {
        const plank = oneWay.create((br.x + i) * TILE + TILE / 2, br.y * TILE + 6, 'bridge') as Phaser.Physics.Arcade.Sprite
        // le visuel ne fait que 12px de haut ; à grande vitesse de chute le joueur peut
        // traverser cette fine tranche en un seul pas de physique (tunneling) — on épaissit
        // donc le corps de collision sans toucher au rendu
        ;(plank.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, 28)
      }
    }

    this.player = new Player(this, this.spawnX(), GROUND_ROW * TILE - 40)
    this.physics.add.collider(this.player, platforms)
    // collision one-way : validée seulement quand le panda retombe sur le dessus
    this.physics.add.collider(this.player, oneWay, undefined, this.landsFromAbove)

    this.enemies = this.physics.add.group()
    this.physics.add.collider(this.enemies, platforms)
    this.physics.add.collider(this.enemies, oneWay)

    // allowGravity: false par défaut — SINON le groupe réapplique son défaut (gravité ON) à
    // chaque `add()` et écrase le setAllowGravity(false) du constructeur de Projectile : les tirs
    // horizontaux se mettaient alors à TOMBER à la verticale. Les tirs en cloche (bambou,
    // mandragore) réactivent explicitement la gravité APRÈS l'ajout au groupe.
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false })
    this.playerProjectiles = this.physics.add.group({ allowGravity: false })

    this.pickups = this.physics.add.group()
    this.physics.add.collider(this.pickups, platforms)
    this.physics.add.collider(this.pickups, oneWay)
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

    // pics = danger mortel ; eau = zone nageable (rendu + zone d'overlap, jamais létale)
    const spikes = this.physics.add.staticGroup()
    const WATER_TOP = GROUND_ROW - 2 // l'eau monte de 2 tuiles au-dessus du sol : de quoi nager
    for (const hz of this.levelDef.hazards ?? []) {
      if (hz.kind === 'spikes') {
        for (let i = 0; i < hz.w; i++) {
          spikes.create((hz.x + i) * TILE + TILE / 2, GROUND_ROW * TILE + 8, 'spikes')
        }
      } else {
        // bassin d'eau : plusieurs rangées de tuiles translucides derrière le joueur
        for (let ty = WATER_TOP; ty <= GROUND_ROW + 1; ty++) {
          for (let i = 0; i < hz.w; i++) {
            this.add.image((hz.x + i) * TILE + TILE / 2, ty * TILE + TILE / 2, 'water').setDepth(-2)
          }
        }
        this.waterRects.push(new Phaser.Geom.Rectangle(
          hz.x * TILE, WATER_TOP * TILE, hz.w * TILE, (GROUND_ROW + 2 - WATER_TOP) * TILE,
        ))
      }
    }
    this.physics.add.overlap(this.player, spikes, () => this.hitPlayer(35))

    // échelles : texture répétée + zone d'escalade (gérée dans update via ladderRects)
    for (const l of this.levelDef.ladders ?? []) {
      for (let i = 0; i < l.h; i++) {
        this.add.image(l.x * TILE + TILE / 2, (l.y + i) * TILE + TILE / 2, 'ladder').setDepth(-1)
      }
      // on descend d'une tuile sous le bas de l'échelle pour pouvoir l'attraper depuis le sol
      // zone d'accroche large de 2 tuiles (centrée sur l'échelle) : plus de décrochage au moindre
      // décalage (avant : 1 tuile, testée sur le centre du panda → « casse-gueule »)
      this.ladderRects.push(new Phaser.Geom.Rectangle(
        l.x * TILE - TILE / 2, l.y * TILE, TILE * 2, (l.h + 1) * TILE,
      ))
    }

    // checkpoints : drapeaux ; passer dessus mémorise le point de réapparition
    for (const cp of this.levelDef.checkpoints ?? []) {
      const fx = cp.x * TILE + TILE / 2
      const fy = GROUND_ROW * TILE - 22
      const flag = this.physics.add.staticImage(fx, fy, 'flag')
      let activated = false
      this.physics.add.overlap(this.player, flag, () => {
        if (activated) return
        activated = true
        this.lastCheckpoint = { x: fx, y: GROUND_ROW * TILE - 40 }
        flag.setTint(0x66bb6a)
        audio.playSfx('level-up')
        this.aoeRing(fx, fy, 50, 0x66bb6a)
        const txt = this.add.text(fx, fy - 30, 'Checkpoint !', {
          fontSize: '16px', color: '#a5d6a7', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5)
        this.tweens.add({ targets: txt, y: txt.y - 24, alpha: 0, duration: 800, onComplete: () => txt.destroy() })
      })
    }

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
    // clavier PC : ESPACE = attaque de base (même effet que le bouton ATTAQUE tactile). X reste
    // un raccourci d'attaque secondaire. Le SAUT est porté par la flèche HAUT (voir keyboardControls).
    this.input.keyboard!.on('keydown-SPACE', this.basicAttack, this)
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
    this.bossPhase = 1
    if (this.levelDef.boss) {
      this.spawnBoss()
    } else {
      this.createExit()
    }

    this.cameras.main.setBounds(0, 0, widthPx, 540)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.cursors = this.input.keyboard!.createCursorKeys()
    // clavier PC additionnel : ZQSD (AZERTY) et WASD (QWERTY) doublent les flèches —
    // gauche = A/Q, droite = D, haut = W/Z, bas = S. HAUT = saut (hors échelle) ou grimpe (sur
    // échelle) ; ESPACE = attaque ; MAJ = dash.
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,Z,Q') as Record<string, Phaser.Input.Keyboard.Key>

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
      this.events.off(Phaser.Scenes.Events.RESUME, this.resumeWorld, this)
      this.hitStopTimer?.remove()
      this.hitStopTimer = null
      this.bossVolley?.remove()
      this.scene.stop('UI')
    })
    this.game.events.emit('hud-refresh')
    this.showTutoOnce()
  }

  // tuto d'intro : au tout premier niveau joué, un panneau non bloquant rappelle les
  // contrôles ; un tap le ferme ; un flag localStorage garantit qu'il n'apparaît qu'une fois
  private showTutoOnce() {
    const TUTO_KEY = 'panda-run:tuto-vu'
    try {
      if (typeof localStorage === 'undefined' || localStorage.getItem(TUTO_KEY) === '1') return
      localStorage.setItem(TUTO_KEY, '1')
    } catch { return } // localStorage inaccessible : pas de tuto plutôt que de risquer un boom

    const depth = 40
    const panel = this.add.rectangle(480, 270, 560, 340, 0x0d1b2a, 0.92)
      .setScrollFactor(0).setDepth(depth).setStrokeStyle(2, 0xffd54f, 0.6)
    const title = this.add.text(480, 130, 'Comment jouer', { fontSize: '28px', color: '#ffd54f', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1)
    const lines = [
      '• Déplacer : joystick / flèches gauche-droite',
      '• Sauter : bouton SAUT / flèche HAUT',
      '• Attaquer : bouton ATTAQUE / ESPACE',
      '• Compétences : slots 1-4 / touches 1-4',
      '• Potion : bouton potion / P',
      '• Toucher la barre de vie : gérer les compétences',
    ]
    const body = this.add.text(230, 175, lines.join('\n'), { fontSize: '16px', color: '#ffffff', lineSpacing: 8 })
      .setScrollFactor(0).setDepth(depth + 1)
    const hint = this.add.text(480, 400, 'Tape pour fermer', { fontSize: '15px', color: '#b0bec5' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1)

    const parts = [panel, title, body, hint]
    // capteur plein écran : un tap n'importe où ferme le panneau (sans bloquer le jeu dessous)
    const catcher = this.add.rectangle(480, 270, 960, 540, 0xffffff, 0.001)
      .setScrollFactor(0).setDepth(depth + 2).setInteractive()
    catcher.once('pointerdown', () => {
      audio.playSfx('ui-tap')
      for (const p of parts) p.destroy()
      catcher.destroy()
    })
  }

  private addBackground() {
    const b = BIOMES[this.levelDef.biome] ?? BIOMES.plaine!

    // fond de biome illustré (public/art/biome-<clé>.png) : mis à l'échelle « cover » à partir
    // de la taille réelle de la texture pour couvrir TOUT le viewport (960×540) sans jamais
    // laisser de bande vide, centré, épinglé à la caméra (scrollFactor 0). Quand il est présent,
    // il remplace intégralement le décor procédural (ciel dégradé + nuages + collines) qui
    // ferait doublon et jurerait avec l'illustration. Fallback (biome sans image) : on garde
    // l'ancien décor procédural (dégradé + nuages + collines).
    const biomeKey = `biome-${this.levelDef.biome}`
    const hasBiomeArt = this.textures.exists(biomeKey)
    if (hasBiomeArt) {
      const src = this.textures.get(biomeKey).getSourceImage()
      const cover = Math.max(960 / src.width, 540 / src.height)
      this.add.image(480, 270, biomeKey).setScale(cover).setScrollFactor(0).setDepth(-28)
    } else {
      const sky = this.add.graphics().setScrollFactor(0).setDepth(-30)
      sky.fillGradientStyle(b.skyTop, b.skyTop, b.skyBot, b.skyBot, 1).fillRect(0, 0, 960, 540)
      if (b.clouds) {
        this.bgClouds = this.add.tileSprite(0, 30, 960, 60, 'cloud').setOrigin(0).setScrollFactor(0).setDepth(-25).setAlpha(0.85)
      }
      this.bgFar = this.add.tileSprite(0, 300, 960, 240, 'hill').setOrigin(0).setScrollFactor(0).setDepth(-22).setTint(b.hillFar)
      this.bgNear = this.add.tileSprite(0, 360, 960, 200, 'hill').setOrigin(0).setScrollFactor(0).setDepth(-20).setTint(b.hillNear)
    }

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
    // clavier PC : gauche/droite (+ A/Q, D) = déplacement ; FLÈCHE HAUT (+ W/Z) = saut HORS
    // échelle, grimpe SUR échelle ; BAS (+ S) = descendre l'échelle / nager. Le saut est donc
    // porté par « up », mais activé comme jump uniquement hors échelle (sinon up sert à grimper).
    // ESPACE (attaque) et MAJ (dash) sont gérés par leurs propres écouteurs keydown.
    const k = this.wasd
    const up = this.cursors.up.isDown || !!(k.W?.isDown || k.Z?.isDown)
    return {
      left: this.cursors.left.isDown || !!(k.A?.isDown || k.Q?.isDown),
      right: this.cursors.right.isDown || !!k.D?.isDown,
      jump: up && !this.player.onLadder,
      up,
      down: this.cursors.down.isDown || !!k.S?.isDown,
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

  // processCallback des plateformes one-way : la collision n'est retenue que si le panda
  // descend (velocity.y >= 0) ET que ses pieds (début de frame) ne sont pas passés sous le
  // DESSOUS de la dalle. On monte donc librement à travers, puis on se pose dessus en retombant
  // sans risquer de retraverser en s'enfonçant d'un poil (voir landsOnOneWayPlatform).
  private readonly landsFromAbove: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, platObj) => {
    const pb = (playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body
    const plat = (platObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.StaticBody
    return landsOnOneWayPlatform(pb.prev.y + pb.height, pb.velocity.y, plat.bottom)
  }

  createExit() {
    const doorX = this.exitX()
    // la porte (texture 'exit', 210 px de haut) repose au sol : on ancre son bas sur la ligne
    // de sol (comme l'ancienne sortie, légèrement plantée dans la terre)
    const doorH = 210
    const doorBottom = GROUND_ROW * TILE + 20
    const doorY = doorBottom - doorH / 2
    // halo lumineux pulsant DERRIÈRE la porte : aura blanc/jaune attirante (alpha + échelle)
    const glow = this.add.image(doorX, doorY - 4, 'exit-glow')
      .setDepth(-1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff3c0).setAlpha(0.5).setScale(1.2)
    this.tweens.add({ targets: glow, alpha: 0.85, scale: 1.55, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    // la porte elle-même ; le corps d'overlap reste la texture entière → le joueur déclenche
    // completeLevel dès qu'il l'atteint (comportement conservé, simplement une plus grande cible)
    const exit = this.physics.add.staticImage(doorX, doorY, 'exit')
    this.physics.add.overlap(this.player, exit, () => this.completeLevel())
  }

  spawnBoss() {
    const def = MONSTERS[this.levelDef.boss!]!
    const boss = new Enemy(this, this.levelDef.widthTiles * TILE * 0.7, GROUND_ROW * TILE - 80, def)
    this.enemies.add(boss)
    this.boss = boss

    // barre de vie du boss : centrée sous son nom, largeur maîtrisée et posée assez bas pour
    // ne PAS chevaucher les slots de compétences en haut à droite (qui descendent jusqu'à ~y63)
    this.bossName = this.add.text(480, 74, def.name, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0)
    this.bossBarBg = this.add.rectangle(480, 100, BOSS_BAR_W + 4, 20, 0x000000, 0.6).setScrollFactor(0).setStrokeStyle(1, 0xffffff, 0.3)
    this.bossBar = this.add.rectangle(480 - BOSS_BAR_W / 2, 100, BOSS_BAR_W, 16, 0xef5350).setOrigin(0, 0.5).setScrollFactor(0)

    this.bossPhase = 1
    this.startBossVolley(5000) // phase 1 : salve toutes les 5 s
  }

  // (re)programme la salve du boss courant ; le pattern dépend de la phase active
  private startBossVolley(delay: number) {
    this.bossVolley?.remove()
    const boss = this.boss
    if (!boss) return
    const def = boss.monster
    this.bossVolley = this.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        if (!boss.active) return
        if (this.bossPhase >= 2) {
          // éventail de 5 projectiles + slam de zone télégraphié sous le joueur
          for (const dy of [-0.5, -0.25, 0, 0.25, 0.5]) {
            const proj = new Projectile(this, boss.x, boss.y - 20, this.player.x - boss.x, this.player.y - boss.y + dy * 260, def.atk, false, 650)
            proj.setTexture('fx-shot').clearTint()
            this.enemyProjectiles.add(proj)
            proj.launch()
          }
          this.enemyGroundSpell(this.player.x, def.atk)
        } else {
          for (const dy of [-0.3, 0, 0.3]) {
            const proj = new Projectile(this, boss.x, boss.y - 20, this.player.x - boss.x, this.player.y - boss.y + dy * 200, def.atk, false, 600)
            proj.setTexture('fx-shot').clearTint()
            this.enemyProjectiles.add(proj)
            proj.launch()
          }
        }
      },
    })
  }

  // passage en furie sous 50 % PV : cadence accélérée + nouveau pattern, une seule fois
  private enterBossPhase2() {
    this.bossPhase = 2
    this.startBossVolley(2500)
    this.cameras.main.shake(300, 0.01)
    const txt = this.add.text(480, 150, 'ENRAGÉ !', {
      fontSize: '44px', color: '#ff1744', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setScale(0.3)
    this.tweens.add({
      targets: txt, scale: 1.2, duration: 260, ease: 'Back.out', yoyo: true, hold: 500,
      onComplete: () => this.tweens.add({ targets: txt, alpha: 0, duration: 500, onComplete: () => txt.destroy() }),
    })
  }

  // sort de zone télégraphié posé au sol : marqueur qui se remplit ~600 ms, puis dégâts
  // de zone (onde de choc) touchant le joueur s'il est encore dans le cercle
  enemyGroundSpell(targetX: number, damage: number) {
    const groundY = GROUND_ROW * TILE - 10
    const radius = 58
    const marker = this.add.graphics().setDepth(4)
    const draw = (fill: number) => {
      marker.clear()
      marker.fillStyle(0xab47bc, 0.12 + fill * 0.25).fillCircle(targetX, groundY, radius)
      marker.lineStyle(3, 0xce93d8, 0.5 + fill * 0.5).strokeCircle(targetX, groundY, radius)
    }
    draw(0)
    this.tweens.addCounter({ from: 0, to: 1, duration: 600, onUpdate: (tw) => draw(tw.getValue() ?? 0) })
    this.time.delayedCall(600, () => {
      marker.destroy()
      this.aoeRing(targetX, groundY, radius, 0xab47bc, true)
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, groundY) <= radius) {
        this.hitPlayer(damage)
      }
    })
  }

  // roulade d'esquive : impulsion horizontale rapide + brève invulnérabilité + traînée
  dash() {
    if (this.player.hp <= 0) return
    if (this.time.now < this.dashCooldownUntil) return
    this.dashCooldownUntil = this.time.now + 1200
    this.dashUntil = this.time.now + 180
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 300)
    audio.playSfx('jump')
    this.player.setVelocityX(this.player.facing * 600)
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 40, () => {
        if (!this.player.active || this.player.hp <= 0) return
        const echo = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
          .setFlipX(this.player.flipX).setAlpha(0.5).setTint(0x81d4fa).setDepth(this.player.depth - 1)
          .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
        this.tweens.add({ targets: echo, alpha: 0, duration: 220, onComplete: () => echo.destroy() })
      })
    }
  }

  completeLevel() {
    if (this.player.hp <= 0) return
    // niveau terminé : PV + énergie remis au maximum (on entame le niveau suivant plein).
    // Un nouveau Player est instancié à chaque niveau (déjà plein), c'est la garantie explicite.
    this.player.restoreFull()
    const p = getPlayer()
    if (!p.completedLevels.includes(this.levelDef.id)) p.completedLevels.push(this.levelDef.id)
    // avance le marqueur vers le nœud visé ; si absent (accès direct/ancienne save), on ne le déplace pas
    if (this.targetNode) p.currentNode = this.targetNode
    save(p)
    this.scene.start('WorldMap')
  }

  hitPlayer(rawAtk: number) {
    // God mode DEV (émulateur/tests physiques) : le joueur ne perd jamais de PV. Inoffensif
    // en prod — window.__pandaGodMode est absent (donc falsy) par défaut.
    if ((globalThis as { __pandaGodMode?: boolean }).__pandaGodMode) return
    if (this.time.now < this.invulnUntil || this.player.hp <= 0) return
    this.invulnUntil = this.time.now + 800
    this.player.takeDamage(physicalDamage(rawAtk, this.player.stats.def))
    this.player.setVelocity(-this.player.facing * 200, -200)
    audio.playSfx(this.player.hp <= 0 ? 'player-death' : 'player-hit')
    if (this.player.hp <= 0) {
      // un checkpoint atteint : on réapparaît sur place plutôt que de repartir à la carte
      if (this.lastCheckpoint) { this.respawnAtCheckpoint(); return }
      save(getPlayer())
      this.showGameOver()
    }
  }

  // écran K.O. avec choix « Réessayer » (relance le niveau à l'identique) ou « Carte »
  private showGameOver() {
    // Fige la caméra sur place. Sans ça, le suivi continue de lerper vers le panda projeté par
    // le knockback (puis en chute), ce qui fait « scroller » l'écran juste avant le K.O.
    this.cameras.main.stopFollow()
    // stoppe net le corps du joueur (plus de dérive de la physique sous l'overlay) et le masque :
    // l'illustration K.O. le remplace, épinglée à l'écran (indépendante du scroll du monde).
    this.player.setVelocity(0, 0)
    ;(this.player.body as Phaser.Physics.Arcade.Body).stop()
    this.player.setVisible(false)

    // voile sombre plein écran, épinglé à l'écran
    this.add.rectangle(480, 270, 960, 540, 0x0b0b12, 0.72).setScrollFactor(0).setDepth(20)
    this.add.text(480, 78, 'K.O. !', {
      fontSize: '64px', color: '#ff5252', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22)

    // illustration K.O. (panda sur le dos + étoiles), centrée, avec fondu + léger zoom d'arrivée
    const dead = this.add.image(480, 258, 'death-panda').setScrollFactor(0).setDepth(21)
    const targetH = 250
    dead.setDisplaySize(targetH * (dead.width / dead.height), targetH)
    const sx = dead.scaleX, sy = dead.scaleY
    dead.setScale(sx * 0.7, sy * 0.7).setAlpha(0)
    this.tweens.add({ targets: dead, alpha: 1, duration: 320, ease: 'Quad.out' })
    this.tweens.add({ targets: dead, scaleX: sx, scaleY: sy, duration: 440, ease: 'Back.out' })

    const mkButton = (x: number, label: string, bg: number, onTap: () => void) => {
      const t = this.add.text(x, 448, label, {
        fontSize: '26px', color: '#ffffff', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`,
        padding: { x: 22, y: 12 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(22).setInteractive({ useHandCursor: true })
      t.on('pointerdown', () => {
        audio.playSfx('ui-tap')
        onTap()
      })
    }

    mkButton(360, 'Réessayer', 0x33691e, () => this.scene.restart({
      levelId: this.levelDef.id,
      fromNode: this.fromNode ?? undefined,
      targetNode: this.targetNode ?? undefined,
      dir: this.dir,
    }))
    mkButton(600, 'Carte', 0x455a64, () => this.scene.start('WorldMap'))
  }

  // réapparition au dernier checkpoint : PV pleins, brève invulnérabilité, sans retour carte
  private respawnAtCheckpoint() {
    const cp = this.lastCheckpoint!
    this.cameras.main.flash(250, 120, 200, 120)
    this.player.setPosition(cp.x, cp.y)
    this.player.setVelocity(0, 0)
    this.player.clearTint()
    this.player.heal(this.player.stats.maxHp)
    this.invulnUntil = this.time.now + 1500
  }

  basicAttack() {
    if (this.player.hp <= 0) return
    if (this.time.now < this.nextBasicAttackAt) return
    this.nextBasicAttackAt = this.time.now + 1000 / this.player.stats.attackSpeed
    audio.playSfx('attack')
    this.player.playAttack()
    this.player.gainEnergy(ENERGY_ON_BASIC_HIT) // frapper recharge un peu l'énergie

    const cls = getPlayer().classId
    const isMageType = cls === 'mage' || cls === 'sorcier'
    const isArcherType = cls === 'archer' || cls === 'chasseur'
    if (isMageType || isArcherType) {
      // attaque de base à distance, HORIZONTALE (sens du regard), sans gravité : petite boule
      // de feu bleue (mage/sorcier) ou flèche (archer/chasseur). S'arrête au 1er ennemi ou à ~440px.
      const proj = this.spawnPlayerProjectile(this.player.stats.atk * this.player.outgoingMult(), 440)
      if (isMageType) proj.setTexture('fx-fireball').clearTint().setScale(1.3)
      else proj.setTexture('fx-arrow').clearTint().setScale(1.2)
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
    proj.launch() // relance la vélocité (le groupe l'a remise à 0 sur add)
    return proj
  }

  // projectile ennemi lancé EN CLOCHE (mandragore) : soumis à la gravité, décrit un arc vers le
  // joueur, puis retombe et S'ARRÊTE au sol (collision plateformes → petit impact, pas de rebond).
  spawnEnemyLob(x: number, y: number, targetX: number, damage: number) {
    const proj = new Projectile(this, x, y, 1, 0, damage, false, 1400)
    proj.setTexture('fx-lob').clearTint().setScale(1)
    // ajout au groupe D'ABORD (il remet la gravité au défaut du groupe = OFF), puis on réactive
    // la gravité et on impose la vélocité d'arc → la cloche n'est pas écrasée par le groupe
    this.enemyProjectiles.add(proj)
    const dx = targetX - x
    const T = 0.75 // temps de vol visé → hauteur d'arc ≈ 84px
    const body = proj.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    body.setVelocity(Phaser.Math.Clamp(dx / T, -520, 520), -0.5 * GRAVITY * T)
    proj.setAngularVelocity((Math.sign(dx) || 1) * 320) // tourne sur elle-même (comme le bambou)
    const popOnGround: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (projObj) => {
      const pp = projObj as Projectile
      if (!pp.active) return
      this.impactFx(pp.x, pp.y, 0x7bc86c)
      pp.destroy()
    }
    this.physics.add.collider(proj, this.platforms, popOnGround)
    this.physics.add.collider(proj, this.oneWayPlatforms, popOnGround)
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

    const { maxHp } = this.player.stats
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const color = this.skillColor(skill.id)
    // rang investi : +25% de puissance par point au-delà du 1er
    const rank = p.skillLevels[skill.id] ?? 1
    const mult = skill.multiplier * (1 + 0.25 * (rank - 1))
    // gros coup : bref gel d'impact pour le punch (hors soin)
    if (mult >= 2.5 && skill.kind !== 'heal') this.hitStop(75)
    if (skill.kind === 'melee') {
      this.player.playAttack()
      // gros coup (rang inclus) : double croissant + tremblement de caméra
      this.slashFx(this.player.x + (this.player.facing * skill.range) / 2, this.player.y, skill.range, color, mult >= 2)
      this.meleeHit(skill.range, mult)
      // Câlin brutal : une volée de cœurs s'envole autour du point d'impact
      if (skill.id === 'calin-brutal') this.heartsFx(this.player.x + this.player.facing * 30, this.player.y)
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
      // skills perçants (flèche perçante / laser) : traversent TOUT sur toute la largeur visible
      // → portée forcée à au moins la largeur caméra (~960px)
      const range = skill.pierce ? Math.max(skill.range, this.scale.width) : skill.range
      const proj = this.spawnPlayerProjectile(atk * mult, range)
      if (skill.arc) {
        // lancé en cloche : gravité + rotation (bambou). Au contact d'une surface (sol plein
        // ou plateforme), le boulet S'ARRÊTE et disparaît avec un petit impact — pas de rebond
        // à l'infini ni de traversée du sol.
        const b = proj.body as Phaser.Physics.Arcade.Body
        b.setAllowGravity(true)
        b.setVelocity(this.player.facing * 340, -430)
        proj.setTexture('bamboo').setScale(1).setTint(color).setAngularVelocity(this.player.facing * 480)
        const popOnGround: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (projObj) => {
          const pp = projObj as Projectile
          if (!pp.active) return
          this.impactFx(pp.x, pp.y, color)
          pp.destroy()
        }
        this.physics.add.collider(proj, this.platforms, popOnGround)
        this.physics.add.collider(proj, this.oneWayPlatforms, popOnGround)
      } else if (skill.pierce) {
        // transperce tout sur toute la largeur visible : grande flèche perçante (archer/chasseur)
        // ou faisceau laser (mage/sorcier). Texture blanche → teintée par la couleur du skill.
        proj.pierce = true
        const isArrow = skill.classId === 'archer' || skill.classId === 'chasseur'
          || skill.id.includes('fleche') || skill.id.includes('tir')
        proj.setTexture(isArrow ? 'fx-arrow-pierce' : 'fx-laser').setTint(color).setScale(1)
      } else {
        // projectile simple : boule de feu (mage/sorcier) ou flèche (archer/chasseur), sinon orbe
        const mageType = skill.classId === 'mage' || skill.classId === 'sorcier'
        const archerType = skill.classId === 'archer' || skill.classId === 'chasseur'
        if (mageType) proj.setTexture('fx-fireball').clearTint()
        else if (archerType) proj.setTexture('fx-arrow').clearTint()
        else proj.setTint(color)
        proj.setScale(skill.multiplier >= 2.5 ? 1.6 : skill.multiplier >= 1.6 ? 1.25 : 1.05)
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
    // Cri de guerre : tout skill porteur d'un buff booste l'ATK sortante du panda + onde de cri
    if (skill.buff) {
      this.player.applyAtkBuff(skill.buff.atkMult, skill.buff.durationMs)
      this.warCryFx()
    }
  }

  // volée de cœurs roses qui s'envolent (montée + fondu) autour du point d'impact du Câlin brutal
  private heartsFx(x: number, y: number) {
    for (let i = 0; i < 7; i++) {
      const heart = this.add.text(
        x + Phaser.Math.Between(-26, 26), y + Phaser.Math.Between(-6, 16), '♥',
        { fontSize: `${Phaser.Math.Between(16, 28)}px`, color: '#ff6b9d' },
      ).setOrigin(0.5).setDepth(7)
      this.tweens.add({
        targets: heart,
        y: heart.y - Phaser.Math.Between(55, 95),
        x: heart.x + Phaser.Math.Between(-20, 20),
        alpha: 0, scale: 1.3,
        duration: Phaser.Math.Between(620, 900), delay: i * 55, ease: 'Sine.out',
        onComplete: () => heart.destroy(),
      })
    }
  }

  // onde de cri dorée au lancement du buff : ondes concentriques + éclats + petit shake
  private warCryFx() {
    const x = this.player.x, y = this.player.y
    this.cameras.main.shake(160, 0.006)
    for (let i = 0; i < 2; i++) {
      const wave = this.add.image(x, y, 'ring').setTint(0xffc107).setDepth(4).setScale(0.3).setAlpha(0.85)
      this.tweens.add({ targets: wave, scale: 5 + i, alpha: 0, duration: 450 + i * 120, delay: i * 90, ease: 'Cubic.out', onComplete: () => wave.destroy() })
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const shard = this.add.rectangle(x, y - 10, 4, 12, 0xffe082).setDepth(6).setRotation(a)
      this.tweens.add({ targets: shard, x: x + Math.cos(a) * 46, y: y - 26 + Math.sin(a) * 22, alpha: 0, duration: 420, onComplete: () => shard.destroy() })
    }
  }

  // Touche les ennemis/props devant le panda (ou pile sur lui), avec grande tolérance
  // verticale : le centre du grand sprite panda est plus haut que celui des monstres.
  meleeHit(reach: number, multiplier: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    const atk = this.player.stats.atk * this.player.outgoingMult()
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
    const spawn = (texture: string, data: Record<string, unknown>, tint?: number, size?: number) => {
      const s = this.pickups.create(x + Phaser.Math.Between(-20, 20), y - 10, texture) as Phaser.Physics.Arcade.Sprite
      s.setVelocity(Phaser.Math.Between(-80, 80), -200)
      s.setData(data)
      if (tint !== undefined) s.setTint(tint)
      if (size !== undefined) s.setDisplaySize(size, size)
    }
    if (result.gold > 0) spawn('coin', { gold: result.gold })
    for (let i = 0; i < result.potions; i++) spawn('potion-drop', { potion: 1 })
    // objet lâché : icône illustrée item-<id> (dimensionnée) si dispo, sinon la pastille générique
    for (const itemId of result.items) {
      if (this.textures.exists(`item-${itemId}`)) spawn(`item-${itemId}`, { itemId }, undefined, 22)
      else spawn('item-drop', { itemId })
    }
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
    this.hitStop(90) // gel d'impact sur la mort du boss
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

  // hit-stop (juice) : gel très bref de la physique sur les gros impacts. La reprise est
  // garantie de plusieurs façons — le timer d'horloge ci-dessous, MAIS AUSSI le hook
  // 'resume' de la scène et le create() (voir resumeWorld) — pour ne jamais laisser le
  // monde physique figé si un overlay met la scène (et donc son horloge) en pause pendant
  // la fenêtre de hit-stop.
  private hitStop(ms: number) {
    // pas de gel si la scène est déjà en pause (overlay ouvert) : l'horloge est gelée, la
    // reprise serait repoussée et la physique resterait figée toute la durée du menu
    if (!this.scene.isActive() || this.physics.world.isPaused) return
    this.physics.world.pause()
    // un seul timer de reprise à la fois (deux hit-stops qui se chevauchent ne doivent pas
    // laisser un timer orphelin)
    this.hitStopTimer?.remove()
    this.hitStopTimer = this.time.delayedCall(ms, () => this.resumeWorld())
  }

  // reprise idempotente du monde physique : fin de hit-stop, retour d'un overlay, ou
  // (re)création du niveau. Toujours sûre à appeler, même si aucun hit-stop n'est en cours.
  private resumeWorld() {
    this.hitStopTimer?.remove()
    this.hitStopTimer = null
    this.physics.world.resume()
  }

  update(_time: number, delta: number) {
    const sx = this.cameras.main.scrollX
    if (this.bgClouds) this.bgClouds.tilePositionX = sx * 0.1
    if (this.bgFar) this.bgFar.tilePositionX = sx * 0.3
    if (this.bgNear) this.bgNear.tilePositionX = sx * 0.55
    if (this.player.hp <= 0) return
    this.player.regenEnergy(delta)
    // zones verticales chevauchées (échelle / eau) lues sur le centre du panda
    const onLad = this.ladderRects.find((r) => r.contains(this.player.x, this.player.y))
    this.player.onLadder = !!onLad
    if (onLad) this.player.ladderCenterX = onLad.centerX
    this.player.inWater = this.waterRects.some((r) => r.contains(this.player.x, this.player.y))
    if (this.time.now < this.dashUntil) {
      // pendant la roulade : vitesse imposée, contrôles suspendus (le saut/déplacement
      // reprennent la main dès la fin de la fenêtre)
      this.player.setVelocityX(this.player.facing * 600)
    } else {
      const ui = this.scene.get('UI') as UIScene
      const joy = ui.joystick?.state ?? emptyControls()
      const touch: ControlsState = { ...joy, jump: this.jumpHeld }
      this.player.updateFromControls(mergeControls(this.keyboardControls(), touch))
    }
    if (this.boss?.active && this.bossBar) {
      this.bossBar.setDisplaySize(BOSS_BAR_W * Math.max(0, this.boss.hp / this.boss.monster.hp), 16)
      if (this.bossPhase === 1 && this.boss.hp <= this.boss.monster.hp * 0.5) this.enterBossPhase2()
    }
  }
}
