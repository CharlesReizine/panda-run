import Phaser from 'phaser'
import { MONSTERS } from '../data/monsters'
import { getPlayer } from '../state'
import type { MonsterDef } from '../core/types'
import { renderMonsterCard, monsterKind, css, SILHOUETTE_TINT, textureMonstre } from './monster-card'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'

// Bestiaire — page en lecture seule listant tous les monstres, leurs stats et leur table de drop.
// Aucune écriture dans la sauvegarde ni dans les données du jeu.
const MONSTER_LIST: MonsterDef[] = Object.values(MONSTERS)

const PER_PAGE = 24 // 6 colonnes × 4 rangées
const COLS = 6
const ROWS = 4

export class BestiaryScene extends Phaser.Scene {
  private page = 0
  private kills: Record<string, number> = {}

  constructor() { super('Bestiary') }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    // lecture seule du suivi de kills ; robuste si aucun joueur n'est chargé
    try { this.kills = getPlayer().killsByMonster ?? {} } catch { this.kills = {} }
    this.renderList()
  }

  // Un monstre est « découvert » (révélé) dès qu'il a été tué au moins une fois.
  private discovered(m: MonsterDef): boolean {
    return (this.kills[m.id] ?? 0) > 0
  }

  private clear() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.97)
  }

  private btn(x: number, y: number, label: string, bg: number, onTap: () => void) {
    return this.add.text(x, y, label, { fontSize: '16px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 12, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  }

  private badge(x: number, y: number, m: MonsterDef, fontSize: string) {
    // monstre non découvert : badge neutre masqué (ne révèle pas boss/élite)
    if (!this.discovered(m)) {
      return this.add.text(x, y, '???', { fontSize, color: '#cfd8dc', backgroundColor: css(0x455a64), fontStyle: 'bold', padding: { x: 5, y: 2 } })
        .setOrigin(0.5)
    }
    const { label, color } = monsterKind(m)
    return this.add.text(x, y, label, { fontSize, color: '#0d1b2a', backgroundColor: css(color), fontStyle: 'bold', padding: { x: 5, y: 2 } })
      .setOrigin(0.5)
  }

  private renderList() {
    this.clear()
    const pages = Math.ceil(MONSTER_LIST.length / PER_PAGE)
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1)

    this.add.text(480, 24, 'Bestiaire', { fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 52, `${MONSTER_LIST.length} monstres — tape un monstre pour son butin`, { fontSize: '13px', color: '#b0bec5' }).setOrigin(0.5)

    const start = this.page * PER_PAGE
    const slice = MONSTER_LIST.slice(start, start + PER_PAGE)
    const cellW = 150
    const cellH = 96
    const gridLeft = 105
    const gridTop = 108

    slice.forEach((m, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const cx = gridLeft + col * cellW
      const cy = gridTop + row * cellH

      const seen = this.discovered(m)
      this.add.rectangle(cx, cy, cellW - 8, cellH - 8, 0x000000, 0.3).setStrokeStyle(1, 0xffffff, 0.15)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.renderDetail(m))
      const sprite = this.add.image(cx, cy - 18, textureMonstre(this, m)).setDisplaySize(40, 40)
      if (!seen) sprite.setTint(SILHOUETTE_TINT).setAlpha(0.85) // silhouette sombre tant que pas tué
      this.add.text(cx, cy + 18, seen ? m.name : '???', { fontSize: '12px', color: seen ? '#ffffff' : '#78909c', align: 'center', wordWrap: { width: cellW - 14 } }).setOrigin(0.5, 0)
      this.badge(cx, cy - 40, m, '10px')
    })

    // Navigation de page
    if (pages > 1) {
      if (this.page > 0) this.btn(360, 508, '◀ Préc.', 0x37474f, () => { this.page--; this.renderList() })
      this.add.text(480, 508, `Page ${this.page + 1}/${pages}`, { fontSize: '14px', color: '#b0bec5' }).setOrigin(0.5)
      if (this.page < pages - 1) this.btn(600, 508, 'Suiv. ▶', 0x37474f, () => { this.page++; this.renderList() })
    }

    this.btn(60, 24, '✕ Fermer', 0x8e2f2f, () => this.scene.start('Menu'))
  }

  private renderDetail(m: MonsterDef) {
    this.clear()
    // ⚠️ RENDU PARTAGÉ AVEC L'ÉCRAN DE DÉBUT DE TERRAIN (scenes/monster-card.ts). Il existait deux
    // rendus de fiche monstre, et ils ont divergé deux fois : icônes de butin d'abord (des « vieux
    // cercles de couleurs » d'un côté, les vraies images de l'autre), puis la mise en page entière
    // (l'écran de début de terrain débordait). Un seul rendu, une seule géométrie testée.
    renderMonsterCard(this, m, { seen: this.discovered(m), kills: this.kills[m.id] ?? 0 })

    this.btn(360, 512, '◀ Retour', 0x37474f, () => this.renderList())
    this.btn(600, 512, '✕ Fermer', 0x8e2f2f, () => this.scene.start('Menu'))
  }
}
