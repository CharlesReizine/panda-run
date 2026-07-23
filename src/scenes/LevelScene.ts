import Phaser from 'phaser'
import { LEVELS, type LevelDef } from '../data/levels'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { BossController } from '../entities/BossController'
import { Projectile } from '../entities/Projectile'
import { Prop } from '../entities/Prop'
import { FlameWall } from '../entities/FlameWall'
import { MONSTERS } from '../data/monsters'
import { PROPS } from '../data/props'
import { MATERIALS } from '../data/materials'
import { ITEMS, rarityColor } from '../data/items'
import { physicalDamage, inMeleeReach } from '../core/combat'
import { grantXp, playerXpGain } from '../core/progression'
import { emptyControls, mergeControls, type ControlsState } from '../core/controls'
import { getPlayer } from '../state'
import { basicAttackCooldownFactor } from '../core/stats'
import { save } from '../core/save'
import { CooldownTracker, energyCostOf } from '../core/skill-executor'
import { ENERGY_ON_BASIC_HIT } from '../entities/Player'
import { SKILLS, skillDamageMult, CHARGE_MIN_MULT } from '../data/skills'
import { hpRegenPerSec } from '../core/stats'
import { rollDrops, rollChestRareItem } from '../core/loot'
import { recordKill } from '../core/player-state'
import type { DropEntry, SkillDef } from '../core/types'
import type { UIScene } from './UIScene'
import { TILE, DEFAULT_HEIGHT_TILES, groundRowFor, GRAVITY, landsOnOneWayPlatform } from '../core/platforming'
import { breathMaxMs, BREATH_BASE_MS } from '../core/breath'
import { BIOMES } from '../data/biomes'
import { audio, type MusicTrack } from '../audio/audio-engine'

// biomes → piste musicale ; 'carriere' n'a pas d'ambiance dédiée → repli sur 'montagne'
const BIOME_TRACKS: Record<string, MusicTrack> = {
  plaine: 'plaine', foret: 'foret', desert: 'desert', cave: 'cave', jungle: 'jungle',
  montagne: 'montagne', plage: 'plage', carriere: 'montagne', cimetiere: 'cimetiere', enfer: 'enfer',
}

// largeur de la barre de vie du boss (centrée sous son nom)
const BOSS_BAR_W = 440

// Durée (ms) pour charger une attaque chargeable à FOND (relâchée avant = plus faible).
const CHARGE_FULL_MS = 850

// Plongée sous l'eau : le panda peut s'enfoncer sous la surface (traversée verticale), mais tant
// que sa TÊTE reste immergée il retient son souffle un court instant (apnée) puis se noie
// PROGRESSIVEMENT — jamais de mort instantanée. Le souffle se recharge dès qu'il ressort la tête.
// délai de grâce d'apnée AVANT la noyade. Il n'est plus fixe : le MAX dépend du NIVEAU DU PERSO
// (breathMaxMs = 5000 + 250·niveau, cf. core/breath.ts). BREATH_BASE_MS ne sert que d'initialisation
// avant que la scène ne connaisse le joueur ; toutes les bornes réelles passent par this.breathMax().
const BREATH_RECHARGE_MULT = 3 // le souffle se recharge 3× plus vite qu'il ne se vide (retour surface = répit rapide)
const DROWN_DPS = 4 // PV perdus par seconde une fois le souffle épuisé — adouci (rythme de noyade plus doux)
const DROWN_TICK_MS = 300 // cadence des ticks de noyade : perte régulière, jamais d'un coup
const BUBBLE_INTERVAL_MS = 170 // intervalle d'émission des bulles tant que la tête est sous l'eau
// LAVE (enfer) : cuve de pierre incandescente, MORTELLE au contact. On ne nage pas dedans — le contact
// inflige de gros dégâts continus (chemin de dégâts standard, cf. drownTick) → y tomber tue vite.
const LAVA_DPS = 120 // PV perdus par seconde au contact de la lave (bien plus violent que la noyade)
const LAVA_TICK_MS = 150 // cadence des ticks de brûlure : perte rapide et régulière
// FLAMMES AU SOL (ex-« pics ») : mur de flammes du mage posé comme piège de terrain. NE tue PLUS d'un
// coup — brûle 30 % des PV MAX par seconde, INDÉPENDAMMENT du niveau (danger constant, jamais fatal
// instantanément → ~3,3 s dans les flammes pour un K.O. plein). Même modèle de tick que la lave/noyade.
const FLAME_HP_FRAC_PER_SEC = 0.30 // fraction des PV MAX perdue par seconde dans les flammes
const FLAME_TICK_MS = 150 // cadence des ticks de brûlure des flammes
// RAMASSABLES (butin) : « rien au sol, tout lévite ». Une fois posé/flottant, l'objet se relève d'un
// cran au-dessus du sol (LIFT) et ondule verticalement de ±BOB → lévitation douce qui attire l'œil.
const PICKUP_HOVER_LIFT = 14 // hauteur (px) au-dessus du point d'atterrissage (jamais posé au sol)
const PICKUP_HOVER_BOB = 6 // amplitude (px) du va-et-vient vertical de lévitation

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
  // ÉCLABOUSSURE d'entrée : état d'immersion de la frame précédente, pour détecter le front montant
  // (hors-eau → dans l'eau) au moment où le panda franchit la surface et déclencher la gerbe de gouttes.
  private wasInWater = false
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
  // FLAMMES AU SOL (ex-pics) : zones de brûlure continue (30 % PV max/s, cf. updateFlames). Rendu =
  // image du mur de flammes du mage, légèrement animée. Pas de corps physique (détection par rect).
  private flameRects: Phaser.Geom.Rectangle[] = []
  private flameAccumMs = 0
  // Plongée : réserve d'apnée restante (ms), accumulateurs de ticks de noyade et d'émission de
  // bulles, voile bleuté quand la tête est immergée, petite jauge d'apnée au-dessus de la tête.
  private breathMs = BREATH_BASE_MS
  private drownAccumMs = 0
  private bubbleAccumMs = 0
  // POCHES D'AIR (niveaux immergés) : zones de recharge de souffle (bulles d'air respirable). Touchées
  // par le panda → le souffle remonte au max, comme une surface locale. Vide hors niveau immergé.
  private airPocketRects: Phaser.Geom.Rectangle[] = []
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
  // chiffres de dégâts flottants actifs (garde-fou de perf : au-delà du plafond on n'en crée plus)
  private activeDamageNumbers = 0
  private passiveHealAccum = 0 // PV de régén passive cumulés, affichés en chiffre vert par paquets
  private passiveHealFlushAt = 0
  private dashUntil = 0
  private dashCooldownUntil = 0
  private nextBasicAttackAt = 0
  private cooldowns = new CooldownTracker()
  private boss: Enemy | null = null
  private bossBar: Phaser.GameObjects.Rectangle | null = null
  private bossBarBg: Phaser.GameObjects.Rectangle | null = null
  private bossName: Phaser.GameObjects.Text | null = null
  // Contrôleur de boss (« MVP une classe ») : pilote locomotion, télégraphes, skills, invocations
  // et phases. Remplace l'ancienne salve scriptée générique.
  private bossCtrl: BossController | null = null
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

  // MAINTIEN (canalisé / chargé) : un seul sort tenu à la fois. La source d'entrée (touche 1-4 ou
  // pointeur du bouton de slot) est capturée au lancement pour savoir quand le bouton est RELÂCHÉ.
  private held: {
    slot: number; skill: SkillDef; mode: 'channel' | 'charge'
    key?: Phaser.Input.Keyboard.Key; pointer?: Phaser.Input.Pointer
    startedAt: number; nextTickAt: number
    fx?: Phaser.GameObjects.GameObject[]
  } | null = null
  private slotKeys: (Phaser.Input.Keyboard.Key | undefined)[] = []

  // MODE ENTRAÎNEMENT (TrainingScene) : quand vrai, le joueur ne subit aucun dégât (hitPlayer no-op),
  // aucune porte de sortie n'est posée, et le HUD est lancé en mode entraînement. Faux en jeu normal.
  protected training = false
  // MODE TEST DE NIVEAUX (LevelTestScene) : on charge un VRAI niveau mais le joueur est INVINCIBLE
  // (aucun dégât, aucune chute mortelle) pour se balader et inspecter la géométrie. Retour au sélecteur
  // via un bouton dédié ou en atteignant la sortie. N'écrit rien dans la sauvegarde.
  protected testMode = false

  // clé de scène paramétrable : 'Level' en jeu normal, 'Training' pour la scène d'entraînement qui
  // hérite de toute la machinerie (sol, joueur, skills, HUD) sans dupliquer le code.
  constructor(key = 'Level') { super(key) }

  init(data: { levelId: string; fromNode?: string; targetNode?: string; dir?: 'forward' | 'backward'; test?: boolean }) {
    this.levelDef = LEVELS[data.levelId]!
    this.testMode = data.test ?? false
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
    this.wasInWater = false
    this.waterfalls = []
    this.cascadeRects = []
    this.cascadeSprites = []
    this.lavaRects = []
    this.lavaAccumMs = 0
    this.flameRects = []
    this.flameAccumMs = 0
    this.airPocketRects = []
    // plongée : on entame chaque niveau souffle plein, sans dette de noyade ; les overlays
    // (voile, jauge) sont recréés plus bas (la scène est réutilisée → références remises à zéro)
    this.breathMs = this.breathMax()
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
      if (p.solid) {
        // MARCHE DE PIERRE RIGIDE : texture rocheuse + collision PLEINE (groupe `platforms`, toutes
        // faces) → on ne la traverse PAS, ni par le bas ni par les côtés. Posée isolée (trou d'air
        // entre chaque, cf. escalier-pierre) → aucune arête interne, donc jamais de coincement.
        this.add.tileSprite(p.x * TILE, p.y * TILE, p.w * TILE, TILE, 'basin-wall').setOrigin(0, 0).setDepth(-4)
        this.addStaticBand(platforms, p.x * TILE, p.y * TILE, p.w * TILE, TILE)
      } else {
        // MARCHE DE TERRE : plateforme one-way (traversable par le bas, on se pose dessus en retombant).
        this.add.tileSprite(p.x * TILE, p.y * TILE, p.w * TILE, TILE, platformKey).setOrigin(0, 0).setDepth(-4)
        this.addStaticBand(oneWay, p.x * TILE, p.y * TILE, p.w * TILE, TILE, true)
      }
    }
    // ponts de planches : plateformes fines, elles aussi traversables par le bas. Rendu en UN
    // TileSprite ; collision en UN corps statique par pont. Le visuel ne fait que 12px de haut mais
    // à grande vitesse de chute le joueur pourrait traverser cette fine tranche en un pas de
    // physique (tunneling) → on épaissit le corps (28px) sans toucher au rendu.
    for (const br of this.levelDef.bridges ?? []) {
      this.add.tileSprite(br.x * TILE, br.y * TILE, br.w * TILE, 12, 'bridge').setOrigin(0, 0).setDepth(-4)
      // corps 28px (le visuel ne fait que 12px) : même emprise que l'ancien plank (top br.y*TILE-8)
      this.addStaticBand(oneWay, br.x * TILE, br.y * TILE - 8, br.w * TILE, 28, true)
    }
    // BANDES DE ROCHE (plafond de tunnel + socle de départ) : dalles de pierre PLEINE rendues avec la
    // texture du biome, SANS collision (depth -5, derrière le joueur → il reste toujours visible ; le
    // dégagement sous un plafond est garanti > saut confortable côté assembleur, donc on ne se cogne
    // jamais). Referment visuellement les tunnels (roche dessus + sol/roche dessous) et masquent le
    // dessous de la bande de départ (mesa) → un seul niveau au spawn. Distinct du plafond du MONDE.
    // Texture ROCHEUSE (celle des cuves de lac / grottes, 'basin-wall') pour le CORPS de pierre :
    // socle des falaises/mesas sous la coiffe de biome, plafonds de grotte, support des cascades.
    // Fini le gazon empilé — le corps est de la pierre, seule la coiffe (plateforme) garde le biome.
    for (const rb of this.levelDef.rockBands ?? []) {
      // PLAFOND SOLIDE (rb.solid) : COLLISION pleine → on ne saute PAS à travers. Le dégagement sous le
      // plafond reste > saut confortable (garanti côté assembleur), donc le boyau reste traversable.
      // Socle décoratif (mesa, sous le sol) : aucune collision. Rendu derrière le joueur dans les deux cas.
      this.add.tileSprite(rb.x * TILE, rb.y * TILE, rb.w * TILE, rb.h * TILE, 'basin-wall').setOrigin(0, 0).setDepth(-5)
      if (rb.solid) this.addStaticBand(platforms, rb.x * TILE, rb.y * TILE, rb.w * TILE, rb.h * TILE)
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
    // Les AÉRIENS (oiseaux) traversent le décor : on les exclut des colliders terrain via ce
    // processCallback (ils ne portent plus `checkCollision.none`, qui les rendait intouchables).
    // Les terrestres, eux, collisionnent le sol/les plateformes comme le joueur → ils ne tombent
    // plus à travers la map.
    const groundedEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (eObj) => !((eObj as Enemy).monster?.aerial)
    this.physics.add.collider(this.enemies, platforms, undefined, groundedEnemy)
    this.physics.add.collider(this.enemies, oneWay, undefined, groundedEnemy)

    // Murs de flamme : groupe statique. Collider → les ennemis butent dessus (passage bloqué) ;
    // overlap → tout ennemi au contact prend une brûlure. Les membres détruits quittent le groupe.
    this.flameWalls = this.physics.add.staticGroup()
    this.physics.add.collider(this.enemies, this.flameWalls, undefined, groundedEnemy)
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
    // PANNEAUX « SAUT DE LA FOI » (plongeoir) : décor pur (poteau + flèche vers le bas), dessiné via les
    // primitives — pas un Prop destructible, aucune collision. Invite à plonger dans le lac en contrebas.
    for (const sign of this.levelDef.signs ?? []) {
      const px = sign.x * TILE + TILE / 2
      const py = sign.y * TILE + TILE / 2
      this.add.rectangle(px, py + 6, 4, 26, 0x6d4c41).setOrigin(0.5, 0).setDepth(-3) // poteau
      this.add.rectangle(px, py, 26, 18, 0xffd54f).setOrigin(0.5, 0.5).setDepth(-2).setStrokeStyle(2, 0x6d4c41) // panneau
      this.add.text(px, py, '▼', { fontSize: '15px', color: '#5d4037', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-1) // flèche bas
    }
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

    // flammes = piège de terrain (brûlure continue) ; eau = plan d'eau (bassin / cascade / nappe libre)
    // PAROIS RIGIDES des bassins : corps statiques (un par paroi) qu'on ne traverse PAS en
    // marchant. Collision avec le joueur ET les ennemis. La nage se fait EN DESCENDANT par le HAUT.
    const basinWalls = this.physics.add.staticGroup()
    for (const hz of this.levelDef.hazards ?? []) {
      if (hz.kind === 'spikes') {
        // FLAMMES AU SOL (ex-pics) : `hz.top` = rangée de la surface qui les porte (dessus d'une
        // corniche), absent → au SOL. On réutilise l'image du MUR DE FLAMMES du mage
        // ('fx-mur-de-flamme'), ancrée en bas sur la surface, avec une légère respiration + ondulation
        // pour qu'elle « bouge un peu ». Dégâts = brûlure continue (updateFlames), JAMAIS de one-shot.
        const surfaceTopPx = hz.top !== undefined ? hz.top * TILE : groundTopPx
        const fwPx = hz.w * TILE
        const fhPx = Math.round(TILE * 1.9) // hauteur de la nappe de feu (~2 tuiles, comme les ex-pics)
        const cxPx = hz.x * TILE + fwPx / 2
        if (this.textures.exists('fx-mur-de-flamme')) {
          const fire = this.add.image(cxPx, surfaceTopPx + 2, 'fx-mur-de-flamme')
            .setOrigin(0.5, 1).setDepth(-1).setDisplaySize(fwPx, fhPx)
          const bsx = fire.scaleX, bsy = fire.scaleY
          this.tweens.add({ targets: fire, scaleX: bsx * 1.05, scaleY: bsy * 1.12, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
          this.tweens.add({ targets: fire, x: cxPx - 3, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
        } else {
          // repli sans art : nappe orangée simple (aucun crash si la texture manque)
          this.add.rectangle(cxPx, surfaceTopPx + 2, fwPx, fhPx, 0xff7043, 0.85).setOrigin(0.5, 1).setDepth(-1)
        }
        // zone de brûlure : couvre la nappe de feu posée sur la surface (le centre/les pieds du panda
        // qui marche dedans y tombent) → tick de dégâts continu tant qu'on y reste (updateFlames).
        this.flameRects.push(new Phaser.Geom.Rectangle(hz.x * TILE, surfaceTopPx - fhPx, fwPx, fhPx + 4))
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
        // source rocheuse posée EN TÊTE de rideau (origine bas → la roche coiffe le sommet de la chute
        // sans flotter/déborder au-dessus, cf. ancien origin 0.75 qui la faisait léviter)
        this.add.image(xPx + wPx / 2, topPx, 'waterfall-source').setOrigin(0.5, 1).setDepth(-1)
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
        // PLUS D'ÉCHELLE PLAQUÉE SUR LA CASCADE (retour joueur : « idiot », gros défaut graphique) :
        // la colonne d'eau claire se REMONTE directement (le panda joue l'anim de grimpe, cf. Player).
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

      // NAPPE (basin OU libre) : rendu tuilé en UN TileSprite + liseré de surface + ONDULATION continue.
      this.add.tileSprite(xPx, topPx, wPx, heightPx, 'water').setOrigin(0, 0).setDepth(-3)
      this.add.rectangle(xPx, topPx, wPx, 5, 0x9fdcff, 0.5).setOrigin(0, 0).setDepth(-1)
      this.addSurfaceRipple(xPx, topPx, wPx) // vaguelettes qui bobbent le long de la surface
      this.waterRects.push(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))

      if (hz.water === 'basin') {
        // PUITS/BASSIN CONTENU : parois rocheuses rigides à gauche (colonne hz.x-1) et à droite
        // (colonne hz.x+hz.w). Visuel sur toute la hauteur d'eau ; COLLISION à partir d'une rangée
        // SOUS la surface → on ne traverse jamais la paroi en marchant (blocage latéral au sol),
        // mais on entre/sort librement par le HAUT (plonger, puis remonter à la nage et sortir sur
        // le rebord). Le FOND est le sol du monde (les colonnes d'eau ne sont pas des trous).
        // PASSAGE SOUS-MARIN (hz.openSide) : la paroi ouverte n'est PAS posée → on nage sous la
        // surface et on RESSORT par ce côté (vers la corniche basse voisine). Apnée rallongée (§1).
        const openLeft = hz.openSide === 'left' || hz.openSide === 'both'
        const openRight = hz.openSide === 'right' || hz.openSide === 'both'
        for (const wx of [hz.x - 1, hz.x + hz.w]) {
          if (wx < 0 || wx >= this.levelDef.widthTiles) continue
          if (openLeft && wx === hz.x - 1) continue
          if (openRight && wx === hz.x + hz.w) continue
          this.add.tileSprite(wx * TILE, topPx, TILE, heightPx, 'basin-wall').setOrigin(0, 0).setDepth(-2)
          const collideTopPx = (waterTop + 1) * TILE
          const collideH = (waterBottom + 1) * TILE - collideTopPx
          this.addStaticBand(basinWalls, wx * TILE, collideTopPx, TILE, collideH)
        }
        // déco posée sur la SURFACE du sol (fond du lac) — l'eau recouvre désormais le sol plein
        this.addBasinBottomDeco(hz.x, hz.x + hz.w - 1, this.groundRow - 1)
        // POISSONS : de gros cercles ROUGES qui dérivent dans le bassin (placeholder décoratif, sans
        // visuel dédié ni dégâts — au plus simple : ils vont et viennent dans l'eau).
        this.addFish(new Phaser.Geom.Rectangle(xPx, topPx, wPx, heightPx))
      }
    }
    // PIERRE = SOLIDE dans TOUS les sens (retour user : « les murs ne sont pas traversables, sinon c'est
    // pas bien »). Le joueur ET les ennemis butent sur les parois de bassin/lave. (Les PONTS, eux, restent
    // franchissables par le bas au saut — ce sont des oneWayPlatforms, gérés à part.) Le jeu reste jouable :
    // l'escalier de lacs n'a PAS de paroi interne (openSide), donc rien n'y bloque la traversée.
    this.physics.add.collider(this.player, basinWalls)
    this.physics.add.collider(this.enemies, basinWalls, undefined, groundedEnemy)

    this.addAirPockets()

    // voile bleuté discret, épinglé à l'écran, affiché seulement quand la tête est immergée
    // (alpha piloté dans updateWater). Sous les overlays de menu/K.O. (depth ≥ 20).
    this.submergeVeil = this.add.rectangle(480, 270, 960, 540, 0x0a4a7a, 0)
      .setScrollFactor(0).setDepth(15)

    // plages de colonnes (en tuiles) occupées par une CASCADE remontable : sert à NE PAS dessiner
    // l'échelle parallèle qui borde une cascade (retour joueur : « cascade collée à une échelle,
    // inutile / idiot »). L'échelle reste dans les DONNÉES (zone d'accroche + atteignabilité
    // inchangées, calibration intacte) : on masque seulement son VISUEL — on remonte la cascade en
    // grimpant (anim d'escalade, colonne d'eau claire lisible).
    const cascadeTileRanges = this.cascadeRects.map((r) => ({ x: Math.round(r.x / TILE), w: Math.round(r.width / TILE) }))
    const bordersCascade = (lx: number) => cascadeTileRanges.some((c) => lx >= c.x - 1 && lx <= c.x + c.w)
    // échelles : texture répétée (UN TileSprite par échelle) + zone d'escalade (via ladderRects)
    for (const l of this.levelDef.ladders ?? []) {
      // VISUEL élargi de +50 % (1,5 tuile, centré sur l'échelle) : on ÉTIRE la texture (tileScaleX 1,5)
      // au lieu de la TUILER — sans ça un tileSprite de 48 px sur une texture de 32 px répétait UNE
      // échelle + une DEMI-échelle collée à côté (retour joueur). setTileScale(1.5, 1) → une SEULE
      // échelle large ; le tuilage VERTICAL des barreaux (Y) reste au pas naturel. On SAUTE le dessin
      // des échelles qui bordent une cascade (masquées : on grimpe la cascade elle-même).
      if (!bordersCascade(l.x)) {
        this.add.tileSprite(l.x * TILE - TILE / 4, l.y * TILE, TILE * 1.5, l.h * TILE, 'ladder').setOrigin(0, 0).setDepth(-1).setTileScale(1.5, 1)
      }
      // on descend d'une tuile sous le bas de l'échelle pour pouvoir l'attraper depuis le sol
      // zone d'accroche ÉLARGIE de +50 % : demi-largeur 1,5 tuile (avant : 1 tuile), soit 3 tuiles
      // centrées sur l'échelle → on ne décroche plus involontairement en montant (retour joueur R180).
      this.ladderRects.push(new Phaser.Geom.Rectangle(
        l.x * TILE - TILE, l.y * TILE, TILE * 3, (l.h + 1) * TILE,
      ))
    }

    // contact ennemi → joueur (un CORPS en train de valser — mort humiliante — ne frappe plus).
    // SAUT SUR LA TÊTE (stomp) : si le joueur RETOMBE sur le monstre par le DESSUS, il lui met les
    // dégâts d'une ATTAQUE DE BASE (cf. stompEnemy) et rebondit — pas de contact subi. Sinon, contact
    // classique → le joueur encaisse.
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const en = e as Enemy
      if (en.ragdolling) return
      const pb = this.player.body as Phaser.Physics.Arcade.Body
      const eb = en.body as Phaser.Physics.Arcade.Body
      const stomping = pb.velocity.y > 60 && !pb.blocked.down && pb.bottom <= eb.top + eb.height * 0.5
      if (stomping) { this.stompEnemy(en); return }
      this.hitPlayer(en.monster.atk, en.x)
    })
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, proj) => {
      this.impactFx((proj as Projectile).x, (proj as Projectile).y, 0xff5252)
      this.hitPlayer((proj as Projectile).damage, (proj as Projectile).x)
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
    // objets Key persistants pour tester si une touche de slot est TENUE (canalisé / chargé)
    this.slotKeys = [
      this.input.keyboard!.addKey('ONE'), this.input.keyboard!.addKey('TWO'),
      this.input.keyboard!.addKey('THREE'), this.input.keyboard!.addKey('FOUR'),
    ]
    // ÉCHAP annule une visée de zone en cours (sans rien consommer)
    this.input.keyboard!.on('keydown-ESC', () => { if (this.aim) this.cancelAim() })

    // porte de sortie en fin de niveau (sauf arène de boss : elle n'apparaît qu'à sa mort)
    this.boss = null
    this.bossBar = null
    this.bossBarBg = null
    this.bossName = null
    this.bossCtrl = null
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

    // MODE TEST : bandeau « invincible » + bouton retour au sélecteur (balade libre pour inspecter).
    if (this.testMode) {
      this.add.text(480, 28, '🧪 TEST — invincible', { fontSize: '12px', color: '#80cbc4' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30)
      this.add.text(12, 40, '← Niveaux', { fontSize: '16px', color: '#ffffff', backgroundColor: '#455a64', padding: { x: 10, y: 5 } })
        .setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { audio.playSfx('ui-tap'); this.scene.stop('UI'); this.scene.start('LevelTest') })
    }

    // le HUD est lancé sur la clé de CETTE scène ('Level' ou 'Training') + le drapeau training,
    // pour que barres/énergie se branchent sur la bonne scène et masquent les overlays inadaptés.
    this.scene.launch('UI', { levelKey: this.scene.key, training: this.training })
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
      this.endHold() // coupe un sort maintenu (canalisé / chargé) en cours
      this.hitStopTimer?.remove()
      this.hitStopTimer = null
      this.bossCtrl?.destroy()
      this.bossCtrl = null
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
    // fond PROPRE AU NIVEAU (public/art/bg-<levelId>.jpg) en PRIORITÉ : chaque terrain a ainsi son
    // décor unique, collé à son id, plutôt qu'un seul fond partagé par biome. FALLBACK sur le fond
    // de biome (biome-<clé>) quand le niveau n'a pas d'image dédiée (ex. niveaux de boss), puis sur
    // le décor procédural. Même mise à l'échelle « cover » dans les deux cas.
    const levelKey = `bg-${this.levelDef.id}`
    const biomeKey = `biome-${this.levelDef.biome}`
    const bgKey = this.textures.exists(levelKey) ? levelKey : biomeKey
    const hasBgArt = this.textures.exists(bgKey)
    if (hasBgArt) {
      const src = this.textures.get(bgKey).getSourceImage()
      const cover = Math.max(960 / src.width, 540 / src.height)
      this.add.image(480, 270, bgKey).setScale(cover).setScrollFactor(0).setDepth(-28)
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
  private addStaticBand(group: Phaser.Physics.Arcade.StaticGroup, leftPx: number, topPx: number, wPx: number, hPx: number, topOnly = false) {
    const band = group.create(leftPx + wPx / 2, topPx + hPx / 2, 'tile-plaine') as Phaser.Physics.Arcade.Sprite
    band.setVisible(false)
    const body = band.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(wPx, hPx, false)
    body.position.set(leftPx, topPx)
    body.updateCenter()
    // RÉINDEXATION DU RTREE STATIQUE (sinon on TRAVERSE le sol). Le corps est inséré dans l'arbre
    // spatial des corps statiques AU MOMENT de group.create() — donc à la taille/position de la
    // texture par défaut (32×32 au centre). Après l'avoir redimensionné et repositionné à la main,
    // l'index spatial garde l'ANCIENNE emprise : la recherche de collision (world.step) ne retrouve
    // pas la bande à sa vraie place. Ça restait invisible sur les niveaux à PLUSIEURS bandes (l'arbre
    // finissait cohérent), mais sur une arène à UNE seule bande (entraînement), l'index restait décalé
    // → joueur ET monstres passaient à travers le sol. On réinsère le corps avec ses bornes RÉELLES.
    const tree = this.physics.world.staticTree
    tree.remove(body)
    tree.insert(body)
    // Plateformes ONE-WAY (escaliers/marches, ponts) : collision UNIQUEMENT par le DESSUS. On coupe
    // les faces bas/gauche/droite → Arcade ne peut plus séparer HORIZONTALEMENT sur ces corps, donc
    // le panda ne peut plus se COINCER entre deux marches (le wedge qui gelait le déplacement « entre
    // deux marches »). On passe/traverse librement par les côtés et par le bas ; on se pose sur le
    // dessus. Le processCallback landsFromAbove garde en plus le filtre de retombée.
    if (topOnly) {
      body.checkCollision.down = false
      body.checkCollision.left = false
      body.checkCollision.right = false
    }
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

  // POISSONS DÉCORATIFS qui nagent (dérivent en va-et-vient) dans un bassin. Si une illustration de
  // poisson est présente (textures fish-* chargées en best-effort par PreloadScene, art à générer)
  // → on affiche le SPRITE (variante déterministe, flip selon le sens de nage) ; SINON on retombe sur
  // un GROS CERCLE ROUGE (placeholder). DÉCORATIFS — aucune collision, aucun dégât : au plus simple.
  // Nombre et trajectoires pseudo-aléatoires déterministes sur le rectangle d'eau ; restent immergés.
  private addFish(rect: Phaser.Geom.Rectangle) {
    const rnd = (seed: number) => { const s = Math.sin(seed * 91.7) * 43758.5453; return s - Math.floor(s) }
    // variantes de poisson RÉELLEMENT chargées (les autres → fallback cercle rouge)
    const fishTex = ['fish-poisson', 'fish-poisson-tropical', 'fish-piranha'].filter((k) => this.textures.exists(k))
    const n = Math.max(2, Math.round(rect.width / 120))
    for (let i = 0; i < n; i++) {
      const r = rnd(rect.x + i * 7 + 1)
      const radius = 9 + r * 6 // gros cercles / gabarit du sprite
      const y = rect.top + 24 + rnd(rect.x + i * 13 + 3) * Math.max(20, rect.height - 48)
      const margin = radius + 6
      const xL = rect.left + margin
      const xR = Math.max(xL + 20, rect.right - margin)
      const startX = xL + rnd(rect.x + i * 5) * (xR - xL)
      const duration = 2600 + r * 2200
      if (fishTex.length) {
        // SPRITE : variante déterministe parmi les textures présentes, mise à l'échelle sur ~2 rayons
        // de haut. Le tween part vers la DROITE puis revient (yoyo) → on flippe selon le sens de nage.
        const key = fishTex[Math.floor(rnd(rect.x + i * 17 + 5) * fishTex.length) % fishTex.length]!
        const spr = this.add.image(startX, y, key).setDepth(-1)
        spr.setScale((radius * 2.4) / Math.max(1, spr.height))
        this.tweens.add({
          targets: spr, x: xR, duration, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 300,
          onRepeat: () => spr.setFlipX(false), onYoyo: () => spr.setFlipX(true),
        })
      } else {
        // FALLBACK : gros cercle rouge (placeholder, tant que l'art des poissons n'existe pas)
        const circle = this.add.circle(startX, y, radius, 0xe53935, 0.9).setDepth(-1)
        this.tweens.add({ targets: circle, x: xR, duration, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 300 })
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
  // toujours gauche→droite : apparition à gauche, sortie à droite (plus de niveau « à l'envers »)
  private spawnX(): number { return 2 * TILE }
  private exitX(): number { return this.levelDef.widthTiles * TILE - 2 * TILE }

  // processCallback des plateformes one-way : la collision n'est retenue que si le panda RETOMBE
  // franchement PAR LE DESSUS de la marche. On teste sur les pieds en DÉBUT de frame (pb.prev.y),
  // c.-à-d. AVANT la chute de la frame courante : lors d'une vraie retombée ils étaient encore
  // AU-DESSUS du dessus (bornés par la marge = distance chutable en une frame, anti-tunneling).
  // Renvoyer false = AUCUNE séparation (ni verticale ni horizontale) → le panda ne peut plus se
  // COINCER contre la CONTREMARCHE (face verticale) d'un escalier : ses pieds y sont alors sous le
  // dessus de la marche visée (contact LATÉRAL), donc rejetés → fini le gel « entre deux marches ».
  // (Ancien seuil = plat.bottom, dessous de la dalle : il acceptait les contacts latéraux dans la
  // bande de 32 px sous le dessus et provoquait le wedge horizontal.)
  private readonly landsFromAbove: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, platObj) => {
    const pb = (playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body
    const plat = (platObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.StaticBody
    const margin = Math.abs(pb.velocity.y) * (this.game.loop.delta / 1000) + 4
    return landsOnOneWayPlatform(pb.prev.y + pb.height, pb.velocity.y, plat.top + margin)
  }

  createExit() {
    // ENTRAÎNEMENT : aucune porte de sortie — on ne « termine » pas l'arène (retour via les boutons dédiés).
    if (this.training) return
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

    // le contrôleur prend la main sur le boss (locomotion + skills + télégraphes + phases)
    this.bossCtrl = new BossController(this, boss)
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

  // ═══════════════ API BOSS (utilisée par BossController — « MVP une classe ») ═══════════════
  // Ces helpers ENCAPSULENT les FX (aoeRing/explosionFx/impactFx/burstParticles restent privés) et
  // le pipeline de dégâts (hitPlayer respecte god mode + invulnérabilité). Le contrôleur ne gère que
  // le TIMING, les TÉLÉGRAPHES et l'ENCHAÎNEMENT des skills — jamais le rendu bas niveau.

  // dessus du sol de l'arène (px) — repère commun des frappes au sol / invocations.
  groundTopY(): number { return this.groundRow * TILE }
  // bas du monde (px) : sous cette ligne, plus rien de jouable — sert de garde-fou anti-chute.
  worldFloorY(): number { return this.worldH }
  // dessus RÉEL de la bande de sol (surface solide sur laquelle on se pose) — décalé d'une demi-tuile
  // sous groundTopY (cf. groundTopPx dans create). Sert au filet de sécurité des monstres.
  groundSurfaceY(): number { return this.groundRow * TILE + TILE / 2 }
  // largeur jouable de l'arène (px).
  arenaWidthPx(): number { return this.levelDef.widthTiles * TILE }

  // Invoque un ADD (mob de la zone) au sol à la colonne xPx (bornée à l'arène), ajouté au groupe des
  // ennemis (il combat comme un mob normal). Volute d'invocation à l'apparition. Renvoie l'ennemi.
  bossSpawnAdd(monsterId: string, xPx: number): Enemy | null {
    const def = MONSTERS[monsterId]
    if (!def) return null
    const gy = this.groundRow * TILE
    const x = Phaser.Math.Clamp(xPx, 48, this.arenaWidthPx() - 48)
    const e = new Enemy(this, x, gy - 40, def)
    this.enemies.add(e)
    this.aoeRing(x, gy - 20, 46, 0xab47bc, true)
    this.burstParticles(x, gy - 20, 12, 0xce93d8, { speed: 80, size: 4, durationMs: 420, spreadUp: true })
    return e
  }

  // Tir DIRIGÉ du boss vers un point : projectile ennemi thématique (texture/échelle/portée libres).
  bossShoot(fromX: number, fromY: number, targetX: number, targetY: number, damage: number, tex = 'fx-shot', scale = 1.2, rangePx = 1000) {
    const p = new Projectile(this, fromX, fromY, targetX - fromX, targetY - fromY, damage, false, rangePx)
    p.setTexture(tex).clearTint().setScale(scale)
    this.enemyProjectiles.add(p)
    p.launch()
  }

  // Explosion INSTANTANÉE de zone (retombée de slam/plongeon) : gros FX + dégâts au joueur s'il est
  // dans le rayon au moment de l'impact (évitable si on a dégagé la zone à temps).
  bossExplode(xPx: number, yPx: number, radius: number, damage: number, color: number) {
    this.explosionFx(xPx, yPx, radius, color)
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, xPx, yPx) <= radius) this.hitPlayer(damage)
  }

  // Frappe de zone TÉLÉGRAPHIÉE au sol : marqueur qui se remplit `delayMs`, PUIS onde + dégâts si le
  // joueur est encore dans le cercle (rayon/couleur/délai paramétrables — lisible et évitable).
  bossTelegraphStrike(xPx: number, radius: number, delayMs: number, damage: number, color: number) {
    const groundY = this.groundRow * TILE - 10
    const marker = this.add.graphics().setDepth(4)
    const draw = (fill: number) => {
      marker.clear()
      marker.fillStyle(color, 0.12 + fill * 0.3).fillCircle(xPx, groundY, radius)
      marker.lineStyle(3, color, 0.5 + fill * 0.5).strokeCircle(xPx, groundY, radius)
    }
    draw(0)
    this.tweens.addCounter({ from: 0, to: 1, duration: delayMs, onUpdate: (tw) => draw(tw.getValue() ?? 0) })
    this.time.delayedCall(delayMs, () => {
      marker.destroy()
      if (!this.sys.isActive()) return
      this.bossExplode(xPx, groundY, radius, damage, color)
    })
  }

  // Coup de MÊLÉE du boss : croissant tranchant devant lui (sens du joueur) + dégâts si le joueur est
  // à portée frontale. Sert aux lunges/taillades des boss guerriers (chevalier/sabreur/déchu).
  bossMeleeStrike(bossX: number, bossY: number, reachPx: number, damage: number, color: number) {
    const dir = this.player.x < bossX ? -1 : 1
    const cx = bossX + dir * reachPx * 0.5
    const arc = this.add.graphics({ x: cx, y: bossY }).setDepth(6)
    arc.lineStyle(7, color, 0.92).beginPath()
    arc.arc(0, 0, reachPx * 0.6, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false)
    arc.strokePath()
    arc.scaleX = dir
    this.tweens.add({ targets: arc, scaleX: 1.4 * dir, scaleY: 1.4, alpha: 0, duration: 190, onComplete: () => arc.destroy() })
    this.impactFx(cx, bossY, color)
    const dxFacing = (this.player.x - bossX) * dir
    if (dxFacing > -30 && dxFacing < reachPx + 30 && Math.abs(this.player.y - bossY) < 120) this.hitPlayer(damage)
  }

  // Bannière « ENRAGÉ ! » du passage en phase 2 (sous 50 % PV) : secousse + texte pulsé.
  showEnrageBanner() {
    this.cameras.main.shake(300, 0.01)
    const txt = this.add.text(480, 150, 'ENRAGÉ !', {
      fontSize: '44px', color: '#ff1744', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setScale(0.3)
    this.tweens.add({
      targets: txt, scale: 1.2, duration: 260, ease: 'Back.out', yoyo: true, hold: 500,
      onComplete: () => this.tweens.add({ targets: txt, alpha: 0, duration: 500, onComplete: () => txt.destroy() }),
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
    // MODE TEST : atteindre la sortie renvoie au sélecteur de niveaux (aucune progression/sauvegarde).
    if (this.testMode) { this.scene.start('LevelTest'); return }
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

  // Chiffre de dégâts flottant : monte et s'estompe puis se détruit seul. La TAILLE ∝ ampleur du
  // coup (petit coup = petit chiffre, gros coup = gros chiffre). `taken` = dégâts SUBIS par le
  // joueur → toujours ROUGE ; sinon dégâts INFLIGÉS à un ennemi → jaune → orange → rouge-orangé
  // (couleur DISTINCTE du rouge subi, plus chaude quand le coup est gros/critique). Léger et non
  // bloquant : un JITTER x/y aléatoire + un léger délai étalent les hits simultanés pour qu'ils ne
  // se superposent pas, et un plafond limite le nombre de chiffres à l'écran (perf multi-hits).
  showDamageNumber(x: number, y: number, amount: number, taken: boolean) {
    const amt = Math.round(amount)
    if (amt <= 0 || this.activeDamageNumbers >= 28) return
    // taille bornée croissant avec l'ampleur : ~18px (coup léger) → ~46px (gros coup)
    const size = Math.round(Phaser.Math.Clamp(16 + Math.sqrt(amt) * 2.4, 18, 46))
    const color = taken
      ? (amt >= 60 ? '#ff1744' : '#ff5252') // subi : rouge, plus vif si le coup est fort
      : (amt >= 120 ? '#ff7043' : amt >= 50 ? '#ffa726' : '#ffee58') // infligé : jaune→orange→rouge-orangé
    const jx = Phaser.Math.Between(-22, 22)
    const jy = Phaser.Math.Between(-14, 8)
    const txt = this.add.text(x + jx, y + jy, `${amt}`, { fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(40)
    this.activeDamageNumbers++
    this.tweens.add({
      targets: txt, y: txt.y - 34 - size * 0.5, alpha: 0, duration: 640, ease: 'Cubic.easeOut',
      delay: Phaser.Math.Between(0, 90), // léger décalage temporel : évite l'empilement des hits simultanés
      onComplete: () => { txt.destroy(); this.activeDamageNumbers-- },
    })
  }

  // SOIN : chiffre VERT « +N » qui monte au-dessus de la tête (potion, coffre, soin passif, sort de
  // soin). Même logique de taille que les dégâts : plus le soin est gros, plus le chiffre est gros.
  showHealNumber(amount: number) {
    const amt = Math.round(amount)
    if (amt <= 0 || this.activeDamageNumbers >= 28) return
    const size = Math.round(Phaser.Math.Clamp(16 + Math.sqrt(amt) * 2.4, 18, 46))
    const color = amt >= 120 ? '#00e676' : amt >= 40 ? '#69f0ae' : '#b9f6ca' // vert d'autant plus vif que le soin est gros
    const txt = this.add.text(this.player.x + Phaser.Math.Between(-16, 16), this.player.y - 48, `+${amt}`, {
      fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#0b3d1a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40)
    this.activeDamageNumbers++
    this.tweens.add({
      targets: txt, y: txt.y - 34 - size * 0.5, alpha: 0, duration: 720, ease: 'Cubic.easeOut',
      onComplete: () => { txt.destroy(); this.activeDamageNumbers-- },
    })
  }

  hitPlayer(rawAtk: number, attackerX?: number) {
    // ENTRAÎNEMENT / TEST DE NIVEAUX : le joueur ne subit AUCUN dégât → imperdable (balade).
    if (this.training || this.testMode) return
    // God mode DEV (émulateur/tests physiques) : le joueur ne perd jamais de PV. Inoffensif
    // en prod — window.__pandaGodMode est absent (donc falsy) par défaut.
    if ((globalThis as { __pandaGodMode?: boolean }).__pandaGodMode) return
    if (this.time.now < this.invulnUntil || this.player.hp <= 0) return
    this.invulnUntil = this.time.now + 800
    const dmg = physicalDamage(rawAtk, this.player.stats.def)
    const maxHp = this.player.stats.maxHp
    const hpBefore = this.player.hp
    this.showDamageNumber(this.player.x, this.player.y - 44, dmg, true) // chiffre ROUGE au-dessus de la tête
    this.player.takeDamage(dmg)
    if (this.player.hp <= 0) {
      audio.playSfx('player-death')
      save(getPlayer()) // « Réessayer » recommence le niveau AU DÉBUT
      // MORT HUMILIANTE : coup fatal depuis la VIE PLEINE (ou dégât ≥ PV max) → le joueur vole à
      // l'opposé du monstre puis l'écran de game-over s'affiche. Sinon game-over immédiat classique.
      const oneShot = hpBefore >= maxHp || dmg >= maxHp
      if (oneShot) this.playerRagdollThenGameOver(attackerX)
      else { this.player.setVelocity(-this.player.facing * 200, -200); this.showGameOver() }
      return
    }
    this.player.setVelocity(-this.player.facing * 200, -200)
    audio.playSfx('player-hit')
  }

  // MORT HUMILIANTE du joueur : propulsion en cloche à l'OPPOSÉ de l'attaquant + spin (physique
  // réelle, cf. Player.beginRagdoll), puis l'écran de game-over s'affiche à la retombée.
  private playerRagdollThenGameOver(attackerX?: number) {
    const ax = attackerX ?? this.player.x + this.player.facing * 100
    const dirX = (Math.sign(this.player.x - ax) || (-this.player.facing as 1 | -1) || 1) as 1 | -1
    this.player.beginRagdoll(dirX, this.player.displayHeight * 2.2)
    this.cameras.main.stopFollow()
    this.time.delayedCall(1100, () => { this.player.ragdolling = false; this.showGameOver() })
  }

  // FLAMMES AU SOL (ex-pics) : contact = brûlure CONTINUE, jamais de mort instantanée. Perte de
  // 30 % des PV MAX par seconde, INDÉPENDAMMENT du niveau (danger constant : ~3,3 s pour un K.O.
  // plein). Même modèle de ticks que la lave/noyade (drownTick → god mode, chiffres, K.O.).
  private updateFlames(delta: number) {
    if (!this.flameRects.length) return
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const touching = this.flameRects.some((r) => r.contains(this.player.x, body.bottom) || r.contains(this.player.x, this.player.y))
    if (!touching) { this.flameAccumMs = 0; return }
    this.flameAccumMs += delta
    // dégât par tick = fraction des PV MAX proportionnelle à la durée du tick (30 % PV max/s)
    const perTick = this.player.stats.maxHp * FLAME_HP_FRAC_PER_SEC * (FLAME_TICK_MS / 1000)
    while (this.flameAccumMs >= FLAME_TICK_MS) {
      this.flameAccumMs -= FLAME_TICK_MS
      this.drownTick(perTick)
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
    this.add.text(480, 108, 'Essaie encore !', {
      fontSize: '52px', color: '#ff5252', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22)

    // illustration K.O. (panda sur le dos + étoiles), centrée plus bas pour ne pas chevaucher le titre
    const dead = this.add.image(480, 322, 'death-panda').setScrollFactor(0).setDepth(21)
    const targetH = 195
    dead.setDisplaySize(targetH * (dead.width / dead.height), targetH)
    const sx = dead.scaleX, sy = dead.scaleY
    dead.setScale(sx * 0.7, sy * 0.7).setAlpha(0)
    this.tweens.add({ targets: dead, alpha: 1, duration: 320, ease: 'Quad.out' })
    this.tweens.add({ targets: dead, scaleX: sx, scaleY: sy, duration: 440, ease: 'Back.out' })

    const mkButton = (x: number, label: string, bg: number, onTap: () => void) => {
      const t = this.add.text(x, 478, label, {
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
  // MAX d'apnée courant (ms) — dynamique, lié au NIVEAU DU PERSO (5000 + 250·niveau, cf. core/breath.ts).
  private breathMax(): number { return breathMaxMs(getPlayer().level) }

  private updateWater(delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const rect = this.waterRects.find((r) => r.contains(this.player.x, this.player.y))
    // POCHE D'AIR : bulle d'air respirable au cœur de l'épave. En toucher une recharge le souffle au MAX
    // (comme une surface locale) — dans un niveau sans surface d'air, c'est le seul répit possible.
    const inAirPocket = this.airPocketRects.some((r) => r.contains(this.player.x, this.player.y))
    // marge de 4px : on ne compte comme immergé que quand la tête est franchement sous la surface.
    // Dans une poche d'air, on respire → jamais « submergé » (pas de bulles, pas de noyade).
    const submerged = !inAirPocket && !!rect && body.top >= rect.top + 4

    if (inAirPocket) {
      // répit local : souffle plein, dette de noyade effacée
      this.breathMs = this.breathMax()
      this.drownAccumMs = 0
      this.bubbleAccumMs = 0
    } else if (submerged) {
      this.breathMs = Math.max(0, this.breathMs - delta)
      this.bubbleAccumMs += delta
      while (this.bubbleAccumMs >= BUBBLE_INTERVAL_MS) {
        this.bubbleAccumMs -= BUBBLE_INTERVAL_MS
        this.emitBubble(body.top, rect!.top) // bulles émises à la tête, remontent jusqu'à la SURFACE
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
      this.breathMs = Math.min(this.breathMax(), this.breathMs + delta * BREATH_RECHARGE_MULT)
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
    if (this.testMode) return
    if ((globalThis as { __pandaGodMode?: boolean }).__pandaGodMode) return
    if (this.player.hp <= 0) return
    this.showDamageNumber(this.player.x, this.player.y - 44, amount, true) // chiffre ROUGE (noyade/lave)
    this.player.takeDamage(amount)
    if (this.player.hp <= 0) {
      audio.playSfx('player-death')
      // toute mort → écran de game over ; « Réessayer » recommence le niveau AU DÉBUT
      save(getPlayer())
      this.showGameOver()
    }
  }

  // Un point (ex. le centre d'un monstre) est-il immergé dans une eau MARINE noyante (bassin/nappe),
  // hors cascade REMONTABLE (qu'on nage sans se noyer) ? Sert à noyer les monstres terrestres tombés
  // à l'eau (cf. Enemy.checkDrown) — même zone noyante que pour le joueur (waterRects).
  isMarineWater(xPx: number, yPx: number): boolean {
    return this.waterRects.some((r) => r.contains(xPx, yPx)) && !this.cascadeRects.some((r) => r.contains(xPx, yPx))
  }

  // Rectangle du plan d'eau MARINE contenant ce point (hors cascade) — sert à contenir les mobs
  // aquatiques dans leur cuve (ils nagent vers le joueur mais ne sortent JAMAIS de l'eau).
  waterRectAt(xPx: number, yPx: number): Phaser.Geom.Rectangle | undefined {
    if (this.cascadeRects.some((c) => c.contains(xPx, yPx))) return undefined
    return this.waterRects.find((r) => r.contains(xPx, yPx))
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
    if (this.testMode) return // balade invincible : pas de chute mortelle
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

  // une GROSSE bulle qui monte depuis la tête du panda jusqu'à la SURFACE de l'eau (surfaceY) puis y
  // crève. Elle enfle en montant, ondule légèrement en x, et s'estompe en arrivant à la surface. Plus
  // grosses et plus visibles qu'avant (retour joueur : bulles plus grosses, jusqu'à la surface).
  private emitBubble(headY: number, surfaceY: number) {
    const bx = this.player.x + Phaser.Math.Between(-10, 10)
    const startScale = Phaser.Math.FloatBetween(0.5, 0.9) // grosses bulles
    const b = this.add.image(bx, headY + 2, 'fx-bubble')
      .setDepth(this.player.depth + 1)
      .setScale(startScale)
      .setAlpha(0.85)
    // cible = juste sous la surface (remontée complète). Distance de montée bornée pour rester fluide.
    const topY = Math.min(headY - 20, surfaceY + 2)
    const rise = Math.max(24, headY - topY)
    this.tweens.add({
      targets: b,
      y: topY,
      x: bx + Phaser.Math.Between(-9, 9),
      scale: startScale * 1.6, // enfle en remontant
      alpha: 0,
      duration: Phaser.Math.Between(700, 1000) + rise * 3,
      ease: 'Sine.out',
      onComplete: () => b.destroy(),
    })
  }

  // ONDULATION D'ENTRÉE dans un LAC MARINE : quand le panda franchit la surface, la ligne d'eau ONDULE
  // au point d'impact — un CREUX de surface (ressac amorti) doublé de VAGUELETTES concentriques (2-3
  // anneaux d'onde aplatis) qui s'ouvrent et s'estompent. Propre et discret — plus de gerbe de
  // gouttelettes (retour user : « splash moche »). Purement décoratif, aucun impact gameplay.
  private waterSplashFx(x: number, surfaceY: number) {
    // creux de surface (ressac) : une lentille couleur surface qui s'enfonce brièvement sous la ligne
    // d'eau au point d'impact (creusement) puis remonte à plat avec un léger rebond amorti (Back.out).
    const dip = this.add.ellipse(x, surfaceY, 30, 9, 0x9fdcff, 0.8).setDepth(-1)
    this.tweens.add({
      targets: dip, y: surfaceY + 9, scaleX: 1.15, scaleY: 1.4, duration: 120, ease: 'Quad.in',
      onComplete: () => {
        this.tweens.add({
          targets: dip, y: surfaceY, scaleX: 1, scaleY: 0.3, alpha: 0, duration: 340, ease: 'Back.out',
          onComplete: () => dip.destroy(),
        })
      },
    })
    // VAGUELETTES : anneaux d'onde aplatis concentriques qui s'élargissent à la surface, décalés dans
    // le temps → l'eau « ondule » autour du point d'entrée (ripple), sans éclaboussure verticale.
    for (let i = 0; i < 3; i++) {
      const ring = this.add.ellipse(x, surfaceY, 18, 6, 0xbfe9ff, 0.6 - i * 0.12).setDepth(-1)
      this.tweens.add({
        targets: ring, scaleX: 2.4 + i * 0.7, scaleY: 1.5, alpha: 0,
        duration: 460 + i * 140, delay: i * 90, ease: 'Cubic.out', onComplete: () => ring.destroy(),
      })
    }
  }

  // ONDULATION CONTINUE de la ligne d'eau d'un lac marine : un chapelet de vaguelettes bobbe doucement
  // en décalé le long de la surface → la surface « respire » au lieu d'une ligne figée. Discret et sans
  // coût dans update (tweens en boucle auto-animés). Posé au montage de chaque cuve marine.
  private addSurfaceRipple(xPx: number, topPx: number, wPx: number) {
    const n = Math.max(2, Math.round(wPx / 26))
    for (let i = 0; i < n; i++) {
      const wx = xPx + (i + 0.5) * (wPx / n)
      const w = this.add.ellipse(wx, topPx, 22, 5, 0xbfe9ff, 0.5).setDepth(-1)
      this.tweens.add({
        targets: w, y: topPx - 2, scaleX: 1.3, scaleY: 0.7,
        duration: 950 + (i % 3) * 240, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 170,
      })
    }
  }

  // POCHES D'AIR (niveaux immergés type Épave) : construit les zones de recharge de souffle et leur
  // rendu (halo cyan qui palpite + chapelet de bulles qui remontent). Chaque poche est une zone
  // circulaire ; y entrer recharge le souffle au max (cf. updateWater). No-op si le niveau n'en a pas.
  private addAirPockets() {
    for (const ap of this.levelDef.airPockets ?? []) {
      const r = (ap.r ?? 1.6) * TILE
      const cx = ap.x * TILE + TILE / 2
      const cy = ap.y * TILE + TILE / 2
      this.airPocketRects.push(new Phaser.Geom.Rectangle(cx - r, cy - r, r * 2, r * 2))
      // halo respirable (cyan clair translucide) qui palpite doucement
      const halo = this.add.circle(cx, cy, r, 0xbfefff, 0.22).setDepth(-1).setBlendMode(Phaser.BlendModes.ADD)
      const ring = this.add.circle(cx, cy, r, 0xe8fbff).setStrokeStyle(2, 0xdff6ff, 0.5).setFillStyle(0, 0).setDepth(-1)
      this.tweens.add({ targets: [halo, ring], scale: 1.12, alpha: { from: 0.9, to: 0.5 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      // chapelet de bulles qui montent en continu depuis le cœur de la poche
      for (let i = 0; i < 4; i++) {
        const bx = cx + Phaser.Math.Between(-Math.floor(r / 2), Math.floor(r / 2))
        const bub = this.add.image(bx, cy + r * 0.5, 'fx-bubble').setDepth(-1).setScale(0.4).setAlpha(0.8)
        this.tweens.add({
          targets: bub, y: cy - r, alpha: 0, scale: 0.7,
          duration: 1400 + i * 260, repeat: -1, repeatDelay: i * 180, ease: 'Sine.out',
          onRepeat: () => { bub.setPosition(bx, cy + r * 0.5).setAlpha(0.8).setScale(0.4) },
        })
      }
    }
  }

  // petite jauge d'apnée au-dessus de la tête : visible seulement quand le souffle n'est pas plein
  // (donc invisible hors de l'eau). Vire au rouge quand le souffle est presque épuisé.
  private updateBreathGauge(body: Phaser.Physics.Arcade.Body, submerged: boolean) {
    const show = submerged || this.breathMs < this.breathMax() - 1
    if (!show) {
      this.breathBarBg?.setVisible(false)
      this.breathBar?.setVisible(false)
      return
    }
    const w = 34
    const x = this.player.x - w / 2
    const y = body.top - 12
    const frac = Phaser.Math.Clamp(this.breathMs / this.breathMax(), 0, 1)
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
    // le passif « double attaque » (frappe-doublee / reflexes-felins) raccourcit le cooldown de base
    // selon son rang (× jusqu'à 0,5 au rang max → cadence doublée).
    this.nextBasicAttackAt = this.time.now + (1000 / this.player.stats.attackSpeed) * basicAttackCooldownFactor(getPlayer())
    audio.playSfx('attack')
    this.player.playAttack()
    this.player.gainEnergy(ENERGY_ON_BASIC_HIT) // frapper recharge un peu l'énergie

    const cls = getPlayer().classId
    const isMageType = cls === 'mage' || cls === 'sorcier'
    const isArcherType = cls === 'archer' || cls === 'chasseur'
    if (isMageType || isArcherType) {
      // attaque de base à distance, HORIZONTALE (sens du regard), sans gravité : petite boule
      // de feu bleue (mage/sorcier) ou flèche (archer/chasseur). S'arrête au 1er ennemi ou à ~440px.
      const atk = this.player.stats.atk * this.player.outgoingMult()
      const proj = this.spawnPlayerProjectile(atk, 440)
      if (isMageType) { proj.setTexture('fx-fireball').clearTint().setScale(1.3); this.fireballShimmer(proj, 1.3) }
      else if (this.player.isFlaming()) {
        // Flèche enflammée (buff chasseur) : flèche NORMALE + flammèche MINUSCULE à la pointe (plus de
        // gros sprite fx-fleche-enflammee), et brûlure (DoT) sur la cible.
        proj.setTexture('fx-arrow').clearTint().setScale(1.2)
        proj.burn = { dmgPerTick: atk * 0.18, durationMs: 2400 }
        this.attachTipFlame(proj)
      }
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

  // Flèche AUTOGUIDÉE (archer / chasseur) : ne repose sur AUCUNE physique — elle traverse murs et
  // terrain et enchaîne les ennemis. À chaque bond, on vise l'ennemi le PLUS PROCHE du point courant
  // qu'on n'a PAS encore touché, dans une portée MAX (~largeur d'écran). Le nombre de cibles = le
  // RANG (1→1 … 5→5) ; la chaîne s'arrête plus tôt s'il n'y a plus d'ennemi à portée. Dégâts appliqués
  // immédiatement (fiable), la traînée n'est que du spectacle.
  private castHomingArrow(skill: SkillDef, damage: number, rank: number, color: number) {
    const maxTargets = Math.max(1, rank)
    const maxDist = Math.max(skill.range, this.scale.width) // portée « visible »
    const hit = new Set<Enemy>()
    let fromX = this.player.x, fromY = this.player.y + 12
    const points: { x: number; y: number }[] = [{ x: fromX, y: fromY }]
    for (let i = 0; i < maxTargets; i++) {
      let best: Enemy | null = null
      let bestD = Infinity
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (!e.active || hit.has(e)) continue
        const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y)
        if (d <= maxDist && d < bestD) { bestD = d; best = e }
      }
      if (!best) break // plus d'ennemi à portée → la chaîne s'épuise
      hit.add(best)
      points.push({ x: best.x, y: best.y })
      best.takeDamage(physicalDamage(damage, best.effectiveDef()))
      fromX = best.x; fromY = best.y
    }
    this.homingArrowFx(points, color)
  }

  // Traînée + flèche filante de la Flèche autoguidée : segments lumineux qui s'estompent entre les
  // cibles successives, et une flèche qui bondit de l'une à l'autre (impact à chaque arrivée).
  private homingArrowFx(points: { x: number; y: number }[], color: number) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!, b = points[i + 1]!
      const line = this.add.line(0, 0, a.x, a.y, b.x, b.y, color, 0.9)
        .setOrigin(0, 0).setLineWidth(2.5).setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: line, alpha: 0, duration: 420, delay: i * 80, onComplete: () => line.destroy() })
    }
    if (points.length < 2) return
    const arrow = this.add.image(points[0]!.x, points[0]!.y, 'fx-arrow').setTint(color).setScale(1.3).setDepth(7)
    let seg = 0
    const hop = () => {
      if (!arrow.active || seg >= points.length - 1) { arrow.destroy(); return }
      const b = points[seg + 1]!
      arrow.setRotation(Math.atan2(b.y - arrow.y, b.x - arrow.x))
      // vitesse MODÉRÉE (~0,7 px/ms) au lieu d'un saut instantané de 90 ms : on VOIT la flèche
      // traquer d'un ennemi à l'autre. Durée ∝ distance, bornée pour rester lisible.
      const dur = Phaser.Math.Clamp(Phaser.Math.Distance.Between(arrow.x, arrow.y, b.x, b.y) / 0.7, 240, 620)
      this.tweens.add({
        targets: arrow, x: b.x, y: b.y, duration: dur, ease: 'Sine.inOut',
        onComplete: () => { this.impactFx(b.x, b.y, color); seg++; hop() },
      })
    }
    hop()
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
    if (id === 'lance-flammes') return 0xff7043
    if (id === 'blizzard') return 0x4dd0e1
    if (id === 'tempete-foudroyante') return 0x82b1ff
    if (id === 'faille-du-neant') return 0x7e57c2
    if (id === 'aura-epines') return 0xb388ff
    if (id === 'grand-croix') return 0xfff3c0
    if (id === 'epee-fantome') return 0xd0bcff
    if (id === 'devotion') return 0x64b5f6
    if (id.includes('feu') || id.includes('meteore')) return 0xff7043
    if (id.includes('givre')) return 0x4dd0e1
    if (id.includes('eclair')) return 0xfff176
    if (id === 'bambou-jete' || id === 'fleche-de-bambou') return 0x9ccc65 // bambou vert
    if (id.includes('fleche') || id.includes('tir') || id.includes('salve')) return 0xd7a86e
    if (id.includes('arcanique')) return 0xce93d8
    if (id.includes('lynx')) return 0x69f0ae // buff archer : aura verte d'agilité
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
    if (this.held) return // un seul sort maintenu (canalisé / chargé) à la fois
    const p = getPlayer()
    const skillId = p.equippedSkills[slot]
    if (!skillId || !this.cooldowns.canUse(slot, this.time.now)) return
    const skill = SKILLS[skillId]
    if (!skill) return // skill retiré du registre (vieille save) : on ignore proprement
    // Visée de zone : on n'engage rien tout de suite — on entre en mode ciblage, l'énergie et
    // le cooldown ne sont consommés qu'à la confirmation de la zone.
    if (skill.kind === 'zone') { this.beginZoneTargeting(slot, skill); return }
    // CANALISÉ (maintien) / CHARGE (maintien→relâche) : on entre en mode maintenu, la consommation
    // (mana par tick / cooldown à la fin) est gérée par le système de maintien.
    if (skill.kind === 'channel' || skill.chargeable) { this.beginHold(slot, skill); return }
    if (!this.player.spendEnergy(skill.manaCost ?? energyCostOf(skill))) {
      this.announceSkill('Pas assez d\'énergie', 0x4dd0e1)
      return
    }
    this.cooldowns.use(slot, this.time.now, skill.cooldownMs)
    // untilMs + durée totale → l'overlay de cooldown se dégrise horizontalement au fil de la recharge
    this.game.events.emit('skill-cooldown', slot, this.time.now + skill.cooldownMs, skill.cooldownMs)
    audio.playSfx('skill')
    this.announceSkill(skill.name)

    const { maxHp } = this.player.stats
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const color = this.skillColor(skill.id)
    // rang investi : interpolation douce (skillDamageMult) — signatures jusqu'au rang 10
    const rank = p.skillLevels[skill.id] ?? 1
    const mult = skillDamageMult(skill, rank)
    // gros coup instantané : bref gel d'impact pour le punch (charge/dive/buff gèrent le leur)
    if (mult >= 2.5 && (skill.kind === 'melee' || skill.kind === 'aoe' || skill.kind === 'projectile')) this.hitStop(75)
    if (skill.kind === 'melee') {
      this.player.playAttack()
      if (skill.id === 'lame-ultime' || skill.id === 'epee-fantome') {
        // Ultime (Épée fantôme du chevalier) : lumière aveuglante + DEUX éclairs bleus diagonaux
        // lents qui infligent les dégâts. Ne passe pas par meleeHit.
        this.castSabreurUltimate(mult, color)
      } else if (skill.id === 'grand-croix') {
        // Grand-croix : immense croix de lumière (bras H+V) qui frappe tout sur ses axes.
        this.castGrandCross(skill, mult, color)
      } else {
        // gros coup (rang inclus) : double croissant + tremblement de caméra
        this.slashFx(this.player.x + (this.player.facing * skill.range) / 2, this.player.y, skill.range, color, mult >= 2)
        this.meleeHit(skill.range, mult)
        // Câlin brutal : une volée de cœurs s'envole autour du point d'impact
        if (skill.id === 'calin-brutal') this.heartsFx(this.player.x + this.player.facing * 30, this.player.y)
      }
    } else if (skill.kind === 'aura') {
      // AURA D'ÉPINES (mage) : aura offensive d'éclairs qui blesse en continu les ennemis proches.
      this.castThornAura(skill, mult, color)
    } else if (skill.kind === 'aoe' && skill.slow) {
      // FLÈCHES ENTRAVANTES (chasseur) : ralentit TOUS les ennemis à l'écran (vitesse + cadence),
      // sans dégâts.
      this.castSlow(skill, color)
    } else if (skill.kind === 'aoe' && skill.voidRift) {
      // FAILLE DU NÉANT (sorcier) : aspire puis annihile les faibles, repousse les autres.
      this.castVoidRift(skill, mult, color)
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
    } else if (skill.kind === 'projectile' && skill.homing) {
      // Flèche AUTOGUIDÉE : chaîne homing à travers murs/terrain (nombre de cibles = rang).
      this.castHomingArrow(skill, atk * mult, rank, color)
    } else if (skill.kind === 'projectile' && skill.lance) {
      // CHARGE LANCIÈRE : RUÉE qui POUSSE et larde les ennemis sur la route (rang ↑ puissance + durée).
      this.castLanceCharge(skill, atk * mult, rank, color)
    } else if (skill.kind === 'projectile' && skill.id === 'tir-du-faucon') {
      // TIR DU FAUCON : faucon en PIQUÉ lisible depuis le coin de l'écran → explosion à l'impact.
      this.castFalconStrike(skill, atk * mult, color)
    } else if (skill.kind === 'projectile' && skill.falconBlitz) {
      // ASSAUT DU FAUCON : le faucon fond sur la cible et la frappe en coups multiples.
      this.castFalconBlitz(skill, atk * mult, color)
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
      this.showHealNumber(this.player.heal(Math.round(maxHp * mult))) // chiffre VERT de soin
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
      // Un seul buff par classe, chacun VISUELLEMENT DISTINCT : aura recolorée + FX propre à la classe.
      this.player.applyAtkBuff(skill.buff.atkMult, skill.buff.durationMs, color)
      if (skill.flame) {
        // Flèche enflammée (chasseur) = EMBRASEMENT DU PERSO (aura de feu sur le corps) ; l'épée
        // enflammée (sabreur) embrase la LAME. bodyAura pilote lequel des deux (cf. Player.emitFlame).
        const bodyAura = skill.classId === 'archer' || skill.classId === 'chasseur'
        this.player.applyFlameBuff(skill.buff.durationMs, bodyAura)
        this.flameEnchantFx(color)
      }
      else if (skill.classId === 'mage' || skill.classId === 'sorcier') this.arcaneBuffFx(color)
      else if (skill.classId === 'archer' || skill.classId === 'chasseur') this.agilityBuffFx(color)
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
      // 'lame-ultime' : géré par castSabreurUltimate (lumière aveuglante + éclairs bleus diagonaux)
      case 'tourbillon': // le panda TOURNE (flipX alterné) au milieu de lames tournoyantes
        this.player.spinWhirl(640)
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

  // ULTIME du sabreur (Lame ultime) — refait : LUMIÈRE AVEUGLANTE tout autour du panda (flash plein
  // écran + halo qui enfle + rayons blancs qui jaillissent) PUIS deux grands ÉCLAIRS BLEUS diagonaux
  // qui se tracent LENTEMENT et infligent les dégâts aux ennemis proches de leur tracé (croisent un X
  // sur le panda). Les dégâts sont portés par les éclairs (pas par meleeHit).
  private castSabreurUltimate(mult: number, color: number) {
    const px = this.player.x, py = this.player.y
    // --- 1) lumière aveuglante ---
    this.flashScreen(0xffffff, 0.55, 220)
    this.cameras.main.flash(200, 240, 248, 255)
    const glow = this.add.image(px, py, 'ring').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setScale(0.3).setAlpha(0.95)
    this.tweens.add({ targets: glow, scale: 11, alpha: 0, duration: 640, ease: 'Cubic.out', onUpdate: () => glow.setPosition(this.player.x, this.player.y), onComplete: () => glow.destroy() })
    const coreFlash = this.add.circle(px, py, 26, 0xffffff, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(9)
    this.tweens.add({ targets: coreFlash, scale: 3.6, alpha: 0, duration: 300, ease: 'Cubic.out', onComplete: () => coreFlash.destroy() })
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const ray = this.add.rectangle(px, py, 5, 26, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setRotation(a).setOrigin(0.5, 0)
      this.tweens.add({ targets: ray, scaleY: 12, alpha: 0, duration: 420 + (i % 3) * 90, ease: 'Cubic.out', onComplete: () => ray.destroy() })
    }
    this.screenShake(0.012, 320)
    this.hitStop(120)
    // --- 2) deux éclairs bleus diagonaux, tracés lentement, qui portent les dégâts ---
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const dmg = atk * mult
    const hit = new Set<Enemy>() // un ennemi n'est frappé qu'une fois même s'il est sur les deux traits
    const reach = 520, band = 130
    this.spawnUltBolt(px - reach, py - reach, px + reach, py + reach, band, dmg, hit, 40) // « \ »
    this.spawnUltBolt(px + reach, py - reach, px - reach, py + reach, band, dmg, hit, 200) // « / » (décalé → croisement)
  }

  // Un grand éclair bleu diagonal qui se TRACE lentement (polyligne jaggée dessinée progressivement),
  // avec un cœur blanc lumineux. À la fin du tracé, inflige `dmg` aux ennemis/props à moins de `band`
  // du segment (partagé via `hit` pour ne pas frapper deux fois). Nettoie ses graphics au fondu.
  private spawnUltBolt(x0: number, y0: number, x1: number, y1: number, band: number, dmg: number, hit: Set<Enemy>, delayMs: number) {
    this.time.delayedCall(delayMs, () => {
      if (!this.player.active) return
      const N = 22
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1
      const nx = -dy / len, ny = dx / len // perpendiculaire unitaire (jitter de l'éclair)
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const j = i === 0 || i === N ? 0 : Phaser.Math.Between(-16, 16)
        pts.push({ x: x0 + dx * t + nx * j, y: y0 + dy * t + ny * j })
      }
      const outer = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD)
      const inner = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD)
      const prog = { p: 0 }
      this.tweens.add({
        targets: prog, p: 1, duration: 620, ease: 'Sine.inOut', // LENT (éclair qui se trace)
        onUpdate: () => {
          const upto = Math.max(1, Math.floor(prog.p * N))
          outer.clear().lineStyle(14, 0x1e88ff, 0.5)
          inner.clear().lineStyle(5, 0xe3f2fd, 0.95)
          outer.beginPath(); outer.moveTo(pts[0]!.x, pts[0]!.y)
          inner.beginPath(); inner.moveTo(pts[0]!.x, pts[0]!.y)
          for (let i = 1; i <= upto; i++) { outer.lineTo(pts[i]!.x, pts[i]!.y); inner.lineTo(pts[i]!.x, pts[i]!.y) }
          outer.strokePath(); inner.strokePath()
        },
        onComplete: () => {
          for (const obj of this.enemies.getChildren()) {
            const e = obj as Enemy
            if (!e.active || hit.has(e)) continue
            if (this.distToSegment(e.x, e.y, x0, y0, x1, y1) <= band) { hit.add(e); e.takeDamage(physicalDamage(dmg, e.effectiveDef())) }
          }
          for (const obj of this.props.getChildren()) {
            const pr = obj as Prop
            if (pr.active && this.distToSegment(pr.x, pr.y, x0, y0, x1, y1) <= band) pr.takeDamage(1)
          }
          audio.playSfx('hit')
          this.tweens.add({ targets: [outer, inner], alpha: 0, duration: 240, onComplete: () => { outer.destroy(); inner.destroy() } })
        },
      })
    })
  }

  // distance d'un point (px,py) au segment [ (x0,y0) ; (x1,y1) ]
  private distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0, dy = y1 - y0
    const l2 = dx * dx + dy * dy
    if (l2 === 0) return Math.hypot(px - x0, py - y0)
    const t = Phaser.Math.Clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1)
    return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t))
  }

  // ===== Attaque chargée, Plongeon & Épée enflammée =====

  // Attaque chargée : court WINDUP télégraphié (aura grandissante, étincelles convergentes), puis
  // un coup DÉVASTATEUR frontal — arc géant, onde de choc, explosion, flash, secousse, hit-stop.
  private castChargeAttack(skill: SkillDef, color: number, mult: number) {
    const WINDUP = 480
    // EN L'AIR : on fige le panda en hauteur le temps de la charge (il frappe en haut), puis on
    // relâche → il retombe (slam). AU SOL : beginAirChargeLock renvoie false → comportement inchangé.
    const airborne = this.player.beginAirChargeLock()
    this.chargeWindupFx(color, WINDUP)
    this.time.delayedCall(WINDUP, () => {
      if (!this.player.active || this.player.hp <= 0) { this.player.endChargeLock(); return }
      const px = this.player.x, py = this.player.y, f = this.player.facing
      this.player.playAttack()
      if (!airborne) this.lungeFx(70) // le bond en avant n'a de sens qu'au sol (en l'air on frappe sur place)
      this.bladeArcFx(px + f * skill.range * 0.6, py, skill.range * 1.7, color, true)
      this.shockwaveFx(px + f * 40, py + 22, skill.range * 1.2, color)
      this.explosionFx(px + f * skill.range * 0.7, py, skill.range * 0.95, color)
      this.flashScreen(color, 0.22, 120)
      this.screenShake(0.012, 220)
      this.hitStop(110)
      this.meleeHit(skill.range * 1.3, mult)
      // la charge est finie : on rend la gravité → le panda retombe depuis sa hauteur de frappe
      if (airborne) this.player.endChargeLock()
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

  // Buff MAGE — Fureur arcanique : cercle de runes VIOLETTES qui tournoie + éclats d'arcanes montants
  // + double halo additif. Signature nettement différente du cri de guerre doré.
  private arcaneBuffFx(color: number) {
    const x = this.player.x, y = this.player.y
    this.cameras.main.shake(150, 0.005)
    for (let i = 0; i < 2; i++) {
      const halo = this.add.image(x, y, 'ring').setTint(color).setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.8)
      this.tweens.add({ targets: halo, scale: 4.5 + i * 1.5, alpha: 0, duration: 520 + i * 140, delay: i * 90, ease: 'Cubic.out', onComplete: () => halo.destroy() })
    }
    // anneau de glyphes qui tourne autour du panda avant de se dissiper
    const ring = this.add.container(x, y).setDepth(6)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const glyph = this.add.text(Math.cos(a) * 40, Math.sin(a) * 40, ['✦', '✧', '❖', '✶'][i % 4]!, { fontSize: '15px', color: '#ce93d8' }).setOrigin(0.5)
      glyph.setBlendMode(Phaser.BlendModes.ADD)
      ring.add(glyph)
    }
    this.tweens.add({ targets: ring, angle: 220, scale: 1.5, alpha: 0, duration: 620, ease: 'Sine.out', onComplete: () => ring.destroy() })
    // éclats d'arcanes qui montent
    for (let i = 0; i < 10; i++) {
      const sp = this.add.rectangle(x + Phaser.Math.Between(-26, 26), y + 12, 3, 10, color).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: sp, y: sp.y - Phaser.Math.Between(48, 82), alpha: 0, duration: 560, delay: i * 30, onComplete: () => sp.destroy() })
    }
  }

  // Buff ARCHER — Œil du lynx : traits de vitesse VERTS qui filent horizontalement + double halo vert
  // + plumes légères. Aura d'agilité, visuellement distincte du doré et du violet.
  private agilityBuffFx(color: number) {
    const x = this.player.x, y = this.player.y
    this.cameras.main.shake(120, 0.004)
    for (let i = 0; i < 2; i++) {
      const halo = this.add.image(x, y, 'ring').setTint(color).setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.75)
      this.tweens.add({ targets: halo, scale: 4 + i * 1.4, alpha: 0, duration: 460 + i * 120, delay: i * 80, ease: 'Cubic.out', onComplete: () => halo.destroy() })
    }
    // traits de vitesse qui filent de part et d'autre du panda
    for (let i = 0; i < 10; i++) {
      const dir = i % 2 === 0 ? 1 : -1
      const sy = y + Phaser.Math.Between(-24, 24)
      const streak = this.add.rectangle(x, sy, 22, 3, color).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9)
      this.tweens.add({ targets: streak, x: x + dir * Phaser.Math.Between(60, 110), scaleX: 2.4, alpha: 0, duration: 380, delay: i * 26, onComplete: () => streak.destroy() })
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
    // la lame TOURNE sur elle-même en continu (angularVelocity ≠ 0 → Projectile n'écrase pas la
    // rotation par l'orientation de trajectoire)
    proj.setTexture(key).clearTint().setScale(1.4).setAngularVelocity(this.player.facing * 760)
    // COLLISION À LA POSITION DU PROJECTILE : la hitbox par défaut, héritée de la petite texture
    // 'projectile' (18px) et jamais recalée après le changement de texture, était minuscule et
    // laissait la lame « passer à travers » les mobs. On pose une hitbox GÉNÉREUSE recentrée sur la
    // lame → le lancer touche vraiment les ennemis qu'il chevauche le long de sa trajectoire.
    const body = proj.body as Phaser.Physics.Arcade.Body
    body.setSize(46, 46, true)
    // un peu MOINS vite qu'un tir standard (420 → 320 px/s)
    proj.setVelocity(this.player.facing * 320, 0)
    // effet de VITESSE : traînée d'étincelles acier en plus des échos de lame tournoyante de Projectile
    this.attachSparkTrail(proj, 0xcfd8dc)
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

  // Traînée de flammes d'une flèche embrasée (REFONTE) : langues de feu vives qui montent + braises
  // scintillantes dans le sillage — dégradé jaune→orange→rouge, cœur clair, effet de vraie flamme.
  private attachFlameTrail(proj: Projectile) {
    const f = this.player.facing
    const ev = this.time.addEvent({
      delay: 16, loop: true, callback: () => {
        if (!proj.active) { ev.remove(); return }
        const bx = proj.x - f * Phaser.Math.Between(2, 12)
        const by = proj.y + Phaser.Math.Between(-3, 3)
        // langue de feu (corps orange opaque + cœur jaune ADD) qui s'étire vers le haut en s'éteignant
        const col = Phaser.Math.RND.pick([0xffca28, 0xff7043, 0xf4511e])
        const flame = this.add.rectangle(bx, by, Phaser.Math.Between(5, 8), Phaser.Math.Between(10, 16), col)
          .setDepth((proj.depth ?? 0) - 1).setAlpha(0.95).setOrigin(0.5, 1)
        this.tweens.add({ targets: flame, y: by - Phaser.Math.Between(16, 26), scaleX: 0.3, scaleY: 0.35, alpha: 0, duration: 300, ease: 'Cubic.out', onComplete: () => flame.destroy() })
        const core = this.add.rectangle(bx, by, 3, 8, 0xfff59d).setBlendMode(Phaser.BlendModes.ADD).setDepth((proj.depth ?? 0) + 1).setAlpha(0.95).setOrigin(0.5, 1)
        this.tweens.add({ targets: core, y: by - Phaser.Math.Between(12, 20), scaleY: 0.3, alpha: 0, duration: 260, ease: 'Cubic.out', onComplete: () => core.destroy() })
        // braise qui vole
        if (Math.random() < 0.6) {
          const ember = this.add.circle(bx, by, Phaser.Math.Between(1, 3), 0xffab40).setBlendMode(Phaser.BlendModes.ADD).setDepth((proj.depth ?? 0) - 1).setAlpha(0.9)
          this.tweens.add({ targets: ember, x: bx - f * Phaser.Math.Between(8, 20), y: by - Phaser.Math.Between(8, 22), alpha: 0, duration: 360, onComplete: () => ember.destroy() })
        }
      },
    })
  }

  // Flammèche MINUSCULE à la POINTE d'une flèche (buff flèche enflammée du chasseur) : mini-mini
  // version des langues de feu du mur de flamme, discrète — pas de gros sprite. Suit la pointe selon
  // l'orientation courante du tir. Nettoyée à la mort du projectile.
  private attachTipFlame(proj: Projectile) {
    const ev = this.time.addEvent({
      delay: 26, loop: true, callback: () => {
        if (!proj.active) { ev.remove(); return }
        const len = proj.displayWidth * 0.45 // du centre vers la pointe (sens de la vélocité)
        const tx = proj.x + Math.cos(proj.rotation) * len
        const ty = proj.y + Math.sin(proj.rotation) * len
        const col = Phaser.Math.RND.pick([0xffca28, 0xff7043])
        const fl = this.add.rectangle(tx, ty, 3, 6, col).setDepth((proj.depth ?? 0) + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9)
        this.tweens.add({ targets: fl, scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: 160, ease: 'Sine.out', onComplete: () => fl.destroy() })
      },
    })
  }

  // Flèche explosive : lancée en cloche, elle porte une charge qui détone au sol (ou à l'impact).
  private setupExplosiveArrow(proj: Projectile, skill: SkillDef, damage: number, color: number) {
    proj.explosive = { radius: skill.explodeRadius ?? 110, damage, color }
    const b = proj.body as Phaser.Physics.Arcade.Body
    b.setAllowGravity(true)
    b.setVelocity(this.player.facing * 360, -430)
    const falconTex = skill.id === 'tir-du-faucon' && this.textures.exists('fx-tir-faucon') ? 'fx-tir-faucon' : 'fx-arrow'
    proj.setTexture(falconTex).setTint(falconTex === 'fx-tir-faucon' ? 0xffffff : color).setScale(1.35).setAngularVelocity(this.player.facing * 240)
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
    // untilMs + durée totale → l'overlay de cooldown se dégrise horizontalement au fil de la recharge
    this.game.events.emit('skill-cooldown', slot, this.time.now + skill.cooldownMs, skill.cooldownMs)
    audio.playSfx('skill')
    this.announceSkill(skill.name)
    const p = getPlayer()
    const rank = p.skillLevels[skill.id] ?? 1
    const mult = skillDamageMult(skill, rank)
    const color = this.skillColor(skill.id)
    // clamp de la cible dans les bornes du monde pour rester jouable
    const cx = Phaser.Math.Clamp(x, 40, this.levelDef.widthTiles * TILE - 40)
    const cy = Phaser.Math.Clamp(y, 80, this.groundRow * TILE - 4)
    // dispatch selon la nature du sort de zone : cataclysme (ultime) > météores > mur de flamme > pluie de flèches
    if (skill.id === 'cataclysme') this.executeCataclysm(skill, cx, cy, mult, color)
    else if (skill.storm) this.executeStorm(skill, cx, cy, mult)
    else if (skill.blizzard) this.executeBlizzard(skill, cx, cy, mult)
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
        // météore ARDENT : sprite fx-meteore si dispo, sinon composé procédural (halo + cœur jaune vif)
        const meteor = this.textures.exists('fx-meteore')
          ? this.add.image(startX, startY, 'fx-meteore').setDepth(8).setScale(1.2).setRotation(Math.atan2(landY - startY, mx - startX))
          : this.add.container(startX, startY, [
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

  // ═════════════ MAINTIEN : sorts CANALISÉS (ticks + drain mana) & CHARGE (relâche) ═════════════

  private isHeldDown(h: NonNullable<typeof this.held>): boolean {
    if (h.key) return h.key.isDown
    if (h.pointer) return h.pointer.isDown
    return false
  }

  // Entre en mode maintenu. La source (touche de slot tenue, sinon pointeur du bouton) est capturée
  // pour détecter le RELÂCHEMENT. Canalisé : ticks immédiats. Charge : télégraphe d'orbe.
  private beginHold(slot: number, skill: SkillDef) {
    const now = this.time.now
    const key = this.slotKeys[slot]
    const byKey = key?.isDown ?? false
    const pointer = !byKey && this.input.activePointer.isDown ? this.input.activePointer : undefined
    const mode: 'channel' | 'charge' = skill.kind === 'channel' ? 'channel' : 'charge'
    this.held = { slot, skill, mode, key: byKey ? key : undefined, pointer, startedAt: now, nextTickAt: now, fx: [] }
    audio.playSfx('skill')
    this.announceSkill(skill.name)
    if (mode === 'channel') this.updateHeld(now) // 1er tick immédiat (un tap = au moins une décharge)
    else this.beginChargeFx(skill)
  }

  private updateHeld(now: number) {
    const h = this.held
    if (!h) return
    if (h.mode === 'channel') {
      if (now >= h.nextTickAt) {
        const cfg = h.skill.channel!
        if (!this.player.spendEnergy(cfg.manaPerTick)) { this.announceSkill('Plus d\'énergie', 0x4dd0e1); this.endHold(); return }
        h.nextTickAt = now + cfg.tickMs
        this.channelTick(h.skill)
      }
      if (!this.isHeldDown(h)) this.endHold() // bouton relâché → fin du canal
    } else {
      // charge : le télégraphe grandit ; on relâche à la levée du bouton
      if (!this.isHeldDown(h)) this.releaseCharge()
    }
  }

  // coupe proprement un maintien (canalisé) sans déclencher de relâche chargée
  private endHold() {
    const h = this.held
    if (!h) return
    this.held = null
    h.fx?.forEach((o) => o.destroy())
    if (h.mode === 'channel') {
      this.cooldowns.use(h.slot, this.time.now, h.skill.cooldownMs)
      this.game.events.emit('skill-cooldown', h.slot, this.time.now + h.skill.cooldownMs, h.skill.cooldownMs)
    }
  }

  // Un tick de sort canalisé : mitraillette (rafale de flèches), lance-flammes (jet couvrant haut+bas),
  // éclair (foudre frontale au contact). Le joueur peut se déplacer pendant le canal (pas de lock).
  private channelTick(skill: SkillDef) {
    const p = getPlayer()
    const rank = p.skillLevels[skill.id] ?? 1
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const dmg = atk * skillDamageMult(skill, rank)
    const px = this.player.x, py = this.player.y, f = this.player.facing
    if (skill.id === 'mitraillette') {
      const off = Phaser.Math.Between(-7, 7)
      const proj = this.spawnPlayerProjectile(dmg, skill.range, off)
      proj.setTexture('fx-arrow').clearTint().setScale(1.1)
      // buff flèche enflammée : flammèche minuscule à la POINTE (pas de gros sprite fx-fleche-enflammee)
      if (this.player.isFlaming()) this.attachTipFlame(proj)
      this.mitrailletteFx(px + f * 26, py + 10, f)
      return
    }
    const tall = skill.channel?.tall
    const band = tall ? 155 : 74
    let touched = false
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      const dx = (e.x - px) * f
      if (dx >= -22 && dx <= skill.range && Math.abs(e.y - py) <= band) {
        e.takeDamage(physicalDamage(dmg, e.effectiveDef()))
        if (skill.id === 'lance-flammes') e.applyBurn(atk * 0.1, 1100)
        touched = true
      }
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      const dx = (prop.x - px) * f
      if (prop.active && dx >= -22 && dx <= skill.range && Math.abs(prop.y - py) <= band) prop.takeDamage(1)
    }
    if (skill.id === 'lance-flammes') this.flamethrowerFx(px, py, f, skill.range)
    else this.lightningChannelFx(px, py, f, Math.min(skill.range, 160))
    if (touched) audio.playSfx('hit')
  }

  // Lance-flammes : jet de feu monté sur le sprite fx-lance-flammes (haut+bas), + braises fugaces.
  private flamethrowerFx(px: number, py: number, f: 1 | -1, reach: number) {
    // cône de flammes PROCÉDURAL (orange/rouge, AUCUN blanc, blend NORMAL), collé au joueur et évasé
    // (couvre haut ET bas). Fini le sprite fx-lance-flammes trop clair + l'écart avec le panda.
    const y0 = py - this.player.displayHeight * 0.25 // remonté d'~1/4 de la taille du perso
    // IMAGE fx-lance-flammes RÉTABLIE (le cône procédural était moche), teintée orange, COLLÉE au panda
    // (centre à ~0.42·reach → bord gauche quasi sur le panda) et remontée d'~1/4 de sa taille (y0).
    if (this.textures.exists('fx-lance-flammes')) {
      const jet = this.add.image(px + f * (reach * 0.42), y0, 'fx-lance-flammes')
        .setDepth(7).setFlipX(f === -1).setAlpha(0.85).setTint(0xf4611e)
      jet.setDisplaySize(reach, 150 * Phaser.Math.FloatBetween(0.8, 1.15))
      jet.setAngle(f * Phaser.Math.FloatBetween(-6, 6))
      this.tweens.add({ targets: jet, alpha: 0, duration: 150, ease: 'Sine.out', onComplete: () => jet.destroy() })
    }
    for (let i = 0; i < 3; i++) {
      const ex = px + f * Phaser.Math.Between(20, reach)
      const em = this.add.circle(ex, y0 + Phaser.Math.Between(-55, 55), Phaser.Math.Between(2, 4), 0xffa040).setDepth(6).setAlpha(0.8)
      this.tweens.add({ targets: em, y: em.y - Phaser.Math.Between(14, 28), alpha: 0, duration: 260, onComplete: () => em.destroy() })
    }
  }

  // Éclair canalisé : petits arcs bleus crépitant au contact devant le mage.
  private lightningChannelFx(px: number, py: number, f: 1 | -1, reach: number) {
    const g = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
    g.lineStyle(3, 0x64b5ff, 0.95).beginPath()
    let cx = px + f * 10, cy = py
    g.moveTo(cx, cy)
    for (let i = 1; i <= 5; i++) { cx = px + f * (reach * i) / 5; cy = py + Phaser.Math.Between(-30, 30); g.lineTo(cx, cy) }
    g.strokePath()
    this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() })
  }

  // Muzzle-flash de la mitraillette (fx-mitraillette) : éclair de bouche bref à la main.
  private mitrailletteFx(x: number, y: number, f: 1 | -1) {
    if (this.textures.exists('fx-mitraillette')) {
      const m = this.add.image(x, y, 'fx-mitraillette').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setFlipX(f === -1).setScale(0.9).setAlpha(0.95)
      this.tweens.add({ targets: m, scaleX: 1.1 * f, alpha: 0, duration: 90, onComplete: () => m.destroy() })
    }
    audio.playSfx('attack')
  }

  // Télégraphe de charge (boule de feu) : orbe qui enfle à la main tant qu'on maintient.
  private beginChargeFx(skill: SkillDef) {
    const color = this.skillColor(skill.id)
    const orb = this.add.image(this.player.x, this.player.y, 'ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.player.depth + 1).setScale(0.15).setAlpha(0.85)
    this.tweens.add({ targets: orb, scale: 1.4, duration: CHARGE_FULL_MS, ease: 'Cubic.in' })
    const ev = this.time.addEvent({ delay: 30, loop: true, callback: () => {
      if (!this.held || this.held.mode !== 'charge') { ev.remove(); return }
      orb.setPosition(this.player.x + this.player.facing * 20, this.player.y + 14)
    } })
    this.held!.fx = [orb, { destroy: () => ev.remove() } as unknown as Phaser.GameObjects.GameObject]
  }

  // Relâche une attaque chargée : puissance interpolée selon la fraction de charge (tôt = faible).
  private releaseCharge() {
    const h = this.held
    if (!h) return
    this.held = null
    h.fx?.forEach((o) => o.destroy())
    const skill = h.skill
    const now = this.time.now
    if (!this.player.spendEnergy(skill.manaCost ?? energyCostOf(skill))) { this.announceSkill('Pas assez d\'énergie', 0x4dd0e1); return }
    this.cooldowns.use(h.slot, now, skill.cooldownMs)
    this.game.events.emit('skill-cooldown', h.slot, now + skill.cooldownMs, skill.cooldownMs)
    audio.playSfx('skill')
    const p = getPlayer()
    const rank = p.skillLevels[skill.id] ?? 1
    const frac = Phaser.Math.Clamp((now - h.startedAt) / CHARGE_FULL_MS, 0, 1)
    const chargeMul = CHARGE_MIN_MULT + (1 - CHARGE_MIN_MULT) * frac
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const dmg = atk * skillDamageMult(skill, rank) * chargeMul
    const color = this.skillColor(skill.id)
    this.player.playAttack()
    const proj = this.spawnPlayerProjectile(dmg, skill.range)
    const scale = (skill.blast ? 2.0 : 1.4) * (0.7 + 0.9 * frac)
    proj.setTexture('fx-fireball-orange').clearTint()
    this.fireballShimmer(proj, scale)
    if (skill.blast) proj.blast = { radius: skill.blast * (0.8 + 0.9 * frac), color }
    if (frac > 0.8) { this.flashScreen(0xff7043, 0.14, 130); this.screenShake(0.006, 120); this.hitStop(50) }
  }

  // ═════════════ CHEVALIER : Grand-croix (croix de lumière) ═════════════
  private castGrandCross(skill: SkillDef, mult: number, color: number) {
    const f = this.player.facing
    const cx = this.player.x + f * 30, cy = this.player.y
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const hReach = skill.range * 2.4, vReach = 210, thick = 92
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      const onH = Math.abs(e.y - cy) <= thick && Math.abs(e.x - cx) <= hReach
      const onV = Math.abs(e.x - cx) <= thick && Math.abs(e.y - cy) <= vReach
      if (onH || onV) e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult))
    }
    for (const obj of this.props.getChildren()) {
      const prop = obj as Prop
      if (prop.active && Math.abs(prop.y - cy) <= thick && Math.abs(prop.x - cx) <= hReach) prop.takeDamage(1)
    }
    // ── CROIX DIVINE : bras de lumière ÉNORMES (dimensionnés sur la portée) + cœur blanc éclatant,
    //    god-rays radiaux, halo additif et gros flash. Doit crier « sacré ».
    const hBar = this.add.rectangle(cx, cy, hReach * 2, thick, 0xfff3c0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    const vBar = this.add.rectangle(cx, cy, thick, vReach * 2, 0xfff3c0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    const hCore = this.add.rectangle(cx, cy, hReach * 2, thick * 0.4, 0xffffff).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    const vCore = this.add.rectangle(cx, cy, thick * 0.4, vReach * 2, 0xffffff).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    for (const bar of [hBar, vBar]) this.tweens.add({ targets: bar, alpha: 0.92, duration: 90, yoyo: true, hold: 150, onComplete: () => bar.destroy() })
    for (const core of [hCore, vCore]) this.tweens.add({ targets: core, alpha: 1, duration: 70, yoyo: true, hold: 110, onComplete: () => core.destroy() })
    // god-rays : faisceaux radiaux qui jaillissent du cœur de la croix
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const ray = this.add.rectangle(cx, cy, 8, 230, 0xfff59d).setOrigin(0.5, 0).setRotation(a).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85)
      this.tweens.add({ targets: ray, scaleY: 1.7, alpha: 0, duration: 440, delay: 60, ease: 'Cubic.out', onComplete: () => ray.destroy() })
    }
    // halo éclatant qui enfle
    for (let i = 0; i < 3; i++) {
      const halo = this.add.image(cx, cy, 'ring').setTint(0xfff3c0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9)
      this.tweens.add({ targets: halo, scale: 5 + i * 2, alpha: 0, duration: 520 + i * 120, delay: i * 70, ease: 'Cubic.out', onComplete: () => halo.destroy() })
    }
    if (this.textures.exists('fx-grand-croix')) {
      const cross = this.add.image(cx, cy, 'fx-grand-croix').setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.98)
      this.tweens.add({ targets: cross, scale: 3.0, alpha: 0, duration: 560, ease: 'Cubic.out', onComplete: () => cross.destroy() })
    }
    this.beamStrikeFx(cx, cy, color)
    this.flashScreen(0xfff3c0, 0.42, 200)
    this.cameras.main.flash(180, 255, 248, 210)
    this.screenShake(0.016, 320)
    this.hitStop(130)
    audio.playSfx('hit')
  }

  // ═════════════ CHEVALIER : Charge lancière (RUÉE qui pousse + larde) ═════════════
  // Le chevalier FONCE droit devant, lance abaissée : tout ennemi sur sa route est POUSSÉ (knockback
  // CONTINU, jamais traversé) et lardé de coups PAR TICK tant qu'il est poussé. Le RANG augmente la
  // PUISSANCE (`damage` déjà multiplié par le rang) ET la DURÉE/distance de la ruée.
  private castLanceCharge(skill: SkillDef, damage: number, rank: number, color: number) {
    const cfg = skill.lanceCharge!
    const f = this.player.facing
    // durée allongée avec le rang (+18 %/rang au-delà du 1er) → distance = vitesse × durée qui grandit
    const durationMs = cfg.durationMs * (1 + 0.18 * (rank - 1))
    this.player.beginLanceCharge(f, cfg.speedPx)
    this.lungeFx(24)
    this.screenShake(0.006, 140)
    const reach = 84 // portée frontale de la lance (px au-delà du corps)
    const endAt = this.time.now + durationMs
    const tick = this.time.addEvent({ delay: cfg.tickMs, loop: true, callback: () => {
      if (!this.player.active || !this.player.isLancing()) { tick.remove(); return }
      const px = this.player.x, py = this.player.y
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (!e.active || e.ragdolling) continue
        const dx = (e.x - px) * f // devant le panda
        const dy = Math.abs(e.y - py)
        if (dx < -20 || dx > reach || dy > 90) continue
        // POUSSE l'ennemi devant (knockback qui PREND : l'IA de déplacement est suspendue le temps du
        // recul → il part vraiment en arrière) + dégâts par tick. Un peu plus long que le tick pour un
        // recul continu et lisible pendant toute la ruée.
        e.applyKnockback(f * cfg.knockbackPx, -140, cfg.tickMs + 120)
        e.takeDamage(physicalDamage(damage, e.effectiveDef()))
        this.impactFx(e.x, e.y, color)
      }
      // fer de lance doré devant le panda
      const lanceFx = this.add.rectangle(px + f * reach * 0.6, py + 6, reach, 6, 0xffd54f)
        .setOrigin(0.5).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85)
      this.tweens.add({ targets: lanceFx, alpha: 0, scaleX: 1.2, duration: cfg.tickMs, onComplete: () => lanceFx.destroy() })
    } })
    this.time.delayedCall(durationMs, () => { tick.remove(); this.player.endLanceCharge() })
    // sillage doré pendant la ruée
    const trail = this.time.addEvent({ delay: 20, loop: true, callback: () => {
      if (this.time.now >= endAt || !this.player.active) { trail.remove(); return }
      const echo = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
        .setFlipX(this.player.flipX).setAlpha(0.35).setTint(0xfff3c4).setDepth(this.player.depth - 1)
        .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
      this.tweens.add({ targets: echo, alpha: 0, duration: 220, onComplete: () => echo.destroy() })
    } })
  }

  // ═════════════ MAGE : Aura d'épines (aura offensive d'éclairs) ═════════════
  private castThornAura(skill: SkillDef, mult: number, color: number) {
    const cfg = skill.aura!
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const endAt = this.time.now + cfg.durationMs
    const useSprite = this.textures.exists('fx-aura-epines')
    const aura = this.add.image(this.player.x, this.player.y, useSprite ? 'fx-aura-epines' : 'ring')
      .setDepth(this.player.depth - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(useSprite ? 0xffffff : color).setAlpha(0.7)
    if (useSprite) aura.setDisplaySize(cfg.radius * 2, cfg.radius * 2)
    else aura.setScale((cfg.radius / 28))
    this.tweens.add({ targets: aura, angle: 360, duration: 2600, repeat: -1 })
    this.tweens.add({ targets: aura, alpha: 0.45, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    // RECALAGE À CHAQUE FRAME (POST_UPDATE, comme syncOverlays) : l'aura colle au panda sans latence.
    // Le timer ne sert QU'AUX ticks de dégâts, plus au suivi de position (qui traînait d'un tick).
    const follow = () => { if (aura.active) aura.setPosition(this.player.x, this.player.y) }
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow, this)
    const tick = this.time.addEvent({ delay: cfg.tickMs, loop: true, callback: () => {
      if (!this.player.active || this.time.now >= endAt) {
        tick.remove()
        this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow, this)
        this.tweens.killTweensOf(aura)
        this.tweens.add({ targets: aura, alpha: 0, scale: aura.scale * 1.2, duration: 240, onComplete: () => aura.destroy() })
        return
      }
      let hit = false
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= cfg.radius) {
          e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult))
          hit = true
        }
      }
      // éclats d'épines radiaux
      for (let i = 0; i < 3; i++) {
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2)
        const sp = this.add.rectangle(this.player.x, this.player.y, 3, 12, 0xb388ff).setDepth(this.player.depth + 1).setBlendMode(Phaser.BlendModes.ADD).setRotation(a)
        this.tweens.add({ targets: sp, x: this.player.x + Math.cos(a) * cfg.radius, y: this.player.y + Math.sin(a) * cfg.radius, alpha: 0, duration: cfg.tickMs, onComplete: () => sp.destroy() })
      }
      if (hit) audio.playSfx('hit')
    } })
    this.aoeRing(this.player.x, this.player.y, cfg.radius, color, true)
  }

  // ═════════════ SORCIER : Faille du néant (aspire + annihile les faibles, repousse les autres) ═══
  private castVoidRift(skill: SkillDef, mult: number, color: number) {
    const f = this.player.facing
    const cx = this.player.x + f * 70, cy = this.player.y
    const radius = skill.range
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const lvl = getPlayer().level
    // déchirure : sprite fx-faille-neant qui s'ouvre + flash + secousse
    if (this.textures.exists('fx-faille-neant')) {
      const rift = this.add.image(cx, cy, 'fx-faille-neant').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.95)
      this.tweens.add({ targets: rift, scale: (radius * 2) / Math.max(1, rift.height), duration: 300, ease: 'Cubic.out',
        onComplete: () => this.tweens.add({ targets: rift, alpha: 0, angle: 40, duration: 320, onComplete: () => rift.destroy() }) })
    }
    this.aoeRing(cx, cy, radius, color, true)
    this.flashScreen(0x7e57c2, 0.2, 200)
    this.screenShake(0.012, 260)
    this.hitStop(70)
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      if (Phaser.Math.Distance.Between(cx, cy, e.x, e.y) > radius) continue
      const weak = !e.monster.boss && !e.monster.mvp && e.monster.level < lvl
      if (weak) {
        // aspiration (particules convergentes vers la faille) puis ANNIHILATION
        for (let i = 0; i < 6; i++) {
          const sp = this.add.rectangle(e.x + Phaser.Math.Between(-20, 20), e.y + Phaser.Math.Between(-20, 20), 4, 4, 0xce93d8).setDepth(8).setBlendMode(Phaser.BlendModes.ADD)
          this.tweens.add({ targets: sp, x: cx, y: cy, alpha: 0, duration: 200, ease: 'Cubic.in', onComplete: () => sp.destroy() })
        }
        this.time.delayedCall(190, () => { if (e.active) { this.impactFx(e.x, e.y, 0x7e57c2); e.takeDamage(e.hp + 100000) } })
      } else {
        // boss / élite / mob de niveau ≥ joueur : IMMUNISÉ à l'annihilation, juste violemment repoussé
        const dir = (Math.sign(e.x - cx) || 1) as 1 | -1
        ;(e.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 400, -180)
        e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.5))
      }
    }
    audio.playSfx('hit')
  }

  // ═════════════ ARCHER : Flèche-grappin (tracte le panda sur une plateforme devant/au-dessus) ═════
  // ═════════════ CHASSEUR : Flèches entravantes (ralenti de zone) ═════════════
  // Ralentit TOUS les ennemis actifs à l'écran (vitesse ET cadence, cf. Enemy.applySlow) pendant
  // skill.slow.durationMs, sans leur infliger de dégâts. Volée de flèches bleutées + halo de zone.
  private castSlow(skill: SkillDef, color: number) {
    const { factor, durationMs } = skill.slow!
    let n = 0
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      e.applySlow(factor, durationMs)
      n++
    }
    // halo de zone glacé autour du joueur + fines flèches entravantes qui filent vers l'extérieur
    this.aoeRing(this.player.x, this.player.y, 220, color, true)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const dart = this.add.rectangle(this.player.x, this.player.y, 12, 3, color).setRotation(a).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9)
      this.tweens.add({ targets: dart, x: this.player.x + Math.cos(a) * 230, y: this.player.y + Math.sin(a) * 230, alpha: 0, duration: 360, ease: 'Cubic.out', onComplete: () => dart.destroy() })
    }
    this.flashScreen(color, 0.1, 140)
    this.announceSkill(`${n} ennemi(s) ralenti(s)`, color)
  }

  // FAUCON LISIBLE (tir-du-faucon & assaut-du-faucon) : le faucon SPAWNE au COIN de l'écran le PLUS
  // ÉLOIGNÉ de la cible et traverse en PIQUÉ à vitesse MODÉRÉE (~500 ms), sprite orienté vers le vol,
  // jusqu'à frapper. `onImpact` est appelé à l'arrivée (dégâts / explosion). Longue trajectoire lisible.
  private falconDive(targetX: number, targetY: number, durationMs: number, onImpact: () => void) {
    const key = this.textures.exists('fx-tir-faucon') ? 'fx-tir-faucon'
      : (this.textures.exists('fx-blitz-faucon') ? 'fx-blitz-faucon' : 'fx-arrow')
    const cam = this.cameras.main
    const left = cam.scrollX, right = cam.scrollX + cam.width
    const top = cam.scrollY, bottom = cam.scrollY + cam.height
    // coin de l'écran (monde) le plus ÉLOIGNÉ de la cible → longue diagonale de piqué
    const cornerX = Math.abs(targetX - left) > Math.abs(targetX - right) ? left : right
    const cornerY = Math.abs(targetY - top) > Math.abs(targetY - bottom) ? top : bottom
    const falcon = this.add.image(cornerX, cornerY, key).setDepth(9).setScale(1.0)
    // ORIENTATION : le faucon (dessiné face à DROITE) reste TOUJOURS à l'endroit (dos en haut). On gère
    // le sens horizontal par un flip (flipX) et l'inclinaison du piqué par une rotation bornée à ≤ 90°
    // (jamais au-delà de la verticale → jamais ventre en l'air). Vol à gauche → flipX + rotation inversée.
    const down = Math.atan2(Math.abs(targetY - cornerY), Math.abs(targetX - cornerX)) // 0..π/2 (piqué vers le bas)
    const leftward = targetX < cornerX
    falcon.setFlipX(!leftward)
    falcon.setRotation(leftward ? -down : down)
    this.tweens.add({
      targets: falcon, x: targetX, y: targetY, duration: durationMs, ease: 'Quad.in',
      onComplete: () => { onImpact(); falcon.destroy() },
    })
  }

  // ═════════════ CHASSEUR : Tir du faucon (piqué explosif lisible) ═════════════
  private castFalconStrike(skill: SkillDef, damage: number, color: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    let target: Enemy | null = null
    let bestD = Infinity
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active || e.ragdolling) continue
      const dx = (e.x - px) * f
      if (dx < -10 || dx > skill.range) continue
      const d = Phaser.Math.Distance.Between(px, py, e.x, e.y)
      if (d < bestD) { bestD = d; target = e }
    }
    const tx = target ? target.x : px + f * Math.min(skill.range, 320)
    const ty = target ? target.y : this.groundRow * TILE - 20
    const radius = skill.explodeRadius ?? 120
    this.falconDive(tx, ty, 950, () => {
      const ex = target && target.active ? target.x : tx
      const ey = target && target.active ? target.y : ty
      this.explosionFx(ex, ey, radius, color)
      this.screenShake(Math.min(0.02, radius * 0.0001), 200)
      audio.playSfx('hit')
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Enemy
        if (e.active && !e.ragdolling && Phaser.Math.Distance.Between(ex, ey, e.x, e.y) <= radius) e.takeDamage(physicalDamage(damage, e.effectiveDef()))
      }
      for (const obj of this.props.getChildren()) {
        const prop = obj as Prop
        if (prop.active && Phaser.Math.Distance.Between(ex, ey, prop.x, prop.y) <= radius) prop.takeDamage(1)
      }
    })
  }

  // ═════════════ CHASSEUR : Assaut du faucon (piqué en coups multiples) ═════════════
  private castFalconBlitz(skill: SkillDef, dmg: number, color: number) {
    const px = this.player.x, py = this.player.y, f = this.player.facing
    let target: Enemy | null = null
    let bestD = Infinity
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active || e.ragdolling) continue
      const dx = (e.x - px) * f
      if (dx < -10 || dx > skill.range) continue
      const d = Phaser.Math.Distance.Between(px, py, e.x, e.y)
      if (d < bestD) { bestD = d; target = e }
    }
    if (!target) {
      // aucune cible : un unique piqué lisible vers un point devant (aucun dégât, pur spectacle)
      this.falconDive(px + f * Math.min(skill.range, 320), this.groundRow * TILE - 20, 950, () => {})
      return
    }
    const hits = 3
    for (let i = 0; i < hits; i++) {
      // piqués successifs et LISIBLES depuis le coin de l'écran (staggered), chacun ~460 ms
      this.time.delayedCall(i * 220, () => {
        if (!target!.active || target!.ragdolling) return
        this.falconDive(target!.x, target!.y, 820, () => {
          if (target!.active && !target!.ragdolling) {
            target!.takeDamage(physicalDamage(dmg / hits, target!.effectiveDef()))
            this.impactFx(target!.x, target!.y, color)
          }
        })
      })
    }
    audio.playSfx('hit')
  }

  // ═════════════ SORCIER : Tempête foudroyante (nuke orage sur zone) ═════════════
  private executeStorm(skill: SkillDef, cx: number, cy: number, mult: number) {
    const radius = skill.range
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const marker = this.add.graphics().setDepth(3)
    marker.fillStyle(0x5c6bc0, 0.14).fillCircle(cx, cy, radius).lineStyle(3, 0x9fa8da, 0.7).strokeCircle(cx, cy, radius)
    this.tweens.add({ targets: marker, alpha: 0, duration: 1400, onComplete: () => marker.destroy() })
    if (this.textures.exists('fx-tempete')) {
      const storm = this.add.image(cx, cy - radius * 0.4, 'fx-tempete').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.95)
      storm.setDisplaySize(radius * 2.4, radius * 2.2)
      this.tweens.add({ targets: storm, alpha: 0, duration: 1200, onComplete: () => storm.destroy() })
    }
    const strikes = 7
    for (let i = 0; i < strikes; i++) {
      this.time.delayedCall(i * 150, () => {
        const sx = cx + Phaser.Math.FloatBetween(-radius, radius)
        this.lightningStrikeFx(sx, cy)
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e.active && Phaser.Math.Distance.Between(sx, cy, e.x, e.y) <= radius * 0.5) e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.5))
        }
      })
    }
    this.flashScreen(0xcfe8ff, 0.28, 200)
    this.screenShake(0.014, 400)
    audio.playSfx('hit')
  }

  // colonne de foudre verticale qui s'abat (Tempête)
  private lightningStrikeFx(x: number, groundY: number) {
    const g = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD)
    g.lineStyle(4, 0x82b1ff, 0.95).beginPath()
    let y = groundY - 300
    g.moveTo(x, y)
    while (y < groundY) { y += 30; g.lineTo(x + Phaser.Math.Between(-18, 18), y) }
    g.strokePath()
    const core = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD)
    core.lineStyle(2, 0xffffff, 1).lineBetween(x, groundY - 300, x, groundY)
    this.tweens.add({ targets: [g, core], alpha: 0, duration: 180, onComplete: () => { g.destroy(); core.destroy() } })
    this.impactFx(x, groundY, 0x82b1ff)
  }

  // ═════════════ SORCIER : Blizzard (nuke de glace sur zone) ═════════════
  private executeBlizzard(skill: SkillDef, cx: number, cy: number, mult: number) {
    const radius = skill.range
    const atk = this.player.stats.atk * this.player.outgoingMult()
    const marker = this.add.graphics().setDepth(3)
    marker.fillStyle(0x4dd0e1, 0.14).fillCircle(cx, cy, radius).lineStyle(3, 0xb2ebf2, 0.7).strokeCircle(cx, cy, radius)
    this.tweens.add({ targets: marker, alpha: 0, duration: 1500, onComplete: () => marker.destroy() })
    if (this.textures.exists('fx-blizzard')) {
      const bz = this.add.image(cx, cy, 'fx-blizzard').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.95)
      bz.setDisplaySize(radius * 2.3, radius * 2.3)
      this.tweens.add({ targets: bz, angle: 90, alpha: 0, duration: 1400, onComplete: () => bz.destroy() })
    }
    // éclats de glace qui tombent en biais
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(Phaser.Math.Between(0, 1000), () => {
        const ix = cx + Phaser.Math.FloatBetween(-radius, radius)
        const shard = this.add.rectangle(ix - 40, cy - 200, 3, 12, 0xe1f5fe).setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setRotation(0.7)
        this.tweens.add({ targets: shard, x: ix, y: cy + Phaser.Math.Between(-10, 12), alpha: 0, duration: 320, onComplete: () => shard.destroy() })
      })
    }
    const ticks = 5
    for (let t = 0; t < ticks; t++) {
      this.time.delayedCall(150 + t * 200, () => {
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e.active && Phaser.Math.Distance.Between(cx, cy, e.x, e.y) <= radius) e.takeDamage(physicalDamage(atk, e.effectiveDef(), mult * 0.4))
        }
      })
    }
    this.flashScreen(0xb2ebf2, 0.2, 220)
    this.screenShake(0.01, 360)
    audio.playSfx('hit')
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

  // SAUT SUR LA TÊTE : inflige au monstre les MÊMES dégâts qu'une attaque de base (atk du joueur ×
  // multiplicateurs sortants, réduit par la def du monstre) + brûlure si l'épée est enflammée, puis
  // fait REBONDIR le joueur (petite détente) pour enchaîner et ne pas retomber au contact.
  private stompEnemy(e: Enemy) {
    const atk = this.player.stats.atk * this.player.outgoingMult()
    e.takeDamage(physicalDamage(atk, e.effectiveDef()))
    if (this.player.isFlaming()) e.applyBurn(atk * 0.35, 3000)
    audio.playSfx('hit')
    this.impactFx(e.x, e.y - 8, 0xffffff)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-360) // rebond
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
      // très rarement, le coffre recèle un trésor épique/légendaire (révélation brillante réutilisée)
      const rareItem = rollChestRareItem()
      if (rareItem) this.spawnItemDrop(prop.x, prop.y, rareItem)
    }
    this.spawnDrops(prop.x, prop.y, prop.def.drops)
  }

  // Fabrique un ramassable. Deux comportements (retour joueur : « rien au sol, tout lévite ; les
  // objets qui tombent doivent tomber à côté puis s'arrêter ; les pièces doivent voler et chatoyer ») :
  //  - `float:true` (pièces) → FLOTTE immédiatement en l'air là où c'est lâché (aucune chute) + chatoie ;
  //  - sinon → petit saut, CHUTE COURTE à côté (peu de dérive : vitesse H réduite + traînée), puis dès
  //    qu'il touche le sol il se FIGE et LÉVITE (settlePickup). Objets « pas trop petits » (~26 px).
  private makeDrop(x: number, y: number, texture: string, data: Record<string, unknown>, opts?: { tint?: number; size?: number; float?: boolean }) {
    const s = this.pickups.create(x + Phaser.Math.Between(-14, 14), y - 10, texture) as Phaser.Physics.Arcade.Sprite
    const body = s.body as Phaser.Physics.Arcade.Body
    s.setData({ ...data, settled: false })
    if (opts?.tint !== undefined) s.setTint(opts.tint)
    s.setDisplaySize(opts?.size ?? 26, opts?.size ?? 26)
    s.setDepth(4)
    if (opts?.float) {
      // PIÈCE : vole/flotte sur place + chatoiement (scale + alpha pulsés). Aucune chute.
      this.settlePickup(s, s.y)
      this.addShimmer(s)
    } else {
      // OBJET : petit pop + chute courte (peu de dérive H, traînée pour s'arrêter net), puis lévitation
      // dès l'atterrissage (cf. updatePickups → settlePickup).
      s.setVelocity(Phaser.Math.Between(-22, 22), -150)
      body.setBounce(0.05, 0.05)
      body.setDragX(500)
    }
    return s
  }

  // Fige un ramassable et le fait LÉVITER : le corps ne bouge plus par la physique (`moves=false`,
  // il suit désormais la position du GO), mais reste ACTIF pour l'overlap de ramassage. On pilote un
  // léger va-et-vient vertical par tween → ondulation bas-haut « qui donne envie », un peu au-dessus
  // du sol (jamais posé). `restRef` = y de référence (position d'atterrissage ou de flottaison).
  private settlePickup(s: Phaser.Physics.Arcade.Sprite, restRef: number) {
    if (s.getData('settled')) return
    s.setData('settled', true)
    const body = s.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.setAllowGravity(false)
    body.moves = false // la physique ne le déplace plus ; le corps suit le GO (overlap toujours actif)
    const restY = restRef - PICKUP_HOVER_LIFT // relevé au-dessus du sol → il lévite, jamais posé
    s.setY(restY)
    this.tweens.add({
      targets: s, y: restY + PICKUP_HOVER_BOB, duration: 900, yoyo: true, repeat: -1,
      ease: 'Sine.inOut', delay: Phaser.Math.Between(0, 320),
    })
  }

  // Chatoiement d'une pièce : pulsation douce d'échelle + d'alpha (autour de l'échelle courante fixée
  // par setDisplaySize) → effet « or scintillant ». N'affecte pas la position (compatible lévitation).
  private addShimmer(s: Phaser.Physics.Arcade.Sprite) {
    const bs = s.scaleX
    this.tweens.add({ targets: s, scaleX: bs * 1.14, scaleY: bs * 1.14, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.tweens.add({ targets: s, alpha: 0.72, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  // Passe chaque ramassable NON encore figé en lévitation dès qu'il touche une surface (fin de chute).
  private updatePickups() {
    for (const obj of this.pickups.getChildren()) {
      const s = obj as Phaser.Physics.Arcade.Sprite
      if (!s.active || s.getData('settled')) continue
      const body = s.body as Phaser.Physics.Arcade.Body
      if (body.blocked.down || body.touching.down) this.settlePickup(s, s.y)
    }
  }

  // Lâche un unique objet ramassable (icône illustrée si dispo, sinon pastille générique).
  private spawnItemDrop(x: number, y: number, itemId: string) {
    const illustrated = this.textures.exists(`item-${itemId}`)
    this.makeDrop(x, y, illustrated ? `item-${itemId}` : 'item-drop', { itemId }, { size: illustrated ? 26 : undefined })
  }

  spawnDrops(x: number, y: number, drops: DropEntry[]) {
    const result = rollDrops(drops)
    if (result.gold > 0) this.makeDrop(x, y, 'coin', { gold: result.gold }, { float: true, size: 26 })
    for (let i = 0; i < result.potions; i++) this.makeDrop(x, y, 'potion-drop', { potion: 1 }, { size: 26 })
    // objet lâché : icône illustrée item-<id> (dimensionnée) si dispo, sinon la pastille générique
    for (const itemId of result.items) {
      if (this.textures.exists(`item-${itemId}`)) this.makeDrop(x, y, `item-${itemId}`, { itemId }, { size: 26 })
      else this.makeDrop(x, y, 'item-drop', { itemId })
    }
    for (const materialId of result.materials) this.makeDrop(x, y, 'material-drop', { materialId }, { tint: MATERIALS[materialId]!.color, size: 24 })
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
    this.showHealNumber(this.player.heal(Math.round(this.player.stats.maxHp * 0.5))) // chiffre VERT de soin
    save(p)
    this.game.events.emit('hud-refresh')
  }

  onEnemyDied(e: Enemy) {
    const p = getPlayer()
    audio.playSfx('enemy-death')
    p.monstersKilled += 1
    recordKill(p, e.monster.id)
    const { levelsGained } = grantXp(p, playerXpGain(e.monster))
    this.events.emit('enemy-loot', e) // consommé en Task 13
    if (levelsGained > 0) {
      this.player.refreshStats()
      // passage de niveau : PV + mana/énergie remis à 100 % (une seule fois, même si plusieurs
      // niveaux gagnés d'un coup — restoreFull est idempotent sur le max)
      this.player.restoreFull()
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
    this.bossCtrl?.destroy()
    this.bossCtrl = null
    this.bossBarBg?.destroy()
    this.bossBar?.destroy()
    this.bossName?.destroy()
    this.boss = null
    this.bossBar = null
    this.bossBarBg = null
    this.bossName = null
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
    if (this.held) this.updateHeld(this.time.now)
    if (this.player.hp <= 0) { if (this.held) this.endHold(); return }
    // chute mortelle : uniquement quand le panda a plongé jusqu'au fond du monde dans un vrai trou
    this.checkPitDeath()
    if (this.player.hp <= 0) return
    this.player.regenEnergy(delta)
    // Régénération PASSIVE (sabreur) : remonte lentement les PV hors combat si le passif est appris.
    // On CUMULE les PV rendus et on affiche un chiffre de soin vert par paquets (~toutes les 900 ms)
    // plutôt qu'un +1 spammé à chaque frame.
    this.passiveHealAccum += this.player.passiveRegen(delta, hpRegenPerSec(getPlayer()))
    if (this.passiveHealAccum > 0 && this.time.now >= this.passiveHealFlushAt) {
      this.showHealNumber(this.passiveHealAccum)
      this.passiveHealAccum = 0
      this.passiveHealFlushAt = this.time.now + 900
    }
    // zones verticales chevauchées (échelle / eau) lues sur le centre du panda
    const onLad = this.ladderRects.find((r) => r.contains(this.player.x, this.player.y))
    this.player.onLadder = !!onLad
    if (onLad) this.player.ladderCenterX = onLad.centerX
    // cascade REMONTABLE : on nage/grimpe dedans sans noyade (inCascade) ; le bassin marine, lui,
    // noie (waterRects). inWater (mécanique de nage) couvre les deux.
    this.player.inCascade = this.cascadeRects.some((r) => r.contains(this.player.x, this.player.y))
    const containingWater = this.waterRects.find((r) => r.contains(this.player.x, this.player.y))
      ?? this.cascadeRects.find((r) => r.contains(this.player.x, this.player.y))
    this.player.inWater = this.player.inCascade || this.waterRects.some((r) => r.contains(this.player.x, this.player.y))
    // surface (ligne d'eau) de la nappe/colonne courante : le Player s'en sert pour SORTIR de l'eau
    // en sautant (près de la surface, nager vers le haut donne une vraie détente hors de l'eau).
    this.player.waterSurfaceY = containingWater ? containingWater.top : Number.POSITIVE_INFINITY
    // ENTRÉE dans un LAC MARINE (front montant de inWater, hors cascade) : la surface ONDULE au point
    // d'impact (ripple de vaguelettes). On EXCLUT la cascade — y « tomber » se fait par le bas de la
    // colonne, un splash posé en haut du rideau serait faux (retour user : gouttes parasites en haut).
    if (this.player.inWater && !this.wasInWater && !this.player.inCascade && containingWater) {
      this.waterSplashFx(this.player.x, containingWater.top)
    }
    this.wasInWater = this.player.inWater
    this.updateWater(delta)
    this.updateLava(delta)
    this.updateFlames(delta)
    this.updatePickups()
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
      this.bossCtrl?.step(this.time.now, delta)
    }
  }
}
