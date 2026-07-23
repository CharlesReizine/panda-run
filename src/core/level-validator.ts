// Validateur STATIQUE d'atteignabilité d'un niveau. Déterministe, fonctions PURES : on
// rejoue la géométrie (plateformes + échelles) avec le modèle de saut de platforming.ts pour
// garantir qu'un niveau est PHYSIQUEMENT jouable — chaque plateforme accessible, aucune
// échelle qui débouche sur le vide, aucun coffre posé sur une plateforme injoignable.
//
// Une échelle est modélisée comme un connecteur VERTICAL : contrairement au saut, elle relie
// son pied (au sol / sur une plateforme) à son sommet, quelle que soit la dénivelée. Le
// sommet d'une échelle est donc atteignable dès que son pied l'est, ce que le simple
// `unreachablePlatforms` de platforming.ts (sauts uniquement) ne sait pas modéliser.

import { groundRowFor, canReach, maxJumpGapPx, MAX_LADDER_TILES, TILE, type Plat } from './platforming'
import type { LevelDef } from '../data/levels'

const ROW_TOL = 1 // tolérance verticale (en tuiles) pour « le dessus est à la rangée y »

interface Ladder { x: number; y: number; h: number }

export interface LadderProblem { x: number; y: number; h: number; reason: 'sommet-sans-plateforme' | 'pied-dans-le-vide' }
export interface ChestProblem { x: number; y: number }
export interface GapProblem { x: number; w: number }
export interface OversizedLadder { x: number; y: number; h: number }

function hgap(a: Plat, b: Plat): number {
  return Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
}

// Décalage PIEDS↔CENTRE du panda ≈ 40px ≈ 1,25 tuile : en grimpant jusqu'en haut, son CENTRE
// atteint ~la rangée du haut du montant (l.y) et ses PIEDS sont ~1,25 tuile PLUS BAS. Une
// plateforme posée pile à l.y serait donc à hauteur de tête, inatteignable. Elle n'est
// « posable » au sommet que si son dessus est 1 à 2 rangées SOUS le haut de l'échelle
// (l.y+1..l.y+2) — là où les pieds arrivent, avec un petit saut vers le bas pour s'y poser —
// ET qu'elle est horizontalement adjacente au montant (l'x de l'échelle tombe entre platX-1 et
// platX+platW+1, à gauche OU à droite).
const LADDER_TOP_MIN_DROP = 1 // rangées sous l.y : borne HAUTE atteignable (pieds à ~1,25 tuile sous le centre)
const LADDER_TOP_MAX_DROP = 2 // rangées sous l.y : borne BASSE (au-delà, la plateforme décroche du sommet)
function isLadderTop(p: Plat, l: Ladder): boolean {
  const drop = p.y - l.y
  return drop >= LADDER_TOP_MIN_DROP && drop <= LADDER_TOP_MAX_DROP && l.x >= p.x - 1 && l.x <= p.x + p.w + 1
}

// ÉCHELLES-LIANES : une échelle SUSPENDUE (accrochée par le haut, pied dans le VIDE) s'attrape en
// SAUTANT — si une surface est alignée sous son pied, à portée de saut (≤ LADDER_GRAB_TILES rangées),
// on bondit pour agripper les barreaux du bas. On l'accepte donc comme « pied joignable ».
const LADDER_GRAB_TILES = 4 // ≈ hauteur de saut (maxJumpHeightPx/TILE) : au-delà, injoignable au saut
// Le pied « rejoint » une surface : posé dessus (échelle classique) OU juste au-dessus, à portée de
// saut (échelle-liane suspendue qu'on attrape en bondissant). `col` = alignement horizontal.
function footMeets(l: Ladder, p: Plat): boolean {
  const drop = p.y - (l.y + l.h) // >0 : surface SOUS le pied ; ~0 : pied posé
  return l.x >= p.x - 1 && l.x <= p.x + p.w + 1 && drop >= -ROW_TOL && drop <= LADDER_GRAB_TILES
}

// Le pied de l'échelle (rangée y+h) rejoint-il le sol (au BAS du monde) ou une plateforme (posé OU à
// portée de saut) ? (b)
function ladderFootGrounded(l: Ladder, platforms: Plat[], groundRow: number): boolean {
  const bottom = l.y + l.h
  if (bottom >= groundRow) return true // descend jusqu'au sol
  return platforms.some((p) => footMeets(l, p))
}

// Le pied de l'échelle rejoint-il une surface DÉJÀ atteignable (sol, ou plateforme du set, posé ou à
// portée de saut) ? — condition pour pouvoir emprunter l'échelle et donc atteindre son sommet.
function ladderFootReachable(l: Ladder, platforms: Plat[], reachable: Set<number>, groundRow: number): boolean {
  const bottom = l.y + l.h
  if (bottom >= groundRow) return true // pied au sol : toujours accessible
  return platforms.some((p, i) => reachable.has(i) && footMeets(l, p))
}

// Graphe d'atteignabilité (point fixe) : surfaces joignables du sol, de proche en proche par saut,
// ou par une échelle dont le pied est accessible. Les PONTS sont des surfaces marchables (one-way)
// au même titre que les plateformes : inclus comme relais, sinon une traversée qui passe par un pont
// (ex. franchir une cuve) ferait croire la rive opposée injoignable. Renvoie les nœuds (plateformes
// PUIS ponts), l'ensemble des indices atteignables, le nb de plateformes et le sol.
interface ReachInfo { nodes: Plat[]; reachable: Set<number>; nPlat: number; groundRow: number; ground: Plat }

// Cascades REMONTABLES = connecteurs VERTICAUX au même titre qu'une échelle : on GRIMPE la colonne
// d'eau (le panda joue l'anim d'escalade). Le sommet d'émergence — une plateforme JOINTIVE au bord de
// la colonne, ~à la rangée `top` du rideau — est atteignable dès qu'une BERGE BASSE de la colonne
// (plateforme jointive en contrebas, où l'on saute pour entrer) est elle-même accessible.
interface Cascade { x: number; w: number; top: number }
function cascadeColumns(level: LevelDef): Cascade[] {
  return (level.hazards ?? [])
    .filter((h) => h.kind === 'water' && h.water === 'cascade')
    .map((h) => ({ x: h.x, w: h.w, top: h.top ?? 0 }))
}
function bordersCascade(p: Plat, c: Cascade): boolean {
  return p.x + p.w === c.x || p.x === c.x + c.w
}
function isCascadeTop(b: Plat, c: Cascade): boolean {
  const drop = b.y - c.top
  return drop >= 0 && drop <= LADDER_TOP_MAX_DROP && bordersCascade(b, c)
}
function cascadeFootReachable(c: Cascade, nodes: Plat[], reachable: Set<number>): boolean {
  return nodes.some((p, i) => reachable.has(i) && bordersCascade(p, c) && p.y > c.top)
}

function computeReach(level: LevelDef): ReachInfo {
  const platforms = level.platforms
  const bridges = (level.bridges ?? []).map((b) => ({ x: b.x, y: b.y, w: b.w }))
  const nodes: Plat[] = [...platforms, ...bridges]
  const ladders = (level.ladders ?? []) as Ladder[]
  const cascades = cascadeColumns(level)
  const groundRow = groundRowFor(level.heightTiles)
  const ground: Plat = { x: 0, y: groundRow, w: level.widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    const surfaces = [ground, ...[...reachable].map((j) => nodes[j]!)]
    for (let i = 0; i < nodes.length; i++) {
      if (reachable.has(i)) continue
      const b = nodes[i]!
      // (1) atteignable par saut depuis le sol ou une surface déjà atteignable
      if (surfaces.some((a) => canReach(a.y, b, hgap(a, b)))) { reachable.add(i); changed = true; continue }
      // (2) sommet d'une échelle dont le pied est accessible (plateformes uniquement)
      if (i < platforms.length && ladders.some((l) => isLadderTop(b, l) && ladderFootReachable(l, platforms, reachable, groundRow))) {
        reachable.add(i); changed = true; continue
      }
      // (3) sommet d'émergence d'une cascade REMONTABLE dont une berge basse est accessible
      if (cascades.some((c) => isCascadeTop(b, c) && cascadeFootReachable(c, nodes, reachable))) {
        reachable.add(i); changed = true
      }
    }
  }
  return { nodes, reachable, nPlat: platforms.length, groundRow, ground }
}

// Plateformes qu'on ne peut atteindre ni du sol, ni de proche en proche par saut, ni en
// grimpant une échelle dont le pied est accessible.
export function unreachablePlatforms(level: LevelDef): Plat[] {
  const { nodes, reachable, nPlat } = computeReach(level)
  return nodes.slice(0, nPlat).filter((_, i) => !reachable.has(i))
}

// Échelles « vers le vide » : sommet sans plateforme posable (a) ou pied qui ne rejoint ni
// le sol ni une plateforme (b).
export function laddersToNowhere(level: LevelDef): LadderProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const out: LadderProblem[] = []
  for (const l of (level.ladders ?? []) as Ladder[]) {
    const hasTop = level.platforms.some((p) => isLadderTop(p, l))
    if (!hasTop) { out.push({ x: l.x, y: l.y, h: l.h, reason: 'sommet-sans-plateforme' }); continue }
    if (!ladderFootGrounded(l, level.platforms, groundRow)) out.push({ x: l.x, y: l.y, h: l.h, reason: 'pied-dans-le-vide' })
  }
  return out
}

// Échelles dont le pied n'est pas accessible à pied (sol ou plateforme atteignable). Utile en
// complément : une échelle peut avoir un sommet correct mais un pied injoignable.
export function unreachableLadders(level: LevelDef): LadderProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const bad = new Set(unreachablePlatforms(level))
  const reachable = new Set<number>()
  level.platforms.forEach((p, i) => { if (!bad.has(p)) reachable.add(i) })
  const out: LadderProblem[] = []
  for (const l of (level.ladders ?? []) as Ladder[]) {
    if (!ladderFootReachable(l, level.platforms, reachable, groundRow)) {
      out.push({ x: l.x, y: l.y, h: l.h, reason: 'pied-dans-le-vide' })
    }
  }
  return out
}

// Échelles trop LONGUES (h > MAX_LADDER_TILES) : une échelle unique géante est proscrite — une
// grande montée doit être découpée en SEGMENTS empilés séparés par des paliers (voir builder tower).
export function oversizedLadders(level: LevelDef): OversizedLadder[] {
  return ((level.ladders ?? []) as Ladder[])
    .filter((l) => l.h > MAX_LADDER_TILES)
    .map((l) => ({ x: l.x, y: l.y, h: l.h }))
}

// Trous du sol trop LARGES pour être franchis au saut simple (w × TILE > distance de saut
// confortable). Le sol couvre toute la largeur (les plateformes restent atteignables du sol,
// donc un trou ne casse jamais l'atteignabilité) ; on ne vérifie ici que la franchissabilité.
// EXEMPTION : un trou situé SOUS une cascade REMONTABLE n'est PAS censé se franchir au saut — on
// GRIMPE la cascade au-dessus (y tomber = mort volontaire). On l'exclut donc du contrôle de saut
// (sinon élargir la colonne de cascade ferait croire à un trou infranchissable).
export function oversizedGaps(level: LevelDef): GapProblem[] {
  const max = maxJumpGapPx()
  const cascades = cascadeColumns(level)
  const underCascade = (g: GapProblem) => cascades.some((c) => c.x <= g.x && c.x + c.w >= g.x + g.w)
  return (level.gaps ?? []).filter((g) => g.w * TILE > max && !underCascade(g)).map((g) => ({ x: g.x, w: g.w }))
}

// ─── VALIDATEURS DU KIT DE MODULES (jouabilité + cohérence, cf. docs/level-module-kit.md) ────

export interface TierProblem { x: number; tiers: number }
export interface WaterProblem { x: number; w: number; water?: string }
export interface SpawnProblem { monsterId: string; x: number; y?: number; reason: string }

// Nombre MAXIMAL de paliers empilés (plateformes/ponts + sol) à une colonne x. Une grande verticale
// (tour d'échelles) empile beaucoup de paliers ; le kit impose ≤ 3 (silhouette collines).
export function maxStackedTiers(level: LevelDef): number {
  const groundRow = groundRowFor(level.heightTiles)
  const isGap = (x: number) => (level.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
  const surfaces = [
    ...level.platforms.map((p) => ({ x: p.x, w: p.w })),
    ...(level.bridges ?? []).map((b) => ({ x: b.x, w: b.w })),
  ]
  let max = 0
  for (let x = 0; x < level.widthTiles; x++) {
    let n = isGap(x) ? 0 : 1 // le sol compte comme 1 palier (sauf trou)
    for (const s of surfaces) if (x >= s.x && x < s.x + s.w) n++
    if (n > max) max = n
  }
  return max
}

// Renvoie les colonnes où plus de `limit` paliers sont empilés (défaut 3).
export function overStackedColumns(level: LevelDef, limit = 3): TierProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const isGap = (x: number) => (level.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
  const surfaces = [
    ...level.platforms.map((p) => ({ x: p.x, w: p.w })),
    ...(level.bridges ?? []).map((b) => ({ x: b.x, w: b.w })),
  ]
  const out: TierProblem[] = []
  for (let x = 0; x < level.widthTiles; x++) {
    let n = isGap(x) ? 0 : 1
    for (const s of surfaces) if (x >= s.x && x < s.x + s.w) n++
    if (n > limit) out.push({ x, tiers: n })
  }
  void groundRow
  return out
}

// Eau NON ENCLOSE dans une cuve de pierre : le kit n'autorise que les formes CONTENUES (murs/fond
// posés par le moteur) — 'basin' (marine), 'cascade' (remontable) et 'lave' (cuve de lave mortelle,
// enfer). Une nappe LIBRE (water absent) ou une 'waterfall' décorative n'est pas une cuve jouable →
// rejetée pour un niveau modulaire.
export function openWaterHazards(level: LevelDef): WaterProblem[] {
  const enclosed = new Set(['basin', 'cascade', 'lave'])
  return (level.hazards ?? [])
    .filter((h) => h.kind === 'water' && !enclosed.has(h.water ?? ''))
    .map((h) => ({ x: h.x, w: h.w, water: h.water }))
}

// Cascades REMONTABLES trop COURTES : une cascade doit se GRIMPER, pas se franchir d'un saut. On
// exige que sa dénivelée jouable atteigne AU MOINS `minTiles` rangées (= 4× la taille du panda, cf.
// MIN_CASCADE_TILES). La dénivelée = distance verticale entre le SOMMET de la colonne (top) et la
// berge/pierre marchable qui la BORDE en contrebas (bord gauche x-1 ou bord droit x+w). Une cascade
// entièrement cernée d'eau (rideau qui plonge dans un bassin) n'a pas de berge latérale → on retombe
// sur la hauteur de sa colonne d'eau (h). Une cascade plus courte est signalée (montée « chiante »).
export interface ShortCascadeProblem { x: number; w: number; top: number; climb: number }
export function shortCascades(level: LevelDef, minTiles: number): ShortCascadeProblem[] {
  const surfaces: Plat[] = [...level.platforms, ...(level.bridges ?? [])]
  const out: ShortCascadeProblem[] = []
  for (const h of level.hazards ?? []) {
    if (h.kind !== 'water' || h.water !== 'cascade') continue
    const top = h.top ?? 0
    // footings marchables qui BORDENT la colonne (jointifs au bord gauche/droit) et sont EN CONTREBAS
    const borders = surfaces.filter((p) => (p.x + p.w === h.x || p.x === h.x + h.w) && p.y > top)
    const climb = borders.length ? Math.max(...borders.map((p) => p.y)) - top : (h.h ?? 0)
    if (climb < minTiles) out.push({ x: h.x, w: h.w, top, climb })
  }
  return out
}

// Monstres TERRESTRES (non aériens) mal posés : un spawn avec y doit reposer sur une surface
// (plateforme) présente à cette rangée, assez large pour patrouiller (≥ minWidth tuiles). Les
// oiseaux (aerial) volent → exclus. Les spawns sans y sont au sol (toujours valides).
export function monstersOffSurface(level: LevelDef, isAerial: (id: string) => boolean, minWidth = 3): SpawnProblem[] {
  const out: SpawnProblem[] = []
  for (const s of level.spawns) {
    if (s.y === undefined || isAerial(s.monsterId)) continue
    const plat = level.platforms.find((p) => s.x >= p.x - 1 && s.x <= p.x + p.w && p.y === s.y)
    if (!plat) { out.push({ monsterId: s.monsterId, x: s.x, y: s.y, reason: 'aucune-surface' }); continue }
    if (plat.w < minWidth) out.push({ monsterId: s.monsterId, x: s.x, y: s.y, reason: 'surface-trop-etroite' })
  }
  return out
}

// Problèmes de DÉPART / SORTIE : le départ peut être AU SOL ou surélevé (varié par graine, R171),
// mais jamais collé au plafond ni sous le sol du monde, et la sortie doit exister à une altitude
// NETTEMENT différente du départ (≥ 3 rangées) → un vrai trajet vertical entre départ et sortie.
export function startExitProblems(level: LevelDef, minAltGap = 3): string[] {
  const groundRow = groundRowFor(level.heightTiles)
  const out: string[] = []
  if (!level.start) { out.push('départ absent'); return out }
  if (!level.exit) { out.push('sortie absente'); return out }
  if (level.start.y > groundRow) out.push('départ sous le sol du monde')
  if (level.start.y <= 2) out.push('départ collé au plafond')
  if (Math.abs(level.start.y - level.exit.y) < minAltGap) out.push('sortie à la même altitude que le départ')
  return out
}

// Un coffre AU FOND (sans y) est atteignable par NAGE si son plan d'eau (bassin marine) est ENTRABLE
// depuis une surface marchable atteignable adjacente : il faut (1) une COLONNE OUVERTE en surface
// (non scellée par un pont) pour PLONGER, et (2) une surface marchable ATTEIGNABLE qui BORDE le
// bassin au niveau de sa surface (pour rejoindre le point de plongée puis RESSORTIR). Un lac entouré
// de falaises (aucune surface joignable à son niveau) ou entièrement ponté rend le coffre injoignable.
function bottomChestReachable(level: LevelDef, cx: number, reachSurfaces: Plat[], groundRow: number): boolean {
  const water = (level.hazards ?? []).find((h) => h.kind === 'water' && h.water === 'basin' && cx >= h.x && cx < h.x + h.w)
  if (!water) {
    // pas dans l'eau → coffre posé au sol : injoignable seulement s'il est au-dessus d'un trou mortel
    return !(level.gaps ?? []).some((g) => cx >= g.x && cx < g.x + g.w)
  }
  const surfaceRow = water.top ?? groundRow - 2
  const covers = (x: number) => [...level.platforms, ...(level.bridges ?? [])]
    .some((p) => x >= p.x && x < p.x + p.w && Math.abs(p.y - surfaceRow) <= 1)
  // (1) au moins une colonne d'eau OUVERTE en surface (par où plonger dans le bassin)
  let open = false
  for (let x = water.x; x < water.x + water.w; x++) if (!covers(x)) { open = true; break }
  if (!open) return false
  // (2) une surface marchable ATTEIGNABLE borde le bassin au niveau de sa surface (accès + sortie)
  return reachSurfaces.some((s) => Math.abs(s.y - surfaceRow) <= 1 && s.x <= water.x + water.w && s.x + s.w >= water.x)
}

// Coffres injoignables : posés sur une plateforme absente/injoignable (coffre AVEC y), OU au fond
// d'un bassin qu'on ne peut pas entrer/ressortir à la nage (coffre SANS y). Le test casse le build
// si un seul coffre est injoignable (bug du coffre dans un lac inaccessible).
export function unreachableChests(level: LevelDef): ChestProblem[] {
  const bad = new Set(unreachablePlatforms(level))
  const reach = computeReach(level)
  const reachSurfaces = [reach.ground, ...[...reach.reachable].map((i) => reach.nodes[i]!)]
  const out: ChestProblem[] = []
  for (const c of level.props ?? []) {
    if (c.kind !== 'coffre') continue
    if (c.y !== undefined) {
      // coffre POSÉ sur une plateforme : elle doit exister ET être atteignable
      const plat = level.platforms.find((p) => c.x >= p.x && c.x < p.x + p.w && c.y === p.y - 1)
      if (!plat || bad.has(plat)) out.push({ x: c.x, y: c.y })
      continue
    }
    // coffre AU FOND (sans y) : au sol marchable, ou au fond d'un bassin atteignable à la NAGE
    if (!bottomChestReachable(level, c.x, reachSurfaces, reach.groundRow)) out.push({ x: c.x, y: reach.groundRow - 1 })
  }
  return out
}

// ─── PLAFOND DE GROTTE : DÉGAGEMENT DE SAUT GARANTI (grottes, grottes-tunnels, grottes noyées) ──
// Un PLAFOND DE ROCHE solide (tunnel) doit laisser un DÉGAGEMENT ≥ minClear rangées au-dessus de la
// surface qu'il coiffe (sol marchable OU surface d'eau), sinon le panda se cogne / reste coincé sous
// la roche. On ne contrôle QUE les plafonds SOLIDES qui coiffent une surface EN DESSOUS d'eux (dans
// leur portée x) ; un plafond IMMERGÉ (sous la surface de l'eau, sans chemin d'air dessous) n'est
// pas concerné (on nage dessous). Le dégagement > hauteur de saut (≈ 4 tuiles) → min 5 rangées.
export interface CeilingProblem { x: number; w: number; clearance: number }
export function caveCeilingClearance(level: LevelDef, minClear = 5): CeilingProblem[] {
  const ceilings = (level.rockBands ?? []).filter((r) => r.solid)
  const surfaces: { x: number; w: number; row: number }[] = [
    ...level.platforms.map((p) => ({ x: p.x, w: p.w, row: p.y })),
    ...(level.bridges ?? []).map((b) => ({ x: b.x, w: b.w, row: b.y })),
    ...(level.hazards ?? []).filter((h) => h.kind === 'water' && h.top !== undefined).map((h) => ({ x: h.x, w: h.w, row: h.top! })),
  ]
  // chevauchement SIGNIFICATIF (≥ 3 colonnes) : on mesure le dégagement au-dessus du VRAI sol du
  // tunnel (qui court sur toute la portée), pas au-dessus d'une berge de module voisin qui affleure
  // d'une ou deux colonnes à la couture (faux positif de bord, sans risque de cognement réel).
  const MIN_OVERLAP = 3
  const overlapW = (ax: number, aw: number, bx: number, bw: number) => Math.min(ax + aw, bx + bw) - Math.max(ax, bx)
  const out: CeilingProblem[] = []
  for (const c of ceilings) {
    const bottomRow = c.y + c.h - 1 // rangée du BAS de la dalle de plafond
    // surface la plus PROCHE strictement EN DESSOUS (row > bottomRow) chevauchant AMPLEMENT la portée x
    let closest: number | undefined
    for (const s of surfaces) {
      if (overlapW(c.x, c.w, s.x, s.w) < MIN_OVERLAP || s.row <= bottomRow) continue
      if (closest === undefined || s.row < closest) closest = s.row
    }
    if (closest === undefined) continue // aucun chemin d'air sous le plafond (ex. plafond immergé) → hors sujet
    const clearance = closest - bottomRow
    if (clearance < minClear) out.push({ x: c.x, w: c.w, clearance })
  }
  return out
}

// ─── ANTI-ENNUI : LONGUE BANDE DE PLAT VIDE (retour user : « parfois une immense bande de plat sans
// rien, je me fais chier ») ──────────────────────────────────────────────────────────────────────
// Détecte une SUITE de tuiles de surface marchable à la MÊME altitude (sol plat, aucun changement de
// relief) SANS AUCUN élément d'intérêt sur toute sa longueur : 0 monstre, 0 coffre, 0 pic, 0 trou,
// 0 plan d'eau, 0 échelle/cascade, 0 rockBand, 0 panneau, ET aucune plateforme AU-DESSUS (relief en
// surplomb). Les décorations pures (touffe d'herbe / champignon, posées à intervalle fixe sur CHAQUE
// niveau par l'assembleur) NE comptent PAS : elles ne « meublent » rien pour le joueur. Un tel désert
// plat qui DÉPASSE `maxRun` tuiles est un problème d'ennui → la génération ne retient que les seeds
// sans une telle bande (cf. clean() dans levels.ts), et le test tests/levels le vérifie sur tous les
// niveaux. Fonction PURE et déterministe.
//
// Modèle : la surface marchable d'une colonne = la plateforme/pont la PLUS HAUTE qui la couvre, sinon
// le SOL du monde (groundRow) si la colonne n'est ni un trou ni un plan d'eau (sinon `null` = rupture,
// qui BORNE la bande — un trou/une cuve est lui-même un point d'intérêt). Une « bande plate » = des
// colonnes consécutives à surface marchable de MÊME rangée ; elle est « vide » si aucune de ses
// colonnes ne porte d'intérêt.
export interface EmptyFlatProblem { x: number; w: number; row: number }
export function longEmptyFlats(level: LevelDef, maxRun = 16): EmptyFlatProblem[] {
  const W = level.widthTiles
  const groundRow = groundRowFor(level.heightTiles)
  const gaps = level.gaps ?? []
  const waters = (level.hazards ?? []).filter((h) => h.kind === 'water')
  const spikes = (level.hazards ?? []).filter((h) => h.kind === 'spikes')
  const surfaces: Plat[] = [...level.platforms, ...(level.bridges ?? [])]
  const isGap = (x: number) => gaps.some((g) => x >= g.x && x < g.x + g.w)
  const inWater = (x: number) => waters.some((h) => x >= h.x && x < h.x + h.w)
  // surface marchable la plus HAUTE couvrant la colonne ; sinon le sol, sauf trou/eau (rupture = null)
  const surfaceRow = (x: number): number | null => {
    let best: number | null = null
    for (const p of surfaces) if (x >= p.x && x < p.x + p.w) best = best === null ? p.y : Math.min(best, p.y)
    if (best !== null) return best
    if (isGap(x) || inWater(x)) return null
    return groundRow
  }
  const hasSpike = (x: number) => spikes.some((s) => x >= s.x && x < s.x + s.w)
  const hasLadder = (x: number) => (level.ladders ?? []).some((l) => x >= l.x - 1 && x <= l.x + 1)
  const hasRock = (x: number) => (level.rockBands ?? []).some((r) => x >= r.x && x < r.x + r.w)
  const hasSign = (x: number) => (level.signs ?? []).some((s) => x >= s.x - 1 && x <= s.x + 1)
  // seuls les COFFRES meublent (l'herbe/le champignon décoratifs, eux, ne comptent pas)
  const hasChest = (x: number) => (level.props ?? []).some((p) => p.kind === 'coffre' && x >= p.x - 1 && x <= p.x + 1)
  const hasSpawn = (x: number) => level.spawns.some((s) => x >= s.x - 1 && x <= s.x + 1)
  // une plateforme/un pont AU-DESSUS de la surface marchable de la colonne (relief en surplomb)
  const overhead = (x: number, row: number) => surfaces.some((p) => x >= p.x && x < p.x + p.w && p.y < row)
  const interest = (x: number, row: number) =>
    hasSpawn(x) || hasChest(x) || hasSpike(x) || hasLadder(x) || hasRock(x) || hasSign(x) || overhead(x, row)

  const out: EmptyFlatProblem[] = []
  let runRow: number | null = null
  let runStart = 0
  let runLen = 0
  let empty = true
  const flush = () => { if (runRow !== null && empty && runLen > maxRun) out.push({ x: runStart, w: runLen, row: runRow }) }
  for (let x = 0; x < W; x++) {
    const r = surfaceRow(x)
    if (r === runRow && r !== null) {
      runLen++
      if (interest(x, r)) empty = false
    } else {
      flush()
      runRow = r
      runStart = x
      runLen = r === null ? 0 : 1
      empty = r === null ? true : !interest(x, r)
    }
  }
  flush()
  return out
}

// ─── REBORDS DE PLAN D'EAU À NIVEAU (retour user : « rebord gauche plus haut que droite ») ───
// La SURFACE d'un plan d'eau marine (ou d'une cuve de lave) est HORIZONTALE : ses DEUX berges
// doivent border l'eau à la MÊME altitude (= la rangée de surface). Une berge plus basse que
// l'autre = l'eau déborderait d'un côté → géométrie absurde. On lit, à la colonne juste HORS de
// chaque bord de la cuve, la surface marchable la plus HAUTE (min y) : elle doit tomber pile sur la
// rangée de surface de l'eau. Un bord OUVERT (openSide, passage sous-marin) est exempté : de ce
// côté la cuve n'a pas de berge de surface (on ressort immergé). Une berge ABSENTE (bord de module)
// n'est pas fautive (la continuité vient du module voisin).
export interface BankProblem { x: number; w: number; side: 'gauche' | 'droite'; bankRow: number; surfaceRow: number }
export function unlevelWaterBanks(level: LevelDef): BankProblem[] {
  const surfaces: Plat[] = [...level.platforms, ...(level.bridges ?? [])]
  // surface marchable la plus HAUTE (min y) couvrant la colonne col — sinon undefined.
  const topSurfaceAt = (col: number): number | undefined => {
    let best: number | undefined
    for (const s of surfaces) if (col >= s.x && col < s.x + s.w) best = best === undefined ? s.y : Math.min(best, s.y)
    return best
  }
  const out: BankProblem[] = []
  for (const h of level.hazards ?? []) {
    if (h.kind !== 'water' || (h.water !== 'basin' && h.water !== 'lave')) continue
    const surfaceRow = h.top ?? groundRowFor(level.heightTiles) - 2
    const openL = h.openSide === 'left' || h.openSide === 'both'
    const openR = h.openSide === 'right' || h.openSide === 'both'
    if (!openL) { const b = topSurfaceAt(h.x - 1); if (b !== undefined && b !== surfaceRow) out.push({ x: h.x, w: h.w, side: 'gauche', bankRow: b, surfaceRow }) }
    if (!openR) { const b = topSurfaceAt(h.x + h.w); if (b !== undefined && b !== surfaceRow) out.push({ x: h.x, w: h.w, side: 'droite', bankRow: b, surfaceRow }) }
  }
  return out
}

// ─── EAU SUSPENDUE DANS LE VIDE (retour user : « de l'eau qui vole », « rebord gauche plus haut ») ──
// La SURFACE d'un lac marine est HORIZONTALE et PLANE : la cuve doit être FERMÉE sur ses deux bords,
// bancs à la MÊME rangée que la surface. `unlevelWaterBanks` (ci-dessus) EXEMPTE les bords ouverts
// (openSide, ex-passage sous-marin) — c'est justement le trou par lequel passait le lac « suspendu » :
// un bord ouvert dont le sol voisin est BIEN PLUS BAS que la surface (colonne d'eau qui domine le
// terrain de plusieurs rangées, sans paroi de ce côté) = de l'eau qui vole. On l'attrape ici : pour
// chaque cuve marine/lave à bord OUVERT, on lit la surface marchable juste à l'extérieur de ce bord ;
// si elle tombe SOUS la ligne d'eau (au-delà d'1 rangée de tolérance), la surface flotte → faute.
const SUSPENDED_TOL = 1 // rangées de tolérance : au-delà, le sol voisin est trop bas → eau suspendue
export function suspendedWaterBanks(level: LevelDef): BankProblem[] {
  const surfaces: Plat[] = [...level.platforms, ...(level.bridges ?? [])]
  const topSurfaceAt = (col: number): number | undefined => {
    let best: number | undefined
    for (const s of surfaces) if (col >= s.x && col < s.x + s.w) best = best === undefined ? s.y : Math.min(best, s.y)
    return best
  }
  const out: BankProblem[] = []
  for (const h of level.hazards ?? []) {
    if (h.kind !== 'water' || (h.water !== 'basin' && h.water !== 'lave')) continue
    const surfaceRow = h.top ?? groundRowFor(level.heightTiles) - 2
    const openL = h.openSide === 'left' || h.openSide === 'both'
    const openR = h.openSide === 'right' || h.openSide === 'both'
    // on ne regarde QUE les bords ouverts : les bords fermés sont déjà couverts par unlevelWaterBanks.
    if (openL) { const b = topSurfaceAt(h.x - 1); if (b !== undefined && b > surfaceRow + SUSPENDED_TOL) out.push({ x: h.x, w: h.w, side: 'gauche', bankRow: b, surfaceRow }) }
    if (openR) { const b = topSurfaceAt(h.x + h.w); if (b !== undefined && b > surfaceRow + SUSPENDED_TOL) out.push({ x: h.x, w: h.w, side: 'droite', bankRow: b, surfaceRow }) }
  }
  return out
}

// ─── ANTI-SOFTLOCK : « pas de piège sans retour » (retour user : on tombe, on est coincé vivant) ──
// Depuis TOUTE position atteignable, si le joueur tombe sur un palier inférieur il doit TOUJOURS
// pouvoir REMONTER vers la sortie (échelle/plateformes/nage) OU la chute doit être MORTELLE (trou
// jusqu'au fond du monde, lave). On rejoue le MODÈLE DE MOUVEMENT (surfaces marchables reliées par
// saut/chute/échelle/nage) et on casse sur toute surface atteignable depuis le départ d'où la
// SORTIE est injoignable ET sur laquelle on ne peut pas mourir (donc coincé vivant, sans retour).
export interface DeadEndProblem { x: number; y: number; w: number; kind: string }
interface MSurf { y: number; x: number; w: number; kind: 'sol' | 'plat' | 'pont' }
export function deadEndSurfaces(level: LevelDef): DeadEndProblem[] {
  const W = level.widthTiles
  const groundRow = groundRowFor(level.heightTiles)
  const gaps = level.gaps ?? []
  const waters = (level.hazards ?? []).filter((h) => h.kind === 'water')
  const basins = waters.filter((h) => h.water === 'basin')
  const lavas = waters.filter((h) => h.water === 'lave')
  const isGap = (x: number) => gaps.some((g) => x >= g.x && x < g.x + g.w)
  const inBasin = (x: number) => basins.some((h) => x >= h.x && x < h.x + h.w)
  const inLava = (x: number) => lavas.some((h) => x >= h.x && x < h.x + h.w)
  const groundWalk = (x: number) => !isGap(x) && !inBasin(x) && !inLava(x) // le sol est-il foulable ?

  // 1) surfaces : segments de SOL foulable + plateformes + ponts
  const surfaces: MSurf[] = []
  let run = -1
  for (let x = 0; x <= W; x++) {
    const w = x < W && groundWalk(x)
    if (w && run < 0) run = x
    if (!w && run >= 0) { surfaces.push({ y: groundRow, x: run, w: x - run, kind: 'sol' }); run = -1 }
  }
  for (const p of level.platforms) surfaces.push({ y: p.y, x: p.x, w: p.w, kind: 'plat' })
  for (const b of level.bridges ?? []) surfaces.push({ y: b.y, x: b.x, w: b.w, kind: 'pont' })

  const N = surfaces.length
  const hgapOf = (a: MSurf, b: MSurf) => Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
  const covers = (s: MSurf, x: number) => x >= s.x - 1 && x < s.x + s.w + 1
  const adj: Set<number>[] = Array.from({ length: N }, () => new Set())
  const canDie = new Array<boolean>(N).fill(false)

  // 2a) SAUT (haut / travers) : modèle de parabole partagé avec platforming.canReach
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j) continue
    if (canReach(surfaces[i]!.y, surfaces[j]!, hgapOf(surfaces[i]!, surfaces[j]!))) adj[i]!.add(j)
  }
  // 2b) CHUTE : on marche jusqu'à une colonne de la surface (ou son bord) et on tombe sur la surface
  // la plus HAUTE strictement en dessous ; rien dessous → gap/lave = mort, bassin = nage (ressort sur
  // une berge OU se noie = mort), passage ouvert = ressort sur le côté.
  for (let i = 0; i < N; i++) {
    const a = surfaces[i]!
    for (let x = a.x - 1; x <= a.x + a.w; x++) {
      if (x < 0 || x >= W) continue
      let best = -1, bestY = Infinity
      for (let j = 0; j < N; j++) {
        const b = surfaces[j]!
        if (j === i || b.y <= a.y || !covers(b, x)) continue
        if (b.y < bestY) { bestY = b.y; best = j }
      }
      if (best >= 0) { adj[i]!.add(best); continue }
      if (inLava(x)) { canDie[i] = true; continue }
      if (inBasin(x)) {
        canDie[i] = true // noyade possible
        const bas = basins.find((h) => x >= h.x && x < h.x + h.w)!
        const top = bas.top ?? groundRow - 2
        for (let j = 0; j < N; j++) {
          const b = surfaces[j]!
          if (Math.abs(b.y - top) <= 1 && b.x <= bas.x + bas.w && b.x + b.w >= bas.x) adj[i]!.add(j)
          const os = bas.openSide
          if ((os === 'right' || os === 'both') && Math.abs(b.x - (bas.x + bas.w)) <= 1) adj[i]!.add(j)
          if ((os === 'left' || os === 'both') && Math.abs((b.x + b.w) - bas.x) <= 1) adj[i]!.add(j)
        }
        continue
      }
      if (isGap(x)) canDie[i] = true // chute mortelle jusqu'au fond du monde
    }
  }
  // 2c) ÉCHELLES (montée/descente = lien bidirectionnel pied ↔ palier de sommet)
  for (const l of (level.ladders ?? []) as Ladder[]) {
    const footRow = l.y + l.h
    const tops: number[] = [], feet: number[] = []
    for (let j = 0; j < N; j++) {
      const b = surfaces[j]!
      const drop = b.y - l.y
      if (drop >= 1 && drop <= 2 && l.x >= b.x - 1 && l.x <= b.x + b.w + 1) tops.push(j)
      const grounded = footRow >= groundRow ? b.kind === 'sol' : Math.abs(b.y - footRow) <= ROW_TOL
      if (grounded && l.x >= b.x - 1 && l.x <= b.x + b.w + 1) feet.push(j)
    }
    for (const t of tops) for (const f of feet) { adj[t]!.add(f); adj[f]!.add(t) }
  }

  // 3) surface de DÉPART et de SORTIE
  const findSurf = (pt?: { x: number; y: number }): number => {
    if (!pt) return -1
    for (let j = 0; j < N; j++) { const b = surfaces[j]!; if (pt.x >= b.x - 1 && pt.x <= b.x + b.w && Math.abs(b.y - pt.y) <= 1) return j }
    return -1
  }
  let startI = findSurf(level.start)
  if (startI < 0) startI = surfaces.findIndex((s) => s.kind === 'sol')
  let exitI = findSurf(level.exit)
  if (exitI < 0) exitI = surfaces.reduce((acc, s, j) => (s.kind === 'sol' && (acc < 0 || s.x + s.w > surfaces[acc]!.x + surfaces[acc]!.w) ? j : acc), -1)
  if (startI < 0 || exitI < 0) return [] // niveau sans départ/sortie exploitable → hors de portée de ce contrôle

  const bfs = (from: number, graph: Set<number>[]): Set<number> => {
    const seen = new Set([from]); const q = [from]
    while (q.length) { const u = q.shift()!; for (const v of graph[u]!) if (!seen.has(v)) { seen.add(v); q.push(v) } }
    return seen
  }
  const radj: Set<number>[] = Array.from({ length: N }, () => new Set())
  for (let i = 0; i < N; i++) for (const j of adj[i]!) radj[j]!.add(i)
  const reachFromStart = bfs(startI, adj)
  const canReachExit = bfs(exitI, radj)

  const out: DeadEndProblem[] = []
  for (const i of reachFromStart) {
    if (canReachExit.has(i) || canDie[i]) continue
    const s = surfaces[i]!
    out.push({ x: s.x, y: s.y, w: s.w, kind: s.kind })
  }
  return out
}
