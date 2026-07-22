import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { ITEMS, rarityColor, SLOT_ORDER, SLOT_LABEL_PLURAL } from '../data/items'
import { upgradedBonus } from '../core/reforge'
import { canEquipItem, equipRestrictionMessage } from '../core/equip'
import type { EquipSlot, Rarity } from '../core/types'
import type { LevelScene } from './LevelScene'

// ordre fixe chapeau → armure → arme → accessoire (partagé avec les boutiques)
const SLOTS: EquipSlot[] = SLOT_ORDER
const SLOT_LABELS: Record<EquipSlot, string> = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire', hat: 'Chapeau' }
// libellé de rareté affiché dans la fiche info (couleur = rarityColor)
const RARITY_LABELS: Record<Rarity, string> = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' }
// libellé lisible d'une propriété de bonus (fiche info)
const STAT_LABELS: Record<'atk' | 'def' | 'maxHp', string> = { atk: 'ATK', def: 'DÉF', maxHp: 'PV' }

// objet actuellement sélectionné → alimente la fiche info (droite). `source` distingue un objet du
// stock (bouton Équiper) d'un objet équipé (bouton Retirer).
interface Selection { itemId: string; source: 'stock' | 'equip'; slot: EquipSlot; invIndex?: number }
// pastille par emplacement (repli quand aucune icône illustrée item-<id> n'est bakée)
const SLOT_PASTILLE: Record<EquipSlot, { color: number; glyph: string }> = {
  weapon: { color: 0xe64a19, glyph: 'ATK' },
  armor: { color: 0x1e88e5, glyph: 'DEF' },
  accessory: { color: 0x43a047, glyph: 'PV' },
  hat: { color: 0x8e24aa, glyph: 'HAT' },
}

// Écran d'inventaire dédié, SÉPARÉ des compétences. GAUCHE = le stock (objets non équipés),
// DROITE = l'équipement porté (4 slots). Cliquer un objet du stock l'équipe ; cliquer un slot
// équipé le déséquipe. Ouvrable depuis la carte du monde (transition) ou en jeu (overlay).
export class InventoryScene extends Phaser.Scene {
  private returnKey = 'WorldMap'
  private overlay = false // true = lancée par-dessus le jeu en pause (à reprendre à la fermeture)
  private dirty = false // un équipement a changé → rafraîchir le panda en jeu à la fermeture
  private selected: Selection | null = null // objet dont la fiche info est ouverte
  private notice: string | null = null // message contextuel (ex. arme réservée à une autre classe)

  constructor() { super('Inventory') }

  init(data: { return?: string; overlay?: boolean }) {
    this.returnKey = data.return ?? 'WorldMap'
    this.overlay = data.overlay ?? false
    this.dirty = false
    this.selected = null
    this.notice = null
  }

  create() {
    this.render()
  }

  private close() {
    if (this.overlay) {
      this.scene.resume('Level')
      this.scene.resume('UI')
      if (this.dirty) {
        // l'équipement a changé pendant le combat : recalcule les stats du panda + rafraîchit HUD/coiffe/arme
        const lvl = this.scene.get('Level') as LevelScene | undefined
        lvl?.player?.refreshStats()
        this.game.events.emit('hud-refresh')
      }
      this.scene.stop()
    } else {
      this.scene.start(this.returnKey)
    }
  }

  private css(n: number): string { return `#${n.toString(16).padStart(6, '0')}` }

  // icône d'un objet : illustration bakée item-<id> si dispo, sinon coiffe cosmetic-<id> (chapeaux),
  // sinon pastille colorée + glyphe par slot. Ajoute l'objet à la scène (rien à renvoyer).
  private itemIcon(itemId: string, x: number, y: number, size: number) {
    const item = ITEMS[itemId]!
    if (this.textures.exists(`item-${itemId}`)) { this.add.image(x, y, `item-${itemId}`).setDisplaySize(size, size); return }
    if (item.slot === 'hat' && this.textures.exists(`cosmetic-${itemId}`)) { this.add.image(x, y, `cosmetic-${itemId}`).setDisplaySize(size, size); return }
    const p = SLOT_PASTILLE[item.slot]
    this.add.circle(x, y, size / 2, p.color).setStrokeStyle(2, 0xffffff, 0.6)
    this.add.text(x, y, p.glyph, { fontSize: `${Math.round(size / 3.6)}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  private render() {
    for (const child of [...this.children.list]) child.destroy()
    const p = getPlayer()
    this.add.rectangle(480, 270, 960, 540, 0x0d1b2a, 0.96)
    this.add.text(480, 22, 'Inventaire', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    // ─── GAUCHE : STOCK (objets non équipés) ───────────────────────────────
    this.add.text(40, 52, 'STOCK', { fontSize: '18px', color: '#80cbc4' })
    this.add.rectangle(30, 88, 470, 420, 0x000000, 0.25).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.15)

    if (p.inventory.length === 0) {
      this.add.text(265, 300, '(vide — les objets ramassés\napparaissent ici)', { fontSize: '14px', color: '#78909c', align: 'center' }).setOrigin(0.5)
    } else {
      // regroupé visuellement par type (chapeau → armure → arme → accessoire), en-tête par section.
      // On conserve l'index réel dans p.inventory pour l'équipement (splice).
      const cols = 3, cellW = 150, cellH = 92
      const gridLeft = 40
      const entries = p.inventory.map((itemId, i) => ({ itemId, i }))
      let y = 92
      for (const slot of SLOTS) {
        const group = entries.filter((e) => ITEMS[e.itemId]!.slot === slot)
        if (group.length === 0) continue
        this.add.text(44, y, SLOT_LABEL_PLURAL[slot], { fontSize: '13px', color: '#ffd54f', fontStyle: 'bold' })
        const rowsTop = y + 22
        group.forEach((e, gi) => {
          const item = ITEMS[e.itemId]!
          const col = gi % cols, row = Math.floor(gi / cols)
          const cx = gridLeft + col * cellW + cellW / 2
          const cy = rowsTop + row * cellH + cellH / 2
          const up = p.upgrades[e.itemId] ?? 0
          const upTxt = up > 0 ? ` +${up}` : ''
          const isSel = this.selected?.source === 'stock' && this.selected.invIndex === e.i
          const tile = this.add.rectangle(cx, cy, cellW - 12, cellH - 16, 0x1b2b3a, 0.9)
            .setStrokeStyle(isSel ? 3 : 2, isSel ? 0xffffff : rarityColor(item.rarity), isSel ? 1 : 0.9)
          this.itemIcon(e.itemId, cx, cy - 14, 40)
          this.add.text(cx, cy + 20, `${item.name}${upTxt}`, {
            fontSize: '11px', color: this.css(rarityColor(item.rarity)), align: 'center', wordWrap: { width: cellW - 18 },
          }).setOrigin(0.5, 0)
          // clic sur la case = ouvrir la fiche info de l'objet (l'équipement se fait depuis la fiche)
          tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.selected = { itemId: e.itemId, source: 'stock', slot: item.slot, invIndex: e.i }
            this.notice = null
            this.render()
          })
        })
        y = rowsTop + Math.ceil(group.length / cols) * cellH + 6
      }
    }

    // ─── DROITE : ÉQUIPEMENT porté (4 slots) ───────────────────────────────
    this.add.text(560, 52, 'ÉQUIPEMENT', { fontSize: '18px', color: '#80cbc4' })
    SLOTS.forEach((slot, i) => {
      const y = 116 + i * 88
      const itemId = p.equipment[slot]
      const item = itemId ? ITEMS[itemId]! : null
      const isSel = this.selected?.source === 'equip' && this.selected.slot === slot
      const box = this.add.rectangle(750, y, 360, 76, 0x1b2b3a, 0.9)
        .setStrokeStyle(isSel ? 3 : 2, isSel ? 0xffffff : (item ? rarityColor(item.rarity) : 0x455a64), item ? (isSel ? 1 : 0.95) : 0.6)
      this.add.text(590, y - 24, SLOT_LABELS[slot], { fontSize: '12px', color: '#90a4ae' }).setOrigin(0, 0.5)
      if (item && itemId) {
        this.itemIcon(itemId, 610, y + 6, 44)
        const up = p.upgrades[itemId] ?? 0
        const upTxt = up > 0 ? ` +${up}` : ''
        this.add.text(646, y + 2, `${item.name}${upTxt}`, { fontSize: '15px', color: this.css(rarityColor(item.rarity)), fontStyle: 'bold', wordWrap: { width: 240 } }).setOrigin(0, 0.5)
        this.add.text(880, y + 2, 'Infos', { fontSize: '11px', color: '#b0d4ff' }).setOrigin(0.5)
        // clic sur le slot équipé = ouvrir la fiche info (le retrait se fait depuis la fiche)
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.selected = { itemId, source: 'equip', slot }
          this.notice = null
          this.render()
        })
      } else {
        this.add.text(750, y + 4, '— vide —', { fontSize: '13px', color: '#607d8b' }).setOrigin(0.5)
      }
    })

    // Fermer : retour à la scène d'origine
    this.add.text(480, 505, '← Fermer', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close())

    // Fiche info par-dessus (modale) quand un objet est sélectionné
    if (this.selected) this.drawInfoPanel()
  }

  // équipe l'objet sélectionné du stock (l'objet déjà porté retourne au stock), puis ferme la fiche.
  // RESTRICTION DE CLASSE : une arme hors spécialité (ex. épée pour un mage) est refusée avec un
  // message clair, la fiche reste ouverte. Les objets déjà équipés (saves existantes) restent en
  // place — seul le RÉ-équipement d'une arme non autorisée est bloqué.
  private equipSelected(sel: Selection) {
    const p = getPlayer()
    if (sel.invIndex === undefined) return
    if (!canEquipItem(p.classId, sel.itemId)) {
      this.notice = equipRestrictionMessage(p.classId, sel.itemId)
      this.render()
      return
    }
    const prev = p.equipment[sel.slot]
    p.equipment[sel.slot] = sel.itemId
    p.inventory.splice(sel.invIndex, 1)
    if (prev) p.inventory.push(prev)
    this.selected = null
    save(p); this.dirty = true; this.render()
  }

  // déséquipe l'objet du slot sélectionné (retour au stock), puis ferme la fiche
  private unequipSelected(sel: Selection) {
    const p = getPlayer()
    p.inventory.push(sel.itemId)
    delete p.equipment[sel.slot]
    this.selected = null
    save(p); this.dirty = true; this.render()
  }

  // Panneau d'INFO modal : NOM, RARETÉ (couleur), emplacement, DESCRIPTION courte et
  // PROPRIÉTÉS (bonus lus depuis l'ItemDef, majorés du niveau de réforge). Bouton d'action
  // contextuel (Équiper / Retirer) + fermeture de la fiche.
  private drawInfoPanel() {
    const sel = this.selected!
    const p = getPlayer()
    const item = ITEMS[sel.itemId]!
    const color = rarityColor(item.rarity)
    const up = p.upgrades[sel.itemId] ?? 0

    // fond assombri : clic en dehors de la carte = fermer la fiche
    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.55)
      .setInteractive({ useHandCursor: false }).on('pointerdown', () => { this.selected = null; this.render() })

    const cx = 480, top = 96, cardW = 460, cardH = 348
    this.add.rectangle(cx, top + cardH / 2, cardW, cardH, 0x14263a, 1).setStrokeStyle(3, color, 1)

    // icône + nom + rareté
    this.itemIcon(sel.itemId, cx, top + 52, 72)
    const upTxt = up > 0 ? ` +${up}` : ''
    this.add.text(cx, top + 104, `${item.name}${upTxt}`, { fontSize: '20px', color: this.css(color), fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 40 } }).setOrigin(0.5, 0)
    this.add.text(cx, top + 132, `${RARITY_LABELS[item.rarity ?? 'commun']} · ${SLOT_LABELS[item.slot]}`, { fontSize: '13px', color: this.css(color) }).setOrigin(0.5, 0)

    // description
    const desc = item.description ?? 'Aucune description.'
    this.add.text(cx, top + 158, desc, { fontSize: '13px', color: '#cfd8dc', align: 'center', fontStyle: 'italic', wordWrap: { width: cardW - 56 } }).setOrigin(0.5, 0)

    // propriétés (bonus effectifs, majorés du niveau de réforge)
    const bonus = upgradedBonus(item.bonus, up)
    const props = (['atk', 'def', 'maxHp'] as const).filter((k) => (bonus[k] ?? 0) > 0).map((k) => `+${bonus[k]} ${STAT_LABELS[k]}`)
    const propsY = top + 226
    this.add.text(cx, propsY, 'PROPRIÉTÉS', { fontSize: '12px', color: '#80cbc4', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.add.text(cx, propsY + 20, props.length ? props.join('   ') : '(aucun bonus)', { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)

    // message contextuel (ex. « Arme réservée aux mages ») au-dessus du bouton d'action
    if (this.notice) {
      this.add.text(cx, top + cardH - 74, this.notice, { fontSize: '13px', color: '#ff8a80', fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 48 } }).setOrigin(0.5)
    }

    // bouton d'action contextuel
    const btnY = top + cardH - 42
    const actLabel = sel.source === 'stock' ? 'Équiper' : 'Retirer'
    const actBg = sel.source === 'stock' ? '#2e7d32' : '#8d3b3b'
    this.add.text(cx - 70, btnY, actLabel, { fontSize: '16px', color: '#ffffff', backgroundColor: actBg, padding: { x: 18, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (sel.source === 'stock') this.equipSelected(sel); else this.unequipSelected(sel) })
    this.add.text(cx + 80, btnY, 'Fermer', { fontSize: '16px', color: '#ffffff', backgroundColor: '#37474f', padding: { x: 18, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.selected = null; this.render() })
  }
}
