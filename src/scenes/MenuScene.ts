import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { MATERIALS } from '../data/materials'
import { computeStats } from '../core/stats'
import { STAT_POINTS_PER_LEVEL } from '../core/progression'
import { STATS, pourcentages, type StatId } from '../core/repartition'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { MENU, statsBox, materialsBox, materialRowsPerCol, splitMaterials, materialsBottom } from './menu-layout'

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu') }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    this.render()
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x1b2631, 0.95)
    const p = getPlayer()
    const stats = computeStats(p)

    // ── EN-TÊTE ──
    this.add.text(MENU.left, 20, `${p.name} — Nv ${p.level}`, { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
    this.add.text(MENU.left, 50, `ATK ${stats.atk} · DÉF ${Math.round(stats.def)} · PV ${stats.maxHp} · VIT ${stats.attackSpeed.toFixed(2)}`,
      { fontSize: '15px', color: '#b0bec5' })

    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`, padding: { x: 8, y: 4 } })
        .setInteractive({ useHandCursor: true }).on('pointerdown', onTap)

    // ── COLONNE GAUCHE : répartition de stats ──
    // ⚠️ LA LISTE DES COMPÉTENCES A ÉTÉ RETIRÉE D'ICI, et c'est le correctif principal. Elle était
    // posée à `y = 110 + i * 50` sans aucune borne : avec les 15 sorts de l'archer la dernière ligne
    // tombait à y = 810 sur un écran haut de 540 — « le menu cata cata ». Elle faisait de surcroît
    // DOUBLON avec l'écran d'arbre de compétences, qui la présente bien mieux. Un bouton y mène.
    // ── COLONNE GAUCHE : un RENVOI vers la page Stat, plus la répartition elle-même ────────────
    //
    // ⚠️ LA RÉPARTITION A DÉMÉNAGÉ, ET C'EST LE CORRECTIF. Elle vivait ici, dans un coin d'un écran
    // qu'on n'ouvre qu'entre deux terrains — alors qu'on gagne des points EN JOUANT. « Là le menu est
    // inaccessible. » Elle a maintenant sa page, atteignable depuis la carte ET depuis le jeu (pastille
    // contre la barre de vie). Ce bloc n'en garde qu'un résumé et la porte d'entrée : deux endroits pour
    // faire la même chose, c'est deux endroits à tenir à jour et un joueur qui hésite.
    const sb = statsBox()
    this.add.text(sb.x, sb.y - 24, 'STATS', { fontSize: '17px', color: '#80cbc4', fontStyle: 'bold' })
    const aDesPoints = p.statPoints > 0
    this.add.text(sb.x + sb.w, sb.y - 24,
      aDesPoints ? `● ${p.statPoints} point${p.statPoints > 1 ? 's' : ''} à répartir` : `+${STAT_POINTS_PER_LEVEL} par niveau`,
      { fontSize: '13px', color: aDesPoints ? '#ffd700' : '#607d8b', fontStyle: 'bold' }).setOrigin(1, 0)

    const pct = pourcentages(p.allocated as Record<StatId, number>)
    STATS.forEach((st, i) => {
      const y = sb.y + 6 + i * 34
      this.add.rectangle(sb.x, y, sb.w, 30, 0x000000, 0.25).setOrigin(0, 0)
      this.add.rectangle(sb.x, y, 4, 30, st.couleur, 1).setOrigin(0, 0)
      this.add.text(sb.x + 14, y + 7, `${st.nom} ${(p.allocated as Record<StatId, number>)[st.id]}`,
        { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
      this.add.text(sb.x + sb.w - 12, y + 8, `${pct[st.id]} %`, { fontSize: '13px', color: '#78909c' }).setOrigin(1, 0)
    })
    const yBtn = sb.y + 6 + STATS.length * 34 + 14
    const ouvrir = this.add.text(sb.x + sb.w / 2, yBtn, aDesPoints ? '★ Répartir mes points' : 'Voir la répartition', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: aDesPoints ? '#8d6e00' : '#37474f', padding: { x: 14, y: 7 },
    }).setOrigin(0.5, 0)
    ouvrir.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Stats', { return: 'Menu' }))

    // ── COLONNE DROITE : matériaux, en grille BORNÉE ──
    const mb = materialsBox()
    this.add.text(mb.x, mb.y - 24, 'MATÉRIAUX', { fontSize: '17px', color: '#80cbc4', fontStyle: 'bold' })
    // « Le craft arrive bientôt… » était AFFICHÉ ICI alors que la forge existe en ville depuis
    // longtemps : le joueur cherchait donc une fonctionnalité qu'on lui disait absente.
    this.add.text(mb.x + mb.w, mb.y - 22, 'à la forge, en ville', { fontSize: '12px', color: '#78909c', fontStyle: 'italic' }).setOrigin(1, 0)
    const collected = Object.entries(p.materials).filter(([, count]) => count > 0)
    if (collected.length === 0) {
      this.add.text(mb.x, mb.y + 6, 'Aucun matériau pour l\'instant.\nLes monstres en laissent tomber.',
        { fontSize: '13px', color: '#78909c', fontStyle: 'italic', lineSpacing: 3 })
    } else {
      const { shown, hidden } = splitMaterials(collected)
      const perCol = materialRowsPerCol()
      const colW = mb.w / MENU.matCols
      shown.forEach(([id, count], i) => {
        const def = MATERIALS[id]
        const col = Math.floor(i / perCol), r = i % perCol
        const x = mb.x + col * colW
        const y = mb.y + 4 + r * MENU.rowH
        if (this.textures.exists(`material-${id}`)) {
          this.add.image(x + 8, y + 8, `material-${id}`).setDisplaySize(16, 16)
        }
        const color = def ? `#${def.color.toString(16).padStart(6, '0')}` : '#ffffff'
        this.add.text(x + 22, y, `${def ? def.name : id} ×${count}`, { fontSize: '13px', color })
      })
      if (hidden > 0) {
        this.add.text(mb.x, materialsBottom(collected.length), `+${hidden} autre${hidden > 1 ? 's' : ''}…`,
          { fontSize: '12px', color: '#78909c' })
      }
    }

    // ── RANGÉE DE BOUTONS ──
    const bigBtn = (x: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, 502, label, { fontSize: '17px', color: '#ffffff', fontStyle: 'bold', backgroundColor: `#${bg.toString(16).padStart(6, '0')}`, padding: { x: 14, y: 8 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onTap)

    // ⚠️ POSITIONS CALCULÉES, PAS DEVINÉES. Posés à 110/320/520/700/860, « Bestiaire » et
    // « Entraînement » se chevauchaient (leurs fonds fusionnaient en une seule barre) et le dernier
    // s'étendait jusqu'à ~985, hors de la zone 0→960. On répartit donc les 5 boutons à pas ÉGAL sur la
    // largeur utile : impossible de se chevaucher par construction, et rien ne peut sortir du cadre.
    const actions: [string, number, () => void][] = [
      ['← Retour', 0x33691e, () => this.scene.start('WorldMap')],
      // l'arbre de compétences REMPLACE la liste qui débordait ici
      ['✦ Compétences', 0x1565c0, () => this.scene.start('SkillEquip', { levelKey: 'Menu', standalone: true })],
      ['🎒 Inventaire', 0x37474f, () => this.scene.start('Inventory', { return: 'Menu' })],
      ['📜 Quêtes', 0x37474f, () => this.scene.start('QuestLog', { return: 'Menu' })],
      ['📖 Bestiaire', 0x37474f, () => this.scene.start('Bestiary')],
      ['⚔ Entraînement', 0x37474f, () => this.scene.start('Training')],
    ]
    const usable = MENU.right - MENU.left
    const step = usable / actions.length
    actions.forEach(([label, bg, onTap], i) => bigBtn(MENU.left + step * (i + 0.5), label, bg, onTap))
  }
}
