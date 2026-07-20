import Phaser from 'phaser'
import type { StatBlock } from '../core/types'
import type { ControlsState } from '../core/controls'
import { computeStats } from '../core/stats'
import { getPlayer } from '../state'
import { PANDA_BODY, PANDA_HEAD_ANCHORS } from './player-body'
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
const DIVE_SPEED = 1400 // vitesse de piqué vertical du Plongeon (px/s)
// Lignée du sabreur : ces classes disposent du DOUBLE SAUT (2 sauts). Les autres restent à 1.
const DOUBLE_JUMP_CLASSES = new Set<string>(['swordsman', 'chevalier'])
const HAT_OFFSET_Y = -38 // place le chapeau au-dessus de la tête du panda illustré (crown haute)
const WEAPON_OFFSET_X = 11 // décalage horizontal de l'arme (patte avant), mirroré selon l'orientation
const WEAPON_OFFSET_Y = 12 // décalage vertical de l'arme (hauteur de la patte avant)
// Inclinaison de l'arme tenue dans la patte avant (degrés, panda tourné vers la droite). Positif =
// sommet penché vers l'AVANT (× facing), ce qui dégage la tête : l'arme n'est plus plantée à la
// verticale dans le crâne mais tenue en biais comme dans la main. Réglée par classe (le bâton du
// mage/sorcier, long, penche le plus fort ; l'épée un peu moins ; l'arc reste presque droit).
const WEAPON_TILT_DEG: Record<string, number> = {
  mage: 40, sorcier: 42,
  swordsman: 30, chevalier: 26,
  archer: 16, chasseur: 18,
}
// Distance (px) du CENTRE de la texture (92px de haut, origine 0.5) à la ligne des pieds
// (FEET_Y=86 au bake) : sert à ré-ancrer les pieds quand un squash/stretch d'affichage change
// scaleY (le scaling se fait autour du centre → sans compensation les pieds « décolleraient »).
const FEET_FROM_CENTER = 40

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: StatBlock
  hp: number
  energy = MAX_ENERGY
  readonly maxEnergy = MAX_ENERGY
  facing: 1 | -1 = 1
  // renseignés chaque frame par LevelScene selon les zones chevauchées
  onLadder = false
  ladderCenterX = 0 // centre x de l'échelle courante : sert à recentrer le panda en grimpant
  inWater = false
  private climbing = false
  // cycle d'escalade : phase (0/1) alternant deux poses de membres opposés, avancée par la
  // distance verticale réellement parcourue (climbAccum), pas par une horloge → fige à l'arrêt
  private climbPhase = 0
  private climbAccum = 0
  private climbLastY = 0
  private wasGrounded = true
  // Sauts : compteur remis à 0 à l'atterrissage ; front montant de `jump` détecté via jumpWasDown
  // (l'input est maintenu, pas événementiel) → un appui = un saut. maxJumps() = 2 pour la lignée
  // du sabreur (double saut), 1 sinon.
  private jumpsUsed = 0
  private jumpWasDown = false
  // Plongeon : piqué vertical verrouillé déclenché en l'air ; l'atterrissage émet 'player-dive-land'
  // (x, y, hauteur de chute) → LevelScene fait l'explosion proportionnelle à la hauteur.
  diving = false
  private diveStartY = 0
  // Épée enflammée : buff temporaire ; pendant ce temps la lame flambe et les coups brûlent.
  private flameUntil = 0
  private flameTimer: Phaser.Time.TimerEvent | null = null
  private attacking = false
  // Animation d'affichage PROCÉDURALE (respiration / rebond de foulée / squash-stretch) : pilotée
  // uniquement sur le RENDU (setScale + décalage vertical), jamais sur le corps physique. Le
  // transform est POSÉ en POST_UPDATE (juste avant le rendu) puis RETIRÉ en PRE_UPDATE, AVANT que
  // la physique ne relise l'échelle/position (ordre Phaser : PRE_UPDATE → physique → update →
  // POST_UPDATE → rendu). La physique ne voit donc jamais qu'une échelle 1 → hitbox 34×62 intacte.
  private breathT = 0 // horloge de respiration (état idle)
  private strideDist = 0 // distance horizontale accumulée → cadence la foulée (fige à l'arrêt)
  private strideLastX = 0
  private landSquash = 0 // impulsion de squash d'atterrissage (décroît vers 0)
  private dispDy = 0 // décalage vertical de rendu appliqué (retiré tel quel en PRE_UPDATE)
  private dispApplied = false
  private hatImage: Phaser.GameObjects.Image | null = null
  private weaponImage: Phaser.GameObjects.Image | null = null
  // offset d'angle (radians) ajouté à l'arme pendant l'attaque : un tween le fait balayer de
  // l'arrière vers l'avant/bas puis revenir à 0. Piloté ici, appliqué dans syncOverlays (qui repose
  // l'angle de repos chaque frame) → le swing prend le dessus tant qu'il n'est pas revenu à 0.
  private attackSwing = 0
  private swingTween: Phaser.Tweens.Tween | null = null
  // buff d'attaque (Cri de guerre) : multiplicateur temporaire des dégâts sortants + aura dorée suivie
  private buffUntil = 0
  private buffMult = 1
  private auraImage: Phaser.GameObjects.Image | null = null
  private auraTween: Phaser.Tweens.Tween | null = null
  // Folie enragée : aura ROUGE SANG pulsante + clignotement rouge du panda, distincte du buff ATK
  // doré. Purement visuel côté joueur (l'effet de terreur s'applique aux ennemis dans LevelScene).
  private rageUntil = 0
  private rageAura: Phaser.GameObjects.Image | null = null
  private rageTween: Phaser.Tweens.Tween | null = null
  private rageBlink: Phaser.Time.TimerEvent | null = null

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
    // Les overlays (chapeau/arme/aura) sont recalés APRÈS la synchro physique de la frame
    // (POST_UPDATE, après world.postUpdate) : positions/flip du panda finalisés → ancrage rigide,
    // pas de traînée d'une frame en déplacement.
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncOverlays, this)
    // retrait du transform d'affichage AVANT le pas physique (cf. commentaire des champs disp*)
    this.scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.resetDisplayTransform, this)
    this.strideLastX = x
  }

  // PRE_UPDATE : rend au sprite son échelle 1 et sa position physique canonique AVANT que la
  // physique ne s'exécute → le corps 34×62 n'est jamais impacté par le squash/stretch d'affichage.
  private resetDisplayTransform() {
    if (!this.active || !this.scene || !this.scene.sys) return
    if (!this.dispApplied) return
    this.setScale(1, 1)
    this.y -= this.dispDy
    this.dispDy = 0
    this.dispApplied = false
  }

  // Calcule le transform d'affichage (échelle + décalage vertical) selon l'état courant, déduit du
  // corps physique. Vie procédurale : respiration à l'arrêt, rebond+squash de foulée en course,
  // stretch/squash au saut, plus l'impulsion d'atterrissage. Ne touche RIEN de la physique.
  private computeDisplayTransform(delta: number): { sx: number; sy: number; dy: number } {
    const body = this.body as Phaser.Physics.Arcade.Body
    const moved = Math.abs(this.x - this.strideLastX)
    this.strideLastX = this.x
    let sx = 1, sy = 1, dy = 0

    if (this.climbing) {
      // escalade : poses + inclinaison gérées par animateClimb → pas de squash d'affichage
    } else if (!body.blocked.down && !this.inWater) {
      // SAUT : étirement vertical en montée (vy<0), compression à la retombée (vy>0)
      const s = Phaser.Math.Clamp(-body.velocity.y / 850, -0.16, 0.18)
      sy = 1 + s * 0.9
      sx = 1 - s * 0.6
    } else if (Math.abs(body.velocity.x) > 6) {
      // COURSE : rebond de foulée cadencé par la distance parcourue + squash/stretch d'appui
      this.strideDist += moved
      const ph = (this.strideDist / 30) * Math.PI * 2 // 30 px ≈ un cycle de 2 appuis
      dy = -Math.abs(Math.sin(ph)) * 4 // remonte à chaque poussée
      const sq = Math.cos(ph) * 0.05 // compression à l'appui / extension en l'air
      sy = 1 - sq
      sx = 1 + sq
    } else {
      // IDLE : respiration douce (échelle qui pulse ±3 %) + micro-bob → plus de statue figée
      this.breathT += delta / 1000
      const b = Math.sin(this.breathT * 2.1)
      sy = 1 + b * 0.03
      sx = 1 - b * 0.03
      dy = -Math.abs(b) * 1.3
    }

    // impulsion d'atterrissage : squash bref (aplati) qui se superpose puis décroît
    if (this.landSquash > 0.01) {
      sx += this.landSquash * 0.16
      sy -= this.landSquash * 0.16
      this.landSquash *= 0.8
    } else this.landSquash = 0

    // ré-ancrage des pieds : le scaling se fait autour du centre → on décale le rendu pour que la
    // ligne des pieds ne bouge pas quand scaleY ≠ 1 (le panda reste posé au sol)
    dy -= (sy - 1) * FEET_FROM_CENTER
    return { sx, sy, dy }
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

  // Recale les overlays sur le panda (appelé en POST_UPDATE, après la synchro physique) : ancrage
  // RIGIDE, aucun lissage/tween. Le chapeau se colle sur l'ancre de tête de la POSE COURANTE
  // (texture affichée) et non sur un offset fixe → il reste collé à la tête dans toutes les poses
  // (idle/course/saut/attaque/échelle), dont la hauteur de tête diffère.
  private syncOverlays(_time: number, delta: number) {
    // garde de fermeture : pendant la sortie de niveau, POST_UPDATE peut encore se déclencher
    // alors que la scène/le corps sont déjà en cours de destruction → accès à this.scene = gel
    if (!this.active || !this.scene || !this.scene.sys) return
    // pose le transform d'affichage procédural pour le rendu de cette frame (retiré en PRE_UPDATE)
    const { sx, sy, dy } = this.computeDisplayTransform(delta)
    this.setScale(sx, sy)
    this.y += dy
    this.dispDy = dy
    this.dispApplied = true
    const flip = this.facing
    if (this.hatImage) {
      const a = PANDA_HEAD_ANCHORS[this.texture.key] ?? { dx: 0, dy: HAT_OFFSET_Y }
      // l'échelle d'affichage déplace la tête (scaling autour du centre) → on répercute sx/sy sur
      // l'ancrage pour que le chapeau reste COLLÉ à la tête malgré respiration/squash (this.y
      // inclut déjà le bob dy, donc le chapeau suit tête ET rebond)
      this.hatImage.setPosition(this.x + a.dx * flip * sx, this.y + a.dy * sy)
      this.hatImage.setFlipX(flip === -1)
    }
    if (this.weaponImage) {
      this.weaponImage.setPosition(this.x + WEAPON_OFFSET_X * flip * sx, this.y + WEAPON_OFFSET_Y * sy)
      this.weaponImage.setFlipX(flip === -1)
      // arme tenue en biais dans la patte (pas plantée à la verticale dans la tête) ; l'angle suit
      // le flip pour rester penchée vers l'avant quel que soit le sens du regard
      const tilt = WEAPON_TILT_DEG[getPlayer().classId] ?? 0
      // angle de repos (tilt) + offset de swing d'attaque, le tout mirroré par le flip pour que
      // l'arme fende toujours vers l'avant quel que soit le sens du regard
      this.weaponImage.setRotation((Phaser.Math.DegToRad(tilt) + this.attackSwing) * flip)
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
    // aura de rage (Folie enragée) : suit le panda tant que la furie dure, puis s'éteint et rend
    // sa teinte normale au panda.
    if (this.rageAura) {
      if (this.scene.time.now >= this.rageUntil) {
        this.rageTween?.remove(); this.rageTween = null
        this.rageBlink?.remove(); this.rageBlink = null
        this.rageAura.destroy(); this.rageAura = null
        this.clearTint()
      } else {
        this.rageAura.setPosition(this.x, this.y)
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

  // Folie enragée : entre en furie pour une durée donnée → aura ROUGE SANG pulsante sous le panda
  // + clignotement rouge du panda (teinte alternée). Purement visuel côté joueur ; la terreur
  // infligée aux monstres est gérée dans LevelScene. Nettoyage à l'échéance dans syncOverlays.
  applyRageAura(durationMs: number) {
    this.rageUntil = this.scene.time.now + durationMs
    if (!this.rageAura) {
      this.rageAura = this.scene.add.image(this.x, this.y, 'ring')
        .setTint(0xd50000).setDepth(this.depth - 1).setAlpha(0.55).setScale(1.8)
      this.rageTween = this.scene.tweens.add({
        targets: this.rageAura, scale: 2.5, alpha: 0.85,
        duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      })
    }
    if (!this.rageBlink) {
      this.rageBlink = this.scene.time.addEvent({
        delay: 120, loop: true, callback: () => {
          if (this.scene.time.now >= this.rageUntil) { this.rageBlink?.remove(); this.rageBlink = null; return }
          // alterne une teinte ROUGE SANG sur le panda → clignotement de furie
          if (this.isTinted) this.clearTint()
          else this.setTint(0xb71c1c)
        },
      })
    }
  }

  // multiplicateur appliqué à tous les dégâts sortants (attaque de base + skills) ; 1 hors buff
  outgoingMult(): number {
    return this.scene.time.now < this.buffUntil ? this.buffMult : 1
  }

  destroy(fromScene?: boolean) {
    this.scene?.events?.off(Phaser.Scenes.Events.POST_UPDATE, this.syncOverlays, this)
    this.scene?.events?.off(Phaser.Scenes.Events.PRE_UPDATE, this.resetDisplayTransform, this)
    this.swingTween?.remove()
    this.flameTimer?.remove()
    this.hatImage?.destroy()
    this.weaponImage?.destroy()
    this.auraTween?.remove()
    this.auraImage?.destroy()
    this.rageTween?.remove()
    this.rageBlink?.remove()
    this.rageAura?.destroy()
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
    this.swingWeapon()
  }

  // Balaye l'arme d'un coup : armé vers l'arrière (angle négatif) puis fend vers l'avant/bas
  // (angle positif) et revient au repos. Synchronisé avec chaque attaque de base / skill mêlée.
  // No-op sans arme (novice). L'ampleur suit un peu la classe (épée = grand arc franc).
  swingWeapon() {
    if (!this.weaponImage) return
    this.swingTween?.remove()
    this.attackSwing = Phaser.Math.DegToRad(-60) // arme relevée vers l'arrière
    this.swingTween = this.scene.tweens.add({
      targets: this,
      attackSwing: Phaser.Math.DegToRad(78), // fend vers l'avant / le bas
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        this.swingTween = this.scene?.tweens.add({
          targets: this, attackSwing: 0, duration: 130, ease: 'Cubic.out',
        }) ?? null
      },
    })
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

    // PLONGEON en cours : piqué vertical verrouillé, aucun autre contrôle jusqu'à l'impact.
    if (this.diving) { this.updateDive(body); return }

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
    else { this.setVelocityX(0); this.setFlipX(this.facing === -1) } // aligne le flip sur l'orientation (corrige le miroir de grimpe résiduel)

    if (this.inWater) { this.updateSwim(c, body); return }

    // SAUT + DOUBLE SAUT : compteur remis à 0 dès qu'on touche le sol ; on ne consomme un saut
    // que sur le FRONT MONTANT de `jump` (input maintenu). La lignée du sabreur peut sauter une
    // seconde fois en l'air (maxJumps = 2) ; les autres classes restent à un seul saut.
    if (body.blocked.down) this.jumpsUsed = 0
    const jumpPressed = c.jump && !this.jumpWasDown
    if (jumpPressed && this.jumpsUsed < this.maxJumps()) {
      const airborneJump = this.jumpsUsed >= 1
      this.setVelocityY(JUMP_VELOCITY)
      this.jumpsUsed += 1
      this.scene.events.emit('player-jump')
      if (airborneJump) this.doubleJumpFx() // souffle bleuté sous les pattes au 2e saut
    }
    this.jumpWasDown = c.jump

    // « splat » d'atterrissage : impulsion de squash purement D'AFFICHAGE (cf. computeDisplayTransform),
    // posée en POST_UPDATE et retirée en PRE_UPDATE → le corps physique n'est jamais redimensionné
    // (l'ancien setScale direct changeait la hitbox et cassait le contact sur les dalles one-way).
    if (body.blocked.down && !this.wasGrounded) this.landSquash = 1
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
    // gauche/droite : on peut se décaler volontairement pour quitter l'échelle
    if (c.left) { this.setVelocityX(-RUN_SPEED); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(RUN_SPEED); this.facing = 1; this.setFlipX(false) }
    else {
      // sans input latéral : recentrage doux sur l'échelle → plus de décrochage accidentel
      const dx = this.ladderCenterX - this.x
      this.setVelocityX(Math.abs(dx) > 1 ? Phaser.Math.Clamp(dx * 8, -RUN_SPEED, RUN_SPEED) : 0)
    }
    this.wasGrounded = false
    if (!this.attacking) this.animateClimb(c)
  }

  // Grimpe vue de dos : la pose `panda-<cls>-echelle` (un bras/jambe opposés levés) + son MIROIR
  // horizontal (flipX) forment un cycle de 2 frames à membres alternés. Le cycle N'AVANCE QUE
  // quand le panda se déplace vraiment (distance verticale accumulée) → il fige sur une frame dès
  // qu'on lâche up/down. On pilote flipX/texture à la main : hitbox et montée (onLadder/climb)
  // inchangées. Repli sur l'ancienne grimpe procédurale si la pose de dos manque.
  private animateClimb(c: ControlsState) {
    const cls = getPlayer().classId
    const ladderKey = `panda-${cls}-echelle`
    this.anims.stop() // on pilote les frames à la main plutôt que via une horloge d'animation
    const climbed = Math.abs(this.y - this.climbLastY)
    this.climbLastY = this.y
    if (c.up || c.down) {
      this.climbAccum += climbed
      if (this.climbAccum >= CLIMB_STRIDE) { this.climbAccum -= CLIMB_STRIDE; this.climbPhase ^= 1 }
    }
    if (this.scene.textures.exists(ladderKey)) {
      this.setTexture(ladderKey)
      this.setAngle(0)
      this.setFlipX(this.climbPhase === 1) // frame 2 = miroir de la frame 1 (membres opposés)
      return
    }
    // repli procédural : 2 poses de course inversées + légère inclinaison alternée
    const frames = this.scene.textures.exists(`panda-${cls}-course`)
      ? [`panda-${cls}`, `panda-${cls}-course`]
      : [`panda-${cls}-run-0`, `panda-${cls}-run-2`]
    if (c.up || c.down) {
      this.setTexture(frames[this.climbPhase] ?? frames[0]!)
      this.setAngle(this.climbPhase === 0 ? -CLIMB_TILT : CLIMB_TILT)
    } else {
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

  // nombre de sauts autorisés selon la classe : 2 pour la lignée du sabreur (double saut), 1 sinon
  private maxJumps(): number {
    return DOUBLE_JUMP_CLASSES.has(getPlayer().classId) ? 2 : 1
  }

  // souffle du 2e saut : anneau bleuté aplati sous le panda + fines traînées vers le bas
  private doubleJumpFx() {
    const y = this.y + PANDA_BODY.h / 2
    const ring = this.scene.add.image(this.x, y, 'ring').setTint(0xb3e5fc)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth - 1).setScale(0.15).setAlpha(0.9)
    this.scene.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 0.7, alpha: 0, duration: 300, ease: 'Cubic.out', onComplete: () => ring.destroy() })
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI // éventail dirigé vers le bas
      const sh = this.scene.add.rectangle(this.x, y, 3, 9, 0xe1f5fe).setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD)
      this.scene.tweens.add({ targets: sh, x: this.x + Math.cos(a) * 28, y: y - Math.sin(a) * 22, alpha: 0, duration: 260, onComplete: () => sh.destroy() })
    }
  }

  // Plongeon : ne s'amorce qu'EN L'AIR. Verrouille les contrôles et impose un piqué vertical
  // rapide ; l'atterrissage (updateDive) émet 'player-dive-land'. Renvoie false au sol.
  startDive(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (this.diving || body.blocked.down) return false
    this.diving = true
    this.diveStartY = this.y
    body.setAllowGravity(true)
    this.setVelocity(0, DIVE_SPEED)
    this.play(this.anim('attack'), true)
    return true
  }

  // piqué du Plongeon : chute verticale imposée jusqu'à l'impact, puis émission de l'événement
  // d'atterrissage avec la hauteur de chute (dégâts/rayon proportionnels côté LevelScene)
  private updateDive(body: Phaser.Physics.Arcade.Body) {
    body.setAllowGravity(true)
    this.setVelocityX(0)
    if (body.velocity.y < DIVE_SPEED) this.setVelocityY(DIVE_SPEED)
    if (body.blocked.down) {
      const fall = Math.max(0, this.y - this.diveStartY)
      this.diving = false
      this.jumpsUsed = 0
      this.wasGrounded = true
      this.scene.events.emit('player-dive-land', this.x, this.y, fall)
    }
  }

  // Épée enflammée : embrase la lame pour un temps donné → flammes visibles sur l'arme et
  // brûlure appliquée par les coups (test isFlaming côté LevelScene).
  applyFlameBuff(durationMs: number) {
    this.flameUntil = this.scene.time.now + durationMs
    this.weaponImage?.setTint(0xff7043)
    if (!this.flameTimer) {
      this.flameTimer = this.scene.time.addEvent({ delay: 55, loop: true, callback: () => this.emitFlame() })
    }
  }

  isFlaming(): boolean {
    return this.scene.time.now < this.flameUntil
  }

  // flammèche qui monte depuis la lame tant que le buff est actif ; s'auto-éteint à l'échéance
  private emitFlame() {
    if (!this.isFlaming()) {
      this.flameTimer?.remove(); this.flameTimer = null
      this.weaponImage?.clearTint()
      return
    }
    const w = this.weaponImage
    if (!w) return
    const fx = w.x + Phaser.Math.Between(-7, 7)
    const fy = w.y - Phaser.Math.Between(4, 18)
    const col = Phaser.Math.RND.pick([0xffca28, 0xff7043, 0xff5252])
    const fl = this.scene.add.rectangle(fx, fy, 5, 10, col).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95)
    this.scene.tweens.add({ targets: fl, y: fy - Phaser.Math.Between(16, 26), scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: 300, ease: 'Sine.out', onComplete: () => fl.destroy() })
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
