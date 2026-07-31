import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { skillsOf, SKILLS, maxRankOf, skillDamageMult } from '../data/skills'
import { computeStats } from '../core/stats'
import { energyCostOf } from '../core/skill-executor'
import { EVOLUTIONS } from '../core/progression'
import { CLASSES } from '../data/classes'
import type { ClassId, SkillDef } from '../core/types'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { layoutSkillTree } from './skill-tree-layout'

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
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
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
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.96)
    this.add.text(480, 16, 'Compétences', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(480, 36, `Points à dépenser : ${p.skillPoints}`, { fontSize: '14px', color: '#ffd54f' }).setOrigin(0.5)
    // Légende de l'arbre : « ↳ » marque une compétence enfant (débloque son parent d'abord) ; les cartes
    // verrouillées sont grisées et affichent la raison (niveau ou prérequis manquant).
    this.add.text(480, 51, 'Les flèches vont du prérequis vers ce qu\'il ouvre · un peu grisé = 1 condition manquante · très grisé = 2', { fontSize: '10px', color: '#78909c' }).setOrigin(0.5)

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

    // ───────── ARBRE DE COMPÉTENCES ─────────
    // Remplace l'ancienne GRILLE plate. Les dépendances existaient déjà dans les données
    // (SkillDef.requires) mais n'étaient qu'une mention textuelle « Nécessite : … » : on LISAIT la
    // structure au lieu de la VOIR, et rien ne montrait qu'un sort en débloque deux autres.
    // Géométrie déléguée à scenes/skill-tree-layout.ts (pure et testée) ; ici on ne fait que peindre.
    // Sens GAUCHE→DROITE (format paysage) : un prérequis est toujours à gauche de ce qu'il ouvre.
    const skills = skillsOf(this.tab)
    const tree = layoutSkillTree(skills)
    const byId = new Map(skills.map((sk) => [sk.id, sk]))

    const AREA_TOP = 166, AREA_BOT = 524
    const NODE_W = 176, NODE_H = 46
    const colGap = 40
    const rowH = 54
    const treeH = Math.max(1, tree.rows) * rowH
    const colW = NODE_W + colGap
    const totalW = Math.max(1, tree.tiers) * colW
    const x0 = Math.max(24, (VIEW_W - totalW) / 2)

    // Conteneur défilable : l'archer monte à 13 rangées, impossible à tenir dans 358 px. On masque
    // la zone et on fait glisser le contenu — plutôt que d'écraser les cartes jusqu'à l'illisible.
    const layer = this.add.container(0, 0)
    const maskShape = this.make.graphics({}, false)
    maskShape.fillRect(0, AREA_TOP, VIEW_W, AREA_BOT - AREA_TOP)
    layer.setMask(maskShape.createGeometryMask())

    const posOf = (n: { tier: number; row: number }) => ({
      x: x0 + n.tier * colW,
      y: AREA_TOP + 10 + n.row * rowH,
    })
    const nodePos = new Map(tree.nodes.map((n) => [n.id, posOf(n)]))

    // FLÈCHES de filiation, dessinées AVANT les cartes (donc dessous) : coude horizontal→vertical→
    // horizontal, façon arbre de talents, plus lisible qu'une diagonale quand plusieurs enfants
    // partent du même parent.
    const wires = this.add.graphics()
    layer.add(wires)
    for (const e of tree.edges) {
      const a = nodePos.get(e.from), b = nodePos.get(e.to)
      if (!a || !b) continue
      const childSkill = byId.get(e.to)
      const met = childSkill ? !this.lockReason(p, childSkill) : false
      // vert quand la filiation est REMPLIE (prérequis appris + niveau atteint), gris sinon : on voit
      // d'un coup d'œil quelles branches sont ouvertes
      wires.lineStyle(met ? 3 : 2, met ? 0x81c784 : 0x546e7a, met ? 0.95 : 0.5)
      const ax = a.x + NODE_W, ay = a.y + NODE_H / 2
      const bx = b.x, by = b.y + NODE_H / 2
      const mx = ax + colGap / 2
      wires.beginPath()
      wires.moveTo(ax, ay); wires.lineTo(mx, ay); wires.lineTo(mx, by); wires.lineTo(bx, by)
      wires.strokePath()
      // pointe de flèche sur l'enfant
      wires.fillStyle(met ? 0x81c784 : 0x546e7a, met ? 0.95 : 0.6)
      wires.fillTriangle(bx, by, bx - 8, by - 5, bx - 8, by + 5)
    }

    for (const n of tree.nodes) {
      const sk = byId.get(n.id)
      if (!sk) continue
      const { x, y } = nodePos.get(n.id)!
      const rank = p.skillLevels[sk.id] ?? 0
      const unlocked = rank > 0
      const equipped = p.equippedSkills.includes(sk.id)

      // GRISÉ SELON LE NOMBRE DE RAISONS (demande explicite) : un peu grisé s'il ne manque QUE le
      // niveau ou QUE le prérequis, beaucoup grisé si les DEUX manquent — le joueur voit ainsi la
      // différence entre « bientôt » et « pas pour maintenant ».
      const needLevel = p.level < (sk.minLevel ?? 1)
      const needParent = !!sk.requires && (p.skillLevels[sk.requires] ?? 0) <= 0
      const reasons = (needLevel ? 1 : 0) + (needParent ? 1 : 0)
      const alpha = unlocked ? 1 : reasons >= 2 ? 0.3 : reasons === 1 ? 0.62 : 1

      const card = this.add.rectangle(x, y, NODE_W, NODE_H, 0x000000, equipped ? 0.6 : 0.34).setOrigin(0, 0)
        .setStrokeStyle(2, equipped ? 0x80cbc4 : unlocked ? 0xffd54f : 0xffffff, equipped ? 0.9 : unlocked ? 0.7 : 0.22)
      const icon = this.add.image(x + 26, y + NODE_H / 2, `skill-${sk.id}`).setDisplaySize(34, 34)
      const name = this.add.text(x + 48, y + 6, sk.name, {
        fontSize: '12px', color: unlocked ? '#ffffff' : '#cfd8dc', fontStyle: 'bold',
        wordWrap: { width: NODE_W - 56 }, lineSpacing: -3,
      })
      const need: string[] = []
      if (needLevel) need.push(`Nv ${sk.minLevel}`)
      if (needParent) need.push(SKILLS[sk.requires!]?.name ?? sk.requires!)
      const state = unlocked ? `Nv ${rank}/${maxRankOf(sk)}${equipped ? ' · équipé' : ''}`
        : need.length ? `🔒 ${need.join(' + ')}`
        : 'À débloquer'
      const sub = this.add.text(x + 48, y + NODE_H - 17, state, {
        fontSize: '10px', color: unlocked ? '#ffd54f' : reasons >= 2 ? '#ef9a9a' : reasons === 1 ? '#ffcc80' : '#90caf9',
        wordWrap: { width: NODE_W - 56 },
      })

      for (const o of [card, icon, name, sub]) { o.setAlpha(alpha); layer.add(o) }

      // toute la carte est tapable : ouvre la fiche (débloquer / équiper s'y font)
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(sk))
      icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showDetail(sk))
    }

    // DÉFILEMENT VERTICAL si l'arbre dépasse la zone : molette + glisser. Borné aux deux extrémités.
    const overflow = Math.max(0, treeH + 20 - (AREA_BOT - AREA_TOP))
    if (overflow > 0) {
      this.add.text(VIEW_W - 26, AREA_TOP + 4, '↕', { fontSize: '18px', color: '#4fc3f7' }).setOrigin(1, 0)
      let dragging = false, lastY = 0
      const clamp = (dy: number) => { layer.y = Phaser.Math.Clamp(layer.y + dy, -overflow, 0) }
      this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => clamp(-dy * 0.5))
      this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        if (ptr.y < AREA_TOP || ptr.y > AREA_BOT) return
        dragging = true; lastY = ptr.y
      })
      this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
        if (!dragging) return
        clamp(ptr.y - lastY); lastY = ptr.y
      })
      this.input.on('pointerup', () => { dragging = false })
    }

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
      : s.kind === 'channel' ? 'Canalisé'
      : s.kind === 'aura' ? 'Aura'
      : s.kind === 'passive' ? 'Passif'
      : 'Soin'
    const tags: string[] = []
    if (s.pierce) tags.push('perçant')
    if (s.arc) tags.push('en cloche')
    if (s.burn) tags.push('brûlure')
    if (s.explode) tags.push('explosif')
    if (s.chargeable) tags.push('chargeable')
    if (s.channel) tags.push('maintien')
    if (s.slow) tags.push('ralenti')
    if (s.arrows && s.arrows > 1) tags.push(`${s.arrows} flèches`)
    return tags.length ? `${base} (${tags.join(', ')})` : base
  }

  private showDetail(s: SkillDef) {
    const p = getPlayer()
    const rank = p.skillLevels[s.id] ?? 0
    const effRank = Math.max(1, rank)
    const rankMult = skillDamageMult(s, effRank) / s.multiplier
    const stats = computeStats(p)

    const panel = this.add.container(0, 0).setDepth(1000)
    // Fond opaque qui bloque les clics vers l'écran dessous
    const backdrop = this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x000000, 0.72).setInteractive()
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

    const rankTxt = rank > 0 ? `Nv ${rank}/${maxRankOf(s)}` : 'Non débloquée (aperçu au Nv 1)'
    panel.add(this.add.text(left, y, rankTxt, { fontSize: '13px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0, 0))
    y += 24

    if (s.kind === 'passive') {
      const parts: string[] = []
      if (s.passive?.atk) parts.push(`+${s.passive.atk} ATK`)
      if (s.passive?.maxHp) parts.push(`+${s.passive.maxHp} PV max`)
      if (s.passive?.def) parts.push(`+${s.passive.def} DÉF`)
      if (s.passive?.attackSpeed) parts.push(`+${s.passive.attackSpeed} vit. att.`)
      if (s.passive?.hpRegenPerSec) parts.push(`+${s.passive.hpRegenPerSec} PV/s régén`)
      if (s.passive?.energyRegenPerSec) parts.push(`+${s.passive.energyRegenPerSec} énergie/s`)
      if (s.passive?.moveSpeedPct) parts.push(`+${Math.round(s.passive.moveSpeedPct * 100)}% vitesse`)
      if (s.passive?.jumpBoostPct) parts.push(`+${Math.round(s.passive.jumpBoostPct * 100)}% saut`)
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
