import Phaser from 'phaser'
import { LevelScene, TILE } from './LevelScene'
import type { LevelDef } from '../data/levels'
import { CLASSES } from '../data/classes'
import { SKILLS, maxRankOf } from '../data/skills'
import { MONSTERS } from '../data/monsters'
import { Enemy } from '../entities/Enemy'
import { newPlayer, type PlayerState } from '../core/player-state'
import { getPlayer, setPlayer } from '../state'
import type { ClassId } from '../core/types'
import { audio } from '../audio/audio-engine'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'

// PAGE D'ENTRAÎNEMENT : on incarne n'importe quelle classe (base + évolutions), MANA infini, TOUS
// les skills débloqués au rang max. Un grand arbre-boss ENRACINÉ encaisse sans mourir et frappe pour 0, des
// corbeaux volent et « attaquent » pour 0 — impossible de mourir. Réutilise toute la machinerie de
// LevelScene (sol, joueur, skills, HUD) via l'héritage + le drapeau `training`.

// classes proposées : les 3 voies de base + leurs évolutions (+ novice pour la panoplie de départ)
const TRAINING_CLASSES: ClassId[] = ['novice', 'swordsman', 'chevalier', 'mage', 'sorcier', 'archer', 'chasseur']

// arène plate d'un seul écran : biome plaine, ni trou ni eau ni pics (le joueur ne peut pas mourir).
const TRAINING_LEVEL: LevelDef = {
  id: 'training', name: 'Arène d\'entraînement', biome: 'plaine', widthTiles: 30, platforms: [], spawns: [],
}

// JOUEUR RÉEL mis de côté le temps de l'entraînement (on écrase le joueur global par un perso
// temporaire). Module-level pour survivre aux scene.restart() (changement de classe d'entraînement) ;
// restauré au retour menu. `saved` évite de re-capturer le temporaire à chaque changement de classe.
let realPlayer: PlayerState | null = null
let realPlayerSaved = false

export class TrainingScene extends LevelScene {
  private classId: ClassId | null = null
  private phase: 'picker' | 'arena' = 'picker'

  constructor() { super('Training') }

  // signature élargie (surensemble de celle de LevelScene) pour rester un override valide ; seul
  // `classId` est utilisé côté entraînement.
  init(data: { classId?: ClassId; levelId?: string; fromNode?: string; targetNode?: string; dir?: 'forward' | 'backward' } = {}) {
    this.training = true
    this.levelDef = TRAINING_LEVEL
    this.classId = data.classId ?? null
    this.phase = this.classId ? 'arena' : 'picker'
    // capture du joueur réel une seule fois par session d'entraînement (peut être absent si l'on
    // arrive depuis l'écran-titre, avant tout chargement de partie → getPlayer() lèverait)
    if (!realPlayerSaved) {
      try { realPlayer = getPlayer() } catch { realPlayer = null }
      realPlayerSaved = true
    }
    // phase arène : on devient un perso de la classe choisie AVANT que super.create() n'instancie
    // le Player (son constructeur lit getPlayer()).
    if (this.classId) setPlayer(this.buildTrainee(this.classId))
  }

  create() {
    // ⚠️ PAS DE setScrollFactor(0) DANS CET ÉCRAN, ET C'EST VOLONTAIRE.
    // La scène appelle centerCamera() (core/viewport.ts), qui décale la caméra de −BLEED_X pour recentrer
    // l'espace de conception 0→960 sur un écran plus large. Or un objet en scrollFactor(0) ignore le
    // défilement de caméra PAR DÉFINITION : il restait donc à sa coordonnée brute, soit 105 px à gauche du
    // centre réel. Et dans un écran d'interface la caméra ne défile jamais, donc l'épinglage n'apportait
    // rien. C'est la cause unique du « c'est pas centré » constaté sur plusieurs écrans.
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    if (this.phase === 'picker') { this.buildPicker(); return }
    // arène complète (sol, joueur, groupes physiques, entrées, HUD) via la machinerie LevelScene
    super.create()
    // TrainingScene est déclarée APRÈS UIScene dans main.ts → elle se rend AU-DESSUS du HUD et son
    // fond plein écran masquait les boutons saut/attaque/slots (invisibles + non cliquables). On
    // remonte le HUD au premier plan pour l'entraînement (inutile en niveau normal : Level < UI).
    this.scene.bringToTop('UI')
    this.spawnDummies()
    this.buildArenaOverlay()
  }

  // le joueur d'entraînement : classe choisie, haut niveau (stats confortables), tous les skills de
  // la classe au rang MAX, les 4 premiers équipés (le HUD n'a que 4 slots).
  private buildTrainee(classId: ClassId): PlayerState {
    const p = newPlayer('Panda')
    p.classId = classId
    p.level = 60
    p.potions = 99
    const ids = CLASSES[classId].skillIds
    p.skillLevels = {}
    for (const id of ids) p.skillLevels[id] = maxRankOf(SKILLS[id]!)
    // On équipe les 4 premiers skills ACTIFS (castables) de la classe : les passifs (double-saut,
    // régén, vol arcanique, réflexes…) ne sont JAMAIS équipés — sur les slots ils donneraient des
    // slots morts. Filtrer garantit 4 skills utilisables quel que soit l'ordre de l'arbre.
    const active = ids.filter((id) => SKILLS[id] && SKILLS[id]!.kind !== 'passive')
    p.equippedSkills = [active[0] ?? null, active[1] ?? null, active[2] ?? null, active[3] ?? null]
    return p
  }

  // dummy + corbeaux, tous INVINCIBLES (persistants, jamais tués) et inoffensifs (hitPlayer no-op en
  // mode training). Le gros Poring (roi-gloopy, charge) télégraphie et anime ses attaques ; les
  // corbeaux (aerial) planent puis piquent sur le joueur.
  private spawnDummies() {
    const gy = this.groundTopY()
    const width = this.levelDef.widthTiles * TILE

    // ─── LE MANNEQUIN EST UN ARBRE, IMMOBILE ET IMMORTEL ──────────────────────────────────────
    //
    // Demande du user : « en entraînement, j'aimerais que le boss soit un grand monstre boss genre arbre
    // immobile et avec vie infinie ».
    //
    // ⚠️ IMMOBILE, ET PAS SEULEMENT LENT. Le Poring-roi d'avant rebondissait dans toute l'arène : on
    // passait son temps à le courser au lieu d'essayer ses sorts, ce qui est le seul but de cet écran.
    // On l'enracine donc pour de bon (`root` sur une durée absurde plutôt qu'un drapeau de plus : c'est
    // le mécanisme d'entrave que le moteur connaît déjà, avec son rendu et ses règles). Un arbre qui ne
    // bouge pas, c'est aussi une CIBLE : on peut mesurer ses dégâts, tester une portée, enchaîner un
    // combo — impossible sur une balle sauteuse.
    const bossDef = MONSTERS['seigneur-liane']! // archimage sylvestre : la silhouette d'arbre du jeu
    const dummy = new Enemy(this, width * 0.66, gy - 90, bossDef)
    dummy.invincible = true // « vie infinie » : il encaisse et affiche les dégâts sans jamais tomber
    dummy.baseScale = 2.2 // GRAND : il domine l'arène, on voit où l'on tape
    dummy.root(10 ** 9) // enraciné pour la durée de la session
    this.enemies.add(dummy)

    const crowDef = MONSTERS['corbeau']!
    for (const [cx, cy] of [[240, 150], [520, 110], [760, 170], [900, 130]] as const) {
      const crow = new Enemy(this, cx, cy, crowDef)
      crow.invincible = true
      this.enemies.add(crow)
    }
  }

  // bandeau d'entraînement + boutons « Menu » et « Changer de classe » (épinglés à l'écran, au-dessus
  // du HUD). Placés en haut-centre, à l'écart du panneau de vie (gauche) et des slots (droite).
  private buildArenaOverlay() {
    this.add.text(480, 20, `Entraînement — ${CLASSES[this.classId!].name}`, {
      fontSize: '20px', color: '#ffd54f', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30)
    this.add.text(480, 44, 'Mana infini · tous les skills au max · dummy invincible · dégâts nuls', {
      fontSize: '12px', color: '#e0f7fa', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30)

    this.overlayButton(345, 92, '◂ Menu', 0x455a64, () => this.returnToMenu())
    this.overlayButton(575, 92, 'Changer de classe ▸', 0x1565c0, () => { audio.playSfx('ui-tap'); this.scene.restart({}) })
  }

  // écran de choix de la classe à essayer (phase picker) : une grille de cartes (classes de base +
  // évolutions). Un clic relance la scène en phase arène avec la classe choisie.
  private buildPicker() {
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a)
    this.add.text(480, 40, 'Essaie les classes !', {
      fontSize: '34px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5)
    this.add.text(480, 78, 'Mana infini, tous les pouvoirs au max, dummy invincible pour t\'entraîner', {
      fontSize: '14px', color: '#b0bec5',
    }).setOrigin(0.5)

    const cols = 4
    TRAINING_CLASSES.forEach((id, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = 180 + col * 200
      const y = 190 + row * 165
      const def = CLASSES[id]
      const card = this.add.rectangle(x, y, 172, 148, 0x1b3a4b).setStrokeStyle(3, def.tint).setInteractive({ useHandCursor: true })
      this.add.image(x, y - 26, `panda-${id}`).setScale(1.4)
      this.add.text(x, y + 52, def.name, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      card.on('pointerover', () => card.setFillStyle(0x24506a))
      card.on('pointerout', () => card.setFillStyle(0x1b3a4b))
      card.on('pointerdown', () => { audio.playSfx('ui-tap'); this.scene.restart({ classId: id }) })
    })

    this.overlayButton(480, 500, '◂ Retour au menu', 0x455a64, () => this.returnToMenu())
  }

  // retour à l'écran-titre : on restaure le joueur réel et on quitte l'entraînement.
  private returnToMenu() {
    audio.playSfx('ui-tap')
    if (realPlayer) setPlayer(realPlayer)
    realPlayer = null
    realPlayerSaved = false
    this.scene.stop('UI')
    this.scene.start('Title')
  }

  // petit bouton texte épinglé à l'écran (overlay d'entraînement).
  private overlayButton(x: number, y: number, label: string, bg: number, onTap: () => void) {
    const t = this.add.text(x, y, label, {
      fontSize: '18px', color: '#ffffff', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`,
      padding: { x: 14, y: 8 }, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
    t.on('pointerdown', () => { this.tweens.add({ targets: t, scale: 0.92, duration: 60, yoyo: true }); onTap() })
    return t
  }

  update(time: number, delta: number) {
    if (this.phase !== 'arena') return
    super.update(time, delta)
    // MANA INFINI : la jauge d'énergie est remise à plein chaque frame (après le drain éventuel du
    // vol/double-saut dans super.update) → les skills ne manquent jamais d'énergie.
    if (this.player) this.player.energy = this.player.maxEnergy
  }
}
