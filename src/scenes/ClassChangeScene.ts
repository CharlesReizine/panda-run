import Phaser from 'phaser'
import { CLASSES } from '../data/classes'
import { skillsOf } from '../data/skills'
import { canChangeClass, changeClass, canEvolveClass, evolveClass, EVOLUTIONS } from '../core/progression'
import { getPlayer } from '../state'
import { save } from '../core/save'
import type { ClassDef, ClassId } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import {
  CC, cardRect, cardFlow, portraitScale, splitSkills, fitName, fitSkill, trainingRect, type Rect,
} from './classchange-layout'
import {
  DUREE_TOTALE, angleOndulation, clignotement, intensiteRayons, montreNouvelleForme, phaseA,
  rotationRayons, voileBlanc,
} from './evolution-anim'
import { audio } from '../audio/audio-engine'

const CHOICES: ClassId[] = ['swordsman', 'mage', 'archer']

export class ClassChangeScene extends Phaser.Scene {
  private chosen = false
  // séquence d'évolution en cours (cf. evolution-anim.ts pour la partition ; ici on ne fait qu'obéir)
  private anim?: {
    t0: number
    echelle: number
    rayons: Phaser.GameObjects.Image
    vieux: Phaser.GameObjects.Image
    neuf: Phaser.GameObjects.Image
    eclatVieux: Phaser.GameObjects.Image
    eclatNeuf: Phaser.GameObjects.Image
    voile: Phaser.GameObjects.Rectangle
    message: Phaser.GameObjects.Text
  }

  constructor() { super('ClassChange') }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    this.chosen = false
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a)

    // deux modes : évolution (1 seule voie → confirmation) si le joueur y est éligible,
    // sinon choix de la 1re classe (3 cartes, novice)
    if (canEvolveClass(getPlayer())) this.buildEvolution()
    else this.buildFirstChoice()

    // accès à la page d'entraînement depuis le choix de classe (essayer les classes librement,
    // mana infini + dummy invincible) — coin bas-gauche, à l'écart des cartes ET du bouton
    // d'évolution : sa bande est comparée aux deux autres dans tests/core/classchange-layout.test.ts
    const training = '⚔ Entraînement'
    const tr = trainingRect(training)
    this.add.text(tr.x, CC.trainingY, training, {
      fontSize: `${CC.trainingFont}px`, color: '#ffd54f', fontStyle: 'bold', backgroundColor: '#00000066',
      padding: { x: CC.trainingPadX, y: CC.trainingPadY },
    }).setOrigin(0, 0.5).setDepth(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Training'))
  }

  private title(text: string) {
    this.add.text(480, CC.titleY, text, { fontSize: `${CC.titleFont}px`, color: '#ffd700' }).setOrigin(0.5)
  }

  // Peint le contenu commun d'une carte de classe : illustration BORNÉE par la carte, puis nom, stats
  // et liste de compétences bornée. Renvoie le rectangle de fond pour que l'appelant le rende cliquable.
  private paintCard(card: Rect, texture: string, name: string, def: ClassDef, skills: string[], heading?: string) {
    const f = cardFlow(card)
    const bg = this.add.rectangle(card.x + card.w / 2, card.y + card.h / 2, card.w, card.h, 0x1b3a4b)
      .setStrokeStyle(3, def.tint)

    // l'échelle vient de la carte, jamais l'inverse : c'est ce qui empêche le panda de ressortir par
    // le haut du cadre comme il le faisait (cadre 83→267 pour une carte commençant à 110)
    this.add.image(f.portrait.x + f.portrait.w / 2, f.portrait.y + f.portrait.h / 2, texture)
      .setScale(portraitScale(card))

    this.add.text(card.x + card.w / 2, f.name.y, fitName(name, card), {
      fontSize: `${CC.nameFont}px`, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.add.text(card.x + card.w / 2, f.stats.y, `ATK ${def.baseStats.atk}  DEF ${def.baseStats.def}\nPV ${def.baseStats.maxHp}`, {
      fontSize: `${CC.statsFont}px`, color: '#b0bec5', align: 'center',
    }).setOrigin(0.5, 0)

    // liste de compétences BORNÉE : le surplus est compté, pas remplacé par un « … » muet
    const { shown, hidden } = splitSkills(skills, card, heading ? 1 : 0)
    const lines = [
      ...(heading ? [fitSkill(heading, card)] : []),
      ...shown.map((s) => fitSkill(`• ${s}`, card)),
      ...(hidden > 0 ? [`+${hidden} autre${hidden > 1 ? 's' : ''}`] : []),
    ]
    this.add.text(card.x + card.w / 2, f.skills.y, lines.join('\n'), {
      fontSize: `${CC.skillFont}px`, color: '#80cbc4', align: 'center',
    }).setOrigin(0.5, 0)

    return bg
  }

  private buildFirstChoice() {
    this.title('✦ Choisis ta voie, petit panda ✦')

    CHOICES.forEach((id, i) => {
      const def = CLASSES[id]
      const card = cardRect(i, CHOICES.length)
      const bg = this.paintCard(card, `panda-${id}`, def.name, def, skillsOf(id).map((s) => s.name))
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(id))
    })
  }

  private buildEvolution() {
    const p = getPlayer()
    const target = EVOLUTIONS[p.classId]!
    const def = CLASSES[target]
    this.title('✦ Ton pouvoir s\'éveille ✦')

    const card = cardRect(0, 1)
    this.paintCard(card, `panda-${target}`, `${CLASSES[p.classId].name} → ${def.name}`, def,
      skillsOf(target).map((s) => s.name), 'Nouveaux skills :')

    // bouton d'action SOUS les cartes : il recouvrait le message de fin (bandes 474→526 et 504→536)
    const label = `Évoluer en ${def.name} !`
    const btn = this.add.text(480, CC.actionY, label, {
      fontSize: `${CC.actionFont}px`, color: '#000000', backgroundColor: '#ffd700',
      padding: { x: CC.actionPadX, y: CC.actionPadY },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    // le battement (+6 %) reste dans l'écran : le test vérifie que le rectangle réservé, grossi de 6 %,
    // tient encore dans les 960 px de l'espace de conception
    this.tweens.add({ targets: btn, scale: CC.actionPulse, yoyo: true, repeat: -1, duration: 500 })
    btn.on('pointerdown', () => this.evolve())
  }

  private choose(id: ClassId) {
    if (this.chosen) return
    const p = getPlayer()
    // même garde que pour l'évolution : `changeClass` lève quand les conditions ne sont pas réunies, et
    // une exception depuis un gestionnaire de bouton s'affiche au joueur en pleine page.
    if (!canChangeClass(p) || id === 'novice') return
    this.chosen = true
    const avant = p.classId // AVANT la mutation : c'est la forme qu'on montre au début de l'évolution
    changeClass(p, id)
    // ⚠️ ON N'OFFRE PLUS RIEN AU PASSAGE DE CLASSE, ET C'EST DEMANDÉ : « au passage de classe tu me mets
    // déjà un skill et tu l'équipes. Ça tu arrêtes, je veux pas ça. »
    // L'ancien comportement apprenait le premier skill de la nouvelle classe et le posait dans un slot
    // libre. Le joueur découvrait donc sa classe avec un choix déjà fait à sa place, et un slot occupé
    // qu'il devait défaire. Les points de compétence sont là pour ça : il apprend ce qu'il veut, quand il
    // veut, depuis l'arbre des compétences.
    save(p)
    this.finish(`Tu es maintenant ${CLASSES[id].name} !`, avant, id)
  }

  private evolve() {
    if (this.chosen) return
    const p = getPlayer()
    // ⚠️ ON VÉRIFIE AVANT D'AGIR. `evolveClass` LÈVE quand les conditions ne sont pas réunies (mauvaise
    // classe, niveau trop bas) — c'est un bon garde-fou côté modèle, mais depuis un gestionnaire de
    // bouton une exception non rattrapée remonte jusqu'à l'overlay d'erreur JS : le joueur voit une
    // stack trace en plein écran là où il attendait, au pire, un bouton qui ne fait rien. L'écran ne
    // devrait de toute façon pas proposer l'évolution dans ce cas ; ceci en est la preuve, pas l'excuse.
    if (!canEvolveClass(p)) return
    this.chosen = true
    const avant = p.classId // AVANT la mutation
    const to = evolveClass(p)
    save(p)
    this.finish(`Tu es maintenant ${CLASSES[to].name} !`, avant, to)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // L'ÉVOLUTION SE JOUE ICI — la partition est dans `evolution-anim.ts`, cette méthode n'en est que
  // l'orchestre. Avant, c'était un flash blanc de 300 ms : le moment le plus marquant de la progression
  // passait inaperçu (« je veux comme pokémon, quand ça évolue »).
  //
  // ⚠️ ON PILOTE DEPUIS `update`, PAS EN EMPILANT DES TWEENS. Quatre phases dont deux à cadence VARIABLE
  // (le clignotement accélère) : en tweens il faudrait les chaîner à la main, et le moindre décalage de
  // durée décollerait le voile de l'alternance. Lire l'instant courant dans des fonctions pures garde la
  // séquence exacte par construction — et testable sans navigateur.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  private finish(message: string, de: ClassId, vers: ClassId) {
    // l'écran s'efface : on ne garde que le sujet, comme dans la référence
    for (const o of this.children.list.slice()) o.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a)
    audio.playSfx('level-up')

    // ── FOND DE RAYONS, généré ici plutôt que chargé ──────────────────────────────────────────
    // Demande du joueur : « génère-moi une image de fond qui a un peu de gueule ». On la DESSINE au lieu
    // d'ajouter un PNG : le motif est une roue de rayons, donc quelques lignes de géométrie suffisent, et
    // surtout elle TOURNE et s'intensifie avec la séquence — ce qu'une image plate ne saurait pas faire.
    // Un asset aurait aussi alourdi le préchargement pour un écran vu deux fois par partie.
    const CLE_RAYONS = 'evo-rayons'
    if (!this.textures.exists(CLE_RAYONS)) {
      const R = 256
      const g = this.make.graphics({ x: 0, y: 0 })
      const N = 18 // assez pour une roue lisible, pas au point de faire une bouillie en tournant
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2
        g.fillStyle(0xffffff, i % 2 === 0 ? 0.30 : 0.12)
        g.slice(R, R, R, a0, a0 + Math.PI / N, false)
        g.fillPath()
      }
      g.generateTexture(CLE_RAYONS, R * 2, R * 2)
      g.destroy()
    }

    const CY = 240 // un peu haut : le message de fin occupe le bas de l'écran
    // ⚠️ 7 ET NON 12, ET C'EST L'ILLUSTRATION QUI COMMANDE. Demande : « fais l'image x3 ». Poussée au
    // triple (4 → 12), la silhouette SORT du cadre — on ne voyait plus que la tête et le torse — et
    // l'illustration source, petite, se délite en bouillie. On ne peut pas compenser par un filtre
    // « pixels nets » : ces textures sont celles du jeu, changer leur filtrage pixelliserait tout le reste.
    // Mesuré au banc : à 12 on ne voit plus que la tête et le torse, à 7 les pattes passent sous le
    // message. 5,5 est le plus grand agrandissement qui garde le panda ENTIER, message compris — soit
    // ~80 % de la hauteur d'écran, la place qu'occupe le sujet dans la référence.
    const ECHELLE = 5.5
    // la roue est posée SOUS le sujet, largement débordante (elle doit couvrir les coins en tournant)
    const rayons = this.add.image(480, CY, CLE_RAYONS).setScale(3).setDepth(5).setAlpha(0)
    const poser = (texture: string) => this.add.image(480, CY, texture).setScale(ECHELLE).setDepth(10)
    const vieux = poser(`panda-${de}`)
    const neuf = poser(`panda-${vers}`).setVisible(false)
    // ÉCLAT : une copie BLANCHE de la même image posée par-dessus. C'est ce qui donne la silhouette
    // lumineuse de la référence — un tint NORMAL ne sait pas éclaircir, il ne fait que multiplier la
    // couleur. Il faut donc le mode FILL, qui REMPLACE la couleur du pixel.
    // ⚠️ `setTintFill(couleur)` de Phaser 3 ne fait plus RIEN en Phaser 4 (méthode dépréciée, vide) : le
    // mode est devenu un réglage à part. Écrit à l'ancienne, l'éclat aurait été une simple copie du panda
    // en surimpression — donc rien de visible, et aucun test ne l'aurait dit.
    const eclat = (texture: string) => poser(texture)
      .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setDepth(11).setAlpha(0)
    const eclatVieux = eclat(`panda-${de}`)
    const eclatNeuf = eclat(`panda-${vers}`).setVisible(false)

    const voile = this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0xffffff).setAlpha(0).setDepth(20)
    const messageTxt = this.add.text(480, CC.messageY, message, {
      fontSize: `${CC.messageFont}px`, color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30).setAlpha(0)

    this.anim = { t0: this.time.now, echelle: ECHELLE, rayons, vieux, neuf, eclatVieux, eclatNeuf, voile, message: messageTxt }
  }

  update(time: number) {
    const a = this.anim
    if (!a) return
    const t = time - a.t0
    if (t >= DUREE_TOTALE) {
      this.anim = undefined
      this.scene.start('WorldMap')
      return
    }
    // 0) la roue de rayons : elle enfle et accélère, sans clignoter (le sujet s'en charge)
    a.rayons.setAlpha(0.55 * intensiteRayons(t))
    a.rayons.setRotation(rotationRayons(t))
    // 1) le balancement, sur la forme actuellement montrée
    const angle = angleOndulation(t)
    const nouvelle = montreNouvelleForme(t)
    for (const o of [a.vieux, a.eclatVieux]) { o.setVisible(!nouvelle); o.setAngle(angle) }
    for (const o of [a.neuf, a.eclatNeuf]) { o.setVisible(nouvelle); o.setAngle(angle) }
    // 2) la lumière qui bat sur le sujet, d'enveloppe croissante
    const lueur = clignotement(t)
    a.eclatVieux.setAlpha(nouvelle ? 0 : lueur)
    a.eclatNeuf.setAlpha(nouvelle ? lueur : 0)
    // 3) le voile plein écran : il sature à 1 pendant la phase blanche, ce qui CACHE la bascule
    a.voile.setAlpha(voileBlanc(t))
    // 4) la révélation : le message se lève avec la lumière qui retombe, et l'image se pose à l'échelle
    const rev = phaseA('revelation')
    if (t >= rev.debut) {
      const av = Math.min(1, (t - rev.debut) / rev.duree)
      a.message.setAlpha(av)
      const e = a.echelle * (1.18 - 0.18 * av) // arrive un peu trop grande, puis se pose
      a.neuf.setScale(e)
      a.eclatNeuf.setScale(e)
    }
  }
}
