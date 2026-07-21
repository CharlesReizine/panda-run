import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf, SKILLS } from '../data/skills'
import { MAX_SKILL_RANK } from '../core/player-state'
import { computeStats } from '../core/stats'
import { energyCostOf } from '../core/skill-executor'
import { EVOLUTIONS } from '../core/progression'
import { CLASSES } from '../data/classes'
import type { ClassId, SkillDef } from '../core/types'

// Gestion des compétences DIRECTEMENT en jeu (pas besoin de la carte).
// Lancée par-dessus le niveau en pause ; à la fermeture, on reprend le jeu.
export class SkillEquipScene extends Phaser.Scene {
  private tab: ClassId | null = null
  // scène de jeu à reprendre à la fermeture ('Level' en partie, 'Training' en entraînement) et mode
  // entraînement : en training on NE persiste PAS les changements (sinon on écraserait la vraie
  // sauvegarde avec le perso temporaire) — les swaps restent en mémoire, le temps de tester.
  private levelKey = 'Level'
  private training = false

  constructor() { super('SkillEquip') }

  init(data?: { levelKey?: string; training?: boolean }) {
    this.levelKey = data?.levelKey ?? 'Level'
    this.training = !!data?.training
  }

  create() {
    this.tab = null
    this.render()
  }

  private close() {
    this.scene.resume(this.levelKey)
    this.scene.resume('UI')
    this.game.events.emit('hud-refresh')
    this.scene.stop('SkillEquip')
  }

  // persiste la fiche joueur — sauf en entraînement (perso temporaire, ne doit pas toucher le disque)
  private persist(p: ReturnType<typeof getPlayer>) {
    if (!this.training) save(p)
  }

  // Lignée de la classe : novice → classe de base → classe évoluée.
  // Si le joueur est déjà évolué, on retrouve la classe de base en inversant EVOLUTIONS.
  private lineageTabs(classId: ClassId): ClassId[] {
    const tabs: ClassId[] = ['novice']
    let baseClass: ClassId | undefined
    let evolvedClass: ClassId | undefined
    if (classId === 'novice') {
      // rien de plus
    } else if (classId in EVOLUTIONS) {
      baseClass = classId
      evolvedClass = EVOLUTIONS[classId]
    } else {
      baseClass = (Object.keys(EVOLUTIONS) as ClassId[]).find((k) => EVOLUTIONS[k] === classId)
      evolvedClass = classId
    }
    if (baseClass) tabs.push(baseClass)
    if (evolvedClass) tabs.push(evolvedClass)
    // n'afficher qu'un onglet qui possède des skills
    return tabs.filter((id) => skillsOf(id).length > 0)
  }

  // Verrou d'arbre : un skill est débloquable/améliorable si le niveau est atteint et le prérequis appris.
  private lockReason(p: ReturnType<typeof getPlayer>, s: SkillDef): string | null {
    const minLevel = s.minLevel ?? 1
    if (p.level < minLevel) return `Niveau ${minLevel} requis`
    if (s.requires && (p.skillLevels[s.requires] ?? 0) <= 0) {
      const req = SKILLS[s.requires]
      return `Nécessite : ${req ? req.name : s.requires}`
    }
    return null
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    const p = getPlayer()
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a, 0.96)
    this.add.text(480, 16, 'Compétences', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 36, `Points à dépenser : ${p.skillPoints}`, { fontSize: '14px', color: '#ffd54f' }).setOrigin(0.5)
    // Légende de l'arbre : « ↳ » marque une compétence enfant (débloque son parent d'abord) ; les cartes
    // verrouillées sont grisées et affichent la raison (niveau ou prérequis manquant).
    this.add.text(480, 51, 'Arbre — ↳ = requiert la compétence parente · carte grisée = verrouillée (raison affichée)', { fontSize: '10px', color: '#78909c' }).setOrigin(0.5)

    const btn = (x: number, y: number, label: string, bg: number, onTap: () => void) =>
      this.add.text(x, y, label, { fontSize: '13px', color: '#ffffff', backgroundColor: `#${bg.toString(16)}`, padding: { x: 8, y: 4 } })
        .setOrigin(0.5).setInteractive().on('pointerdown', onTap)

    // Onglets de lignée — Novice / classe de base / classe évoluée. Défaut = classe actuelle.
    const tabs = this.lineageTabs(p.classId)
    if (!this.tab || !tabs.includes(this.tab)) this.tab = tabs.includes(p.classId) ? p.classId : tabs[0]!
    const tabW = 150
    const tabsWidth = tabs.length * tabW
    tabs.forEach((id, i) => {
      const x = 480 - tabsWidth / 2 + tabW / 2 + i * tabW
      const active = id === this.tab
      this.add.rectangle(x, 68, tabW - 8, 26, active ? 0x33691e : 0x000000, active ? 0.9 : 0.4)
        .setStrokeStyle(1, active ? 0x80cbc4 : 0xffffff, active ? 0.9 : 0.25)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.tab = id; this.render() })
      this.add.text(x, 68, CLASSES[id].name, { fontSize: '13px', color: active ? '#ffffff' : '#90a4ae', fontStyle: active ? 'bold' : 'normal' }).setOrigin(0.5)
    })

    // Rangée des 4 slots équipés (tap = retirer) — icônes agrandies, cases surlignées quand pleines
    this.add.text(480, 92, 'Équipé (tape pour retirer)', { fontSize: '12px', color: '#b0bec5' }).setOrigin(0.5)
    for (let i = 0; i < 4; i++) {
      const x = 360 + i * 80
      const sid = p.equippedSkills[i]
      this.add.rectangle(x, 132, 60, 60, 0x000000, 0.5).setStrokeStyle(2, sid ? 0xffd54f : 0xffffff, sid ? 0.9 : 0.5)
      this.add.text(x, 108, `${i + 1}`, { fontSize: '12px', color: '#ffd54f' }).setOrigin(0.5)
      if (sid) {
        this.add.image(x, 134, `skill-${sid}`).setDisplaySize(48, 48)
          .setInteractive().on('pointerdown', () => { p.equippedSkills[i] = null; this.persist(p); this.render() })
      }
    }

    // Grille des compétences de l'onglet actif — colonnes selon le nombre de skills.
    const skills = skillsOf(this.tab)
    const columns = skills.length > 6 ? 3 : skills.length > 1 ? 2 : 1
    const colW = columns === 3 ? 293 : columns === 2 ? 440 : 860
    const colX = columns === 3 ? [26, 333, 640] : columns === 2 ? [50, 500] : [50]
    const rowH = 76
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
      const lock = unlocked ? null : this.lockReason(p, s)
      const locked = lock !== null
      const dim = !unlocked

      this.add.rectangle(x, y, colW, cardH, 0x000000, equipped ? 0.55 : locked ? 0.22 : 0.32).setOrigin(0, 0)
        .setStrokeStyle(1, equipped ? 0x80cbc4 : 0xffffff, equipped ? 0.8 : 0.22)

      const icon = this.add.image(x + 34, y + cardH / 2, `skill-${s.id}`).setDisplaySize(44, 44)
      if (dim) icon.setAlpha(locked ? 0.28 : 0.4)
      // Tap sur l'icône = ouvre la fiche de détail
      icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(s))

      // Aperçu = NOM (préfixe ↳ pour un enfant d'arbre) + état. Description dans la fiche détail.
      const nameColor = unlocked ? '#ffffff' : locked ? '#607d8b' : '#b0bec5'
      const childMark = s.requires ? '↳ ' : ''
      this.add.text(x + 62, y + 5, childMark + s.name, { fontSize: '13px', color: nameColor, fontStyle: 'bold', wordWrap: { width: colW - 150 }, lineSpacing: -3 })
      // Ligne d'arbre PERSISTANTE : prérequis (parent) + niveau requis, en vert si rempli, rouge sinon.
      const treeBits: string[] = []
      if (s.requires) { const req = SKILLS[s.requires]; treeBits.push(req ? req.name : s.requires) }
      if ((s.minLevel ?? 1) > 1) treeBits.push(`Nv ${s.minLevel}`)
      if (treeBits.length) {
        const reqMet = !this.lockReason(p, s)
        this.add.text(x + 62, y + 29, `requiert : ${treeBits.join(' · ')}${reqMet ? ' ✓' : ''}`, { fontSize: '10px', color: reqMet ? '#81c784' : '#ef9a9a', wordWrap: { width: colW - 96 } })
      }
      const stateTxt = unlocked ? `Nv ${rank}/${MAX_SKILL_RANK}` : locked ? `🔒 ${lock!}` : 'À débloquer'
      const stateColor = unlocked ? '#ffd54f' : locked ? '#ef9a9a' : '#90caf9'
      this.add.text(x + 62, y + 46, stateTxt, { fontSize: '11px', color: stateColor })

      // Bouton info (fiche de détail) — discret, à droite de l'icône
      this.add.text(x + 46, y + cardH / 2 + 14, 'ℹ', { fontSize: '13px', color: '#4fc3f7', backgroundColor: '#0b2536', padding: { x: 4, y: 1 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(s))

      // Débloquer / +1 : masqué si verrouillé par l'arbre.
      if (!locked && p.skillPoints > 0 && rank < MAX_SKILL_RANK) {
        btn(x + colW - 54, y + 16, unlocked ? '+1 pt' : 'Débloquer', 0x8d6e00, () => {
          p.skillPoints--; p.skillLevels[s.id] = rank + 1; this.persist(p); this.render()
        })
      }
      // Les passifs ne s'équipent JAMAIS : appris = actif en permanence (via computeStats), hors des 4 slots.
      if (s.kind === 'passive') {
        if (unlocked) this.add.text(x + colW - 54, y + 44, 'Passif actif ✓', { fontSize: '11px', color: '#ce93d8' }).setOrigin(0.5)
      } else if (unlocked && !equipped) {
        btn(x + colW - 54, y + 44, 'Équiper', 0x33691e, () => {
          const free = p.equippedSkills.indexOf(null)
          p.equippedSkills[free >= 0 ? free : 3] = s.id; this.persist(p); this.render()
        })
      } else if (equipped) {
        this.add.text(x + colW - 54, y + 44, 'Équipé ✓', { fontSize: '12px', color: '#80cbc4' }).setOrigin(0.5)
      }
    })

    btn(480, 508, 'Reprendre ▶', 0x33691e, () => this.close())
  }

  private kindLabel(s: SkillDef): string {
    const base = s.kind === 'melee' ? 'Mêlée'
      : s.kind === 'projectile' ? 'Projectile'
      : s.kind === 'aoe' ? 'Zone'
      : s.kind === 'charge' ? 'Charge'
      : s.kind === 'dive' ? 'Plongeon'
      : s.kind === 'buff' ? 'Amélioration'
      : s.kind === 'zone' ? 'Zone visée'
      : s.kind === 'trap' ? 'Piège'
      : s.kind === 'lightning' ? 'Foudre'
      : s.kind === 'passive' ? 'Passif'
      : 'Soin'
    const tags: string[] = []
    if (s.pierce) tags.push('perçant')
    if (s.arc) tags.push('en cloche')
    if (s.burn) tags.push('brûlure')
    if (s.explode) tags.push('explosif')
    if (s.arrows && s.arrows > 1) tags.push(`${s.arrows} flèches`)
    return tags.length ? `${base} (${tags.join(', ')})` : base
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
    let y = 62

    panel.add(this.add.image(480, y + 16, `skill-${s.id}`).setDisplaySize(48, 48))
    y += 48
    panel.add(this.add.text(480, y, s.name, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5))
    y += 24
    panel.add(this.add.text(480, y, this.kindLabel(s), { fontSize: '13px', color: '#4fc3f7' }).setOrigin(0.5))
    y += 30

    // Description « lore » du skill
    panel.add(this.add.text(left, y, s.description, { fontSize: '13px', color: '#cfd8dc', wordWrap: { width: 500 } }).setOrigin(0, 0))
    y += 46

    const rankTxt = rank > 0 ? `Nv ${rank}/${MAX_SKILL_RANK}` : 'Non débloquée (aperçu au Nv 1)'
    panel.add(this.add.text(left, y, rankTxt, { fontSize: '13px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0, 0))
    y += 24

    if (s.kind === 'passive') {
      const parts: string[] = []
      if (s.passive?.atk) parts.push(`+${s.passive.atk} ATK`)
      if (s.passive?.maxHp) parts.push(`+${s.passive.maxHp} PV max`)
      if (s.passive?.def) parts.push(`+${s.passive.def} DÉF`)
      if (s.passive?.attackSpeed) parts.push(`+${s.passive.attackSpeed} vit. att.`)
      if (s.passive?.hpRegenPerSec) parts.push(`+${s.passive.hpRegenPerSec} PV/s régén`)
      panel.add(this.add.text(left, y, 'Passif — toujours actif une fois appris (hors slots)', { fontSize: '13px', color: '#ce93d8' }).setOrigin(0, 0))
      y += 20
      panel.add(this.add.text(left, y, `Bonus par rang : ${parts.join('   ') || '—'}${rank > 0 ? `   (rang ${rank})` : ''}`, { fontSize: '13px', color: '#e1bee7', fontStyle: 'bold' }).setOrigin(0, 0))
    } else if (s.kind === 'heal') {
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
    y += 26

    if (s.buff) {
      panel.add(this.add.text(left, y, `Buff : ATK ×${s.buff.atkMult} pendant ${(s.buff.durationMs / 1000).toFixed(0)} s`, { fontSize: '13px', color: '#fff59d' }).setOrigin(0, 0))
      y += 22
    }

    panel.add(this.add.text(left, y, `Portée : ${s.range} px    Recharge : ${(s.cooldownMs / 1000).toFixed(1)} s    Énergie : ${energyCostOf(s)}`, { fontSize: '12px', color: '#90caf9' }).setOrigin(0, 0))
    y += 30

    // Condition de déblocage (arbre) si présente
    if (s.minLevel !== undefined || s.requires !== undefined) {
      const parts: string[] = []
      if (s.minLevel !== undefined) parts.push(`Niveau ${s.minLevel}`)
      if (s.requires !== undefined) { const req = SKILLS[s.requires]; parts.push(`Prérequis : ${req ? req.name : s.requires}`) }
      const lock = this.lockReason(p, s)
      const color = lock ? '#ef9a9a' : '#a5d6a7'
      panel.add(this.add.text(left, y, `Déblocage — ${parts.join('   ')}${lock ? '' : ' ✓'}`, { fontSize: '12px', color, wordWrap: { width: 500 } }).setOrigin(0, 0))
      y += 26
    }

    panel.add(this.add.text(left, y, 'Comment l\'utiliser', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0))
    y += 20
    const howto = s.kind === 'passive'
      ? 'Débloque-la avec un point de compétence : son bonus s\'applique alors en permanence, sans occuper de slot.'
      : 'Équipe-la dans un slot 1-4, puis touche l\'icône du slot ou la touche 1-4 en jeu.'
    panel.add(this.add.text(left, y, howto, { fontSize: '12px', color: '#b0bec5', wordWrap: { width: 500 } }).setOrigin(0, 0))

    const closeBtn = this.add.text(480, 470, 'Fermer', { fontSize: '14px', color: '#ffffff', backgroundColor: '#455a64', padding: { x: 14, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => panel.destroy())
    panel.add(closeBtn)
    // La croix en haut à droite ferme aussi
    const cross = this.add.text(742, 46, '✕', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => panel.destroy())
    panel.add(cross)
  }
}
