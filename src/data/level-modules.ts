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
import { MIN_LADDER_TILES, MAX_LADDER_TILES } from '../core/platforming'
import { MONSTERS } from './monsters'

// altitude = nombre de rangées AU-DESSUS du sol (0 = surface du sol). row = groundRow - alt.
// 'lave' = cuve de LAVE (enfer) : rendu rouge/orange incandescent, MORTELLE au contact (gros dégâts
// continus, cf. LevelScene.updateLava) — géométriquement une cuve de pierre comme 'marine', mais sans
// coffre de plongée (plonger = mourir).
export type Fill = 'air' | 'sol' | 'roche' | 'vide' | 'marine' | 'cascade' | 'lave' | 'pics'

// PHASE 2 — CATALOGUE ÉTENDU. On GARDE les 12 kinds historiques (les 15 niveaux non refondus en
// dépendent) et on AJOUTE ceux du catalogue user (docs/level-module-kit.md §PHASE 2), dédupliqués.
// Chaque kind porte des métadonnées de composition dans CATALOG (tier, famille, tags entrée/sortie,
// largeur variable). Les motifs à ÉCHELLE (flag ladder) réintroduisent la mécanique d'escalade.
export type ModuleKind =
  // historiques (12)
  | 'plateau' | 'colline' | 'escalier' | 'descente' | 'gue' | 'corniche-vide'
  | 'bassin' | 'cascade' | 'grotte' | 'arene' | 'crete' | 'volee'
  // fillers / respiration (D1)
  | 'ligne-droite' | 'marche' | 'descente-douce' | 'couloir-large' | 'petit-pont'
  | 'echelle-tranquille' | 'balcon' | 'double-sol'
  // traversée horizontale (D1–D3)
  | 'gap-grandissant' | 'ilots-reguliers' | 'ilots-irreguliers' | 'trou-filet' | 'pas-japonais' | 'triple-saut'
  // vertical / étages (D2–D4)
  | 'zigzag' | 'cage-echelles' | 'echelle-vs-sauts' | 'descente-controlee' | 'tour-creuse'
  // PASSERELLES FLOTTANTES EN ZIGZAG ASCENDANT : plateformes suspendues qui montent en alternant
  // gauche/droite (chaque saut franchissable), au-dessus du vide (rater = chute mortelle, jamais coincé)
  | 'passerelles-zigzag'
  // risque / récompense (D2–D4)
  | 'chemin-double' | 'detour-balcon' | 'fausse-sortie' | 'tresor-bassin'
  // tension / précision (D3–D5) — PHASE 2b : le moteur rend désormais les pics sur N'IMPORTE QUELLE
  // surface élevée (corniche/plateforme), pas seulement au sol → les motifs à PICS en hauteur sont
  // activés. Dégâts/overlap identiques quelle que soit la hauteur.
  | 'echelle-exposee' | 'couloir-pics' | 'pics-quinconce' | 'atterrissage-etroit' | 'faux-plat'
  // escaliers de PIERRE rigides (blocs solides isolés) — distincts des marches de TERRE one-way
  | 'escalier-pierre'
  // eau / cascade (D2–D4)
  | 'sortie-humide'
  // passage SOUS-MARIN : plonger par le haut d'un lac, ressortir sur le côté immergé
  | 'passage-immerge'
  // LAC EN U : plonger d'une corniche à hauteur H, nager sous un PLAFOND DE ROCHE immergé au milieu,
  // ressortir sur une corniche à la MÊME hauteur H (passage sous-marin symétrique)
  | 'lac-en-u'
  // GROTTE-TUNNEL : vrai boyau de roche (roche au-dessus ET en dessous) plus long/varié que 'grotte',
  // réservé aux biomes ROCHEUX / SOUTERRAINS (cave/montagne/carriere/enfer/jungle) — cavités franches
  | 'grotte-tunnel'
  // GROTTE SOUS-MARINE EN U : lac en U NOYÉ SOUS UN TOIT DE ROCHE (grotte inondée) — on plonge, on
  // traverse le fond immergé sous un plafond de roche, on remonte de l'autre côté ; coffre au fond
  | 'grotte-noyee'
  // ─── REFONTE DES MOTIFS D'EAU (retour joueur : « l'eau doit être un vrai PASSAGE ») ───────────
  // PLONGEOIR : corniche HAUTE qui SURPLOMBE (plongeoir) un bassin en CONTREBAS — on saute dedans
  // depuis la corniche, on nage, on ressort sur le rebord ; coffre au fond.
  | 'plongeoir'
  // PUITS : cuve marine ÉTROITE (2-4 tuiles) et PROFONDE, encadrée de 2 rebords de pierre qui
  // DÉPASSENT (margelle) — distinct du BASSIN large. On plonge par l'étroite ouverture ; coffre au fond.
  | 'puits'
  // CASCADE-BASSIN : une CASCADE remontable qui tombe dans un BASSIN marine (la chute alimente le
  // bassin). On peut plonger dans le bassin (coffre au fond) ou remonter la cascade vers la corniche haute.
  | 'cascade-bassin'
  // BOYAU IMMERGÉ (eau-passage) : tunnel marine à paroi OUVERTE (openSide) qu'il faut TRAVERSER À LA
  // NAGE pour progresser — plafond de roche immergé au milieu (on ne fait pas surface), on ressort par
  // le côté ouvert sur une corniche À NIVEAU (banc égal → cuve non suspendue).
  | 'boyau-immerge'
  // GROTTE DE DÉPART SOUTERRAINE : boyau de roche FERMÉ (roche jusqu'au plafond) contenant un bassin
  // marine immergé qu'il faut FRANCHIR À LA NAGE (plafond de roche submergé au milieu). Module de SPAWN.
  | 'grotte-depart'
  // ─── CHAÎNES VERTICALES VARIÉES (retour joueur : « varie les échelles ») ──────────────────────
  // ÉCHELLE → TROU → ÉCHELLE : on grimpe une échelle, on franchit un TROU mortel au saut sur le palier,
  // puis on grimpe une 2ᵉ échelle décalée jusqu'au sommet.
  | 'echelle-trou-echelle'
  // ÉCHELLE → ZIGZAG : une échelle mène à une suite de PASSERELLES en zigzag gauche-droite (monter puis
  // redescendre) au-dessus du vide, jusqu'à la sortie.
  | 'echelle-zigzag'
  // 2 ÉCHELLES DÉCALÉES : deux échelles nettement décalées horizontalement reliées par un large palier
  // intermédiaire (montée franche, pas de quinconce serré).
  | 'echelles-decalees'
  // PASSERELLES FLOTTANTES sur SOL PLEIN (variante « full sol » — cf. passerelles-zigzag « full trou ») :
  // mêmes passerelles alternées gauche/droite, mais posées AU-DESSUS D'UN SOL PLEIN continu (rater un
  // saut = retomber au sol, pas de chute mortelle). Corrige le « miroir bizarre » sous les passerelles.
  | 'passerelles-plein'
  // ─── R168 — ÉCHELLE-DESCENTE PIÉGÉE + VARIANTES DE CASCADES (retour joueur) ───────────────────
  // ÉCHELLE-DESCENTE PIÉGÉE : on DESCEND une échelle, un TROU MORTEL attend en bas, il faut SAUTER sur
  // une PASSERELLE latérale COIFFÉE DE ROCHE (inaccessible par le haut, atteignable seulement par ce
  // chemin) avec un dégagement de saut sous la roche.
  | 'echelle-descente-piegee'
  // CASCADE → GROTTE SOUS-MARINE : la cascade tombe (par une lucarne du toit) dans un BASSIN marine
  // coiffé d'un TOIT DE ROCHE (grotte inondée) ; coffre au fond.
  | 'cascade-grotte'
  // CASCADE → TROU MORTEL (piège) : cascade étroite dont la chute débouche sur le VIDE (mort) ; on ne
  // la descend PAS, on FRANCHIT le rideau au saut d'une corniche à l'autre par le haut.
  | 'cascade-trou'
  // CASCADE LARGE (rideau large) : un large rideau d'eau REMONTABLE qui alimente un BASSIN en contrebas
  // (pas de vide mortel : l'eau retombe dans le lac) ; coffre au fond.
  | 'cascade-large'
  // CASCADE TROUÉE : colonnes de cascade ALTERNÉES avec des TROUS MORTELS (eau / vide / eau…), franchies
  // au saut sur des pierres de gué au-dessus ; tomber dans une colonne (eau OU vide) = chute mortelle.
  | 'cascade-trouee'
  // CASCADE → LAC-TRÉSOR EN CUL-DE-SAC : la cascade descend dans un lac SANS SORTIE PAR LE BAS, trésor
  // au fond ; il faut faire DEMI-TOUR, remonter (cascade remontable) et repasser par le HAUT (sortie haute).
  | 'cascade-cul-de-sac'
  // CASCADE EN W : deux rideaux MORTELS (au-dessus du vide) encadrant un îlot central dont la cascade
  // tombe dans un petit bassin (atterrissage sûr + coffre). Passerelles plates de part et d'autre pour
  // s'élancer et sauter par-dessus les rideaux latéraux (rater = chute mortelle).
  | 'cascade-w'
  // CASCADE SAUT DE L'ANGE : on grimpe une cascade très haute jusqu'à un perchoir (panneau flèche bas),
  // puis plongeon à l'aveugle dans un bassin en contrebas (coffre au fond).
  | 'cascade-saut-ange'
  // CASCADE LARGE + PIERRE : cascade très large au-dessus du vide (chute mortelle), grosse pierre rigide
  // à mi-hauteur qui force à gérer montée/descente pour rester dans l'eau.
  | 'cascade-large-pierre'
  // ÉCHELLES-LIANES : échelles hautes plantées sur des SOCLES de PIERRE RIGIDE, on grimpe puis on SAUTE
  // d'un socle au suivant (escalier ascendant en quinconce).
  | 'echelles-lianes'
  // ÉCHELLES ZIGZAG : échelles suspendues « en T » dont on bondit alternativement à GAUCHE puis à DROITE
  // en montant (chevron/zigzag), dans une bande verticale étroite.
  | 'echelles-zigzag'
  // ESCALIER DE LACS MONTANT : on REMONTE des cascades pour émerger de lac en lac, de plus en plus haut.
  | 'lacs-cascade-montee'
  // ESCALIER DE LACS DESCENDANT : on grimpe à un lac perché, d'où l'eau se déverse de lac en lac vers le bas.
  | 'lacs-cascade-descente'
  // ─── R171 — VARIÉTÉ + NOUVEAUX MOTIFS (retours playtest) ───────────────────────────────────────
  // LAC → CASCADE → PLATEAU : un bout de LAC marine horizontal, puis à sa FIN une CASCADE remontable
  // qu'on remonte sur ~3-4 sauts de hauteur pour arriver sur un PLATEAU en HAUT (sortie haute). Une
  // rampe de paliers parallèle garantit l'accès au plateau (reachable) ; la cascade est le raccourci fun.
  | 'lac-cascade-plateau'
  // ESCALIER À GRANDS PAS : marches de TERRE espacées montant de SIMPLE_JUMP_ROWS (près du max de saut)
  // avec un écart horizontal → chaque marche force un VRAI saut (haut ET loin). SOL PLEIN dessous
  // (rater = retomber au sol, jamais mortel). Distinct des escaliers doux (rise 1-2).
  | 'escalier-saut'
  // ÉCHELLES SUCCESSIVES : on grimpe une échelle, on débouche sur un COURT palier, et on enchaîne
  // IMMÉDIATEMENT sur une 2ᵉ échelle (échelle puis échelle, sans marche intermédiaire large).
  | 'echelles-successives'

// Tier de difficulté (D1..D5) et tags d'accroche : altitude du bord GAUCHE (entrée) / DROIT (sortie).
export type Tier = 1 | 2 | 3 | 4 | 5
export type EdgeTag = 'bas' | 'milieu' | 'haut'
// Famille de composition (pour le DOSAGE par niveau, cf. composeLevel).
export type Family = 'filler' | 'traverse' | 'vertical' | 'risque' | 'tension'

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
  // métadonnées (déduites de CATALOG si absentes) — servent au dosage / à la courbe de difficulté.
  tier?: Tier
  entry?: EdgeTag
  exit?: EdgeTag
  // RELIEF VALLONNÉ : colline aux sommets RELEVÉS (silhouette plus haute) — cf. ComposeOpts.hilly.
  tall?: boolean
  // ALTITUDE DE DÉPART (module de spawn uniquement) : altitude du sol de départ. 0 = départ AU SOL,
  // ≥3 = départ sur une corniche SURÉLEVÉE. Varié par seed dans planModules (retour joueur : « les
  // niveaux commencent toujours en hauteur »). Absent → fallback surélevé dans l'assembleur.
  startAlt?: number
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

// Hauteur MINIMALE d'une cascade remontable, en rangées : AU MOINS 4× la taille du panda
// (PANDA_BODY.h ≈ 62px ≈ 2 tuiles → 8 rangées). En-deçà, la cascade se franchit presque d'un saut
// (maxJumpTiles ≈ 4) → une montée « chiante » sans intérêt (retour joueur R180). On l'impose à la
// génération de TOUS les motifs de cascade et on la verrouille par test (shortCascades).
export const MIN_CASCADE_TILES = 8 // 4 × ~2 tuiles (PANDA_BODY.h 62px / TILE 32px, arrondi)
// dénivelée déterministe d'une cascade : au moins MIN_CASCADE_TILES, +0..1 rangée de variété.
const cascadeRise = (rng: () => number) => MIN_CASCADE_TILES + Math.floor(rng() * 2)

// ─── Représentation intermédiaire en espace ALTITUDE (converti en rows à la fin) ────────────
interface Piece {
  // `solid` : marche de PIERRE rigide (collision pleine, isolée pour ne pas coincer) ; absent = TERRE
  // one-way (traversable par le bas).
  platforms: { x: number; alt: number; w: number; solid?: boolean }[]
  // DALLES DE ROCHE : rectangle plein de altBot à altTop (altitudes inclusives). Sert au PLAFOND DE
  // ROCHE d'un tunnel (grotte : roche au-dessus de la surface, avec un dégagement >= saut confortable
  // → on ne se cogne jamais) et au remplissage plein sous le sol de la grotte / sous la bande de départ
  // (mesa). `solid` : le PLAFOND est une COLLISION pleine (on ne saute pas à travers) ; absent = socle
  // décoratif sous le sol (aucune collision).
  rocks: { x: number; altBot: number; altTop: number; w: number; solid?: boolean }[]
  gaps: { x: number; w: number }[]
  // pics : alt = altitude de la SURFACE qui porte les pics (corniche en hauteur). Absent → pics au sol.
  spikes: { x: number; w: number; alt?: number }[]
  bridges: { x: number; alt: number; w: number }[]
  // cuves d'eau : marine (noyade), cascade (remontable) ou lave (mortelle, enfer). bankAlt = rangée des
  // berges (surface juste dessous) ; le liquide descend jusqu'au sol (fond). Le moteur pose murs + fond + déco.
  // `openSide` : ouvre une paroi (passage sous-marin — on ressort par le côté immergé).
  // `bottomAlt` (CASCADE uniquement) : la cascade s'arrête à cette altitude (surface d'un BASSIN qui la
  // recueille) au lieu de couler jusqu'au bas du monde → PAS de vide mortel dessous (l'eau alimente le lac).
  waters: { x: number; w: number; kind: 'marine' | 'cascade' | 'lave'; bankAlt: number; openSide?: 'left' | 'right' | 'both'; bottomAlt?: number }[]
  // ÉCHELLES : montant vertical de topAlt (haut) jusqu'à topAlt-h (pied). h∈[MIN,MAX]_LADDER_TILES.
  // Correct-par-construction : pied posé sur une surface + palier de sortie 2 rangées sous le sommet.
  ladders: { x: number; topAlt: number; h: number; hung?: boolean }[]
  spawns: { monsterId: string; x: number; alt?: number; aerial?: boolean }[]
  props: { kind: string; x: number; alt?: number }[]
  // PANNEAUX décoratifs (poteau + flèche vers le bas) — plongeoir « saut de la foi ». Canal DISTINCT
  // des props destructibles (aucune collision, aucun drop, hors registre PROPS).
  signs: { x: number; alt: number }[]
  start?: { x: number; alt: number }
  exit?: { x: number; alt: number }
  exitAlt: number // altitude de sortie (pour chaîner le module suivant)
}

function emptyPiece(exitAlt: number): Piece {
  return { platforms: [], rocks: [], gaps: [], spikes: [], bridges: [], waters: [], ladders: [], spawns: [], props: [], signs: [], exitAlt }
}

// Dégagement libre (en rangées) garanti sous un PLAFOND DE ROCHE de tunnel : strictement supérieur à
// la hauteur de saut (≈ 4 tuiles) + la taille du panda, pour qu'il traverse le boyau sans se cogner
// (le plafond n'a AUCUNE collision, mais on garde un vrai vide pour que ça reste jouable et lisible).
const CAVE_CLEARANCE = 6
const CAVE_CEILING_THICK = 6 // épaisseur de la dalle de plafond (rangées de roche pleine) — plus épais

// ─── SOCLE DE PIERRE sous les surfaces pleines (chantier « fini le gazon empilé ») ──────────
// Sous la COIFFE marchable d'une surface PLEINE (biome en haut, ~1 tuile), on remplit le CORPS
// avec de la ROCHE (rendue en texture rocheuse, cf. LevelScene) qui DESCEND jusqu'au sol du monde
// → des FALAISES / MESAS de pierre à coiffe de biome, plus jamais de dalle de gazon qui flotte.
// Ne s'applique QU'AUX modules à fond plein/eau (sol/marine/cascade/lave) : les corniches
// au-dessus d'un TROU ('vide') et les plafonds de grotte ('roche') gardent leur rendu (elles
// DOIVENT flotter / sont déjà pleines). Les colonnes d'EAU restent OUVERTES (on ne bouche pas la
// cuve/la cascade). Purement RENDU (rockBands sans collision) → la jouabilité ne change pas.
function addPedestals(p: Piece, w: number) {
  // altitude de la plateforme la PLUS BASSE par colonne = la coiffe marchable de la silhouette.
  // Les plateformes BONUS (balcon/leurre/palier d'échelle), toujours plus HAUTES qu'un sol qui les
  // porte, ne sont jamais la plus basse → elles ne reçoivent PAS de socle et restent fines.
  const floorAlt = new Array<number>(w).fill(0)
  for (const pl of p.platforms) {
    for (let x = Math.max(0, pl.x); x < Math.min(w, pl.x + pl.w); x++) {
      if (floorAlt[x] === 0 || pl.alt < floorAlt[x]!) floorAlt[x] = pl.alt
    }
  }
  const blocked = (x: number) =>
    p.gaps.some((g) => x >= g.x && x < g.x + g.w) ||
    p.waters.some((wt) => x >= wt.x && x < wt.x + wt.w)
  // fusionne les colonnes de même altitude de coiffe en une seule bande de roche (1 → alt-1)
  let runX = -1
  let runAlt = 0
  const flush = (endX: number) => {
    // altBot 0 : le socle descend jusque DANS la bande de sol du monde (pas de liseré de fond
    // visible entre le bas de la falaise et le sol). Rendu derrière le sol (depth), sans collision.
    if (runX >= 0 && runAlt >= 2) p.rocks.push({ x: runX, altBot: 0, altTop: runAlt - 1, w: endX - runX })
    runX = -1
    runAlt = 0
  }
  for (let x = 0; x < w; x++) {
    const a = blocked(x) ? 0 : floorAlt[x]!
    if (a >= 2 && a === runAlt) continue
    flush(x)
    if (a >= 2) { runX = x; runAlt = a }
  }
  flush(w)
}

// ─── PLAFOND DE GROTTE VARIÉ (chantier « plafonds de grotte trop plats ») ────────────────────
// Rend le plafond de roche d'un tunnel avec un bord inférieur ONDULÉ (dents / marches / vagues)
// au lieu d'une ligne plate. Le sommet reste commun (masse connectée, épaisse) ; seul le BAS varie.
// Le dégagement libre reste TOUJOURS > saut (min 5 rangées > maxJump ≈ 4) → on traverse le boyau
// sans jamais se cogner. Purement RENDU (rockBands sans collision). `variant` ∈ {0,1,2}.
// Nombre de VARIANTES de plafond disponibles (0..CEILING_VARIANTS-1) — plusieurs profils de bord
// inférieur pour que deux grottes ne se ressemblent jamais (dents, marches, ondulation, voûtes,
// stalactites). Le dégagement libre reste TOUJOURS ≥ 5 rangées (> saut ≈ 4).
const CEILING_VARIANTS = 5
function pushVariedCeiling(p: Piece, w: number, alt: number, variant: number) {
  const base = alt + CAVE_CLEARANCE // dégagement de base (6 rangées)
  const topAlt = base + CAVE_CEILING_THICK + 3 // sommet commun → dalle pleine et connectée (assez épaisse pour les voûtes)
  const v = ((variant % CEILING_VARIANTS) + CEILING_VARIANTS) % CEILING_VARIANTS
  const seg = 4
  let i = 0
  for (let x = 0; x < w; x += seg, i++) {
    const sw = Math.min(seg, w - x)
    // offset du bord inférieur : négatif = DENT qui pend (dégagement plus court, jamais < 5),
    // positif = RECREUSE (plus de dégagement). Amplitude bornée [-1, +3] → dégagement ∈ [5, 9].
    let off: number
    if (v === 0) off = i % 2 === 0 ? -1 : 2 // DENTS / créneaux
    else if (v === 1) off = [0, 1, 2, 1][i % 4]! // MARCHES
    else if (v === 2) off = [2, 1, 0, 1][i % 4]! // ONDULATION douce
    else if (v === 3) off = [3, 1, 3, 1][i % 4]! // GROSSES VOÛTES (arches profondes)
    else off = i % 3 === 0 ? -1 : 3 // STALACTITES espacées (pointe basse isolée)
    // PLAFOND SOLIDE : collision pleine → on ne saute pas à travers (le dégagement reste > saut).
    p.rocks.push({ x, altBot: base + off, altTop: topAlt, w: sw, solid: true })
  }
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

// hauteur d'échelle bornée à [MIN,MAX]_LADDER_TILES (le validateur casse hors de cet intervalle).
const LADDER_H = Math.max(MIN_LADDER_TILES, Math.min(9, MAX_LADDER_TILES))

// ─── ÉCHELLES (motifs correct-par-construction) ─────────────────────────────────────────────
// Pose UN étage d'escalade : une plateforme-PIED à footAlt qui couvre le montant, un MONTANT de h
// tuiles (h∈[MIN,MAX]), et un PALIER DE SORTIE posé 2 rangées SOUS le sommet (drop=2, la règle du
// décalage pieds↔centre du panda — cf. level-validator.isLadderTop), horizontalement collé au
// montant. Le palier s'étend jusqu'à `landRight` pour raccorder la sortie du module. Renvoie
// l'altitude du palier (= altitude de sortie de l'escalade).
function poseLadder(p: Piece, xLad: number, footAlt: number, footX0: number, footW: number, landRight: number, h = LADDER_H): number {
  const fa = Math.max(1, footAlt)
  p.platforms.push({ x: footX0, alt: fa, w: footW }) // pied de l'échelle (surface d'accès)
  return poseLadderOn(p, xLad, fa, landRight, h)
}

// Ajoute un montant + palier de sortie SUR une surface de pied DÉJÀ posée à footAlt (couvrant xLad).
function poseLadderOn(p: Piece, xLad: number, footAlt: number, landRight: number, h = LADDER_H): number {
  const topAlt = footAlt + h
  p.ladders.push({ x: xLad, topAlt, h })
  const landAlt = topAlt - 2 // palier atteignable : 2 rangées sous le haut du montant (décalage pieds)
  p.platforms.push({ x: xLad, alt: landAlt, w: Math.max(4, landRight - xLad) }) // palier collé au montant
  return landAlt
}

// TOUR D'ÉCHELLES en LACET (cage / puits) : `stages` étages échelle+palier, l'échelle suivante part
// du bout du palier précédent (quinconce) → jamais plus de 2 paliers empilés (+ sol = 3). Renvoie
// l'altitude du palier de sommet.
function poseTower(p: Piece, w: number, entryAlt: number, stages: number): number {
  const seg = Math.max(6, Math.floor((w - 4) / (stages + 1)))
  let footAlt = Math.max(1, entryAlt)
  p.platforms.push({ x: 0, alt: footAlt, w: seg + 2 }) // plateforme-pied initiale
  let x = 2
  for (let i = 0; i < stages; i++) {
    const isLast = i === stages - 1
    const landRight = isLast ? w : Math.min(w, x + seg + 2)
    footAlt = poseLadderOn(p, x, footAlt, landRight)
    x = Math.min(w - 3, landRight - 2) // prochaine échelle au bout du palier
  }
  return footAlt
}

// ─── Générateur d'un module (espace altitude, x local 0..w) ─────────────────────────────────
function buildModule(m: Module, rng: () => number, w: number, entryAlt: number): Piece {
  const bank = 3 // largeur des berges solides d'entrée/sortie
  // DÉPART TOUJOURS SÛR : le module de spawn ne pose AUCUN monstre (ni au sol, ni en l'air) → le
  // panda apparaît seul sur son plateau. La marge de sécurité autour du x de départ est en plus
  // garantie globalement par l'assembleur (voir SAFE_SPAWN_TILES).
  const groundMobs = m.spawnHere ? [] : (m.ground ?? [])
  const birds = m.spawnHere ? [] : (m.birds ?? [])
  const p = emptyPiece(entryAlt)
  const rise = m.rise ?? 0
  const exitAlt = Math.max(0, entryAlt + rise)
  p.exitAlt = exitAlt
  // CUVE marine par défaut, sauf si le module est déclaré 'lave' (enfer) : la lave est mortelle et ne
  // porte JAMAIS de coffre de plongée (y plonger = mourir), à la différence de la marine (apnée + trésor).
  const basinKind: 'marine' | 'lave' = m.fillBelow === 'lave' ? 'lave' : 'marine'

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
      // RELIEF VALLONNÉ (m.tall) : sommets relevés (+3..+9) → silhouette plus haute et découpée ; sinon +3..+6.
      const peak = entryAlt + (m.tall ? Math.max(5, 5 + Math.floor(rng() * 5)) : Math.max(3, 3 + Math.floor(rng() * 4)))
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
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      // pont à bankAlt en 2 segments avec un trou central de 3 tuiles (on plonge par le trou)
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      // BERGE DROITE au MÊME niveau que la gauche (surface d'eau horizontale) : corniche plate flush
      // à l'eau à bankAlt, PUIS redescente. Sans ce palier plat, la rampe amorçait sa descente dès le
      // bord de l'eau → rebord droit plus bas que le gauche (retour user « rebord gauche + haut »).
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt)) // berge droite descendante
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // au fond (sol) — jamais dans la lave
      placeBirds(bankAlt + 2)
      break
    }
    case 'cascade': {
      // cascade claire REMONTABLE (bleu clair, pas de noyade) : depuis la corniche BASSE on saute dans
      // la colonne et le courant ASCENDANT nous porte vers la corniche HAUTE + coffre secret. Une
      // RAMPE DE PALIERS parallèle garantit l'accès à la corniche haute au saut simple (reachable.test) ;
      // la cascade est le raccourci fun.
      const low = Math.max(entryAlt, 1)
      const top = low + cascadeRise(rng) // cascade HAUTE (≥ 4× le panda) : plus jamais franchissable au saut
      // allocation séquentielle : corniche basse | colonne (2) | ÉCHELLE parallèle + jetée | corniche
      // haute (5) | rampe de redescente. La rampe montante ne tient plus (une cascade de 4× le panda
      // dépasse ce qu'un escalier de paliers peut couvrir en largeur) → une échelle donne l'accès garanti.
      const L = Math.max(4, Math.floor(w * 0.22))
      const cornW = 5
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche basse d'accès
      p.waters.push({ x: L, w: 4, kind: 'cascade', bankAlt: top }) // colonne LARGE (2×) : on la GRIMPE (chute mortelle au fond)
      // plus d'échelle parallèle (retour joueur) : la corniche haute est JOINTIVE au bord droit de la
      // colonne, on émerge dessus en grimpant la cascade (connecteur vertical, cf. level-validator).
      const topX = L + 4
      p.platforms.push({ x: topX, alt: top, w: cornW }) // corniche haute (sortie de cascade)
      p.props.push({ kind: 'coffre', x: topX + 2, alt: top + 1 }) // coffre POSÉ sur la corniche (1 rangée au-dessus)
      const downStart = topX + cornW
      if (w - downStart >= 1) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt)) // redescente vers la sortie
      placeBirds(top + 2)
      break
    }
    case 'grotte': {
      // VRAI TUNNEL FERMÉ (phase 2b) : roche PLEINE au-dessus ET en dessous de la surface marchable.
      // - sol de roche marchable à `alt` ;
      // - remplissage plein SOUS le sol (de la surface jusqu'au bas du monde) → « tout pierre dessous » ;
      // - PLAFOND DE ROCHE au-dessus, laissant un dégagement CAVE_CLEARANCE (> saut confortable) pour
      //   qu'on traverse le boyau sans se cogner (plafond sans collision, purement visuel).
      const alt = Math.max(entryAlt, 2)
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      // socle plein sous la surface (jusqu'au niveau du sol du monde ; le reste est fermé par le sol)
      if (alt - 1 >= 1) p.rocks.push({ x: 0, altBot: 1, altTop: alt - 1, w })
      // PLAFOND DE ROCHE VARIÉ (dents/marches/vagues) au lieu d'une dalle plate
      pushVariedCeiling(p, w, alt, Math.floor(rng() * CEILING_VARIANTS))
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

    // ─── PHASE 2 — FILLERS / respiration (D1) ────────────────────────────────────────────────
    case 'ligne-droite':
    case 'couloir-large': {
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'marche': {
      // une marche simple qui monte de 2-3 rangées à mi-parcours
      const alt = entryAlt
      const step = Math.min(SIMPLE_JUMP_ROWS, 2 + Math.floor(rng() * 2))
      const half = Math.floor(w / 2)
      if (alt >= 1) p.platforms.push({ x: 0, alt, w: half })
      p.platforms.push({ x: half, alt: alt + step, w: w - half })
      p.exitAlt = alt + step
      break
    }
    case 'descente-douce': {
      const alt = entryAlt
      const drop = Math.min(SIMPLE_JUMP_ROWS, 2 + Math.floor(rng() * 2))
      const toAlt = Math.max(0, alt - drop)
      p.platforms.push(...ramp(0, w, alt, toAlt))
      p.exitAlt = toAlt
      break
    }
    case 'balcon': {
      // plateau + balcon surélevé (bonus optionnel), sortie = entrée
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      p.platforms.push({ x: Math.floor(w / 3), alt: alt + SIMPLE_JUMP_ROWS, w: Math.max(4, Math.floor(w / 3)) })
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }
    case 'echelle-tranquille': {
      // F6 : montée par UNE échelle unique, palier de sortie jusqu'au bord droit
      const xLad = Math.max(3, Math.floor(w * 0.4))
      p.exitAlt = poseLadder(p, xLad, entryAlt, 0, xLad + 3, w)
      break
    }
    case 'double-sol': {
      // F8 : 2 étages plats reliés par une échelle, MÊME sortie que l'entrée (l'étage haut = bonus)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w }) // sol bas, pleine largeur = chemin principal
      const xLad = Math.max(3, Math.floor(w * 0.35))
      const topAlt = alt + LADDER_H
      p.ladders.push({ x: xLad, topAlt, h: LADDER_H })
      p.platforms.push({ x: xLad, alt: topAlt - 2, w: Math.max(4, Math.floor(w / 2)) }) // étage haut
      p.exitAlt = alt
      break
    }

    // ─── PHASE 2 — TRAVERSÉE horizontale (D1–D3) ─────────────────────────────────────────────
    case 'gap-grandissant':
    case 'ilots-reguliers':
    case 'ilots-irreguliers':
    case 'triple-saut': {
      // sol à alt courant coupé de TROUS mortels (≤3 tuiles chacun, franchissables). Le motif change
      // le rythme des trous : croissant, régulier, irrégulier, ou triple saut serré.
      const alt = Math.max(1, entryAlt)
      const bank = 3
      p.platforms.push({ x: 0, alt, w: bank })
      let x = bank
      let i = 0
      const maxGaps = m.kind === 'triple-saut' ? 3 : 99
      while (x < w - bank - 2 && i < maxGaps) {
        let gw: number
        if (m.kind === 'gap-grandissant') gw = Math.min(1 + i, 3)
        else if (m.kind === 'ilots-irreguliers') gw = 1 + ((i * 2 + 1) % 3)
        else if (m.kind === 'triple-saut') gw = 3
        else gw = 2
        gw = Math.min(gw, 3, w - bank - x - 2)
        if (gw <= 0) break
        p.gaps.push({ x, w: gw }); x += gw
        const iw = m.kind === 'ilots-irreguliers' ? 3 + (i % 3) : 4
        const sw = Math.min(iw, w - bank - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt, w: sw }); x += sw
        i++
      }
      p.platforms.push({ x: Math.max(x, w - bank), alt, w: bank }) // berge droite
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'petit-pont': {
      // F5 : pont au-dessus d'un bassin marine peu profond. Le pont a un TROU central (3 tuiles,
      // franchissable au saut) par lequel on PLONGE pour le petit trésor du fond puis on RESSORT —
      // sans le trou, le coffre du fond serait injoignable (bassin scellé). Bassin peu profond →
      // plongée/remontée triviale (survivable).
      const bankAlt = entryAlt + 2
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt))
      const wx = rampW, ww = w - 2 * rampW // eau entre les DEUX berges de largeur rampW (surface plane)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      const holeL = wx + Math.floor(ww / 2) - 1 // trou central de 3 tuiles : on plonge par là
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      // berge droite AU MÊME niveau que la gauche (rebords à niveau), puis redescente
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, entryAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // petit trésor au fond du bassin
      p.exitAlt = entryAlt
      break
    }
    case 'trou-filet':
    case 'pas-japonais': {
      // pas de pierre (bridges) au-dessus d'une cuve marine : rater = tomber à l'eau (nage), pas mourir
      const bankAlt = Math.max(entryAlt, 2)
      const bank = 3
      p.platforms.push({ x: 0, alt: bankAlt, w: bank })
      const wx = bank, ww = Math.max(6, w - 2 * bank)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt })
      const stepW = m.kind === 'pas-japonais' ? 2 : 3
      let x = wx
      while (x < wx + ww) {
        const sw = Math.min(stepW, wx + ww - x)
        if (sw <= 0) break
        p.bridges.push({ x, alt: bankAlt, w: sw })
        x += sw + 3
      }
      p.platforms.push({ x: wx + ww, alt: bankAlt, w: bank })
      placeBirds(bankAlt + 2)
      p.exitAlt = bankAlt
      break
    }

    // ─── PHASE 2 — VERTICAL / étages (D2–D4) ─────────────────────────────────────────────────
    case 'zigzag': {
      // plateformes alternées contiguës (monte de 2, redescend de 1 → progression en dents de scie)
      const alt = Math.max(1, entryAlt)
      const seg = 4
      let x = 0, a = alt, i = 0
      while (x < w) {
        const sw = Math.min(seg, w - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt: a, w: sw })
        x += sw
        a = Math.max(1, i % 2 === 0 ? a + 2 : a - 1)
        i++
      }
      p.exitAlt = a
      break
    }
    case 'descente-controlee': {
      // paliers descendants réguliers (chute contrôlée corniche → corniche)
      const alt = entryAlt
      const drop = Math.max(5, Math.abs(m.rise ?? 8))
      const toAlt = Math.max(0, alt - drop)
      p.platforms.push(...ramp(0, w, alt, toAlt))
      placeBirds(alt + 2)
      p.exitAlt = toAlt
      break
    }
    case 'cage-echelles': {
      // V18 : 2 échelles + paliers en lacet (quinconce)
      p.exitAlt = poseTower(p, w, entryAlt, 2)
      break
    }
    case 'tour-creuse': {
      // V21 : puits, plateformes en quinconce reliées par échelles (3 étages)
      p.exitAlt = poseTower(p, w, entryAlt, 3)
      break
    }
    case 'echelle-vs-sauts': {
      // V19 : deux routes vers le même palier — échelle (gauche) OU escalier de sauts (droite)
      const xLad = Math.max(3, Math.floor(w * 0.25))
      const rx = Math.floor(w * 0.5)
      const landAlt = poseLadder(p, xLad, entryAlt, 0, rx, rx)
      p.platforms.push(...ramp(rx, w - rx, entryAlt, landAlt)) // escalier alternatif à droite
      p.exitAlt = landAlt
      break
    }

    // ─── PHASE 2 — RISQUE / récompense (D2–D4) ───────────────────────────────────────────────
    case 'chemin-double': {
      // R23 : route HAUTE continue (sûre) + route BASSE à trous (rapide, risquée)
      const lowAlt = Math.max(1, entryAlt)
      const highAlt = lowAlt + SIMPLE_JUMP_ROWS
      p.platforms.push({ x: 0, alt: lowAlt, w: 4 })
      let x = 4
      while (x < w - 4) {
        const gw = Math.min(2, w - 4 - x)
        if (gw <= 0) break
        p.gaps.push({ x, w: gw }); x += gw
        const sw = Math.min(4, w - 4 - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt: lowAlt, w: sw }); x += sw
      }
      p.platforms.push({ x: Math.max(x, w - 4), alt: lowAlt, w: 4 })
      p.platforms.push({ x: 2, alt: highAlt, w: Math.max(6, w - 4) }) // corniche haute continue
      p.exitAlt = lowAlt
      break
    }
    case 'fausse-sortie': {
      // R28 : chemin continu + leurre surélevé sans issue (cul-de-sac à observer)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      p.platforms.push({ x: Math.floor(w / 3), alt: alt + SIMPLE_JUMP_ROWS, w: 5 }) // leurre
      p.exitAlt = alt
      break
    }
    case 'detour-balcon': {
      // R26 : chemin principal au sol + balcon-trésor optionnel via échelle (sortie = entrée)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      const xLad = Math.max(3, Math.floor(w * 0.4))
      const topAlt = alt + LADDER_H
      p.ladders.push({ x: xLad, topAlt, h: LADDER_H })
      const balcAlt = topAlt - 2
      p.platforms.push({ x: xLad, alt: balcAlt, w: Math.max(4, Math.floor(w / 3)) })
      p.props.push({ kind: 'coffre', x: xLad + 2, alt: balcAlt + 1 })
      p.exitAlt = alt
      break
    }
    case 'tresor-bassin': {
      // R25 : cuve marine avec coffre au FOND (détour aquatique) — reprend le motif bassin
      const bankAlt = entryAlt + 4
      const rampW = 5
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt))
      const wx = rampW, ww = w - 2 * rampW // eau entre les DEUX berges (surface plane, rebords à niveau)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      // berge droite AU MÊME niveau que la gauche, puis redescente
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, entryAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) })
      placeBirds(bankAlt + 2)
      break
    }

    // ─── PHASE 2 — TENSION / précision (D3–D5, sans pics — voir NOTE) ─────────────────────────
    case 'echelle-exposee': {
      // P30 : échelle exposée, il faut SORTIR DU BON CÔTÉ (palier à droite ; leurre court à gauche)
      const xLad = Math.max(4, Math.floor(w * 0.5))
      const landAlt = poseLadder(p, xLad, entryAlt, 0, xLad + 3, w)
      p.platforms.push({ x: Math.max(0, xLad - 6), alt: landAlt, w: 3 }) // leurre gauche (cul-de-sac)
      p.exitAlt = landAlt
      break
    }

    // ─── PHASE 2b — TENSION à PICS (pics rendus sur TOUTE surface élevée) ─────────────────────
    case 'faux-plat': {
      // T16 : corniche plate (en hauteur) semée de PICS ISOLÉS à enjamber. Surface pleine + pics
      // d'1 tuile posés SUR la corniche à intervalles réguliers → on saute par-dessus.
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      for (const sx of spread(w, 3)) p.spikes.push({ x: sx, w: 1, alt })
      p.exitAlt = alt
      break
    }
    case 'couloir-pics': {
      // P29 : couloir avec PLAFOND DE ROCHE (roche au-dessus) et LITS DE PICS sur la corniche : on
      // enchaîne des sauts par-dessus les lits, dégagement > saut sous le plafond.
      const alt = Math.max(2, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      pushVariedCeiling(p, w, alt, Math.floor(rng() * CEILING_VARIANTS)) // plafond de roche varié
      let x = 3
      while (x < w - 4) { p.spikes.push({ x, w: 2, alt }); x += 6 } // lit de 2 pics + 4 tuiles libres
      p.exitAlt = alt
      break
    }
    case 'pics-quinconce': {
      // P31 : pics en QUINCONCE — lits de pics au sol de la corniche alternés avec des mini-corniches
      // surélevées elles aussi coiffées de pics → on slalome en hauteur.
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      let x = 3, hi = false
      while (x < w - 4) {
        if (hi) { p.platforms.push({ x, alt: alt + 2, w: 3 }); p.spikes.push({ x, w: 3, alt: alt + 2 }) }
        else p.spikes.push({ x, w: 2, alt })
        x += 5; hi = !hi
      }
      p.exitAlt = alt
      break
    }
    case 'atterrissage-etroit': {
      // P32 : atterrissages ÉTROITS (1 case) encadrés de pics — précision de saut en hauteur.
      const alt = Math.max(2, entryAlt)
      p.platforms.push({ x: 0, alt, w: 3 }) // berge d'entrée
      let x = 3
      while (x < w - 4) {
        p.spikes.push({ x, w: 1, alt })
        p.platforms.push({ x: x + 1, alt, w: 1 }) // atterrissage d'une seule tuile
        p.spikes.push({ x: x + 2, w: 1, alt })
        x += 4
      }
      p.platforms.push({ x: Math.max(x, w - 3), alt, w: 3 }) // berge de sortie
      p.exitAlt = alt
      break
    }

    // ─── ESCALIER DE PIERRE (marches RIGIDES) ────────────────────────────────────────────────
    case 'escalier-pierre': {
      // Marches de PIERRE PLEINES et ISOLÉES (un trou d'air entre chaque) : collision pleine → on ne
      // les traverse PAS (ni par le bas), mais l'isolement empêche tout coincement (aucune arête
      // interne où se wedger). On monte bloc par bloc (écart +STEP_RISE rangées, GAP tuiles → saut
      // simple garanti et reachable). Le fond est du SOL PLEIN : rater un saut = retomber au sol,
      // jamais de piège. Contraste avec les marches de TERRE (rampes one-way traversables par le bas).
      const STEP_RISE = 2 // +2 rangées par marche (avec un trou de GAP=2 tuiles → CONFORTABLEMENT franchissable)
      const GAP = 2
      const stepW = 4
      const pitch = stepW + GAP // 6 tuiles par marche
      const from = Math.max(1, entryAlt)
      // autant de marches que la largeur en contient (≥2), la DERNIÈRE étant un large palier qui
      // rejoint le bord droit du module (contigu au module suivant → chaînage reachable).
      const count = Math.max(2, Math.min(5, Math.floor((w - stepW) / pitch) + 1))
      let x = 0
      for (let i = 0; i < count; i++) {
        const alt = from + i * STEP_RISE
        const last = i === count - 1
        const bw = last ? Math.max(stepW, w - x) : stepW // dernier bloc élargi jusqu'au bord droit
        p.platforms.push({ x, alt, w: bw, solid: true }) // bloc de PIERRE rigide
        x += pitch
      }
      p.exitAlt = from + (count - 1) * STEP_RISE
      break
    }

    // ─── PHASE 2 — EAU / cascade (D2–D4) ─────────────────────────────────────────────────────
    case 'sortie-humide': {
      // E40 : sortie derrière une cascade — reprend exactement le motif cascade (plateforme collée
      // à GAUCHE et à DROITE du rideau, courant DESCENDANT qu'on remonte en maintenant HAUT)
      const low = Math.max(entryAlt, 1)
      const top = low + cascadeRise(rng) // cascade HAUTE (≥ 4× le panda)
      const L = Math.max(4, Math.floor(w * 0.22))
      const cornW = 5
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche basse collée à gauche du rideau
      p.waters.push({ x: L, w: 4, kind: 'cascade', bankAlt: top }) // rideau LARGE (2×) : on GRIMPE la colonne
      // corniche de sortie JOINTIVE au bord droit du rideau (on émerge en grimpant, plus d'échelle)
      const topX = L + 4
      p.platforms.push({ x: topX, alt: top, w: cornW })
      p.props.push({ kind: 'coffre', x: topX + 2, alt: top + 1 })
      const downStart = topX + cornW
      if (w - downStart >= 1) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt))
      placeBirds(top + 2)
      break
    }

    // ─── PASSAGE SOUS-MARIN : plonger par le HAUT, ressortir sur le CÔTÉ immergé ──────────────
    case 'passage-immerge': {
      // Lac marine dont la paroi DROITE est OUVERTE (openSide) : on plonge depuis la berge gauche
      // HAUTE (par le haut du lac) puis, apnée rallongée (§1) aidant, on nage/descend et on RESSORT
      // sur le CÔTÉ par l'ouverture immergée → une corniche BASSE de la zone suivante (on ne remonte
      // pas par le haut). Le fond est du sol plein ; des poissons (cercles rouges) dérivent dans l'eau.
      const highBank = entryAlt + 5 // berge gauche HAUTE : le point de plongée
      const outAlt = Math.max(1, Math.min(entryAlt, 3)) // sortie latérale BASSE (joignable du sol côté validateur)
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, highBank)) // rampe d'accès à la berge haute
      const wx = rampW
      const ww = Math.max(6, w - rampW - 3)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt: highBank, openSide: 'right' })
      // corniche de SORTIE latérale, basse, collée au bord droit ouvert de l'eau (on émerge par là)
      p.platforms.push({ x: wx + ww, alt: outAlt, w: Math.max(3, w - (wx + ww)) })
      placeBirds(highBank + 2)
      p.exitAlt = outAlt
      break
    }

    // ─── LAC EN U : plonger, nager SOUS LA ROCHE, ressortir à la MÊME hauteur ─────────────────
    case 'lac-en-u': {
      // Corniche d'ENTRÉE à hauteur H (bankAlt) → colonne d'eau qui DESCEND → TUNNEL immergé au fond
      // sous un PLAFOND DE ROCHE (collision, comme une grotte) : au milieu on NE PEUT PAS remonter à
      // la surface → on nage sous la roche → colonne qui REMONTE → corniche de SORTIE à la MÊME
      // hauteur H. En U symétrique. Rebords des deux colonnes AU MÊME niveau (règle rebords).
      const bankAlt = entryAlt + 3 // berges rehaussées → U assez profond (surface à bankAlt, fond = sol)
      const rampW = 3
      const colW = 3 // largeur des colonnes verticales OUVERTES (on y atteint la surface : descente/montée)
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // rampe d'accès → corniche gauche à bankAlt
      const wx = rampW
      const ww = Math.max(2 * colW + 4, w - 2 * rampW) // eau entre les deux berges (≥ 2 colonnes + tunnel)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt }) // cuve close (murs posés par le moteur), surface plane
      // PLAFOND DE ROCHE SUBMERGÉ au MILIEU (entre les 2 colonnes) : de ceilBotAlt à la surface bankAlt,
      // collision pleine → impossible de faire surface au milieu, on nage dessous. Tunnel = eau sous
      // ceilBotAlt jusqu'au fond. POCHE(S) D'AIR : si le milieu est large, on ménage des trous dans le
      // plafond (on y refait surface pour respirer) → traversée toujours tenable dans l'apnée (5 s).
      // toit du tunnel : eau libre du fond jusqu'à ceilBotAlt (le panda nage dessous). Borné pour
      // garder À LA FOIS un dégagement de nage (≥ 2 rangées) et une roche assez épaisse (≥ 2 rangées).
      const ceilBotAlt = Math.min(4, Math.max(2, bankAlt - 2))
      const midX = wx + colW
      const midW = ww - 2 * colW
      const maxRock = 7 // longueur de roche max entre deux poches d'air (borne la nage en apnée)
      const airGap = 2
      let rx = midX
      while (rx < midX + midW) {
        const seg = Math.min(maxRock, midX + midW - rx)
        p.rocks.push({ x: rx, altBot: ceilBotAlt, altTop: bankAlt, w: seg, solid: true }) // plafond de roche immergé
        rx += seg + airGap // saute une POCHE D'AIR (colonnes ouvertes où l'on refait surface)
      }
      // berge droite (corniche de SORTIE) AU MÊME niveau H que l'entrée, puis retour à l'altitude de sortie
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      // MONSTRES AQUATIQUES proportionnels à la SURFACE d'eau (petit U → 1-2, grand → plus). Placés
      // SANS y → posés au FOND (immergés) : ils nagent (aquatic, pas de noyade) ; jamais de terrestre.
      if (groundMobs.length) {
        const area = ww * bankAlt
        const nAqua = Math.max(1, Math.min(4, Math.round(area / 70)))
        spread(ww, nAqua).forEach((ax, i) => p.spawns.push({ monsterId: groundMobs[i % groundMobs.length]!, x: wx + ax }))
      }
      placeBirds(bankAlt + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── GROTTE-TUNNEL : boyau de roche PLUS LONG et VARIÉ (roche dessus ET dessous) ──────────
    case 'grotte-tunnel': {
      // Vrai tunnel fermé, comme 'grotte', mais avec un RELIEF de sol (petit ressaut) et un plafond
      // ondulant tiré parmi les 5 profils → deux grottes ne se ressemblent jamais. Le dégagement sous
      // le plafond reste > saut (on ne se cogne pas). Réservé aux biomes rocheux/souterrains.
      const alt = Math.max(entryAlt, 2)
      // sol en deux paliers : plat, puis un ressaut d'1 marche à mi-parcours (relief de caverne)
      const step = 1 + (Math.floor(rng() * 2)) // 1 ou 2 rangées de ressaut
      const half = Math.floor(w / 2)
      p.platforms.push({ x: 0, alt, w: half })
      p.platforms.push({ x: half, alt: alt + step, w: w - half })
      // socle plein sous les deux paliers (grotte « tout pierre dessous »)
      if (alt - 1 >= 1) p.rocks.push({ x: 0, altBot: 1, altTop: alt - 1, w })
      // PLAFOND DE ROCHE VARIÉ calé sur le palier le PLUS HAUT (dégagement garanti partout)
      pushVariedCeiling(p, w, alt + step, Math.floor(rng() * CEILING_VARIANTS))
      p.exitAlt = alt + step
      break
    }

    // ─── GROTTE SOUS-MARINE EN U : lac en U NOYÉ SOUS UN TOIT DE ROCHE, coffre au fond ────────
    case 'grotte-noyee': {
      // Grotte inondée : comme 'lac-en-u' (on plonge, on nage sous un plafond de roche IMMERGÉ au
      // milieu, on remonte à la MÊME hauteur H de l'autre côté) MAIS coiffée d'un TOIT DE ROCHE au-
      // dessus de la surface de l'eau (grotte noyée fermée). Coffre AU FOND = récompense de plongée.
      const bankAlt = entryAlt + 3
      const rampW = 3
      const colW = 3
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // rampe → corniche gauche à bankAlt
      const wx = rampW
      const ww = Math.max(2 * colW + 4, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt }) // cuve close, surface plane
      // PLAFOND IMMERGÉ au MILIEU (force la plongée : impossible de faire surface au centre)
      const ceilBotAlt = Math.min(4, Math.max(2, bankAlt - 2))
      const midX = wx + colW
      const midW = ww - 2 * colW
      const maxRock = 7
      const airGap = 2
      let rx = midX
      while (rx < midX + midW) {
        const seg = Math.min(maxRock, midX + midW - rx)
        p.rocks.push({ x: rx, altBot: ceilBotAlt, altTop: bankAlt, w: seg, solid: true })
        rx += seg + airGap
      }
      // TOIT DE ROCHE au-DESSUS de la surface (grotte noyée) : plafond varié calé sur bankAlt, avec
      // un dégagement > saut au-dessus de la surface → on entre/ressort sans se cogner au plafond.
      pushVariedCeiling(p, w, bankAlt, Math.floor(rng() * CEILING_VARIANTS))
      // berge droite (corniche de SORTIE) à la MÊME hauteur H, puis retour à l'altitude de sortie
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      // COFFRE AU FOND (jamais dans la lave) : plongée récompensée
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) })
      // monstres AQUATIQUES au fond (comme lac-en-u) — jamais de terrestre au-dessus de l'eau
      if (groundMobs.length) {
        const nAqua = Math.max(1, Math.min(3, Math.round((ww * bankAlt) / 80)))
        spread(ww, nAqua).forEach((ax, i) => p.spawns.push({ monsterId: groundMobs[i % groundMobs.length]!, x: wx + ax }))
      }
      p.exitAlt = exitAlt
      break
    }

    // ─── PASSERELLES FLOTTANTES EN ZIGZAG ASCENDANT ───────────────────────────────────────────
    case 'passerelles-zigzag': {
      // Plateformes SUSPENDUES qui montent en alternant GAUCHE / DROITE : on saute en haut à gauche,
      // puis en haut à droite, puis gauche… pour grimper. Deux colonnes fixes (xL, xR) : chaque saut
      // monte de STEP_RISE=2 rangées (< saut ≈ 4) avec un écart horizontal de 2 tuiles (≤ portée de
      // saut confortable) → toujours FRANCHISSABLE. Le tout AU-DESSUS DU VIDE (passerelles flottantes :
      // rater un saut = chute mortelle, jamais coincé vivant → pas de socle plein sous la travée). La
      // dernière passerelle est un PALIER LARGE jusqu'au bord droit (raccord au module suivant, au
      // sommet). ≤ 3 passerelles empilées par colonne (silhouette collines respectée, le vide ne
      // compte pas comme palier).
      const base = Math.max(1, entryAlt)
      const STEP_RISE = 2
      const pw = 3
      const gapX = 2 // écart horizontal entre les deux colonnes (≤ portée de saut à +2 rangées)
      const xL = bank
      const xR = xL + pw + gapX
      const steps = 4 + Math.floor(rng() * 2) // 5 à 6 passerelles empilées (≤ 3 par colonne)
      // berge SOLIDE d'entrée à gauche (raccord au module précédent, à l'altitude d'entrée)
      p.platforms.push({ x: 0, alt: base, w: bank })
      let top = base
      for (let k = 0; k <= steps; k++) {
        const alt = base + k * STEP_RISE
        const x = k % 2 === 0 ? xL : xR // alterne gauche / droite
        const isLast = k === steps
        const pwk = isLast ? Math.max(pw, w - x) : pw // dernière = palier large → sortie au sommet
        p.platforms.push({ x, alt, w: pwk })
        top = alt
      }
      // TROUS mortels sous toute la travée des passerelles (tranches ≤ 3 → chacune franchissable, mais
      // on ne les franchit pas : on grimpe les passerelles). Retire le socle → passerelles FLOTTANTES.
      for (let gx = bank; gx < w; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, w - gx) })
      p.exitAlt = top
      break
    }

    // ─── PASSERELLES FLOTTANTES sur SOL PLEIN (variante « full sol » du miroir sous les passerelles) ──
    case 'passerelles-plein': {
      // Mêmes passerelles alternées gauche/droite que 'passerelles-zigzag', mais AU-DESSUS D'UN SOL
      // PLEIN continu : rater un saut = retomber sur le sol (pas de chute mortelle). Sol plein SOUS la
      // travée → fini le « miroir bizarre » (le sol ne suit plus la fréquence des passerelles). On
      // PLAFONNE à 4 passerelles (2 par colonne) : sol (1) + 2 passerelles = 3 paliers max (silhouette).
      const base = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt: base, w }) // SOL PLEIN pleine largeur (retombée sûre, jamais mortel)
      // passerelles flottantes en DENTS DE SCIE, chacune sur une COLONNE DISTINCTE (gauche→droite) →
      // sol (1) + AU PLUS 1 passerelle par colonne = 2 paliers (silhouette respectée). La dernière est
      // un large palier surélevé (raccord de la montée). Sol PLEIN dessous → plus de « miroir bizarre ».
      const pw = 3
      const scie = [base + 2, base + 4, base + 3, base + 4] // monte, redescend, remonte
      let x = bank
      let top = base
      for (let i = 0; i < scie.length && x + pw < w; i++) {
        const isLast = i === scie.length - 1 || x + 2 * (pw + 1) >= w
        const pwk = isLast ? Math.max(pw, w - x) : pw
        p.platforms.push({ x, alt: scie[i]!, w: pwk })
        top = scie[i]!
        if (isLast) break
        x += pw + 1 // colonne suivante (1 tuile d'écart → jamais de chevauchement de colonnes)
      }
      p.exitAlt = top
      break
    }

    // ─── PLONGEOIR « SAUT DE LA FOI » : perchoir TRÈS HAUT + panneau, on plonge à l'aveugle dans le lac ──
    case 'plongeoir': {
      // On grimpe jusqu'à un perchoir TRÈS HAUT en surplomb du lac (montée VARIÉE : échelle OU escalier
      // de plateformes selon la graine → « pas toujours échelle puis saut »), un PANNEAU (flèche vers le
      // bas) invite au saut, le BASSIN est VISIBLE en contrebas (télégraphie) ; on plonge à l'aveugle et
      // on tombe dans le LAC ALIGNÉ pile sous le point de saut (atterrissage dans l'EAU garanti). Le
      // plongeoir est PLUS HAUT qu'avant (bankAlt+9..11 en mode échelle) → vrai saut de la foi.
      const bankAlt = Math.max(2, entryAlt)
      const rampW = 3
      const ladderMode = Math.floor(rng() * 2) === 0 // 0 = ÉCHELLE (perchoir très haut) · 1 = PLATEFORMES
      const approachW = ladderMode ? rampW + 1 : Math.max(9, Math.floor(w * 0.4))
      const wx = approachW
      const ww = Math.max(8, w - approachW - rampW)
      // hauteur du perchoir : très haut par l'échelle ; par les plateformes, dérivée de la place dispo
      // (paliers ≤ 3, chacun +3) → toujours plusieurs sauts au-dessus de l'eau, jamais de débordement.
      const paliers = Math.max(1, Math.min(3, Math.floor((approachW - 3) / 3)))
      const boardAlt = bankAlt + (ladderMode ? 9 + Math.floor(rng() * 3) : 3 * paliers)
      if (ladderMode) {
        // MONTÉE PAR ÉCHELLE : berge plate → jetée au ras de l'eau → longue échelle → plongeoir en surplomb.
        p.platforms.push({ x: 0, alt: bankAlt, w: wx }) // berge gauche (colonne wx-1 = bankAlt : banc à niveau)
        const h = Math.min(MAX_LADDER_TILES, boardAlt - bankAlt + 2) // pied bankAlt, palier (top-2) = boardAlt
        p.platforms.push({ x: wx, alt: bankAlt, w: 2 }) // jetée (pied de l'échelle)
        p.ladders.push({ x: wx, topAlt: bankAlt + h, h })
        p.platforms.push({ x: wx, alt: boardAlt, w: 4 }) // PLONGEOIR en surplomb
      } else {
        // MONTÉE PAR PLATEFORMES : escalier de paliers (≤3) sur le SOL PLEIN à gauche jusqu'à une
        // plateforme de lancement à boardAlt ; puis SAUT (hgap 1) sur le PLONGEOIR qui déborde le lac.
        p.platforms.push({ x: 0, alt: bankAlt, w: 2 }) // berge d'entrée
        p.platforms.push(...ramp(2, 3 * paliers, bankAlt, boardAlt)) // escalier jusqu'à la plateforme de lancement
        p.platforms.push({ x: wx - 1, alt: bankAlt, w: 1 }) // berge du lac EN CREUX (banc gauche à niveau)
        p.platforms.push({ x: wx, alt: boardAlt, w: 4 }) // PLONGEOIR en surplomb (atteint au saut depuis le lancement)
      }
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      // PANNEAU (poteau + flèche vers le bas) au BOUT du plongeoir, au-dessus de l'eau libre → « saute ici »
      p.signs.push({ x: wx + 3, alt: boardAlt + 1 })
      // berge droite AU MÊME niveau (surface horizontale), puis redescente vers la sortie
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // au fond (plongée)
      placeBirds(boardAlt + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── PUITS : cuve marine ÉTROITE et PROFONDE (margelle de pierre), distinct du BASSIN large ────
    case 'puits': {
      const bankAlt = entryAlt + 4 // profond
      const ww = 3 // ÉTROIT (le bassin, lui, est large)
      const side = Math.max(3, Math.floor((w - ww) / 2))
      p.platforms.push(...ramp(0, side, entryAlt, bankAlt)) // montée gauche jusqu'à la margelle
      const wx = side
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      // MARGELLE : rebords de pierre à NIVEAU de chaque côté (berges égales → validateur berges).
      const rbx = wx + ww
      const flatW = Math.min(3, Math.max(1, w - rbx))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + 1 }) // au fond du puits
      placeBirds(bankAlt + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── CASCADE-BASSIN : une cascade remontable qui TOMBE dans un bassin marine (coffre au fond) ──
    case 'cascade-bassin': {
      const low = Math.max(1, entryAlt)
      const bankAlt = low + 2
      const rampW = 3
      p.platforms.push(...ramp(0, rampW, low, bankAlt)) // berge gauche vers la surface du bassin
      const wx = rampW
      const bw = Math.max(5, Math.floor((w - rampW) * 0.4)) // BASSIN (large-ish)
      p.waters.push({ x: wx, w: bw, kind: basinKind, bankAlt })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(bw / 2) })
      const rbx = wx + bw
      p.platforms.push({ x: rbx, alt: bankAlt, w: 2 }) // berge droite du bassin à niveau
      // CASCADE remontable qui alimente le bassin : colonne juste à droite, montant vers une corniche
      // haute. Une rampe de paliers garantit l'accès à la corniche (reachable), la cascade = le raccourci.
      const top = bankAlt + cascadeRise(rng) // cascade HAUTE (≥ 4× le panda)
      const colX = rbx + 2
      p.waters.push({ x: colX, w: 4, kind: 'cascade', bankAlt: top }) // colonne LARGE (2×) : on la GRIMPE
      // corniche JOINTIVE au bord droit de la colonne (émergence de la grimpe), plus d'échelle parallèle
      const cornX = colX + 4
      const cw = Math.max(3, Math.min(5, w - cornX))
      p.platforms.push({ x: cornX, alt: top, w: cw })
      const downStart = cornX + cw
      if (w - downStart > 0) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt))
      placeBirds(top + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── BOYAU IMMERGÉ (eau-passage) : tunnel marine OUVERT sur le côté, traversé À LA NAGE ────────
    case 'boyau-immerge': {
      // Cuve marine dont la paroi DROITE est OUVERTE (openSide) : on plonge par une colonne d'eau à
      // gauche, on nage SOUS un plafond de roche immergé (impossible de faire surface au milieu), puis
      // on RESSORT par le côté ouvert sur une corniche À NIVEAU (banc égal → cuve NON suspendue).
      const bankAlt = entryAlt + 3
      const rampW = 3
      const colW = 3
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // accès à la corniche gauche (surface)
      const wx = rampW
      const ww = Math.max(2 * colW + 4, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt, openSide: 'right' })
      // plafond de roche IMMERGÉ au milieu (force la nage sous la surface, comme lac-en-u)
      const ceilBotAlt = Math.min(4, Math.max(2, bankAlt - 2))
      const midX = wx + colW
      const midW = ww - 2 * colW
      const maxRock = 7
      const airGap = 2
      let rx = midX
      while (rx < midX + midW) {
        const seg = Math.min(maxRock, midX + midW - rx)
        p.rocks.push({ x: rx, altBot: ceilBotAlt, altTop: bankAlt, w: seg, solid: true })
        rx += seg + airGap
      }
      // SORTIE latérale par le bord OUVERT (droite), corniche À NIVEAU (banc égal), puis vers la sortie
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      // MONSTRES AQUATIQUES au fond (comme lac-en-u) — jamais de terrestre au-dessus de l'eau
      if (groundMobs.length) {
        const nAqua = Math.max(1, Math.min(3, Math.round((ww * bankAlt) / 80)))
        spread(ww, nAqua).forEach((ax, i) => p.spawns.push({ monsterId: groundMobs[i % groundMobs.length]!, x: wx + ax }))
      }
      placeBirds(bankAlt + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── GROTTE DE DÉPART SOUTERRAINE : boyau de roche fermé, bassin immergé à FRANCHIR À LA NAGE ──
    case 'grotte-depart': {
      // Module de SPAWN souterrain : plancher de roche PLEIN à gauche (le panda apparaît à mi-portée,
      // sur le solide), puis un bassin marine dont le milieu est coiffé d'un PLAFOND DE ROCHE IMMERGÉ
      // (on ne fait pas surface au centre → on NAGE dessous pour avancer), et un TOIT DE ROCHE au-dessus
      // de tout (grotte fermée : roche jusqu'au plafond). Corniche de sortie à droite, à niveau.
      const alt = Math.max(entryAlt, 3)
      const solidW = Math.max(Math.floor(w * 0.55), Math.floor(w / 2) + 2) // plancher solide couvre le milieu (spawn)
      p.platforms.push({ x: 0, alt, w: solidW }) // plancher de spawn (marchable, plein)
      if (alt - 1 >= 1) p.rocks.push({ x: 0, altBot: 1, altTop: alt - 1, w }) // « tout pierre dessous »
      const colW = 3
      const wx = solidW
      const ww = Math.max(2 * colW + 2, w - solidW - 3)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt: alt })
      // PLAFOND IMMERGÉ au milieu du bassin (force la plongée)
      const ceilBotAlt = Math.max(1, Math.min(alt - 1, alt - 2))
      const midX = wx + colW
      const midW = Math.max(0, ww - 2 * colW)
      let rx = midX
      while (rx < midX + midW) {
        const seg = Math.min(6, midX + midW - rx)
        p.rocks.push({ x: rx, altBot: ceilBotAlt, altTop: alt, w: seg, solid: true })
        rx += seg + 2
      }
      // corniche de sortie à droite, À NIVEAU (banc égal)
      const rbx = wx + ww
      p.platforms.push({ x: rbx, alt, w: Math.max(3, w - rbx) })
      // TOIT DE ROCHE au-dessus de tout (grotte fermée continue, roche jusqu'au plafond)
      pushVariedCeiling(p, w, alt, Math.floor(rng() * CEILING_VARIANTS))
      p.exitAlt = alt
      break
    }

    // ─── CHAÎNES VERTICALES VARIÉES ───────────────────────────────────────────────────────────────
    case 'echelle-trou-echelle': {
      // On grimpe une 1ʳᵉ échelle jusqu'à un palier, on franchit un TROU mortel au saut, puis on grimpe
      // une 2ᵉ échelle décalée jusqu'au sommet. Deux étages d'escalade séparés par un vide franchissable.
      const base = Math.max(1, entryAlt)
      const half = Math.max(8, Math.floor(w / 2))
      const land1 = poseLadder(p, 2, base, 0, 4, half - 3) // pied gauche + échelle 1 → palier1 (s'arrête avant le trou)
      p.gaps.push({ x: half - 3, w: 3 }) // TROU mortel entre le palier1 et le pied de l'échelle 2
      const top = poseLadder(p, half + 1, land1, half, w - half, w) // pied droit à land1 + échelle 2 → sommet
      p.exitAlt = top
      break
    }
    case 'echelle-zigzag': {
      // Une échelle mène à une suite de PASSERELLES en zigzag gauche-droite (montée puis redescente)
      // AU-DESSUS DU VIDE, jusqu'à la sortie. On grimpe, puis on slalome de passerelle en passerelle.
      const base = Math.max(1, entryAlt)
      const landAlt = poseLadder(p, 2, base, 0, 5, 7) // échelle → petit palier de départ du zigzag
      const pw = 3
      let x = 7
      let a = landAlt
      const seq = [2, 2, -2, -2, 2] // monter, monter, redescendre, redescendre, remonter (dents de scie)
      for (const d of seq) {
        if (x + pw > w) break
        a = Math.max(1, a + d)
        p.bridges.push({ x, alt: a, w: pw })
        x += pw + 2 // écart horizontal 2 (≤ portée de saut)
      }
      // palier de sortie SOLIDE au bout (raccord au module suivant)
      const outX = Math.min(w - 4, x)
      p.platforms.push({ x: outX, alt: a, w: Math.max(4, w - outX) })
      // VIDE mortel sous toute la travée du zigzag (rater = chute) — passerelles flottantes
      for (let gx = 7; gx < outX; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, outX - gx) })
      p.exitAlt = a
      break
    }
    case 'echelles-decalees': {
      // Deux échelles nettement DÉCALÉES horizontalement, reliées par un large palier intermédiaire
      // (montée franche : on grimpe à gauche, on marche jusqu'à droite, on regrimpe). Pas de quinconce serré.
      const base = Math.max(1, entryAlt)
      const mid = Math.max(7, Math.floor(w / 2))
      const land1 = poseLadder(p, 2, base, 0, 5, mid) // échelle 1 (gauche) → palier land1 (2..mid)
      const top = poseLadder(p, mid + 1, land1, mid, w - mid, w) // pied (mid..w) à land1 + échelle 2 (droite) → sommet
      p.exitAlt = top
      break
    }

    // ─── ÉCHELLE-DESCENTE PIÉGÉE : on descend, TROU mortel en bas, saut sur passerelle coiffée de roche ──
    case 'echelle-descente-piegee': {
      // On MONTE jusqu'au sommet de l'échelle (palier d'accès), on DESCEND l'échelle jusqu'à un petit
      // pied près du sol, un TROU MORTEL barre la route → il faut SAUTER sur une PASSERELLE latérale
      // COIFFÉE DE ROCHE (inaccessible par le haut : le toit de roche empêche d'y tomber d'en haut ;
      // seul le saut depuis le pied l'atteint), avec un dégagement de saut confortable sous la roche.
      const h = LADDER_H
      const footAlt = 1
      const topAlt = footAlt + h
      const palierAlt = topAlt - 2 // palier d'accès au sommet de l'échelle (règle du décalage pieds)
      const upW = Math.max(5, Math.floor(w * 0.32))
      p.platforms.push({ x: 0, alt: entryAlt, w: bank }) // berge d'entrée
      p.platforms.push(...ramp(bank, upW, entryAlt, palierAlt)) // rampe d'accès au sommet de l'échelle
      const ladX = bank + upW + 1
      p.platforms.push({ x: ladX - 2, alt: palierAlt, w: 4 }) // palier haut (on descend d'ici)
      p.ladders.push({ x: ladX, topAlt, h })
      p.platforms.push({ x: ladX - 1, alt: footAlt, w: 3 }) // pied de l'échelle (près du sol)
      const gapX = ladX + 2
      const gapW = 3
      p.gaps.push({ x: gapX, w: gapW }) // TROU MORTEL juste après le pied
      const passX = gapX + gapW
      const passAlt = footAlt + 1
      p.bridges.push({ x: passX, alt: passAlt, w: 4 }) // PASSERELLE latérale (saut depuis le pied)
      // TOIT DE ROCHE au-dessus de la passerelle (inaccessible par le haut), dégagement de saut ≥ CAVE_CLEARANCE
      p.rocks.push({ x: passX, altBot: passAlt + CAVE_CLEARANCE, altTop: passAlt + CAVE_CLEARANCE + 2, w: 4, solid: true })
      const outX = passX + 4
      if (w - outX > 0) p.platforms.push(...ramp(outX, w - outX, passAlt, exitAlt)) // sortie
      p.exitAlt = exitAlt
      break
    }

    // ─── CASCADE → GROTTE SOUS-MARINE : le rideau tombe (lucarne) dans un bassin sous toit de roche ──
    case 'cascade-grotte': {
      // CASCADE → GROTTE (spec user) : une CASCADE remontable, et À SA DROITE une GROTTE creusée dans la
      // ROCHE PLEINE — roche SOLIDE au-DESSUS (plafond) et en-DESSOUS (falaise jusqu'au sol). La SEULE
      // façon d'atteindre la grotte est de GRIMPER la cascade et d'enjamber sur son plancher. Coffre au fond.
      const A = Math.max(entryAlt, 2)
      const T = A + cascadeRise(rng) // sommet de la cascade = niveau du plancher de la grotte (≥ MIN_CASCADE_TILES)
      let x = 0
      p.platforms.push({ x, alt: A, w: bank }); x += bank // berge d'accès (on bondit dans la cascade)
      p.waters.push({ x, w: 2, kind: 'cascade', bankAlt: T, bottomAlt: A }) // CASCADE remontable A → T (repose sur la berge)
      const caveX = x + 2
      const floorW = Math.max(bank, w - caveX) // plancher de la grotte, jusqu'au bord (= la sortie, au niveau T)
      p.platforms.push({ x: caveX, alt: T, w: floorW }) // PLANCHER de la grotte (borde la cascade → atteignable en grimpant)
      // ROCHE PLEINE SOUS le plancher (falaise du sol jusqu'à T) → aucun accès par en bas
      if (T - 1 >= 0) p.rocks.push({ x: caveX, altBot: 0, altTop: T - 1, w: floorW, solid: true })
      // PLAFOND DE ROCHE au-dessus de la partie GAUCHE (contre la cascade) → la « grotte » proprement dite ;
      // dégagement CAVE_CLEARANCE pour y marcher (≥ saut confortable, cf. validateur de plafond).
      const roofW = Math.min(floorW, 6)
      p.rocks.push({ x: caveX, altBot: T + CAVE_CLEARANCE, altTop: T + CAVE_CLEARANCE + CAVE_CEILING_THICK, w: roofW, solid: true })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: caveX + 1 }) // coffre AU FOND de la grotte (sous le toit)
      placeBirds(T + CAVE_CLEARANCE + 4)
      p.exitAlt = T
      break
    }

    // ─── CASCADE → TROU MORTEL (piège) : on FRANCHIT le rideau par le haut, la descendre = mort ────────
    case 'cascade-trou': {
      const low = Math.max(entryAlt, 1)
      const top = low + cascadeRise(rng)
      const L = Math.max(4, Math.floor(w * 0.3))
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche gauche d'appel
      p.waters.push({ x: L, w: 2, kind: 'cascade', bankAlt: top }) // rideau étroit AU-DESSUS DU VIDE (chute = mort)
      // corniche droite au MÊME niveau bas, à 2 tuiles (largeur du rideau) → on SAUTE par-dessus le vide
      const rx = L + 2
      const rw = Math.max(4, w - rx)
      p.platforms.push({ x: rx, alt: low, w: rw })
      placeBirds(top + 2)
      p.exitAlt = low
      break
    }

    // ─── CASCADE LARGE (rideau large) qui alimente un bassin (pas de vide mortel) ─────────────────────
    case 'cascade-large': {
      const bankAlt = entryAlt + 2
      const rampW = 3
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // berge gauche → surface du bassin
      const wx = rampW
      const bw = Math.max(10, w - 2 * rampW)
      p.waters.push({ x: wx, w: bw, kind: basinKind, bankAlt }) // BASSIN qui recueille la chute
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(bw / 2) })
      // RIDEAU LARGE remontable (5-7 tuiles) qui retombe dans le bassin (bottomAlt = surface → aucun vide)
      const top = bankAlt + cascadeRise(rng)
      const curtainW = Math.max(5, Math.min(7, bw - 2))
      p.waters.push({ x: wx + 1, w: curtainW, kind: 'cascade', bankAlt: top, bottomAlt: bankAlt })
      // berge droite à niveau + sortie
      const rbx = wx + bw
      const flatW = Math.min(bank, Math.max(1, w - rbx))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      placeBirds(top + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── CASCADE TROUÉE : colonnes cascade / vide alternées, franchies au saut sur des pierres de gué ──
    case 'cascade-trouee': {
      const alt = Math.max(entryAlt, 2)
      const top = alt + cascadeRise(rng)
      p.platforms.push({ x: 0, alt, w: bank }) // berge gauche (solide)
      // CHASME central : VIDE mortel sous toute la travée (tranches ≤3 → chacune, mais on ne les
      // franchit pas au sol : on saute de PIERRE DE GUÉ en pierre de gué). Rater = chute mortelle.
      const rightBerge = w - bank
      for (let gx = bank; gx < rightBerge; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, rightBerge - gx) })
      // motif répété : colonne (cascade OU vide, 2) → PIERRE de gué (3) → … Le rideau (cascade) coule au
      // DESSUS DU VIDE (chute = mort) ; on alterne eau / vide entre les gués.
      let x = bank
      let toggle = 0
      while (x < rightBerge - 2) {
        const colW = 2
        if (toggle % 2 === 0) p.waters.push({ x, w: colW, kind: 'cascade', bankAlt: top }) // rideau (chute = mort)
        // toggle impair → simple colonne de vide (déjà gappée par le chasme central)
        x += colW
        const stoneW = Math.min(3, rightBerge - x)
        if (stoneW <= 0) break
        p.platforms.push({ x, alt, w: stoneW }) // pierre de gué flottante (on saute de l'une à l'autre)
        x += stoneW
        toggle++
      }
      p.platforms.push({ x: rightBerge, alt, w: bank }) // berge droite (solide)
      placeBirds(top + 2)
      p.exitAlt = alt
      break
    }

    // ─── CASCADE → LAC-TRÉSOR EN CUL-DE-SAC : trésor au fond, demi-tour + remontée, sortie par le HAUT ──
    case 'cascade-cul-de-sac': {
      // On arrive en HAUT, une cascade descend dans un lac SANS SORTIE PAR LE BAS (trésor au fond) : un
      // PONT coiffe le lac avec un TROU central par lequel on plonge chercher le coffre, puis on remonte
      // et on REPASSE PAR LE HAUT (le pont) pour ressortir. La sortie est HAUTE (jamais par le bas).
      const bankAlt = entryAlt + 4 // lac profond, berges hautes
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // montée vers le pont/berge
      const wx = rampW
      const ww = Math.max(8, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      // PONT à bankAlt avec un TROU central (on plonge par là chercher le trésor du fond)
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      // CASCADE remontable qui descend par le trou du pont dans le lac (bottomAlt = surface → pas de vide)
      p.waters.push({ x: holeL, w: 3, kind: 'cascade', bankAlt: bankAlt + cascadeRise(rng), bottomAlt: bankAlt })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // trésor au FOND (cul-de-sac)
      // berge droite au MÊME niveau (rebords à niveau), puis SORTIE HAUTE (on repasse par le haut)
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      placeBirds(bankAlt + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── CASCADE EN W : rideaux mortels latéraux + îlot central (cascade → petit bassin) ────────────
    case 'cascade-w': {
      // Passerelle plate GAUCHE (lancement) → cascade GAUCHE au-dessus du VIDE (chute mortelle, on saute
      // par-dessus) → ÎLOT central (berge | bassin où TOMBE une cascade + coffre au fond | berge) →
      // cascade DROITE au-dessus du VIDE → passerelle plate DROITE (relance + sortie). Tout à plat (A) :
      // on enchaîne des sauts de 2-3 tuiles ; rater un rideau = chute mortelle (checkPitDeath).
      const A = Math.max(entryAlt, 2)
      const casW = 2 // rideaux latéraux étroits (sautables) au-dessus du vide
      const top = A + cascadeRise(rng)
      let x = 0
      p.platforms.push({ x, alt: A, w: bank }); x += bank // passerelle GAUCHE
      p.waters.push({ x, w: casW, kind: 'cascade', bankAlt: top }); p.gaps.push({ x, w: casW }); x += casW // rideau GAUCHE → mort
      p.platforms.push({ x, alt: A, w: 1 }); x += 1 // berge gauche de l'îlot
      const basinW = 3
      p.waters.push({ x, w: basinW, kind: basinKind, bankAlt: A }) // petit bassin central (atterrissage sûr)
      p.waters.push({ x: x + 1, w: 2, kind: 'cascade', bankAlt: A + cascadeRise(rng), bottomAlt: A }) // cascade qui TOMBE dans le bassin
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: x + 1 }) // coffre au fond du bassin
      x += basinW
      p.platforms.push({ x, alt: A, w: 1 }); x += 1 // berge droite de l'îlot
      p.waters.push({ x, w: casW, kind: 'cascade', bankAlt: top }); p.gaps.push({ x, w: casW }); x += casW // rideau DROIT → mort
      p.platforms.push({ x, alt: A, w: Math.max(bank, w - x) }) // passerelle DROITE + sortie
      placeBirds(top + 2)
      p.exitAlt = A
      break
    }

    // ─── CASCADE SAUT DE L'ANGE : on GRIMPE une cascade TRÈS HAUTE jusqu'à un perchoir, panneau flèche
    // vers le bas, puis PLONGEON à l'aveugle dans un BASSIN en contrebas (coffre au fond) ──────────────
    case 'cascade-saut-ange': {
      const A = Math.max(entryAlt, 2)
      const T = A + cascadeRise(rng) + 2 // perchoir TRÈS haut
      let x = 0
      p.platforms.push({ x, alt: A, w: bank }); x += bank // berge basse d'accès (on saute dans la cascade)
      p.waters.push({ x, w: 4, kind: 'cascade', bankAlt: T, bottomAlt: A }) // cascade HAUTE grimpable (repose au sol, pas de vide)
      const perchX = x + 4 // perchoir JOINTIF au bord droit de la colonne
      p.platforms.push({ x: perchX, alt: T, w: 3 }) // perchoir en surplomb
      p.signs.push({ x: perchX + 1, alt: T + 1 }) // PANNEAU flèche vers le bas → « saute ici »
      const basinX = perchX + 3
      const basinW = Math.max(5, w - basinX - 2)
      p.waters.push({ x: basinX, w: basinW, kind: basinKind, bankAlt: A }) // BASSIN d'atterrissage (visible en contrebas)
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: basinX + Math.floor(basinW / 2) })
      const rbx = basinX + basinW
      p.platforms.push({ x: rbx, alt: A, w: Math.max(1, w - rbx) }) // berge droite / sortie
      placeBirds(T + 2)
      p.exitAlt = A
      break
    }

    // ─── CASCADE LARGE + PIERRE À MI-HAUTEUR : cascade TRÈS LARGE au-dessus du VIDE (chute mortelle),
    // une grosse PIERRE RIGIDE à mi-hauteur oblige à gérer la montée/descente pour rester dans l'eau ──
    case 'cascade-large-pierre': {
      const A = Math.max(entryAlt, 2)
      const T = A + cascadeRise(rng) + 3 // très haut
      const M = A + Math.floor((T - A) / 2) // mi-hauteur (obstacle)
      const casW = 6 // cascade TRÈS LARGE
      let x = 0
      p.platforms.push({ x, alt: A, w: bank }); x += bank // berge basse d'accès (gauche)
      p.waters.push({ x, w: casW, kind: 'cascade', bankAlt: T }) // cascade LARGE au-dessus du VIDE (chute = mort)
      p.platforms.push({ x: x + 2, alt: M, w: 2, solid: true }) // GROSSE PIERRE rigide à mi-hauteur (on la contourne)
      const topX = x + casW // corniche haute JOINTIVE au bord droit (émergence de la grimpe)
      p.platforms.push({ x: topX, alt: T, w: bank })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: topX + 1, alt: T + 1 })
      x = topX + bank
      if (w - x > 0) p.platforms.push(...ramp(x, w - x, T, exitAlt))
      placeBirds(T + 2)
      p.exitAlt = exitAlt
      break
    }

    // ─── ÉCHELLES-LIANES : des lianes PENDENT d'un plafond (pied SUSPENDU dans le vide) ; on marche au
    // sol, on SAUTE pour agripper une liane et grimper vers les paliers du plafond, on enchaîne jusqu'à
    // la sortie EN HAUT. Pas d'escalier de plateaux — juste le sol d'accès + les lianes. ──────────────
    case 'echelles-lianes': {
      // ÉCHELLES SUSPENDUES « EN T » (retour user) : des échelles accrochées au PLAFOND par une PIERRE
      // rigide qui les COIFFE (⊤) — on ne peut PAS monter au-dessus. On grimpe une échelle, puis on SAUTE
      // en DIAGONALE vers la suivante (décalée vers le HAUT et la DROITE, travées qui se CHEVAUCHENT),
      // jusqu'à enjamber sur le plateau de SORTIE (dont le bord est un peu SOUS le sommet de la dernière
      // échelle). Rater = on retombe sur le sol de la grotte et on recommence. Pente régulière.
      const floor = Math.max(1, entryAlt)
      const H = LADDER_H     // longueur d'échelle (≥ MIN_LADDER_TILES)
      const DX = 4           // écart horizontal ENTRE échelles : un cran de plus que le saut à plat →
                             // on saute en diagonale, sensation « je vais me rater » voulue (cf. HUNG_JUMP_COLS)
      const STEP = 4         // gain d'altitude par échelle (travées chevauchantes : STEP < H → transfert au saut)
      p.platforms.push({ x: 0, alt: floor, w: bank }) // corniche d'ACCÈS : on bondit pour agripper la 1re échelle
      const fitW = Math.floor((w - bank - 2) / DX)
      const N = Math.max(2, Math.min(4, fitW))
      let lastX = bank, lastTop = floor + 2 + H
      for (let i = 0; i < N; i++) {
        const lx = bank + i * DX
        const footAlt = floor + 2 + i * STEP // 1re échelle : pied à floor+2 → agrippable en bondissant de la corniche
        const isLast = i === N - 1
        // DERNIÈRE échelle plus HAUTE : son sommet dépasse NETTEMENT le plateau de sortie (retour user :
        // « la dernière ne monte pas assez haut, on ne peut pas sortir »).
        const h = isLast ? Math.min(MAX_LADDER_TILES, H + 3) : H
        const topAlt = footAlt + h
        p.ladders.push({ x: lx, topAlt, h, hung: true }) // échelle SUSPENDUE (pied dans le vide)
        // PIERRE de coiffe (barre du T) : dalle RIGIDE juste au-dessus du sommet → blocage vers le haut
        p.rocks.push({ x: lx - 1, altBot: topAlt + 1, altTop: topAlt + 2, w: 3, solid: true })
        lastX = lx; lastTop = topAlt
      }
      // PLATEAU DE SORTIE : PROCHE (2 colonnes) et 3 rangées SOUS le sommet de la dernière échelle (haute)
      // → petite enjambée sûre pour finir (alors que les transferts intermédiaires, eux, sont exigeants).
      const exitX = lastX + 2
      const exitAltE = lastTop - 3
      p.platforms.push({ x: exitX, alt: exitAltE, w: Math.max(bank, w - exitX) })
      placeBirds(exitAltE + 3)
      p.exitAlt = exitAltE
      break
    }

    // ─── ÉCHELLES ZIGZAG « gauche-droite-gauche » (retour user) : mêmes échelles suspendues « en T »,
    // mais on BONDIT alternativement à GAUCHE puis à DROITE en montant → un chevron/zigzag serré dans une
    // bande verticale étroite (2 colonnes). Plus nerveux que la pente régulière des echelles-lianes. ────
    case 'echelles-zigzag': {
      const floor = Math.max(1, entryAlt)
      const H = LADDER_H
      const DX = 4      // écart entre les 2 colonnes (saut diagonal ≤ HUNG_JUMP_COLS)
      const STEP = 6    // gain d'altitude par échelle : > (H+2)/2 → deux échelles d'une même colonne ne se chevauchent JAMAIS
      const xL = bank, xR = bank + DX
      p.platforms.push({ x: 0, alt: floor, w: bank }) // corniche d'ACCÈS (on bondit sur la 1re échelle, à gauche)
      const N = 3 // gauche, droite, gauche
      let lastX = xL, lastTop = floor + 2 + H
      for (let i = 0; i < N; i++) {
        const lx = i % 2 === 0 ? xL : xR // GAUCHE, DROITE, GAUCHE, DROITE… → zigzag
        const footAlt = floor + 2 + i * STEP
        const isLast = i === N - 1
        const h = isLast ? Math.min(MAX_LADDER_TILES, H + 3) : H // dernière plus HAUTE (sortie franche)
        const topAlt = footAlt + h
        p.ladders.push({ x: lx, topAlt, h, hung: true })
        p.rocks.push({ x: lx - 1, altBot: topAlt + 1, altTop: topAlt + 2, w: 3, solid: true }) // pierre de coiffe (⊤)
        lastX = lx; lastTop = topAlt
      }
      // sortie proche de la dernière échelle, un peu en contrebas (enjambée sûre)
      const zExitX = lastX + 2
      const zExitAlt = lastTop - 3
      p.platforms.push({ x: zExitX, alt: zExitAlt, w: Math.max(bank, w - zExitX) })
      placeBirds(zExitAlt + 3)
      p.exitAlt = zExitAlt
      break
    }

    case 'lacs-cascade-montee': {
      // ESCALIER DE LACS — 100 % EAU CONTINUE, SANS AUCUN MUR (retour user : « même les murs tu peux les
      // supprimer avec tes cascades, c'est propre ! »). Un SEUL ensemble d'eau : des lacs JOINTIFS aux
      // parois internes TOUTES ouvertes (openSide 'both') dont la surface monte en marches, chaque marche
      // = une CASCADE FINE d'1 tuile qui déverse le lac supérieur dans l'inférieur. Chaque lac s'étend
      // SOUS sa cascade (l'eau descend jusqu'au sol → rien ne flotte). Zéro pierre au milieu ; seules
      // surfaces solides = les 2 rives d'entrée/sortie (là où l'on marche). On grimpe les cascades pour
      // remonter de lac en lac (le validateur modélise cascades remontables + lacs traversables à la nage).
      const POOL = 5 // largeur d'un lac ; la cascade fine (1 tuile) occupe la tuile suivante
      let alt = Math.max(2, entryAlt)
      let x = 0
      let placedCoffre = false
      p.platforms.push({ x, alt, w: bank }); x += bank // RIVE d'accès (gauche)
      while (x + POOL + 1 <= w - bank) {
        const top = alt + cascadeRise(rng)
        // LAC : parois internes OUVERTES (eau continue), s'étend SOUS la cascade (colonne x+POOL comprise)
        p.waters.push({ x, w: POOL + 1, kind: basinKind, bankAlt: alt, openSide: 'both' })
        if (basinKind !== 'lave' && !placedCoffre) { p.props.push({ kind: 'coffre', x: x + 1 }); placedCoffre = true }
        // CASCADE FINE (1 tuile) = la marche d'eau : pied dans CE lac, sommet dans le lac suivant
        p.waters.push({ x: x + POOL, w: 1, kind: 'cascade', bankAlt: top, bottomAlt: alt })
        x += POOL + 1
        alt = top
      }
      // LAC FINAL (sommet), parois ouvertes ; la rive de sortie borde sa surface (au même niveau)
      const fw = Math.max(POOL, w - x - bank)
      p.waters.push({ x, w: fw, kind: basinKind, bankAlt: alt, openSide: 'both' })
      x += fw
      p.platforms.push({ x, alt, w: Math.max(1, w - x) }) // RIVE de sortie (droite)
      placeBirds(alt + 3)
      p.exitAlt = alt
      break
    }

    // ─── ESCALIER DE LACS DESCENDANT : on grimpe à un lac perché, l'eau se déverse de lac en lac vers le bas ──
    case 'lacs-cascade-descente': {
      const low = Math.max(1, entryAlt)
      const steps = 3
      const peak = low + cascadeRise(rng) // sommet atteint en grimpant une cascade
      let x = 0
      p.platforms.push({ x, alt: low, w: 2 }); x += 2 // berge d'accès basse
      // MONTÉE : une cascade remontable jusqu'au lac perché
      p.waters.push({ x, w: 3, kind: 'cascade', bankAlt: peak, bottomAlt: low }); x += 3
      p.platforms.push({ x, alt: peak, w: 1 }); x += 1 // corniche d'émergence
      // DESCENTE : lacs en MARCHES qui descendent (chaque marche ≤ 3 rangées → atteignable au saut depuis le bas)
      let alt = peak
      for (let i = 0; i < steps; i++) {
        const lakeW = 3
        p.waters.push({ x, w: lakeW, kind: basinKind, bankAlt: alt }) // lac de la marche
        if (basinKind !== 'lave' && i === steps - 1) p.props.push({ kind: 'coffre', x: x + Math.floor(lakeW / 2) })
        x += lakeW
        const lower = Math.max(low, alt - 3)
        // rideau de cascade qui déverse ce lac dans le suivant (plus bas), reposant sur la marche basse
        p.waters.push({ x, w: 2, kind: 'cascade', bankAlt: alt, bottomAlt: lower })
        p.platforms.push({ x: x + 2, alt: lower, w: 1 }) // berge de la marche inférieure
        x += 2 + 1
        alt = lower
      }
      p.platforms.push({ x, alt, w: Math.max(1, w - x) }) // berge de SORTIE basse
      p.exitAlt = alt
      break
    }

    // ─── LAC → CASCADE → PLATEAU : lac horizontal, puis cascade remontable vers un plateau EN HAUT ──
    case 'lac-cascade-plateau': {
      // Un bout de LAC marine HORIZONTAL (coffre au fond), puis à sa FIN une CASCADE remontable qu'on
      // remonte (~3-4 sauts de hauteur) vers un PLATEAU en HAUT (sortie haute). Une RAMPE de paliers
      // parallèle garantit l'accès au plateau au saut simple (reachable) ; la cascade = le raccourci fun.
      const bankAlt = Math.max(2, entryAlt)
      const rampW = 3
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // berge d'accès à la surface du lac
      const wx = rampW
      const lakeW = Math.max(6, Math.floor((w - rampW) * 0.42)) // LAC horizontal (large-ish)
      p.waters.push({ x: wx, w: lakeW, kind: basinKind, bankAlt })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(lakeW / 2) }) // au fond du lac
      const rbx = wx + lakeW
      p.platforms.push({ x: rbx, alt: bankAlt, w: 2 }) // berge droite du lac (à niveau)
      // CASCADE remontable à la FIN du lac : ≥ 4× le panda vers le plateau
      const top = bankAlt + cascadeRise(rng)
      const colX = rbx + 2
      p.waters.push({ x: colX, w: 4, kind: 'cascade', bankAlt: top }) // colonne LARGE (2×) remontable (chute mortelle au fond)
      // plus d'échelle : on GRIMPE la cascade jusqu'au plateau, JOINTIF au bord droit de la colonne
      const cornW = 5
      const platX = colX + 4
      p.platforms.push({ x: platX, alt: top, w: Math.max(cornW, w - platX) })
      placeBirds(top + 2)
      p.exitAlt = top
      break
    }

    // ─── ESCALIER À GRANDS PAS : marches espacées montant de ~SIMPLE_JUMP_ROWS (saut franc exigé) ────
    case 'escalier-saut': {
      // Marches de TERRE espacées montant de SIMPLE_JUMP_ROWS (près du max de saut) avec un écart
      // horizontal → chaque marche force un VRAI saut (haut ET loin). SOL PLEIN continu dessous
      // (rater = retomber au sol, jamais mortel). ≤ 2 marches surélevées (sol + 2 = 3 paliers max).
      const base = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt: base, w }) // sol plein continu (retombée sûre)
      const rise = SIMPLE_JUMP_ROWS // +3 par marche (saut franc)
      const stepW = 3
      const gap = 2 // écart horizontal (≤ portée à +3 rangées → franchissable, cf. canReach)
      const pitch = stepW + gap
      let x = bank
      let a = base
      while (x + stepW <= w - bank && a - base < 2 * rise) {
        a += rise
        p.platforms.push({ x, alt: a, w: stepW })
        x += pitch
      }
      p.exitAlt = a
      break
    }

    // ─── ÉCHELLES SUCCESSIVES : échelle → court palier → 2ᵉ échelle (enchaînées, sans marche large) ──
    case 'echelles-successives': {
      const base = Math.max(1, entryAlt)
      const x1 = 2
      const palRight = Math.min(w - 3, x1 + 7) // court palier de sortie de l'échelle 1
      const land1 = poseLadder(p, x1, base, 0, x1 + 3, palRight) // échelle 1 → petit palier
      const x2 = Math.min(w - 3, palRight - 2) // 2ᵉ échelle DÈS la fin du palier (successive)
      const top = poseLadderOn(p, x2, land1, w) // pied = le palier de l'échelle 1 (déjà posé)
      p.exitAlt = top
      break
    }
  }

  // Placement GÉNÉRIQUE des monstres terrestres : posés SUR les plateformes marchables assez larges
  // (≥4) à leur altitude réelle → jamais en l'air ni dans la roche, toujours de la place pour
  // patrouiller (validateur monstersOffSurface). Le LAC EN U place lui-même ses mobs AQUATIQUES dans
  // l'eau (proportionnels à la surface) → on saute le placement générique pour ce module.
  const walkable = p.platforms.filter((pl) => pl.w >= 4).sort((a, b) => a.x - b.x)
  if (m.kind !== 'lac-en-u') groundMobs.forEach((id, i) => {
    if (walkable.length === 0) { p.spawns.push({ monsterId: id, x: Math.round((w * (i + 1)) / (groundMobs.length + 1)) }); return }
    const pl = walkable[i % walkable.length]!
    const cx = Math.min(pl.x + pl.w - 2, Math.max(pl.x + 1, pl.x + Math.floor(pl.w / 2)))
    p.spawns.push({ monsterId: id, x: cx, alt: pl.alt })
  })

  // SOCLE DE PIERRE jusqu'au sol sous les surfaces PLEINES (mesa à coiffe de biome) + support
  // continu le long des CASCADES/berges. Exclut le VIDE ('vide' : corniches qui doivent flotter)
  // et la ROCHE ('roche' : grotte, déjà pleine + plafond). Colonnes d'eau laissées ouvertes.
  if (m.fillBelow === 'sol' || m.fillBelow === 'marine' || m.fillBelow === 'cascade' || m.fillBelow === 'lave') {
    addPedestals(p, w)
  }
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
  // DÉPART STANDARDISÉ (phase 2b) : le PREMIER module est TOUJOURS une bande PLATE à UN SEUL niveau
  // de sol — pas de rampe d'amorce (qui empilait des paliers « à deux niveaux » au spawn), pas de
  // plateforme parallèle. Sa hauteur VARIE d'un niveau à l'autre (startAlt ∈ {2,3,4}, toujours
  // joignable du sol au saut simple ; rise ≤ 4). Un SOCLE PLEIN (mesa, posé plus bas) referme le
  // dessous → une seule bande plate visible au départ. Ensuite la variété reprend (rester, grimper,
  // ou sauter dans l'eau/la cascade). Plage {3,4} : varie d'un niveau à l'autre, reste joignable du
  // sol (≤ 4) ET laisse ≥ 3 rangées d'écart avec une sortie tout en bas (validateur départ/sortie).
  // ALTITUDE DE DÉPART : décidée dans planModules (variée par graine, cf. Module.startAlt sur le module
  // de spawn) — 0 = départ au SOL, 3-4 = surélevé. Fallback surélevé si un appelant direct l'omet.
  const spawnModule = modules.find((m) => m.spawnHere)
  const startAlt = spawnModule?.startAlt ?? (3 + (hashSeed(opts.id + ':startalt') % 2))
  let runningAlt = startAlt
  modules.forEach((m, i) => {
    const rng = mulberry32(seed + i * 2654435761)
    const [wmin, wmax] = m.widthRange
    const w = wmin + (hashSeed(opts.id + ':' + i + ':' + m.kind) % (wmax - wmin + 1))
    const piece = buildModule(m, rng, w, runningAlt)
    // départ / sortie
    if (m.spawnHere) {
      piece.start = { x: Math.floor(w / 2), alt: runningAlt }
      // le SOCLE PLEIN sous la bande de départ (mesa) est désormais posé par addPedestals (socle de
      // pierre générique sous toute surface pleine) → une seule bande plate visible au départ.
    }
    if (m.exitHere) piece.exit = { x: w - 3, alt: piece.exitAlt }
    pieces.push({ piece, x0: cursorX, w })
    cursorX += w
    runningAlt = piece.exitAlt
  })
  const totalWidth = cursorX + 2

  // 2) enveloppe verticale. On distingue le sommet des SURFACES MARCHABLES (platforms) de celui des
  // PLAFONDS DE ROCHE (rocks) pour NE PAS laisser de dalle de ciel morte au-dessus des grottes : le
  // plafond d'un tunnel monte souvent bien plus haut que la plus haute plateforme, et garder +6 tuiles
  // au-dessus donnait un grand vide bleu inutile. On garde donc juste ce qu'il faut :
  //   • SKY_PAD tuiles de dégagement au-dessus de la plus haute plateforme (> hauteur de saut ≈ 4 →
  //     on peut sauter du sommet sans sortir du monde, plafond du monde traversable R114) ;
  //   • le plafond de roche le plus haut tient dans le monde (+1 tuile).
  let maxPlatAlt = 0
  let maxRockAlt = 0
  let maxAerialAlt = 0 // les oiseaux volent AU-DESSUS des surfaces : le ciel doit les contenir (row ≥ 1)
  for (const { piece } of pieces) {
    for (const pl of piece.platforms) maxPlatAlt = Math.max(maxPlatAlt, pl.alt)
    for (const rk of piece.rocks) maxRockAlt = Math.max(maxRockAlt, rk.altTop)
    for (const s of piece.spawns) if (s.aerial && s.alt !== undefined) maxAerialAlt = Math.max(maxAerialAlt, s.alt)
  }
  const SKY_PAD = 5 // dégagement au-dessus de la plus haute plateforme (> saut ~4 tuiles), sans ciel mort
  const groundRow = Math.max(maxPlatAlt + SKY_PAD, maxRockAlt + 1, maxAerialAlt + 1)
  const heightTiles = groundRow + 2
  const row = (alt: number) => groundRow - alt

  // 3) EXPAND vers LevelDef
  const platforms: LevelDef['platforms'] = []
  const bridges: NonNullable<LevelDef['bridges']> = []
  const gaps: NonNullable<LevelDef['gaps']> = []
  const hazards: NonNullable<LevelDef['hazards']> = []
  const ladders: NonNullable<LevelDef['ladders']> = []
  const rockBands: NonNullable<LevelDef['rockBands']> = []
  const spawns: LevelDef['spawns'] = []
  const props: NonNullable<LevelDef['props']> = []
  const signs: NonNullable<LevelDef['signs']> = []
  let start: LevelDef['start']
  let exit: LevelDef['exit']

  for (const { piece, x0 } of pieces) {
    for (const pl of piece.platforms) platforms.push({ x: x0 + pl.x, y: row(pl.alt), w: pl.w, ...(pl.solid ? { solid: true } : {}) })
    for (const b of piece.bridges) bridges.push({ x: x0 + b.x, y: row(b.alt), w: b.w })
    for (const l of piece.ladders) ladders.push({ x: x0 + l.x, y: row(l.topAlt), h: l.h, ...(l.hung ? { hung: true } : {}) })
    for (const g of piece.gaps) gaps.push({ x: x0 + g.x, w: g.w })
    // dalles de roche (plafond de tunnel / socle) : y = rangée du HAUT de la dalle, h = épaisseur ;
    // `solid` = plafond à collision pleine (on ne saute pas à travers).
    for (const rk of piece.rocks) rockBands.push({ x: x0 + rk.x, y: row(rk.altTop), w: rk.w, h: rk.altTop - rk.altBot + 1, ...(rk.solid ? { solid: true } : {}) })
    // pics : `top` = rangée de la surface qui les porte (corniche en hauteur), sinon au sol (top absent)
    for (const s of piece.spikes) hazards.push({ kind: 'spikes', x: x0 + s.x, w: s.w, ...(s.alt !== undefined ? { top: row(s.alt) } : {}) })
    for (const wtr of piece.waters) {
      const top = row(wtr.bankAlt) // surface d'eau À RAS du rebord (berges) — pas de bande d'air au-dessus
      if (wtr.kind === 'cascade') {
        if (wtr.bottomAlt !== undefined) {
          // CASCADE QUI ALIMENTE UN BASSIN : le rideau s'arrête à la surface du lac (bottomAlt), PAS de
          // vide mortel dessous — l'eau retombe dans le bassin marine posé à cette altitude (cf.
          // cascade-grotte / cascade-large / cascade-cul-de-sac). Remontable, jamais de noyade.
          const bottomRow = row(wtr.bottomAlt)
          hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, bottomRow - top), water: 'cascade' })
        } else {
          // CASCADE claire REMONTABLE : elle COULE JUSQU'AU BAS DE LA CARTE (rangée heightTiles), au
          // DESSUS DU VIDE (aucun sol dessous) — la descendre jusqu'au fond = chute mortelle
          // (checkPitDeath). Aucune pierre/cuve : c'est de l'eau qui s'écoule, pas un bassin.
          hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, heightTiles - top), water: 'cascade' })
          gaps.push({ x: x0 + wtr.x, w: wtr.w }) // VIDE sous la cascade → descendre au fond = mort
        }
      } else {
        // CUVE de fond plein (marine OU lave) : le FOND repose TOUJOURS sur le SOL PLEIN, sans espace
        // vide. On étend le liquide jusqu'à recouvrir la surface du sol (rangée groundRow) → jamais de
        // liquide qui vole. 'lave' = cuve de pierre MORTELLE (enfer) ; 'marine' = bassin de noyade.
        hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, groundRow + 1 - top), water: wtr.kind === 'lave' ? 'lave' : 'basin', ...(wtr.openSide ? { openSide: wtr.openSide } : {}) })
      }
    }
    for (const s of piece.spawns) spawns.push({ monsterId: s.monsterId, x: x0 + s.x, ...(s.alt !== undefined ? { y: row(s.alt) } : {}) })
    for (const pr of piece.props) props.push({ kind: pr.kind, x: x0 + pr.x, ...(pr.alt !== undefined ? { y: row(pr.alt) } : {}) })
    for (const sg of piece.signs) signs.push({ x: x0 + sg.x, y: row(sg.alt) })
    if (piece.start) start = { x: x0 + piece.start.x, y: row(piece.start.alt) }
    if (piece.exit) exit = { x: x0 + piece.exit.x, y: row(piece.exit.alt) }
  }

  // quelques décorations au sol (herbe/champignon selon le biome) réparties sur la largeur
  const decoKind = opts.biome === 'foret' || opts.biome === 'jungle' ? 'champignon' : 'herbe'
  for (const f of [0.18, 0.45, 0.72]) props.push({ kind: decoKind, x: Math.round(totalWidth * f) })

  // DÉPART SÛR (marge globale) : aucun spawn — terrestre OU aérien — n'est laissé à moins de
  // SAFE_SPAWN_TILES tuiles du x de départ. Couvre les monstres des modules voisins et les oiseaux
  // qui, malgré le module de spawn vidé, se retrouveraient à portée du point d'apparition.
  const SAFE_SPAWN_TILES = 8
  const nearSafe = start
    ? spawns.filter((s) => Math.abs(s.x - start!.x) >= SAFE_SPAWN_TILES)
    : spawns
  // DÉCLUSTERING (retour joueur : « des mobs collés, 2-3 spawnés à quelques tuiles ») : on impose un
  // ESPACEMENT MINIMUM entre les spawns qui jalonnent le CHEMIN — les mobs TERRESTRES et les OISEAUX
  // piqueurs (les grappes que le joueur se prend en pleine face). Les mobs AQUATIQUES sont EXCLUS : ils
  // vivent dans les cuves d'eau (bancs de poissons rencontrés À LA NAGE), c'est une menace de milieu, pas
  // une grappe sur le chemin — les déclustérer viderait les plans d'eau et effondrerait l'XP des biomes
  // aquatiques (désert/jungle/plage). Balayage gauche→droite (tri STABLE → déterministe) : on ne garde
  // qu'UN spawn par FENÊTRE de MIN_SPAWN_SPACING tuiles. Dans une fenêtre on retient l'espèce la plus
  // PRÉCIEUSE, dans l'ordre : (1) PAS ENCORE gardée dans ce niveau (→ MAXIMISE les espèces distinctes,
  // aucune ne disparaît même arrivée en nuée) ; (2) la plus RARE du niveau ; (3) TERRESTRE plutôt
  // qu'AÉRIEN (le sol porte le vrai contenu) ; (4) le plus à gauche. Préserve la DIVERSITÉ sans grappe.
  const MIN_SPAWN_SPACING = 10
  const isAquatic = (id: string) => !!MONSTERS[id]?.aquatic
  const aquaticSpawns = nearSafe.filter((s) => isAquatic(s.monsterId)) // laissés tels quels (menace d'eau)
  const sorted = [...nearSafe].filter((s) => !isAquatic(s.monsterId)).sort((a, b) => a.x - b.x)
  const total: Record<string, number> = {}
  for (const s of sorted) total[s.monsterId] = (total[s.monsterId] ?? 0) + 1
  const aerialOf = (id: string) => (MONSTERS[id]?.aerial ? 1 : 0)
  const safeSpawns: LevelDef['spawns'] = []
  const kept: Record<string, number> = {}
  // ordre lexicographique de priorité (plus PETIT = préféré) : [déjà gardé, rareté, aérien, x]
  const rank = (s: LevelDef['spawns'][number]): [number, number, number, number] =>
    [kept[s.monsterId] ?? 0, total[s.monsterId]!, aerialOf(s.monsterId), s.x]
  const better = (a: [number, number, number, number], b: [number, number, number, number]) => {
    for (let t = 0; t < a.length; t++) { if (a[t]! !== b[t]!) return a[t]! < b[t]! }
    return false
  }
  let lastSpawnX = -Infinity
  let i = 0
  while (i < sorted.length) {
    if (sorted[i]!.x - lastSpawnX < MIN_SPAWN_SPACING) { i++; continue } // trop près du dernier gardé
    let j = i
    while (j < sorted.length && sorted[j]!.x - sorted[i]!.x < MIN_SPAWN_SPACING) j++ // fenêtre [x, x+MIN)
    let bestK = i
    for (let k = i + 1; k < j; k++) if (better(rank(sorted[k]!), rank(sorted[bestK]!))) bestK = k
    const pick = sorted[bestK]!
    safeSpawns.push(pick)
    kept[pick.monsterId] = (kept[pick.monsterId] ?? 0) + 1
    lastSpawnX = pick.x
    i = j
  }
  // FILET DE SÉCURITÉ (sans jamais créer de grappe) : si une espèce présente avant déclustering a été
  // entièrement évincée, on la réintroduit à sa 1ʳᵉ instance qui RESPECTE l'espacement. On ne force
  // jamais une instance trop proche (cela recréerait une grappe) : une espèce absente d'UN niveau mais
  // présente ailleurs est acceptable. La garantie qu'aucune espèce ne disparaît du JEU entier est
  // assurée globalement à l'assemblage des niveaux (cf. ensureRosterCoverage dans levels.ts).
  const present = new Set(safeSpawns.map((s) => s.monsterId))
  for (const id of new Set(sorted.map((s) => s.monsterId))) {
    if (present.has(id)) continue
    const inst = sorted.find((s) => s.monsterId === id
      && safeSpawns.every((k) => Math.abs(k.x - s.x) >= MIN_SPAWN_SPACING))
    if (inst) { safeSpawns.push(inst); present.add(id) }
  }
  safeSpawns.push(...aquaticSpawns) // menaces d'eau réintégrées intactes (bancs en cuve, hors déclustering)
  safeSpawns.sort((a, b) => a.x - b.x)

  return {
    id: opts.id, name: opts.name, biome: opts.biome,
    widthTiles: totalWidth, heightTiles,
    start, exit,
    platforms, bridges, gaps, hazards, ladders, rockBands, spawns: safeSpawns, props,
    ...(signs.length ? { signs } : {}),
  }
}

// ─── CATALOGUE : métadonnées de composition par kind (docs/level-module-kit.md §PHASE 2) ─────
// tier D1..D5 · family (dosage) · tags d'accroche entry/exit ∈ {bas,milieu,haut} · largeur VARIABLE
// (amplitude large ±40-60 %, tirée déterministiquement par l'assembleur) · fills · flags ladder /
// chest (coffre) / water (plan d'eau). Sert au helper composeLevel (dosage + courbe de difficulté).
export interface ModuleSpec {
  tier: Tier
  family: Family
  entry: EdgeTag
  exit: EdgeTag
  width: [number, number]
  below: Fill
  above: Fill
  ladder?: boolean
  chest?: boolean
  water?: boolean
  birds?: boolean // motif de plein air (accueille des oiseaux)
  // motif RÉSERVÉ : jamais tiré dans le pool générique aléatoire ; n'apparaît QUE s'il est imposé
  // explicitement via ComposeOpts.forcedKinds (per-terrain). Sert aux gros motifs signature qu'on veut
  // maîtriser (échelles-lianes, escaliers de lacs…) sans qu'ils polluent tous les niveaux.
  forcedOnly?: boolean
}

export const CATALOG: Record<ModuleKind, ModuleSpec> = {
  // historiques (12)
  plateau: { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [10, 18], below: 'sol', above: 'air' },
  colline: { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 28], below: 'sol', above: 'air', birds: true },
  escalier: { tier: 1, family: 'traverse', entry: 'bas', exit: 'haut', width: [12, 22], below: 'sol', above: 'air' },
  descente: { tier: 1, family: 'traverse', entry: 'haut', exit: 'bas', width: [12, 22], below: 'sol', above: 'air' },
  gue: { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air', birds: true },
  'corniche-vide': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'vide', above: 'air', birds: true },
  bassin: { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'marine', above: 'air', chest: true, water: true },
  cascade: { tier: 2, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 26], below: 'cascade', above: 'air', chest: true, water: true },
  grotte: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'roche', above: 'roche' },
  arene: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'sol', above: 'air' },
  crete: { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air', birds: true },
  volee: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'sol', above: 'air', birds: true },
  // fillers / respiration (D1)
  'ligne-droite': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [8, 16], below: 'sol', above: 'air' },
  marche: { tier: 1, family: 'filler', entry: 'bas', exit: 'haut', width: [8, 16], below: 'sol', above: 'air' },
  'descente-douce': { tier: 1, family: 'filler', entry: 'haut', exit: 'bas', width: [8, 16], below: 'sol', above: 'air' },
  'couloir-large': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [14, 30], below: 'sol', above: 'air' },
  'petit-pont': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [10, 18], below: 'marine', above: 'air', chest: true, water: true },
  'echelle-tranquille': { tier: 1, family: 'filler', entry: 'bas', exit: 'haut', width: [10, 16], below: 'sol', above: 'air', ladder: true },
  balcon: { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air', birds: true },
  'double-sol': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air', ladder: true },
  // traversée horizontale (D1–D3)
  'gap-grandissant': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air' },
  'ilots-reguliers': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'vide', above: 'air' },
  'ilots-irreguliers': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'vide', above: 'air' },
  'trou-filet': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', water: true },
  'pas-japonais': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', water: true },
  'triple-saut': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'vide', above: 'air' },
  // vertical / étages (D2–D4)
  zigzag: { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'sol', above: 'air' },
  'cage-echelles': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'sol', above: 'air', ladder: true },
  'echelle-vs-sauts': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'sol', above: 'air', ladder: true },
  'descente-controlee': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [14, 24], below: 'sol', above: 'air', birds: true },
  'tour-creuse': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 28], below: 'sol', above: 'air', ladder: true },
  // passerelles flottantes en zigzag ascendant (montée franchissable, vide dessous) — motif VERTICAL
  'passerelles-zigzag': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 22], below: 'vide', above: 'air' },
  // risque / récompense (D2–D4)
  'chemin-double': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'vide', above: 'air' },
  'detour-balcon': { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'sol', above: 'air', ladder: true, chest: true },
  'fausse-sortie': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'sol', above: 'air' },
  'tresor-bassin': { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', chest: true, water: true },
  // tension / précision (D3–D5)
  'echelle-exposee': { tier: 4, family: 'tension', entry: 'bas', exit: 'haut', width: [12, 20], below: 'sol', above: 'air', ladder: true },
  // PHASE 2b — motifs à PICS en hauteur (tier ≥ 3 → hors de la zone 1 : n'altèrent aucun niveau existant)
  'faux-plat': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air' },
  'couloir-pics': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'sol', above: 'roche' },
  'pics-quinconce': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'sol', above: 'air' },
  'atterrissage-etroit': { tier: 5, family: 'tension', entry: 'milieu', exit: 'milieu', width: [12, 18], below: 'sol', above: 'air' },
  // escalier de PIERRE rigide (blocs solides isolés)
  'escalier-pierre': { tier: 2, family: 'traverse', entry: 'bas', exit: 'haut', width: [16, 24], below: 'sol', above: 'air' },
  // eau / cascade (D2–D4)
  'sortie-humide': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 26], below: 'cascade', above: 'air', chest: true, water: true },
  // passage sous-marin (plonger par le haut, ressortir sur le côté)
  'passage-immerge': { tier: 3, family: 'risque', entry: 'milieu', exit: 'bas', width: [16, 26], below: 'marine', above: 'air', water: true },
  // lac en U (plonger, nager sous la roche, ressortir à la MÊME hauteur — entrée = sortie)
  'lac-en-u': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 30], below: 'marine', above: 'roche', water: true },
  // GROTTE-TUNNEL : boyau de roche varié (roche dessus ET dessous) — biomes rocheux/souterrains
  'grotte-tunnel': { tier: 2, family: 'tension', entry: 'milieu', exit: 'haut', width: [14, 24], below: 'roche', above: 'roche' },
  // GROTTE SOUS-MARINE EN U : lac en U noyé sous un toit de roche, coffre au fond (plongée récompensée)
  'grotte-noyee': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 30], below: 'marine', above: 'roche', chest: true, water: true },
  // REFONTE DES MOTIFS D'EAU (vrais passages)
  plongeoir: { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'marine', above: 'air', chest: true, water: true },
  puits: { tier: 2, family: 'risque', entry: 'bas', exit: 'bas', width: [14, 22], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-bassin': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [22, 30], below: 'marine', above: 'air', chest: true, water: true },
  'boyau-immerge': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'marine', above: 'air', water: true },
  // GROTTE DE DÉPART souterraine (module de SPAWN, biomes rocheux) — bassin immergé à franchir à la nage
  'grotte-depart': { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'roche', above: 'roche', water: true },
  // CHAÎNES VERTICALES VARIÉES
  'echelle-trou-echelle': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 26], below: 'vide', above: 'air', ladder: true },
  'echelle-zigzag': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 26], below: 'vide', above: 'air', ladder: true },
  'echelles-decalees': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 28], below: 'sol', above: 'air', ladder: true },
  // PASSERELLES FLOTTANTES sur SOL PLEIN (variante « full sol » du miroir)
  'passerelles-plein': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 22], below: 'sol', above: 'air' },
  // R168 — ÉCHELLE-DESCENTE PIÉGÉE (on descend, trou mortel, saut sur passerelle coiffée de roche)
  'echelle-descente-piegee': { tier: 3, family: 'vertical', entry: 'bas', exit: 'milieu', width: [18, 26], below: 'sol', above: 'roche', ladder: true },
  // R168 — VARIANTES DE CASCADES
  'cascade-grotte': { tier: 3, family: 'risque', entry: 'bas', exit: 'milieu', width: [22, 32], below: 'marine', above: 'roche', chest: true, water: true },
  'cascade-trou': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 24], below: 'cascade', above: 'air', water: true },
  'cascade-large': { tier: 2, family: 'risque', entry: 'bas', exit: 'milieu', width: [20, 30], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-trouee': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'vide', above: 'air', water: true },
  'cascade-cul-de-sac': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [20, 30], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-w': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'vide', above: 'air', chest: true, water: true },
  'cascade-saut-ange': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-large-pierre': { tier: 4, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 24], below: 'vide', above: 'air', chest: true, water: true },
  'echelles-lianes': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'sol', above: 'air', ladder: true, forcedOnly: true },
  'echelles-zigzag': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [12, 20], below: 'sol', above: 'air', ladder: true, forcedOnly: true },
  'lacs-cascade-montee': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [18, 30], below: 'marine', above: 'air', chest: true, water: true, forcedOnly: true },
  'lacs-cascade-descente': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [20, 30], below: 'marine', above: 'air', chest: true, water: true, forcedOnly: true },
  // R171 — LAC → CASCADE → PLATEAU (lac horizontal + cascade remontable vers un plateau haut)
  'lac-cascade-plateau': { tier: 2, family: 'risque', entry: 'bas', exit: 'haut', width: [22, 32], below: 'marine', above: 'air', chest: true, water: true },
  // R171 — ESCALIER À GRANDS PAS (marches espacées, saut franc) — motif VERTICAL/traversée sec
  'escalier-saut': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'sol', above: 'air' },
  // R171 — ÉCHELLES SUCCESSIVES (échelle puis échelle, court palier) — motif VERTICAL
  'echelles-successives': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'sol', above: 'air', ladder: true },
}

// Construit un Module à partir de son kind (fills + métadonnées du CATALOG) + peuplement/flags.
function mk(kind: ModuleKind, extra: Partial<Module> = {}): Module {
  const s = CATALOG[kind]
  return {
    kind, widthRange: s.width, fillBelow: s.below, fillAbove: s.above,
    tier: s.tier, entry: s.entry, exit: s.exit, tags: [s.family],
    ...extra,
  }
}

// ─── COMPOSITION : DOSAGE + COURBE DE DIFFICULTÉ ─────────────────────────────────────────────
// Assemble un niveau en respectant : (1) COURBE — tier PLAFONNÉ par la progression (tierCap) ;
// (2) DOSAGE — ~30 % fillers · ~40 % traversée+vertical · ~20 % risque · ~10 % tension ; (3) départ
// = filler simple à mi-hauteur SANS monstre (R127) ; (4) sortie à une altitude ≠ (ending bas/haut) ;
// (5) au moins UN plan d'eau + un coffre ; coffres plafonnés à 3. Déterministe (aucun Math.random).
export interface ComposeOpts {
  id: string
  name: string
  biome: string
  tierCap: Tier
  ending: 'bas' | 'haut' // sortie franchement plus BASSE ou plus HAUTE que le départ (mi-hauteur)
  ground: string[]       // pool de monstres terrestres (ordre = difficulté croissante)
  birds: string[]        // pool d'oiseaux du biome
  // PLAFOND DE DENSITÉ D'OISEAUX (aériens piqueurs). Les oiseaux (corbeau…) plongent sur le joueur ;
  // en NUÉE dès le début, ils rendent le jeu injouable (retour joueur). birdCap borne le nombre
  // d'oiseaux posés par motif : 0 = AUCUN oiseau (tout premier niveau, chill), 1 = un oiseau ISOLÉ,
  // etc. Absent → densité pleine (birdCountFor). Ne change pas le flux RNG (le 1er tirage est conservé).
  birdCap?: number
  // PLAFOND DE SÉLECTION DES MOTIFS (variété), DISTINCT de tierCap (difficulté/tension). Sert à
  // DÉBRIDER la variété des premiers niveaux : à tierCap=1 (plaine), les pools centraux s'effondraient
  // sur escalier + descente (seuls motifs tier 1 non-eau) → terrains PLATS et répétitifs. En relevant
  // composeCap (2-3) SANS toucher tierCap, on rend les motifs tier 2-3 (colline, gué, corniche, zigzag,
  // passerelles, escalier à grands pas, détours…) accessibles TÔT, tout en gardant la TENSION (pics)
  // gouvernée par tierCap → jamais de pics/précision punitifs en plaine. Absent → composeCap = tierCap.
  composeCap?: Tier
  // NIVEAU « EARLY » : réduit fortement la part de FILLER PLAT (~30 % → ~15 %) au profit de la
  // traversée/verticalité → les premiers terrains cessent d'être du remplissage plat et gagnent du
  // caractère dès le début (retour playtest). N'affecte QUE le dosage des familles, pas la longueur.
  earlyBoost?: boolean
  // PLANCHER DE GROS MOTIFS : nombre minimal de motifs « intéressants » (non plats) exigé dans le plan
  // d'un niveau — vérifié à la sélection de graine (cf. terrain) pour GARANTIR ≥ N gros motifs dès le
  // début. Absent → aucune garantie (comportement historique).
  featureFloor?: number
  // pool de monstres AQUATIQUES posés sur/au-dessus des cuves d'eau (bassin, passage immergé…). Seuls
  // des mobs aquatiques (méduse, crabe) y sont cohérents ; par défaut VIDE → l'eau reste sans monstre
  // plutôt que d'y placer un terrestre (règle de cohérence : jamais de mob terrestre au-dessus de l'eau).
  aquatic?: string[]
  mvp?: string           // MVP rare posé dans un module de risque tardif
  midCount?: number      // nb de modules centraux (défaut 5)
  allowLadders?: boolean // autoriser les motifs à échelle (niveau 1 : false pour rester simple)
  stony?: boolean // biome ROCHEUX : autorise les marches de PIERRE rigides (escalier-pierre)
  caves?: boolean // biome ROCHEUX / SOUTERRAIN / JUNGLE PROFONDE : autorise les grottes-tunnels
  waterKinds?: ModuleKind[] // plans d'eau imposés (variété entre niveaux)
  forcedKinds?: ModuleKind[] // motifs NON-eau imposés sur ce terrain (échelles-lianes, escaliers de lacs…)
  lava?: boolean // ENFER : les cuves marine (bassin/tresor-bassin/petit-pont) deviennent de la LAVE mortelle
  // GROTTE DE DÉPART souterraine : le module de SPAWN peut être une grotte fermée avec bassin immergé à
  // franchir à la nage (biomes ROCHEUX / souterrains seulement — ailleurs une caverne de départ serait incongrue).
  caveStart?: boolean
  // ZIGZAG D'OUVERTURE : force un motif zigzag gauche-droite JUSTE APRÈS le spawn (retour joueur :
  // « du zigzag dès le début du jeu »). Réservé aux tout premiers niveaux.
  openZigzag?: boolean
  // RELIEF VALLONNÉ : privilégie les collines et RELÈVE leurs sommets → silhouette plus HAUTE et plus
  // découpée (maps de hauteurs variées, retour joueur « plus hautes parfois »). Reste jouable (paliers ≤3).
  hilly?: boolean
  seed?: string
}

const FAMILY_BUCKET: Record<Family, 'filler' | 'traverse' | 'risque' | 'tension'> = {
  filler: 'filler', traverse: 'traverse', vertical: 'traverse', risque: 'risque', tension: 'tension',
}

// Motifs PLATS / de remplissage (rampes douces + fillers) : NE COMPTENT PAS comme « gros motif
// intéressant ». Tout le reste (eau-passage, verticalité franche, grottes, relief, précision) est un
// GROS MOTIF. Sert au plancher featureFloor (garantie de motifs intéressants dès les premiers niveaux).
export const FLAT_KINDS = new Set<ModuleKind>([
  'plateau', 'ligne-droite', 'couloir-large', 'marche', 'descente-douce', 'balcon', 'arene',
  'double-sol', 'echelle-tranquille', 'escalier', 'descente',
])
// Nombre de GROS MOTIFS (non plats) dans une liste de kinds — le module de spawn (plat) est ignoré.
export function countFeatureModules(kinds: ModuleKind[]): number {
  return kinds.filter((k) => !FLAT_KINDS.has(k)).length
}

export function composeLevel(o: ComposeOpts): LevelDef {
  return buildLevelFromModules(planModules(o), { id: o.id, name: o.name, biome: o.biome, seed: o.seed })
}

// Sélection DÉTERMINISTE de la liste de modules d'un niveau (sans expansion géométrique). Extrait de
// composeLevel pour être INTROSPECTABLE (rapport de diversité des motifs, cf. LEVEL_MODULE_KINDS) —
// composeLevel = planModules + buildLevelFromModules. Aucune logique de choix modifiée.
export function planModules(o: ComposeOpts): Module[] {
  const rng = mulberry32(hashSeed(o.seed ?? o.id))
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)] ?? arr[0]!
  // DENSITÉ D'OISEAUX : les beats de PLEIN AIR respirent trop avec 1 seul oiseau. On densifie selon le
  // motif — volée (grand ciel ouvert) 4-5, crêtes/corniches sur le vide 3, autres reliefs aérés 2.
  const birdCountFor = (k: ModuleKind): number => {
    const base = k === 'volee' ? 4 + (hashSeed(o.id + ':' + k) % 2) : (k === 'crete' || k === 'corniche-vide') ? 3 : 2
    // DÉCLUSTERING AÉRIEN : borne la densité par birdCap (0 = aucun oiseau, 1 = un seul isolé…).
    return o.birdCap !== undefined ? Math.max(0, Math.min(base, o.birdCap)) : base
  }
  // On CONSOMME exactement UN tirage rng (comme avant) pour le 1er oiseau → le flux RNG qui pilote le
  // CHOIX des modules reste identique (géométrie inchangée), MÊME si birdCap réduit le nombre d'oiseaux
  // rendus. Les oiseaux SUPPLÉMENTAIRES sont tirés d'une source à part (hashSeed).
  const flock = (k: ModuleKind): string[] => {
    const first = o.birds.length ? pick(o.birds) : undefined // tirage rng conservé (flux inchangé)
    const n = birdCountFor(k)
    if (n <= 0 || first === undefined) return []
    const extra = Array.from({ length: n - 1 },
      (_, i) => o.birds[hashSeed(o.id + ':bird:' + k + ':' + i) % o.birds.length] ?? first)
    return [first, ...extra]
  }
  // veut-on des oiseaux sur les plans d'eau imposés ? (cap 0 → non). Le tirage rng reste consommé.
  const wantBird = o.birdCap === undefined || o.birdCap > 0
  const cap = o.tierCap
  // PLAFOND DE SÉLECTION (variété) ≥ tierCap : débride les motifs tier 2-3 dès les premiers niveaux
  // sans toucher à la TENSION (pics), qui reste gouvernée par tierCap (cf. nTension / biais tension).
  const selCap = Math.max(cap, o.composeCap ?? cap) as Tier
  const allowLadders = o.allowLadders ?? true
  const mid = o.midCount ?? 5

  // pools de kinds par bucket, filtrés par tier + échelles autorisées (on exclut les plans d'eau
  // des pools génériques : ils sont IMPOSÉS séparément pour garantir eau + coffre et leur variété).
  const kindsOf = (bucket: 'filler' | 'traverse' | 'risque' | 'tension'): ModuleKind[] =>
    (Object.keys(CATALOG) as ModuleKind[]).filter((k) => {
      const s = CATALOG[k]
      if (FAMILY_BUCKET[s.family] !== bucket) return false
      if (s.tier > selCap) return false
      if (s.ladder && !allowLadders) return false
      if (s.water) return false // eau imposée séparément
      if (s.forcedOnly) return false // motifs réservés : imposés seulement via forcedKinds
      if (k === 'plateau' || k === 'arene') return false // réservés spawn / climax
      // marches de PIERRE rigides : uniquement en biome ROCHEUX (ailleurs incongru), jamais ailleurs.
      if (k === 'escalier-pierre') return !!o.stony
      // grottes-tunnels : uniquement en biome ROCHEUX / SOUTERRAIN / JUNGLE (cavités franches)
      if (k === 'grotte-tunnel') return !!o.caves
      return true
    })

  // séquence de familles pour les modules centraux (dosage 30/40/20/10, arrondi). En mode EARLY, on
  // COMPRIME le filler plat (~30 % → ~15 %) : les slots libérés vont à la TRAVERSÉE (colline, gué,
  // corniche, zigzag, passerelles, escalier à grands pas…), désormais débridée par selCap → premiers
  // terrains bien moins plats, sans changer leur longueur (mid) ni le nombre de monstres au sol.
  const fillerShare = o.earlyBoost ? 0.15 : 0.3
  const nFiller = Math.max(1, Math.round(mid * fillerShare))
  const nRisque = Math.max(1, Math.round(mid * 0.2))
  const nTension = cap >= 2 ? Math.round(mid * 0.1) : 0
  const nTraverse = Math.max(1, mid - nFiller - nRisque - nTension)
  const bag: ('filler' | 'traverse' | 'risque' | 'tension')[] = [
    ...Array(nFiller).fill('filler'), ...Array(nTraverse).fill('traverse'),
    ...Array(nRisque).fill('risque'), ...Array(nTension).fill('tension'),
  ]
  // rythme : on ordonne selon un patron plaisant (traversée → filler → risque → tension tardif)
  const rhythm = ['traverse', 'filler', 'risque', 'traverse', 'filler', 'tension', 'traverse', 'risque', 'filler', 'traverse']
  const order: typeof bag = []
  for (const fam of rhythm) { const i = bag.indexOf(fam as never); if (i >= 0) { order.push(bag[i]!); bag.splice(i, 1) } }
  order.push(...bag)

  const modules: Module[] = []
  // BUDGET DE COFFRES (plafonné à 3) : on PRÉ-RÉSERVE les coffres des plans d'eau IMPOSÉS (placés
  // inconditionnellement) pour que les modules centraux cessent d'en ajouter dès que le total atteint 3
  // → fini les niveaux (désormais plus longs) qui cumulaient > 3 coffres (eau imposée + détours à coffre).
  let chests = (o.waterKinds ?? ['bassin']).slice(0, 2).filter((w) => CATALOG[w].chest).length
  let lastKind: ModuleKind | null = null
  // PLAFOND DE RÉPÉTITION : un même motif central ne se pose pas plus de MAX_REPEAT fois par niveau
  // → fini les niveaux « le même motif encore et encore » (retour user sur la redondance).
  const usage: Partial<Record<ModuleKind, number>> = {}
  const MAX_REPEAT = 2
  // Choix STRUCTUREL déterministe (départ / descente / montée de fin) dans un pool, filtré par tier +
  // échelles autorisées, tiré sur le SEED du niveau → chaque niveau varie ses rôles fixes (départ,
  // fin) au lieu de reprendre toujours plateau + descente-controlee/arène ou marche + échelle.
  const structural = (pool: ModuleKind[], salt: string): ModuleKind => {
    const ok = pool.filter((k) => CATALOG[k].tier <= selCap && (!CATALOG[k].ladder || allowLadders))
    const list = ok.length ? ok : pool
    return list[hashSeed((o.seed ?? o.id) + ':' + salt) % list.length]!
  }

  // 1) DÉPART : filler PLAT à mi-hauteur (varié d'un niveau à l'autre), AUCUN monstre (R127). En biome
  // ROCHEUX avec caveStart, le départ peut être une GROTTE souterraine (bassin immergé à franchir à la nage).
  // caveStart FORCE la grotte de départ souterraine (bassin immergé à franchir à la nage) ; sinon
  // départ plat varié. On force (plutôt que tirer) pour GARANTIR l'apparition du motif là où il est voulu.
  const spawnKind: ModuleKind = o.caveStart ? 'grotte-depart' : structural(['plateau', 'ligne-droite', 'couloir-large'], 'spawn')
  // DÉPART VARIÉ (retour joueur : « les niveaux commencent TOUJOURS surélevés »). On tire l'altitude
  // de départ par la graine : parfois AU SOL (alt 0), parfois sur une corniche SURÉLEVÉE (3-4). La zone
  // de spawn reste DÉGAGÉE (module de spawn sec, sans monstre — spawnHere vide ground/birds — et marge
  // SAFE_SPAWN_TILES globale) → jamais SUR un monstre ni DANS l'eau. CONTRAINTE : la sortie doit rester
  // à ≥3 rangées du départ (validateur startExit). Une sortie 'bas' (au sol) impose donc un départ
  // SURÉLEVÉ ; une grotte de départ (plancher haut) idem. Une sortie 'haut' (montée finale) autorise le
  // départ au SOL (l'écart est garanti par la montée). On lie donc le départ au sol aux fins 'haut'.
  const startElevated = 3 + (hashSeed((o.seed ?? o.id) + ':startalt') % 2) // 3 ou 4 (surélevé)
  const groundAllowed = o.ending === 'haut' && !o.caveStart
  const startAlt = groundAllowed
    ? (hashSeed((o.seed ?? o.id) + ':startmode') % 3 === 0 ? 0 : hashSeed((o.seed ?? o.id) + ':startmode') % 3 === 1 ? 1 : startElevated)
    : startElevated
  modules.push(mk(spawnKind, { spawnHere: true, startAlt, tags: ['respiration'] }))
  // ZIGZAG D'OUVERTURE (tout premiers niveaux) : dents de scie gauche-droite dès la sortie du spawn.
  if (o.openZigzag) modules.push(mk('zigzag', { ground: [], tags: ['ouverture'] }))

  // 2) plan(s) d'eau imposé(s) : au moins un (eau + coffre), variété pilotée par waterKinds
  const waters = (o.waterKinds ?? ['bassin']).slice(0, 2)
  const waterSlots = new Set<number>()
  waters.forEach((_, i) => waterSlots.add(1 + Math.floor(((i + 1) * order.length) / (waters.length + 1))))

  // 2 bis) motifs NON-eau IMPOSÉS (forcedKinds) : posés sur des slots centraux libres (jamais un slot
  // d'eau), pour garantir la présence des gros motifs signature (échelles-lianes, escaliers de lacs).
  const forcedSlots = new Map<number, ModuleKind>()
  {
    let n = 1
    for (const fk of (o.forcedKinds ?? []).slice(0, 2)) {
      while (n < order.length && (waterSlots.has(n + 1) || forcedSlots.has(n))) n++
      if (n < order.length) { forcedSlots.set(n, fk); n++ }
    }
  }

  // 3) modules centraux
  const groundQ = [...o.ground]
  const nextGround = (): string[] => (groundQ.length ? [groundQ.shift()!] : (o.ground.length ? [o.ground[0]!] : []))
  order.forEach((bucket, idx) => {
    if (waterSlots.has(idx + 1) && waters.length) {
      const wk = waters.shift()!
      const spec = CATALOG[wk]
      // coffre déjà pré-réservé dans le budget (chests) → on ne ré-incrémente pas ici
      modules.push(mk(wk, {
        ground: o.aquatic ?? [], birds: spec.birds && o.birds.length ? (wantBird ? [pick(o.birds)] : (pick(o.birds), undefined)) : undefined,
        ...(o.lava && spec.below === 'marine' ? { fillBelow: 'lave' as Fill } : {}),
      }))
      lastKind = wk
      return
    }
    if (forcedSlots.has(idx)) {
      const fk = forcedSlots.get(idx)!
      const fspec = CATALOG[fk]
      modules.push(mk(fk, {
        ground: fspec.water ? (o.aquatic ?? []) : nextGround(),
        ...(o.lava && fspec.below === 'marine' ? { fillBelow: 'lave' as Fill } : {}),
      }))
      lastKind = fk
      return
    }
    let cands = kindsOf(bucket)
    if (cands.length === 0) cands = kindsOf('traverse')
    if (cands.length === 0) cands = ['colline']
    // en biome à HAUT tier, la TENSION privilégie les motifs vraiment corsés (tier ≥ 3) → on sort
    // enfin les motifs de précision jadis inutilisés (échelle exposée, pics en quinconce, atterrissage
    // étroit) au lieu de retomber sur grotte/volée de bas tier.
    if (bucket === 'tension' && cap >= 4) {
      const hi = cands.filter((k) => CATALOG[k].tier >= 3)
      if (hi.length) cands = hi
    }
    // évite la répétition immédiate, PLAFONNE la répétition d'un motif dans le niveau, respecte le
    // plafond de coffres. Repli progressif (motifs frais → non-répétés immédiats → tous) pour ne
    // jamais bloquer la sélection.
    const notLast = cands.filter((k) => k !== lastKind)
    const fresh = notLast.filter((k) => (usage[k] ?? 0) < MAX_REPEAT)
    let kind = pick(fresh.length ? fresh : notLast.length ? notLast : cands)
    if (CATALOG[kind].chest && chests >= 3) {
      // budget de coffres atteint : on cherche un motif SANS coffre — d'abord dans le pool du bucket,
      // sinon en REPLI CROISÉ sur traversée/filler (à bas tier, le bucket 'risque' n'a que detour-balcon,
      // à coffre → sans repli on dépassait 3 coffres sur les niveaux longs). Cap DUR à 3 coffres.
      let noChest = cands.filter((k) => !CATALOG[k].chest)
      if (!noChest.length) noChest = kindsOf('traverse').filter((k) => !CATALOG[k].chest && k !== lastKind)
      if (!noChest.length) noChest = kindsOf('filler').filter((k) => !CATALOG[k].chest)
      if (noChest.length) kind = pick(noChest)
    }
    if (CATALOG[kind].chest) chests++
    usage[kind] = (usage[kind] ?? 0) + 1
    const spec = CATALOG[kind]
    const mvpHere = o.mvp && bucket === 'risque' && idx >= order.length - 2 && !modules.some((m) => m.ground?.includes(o.mvp!))
    modules.push(mk(kind, {
      ground: [...(mvpHere ? [o.mvp!] : []), ...nextGround()],
      birds: spec.birds && o.birds.length ? flock(kind) : undefined,
      ...(o.hilly && kind === 'colline' ? { tall: true } : {}),
    }))
    lastKind = kind
  })

  // 4) plan(s) d'eau non encore placé(s) (sécurité : garantit l'eau + un coffre) — coffre pré-réservé
  for (const wk of waters) {
    const spec = CATALOG[wk]
    modules.push(mk(wk, {
      ground: o.aquatic ?? [], birds: spec.birds ? [pick(o.birds)] : undefined,
      ...(o.lava && spec.below === 'marine' ? { fillBelow: 'lave' as Fill } : {}),
    }))
  }

  // 5) SORTIE à altitude ≠ du départ (mi-hauteur = BASE_ALT 5) :
  //    ending 'bas'  → grande descente jusqu'au sol, arène-climax + PORTE en contrebas ;
  //    ending 'haut' → petite marche puis échelle/escalier, PORTE tout en haut.
  if (o.ending === 'bas') {
    // grande descente jusqu'au sol (motif varié) + arène-climax en contrebas
    const descKind = structural(['descente-controlee', 'descente'], 'descend')
    modules.push(mk(descKind, { rise: -40, ground: nextGround(), tags: ['relief', 'combat'] }))
    modules.push(mk('arene', { exitHere: true, ground: [...(o.mvp && !modules.some((m) => m.ground?.includes(o.mvp!)) ? [o.mvp] : []), ...nextGround()], tags: ['combat'] }))
  } else {
    // petite marche variée puis MONTÉE variée (échelle, cage, tour, zigzag, passerelles flottantes…)
    const stepKind = structural(['marche', 'escalier', 'ligne-droite'], 'step')
    // FILET DE SÉCURITÉ MVP (fins 'haut') : si le MVP n'a pas été posé dans un module de risque, on le
    // pose sur la marche de fin (surface plate → mob terrestre bien posé). Garantit que chaque niveau à
    // MVP le fait bien apparaître, quel que soit l'ending (les niveaux plus longs déplaçaient parfois
    // tous les buckets de risque hors des 2 derniers slots → MVP jamais posé).
    const mvpTail = o.mvp && !modules.some((m) => m.ground?.includes(o.mvp!)) ? [o.mvp] : []
    modules.push(mk(stepKind, { ground: [...mvpTail, ...nextGround()] }))
    const climbPool: ModuleKind[] = allowLadders
      ? ['echelle-tranquille', 'cage-echelles', 'echelle-vs-sauts', 'tour-creuse', 'zigzag', 'passerelles-zigzag', 'passerelles-plein', 'echelle-trou-echelle', 'echelle-zigzag', 'echelles-decalees', 'echelle-descente-piegee', 'escalier-saut', 'echelles-successives']
      : ['escalier', 'zigzag', 'passerelles-zigzag', 'passerelles-plein', 'escalier-saut']
    const climbKind = structural(climbPool, 'climb')
    modules.push(mk(climbKind, { exitHere: true, ...(climbKind === 'escalier' ? { rise: 6 } : {}), ground: nextGround(), tags: ['montée'] }))
  }

  return modules
}
