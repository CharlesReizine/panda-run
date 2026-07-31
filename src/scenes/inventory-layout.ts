// Géométrie PURE (sans Phaser) de l'écran d'inventaire, pour que le non-débordement soit TESTABLE.
//
// LE BUG QUE ÇA CORRIGE — celui-là était visible dès le début de partie, avec QUATRE objets en sac.
// La grille du stock était posée en dur, section par section : en-tête à `y`, cases à
// `rowsTop + row * 92` avec `rowsTop = y + 22`, puis `y = rowsTop + rows * 92 + 6` pour la section
// suivante. Avec un seul objet de chaque type (chapeau, armure, arme, accessoire), les quatre sections
// se succédaient à y = 92, 212, 332 puis 452 : la 4e rangée de cases s'étalait de 482 à 558. Le
// panneau s'arrêtait à 508 et l'ÉCRAN à 540 : la dernière ligne d'objets sortait de l'écran par le
// bas (18 px dehors) et son nom, dessiné à y = 540, était intégralement invisible. Au passage elle
// recouvrait le bouton « ← Fermer » (bande 483→527). Et comme le sac n'a AUCUNE limite (rien dans
// src/core ne borne `p.inventory.push`), le débordement était sans fond : 20 objets en sac faisaient
// descendre la grille à y > 900.
//
// LA RÈGLE APPLIQUÉE, la même que pour le menu : une liste dont la longueur dépend de la partie doit
// avoir une capacité CALCULÉE, et le surplus doit être ANNONCÉ (« +N autres ») plutôt que dessiné dans
// le vide. Ici la capacité dépend même du CONTENU du sac (chaque type d'objet présent coûte un
// en-tête de section), donc elle se calcule à chaque rendu — impossible à figer dans une constante.
//
// ⚠️ LIMITE CONNUE, À TRANCHER PAR LE JEU, PAS PAR LA GÉOMÉTRIE. La grille montre 16 objets (4 rangées
// de 4, cf. `layoutStock`) : sur 540 px de haut, avec un en-tête par type d'équipement, il n'y a pas
// plus de place. Comme le sac est SANS LIMITE, un joueur qui accumule au-delà de 16 objets ne peut plus
// atteindre les suivants depuis cet écran — ils sont comptés (« +N en sac ») mais pas cliquables. Deux
// vraies réponses, toutes deux hors géométrie : plafonner le sac dans src/core (et refuser/vendre le
// butin au-delà), ou paginer ce panneau comme le fait déjà l'écran de réforge en ville. En attendant,
// annoncer le surplus vaut toujours mieux que le dessiner hors de l'écran, où il n'était NI visible NI
// cliquable.
//
// ⚠️ ESPACE DE CONCEPTION. Toutes les coordonnées ci-dessous vivent dans le repère 0→960 × 0→540. La
// LARGEUR réelle de l'écran varie (960→1404, cf. core/viewport.ts) ; la scène appelle `centerCamera`
// et ce repère tombe pile au milieu. C'est pourquoi on borne à 960 et non à VIEW_W : borner à VIEW_W
// ferait glisser l'interface vers la droite sur les écrans larges.

import { charsPerLine, lineH, textWidth, wrapText } from './text-metrics'

/** Repère de conception. Ne PAS confondre avec VIEW_W/VIEW_H (taille réelle, variable). */
export const DESIGN = { w: 960, h: 540 }

export interface Rect { x: number; y: number; w: number; h: number }
export interface Band { y: number; h: number }

export const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export const centerOf = (r: Rect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export const INV = {
  titleY: 22, titleFont: 26,
  /** libellés de colonne (STOCK / ÉQUIPEMENT), origine haut-gauche */
  labelY: 52, labelFont: 18,
  /** haut des deux panneaux */
  top: 78,
  /** RIEN ne descend sous cette ligne : le bouton « ← Fermer » commence en dessous */
  bottom: 496,
  left: 30, right: 930,
  /** frontière stock (gauche) / équipement (droite) */
  splitX: 512,
  gap: 12,
  /** marge intérieure du panneau de stock */
  pad: 10,

  // ── grille du stock ──────────────────────────────────────────────────────────
  /** 4 colonnes plutôt que 3 : la contrainte est la HAUTEUR (540 px fixes), pas la largeur. Une
   *  colonne de plus, c'est +33 % de capacité sans coûter un pixel vertical. */
  cols: 4,
  cellH: 80,
  icon: 34,
  nameFont: 11,
  /** un en-tête de section (« Chapeaux », « Armures »…) coûte exactement une ligne de 13 px */
  sectionFont: 13,
  sectionGap: 2,

  // ── ligne « +N autres » ──────────────────────────────────────────────────────
  noticeFont: 13,

  // ── colonne d'équipement ────────────────────────────────────────────────────
  slotRowH: 88, slotRowGap: 10,
  slotLabelFont: 12, slotNameFont: 15, slotIcon: 44, slotHintFont: 11,

  // ── bouton de fermeture ─────────────────────────────────────────────────────
  closeY: 518, closeFont: 18, closePadX: 16, closePadY: 6,
}

export const sectionH = (): number => lineH(INV.sectionFont)
export const noticeH = (): number => lineH(INV.noticeFont)

/** Bas du bandeau de titre + libellés de colonne : les panneaux commencent en dessous. */
export const headerBottom = (): number => INV.labelY + lineH(INV.labelFont)

export const stockBox = (): Rect => ({
  x: INV.left, y: INV.top, w: INV.splitX - INV.gap - INV.left, h: INV.bottom - INV.top,
})

export const equipBox = (): Rect => ({
  x: INV.splitX + INV.gap, y: INV.top, w: INV.right - INV.splitX - INV.gap, h: INV.bottom - INV.top,
})

export const cellW = (): number => Math.floor((stockBox().w - 2 * INV.pad) / INV.cols)
export const gridLeft = (): number => stockBox().x + INV.pad

/**
 * Ligne au-delà de laquelle la grille n'a plus le droit de descendre.
 *
 * La place de la notice « +N autres » est réservée EN PERMANENCE, même quand il n'y a pas de surplus.
 * Sinon la capacité changerait selon qu'il y a débordement ou non : ajouter un objet ferait apparaître
 * une case, qui ferait apparaître la notice, qui reprendrait la place de la case… un cycle instable
 * qui se verrait à l'écran comme un clignotement.
 */
export const gridLimit = (): number => INV.bottom - noticeH()

export interface StockSection {
  /** clé du groupe telle que fournie par l'appelant (l'emplacement d'équipement) */
  key: string
  /** index du PREMIER objet de la section affiché sur cette page (pagination) */
  from: number
  /** y de l'en-tête de section */
  headerY: number
  /** y de la première rangée de cases */
  gridY: number
  rows: number
  /** nombre d'objets de cette section réellement dessinés */
  shown: number
  /** objets de cette section non dessinés (déjà comptés dans `StockLayout.hidden`) */
  hidden: number
}

export interface StockLayout {
  sections: StockSection[]
  /** total non dessiné SUR CETTE PAGE — DOIT être annoncé, jamais avalé */
  hidden: number
  /** y de la ligne d'annonce / du pagineur */
  noticeY: number
  /** nombre de pages nécessaires pour montrer TOUT le sac */
  pageCount: number
  /** page réellement affichée (bornée à [0, pageCount-1]) */
  page: number
}

/**
 * Place les sections du stock de haut en bas et borne le tout à la place réellement disponible.
 *
 * `groups` arrive dans l'ordre d'affichage voulu (chapeau → armure → arme → accessoire) ; les groupes
 * vides sont ignorés — ils ne coûtent pas d'en-tête, ce qui rend la capacité dépendante du CONTENU du
 * sac et non d'un nombre figé.
 *
 * DEUX TEMPS, ET C'EST LE POINT IMPORTANT :
 *  1. chaque section présente reçoit d'abord UNE rangée (en-tête + une rangée, indivisibles) ;
 *  2. les rangées qui restent sont distribuées à TOUR DE RÔLE aux sections qui en veulent plus.
 *
 * Une distribution « premier arrivé, premier servi » serait plus simple et beaucoup plus mauvaise :
 * avec 9 chapeaux en sac, les chapeaux prendraient toute la hauteur et les ARMES disparaîtraient
 * entièrement. Une borne correcte qui empêche d'équiper son arme reste un écran cassé. Le tour de rôle
 * garantit qu'aucun type d'équipement ne peut être évincé par un autre.
 */
export function layoutStock(groups: { key: string; count: number }[], page = 0): StockLayout {
  const avail = gridLimit() - INV.top
  const hdr = sectionH()
  const present = groups.filter((g) => g.count > 0)

  // combien de sections peut-on entamer (en-tête + une rangée chacune) ? Entamer une section sans
  // pouvoir lui donner une rangée serait le pire des deux mondes : de la place perdue à annoncer du vide
  let k = 0
  while (k < present.length) {
    const cost = (k + 1) * (hdr + INV.cellH) + k * INV.sectionGap
    if (cost > avail) break
    k++
  }
  const kept = present.slice(0, k)
  const rows = kept.map(() => 1)
  let used = k * (hdr + INV.cellH) + Math.max(0, k - 1) * INV.sectionGap

  let encore = true
  while (encore) {
    encore = false
    for (let i = 0; i < kept.length && used + INV.cellH <= avail; i++) {
      if (rows[i]! * INV.cols >= kept[i]!.count) continue // cette section est déjà complète
      rows[i] = rows[i]! + 1
      used += INV.cellH
      encore = true
    }
  }

  // ── PAGINATION ──────────────────────────────────────────────────────────────────────────────
  // Borner l'affichage suffit à ne plus déborder, mais rend les objets au-delà INATTEIGNABLES : on
  // remplace un écran cassé par un écran qui cache des objets, ce qui n'est pas mieux quand on veut
  // équiper son 17ᵉ objet. Chaque section défile donc par pages de SA propre capacité, et le nombre
  // de pages est celui de la section la plus remplie — ainsi aucun objet du sac n'est hors de portée.
  // (Le vrai correctif de fond serait un plafond de sac dans src/core, cf. l'en-tête de ce fichier.)
  const capOf = (i: number) => rows[i]! * INV.cols
  const pageCount = Math.max(1, ...kept.map((g, i) => Math.ceil(g.count / capOf(i))))
  const pg = Math.min(Math.max(0, page), pageCount - 1)

  const sections: StockSection[] = []
  // Les sections qu'on n'a même pas pu ENTAMER n'ont aucune page à elles : elles restent comptées
  // comme masquées, sur toutes les pages. C'est un manque de PLACE, pas de pagination.
  let hidden = present.slice(k).reduce((n, g) => n + g.count, 0)
  let y = INV.top
  for (const [i, g] of kept.entries()) {
    const r = rows[i]!
    const cap = capOf(i)
    const from = Math.min(pg * cap, Math.max(0, g.count - 1))
    const shown = Math.max(0, Math.min(cap, g.count - from))
    sections.push({ key: g.key, from, headerY: y, gridY: y + hdr, rows: r, shown, hidden: g.count - shown })
    hidden += g.count - shown
    y += hdr + r * INV.cellH + INV.sectionGap
  }

  return { sections, hidden, noticeY: gridLimit(), pageCount, page: pg }
}

/** Case n° `i` (0-based) d'une section dont la grille commence à `gridY`. */
export function cellRect(gridY: number, i: number): Rect {
  const w = cellW()
  return {
    x: gridLeft() + (i % INV.cols) * w,
    y: gridY + Math.floor(i / INV.cols) * INV.cellH,
    w, h: INV.cellH,
  }
}

/** Cadre DESSINÉ d'une case : 4 px de retrait pour que deux cases voisines ne se touchent pas. */
export const cellFrame = (c: Rect): Rect => ({ x: c.x + 4, y: c.y + 4, w: c.w - 8, h: c.h - 8 })

export const cellIconCenter = (c: Rect): { x: number; y: number } =>
  ({ x: c.x + c.w / 2, y: c.y + 6 + INV.icon / 2 })

export const cellNameTop = (c: Rect): number => c.y + 6 + INV.icon + 4

/** Deux lignes au plus pour le nom d'un objet : au-delà on empiéterait sur le cadre de la case. */
export const CELL_NAME_LINES = 2

export const cellNameChars = (): number => charsPerLine(cellW() - 14, INV.nameFont)

export const cellNameLines = (name: string): string[] =>
  wrapText(name, cellNameChars(), CELL_NAME_LINES)

/** Bas du texte de nom d'une case — doit rester dans le cadre dessiné. */
export const cellNameBottom = (c: Rect): number =>
  cellNameTop(c) + CELL_NAME_LINES * lineH(INV.nameFont)

// ── colonne d'équipement : nombre de lignes FIXE (un emplacement par type), mais la géométrie reste
// calculée pour que la rangée du bas soit garantie au-dessus du bouton de fermeture.
export function equipRowRect(i: number, n: number): Rect {
  const box = equipBox()
  const total = n * INV.slotRowH + (n - 1) * INV.slotRowGap
  const y0 = box.y + Math.max(0, Math.floor((box.h - total) / 2))
  return { x: box.x, y: y0 + i * (INV.slotRowH + INV.slotRowGap), w: box.w, h: INV.slotRowH }
}

export const equipRowsFit = (n: number): boolean => {
  const box = equipBox()
  const last = equipRowRect(n - 1, n)
  return n >= 1 && last.y + last.h <= box.y + box.h
}

export const equipLabelPos = (r: Rect): { x: number; y: number } => ({ x: r.x + 12, y: r.y + 8 })
export const equipIconCenter = (r: Rect): { x: number; y: number } => ({ x: r.x + 44, y: r.y + 50 })
export const equipNameX = (r: Rect): number => r.x + 76
/** Largeur laissée au nom : on garde 60 px à droite pour la mention « Infos ». */
export const equipNameW = (r: Rect): number => r.w - 76 - 60
export const equipNameChars = (r: Rect): number => charsPerLine(equipNameW(r), INV.slotNameFont)
export const equipHintX = (r: Rect): number => r.x + r.w - 30

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FICHE INFO (modale) — flux vertical CALCULÉ.
//
// L'ancienne version empilait des offsets en dur depuis le haut de la carte (`top + 104`,
// `top + 132`, `top + 158`, `top + 226`…). Tant que les textes tenaient sur une ligne ça marchait ;
// dès qu'un nom passait sur deux lignes ou qu'une description dépassait trois lignes, les blocs se
// marchaient dessus — et la description la plus longue du jeu (105 caractères) tombait déjà pile sur
// la limite. Ici chaque bloc est déduit du précédent, et le test vérifie l'empilement pour TOUTES les
// combinaisons (nom 1-2 lignes × description 0-4 lignes × message présent ou pas).
//
// Choix assumé : la place des blocs est RÉSERVÉE au maximum (2 lignes de nom, 4 de description,
// 2 de message), même quand le contenu est plus court. La carte garde donc la même taille et les
// boutons ne bougent pas d'un objet à l'autre — un bouton qui se déplace sous le doigt entre deux
// clics est un défaut plus grave qu'un peu de blanc dans une modale.

export const CARD = {
  cx: 480, w: 460,
  top: 72, h: 396,
  padX: 24,
  /** marge plus large pour la description : du texte long se lit mieux avec des bords généreux */
  descPadX: 28,
  padTop: 14, padBottom: 12,
  icon: 72,
  nameFont: 20, nameLines: 2,
  rarityFont: 13,
  descFont: 13, descLines: 4,
  propsTitleFont: 12, propsFont: 15,
  noticeFont: 13, noticeLines: 2,
  btnFont: 16, btnPadX: 18, btnPadY: 8, btnGap: 16,
}

export interface InfoLayout {
  card: Rect
  icon: Rect
  name: Band; nameLines: string[]
  rarity: Band
  desc: Band; descLines: string[]
  propsTitle: Band
  props: Band
  /** bande réservée au message contextuel (ex. « Arme réservée aux mages ») */
  notice: Band; noticeLines: string[]
  /** bande des deux boutons, ancrée au BAS de la carte */
  buttons: Band
}

export const cardRect = (): Rect => ({ x: CARD.cx - CARD.w / 2, y: CARD.top, w: CARD.w, h: CARD.h })

export const cardNameChars = (): number => charsPerLine(CARD.w - 2 * CARD.padX, CARD.nameFont)
export const cardDescChars = (): number => charsPerLine(CARD.w - 2 * CARD.descPadX, CARD.descFont)
export const cardNoticeChars = (): number => charsPerLine(CARD.w - 2 * CARD.padX, CARD.noticeFont)

/**
 * Bande des deux boutons, ancrée au BAS de la carte : les blocs les plus cliquables ne dépendent donc
 * pas de la longueur des textes du haut.
 */
export function buttonsBand(): Band {
  const h = lineH(CARD.btnFont) + 2 * CARD.btnPadY
  return { h, y: CARD.top + CARD.h - CARD.padBottom - h }
}

export function layoutInfo(name: string, desc: string, notice: string | null): InfoLayout {
  const card = cardRect()
  const icon: Rect = { x: CARD.cx - CARD.icon / 2, y: card.y + CARD.padTop, w: CARD.icon, h: CARD.icon }

  const nameBand: Band = { y: icon.y + icon.h + 10, h: CARD.nameLines * lineH(CARD.nameFont) }
  const rarity: Band = { y: nameBand.y + nameBand.h + 4, h: lineH(CARD.rarityFont) }
  const descBand: Band = { y: rarity.y + rarity.h + 6, h: CARD.descLines * lineH(CARD.descFont) }
  const propsTitle: Band = { y: descBand.y + descBand.h + 8, h: lineH(CARD.propsTitleFont) }
  const props: Band = { y: propsTitle.y + propsTitle.h + 2, h: lineH(CARD.propsFont) }

  const buttons = buttonsBand()
  const noticeBand: Band = {
    h: CARD.noticeLines * lineH(CARD.noticeFont),
    y: buttons.y - 6 - CARD.noticeLines * lineH(CARD.noticeFont),
  }

  return {
    card, icon,
    name: nameBand, nameLines: wrapText(name, cardNameChars(), CARD.nameLines),
    rarity,
    desc: descBand, descLines: wrapText(desc, cardDescChars(), CARD.descLines),
    propsTitle, props,
    notice: noticeBand,
    noticeLines: notice ? wrapText(notice, cardNoticeChars(), CARD.noticeLines) : [],
    buttons,
  }
}

/** Les deux boutons de la fiche, côte à côte et centrés : largeur déduite des libellés. */
export function infoButtons(action: string, close: string): { action: Rect; close: Rect } {
  const band = buttonsBand()
  const wOf = (s: string) => Math.ceil(textWidth(s, CARD.btnFont)) + 2 * CARD.btnPadX
  const wa = wOf(action), wc = wOf(close)
  const x0 = CARD.cx - (wa + CARD.btnGap + wc) / 2
  return {
    action: { x: x0, y: band.y, w: wa, h: band.h },
    close: { x: x0 + wa + CARD.btnGap, y: band.y, w: wc, h: band.h },
  }
}

/** Bouton « ← Fermer » de l'écran, sous les panneaux (origine 0,5 côté Phaser d'où le centrage). */
export function closeRect(label: string): Rect {
  const h = lineH(INV.closeFont) + 2 * INV.closePadY
  const w = Math.ceil(textWidth(label, INV.closeFont)) + 2 * INV.closePadX
  return { x: CARD.cx - w / 2, y: INV.closeY - h / 2, w, h }
}

// ─── ONGLET « MATÉRIAUX » DU PANNEAU DE GAUCHE ──────────────────────────────────────────────────
//
// Retour du user : « je vois pas dans mon inventaire où je trouve mes matériaux et loots ». Ils
// existaient, mais UNIQUEMENT dans l'écran Menu — pas dans l'inventaire, qui est l'endroit où on les
// cherche. On réutilise donc la surface du panneau de stock avec deux onglets : Équipement / Matériaux.
//
// ⚠️ ON RÉUTILISE LA SURFACE PLUTÔT QUE D'AJOUTER UN TROISIÈME PANNEAU. L'écran fait 540 px de haut,
// fixes, et le panneau de stock est déjà paginé parce qu'il ne tenait pas. Un panneau de plus aurait
// rétréci les deux autres et remis le débordement au programme.

export const MAT = {
  /** hauteur d'une ligne de matériau : icône + nom + quantité sur une seule ligne, bien lisible */
  rowH: 34,
  icon: 24,
  nameFont: 13,
  qtyFont: 14,
  /** deux colonnes : les noms de matériaux sont courts, une seule colonne gâcherait la largeur */
  cols: 2,
  gap: 8,
  /** hauteur de la barre d'onglets, au-dessus des panneaux */
  tabsH: 26,
}

/** Zone utile de la liste de matériaux (sous la barre d'onglets, dans le panneau de gauche). */
export const matBox = (): Rect => {
  const s = stockBox()
  return { x: s.x + INV.pad, y: s.y + MAT.tabsH + INV.pad, w: s.w - 2 * INV.pad, h: s.h - MAT.tabsH - 2 * INV.pad }
}

export const matCellW = (): number => Math.floor((matBox().w - (MAT.cols - 1) * MAT.gap) / MAT.cols)

/** Nombre de lignes de matériaux affichables par colonne. */
export const matRows = (): number => Math.max(1, Math.floor(matBox().h / MAT.rowH))

/** Capacité d'une page (toutes colonnes confondues). */
export const matPerPage = (): number => matRows() * MAT.cols

/** Rectangle d'une case de matériau, par index DANS la page. */
export function matCellRect(i: number): Rect {
  const b = matBox()
  const col = Math.floor(i / matRows())
  const row = i % matRows()
  return { x: b.x + col * (matCellW() + MAT.gap), y: b.y + row * MAT.rowH, w: matCellW(), h: MAT.rowH }
}

/** Nombre de pages nécessaires pour `n` matériaux collectés. */
export const matPageCount = (n: number): number => Math.max(1, Math.ceil(n / matPerPage()))

/** Y de la ligne de pagination des matériaux (sous la dernière ligne possible). */
export const matPagerY = (): number => matBox().y + matRows() * MAT.rowH + 10
