import Phaser from 'phaser'
import type { MonsterDef } from '../core/types'
import { Projectile } from './Projectile'
import type { LevelScene } from '../scenes/LevelScene'
import { getPlayer } from '../state'

// Texture de projectile thématique par monstre à distance (fireProjectile). La mandragore tire
// en cloche (fx-lob, géré à part) ; tout id absent retombe sur l'orbe générique fx-shot.
const ENEMY_PROJECTILE_TEX: Record<string, string> = {
  'mage-noir': 'fx-bolt', // bolt magique violet
  'rocker': 'fx-rock', // éclat de pierre
  'gobelin-mineur': 'fx-rock', // éclat de pierre
  'meduse': 'fx-bubble', // bulle d'eau bleue translucide
  'fantome': 'fx-spectral', // orbe spectral bleu pâle vaporeux
  'spectre-ancien': 'fx-spectral', // orbe spectral bleu pâle vaporeux
  'banshee': 'fx-scream', // onde de cri (arc violet pâle)
  'flora-vorace': 'fx-spore', // épine / spore verte
  'pharaon-scarabee': 'fx-sand', // projectile de sable doré
  'roi-liche': 'fx-necro', // bolt nécrotique violet sombre
  'pretre-goule': 'fx-necro', // bolt nécrotique violet sombre
}

// Couleur de la plaque de niveau selon le DANGER = écart entre le niveau du monstre et celui du
// joueur (rouge = très au-dessus, orange = au-dessus, blanc = à portée). Le monstre reste tuable
// quel que soit l'écart : c'est un simple indicateur visuel.
function levelGapColor(monsterLevel: number): string {
  const gap = monsterLevel - getPlayer().level
  if (gap >= 15) return '#ff3b3b'
  if (gap >= 10) return '#ffa726'
  return '#ffffff'
}

const AGGRO_RANGE = 350
const CHARGE_COOLDOWN = 2500
const SHOOT_COOLDOWN = 2000
const CAST_COOLDOWN = 3200
const CASTER_KEEP_DIST = 240 // distance de confort du lanceur de sorts
// seuil d'hystérésis d'orientation : on ne retourne le sprite que si l'intention horizontale
// est franche (|vx| > ce seuil). En deçà on garde la dernière orientation → plus de bascule
// flip flou quand la vitesse oscille autour de 0 (lanceur qui garde ses distances, cible qui
// alterne gauche/droite)
const FLIP_THRESHOLD = 20
// fraction de la vitesse nominale à laquelle un monstre apeuré (Folie enragée) fuit le joueur :
// assez lent pour rester rattrapable et frappable pendant qu'il détale.
const FEAR_SPEED_MULT = 0.45
// patrouille au repos (hors aggro) des monstres terrestres : ils arpentent leur corniche à vitesse
// réduite, font demi-tour au MUR et au REBORD (détection de vide devant) → ne tombent JAMAIS.
const PATROL_SPEED_MULT = 0.6
// oiseau : vol en sinus (amplitude/période) + piqué vers le joueur par à-coups puis remontée.
const BIRD_DIVE_COOLDOWN = 2200
const BIRD_DIVE_MS = 620
const BIRD_WANDER_AMP = 60 // px d'oscillation verticale du vol de croisière
// avancée du point de sonde de rebord au-delà du bord du corps (px) pour la détection de vide devant.
const TILE_PROBE = 20

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  monster: MonsterDef
  hp: number
  private levelScene: LevelScene
  private nextActionAt = 0
  private nextShootAt = 0
  private bar: Phaser.GameObjects.Graphics
  private lvlText: Phaser.GameObjects.Text
  private eliteAura: Phaser.GameObjects.Graphics | null = null
  private isCharging = false
  private facingLeft = false // orientation retenue (mise à jour seulement au-delà de FLIP_THRESHOLD)
  private zzz: Phaser.GameObjects.Text | null = null
  private nextZzzToggleAt = 0
  // Brûlure (Épée enflammée) : dégâts périodiques sur une durée ; un seul timer, on prolonge
  // l'échéance si on ré-enflamme.
  private burnUntil = 0
  private burnTimer: Phaser.Time.TimerEvent | null = null
  // Immobilisation (Piège de l'archer) : l'ennemi reste cloué sur place jusqu'à cette échéance.
  private rootedUntil = 0
  private snareFx: Phaser.GameObjects.Graphics | null = null
  // Terreur (Folie enragée du sabreur) : l'ennemi FUIT le joueur lentement et prend +50% de dégâts
  // (défense effective halvée) jusqu'à cette échéance. Les boss en sont toujours immunisés.
  private fearedUntil = 0
  private fearFx: Phaser.GameObjects.Text | null = null
  // patrouille sûre (monstres terrestres au repos) : sens courant + demi-tour au bord/mur.
  private patrolDir: 1 | -1 = 1
  // oiseau : point d'attache du vol de croisière + cadence de piqué.
  private homeX = 0
  private homeY = 0
  private nextDiveAt = 0
  private diveUntil = 0

  constructor(scene: LevelScene, x: number, y: number, def: MonsterDef) {
    super(scene, x, y, `monster-${def.id}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.homeX = x; this.homeY = y
    this.patrolDir = (Math.round(x / 32) % 2 === 0 ? 1 : -1)
    // OISEAU : vol libre — gravité coupée et AUCUNE collision terrain (il traverse le décor), il ne
    // se déplace que par sa vélocité. Le contact avec le joueur reste géré par overlap.
    if (def.aerial) {
      const b = this.body as Phaser.Physics.Arcade.Body
      b.setAllowGravity(false)
      b.checkCollision.none = true
    }
    // borne tout ennemi dans l'arène : les bornes du monde physique valent (0..widthPx). Sans ça,
    // un chargeur lancé (vitesse persistante, drag nul) glisse hors de la zone jouable et ne revient
    // jamais — c'est le bug du boss « parti tout seul » hors écran.
    this.setCollideWorldBounds(true)
    // hitbox = la créature seule (la texture a de la marge : ombre au sol + place au-dessus),
    // pour qu'elle repose au sol au même niveau que le panda
    const bw = this.width * 0.8
    const bh = this.height - 8
    this.setSize(bw, bh)
    this.setOffset((this.width - bw) / 2, 2)
    this.levelScene = scene
    this.monster = def
    this.hp = def.hp
    this.bar = scene.add.graphics()
    // plaque de niveau au-dessus du monstre : couleur selon l'écart de niveau avec le joueur
    // (danger). Les boss/MVP gardent leur indice distinct via la barre de vie large et le halo
    // d'élite ci-dessous — la COULEUR du nom, elle, suit l'écart.
    this.lvlText = scene.add.text(x, y, `Nv ${def.level}`, { fontSize: '17px', color: levelGapColor(def.level), fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
    if (def.mvp) this.eliteAura = scene.add.graphics()
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp -= amount
    // Phaser 4 : le flash blanc se fait via setTint + mode FILL (setTintFill est un no-op déprécié)
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(80, () => this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY))
    const txt = this.scene.add.text(this.x, this.y - 30, `${amount}`, { fontSize: '24px', color: '#ffee58', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5)
    this.scene.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() })
    if (this.hp <= 0) {
      this.scene.events.emit('enemy-died', this)
      this.bar.destroy()
      this.lvlText.destroy()
      this.eliteAura?.destroy()
      this.zzz?.destroy()
      this.burnTimer?.remove()
      this.snareFx?.destroy()
      this.fearFx?.destroy()
      this.destroy()
    }
  }

  // Applique/prolonge une brûlure : dégâts par palier toutes les 500 ms pendant durationMs,
  // avec petite flammèche à chaque tic. Le timer s'arrête à l'échéance ou à la mort.
  applyBurn(dmgPerTick: number, durationMs: number) {
    if (!this.active) return
    this.burnUntil = Math.max(this.burnUntil, this.scene.time.now + durationMs)
    if (this.burnTimer) return
    this.burnTimer = this.scene.time.addEvent({
      delay: 500, loop: true, callback: () => {
        if (!this.active || this.scene.time.now >= this.burnUntil) {
          this.burnTimer?.remove(); this.burnTimer = null
          return
        }
        const fl = this.scene.add.rectangle(this.x + Phaser.Math.Between(-8, 8), this.y, 5, 11, Phaser.Math.RND.pick([0xffca28, 0xff7043]))
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.95)
        this.scene.tweens.add({ targets: fl, y: this.y - 22, scaleY: 0.4, alpha: 0, duration: 380, onComplete: () => fl.destroy() })
        this.takeDamage(Math.max(1, Math.round(dmgPerTick)))
      },
    })
  }

  // Immobilise l'ennemi sur place pour une durée donnée (Piège) : la boucle d'IA ci-dessous
  // ignore tout déplacement tant que rootedUntil n'est pas dépassé. Un liseré de « chaînes »
  // pulse à ses pieds pendant l'effet.
  root(durationMs: number) {
    if (!this.active) return
    this.rootedUntil = Math.max(this.rootedUntil, this.scene.time.now + durationMs)
    this.setVelocity(0, 0)
    if (!this.snareFx) this.snareFx = this.scene.add.graphics().setDepth(this.depth - 1)
  }

  isRooted(): boolean {
    return this.scene.time.now < this.rootedUntil
  }

  // Terrorise l'ennemi pour une durée donnée (Folie enragée) : tant que l'effet dure, la boucle
  // d'IA le fait FUIR le joueur (sens opposé) lentement et sa défense effective est halvée. Sans
  // effet sur les boss — la peur ne prend jamais sur eux.
  fear(durationMs: number) {
    if (!this.active || this.monster.boss) return
    this.fearedUntil = Math.max(this.fearedUntil, this.scene.time.now + durationMs)
  }

  isFeared(): boolean {
    return this.scene.time.now < this.fearedUntil
  }

  // Défense effective encaissée par le calcul de dégâts : halvée tant que l'ennemi est apeuré
  // (Folie enragée), sinon la défense nominale du monstre.
  effectiveDef(): number {
    return this.isFeared() ? this.monster.def * 0.5 : this.monster.def
  }

  // tir d'un projectile vers le joueur, propre et cohérent selon le monstre :
  //  - mandragore : boule verte EN CLOCHE (gravité, retombe et s'arrête au sol)
  //  - mage noir : bolt magique violet HORIZONTAL ; rocker : petite pierre HORIZONTALE
  //  - autres : orbe d'attaque générique HORIZONTAL (dirY = 0, sans gravité)
  private fireProjectile() {
    const player = this.levelScene.player
    if (this.monster.id === 'mandragore') {
      this.levelScene.spawnEnemyLob(this.x, this.y - 10, player.x, this.monster.atk)
      return
    }
    const dir = Math.sign(player.x - this.x) || 1
    const p = new Projectile(this.scene, this.x + dir * 12, this.y - 10, dir, 0, this.monster.atk, false, 620)
    // texture thématique selon le monstre (repli fx-shot), horizontale et sans gravité (dirY = 0),
    // s'arrête au 1er ennemi/à portée comme tout projectile
    p.setTexture(ENEMY_PROJECTILE_TEX[this.monster.id] ?? 'fx-shot').clearTint().setScale(1.1)
    this.levelScene.enemyProjectiles.add(p)
    p.launch() // relance la vélocité (le groupe l'a remise à 0 sur add)
  }

  // Y a-t-il un sol à ~1 tuile DEVANT (dans le sens `dir`), au niveau des pieds ? Sert à la
  // patrouille sûre : un monstre terrestre fait demi-tour dès qu'il n'y a plus de sol devant lui
  // (bord de corniche, trou) → il ne tombe JAMAIS. S'appuie sur la géométrie statique du niveau.
  private floorAhead(dir: number): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body
    const probeX = this.x + dir * (this.width * 0.5 + TILE_PROBE)
    return this.levelScene.floorAt(probeX, body.bottom + 2)
  }

  // Vol de l'oiseau : croisière en sinus autour de son point d'attache, PIQUÉ vers le joueur par
  // à-coups (dive) puis remontée. Gravité déjà coupée (constructeur). Jamais de collision terrain.
  private flyUpdate(t: number, dist: number, dirX: number, player: { x: number; y: number }) {
    const speed = this.monster.speed
    if (dist < AGGRO_RANGE && t > this.nextDiveAt && t > this.diveUntil) {
      this.diveUntil = t + BIRD_DIVE_MS
      this.nextDiveAt = t + BIRD_DIVE_COOLDOWN
    }
    if (t < this.diveUntil) {
      // piqué : fond droit sur le joueur
      const dy = Math.sign(player.y - this.y) || 1
      this.setVelocity(dirX * speed * 1.6, dy * speed * 1.4)
    } else {
      // croisière : oscille horizontalement autour de home + houle verticale ; dérive vers le joueur
      const drift = dist < AGGRO_RANGE ? dirX * speed * 0.4 : Math.cos(t / 700) * speed * 0.5
      this.setVelocityX(drift)
      const targetY = this.homeY + Math.sin(t / 500) * BIRD_WANDER_AMP
      this.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 3, -speed, speed))
    }
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    const player = this.levelScene.player
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
    const dir = Math.sign(player.x - this.x) || 1
    // distance de corps-à-corps : au-delà on avance vers le joueur, en deçà on S'ARRÊTE
    // (on reste planté à infliger les dégâts de contact) au lieu de foncer/pousser sans fin
    const stopDist = this.width * 0.5 + 16

    // Immobilisé par un piège : cloué sur place, aucune IA de déplacement tant que dure l'effet.
    const rooted = t < this.rootedUntil
    if (rooted) this.setVelocity(0, 0)
    // Apeuré (Folie enragée) : le monstre FUIT le joueur (sens opposé) LENTEMENT — encore
    // rattrapable pour le taper — et n'attaque plus. Les boss n'y sont jamais soumis.
    const feared = !this.monster.boss && t < this.fearedUntil

    // OISEAU : IA de vol dédiée, court-circuite tout l'arbre terrestre ci-dessous.
    if (this.monster.aerial) {
      if (rooted) this.setVelocity(0, 0)
      else if (feared) { this.setVelocity(-dir * this.monster.speed * FEAR_SPEED_MULT, 0) }
      else this.flyUpdate(t, dist, dir, player)
      this.updateVisuals(t)
      return
    }

    if (!rooted && feared) {
      this.setVelocityX(-dir * this.monster.speed * FEAR_SPEED_MULT)
    } else if (!rooted && dist < AGGRO_RANGE) {
      if (this.monster.behavior === 'charge') {
        if (t > this.nextActionAt) {
          this.setVelocityX(dir * this.monster.speed * 3)
          this.nextActionAt = t + CHARGE_COOLDOWN
          this.isCharging = true
          this.scene.time.delayedCall(400, () => { this.isCharging = false })
        } else if (!this.isCharging) {
          // entre deux charges : on marche vers le joueur au lieu de conserver la vitesse de la
          // charge précédente (sinon dérive infinie hors de la zone → le boss « s'enfuit »),
          // mais on s'arrête au corps-à-corps au lieu de le pousser sans fin ; borné au rebord
          // (pas de chute bête si on est au sol et qu'il n'y a plus de sol devant)
          const grounded = (this.body as Phaser.Physics.Arcade.Body).blocked.down
          const step = dist > stopDist && !(grounded && !this.floorAhead(dir))
          this.setVelocityX(step ? dir * this.monster.speed : 0)
        }
      } else if (this.monster.behavior === 'projectile' && t > this.nextActionAt) {
        this.fireProjectile()
        this.nextActionAt = t + SHOOT_COOLDOWN
      } else if (this.monster.behavior === 'caster') {
        // garde ses distances : recule si le joueur s'approche, avance s'il fuit
        if (dist < CASTER_KEEP_DIST - 30) this.setVelocityX(-dir * this.monster.speed)
        else if (dist > CASTER_KEEP_DIST + 60) this.setVelocityX(dir * this.monster.speed)
        else this.setVelocityX(0)
        // sort de zone télégraphié sous le joueur
        if (t > this.nextActionAt) {
          this.levelScene.enemyGroundSpell(player.x, this.monster.atk)
          this.nextActionAt = t + CAST_COOLDOWN
        }
        // + projectile occasionnel pour harceler pendant le rechargement du sort
        if (t > this.nextShootAt) {
          this.fireProjectile()
          this.nextShootAt = t + SHOOT_COOLDOWN * 1.5
        }
      } else if (this.monster.behavior !== 'projectile') {
        // 'contact' (et tout behavior inconnu non géré au-dessus) : avance vers le joueur puis
        // S'ARRÊTE au corps-à-corps (dégâts de contact). Borné au rebord : au sol, s'il n'y a plus
        // de sol devant, on ne franchit pas le vide (pas de chute bête pendant la poursuite).
        const grounded = (this.body as Phaser.Physics.Arcade.Body).blocked.down
        const step = dist > stopDist && !(grounded && !this.floorAhead(dir))
        this.setVelocityX(step ? dir * this.monster.speed : 0)
      }
    } else if (!rooted && this.monster.boss) {
      // hors aggro, le boss revient TOUJOURS vers le joueur tant qu'il est vivant : il ne
      // « s'endort » jamais hors écran et rejoint l'arène du joueur
      this.setVelocityX(dir * this.monster.speed)
    } else if (!rooted && this.monster.speed > 0 && (this.monster.behavior === 'contact' || this.monster.behavior === 'charge')) {
      // PATROUILLE SÛRE (hors aggro) : le monstre terrestre arpente sa corniche à vitesse réduite,
      // demi-tour au MUR et au REBORD (plus de sol devant → il se retourne AVANT de tomber). Il
      // ne quitte jamais sa plateforme.
      const body = this.body as Phaser.Physics.Arcade.Body
      const wall = this.patrolDir < 0 ? body.blocked.left : body.blocked.right
      if (body.blocked.down && (wall || !this.floorAhead(this.patrolDir))) this.patrolDir = this.patrolDir === 1 ? -1 : 1
      this.setVelocityX(this.patrolDir * this.monster.speed * PATROL_SPEED_MULT)
    } else {
      // hors aggro (immobiles : mandragore/casters/gardiens) : on s'arrête net — pas de dérive
      this.setVelocityX(0)
    }

    this.updateVisuals(t)
  }

  // Tout le rendu flottant du monstre (orientation, dandinement, barre de vie, plaque de niveau,
  // zzz, liserés de piège/terreur, halo d'élite). Extrait pour être partagé par l'IA terrestre ET
  // l'IA de vol de l'oiseau.
  private updateVisuals(t: number) {
    const player = this.levelScene.player
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
    const rooted = t < this.rootedUntil
    const feared = !this.monster.boss && t < this.fearedUntil

    // marche : dandinement + regarde dans son sens de déplacement ; sinon respiration
    const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x
    // orientation avec hystérésis : ne bascule que sur une intention franche, sinon garde
    // la dernière → supprime le tremblement de flip quand vx oscille près de 0
    if (Math.abs(vx) > FLIP_THRESHOLD) this.facingLeft = vx < 0
    this.setFlipX(this.facingLeft)
    if (Math.abs(vx) > 5) {
      this.setRotation(Math.sin(t / 70) * 0.12)
      this.setScale(1, 1 + 0.04 * Math.sin(t / 70))
    } else {
      this.setRotation(0)
      if (!this.isCharging) this.setScale(1, 1 + 0.05 * Math.sin(t / 300))
    }

    // "zzz" hors aggro, caché dès que le monstre repère le joueur
    if (dist >= AGGRO_RANGE) {
      // placé bien au-dessus de la plaque « Nv X » (y - height/2 - 22) pour ne pas la recouvrir
      if (!this.zzz) this.zzz = this.scene.add.text(this.x, this.y - this.height / 2 - 42, 'zzz', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)
      this.zzz.setPosition(this.x, this.y - this.height / 2 - 42)
      if (t > this.nextZzzToggleAt) {
        this.zzz.setVisible(!this.zzz.visible)
        this.nextZzzToggleAt = t + 2000
      }
    } else if (this.zzz) {
      this.zzz.destroy()
      this.zzz = null
    }

    // barre de vie flottante
    this.bar.clear()
    const w = this.monster.boss ? 60 : 30
    this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2, this.y - this.height / 2 - 12, w, 5)
    this.bar.fillStyle(0x66bb6a).fillRect(this.x - w / 2, this.y - this.height / 2 - 12, w * Math.max(0, this.hp / this.monster.hp), 5)

    // « Nv X » juste au-dessus de la barre de vie
    this.lvlText.setPosition(this.x, this.y - this.height / 2 - 22)

    // liseré d'immobilisation (Piège) : anneau + « chaînes » qui pulsent aux pieds tant que l'effet dure
    if (this.snareFx) {
      if (rooted) {
        this.snareFx.clear()
        const yFeet = this.y + this.height / 2 - 4
        const pulse = 0.5 + 0.35 * Math.sin(t / 90)
        this.snareFx.lineStyle(3, 0xffca28, pulse).strokeEllipse(this.x, yFeet, this.width * 0.9, 14)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t / 400
          this.snareFx.fillStyle(0xfff59d, pulse).fillCircle(this.x + Math.cos(a) * this.width * 0.45, yFeet + Math.sin(a) * 7, 2.5)
        }
      } else {
        this.snareFx.destroy()
        this.snareFx = null
      }
    }

    // indicateur de terreur (Folie enragée) : un « ! » pâle et tremblotant au-dessus de la tête
    // tant que le monstre est apeuré.
    if (feared) {
      if (!this.fearFx) this.fearFx = this.scene.add.text(this.x, this.y, '!', { fontSize: '20px', color: '#e3f2fd', fontStyle: 'bold', stroke: '#4527a0', strokeThickness: 4 }).setOrigin(0.5)
      this.fearFx.setPosition(this.x + Phaser.Math.Between(-2, 2), this.y - this.height / 2 - 34 + Phaser.Math.Between(-2, 2))
      this.fearFx.setAlpha(0.65 + 0.35 * Math.sin(t / 60))
    } else if (this.fearFx) {
      this.fearFx.destroy()
      this.fearFx = null
    }

    // halo d'élite pulsant autour des MVP
    if (this.eliteAura) {
      this.eliteAura.clear()
      const pulse = 0.35 + 0.2 * Math.sin(t / 220)
      this.eliteAura.lineStyle(2, 0xffd54f, pulse).strokeCircle(this.x, this.y, this.width * 0.6)
    }
  }
}
