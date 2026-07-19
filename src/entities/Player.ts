import Phaser from 'phaser'
import type { StatBlock } from '../core/types'
import type { ControlsState } from '../core/controls'
import { computeStats } from '../core/stats'
import { getPlayer } from '../state'
import { PANDA_BODY } from './player-body'
import { JUMP_SPEED, RUN_SPEED } from '../core/platforming'

const JUMP_VELOCITY = -JUMP_SPEED // source unique (partagée avec le test d'atteignabilité)
const CLIMB_SPEED = 150 // vitesse verticale sur une échelle (up/down)
const CLIMB_STRIDE = 13 // px parcourus entre deux poses du cycle de grimpe (avance au mouvement réel)
const CLIMB_TILT = 6 // légère inclinaison alternée (degrés) pour vendre l'effort de montée
const SWIM_SPEED = 150 // vitesse verticale de nage dans l'eau (up/down)
const SWIM_DRIFT = 40 // léger enfoncement quand on ne nage pas activement
const SWIM_RUN_MULT = 0.7 // déplacement horizontal ralenti dans l'eau
const MAX_ENERGY = 100
const ENERGY_REGEN_PER_SEC = 22
const ENERGY_PER_BASIC_HIT = 6
const HAT_OFFSET_Y = -38 // place le chapeau au-dessus de la tête du panda illustré (crown haute)
const WEAPON_OFFSET_X = 11 // décalage horizontal de l'arme (patte avant), mirroré selon l'orientation
const WEAPON_OFFSET_Y = 10 // décalage vertical de l'arme (hauteur de la patte avant)

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock
  hp: number
  energy = MAX_ENERGY
  readonly maxEnergy = MAX_ENERGY
  facing: 1 | -1 = 1
  // renseignés chaque frame par LevelScene selon les zones chevauchées
  onLadder = false
  inWater = false
  private climbing = false
  // cycle d'escalade : phase (0/1) alternant deux poses de membres opposés, avancée par la
  // distance verticale réellement parcourue (climbAccum), pas par une horloge → fige à l'arrêt
  private climbPhase = 0
  private climbAccum = 0
  private climbLastY = 0
  private wasGrounded = true
  private attacking = false
  private hatImage: Phaser.GameObjects.Image | null = null
  private weaponImage: Phaser.GameObjects.Image | null = null
  // buff d'attaque (Cri de guerre) : multiplicateur temporaire des dégâts sortants + aura dorée suivie
  private buffUntil = 0
  private buffMult = 1
  private auraImage: Phaser.GameObjects.Image | null = null
  private auraTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, `panda-${getPlayer().classId}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    // hitbox calée sur le panda visible (pas la texture entière qui a de la marge)
    this.setSize(PANDA_BODY.w, PANDA_BODY.h)
    this.setOffset(PANDA_BODY.offsetX, PANDA_BODY.offsetY)
    this.setCollideWorldBounds(true)
    this.stats = computeStats(getPlayer())
    this.hp = this.stats.maxHp
    this.play(this.anim('idle'))
    this.emitHp()
    this.refreshHat()
    this.refreshWeapon()
  }

  // (ré)affiche le chapeau cosmétique équipé (ou le retire si le slot est vide)
  private refreshHat() {
    const hatId = getPlayer().equipment.hat
    this.hatImage?.destroy()
    this.hatImage = hatId ? this.scene.add.image(this.x, this.y + HAT_OFFSET_Y, `cosmetic-${hatId}`).setDepth(this.depth + 1) : null
  }

  // (ré)affiche l'arme de classe en overlay dans la patte avant (le panda illustré a les mains
  // vides) ; retirée si la classe n'a pas d'arme (novice). Suivie/mirrorée chaque frame.
  private refreshWeapon() {
    const key = `weapon-${getPlayer().classId}`
    this.weaponImage?.destroy()
    this.weaponImage = this.scene.textures.exists(key)
      ? this.scene.add.image(this.x + WEAPON_OFFSET_X, this.y + WEAPON_OFFSET_Y, key).setOrigin(0.5, 44 / 60).setDepth(this.depth + 1)
      : null
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    if (this.hatImage) {
      this.hatImage.setPosition(this.x, this.y + HAT_OFFSET_Y)
      this.hatImage.setFlipX(this.facing === -1)
    }
    if (this.weaponImage) {
      this.weaponImage.setPosition(this.x + WEAPON_OFFSET_X * this.facing, this.y + WEAPON_OFFSET_Y)
      this.weaponImage.setFlipX(this.facing === -1)
    }
    // aura de buff : suit le panda tant que le buff est actif, puis se dissout à l'échéance
    if (this.auraImage) {
      if (this.scene.time.now >= this.buffUntil) {
        this.auraTween?.remove(); this.auraTween = null
        this.auraImage.destroy(); this.auraImage = null
        this.scene.events.emit('player-buff-end')
      } else {
        this.auraImage.setPosition(this.x, this.y)
      }
    }
  }

  // applique (ou renouvelle) un buff d'attaque : multiplie les dégâts sortants un temps donné,
  // fait apparaître une aura dorée pulsante et notifie le HUD
  applyAtkBuff(mult: number, durationMs: number) {
    this.buffMult = mult
    this.buffUntil = this.scene.time.now + durationMs
    if (!this.auraImage) {
      this.auraImage = this.scene.add.image(this.x, this.y, 'ring')
        .setTint(0xffd54f).setDepth(this.depth - 1).setAlpha(0.5).setScale(1.7)
      this.auraTween = this.scene.tweens.add({
        targets: this.auraImage, scale: 2.3, alpha: 0.8,
        duration: 480, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      })
    }
    this.scene.events.emit('player-buff', this.buffUntil, durationMs)
  }

  // multiplicateur appliqué à tous les dégâts sortants (attaque de base + skills) ; 1 hors buff
  outgoingMult(): number {
    return this.scene.time.now < this.buffUntil ? this.buffMult : 1
  }

  destroy(fromScene?: boolean) {
    this.hatImage?.destroy()
    this.weaponImage?.destroy()
    this.auraTween?.remove()
    this.auraImage?.destroy()
    super.destroy(fromScene)
  }

  // clé d'animation selon la classe courante (le visuel change au changement de classe)
  private anim(suffix: string): string {
    return `panda-${getPlayer().classId}-${suffix}`
  }

  // joue l'animation d'attaque ; pendant ce temps run/idle sont suspendus
  playAttack() {
    this.attacking = true
    this.play(this.anim('attack'), true)
    this.scene.time.delayedCall(160, () => { this.attacking = false })
  }

  refreshStats() {
    const ratio = this.hp / this.stats.maxHp
    this.stats = computeStats(getPlayer())
    this.hp = Math.round(this.stats.maxHp * ratio)
    this.play(this.anim('idle')) // reprend l'allure de la nouvelle classe
    this.emitHp()
    this.refreshHat()
    this.refreshWeapon()
  }

  updateFromControls(c: ControlsState) {
    const body = this.body as Phaser.Physics.Arcade.Body

    // ESCALADE : entrer en mode grimpe en poussant up/down sur une échelle ;
    // en sortir en sautant ou en quittant l'échelle.
    const wasClimbing = this.climbing
    if (this.onLadder && (c.up || c.down)) this.climbing = true
    if (this.climbing && !this.onLadder) this.climbing = false
    if (this.climbing) {
      // à l'entrée sur l'échelle : repart d'une pose neutre, cycle remis à zéro
      if (!wasClimbing) { this.climbPhase = 0; this.climbAccum = 0; this.climbLastY = this.y }
      this.updateClimb(c, body); return
    }

    body.setAllowGravity(true)
    this.setAngle(0) // hors échelle : plus d'inclinaison de grimpe

    // horizontale (ralentie dans l'eau)
    const runSpeed = this.inWater ? RUN_SPEED * SWIM_RUN_MULT : RUN_SPEED
    if (c.left) { this.setVelocityX(-runSpeed); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(runSpeed); this.facing = 1; this.setFlipX(false) }
    else this.setVelocityX(0)

    if (this.inWater) { this.updateSwim(c, body); return }

    if (c.jump && body.blocked.down) {
      this.setVelocityY(JUMP_VELOCITY)
      this.scene.events.emit('player-jump')
    }

    // Petit « splat » d'atterrissage : uniquement HORIZONTAL (scaleY reste 1). En Arcade
    // (Phaser 4) le corps physique suit l'échelle du sprite ; l'ancien squash vertical
    // (scaleY 0.9 puis retour à 1) rétrécissait puis regrandissait le corps pile en se posant
    // sur une dalle one-way, ce qui rompait le contact et faisait RETRAVERSER le panda jusqu'au
    // sol (bug du « 2e étage » d'un escalier de plateformes). En ne touchant qu'à l'axe X, la
    // hauteur et la position verticale du corps restent canoniques → atterrissage fiable.
    if (body.blocked.down && !this.wasGrounded) {
      this.setScale(1.12, 1)
      this.scene.time.delayedCall(100, () => this.setScale(1, 1))
    }
    this.wasGrounded = body.blocked.down

    // animations : attaque > saut (en l'air) > course > idle
    if (!this.attacking) {
      if (!body.blocked.down) this.play(this.anim('jump'), true)
      else if (c.left || c.right) this.play(this.anim('run'), true)
      else this.play(this.anim('idle'), true)
    }
  }

  // sur une échelle : gravité coupée, montée/descente au clavier/joystick, le saut détache
  private updateClimb(c: ControlsState, body: Phaser.Physics.Arcade.Body) {
    body.setAllowGravity(false)
    if (c.jump) {
      this.climbing = false
      body.setAllowGravity(true)
      this.setAngle(0)
      this.setVelocityY(JUMP_VELOCITY)
      this.scene.events.emit('player-jump')
      return
    }
    if (c.up) this.setVelocityY(-CLIMB_SPEED)
    else if (c.down) this.setVelocityY(CLIMB_SPEED)
    else this.setVelocityY(0)
    // on peut se décaler pour quitter l'échelle
    if (c.left) { this.setVelocityX(-RUN_SPEED); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(RUN_SPEED); this.facing = 1; this.setFlipX(false) }
    else this.setVelocityX(0)
    this.wasGrounded = false
    if (!this.attacking) this.animateClimb(c)
  }

  // Grimpe crédible : cycle de 2 poses à membres opposés (réutilise les 2 phases de course —
  // base ↔ course pour l'art, run-0 ↔ run-2 pour le procédural, qui sont déjà des foulées
  // inversées) + légère inclinaison alternée. Le cycle N'AVANCE QUE quand le panda se déplace
  // vraiment (distance verticale accumulée), donc il fige dès qu'on lâche up/down. La rotation
  // du sprite ne touche pas le corps physique Arcade (AABB) : hitbox et montée inchangées.
  private animateClimb(c: ControlsState) {
    const cls = getPlayer().classId
    const frames = this.scene.textures.exists(`panda-${cls}-course`)
      ? [`panda-${cls}`, `panda-${cls}-course`]
      : [`panda-${cls}-run-0`, `panda-${cls}-run-2`]
    this.anims.stop() // on pilote les frames à la main plutôt que via une horloge d'animation
    const climbed = Math.abs(this.y - this.climbLastY)
    this.climbLastY = this.y
    if (c.up || c.down) {
      this.climbAccum += climbed
      if (this.climbAccum >= CLIMB_STRIDE) { this.climbAccum -= CLIMB_STRIDE; this.climbPhase ^= 1 }
      this.setTexture(frames[this.climbPhase] ?? frames[0]!)
      this.setAngle(this.climbPhase === 0 ? -CLIMB_TILT : CLIMB_TILT)
    } else {
      // agrippé, immobile : pose neutre bien droite
      this.setTexture(frames[0]!)
      this.setAngle(0)
    }
  }

  // dans l'eau : gravité coupée, flottaison + nage verticale ; ne tue jamais
  private updateSwim(c: ControlsState, body: Phaser.Physics.Arcade.Body) {
    body.setAllowGravity(false)
    if (c.up || c.jump) this.setVelocityY(-SWIM_SPEED)
    else if (c.down) this.setVelocityY(SWIM_SPEED)
    else this.setVelocityY(SWIM_DRIFT) // léger enfoncement, façon flottaison
    this.wasGrounded = false
    if (!this.attacking) {
      if (c.left || c.right) this.play(this.anim('run'), true)
      else this.play(this.anim('jump'), true)
    }
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.setTint(0xff5555)
    this.scene.time.delayedCall(100, () => this.clearTint())
    this.emitHp()
  }

  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount)
    this.emitHp()
  }

  // PV + énergie au maximum (appelé au passage de niveau : on entame chaque niveau plein)
  restoreFull() {
    this.hp = this.stats.maxHp
    this.energy = this.maxEnergy
    this.emitHp()
  }

  // true si l'énergie suffisait (et a été dépensée), false sinon
  spendEnergy(amount: number): boolean {
    if (this.energy < amount) return false
    this.energy -= amount
    return true
  }

  gainEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount)
  }

  regenEnergy(deltaMs: number) {
    this.gainEnergy((ENERGY_REGEN_PER_SEC * deltaMs) / 1000)
  }

  private emitHp() {
    this.scene.events.emit('player-hp', this.hp, this.stats.maxHp)
  }
}

export const ENERGY_ON_BASIC_HIT = ENERGY_PER_BASIC_HIT
