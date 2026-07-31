import Phaser from 'phaser'
import { LEVELS } from '../data/levels'
import { MONSTERS } from '../data/monsters'
import { audio } from '../audio/audio-engine'
import type { MonsterDef } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { renderMonsterCard } from './monster-card'
import { INTRO, INTRO_ROW } from './level-intro-layout'

// Écran de présentation d'un NOUVEAU terrain : montré une seule fois par levelId (la première
// entrée), il présente les monstres du niveau AVANT de lancer le jeu. Reçoit les mêmes données que la
// scène 'Level' et les lui transmet à l'identique.
//
// ⚠️ UN MONSTRE PAR PAGE, AVEC LA FICHE DU BESTIAIRE — et c'est le cœur du correctif.
// Cet écran entassait tous les monstres du terrain dans une grille de petites cartes, avec pour chacune
// image + badge + nom + butin complet + compétences. Sur un terrain à 4 monstres ça faisait des cartes
// de ~90 px de large : le butin passait sous les compétences, les compétences sous le bord.
// Retour user : « là ça déborde complet et c'est pas le format que je veux ».
// Une grille ne peut PAS contenir cette information : il y en a trop. On affiche donc UNE fiche à la
// fois, dans le format explicitement demandé (quatre quarts), avec une navigation ‹ ›. Le rendu vient
// de scenes/monster-card.ts, partagé avec le bestiaire, dont la géométrie est vérifiée par un test sur
// le vrai roster — le débordement est donc impossible par construction, et les deux écrans ne peuvent
// plus diverger.
interface IntroData {
  levelId: string
  fromNode: string
  targetNode: string
  dir: 'forward' | 'backward'
}

const SEEN_KEY = 'panda-run:vus'

// Marque un levelId comme déjà vu (persistant). Silencieux si localStorage est inaccessible.
export function markLevelSeen(levelId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
    seen.add(levelId)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch { /* localStorage inaccessible : on n'empêche pas de jouer */ }
}

// Vrai si ce levelId a déjà été introduit (donc pas de re-présentation).
export function isLevelSeen(levelId: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return seen.includes(levelId)
  } catch { return false }
}

export class LevelIntroScene extends Phaser.Scene {
  private intro!: IntroData
  private monsters: MonsterDef[] = []
  private page = 0

  constructor() { super('LevelIntro') }

  init(data: IntroData) {
    this.intro = data
    this.page = 0
  }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts)
    centerCamera(this)
    this.monsters = this.uniqueMonsters(LEVELS[this.intro.levelId])
    this.render()
  }

  // Monstres UNIQUES du niveau : dérivés des spawns (dédup, ordre préservé) + le boss en dernier.
  private uniqueMonsters(level: typeof LEVELS[string] | undefined): MonsterDef[] {
    const ids: string[] = []
    for (const s of level?.spawns ?? []) if (!ids.includes(s.monsterId)) ids.push(s.monsterId)
    if (level?.boss && !ids.includes(level.boss)) ids.push(level.boss)
    return ids.map((id) => MONSTERS[id]).filter((m): m is MonsterDef => !!m)
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x10151f, 1)

    // Sur-titre sur UNE seule ligne : le nom du terrain compte, pas la mise en scène — la place
    // gagnée va à la fiche. (L'ancienne version empilait un bandeau de trois lignes jusqu'à y=84.)
    const level = LEVELS[this.intro.levelId]
    this.add.text(480, INTRO.headerY, `Nouveau terrain · ${level?.name ?? this.intro.levelId}`, {
      fontSize: '19px', color: '#80cbc4', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    if (this.monsters.length === 0) {
      this.add.text(480, 260, 'Aucun monstre répertorié.', { fontSize: '18px', color: '#b0bec5' }).setOrigin(0.5)
    } else {
      // fiche RÉVÉLÉE : tout l'intérêt de cet écran est de décrire les monstres avant de les croiser.
      // Pas de compteur de victoires ici (il vaut 0 par définition sur un terrain jamais joué).
      renderMonsterCard(this, this.monsters[this.page]!)
      this.navRow()
    }

    this.startButton()
  }

  // Rangée du bas : ‹ Préc. · « Monstre i/n » · Suiv. ›. Positions figées dans level-intro-layout.ts,
  // dont le test garantit qu'elles ne se recouvrent pas et n'empiètent pas sur la fiche.
  private navRow() {
    const n = this.monsters.length
    if (n <= 1) return
    if (this.page > 0) {
      this.rowBtn(INTRO_ROW.prev.x, '◀ Préc.', 0x37474f, () => { this.page--; this.render() })
    }
    this.add.text(INTRO_ROW.counter.x, INTRO.navY, `Monstre ${this.page + 1}/${n}`, {
      fontSize: '15px', color: '#b0bec5',
    }).setOrigin(0.5)
    if (this.page < n - 1) {
      this.rowBtn(INTRO_ROW.next.x, 'Suiv. ▶', 0x37474f, () => { this.page++; this.render() })
    }
  }

  private rowBtn(x: number, label: string, bg: number, onTap: () => void) {
    return this.add.text(x, INTRO.navY, label, {
      fontSize: '16px', color: '#ffffff', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`, padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  }

  // Bouton « Commencer ! » : marque le niveau comme vu puis lance la partie avec les mêmes data.
  private startButton() {
    const w = INTRO_ROW.start.w, h = 44
    const c = this.add.container(INTRO_ROW.start.x, INTRO.navY)
    const bg = this.add.graphics()
    const paint = (fill: number, line: number) => {
      bg.clear()
      bg.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 12)
      bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12)
      bg.lineStyle(3, line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
    }
    paint(0x2e7d32, 0xa5d6a7)
    const t = this.add.text(0, 0, 'Commencer !', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    c.add([bg, t])
    c.setSize(w, h).setInteractive({ useHandCursor: true })
    c.on('pointerover', () => { paint(0x43a047, 0xe8f5e9); c.setScale(1.05) })
    c.on('pointerout', () => { paint(0x2e7d32, 0xa5d6a7); c.setScale(1) })
    c.on('pointerdown', () => {
      audio.playSfx('ui-tap')
      markLevelSeen(this.intro.levelId)
      this.scene.start('Level', this.intro)
    })
  }
}
