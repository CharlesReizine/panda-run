import Phaser from 'phaser'
import { LEVELS, type LevelDef } from '../data/levels'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'
import { Prop } from '../entities/Prop'
import { FlameWall } from '../entities/FlameWall'
import { MONSTERS } from '../data/monsters'
import { PROPS } from '../data/props'
import { MATERIALS } from '../data/materials'
import { ITEMS, rarityColor } from '../data/items'
import { physicalDamage, inMeleeReach } from '../core/combat'
import { grantXp } from '../core/progression'
import { emptyControls, mergeControls, type ControlsState } from '../core/controls'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { CooldownTracker, energyCostOf } from '../core/skill-executor'
import { ENERGY_ON_BASIC_HIT } from '../entities/Player'
import { SKILLS } from '../data/skills'
import { rollDrops } from '../core/loot'
import type { DropEntry, SkillDef } from '../core/types'
import type { UIScene } from './UIScene'
import { TILE, DEFAULT_HEIGHT_TILES, groundRowFor, GRAVITY, landsOnOneWayPlatform } from '../core/platforming'
import { BIOMES } from '../data/biomes'
import { audio, type MusicTrack } from '../audio/audio-engine'

// biomes → piste musicale ; 'carriere' n'a pas d'ambiance dédiée → repli sur 'montagne'
const BIOME_TRACKS: Record<string, MusicTrack> = {
  plaine: 'plaine', foret: 'foret', desert: 'desert', cave: 'cave', jungle: 'jungle',
  montagne: 'montagne', plage: 'plage', carriere: 'montagne', cimetiere: 'cimetiere', enfer: 'enfer',
}

// largeur de la barre de vie du boss (centrée sous son nom)
const BOSS_BAR_W = 440

// Plongée sous l'eau : le panda peut s'enfoncer sous la surface (traversée verticale), mais tant
// que sa TÊTE reste immergée il retient son souffle un court instant (apnée) puis se noie
// PROGRESSIVEMENT — jamais de mort instantanée. Le souffle se recharge dès qu'il ressort la tête.
const BREATH_MAX_MS = 1800 // délai de grâce d'apnée avant que la noyade douce ne commence
const BREATH_RECHARGE_MULT = 3 // le souffle se recharge 3× plus vite qu'il ne se vide (retour surface = répit rapide)
const DROWN_DPS = 7 // PV perdus par seconde une fois le souffle épuisé (traversée courte = sûre)
const DROWN_TICK_MS = 250 // cadence des ticks de noyade : perte régulière, jamais d'un coup
const BUBBLE_INTERVAL_MS = 170 // intervalle d'émission des bulles tant que la tête est sous l'eau
// LAVE (enfer) : cuve de pierre incandescente, MORTELLE au contact. On ne nage pas dedans — le contact
// inflige de gros dégâts continus (chemin de dégâts standard, cf. drownTick) → y tomber tue vite.
const LAVA_DPS = 120 // PV perdus par seconde au contact de la lave (bien plus violent que la noyade)
const LAVA_TICK_MS = 150 // cadence des ticks de brûlure : perte rapide et régulière

export { TILE }

export class LevelScene extends Phaser.Scene {
  player!: Player
  enemies!: Phaser.Physics.Arcade.Group
  enemyProjectiles!: Phaser.Physics.Arcade.Group
  playerProjectiles!: Phaser.Physics.Arcade.Group
  pickups!: Phaser.Physics.Arcade.Group
  props!: Phaser.Physics.Arcade.Group
  // Murs de flamme (Mage/Sorcier) : barrières statiques temporaires qui bloquent + brûlent les ennemis
  private flameWalls!: Phaser.Physics.Arcade.StaticGroup
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private oneWayPlatforms!: Phaser.Physics.Arcade.StaticGroup
  private ladderRects: Phaser.Geom.Rectangle[] = []
  private waterRects: Phaser.Geom.Rectangle[] = []
  // rideaux de cascade (water:'waterfall') : défilés verticalement dans update pour l'effet de chute
  private waterfalls: Phaser.GameObjects.TileSprite[] = []
  // CASCADES REMONTABLES (water:'cascade') : colonnes d'eau CLAIRE en cuve, à courant ASCENDANT — on
  // les remonte comme une échelle sans jamais se noyer (distinctes des bassins marine). Zones de
  // contact (cascadeRects) + rideaux défilés vers le HAUT (cascadeSprites).
  private cascadeRects: Phaser.Geom.Rectangle[] = []
  private cascadeSprites: Phaser.GameObjects.TileSprite[] = []
  // CUVES DE LAVE (water:'lave', enfer) : zones de contact MORTELLES (brûlure continue, cf. updateLava).
  private lavaRects: Phaser.Geom.Rectangle[] = []
  private lavaAccumMs = 0
  // Plongée : réserve d'apnée restante (ms), accumulateurs de ticks de noyade et d'émission de
  // bulles, voile bleuté quand la tête est immergée, petite jauge d'apnée au-dessus de la tête.
  private breathMs = BREATH_MAX_MS
  private drownAccumMs = 0
  private bubbleAccumMs = 0
  private submergeVeil: Phaser.GameObjects.Rectangle | null = null
  private breathBarBg: Phaser.GameObjects.Rectangle | null = null
  private breathBar: Phaser.GameObjects.Rectangle | null = null
  // Géométrie verticale du monde courant : rangée de sol (bas du monde) et hauteur en pixels.
  // Recalculées à chaque niveau depuis levelDef.heightTiles (défaut 16 → groundRow 14, monde 540).
  private groundRow = groundRowFor()
  private worldH = DEFAULT_HEIGHT_TILES * TILE
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
  // Plongeon : paramètres d'explosion réservés au lancer, consommés à l'atterrissage
  // ('player-dive-land') → dégâts/rayon proportionnels à la hauteur de chute.
  private pendingDive: { range: number; mult: number; color: number } | null = null
  // Visée de zone (infra partagée archer/mage) : mode de ciblage actif. Le jeu ne se fige pas ;
  // un réticule suit le doigt/la souris, le tap suivant valide la zone, un bouton (ou ÉCHAP) annule.
  private aim: {
    slot: number; skill: SkillDef
    reticle: Phaser.GameObjects.Container
    ui: Phaser.GameObjects.GameObject[]
    cancelAt: { x: number; y: number }
  } | null = null

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
    this.waterfalls = []
    this.cascadeRects = []
    this.cascadeSprites = []
    this.lavaRects = []
    this.lavaAccumMs = 0
    // plongée : on entame chaque niveau souffle plein, sans dette de noyade ; les overlays
    // (voile, jauge) sont recréés plus bas (la scène est réutilisée → références remises à zéro)
    this.breathMs = BREATH_MAX_MS
    this.drownAccumMs = 0
    this.bubbleAccumMs = 0
    this.submergeVeil = null
    this.breathBarBg = null
    this.breathBar = null

    // hauteur de monde paramétrable : le sol reste au BAS (groundRow), la caméra scrolle en
    // vertical dès que le monde dépasse la hauteur du viewport (540)
    this.groundRow = groundRowFor(this.levelDef.heightTiles)
    // au moins la hauteur du viewport (540) pour que les mondes « défaut 16 » se comportent
    // EXACTEMENT comme avant (bounds 540, caméra verrouillée) ; les mondes hauts dépassent 540 et
    // déclenchent le scroll vertical.
    this.worldH = Math.max(540, (this.levelDef.heightTiles ?? DEFAULT_HEIGHT_TILES) * TILE)
    const widthPx = this.levelDef.widthTiles * TILE
    this.physics.world.setBounds(0, 0, widthPx, this.worldH)

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
    // trous MORTELS : aux colonnes couvertes par un gap, on NE POSE PAS les tuiles de sol
    // pleines (rangées groundRow/+1) → c'est le vide, et tomber dedans tue (voir checkPitDeath).
    const isGapCol = (x: number) => (this.levelDef.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
    // OPTIM RENDU : le sol/les plateformes/l'eau étaient dessinés TUILE PAR TUILE (des milliers de
    // this.add.image). On rend désormais chaque tranche continue en UN SEUL TileSprite (le culling
    // caméra de Phaser reste actif) et on regroupe la COLLISION en UN corps statique rectangulaire
    // par tranche. La collision est STRICTEMENT équivalente : le corps couvre exactement la même
    // emprise (même bord SUPÉRIEUR, seule surface qui compte pour se poser) que la ribambelle de
    // tuiles qu'il remplace → aucun changement de comportement (pas de chute à travers le sol).
    // SOL : tuiles historiquement posées à y = groundRow*TILE+TILE (centre) → dessus à
    // groundRow*TILE+TILE/2. On reproduit EXACTEMENT cette emprise (2 rangées) par tranche continue.
    const groundTopPx = this.groundRow * TILE + TILE / 2
    const groundBandH = 2 * TILE
    // tranches continues de sol (colonnes hors trou), [a, b)
    let runA = -1
    const W = this.levelDef.widthTiles
    for (let x = 0; x <= W; x++) {
      const solid = x < W && !isGapCol(x)
      if (solid) { if (runA < 0) runA = x }
      else if (runA >= 0) {
        const wTiles = x - runA
        // rendu : une bande tuilée (2 rangées), calée au pixel comme les anciennes tuiles
        this.add.tileSprite(runA * TILE, groundTopPx, wTiles * TILE, groundBandH, tileKey).setOrigin(0, 0).setDepth(-4)
        // collision : un corps statique rectangulaire équivalent (même dessus, même largeur)
        this.addStaticBand(platforms, runA * TILE, groundTopPx, wTiles * TILE, groundBandH)
        runA = -1
      }
    }
    // bords de trou marqués : le sol s'arrête NET sur une fine paroi sombre → le danger se voit
    // avant d'y arriver. Les trous CONTIGUS sont FUSIONNÉS en un seul grand trou (plus de barre
    // verticale entre deux trous voisins) : on ne dessine la paroi qu'aux EXTRÉMITÉS extérieures du
    // trou global. Les colonnes couvertes par une CASCADE (eau qui coule dans le vide) sont exclues :
    // c'est l'eau qui signale le vide, pas une paroi sombre.
    const cascadeRanges = (this.levelDef.hazards ?? [])
      .filter((h) => h.kind === 'water' && h.water === 'cascade')
      .map((h) => ({ x: h.x, end: h.x + h.w }))
    const sortedGaps = [...(this.levelDef.gaps ?? [])].sort((a, b) => a.x - b.x)
    const mergedGaps: { x: number; end: number }[] = []
    for (const g of sortedGaps) {
      const last = mergedGaps[mergedGaps.length - 1]
      if (last && g.x <= last.end) last.end = Math.max(last.end, g.x + g.w)
      else mergedGaps.push({ x: g.x, end: g.x + g.w })
    }
    for (const m of mergedGaps) {
      if (cascadeRanges.some((c) => m.x >= c.x && m.end <= c.end)) continue
      const topY = this.groundRow * TILE + TILE / 2
      const wallH = 2 * TILE
      this.add.rectangle(m.x * TILE, topY, 4, wallH, 0x0c0c12, 0.85).setOrigin(1, 0).setDepth(-3)
      this.add.rectangle(m.end * TILE, topY, 4, wallH, 0x0c0c12, 0.85).setOrigin(0, 0).setDepth(-3)
    }
    // plateformes surélevées : on les traverse en montant et on se pose dessus en retombant (voir
    // landsFromAbove). Rendu en UN TileSprite par plateforme ; collision en UN corps statique par
    // plateforme (dessus à p.y*TILE, hauteur 1 tuile) — équivalent exact des anciennes tuiles.
    for (const p of this.levelDef.platforms) {
      this.add.tileSprite(p.x * TILE, p.y * TILE, p.w * TILE, TILE, platformKey).setOrigin(0, 0).setDepth(-4)
      this.addStaticBand(oneWay, p.x * TILE, p.y * TILE, p.w * TILE, TILE)
    }
    // ponts de planches : plateformes fines, elles aussi traversables par le bas. Rendu en UN
    // TileSprite ; collision en UN corps statique par pont. Le visuel ne fait que 12px de haut mais
    // à grande vitesse de chute le joueur pourrait traverser cette fine tranche en un pas de
    // physique (tunneling) → on épaissit le corps (28px) sans toucher au rendu.
    for (const br of this.levelDef.bridges ?? []) {
      this.add.tileSprite(br.x * TILE, br.y * TILE, br.w * TILE, 12, 'bridge').setOrigin(0, 0).setDepth(-4)
      // corps 28px (le visuel ne fait que 12px) : même emprise que l'ancien plank (top br.y*TILE-8)
      this.addStaticBand(oneWay, br.x * TILE, br.y * TILE - 8, br.w * TILE, 28)
    }
    // BANDES DE ROCHE (plafond de tunnel + socle de départ) : dalles de pierre PLEINE rendues avec la
    // texture du biome, SANS collision (depth -5, derrière le joueur → il reste toujours visible ; le
    // dégagement sous un plafond est garanti > saut confortable côté assembleur, donc on ne se cogne
    // jamais). Referment visuellement les tunnels (roche dessus + sol/roche dessous) et masquent le
    // dessous de la bande de départ (mesa) → un seul niveau au spawn. Distinct du plafond du MONDE.
    for (const rb of this.levelDef.rockBands ?? []) {
      this.add.tileSprite(rb.x * TILE, rb.y * TILE, rb.w * TILE, rb.h * TILE, tileKey).setOrigin(0, 0).setDepth(-5)
    }

    // départ : sur la corniche `start` (mi-hauteur) si le niveau en définit une, sinon au sol,
    // bord gauche (comportement historique). Le -40 pose les PIEDS sur le dessus de la corniche.
    const start = this.levelDef.start
    const startX = start ? start.x * TILE + TILE / 2 : this.spawnX()
    const startY = (start ? start.y : this.groundRow) * TILE - 40
    this.player = new Player(this, startX, startY)
    // PLAFOND TRAVERSABLE (fini le rebond) : en Phaser 4, la collision aux bornes du monde est
    // arbitrée par world.checkCollision (GLOBAL, partagé avec les ennemis) — désactiver le bord
    // haut du joueur via body.checkCollision.up ne suffit donc pas. On donne au JOUEUR un
    // rectangle de bornes PERSONNEL identique au monde en bas/gauche/droite mais dont le HAUT est
    // repoussé très au-dessus (y négatif) : le panda peut monter au-dessus du haut du monde sans
    // rebondir puis retomber, tandis que les ennemis gardent les bornes standard.
    ;(this.player.body as Phaser.Physics.Arcade.Body).setBoundsRectangle(
      new Phaser.Geom.Rectangle(0, -10000, widthPx, this.worldH + 10000),
    )
    this.physics.add.collider(this.player, platforms)
    // collision one-way : validée seulement quand le panda retombe sur le dessus
    this.physics.add.collider(this.player, oneWay, undefined, this.landsFromAbove)

    this.enemies = this.physics.add.group()
    this.physics.add.collider(this.enemies, platforms)
    this.physics.add.collider(this.enemies, oneWay)

    // Murs de flamme : groupe statique. Collider → les ennemis butent dessus (passage bloqué) ;
    // overlap → tout ennemi au contact prend une brûlure. Les membres détruits quittent le groupe.
    this.flameWalls = this.physics.add.staticGroup()
    this.physics.add.collider(this.enemies, this.flameWalls)
    this.physics.add.overlap(this.enemies, this.flameWalls, (eObj, wObj) => {
      const e = eObj as Enemy, w = wObj as FlameWall
      if (e.active) e.applyBurn(w.dmgPerTick, 900)
    })

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
      // s.y présent → monstre posé sur une corniche en hauteur (pieds sur son dessus) ; sinon au sol.
      const yTile = s.y ?? this.groundRow
      this.enemies.add(new Enemy(this, s.x * TILE, yTile * TILE - 40, MONSTERS[s.monsterId]!))
    }

    // le groupe applique ses defaults (allowGravity: true, immovable: false) à chaque ajout et
    // écraserait sinon les setAllowGravity(false)/setImmovable(true) posés dans Prop — sans ça,
    // un coffre "tombe" (gravité réactivée) dès qu'il rejoint le groupe
    this.props = this.physics.add.group({ allowGravity: false, immovable: true })
    for (const propDef of this.levelDef.props ?? []) {
      const yTile = propDef.y ?? this.groundRow - 1
      const prop = new Prop(this, propDef.x * TILE + TILE / 2, yTile * TILE + TILE / 2, PROPS[propDef.kind]!)
      this.props.add(prop)
      // les coffres attirent l'œil : petit rebond + éclat régulier
      if (propDef.kind === 'coffre') {
        this.tweens.add({ targets: prop, y: prop.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
        const glint = this.add.text(prop.x, prop.y - 22, '✦', { fontSize: '16px', color: '#fff59d' }).setOrigin(0.5)
        this.tweens.add({ targets: glint, alpha: 0.2, scale: 1.4, duration: 600, yoyo: true, repeat: -1 })
      }
    }

    // pics = danger mortel ; eau = plan d'eau (bassin contenu / cascade / nappe libre héritée)
    const spikes = this.physics.add.staticGroup()
    // PAROIS RIGIDES des bassins : corps statiques (un par paroi) qu'on ne traverse PAS en
    // marchant. Collision avec le joueur ET les ennemis. La nage se fait EN DESCENDANT par le HAUT.
    const basinWalls = this.physics.add.staticGroup()
    for (const hz of this.levelDef.hazards ?? []) {
      if (hz.kind === 'spikes') {
        // PICS EN HAUTEUR : `hz.top` = rangée de la surface qui porte les pics (dessus d'une corniche).
        // Absent → pics au SOL (comportement historique EXACT : groundTopPx - 8 = groundRow*TILE + 8).
        // Les pics sont posés SUR la surface (base au dessus de la corniche, pointes vers le haut).
        const surfaceTopPx = hz.top !== undefined ? hz.top * TILE : groundTopPx
        for (let i = 0; i < hz.w; i++) {
          spikes.create((hz.x + i) * TILE + TILE / 2, surfaceTopPx - 8, 'spikes')
        }
        continue
      }
      // EAU. top = rangée de surface, h = profondeur (rangées). Sans top/h → ancienne bande près du
      // sol (rétrocompat exacte). hz.water choisit la FORME : 'basin' (puits à parois rigides + déco
      // de fond), 'waterfall' (cascade à source visible), sinon nappe libre héritée (aucun mur).
      const waterTop = hz.top ?? this.groundRow - 2
      const waterBottom = hz.h !== undefined ? waterTop + hz.h - 1 : this.groundRow + 1
      const xPx = hz.x * TILE
      const wPx = hz.w * TILE
      const topPx = waterTop * TILE
      const heightPx = (waterBottom + 1 - waterTop) * TILE

      if (hz.water === 'waterfall') {
        // CASCADE : rideau d'eau tuilé qu'on fait défiler vers le bas (update) + source rocheuse
        // visible en haut d'où l'eau jaillit. Immersion douce (traversée courte, jamais mortelle).
        const fall = this.add.tileSprite(xPx, topPx, wPx, heightPx, 'waterfall').setOrigin(0, 0).setDepth(-2)
        this.waterfalls.push(fall)
        this.add.image(xPx + wPx / 2, topPx, 'waterfall-source').setOrigin(0.5, 0.75).setDepth(-1)
        // bassin d'écume au pied de la chute
        this.add.ellipse(xPx + wPx / 2, waterBottom * TILE + TILE, wPx + 20, 16, 0xe3f2fd, 0.4).setDepth(-1)
        this.waterRects.push(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))
        continue
      }

      if (hz.water === 'cascade') {
        // CASCADE REMONTABLE : colonne d'EAU CLAIRE qui COULE — AUCUNE pierre, aucun cadre, aucune
        // cuve. On la remonte comme une échelle SANS jamais se noyer (cascadeRects, distinct des
        // bassins marine). Le rideau DÉFILE vers le bas (écoulement visible, cf. update). L'eau
        // descend jusqu'au BAS DE LA CARTE au-dessus du VIDE (h porté jusqu'à worldH par
        // l'assembleur) → y descendre jusqu'au fond = chute mortelle (checkPitDeath).
        const col = this.add.tileSprite(xPx, topPx, wPx, heightPx, 'waterfall').setOrigin(0, 0).setDepth(-2).setTint(0xa9e8ff).setAlpha(0.82)
        this.cascadeSprites.push(col)
        this.cascadeRects.push(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))
        // HAUT ONDULÉ : au lieu d'une ligne droite, un chapelet de bulbes d'écume qui montent et
        // descendent en décalé → vagues + remous animés en tête de cascade (là où l'eau jaillit et
        // où l'on émerge). Chaque bulbe oscille en boucle autour du bord supérieur.
        const foamN = Math.max(3, Math.round(wPx / 11))
        for (let i = 0; i < foamN; i++) {
          const fx = xPx + (i + 0.5) * (wPx / foamN)
          const foam = this.add.ellipse(fx, topPx, 13, 9, 0xffffff, 0.72).setDepth(-1)
          this.tweens.add({
            targets: foam, y: topPx - 6, scaleX: 1.35, scaleY: 0.55,
            duration: 380 + (i % 3) * 110, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 130,
          })
        }
        continue
      }

      if (hz.water === 'lave') {
        // CUVE DE LAVE (enfer) : cuve de PIERRE (parois rigides identiques au bassin) remplie de lave
        // ROUGE/ORANGE incandescente. MORTELLE au contact (lavaRects → brûlure continue) : on ne nage
        // PAS dedans. Corps OPAQUE (rectangle molten posé en fond, derrière ponts/plateformes) surmonté
        // d'ondulations (texture 'water' teintée) + croûte incandescente + lueur ADD + bulles qui crèvent.
        this.add.rectangle(xPx, topPx, wPx, heightPx, 0xd8380f, 1).setOrigin(0, 0).setDepth(-6) // corps de lave opaque
        this.add.tileSprite(xPx, topPx, wPx, heightPx, 'water').setOrigin(0, 0).setDepth(-3).setTint(0xff5a1e).setAlpha(0.7)
        this.add.rectangle(xPx, topPx, wPx, 6, 0xffd24a, 0.9).setOrigin(0, 0).setDepth(-1) // croûte incandescente en surface
        const glow = this.add.rectangle(xPx + wPx / 2, topPx, wPx, 30, 0xff7a1e, 0.4)
          .setOrigin(0.5, 0).setDepth(-1).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: glow, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
        // parois de pierre (cuve) — mêmes corps rigides que le bassin marine
        for (const wx of [hz.x - 1, hz.x + hz.w]) {
          if (wx < 0 || wx >= this.levelDef.widthTiles) continue
          this.add.tileSprite(wx * TILE, topPx, TILE, heightPx, 'basin-wall').setOrigin(0, 0).setDepth(-2)
          const collideTopPx = (waterTop + 1) * TILE
          const collideH = (waterBottom + 1) * TILE - collideTopPx
          this.addStaticBand(basinWalls, wx * TILE, collideTopPx, TILE, collideH)
        }
        // bulles de lave qui montent et crèvent en surface (déterministes, animées en boucle)
        const nb = Math.max(3, Math.round(wPx / 40))
        for (let i = 0; i < nb; i++) {
          const bx = xPx + (i + 0.5) * (wPx / nb)
          const bub = this.add.circle(bx, topPx + 6, 3 + (i % 3), 0xffb347, 0.95).setDepth(-1).setBlendMode(Phaser.BlendModes.ADD)
          this.tweens.add({
            targets: bub, y: topPx - 10, scale: 1.9, alpha: 0,
            duration: 700 + (i % 4) * 240, repeat: -1, repeatDelay: 260 + i * 110, ease: 'Sine.out',
          })
        }
        this.lavaRects.push(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))
        continue
      }

      // NAPPE (basin OU libre) : rendu tuilé en UN TileSprite + liseré de surface.
      this.add.tileSprite(xPx, topPx, wPx, heightPx, 'water').setOrigin(0, 0).setDepth(-3)
      this.add.rectangle(xPx, topPx, wPx, 5, 0x9fdcff, 0.5).setOrigin(0, 0).setDepth(-1)
      this.waterRects.push(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))

      if (hz.water === 'basin') {
        // PUITS/BASSIN CONTENU : parois rocheuses rigides à gauche (colonne hz.x-1) et à droite
        // (colonne hz.x+hz.w). Visuel sur toute la hauteur d'eau ; COLLISION à partir d'une rangée
        // SOUS la surface → on ne traverse jamais la paroi en marchant (blocage latéral au sol),
        // mais on entre/sort librement par le HAUT (plonger, puis remonter à la nage et sortir sur
        // le rebord). Le FOND est le sol du monde (les colonnes d'eau ne sont pas des trous).
        for (const wx of [hz.x - 1, hz.x + hz.w]) {
          if (wx < 0 || wx >= this.levelDef.widthTiles) continue
          this.add.tileSprite(wx * TILE, topPx, TILE, heightPx, 'basin-wall').setOrigin(0, 0).setDepth(-2)
          const collideTopPx = (waterTop + 1) * TILE
          const collideH = (waterBottom + 1) * TILE - collideTopPx
          this.addStaticBand(basinWalls, wx * TILE, collideTopPx, TILE, collideH)
        }
        // déco posée sur la SURFACE du sol (fond du lac) — l'eau recouvre désormais le sol plein
        this.addBasinBottomDeco(hz.x, hz.x + hz.w - 1, this.groundRow - 1)
      }
    }
    this.physics.add.overlap(this.player, spikes, () => this.hitPlayer(35))
    this.physics.add.collider(this.player, basinWalls)
    this.physics.add.collider(this.enemies, basinWalls)

    // voile bleuté discret, épinglé à l'écran, affiché seulement quand la tête est immergée
    // (alpha piloté dans updateWater). Sous les overlays de menu/K.O. (depth ≥ 20).
    this.submergeVeil = this.add.rectangle(480, 270, 960, 540, 0x0a4a7a, 0)
      .setScrollFactor(0).setDepth(15)

    // échelles : texture répétée (UN TileSprite par échelle) + zone d'escalade (via ladderRects)
    for (const l of this.levelDef.ladders ?? []) {
      this.add.tileSprite(l.x * TILE, l.y * TILE, TILE, l.h * TILE, 'ladder').setOrigin(0, 0).setDepth(-1)
      // on descend d'une tuile sous le bas de l'échelle pour pouvoir l'attraper depuis le sol
      // zone d'accroche large de 2 tuiles (centrée sur l'échelle) : plus de décrochage au moindre
      // décalage (avant : 1 tuile, testée sur le centre du panda → « casse-gueule »)
      this.ladderRects.push(new Phaser.Geom.Rectangle(
        l.x * TILE - TILE / 2, l.y * TILE, TILE * 2, (l.h + 1) * TILE,
      ))
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
      if (!proj.active) return
      // Flèche explosive : pas de dégâts directs, elle détone en zone à l'endroit du contact.
      if (proj.explosive) { this.doArrowExplosion(proj); return }
      audio.playSfx('hit')
      if (proj.pierce) {
        if (proj.hitEnemies.has(e)) return
        proj.hitEnemies.add(e)
        e.takeDamage(physicalDamage(proj.damage, e.effectiveDef()))
        if (proj.burn) e.applyBurn(proj.burn.dmgPerTick, proj.burn.durationMs)
        this.impactFx(proj.x, proj.y, proj.tintTopLeft)
      } else {
        e.takeDamage(physicalDamage(proj.damage, e.effectiveDef()))
        if (proj.burn) e.applyBurn(proj.burn.dmgPerTick, proj.burn.durationMs)
        // grosse boule de feu : petite explosion (gerbe + splash) à l'impact, en plus du coup direct
        if (proj.blast) this.doFireballBlast(proj)
        else this.impactFx(proj.x, proj.y, proj.tintTopLeft)
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
    // ÉCHAP annule une visée de zone en cours (sans rien consommer)
    this.input.keyboard!.on('keydown-ESC', () => { if (this.aim) this.cancelAim() })

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

    // caméra bornée à la taille RÉELLE du monde (largeur ET hauteur) : sur un monde haut elle
    // suit le panda en X ET en Y (scroll vertical quand il monte/descend), lerp doux sur les deux
    // axes. Sur un monde « défaut 16 » (worldH = 540 = viewport) l'axe Y reste verrouillé → aucune
    // régression.
    this.cameras.main.setBounds(0, 0, widthPx, this.worldH)
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
    this.events.on('player-dive-land', this.onDiveLand, this)
    this.events.once('shutdown', () => {
      this.game.events.off('input-jump-down', this.onJumpDown, this)
      this.game.events.off('input-jump-up', this.onJumpUp, this)
      this.events.off('player-jump', this.onPlayerJump, this)
      this.events.off('player-dive-land', this.onDiveLand, this)
      this.game.events.off('input-attack', this.basicAttack, this)
      this.game.events.off('input-skill', this.castSkill, this)
      this.game.events.off('input-potion', this.usePotion, this)
      this.events.off('enemy-died', this.onEnemyDied, this)
      this.events.off('enemy-died', this.onBossDied, this)
      this.events.off('enemy-loot', this.onEnemyLoot, this)
      this.events.off('prop-broken', this.onPropBroken, this)
      this.events.off(Phaser.Scenes.Events.RESUME, this.resumeWorld, this)
      this.endAim() // sort proprement d'une éventuelle visée de zone en cours
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

    // AMBIANCE DE CIEL : le fond de biome (illustration ou dégradé) laissait un HAUT figé et mort.
    // On peuple la bande de ciel d'éléments d'ambiance ANIMÉS et biome-appropriés (nuages, braises,
    // brumes, flocons, volées lointaines). Purement décoratif : AUCUNE physique, depth arrière (derrière
    // le décor jouable), épinglé à la caméra (scrollFactor 0 = ciel « à l'infini », parallaxe cohérente).
    this.addSkyAmbience()

    // décors posés au sol pour remplir l'espace (défilent avec le monde, derrière le joueur)
    const widthPx = this.levelDef.widthTiles * TILE
    const groundY = this.groundRow * TILE
    const decoKey = `deco-${this.levelDef.biome}`
    if (this.textures.exists(decoKey)) {
      for (let x = 160; x < widthPx - 80; x += 250) {
        const jitter = ((x * 37) % 70) - 35 // pseudo-aléa déterministe
        this.add.image(x + jitter, groundY + 4, decoKey).setOrigin(0.5, 1).setDepth(-5)
      }
    }
  }

  // AMBIANCE DE CIEL (décor pur, aucune physique) : peuple la bande de ciel au-dessus du jeu d'éléments
  // ANIMÉS selon le biome pour qu'elle ne soit plus une dalle figée. Épinglé caméra (scrollFactor 0),
  // depth arrière (derrière plateformes/joueur). Pseudo-aléa déterministe → rendu stable.
  private addSkyAmbience() {
    const biome = this.levelDef.biome
    const rnd = (n: number) => { const s = Math.sin((n + 1) * 91.7) * 43758.5453; return s - Math.floor(s) }
    // dérive horizontale en boucle (nuages, brumes, volées) — va-et-vient lent
    const drift = (obj: Phaser.GameObjects.GameObject & { x: number }, dx: number, dur: number) =>
      this.tweens.add({ targets: obj, x: obj.x + dx, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    if (biome === 'enfer') {
      // ENFER : braises ascendantes incandescentes + volutes de fumée sombres
      for (let i = 0; i < 16; i++) {
        const x = 30 + rnd(i) * 900
        const y = 130 + rnd(i + 50) * 260
        const em = this.add.circle(x, y, 2 + rnd(i + 7) * 3, 0xff7a2a, 0.9).setScrollFactor(0).setDepth(-24).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: em, y: y - 120 - rnd(i) * 90, alpha: 0, duration: 2600 + rnd(i + 3) * 2400, repeat: -1, repeatDelay: rnd(i + 9) * 1600, ease: 'Sine.out' })
      }
      for (let i = 0; i < 4; i++) {
        const smoke = this.add.ellipse(120 + rnd(i + 20) * 720, 55 + rnd(i) * 120, 170, 60, 0x2a0a0a, 0.3).setScrollFactor(0).setDepth(-25)
        drift(smoke, 70 - rnd(i) * 140, 9000 + rnd(i) * 4000)
      }
      return
    }
    if (biome === 'cimetiere') {
      // CIMETIÈRE : brumes pâles qui dérivent + orbes spectraux qui palpitent
      for (let i = 0; i < 6; i++) {
        const fog = this.add.ellipse(rnd(i + 4) * 960, 40 + rnd(i) * 220, 230, 56, 0xb9b0d6, 0.16).setScrollFactor(0).setDepth(-25)
        drift(fog, 130 - rnd(i) * 260, 12000 + rnd(i) * 5000)
      }
      for (let i = 0; i < 4; i++) {
        const orb = this.add.circle(60 + rnd(i + 8) * 840, 90 + rnd(i) * 170, 4, 0xd7cbff, 0.5).setScrollFactor(0).setDepth(-24).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: orb, y: orb.y - 34, alpha: 0.12, duration: 2200 + rnd(i) * 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
      return
    }
    if (biome === 'cave') {
      // GROTTE : rares poussières en suspension qui descendent lentement (ambiance souterraine feutrée)
      for (let i = 0; i < 9; i++) {
        const x = rnd(i) * 960, y = 20 + rnd(i + 2) * 170
        const mote = this.add.circle(x, y, 1.5 + rnd(i) * 1.5, 0xbfae90, 0.4).setScrollFactor(0).setDepth(-24)
        this.tweens.add({ targets: mote, y: y + 130 + rnd(i) * 80, alpha: 0, duration: 5000 + rnd(i) * 4000, repeat: -1, repeatDelay: rnd(i) * 2200, ease: 'Sine.in' })
      }
      return
    }

    // BIOMES DE PLEIN AIR (plaine/foret/desert/jungle/montagne/plage/carriere) : nuages doux qui dérivent
    const cloudN = 6
    for (let i = 0; i < cloudN; i++) {
      const cx = (i / cloudN) * 960 + rnd(i) * 120
      const cy = 22 + rnd(i + 3) * 150
      const cloud = this.add.container(cx, cy).setScrollFactor(0).setDepth(-25)
      for (const [ox, oy, r] of [[0, 0, 34], [28, 7, 26], [-26, 7, 24], [6, -9, 22]] as const) {
        cloud.add(this.add.ellipse(ox, oy, r * 1.7, r, 0xffffff, 0.5))
      }
      cloud.setScale(0.7 + rnd(i + 5) * 0.8)
      drift(cloud, 90 - rnd(i) * 180, 14000 + rnd(i) * 7000)
    }
    if (biome === 'montagne') {
      // MONTAGNE : flocons lents en plus des nuages
      for (let i = 0; i < 12; i++) {
        const x = rnd(i) * 960, y = rnd(i + 1) * 270
        const flake = this.add.circle(x, y, 1.5 + rnd(i) * 1.5, 0xffffff, 0.75).setScrollFactor(0).setDepth(-24)
        this.tweens.add({ targets: flake, y: y + 170, x: x + 30 - rnd(i) * 60, duration: 6000 + rnd(i) * 4000, repeat: -1, repeatDelay: rnd(i) * 1500, ease: 'Sine.in' })
      }
    }
    // volées lointaines d'oiseaux d'ambiance (chevrons sombres qui traversent le ciel)
    for (let gi = 0; gi < 2; gi++) {
      const gx = 180 + gi * 340, gy = 46 + rnd(gi + 30) * 90
      const g = this.add.graphics().setScrollFactor(0).setDepth(-24).setPosition(gx, gy)
      g.lineStyle(2, 0x37474f, 0.5)
      for (let k = 0; k < 3; k++) {
        const bx = k * 18 - 18, by = Math.abs(k - 1) * 7
        g.beginPath(); g.moveTo(bx - 6, by); g.lineTo(bx, by - 4); g.lineTo(bx + 6, by); g.strokePath()
      }
      this.tweens.add({ targets: g, x: gx + 240, y: gy + 24 - rnd(gi) * 48, duration: 17000 + gi * 5000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
  }

  // OPTIM COLLISION : crée UN corps statique rectangulaire (coin haut-gauche leftPx/topPx, taille
  // wPx×hPx) dans le groupe donné, à la place d'une ribambelle de tuiles. Le corps est dimensionné
  // et positionné EXPLICITEMENT (setSize + position + updateCenter) : en Phaser 4, setScale+refreshBody
  // ne redimensionne PAS un corps statique (il restait 32px → chute à travers). Le sprite support est
  // invisible ; le RENDU est fait par un TileSprite séparé.
  private addStaticBand(group: Phaser.Physics.Arcade.StaticGroup, leftPx: number, topPx: number, wPx: number, hPx: number) {
    const band = group.create(leftPx + wPx / 2, topPx + hPx / 2, 'tile-plaine') as Phaser.Physics.Arcade.Sprite
    band.setVisible(false)
    const body = band.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(wPx, hPx, false)
    body.position.set(leftPx, topPx)
    body.updateCenter()
  }

  // DÉCO DE FOND de bassin (ambiance pure, AUCUNE physique/collision, depth arrière) : galets le
  // long du fond, algues, coquillages, coraux et quelques bulles immobiles. Pseudo-aléa déterministe
  // sur la colonne → rendu stable d'une frame à l'autre.
  private addBasinBottomDeco(xFrom: number, xTo: number, bottomRow: number) {
    const floorY = (bottomRow + 1) * TILE // ligne du fond (dessus du sol du monde)
    const rnd = (seed: number) => { const s = Math.sin(seed * 127.1) * 43758.5453; return s - Math.floor(s) }
    let k = 0
    for (let tx = xFrom; tx <= xTo; tx++) {
      const cx = tx * TILE + TILE / 2
      const r = rnd(tx + 1)
      // galets posés au fond (fréquents, tailles variées)
      this.add.image(cx, floorY - 3, 'deco-pebble').setOrigin(0.5, 1).setDepth(-2).setAlpha(0.9).setScale(0.75 + r * 0.5)
      // un élément « vivant » une colonne sur trois (algue / coquillage / corail en rotation)
      if ((tx - xFrom) % 3 === 1) {
        const kind = ['deco-algae', 'deco-shell', 'deco-coral'][k++ % 3]!
        this.add.image(cx + (r - 0.5) * 10, floorY - 2, kind).setOrigin(0.5, 1).setDepth(-2).setAlpha(0.85)
      }
      // bulles immobiles éparses qui « décorent » la colonne d'eau
      if (r > 0.7) this.add.image(cx, floorY - TILE - r * 40, 'fx-bubble').setDepth(-2).setAlpha(0.5).setScale(0.3 + r * 0.3)
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
  // toujours gauche→droite : apparition à gauche, sortie à droite (plus de niveau « à l'envers »)
  private spawnX(): number { return 2 * TILE }
  private exitX(): number { return this.levelDef.widthTiles * TILE - 2 * TILE }

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
    // sortie sur la corniche `exit` (altitude différente du départ) si définie, sinon au sol bord droit.
    const exitDef = this.levelDef.exit
    const doorX = exitDef ? exitDef.x * TILE + TILE / 2 : this.exitX()
    const doorRow = exitDef ? exitDef.y : this.groundRow
    // la porte (texture 'exit', 210 px de haut) repose sur la corniche : on ancre son bas sur le
    // dessus de la corniche (légèrement plantée, comme l'ancienne sortie au sol)
    const doorH = 210
    const doorBottom = doorRow * TILE + (exitDef ? 6 : 20)
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
    const boss = new Enemy(this, this.levelDef.widthTiles * TILE * 0.7, this.groundRow * TILE - 80, def)
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
    const groundY = this.groundRow * TILE - 10
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
      // toute mort → écran de game over ; « Réessayer » recommence le niveau AU DÉBUT
      save(getPlayer())
      this.showGameOver()
    }
  }

  // écran K.O. avec choix « Réessayer » (relance le niveau au DÉBUT) ou « Carte »
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
    this.add.text(480, 78, 'Essaie encore !', {
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

  // Plongée sous l'eau (appelé chaque frame ; no-op sans bassin). Le panda est « submergé » quand
  // le HAUT de sa hitbox (le crâne) est passé sous la surface du bassin courant. Tant qu'il l'est :
  // le souffle se vide, des bulles montent depuis sa tête, et une fois le souffle épuisé il perd
  // de la vie par ticks réguliers (noyade douce, jamais instantanée). Dès qu'il ressort la tête,
  // la noyade s'arrête et le souffle se recharge vite. Respecte le god mode (via drownTick).
  private updateWater(delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const rect = this.waterRects.find((r) => r.contains(this.player.x, this.player.y))
    // marge de 4px : on ne compte comme immergé que quand la tête est franchement sous la surface
    const submerged = !!rect && body.top >= rect.top + 4

    if (submerged) {
      this.breathMs = Math.max(0, this.breathMs - delta)
      this.bubbleAccumMs += delta
      while (this.bubbleAccumMs >= BUBBLE_INTERVAL_MS) {
        this.bubbleAccumMs -= BUBBLE_INTERVAL_MS
        this.emitBubble(body.top)
      }
      // souffle épuisé : noyade douce par ticks réguliers (jamais de mort d'un seul coup)
      if (this.breathMs <= 0) {
        this.drownAccumMs += delta
        while (this.drownAccumMs >= DROWN_TICK_MS) {
          this.drownAccumMs -= DROWN_TICK_MS
          this.drownTick((DROWN_DPS * DROWN_TICK_MS) / 1000)
        }
      }
    } else {
      // tête hors de l'eau : répit — le souffle se recharge vite et la noyade s'interrompt
      this.breathMs = Math.min(BREATH_MAX_MS, this.breathMs + delta * BREATH_RECHARGE_MULT)
      this.drownAccumMs = 0
      this.bubbleAccumMs = 0
    }

    this.submergeVeil?.setAlpha(submerged ? 0.14 : 0)
    this.updateBreathGauge(body, submerged)
  }

  // Contact avec la LAVE (appelé chaque frame ; no-op sans cuve de lave). Dès que le corps du panda
  // touche une cuve de lave (pieds OU centre), il BRÛLE : gros dégâts continus par ticks rapides via
  // le chemin de dégâts standard (drownTick respecte le god mode et déclenche le K.O.). Pas de nage :
  // tomber dans la lave tue très vite (cuve de pierre → dur d'en ressortir).
  private updateLava(delta: number) {
    if (!this.lavaRects.length) return
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const touching = this.lavaRects.some((r) => r.contains(this.player.x, body.bottom) || r.contains(this.player.x, this.player.y))
    if (!touching) { this.lavaAccumMs = 0; return }
    this.lavaAccumMs += delta
    while (this.lavaAccumMs >= LAVA_TICK_MS) {
      this.lavaAccumMs -= LAVA_TICK_MS
      this.drownTick((LAVA_DPS * LAVA_TICK_MS) / 1000)
    }
  }

  // un tick de noyade : perte de PV régulière passant par le chemin de dégâts standard. Respecte
  // le god mode (émulateur/tests → aucune perte) et déclenche le K.O. / checkpoint comme un coup.
  private drownTick(amount: number) {
    if ((globalThis as { __pandaGodMode?: boolean }).__pandaGodMode) return
    if (this.player.hp <= 0) return
    this.player.takeDamage(amount)
    if (this.player.hp <= 0) {
      audio.playSfx('player-death')
      // toute mort → écran de game over ; « Réessayer » recommence le niveau AU DÉBUT
      save(getPlayer())
      this.showGameOver()
    }
  }

  // Y a-t-il une SURFACE SOLIDE (plateforme, pont, ou sol non troué) dont le dessus est ~au niveau
  // de footYPx à la colonne xPx ? Utilisé par la patrouille des monstres pour la détection de rebord
  // (demi-tour avant de tomber). Lecture pure de la géométrie statique du niveau.
  floorAt(xPx: number, footYPx: number): boolean {
    const tileX = Math.floor(xPx / TILE)
    if (tileX < 0 || tileX >= this.levelDef.widthTiles) return false
    for (const p of this.levelDef.platforms) {
      if (tileX >= p.x && tileX < p.x + p.w && Math.abs(p.y * TILE - footYPx) <= TILE * 0.9) return true
    }
    for (const b of this.levelDef.bridges ?? []) {
      if (tileX >= b.x && tileX < b.x + b.w && Math.abs(b.y * TILE - footYPx) <= TILE) return true
    }
    const isGap = (this.levelDef.gaps ?? []).some((g) => tileX >= g.x && tileX < g.x + g.w)
    if (!isGap && Math.abs(this.groundRow * TILE - footYPx) <= TILE * 1.2) return true
    return false
  }

  // le centre du panda est-il au-dessus d'un trou du sol (colonne de vide) ?
  private overGap(x: number): boolean {
    return (this.levelDef.gaps ?? []).some((g) => x >= g.x * TILE && x < (g.x + g.w) * TILE)
  }

  // Chute MORTELLE dans un trou (appelé chaque frame). On ne meurt QUE si l'on est réellement tombé
  // TOUT EN BAS dans un VRAI VIDE : au-dessus d'une colonne de trou (overGap → fillBelow 'vide',
  // aucun sol/plateforme dessous) ET les pieds arrivés au fond du monde (le corps repose sur la borne
  // basse = worldH). Une descente/saut normal d'une plateforme à une plateforme plus basse ne tue
  // JAMAIS : on se pose sur la plateforme bien avant d'atteindre le fond. Toute mort (dont celle-ci)
  // passe désormais par l'écran de game over ; « Réessayer » recommence le niveau AU DÉBUT.
  private checkPitDeath() {
    if ((globalThis as { __pandaGodMode?: boolean }).__pandaGodMode) return
    if (this.player.hp <= 0) return
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const inVoidColumn = this.overGap(this.player.x)
    const atWorldBottom = body.bottom >= this.worldH - 2
    if (!(inVoidColumn && atWorldBottom)) return
    this.player.takeDamage(this.player.hp)
    audio.playSfx('player-death')
    save(getPlayer())
    this.showGameOver()
  }

  // une bulle qui monte depuis la tête du panda et s'estompe (réutilise la texture fx-bubble,
  // mise à petite échelle). Effet léger : quelques bulles translucides qui remontent.
  private emitBubble(headY: number) {
    const bx = this.player.x + Phaser.Math.Between(-8, 8)
    const b = this.add.image(bx, headY + 2, 'fx-bubble')
      .setDepth(this.player.depth + 1)
      .setScale(Phaser.Math.FloatBetween(0.2, 0.45))
      .setAlpha(0.8)
    this.tweens.add({
      targets: b,
      y: headY - Phaser.Math.Between(28, 48),
      x: bx + Phaser.Math.Between(-7, 7),
      scale: b.scale * 1.5,
      alpha: 0,
      duration: Phaser.Math.Between(560, 860),
      ease: 'Sine.out',
      onComplete: () => b.destroy(),
    })
  }

  // petite jauge d'apnée au-dessus de la tête : visible seulement quand le souffle n'est pas plein
  // (donc invisible hors de l'eau). Vire au rouge quand le souffle est presque épuisé.
  private updateBreathGauge(body: Phaser.Physics.Arcade.Body, submerged: boolean) {
    const show = submerged || this.breathMs < BREATH_MAX_MS - 1
    if (!show) {
      this.breathBarBg?.setVisible(false)
      this.breathBar?.setVisible(false)
      return
    }
    const w = 34
    const x = this.player.x - w / 2
    const y = body.top - 12
    const frac = Phaser.Math.Clamp(this.breathMs / BREATH_MAX_MS, 0, 1)
    if (!this.breathBarBg) {
      this.breathBarBg = this.add.rectangle(0, 0, w + 2, 6, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(9)
      this.breathBar = this.add.rectangle(0, 0, w, 4, 0x4fc3f7).setOrigin(0, 0.5).setDepth(10)
    }
    this.breathBarBg.setVisible(true).setPosition(x - 1, y)
    const bar = this.breathBar!
    bar.setVisible(true).setPosition(x, y)
    bar.setDisplaySize(Math.max(0.001, w * frac), 4)
    bar.setFillStyle(frac > 0.3 ? 0x4fc3f7 : 0xff5252)
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
      if (isMageType) { proj.setTexture('fx-fireball').clearTint().setScale(1.3); this.fireballShimmer(proj, 1.3) }
      else proj.setTexture('fx-arrow').clearTint().setScale(1.2)
    } else {
      this.slashFx(this.player.x + this.player.facing * 30, this.player.y, 60, 0xffffff)
      this.meleeHit(70, 1)
    }
  }

  // projectile allié tiré depuis la main, à hauteur des monstres (yOffset : décalage vertical du
  // point de départ, ex. pour tirer deux flèches très rapprochées → Double flèche)
  private spawnPlayerProjectile(damage: number, rangePx: number, yOffset = 0): Projectile {
    const proj = new Projectile(this, this.player.x + this.player.facing * 22, this.player.y + 16 + yOffset, this.player.facing, 0, damage, true, rangePx)
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

  // scintillement de flamme : fait vibrer la boule de feu (échelle X/Y alternée) comme du vrai
  // feu. Le tween est en repeat:-1 mais Projectile.destroy tue les tweens du projectile → pas de
  // fuite quand le tir s'éteint (portée atteinte ou impact).
  private fireballShimmer(proj: Projectile, base: number) {
    proj.setScale(base)
    this.tweens.add({
      targets: proj,
      scaleX: base * 1.22, scaleY: base * 0.86,
      duration: 90, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    })
  }

  // croissant de coup visible même dans le vide + petit élan du panda ; en mode "intense"
  // (gros coup), double croissant + léger tremblement de caméra
  private slashFx(cx: number, cy: number, w: number, color: number, intense = false) {
    const f = this.player.facing
    const drawCrescent = (offsetDeg: number, scaleMul: number, alpha: number) => {
      const arc = this.add.graphics({ x: cx, y: cy }).setDepth(5)
      arc.lineStyle(intense ? 6 : 5, color, alpha).beginPath()
      arc.arc(0, 0, (w * 0.5) * scaleMul, Phaser.Math.DegToRad(-70 + offsetDeg), Phaser.Math.DegToRad(70 + offsetDeg), false)
      arc.strokePath()
      arc.scaleX = f // mirror le croissant selon le sens du regard (sinon il ouvre toujours vers la droite)
      this.tweens.add({ targets: arc, scaleX: 1.4 * f, scaleY: 1.4, alpha: 0, duration: 170, onComplete: () => arc.destroy() })
    }
    drawCrescent(0, 1, 0.95)
    if (intense) drawCrescent(16, 0.72, 0.55)
    // éclat de tranchant + petites étincelles projetées vers l'avant, pour un coup qui « claque »
    const flash = this.add.image(cx, cy, 'ring').setTint(color).setDepth(6).setScale(0.06).setAlpha(0.9)
    this.tweens.add({ targets: flash, scale: intense ? 0.5 : 0.35, alpha: 0, duration: 150, onComplete: () => flash.destroy() })
    const sparks = intense ? 6 : 4
    for (let i = 0; i < sparks; i++) {
      const a = Phaser.Math.DegToRad(-45 + (90 / sparks) * i) // éventail vers l'avant (sens du regard)
      const spark = this.add.rectangle(cx, cy, 3, 3, color).setDepth(6)
      const reach = intense ? 34 : 24
      this.tweens.add({
        targets: spark, x: cx + Math.cos(a) * reach * this.player.facing, y: cy + Math.sin(a) * reach,
        alpha: 0, duration: 220, onComplete: () => spark.destroy(),
      })
    }
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

  // ===== Helpers FX réutilisables (généreux) — partagés par toutes les classes =====
  // Amples volontairement : explosions larges, éclats nombreux, secousses franches. Les futurs
  // skills (archer/mage) sont censés s'appuyer dessus plutôt que de réinventer chaque effet.

  // Secousse de caméra : intensité 0..1 (fraction de l'écran), durée en ms.
  screenShake(intensity: number, ms: number) {
    this.cameras.main.shake(ms, intensity)
  }

  // Flash plein écran additif d'une couleur donnée qui se dissout ; alpha = pic d'intensité.
  flashScreen(color: number, alpha: number, ms: number) {
    const rect = this.add.rectangle(480, 270, 960, 540, color, alpha)
      .setScrollFactor(0).setDepth(50).setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: rect, alpha: 0, duration: ms, onComplete: () => rect.destroy() })
  }

  // Gerbe de particules additives autour de (x,y). spreadUp = éventail vers le haut (jets/flammes),
  // sinon 360°. gravity = les particules retombent un peu. speed règle la portée.
  burstParticles(
    x: number, y: number, count: number, color: number,
    opts: { speed?: number; size?: number; durationMs?: number; spreadUp?: boolean; gravity?: boolean } = {},
  ) {
    const { speed = 60, size = 4, durationMs = 400, spreadUp = false, gravity = false } = opts
    for (let i = 0; i < count; i++) {
      const a = spreadUp
        ? -Math.PI / 2 + Phaser.Math.FloatBetween(-0.9, 0.9)
        : (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2)
      const reach = speed * Phaser.Math.FloatBetween(0.5, 1)
      const pcl = this.add.rectangle(x, y, size, size, color).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setRotation(a)
      const ty = y + Math.sin(a) * reach + (gravity ? reach * 0.45 : 0)
      this.tweens.add({ targets: pcl, x: x + Math.cos(a) * reach, y: ty, alpha: 0, scale: 0.3, duration: durationMs, ease: 'Cubic.out', onComplete: () => pcl.destroy() })
    }
  }

  // GROSSE explosion en cercle : cœur incandescent + doubles ondes de choc + boules de feu
  // projetées + éclats + secousse proportionnelle au rayon. Le grand effet « qui claque ».
  explosionFx(x: number, y: number, radius: number, color: number) {
    const ADD = Phaser.BlendModes.ADD
    // cœur blanc incandescent qui gonfle et s'éteint
    const core = this.add.image(x, y, 'ring').setTint(0xffffff).setBlendMode(ADD).setDepth(7).setScale(0.1)
    this.tweens.add({ targets: core, scale: (radius / 28) * 0.55, alpha: 0, duration: 200, ease: 'Cubic.out', onComplete: () => core.destroy() })
    // deux ondes de choc concentriques
    for (let i = 0; i < 2; i++) {
      const ring = this.add.image(x, y, 'ring').setTint(color).setBlendMode(ADD).setDepth(6).setScale(0.15).setAlpha(0.85)
      this.tweens.add({ targets: ring, scale: (radius / 28) * (1 + i * 0.4), alpha: 0, duration: 360 + i * 140, delay: i * 60, ease: 'Cubic.out', onComplete: () => ring.destroy() })
    }
    // boules de feu projetées vers l'extérieur (dégradé jaune/couleur)
    const blobs = Math.round(8 + radius / 16)
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25)
      const dist = radius * Phaser.Math.FloatBetween(0.45, 1)
      const blob = this.add.circle(x, y, Phaser.Math.Between(5, 10), i % 3 === 0 ? 0xffe082 : color).setBlendMode(ADD).setDepth(6).setAlpha(0.95)
      this.tweens.add({ targets: blob, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist - dist * 0.15, scale: 0.2, alpha: 0, duration: Phaser.Math.Between(320, 480), ease: 'Cubic.out', onComplete: () => blob.destroy() })
    }
    this.burstParticles(x, y, Math.round(radius / 10) + 6, color, { speed: radius, size: 4, durationMs: 420 })
    this.screenShake(Math.min(0.02, radius * 0.00012), 180)
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
    const skill = SKILLS[skillId]
    if (!skill) return // skill retiré du registre (vieille save) : on ignore proprement
    // Visée de zone : on n'engage rien tout de suite — on entre en mode ciblage, l'énergie et
    // le cooldown ne sont consommés qu'à la confirmation de la zone.
    if (skill.kind === 'zone') { this.beginZoneTargeting(slot, skill); return }
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
    // gros coup instantané : bref gel d'impact pour le punch (charge/dive/buff gèrent le leur)
    if (mult >= 2.5 && (skill.kind === 'melee' || skill.kind === 'aoe' || skill.kind === 'projectile')) this.hitStop(75)
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
          e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult))
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
      const mageType = skill.classId === 'mage' || skill.classId === 'sorcier'
      const archerType = skill.classId === 'archer' || skill.classId === 'chasseur'
      if (skill.arc && skill.explode) {
        // Flèche explosive / Tir du faucon : cloche à tête explosive qui détone au sol (rayon = explodeRadius)
        this.setupExplosiveArrow(proj, skill, atk * mult, color)
      } else if (skill.arc) {
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
      } else if (skill.id === 'lancer-epee') {
        // Lancer d'épée : la lame elle-même part en tournoyant et traverse la ligne ennemie
        this.swordThrowProjectile(proj, color)
      } else if (skill.burn) {
        // Flèche enflammée / mortelle : flèche embrasée + brûlure (DoT) sur chaque cible touchée.
        proj.pierce = !!skill.pierce
        proj.burn = { dmgPerTick: atk * mult * 0.25, durationMs: 3200 }
        proj.setTexture(skill.pierce ? 'fx-arrow-pierce' : 'fx-arrow').setTint(0xff7a33).setScale(1.35)
        this.attachFlameTrail(proj)
      } else if (skill.pierce) {
        // transperce tout sur toute la largeur visible : grande flèche perçante à TRAÎNÉE BLEUE
        // lumineuse (archer/chasseur) ou faisceau laser (mage/sorcier).
        proj.pierce = true
        const isArrow = archerType || skill.id.includes('fleche') || skill.id.includes('tir')
        if (isArrow) {
          proj.setTexture('fx-arrow-pierce').setTint(0x40c4ff).setScale(1.3)
          this.attachSparkTrail(proj, 0x81d4fa)
        } else {
          proj.setTexture('fx-laser').setTint(color).setScale(1)
        }
      } else if (skill.id === 'sceau-du-heaume') {
        // sceau du chevalier : sigil héraldique tournoyant, doré et lumineux
        this.sealProjectile(proj, color)
      } else {
        // projectile simple : boule de feu (mage/sorcier) ou flèche (archer/chasseur), sinon orbe.
        // Grosse boule de feu (skill.blast) : nettement plus imposante que les autres tirs.
        const projScale = skill.blast ? 2.4 : skill.multiplier >= 2.5 ? 1.6 : skill.multiplier >= 1.6 ? 1.25 : 1.05
        const styleSimple = (pr: Projectile) => {
          if (mageType) { pr.setTexture('fx-fireball-orange').clearTint(); this.fireballShimmer(pr, projScale) }
          else if (archerType) pr.setTexture('fx-arrow').clearTint().setScale(projScale)
          else pr.setTint(color).setScale(projScale)
          if (skill.blast) pr.blast = { radius: skill.blast, color }
        }
        styleSimple(proj)
        // Double flèche : on tire les flèches supplémentaires TOUT contre la première (léger
        // décalage vertical), lancées ensemble → elles frappent comme une salve serrée.
        if (skill.arrows && skill.arrows > 1) {
          for (let k = 1; k < skill.arrows; k++) {
            const off = (k % 2 === 1 ? -1 : 1) * (7 + Math.floor((k - 1) / 2) * 8)
            styleSimple(this.spawnPlayerProjectile(atk * mult, range, off))
          }
        }
      }
    } else if (skill.kind === 'trap') {
      // Piège : posé au sol aux pieds du panda ; immobilise + blesse le premier ennemi qui l'atteint.
      this.castTrap(skill, color, mult)
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
    } else if (skill.kind === 'charge') {
      // Attaque chargée : windup télégraphié puis coup dévastateur frontal (dégâts différés)
      this.castChargeAttack(skill, color, mult)
    } else if (skill.kind === 'dive') {
      // Plongeon : piqué depuis les airs → explosion à l'impact (proportionnelle à la chute)
      this.castDive(skill, color, mult)
    } else if (skill.kind === 'lightning') {
      // Éclairs foudroyants : décharge frontale à courte portée, dévastatrice
      this.castLightning(skill, mult)
    }
    // buff : rien à faire ici, l'effet est appliqué par le bloc buff ci-dessous (ATK + flamme)

    // Tout skill porteur d'un buff booste l'ATK sortante ; l'Épée enflammée y ajoute la flamme
    // (lame embrasée + brûlure sur les coups), sinon onde de cri dorée classique.
    if (skill.buff) {
      this.player.applyAtkBuff(skill.buff.atkMult, skill.buff.durationMs)
      if (skill.flame) { this.player.applyFlameBuff(skill.buff.durationMs); this.flameEnchantFx(color) }
      else this.warCryFx()
    }
    // Folie enragée : le panda entre en furie (aura ROUGE côté joueur) et TERRORISE tous les
    // monstres de son niveau ou moins — hors boss, jamais apeurés — qui fuient lentement et
    // encaissent +50% de dégâts (déf halvée, cf. Enemy.effectiveDef).
    if (skill.fear) {
      this.player.applyRageAura(skill.fear.durationMs)
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (!e.monster.boss && e.monster.level <= p.level) e.fear(skill.fear.durationMs)
      }
      // FX de lancement : onde rouge sang + léger flash rouge + courte secousse
      this.aoeRing(this.player.x, this.player.y, 170, 0xd50000, true)
      this.flashScreen(0xd50000, 0.14, 150)
      this.screenShake(0.008, 200)
    }
    // couche d'effets stylés propre à chaque skill sabreur / chevalier (par-dessus le générique)
    this.swordsmanFx(skill, color)
  }

  // Effets signature des skills sabreur / chevalier : chacun a une identité visuelle distincte
  // (grand arc lumineux, tourbillon, dash, onde de choc, colonne de lumière, garde…). Le
  // comportement (dégâts/portée) reste géré par le chemin générique ci-dessus ; ici on ne fait
  // qu'ajouter du feel et du spectacle.
  private swordsmanFx(skill: SkillDef, color: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    switch (skill.id) {
      case 'taillade': // grand arc de tranchant franc
        this.bladeArcFx(px + f * skill.range * 0.55, py, skill.range * 1.4, color)
        break
      case 'estoc-rapide': // fente rapide : petit bond en avant + trait perçant
        this.lungeFx(48)
        this.thrustFx(px + f * 24, py, color)
        break
      case 'lame-ultime': // ultime : double arc géant, flash, onde de choc, gros hit-stop
        this.flashScreen(0xfffae0, 0.35, 130)
        this.cameras.main.flash(110, 255, 250, 210)
        this.bladeArcFx(px + f * skill.range * 0.5, py, skill.range * 2.4, color, true)
        this.time.delayedCall(80, () => { if (this.player.active) this.bladeArcFx(px + f * skill.range * 0.5, py, skill.range * 2.4, 0xffffff, true) })
        this.shockwaveFx(px + f * 30, py + 22, 160, color)
        this.explosionFx(px + f * skill.range * 0.7, py, skill.range * 1.2, color)
        this.hitStop(130)
        break
      case 'tourbillon': // lames tournoyantes tout autour du panda
        this.whirlwindFx(px, py, skill.range, color)
        break
      case 'jugement-royal': // colonne de lumière céleste + arc géant + onde + flash + hit-stop
        this.beamStrikeFx(px + f * skill.range * 0.35, py, color)
        this.bladeArcFx(px + f * skill.range * 0.5, py, skill.range * 1.9, color, true)
        this.shockwaveFx(px + f * 30, py + 22, 150, color)
        this.explosionFx(px + f * skill.range * 0.4, py, skill.range * 1.1, color)
        this.flashScreen(0xfff3c0, 0.3, 140)
        this.cameras.main.flash(130, 255, 240, 170)
        this.hitStop(120)
        break
      case 'garde-imperiale': // éclat de garde dorée : anneaux + couronne de lames dressées
        this.guardBurstFx(px, py, skill.range, color)
        break
    }
  }

  // ===== Attaque chargée, Plongeon & Épée enflammée =====

  // Attaque chargée : court WINDUP télégraphié (aura grandissante, étincelles convergentes), puis
  // un coup DÉVASTATEUR frontal — arc géant, onde de choc, explosion, flash, secousse, hit-stop.
  private castChargeAttack(skill: SkillDef, color: number, mult: number) {
    const WINDUP = 480
    this.chargeWindupFx(color, WINDUP)
    this.time.delayedCall(WINDUP, () => {
      if (!this.player.active || this.player.hp <= 0) return
      const px = this.player.x, py = this.player.y, f = this.player.facing
      this.player.playAttack()
      this.lungeFx(70)
      this.bladeArcFx(px + f * skill.range * 0.6, py, skill.range * 1.7, color, true)
      this.shockwaveFx(px + f * 40, py + 22, skill.range * 1.2, color)
      this.explosionFx(px + f * skill.range * 0.7, py, skill.range * 0.95, color)
      this.flashScreen(color, 0.22, 120)
      this.screenShake(0.012, 220)
      this.hitStop(110)
      this.meleeHit(skill.range * 1.3, mult)
    })
  }

  // Télégraphe de charge : aura qui enfle autour du panda + étincelles aspirées vers lui, avec
  // une petite anticipation de secousse juste avant la libération.
  private chargeWindupFx(color: number, ms: number) {
    const p = this.player
    const aura = this.add.image(p.x, p.y, 'ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.depth - 1).setScale(0.3).setAlpha(0.2)
    this.tweens.add({
      targets: aura, scale: 2.2, alpha: 0.85, duration: ms, ease: 'Cubic.in',
      onUpdate: () => aura.setPosition(p.x, p.y),
      onComplete: () => this.tweens.add({ targets: aura, scale: 0.2, alpha: 0, duration: 90, onComplete: () => aura.destroy() }),
    })
    this.time.addEvent({
      delay: 45, repeat: Math.floor(ms / 45), callback: () => {
        if (!p.active) return
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2)
        const sh = this.add.rectangle(p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 4, 4, color).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.depth + 1)
        this.tweens.add({ targets: sh, x: p.x, y: p.y, alpha: 0, duration: 220, onComplete: () => sh.destroy() })
      },
    })
    this.time.delayedCall(Math.max(0, ms - 120), () => { if (this.player.active) this.screenShake(0.004, 130) })
  }

  // Plongeon : amorce le piqué s'il y a de la hauteur ; sinon (au sol) petite explosion immédiate.
  private castDive(skill: SkillDef, color: number, mult: number) {
    if (this.player.startDive()) {
      this.pendingDive = { range: skill.range, mult, color }
      this.diveTrailFx()
    } else {
      this.doDiveImpact(this.player.x, this.player.y, 0, skill.range, mult, color)
    }
  }

  // sillage orangé du panda pendant le piqué (rémanences qui s'estompent)
  private diveTrailFx() {
    const p = this.player
    const ev = this.time.addEvent({
      delay: 30, loop: true, callback: () => {
        if (!p.active || !p.diving) { ev.remove(); return }
        const echo = this.add.image(p.x, p.y, p.texture.key, p.frame.name)
          .setFlipX(p.flipX).setAlpha(0.4).setTint(0xff8a65).setDepth(p.depth - 1)
          .setDisplaySize(p.displayWidth, p.displayHeight)
        this.tweens.add({ targets: echo, alpha: 0, duration: 200, onComplete: () => echo.destroy() })
      },
    })
  }

  // atterrissage du Plongeon : consomme les paramètres réservés au lancer
  private onDiveLand(x: number, y: number, fall: number) {
    const d = this.pendingDive
    this.pendingDive = null
    if (!d) return
    this.doDiveImpact(x, y, fall, d.range, d.mult, d.color)
  }

  // impact du Plongeon : rayon ET dégâts PROPORTIONNELS à la hauteur de chute + grosse explosion.
  private doDiveImpact(x: number, y: number, fall: number, baseRange: number, mult: number, color: number) {
    const heightFactor = Phaser.Math.Clamp(fall / 200, 0.5, 2.6)
    const radius = baseRange * (0.6 + heightFactor * 0.8)
    const dmgMult = mult * (0.6 + heightFactor * 0.7)
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const flaming = this.player.isFlaming()
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) {
        e.takeDamage(physicalDamage(atk, e.effectiveDef(), dmgMult))
        if (flaming) e.applyBurn(atk * 0.35, 3000)
      }
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      if (prop.active && Phaser.Math.Distance.Between(x, y, prop.x, prop.y) <= radius) prop.takeDamage(1)
    }
    this.explosionFx(x, y, radius, color)
    this.shockwaveFx(x, y, radius, color)
    this.screenShake(Math.min(0.022, 0.006 + heightFactor * 0.006), 240)
    this.hitStop(90)
    audio.playSfx('hit')
  }

  // Épée enflammée : gerbe de flammes + anneaux + flash orangé au moment de l'embrasement.
  private flameEnchantFx(color: number) {
    const x = this.player.x, y = this.player.y
    this.flashScreen(0xff7043, 0.16, 160)
    for (let i = 0; i < 2; i++) {
      const ring = this.add.image(x, y, 'ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setScale(0.3).setAlpha(0.8)
      this.tweens.add({ targets: ring, scale: 3 + i, alpha: 0, duration: 420 + i * 120, delay: i * 80, onComplete: () => ring.destroy() })
    }
    this.burstParticles(x, y - 10, 14, color, { speed: 60, size: 6, durationMs: 500, spreadUp: true })
    this.screenShake(0.005, 160)
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

  // ===== Effets visuels signature des skills sabreur / chevalier =====

  // Grand arc de tranchant lumineux : croissant épais additif + cœur blanc-vif + halo + éclats
  // projetés vers l'avant. `intense` = arc plus large + shake caméra. Orienté selon le regard.
  private bladeArcFx(cx: number, cy: number, radius: number, color: number, intense = false) {
    const f = this.player.facing
    const crescent = (r: number, thick: number, col: number, alpha: number, dur: number) => {
      const g = this.add.graphics({ x: cx, y: cy }).setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
      g.lineStyle(thick, col, alpha).beginPath()
      g.arc(0, 0, r, Phaser.Math.DegToRad(-74), Phaser.Math.DegToRad(74), false)
      g.strokePath()
      g.setScale(0.6 * f, 0.6)
      this.tweens.add({ targets: g, scaleX: 1.5 * f, scaleY: 1.5, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => g.destroy() })
    }
    crescent(radius * 0.5, intense ? 9 : 7, color, 0.95, 230)
    crescent(radius * 0.5, intense ? 4 : 3, 0xffffff, 1, 300) // cœur blanc-vif du tranchant
    if (intense) crescent(radius * 0.62, 5, color, 0.5, 260)
    const flash = this.add.image(cx, cy, 'ring').setTint(color).setDepth(6).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(0.85)
    this.tweens.add({ targets: flash, scale: intense ? 0.7 : 0.45, alpha: 0, duration: 200, onComplete: () => flash.destroy() })
    const n = intense ? 9 : 6
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.DegToRad(-50 + (100 / n) * i)
      const reach = (intense ? 58 : 40) + Phaser.Math.Between(-6, 10)
      const sh = this.add.rectangle(cx, cy, 3, intense ? 11 : 8, color).setDepth(7).setRotation(a).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sh, x: cx + Math.cos(a) * reach * f, y: cy + Math.sin(a) * reach, alpha: 0, duration: 260, onComplete: () => sh.destroy() })
    }
    if (intense) this.cameras.main.shake(70, 0.006)
  }

  // Tourbillon : anneau de vent + lames en croissant qui balaient tout le cercle + éclats radiaux.
  private whirlwindFx(cx: number, cy: number, radius: number, color: number) {
    const ring = this.add.image(cx, cy, 'ring').setTint(color).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.7)
    this.tweens.add({ targets: ring, scale: (radius / 28) * 1.1, alpha: 0, duration: 440, onComplete: () => ring.destroy() })
    const blades = 3
    for (let b = 0; b < blades; b++) {
      const g = this.add.graphics({ x: cx, y: cy }).setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
      g.lineStyle(6, color, 0.9).beginPath()
      g.arc(0, 0, radius * 0.72, Phaser.Math.DegToRad(-28), Phaser.Math.DegToRad(28), false)
      g.strokePath()
      g.setRotation((b / blades) * Math.PI * 2)
      this.tweens.add({ targets: g, rotation: g.rotation + Math.PI * 3, alpha: 0, scale: 1.2, duration: 520, ease: 'Cubic.out', onComplete: () => g.destroy() })
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const sh = this.add.rectangle(cx, cy, 3, 10, color).setDepth(6).setRotation(a).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sh, x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, alpha: 0, duration: 440, onComplete: () => sh.destroy() })
    }
    this.cameras.main.shake(80, 0.004)
  }

  // Bond en avant (fente/charge) : petit élan avant-arrière (yoyo, la physique reste cohérente) +
  // rémanences dorées du panda pour vendre la vitesse.
  private lungeFx(distance: number, tint = 0xffe082) {
    const f = this.player.facing
    this.tweens.add({ targets: this.player, x: this.player.x + f * distance, duration: 110, yoyo: true, ease: 'Cubic.out' })
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 30, () => {
        if (!this.player.active) return
        const echo = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
          .setFlipX(this.player.flipX).setAlpha(0.4).setTint(tint).setDepth(this.player.depth - 1)
          .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
        this.tweens.add({ targets: echo, alpha: 0, duration: 200, onComplete: () => echo.destroy() })
      })
    }
  }

  // Estoc : trait perçant qui file vers l'avant + fines étincelles alignées.
  private thrustFx(x: number, y: number, color: number) {
    const f = this.player.facing
    const streak = this.add.rectangle(x, y, 12, 6, color).setDepth(6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95)
    this.tweens.add({ targets: streak, x: x + f * 80, scaleX: 6, alpha: 0, duration: 160, ease: 'Cubic.out', onComplete: () => streak.destroy() })
    for (let i = 0; i < 3; i++) {
      const sh = this.add.rectangle(x, y + Phaser.Math.Between(-8, 8), 3, 3, color).setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sh, x: x + f * Phaser.Math.Between(50, 90), alpha: 0, duration: 200, onComplete: () => sh.destroy() })
    }
  }

  // Onde de choc au sol : deux anneaux aplatis qui s'étendent + éclats projetés vers le haut.
  private shockwaveFx(x: number, y: number, radius: number, color: number) {
    for (let i = 0; i < 2; i++) {
      const w = this.add.image(x, y, 'ring').setTint(color).setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15).setAlpha(0.8)
      this.tweens.add({ targets: w, scaleX: radius / 28 + i, scaleY: (radius / 28) * 0.5, alpha: 0, duration: 340 + i * 90, delay: i * 60, ease: 'Cubic.out', onComplete: () => w.destroy() })
    }
    const n = 8
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const sh = this.add.rectangle(x, y, 4, 4, color).setDepth(5).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sh, x: x + Math.cos(a) * radius, y: y - Math.abs(Math.sin(a)) * radius * 0.6, alpha: 0, duration: 380, onComplete: () => sh.destroy() })
    }
  }

  // Colonne de lumière céleste qui s'abat (jugement royal) : faisceau + cœur blanc + impact au sol.
  private beamStrikeFx(x: number, y: number, color: number) {
    const beam = this.add.rectangle(x, y + 8, 46, 320, color).setOrigin(0.5, 1).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    this.tweens.add({ targets: beam, alpha: 0.9, duration: 90, yoyo: true, hold: 70, onComplete: () => beam.destroy() })
    const core = this.add.rectangle(x, y + 8, 16, 320, 0xffffff).setOrigin(0.5, 1).setDepth(6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    this.tweens.add({ targets: core, alpha: 1, duration: 80, yoyo: true, hold: 60, onComplete: () => core.destroy() })
    this.aoeRing(x, y + 6, 72, color, true)
  }

  // Éclat de garde impériale : anneaux dorés concentriques + couronne de lames dressées qui jaillit.
  private guardBurstFx(x: number, y: number, radius: number, color: number) {
    for (let i = 0; i < 3; i++) {
      const r = this.add.image(x, y, 'ring').setTint(i === 1 ? 0xffffff : color).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.85)
      this.tweens.add({ targets: r, scale: (radius / 28) * (0.9 + i * 0.15), alpha: 0, duration: 380 + i * 90, delay: i * 70, ease: 'Cubic.out', onComplete: () => r.destroy() })
    }
    const n = 12
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const sh = this.add.rectangle(x + Math.cos(a) * 20, y + Math.sin(a) * 20, 5, 16, color).setDepth(6).setRotation(a + Math.PI / 2).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sh, x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius, alpha: 0, duration: 420, ease: 'Cubic.out', onComplete: () => sh.destroy() })
    }
    this.cameras.main.shake(90, 0.004)
  }

  // Lancer d'épée : la lame part en tournoyant et transperce toute la ligne ennemie (perçant).
  // Utilise la texture d'arme du sabreur si dispo, avec une forte rotation propre.
  private swordThrowProjectile(proj: Projectile, _color: number) {
    proj.pierce = true
    const key = this.textures.exists('weapon-swordsman') ? 'weapon-swordsman' : 'projectile'
    proj.setTexture(key).clearTint().setScale(1.3).setAngularVelocity(this.player.facing * 900)
  }

  // Sceau du heaume : le projectile devient un sigil héraldique tournoyant (anneau + croix) qui
  // pulse le long de sa trajectoire (pulsations nettoyées à la mort du projectile).
  private sealProjectile(proj: Projectile, color: number) {
    proj.setTexture('ring').setTint(color).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setAngularVelocity(240)
    const seal = this.time.addEvent({
      delay: 55, loop: true, callback: () => {
        if (!proj.active) { seal.remove(); return }
        const g = this.add.graphics({ x: proj.x, y: proj.y }).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setRotation(Phaser.Math.FloatBetween(0, Math.PI))
        g.lineStyle(3, 0xffffff, 0.85).strokeCircle(0, 0, 14)
        g.lineBetween(-16, 0, 16, 0)
        g.lineBetween(0, -16, 0, 16)
        this.tweens.add({ targets: g, alpha: 0, scale: 1.7, duration: 240, onComplete: () => g.destroy() })
      },
    })
  }

  // ===== Archer / Chasseur : traînées, flèche explosive, piège & visée de zone =====

  // Traînée d'étincelles additives semées le long d'un projectile (flèche perçante bleue) : des
  // éclats brillants qui s'estompent, en plus des échos de texture de Projectile. Nettoyée à la
  // mort du projectile.
  private attachSparkTrail(proj: Projectile, color: number) {
    const ev = this.time.addEvent({
      delay: 24, loop: true, callback: () => {
        if (!proj.active) { ev.remove(); return }
        const s = this.add.rectangle(proj.x - this.player.facing * Phaser.Math.Between(6, 16), proj.y + Phaser.Math.Between(-4, 4), 4, 4, color)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth((proj.depth ?? 0) - 1).setAlpha(0.9)
        this.tweens.add({ targets: s, alpha: 0, scale: 0.2, duration: 240, onComplete: () => s.destroy() })
      },
    })
  }

  // Traînée de flammes d'une flèche embrasée : flammèches qui montent et s'éteignent dans son sillage.
  private attachFlameTrail(proj: Projectile) {
    const ev = this.time.addEvent({
      delay: 22, loop: true, callback: () => {
        if (!proj.active) { ev.remove(); return }
        const col = Phaser.Math.RND.pick([0xffca28, 0xff7043, 0xff5252])
        const fl = this.add.rectangle(proj.x - this.player.facing * Phaser.Math.Between(4, 14), proj.y + Phaser.Math.Between(-4, 4), 5, 9, col)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth((proj.depth ?? 0) - 1).setAlpha(0.95)
        this.tweens.add({ targets: fl, y: fl.y - Phaser.Math.Between(10, 20), scaleY: 0.4, alpha: 0, duration: 300, onComplete: () => fl.destroy() })
      },
    })
  }

  // Flèche explosive : lancée en cloche, elle porte une charge qui détone au sol (ou à l'impact).
  private setupExplosiveArrow(proj: Projectile, skill: SkillDef, damage: number, color: number) {
    proj.explosive = { radius: skill.explodeRadius ?? 110, damage, color }
    const b = proj.body as Phaser.Physics.Arcade.Body
    b.setAllowGravity(true)
    b.setVelocity(this.player.facing * 360, -430)
    proj.setTexture('fx-arrow').setTint(color).setScale(1.35).setAngularVelocity(this.player.facing * 240)
    this.attachFlameTrail(proj) // petite mèche fumante pendant le vol
    const boom: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (projObj) => this.doArrowExplosion(projObj as Projectile)
    this.physics.add.collider(proj, this.platforms, boom)
    this.physics.add.collider(proj, this.oneWayPlatforms, boom)
  }

  // Détonation d'une flèche explosive : GROSSE explosion + secousse + dégâts de zone aux alentours.
  private doArrowExplosion(proj: Projectile) {
    if (!proj.active) return
    const data = proj.explosive
    if (!data) { proj.destroy(); return }
    const x = proj.x, y = proj.y
    proj.explosive = null // pare la double détonation (sol + ennemi dans la même frame)
    proj.destroy()
    this.explosionFx(x, y, data.radius, data.color)
    this.screenShake(Math.min(0.02, data.radius * 0.0001), 200)
    audio.playSfx('hit')
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= data.radius) e.takeDamage(physicalDamage(data.damage, e.effectiveDef()))
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      if (prop.active && Phaser.Math.Distance.Between(x, y, prop.x, prop.y) <= data.radius) prop.takeDamage(1)
    }
  }

  // Piège à mâchoires : posé au sol aux pieds du panda. Le premier ennemi qui entre dans son
  // rayon est IMMOBILISÉ (root) et mordu (dégâts), puis le piège claque et disparaît. S'il n'est
  // pas déclenché, il s'efface au bout de ~14 s.
  private castTrap(skill: SkillDef, color: number, mult: number) {
    const gx = this.player.x, gy = this.groundRow * TILE - 6
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const trap = this.add.image(gx, gy, 'fx-trap').setDepth(2).setScale(1.05)
    this.physics.add.existing(trap, true) // corps statique = emprise de la texture (large piège au sol)
    // petit clignotement d'armement + pose
    this.aoeRing(gx, gy, 34, color)
    this.tweens.add({ targets: trap, scaleX: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    let sprung = false
    const spring = (enemy: Enemy) => {
      if (sprung || !enemy.active) return
      sprung = true
      this.tweens.killTweensOf(trap)
      enemy.root(skill.root ?? 2000)
      enemy.takeDamage(physicalDamage(atk, enemy.effectiveDef(), mult))
      this.impactFx(trap.x, trap.y, color)
      this.burstParticles(trap.x, trap.y, 12, color, { speed: 90, size: 5, durationMs: 360 })
      this.screenShake(0.004, 120)
      audio.playSfx('hit')
      // mâchoires qui claquent (léger sursaut) puis disparition
      this.tweens.add({ targets: trap, scaleY: 0.4, alpha: 0, duration: 260, onComplete: () => trap.destroy() })
    }
    this.physics.add.overlap(trap, this.enemies, (_t, e) => spring(e as Enemy))
    // filet de sécurité : le piège non déclenché s'efface après un temps
    this.time.delayedCall(14000, () => { if (!sprung && trap.active) { this.tweens.killTweensOf(trap); this.tweens.add({ targets: trap, alpha: 0, duration: 300, onComplete: () => trap.destroy() }) } })
  }

  // ===== Visée de zone (infra RÉUTILISABLE — archer & futur mage : météores / mur de flamme) =====
  // On entre en mode ciblage : un réticule suit le pointeur, le tap suivant valide la zone (effet
  // déclenché sur place), un bouton « Annuler » (ou ÉCHAP) sort sans rien consommer. Le jeu ne se
  // fige jamais — les ennemis continuent d'agir pendant la visée.
  private beginZoneTargeting(slot: number, skill: SkillDef) {
    if (this.aim) this.cancelAim() // une seule visée à la fois
    // vérifie SANS consommer que l'énergie suffira (dépensée seulement à la confirmation)
    if (this.player.energy < energyCostOf(skill)) { this.announceSkill('Pas assez d\'énergie', 0x4dd0e1); return }

    const color = this.skillColor(skill.id)
    const radius = skill.range
    // Réticule (monde) : disque translucide + anneau + croix, orienté au sol de la zone visée.
    const g = this.add.graphics()
    g.fillStyle(color, 0.16).fillCircle(0, 0, radius)
    g.lineStyle(3, color, 0.9).strokeCircle(0, 0, radius)
    g.lineStyle(2, 0xffffff, 0.9).lineBetween(-14, 0, 14, 0).lineBetween(0, -14, 0, 14)
    const ring = this.add.image(0, 0, 'ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setScale((radius / 28) * 0.5)
    this.tweens.add({ targets: ring, scale: (radius / 28) * 1.05, alpha: 0.2, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    const reticle = this.add.container(this.player.x + this.player.facing * 160, this.groundRow * TILE - 30, [g, ring]).setDepth(9)

    // UI écran (épinglée) : consigne + bouton Annuler visuel (hit-test manuel dans onAimPointer)
    const hint = this.add.text(480, 458, 'Touche la zone à viser', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(60)
    const cancelBg = this.add.rectangle(480, 498, 150, 34, 0x455a64, 0.95).setScrollFactor(0).setDepth(60).setStrokeStyle(2, 0xffffff, 0.6)
    const cancelTxt = this.add.text(480, 498, 'Annuler ✕', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(61)

    this.aim = { slot, skill, reticle, ui: [hint, cancelBg, cancelTxt], cancelAt: { x: 480, y: 498 } }
    // Le tap qui a lancé la visée (bouton de slot / touche) ne doit pas valider aussitôt :
    // on n'écoute le pointeur qu'après un court délai.
    this.time.delayedCall(160, () => { if (this.aim) this.input.on('pointerdown', this.onAimPointer, this) })
  }

  // Réticule suit le pointeur actif (souris survolée ou doigt posé) — appelé chaque frame.
  private updateAimReticle() {
    if (!this.aim) return
    const p = this.input.activePointer
    const wp = this.cameras.main.getWorldPoint(p.x, p.y)
    this.aim.reticle.setPosition(wp.x, wp.y)
  }

  private onAimPointer(pointer: Phaser.Input.Pointer) {
    if (!this.aim) return
    // tap sur le bouton Annuler (coords écran) → on sort sans rien consommer
    if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.aim.cancelAt.x, this.aim.cancelAt.y) < 48) { this.cancelAim(); return }
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
    this.confirmZone(wp.x, wp.y)
  }

  private cancelAim() {
    this.announceSkill('Visée annulée', 0x90a4ae)
    this.endAim()
  }

  // nettoie le mode visée : objets + écouteur pointeur
  private endAim() {
    if (!this.aim) return
    this.input.off('pointerdown', this.onAimPointer, this)
    this.aim.reticle.destroy()
    for (const o of this.aim.ui) o.destroy()
    this.aim = null
  }

  // Zone confirmée : NOW on consomme l'énergie + le cooldown, puis on déclenche l'effet sur place.
  private confirmZone(x: number, y: number) {
    if (!this.aim) return
    const { slot, skill } = this.aim
    this.endAim()
    if (!this.cooldowns.canUse(slot, this.time.now)) return
    if (!this.player.spendEnergy(energyCostOf(skill))) { this.announceSkill('Pas assez d\'énergie', 0x4dd0e1); return }
    this.cooldowns.use(slot, this.time.now, skill.cooldownMs)
    this.game.events.emit('skill-cooldown', slot, this.time.now + skill.cooldownMs)
    audio.playSfx('skill')
    this.announceSkill(skill.name)
    const p = getPlayer()
    const rank = p.skillLevels[skill.id] ?? 1
    const mult = skill.multiplier * (1 + 0.25 * (rank - 1))
    const color = this.skillColor(skill.id)
    // clamp de la cible dans les bornes du monde pour rester jouable
    const cx = Phaser.Math.Clamp(x, 40, this.levelDef.widthTiles * TILE - 40)
    const cy = Phaser.Math.Clamp(y, 80, this.groundRow * TILE - 4)
    // dispatch selon la nature du sort de zone : cataclysme (ultime) > météores > mur de flamme > pluie de flèches
    if (skill.id === 'cataclysme') this.executeCataclysm(skill, cx, cy, mult, color)
    else if (skill.meteors) this.executeMeteorRain(skill, cx, cy, mult, color)
    else if (skill.wall) this.executeFlameWall(skill, cx, mult)
    else this.executeArrowRain(skill, cx, cy, mult, color)
  }

  // Pluie de flèches / Nuée de flèches : ~40-64 mini-flèches s'abattent du ciel sur la zone visée,
  // en criblant le secteur par vagues (dégâts répétés). Spectacle : marqueur au sol + rideau dense.
  private executeArrowRain(skill: SkillDef, cx: number, cy: number, mult: number, color: number) {
    const radius = skill.range
    const count = skill.rain ?? 40
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const durationMs = 900

    // marqueur de zone au sol pendant la salve
    const marker = this.add.graphics().setDepth(3)
    const drawMarker = (a: number) => {
      marker.clear()
      marker.fillStyle(color, 0.12 * a).fillCircle(cx, cy, radius)
      marker.lineStyle(3, color, 0.4 + 0.4 * a).strokeCircle(cx, cy, radius)
    }
    drawMarker(1)
    this.tweens.addCounter({ from: 1, to: 0, duration: durationMs + 200, onUpdate: (tw) => drawMarker(tw.getValue() ?? 0), onComplete: () => marker.destroy() })

    // rideau de flèches qui tombent (visuel pur, non physique → dense et fluide)
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(Phaser.Math.Between(0, durationMs), () => {
        const ax = cx + Phaser.Math.FloatBetween(-radius, radius)
        const startY = cy - 340 - Phaser.Math.Between(0, 70)
        const landY = cy + Phaser.Math.Between(-10, 12)
        const arrow = this.add.image(ax, startY, 'fx-arrow').setTint(color).setRotation(Math.PI / 2).setScale(1.15).setDepth(7)
        this.tweens.add({
          targets: arrow, y: landY, duration: Phaser.Math.Between(200, 280), ease: 'Quad.in',
          onComplete: () => { this.impactFx(ax, landY, color); arrow.destroy() },
        })
      })
    }

    // dégâts répétés : plusieurs vagues sur toute la durée de la pluie
    const ticks = 5
    for (let t = 0; t < ticks; t++) {
      this.time.delayedCall(120 + t * (durationMs / ticks), () => {
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e.active && Phaser.Math.Distance.Between(cx, cy, e.x, e.y) <= radius * 1.08) e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.45))
        }
        for (const obj of this.props.getChildren()) {
          const prop = obj as Prop
          if (prop.active && Phaser.Math.Distance.Between(cx, cy, prop.x, prop.y) <= radius * 1.08) prop.takeDamage(1)
        }
      })
    }
    this.screenShake(0.004, 220)
    audio.playSfx('hit')
  }

  // ===== Mage / Sorcier : boule de feu, éclairs, mur de flamme, pluie de météores, cataclysme =====

  // Petite explosion (gerbe de feu) à l'impact de la grosse boule de feu : effet + splash aux alentours.
  private doFireballBlast(proj: Projectile) {
    const data = proj.blast
    if (!data) return
    const x = proj.x, y = proj.y
    this.explosionFx(x, y, data.radius, data.color)
    this.screenShake(0.005, 130)
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= data.radius) {
        e.takeDamage(physicalDamage(proj.damage * 0.5, e.effectiveDef()))
      }
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      if (prop.active && Phaser.Math.Distance.Between(x, y, prop.x, prop.y) <= data.radius) prop.takeDamage(1)
    }
  }

  // Éclairs foudroyants : décharge FRONTALE à courte portée. Dégâts dévastateurs à tous les ennemis
  // devant le mage dans la portée + gros éclairs bleus zigzaguants ramifiés, flash et secousse.
  private castLightning(skill: SkillDef, mult: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const reach = skill.range
    this.player.playAttack()
    let touched = false
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      const dx = (e.x - px) * f
      if (dx >= -24 && dx <= reach && Math.abs(e.y - py) <= 140) {
        e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult))
        touched = true
      }
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      const dx = (prop.x - px) * f
      if (prop.active && dx >= -24 && dx <= reach && Math.abs(prop.y - py) <= 140) prop.takeDamage(1)
    }
    this.lightningFx(px + f * 14, py, reach)
    this.flashScreen(0xcfe8ff, 0.32, 130)
    this.screenShake(0.013, 210)
    this.hitStop(70)
    if (touched) audio.playSfx('hit')
  }

  // Gros éclairs bleus zigzaguants (avec branches) projetés devant le mage + cœur blanc + halo + éclats.
  private lightningFx(x: number, y: number, reach: number) {
    const f = this.player.facing
    const bolt = (yJitter: number, thick: number, col: number, alpha: number) => {
      const g = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
      g.lineStyle(thick, col, alpha).beginPath()
      let cx = x, cy = y + yJitter
      g.moveTo(cx, cy)
      const segs = 7
      for (let i = 1; i <= segs; i++) {
        cx = x + f * (reach * i) / segs
        cy = y + yJitter + Phaser.Math.Between(-36, 36)
        g.lineTo(cx, cy)
        if (i % 2 === 0) { g.lineTo(cx + f * 20, cy + Phaser.Math.Between(-26, 26)); g.moveTo(cx, cy) } // branche
      }
      g.strokePath()
      this.tweens.add({ targets: g, alpha: 0, duration: 220, delay: 50, onComplete: () => g.destroy() })
    }
    for (let b = 0; b < 3; b++) bolt(Phaser.Math.Between(-32, 32), 6, 0x64b5ff, 0.9)
    bolt(0, 3, 0xffffff, 1) // cœur blanc éclatant
    this.burstParticles(x, y, 14, 0x64b5ff, { speed: 95, size: 5, durationMs: 320 })
    const flash = this.add.image(x, y, 'ring').setTint(0x64b5ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setScale(0.1).setAlpha(0.9)
    this.tweens.add({ targets: flash, scale: 0.75, alpha: 0, duration: 200, onComplete: () => flash.destroy() })
  }

  // Mur de flamme : invoque une barrière de feu STATIQUE à l'endroit visé (entité FlameWall). Elle
  // brûle et bloque les ennemis tant qu'elle dure ; ici on gère l'embrasement d'invocation + FX.
  private executeFlameWall(skill: SkillDef, cx: number, mult: number) {
    const cfg = skill.wall!
    const groundY = this.groundRow * TILE - 4
    const width = skill.range * 2
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const dmgPerTick = Math.max(1, atk * mult * 0.3)
    const wall = new FlameWall(this, cx, groundY, width, cfg.height, dmgPerTick)
    this.flameWalls.add(wall)
    wall.activate(cfg.durationMs)
    this.aoeRing(cx, groundY, skill.range, 0xff7043, true)
    this.screenShake(0.006, 180)
    this.flashScreen(0xff7043, 0.12, 150)
  }

  // Pluie de météores : quelques (5-8) météores enflammés tombent du ciel sur la zone visée et
  // EXPLOSENT à l'impact (explosionFx + secousse + dégâts de zone + brûlure). Spectaculaire.
  private executeMeteorRain(skill: SkillDef, cx: number, cy: number, mult: number, color: number) {
    const radius = skill.range
    const count = skill.meteors ?? 6
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const f = this.player.facing

    // marqueur de zone au sol pendant la pluie
    const marker = this.add.graphics().setDepth(3)
    const drawMarker = (a: number) => {
      marker.clear()
      marker.fillStyle(color, 0.12 * a).fillCircle(cx, cy, radius)
      marker.lineStyle(3, color, 0.4 + 0.4 * a).strokeCircle(cx, cy, radius)
    }
    drawMarker(1)
    this.tweens.addCounter({ from: 1, to: 0, duration: 1500, onUpdate: (tw) => drawMarker(tw.getValue() ?? 0), onComplete: () => marker.destroy() })

    for (let i = 0; i < count; i++) {
      this.time.delayedCall(Phaser.Math.Between(0, 900), () => {
        const mx = cx + Phaser.Math.FloatBetween(-radius, radius)
        const landY = cy + Phaser.Math.Between(-8, 12)
        const startY = landY - 400
        const startX = mx - f * 130 // chute en biais
        // météore ARDENT : halo ADD + corps OPAQUE rouge/orange + cœur jaune vif (lisible sur ciel clair)
        const meteor = this.add.container(startX, startY, [
          this.add.circle(0, 0, 22, 0xff7043).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55),
          this.add.circle(0, 0, 15, 0xe64a19).setAlpha(0.98),
          this.add.circle(0, 0, 9, 0xff7043).setAlpha(0.98),
          this.add.circle(0, 0, 4.5, 0xffee58).setAlpha(1),
        ]).setDepth(8)
        const trail = this.time.addEvent({
          delay: 18, loop: true, callback: () => {
            if (!meteor.active) { trail.remove(); return }
            const col = Phaser.Math.RND.pick([0xffee58, 0xffca28, 0xff7043, 0xff5252])
            const pcl = this.add.circle(meteor.x, meteor.y, Phaser.Math.Between(4, 8), col).setDepth(7).setAlpha(0.9)
            this.tweens.add({ targets: pcl, alpha: 0, scale: 0.2, duration: 340, onComplete: () => pcl.destroy() })
          },
        })
        this.tweens.add({
          targets: meteor, x: mx, y: landY, duration: Phaser.Math.Between(360, 470), ease: 'Quad.in',
          onComplete: () => {
            trail.remove(); meteor.destroy()
            const blast = 86
            this.explosionFx(mx, landY, blast, 0xff7043)
            this.screenShake(0.008, 150)
            audio.playSfx('hit')
            for (const obj of this.enemies.getChildren()) {
              const e = obj as Enemy
              if (e.active && Phaser.Math.Distance.Between(mx, landY, e.x, e.y) <= blast) {
                e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.6))
                e.applyBurn(atk * 0.15, 2200)
              }
            }
            for (const obj of this.props.getChildren()) {
              const prop = obj as Prop
              if (prop.active && Phaser.Math.Distance.Between(mx, landY, prop.x, prop.y) <= blast) prop.takeDamage(1)
            }
          },
        })
      })
    }
    this.flashScreen(0xff7043, 0.12, 200)
  }

  // Cataclysme (ultime du Sorcier) : le ciel se déchire sur la zone — pluie de météores massive +
  // colonnes de feu qui jaillissent du sol + déflagrations en chaîne + flash rouge et grosse secousse.
  private executeCataclysm(skill: SkillDef, cx: number, cy: number, mult: number, color: number) {
    this.flashScreen(0xff3b30, 0.4, 240)
    this.cameras.main.flash(170, 255, 170, 110)
    this.screenShake(0.02, 620)
    this.hitStop(90)
    this.executeMeteorRain(skill, cx, cy, mult, color)
    const radius = skill.range
    const groundY = this.groundRow * TILE - 4
    // colonnes de feu en travers de la zone
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 140, () => this.firePillarFx(cx + Phaser.Math.FloatBetween(-radius, radius), groundY))
    }
    // déflagrations en chaîne qui ravagent le secteur
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(300 + i * 200, () => {
        const bx = cx + Phaser.Math.FloatBetween(-radius, radius)
        const by = cy + Phaser.Math.Between(-30, 20)
        this.explosionFx(bx, by, 118, 0xff5252)
        const atk = this.player.stats.atk * this.player.outgoingMult()
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e.active && Phaser.Math.Distance.Between(bx, by, e.x, e.y) <= 122) e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.4))
        }
      })
    }
  }

  // Colonne de feu qui jaillit du sol (cataclysme) : gaine orangée + cœur jaune vif qui montent
  // d'un coup puis s'estompent, avec gerbe de braises au sommet.
  private firePillarFx(x: number, groundY: number) {
    const h = Phaser.Math.Between(150, 220)
    const pillar = this.add.rectangle(x, groundY, 26, h, 0xff7043).setOrigin(0.5, 1).setDepth(6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).setScale(1, 0.2)
    const core = this.add.rectangle(x, groundY, 10, h, 0xffee58).setOrigin(0.5, 1).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95).setScale(1, 0.2)
    this.tweens.add({
      targets: [pillar, core], scaleY: 1, duration: 160, ease: 'Cubic.out',
      onComplete: () => this.tweens.add({ targets: [pillar, core], alpha: 0, scaleY: 1.15, duration: 260, onComplete: () => { pillar.destroy(); core.destroy() } }),
    })
    this.burstParticles(x, groundY - h * 0.4, 12, 0xffca28, { speed: 80, size: 6, durationMs: 400, spreadUp: true })
  }

  // Touche les ennemis/props devant le panda (ou pile sur lui), avec grande tolérance
  // verticale : le centre du grand sprite panda est plus haut que celui des monstres.
  meleeHit(reach: number, multiplier: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const flaming = this.player.isFlaming() // Épée enflammée : les coups appliquent une brûlure
    let touched = false
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active && inMeleeReach((e.x - px) * f, Math.abs(e.y - py), reach)) {
        e.takeDamage(physicalDamage(atk, e.effectiveDef(), multiplier))
        if (flaming) e.applyBurn(atk * 0.35, 3000)
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
    if (itemId) {
      p.inventory.push(itemId)
      this.showLootReveal(itemId)
    }
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

  // Présentation de loot valorisante quand un équipement est ramassé (drop de monstre / coffre).
  // Purement visuel, non bloquant : icône en GROS au centre-écran, halo + rayons tournants +
  // éclats scintillants teintés selon la rareté, nom coloré dessous. Plus la rareté est haute,
  // plus c'est spectaculaire. N'affecte ni la logique de drop ni l'inventaire.
  // File d'attente : si plusieurs équipements tombent en même temps (coffre), on les présente
  // l'un après l'autre plutôt qu'en les empilant → chaque icône/nom reste lisible.
  private lootQueue: string[] = []
  private lootBusy = false
  private showLootReveal(itemId: string) {
    const def = ITEMS[itemId]
    if (!def || !def.slot) return // seul l'équipement (arme/armure/chapeau/accessoire) est présenté
    this.lootQueue.push(itemId)
    if (!this.lootBusy) this.pumpLootQueue()
  }
  private pumpLootQueue() {
    const next = this.lootQueue.shift()
    if (next === undefined) { this.lootBusy = false; return }
    this.lootBusy = true
    this.runLootReveal(next)
  }
  private runLootReveal(itemId: string) {
    const def = ITEMS[itemId]!
    const color = rarityColor(def.rarity)
    const tier = ({ commun: 0, rare: 1, epique: 2, legendaire: 3 } as const)[def.rarity ?? 'commun'] ?? 0
    const ADD = Phaser.BlendModes.ADD

    const cx = 480
    const cy = 236
    const holdMs = 900 + tier * 260 // plus rare = reste plus longtemps
    const totalMs = 360 + holdMs + 420

    const objs: Phaser.GameObjects.GameObject[] = []
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o }

    // halo lumineux (disque additif qui pulse) — plus large et intense selon la rareté
    const haloR = 70 + tier * 26
    const halo = track(this.add.circle(cx, cy, haloR, color, 0.28 + tier * 0.05))
      .setScrollFactor(0).setDepth(60).setBlendMode(ADD).setScale(0.2)
    this.tweens.add({ targets: halo, scale: 1, duration: 320, ease: 'Cubic.out' })
    this.tweens.add({ targets: halo, alpha: halo.alpha * 0.55, scale: 1.12, duration: 620, yoyo: true, repeat: -1, delay: 320, ease: 'Sine.inOut' })

    // rayons lumineux qui tournent (réutilise la texture 'title-rays') — dès la rareté rare
    if (tier >= 1) {
      const raysScale = (haloR * 2.4) / 1200
      const rays = track(this.add.image(cx, cy, 'title-rays').setTint(color))
        .setScrollFactor(0).setDepth(59).setBlendMode(ADD).setAlpha(0).setScale(raysScale * 0.6)
      this.tweens.add({ targets: rays, alpha: 0.5 + tier * 0.1, scale: raysScale, duration: 340, ease: 'Cubic.out' })
      this.tweens.add({ targets: rays, angle: 40 + tier * 30, duration: totalMs, ease: 'Sine.inOut' })
    }

    // éclats scintillants (screen-space) — nombre croissant avec la rareté
    const sparkle = (delay: number) => {
      const n = 6 + tier * 5
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3)
        const reach = (haloR + 10) * Phaser.Math.FloatBetween(0.5, 1.1)
        const sz = Phaser.Math.Between(3, 5 + tier)
        const p = this.add.rectangle(cx, cy, sz, sz, i % 4 === 0 ? 0xffffff : color)
          .setScrollFactor(0).setDepth(61).setBlendMode(ADD).setRotation(a).setAlpha(0)
        this.tweens.add({
          targets: p, x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach,
          alpha: { from: 1, to: 0 }, scale: 0.3, delay, duration: 460 + tier * 60, ease: 'Cubic.out',
          onComplete: () => p.destroy(),
        })
      }
    }
    sparkle(0)
    if (tier >= 2) this.time.delayedCall(holdMs * 0.5, () => { if (this.sys.isActive()) sparkle(0) })

    // légendaire : petit flash doré plein écran pour marquer le coup (non bloquant)
    if (tier >= 3) this.flashScreen(color, 0.22, 220)

    // ICÔNE en GROS : pop (Back.out) puis pulse doux pendant le maintien
    const iconKey = this.textures.exists(`item-${itemId}`) ? `item-${itemId}` : 'item-drop'
    const icon = track(this.add.image(cx, cy, iconKey)).setScrollFactor(0).setDepth(62)
    const targetH = 108 + tier * 18
    const baseScale = targetH / Math.max(1, icon.height)
    icon.setScale(0)
    this.tweens.add({ targets: icon, scale: baseScale, duration: 360, ease: 'Back.out' })
    this.tweens.add({ targets: icon, scale: baseScale * 1.06, duration: 560, yoyo: true, repeat: -1, delay: 360, ease: 'Sine.inOut' })

    // liseré de rareté (anneau) autour de l'icône pour les hautes raretés
    if (tier >= 2) {
      const ring = track(this.add.image(cx, cy, 'ring').setTint(color)).setScrollFactor(0).setDepth(61).setBlendMode(ADD)
      ring.setScale((targetH * 1.25) / 64).setAlpha(0)
      this.tweens.add({ targets: ring, alpha: 0.9, duration: 320, ease: 'Cubic.out' })
      this.tweens.add({ targets: ring, angle: -60, duration: totalMs, ease: 'Sine.inOut' })
    }

    // NOM de l'objet, couleur = rareté
    const hex = `#${color.toString(16).padStart(6, '0')}`
    const name = track(this.add.text(cx, cy + targetH * 0.62, def.name, {
      fontSize: `${20 + tier * 2}px`, fontStyle: 'bold', color: hex,
      stroke: '#000000', strokeThickness: 4, align: 'center',
    })).setOrigin(0.5).setScrollFactor(0).setDepth(62).setAlpha(0)
    this.tweens.add({ targets: name, alpha: 1, y: name.y - 6, duration: 300, delay: 200, ease: 'Cubic.out' })

    // son de récompense si dispo (pop selon la rareté)
    audio.playSfx(tier >= 2 ? 'level-up' : 'buy')

    // sortie commune : tout monte légèrement et se dissout, puis destruction
    this.time.delayedCall(360 + holdMs, () => {
      const live = objs.filter((o) => o.scene)
      if (!this.sys.isActive()) { live.forEach((o) => o.destroy()); return }
      this.tweens.killTweensOf(live as unknown as object[])
      this.tweens.add({
        targets: live, alpha: 0, y: '-=24', duration: 420, ease: 'Cubic.in',
        onComplete: () => {
          live.forEach((o) => o.destroy())
          if (this.sys.isActive()) this.pumpLootQueue() // enchaîne l'objet suivant en file
        },
      })
    })
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
    // cascades décoratives : le rideau d'eau défile vers le bas (effet de chute continue)
    for (const wf of this.waterfalls) wf.tilePositionY += delta * 0.4
    // cascades REMONTABLES : le rideau défile vers le BAS (écoulement visible — on COMPREND que ça
    // coule, et qu'on le REMONTE à contre-courant)
    for (const cs of this.cascadeSprites) cs.tilePositionY += delta * 0.45
    if (this.aim) this.updateAimReticle()
    if (this.player.hp <= 0) return
    // chute mortelle : uniquement quand le panda a plongé jusqu'au fond du monde dans un vrai trou
    this.checkPitDeath()
    if (this.player.hp <= 0) return
    this.player.regenEnergy(delta)
    // zones verticales chevauchées (échelle / eau) lues sur le centre du panda
    const onLad = this.ladderRects.find((r) => r.contains(this.player.x, this.player.y))
    this.player.onLadder = !!onLad
    if (onLad) this.player.ladderCenterX = onLad.centerX
    // cascade REMONTABLE : on nage/grimpe dedans sans noyade (inCascade) ; le bassin marine, lui,
    // noie (waterRects). inWater (mécanique de nage) couvre les deux.
    this.player.inCascade = this.cascadeRects.some((r) => r.contains(this.player.x, this.player.y))
    this.player.inWater = this.player.inCascade || this.waterRects.some((r) => r.contains(this.player.x, this.player.y))
    this.updateWater(delta)
    this.updateLava(delta)
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
