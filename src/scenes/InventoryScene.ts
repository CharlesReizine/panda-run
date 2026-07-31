import Phaser from 'phaser'
import { getPlayer } from '../state'
import { save } from '../core/save'
import { ITEMS, rarityColor, SLOT_ORDER, SLOT_LABEL_PLURAL } from '../data/items'
import { upgradedBonus } from '../core/reforge'
import { canEquipItem, equipRestrictionMessage } from '../core/equip'
import type { EquipSlot, Rarity } from '../core/types'
import type { LevelScene } from './LevelScene'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import {
  INV, CARD, stockBox, equipBox, layoutStock, cellRect, cellFrame, cellIconCenter, cellNameTop,
  cellNameLines, equipRowRect, equipLabelPos, equipIconCenter, equipNameX,
  equipNameChars, equipHintX, layoutInfo, infoButtons, centerOf, type Rect,
} from './inventory-layout'
import { truncate } from './text-metrics'

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
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
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

  // Cette scène ne fait plus que PEINDRE : toutes les positions viennent de inventory-layout.ts, qui
  // est testé pour ne rien laisser sortir du cadre quel que soit le contenu du sac (lequel n'a aucune
  // limite — cf. l'en-tête du module de géométrie).
  private render() {
    for (const child of [...this.children.list]) child.destroy()
    const p = getPlayer()
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1b2a, 0.96)
    this.add.text(480, INV.titleY, 'Inventaire', { fontSize: `${INV.titleFont}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    const stock = stockBox(), equip = equipBox()

    // ─── GAUCHE : STOCK (objets non équipés) ───────────────────────────────
    this.add.text(stock.x + 10, INV.labelY, 'STOCK', { fontSize: `${INV.labelFont}px`, color: '#80cbc4' })
    this.add.rectangle(stock.x, stock.y, stock.w, stock.h, 0x000000, 0.25).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.15)

    if (p.inventory.length === 0) {
      this.add.text(stock.x + stock.w / 2, stock.y + stock.h / 2, '(vide — les objets ramassés\napparaissent ici)', { fontSize: '14px', color: '#78909c', align: 'center' }).setOrigin(0.5)
    } else {
      // regroupé visuellement par type (chapeau → armure → arme → accessoire), en-tête par section.
      // On conserve l'index réel dans p.inventory pour l'équipement (splice).
      const entries = p.inventory.map((itemId, i) => ({ itemId, i }))
      const bySlot = (slot: EquipSlot) => entries.filter((e) => ITEMS[e.itemId]!.slot === slot)
      const layout = layoutStock(SLOTS.map((slot) => ({ key: slot, count: bySlot(slot).length })))

      for (const section of layout.sections) {
        const slot = section.key as EquipSlot
        this.add.text(stock.x + 14, section.headerY, SLOT_LABEL_PLURAL[slot], { fontSize: `${INV.sectionFont}px`, color: '#ffd54f', fontStyle: 'bold' })
        bySlot(slot).slice(0, section.shown).forEach((e, gi) => this.drawStockCell(e, cellRect(section.gridY, gi)))
      }

      // le surplus est ANNONCÉ, jamais dessiné dans le vide : c'est la règle du dépôt depuis le bug
      // du menu, et elle est d'autant plus nécessaire ici que le sac est sans limite
      if (layout.hidden > 0) {
        this.add.text(stock.x + stock.w / 2, layout.noticeY, `+${layout.hidden} autre${layout.hidden > 1 ? 's' : ''} en sac (équipe ou vends)`, {
          fontSize: `${INV.noticeFont}px`, color: '#ffab40', fontStyle: 'bold',
        }).setOrigin(0.5, 0)
      }
    }

    // ─── DROITE : ÉQUIPEMENT porté (4 slots) ───────────────────────────────
    this.add.text(equip.x, INV.labelY, 'ÉQUIPEMENT', { fontSize: `${INV.labelFont}px`, color: '#80cbc4' })
    SLOTS.forEach((slot, i) => {
      const row = equipRowRect(i, SLOTS.length)
      const mid = centerOf(row)
      const itemId = p.equipment[slot]
      const item = itemId ? ITEMS[itemId]! : null
      const isSel = this.selected?.source === 'equip' && this.selected.slot === slot
      const box = this.add.rectangle(mid.x, mid.y, row.w, row.h, 0x1b2b3a, 0.9)
        .setStrokeStyle(isSel ? 3 : 2, isSel ? 0xffffff : (item ? rarityColor(item.rarity) : 0x455a64), item ? (isSel ? 1 : 0.95) : 0.6)
      const lab = equipLabelPos(row)
      this.add.text(lab.x, lab.y, SLOT_LABELS[slot], { fontSize: `${INV.slotLabelFont}px`, color: '#90a4ae' })
      if (item && itemId) {
        const ic = equipIconCenter(row)
        this.itemIcon(itemId, ic.x, ic.y, INV.slotIcon)
        const up = p.upgrades[itemId] ?? 0
        const upTxt = up > 0 ? ` +${up}` : ''
        // tronqué à la largeur CALCULÉE de la rangée : aucun nom ne peut plus recouvrir « Infos »
        this.add.text(equipNameX(row), ic.y, truncate(`${item.name}${upTxt}`, equipNameChars(row)), {
          fontSize: `${INV.slotNameFont}px`, color: this.css(rarityColor(item.rarity)), fontStyle: 'bold',
        }).setOrigin(0, 0.5)
        this.add.text(equipHintX(row), ic.y, 'Infos', { fontSize: `${INV.slotHintFont}px`, color: '#b0d4ff' }).setOrigin(0.5)
        // clic sur le slot équipé = ouvrir la fiche info (le retrait se fait depuis la fiche)
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.selected = { itemId, source: 'equip', slot }
          this.notice = null
          this.render()
        })
      } else {
        this.add.text(mid.x, mid.y + 6, '— vide —', { fontSize: '13px', color: '#607d8b' }).setOrigin(0.5)
      }
    })

    // Fermer : retour à la scène d'origine — SOUS les deux panneaux (il était auparavant recouvert
    // par la dernière rangée d'objets, qui descendait jusqu'à y = 558)
    this.add.text(480, INV.closeY, '← Fermer', {
      fontSize: `${INV.closeFont}px`, color: '#ffffff', backgroundColor: '#33691e',
      padding: { x: INV.closePadX, y: INV.closePadY },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close())

    // Fiche info par-dessus (modale) quand un objet est sélectionné
    if (this.selected) this.drawInfoPanel()
  }

  // Une case de la grille du stock : cadre + icône + nom sur deux lignes au plus, tout borné par
  // inventory-layout (le nom ne peut plus déborder du cadre ni la case sortir du panneau).
  private drawStockCell(entry: { itemId: string; i: number }, cell: Rect) {
    const p = getPlayer()
    const item = ITEMS[entry.itemId]!
    const frame = cellFrame(cell)
    const mid = centerOf(frame)
    const isSel = this.selected?.source === 'stock' && this.selected.invIndex === entry.i
    const tile = this.add.rectangle(mid.x, mid.y, frame.w, frame.h, 0x1b2b3a, 0.9)
      .setStrokeStyle(isSel ? 3 : 2, isSel ? 0xffffff : rarityColor(item.rarity), isSel ? 1 : 0.9)

    const ic = cellIconCenter(cell)
    this.itemIcon(entry.itemId, ic.x, ic.y, INV.icon)

    const up = p.upgrades[entry.itemId] ?? 0
    const upTxt = up > 0 ? ` +${up}` : ''
    this.add.text(cell.x + cell.w / 2, cellNameTop(cell), cellNameLines(`${item.name}${upTxt}`).join('\n'), {
      // la découpe est faite par la géométrie (nombre de lignes BORNÉ) : on n'utilise PAS wordWrap,
      // qui ne sait pas s'arrêter au bout de deux lignes et laissait donc le nom sortir du cadre
      fontSize: `${INV.nameFont}px`, color: this.css(rarityColor(item.rarity)), align: 'center',
    }).setOrigin(0.5, 0)

    // clic sur la case = ouvrir la fiche info de l'objet (l'équipement se fait depuis la fiche)
    tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selected = { itemId: entry.itemId, source: 'stock', slot: item.slot, invIndex: entry.i }
      this.notice = null
      this.render()
    })
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
    this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x000000, 0.55)
      .setInteractive({ useHandCursor: false }).on('pointerdown', () => { this.selected = null; this.render() })

    // Flux vertical CALCULÉ (cf. inventory-layout) : les anciens offsets en dur depuis le haut de la
    // carte se chevauchaient dès qu'un nom passait sur deux lignes ou qu'une description était longue.
    const upTxt = up > 0 ? ` +${up}` : ''
    const desc = item.description ?? 'Aucune description.'
    const L = layoutInfo(`${item.name}${upTxt}`, desc, this.notice)
    const cx = CARD.cx
    this.add.rectangle(cx, L.card.y + L.card.h / 2, L.card.w, L.card.h, 0x14263a, 1).setStrokeStyle(3, color, 1)

    // icône + nom + rareté
    this.itemIcon(sel.itemId, cx, L.icon.y + L.icon.h / 2, CARD.icon)
    this.add.text(cx, L.name.y, L.nameLines.join('\n'), { fontSize: `${CARD.nameFont}px`, color: this.css(color), fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0)
    this.add.text(cx, L.rarity.y, `${RARITY_LABELS[item.rarity ?? 'commun']} · ${SLOT_LABELS[item.slot]}`, { fontSize: `${CARD.rarityFont}px`, color: this.css(color) }).setOrigin(0.5, 0)

    // description
    this.add.text(cx, L.desc.y, L.descLines.join('\n'), { fontSize: `${CARD.descFont}px`, color: '#cfd8dc', align: 'center', fontStyle: 'italic' }).setOrigin(0.5, 0)

    // propriétés (bonus effectifs, majorés du niveau de réforge)
    const bonus = upgradedBonus(item.bonus, up)
    const props = (['atk', 'def', 'maxHp'] as const).filter((k) => (bonus[k] ?? 0) > 0).map((k) => `+${bonus[k]} ${STAT_LABELS[k]}`)
    this.add.text(cx, L.propsTitle.y, 'PROPRIÉTÉS', { fontSize: `${CARD.propsTitleFont}px`, color: '#80cbc4', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.add.text(cx, L.props.y, props.length ? props.join('   ') : '(aucun bonus)', { fontSize: `${CARD.propsFont}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)

    // message contextuel (ex. « Arme réservée aux mages ») dans la bande réservée au-dessus des boutons
    if (this.notice) {
      this.add.text(cx, L.notice.y, L.noticeLines.join('\n'), { fontSize: `${CARD.noticeFont}px`, color: '#ff8a80', fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0)
    }

    // boutons ancrés au bas de la carte, largeur déduite de leurs libellés
    const actLabel = sel.source === 'stock' ? 'Équiper' : 'Retirer'
    const actBg = sel.source === 'stock' ? '#2e7d32' : '#8d3b3b'
    const btns = infoButtons(actLabel, 'Fermer')
    const actMid = centerOf(btns.action), closeMid = centerOf(btns.close)
    this.add.text(actMid.x, actMid.y, actLabel, { fontSize: `${CARD.btnFont}px`, color: '#ffffff', backgroundColor: actBg, padding: { x: CARD.btnPadX, y: CARD.btnPadY } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (sel.source === 'stock') this.equipSelected(sel); else this.unequipSelected(sel) })
    this.add.text(closeMid.x, closeMid.y, 'Fermer', { fontSize: `${CARD.btnFont}px`, color: '#ffffff', backgroundColor: '#37474f', padding: { x: CARD.btnPadX, y: CARD.btnPadY } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.selected = null; this.render() })
  }
}
