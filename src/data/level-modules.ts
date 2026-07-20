// ─── KIT DE MODULES DE NIVEAU (couche d'authoring) ──────────────────────────────────────────
// Voir docs/level-module-kit.md. On décrit un niveau comme une LISTE DE MODULES composables posés
// bout à bout (gauche → droite). L'assembleur `buildLevelFromModules` tire une largeur déterministe
// dans chaque [min,max], accroche altSortie(N) ≈ altEntrée(N+1) (rebasage automatique de l'altitude
// courante → jamais de marche infranchissable), remplit chaque colonne selon fillBas/fillHaut, puis
// EXPAND vers la structure LevelDef existante (platforms/hazards/gaps/bridges/spawns/props/start/exit).
//
// PRINCIPE DE JOUABILITÉ (correct-par-construction) :
// - la surface marchable est une POLYLIGNE de paliers (steps) reliés par des marches ≤ 3 rangées,
//   horizontalement adjacentes → chaque palier est atteignable du précédent au saut simple, et la
//   chaîne part du SOL (alt 0) → tout est atteignable (reachable.test vert sans échelle).
// - chaque module a des BERGES solides à l'entrée et à la sortie (jonctions toujours praticables).
// - l'eau est TOUJOURS en cuve de pierre : 'marine' (bleu marine, noyade) ou 'cascade' (bleu clair,
//   REMONTABLE, pas de noyade) — jamais de nappe libre. Les murs/fond sont posés par le moteur.
// - silhouette COLLINES : on monte puis on redescend ; ≤ 3 paliers empilés partout ; hauteur du
//   monde = enveloppe des modules (souvent ~22-34 tuiles, pas de tour géante).

import type { LevelDef } from './levels'

// altitude = nombre de rangées AU-DESSUS du sol (0 = surface du sol). row = groundRow - alt.
export type Fill = 'air' | 'sol' | 'roche' | 'vide' | 'marine' | 'cascade' | 'pics'
export type ModuleKind =
  | 'plateau' | 'colline' | 'escalier' | 'descente' | 'gue' | 'corniche-vide'
  | 'bassin' | 'cascade' | 'grotte' | 'arene' | 'crete' | 'volee'

export interface Module {
  kind: ModuleKind
  widthRange: [number, number] // largeur en tuiles (on tire dedans, déterministe)
  // delta d'altitude du module (exit - entry, en rangées) : l'assembleur rebase l'entrée sur
  // l'altitude courante, donc seul le DELTA compte (l'accroche est automatique).
  rise?: number
  fillBelow: Fill // sous la surface (sol/roche = solide, vide = trou mortel, marine/cascade = cuve)
  fillAbove: Fill // au-dessus (air par défaut, roche = plafond/grotte)
  tags: string[]
  // peuplement : ids de monstres terrestres (posés sur la surface) et aériens (oiseaux) — l'assembleur
  // les répartit sur la portée du module. Les coffres (secret) sont posés par le générateur du kind.
  ground?: string[]
  birds?: string[]
  spawnHere?: boolean // départ du joueur dans ce module (posé à mi-portée sur la surface)
  exitHere?: boolean // PORTE de sortie dans ce module
}

// ─── RNG déterministe (mulberry32) : pas de Math.random (interdit) ──────────────────────────
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIMPLE_JUMP_ROWS = 3 // marche maximale garantie au saut simple (rise ≈ 96px < 130px)

// ─── Représentation intermédiaire en espace ALTITUDE (converti en rows à la fin) ────────────
interface Piece {
  platforms: { x: number; alt: number; w: number }[]
  ceilings: { x: number; alt: number; w: number }[] // plafond de roche (fillAbove roche)
  gaps: { x: number; w: number }[]
  spikes: { x: number; w: number }[]
  bridges: { x: number; alt: number; w: number }[]
  // cuves d'eau : marine (noyade) ou cascade (remontable). bankAlt = rangée des berges (surface d'eau
  // juste dessous) ; l'eau descend jusqu'au sol (fond). Le moteur pose murs + fond + déco.
  waters: { x: number; w: number; kind: 'marine' | 'cascade'; bankAlt: number }[]
  spawns: { monsterId: string; x: number; alt?: number; aerial?: boolean }[]
  props: { kind: string; x: number; alt?: number }[]
  start?: { x: number; alt: number }
  exit?: { x: number; alt: number }
  exitAlt: number // altitude de sortie (pour chaîner le module suivant)
}

function emptyPiece(exitAlt: number): Piece {
  return { platforms: [], ceilings: [], gaps: [], spikes: [], bridges: [], waters: [], spawns: [], props: [], exitAlt }
}

// Rampe de paliers : suite de plateformes ADJACENTES de fromAlt à toAlt par marches ≤3 rangées.
// Les alt ≤ 0 (niveau du sol) ne posent PAS de plateforme (on marche sur le sol) — sauf si
// keepGround (utile quand le sol est gappé et qu'il faut une vraie plateforme).
function ramp(x0: number, w: number, fromAlt: number, toAlt: number, keepGround = false): { x: number; alt: number; w: number }[] {
  const diff = toAlt - fromAlt
  const count = Math.max(1, Math.ceil(Math.abs(diff) / SIMPLE_JUMP_ROWS))
  const step = diff / count
  const segW = Math.max(3, Math.floor(w / count))
  const out: { x: number; alt: number; w: number }[] = []
  let x = x0
  for (let i = 0; i < count; i++) {
    const alt = Math.round(fromAlt + step * (i + 1))
    const segw = i === count - 1 ? x0 + w - x : segW
    if (segw <= 0) break
    if (alt >= 1 || keepGround) out.push({ x, alt: Math.max(keepGround ? 0 : 1, alt), w: segw })
    x += segw
  }
  return out
}

// répartit n items sur la portée [0,w) à des x réguliers (déterministe)
function spread(w: number, n: number): number[] {
  if (n <= 0) return []
  return Array.from({ length: n }, (_, i) => Math.round((w * (i + 1)) / (n + 1)))
}

// ─── Générateur d'un module (espace altitude, x local 0..w) ─────────────────────────────────
function buildModule(m: Module, rng: () => number, w: number, entryAlt: number): Piece {
  const bank = 3 // largeur des berges solides d'entrée/sortie
  const groundMobs = m.ground ?? []
  const birds = m.birds ?? []
  const p = emptyPiece(entryAlt)
  const rise = m.rise ?? 0
  const exitAlt = Math.max(0, entryAlt + rise)
  p.exitAlt = exitAlt

  // pose les monstres terrestres sur la surface (alt lue plus bas selon le kind) et les oiseaux en l'air
  const placeBirds = (surfaceAlt: number) => {
    const xs = spread(w, birds.length)
    birds.forEach((id, i) => p.spawns.push({ monsterId: id, x: xs[i]!, alt: surfaceAlt + 6 + (i % 2) * 2, aerial: true }))
  }

  switch (m.kind) {
    case 'plateau':
    case 'arene': {
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      placeBirds(alt)
      p.exitAlt = alt
      break
    }
    case 'colline': {
      const peak = entryAlt + Math.max(3, 3 + Math.floor(rng() * 4))
      const half = Math.floor(w / 2)
      p.platforms.push(...ramp(0, half, entryAlt, peak))
      p.platforms.push(...ramp(half, w - half, peak, exitAlt))
      placeBirds(peak)
      break
    }
    case 'escalier':
    case 'descente': {
      p.platforms.push(...ramp(0, w, entryAlt, exitAlt))
      placeBirds(Math.max(entryAlt, exitAlt))
      break
    }
    case 'gue': {
      // gués : berges + pas de pierre au-dessus du VIDE (trous mortels ≤3 tuiles). Surface à alt courante.
      const alt = entryAlt
      const stoneW = 4, gapW = 3
      let x = 0
      if (alt >= 1) p.platforms.push({ x: 0, alt, w: bank }); x = bank
      while (x < w - bank - gapW) {
        p.gaps.push({ x, w: gapW }) // trou dans le sol
        x += gapW
        const sw = Math.min(stoneW, w - bank - x)
        if (sw <= 0) break
        if (alt >= 1) p.platforms.push({ x, alt, w: sw })
        x += sw
      }
      if (alt >= 1) p.platforms.push({ x: Math.max(x, w - bank), alt, w: bank }) // berge droite
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'corniche-vide':
    case 'crete': {
      // corniches/arête larges au-dessus d'un trou mortel + oiseaux. Berges solides à l'entrée/sortie,
      // VIDE (trous dans le sol) sur toute la zone centrale, corniches suspendues CONTIGUËS (hgap ≤3,
      // reliées de berge à berge → chaîne atteignable) à alt ~courant, légère ondulation.
      const alt = Math.max(entryAlt, m.kind === 'crete' ? 4 : 3)
      const bw = bank
      p.platforms.push({ x: 0, alt, w: bw }) // berge gauche
      const rightBergeX = w - bw
      // trou mortel sous toute la zone centrale (tranches de 3 tuiles, chacune franchissable)
      for (let gx = bw; gx < rightBergeX; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, rightBergeX - gx) })
      // corniches larges 4, hgap 3 → chaîne saut simple ; dernière corniche flush à la berge droite
      let x = bw
      let toggle = 0
      const pw = 4
      while (x + pw < rightBergeX) {
        const calt = Math.max(2, alt - (toggle % 2))
        // clampe la largeur pour finir juste avant la berge droite
        const pwn = Math.min(pw, rightBergeX - x)
        p.platforms.push({ x, alt: calt, w: pwn })
        x += pwn + 3 // gap de 3 (≤ saut simple) jusqu'à la corniche suivante
        toggle++
      }
      // corniche de raccord flush à la berge droite si le dernier saut serait trop long
      if (rightBergeX - x > 0 && rightBergeX - x <= 4) p.platforms.push({ x, alt, w: rightBergeX - x })
      p.platforms.push({ x: rightBergeX, alt, w: bw }) // berge droite
      placeBirds(alt + 3)
      p.exitAlt = alt
      break
    }
    case 'bassin': {
      // cuve marine profonde en VALLÉE : berges hautes reliées par rampes, eau profonde au milieu
      // (murs rigides posés par le moteur), pont à trou central, coffre au FOND (plongée/apnée,
      // noyade). Berges 4 rangées au-dessus de l'entrée → eau vraiment profonde.
      const bankAlt = entryAlt + 4
      const rampW = 5
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // berge gauche montante
      const wx = rampW, ww = w - 2 * rampW
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt })
      // pont à bankAlt en 2 segments avec un trou central de 3 tuiles (on plonge par le trou)
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      p.platforms.push(...ramp(wx + ww, w - (wx + ww), bankAlt, exitAlt)) // berge droite descendante
      p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // au fond (sol)
      placeBirds(bankAlt + 2)
      break
    }
    case 'cascade': {
      // cascade claire REMONTABLE (bleu clair, pas de noyade) : depuis la corniche BASSE on saute dans
      // la colonne et le courant ASCENDANT nous porte vers la corniche HAUTE + coffre secret. Une
      // RAMPE DE PALIERS parallèle garantit l'accès à la corniche haute au saut simple (reachable.test) ;
      // la cascade est le raccourci fun.
      const low = Math.max(entryAlt, 1)
      const top = low + Math.max(4, 4 + Math.floor(rng() * 2))
      // allocation séquentielle des portées (jamais de débordement) : corniche basse | colonne (2) |
      // rampe montante | corniche haute (5) | rampe de redescente jusqu'au bord droit.
      const L = Math.max(4, Math.floor(w * 0.22))
      const cornW = 5
      const upW = Math.max(4, Math.min(Math.floor(w * 0.3), w - L - 2 - cornW - 2))
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche basse d'accès
      p.waters.push({ x: L, w: 2, kind: 'cascade', bankAlt: top }) // colonne de cascade (remontée fun)
      p.platforms.push(...ramp(L + 2, upW, low, top)) // rampe montante (accès garanti), sautée par-dessus la colonne
      const topX = L + 2 + upW
      p.platforms.push({ x: topX, alt: top, w: cornW }) // corniche haute (sortie de cascade)
      p.props.push({ kind: 'coffre', x: topX + 2, alt: top + 1 }) // coffre POSÉ sur la corniche (1 rangée au-dessus)
      const downStart = topX + cornW
      if (w - downStart >= 1) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt)) // redescente vers la sortie
      placeBirds(top + 2)
      break
    }
    case 'grotte': {
      // tunnel : sol de roche, mobs dans le boyau, encaissé entre deux crêtes de roche (déco). NOTE :
      // un vrai plafond de roche à collision (fillAbove roche) n'est pas encore rendu par le moteur —
      // on garde le boyau au sol ; le plafond sera ajouté quand le moteur saura poser une dalle
      // « anti-remontée » (les plateformes actuelles sont one-way, traversables par le bas).
      const alt = Math.max(entryAlt, 2)
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      p.exitAlt = alt
      break
    }
    case 'volee': {
      // plein air envahi d'oiseaux, abris épars au sol. Surface à alt courant, quelques plateformes-abris.
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      const shelters = spread(w, 3)
      shelters.forEach((sx, i) => p.platforms.push({ x: Math.max(0, sx - 2), alt: alt + 3 + (i % 2), w: 4 }))
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }
  }

  // Placement GÉNÉRIQUE des monstres terrestres : posés SUR les plateformes marchables assez larges
  // (≥4) à leur altitude réelle → jamais en l'air ni dans la roche, toujours de la place pour
  // patrouiller (validateur monstersOffSurface).
  const walkable = p.platforms.filter((pl) => pl.w >= 4).sort((a, b) => a.x - b.x)
  groundMobs.forEach((id, i) => {
    if (walkable.length === 0) { p.spawns.push({ monsterId: id, x: Math.round((w * (i + 1)) / (groundMobs.length + 1)) }); return }
    const pl = walkable[i % walkable.length]!
    const cx = Math.min(pl.x + pl.w - 2, Math.max(pl.x + 1, pl.x + Math.floor(pl.w / 2)))
    p.spawns.push({ monsterId: id, x: cx, alt: pl.alt })
  })
  return p
}

export interface AssembleOpts {
  id: string
  name: string
  biome: string
  seed?: string
}

// ─── Assembleur : modules → LevelDef ────────────────────────────────────────────────────────
export function buildLevelFromModules(modules: Module[], opts: AssembleOpts): LevelDef {
  const seed = hashSeed(opts.seed ?? opts.id)
  // 1) pièces en espace altitude, chaînées (entrée = altitude courante)
  const pieces: { piece: Piece; x0: number; w: number }[] = []
  let cursorX = 2 // petite marge de bord gauche
  // RAMPE D'AMORCE : le sol (alt 0) monte jusqu'à BASE_ALT au bord gauche. Le premier module (donc
  // le DÉPART) est ainsi posé à MI-HAUTEUR — routes vers le HAUT (collines suivantes) ET vers le BAS
  // (redescendre la rampe jusqu'au sol) — et toute la surface reste accrochée au sol (reachable).
  const BASE_ALT = 5
  const onbW = BASE_ALT * 2 + 3
  const onb = emptyPiece(BASE_ALT)
  onb.platforms = ramp(0, onbW, 0, BASE_ALT)
  pieces.push({ piece: onb, x0: cursorX, w: onbW })
  cursorX += onbW
  let runningAlt = BASE_ALT
  modules.forEach((m, i) => {
    const rng = mulberry32(seed + i * 2654435761)
    const [wmin, wmax] = m.widthRange
    const w = wmin + (hashSeed(opts.id + ':' + i + ':' + m.kind) % (wmax - wmin + 1))
    const piece = buildModule(m, rng, w, runningAlt)
    // départ / sortie
    if (m.spawnHere) piece.start = { x: Math.floor(w / 2), alt: runningAlt }
    if (m.exitHere) piece.exit = { x: w - 3, alt: piece.exitAlt }
    pieces.push({ piece, x0: cursorX, w })
    cursorX += w
    runningAlt = piece.exitAlt
  })
  const totalWidth = cursorX + 2

  // 2) enveloppe verticale : altitude max des surfaces/plafonds → hauteur du monde
  let maxAlt = 0
  for (const { piece } of pieces) {
    for (const pl of piece.platforms) maxAlt = Math.max(maxAlt, pl.alt)
  }
  // sol au bas ; headroom au-dessus du sommet. groundRow = maxAlt + marge. heightTiles = groundRow + 2.
  const groundRow = maxAlt + 6
  const heightTiles = groundRow + 2
  const row = (alt: number) => groundRow - alt

  // 3) EXPAND vers LevelDef
  const platforms: LevelDef['platforms'] = []
  const bridges: NonNullable<LevelDef['bridges']> = []
  const gaps: NonNullable<LevelDef['gaps']> = []
  const hazards: NonNullable<LevelDef['hazards']> = []
  const spawns: LevelDef['spawns'] = []
  const props: NonNullable<LevelDef['props']> = []
  let start: LevelDef['start']
  let exit: LevelDef['exit']

  for (const { piece, x0 } of pieces) {
    for (const pl of piece.platforms) platforms.push({ x: x0 + pl.x, y: row(pl.alt), w: pl.w })
    for (const b of piece.bridges) bridges.push({ x: x0 + b.x, y: row(b.alt), w: b.w })
    for (const g of piece.gaps) gaps.push({ x: x0 + g.x, w: g.w })
    for (const s of piece.spikes) hazards.push({ kind: 'spikes', x: x0 + s.x, w: s.w })
    for (const wtr of piece.waters) {
      const top = row(wtr.bankAlt) + 1 // surface d'eau juste sous les berges
      const depth = groundRow - top // jusqu'au fond (sol)
      hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, depth), water: wtr.kind === 'marine' ? 'basin' : 'cascade' })
    }
    for (const s of piece.spawns) spawns.push({ monsterId: s.monsterId, x: x0 + s.x, ...(s.alt !== undefined ? { y: row(s.alt) } : {}) })
    for (const pr of piece.props) props.push({ kind: pr.kind, x: x0 + pr.x, ...(pr.alt !== undefined ? { y: row(pr.alt) } : {}) })
    if (piece.start) start = { x: x0 + piece.start.x, y: row(piece.start.alt) }
    if (piece.exit) exit = { x: x0 + piece.exit.x, y: row(piece.exit.alt) }
  }

  // quelques décorations au sol (herbe/champignon selon le biome) réparties sur la largeur
  const decoKind = opts.biome === 'foret' || opts.biome === 'jungle' ? 'champignon' : 'herbe'
  for (const f of [0.18, 0.45, 0.72]) props.push({ kind: decoKind, x: Math.round(totalWidth * f) })

  // checkpoints répartis sur la largeur
  const checkpoints = [0.3, 0.6, 0.85].map((f) => ({ x: Math.round(totalWidth * f) }))

  return {
    id: opts.id, name: opts.name, biome: opts.biome,
    widthTiles: totalWidth, heightTiles,
    start, exit,
    platforms, bridges, gaps, hazards, spawns, props, checkpoints,
  }
}
