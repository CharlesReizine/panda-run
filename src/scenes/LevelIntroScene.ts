import Phaser from 'phaser'
import { LEVELS } from '../data/levels'
import { MONSTERS } from '../data/monsters'
import { audio } from '../audio/audio-engine'
import type { MonsterDef } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { renderMonsterCard, textureMonstre } from './monster-card'
import { INTRO, INTRO_ROW } from './level-intro-layout'
import { RAYON_INFO, grilleMonstres } from './intro-grille-layout'

// Écran de présentation d'un NOUVEAU terrain : montré une seule fois par levelId (la première
// entrée), il présente les monstres du niveau AVANT de lancer le jeu. Reçoit les mêmes données que la
// scène 'Level' et les lui transmet à l'identique.
//
// ⚠️ UNE GRILLE DE VIGNETTES, ET LA FICHE DERRIÈRE UN « i ». Demande du user : « des images juste de
// tous les monstres + leur niveau et si élite ou pas, et juste un petit "i" à côté avec la sous-page
// dédiée ».
//
// Cet écran a déjà été une grille, et elle a échoué : elle entassait pour CHAQUE monstre image + nom +
// butin + compétences, et sur quatre espèces les cartes tombaient à 90 px de large (« là ça déborde
// complet »). On était donc passé à une fiche par page, avec navigation ‹ ›. La grille revient parce que
// son CONTENU a changé : quatre informations minuscules par monstre, et tout le détail derrière le « i ».
// Ce n'est pas un retour en arrière — c'est ce qui rend la grille tenable.
//
// La fiche détaillée reste EXACTEMENT la même (scenes/monster-card.ts, partagée avec le bestiaire) :
// les deux écrans ne peuvent pas diverger, et sa géométrie est vérifiée par un test sur le vrai roster.
// La grille l'est aussi, par tests/scenes/intro-grille.test.ts — sur le roster réel, terrain par terrain.
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
  /** index du monstre dont la fiche est ouverte ; null = on est sur la grille */
  private fiche: number | null = null

  constructor() { super('LevelIntro') }

  init(data: IntroData) {
    this.intro = data
    this.fiche = null
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
    } else if (this.fiche === null) {
      this.grille()
    } else {
      // fiche détaillée d'UN monstre — celle du bestiaire, à l'identique. Pas de compteur de victoires
      // ici (il vaut 0 par définition sur un terrain jamais joué).
      renderMonsterCard(this, this.monsters[this.fiche]!)
      this.rowBtn(INTRO_ROW.prev.x, '◀ Retour', 0x37474f, () => { this.fiche = null; this.render() })
    }

    this.retourCarte()
    this.startButton()
  }

  /**
   * La grille : une vignette par monstre, son niveau, son statut d'élite, et un « i » vers sa fiche.
   *
   * ⚠️ LA VIGNETTE PASSE PAR `textureMonstre`, pas par `m.tex`. Les variantes (Scorpionnet, Gobelinou,
   * tous les géants) n'ont pas d'art propre : elles réutilisent celui de leur base via `artFrom`. Lire
   * la texture en direct laissait ces monstres SANS IMAGE — c'est le bug du Scorpionnet, et la fonction
   * partagée existe précisément pour qu'il ne puisse pas revenir par une autre porte.
   */
  private grille() {
    const cells = grilleMonstres(this.monsters.length)
    this.monsters.forEach((m, i) => {
      const c = cells[i]!
      const elite = !!m.mvp || !!m.boss
      // cadre : bordure dorée pour un élite ou un boss — l'information « si élite ou pas » se lit d'un
      // coup d'œil, avant même le libellé.
      this.add.rectangle(c.x, c.y, c.taille, c.taille, 0x1c2431, 1)
        .setStrokeStyle(elite ? 3 : 2, elite ? 0xffd54f : 0x37474f)
      const tex = textureMonstre(this, m)
      if (this.textures.exists(tex)) {
        const img = this.add.image(c.x, c.y, tex)
        const src = this.textures.get(tex).getSourceImage()
        const k = Math.min((c.taille - 14) / src.width, (c.taille - 14) / src.height)
        img.setScale(k)
      } else {
        this.add.circle(c.x, c.y, c.taille * 0.3, m.color ?? 0x90a4ae)
      }
      // niveau + nom, sous la vignette
      this.add.text(c.x, c.niveauY, `Nv ${m.level}`, {
        fontSize: '15px', color: elite ? '#ffd54f' : '#eceff1', fontStyle: 'bold',
      }).setOrigin(0.5, 0)
      this.add.text(c.x, c.niveauY + 17, m.name, { fontSize: '11px', color: '#90a4ae' })
        .setOrigin(0.5, 0).setWordWrapWidth(c.taille + 16)
      if (elite) {
        this.add.text(c.x, c.y - c.taille / 2 + 2, m.boss ? 'BOSS' : 'ÉLITE', {
          fontSize: '11px', color: '#1c2431', backgroundColor: '#ffd54f',
          fontStyle: 'bold', padding: { x: 5, y: 1 },
        }).setOrigin(0.5, 0)
      }
      // le « i » : cercle discret en haut à droite de la vignette, zone tactile généreuse
      const info = this.add.circle(c.infoX, c.infoY, RAYON_INFO, 0x263238).setStrokeStyle(2, 0x80cbc4)
      this.add.text(c.infoX, c.infoY, 'i', { fontSize: '15px', color: '#80cbc4', fontStyle: 'bold' }).setOrigin(0.5)
      info.setInteractive(new Phaser.Geom.Circle(RAYON_INFO, RAYON_INFO, RAYON_INFO + 8), Phaser.Geom.Circle.Contains)
      info.on('pointerdown', () => { this.fiche = i; this.render() })
    })
  }

  private rowBtn(x: number, label: string, bg: number, onTap: () => void) {
    return this.add.text(x, INTRO.navY, label, {
      fontSize: '16px', color: '#ffffff', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`, padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  }

  /**
   * Bouton « ← Carte » : on repart sans lancer le terrain.
   *
   * ⚠️ ON NE MARQUE PAS LE NIVEAU COMME VU. `markLevelSeen` appartient à « Commencer ! » : cet écran
   * s'affiche une fois, à la découverte, et repartir sans jouer ne doit pas consommer cette
   * découverte — sinon on ne reverrait jamais le bestiaire du terrain qu'on a justement voulu regarder.
   */
  private retourCarte() {
    this.rowBtn(INTRO_ROW.retour.x, '← Carte', 0x455a64, () => {
      audio.playSfx('ui-tap')
      this.scene.start('WorldMap')
    })
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
