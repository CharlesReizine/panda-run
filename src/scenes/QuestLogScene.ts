import Phaser from 'phaser'
import { getPlayer } from '../state'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { villeLaPlusProche } from '../data/worldmap'
import { refreshQuestProgress } from '../core/quests'
import { QUEST_CHAIN } from '../data/shops'
import {
  FONT, JOURNAL, lignesJournal, lignesParPage, largeurTexte, tronquer, yLigne,
  type EtatQuete, type LigneQuete,
} from './quest-log-layout'

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

      this.add.text(JOURNAL.left + 10, y + 6, `${style.puce} ${l.ordre}. ${tronquer(l.nom, largeur - 40, FONT.titre)}`, {
        fontSize: `${FONT.titre}px`, color: style.couleur, fontStyle: 'bold',
      })
      // l'objectif d'abord, la récompense ensuite : on cherche « quoi faire » plus souvent que « ça rapporte quoi »
      this.add.text(JOURNAL.left + 10, y + 26, tronquer(l.objectif, largeur, FONT.detail), {
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
