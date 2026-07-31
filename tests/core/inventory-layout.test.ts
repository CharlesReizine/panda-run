import { describe, it, expect } from 'vitest'
import {
  DESIGN, INV, CARD, overlap, headerBottom, stockBox, equipBox, gridLimit, cellW, gridLeft,
  layoutStock, cellRect, cellFrame, cellIconCenter, cellNameTop, cellNameBottom, cellNameChars, cellNameLines,
  CELL_NAME_LINES, equipRowRect, equipRowsFit, equipLabelPos, equipIconCenter, equipNameX,
  equipNameChars, equipHintX, layoutInfo, infoButtons, closeRect, cardNameChars, cardDescChars,
  sectionH, noticeH, type Rect,
} from '../../src/scenes/inventory-layout'
import { charsPerLine, lineH } from '../../src/scenes/text-metrics'
import { ITEMS, SLOT_ORDER } from '../../src/data/items'
import { MAX_REFORGE_LEVEL, upgradedBonus } from '../../src/core/reforge'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// INVENTAIRE — RIEN NE DÉBORDE, QUEL QUE SOIT LE CONTENU DU SAC. TEST BLOQUANT.
//
// LE BUG, chiffré. L'ancienne grille enchaînait les sections en dur : en-tête à `y`, cases à
// `y + 22 + row * 92`, section suivante à `y + 22 + rows * 92 + 6`. Avec UN objet de chaque type —
// chapeau, armure, arme, accessoire, soit un sac de tout début de partie — les en-têtes tombaient à
// y = 92, 212, 332 et 452, et la 4e rangée de cases occupait 482 → 558. Le panneau finissait à 508,
// l'écran à 540 : la dernière ligne d'objets sortait de l'écran et son libellé (dessiné à y = 540)
// était totalement invisible, par-dessus le bouton « ← Fermer » (bande 483 → 527).
//
// Et le sac n'a AUCUNE limite : rien dans src/core ne borne `p.inventory.push` (butin dans LevelScene,
// achats dans shop.ts, récompenses de quête dans quests.ts, artisanat dans craft.ts). Le débordement
// n'avait donc pas de plafond — 20 objets poussaient la grille au-delà de y = 900.
//
// Ce test balaie donc TOUTES les répartitions plausibles (et quelques absurdes) : c'est la seule
// manière de savoir que la borne tient, y compris pour un sac qu'on ne peut pas fermer.

const cellsOf = (rows: number, gridY: number, shown: number): Rect[] =>
  Array.from({ length: shown }, (_, i) => cellRect(gridY, i)).slice(0, rows * INV.cols)

/**
 * Répartitions à couvrir : sac vide, sacs de début de partie (là où était le bug), sacs pleins, sacs
 * absurdes. Le produit cartésien sur les 4 types donne 2401 combinaisons — assez pour attraper une
 * borne fausse, assez peu pour que la suite reste rapide.
 */
const COUNTS = [0, 1, 2, 4, 9, 17, 60]
const distributions: number[][] = []
for (const a of COUNTS) for (const b of COUNTS) for (const c of COUNTS) for (const d of COUNTS) {
  distributions.push([a, b, c, d])
}
const groupsOf = (counts: number[]) => SLOT_ORDER.map((s, i) => ({ key: s, count: counts[i] ?? 0 }))

describe('cadre général', () => {
  it('les libellés de colonne s\'arrêtent au-dessus des panneaux', () => {
    expect(headerBottom()).toBeLessThanOrEqual(INV.top)
  })

  it('stock et équipement ne se recouvrent pas et tiennent dans la zone utile', () => {
    const a = stockBox(), b = equipBox()
    expect(overlap(a, b)).toBe(false)
    expect(a.x + a.w).toBeLessThanOrEqual(INV.splitX)
    expect(b.x).toBeGreaterThanOrEqual(INV.splitX)
    for (const [nom, r] of Object.entries({ stock: a, equipement: b })) {
      expect(r.x, `${nom}.x`).toBeGreaterThanOrEqual(INV.left)
      expect(r.x + r.w, `${nom} droite`).toBeLessThanOrEqual(INV.right)
      expect(r.y, `${nom}.y`).toBeGreaterThanOrEqual(INV.top)
      expect(r.y + r.h, `${nom} bas`).toBeLessThanOrEqual(INV.bottom)
    }
  })

  it('le bouton « ← Fermer » est SOUS les deux panneaux et reste dans l\'écran', () => {
    const btn = closeRect('← Fermer')
    expect(btn.y, 'haut du bouton').toBeGreaterThanOrEqual(INV.bottom)
    expect(btn.y + btn.h, 'bas du bouton').toBeLessThanOrEqual(DESIGN.h)
    expect(overlap(btn, stockBox())).toBe(false)
    expect(overlap(btn, equipBox())).toBe(false)
  })

  it('la place de la ligne « +N autres » est réservée en permanence', () => {
    // sinon la capacité dépendrait de l'existence du surplus, qui dépend de la capacité : ajouter un
    // objet ferait apparaître une case, qui ferait apparaître la notice, qui reprendrait la place de
    // la case… un cycle qui se verrait à l'écran comme un clignotement
    expect(gridLimit()).toBe(INV.bottom - noticeH())
    expect(noticeH()).toBeGreaterThanOrEqual(lineH(INV.noticeFont))
    expect(sectionH()).toBeGreaterThanOrEqual(lineH(INV.sectionFont))
  })
})

describe('grille du stock bornée', () => {
  it('AUCUNE case ne descend sous la grille, pour toutes les répartitions du sac', () => {
    const fautes: string[] = []
    for (const counts of distributions) {
      const l = layoutStock(groupsOf(counts))
      for (const s of l.sections) {
        for (const c of cellsOf(s.rows, s.gridY, s.shown)) {
          if (c.y + c.h > gridLimit()) fautes.push(`${counts.join('/')} · ${s.key} : bas ${c.y + c.h} > ${gridLimit()}`)
        }
      }
    }
    expect(fautes.slice(0, 8), `cases débordantes (${fautes.length}) :\n  ${fautes.slice(0, 8).join('\n  ')}`).toEqual([])
  })

  it('AUCUNE case ne sort du panneau par la droite ou par la gauche', () => {
    const box = stockBox()
    for (const i of [0, 1, 2, 3, 7, 15]) {
      const c = cellRect(INV.top, i)
      expect(c.x, `case ${i}`).toBeGreaterThanOrEqual(box.x)
      expect(c.x + c.w, `case ${i}`).toBeLessThanOrEqual(box.x + box.w)
    }
    expect(gridLeft() + INV.cols * cellW()).toBeLessThanOrEqual(box.x + box.w)
  })

  it('les sections ne se marchent pas dessus et restent dans le panneau', () => {
    // on accumule les fautes et on fait UNE assertion : sur 2401 répartitions × 4 sections, appeler
    // expect() à chaque tour coûterait des secondes pour la même garantie
    const fautes: string[] = []
    for (const counts of distributions) {
      const l = layoutStock(groupsOf(counts))
      let prevBottom = INV.top
      for (const s of l.sections) {
        if (s.headerY < prevBottom) fautes.push(`${counts.join('/')} · ${s.key} : en-tête ${s.headerY} < ${prevBottom}`)
        if (s.gridY !== s.headerY + sectionH()) fautes.push(`${counts.join('/')} · ${s.key} : grille mal placée`)
        if (s.rows < 1) fautes.push(`${counts.join('/')} · ${s.key} : section sans rangée`)
        prevBottom = s.gridY + s.rows * INV.cellH
        if (prevBottom > gridLimit()) fautes.push(`${counts.join('/')} · ${s.key} : bas ${prevBottom} > ${gridLimit()}`)
      }
    }
    expect(fautes.slice(0, 8), `sections fautives (${fautes.length}) :\n  ${fautes.slice(0, 8).join('\n  ')}`).toEqual([])
  })

  it('ne perd JAMAIS un objet en silence : affiché + masqué = contenu du sac', () => {
    const fautes: string[] = []
    for (const counts of distributions) {
      const l = layoutStock(groupsOf(counts))
      const shown = l.sections.reduce((n, s) => n + s.shown, 0)
      const total = counts.reduce((n, v) => n + v, 0)
      if (shown + l.hidden !== total) fautes.push(`${counts.join('/')} : ${shown} + ${l.hidden} ≠ ${total}`)
      if (shown < total && l.hidden <= 0) fautes.push(`${counts.join('/')} : surplus non annoncé`)
    }
    expect(fautes.slice(0, 8), `comptes faux (${fautes.length}) :\n  ${fautes.slice(0, 8).join('\n  ')}`).toEqual([])
  })

  it('LE CAS DU BUG : un objet de chacun des 4 types tient entièrement à l\'écran', () => {
    // c'est la répartition qui débordait (4e rangée de cases 482 → 558, écran haut de 540)
    const l = layoutStock(groupsOf([1, 1, 1, 1]))
    expect(l.sections).toHaveLength(4)
    expect(l.hidden, 'rien ne doit être masqué avec 4 objets en sac').toBe(0)
    const last = l.sections[3]!
    expect(last.gridY + last.rows * INV.cellH).toBeLessThanOrEqual(gridLimit())
  })

  it('un sac PLEIN (tous les objets du jeu) est borné et annonce son surplus', () => {
    const counts = SLOT_ORDER.map((s) => Object.values(ITEMS).filter((it) => it.slot === s).length)
    const total = counts.reduce((n, v) => n + v, 0)
    expect(total, 'le jeu a bien plusieurs dizaines d\'objets').toBeGreaterThan(40)
    const l = layoutStock(groupsOf(counts))
    const shown = l.sections.reduce((n, s) => n + s.shown, 0)
    expect(shown).toBeLessThan(total)
    expect(l.hidden).toBe(total - shown)
    for (const s of l.sections) expect(s.gridY + s.rows * INV.cellH).toBeLessThanOrEqual(gridLimit())
  })

  it('aucun type d\'équipement ne peut être ÉVINCÉ par un autre', () => {
    // 30 chapeaux et une arme : si la distribution était « premier arrivé, premier servi », les
    // chapeaux mangeraient toute la hauteur et l'arme deviendrait inéquipable — un écran d'inventaire
    // qui empêche d'équiper son arme est cassé, même si plus rien ne dépasse
    for (const counts of [[30, 1, 1, 1], [1, 1, 1, 30], [9, 9, 9, 9], [60, 60, 60, 60]]) {
      const l = layoutStock(groupsOf(counts))
      expect(l.sections.map((s) => s.key), `${counts.join('/')}`).toEqual([...SLOT_ORDER])
      for (const s of l.sections) {
        expect(s.shown, `${counts.join('/')} · ${s.key}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('la capacité reste utile : au moins 12 objets visibles même avec les 4 sections', () => {
    // une borne qui ne montrerait que 4 objets serait « correcte » et inutilisable : on vérifie donc
    // aussi que la géométrie ne se protège pas en n'affichant presque rien
    const l = layoutStock(groupsOf([9, 9, 9, 9]))
    const shown = l.sections.reduce((n, s) => n + s.shown, 0)
    expect(shown).toBeGreaterThanOrEqual(12)
  })
})

describe('libellés des cases', () => {
  it('le nom reste DANS le cadre dessiné de la case', () => {
    const c = cellRect(INV.top, 0)
    const frame = cellFrame(c)
    expect(cellNameTop(c)).toBeGreaterThan(frame.y)
    expect(cellNameBottom(c), 'bas du nom').toBeLessThanOrEqual(frame.y + frame.h)
    // l'icône est au-dessus du nom, et les deux tiennent dans le cadre : c'est la seule répartition
    // possible dans 72 px de haut (34 d'icône + 2 lignes de 15), donc elle est vérifiée telle quelle
    const icon = cellIconCenter(c)
    expect(icon.y - INV.icon / 2, 'haut de l\'icône').toBeGreaterThanOrEqual(frame.y)
    expect(icon.y + INV.icon / 2, 'bas de l\'icône').toBeLessThanOrEqual(cellNameTop(c))
    expect(CELL_NAME_LINES * lineH(INV.nameFont)).toBe(cellNameBottom(c) - cellNameTop(c))
  })

  it('TOUS les noms d\'objets du jeu tiennent en 2 lignes sans être tronqués', () => {
    const coupes = Object.values(ITEMS)
      .filter((it) => cellNameLines(it.name).some((l) => l.endsWith('…')))
      .map((it) => `${it.name} → ${cellNameLines(it.name).join(' / ')}`)
    expect(coupes, `noms tronqués :\n  ${coupes.join('\n  ')}`).toEqual([])
  })

  it('avec le suffixe de réforge le plus long, la coupe reste propre (jamais de débordement)', () => {
    for (const it of Object.values(ITEMS)) {
      const lines = cellNameLines(`${it.name} +${MAX_REFORGE_LEVEL}`)
      expect(lines.length, it.name).toBeLessThanOrEqual(CELL_NAME_LINES)
      for (const l of lines) expect(l.length, `${it.name} → ${l}`).toBeLessThanOrEqual(cellNameChars())
    }
  })
})

describe('colonne d\'équipement', () => {
  const n = SLOT_ORDER.length

  it('les 4 rangées tiennent dans le panneau et ne se recouvrent pas', () => {
    expect(equipRowsFit(n)).toBe(true)
    const box = equipBox()
    const rows = Array.from({ length: n }, (_, i) => equipRowRect(i, n))
    for (const [i, r] of rows.entries()) {
      expect(r.y, `rangée ${i}`).toBeGreaterThanOrEqual(box.y)
      expect(r.y + r.h, `rangée ${i}`).toBeLessThanOrEqual(box.y + box.h)
      expect(r.x).toBe(box.x)
      expect(r.w).toBe(box.w)
      for (const other of rows.slice(i + 1)) expect(overlap(r, other), `rangées ${i}`).toBe(false)
    }
  })

  it('libellé, icône, nom et mention « Infos » ne se chevauchent pas dans une rangée', () => {
    const r = equipRowRect(0, n)
    const icon = equipIconCenter(r)
    const label = equipLabelPos(r)
    // le libellé du slot est au-dessus de l'icône, le nom à droite de l'icône, « Infos » tout à droite
    expect(label.y + lineH(INV.slotLabelFont)).toBeLessThanOrEqual(icon.y - INV.slotIcon / 2)
    expect(icon.x + INV.slotIcon / 2).toBeLessThanOrEqual(equipNameX(r))
    expect(equipNameX(r) + equipNameChars(r) * INV.slotNameFont * 0.6)
      .toBeLessThanOrEqual(equipHintX(r) - 20)
    expect(icon.y + INV.slotIcon / 2, 'icône dans la rangée').toBeLessThanOrEqual(r.y + r.h)
  })

  it('le nom d\'objet le plus long du jeu, réforge comprise, tient dans sa rangée', () => {
    const r = equipRowRect(0, n)
    const pire = Object.values(ITEMS)
      .map((it) => `${it.name} +${MAX_REFORGE_LEVEL}`)
      .sort((a, b) => b.length - a.length)[0]!
    expect(pire.length, `« ${pire} » (${equipNameChars(r)} caractères disponibles)`)
      .toBeLessThanOrEqual(equipNameChars(r))
  })
})

describe('fiche info (modale)', () => {
  const NOMS = ['x', 'Épée en bambou', 'Grelot porte-bonheur +10', 'A'.repeat(120)]
  const DESCS = ['', 'Court.', 'Une veste matelassée bon marché : amortit les premiers coups.', 'z'.repeat(400)]
  const NOTICES = [null, 'Arme réservée aux mages.', 'Un message vraiment très long qui n\'a aucune raison d\'exister mais qui pourrait arriver un jour.']

  it('la carte tient dans l\'écran', () => {
    const l = layoutInfo('Épée en bambou', 'Une lame.', null)
    expect(l.card.y).toBeGreaterThanOrEqual(0)
    expect(l.card.y + l.card.h).toBeLessThanOrEqual(DESIGN.h)
    expect(l.card.x).toBeGreaterThanOrEqual(0)
    expect(l.card.x + l.card.w).toBeLessThanOrEqual(DESIGN.w)
  })

  it('les blocs s\'empilent sans JAMAIS se recouvrir, pour tous les contenus possibles', () => {
    for (const nom of NOMS) for (const desc of DESCS) for (const notice of NOTICES) {
      const l = layoutInfo(nom, desc, notice)
      const bandes = [
        ['icone', { y: l.icon.y, h: l.icon.h }],
        ['nom', l.name], ['rarete', l.rarity], ['description', l.desc],
        ['titre proprietes', l.propsTitle], ['proprietes', l.props],
        ['message', l.notice], ['boutons', l.buttons],
      ] as const
      let bas = l.card.y
      for (const [nomBande, b] of bandes) {
        expect(b.y, `${nomBande} après ${bas} (nom=${nom.length}c desc=${desc.length}c)`).toBeGreaterThanOrEqual(bas)
        bas = b.y + b.h
      }
      expect(bas, 'bas du dernier bloc').toBeLessThanOrEqual(l.card.y + l.card.h)
    }
  })

  it('aucun texte ne dépasse la largeur intérieure de la carte', () => {
    for (const nom of NOMS) for (const desc of DESCS) for (const notice of NOTICES) {
      const l = layoutInfo(nom, desc, notice)
      for (const line of l.nameLines) expect(line.length).toBeLessThanOrEqual(cardNameChars())
      for (const line of l.descLines) expect(line.length).toBeLessThanOrEqual(cardDescChars())
      expect(l.nameLines.length).toBeLessThanOrEqual(CARD.nameLines)
      expect(l.descLines.length).toBeLessThanOrEqual(CARD.descLines)
      expect(l.noticeLines.length).toBeLessThanOrEqual(CARD.noticeLines)
    }
  })

  it('les descriptions RÉELLES du jeu s\'affichent en entier (aucune ellipse)', () => {
    const coupees = Object.values(ITEMS)
      .filter((it) => (it.description ?? '').length > 0)
      .filter((it) => layoutInfo(it.name, it.description!, null).descLines.some((l) => l.endsWith('…')))
      .map((it) => `${it.id} (${it.description!.length} caractères)`)
    expect(coupees, `descriptions tronquées :\n  ${coupees.join('\n  ')}`).toEqual([])
  })

  it('les lignes construites par la scène (rareté, propriétés) tiennent aussi en largeur', () => {
    // ces deux lignes ne passent pas par wrapText : elles sont assemblées par la scène, donc c'est
    // ici qu'on vérifie qu'aucune combinaison de bonus ne les fait sortir de la carte
    const rarete = 'Légendaire · Accessoire'
    expect(rarete.length, `« ${rarete} »`).toBeLessThanOrEqual(charsPerLine(CARD.w - 2 * CARD.padX, CARD.rarityFont))
    const props = Object.values(ITEMS).map((it) => {
      const b = upgradedBonus(it.bonus, MAX_REFORGE_LEVEL)
      return (['atk', 'def', 'maxHp'] as const).filter((k) => (b[k] ?? 0) > 0).map((k) => `+${b[k]} XXX`).join('   ')
    }).sort((a, b) => b.length - a.length)[0]!
    expect(props.length, `« ${props} »`).toBeLessThanOrEqual(charsPerLine(CARD.w - 2 * CARD.padX, CARD.propsFont))
  })

  it('les deux boutons de la fiche ne se recouvrent pas et restent dans la carte', () => {
    for (const action of ['Équiper', 'Retirer']) {
      const { action: a, close: c } = infoButtons(action, 'Fermer')
      expect(overlap(a, c)).toBe(false)
      const card = layoutInfo('', '', null).card
      for (const [nom, r] of Object.entries({ action: a, fermer: c })) {
        expect(r.x, `${nom}`).toBeGreaterThanOrEqual(card.x)
        expect(r.x + r.w, `${nom}`).toBeLessThanOrEqual(card.x + card.w)
        expect(r.y + r.h, `${nom}`).toBeLessThanOrEqual(card.y + card.h)
      }
    }
  })
})
