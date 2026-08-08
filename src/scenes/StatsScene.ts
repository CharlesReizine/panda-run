import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { computeStats } from '../core/stats'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { STAT_POINTS_PER_LEVEL } from '../core/progression'
import {
  STATS, BUILDS, pourcentages, pointsToile, cadreToile, suggerer, totalReparti, type StatId,
} from '../core/repartition'
import {
  PAGE, POLICE, yLigneStat, etiquetteToile, largeurEffet, tronquer,
} from './stats-layout'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA PAGE STAT
//
// Demande du joueur : « je suis chaud si tu peux faire une page "Stat" et je peux changer les stats
// (quitte à rajouter des stats genre VIT, INT), et une jolie toile où je vois comment j'ai pondéré mon
// perso (en pourcentage de points affectés). Je veux aussi un bouton "Suggérer" qui suit un build un peu
// classique par classe. Je veux aussi pouvoir accéder à ce menu depuis la page de jeu (il faut une notif
// au niveau de la vie quand j'ai des points). Là le menu est inaccessible. »
//
// ⚠️ « LÀ LE MENU EST INACCESSIBLE » EST LE VRAI SUJET, et le reste en découle. La répartition existait
// depuis longtemps, mais elle vivait dans un coin d'un écran qu'on n'ouvre qu'entre deux terrains : on
// gagne des points EN JOUANT, et c'est précisément là qu'on ne pouvait pas les dépenser. Une mécanique
// qu'on ne peut pas atteindre au moment où elle se déclenche n'existe qu'à moitié.
//
// La toile n'est pas de la décoration : c'est la seule vue qui répond à « quel genre de perso ai-je
// fait, au juste ? ». Quatre nombres alignés ne disent pas une FORME ; un radar, si.

export class StatsScene extends Phaser.Scene {
  private retour = 'Menu'
  /** ouverte par-dessus une partie en cours : on REPREND la scène qui dort, on ne la redémarre pas */
  private depuisLeJeu = false

  constructor() { super('Stats') }

  init(data?: { return?: string; fromGame?: boolean }) {
    this.retour = data?.return ?? 'Menu'
    this.depuisLeJeu = !!data?.fromGame
  }

  create() {
    installUiClickSound(this)
    centerCamera(this)
    this.render()
  }

  /**
   * Sortie de la page.
   *
   * ⚠️ DEUX CHEMINS, ET LES CONFONDRE TUE LA PARTIE — même piège que le journal de quêtes. Ouverte
   * depuis le jeu, le terrain n'est pas fini : il DORT. Le redémarrer le rejouerait depuis le début.
   */
  private sortir() {
    if (!this.depuisLeJeu) { this.scene.start(this.retour); return }
    const jeu = this.scene.manager.getScenes(false)
      .find((sc) => (sc.scene.key === 'Level' || sc.scene.key === 'Training') && sc.scene.isPaused())
    if (!jeu) { this.scene.stop('UI'); this.scene.start('WorldMap'); this.scene.stop('Stats'); return }
    this.scene.resume(jeu.scene.key)
    this.scene.resume('UI')
    this.scene.stop('Stats')
  }

  private btn(x: number, y: number, label: string, fond: number, onTap: () => void, actif = true) {
    const t = this.add.text(x, y, label, {
      fontSize: '16px', color: actif ? '#ffffff' : '#607d8b', fontStyle: 'bold',
      backgroundColor: `#${(actif ? fond : 0x2a2f35).toString(16).padStart(6, '0')}`,
      padding: { x: 12, y: 7 },
    }).setOrigin(0.5)
    if (actif) t.setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
    return t
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.98)

    let p
    try { p = getPlayer() } catch { this.sortir(); return }
    const a = p.allocated as Record<StatId, number>
    const pct = pourcentages(a)
    const derive = computeStats(p)

    this.add.text(480, PAGE.titreY, 'RÉPARTITION DES STATS', {
      fontSize: `${POLICE.titre}px`, color: '#ffd54f', fontStyle: 'bold',
    }).setOrigin(0.5)

    const reste = p.statPoints
    this.add.text(480, PAGE.titreY + 26, reste > 0
      ? `${reste} point${reste > 1 ? 's' : ''} à répartir`
      : `+${STAT_POINTS_PER_LEVEL} points à chaque niveau`, {
      fontSize: '14px', color: reste > 0 ? '#ffd54f' : '#78909c', fontStyle: reste > 0 ? 'bold' : 'normal',
    }).setOrigin(0.5)

    // ── COLONNE GAUCHE : les quatre stats ────────────────────────────────────────────────────
    STATS.forEach((s, i) => {
      const y = yLigneStat(i)
      this.add.rectangle(PAGE.listeX, y, PAGE.listeW, PAGE.ligneH - 10, 0x16202b, 0.9)
        .setOrigin(0, 0).setStrokeStyle(1, s.couleur, 0.45)
      this.add.rectangle(PAGE.listeX, y, 5, PAGE.ligneH - 10, s.couleur, 1).setOrigin(0, 0)

      this.add.text(PAGE.listeX + 16, y + 10, s.nom, {
        fontSize: `${POLICE.nom}px`, color: `#${s.couleur.toString(16).padStart(6, '0')}`, fontStyle: 'bold',
      })
      this.add.text(PAGE.listeX + 16, y + 38, tronquer(s.effet, largeurEffet(), POLICE.effet), {
        fontSize: `${POLICE.effet}px`, color: '#90a4ae',
      })

      // valeur + part, alignées à droite du bloc
      const xVal = PAGE.listeX + PAGE.listeW - 74
      this.add.text(xVal, y + 12, `${a[s.id] ?? 0}`, {
        fontSize: `${POLICE.valeur}px`, color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0)
      this.add.text(xVal, y + 40, `${pct[s.id] ?? 0} %`, {
        fontSize: `${POLICE.pct}px`, color: '#78909c',
      }).setOrigin(0.5, 0)

      // ⚠️ LE « + » EST TOUJOURS DESSINÉ, grisé quand il n'y a pas de point. Un bouton qui n'apparaît
      // qu'au moment où on peut s'en servir n'apprend jamais qu'il existe — c'est le défaut qu'on vient
      // de corriger dans le menu, et il n'a aucune raison de renaître ici.
      this.btn(PAGE.listeX + PAGE.listeW - 26, y + 26, '+', 0x8d6e00, () => {
        p!.statPoints--
        ;(p!.allocated as Record<StatId, number>)[s.id]++
        save(p!)
        this.render()
      }, reste > 0)
    })

    // ── COLONNE DROITE : la toile ────────────────────────────────────────────────────────────
    this.dessinerToile(pct, totalReparti(a))

    // ── STATS DÉRIVÉES : ce que la répartition donne VRAIMENT ────────────────────────────────
    // Sans cette ligne, la page parle en points ; le joueur, lui, joue avec des PV et de l'attaque.
    this.add.text(480, PAGE.basY - 34, `${Math.round(derive.maxHp)} PV  ·  ${Math.round(derive.atk)} ATK  ·  ${Math.round(derive.def)} DÉF`, {
      fontSize: '15px', color: '#b0bec5', fontStyle: 'bold',
    }).setOrigin(0.5)

    // ── RANGÉE DU BAS ───────────────────────────────────────────────────────────────────────
    const build = BUILDS[p.classId] ?? BUILDS.novice
    this.btn(300, PAGE.basY, `Suggérer · ${build.nom}`, 0x00695c, () => {
      const propose = suggerer(p!.classId, a, p!.statPoints)
      p!.allocated = propose
      p!.statPoints = 0
      save(p!)
      this.render()
    }, reste > 0)
    this.btn(660, PAGE.basY, '← Retour', 0x33691e, () => this.sortir())
  }

  /**
   * La toile de pondération.
   *
   * ⚠️ L'ÉCHELLE EST RELATIVE À LA PLUS GROSSE PART, PAS À 100 % (cf. core/repartition). Sur un
   * personnage réparti 40/30/20/10, une toile calée sur 100 % serait un petit point au centre : la
   * FORME est ce qui dit « bretteur » ou « arcaniste », pas la taille.
   */
  private dessinerToile(pct: Record<StatId, number>, total: number) {
    const g = this.add.graphics()
    const cadre = cadreToile(PAGE.toileCx, PAGE.toileCy, PAGE.toileR)

    // grille de fond : trois anneaux et les quatre rayons
    g.lineStyle(1, 0x37474f, 0.8)
    for (const f of [0.35, 0.7, 1]) {
      const anneau = cadreToile(PAGE.toileCx, PAGE.toileCy, PAGE.toileR * f)
      g.beginPath()
      anneau.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)))
      g.closePath().strokePath()
    }
    for (const pt of cadre) g.lineBetween(PAGE.toileCx, PAGE.toileCy, pt.x, pt.y)

    // le polygone du joueur
    if (total > 0) {
      const pts = pointsToile(pct, PAGE.toileCx, PAGE.toileCy, PAGE.toileR)
      g.fillStyle(0x4dd0e1, 0.28).lineStyle(3, 0x4dd0e1, 0.95)
      g.beginPath()
      pts.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)))
      g.closePath().fillPath().strokePath()
      pts.forEach((pt, i) => this.add.circle(pt.x, pt.y, 5, STATS[i]!.couleur).setStrokeStyle(2, 0x0d1b2a))
    } else {
      // ⚠️ UN RADAR VIDE NE SE LIT PAS COMME « ZÉRO POINT », il se lit comme un bug. On le DIT.
      this.add.text(PAGE.toileCx, PAGE.toileCy, 'aucun point réparti\npour l\'instant', {
        fontSize: '14px', color: '#546e7a', align: 'center', lineSpacing: 4,
      }).setOrigin(0.5)
    }

    STATS.forEach((s, i) => {
      const e = etiquetteToile(i)
      this.add.text(e.x, e.y, s.nom, {
        fontSize: `${POLICE.nom}px`, color: `#${s.couleur.toString(16).padStart(6, '0')}`, fontStyle: 'bold',
      }).setOrigin(0.5)
    })
  }
}
