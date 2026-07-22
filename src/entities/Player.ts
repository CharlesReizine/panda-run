import Phaser from 'phaser'
import type { StatBlock } from '../core/types'
import type { ControlsState } from '../core/controls'
import { computeStats } from '../core/stats'
import { getPlayer } from '../state'
import { SKILLS } from '../data/skills'
import { ITEMS, rarityColor } from '../data/items'
import { displayedWeaponType, isBigWeapon, weaponTextureKeys } from '../core/equip'
import { PANDA_BODY, PANDA_HEAD_ANCHORS } from './player-body'
import { JUMP_SPEED, RUN_SPEED, GRAVITY } from '../core/platforming'
import { MAX_SKILL_RANK } from '../core/player-state'

const JUMP_VELOCITY = -JUMP_SPEED // source unique (partagée avec le test d'atteignabilité)
const CLIMB_SPEED = 150 // vitesse verticale sur une échelle (up/down)
const CLIMB_STRIDE = 13 // px parcourus entre deux poses du cycle de grimpe (avance au mouvement réel)
const CLIMB_TILT = 6 // légère inclinaison alternée (degrés) pour vendre l'effort de montée
const SWIM_SPEED = 150 // vitesse verticale de nage dans l'eau (up/down)
const SWIM_DRIFT = 40 // léger enfoncement quand on ne nage pas activement
const SWIM_RUN_MULT = 0.7 // déplacement horizontal ralenti dans l'eau
const SWIM_STRIDE = 18 // px parcourus (nage réelle) entre deux poses du cycle de brasse (fige à l'arrêt)
// Échelle du sprite EN EAU : la pose de nage est horizontale ; orientée à la VERTICALE (colonne/puits)
// l'empreinte du sprite = la HAUTEUR du cadre de texture (92 px) qui déborderait d'une colonne de 2
// tuiles (64 px). On réduit donc légèrement l'échelle en eau (92 × 0,68 ≈ 63 px) pour que le nageur
// vertical rentre dans 2 tuiles (vérifié par getBounds sur le moteur réel : bornes ≤ 64 px).
const SWIM_SCALE = 0.68
const MAX_ENERGY = 100
// Régénération PROGRESSIVE (~12,5 s pour refaire la jauge). Volontairement plus lente que
// l'ancien réglage (22/s) : à 22/s la régén sur un cooldown de 2 s (44) dépassait le coût d'un
// skill (10-45) → l'énergie se rechargeait plus vite qu'on ne la dépensait et les skills étaient
// « gratuits ». À 8/s, enchaîner des skills VIDE bel et bien la jauge : l'énergie redevient une
// vraie ressource à gérer.
const ENERGY_REGEN_PER_SEC = 8
const REGEN_COMBAT_LOCK_MS = 3000 // délai « hors combat » après un coup reçu avant que la régén passive reprenne
const ENERGY_PER_BASIC_HIT = 6
const DIVE_SPEED = 1400 // vitesse de piqué vertical du Plongeon (px/s)
// DOUBLE SAUT : n'est plus inné. C'est le SKILL passif 'double-saut' (lignée sabreur) qui l'ouvre.
// Tant qu'il n'est pas appris → 1 seul saut. Appris → 2e saut possible, qui COÛTE de l'énergie et
// dont la hauteur monte avec le rang (petit au rang 1, hauteur du 1er saut au rang max).
const DOUBLE_JUMP_SKILL = 'double-saut'
const DOUBLE_JUMP_ENERGY_COST = 20 // énergie dépensée à chaque saut aérien
const DOUBLE_JUMP_MIN_FRAC = 0.45 // hauteur du 2e saut au rang 1 (fraction du 1er saut)
// VOL ARCANIQUE : skill passif 'vol-arcanique' (désormais lignée SORCIER). Tant qu'il est appris,
// MAINTENIR le saut en l'air fait VOLER le panda (gravité coupée, mouvement libre). Le vol dévore le
// mana très vite : une jauge PLEINE tient exactement (rang) secondes → drain net = maxEnergy / rang
// par seconde (rang 1 = 1 s, rang 2 = 2 s…). À court d'énergie, le vol s'arrête et le panda retombe.
const FLIGHT_SKILL = 'vol-arcanique'
const FLIGHT_VSPEED = 300 // vitesse verticale du vol (montée quand saut tenu, descente sur bas), px/s
// Lignée du sabreur : la GROSSE épée n'est PAS affichée au repos ; elle n'apparaît (agrandie) que
// le temps d'un coup (swingWeapon) ou d'un tourbillon (spinWhirl), puis se rétracte. Les autres
// armes (arc/bâton) restent visibles en permanence. (voir core/equip.isBigWeapon)
// Retour joueur : l'épée du sabreur paraissait ENCORE trop grosse (0,9 × la croissance ×1,36 au
// palier max → ~1,22). On divise la base (0,6) ET on plafonne la croissance par palier (voir
// BIG_SWORD_TIER_GROWTH) pour une lame imposante mais crédible.
const BIG_SWORD_SCALE = 0.6 // agrandissement de base de la grosse épée à l'affichage
// Croissance par palier RÉDUITE pour les grosses épées (les autres armes gardent +12 %/palier) :
// +5 %/palier → au palier max (3) la lame n'enfle que de ~15 %, elle ne redevient pas démesurée.
const BIG_SWORD_TIER_GROWTH = 0.05
const WEAPON_TIER_GROWTH = 0.12 // croissance par palier des armes normales (arc/bâton, inchangé)
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
// Décalage AVANT supplémentaire (px, dans le sens du regard) ajouté à WEAPON_OFFSET_X pour certaines
// classes. Le BÂTON du mage/sorcier est long : au repos comme à l'attaque il doit DÉPASSER devant le
// panda, pas rester collé au corps → on le pousse nettement vers l'avant. Les autres classes gardent
// l'ancrage patte avant standard (0).
const WEAPON_FWD_X: Record<string, number> = { mage: 13, sorcier: 13 }
// Signature visuelle d'arme par CLASSE : échelle de base + couleur de lueur propres. Deux classes à
// silhouette proche (sabreur/chevalier, mage/sorcier, archer/chasseur) restent alors nettement
// distinctes — taille ET couleur de halo. La lueur est un halo additif DERRIÈRE l'arme (elle ne
// salit pas les couleurs de la lame, contrairement à un tint direct que réserve le buff enflammé).
// Pour les grosses épées, `scale` est un FACTEUR appliqué à BIG_SWORD_SCALE (0,9 reste la base) ;
// pour les autres armes c'est l'échelle absolue de la texture.
const WEAPON_STYLE: Record<string, { scale: number; glow: number }> = {
  swordsman: { scale: 1, glow: 0x80d8ff }, // sabre acier, halo cyan vif
  chevalier: { scale: 1.15, glow: 0xffd54f }, // épée de chevalier, plus grande, halo doré noble
  mage: { scale: 1, glow: 0x64b5f6 }, // bâton, halo bleu arcanique
  sorcier: { scale: 1.12, glow: 0xb388ff }, // bâton d'orbe évolué, plus grand, halo violet
  archer: { scale: 1, glow: 0xa5d6a7 }, // arc léger, halo vert discret
  chasseur: { scale: 1.12, glow: 0xffb74d }, // grand arc, halo ambre
}
// Teinte NOBLE du halo au palier max (or blanchi) — l'arme paraît légendaire aux hauts niveaux.
const WEAPON_GLOW_TOP = 0xfff3c4

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
  // ligne d'eau (y du dessus) de la nappe/colonne courante, posée par LevelScene chaque frame. Sert
  // à SORTIR de l'eau : près de la surface, nager vers le haut déclenche une vraie détente (JUMP)
  // qui éjecte le panda hors de l'eau au lieu de le laisser coincé à ras la surface.
  waterSurfaceY = Number.POSITIVE_INFINITY
  // cascade REMONTABLE : dans une colonne de cascade (courant ascendant), on nage sans noyade et un
  // léger courant nous pousse vers le haut → on la « remonte » comme une échelle d'eau.
  inCascade = false
  private climbing = false
  // cycle d'escalade : phase (0/1) alternant deux poses de membres opposés, avancée par la
  // distance verticale réellement parcourue (climbAccum), pas par une horloge → fige à l'arrêt
  private climbPhase = 0
  private climbAccum = 0
  private climbLastY = 0
  // cycle de nage : phase (0/1) alternant nage1/nage2, avancée par la DISTANCE réellement parcourue
  // dans l'eau (swimAccum sur x+y), pas par une horloge → fige à l'arrêt, comme le cycle de grimpe.
  private swimPhase = 0
  private swimAccum = 0
  private swimLastX = 0
  private swimLastY = 0
  private swimming = false
  // Sauts : compteur remis à 0 à l'atterrissage ; front montant de `jump` détecté via jumpWasDown
  // (l'input est maintenu, pas événementiel) → un appui = un saut. maxJumps() = 2 pour la lignée
  // du sabreur (double saut), 1 sinon.
  private jumpsUsed = 0
  private jumpWasDown = false
  // Plongeon : piqué vertical verrouillé déclenché en l'air ; l'atterrissage émet 'player-dive-land'
  // (x, y, hauteur de chute) → LevelScene fait l'explosion proportionnelle à la hauteur.
  diving = false
  private diveStartY = 0
  // VOL DU MAGE : actif tant qu'on maintient le saut en l'air (skill appris + énergie > 0). Gravité
  // coupée pendant le vol ; l'énergie chute vite (voir updateFlight). flightFxAt limite le débit des
  // étincelles arcaniques sous le panda pendant le vol.
  private flying = false
  private flightFxAt = 0
  private flightLastT = 0 // horloge de jeu au dernier tick de vol (drain exact, cohérent avec regenEnergy)
  // Attaque chargée EN L'AIR : pendant le windup, le panda est FIGÉ en hauteur (gravité coupée,
  // vitesse nulle, contrôles ignorés) ; à la fin de la charge on relâche → il retombe (slam).
  private chargeLocked = false
  // Épée enflammée : buff temporaire ; pendant ce temps la lame flambe et les coups brûlent.
  private flameUntil = 0
  private flameTimer: Phaser.Time.TimerEvent | null = null
  // Flèche enflammée (chasseur) : le buff embrase le CORPS du panda (aura de feu) au lieu de la lame.
  private flameBodyAura = false
  // Charge lancière (chevalier) : RUÉE verrouillée — le panda fonce en avant à vitesse imposée le
  // temps de la charge (contrôles ignorés, comme diving/chargeLocked). LevelScene pousse et blesse
  // les ennemis sur la route. Terminée par un timer (endLanceCharge).
  private lancing = false
  private lanceDir: 1 | -1 = 1
  private lanceSpeed = 0
  // MORT HUMILIANTE (one-shot depuis la vie pleine) : le panda est propulsé en cloche à l'opposé de
  // l'attaquant, tournoie, retombe — puis LevelScene affiche le game-over. Contrôles ignorés (physique
  // libre) tant que ça dure.
  ragdolling = false
  private attacking = false
  // Tourbillon : pendant le skill, le panda TOURNE — flipX alterné gauche/droite plusieurs fois sur
  // la durée → illusion de rotation. spinFlip = orientation courante du cycle ; remis au facing réel
  // à la fin. Piloté par un timer, imposé dans updateFromControls/syncOverlays tant que ça tourne.
  private spinUntil = 0
  private spinFlip = false
  private spinTimer: Phaser.Time.TimerEvent | null = null
  private hatImage: Phaser.GameObjects.Image | null = null
  private weaponImage: Phaser.GameObjects.Image | null = null
  // true quand l'arme AFFICHÉE est une grosse épée (lame portée par un épéiste) : masquée au repos,
  // révélée le temps d'un coup / tourbillon. Calculé à chaque refreshWeapon selon l'arme équipée.
  private weaponIsBig = false
  // true quand l'arme AFFICHÉE est un ARC : l'arc reste DROIT/horizontal (aucune inclinaison de repos
  // ni swing d'attaque, contrairement aux épées/bâtons). Calculé à chaque refreshWeapon.
  private weaponIsBow = false
  // Halo de classe derrière l'arme (montée en gamme) : même texture que l'arme, teintée de la couleur
  // de classe, en fondu additif, échelle un peu plus grande → lueur qui suit rigidement l'arme.
  private weaponGlow: Phaser.GameObjects.Image | null = null
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
  // Régénération passive (sabreur) : dernier instant où le panda a été touché + accumulateur de PV
  // fractionnaires. La régén ne coule que hors combat (quelques secondes après le dernier coup).
  private lastDamagedAt = -99999
  private regenAccum = 0
  // Dévotion (chevalier) : garde sacrée temporaire qui RÉDUIT les dégâts subis (guardMult < 1)
  // + aura bleue de bouclier suivie. Purement défensif.
  private guardUntil = 0
  private guardMult = 1
  private guardAura: Phaser.GameObjects.Image | null = null
  private guardTween: Phaser.Tweens.Tween | null = null

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
  }

  // (ré)affiche le chapeau cosmétique équipé (ou le retire si le slot est vide)
  private refreshHat() {
    const hatId = getPlayer().equipment.hat
    this.hatImage?.destroy()
    this.hatImage = hatId ? this.scene.add.image(this.x, this.y + HAT_OFFSET_Y, `cosmetic-${hatId}`).setDepth(this.depth + 1) : null
  }

  // (ré)affiche l'arme ÉQUIPÉE en overlay dans la patte avant (le panda illustré a les mains vides).
  // L'overlay reflète l'OBJET porté (getPlayer().equipment.weapon) : texture procédurale propre à
  // l'objet (`weapon-<itemId>`, silhouette par famille + teinte de rareté), avec repli sur l'arme
  // générique de la classe (`weapon-<cls>`) quand aucun objet n'est équipé. Suivie/mirrorée chaque frame.
  private refreshWeapon() {
    const p = getPlayer()
    const cls = p.classId
    const weaponId = p.equipment.weapon ?? null
    this.weaponImage?.destroy()
    this.weaponGlow?.destroy()
    this.weaponImage = null
    this.weaponGlow = null
    this.weaponIsBig = false
    // arme de l'objet équipé si sa texture existe, sinon arme générique de classe (repli sûr)
    const keys = weaponTextureKeys(cls, weaponId)
    const key = keys.item && this.scene.textures.exists(keys.item) ? keys.item : keys.fallback
    if (!this.scene.textures.exists(key)) return
    const type = displayedWeaponType(cls, weaponId)
    const big = isBigWeapon(cls, type)
    this.weaponIsBig = big
    this.weaponIsBow = type === 'bow'
    const style = WEAPON_STYLE[cls] ?? { scale: 1, glow: 0xffffff }
    const tier = this.weaponTier()
    // échelle : base de classe (les grosses épées partent de BIG_SWORD_SCALE) et AGRANDIE par palier
    // — croissance PLAFONNÉE pour les grosses épées (BIG_SWORD_TIER_GROWTH), normale sinon.
    const base = big ? BIG_SWORD_SCALE * style.scale : style.scale
    const growth = 1 + (big ? BIG_SWORD_TIER_GROWTH : WEAPON_TIER_GROWTH) * tier
    const scale = base * growth
    const w = this.scene.add.image(this.x + WEAPON_OFFSET_X, this.y + WEAPON_OFFSET_Y, key)
      .setOrigin(0.5, 44 / 60).setDepth(this.depth + 1).setScale(scale)
    // halo : n'apparaît qu'à partir du palier 1 et s'intensifie ensuite (montée en gamme). Couleur =
    // RARETÉ de l'objet équipé (distingue deux armes d'un même type), sinon couleur de classe ;
    // teinte dorée noble au palier max. Derrière l'arme (depth − 1), fondu additif, un peu plus grand.
    if (tier >= 1) {
      this.weaponGlow = this.scene.add.image(this.x + WEAPON_OFFSET_X, this.y + WEAPON_OFFSET_Y, key)
        .setOrigin(0.5, 44 / 60).setDepth(this.depth).setScale(scale * 1.25)
        .setTint(this.weaponGlowColor(weaponId, style.glow, tier))
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28 + 0.18 * tier)
    }
    // GROSSE épée MASQUÉE au repos → révélée (halo compris) le temps du balayage / tourbillon.
    if (big) { w.setVisible(false); this.weaponGlow?.setVisible(false) }
    this.weaponImage = w
  }

  // Couleur du halo d'arme : teinte NOBLE au palier max, sinon couleur de la RARETÉ de l'objet
  // équipé (deux armes d'un même type se distinguent), à défaut couleur de la classe.
  private weaponGlowColor(weaponId: string | null, classGlow: number, tier: number): number {
    if (tier >= 3) return WEAPON_GLOW_TOP
    const it = weaponId ? ITEMS[weaponId] : undefined
    if (it && it.slot === 'weapon') return rarityColor(it.rarity)
    return classGlow
  }

  // Palier de « montée en gamme » déduit du NIVEAU perso existant (aucun nouveau système de save).
  // Plus le palier monte, plus l'arme est grande et lumineuse (« de plus en plus badass »).
  private weaponTier(): number {
    const lvl = getPlayer().level
    if (lvl >= 45) return 3
    if (lvl >= 30) return 2
    if (lvl >= 15) return 1
    return 0
  }

  // Recale les overlays sur le panda (appelé en POST_UPDATE, après la synchro physique) : ancrage
  // RIGIDE, aucun lissage/tween. Le panda reste à l'échelle 1 normale (aucune déformation de rendu) ;
  // le chapeau se colle sur l'ancre de tête de la POSE COURANTE (texture affichée) et non sur un
  // offset fixe → il reste collé à la tête dans toutes les poses (idle/course/saut/attaque/échelle).
  private syncOverlays() {
    // garde de fermeture : pendant la sortie de niveau, POST_UPDATE peut encore se déclencher
    // alors que la scène/le corps sont déjà en cours de destruction → accès à this.scene = gel
    if (!this.active || !this.scene || !this.scene.sys) return
    // pendant le tourbillon, chapeau/arme suivent le flip de rotation (pas le facing réel)
    const flip = this.isSpinning() ? (this.spinFlip ? -1 : 1) : this.facing
    if (this.hatImage) {
      const a = PANDA_HEAD_ANCHORS[this.texture.key] ?? { dx: 0, dy: HAT_OFFSET_Y }
      this.hatImage.setPosition(this.x + a.dx * flip, this.y + a.dy)
      this.hatImage.setFlipX(flip === -1)
    }
    if (this.weaponImage) {
      // décalage avant propre à la classe (bâton du mage/sorcier poussé nettement devant le panda)
      const fwd = WEAPON_FWD_X[getPlayer().classId] ?? 0
      const wx = this.x + (WEAPON_OFFSET_X + fwd) * flip
      const wy = this.y + WEAPON_OFFSET_Y
      this.weaponImage.setPosition(wx, wy)
      this.weaponImage.setFlipX(flip === -1)
      // arme tenue en biais dans la patte (pas plantée à la verticale dans la tête) ; l'angle suit
      // le flip pour rester penchée vers l'avant quel que soit le sens du regard
      const tilt = WEAPON_TILT_DEG[getPlayer().classId] ?? 0
      // angle de repos (tilt) + offset de swing d'attaque, le tout mirroré par le flip pour que
      // l'arme fende toujours vers l'avant quel que soit le sens du regard. L'ARC fait EXCEPTION : il
      // reste DROIT/horizontal (rot 0) — pas d'inclinaison de repos ni de swing d'épée au tir.
      const rot = this.weaponIsBow ? 0 : (Phaser.Math.DegToRad(tilt) + this.attackSwing) * flip
      this.weaponImage.setRotation(rot)
      // le halo colle rigidement à l'arme (même position/flip/rotation)
      if (this.weaponGlow) {
        this.weaponGlow.setPosition(wx, wy)
        this.weaponGlow.setFlipX(flip === -1)
        this.weaponGlow.setRotation(rot)
      }
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
    // aura de Dévotion (bouclier bleu) : suit le panda tant que la garde tient, puis s'éteint.
    if (this.guardAura) {
      if (this.scene.time.now >= this.guardUntil) {
        this.guardTween?.remove(); this.guardTween = null
        this.guardAura.destroy(); this.guardAura = null
        this.guardMult = 1
      } else {
        this.guardAura.setPosition(this.x, this.y)
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
  applyAtkBuff(mult: number, durationMs: number, auraColor = 0xffd54f) {
    this.buffMult = mult
    this.buffUntil = this.scene.time.now + durationMs
    if (this.auraImage) this.auraImage.setTint(auraColor) // renouvellement : recolore l'aura selon la classe
    if (!this.auraImage) {
      this.auraImage = this.scene.add.image(this.x, this.y, 'ring')
        .setTint(auraColor).setDepth(this.depth - 1).setAlpha(0.5).setScale(1.7)
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

  // Dévotion (chevalier) : réduit les dégâts SUBIS pendant durationMs (mult < 1) + aura de bouclier.
  applyGuard(mult: number, durationMs: number, color = 0x64b5f6) {
    this.guardMult = mult
    this.guardUntil = this.scene.time.now + durationMs
    if (!this.guardAura) {
      this.guardAura = this.scene.add.image(this.x, this.y, 'ring')
        .setTint(color).setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(1.9)
      this.guardTween = this.scene.tweens.add({
        targets: this.guardAura, scale: 2.4, alpha: 0.8,
        duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      })
    } else {
      this.guardAura.setTint(color)
    }
  }

  // multiplicateur appliqué aux dégâts REÇUS (Dévotion) ; 1 hors garde
  private incomingMult(): number {
    return this.scene.time.now < this.guardUntil ? this.guardMult : 1
  }

  destroy(fromScene?: boolean) {
    this.scene?.events?.off(Phaser.Scenes.Events.POST_UPDATE, this.syncOverlays, this)
    this.swingTween?.remove()
    this.spinTimer?.remove()
    this.flameTimer?.remove()
    this.hatImage?.destroy()
    this.weaponImage?.destroy()
    this.weaponGlow?.destroy()
    this.auraTween?.remove()
    this.auraImage?.destroy()
    this.rageTween?.remove()
    this.rageBlink?.remove()
    this.rageAura?.destroy()
    this.guardTween?.remove()
    this.guardAura?.destroy()
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
    // Grosse épée : n'apparaît QUE pendant le coup (révélée ici, rétractée à la fin du retour au
    // repos). Les autres armes (arc/bâton) restent visibles en permanence.
    const big = this.weaponIsBig
    if (big) { this.weaponImage.setVisible(true); this.weaponGlow?.setVisible(true) }
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
          onComplete: () => { if (big) { this.weaponImage?.setVisible(false); this.weaponGlow?.setVisible(false) } },
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

    // MORT HUMILIANTE : physique LIBRE (vol en cloche + spin posés par beginRagdoll), aucun contrôle.
    if (this.ragdolling) return

    // CHARGE LANCIÈRE : ruée verrouillée — vitesse horizontale imposée, gravité active, pas d'input.
    if (this.lancing) { body.setAllowGravity(true); this.setVelocityX(this.lanceDir * this.lanceSpeed); return }

    // PLONGEON en cours : piqué vertical verrouillé, aucun autre contrôle jusqu'à l'impact.
    if (this.diving) { this.updateDive(body); return }

    // CHARGE AÉRIENNE : figé en hauteur le temps du windup (gravité coupée, immobile), aucun
    // autre contrôle. Relâché par endChargeLock() → la gravité reprend et le panda retombe.
    if (this.chargeLocked) { body.setAllowGravity(false); this.setVelocity(0, 0); return }

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
    // hors eau : rendu neutre (échelle pleine, plus d'orientation de nage) — reset avant la
    // branche eau (qui réimpose l'échelle/l'angle de nage) pour purger l'état à la sortie de l'eau
    if (!this.inWater) { this.setScale(1); this.swimming = false }

    // horizontale (ralentie dans l'eau) — le passif « course rapide » (archer) l'accélère durablement
    const runSpeed = (this.inWater ? RUN_SPEED * SWIM_RUN_MULT : RUN_SPEED) * this.moveSpeedMult()
    if (c.left) { this.setVelocityX(-runSpeed); this.facing = -1; this.setFlipX(true) }
    else if (c.right) { this.setVelocityX(runSpeed); this.facing = 1; this.setFlipX(false) }
    else { this.setVelocityX(0); this.setFlipX(this.facing === -1) } // aligne le flip sur l'orientation (corrige le miroir de grimpe résiduel)

    if (this.inWater) { this.updateSwim(c, body); return }

    // VOL DU MAGE (passif maintenu) : ne s'engage qu'EN L'AIR (le saut au sol part d'abord
    // normalement → petit saut au tap). Tenu en l'air, skill appris et énergie restante → vol libre
    // (gravité coupée) ; ce bloc prend alors la main sur le saut/double-saut ci-dessous.
    if (this.updateFlight(c, body)) return

    // SAUT + DOUBLE SAUT : compteur remis à 0 dès qu'on touche le sol ; on ne consomme un saut
    // que sur le FRONT MONTANT de `jump` (input maintenu). Le 2e saut (aérien) n'existe que si le
    // SKILL 'double-saut' est appris ; il COÛTE de l'énergie (échoue sans réserve suffisante) et
    // part plus bas que le 1er (hauteur qui monte avec le rang).
    if (body.blocked.down) this.jumpsUsed = 0
    const jumpPressed = c.jump && !this.jumpWasDown
    if (jumpPressed && this.jumpsUsed < this.maxJumps()) {
      const airborneJump = this.jumpsUsed >= 1
      // saut aérien = payant : n'a lieu que si l'énergie suffit (sinon rien, on retente en
      // relâchant/réappuyant). Le 1er saut reste gratuit.
      if (!airborneJump || this.spendEnergy(DOUBLE_JUMP_ENERGY_COST)) {
        // 1er saut : hauteur boostée par le passif « saut plus haut » (chasseur) ; 2e saut = double-saut
        this.setVelocityY(airborneJump ? this.secondJumpVelocity() : JUMP_VELOCITY * this.jumpMult())
        this.jumpsUsed += 1
        this.scene.events.emit('player-jump')
        if (airborneJump) this.doubleJumpFx() // souffle bleuté sous les pattes au 2e saut
      }
    }
    this.jumpWasDown = c.jump

    // animations : attaque > saut (en l'air) > course > idle
    if (!this.attacking) {
      if (!body.blocked.down) this.play(this.anim('jump'), true)
      else if (c.left || c.right) this.play(this.anim('run'), true)
      else this.play(this.anim('idle'), true)
    }

    // Tourbillon : la rotation (flipX alterné) prime sur le flip d'orientation tant qu'il tourne
    if (this.isSpinning()) this.setFlipX(this.spinFlip)
  }

  // Tourbillon : fait TOURNER le panda visuellement — alterne flipX gauche↔droite sur la durée du
  // skill (effet de rotation), puis rend l'orientation réelle (facing) à la fin. L'alternance à 60 ms
  // était trop rapide (grésillement illisible) → 150 ms, une rotation lisible. La grosse épée
  // (masquée au repos) est RÉVÉLÉE pendant tout le tourbillon puis rétractée à la fin.
  spinWhirl(durationMs: number) {
    this.spinUntil = this.scene.time.now + durationMs
    this.spinFlip = this.facing === -1
    if (this.weaponIsBig) { this.weaponImage?.setVisible(true); this.weaponGlow?.setVisible(true) }
    this.spinTimer?.remove()
    this.spinTimer = this.scene.time.addEvent({
      delay: 240, loop: true, callback: () => {
        if (!this.isSpinning()) {
          this.spinTimer?.remove(); this.spinTimer = null
          this.setFlipX(this.facing === -1) // retour à l'orientation réelle
          // grosse épée : on la rétracte à la fin du tourbillon (sauf si un coup la garde visible)
          if (this.weaponIsBig && this.attackSwing === 0) { this.weaponImage?.setVisible(false); this.weaponGlow?.setVisible(false) }
          return
        }
        this.spinFlip = !this.spinFlip
        this.setFlipX(this.spinFlip)
      },
    })
  }

  isSpinning(): boolean {
    return this.scene.time.now < this.spinUntil
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
    // SORTIE DE L'EAU : près de la surface, nager vers le haut ÉJECTE le panda hors de l'eau avec une
    // vraie détente (JUMP_VELOCITY) au lieu de la lente vitesse de nage. Sans ça, à la surface la
    // vélocité de nage (~150) était instantanément annulée par la gravité au franchissement → le
    // panda restait coincé à ras l'eau, incapable de sauter dehors. La quille (body.top) doit être
    // proche de la ligne d'eau pour armer la détente → on ne « fuse » pas depuis le fond du bassin.
    const nearSurface = body.top <= this.waterSurfaceY + CLIMB_STRIDE
    if ((c.up || c.jump) && nearSurface && !this.inCascade) { this.setVelocityY(JUMP_VELOCITY); return }
    // cascade : le COURANT POUSSE VERS LE BAS (elle fait tomber). On la REMONTE en maintenant HAUT
    // (grimpe à contre-courant, aucune noyade) ; BAS accélère la descente. Bassin : nage libre.
    if (c.up || c.jump) this.setVelocityY(-SWIM_SPEED)
    else if (c.down) this.setVelocityY(this.inCascade ? SWIM_SPEED * 1.4 : SWIM_SPEED)
    // au repos : cascade = courant DESCENDANT ; bassin = léger enfoncement (flottaison)
    else this.setVelocityY(this.inCascade ? SWIM_SPEED * 0.5 : SWIM_DRIFT)
    this.animateSwim(c, body)
  }

  // NAGE : cycle de brasse nage1↔nage2 (avancé par la distance parcourue, figé à l'arrêt) + le sprite
  // PIVOTE vers la direction de nage d'après la vélocité. La pose d'art est horizontale (panda face à
  // droite) → angle 0 = à plat (lac large) ; nage verticale (colonne/puits/cascade) → orientation ~
  // verticale (empreinte fine, rentre dans 2 tuiles grâce à SWIM_SCALE). flipX gauche/droite conservé.
  // ATTAQUE : override par la pose d'attaque normale (horizontale, face au regard, échelle pleine) +
  // le swing d'arme habituel — pas de conflit avec l'arme. Repli propre sur idle si l'art nage manque.
  private animateSwim(c: ControlsState, body: Phaser.Physics.Arcade.Body) {
    // ATTAQUE EN EAU : pose d'attaque normale, à plat et face au regard, échelle pleine → l'arme
    // (overlay, angle de repos) s'aligne sur le corps. L'anim d'attaque (play, déjà lancée par
    // playAttack) tient la texture ; on se contente de neutraliser l'orientation/échelle de nage.
    if (this.attacking) {
      this.setAngle(0)
      this.setScale(1)
      this.setFlipX(this.facing === -1)
      return
    }
    this.setScale(SWIM_SCALE)
    // entrée dans l'eau : cycle remis à zéro pour ne pas hériter d'une phase/position d'ailleurs
    if (!this.swimming) { this.swimming = true; this.swimPhase = 0; this.swimAccum = 0; this.swimLastX = this.x; this.swimLastY = this.y }
    // avance du cycle par la distance réellement nagée (fige à l'arrêt), comme le cycle de grimpe
    const moved = Math.hypot(this.x - this.swimLastX, this.y - this.swimLastY)
    this.swimLastX = this.x; this.swimLastY = this.y
    const actively = c.left || c.right || c.up || c.down || c.jump
    if (actively) {
      this.swimAccum += moved
      if (this.swimAccum >= SWIM_STRIDE) { this.swimAccum -= SWIM_STRIDE; this.swimPhase ^= 1 }
    }
    const cls = getPlayer().classId
    const key = `panda-${cls}-nage${this.swimPhase === 0 ? 1 : 2}`
    // ORIENTATION : la pose est horizontale (nose vers +x) → on la fait pointer dans le sens de la
    // vélocité. pitch = atan2(vy, |vx|) : 0 à l'horizontale (lac), ±90° à la verticale (colonne).
    // Mirroré par le facing pour que « haut » reste haut quel que soit le sens du regard (flipX).
    const vx = body.velocity.x, vy = body.velocity.y
    const pitch = Math.atan2(vy, Math.max(Math.abs(vx), 1)) // garde-fou : évite atan2(0,0) au repos
    this.anims.stop() // poses de nage pilotées à la main (pas d'horloge d'animation)
    if (this.scene.textures.exists(key)) {
      this.setTexture(key)
      this.setFlipX(this.facing === -1)
      this.setRotation(pitch * this.facing)
      return
    }
    // repli propre : pas d'art de nage → pose idle à plat (aucun crash)
    this.setTexture(`panda-${cls}`)
    this.setFlipX(this.facing === -1)
    this.setAngle(0)
  }

  // rang investi dans le skill passif de double saut (0 = pas appris → pas de 2e saut)
  private doubleJumpRank(): number {
    return getPlayer().skillLevels[DOUBLE_JUMP_SKILL] ?? 0
  }

  // nombre de sauts autorisés : 2 uniquement si le skill 'double-saut' est appris, 1 sinon
  private maxJumps(): number {
    return this.doubleJumpRank() > 0 ? 2 : 1
  }

  // vitesse verticale du 2e saut : modeste au rang 1 (DOUBLE_JUMP_MIN_FRAC du 1er), atteint la
  // pleine hauteur du 1er saut au rang max (interpolation linéaire sur le rang investi)
  private secondJumpVelocity(): number {
    const rank = Phaser.Math.Clamp(this.doubleJumpRank(), 1, MAX_SKILL_RANK)
    const frac = DOUBLE_JUMP_MIN_FRAC + (1 - DOUBLE_JUMP_MIN_FRAC) * ((rank - 1) / (MAX_SKILL_RANK - 1))
    return JUMP_VELOCITY * frac
  }

  // Somme d'un champ de passif APPRIS (rang > 0), cumulé × rang — même logique que computeStats mais
  // pour les passifs de MOUVEMENT lus côté Player (vitesse de course, hauteur de saut, régén d'énergie).
  private passiveSum(sel: (p: NonNullable<(typeof SKILLS)[string]['passive']>) => number | undefined): number {
    let total = 0
    const levels = getPlayer().skillLevels
    for (const id in levels) {
      const rank = levels[id] ?? 0
      if (rank <= 0) continue
      const pas = SKILLS[id]?.passive
      if (pas) total += (sel(pas) ?? 0) * rank
    }
    return total
  }

  // Multiplicateur de vitesse de course : 1 + bonus des passifs « course rapide » (archer). 1 sans passif.
  private moveSpeedMult(): number {
    return 1 + this.passiveSum((p) => p.moveSpeedPct)
  }

  // Multiplicateur de hauteur (vitesse) de saut : 1 + bonus des passifs « saut plus haut » (chasseur).
  private jumpMult(): number {
    return 1 + this.passiveSum((p) => p.jumpBoostPct)
  }

  // Régénération d'énergie par seconde : base + bonus des passifs « régén mana » (mage). Utilisée par
  // regenEnergy ET par la compensation de drain du vol (le vol reste indexé sur le rang, cf. updateFlight).
  private energyRegenPerSec(): number {
    return ENERGY_REGEN_PER_SEC + this.passiveSum((p) => p.energyRegenPerSec)
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

  // rang investi dans le skill de vol du mage (0 = pas appris → saut normal, aucun vol)
  private flightRank(): number {
    return getPlayer().skillLevels[FLIGHT_SKILL] ?? 0
  }

  // Vol du mage : renvoie true quand le vol prend la main sur ce tick (le bloc saut est alors sauté).
  // Conditions : skill appris, EN L'AIR, saut TENU et énergie > 0. Sinon, si on était en train de
  // voler, on coupe le vol (gravité rétablie) et on rend la main au comportement de saut normal.
  private updateFlight(c: ControlsState, body: Phaser.Physics.Arcade.Body): boolean {
    if (this.flightRank() <= 0) { if (this.flying) this.endFlight(body); return false }
    const wantFly = c.jump && !body.blocked.down && this.energy > 0
    if (!wantFly) { if (this.flying) this.endFlight(body); return false }
    const now = this.scene.time.now
    if (!this.flying) { this.flying = true; this.flightLastT = now } // 1er tick : pas de drain (dt inconnu)
    body.setAllowGravity(false)
    // Drain : jauge PLEINE vidée en (rang) secondes → maxEnergy / rang par seconde. La scène ajoute
    // ENERGY_REGEN_PER_SEC chaque frame ; on le compense ici pour que le drain NET reste exactement
    // maxEnergy / rang par seconde (rang 1 = 1 s, rang 2 = 2 s, …). dt lu sur l'horloge de jeu
    // (même base de temps que regenEnergy) → drain indépendant du framerate.
    const rank = Phaser.Math.Clamp(this.flightRank(), 1, MAX_SKILL_RANK)
    const dt = Phaser.Math.Clamp((now - this.flightLastT) / 1000, 0, 0.1) // clamp anti-spike (lag/pause)
    this.flightLastT = now
    const drainPerSec = this.maxEnergy / rank + this.energyRegenPerSec()
    this.energy = Math.max(0, this.energy - drainPerSec * dt)
    // vertical : monte tant que le saut est tenu, descend sur bas ; horizontal déjà posé (bloc course)
    this.setVelocityY(c.down ? FLIGHT_VSPEED : -FLIGHT_VSPEED)
    if (!this.attacking) this.play(this.anim('jump'), true)
    this.jumpWasDown = c.jump // consomme le front : pas de saut parasite quand le vol s'arrête
    this.flightFx()
    return true
  }

  // fin de vol : gravité rétablie → le mage retombe (relâchement du saut ou énergie à 0)
  private endFlight(body: Phaser.Physics.Arcade.Body) {
    this.flying = false
    body.setAllowGravity(true)
  }

  // étincelles arcaniques violettes sous le panda pendant le vol (débit limité pour rester léger)
  private flightFx() {
    const now = this.scene.time.now
    if (now < this.flightFxAt) return
    this.flightFxAt = now + 70
    const y = this.y + PANDA_BODY.h / 2
    const sp = this.scene.add.rectangle(this.x + Phaser.Math.Between(-10, 10), y, 3, 8, 0xb388ff)
      .setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9)
    this.scene.tweens.add({ targets: sp, y: y + Phaser.Math.Between(12, 22), alpha: 0, duration: 300, ease: 'Sine.out', onComplete: () => sp.destroy() })
  }

  // Attaque chargée : si le panda est EN L'AIR, on le FIGE en hauteur (gravité coupée, vitesse
  // nulle) le temps de la charge. Renvoie true si le lock a été posé (en l'air), false au sol
  // (comportement de charge au sol inchangé). L'anim d'attaque est tenue pendant la charge.
  beginAirChargeLock(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (this.diving || body.blocked.down) return false
    this.chargeLocked = true
    body.setAllowGravity(false)
    this.setVelocity(0, 0)
    this.play(this.anim('attack'), true)
    return true
  }

  // Fin de la charge aérienne : la gravité reprend → le panda retombe (slam). No-op si pas verrouillé.
  endChargeLock() {
    if (!this.chargeLocked) return
    this.chargeLocked = false
    ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)
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
      this.scene.events.emit('player-dive-land', this.x, this.y, fall)
    }
  }

  // Épée enflammée : embrase la lame pour un temps donné → flammes visibles sur l'arme et
  // brûlure appliquée par les coups (test isFlaming côté LevelScene).
  // `bodyAura` (chasseur — flèche enflammée) : le buff embrase le CORPS du panda (aura de feu) au lieu
  // de la lame ; les flèches tirées portent une flammèche à leur pointe (côté LevelScene).
  applyFlameBuff(durationMs: number, bodyAura = false) {
    this.flameUntil = this.scene.time.now + durationMs
    this.flameBodyAura = bodyAura
    if (!bodyAura) this.weaponImage?.setTint(0xff7043)
    if (!this.flameTimer) {
      this.flameTimer = this.scene.time.addEvent({ delay: 55, loop: true, callback: () => this.emitFlame() })
    }
  }

  isFlaming(): boolean {
    return this.scene.time.now < this.flameUntil
  }

  // flammèche qui monte LE LONG DE LA LAME tant que le buff est actif ; s'auto-éteint à l'échéance.
  // Le feu est échantillonné du grip vers la pointe (selon l'angle/échelle courants de l'épée) →
  // c'est l'ÉPÉE qui brûle, jamais le corps du panda. N'émet que quand la lame est visible (donc,
  // pour la grosse épée du sabreur, uniquement pendant le coup).
  private emitFlame() {
    if (!this.isFlaming()) {
      this.flameTimer?.remove(); this.flameTimer = null
      this.weaponImage?.clearTint()
      return
    }
    // buff chasseur : embrasement du CORPS (aura de feu autour du panda), pas de flamme d'arme
    if (this.flameBodyAura) { this.emitBodyFlame(); return }
    const w = this.weaponImage
    if (!w || !w.visible) return
    // direction « vers la pointe » = (0,-1) local pivoté par la rotation courante de l'arme
    const rot = w.rotation
    const bladeLen = 40 * w.scaleY // longueur grip→pointe à l'échelle d'affichage
    const t = Phaser.Math.FloatBetween(0.2, 1)
    const fx = w.x + Math.sin(rot) * bladeLen * t + Phaser.Math.Between(-4, 4)
    const fy = w.y - Math.cos(rot) * bladeLen * t + Phaser.Math.Between(-4, 4)
    const col = Phaser.Math.RND.pick([0xffca28, 0xff7043, 0xff5252])
    const fl = this.scene.add.rectangle(fx, fy, 5, 11, col).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95)
    this.scene.tweens.add({ targets: fl, y: fy - Phaser.Math.Between(14, 24), scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: 280, ease: 'Sine.out', onComplete: () => fl.destroy() })
  }

  // Embrasement du CORPS (buff flèche enflammée du chasseur) : langues de feu minuscules qui montent
  // tout autour du panda — aura de feu (pas une flamme d'arme).
  private emitBodyFlame() {
    const bx = this.x + Phaser.Math.Between(-14, 14)
    const by = this.y + Phaser.Math.Between(-6, Math.round(PANDA_BODY.h / 2))
    const col = Phaser.Math.RND.pick([0xffca28, 0xff7043, 0xff5252])
    const fl = this.scene.add.rectangle(bx, by, Phaser.Math.Between(4, 7), Phaser.Math.Between(9, 15), col)
      .setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).setOrigin(0.5, 1)
    this.scene.tweens.add({ targets: fl, y: by - Phaser.Math.Between(16, 26), scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: 300, ease: 'Sine.out', onComplete: () => fl.destroy() })
  }

  // CHARGE LANCIÈRE (chevalier) : verrouille les contrôles et impose une RUÉE horizontale à `speed`
  // px/s dans `dir` le temps de la charge (gravité active → le panda longe le sol). Fin par endLanceCharge.
  beginLanceCharge(dir: 1 | -1, speed: number) {
    this.lancing = true
    this.lanceDir = dir
    this.lanceSpeed = speed
    this.facing = dir
    this.setFlipX(dir === -1)
    this.play(this.anim('attack'), true)
  }

  endLanceCharge() {
    if (!this.lancing) return
    this.lancing = false
    this.setVelocityX(0)
  }

  isLancing(): boolean {
    return this.lancing
  }

  // MORT HUMILIANTE : propulse le panda en cloche à l'OPPOSÉ de l'attaquant (dirX) + spin, gravité
  // active (il retombe et peut rebondir sur le sol). Les contrôles sont ignorés (physique libre)
  // jusqu'à ce que LevelScene affiche le game-over. `apogeeH` = hauteur d'apogée voulue (px) →
  // v = sqrt(2·g·h).
  beginRagdoll(dirX: 1 | -1, apogeeH: number) {
    this.ragdolling = true
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    const v = Math.sqrt(2 * GRAVITY * Math.max(1, apogeeH))
    this.setVelocity(dirX * Phaser.Math.Between(220, 300), -v)
    body.setAngularVelocity(dirX * 520)
  }

  takeDamage(amount: number) {
    amount = Math.max(0, Math.round(amount * this.incomingMult())) // Dévotion : dégâts subis réduits
    this.hp = Math.max(0, this.hp - amount)
    this.lastDamagedAt = this.scene.time.now // suspend la régén passive un court instant (hors combat)
    this.setTint(0xff5555)
    this.scene.time.delayedCall(100, () => this.clearTint())
    this.emitHp()
  }

  // Régénération PASSIVE (sabreur) : rend `perSec` PV/s, mais uniquement hors combat (aucun coup reçu
  // depuis REGEN_COMBAT_LOCK_MS). Accumule les PV fractionnaires pour rester fluide à bas taux.
  passiveRegen(deltaMs: number, perSec: number) {
    if (perSec <= 0 || this.hp <= 0 || this.hp >= this.stats.maxHp) return
    if (this.scene.time.now < this.lastDamagedAt + REGEN_COMBAT_LOCK_MS) return
    this.regenAccum += (perSec * deltaMs) / 1000
    if (this.regenAccum >= 1) {
      const whole = Math.floor(this.regenAccum)
      this.regenAccum -= whole
      this.heal(whole)
    }
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
    // base + passif « régén mana » (mage) : la régénération d'énergie s'accélère tant qu'il est appris
    this.gainEnergy((this.energyRegenPerSec() * deltaMs) / 1000)
  }

  private emitHp() {
    this.scene.events.emit('player-hp', this.hp, this.stats.maxHp)
  }
}

export const ENERGY_ON_BASIC_HIT = ENERGY_PER_BASIC_HIT
