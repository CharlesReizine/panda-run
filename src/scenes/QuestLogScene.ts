import Phaser from 'phaser'
import { getPlayer } from '../state'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { villeLaPlusProche } from '../data/worldmap'
import { refreshQuestProgress } from '../core/quests'
import { QUEST_CHAIN } from '../data/shops'
import {
  FONT, JOURNAL, infoCentre, lignesJournal, lignesParPage, largeurTexte, titreLeft, tronquer, yLigne,
  type EtatQuete, type LigneQuete,
} from './quest-log-layout'
import { indiceDe } from '../core/indices-quete'
import { MONSTERS } from '../data/monsters'
import { textureMonstre } from './monster-card'

// JOURNAL DE QUÊTES — la liste complète de la chaîne du garde : ce qui est fait, ce qui est en cours,
// ce qui reste, et où aller rendre ce qui est terminé.
//
// Retour du joueur : « il faut pouvoir suivre les quêtes en cours et tous les objectifs je pense ».
// Jusqu'ici, le seul suivi était le bandeau du HUD, qui n'affiche QU'UNE quête et disparaît dès
// qu'elle est réclamée : impossible de savoir ce qui venait ensuite ni ce qu'on avait déjà fait.
//
// Écran en LECTURE SEULE — à une exception près, et elle compte : on rafraîchit la progression à
// l'ouverture. Les compteurs de kills montent pendant le niveau et personne ne recalcule les quêtes
// avant le retour en ville ; sans ce rafraîchissement, le journal afficherait des chiffres périmés et
// donnerait exactement l'impression que le joueur nous avait déjà signalée — que les quêtes n'avancent
// pas. Aucune quête n'est réclamée ici : la récompense se prend chez le garde, c'est tout l'intérêt de
// dire OÙ il est.

/** Couleur de l'état, et sa pastille. Un journal se lit à la couleur avant de se lire au mot. */
const ETATS: Record<EtatQuete, { puce: string; couleur: string; fond: number }> = {
  'a-prendre': { puce: '·', couleur: '#78909c', fond: 0x263238 },
  'en-cours': { puce: '📜', couleur: '#ffb300', fond: 0x2b2417 },
  'a-rendre': { puce: '✅', couleur: '#66bb6a', fond: 0x17301c },
  'finie': { puce: '✔', couleur: '#546e7a', fond: 0x1c2529 },
}

export class QuestLogScene extends Phaser.Scene {
  private page = 0
  private retour = 'Menu'
  /** ouvert par-dessus une partie en cours : on ne « démarre » pas une scène, on REPREND celle qui dort */
  private depuisLeJeu = false

  constructor() { super('QuestLog') }

  init(data?: { return?: string; fromGame?: boolean }) {
    this.retour = data?.return ?? 'Menu'
    this.depuisLeJeu = !!data?.fromGame
  }

  /**
   * Sortie du journal.
   *
   * ⚠️ DEUX CHEMINS, ET LES CONFONDRE TUE LA PARTIE. Ouvert depuis le menu, on redémarre l'écran
   * d'où l'on vient. Ouvert depuis le JEU (le bandeau du HUD), le terrain n'est pas fini : il DORT.
   * Le redémarrer le rejouerait depuis le début. On reprend donc, exactement comme le fait l'écran de
   * pause — repli sur la carte si aucun terrain suspendu n'existe, parce qu'une interface ne doit pas
   * dépendre du chemin par lequel on y est arrivé (c'est la sonde d'écrans qui l'a appris à Pause).
   */
  private sortir() {
    if (!this.depuisLeJeu) { this.scene.start(this.retour); return }
    const jeu = this.scene.manager.getScenes(false)
      .find((sc) => (sc.scene.key === 'Level' || sc.scene.key === 'Training') && sc.scene.isPaused())
    if (!jeu) { this.scene.stop('UI'); this.scene.start('WorldMap'); this.scene.stop('QuestLog'); return }
    this.scene.resume(jeu.scene.key)
    this.scene.resume('UI')
    this.scene.stop('QuestLog')
  }

  create() {
    installUiClickSound(this)
    centerCamera(this)
    this.render()
  }

  private lignes(): LigneQuete[] {
    let p
    try { p = getPlayer() } catch { return [] }
    // cf. l'avertissement en tête de fichier : sans ce rafraîchissement, les compteurs sont périmés.
    for (const def of QUEST_CHAIN) if (p.quests[def.id]) refreshQuestProgress(p, def.id)
    const ville = villeLaPlusProche(p.currentNode)
    return lignesJournal(p, ville?.name)
  }

  private btn(x: number, y: number, label: string, bg: number, onTap: () => void) {
    return this.add.text(x, y, label, {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: `#${bg.toString(16).padStart(6, '0')}`, padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  }

  /**
   * L'ENCART D'INDICE — quoi chercher, et où.
   *
   * ⚠️ IL SE FERME EN TOUCHANT N'IMPORTE OÙ, et ce n'est pas un détail de confort. Un panneau qui ne se
   * ferme que par sa croix piège au doigt sur téléphone : on tape à côté, il ne se passe rien, et on
   * croit l'écran figé. Le fond est donc lui-même la zone de fermeture, la croix n'étant qu'un repère.
   */
  private montrerIndice(l: LigneQuete) {
    const def = QUEST_CHAIN.find((q) => q.id === l.id)
    if (!def) return
    const ind = indiceDe(def)
    const cont = this.add.container(0, 0).setDepth(50)

    const voile = this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x000000, 0.55)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => cont.destroy())
    cont.add(voile)

    // ── LA TÊTE DU MONSTRE, PAS SEULEMENT SON NOM ───────────────────────────────────────────
    //
    // Demande du joueur : « dans les quêtes où faut défoncer du mob, tu peux mettre la photo du mob à
    // défoncer en plus d'où on peut le trouver ». Un nom se LIT, une bestiole se RECONNAÎT : savoir où
    // aller ne sert à rien si, une fois sur place, on ne sait pas laquelle des cinq espèces présentes
    // on est censé chasser. C'est la moitié qui manquait à l'indice.
    const mob = ind.monstreId ? MONSTERS[ind.monstreId] : undefined
    const tex = mob ? textureMonstre(this, mob) : null
    const aPortrait = !!tex && this.textures.exists(tex)

    const lignes = [
      { t: 'À TROUVER', c: '#80cbc4', s: 12 },
      { t: ind.quoi, c: '#ffffff', s: 17 },
      ...(ind.ou.length ? [{ t: 'OÙ', c: '#80cbc4', s: 12 }] : []),
      ...ind.ou.map((o) => ({ t: `· ${o}`, c: '#ffd54f', s: 15 })),
      ...(ind.astuce ? [{ t: ind.astuce, c: '#b0bec5', s: 12 }] : []),
    ]
    const h = 64 + lignes.reduce((n, li) => n + li.s + 10, 0) + (aPortrait ? 88 : 0)
    cont.add(this.add.rectangle(480, 270, 520, h, 0x0d1b2a, 0.98).setStrokeStyle(2, 0x80cbc4, 0.9))
    cont.add(this.add.text(480, 270 - h / 2 + 20, tronquer(l.nom, 470, 16), {
      fontSize: '16px', color: '#ffd54f', fontStyle: 'bold',
    }).setOrigin(0.5))

    let y = 270 - h / 2 + 46
    if (aPortrait) {
      // cadre + portrait, à l'échelle de sa propre image (les monstres n'ont pas tous le même gabarit)
      cont.add(this.add.rectangle(480, y + 38, 84, 84, 0x1c2431, 1).setStrokeStyle(2, 0x80cbc4, 0.8))
      const img = this.add.image(480, y + 38, tex!)
      const src = this.textures.get(tex!).getSourceImage()
      img.setScale(Math.min(72 / src.width, 72 / src.height))
      cont.add(img)
      y += 88
    }
    for (const li of lignes) {
      cont.add(this.add.text(480, y, tronquer(li.t, 480, li.s), {
        fontSize: `${li.s}px`, color: li.c, fontStyle: li.s >= 15 ? 'bold' : 'normal',
      }).setOrigin(0.5, 0))
      y += li.s + 10
    }
    cont.add(this.add.text(480, 270 + h / 2 - 16, 'toucher pour fermer', {
      fontSize: '11px', color: '#546e7a',
    }).setOrigin(0.5))
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.97)

    const toutes = this.lignes()
    const parPage = lignesParPage()
    const pages = Math.max(1, Math.ceil(toutes.length / parPage))
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1)
    const visibles = toutes.slice(this.page * parPage, this.page * parPage + parPage)

    const restantes = toutes.filter((l) => l.etat !== 'finie').length
    this.add.text(480, 46, '📜 JOURNAL DE QUÊTES', { fontSize: '24px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 72, `${toutes.length - restantes}/${toutes.length} accomplies`, {
      fontSize: '13px', color: '#b0bec5',
    }).setOrigin(0.5)

    const largeur = largeurTexte()
    visibles.forEach((l, i) => {
      const y = yLigne(i)
      const style = ETATS[l.etat]
      this.add.rectangle(JOURNAL.left, y, JOURNAL.right - JOURNAL.left, JOURNAL.rowH, style.fond, 0.9)
        .setOrigin(0, 0).setStrokeStyle(1, 0x37474f, 0.8)

      // ── LE « i » : OÙ TROUVER CE QU'ON DEMANDE ────────────────────────────────────────────
      //
      // Demande du joueur : « dans les quêtes tu peux mettre un petit "i" sur chaque quête, et on peut
      // voir dans quelles maps on peut trouver les mobs ou autres indices ». L'information existait
      // déjà dans les données — elle n'était nulle part dans le jeu, et on cherchait ses quinze Gloopy
      // en reparcourant des terrains au hasard.
      const c = infoCentre(i)
      const pastille = this.add.circle(c.x, c.y, JOURNAL.rayonInfo, 0x263238).setStrokeStyle(2, 0x80cbc4)
      this.add.text(c.x, c.y, 'i', { fontSize: '13px', color: '#80cbc4', fontStyle: 'bold' }).setOrigin(0.5)
      // zone de clic ÉLARGIE au-delà du cercle dessiné : au pouce, onze pixels de rayon ne se touchent pas
      pastille.setInteractive(new Phaser.Geom.Circle(JOURNAL.rayonInfo, JOURNAL.rayonInfo, JOURNAL.rayonInfo + 10), Phaser.Geom.Circle.Contains)
      pastille.on('pointerdown', () => this.montrerIndice(l))

      this.add.text(titreLeft(), y + 6, `${style.puce} ${l.ordre}. ${tronquer(l.nom, largeur - 40, FONT.titre)}`, {
        fontSize: `${FONT.titre}px`, color: style.couleur, fontStyle: 'bold',
      })
      // l'objectif d'abord, la récompense ensuite : on cherche « quoi faire » plus souvent que « ça rapporte quoi »
      this.add.text(titreLeft(), y + 26, tronquer(l.objectif, largeur, FONT.detail), {
        fontSize: `${FONT.detail}px`, color: '#cfd8dc',
      })
      const droite = tronquer(l.ou ?? l.recompense, JOURNAL.gaugeW + 140, FONT.detail)
      this.add.text(JOURNAL.right - 10, y + 26, droite, {
        fontSize: `${FONT.detail}px`, color: l.ou ? '#66bb6a' : '#8d9ba3',
      }).setOrigin(1, 0)

      // jauge : la barre dit l'avancement d'un coup d'œil, le compteur donne le chiffre exact
      if (l.compteur) {
        const gx = JOURNAL.right - JOURNAL.gaugeW, gy = y + 8
        this.add.rectangle(gx, gy, JOURNAL.gaugeW - 10, 10, 0x000000, 0.45).setOrigin(0, 0)
        this.add.rectangle(gx, gy, (JOURNAL.gaugeW - 10) * Math.min(1, l.ratio), 10, Phaser.Display.Color.HexStringToColor(style.couleur).color, 1).setOrigin(0, 0)
        this.add.text(JOURNAL.right - 10, gy - 2, l.compteur, {
          fontSize: `${FONT.jauge}px`, color: style.couleur, fontStyle: 'bold',
        }).setOrigin(1, 0)
      }
    })

    if (pages > 1) {
      if (this.page > 0) this.btn(380, 512, '◀ Préc.', 0x37474f, () => { this.page--; this.render() })
      this.add.text(480, 512, `Page ${this.page + 1}/${pages}`, { fontSize: '13px', color: '#b0bec5' }).setOrigin(0.5)
      if (this.page < pages - 1) this.btn(580, 512, 'Suiv. ▶', 0x37474f, () => { this.page++; this.render() })
    }
    this.btn(120, 512, '← Retour', 0x33691e, () => this.sortir())
  }
}
