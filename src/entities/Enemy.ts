import Phaser from 'phaser'
import type { MonsterDef } from '../core/types'
import { Projectile } from './Projectile'
import type { LevelScene } from '../scenes/LevelScene'
import { getPlayer } from '../state'
import { diesOnFall, hasFallenOutOfWorld } from '../core/mob-fall'
import { GRAVITY } from '../core/platforming'

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
const BIRD_DIVE_COOLDOWN = 1900
const BIRD_DIVE_MS = 820 // fenêtre de piqué allongée : le temps de descendre à hauteur du joueur (tirs) et d'y rester une lucarne touchable
const BIRD_WANDER_AMP = 60 // px d'oscillation verticale du vol de croisière
// avancée du point de sonde de rebord au-delà du bord du corps (px) pour la détection de vide devant.
const TILE_PROBE = 20
// MÊLÉE LISIBLE (mobile-mêlée ET immobile-mêlée) : au lieu de « frotter » le joueur au contact, le
// monstre joue une VRAIE attaque en trois temps — télégraphe (wind-up) planté → coup (fenêtre active,
// petit bond en avant + hitbox de portée) → récupération. Le coup fait plus mal qu'un simple contact.
const MELEE_RANGE_PAD = 26 // portée du coup AU-DELÀ du bord du corps (px)
const MELEE_WINDUP_MS = 340 // durée du télégraphe avant que le coup ne parte
const MELEE_STRIKE_MS = 170 // fenêtre ACTIVE du coup (bond en avant, la hitbox touche)
const MELEE_COOLDOWN = 1300 // récupération entre deux coups de mêlée
const MELEE_DMG_MULT = 1.4 // un vrai coup fait plus mal que le frottement de contact (atk × ceci)
// CHARGE : brève mise en garde avant la ruée, pour que la charge se LISE (on voit le monstre s'armer)
// au lieu de foncer sans prévenir.
const CHARGE_WINDUP_MS = 260
// GABARIT 'grand' (ours, golem) : facteur d'agrandissement du rendu ET de la hitbox (le corps Arcade
// suit la scale du sprite en Phaser 4, cf. Body.update → width = sourceWidth × scaleX).
const GRAND_SCALE = 1.55
// ÉLITE (MVP) : cadence du SKILL SIGNATURE unique — onde de choc télégraphiée (colosses) ou salve en
// éventail (lanceurs). Les mobs normaux n'en ont pas ; les boss (3 skills) sont un chantier à part.
const ELITE_SKILL_COOLDOWN = 6000
// NOYADE DES MONSTRES : un mob terrestre (ni aquatique ni volant) qui se retrouve immergé dans une
// eau marine profonde SE NOIE — dégâts périodiques par le chemin de dégâts standard (takeDamage)
// jusqu'à mourir. Pas d'apnée : l'eau n'est pas son élément (contrairement au joueur). Proportionnel
// aux PV max → mort en un temps borné quel que soit le monstre. Les aquatiques (méduse/crabe) nagent.
const MOB_DROWN_TICK_MS = 400 // cadence des ticks de noyade (perte régulière, jamais d'un coup)
const MOB_DROWN_HP_FRAC_PER_S = 0.12 // fraction des PV max perdue par seconde une fois immergé (~8 s)

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  monster: MonsterDef
  hp: number
  private levelScene: LevelScene
  private nextActionAt = 0
  private nextShootAt = 0
  private bar: Phaser.GameObjects.Graphics
  private lvlText: Phaser.GameObjects.Text
  // Étiquette de rang flottante au-dessus de la plaque de nom : « ÉLITE » (doré) pour un mini-boss
  // de map (mvp), « BOSS » (rouge) pour un boss de zone. Absente pour un mob normal.
  private tierText: Phaser.GameObjects.Text | null = null
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
  // Ralenti (Flèches entravantes du chasseur) : tant que l'effet dure, la VÉLOCITÉ et la CADENCE
  // d'attaque du monstre sont multipliées par slowFactor (< 1). Les boss en sont exemptés.
  private slowedUntil = 0
  private slowFactor = 1
  private slowFx: Phaser.GameObjects.Graphics | null = null
  // patrouille sûre (monstres terrestres au repos) : sens courant + demi-tour au bord/mur.
  private patrolDir: 1 | -1 = 1
  // oiseau : point d'attache du vol de croisière + cadence de piqué.
  private homeX = 0
  private homeY = 0
  private nextDiveAt = 0
  private diveUntil = 0
  // GABARIT : scale de base du sprite (1 = normal, GRAND_SCALE pour les 'grand'). Le dandinement de
  // updateVisuals se REMULTIPLIE par cette base pour ne pas écraser l'agrandissement. Public :
  // l'entraînement l'augmente pour grossir le dummy (le rendu suit, cf. updateVisuals).
  baseScale = 1
  // CIBLE D'ENTRAÎNEMENT (TrainingScene) : PV INFINIS — encaisse chaque coup (flash + chiffre) mais
  // ne perd jamais de vie et ne meurt jamais. Faux en jeu normal → aucun impact sur le gameplay.
  invincible = false
  // MÊLÉE en trois temps : prochaine attaque autorisée / fin du wind-up / fin de la fenêtre active +
  // garde-coup (le coup ne touche qu'une fois par swing) + sens verrouillé au déclenchement.
  private nextMeleeAt = 0
  private windUpUntil = 0
  private strikeUntil = 0
  private struckThisSwing = false
  private attackDir: 1 | -1 = 1
  private meleeFx: Phaser.GameObjects.Graphics | null = null
  // ÉLITE : prochaine utilisation du skill signature.
  private nextEliteSkillAt = 0
  // NOYADE : accumulateur de temps immergé (ticks de dégâts de noyade). Remis à zéro dès que le
  // monstre n'est plus dans l'eau marine.
  private drownAccumMs = 0
  // BOSS piloté de l'EXTÉRIEUR (BossController) : quand vrai, l'IA autonome ci-dessous est
  // COURT-CIRCUITÉE — le contrôleur impose la vélocité et déclenche les skills. On garde le rendu
  // flottant (barre, plaque, télégraphes) et la physique (gravité/collisions/bornes). Piège/terreur
  // n'ont de toute façon aucune prise sur un boss.
  aiDisabled = false
  // REPOUSSÉ : tant que `now < knockbackUntil`, l'IA de déplacement est suspendue et la vélocité de
  // recul imposée prime → le monstre part vraiment en arrière (ex. charge lancière) au lieu de
  // réavancer aussitôt vers le joueur à la frame suivante.
  private knockbackUntil = 0
  applyKnockback(vx: number, vy: number, durationMs: number) {
    if (!this.active || this.ragdolling) return
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy)
    this.knockbackUntil = this.scene.time.now + durationMs
  }
  // MORT HUMILIANTE (one-shot depuis la VIE PLEINE) : le mob est propulsé en cloche à l'opposé de
  // l'attaquant, tournoie, retombe (peut rebondir), puis disparaît (poof) au contact du sol ou au
  // timer max. Tant que c'est vrai, l'IA est court-circuitée (physique libre). Faux = mort normale.
  ragdolling = false
  private ragdollEndAt = 0
  private ragdollAirborne = false

  constructor(scene: LevelScene, x: number, y: number, def: MonsterDef) {
    // TEXTURE : soit une clé explicite réutilisée (def.tex, ex. piranha → fish-piranha), soit la texture
    // bakée de la base pour une variante GÉANTE (def.artFrom), soit la texture bakée du monstre lui-même.
    super(scene, x, y, def.tex && scene.textures.exists(def.tex) ? def.tex : `monster-${def.artFrom ?? def.id}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.homeX = x; this.homeY = y
    this.patrolDir = (Math.round(x / 32) % 2 === 0 ? 1 : -1)
    // OISEAU : vol libre — gravité coupée ; il traverse le décor (sa non-collision avec le sol/les
    // plateformes est gérée par un processCallback côté LevelScene qui ignore les aériens). On NE met
    // PLUS `checkCollision.none = true` : ce drapeau excluait l'oiseau de TOUS les overlaps Arcade
    // (cf. World.collideSpriteVsGroup) → il était intouchable par les tirs du joueur et ne touchait
    // jamais le joueur. Sans lui, l'overlap projectiles↔ennemis le touche enfin (notamment en piqué).
    if (def.aerial) {
      (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    }
    // borne tout ennemi dans l'arène : les bornes du monde physique valent (0..widthPx). Sans ça,
    // un chargeur lancé (vitesse persistante, drag nul) glisse hors de la zone jouable et ne revient
    // jamais — c'est le bug du boss « parti tout seul » hors écran.
    this.setCollideWorldBounds(true)
    // GABARIT : les 'grand' (ours, golem) sont agrandis AVANT le calcul de hitbox — le corps Arcade
    // reprend la scale du sprite (Phaser 4), donc la hitbox grossit avec le rendu.
    this.baseScale = def.size === 'grand' ? GRAND_SCALE : 1
    // TEXTURE réutilisée brute (non bakée, ex. fish-piranha) : normalise l'échelle à ~46px (taille
    // standard d'un mob) pour que le sprite ne s'affiche pas à sa résolution native (souvent énorme).
    if (def.tex && scene.textures.exists(def.tex)) {
      const src = scene.textures.get(def.tex).getSourceImage() as { width?: number }
      if (src.width && src.width > 0) this.baseScale = (46 / src.width) * (def.size === 'grand' ? GRAND_SCALE : 1)
    }
    if (this.baseScale !== 1) this.setScale(this.baseScale)
    // hitbox = la créature seule (la texture a de la marge : ombre au sol + place au-dessus),
    // pour qu'elle repose au sol au même niveau que le panda
    const bw = this.width * 0.8
    const bh = this.height - 8
    this.setSize(bw, bh)
    // FLOTTEMENT VISUEL (def.floatPx) : on descend le CORPS de floatPx px dans la texture → à corps
    // posé au sol, le sprite (la créature) est rendu floatPx px PLUS HAUT = elle vole légèrement.
    this.setOffset((this.width - bw) / 2, 2 + (def.floatPx ?? 0))
    this.levelScene = scene
    this.monster = def
    this.hp = def.hp
    this.bar = scene.add.graphics()
    // plaque de niveau au-dessus du monstre : couleur selon l'écart de niveau avec le joueur
    // (danger). Les boss/MVP gardent leur indice distinct via la barre de vie large et le halo
    // d'élite ci-dessous — la COULEUR du nom, elle, suit l'écart.
    this.lvlText = scene.add.text(x, y, `Nv ${def.level}`, { fontSize: '17px', color: levelGapColor(def.level), fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
    // rang affiché : ÉLITE en DORÉ pour un mini-boss de map, BOSS en rouge pour un boss de zone
    if (def.boss || def.mvp) {
      this.tierText = scene.add.text(x, y, def.boss ? 'BOSS' : 'ÉLITE', { fontSize: '13px', color: def.boss ? '#ff5252' : '#ffd54f', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
    }
    if (def.mvp) this.eliteAura = scene.add.graphics()
  }

  takeDamage(amount: number) {
    if (!this.active || this.ragdolling) return
    // Dummy d'entraînement : PV infinis → on montre le coup (flash + chiffre) sans jamais entamer la
    // vie ni mourir. La barre reste pleine → « insubmersible ».
    if (this.invincible) {
      this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
      this.scene.time.delayedCall(80, () => { if (this.active) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY) })
      this.levelScene.showDamageNumber(this.x, this.y - 30, amount, false)
      return
    }
    const hpBefore = this.hp
    this.hp -= amount
    // Phaser 4 : le flash blanc se fait via setTint + mode FILL (setTintFill est un no-op déprécié)
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(80, () => this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY))
    // chiffre de dégâts INFLIGÉS (taille ∝ ampleur, jaune→orange→rouge selon la force) — style et
    // regroupement gérés par LevelScene, distinct du ROUGE des dégâts subis par le joueur
    this.levelScene.showDamageNumber(this.x, this.y - 30, amount, false)
    if (this.hp <= 0) {
      // MORT HUMILIANTE : uniquement si le coup fatal tue depuis la VIE PLEINE (hp plein avant le
      // coup) OU écrase d'un coup (dégât ≥ PV max). Sinon mort NORMALE. Boss/élite exemptés (mort
      // dédiée / trop lourds à ragdoller).
      const maxHp = this.monster.hp
      const oneShot = hpBefore >= maxHp || amount >= maxHp
      if (oneShot && !this.monster.boss && !this.monster.mvp) this.dieRagdoll(amount / maxHp)
      else this.die(true)
    }
  }

  // MORT HUMILIANTE (one-shot depuis la vie pleine) : récompense + nettoyage des FX flottants MAINTENANT
  // (loot/XP au point de mort), puis le sprite est propulsé en cloche à l'OPPOSÉ du joueur (attaquant),
  // tournoie et retombe sous gravité réelle (peut rebondir), et disparaît (poof) au contact du sol après
  // retombée OU au timer max (~1,5 s). `overkill` = dégât / PV max → apogée ∝ overkill (plafond 5×).
  private dieRagdoll(overkill: number) {
    if (!this.active || this.ragdolling) return
    this.scene.events.emit('enemy-died', this) // XP/loot au point de mort
    this.bar.destroy()
    this.lvlText.destroy()
    this.tierText?.destroy()
    this.eliteAura?.destroy()
    this.zzz?.destroy(); this.zzz = null
    this.burnTimer?.remove(); this.burnTimer = null
    this.snareFx?.destroy(); this.snareFx = null
    this.fearFx?.destroy(); this.fearFx = null
    this.slowFx?.destroy(); this.slowFx = null
    this.meleeFx?.destroy(); this.meleeFx = null
    this.ragdolling = true
    this.aiDisabled = true
    this.ragdollEndAt = this.scene.time.now + 1500
    const dirX = (Math.sign(this.x - this.levelScene.player.x) || 1) as 1 | -1
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    // apogée = ratio d'overkill × la HAUTEUR de la victime, plafonné à 5× ; v = sqrt(2·g·h)
    const h = Phaser.Math.Clamp(overkill, 1, 5) * this.displayHeight
    const v = Math.sqrt(2 * GRAVITY * Math.max(1, h))
    body.setVelocity(dirX * Phaser.Math.Between(160, 240), -v)
    body.setBounceY(0.4)
    this.setAngularVelocity(dirX * 540)
  }

  // Un tick de vol de la MORT HUMILIANTE : détecte l'atterrissage (après avoir décollé) ou le timer
  // max, puis fait disparaître le mob (poof de poussière + destruction).
  private updateRagdoll() {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body.blocked.down) this.ragdollAirborne = true
    const landed = this.ragdollAirborne && body.blocked.down
    if (landed || this.scene.time.now >= this.ragdollEndAt) {
      this.poof()
      this.destroy()
    }
  }

  // petit nuage de poussière à la disparition du corps
  private poof() {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const puff = this.scene.add.circle(this.x, this.y, Phaser.Math.Between(3, 6), 0xcfd8dc).setDepth(6).setAlpha(0.8)
      this.scene.tweens.add({ targets: puff, x: this.x + Math.cos(a) * 26, y: this.y + Math.sin(a) * 26 - 6, alpha: 0, scale: 0.3, duration: 260, onComplete: () => puff.destroy() })
    }
  }

  // MORT du monstre : nettoie tous les FX flottants et détruit le sprite. `grantReward` (vrai en combat
  // normal) émet 'enemy-died' → XP/loot au joueur. Chemin UNIQUE de mort (coup fatal ET chute hors map),
  // pour que rien ne « remonte » ou ne colle : hors-map = mort NETTE (cf. preUpdate).
  private die(grantReward: boolean) {
    if (!this.active) return
    if (grantReward) this.scene.events.emit('enemy-died', this)
    this.bar.destroy()
    this.lvlText.destroy()
    this.tierText?.destroy()
    this.eliteAura?.destroy()
    this.zzz?.destroy()
    this.burnTimer?.remove()
    this.snareFx?.destroy()
    this.fearFx?.destroy()
    this.slowFx?.destroy()
    this.meleeFx?.destroy()
    this.destroy()
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

  // Ralentit l'ennemi pour une durée donnée (Flèches entravantes) : sa vélocité et sa cadence
  // d'attaque sont réduites du facteur `factor` (< 1) tant que l'effet dure. Les boss y sont
  // immunisés (comme pour la terreur). On retient le ralenti le plus FORT (facteur le plus bas) actif.
  applySlow(factor: number, durationMs: number) {
    if (!this.active || this.monster.boss) return
    const until = this.scene.time.now + durationMs
    if (until >= this.slowedUntil) { this.slowedUntil = until; this.slowFactor = factor }
    else this.slowFactor = Math.min(this.slowFactor, factor)
    if (!this.slowFx) this.slowFx = this.scene.add.graphics().setDepth(this.depth - 1)
  }

  isSlowed(): boolean {
    return this.scene.time.now < this.slowedUntil
  }

  // Facteur courant de ralenti (< 1 tant qu'actif, 1 sinon) appliqué à la vélocité.
  private slowMul(): number {
    return this.isSlowed() ? this.slowFactor : 1
  }

  // Facteur d'ÉTIREMENT des temps de recharge (cadence) : 1/slowMul → cooldowns allongés tant que
  // l'ennemi est ralenti (il attaque moins souvent). 1 (aucun effet) hors ralenti.
  private cadenceMul(): number {
    return 1 / this.slowMul()
  }

  // Applique le ralenti à la vélocité EFFECTIVE de la frame (après l'IA) : réduit le déplacement
  // horizontal (tous) et vertical (aériens : leur vol/piqué est piloté, pas la gravité). No-op hors ralenti.
  private applySlowToVelocity() {
    if (!this.isSlowed()) return
    const b = this.body as Phaser.Physics.Arcade.Body
    b.velocity.x *= this.slowFactor
    if (this.monster.aerial) b.velocity.y *= this.slowFactor
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

  // MÊLÉE en trois temps (mobile-mêlée ET immobile-mêlée) : approche → wind-up planté → coup. Le rendu
  // du télégraphe/slash est dans updateVisuals ; ici, la LOGIQUE et la hitbox du coup.
  private meleeUpdate(t: number, dist: number, dir: number, stopDist: number) {
    const attackReach = stopDist + MELEE_RANGE_PAD
    // 1) FENÊTRE ACTIVE du coup : petit bond en avant (mobile) ; le coup touche UNE fois si le joueur
    //    est encore à portée (s'il a esquivé, le coup passe dans le vide → attaque lisible/évitable).
    if (t >= this.windUpUntil && t < this.strikeUntil) {
      this.setVelocityX(this.monster.speed > 0 ? this.attackDir * this.monster.speed * 1.5 : 0)
      if (!this.struckThisSwing && dist <= attackReach + 24) {
        this.struckThisSwing = true
        this.levelScene.hitPlayer(Math.round(this.monster.atk * MELEE_DMG_MULT))
      }
      return
    }
    // 2) TÉLÉGRAPHE : planté, armé (le monstre se prépare — cf. rendu du wind-up dans updateVisuals).
    if (t < this.windUpUntil) { this.setVelocityX(0); return }
    // 3) PRÊT : à portée + récupéré → arme une nouvelle attaque (wind-up puis coup puis cooldown).
    if (dist <= attackReach && t > this.nextMeleeAt) {
      this.attackDir = dir < 0 ? -1 : 1
      this.windUpUntil = t + MELEE_WINDUP_MS
      this.strikeUntil = t + MELEE_WINDUP_MS + MELEE_STRIKE_MS
      this.struckThisSwing = false
      this.nextMeleeAt = this.strikeUntil + MELEE_COOLDOWN * this.cadenceMul()
      this.setVelocityX(0)
      return
    }
    // 4) HORS DE PORTÉE : approche vers le joueur (mobile) ; immobile (speed 0) reste planté. Borné au
    //    rebord : au sol, plus de sol devant → on ne franchit pas le vide (pas de chute bête).
    const grounded = (this.body as Phaser.Physics.Arcade.Body).blocked.down
    const step = dist > stopDist && !(grounded && !this.floorAhead(dir))
    this.setVelocityX(step ? dir * this.monster.speed : 0)
  }

  // Y a-t-il un wind-up de mêlée ou une charge en cours ? (pilote le rendu du télégraphe.)
  private isWindingUp(t: number): boolean {
    return t < this.windUpUntil
  }

  private isStriking(t: number): boolean {
    return t >= this.windUpUntil && t < this.strikeUntil
  }

  // SKILL SIGNATURE des élites (MVP) — un seul, cadencé par ELITE_SKILL_COOLDOWN :
  //  - lanceurs (projectile/caster) : SALVE en éventail (3 tirs haut/droit/bas) ;
  //  - colosses (contact/charge) : ONDE DE CHOC télégraphiée sous le joueur (sort de zone du moteur).
  private useEliteSkill() {
    const player = this.levelScene.player
    if (this.monster.behavior === 'projectile' || this.monster.behavior === 'caster') {
      for (let k = -1; k <= 1; k++) {
        const spread = k
        this.scene.time.delayedCall((k + 1) * 80, () => this.fireSpreadShot(spread))
      }
    } else {
      this.levelScene.enemyGroundSpell(player.x, Math.round(this.monster.atk * 1.2))
    }
  }

  // Un tir de la salve élite : projectile thématique dévié verticalement de `spread` (−1 haut, 0 droit,
  // +1 bas). Même pipeline que fireProjectile (texture, groupe, relance de vélocité).
  private fireSpreadShot(spread: number) {
    if (!this.active) return
    const player = this.levelScene.player
    const dir = Math.sign(player.x - this.x) || 1
    const p = new Projectile(this.scene, this.x + dir * 12, this.y - 10, dir, spread * 0.5, this.monster.atk, false, 620)
    p.setTexture(ENEMY_PROJECTILE_TEX[this.monster.id] ?? 'fx-shot').clearTint().setScale(1.1)
    this.levelScene.enemyProjectiles.add(p)
    p.launch()
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
    // AGGRO du piqué en distance HORIZONTALE (pas la distance 2D) : un oiseau croise HAUT dans le ciel,
    // le joueur est AU SOL — l'écart vertical seul dépasse déjà AGGRO_RANGE, donc en 2D l'oiseau ne
    // déclenchait JAMAIS de piqué (→ intouchable). En ne regardant que l'écart horizontal, un oiseau qui
    // passe au-dessus du joueur pique sur lui et descend à sa hauteur (cf. ci-dessous) → touchable.
    const horiz = Math.abs(player.x - this.x)
    if (horiz < AGGRO_RANGE && t > this.nextDiveAt && t > this.diveUntil) {
      this.diveUntil = t + BIRD_DIVE_MS
      this.nextDiveAt = t + BIRD_DIVE_COOLDOWN * this.cadenceMul()
    }
    if (t < this.diveUntil) {
      // PIQUÉ : l'oiseau fond sur le joueur ET DESCEND jusqu'à SA HAUTEUR — là où passent les tirs
      // horizontaux (attaque de base mage/archer). Sans ça, il plongeait à peine (v.y bornée à ~speed)
      // et restait bien au-dessus de la ligne de tir → intouchable. On vise la hauteur du corps du
      // joueur avec un gain fort et un plancher de vitesse verticale généreux (indépendant de la
      // vitesse nominale, souvent trop lente pour couvrir l'écart ciel→sol dans la fenêtre de piqué) ;
      // en arrivant à hauteur (dy→0) la vitesse s'annule d'elle-même → il plane au niveau du joueur,
      // touchable, avant de remonter en fin de piqué.
      const dy = player.y - this.y
      const vCap = Math.max(560, speed * 4)
      this.setVelocity(dirX * speed * 1.6, Phaser.Math.Clamp(dy * 6, -vCap, vCap))
    } else {
      // croisière : oscille horizontalement autour de home + houle verticale ; dérive vers le joueur
      // (aggro horizontale, cf. piqué) pour se placer au-dessus de lui avant le prochain piqué.
      const drift = horiz < AGGRO_RANGE ? dirX * speed * 0.4 : Math.cos(t / 700) * speed * 0.5
      this.setVelocityX(drift)
      const targetY = this.homeY + Math.sin(t / 500) * BIRD_WANDER_AMP
      this.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 3, -speed, speed))
    }
  }

  // NOYADE : si un monstre terrestre (ni aquatique ni volant ni boss) est immergé dans une eau
  // marine profonde, il perd des PV par ticks réguliers (chemin de dégâts standard) jusqu'à mourir.
  // Renvoie true si le monstre est mort ce tick (détruit) → l'appelant coupe le reste du preUpdate.
  private checkDrown(d: number): boolean {
    if (this.monster.aquatic || this.monster.aerial || this.monster.boss) return false
    if (!this.levelScene.isMarineWater(this.x, this.y)) { this.drownAccumMs = 0; return false }
    this.drownAccumMs += d
    while (this.drownAccumMs >= MOB_DROWN_TICK_MS) {
      this.drownAccumMs -= MOB_DROWN_TICK_MS
      const amount = Math.max(2, Math.round(this.monster.hp * MOB_DROWN_HP_FRAC_PER_S * MOB_DROWN_TICK_MS / 1000))
      this.takeDamage(amount)
      if (!this.active) return true // mort noyé → détruit, on arrête là
    }
    return false
  }

  // CHUTE HORS MAP = MORT NETTE (retour playtest : l'ancien filet REPOSAIT le mob sur son spawn → il
  // « remontait »/collait, buggé). Désormais un monstre terrestre tombé au FOND du monde (trou, cuve,
  // sous la surface) MEURT proprement (retiré, XP/loot au joueur), sans remontée ni blocage. Les
  // aériens (volent) et aquatiques (nagent) en sont exemptés — le vide n'est pas mortel pour eux.
  // Renvoie true si le monstre est mort ce tick (détruit) → l'appelant coupe le reste du preUpdate.
  private checkFallThrough(): boolean {
    if (!diesOnFall(this.monster)) return false
    const body = this.body as Phaser.Physics.Arcade.Body
    const worldBottom = this.levelScene.physics.world.bounds.bottom
    if (hasFallenOutOfWorld(body.bottom, worldBottom)) { this.die(true); return true }
    return false
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    // MORT HUMILIANTE en cours : physique LIBRE (vol en cloche + spin), aucune IA/recalage — on
    // attend l'atterrissage (ou le timer) pour faire disparaître le corps.
    if (this.ragdolling) { this.updateRagdoll(); return }
    // FILET DE SÉCURITÉ ANTI-CHUTE HORS MAP : un monstre terrestre ne doit JAMAIS passer sous le sol ni
    // disparaître sous la carte. La collision au sol peut lâcher pour un GROS corps (boss/élite 'grand')
    // dont la scale — donc la hauteur du corps Arcade — oscille à chaque frame (respiration/dandinement) :
    // sur une bande de sol fine, la séparation ne se stabilise plus et le monstre s'enfonce puis chute.
    // ANTI-JITTER (conservé) : pieds enfoncés SOUS la surface de l'arène MAIS AU-DESSUS d'un sol plein
    // (la collision d'un GROS corps 'grand' dont la scale oscille peut lâcher sur une bande fine) → on
    // repose les pieds PILE sur la surface, sans téléport. Ce n'est PAS une remontée hors-map : il y a
    // un sol sous lui. La chute dans un VRAI trou (pas de sol) tombe dans checkFallThrough → mort nette.
    // Les aériens/aquatiques nagent/volent → non concernés.
    if (!this.monster.aerial && !this.monster.aquatic) {
      const body = this.body as Phaser.Physics.Arcade.Body
      const surface = this.levelScene.groundSurfaceY()
      if (body.bottom > surface + 4 && this.levelScene.floorAt(this.x, surface + 2)) {
        this.y -= body.bottom - surface // recale les pieds sur la surface solide (sol présent sous lui)
        body.setVelocityY(0)
      }
    }
    // NOYADE : un monstre terrestre tombé dans l'eau marine se noie (dégâts jusqu'à la mort). Testé
    // avant toute IA — un mob en train de couler ne patrouille/charge plus, il crève.
    if (this.checkDrown(d)) return
    // CHUTE HORS MAP = MORT NETTE (plus de remontée sur le spawn) : atteint le fond du monde → il meurt.
    if (this.checkFallThrough()) return
    // BOSS piloté par le contrôleur : on ne joue AUCUNE IA autonome (le BossController impose la
    // vélocité et les skills chaque frame). On conserve seulement le rendu flottant.
    if (this.aiDisabled) { this.updateVisuals(t); return }
    // REPOUSSÉ : on laisse filer la vélocité de recul (IA de déplacement suspendue) le temps du push.
    if (t < this.knockbackUntil) { this.updateVisuals(t); return }
    const player = this.levelScene.player
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
    const dir = Math.sign(player.x - this.x) || 1
    // distance de corps-à-corps (tenant compte du gabarit 'grand') : au-delà on avance vers le
    // joueur, en deçà on S'ARRÊTE — puis, en mêlée, on ARME une vraie attaque au lieu de pousser.
    const stopDist = this.width * this.baseScale * 0.5 + 16

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
      this.applySlowToVelocity()
      this.updateVisuals(t)
      return
    }

    if (!rooted && feared) {
      this.setVelocityX(-dir * this.monster.speed * FEAR_SPEED_MULT)
    } else if (!rooted && dist < AGGRO_RANGE) {
      // ÉLITE (MVP) : skill signature périodique EN PLUS du comportement de base — onde de choc
      // télégraphiée (mêlée) ou salve en éventail (distance). Cadencé à part du reste de l'IA.
      if (this.monster.mvp && t > this.nextEliteSkillAt) {
        this.useEliteSkill()
        this.nextEliteSkillAt = t + ELITE_SKILL_COOLDOWN * this.cadenceMul()
      }
      if (this.monster.behavior === 'charge') {
        // CHARGE LISIBLE : bref télégraphe (planté, on voit le monstre s'armer) → RUÉE rapide.
        if (t < this.windUpUntil) {
          this.setVelocityX(0)
        } else if (t > this.nextActionAt && !this.isCharging) {
          this.attackDir = dir < 0 ? -1 : 1
          this.windUpUntil = t + CHARGE_WINDUP_MS
          this.nextActionAt = t + CHARGE_COOLDOWN * this.cadenceMul()
          this.setVelocityX(0)
          // la ruée part à la fin du télégraphe (annulée si entre-temps piégé/apeuré/mort)
          this.scene.time.delayedCall(CHARGE_WINDUP_MS, () => {
            if (!this.active || this.isRooted() || this.isFeared()) return
            this.isCharging = true
            this.setVelocityX(this.attackDir * this.monster.speed * 3)
            this.scene.time.delayedCall(400, () => { this.isCharging = false })
          })
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
        this.nextActionAt = t + SHOOT_COOLDOWN * this.cadenceMul()
      } else if (this.monster.behavior === 'caster') {
        // garde ses distances : recule si le joueur s'approche, avance s'il fuit
        if (dist < CASTER_KEEP_DIST - 30) this.setVelocityX(-dir * this.monster.speed)
        else if (dist > CASTER_KEEP_DIST + 60) this.setVelocityX(dir * this.monster.speed)
        else this.setVelocityX(0)
        // sort de zone télégraphié sous le joueur
        if (t > this.nextActionAt) {
          this.levelScene.enemyGroundSpell(player.x, this.monster.atk)
          this.nextActionAt = t + CAST_COOLDOWN * this.cadenceMul()
        }
        // + projectile occasionnel pour harceler pendant le rechargement du sort
        if (t > this.nextShootAt) {
          this.fireProjectile()
          this.nextShootAt = t + SHOOT_COOLDOWN * 1.5 * this.cadenceMul()
        }
      } else if (this.monster.behavior !== 'projectile') {
        // 'contact' = MÊLÉE (mobile si speed>0, immobile si speed=0) : avance jusqu'à portée puis
        // joue une VRAIE attaque télégraphiée (wind-up + coup) au lieu de frotter le joueur.
        this.meleeUpdate(t, dist, dir, stopDist)
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

    // GARDE-REBORD UNIVERSELLE (retour user : « des monstres qui se jettent tous dans le trou ») : un
    // mob TERRESTRE (ni aquatique ni volant) ne franchit JAMAIS un bord vers le vide/l'eau mortelle,
    // MÊME EN POURSUITE. La détection de rebord des branches ci-dessus n'agit qu'à l'approche (pas
    // pendant une RUÉE de charge ni un BOND de coup) → on l'impose ici, en dernier ressort, sur la
    // vélocité effective : s'il pousse vers une colonne sans sol au niveau de ses pieds (trou, cascade,
    // cuve marine/lave profonde — floorAt y est faux), on annule sa vitesse horizontale. Il s'arrête au
    // bord et continue de harceler à distance (tirs/sorts inchangés). Aquatiques/volants non concernés.
    if (!this.monster.aquatic) {
      const body = this.body as Phaser.Physics.Arcade.Body
      const vx = body.velocity.x
      if (body.blocked.down && Math.abs(vx) > 5 && !this.floorAhead(Math.sign(vx))) this.setVelocityX(0)
    }

    // RALENTI (Flèches entravantes) : réduit la vélocité effective de la frame, en tout dernier ressort.
    this.applySlowToVelocity()

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
    // le dandinement se REMULTIPLIE par baseScale (gabarit 'grand') pour ne pas écraser l'agrandissement.
    if (Math.abs(vx) > 5) {
      this.setRotation(Math.sin(t / 70) * 0.12)
      this.setScale(this.baseScale, this.baseScale * (1 + 0.04 * Math.sin(t / 70)))
    } else {
      this.setRotation(0)
      if (!this.isCharging) this.setScale(this.baseScale, this.baseScale * (1 + 0.05 * Math.sin(t / 300)))
    }
    // gabarit courant (rendu) pour poser barres/plaques/liserés au bon endroit même sur les 'grand'.
    const hh = this.displayHeight
    const hw = this.displayWidth

    // TÉLÉGRAPHE DE MÊLÉE/CHARGE : arc rouge qui se charge devant le monstre pendant le wind-up, puis
    // éclair de coup (croissant blanc) durant la fenêtre active → « attaquer » devient LISIBLE.
    this.drawMeleeTelegraph(t, hh, hw)

    // "zzz" hors aggro, caché dès que le monstre repère le joueur
    if (dist >= AGGRO_RANGE) {
      // placé bien au-dessus de la plaque « Nv X » (y - hh/2 - 22) pour ne pas la recouvrir
      if (!this.zzz) this.zzz = this.scene.add.text(this.x, this.y - hh / 2 - 42, 'zzz', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)
      this.zzz.setPosition(this.x, this.y - hh / 2 - 42)
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
    this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2, this.y - hh / 2 - 12, w, 5)
    this.bar.fillStyle(0x66bb6a).fillRect(this.x - w / 2, this.y - hh / 2 - 12, w * Math.max(0, this.hp / this.monster.hp), 5)

    // « Nv X » juste au-dessus de la barre de vie ; l'étiquette de rang (ÉLITE/BOSS) au-dessus
    this.lvlText.setPosition(this.x, this.y - hh / 2 - 22)
    this.tierText?.setPosition(this.x, this.y - hh / 2 - 39)

    // liseré d'immobilisation (Piège) : anneau + « chaînes » qui pulsent aux pieds tant que l'effet dure
    if (this.snareFx) {
      if (rooted) {
        this.snareFx.clear()
        const yFeet = this.y + hh / 2 - 4
        const pulse = 0.5 + 0.35 * Math.sin(t / 90)
        this.snareFx.lineStyle(3, 0xffca28, pulse).strokeEllipse(this.x, yFeet, hw * 0.9, 14)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t / 400
          this.snareFx.fillStyle(0xfff59d, pulse).fillCircle(this.x + Math.cos(a) * hw * 0.45, yFeet + Math.sin(a) * 7, 2.5)
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
      this.fearFx.setPosition(this.x + Phaser.Math.Between(-2, 2), this.y - hh / 2 - 34 + Phaser.Math.Between(-2, 2))
      this.fearFx.setAlpha(0.65 + 0.35 * Math.sin(t / 60))
    } else if (this.fearFx) {
      this.fearFx.destroy()
      this.fearFx = null
    }

    // liseré de RALENTI (Flèches entravantes) : anneau bleu givré qui pulse lentement aux pieds
    // tant que l'ennemi est ralenti, puis s'éteint.
    if (this.slowFx) {
      if (this.isSlowed()) {
        this.slowFx.clear()
        const yFeet = this.y + hh / 2 - 4
        const pulse = 0.35 + 0.25 * Math.sin(t / 200)
        this.slowFx.lineStyle(3, 0x4dd0e1, pulse).strokeEllipse(this.x, yFeet, hw * 0.95, 15)
      } else {
        this.slowFx.destroy()
        this.slowFx = null
      }
    }

    // halo d'élite pulsant autour des MVP
    if (this.eliteAura) {
      this.eliteAura.clear()
      const pulse = 0.35 + 0.2 * Math.sin(t / 220)
      this.eliteAura.lineStyle(2, 0xffd54f, pulse).strokeCircle(this.x, this.y, hw * 0.6)
    }
  }

  // Rendu du télégraphe de mêlée/charge : pendant le WIND-UP, un arc rouge se REMPLIT devant le
  // monstre (dans son sens d'attaque) — le joueur voit le coup venir et peut esquiver ; pendant la
  // FENÊTRE ACTIVE, un croissant blanc « fend » l'air. Rien en dehors (graphics nettoyé).
  private drawMeleeTelegraph(t: number, hh: number, hw: number) {
    const winding = this.isWindingUp(t)
    const striking = this.isStriking(t)
    if (!winding && !striking) {
      if (this.meleeFx) { this.meleeFx.destroy(); this.meleeFx = null }
      return
    }
    if (!this.meleeFx) this.meleeFx = this.scene.add.graphics().setDepth(this.depth + 1)
    const g = this.meleeFx
    g.clear()
    const cx = this.x + this.attackDir * hw * 0.4
    const cy = this.y - hh * 0.1
    const r = hw * 0.5
    const a0 = this.attackDir === 1 ? -0.9 : Math.PI - 0.9
    if (winding) {
      // progression du wind-up (0 → 1) : l'arc rouge se remplit et s'intensifie.
      const prog = Phaser.Math.Clamp(1 - (this.windUpUntil - t) / MELEE_WINDUP_MS, 0, 1)
      g.lineStyle(4, 0xff5252, 0.35 + 0.5 * prog)
      g.beginPath()
      g.arc(cx, cy, r, a0, a0 + prog * 1.8)
      g.strokePath()
    } else {
      // coup : croissant blanc franc, épais.
      g.lineStyle(6, 0xffffff, 0.95)
      g.beginPath()
      g.arc(cx, cy, r * 1.15, a0 - 0.3, a0 + 1.9)
      g.strokePath()
    }
  }
}
