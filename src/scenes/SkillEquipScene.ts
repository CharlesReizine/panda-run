import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf, SKILLS } from '../data/skills'
import { MAX_SKILL_RANK } from '../core/player-state'
import { computeStats } from '../core/stats'
import { energyCostOf } from '../core/skill-executor'
import type { SkillDef } from '../core/types'

// Gestion des compétences DIRECTEMENT en jeu (pas besoin de la carte).
// Lancée par-dessus le niveau en pause ; à la fermeture, on reprend le jeu.
export class SkillEquipScene extends Phaser.Scene {
  constructor() { super('SkillEquip') }

  create() {
    this.render()
  }

  private close() {
    this.scene.resume('Level')
    this.scene.resume('UI')
    this.game.events.emit('hud-refresh')
    this.scene.stop('SkillEquip')
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    const p = getPlayer()
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a, 0.96)
    this.add.text(480, 20, 'Compétences', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 48, `Points à dépenser : ${p.skillPoints}`, { fontSize: '15px', color: '#ffd54f' }).setOrigin(0.5)

    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '13px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 8, y: 4 } })
        .setOrigin(0.5).setInteractive().on('pointerdown', onTap)

    // Rangée des 4 slots équipés (tap = retirer) — icônes agrandies, cases surlignées quand pleines
    this.add.text(480, 74, 'Équipé (tape pour retirer)', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = 360 + i * 80
      const sid = p.equippedSkills[i]
      this.add.rectangle(x, 116, 68, 68, 0x000000, 0.5).setStrokeStyle(2, sid ? 0xffd54f : 0xffffff, sid ? 0.9 : 0.5)
      this.add.text(x, 88, `${i + 1}`, { fontSize: '12px', color: '#ffd54f' }).setOrigin(0.5)
      if (sid) {
        this.add.image(x, 116, `skill-${sid}`).setDisplaySize(56, 56)
          .setInteractive().on('pointerdown', () => { p.equippedSkills[i] = null; save(p); this.render() })
      }
    }

    // Grille des compétences de la classe — 2 colonnes dès que ça ne tient plus en 1
    this.add.text(480, 168, 'Compétences de la classe', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)
    // liste = skills de la classe actuelle + skills NOVICE + tout skill déjà appris (skillLevels>0)
    // → on ne perd JAMAIS un skill développé (novice, ou classe pré-évolution). Dédup par id.
    const shown = new Map<string, SkillDef>()
    for (const s of skillsOf(p.classId)) shown.set(s.id, s)
    for (const s of skillsOf('novice')) shown.set(s.id, s)
    for (const id of Object.keys(p.skillLevels)) { const s = SKILLS[id]; if (s && (p.skillLevels[id] ?? 0) > 0) shown.set(id, s) }
    const skills = [...shown.values()]
    const columns = skills.length > 6 ? 3 : skills.length > 3 ? 2 : 1
    const colW = columns === 3 ? 293 : columns === 2 ? 440 : 860
    const colX = columns === 3 ? [26, 333, 640] : columns === 2 ? [50, 500] : [50]
    const rowH = 78
    const gridTop = 184

    skills.forEach((s, i) => {
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = colX[col]!
      const y = gridTop + row * rowH
      const cardH = rowH - 8

      const rank = p.skillLevels[s.id] ?? 0
      const unlocked = rank > 0
      const equipped = p.equippedSkills.includes(s.id)

      this.add.rectangle(x, y, colW, cardH, 0x000000, equipped ? 0.55 : 0.32).setOrigin(0, 0)
        .setStrokeStyle(1, equipped ? 0x80cbc4 : 0xffffff, equipped ? 0.8 : 0.22)

      const icon = this.add.image(x + 34, y + cardH / 2, `skill-${s.id}`).setDisplaySize(46, 46)
      if (!unlocked) icon.setAlpha(0.35)
      // Tap sur l'icône = ouvre la fiche de détail
      icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(s))

      const rankTxt = unlocked ? `Nv ${rank}/${MAX_SKILL_RANK}` : 'Verrouillé'
      this.add.text(x + 64, y + 6, s.name, { fontSize: '13px', color: unlocked ? '#ffffff' : '#78909c', fontStyle: 'bold' })
      this.add.text(x + 64, y + 24, rankTxt, { fontSize: '11px', color: unlocked ? '#ffd54f' : '#607d8b' })
      // Phrase de description du skill, sous le nom, en gris clair (wordWrap pour ne pas déborder)
      this.add.text(x + 64, y + 40, s.description, { fontSize: '10px', color: '#b0bec5', wordWrap: { width: colW - 178 }, lineSpacing: -1 })

      // Bouton info (fiche de détail) — discret, à droite de l'icône
      this.add.text(x + 46, y + cardH / 2 + 12, 'ℹ', { fontSize: '13px', color: '#4fc3f7', backgroundColor: '#0b2536', padding: { x: 4, y: 1 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(s))

      if (p.skillPoints > 0 && rank < MAX_SKILL_RANK) {
        btn(x + colW - 74, y + 17, unlocked ? '+1 pt' : 'Débloquer', 0x8d6e00, () => {
          p.skillPoints--; p.skillLevels[s.id] = rank + 1; save(p); this.render()
        })
      }
      if (unlocked && !equipped) {
        btn(x + colW - 74, y + 45, 'Équiper', 0x33691e, () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id; save(p); this.render()
        })
      } else if (equipped) {
        this.add.text(x + colW - 74, y + 45, 'Équipé ✓', { fontSize: '12px', color: '#80cbc4' }).setOrigin(0.5)
      }
    })

    btn(480, 505, 'Reprendre ▶', 0x33691e, () => this.close())
  }

  private kindLabel(s: SkillDef): string {
    const base = s.kind === 'melee' ? 'Mêlée'
      : s.kind === 'projectile' ? 'Projectile'
      : s.kind === 'aoe' ? 'Zone'
      : 'Soin'
    const tags: string[] = []
    if (s.pierce) tags.push('perçant')
    if (s.arc) tags.push('en cloche')
    return tags.length ? `${base} (${tags.join(', ')})` : base
  }

  private effectText(s: SkillDef): string {
    if (s.kind === 'heal') return 'Rend des PV instantanément.'
    if (s.kind === 'melee') return 'Frappe les ennemis devant vous.'
    if (s.kind === 'aoe') return 'Touche tout autour de vous.'
    // projectile
    let t = 'Tir à distance.'
    if (s.pierce) t += ' Traverse tous les ennemis.'
    if (s.arc) t += ' Trajectoire en cloche (soumise à la gravité).'
    return t
  }

  private showDetail(s: SkillDef) {
    const p = getPlayer()
    const rank = p.skillLevels[s.id] ?? 0
    const effRank = Math.max(1, rank)
    const rankMult = 1 + 0.25 * (effRank - 1)
    const stats = computeStats(p)

    const panel = this.add.container(0, 0).setDepth(1000)
    // Fond opaque qui bloque les clics vers l'écran dessous
    const backdrop = this.add.rectangle(480, 270, 960, 540, 0x000000, 0.72).setInteractive()
    const card = this.add.rectangle(480, 270, 560, 470, 0x102a3a, 0.99).setStrokeStyle(2, 0x4fc3f7, 0.9)
    panel.add([backdrop, card])

    const left = 230
    let y = 70

    panel.add(this.add.image(480, y + 18, `skill-${s.id}`).setDisplaySize(52, 52))
    y += 52
    panel.add(this.add.text(480, y, s.name, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
    y += 24
    panel.add(this.add.text(480, y, this.kindLabel(s), { fontSize: '13px', color: '#4fc3f7' }).setOrigin(0.5))
    y += 30

    panel.add(this.add.text(left, y, this.effectText(s), { fontSize: '13px', color: '#cfd8dc', wordWrap: { width: 500 } }).setOrigin(0, 0))
    y += 44

    const rankTxt = rank > 0 ? `Nv ${rank}/${MAX_SKILL_RANK}` : `Verrouillé (aperçu au Nv 1)`
    panel.add(this.add.text(left, y, rankTxt, { fontSize: '13px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0, 0))
    y += 24

    if (s.kind === 'heal') {
      const heal = Math.round(stats.maxHp * s.multiplier * rankMult)
      panel.add(this.add.text(left, y, `Soin : ${Math.round(s.multiplier * 100)}% des PV max`, { fontSize: '13px', color: '#a5d6a7' }).setOrigin(0, 0))
      y += 20
      panel.add(this.add.text(left, y, `PV rendus (rang courant) : ~${heal}`, { fontSize: '13px', color: '#a5d6a7', fontStyle: 'bold' }).setOrigin(0, 0))
    } else {
      const dmg = Math.round(stats.atk * s.multiplier * rankMult)
      panel.add(this.add.text(left, y, `Multiplicateur de base : ×${s.multiplier}`, { fontSize: '13px', color: '#ffab91' }).setOrigin(0, 0))
      y += 20
      panel.add(this.add.text(left, y, `Dégâts estimés (rang courant) : ~${dmg}`, { fontSize: '13px', color: '#ffab91', fontStyle: 'bold' }).setOrigin(0, 0))
    }
    y += 30

    panel.add(this.add.text(left, y, `Portée : ${s.range} px    Recharge : ${(s.cooldownMs / 1000).toFixed(1)} s    Énergie : ${energyCostOf(s)}`, { fontSize: '12px', color: '#90caf9' }).setOrigin(0, 0))
    y += 34

    panel.add(this.add.text(left, y, 'Comment l\'utiliser', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0))
    y += 20
    panel.add(this.add.text(left, y, 'Équipe-la dans un slot 1-4, puis touche l\'icône du slot ou la touche 1-4 en jeu.', { fontSize: '12px', color: '#b0bec5', wordWrap: { width: 500 } }).setOrigin(0, 0))

    const closeBtn = this.add.text(480, 470, 'Fermer', { fontSize: '14px', color: '#ffffff', backgroundColor: '#455a64', padding: { x: 14, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => panel.destroy())
    panel.add(closeBtn)
    // La croix en haut à droite ferme aussi
    const cross = this.add.text(742, 46, '✕', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => panel.destroy())
    panel.add(cross)
  }
}
