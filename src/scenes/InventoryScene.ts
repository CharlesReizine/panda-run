import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { ITEMS, rarityColor, SLOT_ORDER, SLOT_LABEL_PLURAL } from '../data/items'
import type { EquipSlot } from '../core/types'
import type { LevelScene } from './LevelScene'

// ordre fixe chapeau → armure → arme → accessoire (partagé avec les boutiques)
const SLOTS: EquipSlot[] = SLOT_ORDER
const SLOT_LABELS: Record<EquipSlot, string> = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire', hat: 'Chapeau' }
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

  constructor() { super('Inventory') }

  init(data: { return?: string; overlay?: boolean }) {
    this.returnKey = data.return ?? 'WorldMap'
    this.overlay = data.overlay ?? false
    this.dirty = false
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
          const tile = this.add.rectangle(cx, cy, cellW - 12, cellH - 16, 0x1b2b3a, 0.9).setStrokeStyle(2, rarityColor(item.rarity), 0.9)
          this.itemIcon(e.itemId, cx, cy - 14, 40)
          this.add.text(cx, cy + 20, `${item.name}${upTxt}`, {
            fontSize: '11px', color: this.css(rarityColor(item.rarity)), align: 'center', wordWrap: { width: cellW - 18 },
          }).setOrigin(0.5, 0)
          // clic sur la case = équiper l'objet dans son slot (l'objet précédent retourne au stock)
          tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            const prev = p.equipment[item.slot]
            p.equipment[item.slot] = e.itemId
            p.inventory.splice(e.i, 1)
            if (prev) p.inventory.push(prev)
            save(p); this.dirty = true; this.render()
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
      const box = this.add.rectangle(750, y, 360, 76, 0x1b2b3a, 0.9).setStrokeStyle(2, item ? rarityColor(item.rarity) : 0x455a64, item ? 0.95 : 0.6)
      this.add.text(590, y - 24, SLOT_LABELS[slot], { fontSize: '12px', color: '#90a4ae' }).setOrigin(0, 0.5)
      if (item && itemId) {
        this.itemIcon(itemId, 610, y + 6, 44)
        const up = p.upgrades[itemId] ?? 0
        const upTxt = up > 0 ? ` +${up}` : ''
        this.add.text(646, y + 2, `${item.name}${upTxt}`, { fontSize: '15px', color: this.css(rarityColor(item.rarity)), fontStyle: 'bold', wordWrap: { width: 240 } }).setOrigin(0, 0.5)
        this.add.text(880, y + 2, 'Retirer', { fontSize: '11px', color: '#ffb0b0' }).setOrigin(0.5)
        // clic sur le slot équipé = déséquiper (retour au stock)
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          p.inventory.push(itemId)
          delete p.equipment[slot]
          save(p); this.dirty = true; this.render()
        })
      } else {
        this.add.text(750, y + 4, '— vide —', { fontSize: '13px', color: '#607d8b' }).setOrigin(0.5)
      }
    })

    // Fermer : retour à la scène d'origine
    this.add.text(480, 505, '← Fermer', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 16, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close())
  }
}
