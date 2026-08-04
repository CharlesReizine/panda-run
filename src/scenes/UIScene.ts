import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { getPlayer } from '../state'
import { xpToNext } from '../core/progression'
import { audio } from '../audio/audio-engine'
import type { LevelScene } from './LevelScene'
import { VIEW_H, VIEW_W, centerCamera, fromLeft, fromRight } from '../core/viewport'
import { PAD, MARGE_SURE, zoneJoystick } from './action-pad-layout'
import { villeLaPlusProche } from '../data/worldmap'
import { HUD_LEFT, centerOf } from './hud-layout'
import { currentChainQuest, refreshQuestProgress } from '../core/quests'

// ⚠️ TOUT LE HUD PASSE PAR CES DEUX HELPERS, PAS PAR fromLeft/fromRight DIRECTEMENT.
// Retour du user sur iPhone 12 : « là avec la caméra de l'iPhone 12 je vois pas tout ». Les coins arrondis
// et l'îlot de caméra mordent sur les premiers pixels en paysage, et le HUD était collé à 8 px du bord.
// La marge est appliquée ICI, une fois, plutôt qu'ajoutée à chaque coordonnée — un oubli sur une seule
// aurait fait ressortir un élément sous l'encoche sans que rien ne le signale.
const L = (x: number) => fromLeft(MARGE_SURE + x)
const R = (x: number) => fromRight(MARGE_SURE + x)

const BAR_W = 200
const SLOT_SIZE = 58 // « tu peux aussi grossir un peu les skills »
// ⚠️ RANGÉE ABAISSÉE À 82, ET LES NUMÉROS PASSENT DESSOUS. Mesuré sur capture d'écran en 874×402 : à 62,
// les icônes muet et pause (y 6→27) recouvraient les numéros 1-4 posés au-dessus des cases (y 19→31), et le
// titre « POUVOIRS » mordait sur le « 3 ». Trois chevauchements invisibles au raisonnement, évidents à la
// mesure. En descendant la rangée et en mettant les numéros SOUS les cases, chaque bande a sa hauteur.
const SLOT_Y = 82
const SLOT_GAP = 68 // espacement : suit la taille des cases pour qu'elles se touchent sans se recouvrir
// Barre de skills DÉCALÉE VERS LA GAUCHE : les slots empiétaient sur le bouton PAUSE (⏸ à ~908).
// Le 4e slot (i=3) se termine désormais à ~841px, bien à gauche de PAUSE.

export class UIScene extends Phaser.Scene {
  joystick?: VirtualJoystick
  private hpBar!: Phaser.GameObjects.Rectangle
  private energyBar!: Phaser.GameObjects.Rectangle
  private xpBar!: Phaser.GameObjects.Rectangle
  private goldText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private potionText!: Phaser.GameObjects.Text
  private slotCooldownOverlays: Phaser.GameObjects.Rectangle[] = []
  private slotIcons: Phaser.GameObjects.Image[] = []
  private cooldownUntil: number[] = [0, 0, 0, 0]
  private cooldownDur: number[] = [0, 0, 0, 0] // durée totale du dernier cooldown par slot (pour le dégrisé)
  // indicateur de buff ATK (Cri de guerre)
  private buffParts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = []
  private buffBar!: Phaser.GameObjects.Rectangle
  private buffUntil = 0
  private perfText!: Phaser.GameObjects.Text
  private perfFrames = 0
  private perfDepuis = 0
  private buffDuration = 0
  // badge « points à dépenser » : pastille dorée pulsante collée au panneau de vie
  private spBadge!: Phaser.GameObjects.Container
  private spBadgeText!: Phaser.GameObjects.Text
  private skillsBtn!: Phaser.GameObjects.Rectangle
  private skillsBtnText!: Phaser.GameObjects.Text
  private skillsBtnBlink?: Phaser.Tweens.Tween

  // clé de la scène de jeu qui a lancé ce HUD ('Level' par défaut, 'Training' en entraînement) :
  // on branche barres/énergie et pauses dessus. `training` masque les overlays inadaptés (pause,
  // gestion des compétences, inventaire) dont le retour est câblé en dur sur 'Level'.
  private levelKey = 'Level'
  private training = false
  // bandeau de quête en cours (haut, centré) + mémoire des quêtes déjà FÊTÉES, pour ne notifier
  // l'accomplissement qu'une fois (le rafraîchissement du HUD passe des dizaines de fois)
  private questBg?: Phaser.GameObjects.Rectangle
  private questTxt?: Phaser.GameObjects.Text
  private questFetee = new Set<string>()

  constructor() { super('UI') }

  init(data?: { levelKey?: string; training?: boolean }) {
    this.levelKey = data?.levelKey ?? 'Level'
    this.training = !!data?.training
  }

  create() {
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    // Scène réutilisée à chaque niveau (launch depuis LevelScene) : ces tableaux sont des
    // class fields initialisés une seule fois à l'instanciation, pas à chaque create().
    // Sans reset, refresh()/update() continuent de cibler les objets détruits du niveau précédent.
    this.slotIcons = []
    this.slotCooldownOverlays = []
    this.cooldownUntil = [0, 0, 0, 0]
    this.cooldownDur = [0, 0, 0, 0]
    this.buffParts = []
    this.buffUntil = 0
    this.buffDuration = 0
    this.perfFrames = 0
    this.perfDepuis = 0

    this.input.addPointer(3)
    // ZONE DU JOYSTICK = TOUT LE QUART BAS-GAUCHE (« la zone à gauche où on contrôle les mouvements du
    // panda doit être plus grande, tout le quart en bas à gauche ça me choque pas du tout »). C'est la
    // POTION, déplacée en bas à droite, qui libère la place : elle occupait ce coin.
    const zj = zoneJoystick(VIEW_W)
    this.joystick = new VirtualJoystick(this, new Phaser.Geom.Rectangle(zj.x, zj.y, zj.w, zj.h))

    // Haut-gauche : panneau semi-opaque (lisibilité sur n'importe quel biome) regroupant
    // niveau + or, puis barres vie (rouge) / énergie (bleue) / XP (jaune) empilées et distinctes.
    // ⚠️ TOUTES LES ABSCISSES DE CE HUD PASSENT PAR fromLeft/fromRight, ET C'EST INDISPENSABLE.
    // Cette scène est recentrée (centerCamera) : l'espace de conception 0→960 est centré sur un écran
    // plus large, donc la coordonnée 8 n'est PAS à 8 px du bord de l'écran mais à 8 + BLEED_X (~111 px
    // sur un iPhone en paysage). Le panneau de vie flottait ainsi au « milieu gauche » — exactement le
    // retour du user. Un HUD se colle à l'ÉCRAN ; seuls les panneaux centrés restent en 480.
    // ─── TÉMOIN DE PERFORMANCE ────────────────────────────────────────────────────────────────
    //
    // Retour du user : « j'ai joué à Gorge et Ravin, ça va très très très lentement. »
    //
    // ⚠️ CE TÉMOIN EXISTE PARCE QUE JE NE REPRODUIS PAS LE PROBLÈME. Mesuré sur les 58 terrains en
    // navigateur : temps de frame uniforme (~28 ms partout, Gorge et Ravin compris), et sur 14 terrains
    // enchaînés, tas, textures, listeners et objets restent PLATS — l'ancienne fuite ne revient pas.
    // Le ralentissement est donc propre à l'appareil (throttling thermique, mode économie d'énergie,
    // Safari en arrière-plan…) ou à un contenu que mes sondes ne créent pas. Deviner un correctif ici
    // reviendrait à toucher au hasard : une capture d'écran prise PENDANT le ralentissement tranche.
    //
    // Discret (gris, 10 px, coin haut-gauche sous le panneau) et quasi gratuit : un compteur incrémenté
    // par frame, rafraîchi une fois par seconde. Il affiche les images/s et ce qui pourrait expliquer
    // une chute — nombre d'objets affichés et de corps physiques dans le terrain.
    // ⚠️ EN BAS À GAUCHE, pas sous le panneau de vie : à 82 px il passait derrière le bouton
    // « Compétences » (constaté sur capture). Le coin bas-gauche est occupé par le joystick, mais celui-ci
    // est invisible tant qu'on n'y pose pas le pouce — la ligne reste lisible sur une capture.
    this.perfText = this.add.text(L(10), VIEW_H - 13, '', { fontSize: '10px', color: '#8fa3b0' })
      .setOrigin(0, 0).setDepth(60)

    this.add.rectangle(L(8), 2, BAR_W + 16, 78, 0x0d1b2a, 0.6).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.25)
    this.levelText = this.add.text(L(16), 6, '', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
    this.goldText = this.add.text(L(132), 7, '', { fontSize: '13px', color: '#ffd700' })

    this.add.rectangle(L(14), 26, BAR_W + 4, 14, 0x000000, 0.6).setOrigin(0)
    this.hpBar = this.add.rectangle(L(16), 27, BAR_W, 12, 0xe53935).setOrigin(0)
    this.add.rectangle(L(14), 44, BAR_W + 4, 12, 0x000000, 0.6).setOrigin(0)
    this.energyBar = this.add.rectangle(L(16), 46, BAR_W, 8, 0x29b6f6).setOrigin(0)
    this.add.rectangle(L(14), 60, BAR_W + 4, 6, 0x000000, 0.6).setOrigin(0)
    this.xpBar = this.add.rectangle(L(16), 61, BAR_W, 4, 0xfdd835).setOrigin(0)

    // toucher le panneau (barres) ouvre la gestion des skills en jeu — dispo AUSSI en entraînement
    // (on veut y tester/échanger ses skills) : SkillEquip reçoit désormais la clé de scène à reprendre
    // (Level ou Training) et n'écrit pas la sauvegarde en mode training → plus de soft-lock.
    this.add.rectangle(L(8), 2, BAR_W + 16, 78, 0xffffff, 0.001).setOrigin(0).setInteractive()
      .on('pointerdown', () => this.openSkillMenu())
    this.add.text(L(16), 68, 'compétences ▸', { fontSize: '10px', color: '#b0bec5' })

    // Badge « points à dépenser » : JUSTE à droite du panneau de vie, pastille dorée pulsante
    // avec une flèche qui pointe vers le panneau (où l'on ouvre le menu). Masqué s'il n'y a
    // aucun point. Cliquer dessus ouvre le même menu des compétences que la barre de vie.
    // badge « point(s) de compétence dispo » : placé SOUS les slots de skills / le bouton Compétences
    // (haut-droite), et non plus près de la barre de vie — c'est là qu'on gère les compétences.
    // rangée réservée (HUD_LEFT) : le badge chevauchait la pastille de buff et le bouton
    this.spBadge = this.add.container(L(HUD_LEFT.spBadge.x), centerOf(HUD_LEFT.spBadge).y).setDepth(60)
    const badgeBg = this.add.rectangle(76, 0, 152, 32, 0xffca28, 0.97).setStrokeStyle(2, 0x7a4f00, 1)
    const badgeArrow = this.add.text(-4, 0, '◀', { fontSize: '20px', color: '#ffca28', fontStyle: 'bold', stroke: '#3a2600', strokeThickness: 4 }).setOrigin(1, 0.5)
    this.spBadgeText = this.add.text(14, 0, '', { fontSize: '15px', color: '#3a2600', fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.spBadge.add([badgeBg, badgeArrow, this.spBadgeText])
    badgeBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.spBadge.visible) this.openSkillMenu() })
    this.spBadge.setVisible(false)
    // pulsation permanente (clignotement + gonflement) : impossible à rater sur tous les biomes
    this.tweens.add({ targets: this.spBadge, scale: 1.14, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.tweens.add({ targets: badgeBg, fillAlpha: 0.55, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    // pastille de buff ATK : masquée par défaut, affichée avec un compte à rebours tant que le buff est actif
    // Position issue de HUD_LEFT (scenes/hud-layout.ts) : elle recouvrait le bouton « Compétences ».
    const { y: by, w: bw, h: bh } = HUD_LEFT.buffPill
    const bx = L(HUD_LEFT.buffPill.x)
    const buffBg = this.add.rectangle(bx, by, bw, bh, 0xff8f00, 0.9).setOrigin(0).setStrokeStyle(2, 0xffe082, 0.8)
    const buffLabel = this.add.text(bx + 8, by + 4, '⚔ ATK+', { fontSize: '13px', color: '#3a2600', fontStyle: 'bold' }).setOrigin(0)
    this.buffBar = this.add.rectangle(bx + 2, by + bh - 5, bw - 4, 4, 0xfff176).setOrigin(0)
    this.buffParts = [buffBg, buffLabel, this.buffBar]
    for (const o of this.buffParts) o.setVisible(false)

    // bouton muet discret (coin haut-droit), au-dessus des slots de compétences
    const muteBtn = this.add.text(R(16), 6, audio.isMuted() ? '🔇' : '🔊', { fontSize: '20px' })
      .setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true })
    muteBtn.on('pointerdown', () => {
      const muted = audio.toggleMute()
      muteBtn.setText(muted ? '🔇' : '🔊')
    })

    // bouton pause discret, juste à gauche du mute : ouvre le menu de pause par-dessus le jeu gelé
    // (masqué en entraînement : PauseScene resume/quit sur 'Level' en dur, inadapté à 'Training')
    if (!this.training) {
      const pauseBtn = this.add.text(R(52), 6, '⏸', { fontSize: '20px' })
        .setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true })
      pauseBtn.on('pointerdown', () => {
        audio.playSfx('ui-tap')
        this.freezeLevelForOverlay()
        this.scene.launch('Pause')
        this.scene.pause(this.levelKey)
        this.scene.pause('UI')
      })
    }

    // Haut-droite : les 4 cases de pouvoirs côte à côte, ancrées à DROITE sous le bouton pause.
    // Titre « POUVOIRS » centré au-dessus des 4 cases.
    // les 4 cases sont repérées depuis le BORD DROIT (comme le bouton pause juste au-dessus d'elles),
    // sinon la rangée dérive vers le centre sur un écran large et se décolle du bouton
    // ancrée à droite : la dernière case s'aligne sous le bouton pause, les autres se déduisent
    const slotX0 = R(38 + 3 * SLOT_GAP)
    this.add.text(slotX0 + 1.5 * SLOT_GAP, SLOT_Y - SLOT_SIZE / 2 - 18, 'POUVOIRS', {
      fontSize: '13px', color: '#ffd54f', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = slotX0 + i * SLOT_GAP
      // Zone tactile ÉLARGIE au-delà du visuel (60×66 vs 50×50) pour toucher plus facilement au
      // doigt ; 60px = l'espacement des slots → les zones se touchent sans se chevaucher.
      const slot = this.add.rectangle(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff, 0.6)
        .setInteractive(new Phaser.Geom.Rectangle(-5, -5, SLOT_GAP, SLOT_SIZE + 26), Phaser.Geom.Rectangle.Contains)
      // ⚠️ LE RELÂCHEMENT EST ANNONCÉ EXPLICITEMENT, ET C'EST INDISPENSABLE AUX SORTS MAINTENUS.
      // LevelScene DEVINAIT la source du maintien : touche de slot enfoncée, sinon pointeur actif de SA
      // scène. Depuis un bouton du HUD, aucune des deux ne convient — le pointeur appartient à l'interface,
      // pas au terrain — donc le maintien se croyait déjà relâché et se coupait après le premier tick.
      // C'est ça, « la mitraillette ne marche pas en continu », même en entraînement avec du mana à volonté.
      // Un bouton sait quand on le lâche : il le dit, au lieu de laisser l'autre scène le deviner.
      slot.on('pointerdown', () => { this.pressFx(slot); this.game.events.emit('input-skill', i) })
      slot.on('pointerup', () => this.game.events.emit('input-skill-up', i))
      slot.on('pointerout', () => this.game.events.emit('input-skill-up', i))
      this.add.text(x, SLOT_Y + SLOT_SIZE / 2 + 9, `${i + 1}`, { fontSize: '12px', color: '#ffd54f' }).setOrigin(0.5)
      this.slotIcons.push(this.add.image(x, SLOT_Y, '__DEFAULT').setDisplaySize(SLOT_SIZE - 8, SLOT_SIZE - 8).setVisible(false))
      // overlay de cooldown ANCRÉ À DROITE (origine 1) : on le rétrécit vers la droite (scaleX) au fil
      // de la recharge → il « se dégrise » horizontalement de gauche à droite jusqu'à disparaître.
      const ov = this.add.rectangle(x + SLOT_SIZE / 2, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 0x0d1b2a, 0.72)
        .setOrigin(1, 0.5).setVisible(false)
      this.slotCooldownOverlays.push(ov)
    }

    // bouton EXPLICITE « compétences » sous les slots (le clic sur la barre de vie l'ouvre aussi,
    // mais un bouton dédié est bien plus découvrable) — disponible en jeu ET en entraînement.
    const sb0 = centerOf(HUD_LEFT.skillsBtn)
    const sb = { x: L(sb0.x), y: sb0.y }
    const skillsBtn = this.add.rectangle(sb.x, sb.y, HUD_LEFT.skillsBtn.w, HUD_LEFT.skillsBtn.h, 0x37474f, 0.9)
      .setStrokeStyle(1, 0xffffff, 0.55)
      .setInteractive(new Phaser.Geom.Rectangle(-11, -13, 160, 50), Phaser.Geom.Rectangle.Contains)
    this.skillsBtn = skillsBtn
    this.skillsBtnText = this.add.text(sb.x, sb.y, '⚙ Compétences', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    skillsBtn.on('pointerdown', () => { this.pressFx(skillsBtn); this.openSkillMenu() })

    // ─── BAS-DROITE : LE « V » PIVOTÉ À 90° À GAUCHE, soit un « < » ───────────────────────────────
    // Demande du user : « en bas à droite je veux pouvoir attaquer, sauter et prendre une potion. Tu mets
    // ça comme un V qui a pivoté à 90 degrés à gauche. Donc d'abord tu as l'attaque à gauche, au-dessus et
    // à droite tu mets le saut, et en dessous tu mets la potion. »
    //
    //                        ○ SAUT
    //                       ╱
    //           ATTAQUE ◉ ─┤
    //                       ╲
    //                        ○ POTION
    //
    // Géométrie et tailles dans scenes/action-pad-layout.ts, dont le test vérifie que la forme reste un
    // « < », que les trois zones tactiles ne se recouvrent JAMAIS (un tap qui déclenche la mauvaise action
    // est le pire défaut possible sur un bouton de saut) et que rien ne sort du cadre.
    //
    // ⚠️ L'ORDRE DE CRÉATION COMPTE POUR LES TAPS. Phaser donne la priorité au dernier objet interactif
    // ajouté quand deux zones se superposent. Ici elles ne se superposent pas (vérifié par le test), mais
    // on garde l'ordre attaque → saut → potion pour que ça reste vrai si les rayons grossissent un jour.
    // ⚠️ fromRight ET PAS R() : les commandes de droite sont COLLÉES au bord, sans marge de sûreté
    // (« le triangle à droite il faut le coller à droite, pas de marge »). La marge ne sert qu'à esquiver
    // la caméra de l'iPhone, qui est du côté GAUCHE en paysage.
    const X = (d: number) => fromRight(d)
    const mkRond = (b: typeof PAD.attaque, couleur: number, alpha: number) =>
      this.add.circle(X(b.droite), b.y, b.r, couleur, alpha)
        .setInteractive(new Phaser.Geom.Circle(b.r, b.r, b.rTap), Phaser.Geom.Circle.Contains)

    const atk = mkRond(PAD.attaque, 0xfb8c00, 0.72)
    this.add.image(X(PAD.attaque.droite), PAD.attaque.y, 'ui-attack').setDisplaySize(PAD.attaque.r * 1.05, PAD.attaque.r * 1.05)
    this.add.text(X(PAD.attaque.droite), PAD.attaque.labelY, 'ATTAQUE', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    atk.on('pointerdown', () => { this.pressFx(atk); this.game.events.emit('input-attack') })

    const jump = mkRond(PAD.saut, 0x1e88e5, 0.62)
    this.add.image(X(PAD.saut.droite), PAD.saut.y, 'ui-jump').setDisplaySize(PAD.saut.r * 1.05, PAD.saut.r * 1.05)
    this.add.text(X(PAD.saut.droite), PAD.saut.labelY, 'SAUT', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    jump.on('pointerdown', () => { this.pressFx(jump); this.game.events.emit('input-jump-down') })
    jump.on('pointerup', () => this.game.events.emit('input-jump-up'))
    jump.on('pointerout', () => this.game.events.emit('input-jump-up'))

    // POTION : déplacée du bas-GAUCHE au bas-droite, ce qui libère tout le quart bas-gauche pour le
    // joystick. Le compteur « ×N » est collé au bouton, sinon on ne sait pas s'il en reste.
    const potion = mkRond(PAD.potion, 0x8e2f4f, 0.62)
    this.add.image(X(PAD.potion.droite), PAD.potion.y, 'potion-drop').setDisplaySize(PAD.potion.r * 1.4, PAD.potion.r * 1.4)
    // ⚠️ LE COMPTEUR EST SUR LA FIOLE, PLUS À CÔTÉ. Il était posé à DROITE du bouton, donc dans les
    // derniers pixels de l'écran : « là ça déborde à droite de l'écran et c'est crade ». Et pour cause —
    // les commandes de droite sont COLLÉES au bord (règle assumée, cf. action-pad-layout), donc tout ce
    // qu'on ajoute à leur droite sort du cadre. Sur la fiole, le nombre est lisible, ne dépend plus de la
    // largeur de l'écran, et suit le bouton où qu'il aille.
    this.potionText = this.add.text(X(PAD.potion.droite), PAD.potion.y + PAD.potion.r - 6, '', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5)
    potion.on('pointerdown', () => { this.pressFx(potion); this.game.events.emit('input-potion') })

    // bouton inventaire (icône « tenue ») : EN HAUT À GAUCHE, juste à droite du panneau de vie
    // (masqué en entraînement : InventoryScene resume 'Level' en dur → soft-lock depuis 'Training')
    if (!this.training) {
      const invBtn = this.add.image(L(248), 40, 'ui-inventory').setDisplaySize(42, 42).setDepth(50).setInteractive({ useHandCursor: true })
      invBtn.on('pointerdown', () => { this.pressFx(invBtn); this.openInventoryMenu() })
      this.add.text(L(248), 64, 'SAC', { fontSize: '10px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(50)
    }

    // BANDEAU DE QUÊTE EN COURS (haut, centré) — masqué en entraînement, où il n'y a pas de quête.
    if (!this.training) this.buildQuestTracker()

    // Écoute des mises à jour émises par la scène de jeu (Level ou Training)
    const level = this.scene.get(this.levelKey)
    level.events.on('player-hp', this.onPlayerHp)
    level.events.on('player-buff', this.onBuff)
    level.events.on('player-buff-end', this.onBuffEnd)
    this.game.events.on('hud-refresh', this.refresh, this)
    this.game.events.on('skill-cooldown', this.onCooldown, this)
    this.game.events.on('player-level-up', this.onLevelUp, this)
    this.events.once('shutdown', () => {
      level.events.off('player-hp', this.onPlayerHp)
      level.events.off('player-buff', this.onBuff)
      level.events.off('player-buff-end', this.onBuffEnd)
      this.game.events.off('hud-refresh', this.refresh, this)
      this.game.events.off('skill-cooldown', this.onCooldown, this)
      this.game.events.off('player-level-up', this.onLevelUp, this)
    })
    this.refresh()
  }

  // Avant d'ouvrir un overlay (Pause / compétences) on remet le monde physique du niveau à
  // l'état actif : si un hit-stop venait juste de le mettre en pause, l'horloge de Level
  // (gelée par la pause de scène) ne pourrait plus déclencher sa reprise et la physique
  // resterait figée tant que le menu est ouvert. Le niveau reste bien figé par la pause de
  // scène ; on évite seulement de laisser le flag physique bloqué.
  private freezeLevelForOverlay() {
    const level = this.scene.get(this.levelKey) as LevelScene | undefined
    level?.physics?.world?.resume()
  }

  // ouvre la gestion des compétences en jeu (partagé : clic sur le panneau de vie ET sur le badge)
  private openSkillMenu() {
    audio.playSfx('ui-tap')
    this.freezeLevelForOverlay()
    this.scene.launch('SkillEquip', { levelKey: this.levelKey, training: this.training })
    // SkillEquip est déclarée AVANT TrainingScene dans main.ts : sans ceci, ouverte depuis
    // l'entraînement elle se rend DERRIÈRE l'arène (invisible) alors que le jeu est en pause →
    // soft-lock instantané (bouton « Reprendre » inatteignable). On la force au premier plan.
    this.scene.bringToTop('SkillEquip')
    this.scene.pause(this.levelKey)
    this.scene.pause('UI')
  }

  // ouvre l'écran d'inventaire dédié en jeu (overlay par-dessus le niveau en pause)
  private openInventoryMenu() {
    audio.playSfx('ui-tap')
    this.freezeLevelForOverlay()
    this.scene.launch('Inventory', { return: 'game', overlay: true })
    this.scene.pause(this.levelKey)
    this.scene.pause('UI')
  }

  // affiche/masque le badge selon les points de COMPÉTENCE non dépensés (le badge ouvre le menu
  // des compétences ; les points de STAT se gèrent depuis la carte, menu à part → pas comptés ici
  // pour ne pas afficher un total qui ne correspond pas à ce qu'on peut dépenser dans ce menu)
  private updateSkillPointBadge() {
    const p = getPlayer()
    const n = p.skillPoints
    this.spBadge.setVisible(false) // plus de pastille jaune SÉPARÉE (retour user)
    // À la place : le BOUTON « Compétences » devient JAUNE + CLIGNOTANT tant qu'il reste des points.
    if (n > 0) {
      this.skillsBtn.setFillStyle(0xffca28, 0.97).setStrokeStyle(2, 0x7a4f00, 1)
      this.skillsBtnText.setColor('#3a2600').setText(`⚙ Compétences (${n})`)
      if (!this.skillsBtnBlink) {
        this.skillsBtnBlink = this.tweens.add({ targets: [this.skillsBtn, this.skillsBtnText], alpha: 0.45, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
    } else {
      this.skillsBtnBlink?.stop(); this.skillsBtnBlink = undefined
      this.skillsBtn.setAlpha(1).setFillStyle(0x37474f, 0.9).setStrokeStyle(1, 0xffffff, 0.55)
      this.skillsBtnText.setAlpha(1).setColor('#ffffff').setText('⚙ Compétences')
    }
  }

  // pulse visuel au tap pour que chaque bouton réponde sous le doigt
  private pressFx(target: Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Text) {
    this.tweens.add({ targets: target, scale: target.scale * 0.85, duration: 60, yoyo: true })
  }

  private onPlayerHp = (hp: number, max: number) => this.hpBar.setDisplaySize(BAR_W * (hp / max), 12)

  private onCooldown(slot: number, untilMs: number, durationMs = 0) {
    this.cooldownUntil[slot] = untilMs
    this.cooldownDur[slot] = durationMs
  }

  private onBuff = (untilMs: number, durationMs: number) => {
    this.buffUntil = untilMs
    this.buffDuration = durationMs
  }

  private onBuffEnd = () => { this.buffUntil = 0 }

  // notif de passage de niveau : grosse, sous le panneau de HUD (haut-gauche), façon RO
  private onLevelUp(level: number) {
    this.updateSkillPointBadge()
    // ONBOARDING : au TOUT PREMIER passage de niveau (Nv 2), le joueur débloque son 1er point de
    // compétence (il démarre sans aucune compétence). On ouvre un petit panneau explicatif au lieu du
    // simple bandeau — le moment idéal pour apprendre le système. Ensuite, bandeau classique.
    if (level === 2 && !this.training) { this.showFirstSkillOnboarding(); return }
    const bg = this.add.rectangle(L(14), 118, 372, 28, 0xffb300, 0.95).setOrigin(0)
    const txt = this.add.text(L(24), 122, `⭐ NIVEAU ${level} !  +1 compétence · +2 stats`, {
      fontSize: '15px', color: '#3a2600', fontStyle: 'bold',
    }).setOrigin(0, 0)
    bg.setScale(0.2, 1)
    this.tweens.add({ targets: bg, scaleX: 1, duration: 200, ease: 'Back.out' })
    this.tweens.add({ targets: [bg, txt], alpha: 0, delay: 2200, duration: 700, onComplete: () => { bg.destroy(); txt.destroy() } })
  }

  // Panneau d'onboarding « ta première compétence » (Nv 2). Gèle le niveau le temps de la lecture ;
  // deux issues : ouvrir le menu Compétences, ou reprendre. Dessiné DANS l'UI (donc on ne met en
  // pause QUE la scène de niveau — sinon les boutons du panneau ne répondraient plus).
  private showFirstSkillOnboarding() {
    audio.playSfx('level-up')
    this.freezeLevelForOverlay()
    this.scene.pause(this.levelKey)
    const panel = this.add.container(0, 0).setDepth(2000)
    const backdrop = this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x000000, 0.78).setInteractive()
    const card = this.add.rectangle(480, 262, 640, 320, 0x102a3a, 0.99).setStrokeStyle(3, 0x4fc3f7, 0.95)
    const title = this.add.text(480, 138, '⭐ Niveau 2 — ta première compétence !', {
      fontSize: '24px', color: '#ffd54f', fontStyle: 'bold',
    }).setOrigin(0.5)
    const body = this.add.text(480, 258,
      'À chaque niveau tu gagnes un POINT DE COMPÉTENCE.\n\n' +
      'Tu viens d\'en gagner ton premier ! Ouvre ⚙ Compétences pour\n' +
      'APPRENDRE une compétence, puis ÉQUIPE-la dans un slot 1-4.\n\n' +
      'En jeu : touche le slot (ou tape 1-4 au clavier) pour la lancer.', {
      fontSize: '16px', color: '#e8f4fb', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5)
    const close = () => { panel.destroy(); if (this.scene.isPaused(this.levelKey)) this.scene.resume(this.levelKey) }
    const mkBtn = (x: number, w: number, fill: number, label: string, txtColor: string, onTap: () => void) => {
      const b = this.add.rectangle(x, 388, w, 48, fill, 0.98).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({ useHandCursor: true })
      const t = this.add.text(x, 388, label, { fontSize: '17px', color: txtColor, fontStyle: 'bold' }).setOrigin(0.5)
      b.on('pointerdown', () => { audio.playSfx('ui-tap'); this.pressFx(b); onTap() })
      panel.add([b, t])
    }
    panel.add([backdrop, card, title, body])
    mkBtn(378, 264, 0xffca28, '⚙ Voir mes compétences', '#3a2600', () => { panel.destroy(); this.openSkillMenu() })
    mkBtn(636, 176, 0x37474f, 'Plus tard', '#ffffff', close)
    card.setScale(0.7); title.setAlpha(0); body.setAlpha(0)
    this.tweens.add({ targets: card, scale: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({ targets: [title, body], alpha: 1, duration: 260, delay: 120 })
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // BANDEAU DE QUÊTE EN COURS
  //
  // Retour joueur : « pense aussi à un visuel en jeu pour voir les quêtes en cours (ptet en haut de la
  // fenêtre) avec une notif quand c'est accompli. là le jeu incite pas trop à les faire. »
  //
  // Le diagnostic était juste : une quête acceptée n'existait NULLE PART pendant le jeu. Il fallait
  // retourner en ville, parler au garde et lire un panneau pour savoir où l'on en était — donc on
  // l'oubliait. On affiche donc l'objectif et le compteur en permanence, et on FÊTE l'accomplissement au
  // moment où il arrive, là où le joueur est : dans le niveau.
  //
  // La zone est déclarée dans `hud-layout.ts` (questTracker) pour que le test de non-recouvrement la
  // couvre : c'est le seul créneau libre de la rangée haute, entre la vie à gauche et le son/pause à droite.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  private buildQuestTracker() {
    const r = HUD_LEFT.questTracker
    const cx = 480 // centre de l'écran dans cet espace (cf. viewport : [480 - VIEW_W/2, 480 + VIEW_W/2])
    this.questBg = this.add.rectangle(cx, r.y + r.h / 2, r.w, r.h, 0x1b1b2a, 0.72)
      .setOrigin(0.5).setDepth(48).setStrokeStyle(2, 0xffb300, 0.9).setVisible(false)
    this.questTxt = this.add.text(cx, r.y + r.h / 2, '', {
      fontSize: '13px', color: '#ffe082', fontStyle: 'bold', align: 'center',
      wordWrap: { width: r.w - 16 },
    }).setOrigin(0.5).setDepth(49).setVisible(false)
    this.refreshQuestTracker()
  }

  private refreshQuestTracker() {
    if (!this.questBg || !this.questTxt) return
    const p = getPlayer()
    // La quête AFFICHÉE est celle de la chaîne en cours, et seulement si elle est ACCEPTÉE : proposer ici
    // une quête qu'on n'a pas prise ferait doublon avec le « ❗ » du garde, en ville.
    const def = currentChainQuest(p)
    const q = def ? p.quests[def.id] : undefined
    if (!def || !q || q.claimed) {
      this.questBg.setVisible(false)
      this.questTxt.setVisible(false)
      return
    }
    // On RECALCULE la progression ici : les compteurs de kills montent pendant le niveau, et personne
    // d'autre ne rafraîchit la quête avant le retour en ville — c'est ce décalage qui donnait
    // l'impression que les quêtes n'avançaient pas.
    const etaitFini = q.done
    refreshQuestProgress(p, def.id)
    this.questBg.setVisible(true)
    this.questTxt.setVisible(true)
    if (q.done) {
      // ⚠️ ON NOMME LA VILLE, PAS SEULEMENT LE PNJ. « Récompense prête chez le garde » était exact et
      // inutilisable : le garde tient une échoppe dans chaque ville, et rien ne disait laquelle. Retour
      // du joueur : « il faut afficher la ville où je dois aller chercher la récompense ».
      const ville = villeLaPlusProche(p.currentNode)
      this.questTxt.setText(ville
        ? `✅ ${def.name} — récompense chez le garde, à ${ville.name}`
        : `✅ ${def.name} — récompense prête chez le garde`)
      this.questBg.setStrokeStyle(2, 0x66bb6a, 0.95)
      // NOTIF À L'INSTANT OÙ ÇA BASCULE, une seule fois : le joueur doit apprendre la nouvelle sur le
      // terrain, pas la découvrir en ville trois minutes plus tard.
      if (!etaitFini && !this.questFetee.has(def.id)) {
        this.questFetee.add(def.id)
        this.notifierQueteFinie(def.name)
      }
    } else {
      this.questTxt.setText(`📜 ${def.name}   ${q.progress}/${def.targetCount}`)
      this.questBg.setStrokeStyle(2, 0xffb300, 0.9)
    }
  }

  /** Bandeau de félicitations, calqué sur celui du passage de niveau (même grammaire visuelle). */
  private notifierQueteFinie(nom: string) {
    audio.playSfx('level-up')
    const bg = this.add.rectangle(480, 62, 420, 30, 0x66bb6a, 0.96).setOrigin(0.5).setDepth(1500)
    const txt = this.add.text(480, 62, `✅ QUÊTE ACCOMPLIE — ${nom}`, {
      fontSize: '15px', color: '#0b2a12', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1501)
    bg.setScale(0.2, 1)
    this.tweens.add({ targets: bg, scaleX: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({
      targets: [bg, txt], alpha: 0, delay: 2400, duration: 800,
      onComplete: () => { bg.destroy(); txt.destroy() },
    })
  }

  refresh() {
    const p = getPlayer()
    this.refreshQuestTracker()
    this.levelText.setText(`Nv ${p.level}`)
    this.goldText.setText(`${p.gold} or`)
    this.potionText.setText(`×${p.potions}`)
    this.xpBar.setDisplaySize(BAR_W * (p.xp / xpToNext(p.level)), 4)
    for (let i = 0; i < 4; i++) {
      const sid = p.equippedSkills[i]
      const icon = this.slotIcons[i]!
      if (sid) icon.setTexture(`skill-${sid}`).setDisplaySize(SLOT_SIZE - 8, SLOT_SIZE - 8).setVisible(true)
      else icon.setVisible(false)
    }
    this.updateSkillPointBadge()
  }

  update(time: number) {
    // témoin de perf : une addition par frame, un formatage par seconde
    this.perfFrames++
    if (time - this.perfDepuis >= 1000) {
      const ips = Math.round((this.perfFrames * 1000) / (time - this.perfDepuis))
      // ⚠️ ON PREND LA SCÈNE DE JEU ACTIVE, PAS 'Level' EN DUR — ET ON VÉRIFIE QUE SON MONDE EXISTE.
      // `scene.get('Level')` renvoie TOUJOURS l'instance, même quand elle n'a jamais démarré : son
      // `physics.world` vaut alors null. C'est ce qui plantait l'écran d'ENTRAÎNEMENT, qui tourne dans
      // sa propre scène ('Training') et laisse 'Level' à l'arrêt — « Cannot read properties of null
      // (reading 'bodies') », à chaque frame, écran noir. Le témoin de performance n'a aucune raison de
      // pouvoir tuer une scène : il lit ce qui existe, ou il n'affiche rien.
      const jeu = this.scene.manager.getScenes(true)
        .find((sc) => sc.scene.key === 'Level' || sc.scene.key === 'Training') as LevelScene | undefined
      const monde = jeu?.physics?.world ?? null
      const objets = jeu?.children?.list.length ?? 0
      const corps = monde ? monde.bodies.size + monde.staticBodies.size : 0
      this.perfText.setText(`${ips} ips · ${objets} obj · ${corps} corps`)
      this.perfText.setColor(ips >= 45 ? '#8fa3b0' : ips >= 25 ? '#ffb74d' : '#ef5350')
      this.perfFrames = 0
      this.perfDepuis = time
    }

    // l'énergie change en continu (régén) : on la lit directement sur le Player plutôt
    // que via un événement par frame
    const pl = (this.scene.get(this.levelKey) as LevelScene | undefined)?.player
    if (pl && this.energyBar) this.energyBar.setDisplaySize(BAR_W * (pl.energy / pl.maxEnergy), 8)
    for (let i = 0; i < 4; i++) {
      const ov = this.slotCooldownOverlays[i]!
      const until = this.cooldownUntil[i] ?? 0
      const dur = this.cooldownDur[i] ?? 0
      if (time < until && dur > 0) {
        // fraction RESTANTE (1 → 0) : l'overlay grisé couvre la part droite et se rétracte vers la
        // droite (dégrisé gauche→droite) jusqu'à retrouver la couleur du slot à la fin.
        const remain = Phaser.Math.Clamp((until - time) / dur, 0, 1)
        ov.setVisible(true).setScale(remain, 1)
      } else {
        ov.setVisible(false)
      }
    }
    // pastille de buff : visible + barre de compte à rebours tant que le buff court
    const buffActive = time < this.buffUntil
    for (const o of this.buffParts) o.setVisible(buffActive)
    if (buffActive && this.buffDuration > 0) {
      const remain = Phaser.Math.Clamp((this.buffUntil - time) / this.buffDuration, 0, 1)
      this.buffBar.setDisplaySize(100 * remain, 4)
    }
  }
}
