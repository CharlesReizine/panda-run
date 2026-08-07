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

import { canReach, canReachByBounce, ECART_MUR_TRAMPOLINE } from '../core/platforming'
import { chainesContournables, CLAIR_TRAMPOLINE, deadEndSurfaces, marchesInfranchissables, maxSwimTiles, overStackedColumns, sealedVoids, unreachablePlatforms } from '../core/level-validator'
import { breathMaxMs } from '../core/breath'
import type { LevelDef } from './levels'
import { MIN_LADDER_TILES, MAX_LADDER_TILES, maxJumpTiles, maxJumpGapPx, TILE } from '../core/platforming'
import { comblements } from '../core/roche'
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
  // PIERRE FRAGILE (matière cassable) : entrées murées à percer, plancher qui cède
  | 'grotte-scellee' | 'sol-fragile' | 'grotte-u-brisable'
  // motifs INVERSÉS (miroir gauche-droite d'un motif montant) : ils font REDESCENDRE le terrain
  | 'echelle-tranquille-inverse' | 'echelle-zigzag-inverse' | 'echelles-decalees-inverse'
  | 'escalier-saut-inverse' | 'trampoline-corniche-inverse'
  | 'cage-echelles-inverse' | 'echelle-vs-sauts-inverse' | 'echelle-exposee-inverse'
  | 'escalier-pierre-inverse' | 'echelle-trou-echelle-inverse' | 'echelles-successives-inverse'
  | 'tour-creuse-inverse' | 'passerelles-plein-inverse' | 'echelles-lianes-inverse'
  | 'echelles-zigzag-inverse'
  // GROTTE SOUS-MARINE EN U : lac en U NOYÉ SOUS UN TOIT DE ROCHE (grotte inondée) — on plonge, on
  // traverse le fond immergé sous un plafond de roche, on remonte de l'autre côté ; coffre au fond
  | 'grotte-noyee'
  // ─── REFONTE DES MOTIFS D'EAU (retour joueur : « l'eau doit être un vrai PASSAGE ») ───────────
  // PLONGEOIR : corniche HAUTE qui SURPLOMBE (plongeoir) un bassin en CONTREBAS — on saute dedans
  // depuis la corniche, on nage, on ressort sur le rebord ; coffre au fond.
  | 'plongeoir'
  // ─── TRAMPOLINES (élément demandé par le user) ────────────────────────────────────────────────
  // « ça fait genre faire un saut 3 fois plus haut et ça permet aussi d'aller plus sur le côté »
  | 'trampoline-plat'        // 1) sur du plat : il ne sert à rien, on découvre l'objet sans risque
  | 'trampoline-corniche'    // 2) permet d'atteindre une corniche haute
  // les seuls où le rebond est OBLIGATOIRE : aucune surface entre le départ et l'arrivée
  | 'trampoline-mur' | 'trampoline-mur-trou'
  | 'trampoline-saut-vide' | 'trampoline-saut-eau' | 'trampoline-saut-flammes' | 'trampoline-fosse-ardente'        // 3) plateforme haute, et EN DESSOUS c'est le vide     // 4) atteint une échelle en T suspendue, vide en dessous     // 5) dépasse un vide et atteint une cascade
  // ─── MOTIFS EAU / GROTTE DEMANDÉS (variété) ───────────────────────────────────────────────────
  // « Je trouve que c'est un peu répétitif là. »
  | 'cascade-plus-haute'     // 1) cascade qui DÉPASSE l'entrée de la grotte
  | 'cascade-deux-passages'  // 2) cascade + 2 passages à DROITE : tunnel en haut, cavité à trésor en bas
  | 'cascade-deux-passages-g'// 3) idem en miroir (passages à GAUCHE)
  | 'boyau-tresor-retour'    // 4) passage sous-marin vers une grotte à trésor : il faut REVENIR pour avancer
  | 'colonnes-perilleuses'   // 5) longues colonnes de pierre étroites et de hauteurs variées (chute = mort)
  // AQUEDUC / VIADUC : on MARCHE DESSUS. « Au lieu d'avoir un terrain tout plat, parfois on a un aqueduc
  // ou un pont, et c'est joli. » Le tablier est une vraie surface ; sous les arches, de l'eau ou le vide.
  | 'aqueduc'
  // BASSIN CREUSÉ : lit en escalier de pierre, très peu profond aux berges, franchement profond au
  // centre — on marche, puis on nage. Silhouette de cuve taillée, plus le rectangle d'avant.
  | 'bassin-creuse'
  // ⚠️ 'grand-rideau' A ÉTÉ RETIRÉ. Une cascade qui barre toute la largeur du motif était une bonne
  // idée de terrain (« je préférerais que ce soit tout cascade sur toute la largeur ») mais elle ne
  // CHAÎNE pas : sa sortie est douze rangées au-dessus de son entrée, et le seul lien entre les deux est
  // la colonne d'eau — que les validateurs d'atteignabilité ne savent pas escalader. Ajouter une échelle
  // d'accès n'a pas suffi ; posé de force, il rendait injoignable tout ce qui suivait, et laissé à
  // l'ordonnanceur il n'était jamais retenu. Plutôt que de le garder en dette (« c'est quoi les tous
  // inventoriés, c'est hors de question »), on le retire : il reviendra quand son raccordement sera
  // repris — probablement en sortant à la MÊME altitude qu'il entre, le rideau devenant un obstacle à
  // traverser plutôt qu'une montée.
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

// ─── ALTITUDE MINIMALE D'UN PLANCHER DE MOTIF ───────────────────────────────────────────────
// Retour du joueur, après trois captures du même défaut : « y a deux sols qui sont juste empilés, donc
// si je marche sur le premier sans sauter je passe à travers le deuxième », puis « bah impose une
// hauteur minimale ». Un plancher à l'altitude 0 se dessine DANS la rangée du sol du monde ; à
// l'altitude 1, il s'y colle — deux bandes d'herbe sans un pouce d'air entre elles.
//
// ⚠️ ÇA SE POSE DANS LE MOTIF, PAS AU CHAÎNAGE. Borner `runningAlt` entre deux modules a été essayé et
// c'est un piège : le module suivant démarrerait au-dessus de la surface que le précédent a réellement
// laissée, donc sa rampe d'accroche partirait d'une altitude qui n'existe pas (`passage-immerge`
// injoignable à toutes ses largeurs, plus soixante-dix tests de terrain). Un motif a le droit de
// CHAÎNER au ras du sol ; il n'a pas le droit d'y DESSINER son plancher.
const ALT_PLANCHER = 2

const SIMPLE_JUMP_ROWS = 3 // marche maximale garantie au saut simple (rise ≈ 96px < 130px)

// Hauteur MINIMALE d'une cascade remontable, en rangées. Retour joueur (R268) : « les cascades sont
// trop courtes, plus hautes ». On passe de 8 (≈ 4× le panda) à 12 (≈ 6× le panda) : des chutes
// nettement plus imposantes, jamais franchissables au saut (maxJumpTiles ≈ 4). La grille du niveau
// s'agrandit dynamiquement en hauteur ; l'atteignabilité reste garantie (cascade remontable) et
// verrouillée par test (shortCascades + reachable-strict). NB : plus haut (≈16) casse la silhouette
// « pas de tour » (≤ 3 paliers empilés) sur desert-3/plage-1 → 12 est le max sûr sans playtest.
export const MIN_CASCADE_TILES = 12 // 6 × ~2 tuiles (PANDA_BODY.h 62px / TILE 32px)
// dénivelée déterministe d'une cascade : au moins MIN_CASCADE_TILES, +0..2 rangées de variété.
const cascadeRise = (rng: () => number) => MIN_CASCADE_TILES + Math.floor(rng() * 3)

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
  // PIERRE FRAGILE : même rectangle que `rocks` (altitudes inclusives) mais CASSABLE à coups d'attaque
  // ou de saut. Sert à sceller une entrée de grotte et à poser un plancher qui cède. Cf. levels.ts.
  breakables: { x: number; altBot: number; altTop: number; w: number; coups?: number }[]
  gaps: { x: number; w: number }[]
  /** Le module repose sur le VIDE : l'assembleur ouvre le sol du monde sur toute sa portée. */
  fondVide?: boolean
  // pics : alt = altitude de la SURFACE qui porte les pics (corniche en hauteur). Absent → pics au sol.
  spikes: { x: number; w: number; alt?: number }[]
  bridges: { x: number; alt: number; w: number }[]
  // TRAMPOLINES : tapis posé à l'altitude `alt`. Rebond ×3 en hauteur + contrôle latéral accru.
  trampolines: { x: number; alt: number; fixe?: boolean }[]
  // AQUEDUCS : tablier MARCHABLE (une plateforme solide posée en même temps) + arches dessinées dessous.
  arches: { x: number; alt: number; w: number; h: number; fill: 'eau' | 'vide' }[]
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
  return { platforms: [], rocks: [], breakables: [], gaps: [], spikes: [], bridges: [], trampolines: [], arches: [], waters: [], ladders: [], spawns: [], props: [], signs: [], exitAlt }
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
  // ⚠️ UN SOCLE NE SE COULE JAMAIS AUTOUR D'UNE ÉCHELLE, ET LA NUANCE EST QU'ON RENONCE À TOUTE LA
  // BANDE, PAS SEULEMENT À SA COLONNE. Retour joueur, capture à l'appui : « un chevauchement pierre /
  // échelle qui rend le terrain infaisable » — la corniche de sortie du zigzag court au-dessus des
  // échelles, et son socle les enterrait sur neuf rangées. Épargner la seule colonne de l'échelle ne
  // règle rien : il resterait une fente d'une tuile murée des deux côtés et coiffée par la corniche,
  // c'est-à-dire une poche close (cf. sealedVoids) avec l'échelle dedans. Une corniche qui surplombe
  // une montée est un SURPLOMB : elle n'a pas de corps, et c'est très bien ainsi.
  const echelleDans = (x0: number, x1: number, alt: number) =>
    p.ladders.some((l) => l.x >= x0 && l.x < x1 && l.topAlt - l.h < alt)
  const flush = (endX: number) => {
    // altBot 0 : le socle descend jusque DANS la bande de sol du monde (pas de liseré de fond
    // visible entre le bas de la falaise et le sol). Rendu derrière le sol (depth), sans collision.
    if (runX >= 0 && runAlt >= 2 && !echelleDans(runX, endX, runAlt)) p.rocks.push({ x: runX, altBot: 0, altTop: runAlt - 1, w: endX - runX })
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
// Marche maximale qu'une RAMPE a le droit de produire. On tolère la hauteur de SAUT (4 rangées) et
// non `SIMPLE_JUMP_ROWS` (3) : une rampe descendante ne se saute pas, on TOMBE dessus, et une marche
// de la hauteur d'un saut reste franchissable dans les deux sens. Au-delà, c'est une falaise — c'est
// ce que le joueur appelait « les marches géantes ».
const MARCHE_MAX = Math.floor(maxJumpTiles())
export const PORTEES: Record<string, { kind: string; x0: number; w: number }[]> = {}
export const MARCHES_RAMPE: { de: number; a: number; w: number; kind: string }[] = []
let motifCourant = '?'
function ramp(x0: number, w: number, fromAlt: number, toAlt: number, keepGround = false): { x: number; alt: number; w: number }[] {
  const diff = toAlt - fromAlt
  const countVoulu = Math.max(1, Math.ceil(Math.abs(diff) / SIMPLE_JUMP_ROWS))
  // EN DESCENTE, le nombre de paliers est BORNÉ PAR LA PLACE. Un palier plus raide y est gratuit : on
  // tombe. Alors qu'avancer de 3 par palier quand la portée ne le permet pas faisait sortir la rampe de
  // [x0, x0+w) — jusqu'à 30 tuiles — et empiéter sur le module suivant.
  // ⚠️ EN MONTÉE, NE PAS BORNER : raidir une montée la rend infranchissable (mesuré : plaine-7 n'a plus
  // aucune graine valide en 30 passes, 56 plateformes injoignables).
  // ⚠️ EN DESCENTE ON BORNE PAR w/2, PAS w/3 — ET C'EST UN CORRECTIF DE CORRECTIF. Borner par w/3 laissait
  // trop peu de paliers : les marches devenaient des à-pics (mesuré 10 rangées d'un coup entre deux
  // corniches collées sur jungle-1, retour joueur « en bas ça vole un peu »). Or un palier de DESCENTE se
  // reçoit à 2 tuiles — on TOMBE dessus, on ne le vise pas au saut. Deux tuiles par palier, c'est deux
  // fois plus de paliers dans la même portée, donc des marches deux fois plus douces.
  // ⚠️ EN DESCENTE, LE PLANCHER DESCEND JUSQU'À 1 TUILE S'IL LE FAUT — sinon les marches deviennent des
  // à-pics. Mesuré : 91 endroits où deux paliers COLLÉS se décalaient de 6 à 16 rangées, parce qu'un décor
  // demandait de descendre 30 rangées en 10 tuiles et que des paliers de 2 n'en laissaient que cinq. Un
  // palier de descente ne se VISE pas au saut, on TOMBE dessus : une tuile suffit à le recevoir, et cinq
  // petites marches valent mieux qu'une falaise. On prend donc le plancher le plus large qui garde le pas
  // sous la hauteur de saut, et on ne descend à 1 que si 2 ne suffit pas.
  const PLANCHER = diff < 0 && Math.floor(w / 2) < countVoulu ? 1 : 2
  const count = diff < 0 ? Math.max(1, Math.min(countVoulu, Math.floor(w / PLANCHER))) : countVoulu
  const step = diff / count
  // Plancher de largeur : 3 tuiles pour se recevoir confortablement, mais quand la portée est serrée on
  // préfère des paliers de 2 à un débordement — resserrer reste franchissable, déborder ne l'est jamais.
  const segW = Math.max(count * 3 > w ? PLANCHER : 3, Math.floor(w / count))
  const out: { x: number; alt: number; w: number }[] = []
  let x = x0
  for (let i = 0; i < count; i++) {
    const alt = Math.round(fromAlt + step * (i + 1))
    const reste = x0 + w - x
    const segw = i === count - 1 ? reste : Math.min(segW, reste)
    if (segw <= 0) break
    // ⚠️ PAS DE PALIER À L'ALTITUDE 1 : LE SOL DU MONDE EST DÉJÀ CETTE SURFACE. Une rampe qui redescend
    // finissait par un palier collé sur la rangée du sol — deux bandes d'herbe l'une sur l'autre, le
    // défaut que le joueur a signalé trois fois (« y a deux sols qui sont juste empilés »). Le
    // supprimer ne retire aucun appui : on pose le pied une rangée plus bas, sur le sol, qui est là.
    // `keepGround` reste l'exception explicite — c'est le drapeau des rampes qui DOIVENT border un trou.
    const altFinale = Math.max(keepGround ? 0 : 1, alt)
    const colleAuSol = !keepGround && altFinale <= 1
    if ((alt >= 1 || keepGround) && !colleAuSol) out.push({ x, alt: altFinale, w: segw })
    x += segw
  }
  for (let i = 1; i < out.length; i++) {
    // ⚠️ ON NE COMPTE QUE LES MONTÉES. Une marche de sept rangées qui DESCEND se franchit en tombant :
    // c'est même ce que le motif demande. `Math.abs` mettait les deux sens dans le même sac, et faisait
    // passer pour un défaut les rampes de descente des motifs qui plafonnent leur altitude — cinq d'un
    // coup sur `echelle-descente-piegee` après regravure, alors qu'aucune ne bloque quoi que ce soit.
    // Le risque « on tombe et on ne remonte plus » n'est pas ignoré pour autant : il a son propre
    // validateur, `deadEndSurfaces`, et il est à zéro.
    const d = out[i]!.alt - out[i - 1]!.alt
    if (d > MARCHE_MAX) MARCHES_RAMPE.push({ de: out[i - 1]!.alt, a: out[i]!.alt, w, kind: motifCourant })
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
  let footAlt = Math.max(ALT_PLANCHER, entryAlt)
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MOTIFS INVERSÉS : on construit un motif MONTANT, puis on le retourne de gauche à droite
//
// Retour joueur, et il avait raison au chiffre près : « j'ai l'impression qu'on a des tonnes de patterns
// qui montent et peu qui descendent, donc les terrains finissent toujours un peu pareil ». Mesuré sur le
// catalogue : **25 motifs montent** (jusqu'à +40 rangées) contre **4 qui descendent** — et les motifs
// nommés `descente` mesurent un delta NUL, ils descendent puis remontent. Un terrain ne pouvait donc que
// grimper, et tous finissaient en tour.
//
// Puis : « crée des motifs descendants en construisant à l'envers certains patterns montants ».
//
// ⚠️ MIROIR HORIZONTAL, PAS VERTICAL. Retourner les altitudes semble plus direct et casse tout : un
// sommet d'échelle deviendrait un pied, un plafond de grotte un plancher, une surface d'eau un fond. En
// miroir GAUCHE-DROITE, ce qui grimpait de gauche à droite descend, et TOUTES les relations verticales
// restent physiquement justes. C'est littéralement « construire à l'envers ».
//
// Le motif inversé finit au ras du sol (altitude 1) : c'est ce qui RAMÈNE le terrain en bas. Une rampe
// d'accroche à gauche relie l'altitude courante au sommet du motif retourné — descendante quand on arrive
// de haut (le cas normal, puisque le terrain grimpe), montante sinon.
const LARGEUR_ACCROCHE = 6 // bande réservée à la rampe d'accroche du motif inversé

/**
 * Correspondance motif inversé → motif d'origine. Quinze familles : échelles, escaliers, tours,
 * passerelles et trampoline —
 * de quoi redescendre autrement à chaque fois.
 *
 * ⚠️ LES CASCADES NE SE RETOURNENT PAS PAR CE CHEMIN. `cascade-grotte` et `cascade-plus-haute` inversés
 * n'ont JAMAIS été tirés : les motifs à plan d'eau passent par un canal dédié du planificateur, épinglé
 * sur des listes de kinds où ces nouveaux noms n'existent pas. Pire, leur présence faisait tourner la
 * recherche de graines à vide — quinze minutes au lieu d'une et demie, et des terrains fautifs à
 * l'arrivée. Les retourner demande de toucher au canal « plan d'eau », pas d'ajouter une entrée.
 *
 * ⚠️ `passerelles-zigzag` A ÉTÉ ÉCARTÉ, ET C'EST LA BATTERIE QUI L'A DIT. Son original court au-dessus du
 * VIDE : retourné, il devient un cul-de-sac dont on ne remonte pas — un « piège sans retour », le défaut
 * que ce projet tient pour le pire. Tous les motifs ne se retournent donc pas ; ceux dont le sol est un
 * vide mortel demandent d'être repensés, pas mirroirés.
 */
const INVERSES: Partial<Record<ModuleKind, ModuleKind>> = {
  'echelle-tranquille-inverse': 'echelle-tranquille',
  'echelle-zigzag-inverse': 'echelle-zigzag',
  'echelles-decalees-inverse': 'echelles-decalees',
  'escalier-saut-inverse': 'escalier-saut',
  'trampoline-corniche-inverse': 'trampoline-corniche',
  'cage-echelles-inverse': 'cage-echelles',
  'echelle-vs-sauts-inverse': 'echelle-vs-sauts',
  'echelle-exposee-inverse': 'echelle-exposee',
  'escalier-pierre-inverse': 'escalier-pierre',
  'echelle-trou-echelle-inverse': 'echelle-trou-echelle',
  'echelles-successives-inverse': 'echelles-successives',
  'tour-creuse-inverse': 'tour-creuse',
  'passerelles-plein-inverse': 'passerelles-plein',
  'echelles-lianes-inverse': 'echelles-lianes',
  'echelles-zigzag-inverse': 'echelles-zigzag',
}

/** Retourne une pièce de gauche à droite dans une portée de largeur `w`. */
function miroirHorizontal(p: Piece, w: number): Piece {
  const bande = <T extends { x: number; w: number }>(o: T): T => ({ ...o, x: w - (o.x + o.w) })
  const point = <T extends { x: number }>(o: T): T => ({ ...o, x: w - 1 - o.x })
  const cote = (c?: 'left' | 'right' | 'both') => (c === 'left' ? 'right' : c === 'right' ? 'left' : c)
  return {
    platforms: p.platforms.map(bande),
    rocks: p.rocks.map(bande),
    breakables: p.breakables.map(bande),
    gaps: p.gaps.map(bande),
    spikes: p.spikes.map(bande),
    bridges: p.bridges.map(bande),
    arches: p.arches.map(bande),
    waters: p.waters.map((o) => ({ ...bande(o), openSide: cote(o.openSide) })),
    trampolines: p.trampolines.map(point),
    ladders: p.ladders.map(point),
    spawns: p.spawns.map(point),
    props: p.props.map(point),
    signs: p.signs.map(point),
    exitAlt: p.exitAlt,
  }
}

/** Décale toute une pièce vers la droite (on réserve la bande d'accroche à gauche). */
function decalerX(p: Piece, d: number): void {
  for (const t of [p.platforms, p.rocks, p.breakables, p.gaps, p.spikes, p.bridges, p.arches, p.waters,
    p.trampolines, p.ladders, p.spawns, p.props, p.signs] as { x: number }[][]) {
    for (const o of t) o.x += d
  }
}

/**
 * Décale toute une pièce EN ALTITUDE de `d` rangées.
 *
 * ⚠️ UN SOCLE QUI TOUCHAIT LE SOL CONTINUE DE LE TOUCHER. Les dalles de roche posées sous une surface
 * partent de l'altitude 1 : décalées telles quelles vers le haut, elles laisseraient de l'AIR SOUS LA
 * PIERRE — le défaut exact que le joueur avait signalé (« de l'air sous les pierres du bas »). On note
 * donc celles qui touchaient le sol avant le décalage, et on les y ramène après.
 */
function decalerAlt(p: Piece, d: number): void {
  if (!d) return
  const auSol = new Set(p.rocks.filter((r) => r.altBot <= 1).map((r) => r))
  for (const o of p.platforms) o.alt += d
  for (const o of p.bridges) o.alt += d
  for (const o of p.trampolines) o.alt += d
  for (const o of p.arches) o.alt += d
  for (const o of p.signs) o.alt += d
  for (const o of p.rocks) { o.altBot += d; o.altTop += d; if (auSol.has(o)) o.altBot = 1 }
  for (const o of p.breakables) { o.altBot += d; o.altTop += d }
  for (const o of p.spikes) if (o.alt !== undefined) o.alt += d
  for (const o of p.waters) { o.bankAlt += d; if (o.bottomAlt !== undefined) o.bottomAlt += d }
  for (const o of p.ladders) o.topAlt += d
  for (const o of p.spawns) if (o.alt !== undefined) o.alt += d
  for (const o of p.props) if (o.alt !== undefined) o.alt += d
  p.exitAlt += d
}

/** Verse le contenu de `src` dans `dst` (les deux sont déjà dans le même repère). */
function fusionner(dst: Piece, src: Piece): void {
  dst.platforms.push(...src.platforms); dst.rocks.push(...src.rocks); dst.breakables.push(...src.breakables)
  dst.gaps.push(...src.gaps); dst.spikes.push(...src.spikes); dst.bridges.push(...src.bridges)
  dst.arches.push(...src.arches); dst.waters.push(...src.waters); dst.trampolines.push(...src.trampolines)
  dst.ladders.push(...src.ladders); dst.spawns.push(...src.spawns); dst.props.push(...src.props)
  dst.signs.push(...src.signs)
}

/**
 * LE LONG U : longueur d'un plafond immergé, et taille des poches d'air entre deux.
 *
 * Demande du joueur : « les passages dans des grottes sous-marines, je suis chaud d'avoir des passages
 * longs en apnée, et c'est vraiment un looong U. Là je vois des W mais très peu de looong U. »
 *
 * ⚠️ LE « W » ÉTAIT ÉCRIT EN DUR, ET IL SORTAIT D'UNE PRUDENCE MAL PLACÉE. Les plafonds immergés
 * étaient hachés en segments de SEPT colonnes séparés par deux tuiles d'air : on refaisait donc surface
 * tous les sept pas, et la silhouette dessinait exactement le W qu'il décrit. Sept était une valeur de
 * sécurité choisie à la main, sans rapport avec le souffle réel — et comme personne ne mesurait la
 * longueur, il n'y avait aucune raison de la relever.
 *
 * Maintenant que `tunnelsTropLongs` la mesure, la borne peut être la VRAIE : ce qu'un panda de niveau 1
 * traverse d'un souffle, à cette profondeur, avec la marge d'apnée habituelle. Environ le double, et
 * surtout d'un seul tenant — c'est ce qui fait un U au lieu d'un W.
 *
 * ⚠️ ON PREND LE SOUFFLE DU NIVEAU 1, PAS CELUI DU BIOME. Un tunnel calibré sur le souffle d'un joueur
 * de niveau 30 serait mortel pour qui arrive en avance, et ces grottes se traversent aussi en revenant
 * sur ses pas. La borne basse est la seule qui vaille pour un passage obligé.
 */
/** Rangées d'eau entre la berge et le dessous du plafond immergé : peu profond, donc long. */
const PROFONDEUR_TUNNEL = 3

function tunnelImmerge(profondeur: number): { maxRock: number; airGap: number } {
  return {
    // ⚠️ ON BORNE SUR UNE RANGÉE DE PLUS QUE L'ÉCART D'ALTITUDE. La dalle occupe la rangée de son
    // altitude basse : la profondeur RÉELLEMENT nagée vaut donc un de plus que `bankAlt - ceilBotAlt`.
    // Sans cette marge d'une rangée, quatre tunnels dépassaient le souffle de une à trois colonnes —
    // assez pour noyer, trop peu pour se voir à l'œil.
    maxRock: Math.max(4, maxSwimTiles(breathMaxMs(1), Math.max(1, profondeur) + 1)),
    // la poche d'air garde deux colonnes : de quoi refaire surface, pas de quoi transformer la traversée
    // en série de petits bonds. C'est le plafond qui s'allonge, pas le répit.
    airGap: 2,
  }
}

function buildModule(m: Module, rng: () => number, w: number, entryAlt: number): Piece {
  // ── MOTIF INVERSÉ : on bâtit l'original MONTANT depuis le sol, on le retourne, et on l'accroche.
  // Le motif retourné part de son sommet et finit au ras du sol : c'est lui qui fait REDESCENDRE le
  // terrain. La rampe d'accroche relie l'altitude courante à ce sommet (elle descend quand on arrive de
  // haut — le cas normal — et monte sinon).
  const origine = INVERSES[m.kind]
  if (origine) {
    // ⚠️ LA RAMPE D'ACCROCHE PREND LA LARGEUR QUE SON DÉNIVELÉ EXIGE — SINON ELLE S'ARRÊTE EN ROUTE.
    // Retour du joueur : « Colline, le terrain est infaisable dès le début, y a un giga mur trop haut
    // pour être sauté. » Mesuré sur place : une rampe qui devait MONTER de dix-sept rangées dans les six
    // tuiles réservées. `ramp()` ne borne pas le nombre de paliers en montée (raidir une montée la rend
    // infranchissable, cf. son propre commentaire) : il en calcule six, n'a la place que pour trois, et
    // s'arrête là. Résultat à l'écran : un escalier 35 → 32 → 29 → 26, puis un mur de HUIT rangées d'un
    // coup jusqu'au motif. Aucun validateur ne le voyait — ils raisonnent en graphe, et un chemin
    // existait par ailleurs (des échelles suspendues à l'autre bout du module).
    //
    // On réserve donc deux tuiles par palier nécessaire, borné par ce que le module peut céder : le
    // motif retourné garde au moins dix tuiles pour exister.
    // ⚠️ LA RAMPE D'ACCROCHE PEUT S'ARRÊTER EN ROUTE, ET C'EST LE « GIGA MUR » DE COLLINE.
    // Elle relie l'altitude courante au SOMMET du motif retourné. `ramp()` ne borne PAS le nombre de
    // paliers en montée (raidir une montée la rend infranchissable, cf. son propre commentaire) : sur
    // une accroche de six tuiles qui doit grimper dix-sept rangées, il en calcule six, n'a la place que
    // pour trois, et s'arrête là. À l'écran : un escalier 35 → 32 → 29 → 26, puis un mur de HUIT rangées
    // jusqu'au motif. Aucun validateur ne le voyait — ils raisonnent en graphe, et un chemin existait
    // par ailleurs (des échelles suspendues à l'autre bout du module).
    //
    // ⚠️ DEUX PASSES, PARCE QUE LA MONTÉE N'EST CONNUE QU'APRÈS COUP. La rampe relie l'altitude courante
    // au SOMMET du motif retourné — or ce sommet est l'altitude de sortie du motif d'origine, qu'on ne
    // connaît qu'une fois celui-ci construit. On le bâtit donc une première fois pour la mesurer, puis
    // on recommence avec la largeur d'accroche qu'elle réclame. `buildModule` est PUR : le rejouer ne
    // coûte que du calcul, et ça évite d'inventer une formule qui devinerait le sommet.
    //
    // Deux tuiles par palier nécessaire, et le motif retourné garde au moins dix tuiles pour exister.
    const largeurPour = (montee: number) => Math.max(LARGEUR_ACCROCHE,
      Math.min(Math.ceil(Math.abs(montee) / SIMPLE_JUMP_ROWS) * 2, Math.max(0, w - 10)))
    const sommetEssai = buildModule({ ...m, kind: origine }, rng, Math.max(10, w - LARGEUR_ACCROCHE), 1).exitAlt
    const largeurAccroche = largeurPour(sommetEssai - entryAlt)
    const wBase = Math.max(10, w - largeurAccroche)
    const base = buildModule({ ...m, kind: origine }, rng, wBase, 1)
    const sommet = base.exitAlt
    const retourne = miroirHorizontal(base, wBase)
    decalerX(retourne, largeurAccroche)
    // ⚠️ L'ALTITUDE DE SORTIE SE RETOURNE AUSSI. Le miroir déplace la géométrie mais `exitAlt` restait
    // celle de l'original — son SOMMET — alors que le motif retourné sort par son PIED. Le module
    // annonçait donc une sortie à la même altitude que son entrée : le terrain ne redescendait pas d'un
    // pouce, et rien ne le signalait puisque la géométrie, elle, était juste. On y remet l'altitude
    // d'ENTRÉE de l'original, c'est-à-dire le sol (le motif de base est bâti depuis 1).
    retourne.exitAlt = 1
    // ⚠️ ON DESCEND DE SON PROPRE DÉNIVELÉ, ON NE PLONGE PAS AU SOL. Sans décalage d'altitude, le motif
    // retourné finissait TOUJOURS au ras du sol : en arrivant de 34 rangées de haut, la rampe d'accroche
    // devenait une chute de 26 rangées d'un coup. On remonte donc tout le motif pour que son SOMMET soit
    // à l'altitude courante — il descend alors exactement de ce qu'il montait, et l'accroche est plate.
    // Le décalage est borné à zéro : on ne descend jamais sous le sol du monde.
    const decalage = Math.max(0, entryAlt - sommet)
    decalerAlt(retourne, decalage) // décale la géométrie ET son exitAlt
    const out = emptyPiece(retourne.exitAlt)
    const accroche = ramp(0, largeurAccroche, entryAlt, sommet + decalage)
    out.platforms.push(...accroche)
    // ⚠️ LA RAMPE D'ACCROCHE A BESOIN DE SON PROPRE SOCLE, ET SON ABSENCE A CREUSÉ 142 TROUS.
    // `addPedestals` tourne à la FIN de buildModule ; cette branche-ci RETOURNE avant d'y arriver, et
    // le motif de base a été bâti par un appel séparé — il a donc reçu son socle, pas la rampe. Résultat
    // à l'écran (captures du joueur) : une plateforme qui court au-dessus du vide, un socle de pierre de
    // chaque côté, et entre les deux un rectangle de décor de fond où l'on n'entrera jamais. « Un carré
    // de terre vide et bizarre. » On comble donc sous la rampe, avec exactement la même règle que le
    // reste du module (rien sous un module à fond de VIDE : ses corniches DOIVENT flotter).
    if (m.fillBelow === 'sol' || m.fillBelow === 'marine' || m.fillBelow === 'cascade' || m.fillBelow === 'lave') {
      const socle = emptyPiece(0)
      socle.platforms.push(...accroche.map((pl) => ({ ...pl })))
      addPedestals(socle, largeurAccroche)
      out.rocks.push(...socle.rocks)
    }
    fusionner(out, retourne)
    out.exitAlt = retourne.exitAlt
    return out
  }

  motifCourant = m.kind
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
    // ─── LES CINQ MOTIFS À TRAMPOLINE ─────────────────────────────────────────────────────────────
    // Un trampoline propulse le panda TROIS FOIS plus haut qu'un saut normal (≈ 12 rangées contre 4) et
    // lui donne un vrai contrôle latéral en l'air. Les altitudes ci-dessous en découlent : ce qu'on met
    // au-dessus d'un trampoline doit être HORS de portée d'un saut simple, sinon l'engin est décoratif.
    case 'trampoline-plat': {
      // 1) « Trampoline qui sert à rien et qui est sur du plat. » C'est un ATELIER : on découvre le
      // rebond sans rien risquer. Découvrir un rebond ×3 au-dessus d'un vide serait une mort gratuite,
      // et le joueur n'aurait pas compris à quoi sert l'engin.
      const alt = entryAlt
      p.platforms.push({ x: 0, alt, w })
      p.trampolines.push({ x: Math.floor(w / 2), alt: alt + 1 })
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }
    case 'trampoline-corniche': {
      // 2) « Trampoline qui permet d'atteindre une corniche haute. » La corniche est posée à +8 rangées :
      // inatteignable au saut simple (4), confortable au rebond (12).
      const alt = entryAlt
      const haut = alt + 8
      p.platforms.push({ x: 0, alt, w: Math.floor(w * 0.55) })
      p.trampolines.push({ x: Math.floor(w * 0.3), alt: alt + 1 })
      // corniche d'arrivée, large : on retombe dessus après un rebond, pas au pixel près
      p.platforms.push({ x: Math.floor(w * 0.5), alt: haut, w: w - Math.floor(w * 0.5) })
      // ─── PALIER DE SECOURS : À CÔTÉ DE LA CORNICHE, PAS DESSOUS ──────────────────────────────
      //
      // ⚠️ IL ÉTAIT POSÉ SOUS LA CORNICHE D'ARRIVÉE, DONC INATTEIGNABLE. À `0,62 w` il tombait dans la
      // portée de la corniche (`0,5 w` → `w`), quatre rangées plus bas : par le haut on ne traverse pas
      // une corniche de terre, par les côtés les socles de pierre ferment le passage. « Rater le rebond
      // ne renvoie pas au début du module » était donc faux — le palier ne servait à rien.
      //
      // Pire, l'espace entre les deux formait une poche close que le comblement d'assemblage remplissait
      // de roche : à l'écran, une bande d'herbe noyée dans la pierre (« y a de la terre qui se superpose
      // à de la pierre, c'est nul »). On le pose donc AVANT la corniche, où l'on retombe vraiment quand
      // le rebond est trop court.
      // ⚠️ LE PALIER DE SECOURS RESTE, ET SA SUPPRESSION A ÉTÉ ESSAYÉE PUIS ANNULÉE. Il rend bien le
      // trampoline contournable (+4 est à portée d'un saut, et de là la corniche à +8 en est à un
      // second) — mais le retirer fait passer l'atteignabilité STRICTE de 0 à 207 plateformes murées :
      // il porte le raccord avec les modules voisins, pas seulement ce motif-ci. Rendre le trampoline
      // obligatoire ne se fera donc pas en retirant des surfaces à un motif existant ; il y faut un
      // motif conçu pour ça, dont l'obstacle est fermé par construction.
      p.platforms.push({ x: Math.max(0, Math.floor(w * 0.5) - 5), alt: alt + 4, w: 4 })
      placeBirds(haut + 3)
      p.exitAlt = haut
      break
    }
    // ─── LES MOTIFS OÙ LE REBOND EST LA SEULE SOLUTION ───────────────────────────────────────
    //
    // Demande du joueur, après qu'on ait mesuré que les vingt-neuf trampolines du jeu étaient tous
    // contournables : « mur très haut, saut très large avec vide en dessous, saut très large avec
    // flotte en dessous, saut très large avec flammes en dessous, et saut très large avec flammes dans
    // un trou dont on peut pas sortir. »
    //
    // ⚠️ LE MUR TRÈS HAUT MANQUE À L'APPEL, ET C'EST ASSUMÉ PLUTÔT QUE MASQUÉ. Écrit, il échouait au
    // test « chaque motif se tient debout seul » à TOUTES les largeurs : une surface restait
    // injoignable, et ni la hauteur du mur (12 → 9 → 8 → 6), ni la distance du tapis, ni le calage du
    // dessus de roche ne l'ont réglé. Continuer à deviner aurait fini par produire un motif accordé au
    // validateur plutôt qu'au jeu. Les quatre traversées, elles, passent — et elles couvrent quatre des
    // cinq demandes.
    //
    // ⚠️ CE QUI REND UN OBSTACLE « SEULEMENT FRANCHISSABLE AU REBOND » N'EST PAS SA TAILLE, C'EST SA
    // FERMETURE. Un mur se contourne dès qu'une corniche traîne à mi-hauteur — c'est exactement ce qui
    // rendait `trampoline-corniche` facultatif, son palier de secours étant pile à portée de saut.
    // Ces motifs-ci ne posent AUCUNE surface entre le départ et l'arrivée.
    //
    // ⚠️ ET LES COTES SONT MESURÉES, PAS DEVINÉES. Relevé sur `canReach` / `canReachByBounce` :
    //   · à plat, un SAUT franchit 3 tuiles, un REBOND en franchit 8 → un vide de 5 à 7 tuiles n'est
    //     passable qu'au rebond, et laisse de la marge à l'atterrissage ;
    //   · en montée, le rebond atteint +9 rangées à 5 tuiles de distance, et pas au-delà.
    // Un premier jet posait un mur de DOUZE rangées : son sommet était injoignable à toutes les
    // largeurs — un motif impossible plutôt qu'exigeant. « Très haut » se mesure à la portée de
    // l'engin, pas à l'intention.
    // Les quatre traversées ne diffèrent que par CE QU'IL Y A DESSOUS. Le geste est le même — courir,
    // rebondir, survoler — et c'est voulu : on apprend une fois, on reconnaît ensuite, et le décor dit
    // seul ce qu'on risque. Un vide pardonne (on retombe au sol), une nappe d'eau ralentit, les flammes
    // brûlent, et la fosse de lave ne rend pas ce qu'elle prend.
    //
    // ⚠️ COTES MESURÉES, PAS DEVINÉES : à plat, un SAUT franchit 3 tuiles, un REBOND en franchit 8. La
    // traversée fait 6, et le tapis est à UNE tuile du bord — à trois, la berge d'en face était à neuf
    // colonnes et le motif se signalait « piège sans retour », ce qu'il était vraiment.
    case 'trampoline-saut-vide':
    case 'trampoline-saut-eau':
    case 'trampoline-saut-flammes':
    case 'trampoline-fosse-ardente': {
      const alt = Math.max(entryAlt, 3)
      const large = 6
      const berge = Math.max(7, Math.floor((w - large) / 2))
      p.platforms.push({ x: 0, alt, w: berge })
      p.trampolines.push({ x: Math.max(1, berge - 1), alt: alt + 1, fixe: true })
      const xFin = Math.min(w - 3, berge + large)
      p.gaps.push({ x: berge, w: xFin - berge })

      if (m.kind === 'trampoline-saut-eau') {
        p.waters.push({ x: berge, w: xFin - berge, kind: 'marine', bankAlt: alt })
      } else if (m.kind === 'trampoline-saut-flammes') {
        // ⚠️ UNE SEULE NAPPE, PAS SIX POINTES CÔTE À CÔTE. Posées une par colonne, elles se lisaient
        // comme des flammes « à écart nul » et un validateur dédié les refusait — il traque les pointes
        // trop rapprochées, qui ne laissent aucun pas où se poser. Ici il n'y a rien où se poser par
        // construction : c'est une traversée. Une nappe continue dit la même chose sans mentir.
        p.spikes.push({ x: berge, w: xFin - berge, alt })
      } else if (m.kind === 'trampoline-fosse-ardente') {
        // ⚠️ « FLAMMES DANS UN TROU DONT ON PEUT PAS SORTIR » — demandé mot pour mot, et c'est le seul
        // endroit du jeu où l'on assume un piège sans issue. Il n'en est un que parce qu'il TUE : de la
        // LAVE, pas de l'eau. Une fosse dont on ne sort pas et où l'on SURVIT serait exactement le
        // défaut que ce projet refuse depuis toujours — une mort, on la recommence ; un enfermement, on
        // quitte le jeu.
        p.waters.push({ x: berge, w: xFin - berge, kind: 'lave', bankAlt: alt })
      }

      const bergeD = Math.max(3, w - xFin)
      p.platforms.push({ x: xFin, alt, w: bergeD })
      // ⚠️ UN TAPIS SUR CHAQUE BERGE. Sans celui du retour, la berge d'arrivée est un PIÈGE SANS RETOUR :
      // on traverse, et plus rien ne ramène. C'est aussi la bonne lecture de jeu — un obstacle se
      // franchit dans les deux sens, sinon ce n'est pas un obstacle, c'est une porte.
      if (bergeD >= 3) p.trampolines.push({ x: Math.min(w - 2, xFin + 1), alt: alt + 1, fixe: true })
      // ⚠️ AUCUN MONSTRE POSÉ ICI. Un premier jet en plaçait un sur chaque berge : le peuplement
      // automatique de l'assembleur choisit mieux, il connaît les espèces AUTORISÉES sur ce terrain.
      placeBirds(alt + 6)
      p.exitAlt = alt
      break
    }

    case 'trampoline-mur':
    case 'trampoline-mur-trou': {
      // « Deux colonnes de pierre de hauteur différente avec un trampoline entre les deux. » Le cadrage
      // du joueur, et c'est lui qui a débloqué le motif.
      //
      // ⚠️ LE SOMMET DU MUR EST LE SOL D'ARRIVÉE — ON N'Y POSE PAS DE PLATEFORME. C'était l'erreur des
      // quatre tentatives précédentes : une corniche coiffant la roche créait, une rangée plus bas, une
      // surface (le DESSUS DE ROCHE, que le validateur compte comme marchable) coiffée par cette
      // corniche — donc inatteignable par construction, et signalée à toutes les largeurs. Ni la
      // hauteur du mur, ni la distance du tapis, ni le calage de la roche n'y changeaient rien : le
      // défaut n'était pas dans la difficulté, il était dans la superposition.
      const alt = Math.max(entryAlt, 2)
      const haut = alt + 8 // le double d'un saut, sous la portée du rebond
      const colonne = Math.max(3, Math.floor(w * 0.16))
      const approche = Math.max(6, Math.floor(w * 0.38))
      p.platforms.push({ x: 0, alt, w: approche })
      // le tapis contre la colonne : le rebond monte de huit rangées à cinq tuiles de distance, pas plus
      p.trampolines.push({ x: Math.max(1, approche - 1), alt: alt + 1, fixe: true })
      // ⚠️ LA COLONNE DOIT ÊTRE COIFFÉE, SINON ELLE DISPARAÎT. Cinquième tentative, et la vraie cause :
      // une passe d'assemblage supprime tout socle de pierre qui monte du sol SANS RIEN PORTER (« de la
      // pierre qui vole au-dessus du sol », un défaut signalé trois fois par le joueur). Ma colonne
      // n'avait rien sur la tête — elle était donc effacée avant même d'arriver au validateur, et ce
      // qu'on mesurait comme « injoignable » était la corniche d'après, orpheline de son mur.
      // On pose donc UNE SEULE plateforme, à fleur du sommet de la roche et courant jusqu'au bord droit :
      // la colonne est coiffée, et le dessus de roche coïncide avec la corniche au lieu d'être enterré
      // une rangée dessous (l'erreur des quatre essais précédents).
      const xMur = m.kind === 'trampoline-mur-trou' ? approche + 3 : approche
      if (m.kind === 'trampoline-mur-trou') {
        // « Un giga trou où faut pas tomber sinon on meurt. » Entre le tapis et le pied du mur : on
        // décolle du bord, on survole, on se pose en haut. Rater, c'est tomber dedans.
        p.gaps.push({ x: approche, w: 3 })
      }
      p.rocks.push({ x: xMur, altBot: 1, altTop: haut, w: colonne, solid: true })
      p.platforms.push({ x: xMur, alt: haut, w: Math.max(3, w - xMur) })
      placeBirds(haut + 3)
      p.exitAlt = haut
      break
    }

    // Les quatre traversées ne diffèrent que par CE QU'IL Y A DESSOUS. Le geste est le même — courir,
    // rebondir, survoler — et c'est voulu : on apprend une fois, on reconnaît ensuite, et le décor dit
    // seul ce qu'on risque. Un vide pardonne (on retombe au sol du terrain), une nappe d'eau ralentit,
    // les flammes brûlent, et la fosse ardente ne rend pas ce qu'elle prend.
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
      // ⚠️ UNE CASCADE N'EST PAS PLUS HAUTE QUE CE QUE SON MODULE PEUT REDESCENDRE. Le tirage était
      // libre : sur un module étroit, il ne restait plus que trois tuiles pour lâcher quinze rangées,
      // soit des marches de cinq — la dernière « marche géante » du jeu. On plafonne donc par la place
      // réellement disponible (une tuile par marche de la hauteur d'un saut), sans jamais descendre
      // sous les quatre rangées qui font l'identité du motif (« ≥ 4× le panda »).
      const cornW = 5
      const placeDescente = Math.max(1, w - 4 - 4 - cornW) // total moins la colonne d'eau, la corniche basse minimale et la haute
      const top = Math.max(low + 4, Math.min(low + cascadeRise(rng), exitAlt + MARCHE_MAX * placeDescente))
      // allocation séquentielle : corniche basse | colonne (2) | ÉCHELLE parallèle + jetée | corniche
      // haute (5) | rampe de redescente. La rampe montante ne tient plus (une cascade de 4× le panda
      // dépasse ce qu'un escalier de paliers peut couvrir en largeur) → une échelle donne l'accès garanti.
      // ⚠️ LA REDESCENTE SE RÉSERVE SA LARGEUR AVANT QUE LA CORNICHE BASSE NE PRENNE LA SIENNE.
      // L'allocation était séquentielle et la rampe finale héritait de ce qui restait : sur un module
      // serré, il lui restait trois tuiles pour lâcher quinze rangées, soit des marches de cinq — la
      // « marche géante » que le joueur voyait. Un palier de descente tient en UNE tuile, donc la place
      // nécessaire se calcule : une tuile par marche de la hauteur d'un saut.
      const besoinDescente = Math.ceil(Math.max(0, top - exitAlt) / MARCHE_MAX)
      const dispo = w - 4 - cornW // tout sauf la colonne d'eau et la corniche haute
      const L = Math.max(4, Math.min(Math.floor(w * 0.22), dispo - besoinDescente))
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const lowAlt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      p.platforms.push({ x: Math.floor(w / 3), alt: alt + SIMPLE_JUMP_ROWS, w: 5 }) // leurre
      p.exitAlt = alt
      break
    }
    case 'detour-balcon': {
      // R26 : chemin principal au sol + balcon-trésor optionnel via échelle (sortie = entrée)
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      const alt = Math.max(ALT_PLANCHER, entryAlt)
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
      // ⚠️ ON RÉSERVE LES 3 TUILES DE LA BERGE DE SORTIE AVANT D'AJOUTER UN ATTERRISSAGE. La condition
      // était `x < w - 4`, qui laissait x dépasser w-3 : la berge, posée à max(x, w-3), sortait alors de
      // la portée du module et empiétait sur le suivant.
      while (x + 4 <= w - 3) {
        p.spikes.push({ x, w: 1, alt })
        p.platforms.push({ x: x + 1, alt, w: 1 }) // atterrissage d'une seule tuile
        p.spikes.push({ x: x + 2, w: 1, alt })
        x += 4
      }
      // Berge de sortie : elle reprend PILE là où la série d'atterrissages s'arrête, et court jusqu'au bord
      // droit. La poser à `w - 3` laissait un vide de 4 à 5 tuiles entre le dernier atterrissage et elle
      // selon la largeur — le motif devenait intirable et DISPARAISSAIT du jeu (couverture-motifs).
      // La boucle garantit `x ≤ w - 3`, donc la berge fait toujours au moins 3 tuiles.
      p.platforms.push({ x, alt, w: w - x })
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
      const from = Math.max(ALT_PLANCHER, entryAlt)
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
      const cornW = 5
      // ⚠️ LA REDESCENTE SE RÉSERVE SA LARGEUR AVANT QUE LA CORNICHE BASSE NE PRENNE LA SIENNE.
      // L'allocation était séquentielle et la rampe finale héritait de ce qui restait : sur un module
      // serré, il lui restait trois tuiles pour lâcher quinze rangées, soit des marches de cinq — la
      // « marche géante » que le joueur voyait. Un palier de descente tient en UNE tuile, donc la place
      // nécessaire se calcule : une tuile par marche de la hauteur d'un saut.
      const besoinDescente = Math.ceil(Math.max(0, top - exitAlt) / MARCHE_MAX)
      const dispo = w - 4 - cornW // tout sauf la colonne d'eau et la corniche haute
      const L = Math.max(4, Math.min(Math.floor(w * 0.22), dispo - besoinDescente))
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
      // ⚠️ DEUX CORNICHES À DROITE, PAS UNE. La sortie latérale basse suffisait à la jouabilité, mais le bord
      // DROIT du lac restait « désaxé » : sa berge est déclarée à `highBank` alors que la seule surface
      // voisine était la corniche de sortie, vingt-huit rangées plus bas. Le jeu appelle ça de l'eau
      // suspendue et le refuse — à raison : rien n'indiquait où commence ni où finit la cuve. On pose donc
      // AUSSI un rebord à la hauteur de la berge, purement structurel. C'est ce détail qui a tenu ce motif
      // hors du jeu depuis sa création.
      p.platforms.push({ x: wx + ww, alt: highBank, w: 2 })
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
      // ⚠️ LE PLAFOND IMMERGÉ PEND DE LA SURFACE, IL NE REPOSE PLUS SUR LE FOND DU MONDE.
      // Il était calé à `min(4, …)`, c'est-à-dire deux à quatre rangées au-dessus du sol du TERRAIN :
      // le tunnel se retrouvait donc tout au fond, et plonger l'atteindre coûtait `bankAlt` rangées —
      // trente sur un module d'entrée haute, soit bien plus qu'une apnée. On l'accroche à la berge :
      // TUNNEL_NAGE rangées d'eau libre dessous, le tout dans la profondeur qu'un débutant peut plonger.
      // ⚠️ LE PLAFOND PEND PRÈS DE LA SURFACE, ET C'EST CE QUI FAIT LE « LONG U ». Demande du joueur :
      // « je suis chaud d'avoir des passages longs en apnée, et c'est vraiment un looong U. Là je vois
      // des W mais très peu de looong U. » La longueur qu'un souffle permet DÉPEND de la profondeur —
      // il faut payer la descente et la remontée avant de payer la traversée. À sept rangées sous la
      // berge, le budget ne laissait que quatre colonnes de nage ; à trois, il en laisse quatorze.
      // Un tunnel PROFOND est donc forcément COURT : pour un long U, il faut le vouloir peu profond.
      const ceilBotAlt = Math.max(2, Math.min(bankAlt - 2, bankAlt - PROFONDEUR_TUNNEL))
      const midX = wx + colW
      const midW = ww - 2 * colW
      const { maxRock, airGap } = tunnelImmerge(bankAlt - ceilBotAlt)
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

    // ══════════════════════════════════════════════════════════════════════════════════════════
    // PIERRE FRAGILE — deux motifs porteurs, plus des caches greffées sur les motifs d'eau existants.
    // Demande du user : « une nouvelle matière qui est du bloc de
    // pierre cassable, et du coup il me faudrait quelques motifs avec des grottes ou grottes + de
    // l'eau juste après ou cascade qui rentre dans grotte... avec des entrées bouchées qu'on peut
    // casser en tapant quelques fois dans la pierre fragilisée. Pourquoi pas aussi des sols qu'on
    // peut casser en sautant plusieurs fois sur les pierres fragiles. »
    //
    // ⚠️ AUCUN DE CES MOTIFS NE MET LA PIERRE FRAGILE SUR LE CHEMIN OBLIGATOIRE, et c'est une règle,
    // pas une timidité. Un mur à casser barrant la seule route, c'est un joueur bloqué s'il ne
    // comprend pas qu'il faut frapper la pierre — le pire des échecs de lisibilité. Ici la pierre
    // scelle toujours un À-CÔTÉ : on traverse le module sans jamais y toucher, et la casser est une
    // RÉCOMPENSE. L'atteignabilité du terrain ne dépend donc jamais d'un coup d'épée.
    //
    // ⚠️ ET CHAQUE CAVITÉ A UN PUITS OUVERT + UNE ÉCHELLE, ce qui n'est pas décoratif non plus. Une
    // cavité entièrement enfermée dans le socle serait INJOIGNABLE (la bouche scellée débouche sur de
    // la roche, pas sur de l'air) ; une chambre sans échelle serait un CUL-DE-SAC où le panda tombe
    // sans pouvoir remonter. Le puits sert à descendre face au mur, l'échelle à ressortir.
    // ══════════════════════════════════════════════════════════════════════════════════════════

    // ─── GROTTE SCELLÉE : entrée murée de pierre fragile, coffre au fond ──────────────────────
    case 'grotte-scellee': {
      // Un puits ouvert perce le chemin ; au fond, un mur de pierre fissurée bouche une cavité. On
      // descend, on tape, on entre, on prend le coffre, on remonte par l'échelle du puits.
      // ⚠️ LA HAUTEUR DU CHEMIN EST PLAFONNÉE PAR CE QU'UNE ÉCHELLE PEUT REMONTER. Il faut de la hauteur
      // SOUS le chemin pour loger la cavité, mais on doit aussi pouvoir ressortir du puits : la remontée
      // est une échelle, son sommet est à `alt + 2` (règle du décalage pieds), donc `alt + 2` doit tenir
      // dans MAX_LADDER_TILES. Sans ce plafond, la remontée n'atteignait pas le chemin et son palier
      // allait se coincer SOUS la dalle de plafond de la cavité — « je peux marcher du sable même s'il y
      // a de la pierre dessus », retour joueur, vu sur plaine-3 et jungle-3.
      const alt = Math.min(MAX_LADDER_TILES - 2, Math.max(entryAlt, 10))
      // ⚠️ VALEUR ABSOLUE, ET SON ABSENCE FABRIQUAIT DES FALAISES. La largeur de la rampe d'accroche
      // suivait `(alt - entryAlt)` : en DESCENTE la différence est négative, le `max(2, …)` la ramenait
      // à DEUX tuiles, et `ramp()` n'avait plus qu'à lâcher tout le dénivelé d'un coup — mesuré 27 → 11,
      // seize rangées en deux tuiles. La rampe a besoin de place dans les deux sens ; seul le SIGNE du
      // dénivelé change, pas la place qu'il réclame.
      const rampW = Math.min(8, Math.max(2, Math.abs(alt - entryAlt) * 2))
      const cavW = Math.min(8, Math.max(5, Math.floor(w * 0.32)))
      // ⚠️ TROIS COLONNES, ET L'ÉCHELLE CONTRE LA CAVITÉ : ON DESCEND EN TOMBANT, PAS EN GRIMPANT.
      // Demande du joueur : « c'est bizarre de descendre par l'échelle, je voudrais un trou là pour
      // descendre ». Le puits était large de 2 avec l'échelle sur la colonne D'ARRIVÉE : en marchant on
      // l'agrippait avant d'avoir pu tomber. Deux colonnes ouvertes devant, l'échelle au fond : on tombe
      // dedans, et on ne remonte QUE par elle — la profondeur (alt ≥ 10 rangées) dépasse de loin les 4
      // rangées d'un saut, ce que le jeu formalise déjà par MIN_LADDER_TILES (« deux fois la hauteur de
      // saut »). Le joueur ne subit aucun dégât de chute, tomber n'est donc pas une punition. Et 3 tuiles
      // restent franchissables au saut pour qui veut passer sans descendre.
      const puitsW = 3
      // ⚠️ LE SOL DE LA CAVITÉ EST CELUI DU MONDE, pas une plateforme posée juste au-dessus. Une
      // plateforme à l'altitude 1 ajoutait un QUATRIÈME étage marchable dans la colonne (sol du monde,
      // sol de la cavité, toit, chemin) là où la règle anti-empilement en tolère trois — le motif était
      // recalé à chaque tirage. Le sol du monde fait très bien le plancher de la grotte.
      const solCav = 0
      const plafondCav = alt - 1         // plafond de la cavité
      const bas = plafondCav             // la dalle fait deux rangées : plafond de la cavité + sol du chemin
      const puitsX = Math.max(rampW + 1, Math.floor(w * 0.45))
      const cavX = puitsX + puitsW
      const finCav = Math.min(w, cavX + cavW)
      // chemin : rampe d'accroche, bande jusqu'au puits, puis bande après la cavité
      p.platforms.push(...ramp(0, rampW, entryAlt, alt))
      p.platforms.push({ x: rampW, alt, w: puitsX - rampW })
      if (w - finCav > 0) p.platforms.push({ x: finCav, alt, w: w - finCav })
      // socle : plein à gauche du puits et après la cavité ; le puits reste OUVERT (on y descend)
      if (alt - 1 >= 1) {
        // ⚠️ LE SOCLE DÉMARRE APRÈS LA RAMPE, JAMAIS À x=0. Parti du bord, il ENTERRAIT les paliers de la
        // rampe d'accroche sous une dalle pleine : au lieu d'un escalier, le module s'ouvrait sur un mur de
        // roche de la hauteur du chemin, infranchissable — d'où les culs-de-sac et la sortie injoignable
        // qui écartaient ce motif à chaque tirage.
        p.rocks.push({ x: rampW, altBot: 1, altTop: alt - 1, w: puitsX - rampW })
        if (w - finCav > 0) p.rocks.push({ x: finCav, altBot: 1, altTop: alt - 1, w: w - finCav })
        // dalle de plafond au-dessus de la cavité ET du puits : le chemin repose sur du plein, et le
        // puits garde son ouverture (une seule rangée de roche, percée par le trou du chemin)
        // épaisseur visuelle du plafond, coiffée par la plateforme ci-dessous → jamais une corniche nue
        p.rocks.push({ x: cavX, altBot: bas, altTop: bas, w: finCav - cavX })
      }
      // ⚠️ LE TOIT DE LA CAVITÉ EST UNE PLATEFORME SOLIDE, PAS UN SIMPLE DESSUS DE DALLE DE ROCHE, et
      // c'est la subtilité qui a écarté ce motif de tous les terrains. Sans toit, la cavité ouvrait dans le
      // chemin un trou d'une dizaine de colonnes ; avec une simple dalle de roche, seul `strictReach` (qui
      // connaît les sommets de roche) voyait un passage — `unreachablePlatforms` et `deadEndSurfaces`, eux,
      // ne raisonnent que sur les PLATEFORMES et continuaient de déclarer la suite du terrain injoignable.
      // Une plateforme solide est comprise par TOUS les validateurs, et elle dit la vérité : c'est de la
      // pierre, on marche dessus, on ne la traverse pas.
      p.platforms.push({ x: cavX, alt, w: finCav - cavX, solid: true })
      // MUR FRAGILE : il sépare le fond du puits de l'intérieur de la cavité
      p.breakables.push({ x: cavX, altBot: solCav + 1, altTop: plafondCav - 1, w: 2 })
      // PLANCHER SOUS LE COFFRE, sur trois colonnes seulement. Un plancher courant sur TOUTE la cavité
      // ajoutait un quatrième étage marchable dans la colonne du puits (règle anti-empilement) ; réduit au
      // fond de la grotte, il donne au coffre la surface dont `unreachableChests` a besoin sans empiler
      // quoi que ce soit là où le panda descend.
      p.platforms.push({ x: finCav - 3, alt: solCav + 1, w: 3 })
      p.props.push({ kind: 'coffre', x: finCav - 2, alt: solCav + 2 })
      if (groundMobs.length) p.spawns.push({ monsterId: groundMobs[0]!, x: finCav - 5, alt: solCav })
      // ÉCHELLE DE REMONTÉE dans le puits — SANS palier propre, et AU MILIEU du puits.
      // `poseLadderOn` aurait ajouté un palier à `alt - 2`, large de 4, débordant vers la cavité et
      // coincé SOUS la dalle de plafond. Le chemin fait très bien le palier : il finit PILE au bord du
      // puits (x = puitsX), donc le validateur le reconnaît comme sommet (l.x ≤ p.x + p.w + 1).
      // ⚠️ AU MILIEU, PAS CONTRE LE MUR À CASSER. Retour joueur : « l'échelle m'empêche de me rapprocher
      // du mur à casser ». Collée à la cavité, elle occupait la seule colonne d'où l'on peut frapper : on
      // s'y agrippait au lieu de taper. Le puits fait trois colonnes, alors on lui donne celle du milieu —
      // une colonne libre pour TOMBER à gauche, une colonne libre pour FRAPPER à droite.
      p.ladders.push({ x: puitsX + 1, topAlt: alt + 2, h: alt + 2 })
      p.exitAlt = alt
      break
    }

    // ─── SOL FRAGILE : « des sols qu'on peut casser en sautant plusieurs fois » ───────────────
    case 'sol-fragile': {
      // Un pan du chemin est en pierre fissurée. On peut passer dessus sans y penser ; s'acharner à
      // retomber dessus le fait CÉDER, et on découvre une chambre au trésor sous le chemin.
      const alt = Math.max(entryAlt, 9)
      // ⚠️ VALEUR ABSOLUE, ET SON ABSENCE FABRIQUAIT DES FALAISES. La largeur de la rampe d'accroche
      // suivait `(alt - entryAlt)` : en DESCENTE la différence est négative, le `max(2, …)` la ramenait
      // à DEUX tuiles, et `ramp()` n'avait plus qu'à lâcher tout le dénivelé d'un coup — mesuré 27 → 11,
      // seize rangées en deux tuiles. La rampe a besoin de place dans les deux sens ; seul le SIGNE du
      // dénivelé change, pas la place qu'il réclame.
      const rampW = Math.min(8, Math.max(2, Math.abs(alt - entryAlt) * 2))
      const dalleW = 4
      const dalleX = Math.max(rampW + 2, Math.floor(w / 2) - Math.floor(dalleW / 2))
      const finDalle = dalleX + dalleW
      // ⚠️ LA PROFONDEUR N'EST PAS UN CHOIX : ELLE EST DICTÉE PAR L'ÉCHELLE QUI EN REMONTE.
      // Une échelle fait au minimum `MIN_LADDER_TILES` et son sommet doit tomber deux rangées au-dessus
      // du chemin (règle du décalage pieds↔centre, cf. isLadderTop). Toute autre profondeur oblige à
      // glisser un palier intermédiaire — et ce palier fait un QUATRIÈME étage dans la colonne, ce que
      // `overStackedColumns` refuse (mesuré : huit terrains rouges). Une seule valeur satisfait tout le
      // monde, et c'est celle-ci.
      const solChambre = Math.max(1, alt - (MIN_LADDER_TILES - 2))
      p.platforms.push(...ramp(0, rampW, entryAlt, alt))
      p.platforms.push({ x: rampW, alt, w: dalleX - rampW })
      if (w - finDalle > 0) p.platforms.push({ x: finDalle, alt, w: w - finDalle })
      // ─── LE PAN FRAGILE, ET LA TUILE DE GAZON QUI LE BORDE ────────────────────────────────────
      //
      // ⚠️ LA DERNIÈRE COLONNE DE LA DALLE EST DU GAZON, PAS DE LA PIERRE FRAGILE, PARCE QUE L'ÉCHELLE
      // DE REMONTÉE PASSE PAR LÀ. Retour du joueur, capture à l'appui : « l'échelle vole et en haut je
      // peux pas remonter à cause du sol cassable en haut, que je peux pas casser du coup ». Il a
      // raison sur toute la ligne : on ne frappe pas vers le haut en étant agrippé à une échelle, donc
      // déboucher sous la pierre fragile est un cul-de-sac — la chambre au trésor n'avait plus de
      // sortie. Sa solution est celle retenue : « full gazon à gauche, et à droite le truc cassable ».
      //
      // On raccourcit donc la dalle d'une colonne au lieu de déplacer le puits : bouger le puits
      // obligeait à trouer le socle de pierre, ce qui a fait tomber trente-cinq tests (atteignabilité
      // stricte, poches closes, motifs isolés). La dalle, elle, ne porte rien.
      p.breakables.push({ x: dalleX, altBot: alt, altTop: alt, w: dalleW - 1 })
      p.platforms.push({ x: finDalle - 1, alt, w: 1 }) // le gazon au-dessus du puits
      if (alt - 1 >= 1) {
        // socle démarré après la rampe (cf. grotte-scellee : à x=0 il enterrait les paliers d'accroche)
        p.rocks.push({ x: rampW, altBot: 1, altTop: alt - 1, w: dalleX - rampW })
        if (w - finDalle > 0) p.rocks.push({ x: finDalle, altBot: 1, altTop: alt - 1, w: w - finDalle })
        if (solChambre - 1 >= 1) p.rocks.push({ x: dalleX, altBot: 1, altTop: solChambre - 1, w: dalleW })
      }
      p.platforms.push({ x: dalleX, alt: solChambre, w: dalleW }) // sol de la chambre
      p.props.push({ kind: 'coffre', x: dalleX + 1, alt: solChambre + 1 })
      // ─── ÉCHELLE DE REMONTÉE : casser le sol ne doit pas être un aller simple ─────────────────
      //
      // ⚠️ ELLE N'A PLUS DE PALIER À ELLE, ET C'EST LA FIN DU « DOUBLE PLANCHER ». Elle passait par
      // `poseLadderOn`, dont le palier part TOUJOURS vers la droite depuis le montant, sur au moins
      // quatre tuiles : posé une rangée au-dessus du chemin, il venait le RECOUVRIR sur trois colonnes.
      // Huit terrains portaient ce doublon — « j'en ai vu une qui revient et ça perturbe ». Le chemin
      // lui-même fait le palier ; il suffit que l'échelle débouche à la bonne hauteur.
      // Aucun palier propre : la tuile de gazon posée plus haut, au-dessus du puits, EST son palier.
      p.ladders.push({ x: finDalle - 1, topAlt: alt + 2, h: MIN_LADDER_TILES })
      p.exitAlt = alt
      break
    }
    // ─── GROTTE SÈCHE EN U, SCELLÉE PAR DEUX PANS DE SOL FRAGILE ──────────────────────────────
    case 'grotte-u-brisable': {
      // Demande du joueur : « une grotte souterraine qui permet de passer via un U, mais on ne peut y
      // accéder qu'en cassant les pierres en sautant dessus. »
      //
      // Deux pans de SOL FRAGILE posés à l'altitude EXACTE du chemin : rien ne les distingue d'une dalle
      // normale. On passe dessus sans rien voir ; s'acharner à retomber sur le premier le fait céder, et le
      // U s'ouvre. Le second, à l'autre bout, se casse PAR LE DESSOUS d'un coup de tête (le geste « façon
      // Mario ») et fait ressortir bien plus loin sur le chemin — c'est le raccourci de qui a compris.
      //
      // ⚠️ JAMAIS UN ALLER SIMPLE. Une échelle occupe le puits d'ENTRÉE : qui n'a pas compris le coup de
      // tête ressort toujours par où il est tombé. Sans elle, ne pas trouver la sortie enfermerait vivant —
      // ce que ce projet tient pour son pire défaut.
      //
      // ⚠️ LA PROFONDEUR EST CELLE QU'UNE ÉCHELLE REMONTE (`MAX_LADDER_TILES - 2`), comme pour
      // `grotte-scellee` : au-delà, l'échelle n'atteint plus le chemin et son palier se coince en route.
      const altU = Math.min(MAX_LADDER_TILES - 2, Math.max(entryAlt, 9))
      const rampU = Math.min(8, Math.max(2, Math.abs(altU - entryAlt) * 2)) // valeur absolue : cf. grotte-scellee
      // 3 tuiles : le trou que le pan MASQUE reste franchissable au saut, donc le chemin de surface reste
      // une vraie route même pour qui ne casse rien (les validateurs, eux, ne voient que le trou).
      const PAN = 3
      const QUEUE = 3
      const xE = rampU + 2
      // ─── TROIS TERRES AUTOUR DE L'ÉCHELLE ─────────────────────────────────────────────────────
      //
      // Retour du joueur : « le truc que tu as fait avec de la terre au-dessus de l'échelle ne suffit
      // pas à me laisser passer, je bute sur la case d'à côté. Mets 3 terres dans ce cas : à gauche, au
      // dessus, et à droite de l'échelle. » Il a raison, et la raison est mécanique : on sort d'une
      // échelle en se DÉCALANT, pas en montant tout droit. Une seule tuile de terre au sommet donne un
      // perchoir d'une case, encadré par le pan fragile — et le pan, on ne peut pas le casser d'ici.
      // Le puits s'ouvre donc UNE COLONNE PLUS LOIN : la terre couvre xLad-1, xLad et xLad+1.
      const xLad = xE - 1        // l'échelle est dans le chemin, pas dans le pan
      const xPan = xE + 1        // le pan fragile ne commence qu'après la terre de droite
      const midU = Math.max(4, w - xPan - 2 * PAN - QUEUE)
      const xS = xPan + PAN + midU
      const finPans = Math.min(w - QUEUE, xS + PAN)
      // ── CHEMIN DE SURFACE : trois segments, deux pans fragiles entre eux
      p.platforms.push(...ramp(0, rampU, entryAlt, altU))
      p.platforms.push({ x: rampU, alt: altU, w: xPan - rampU })
      p.platforms.push({ x: xPan + PAN, alt: altU, w: xS - (xPan + PAN) })
      p.platforms.push({ x: finPans, alt: altU, w: w - finPans })
      p.breakables.push({ x: xPan, altBot: altU, altTop: altU, w: PAN })
      p.breakables.push({ x: xS, altBot: altU, altTop: altU, w: finPans - xS })
      // ── LE U : deux puits ouverts du sol au chemin, reliés par un couloir bas coiffé de roche. Le sol du
      // monde fait le plancher — une plateforme de plus empilerait un étage marchable pour rien (même
      // leçon que sur grotte-scellee).
      if (altU - 1 >= 1) {
        // ⚠️ LE SOCLE S'ARRÊTE AVANT LE PUITS : les deux colonnes xLad et xLad+1 sont le puits d'entrée,
        // et couler l'échelle dans la pierre la rendrait inutile.
        if (xLad - rampU > 0) p.rocks.push({ x: rampU, altBot: 1, altTop: altU - 1, w: xLad - rampU })
        if (w - finPans > 0) p.rocks.push({ x: finPans, altBot: 1, altTop: altU - 1, w: w - finPans })
        // PLAFOND du couloir : c'est lui qui fait le U. Les deux puits restent ouverts de bout en bout, le
        // milieu est coiffé, donc on DOIT marcher au fond pour passer d'un puits à l'autre.
        p.rocks.push({ x: xPan + PAN, altBot: CAVE_CLEARANCE, altTop: altU - 1, w: xS - (xPan + PAN), solid: true })
      }
      // ── RÉCOMPENSE au fond du couloir, et son gardien
      // ⚠️ COFFRE SANS ALTITUDE, ET C'EST LA CONVENTION « POSÉ AU FOND ». Avec une altitude, le validateur
      // exige une PLATEFORME pile dessous — or le plancher du couloir est le sol du MONDE, qui n'en est
      // pas une. Sans altitude, il est simplement posé au sol, et `unreachableChests` ne lui reproche plus
      // que d'être au-dessus d'un trou mortel (il ne l'est pas).
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: xPan + PAN + Math.floor(midU / 2) })
      const gardienU = groundMobs.find((id) => !MONSTERS[id]?.aquatic && !MONSTERS[id]?.aerial)
      if (gardienU) p.spawns.push({ monsterId: gardienU, x: xPan + PAN + 1, alt: 0 })
      // ── ÉCHELLE DE REMONTÉE dans le puits d'ENTRÉE.
      //
      // ⚠️ ELLE MONTAIT DANS LA COLONNE DU PAN FRAGILE, ET ÇA RENDAIT LA SORTIE IMPOSSIBLE. Retour du
      // joueur, capture à l'appui : « y a du terrain destructible en haut de l'échelle qui bloque la
      // sortie ». Exact, et c'est fatal : on ne frappe pas vers le haut en étant agrippé à une échelle,
      // donc le pan qu'on vient de casser pour ENTRER se referme sur qui veut RESSORTIR — la grotte
      // devient le piège sans retour que ce motif jurait de ne jamais être.
      //
      // L'échelle se plante donc une colonne AVANT le pan, dans le dernier carreau du chemin : ce
      // carreau est du sol normal, il fait le palier, et le socle de pierre lui laisse la place (cf.
      // ci-dessus). Le pan fragile garde sa largeur — il n'a jamais eu besoin de porter l'échelle.
      p.ladders.push({ x: xLad, topAlt: altU + 2, h: altU + 2 })
      p.exitAlt = altU
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
      // ⚠️ LE PLAFOND IMMERGÉ PEND DE LA SURFACE, IL NE REPOSE PLUS SUR LE FOND DU MONDE.
      // Il était calé à `min(4, …)`, c'est-à-dire deux à quatre rangées au-dessus du sol du TERRAIN :
      // le tunnel se retrouvait donc tout au fond, et plonger l'atteindre coûtait `bankAlt` rangées —
      // trente sur un module d'entrée haute, soit bien plus qu'une apnée. On l'accroche à la berge :
      // TUNNEL_NAGE rangées d'eau libre dessous, le tout dans la profondeur qu'un débutant peut plonger.
      // ⚠️ LE PLAFOND PEND PRÈS DE LA SURFACE, ET C'EST CE QUI FAIT LE « LONG U ». Demande du joueur :
      // « je suis chaud d'avoir des passages longs en apnée, et c'est vraiment un looong U. Là je vois
      // des W mais très peu de looong U. » La longueur qu'un souffle permet DÉPEND de la profondeur —
      // il faut payer la descente et la remontée avant de payer la traversée. À sept rangées sous la
      // berge, le budget ne laissait que quatre colonnes de nage ; à trois, il en laisse quatorze.
      // Un tunnel PROFOND est donc forcément COURT : pour un long U, il faut le vouloir peu profond.
      const ceilBotAlt = Math.max(2, Math.min(bankAlt - 2, bankAlt - PROFONDEUR_TUNNEL))
      const midX = wx + colW
      const midW = ww - 2 * colW
      const { maxRock, airGap } = tunnelImmerge(bankAlt - ceilBotAlt)
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
      // CACHE SCELLÉE DE PIERRE FRAGILE sur la berge de sortie (demande du user : de la pierre cassable
      // dans les grottes, et des grottes avec de l'eau). On la GREFFE ici plutôt que d'écrire un motif
      // « grotte + eau » de plus : ce motif-ci a déjà une grotte, un plan d'eau et une géométrie éprouvée
      // par les validateurs — deux tuiles fragiles et un coffre suffisent à y ajouter la mécanique, là où
      // un motif neuf se battait sans fin contre la règle des berges à niveau.
      // seuil à 2 : la berge de sortie de ce motif ne fait souvent que deux colonnes (elle est bornée par
      // `w - rbx - 1`), et un seuil à 3 écartait silencieusement la greffe dans la plupart des largeurs.
      if (flatW >= 2) {
        p.breakables.push({ x: rbx, altBot: bankAlt + 1, altTop: bankAlt + 2, w: 2 })
        p.props.push({ kind: 'coffre', x: rbx, alt: bankAlt + 1 })
      }
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
      // puis en haut à droite, puis gauche… pour grimper.
      //
      // ⚠️ STEP_RISE = 3, ET C'EST TOUTE LA DIFFÉRENCE ENTRE UN ZIGZAG ET UNE ÉCHELLE DÉGUISÉE.
      // Retour du user : « les paliers sont trop proches en hauteur, j'ai même pas besoin de faire
      // gauche-droite-gauche, je peux juste sauter et ça passe ». Il avait raison, et la cause est
      // arithmétique : les passerelles de TERRE se traversent PAR LE BAS (one-way). Ce qui compte n'est
      // donc pas l'écart entre deux marches successives, mais l'écart entre deux marches de la MÊME
      // colonne — soit 2 × STEP_RISE. À 2, ça faisait 4 rangées = 128 px, juste sous les ~130 px de saut :
      // on montait tout droit en traversant ses propres passerelles, sans jamais changer de côté.
      // À 3, la marche diagonale reste au maximum du saut simple (3 rangées, cf. SIMPLE_JUMP_ROWS) mais
      // la même colonne passe à 6 rangées = 192 px, hors d'atteinte. Le détour par l'autre côté devient
      // le SEUL chemin — ce que le motif prétendait déjà être.
      //
      // Écart horizontal de 2 tuiles (≤ portée de saut à +3 rangées) → toujours FRANCHISSABLE. Le tout
      // AU-DESSUS DU VIDE (passerelles flottantes :
      // rater un saut = chute mortelle, jamais coincé vivant → pas de socle plein sous la travée). La
      // dernière passerelle est un PALIER LARGE jusqu'au bord droit (raccord au module suivant, au
      // sommet). ≤ 3 passerelles empilées par colonne (silhouette collines respectée, le vide ne
      // compte pas comme palier).
      const base = Math.max(ALT_PLANCHER, entryAlt)
      const STEP_RISE = SIMPLE_JUMP_ROWS // 3 : la diagonale reste franchissable, la verticale ne l'est plus
      const pw = 3
      const gapX = 2 // écart horizontal entre les deux colonnes (≤ portée de saut à +3 rangées)
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
      const base = Math.max(ALT_PLANCHER, entryAlt)
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
      // ⚠️ PLANCHER À 3 PALIERS, ET C'EST UN INVARIANT, PAS UN RÉGLAGE. Le « saut de la foi » n'a de sens
      // que si le plongeoir culmine très haut ; à 1 ou 2 paliers on saute de trois rangées, ce qui n'est
      // plus un plongeoir mais une marche. La règle « au moins un plongeoir du jeu culmine à ≥ 9 rangées »
      // était jusqu'ici laissée à la CHANCE DE LA GRAINE : il a suffi de regraver les plans pour qu'aucun
      // plongeoir n'atteigne plus 7, et le test a sauté. On le garantit donc par construction.
      const paliers = 3
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
      const low = Math.max(ALT_PLANCHER, entryAlt)
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
      // ⚠️ LE PLAFOND IMMERGÉ PEND DE LA SURFACE, IL NE REPOSE PLUS SUR LE FOND DU MONDE.
      // Il était calé à `min(4, …)`, c'est-à-dire deux à quatre rangées au-dessus du sol du TERRAIN :
      // le tunnel se retrouvait donc tout au fond, et plonger l'atteindre coûtait `bankAlt` rangées —
      // trente sur un module d'entrée haute, soit bien plus qu'une apnée. On l'accroche à la berge :
      // TUNNEL_NAGE rangées d'eau libre dessous, le tout dans la profondeur qu'un débutant peut plonger.
      // ⚠️ LE PLAFOND PEND PRÈS DE LA SURFACE, ET C'EST CE QUI FAIT LE « LONG U ». Demande du joueur :
      // « je suis chaud d'avoir des passages longs en apnée, et c'est vraiment un looong U. Là je vois
      // des W mais très peu de looong U. » La longueur qu'un souffle permet DÉPEND de la profondeur —
      // il faut payer la descente et la remontée avant de payer la traversée. À sept rangées sous la
      // berge, le budget ne laissait que quatre colonnes de nage ; à trois, il en laisse quatorze.
      // Un tunnel PROFOND est donc forcément COURT : pour un long U, il faut le vouloir peu profond.
      const ceilBotAlt = Math.max(2, Math.min(bankAlt - 2, bankAlt - PROFONDEUR_TUNNEL))
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
      const colW = 3
      // ⚠️ LE MODULE SE PARTAGE EN TROIS ET LA SOMME DOIT FAIRE w. Le bassin avait un plancher
      // (2·colW+2) que le plancher de spawn ignorait : sur un module étroit, bassin + corniche
      // débordaient de la portée (jusqu'à 5 tuiles) et la corniche de sortie atterrissait dans le module
      // suivant. On rogne donc le plancher de spawn, pas la sortie.
      const SORTIE_W = 3
      // ⚠️ L'ORDRE DE PRIORITÉ N'EST PAS NÉGOCIABLE, ET S'EST PAYÉ D'UN « DÉPART DANS L'EAU ».
      // 1) le plancher COUVRE LE MILIEU du module — le panda y apparaît (`piece.start` est à w/2) ;
      // 2) la corniche de sortie garde ses 3 tuiles ;
      // 3) le bassin prend ce qui reste. Rogner le plancher en premier faisait apparaître le joueur
      // dans la cuve sur montagne-1 (attrapé par reachable.test, PAS par la validation de gravure).
      const voulu = Math.max(Math.floor(w * 0.55), Math.floor(w / 2) + 2)
      const solidW = Math.max(Math.floor(w / 2) + 2, Math.min(voulu, w - SORTIE_W - 2))
      p.platforms.push({ x: 0, alt, w: solidW }) // plancher de spawn (marchable, plein)
      if (alt - 1 >= 1) p.rocks.push({ x: 0, altBot: 1, altTop: alt - 1, w }) // « tout pierre dessous »
      const wx = solidW
      const ww = Math.max(0, w - solidW - SORTIE_W)
      if (ww >= 2) p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt: alt })
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
      // corniche de sortie à droite, À NIVEAU (banc égal) — bornée à la portée du module
      const rbx = Math.min(wx + ww, w - SORTIE_W)
      p.platforms.push({ x: rbx, alt, w: w - rbx })
      // TOIT DE ROCHE au-dessus de tout (grotte fermée continue, roche jusqu'au plafond)
      pushVariedCeiling(p, w, alt, Math.floor(rng() * CEILING_VARIANTS))
      p.exitAlt = alt
      break
    }

    // ─── CHAÎNES VERTICALES VARIÉES ───────────────────────────────────────────────────────────────
    case 'echelle-trou-echelle': {
      // On grimpe une 1ʳᵉ échelle jusqu'à un palier, on franchit un TROU mortel au saut, puis on grimpe
      // une 2ᵉ échelle décalée jusqu'au sommet. Deux étages d'escalade séparés par un vide franchissable.
      const base = Math.max(ALT_PLANCHER, entryAlt)
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
      const base = Math.max(ALT_PLANCHER, entryAlt)
      const landAlt = poseLadder(p, 2, base, 0, 5, 7) // échelle → petit palier de départ du zigzag
      const pw = 3
      let x = 7
      let a = landAlt
      const seq = [2, 2, -2, -2, 2] // monter, monter, redescendre, redescendre, remonter (dents de scie)
      for (const d of seq) {
        if (x + pw > w) break
        // le zigzag redescend, mais jamais sous le plancher : sinon sa dernière passerelle se colle au
        // sol du monde et, retourné en miroir, le motif devient un cul-de-sac pour le modèle de mouvement.
        a = Math.max(ALT_PLANCHER, a + d)
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
      const base = Math.max(ALT_PLANCHER, entryAlt)
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
      // palier haut (on descend d'ici) — posé PILE au bout de la rampe. À `ladX - 2` il chevauchait d'une
      // tuile le dernier palier de la rampe, à la même altitude : deux textures l'une sur l'autre.
      p.platforms.push({ x: bank + upW, alt: palierAlt, w: 4 })
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
    case 'cascade-plus-haute': {
      // 1) « Une cascade et une grotte (ça existe déjà) mais j'aimerais que la cascade aille PLUS HAUT que
      // l'entrée de la grotte. »
      // La différence avec 'cascade-grotte' est petite mais elle change tout à la lecture : le rideau part
      // d'une corniche SUPÉRIEURE à la bouche de la grotte, donc on le voit tomber DEVANT l'entrée. On monte
      // la cascade au-delà du plancher de la grotte, et le passage haut est encore au-dessus.
      const A = Math.max(entryAlt, 2)
      // ⚠️ HAUTEURS CONTRAINTES PAR LA RÈGLE DES CASCADES REMONTABLES : un rideau de moins de 12 rangées
      // (≈ 4× le panda) ne se lit pas comme une cascade et le test le refuse. Le rideau va donc de `A` à
      // `sommet`, soit 13 rangées, et la bouche de la grotte se place à mi-chemin — ce qui donne bien
      // l'effet demandé : la cascade DÉPASSE l'entrée de la grotte.
      // ⚠️ CE MOTIF ÉTAIT INJOIGNABLE PAR CONSTRUCTION, ET PERSONNE NE LE VOYAIT. Mesuré en l'isolant
      // entre deux plateaux neutres : TROIS de ses cinq plateformes étaient hors d'atteinte, à toutes les
      // largeurs. Le plancher de grotte était à A+5, or le saut garanti fait 3 rangées (4 à la limite
      // physique) ; et il n'était pas non plus un « sommet de cascade » (il faut être à 2 rangées du haut
      // du rideau, il en était à 8). Le motif ne validait que parce que les rampes des modules VOISINS
      // débordaient sur sa portée et lui fabriquaient un escalier par accident. En supprimant ces
      // débordements, les deux terrains qui l'imposent — plaine-7 et desert-7 — n'ont plus trouvé une
      // seule graine valide. Chaque liaison est donc désormais EXPLICITE.
      const T = A + SIMPLE_JUMP_ROWS // bouche de la grotte : à portée de saut GARANTIE depuis la berge
      const sommet = A + 13          // le rideau dépasse la bouche de la grotte de 10 rangées
      let x = 0
      p.platforms.push({ x, alt: A, w: bank }); x += bank
      // rideau : de `sommet` jusqu'au niveau d'entrée (il recueille dans un petit bassin, pas dans le vide)
      p.waters.push({ x, w: 2, kind: 'cascade', bankAlt: sommet, bottomAlt: A })
      p.platforms.push({ x, alt: A, w: 2 }) // vasque au pied du rideau
      const caveX = x + 2
      const floorW = Math.max(bank, w - caveX - bank)
      p.platforms.push({ x: caveX, alt: T, w: floorW, solid: true })     // plancher de la grotte
      if (T - 1 >= 0) p.rocks.push({ x: caveX, altBot: 0, altTop: T - 1, w: floorW, solid: true })
      p.rocks.push({ x: caveX, altBot: T + CAVE_CLEARANCE, altTop: sommet - 1, w: Math.min(floorW, 6), solid: true })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: caveX + 1, alt: T + 1 })
      const gardien = groundMobs.find((id) => !MONSTERS[id]?.aquatic && !MONSTERS[id]?.aerial)
      if (gardien) p.spawns.push({ monsterId: gardien, x: caveX + 3, alt: T })
      // CORNICHE D'ÉMERGENCE au sommet du rideau : sans elle, remonter la cascade ne débouchait sur rien
      // (le validateur ne voit un sommet de cascade que dans les 2 rangées sous le haut du rideau).
      p.platforms.push({ x: caveX, alt: sommet, w: Math.min(3, floorW) })
      // ÉCHELLE DE SORTIE de la cavité vers le passage haut — l'invariant maison : toute cavité a un
      // puits d'accès et une échelle de sortie. Son palier EST le passage de sortie du module, collé au
      // bord droit (le chaînage exige une surface marchable à `exitAlt` sur le bord).
      poseLadderOn(p, w - 4, T, w, sommet - T + 2)
      placeBirds(sommet + 2)
      p.exitAlt = sommet
      break
    }
    case 'cascade-deux-passages':
    case 'cascade-deux-passages-g': {
      // 2) et 3) « Une cascade avec deux passages sur la droite. Celui du haut est un tunnel et celui du bas
      // c'est juste une petite cavité avec un mob et un trésor. » Puis : « pareil mais dans l'autre sens. »
      //
      // Le choix est FAUX-VRAI, et c'est le sel du motif : le passage du bas est un cul-de-sac récompensé,
      // celui du haut est la vraie route. On ne le sait qu'en essayant — d'où le mob qui garde le trésor.
      // « L'autre sens » = le côté des passages par rapport au rideau ; un vrai miroir gauche-droite mettrait
      // la sortie à gauche, à contresens de la progression du terrain.
      //
      // ⚠️ MOTIF DÉLIBÉRÉMENT HAUT, SUR AUTORISATION EXPLICITE : « fais un truc très haut c'est top », « une
      // grande cascade pour descendre ou une grande échelle, ça me choque pas ». Le rideau fait 14 rangées et
      // le tunnel est à son sommet. Cela dépasse la silhouette « collines » (≤ 3 paliers empilés) que le jeu
      // s'impose ailleurs : les terrains qui portent ce motif sont donc déclarés HAUTS (cf. TERRAINS_HAUTS
      // dans data/levels), et c'est la seule exception — ailleurs la règle tient.
      const passagesAGauche = m.kind === 'cascade-deux-passages-g'
      const A = Math.max(entryAlt, 2)
      const T = A + 14 // sommet du rideau ET plancher du tunnel
      const bw = bank
      // ⚠️ ZONE PLAFONNÉE À 15 TUILES. La règle « anti-ennui » du jeu refuse toute bande plate vide de plus
      // de 16 : au-delà, le plancher de la cavité en formait une à lui seul (20 tuiles sur cimetiere-1). Ce
      // qui dépasse est rendu aux berges, donc au chaînage avec les modules voisins.
      const zoneW = Math.min(15, Math.max(10, w - 2 * bw - 3))
      const zoneX = passagesAGauche ? bw : bw + 3
      const casX = passagesAGauche ? bw + zoneW : bw

      p.platforms.push({ x: 0, alt: A, w: bw })

      // RIDEAU : 14 rangées, remontable à la nage, recueilli dans une vasque au pied (pas de vide mortel).
      p.waters.push({ x: casX, w: 2, kind: 'cascade', bankAlt: T, bottomAlt: A })
      p.platforms.push({ x: casX, alt: A, w: 2 })

      // CAVITÉ DU BAS : cul-de-sac récompensé. Le plancher du tunnel lui sert de toit — pas de seconde dalle,
      // qui écraserait le dégagement (essayé : « plafond de grotte trop bas » sur jungle-4).
      const cavW = Math.min(6, zoneW - 2)
      p.platforms.push({ x: zoneX, alt: A, w: zoneW, solid: true })
      // ⚠️ SOCLE DE ROCHE JUSQU'AU SOL SOUS LA CAVITÉ. Sans lui, le sol du monde restait visible et NU sous
      // le module : une bande plate vide de 20 tuiles au ras du niveau, que la règle « anti-ennui » refuse.
      // C'est exactement ce qu'elle est censée attraper — un couloir de sol sans rien dessus — et meubler la
      // surface pour la faire taire aurait masqué le vrai problème : la cavité ne reposait sur rien.
      if (A - 1 >= 0) p.rocks.push({ x: zoneX, altBot: 0, altTop: A - 1, w: zoneW, solid: true })
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: zoneX + Math.floor(cavW / 2), alt: A + 1 })
      const garde = groundMobs.find((id) => !MONSTERS[id]?.aquatic && !MONSTERS[id]?.aerial)
      if (garde) p.spawns.push({ monsterId: garde, x: zoneX + 1, alt: A })

      // GRANDE ÉCHELLE cavité → tunnel : c'est la voie « sèche », en plus de la remontée du rideau. Elle est
      // longue, et c'est assumé (« une grande échelle, ça me choque pas ») ; son sommet porte un palier deux
      // rangées plus bas, comme l'exige le validateur.
      const hEch = Math.min(MAX_LADDER_TILES, T - A)
      p.ladders.push({ x: zoneX + zoneW - 2, topAlt: A + hEch, h: hEch })
      p.platforms.push({ x: zoneX + zoneW - 4, alt: A + hEch - 2, w: 4 })

      // TUNNEL DU HAUT : la vraie route, sous un plafond de roche, jusqu'à la sortie.
      // ⚠️ LE TUNNEL EST EN DEUX PALIERS, ET CE N'EST PAS UN CAPRICE. D'un seul tenant il formait une bande
      // PLATE de 20 tuiles, et le jeu refuse toute bande plate vide de plus de 16 (règle « anti-ennui », qui
      // existe pour éviter les couloirs sans intérêt). Une marche d'une rangée au milieu suffit à casser la
      // bande, et accessoirement le tunnel se lit mieux.
      const moitie = Math.floor(zoneW / 2)
      p.platforms.push({ x: zoneX, alt: T, w: moitie, solid: true })
      p.platforms.push({ x: zoneX + moitie, alt: T + 1, w: zoneW - moitie, solid: true })
      p.rocks.push({ x: zoneX, altBot: T + 1 + CAVE_CLEARANCE, altTop: T + 1 + CAVE_CLEARANCE + CAVE_CEILING_THICK, w: zoneW, solid: true })
      // ⚠️ UN MOB DANS LE TUNNEL, ET C'EST LA RÈGLE « ANTI-ENNUI » QUI L'EXIGE : le jeu refuse une bande plate
      // VIDE de plus de 16 tuiles. Le plafonnement de la zone n'a pas suffi (la bande mesurée restait à 20 en
      // comptant les raccords), et un couloir long et vide est de toute façon la définition de l'ennui. Le
      // tunnel est la VRAIE route du motif : y poster un garde a du sens en plus de régler la règle.
      if (garde) p.spawns.push({ monsterId: garde, x: zoneX + Math.floor(zoneW * 0.6), alt: T + 1 })
      // ⚠️ ET UN PIÈGE SUR LE PALIER HAUT, parce que le garde ne suffit pas toujours : selon le biome, le
      // pool de monstres au sol peut être vide (cimetiere-1 n'en avait aucun d'éligible), et la bande plate
      // redevenait vide — 20 tuiles au ras du tunnel, refusées par la règle « anti-ennui ». Des flammes ne
      // dépendent d'aucun pool, et sur la VRAIE route du motif un piège a du sens : le raccourci se paie.
      p.spikes.push({ x: zoneX + moitie + 2, w: 2, alt: T + 1 })

      // ⚠️ LA CORNICHE DE SORTIE PART DU BOUT DU TUNNEL, PAS DU BORD DU MODULE. Fixée à `w - bw`, elle
      // s'éloignait du tunnel à mesure qu'on élargissait le module : 6 tuiles de vide à la MÊME altitude
      // aux grandes largeurs, donc une sortie injoignable (mesuré sur cascade-deux-passages w=30 et sa
      // variante -g dès w=25). On ne peut pas simplement prolonger le tunnel : dans la variante `-g` le
      // rideau se trouve ENTRE le tunnel et la sortie, et une plateforme posée dessus le coifferait — le
      // validateur ne reconnaîtrait plus son sommet. On part donc du plus à droite des deux : bout du
      // tunnel, ou bout du rideau.
      const sortieX = Math.max(zoneX + zoneW, casX + 2)
      p.platforms.push({ x: sortieX, alt: T + 1, w: w - sortieX })
      placeBirds(T + 4)
      p.exitAlt = T + 1
      break
    }
    case 'boyau-tresor-retour': {
      // 4) « Un passage sous-marin qui permet d'accéder à une grotte avec un trésor, mais il faut REVENIR
      // EN ARRIÈRE pour avancer. »
      //
      // ⚠️ LE CUL-DE-SAC EST LE MOTIF, PAS UN DÉFAUT — mais il ne doit jamais devenir un PIÈGE. Le lac est
      // ouvert des DEUX côtés (`openSide: 'both'`) : on entre, on ressort par où l'on veut. Un boyau à sens
      // unique aurait enfermé le joueur dans la grotte, exactement ce qu'un validateur appelle « coincé
      // vivant » — et ce que le user a signalé comme le pire défaut d'un terrain.
      const A = Math.max(entryAlt, 3)
      const bw = bank
      p.platforms.push({ x: 0, alt: A, w: bw })
      const lacX = bw
      const lacW = Math.max(6, Math.floor(w * 0.4))
      p.waters.push({ x: lacX, w: lacW, kind: basinKind === 'lave' ? 'lave' : 'marine', bankAlt: A, openSide: 'both' })
      // grotte à trésor au FOND du lac, sous un toit de roche : on y descend en nageant
      const grotteX = lacX + Math.floor(lacW / 2)
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: grotteX })
      p.rocks.push({ x: grotteX - 1, altBot: A - 3, altTop: A - 2, w: 4, solid: true }) // avancée rocheuse : la grotte est COUVERTE
      // berge de sortie à la MÊME altitude : on ressort du lac et on repart — le trésor est un détour
      p.platforms.push({ x: lacX + lacW, alt: A, w: Math.max(bw, w - (lacX + lacW)) })
      placeBirds(A + 4)
      p.exitAlt = A
      break
    }
    case 'aqueduc': {
      // AQUEDUC MARCHABLE — « je veux pas que ça soit décoratif dessiné, je veux que ça soit de la matière
      // sur laquelle on peut marcher. C'est, au lieu d'avoir un terrain tout plat, parfois on a un aqueduc
      // ou un pont, et c'est joliii. »
      //
      // ⚠️ LE TABLIER EST UNE VRAIE PLATEFORME, pas un dessin. La première version vivait dans le décor de
      // fond, hors de portée : jolie, mais sans conséquence. Ici l'ouvrage REMPLACE le sol — dessous c'est le
      // vide ou l'eau — donc traverser, c'est marcher sur l'aqueduc. Il entre de ce fait dans tous les
      // calculs d'atteignabilité, ce qui est le prix (et la preuve) qu'il fait partie du terrain.
      // Les arches, elles, restent du dessin : elles pendent SOUS le tablier et ne portent rien.
      const alt = Math.max(entryAlt, 3)
      const bw = bank
      const pontX = bw
      const pontW = Math.max(8, w - 2 * bw)
      const surEau = (hashSeed(m.kind + ':' + w + ':' + alt) % 2) === 0 && basinKind !== 'lave'

      p.platforms.push({ x: 0, alt, w: bw })
      p.platforms.push({ x: pontX, alt, w: pontW, solid: true }) // TABLIER : on marche dessus
      p.platforms.push({ x: w - bw, alt, w: bw })

      if (surEau) {
        // eau EN CONTREBAS : on tombe dedans et on nage, on ne meurt pas. Berges à l'altitude de la cuve pour
        // qu'elle ne soit pas « suspendue » — le validateur y tient, et il a raison : sans bord au niveau de
        // l'eau, rien n'indique où la cuve commence.
        p.waters.push({ x: pontX, w: pontW, kind: basinKind, bankAlt: 1 })
        p.platforms.push({ x: pontX - 1, alt: 1, w: 1 })
        p.platforms.push({ x: pontX + pontW, alt: 1, w: 1 })
      } else {
        for (let gx = pontX; gx < pontX + pontW; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, pontX + pontW - gx) })
      }
      // HAUTEUR DE L'OUVRAGE. Sur l'eau, les piles descendent jusqu'à la SURFACE et s'y enfoncent : on
      // voit où elles se posent, l'ouvrage tient. Au-dessus d'un gouffre, elles plongent — et le rendu
      // les estompe au bout de quelques rangées plutôt que de les faire courir sur trente tuiles de gris.
      // Sans cette hauteur, le bandeau de pierre s'arrêtait à mi-hauteur en plein ciel : « des trucs
      // dégueulasses qui volent ». Une pile qui ne touche rien ne lit pas comme un pont, mais comme un bug.
      p.arches.push({ x: pontX, alt, w: pontW, h: surEau ? Math.max(2, alt - 1) : alt, fill: surEau ? 'eau' : 'vide' })
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }
    case 'bassin-creuse': {
      // ─── BASSIN CREUSÉ DANS LA ROCHE : LA PROFONDEUR VARIE ────────────────────────────────────
      //
      // Demande du user : « des bassins d'épaisseur variable (donc au début très très peu profond) puis
      // au centre très profond pour forcer à nager », et « des bassins qui ont une forme plus
      // intéressante que juste des rectangles et qui seraient dans la roche ».
      //
      // ⚠️ LE FOND EST FAIT DE PLATEFORMES, PAS DE ROCHE BRUTE, ET CE CHOIX EST DICTÉ PAR LES
      // VALIDATEURS. Une dalle de roche immergée bloque la colonne de sol : `strictReach` y voit un mur
      // et déclare injoignable tout ce qui suit — alors qu'on passe simplement à la nage. Des marches de
      // PIERRE (platforms solid) descendent au contraire une par une depuis la berge : chacune est
      // atteignable de la précédente par une simple chute, tous les validateurs suivent, et le rendu est
      // le même (une plateforme solide se dessine avec la texture de paroi de cuve).
      //
      // Le profil est symétrique : on entre par un gué à hauteur de cheville, on descend marche par
      // marche, et le centre n'a PAS de fond posé — c'est le sol du terrain, `bankAlt` rangées plus bas.
      // Au-delà de trois rangées sous la surface, les pieds ne touchent plus : la nage est obligatoire,
      // ce qui est exactement l'effet demandé.
      const bankAlt = Math.max(entryAlt + 5, 6) // ≥ 5 rangées d'eau au centre → nage garantie
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt))
      const wx = rampW
      const ww = Math.max(10, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })

      // LIT EN ESCALIER : marches de pierre descendant de chaque berge vers le centre. Le nombre de
      // marches suit la largeur — sur un bassin étroit, deux paliers suffisent à donner la pente.
      //
      // ⚠️ LE LIT NE SUIT PLUS `bankAlt`, ET C'EST LA CORRECTION DU « lac trop profond ». Le pas de
      // descente valait `(bankAlt - 1) / (nMarches + 1)` : sur un module d'entrée haute, la dernière
      // marche tombait à une rangée du sol du monde, donc trente rangées sous la berge. Deux
      // conséquences, toutes deux mauvaises : le coffre du fond devenait inatteignable en une apnée,
      // et l'assembleur ne pouvait plus remonter le fond de la cuve (il aurait muré ces marches).
      // Le lit se creuse donc dans PROFONDEUR_MOTIF rangées, quelle que soit la hauteur de la berge.
      const nMarches = Math.max(2, Math.min(4, Math.floor(ww / 6)))
      const marcheW = Math.max(2, Math.floor((ww / 2 - 2) / nMarches))
      const litBas = Math.max(1, bankAlt - PROFONDEUR_MOTIF + 1) // altitude de la marche la plus basse
      for (let k = 0; k < nMarches; k++) {
        const alt = Math.max(litBas, bankAlt - 1 - k * Math.max(1, Math.floor((PROFONDEUR_MOTIF - 1) / (nMarches + 1))))
        if (alt < 1) break
        p.platforms.push({ x: wx + k * marcheW, alt, w: marcheW, solid: true })
        p.platforms.push({ x: wx + ww - (k + 1) * marcheW, alt, w: marcheW, solid: true })
      }
      // le coffre repose sur le POINT LE PLUS PROFOND : il faut plonger et tenir son souffle pour l'avoir
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) })

      // BERGE DROITE plate à la ligne d'eau, puis redescente : la surface d'un lac est horizontale, et
      // les validateurs exigent que les deux bords soient EXACTEMENT à la rangée de la surface.
      const rbx = wx + ww
      const flatW = Math.min(bank, Math.max(1, w - rbx - 1))
      p.platforms.push({ x: rbx, alt: bankAlt, w: flatW })
      const downX = rbx + flatW
      if (w - downX > 0) p.platforms.push(...ramp(downX, w - downX, bankAlt, exitAlt))
      placeBirds(bankAlt + 3)
      p.exitAlt = exitAlt
      break
    }
    case 'colonnes-perilleuses': {
      // 5) « Des zones de saut sur des colonnes de pierre pas larges et de hauteurs différentes, et long
      // (genre casse-gueule, et tu tombes tu meurs). »
      //
      // ⚠️ LES HAUTEURS VARIENT DE ±1 RANGÉE ENTRE DEUX COLONNES VOISINES, PAS PLUS. Un premier jet allait de
      // −2 à +2, soit un écart de 4 rangées entre deux colonnes consécutives : 128 px de montée pour 96 px
      // d'écart horizontal, c'est à la limite exacte de la parabole de saut. Le validateur a déclaré cinquante
      // plateformes injoignables sur enfer-4 et signalé des pièges sans retour. Le danger doit venir de la
      // PRÉCISION et de la répétition, jamais d'un saut qui n'est pas franchissable — sinon ce n'est plus
      // casse-gueule, c'est cassé.
      const A = Math.max(entryAlt, 4)
      const bw = bank
      p.platforms.push({ x: 0, alt: A, w: bw })
      const droite = w - bw
      for (let gx = bw; gx < droite; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, droite - gx) })
      const dents = [0, 1, 2, 1, 0, -1]
      let cx = bw + 2
      let k = 0
      while (cx + 2 < droite) {
        p.platforms.push({ x: cx, alt: Math.max(2, A + dents[k % dents.length]!), w: 2 })
        cx += 5 // 2 tuiles de colonne + 3 de vide : saut simple, sans marge de confort
        k++
      }
      p.platforms.push({ x: droite, alt: A, w: bw })
      placeBirds(A + 4)
      p.exitAlt = A
      break
    }

    // ─── PHASE 2 — FILLERS / respiration (D1) ────────────────────────────────────────────────

    // ─── PHASE 2 — TRAVERSÉE horizontale (D1–D3) ─────────────────────────────────────────────

    // ─── PHASE 2 — VERTICAL / étages (D2–D4) ─────────────────────────────────────────────────

    // ─── PHASE 2 — RISQUE / récompense (D2–D4) ───────────────────────────────────────────────

    // ─── PHASE 2 — TENSION / précision (D3–D5, sans pics — voir NOTE) ─────────────────────────

    // ─── PHASE 2b — TENSION à PICS (pics rendus sur TOUTE surface élevée) ─────────────────────

    // ─── ESCALIER DE PIERRE (marches RIGIDES) ────────────────────────────────────────────────

    // ─── PHASE 2 — EAU / cascade (D2–D4) ─────────────────────────────────────────────────────

    // ─── PASSAGE SOUS-MARIN : plonger par le HAUT, ressortir sur le CÔTÉ immergé ──────────────

    // ─── LAC EN U : plonger, nager SOUS LA ROCHE, ressortir à la MÊME hauteur ─────────────────

    // ─── GROTTE-TUNNEL : boyau de roche PLUS LONG et VARIÉ (roche dessus ET dessous) ──────────

    // ─── GROTTE SOUS-MARINE EN U : lac en U NOYÉ SOUS UN TOIT DE ROCHE, coffre au fond ────────

    // ─── PASSERELLES FLOTTANTES EN ZIGZAG ASCENDANT ───────────────────────────────────────────

    // ─── PASSERELLES FLOTTANTES sur SOL PLEIN (variante « full sol » du miroir sous les passerelles) ──

    // ─── PLONGEOIR « SAUT DE LA FOI » : perchoir TRÈS HAUT + panneau, on plonge à l'aveugle dans le lac ──

    // ─── PUITS : cuve marine ÉTROITE et PROFONDE (margelle de pierre), distinct du BASSIN large ────

    // ─── CASCADE-BASSIN : une cascade remontable qui TOMBE dans un bassin marine (coffre au fond) ──

    // ─── BOYAU IMMERGÉ (eau-passage) : tunnel marine OUVERT sur le côté, traversé À LA NAGE ────────

    // ─── GROTTE DE DÉPART SOUTERRAINE : boyau de roche fermé, bassin immergé à FRANCHIR À LA NAGE ──

    // ─── CHAÎNES VERTICALES VARIÉES ───────────────────────────────────────────────────────────────

    // ─── ÉCHELLE-DESCENTE PIÉGÉE : on descend, TROU mortel en bas, saut sur passerelle coiffée de roche ──

    // ─── CASCADE → GROTTE SOUS-MARINE : le rideau tombe (lucarne) dans un bassin sous toit de roche ──
    case 'cascade-grotte': {
      // CASCADE + GROTTE à un niveau DIFFÉRENT de l'entrée (spec user). Deux variantes selon la place :
      //  • assez de place EN BAS → GROTTE EN BAS : on ENTRE EN HAUT (plateforme de départ PLUS HAUTE que
      //    la grotte), on DESCEND la cascade dans la grotte (trésor), le passage continue en haut ;
      //  • sinon → GROTTE EN HAUT : cascade au-dessus du VIDE (bas du niveau), on la GRIMPE vers la grotte.
      // Roche SOLIDE tout autour (plancher, plafond, socle jusqu'au sol) → rien de traversable.
      const rise = cascadeRise(rng)
      const A = Math.max(entryAlt, 2)
      const guard = groundMobs.find((id) => !MONSTERS[id]?.aquatic && !MONSTERS[id]?.aerial) // gardien terrestre si dispo
      let x = 0
      if (A - rise >= 2) {
        // GROTTE EN BAS — plateforme d'ENTRÉE (A) PLUS HAUTE que la grotte (T)
        const T = A - rise
        p.platforms.push({ x, alt: A, w: bank }); x += bank // berge d'ENTRÉE (en haut)
        p.waters.push({ x, w: 2, kind: 'cascade', bankAlt: A, bottomAlt: T }) // cascade qui DESCEND dans la grotte
        const caveX = x + 2
        const floorW = Math.max(bank, w - caveX)
        p.platforms.push({ x: caveX, alt: T, w: floorW, solid: true }) // plancher SOLIDE de la grotte (en bas)
        if (T - 1 >= 0) p.rocks.push({ x: caveX, altBot: 0, altTop: T - 1, w: floorW, solid: true }) // socle jusqu'au SOL
        const roofW = Math.min(floorW, 5)
        p.rocks.push({ x: caveX, altBot: T + CAVE_CLEARANCE, altTop: A - 1, w: roofW, solid: true }) // plafond (sous le passage haut)
        p.platforms.push({ x: caveX, alt: A, w: floorW, solid: true }) // PASSAGE HAUT (à A, au-dessus de la grotte) + sortie
        if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: caveX + 1, alt: T + 1 }) // TRÉSOR sur le PLANCHER de la grotte (en bas)
        if (guard) p.spawns.push({ monsterId: guard, x: caveX + 2, alt: T })
        placeBirds(A + 3)
        p.exitAlt = A
      } else {
        // GROTTE EN HAUT — cascade au-dessus du VIDE, on grimpe
        const T = A + rise
        p.platforms.push({ x, alt: A, w: bank }); x += bank // berge d'accès BASSE
        p.waters.push({ x, w: 2, kind: 'cascade', bankAlt: T }); p.gaps.push({ x, w: 2 }) // cascade au-dessus du VIDE
        const caveX = x + 2
        const floorW = Math.max(bank, w - caveX)
        p.platforms.push({ x: caveX, alt: T, w: floorW, solid: true }) // plancher SOLIDE de la grotte (en haut) + passage
        const roofW = Math.min(floorW, 5)
        p.rocks.push({ x: caveX, altBot: T + CAVE_CLEARANCE, altTop: T + CAVE_CLEARANCE + CAVE_CEILING_THICK, w: roofW, solid: true })
        if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: caveX + 1, alt: T + 1 }) // TRÉSOR sur le PLANCHER de la grotte
        if (guard) p.spawns.push({ monsterId: guard, x: caveX + 2, alt: T })
        placeBirds(T + 2)
        p.exitAlt = T
      }
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
      // ⚠️ BERGE GAUCHE AU NIVEAU DU BASSIN. Sans elle, le voisin de gauche du bassin était le PERCHOIR, seize
      // rangées plus haut : le validateur y voyait un « rebord désaxé », c'est-à-dire une cuve dont le bord ne
      // correspond à aucune surface marchable. C'est ce défaut qui a tenu ce motif hors du jeu jusqu'ici.
      p.platforms.push({ x: perchX + 3, alt: A, w: 2 })
      const basinX = perchX + 5
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
      const floor = Math.max(ALT_PLANCHER, entryAlt)
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
      const floor = Math.max(ALT_PLANCHER, entryAlt)
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
      let first = true
      p.platforms.push({ x, alt, w: bank }); x += bank // RIVE d'accès (gauche)
      while (x + POOL + 1 <= w - bank) {
        const top = alt + cascadeRise(rng)
        // CONTENU : le TOUT PREMIER lac garde sa PAROI GAUCHE (mur d'enceinte) → on ne peut pas nager hors
        // du bassin par la gauche. Les bords INTERNES restent ouverts (eau continue, sans pierre au milieu).
        p.waters.push({ x, w: POOL + 1, kind: basinKind, bankAlt: alt, openSide: first ? 'right' : 'both' })
        first = false
        if (basinKind !== 'lave' && !placedCoffre) { p.props.push({ kind: 'coffre', x: x + 1 }); placedCoffre = true }
        // CASCADE FINE (1 tuile) = la marche d'eau : pied dans CE lac, sommet dans le lac suivant
        p.waters.push({ x: x + POOL, w: 1, kind: 'cascade', bankAlt: top, bottomAlt: alt })
        x += POOL + 1
        alt = top
      }
      // LAC FINAL (sommet) : garde sa PAROI DROITE (mur d'enceinte) → pas de nage hors du bassin par la droite.
      const fw = Math.max(POOL, w - x - bank)
      p.waters.push({ x, w: fw, kind: basinKind, bankAlt: alt, openSide: 'left' })
      x += fw
      p.platforms.push({ x, alt, w: Math.max(1, w - x) }) // RIVE de sortie (droite)
      placeBirds(alt + 3)
      p.exitAlt = alt
      break
    }

    // ─── ESCALIER DE LACS DESCENDANT : on grimpe à un lac perché, l'eau se déverse de lac en lac vers le bas ──
    case 'lacs-cascade-descente': {
      // ESCALIER DE LACS QUI DESCEND : on grimpe un rideau jusqu'à un lac perché, puis on redescend de lac en
      // lac par des déversoirs. C'était l'un des motifs « écrits mais jamais posés » — pas parce qu'il était
      // injouable, mais parce qu'il était MAL DÉCLARÉ, sur trois points qui se cumulaient :
      //   · ses déversoirs de 3 rangées étaient déclarés « cascade », or une cascade remontable doit en faire
      //     12 au minimum ; trois rangées, c'est un déversoir, donc un bassin ;
      //   · ses lacs n'avaient de berge que d'un côté, ce que le validateur appelle un « rebord désaxé » ;
      //   · il sortait à l'altitude d'entrée, alors qu'un motif de DESCENTE doit descendre.
      const haut = Math.max(4, entryAlt)
      // ⚠️ LE NOMBRE DE PALIERS SUIT LA LARGEUR RÉELLE, IL N'EST PAS DÉCRÉTÉ. Un palier coûte 10 tuiles
      // (2 berge + 3 lac + 2 berge + 3 marche), plus bank+6 d'amorce et bank de sortie : trois paliers
      // demandent 42 tuiles. Avec `steps = 3` en dur dans un module large de 20 à 30, l'escalier sortait
      // de sa portée jusqu'à 19 tuiles et écrasait le module suivant. La portée du catalogue est passée à
      // [40, 46] pour que le motif garde ses trois lacs ; la borne ci-dessous le protège quand même.
      const COUT_PALIER = 10
      const steps = Math.max(1, Math.min(3, Math.floor((w - 2 * bank - 6) / COUT_PALIER)))
      const peak = haut + 13 // rideau de montée : 13 rangées, la hauteur minimale d'une cascade remontable
      let x = 0
      p.platforms.push({ x, alt: haut, w: bank }); x += bank
      p.waters.push({ x, w: 3, kind: 'cascade', bankAlt: peak, bottomAlt: haut })
      p.platforms.push({ x, alt: haut, w: 3 }) // vasque au pied du rideau
      x += 3
      p.platforms.push({ x, alt: peak, w: 3 }) // corniche d'émergence en haut
      x += 3
      let alt = peak
      for (let i = 0; i < steps; i++) {
        const lakeW = 3
        // BERGES DES DEUX CÔTÉS : c'est ce qui manquait. Un lac dont un bord ne correspond à aucune surface
        // marchable est un « rebord désaxé », et le jeu le refuse — à raison, on ne saurait pas d'où y entrer.
        p.platforms.push({ x, alt, w: 2 })
        p.waters.push({ x: x + 2, w: lakeW, kind: basinKind, bankAlt: alt })
        if (basinKind !== 'lave' && i === steps - 1) p.props.push({ kind: 'coffre', x: x + 2 + Math.floor(lakeW / 2) })
        x += 2 + lakeW
        const bas = Math.max(1, alt - 3)
        p.platforms.push({ x, alt, w: 2 })        // berge droite du lac, à SON altitude
        p.platforms.push({ x: x + 2, alt: bas, w: 3 }) // marche inférieure
        x += 2 + 3
        alt = bas
      }
      // sortie NETTEMENT plus bas que l'entrée : c'est un motif de descente
      p.platforms.push({ x, alt, w: Math.max(bank, w - x) })
      placeBirds(peak + 2)
      p.exitAlt = alt
      break
    }
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
      const base = Math.max(ALT_PLANCHER, entryAlt)
      p.platforms.push({ x: 0, alt: base, w }) // sol plein continu (retombée sûre)
      const rise = SIMPLE_JUMP_ROWS // +3 par marche (saut franc)
      const stepW = 3
      const gap = 2 // écart horizontal (≤ portée à +3 rangées → franchissable, cf. canReach)
      const pitch = stepW + gap
      let x = bank
      let a = base
      let lastX = -1
      while (x + stepW <= w - bank && a - base < 2 * rise) {
        a += rise
        p.platforms.push({ x, alt: a, w: stepW })
        lastX = x
        x += pitch
      }
      // PALIER DE SORTIE : prolonge le dernier palier jusqu'au BORD DROIT à l'altitude de sortie. Sans
      // lui, le module suivant (raccordé au bord droit à exitAlt = a) est à un saut INFRANCHISSABLE du
      // dernier palier resté au milieu — autrefois masqué par le sol marchable, désormais muré par la
      // roche pleine (bug desert-9 : palier [26,27] → module suivant [39,27], même hauteur, 10 tuiles).
      if (lastX >= 0 && lastX + stepW < w) p.platforms.push({ x: lastX + stepW, alt: a, w: w - (lastX + stepW) })
      p.exitAlt = a
      break
    }

    // ─── ÉCHELLES SUCCESSIVES : échelle → court palier → 2ᵉ échelle (enchaînées, sans marche large) ──
    case 'echelles-successives': {
      const base = Math.max(ALT_PLANCHER, entryAlt)
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
  } else if (m.fillBelow === 'vide') {
    // ⚠️ ET LE SOL DU MONDE S'OUVRE, pas seulement les socles. Voir le commentaire de l'assembleur :
    // « fond de vide » ne voulait dire jusqu'ici que « ses corniches flottent », et le sol restait
    // plein dessous. « Je veux 0000000 sol en dessous pour me rattraper. »
    p.fondVide = true
  }

  // PANNEAU « descends ! » au-dessus des PUITS/BASSINS à COFFRE DE FOND (retour user) : une petite flèche
  // vers le bas au bord du puits donne envie d'y plonger chercher le trésor. On ne le pose que sur un
  // bassin MARINE contenant un coffre AU FOND (prop coffre SANS alt, x dans le bassin) et si aucun
  // panneau n'est déjà là (plongeoir). Purement décoratif (même canal que le plongeoir).
  for (const wat of p.waters) {
    if (wat.kind !== 'marine') continue
    const bottomChest = p.props.find((pr) => pr.kind === 'coffre' && pr.alt === undefined && pr.x >= wat.x && pr.x < wat.x + wat.w)
    // panneau si : coffre au fond (puits/bassin) OU grotte en U / boyau immergé (openSide) — dans les
    // deux cas on veut inviter à PLONGER. Placé à l'ENTRÉE de plongée : au coffre, sinon sur la berge
    // d'entrée (openSide 'left' → on entre par la droite ; sinon par la gauche).
    if (!bottomChest && !wat.openSide) continue
    const signX = bottomChest ? bottomChest.x : wat.openSide === 'left' ? wat.x + wat.w - 2 : wat.x + 2
    if (p.signs.some((s) => Math.abs(s.x - signX) <= 2)) continue
    p.signs.push({ x: signX, alt: wat.bankAlt + 2 })
  }
  return p
}

export interface AssembleOpts {
  id: string
  name: string
  biome: string
  seed?: string
  // Tier du biome — sert UNIQUEMENT à borner la profondeur des cuves (cf. profondeurCuveMax).
  // Absent → on retombe sur la borne la plus stricte, celle d'un joueur de niveau 1.
  tier?: Tier
}

// ─── PROFONDEUR MAXIMALE D'UNE CUVE NOYANTE, PAR TIER DE BIOME ──────────────────────────────
//
// Une cuve doit se plonger ET se remonter dans une seule apnée : deux fois la profondeur, à la
// vitesse de nage, dans la réserve de souffle du joueur à son niveau attendu (cf. core/breath et
// level-validator.maxDiveRows, qui est le juge). La réserve grandit avec le niveau, donc les lacs
// ont le droit de se creuser à mesure qu'on avance — c'est la progression voulue, et c'est aussi
// pour ça que ce n'est pas UNE constante : plafonner tout le jeu à la borne du niveau 1 rendrait
// les cuves de fin de jeu ridicules.
//
// ⚠️ CES CHIFFRES SONT DES BORNES DE SÉCURITÉ, PAS DES CIBLES. Ils sont volontairement SOUS ce que
// le souffle du tier permet : le tier est grossier (un biome tier 3 se croise du niveau 20 au
// niveau 40), donc on se cale sur son terrain le PLUS PRÉCOCE. `tests/data/lacs-apnee.test.ts`
// mesure terrain par terrain et tombe si l'un d'eux passe à travers.
const PROFONDEUR_CUVE: Record<Tier, number> = { 1: 8, 2: 9, 3: 13, 4: 15, 5: 16 }
export function profondeurCuveMax(tier?: Tier): number {
  return PROFONDEUR_CUVE[tier ?? 1]
}

// Profondeur sous laquelle un MOTIF ne creuse jamais de géométrie (marches de lit, boyau, cavité).
// C'est la borne du tier le plus strict : un motif qui descend plus bas empêche l'assembleur de
// combler sous la cuve — il faudrait murer ce que le motif vient de poser — et la cuve reste alors
// aussi profonde que le monde. Autrement dit : un motif creuse dans ce qu'un débutant peut plonger,
// et c'est l'assembleur qui offre la profondeur supplémentaire des biomes avancés.
export const PROFONDEUR_MOTIF = PROFONDEUR_CUVE[1]
// Rangées d'eau libre sous un plafond immergé : de quoi nager sans frotter la roche.
const TUNNEL_NAGE = 3

// ─── Assembleur : modules → LevelDef ────────────────────────────────────────────────────────
// Modules ayant posé de la géométrie HORS de la portée qui leur était allouée. Doit rester vide ;
// `tests/data/superpositions.test.ts` l'exige. Plafonnée pour ne pas gonfler pendant la recherche.
export const DEBORDEMENTS: { id: string; kind: string; w: number; x: number; pw: number }[] = []

export function buildLevelFromModules(modules: Module[], opts: AssembleOpts): LevelDef {
  const seed = hashSeed(opts.seed ?? opts.id)
  // 1) pièces en espace altitude, chaînées (entrée = altitude courante)
  const pieces: { piece: Piece; x0: number; w: number; kind: ModuleKind }[] = []
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
    // ⚠️ PAS DE PLAFOND D'ALTITUDE ICI, ET C'EST UNE ERREUR DE DIAGNOSTIC CORRIGÉE.
    // J'ai cru que l'obstacle aux terrains longs était la DÉRIVE VERTICALE : le catalogue est
    // structurellement montant (28 motifs « bas → haut » contre 4 qui redescendent), donc les terrains
    // devaient finir en tours. Un plafond a été écrit, réglé, testé — puis la mesure a tranché : les
    // terrains ACTUELS montent déjà jusqu'à 84 rangées et se valident très bien. La règle « ≤ 3 paliers
    // empilés » se compte PAR COLONNE, pas sur la hauteur totale : un terrain peut grimper autant qu'il
    // veut tant qu'il ne s'empile pas sur lui-même. Le plafond ne réglait donc rien et déstabilisait la
    // sélection de motifs (le compteur « le moins servi » est global : brider les uns rebat les autres).
    const piece = buildModule(m, rng, w, runningAlt)
    // départ / sortie
    if (m.spawnHere) {
      piece.start = { x: Math.floor(w / 2), alt: runningAlt }
      // le SOCLE PLEIN sous la bande de départ (mesa) est désormais posé par addPedestals (socle de
      // pierre générique sous toute surface pleine) → une seule bande plate visible au départ.
    }
    if (m.exitHere) piece.exit = { x: w - 3, alt: piece.exitAlt }
    // ⚠️ UN MODULE NE DOIT JAMAIS DÉBORDER DE SA PORTÉE, ET ON LE CONSIGNE ICI. C'était la cause des 298
    // débordements relevés le 3 août (jusqu'à 30 tuiles), donc des superpositions de plateformes : la
    // géométrie d'un module empiétait sur celle du suivant. On l'attrape à l'assemblage parce qu'un
    // débordement ne se voit AUTREMENT que par ses conséquences, très loin de sa cause — une plateforme
    // injoignable à l'autre bout du terrain, ou deux textures l'une sur l'autre.
    // On CONSIGNE, on ne lève pas : la recherche de graines construit des centaines de terrains et une
    // exception l'abattrait au lieu d'écarter une graine. C'est `tests/data/superpositions.test.ts` qui
    // exige que cette liste reste vide.
    if (DEBORDEMENTS.length < 200) {
      const horsPortee = (q: { x: number; w: number }) => q.x < 0 || q.x + q.w > w
      const fautif = piece.platforms.find(horsPortee) ?? piece.rocks.find(horsPortee)
      if (fautif) DEBORDEMENTS.push({ id: opts.id, kind: m.kind, w, x: fautif.x, pw: fautif.w })
    }
    pieces.push({ piece, x0: cursorX, w, kind: m.kind })
    cursorX += w
    // ⚠️ NE PAS BORNER L'ALTITUDE DE CHAÎNAGE ICI — ESSAYÉ, ET C'EST UN PIÈGE.
    // « Impose une hauteur minimale » est la bonne intuition contre les « deux sols empilés », mais pas
    // à cet endroit : `runningAlt = Math.max(2, piece.exitAlt)` fait DÉMARRER le module suivant deux
    // rangées au-dessus de la surface que le précédent a réellement laissée. Le raccord ment, la rampe
    // d'accroche part d'une altitude qui n'existe pas, et le motif devient injoignable — mesuré sur
    // `passage-immerge`, injoignable à TOUTES ses largeurs, en plus de soixante-dix tests de terrain.
    // La vraie correction est en aval : un motif a le droit de chaîner au ras du sol, il n'a pas le
    // droit d'y DESSINER un plancher (cf. le nettoyage des planchers en doublon, plus bas).
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
  const trampolines: NonNullable<LevelDef['trampolines']> = []
  const arches: NonNullable<LevelDef['arches']> = []
  const gaps: NonNullable<LevelDef['gaps']> = []
  const hazards: NonNullable<LevelDef['hazards']> = []
  const ladders: NonNullable<LevelDef['ladders']> = []
  const rockBands: NonNullable<LevelDef['rockBands']> = []
  const breakables: NonNullable<LevelDef['breakables']> = []
  const spawns: LevelDef['spawns'] = []
  const props: NonNullable<LevelDef['props']> = []
  const signs: NonNullable<LevelDef['signs']> = []
  let start: LevelDef['start']
  let exit: LevelDef['exit']

  // ⚠️ ON GARDE LES OBJETS, PAS LEURS INDEX. Ce tableau sert à REPRENDRE les trous ouverts par la règle
  // du « fond de vide » si le terrain se révèle piégeux. Une première version retenait des index dans
  // `gaps` — or ce tableau est ensuite mutilé par la déduplication des trous et par le creusement
  // final : les index désignaient autre chose au moment de s'en servir.
  const trousDeVide: { x: number; w: number }[] = []
  PORTEES[opts.id] = pieces.map((p) => ({ kind: p.kind, x0: p.x0, w: p.w }))
  for (const { piece, x0, kind, w: wModule } of pieces) {
    for (const pl of piece.platforms) platforms.push({ x: x0 + pl.x, y: row(pl.alt), w: pl.w, ...(pl.solid ? { solid: true } : {}) })
    for (const b of piece.bridges) bridges.push({ x: x0 + b.x, y: row(b.alt), w: b.w })
    for (const t of piece.trampolines) trampolines.push({ x: x0 + t.x, y: row(t.alt), ...(t.fixe ? { fixe: true } : {}) })
    for (const a of piece.arches) arches.push({ x: x0 + a.x, y: row(a.alt), w: a.w, h: a.h, fill: a.fill })
    for (const l of piece.ladders) ladders.push({ x: x0 + l.x, y: row(l.topAlt), h: l.h, ...(l.hung ? { hung: true } : {}) })
    for (const g of piece.gaps) gaps.push({ x: x0 + g.x, w: g.w })
    // dalles de roche (plafond de tunnel / socle) : y = rangée du HAUT de la dalle, h = épaisseur ;
    // `solid` = plafond à collision pleine (on ne saute pas à travers).
    for (const rk of piece.rocks) rockBands.push({ x: x0 + rk.x, y: row(rk.altTop), w: rk.w, h: rk.altTop - rk.altBot + 1, ...(rk.solid ? { solid: true } : {}) })
    // ─── UN MODULE À FOND DE VIDE N'A PAS DE SOL, ET ÇA N'AVAIT JAMAIS ÉTÉ VRAI ────────────────
    //
    // Demande du joueur, deux fois : « ça manque de zones où on peut tomber et mourir, genre les
    // passages d'échelles, les sauts de plateformes… je veux 0000000 sol en dessous pour me rattraper. »
    //
    // ⚠️ `fillBelow: 'vide'` NE RETIRAIT QUE LES SOCLES, IL N'OUVRAIT PAS LE SOL DU MONDE. C'est la
    // découverte, et elle explique pourquoi passer douze motifs à 'vide' n'avait presque rien changé :
    // le sol du monde est PLEIN par défaut, et un module ne fait un trou que là où il en pousse un
    // explicitement. « Fond de vide » ne voulait donc dire que « ses corniches flottent » — la moitié
    // du contrat, et pas celle qui tue.
    //
    // ⚠️ ON N'OUVRE QUE SOUS UNE ROUTE. Ouvrir toute la portée d'un bloc a été essayé : 20 % du sol du
    // jeu devenait un trou, mais SEIZE d'entre eux n'étaient franchissables par rien — ni par le bas
    // (plus de sol) ni par le haut (aucune plateforme au-dessus) — et sept surfaces devenaient des
    // culs-de-sac. Un trou qu'on ne peut pas passer n'est pas un risque, c'est un mur.
    // On retire donc le sol colonne par colonne, et seulement là où le motif a posé de quoi passer
    // au-dessus. Le joueur peut tomber partout où il y a un chemin à rater : c'est exactement la demande.
    if (piece.fondVide) {
      const berge = 2
      // ⚠️ TROIS CHOSES GARDENT LEUR SOL, ET CHACUNE A COÛTÉ UN TEST ROUGE.
      //   · un TRAMPOLINE a besoin d'une surface pour se poser — au-dessus d'un trou, il flotte ;
      //   · un PIED D'AQUEDUC descend jusqu'au sol, c'est la demande explicite du joueur (« les
      //     piliers/viaduc, fais des pieds qui vont jusqu'au sol ») : lui retirer son appui le fait
      //     planer, et le motif tout entier avec ;
      //   · et il faut une ROUTE AU-DESSUS, sinon le trou n'est pas un risque mais un mur.
      // ⚠️ ET ON NE TOUCHE PAS À UN TROU QUE LE MOTIF A DÉJÀ POSÉ. Recouvrir un trou existant par le
      // nôtre les fait fusionner à la déduplication ; si le repli reprend ensuite le nôtre, il emporte
      // aussi celui du motif — et l'aqueduc de plaine-1 se retrouvait « posé sur du sol plein », alors
      // qu'il avait creusé sous son propre tablier depuis toujours.
      const porteQuelqueChose = (x: number) =>
        trampolines.some((t) => t.x === x)
        || gaps.some((g) => x >= g.x && x < g.x + g.w)
      const surCouvert = (x: number) =>
        platforms.some((pl) => x >= pl.x && x < pl.x + pl.w) && !porteQuelqueChose(x)
      let debut: number | null = null
      const fermer = (fin: number) => {
        if (debut !== null && fin > debut) { const t = { x: debut, w: fin - debut }; trousDeVide.push(t); gaps.push(t) }
        debut = null
      }
      for (let x = x0 + berge; x < x0 + wModule - berge; x++) {
        if (surCouvert(x)) { if (debut === null) debut = x } else fermer(x)
      }
      fermer(x0 + wModule - berge)
    }
    for (const bk of piece.breakables) breakables.push({ x: x0 + bk.x, y: row(bk.altTop), w: bk.w, h: bk.altTop - bk.altBot + 1, ...(bk.coups ? { coups: bk.coups } : {}) })
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
        // ─── CUVE de fond plein (marine OU lave) ───────────────────────────────────────────────
        //
        // ⚠️ LE FOND NE DESCEND PLUS JUSQU'AU SOL DU MONDE, ET C'EST LA CORRECTION D'UN DÉFAUT QUI A
        // RENDU TRENTE LACS MORTELS. La règle d'origine — « le liquide descend jusqu'à recouvrir la
        // rangée groundRow » — servait à ce qu'aucune cuve ne VOLE, et à cette fin elle était juste.
        // Mais elle liait la PROFONDEUR d'un bassin à la HAUTEUR DU MONDE : écrite quand les terrains
        // faisaient 16 rangées, elle a produit des cuves de 30 à 50 rangées le jour où ils en ont fait
        // 45 à 70. Retour joueur : « les lacs sont trop profonds, y a 0 moyen que j'atteigne ça sans
        // mourir » — et le jeu pose un COFFRE au fond, donc la récompense était inatteignable.
        //
        // La cuve est donc BORNÉE par ce qu'une apnée permet (profondeurCuveMax, calé sur le tier du
        // biome), et on COMBLE EN ROCHE sous le nouveau fond : le lac ne vole pas, il repose sur un
        // socle. On ne comble que si l'espace est LIBRE — un boyau immergé ou une grotte sous la cuve
        // se ferait murer, ce qui casserait le motif. Dans ce cas on laisse la cuve telle quelle, et
        // c'est `tests/data/lacs-apnee.test.ts` qui le dira.
        const profMax = profondeurCuveMax(opts.tier)
        let bottomAlt = 0
        if (wtr.bankAlt + 1 > profMax) {
          const cible = Math.max(0, wtr.bankAlt - profMax + 1)
          // l'espace sous le fond visé est-il vierge ? (sinon on ne comble pas, donc on ne rogne pas)
          const chevauche = (x: number, w: number) => x < wtr.x + wtr.w && x + w > wtr.x
          const libre =
            !piece.platforms.some((pl) => chevauche(pl.x, pl.w) && pl.alt < cible)
            && !piece.rocks.some((rk) => chevauche(rk.x, rk.w) && rk.altBot < cible)
            && !piece.breakables.some((bk) => chevauche(bk.x, bk.w) && bk.altBot < cible)
            && !piece.ladders.some((la) => chevauche(la.x, 1) && la.topAlt - la.h < cible)
            && !piece.gaps.some((g) => chevauche(g.x, g.w))
            // une CASCADE qui retombe dans cette cuve ne descend pas sous sa surface (bottomAlt) :
            // elle n'occupe donc rien sous le fond visé et n'empêche pas de combler. Une cascade SANS
            // fond, elle, coule jusqu'au bas de la carte — et une autre cuve, on ne présume rien.
            && !piece.waters.some((o) => o !== wtr && chevauche(o.x, o.w)
              && (o.kind !== 'cascade' || o.bottomAlt === undefined || o.bottomAlt < cible))
            && !piece.bridges.some((b) => chevauche(b.x, b.w) && b.alt < cible)
          if (libre) bottomAlt = cible
        }
        const bottomRow = bottomAlt > 0 ? row(bottomAlt) : groundRow
        hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, bottomRow + 1 - top), water: wtr.kind === 'lave' ? 'lave' : 'basin', ...(wtr.openSide ? { openSide: wtr.openSide } : {}) })
        if (bottomAlt > 0) {
          // socle de roche sous la cuve, de l'altitude 0 (dans la bande de sol) au fond exclu
          rockBands.push({ x: x0 + wtr.x, y: bottomRow + 1, w: wtr.w, h: groundRow + 1 - bottomRow })
        }
      }
    }
    for (const s of piece.spawns) spawns.push({ monsterId: s.monsterId, x: x0 + s.x, ...(s.alt !== undefined ? { y: row(s.alt) } : {}) })
    for (const pr of piece.props) props.push({ kind: pr.kind, x: x0 + pr.x, ...(pr.alt !== undefined ? { y: row(pr.alt) } : {}) })
    for (const sg of piece.signs) signs.push({ x: x0 + sg.x, y: row(sg.alt) })
    if (piece.start) start = { x: x0 + piece.start.x, y: row(piece.start.alt) }
    if (piece.exit) exit = { x: x0 + piece.exit.x, y: row(piece.exit.alt) }
  }

  // TOUTE LA PIERRE EST SOLIDE (règle user : « y a pas de pierre décoratives ? » — on ne traverse
  // JAMAIS la pierre, ni en marchant, ni en tombant, ni les monstres). On force donc la collision sur
  // CHAQUE dalle de roche (fini les remplissages de mesa « décoratifs » traversables).
  for (const r of rockBands) r.solid = true

  // ─── AUCUNE GÉOMÉTRIE NE SE SUPERPOSE À UNE AUTRE ─────────────────────────────────────────
  // Retour du user : « y a des surfaces qui se superposent et quand c'est le cas on peut nager à travers
  // la pierre », puis sa consigne sur la manière de le traiter : « je préfère que ça soit un test qui fail
  // et on le fix, plutôt que du dirty fix. Tu me fix ça, tu me le scotch pas. »
  //
  // ⚠️ CE NETTOYAGE EST UN POST-TRAITEMENT D'ASSEMBLAGE, PAS UN FILTRE D'AFFICHAGE, et c'est toute la
  // différence. LevelScene refusait de POSER les doublons : à l'écran on ne voyait plus rien, mais la
  // géométrie restait fausse — d'où l'eau qui chevauchait la roche, que le rendu ne pouvait pas rattraper.
  // Ici on corrige le LevelDef lui-même, donc les validateurs, l'atteignabilité et la physique voient tous
  // la même vérité. Et comme le post-traitement s'applique APRÈS l'assemblage, les plans gravés restent
  // valables : aucune regravure nécessaire.
  //
  // On ne RETIRE que du redondant, jamais une surface unique : une plateforme noyée dans de la roche pleine
  // (la roche porte déjà la collision), une dalle contenue dans une autre, une plateforme dupliquée sur la
  // même rangée, une tuile cassable posée dans de la matière. Aucune de ces suppressions ne peut retirer un
  // appui au joueur.
  // ⚠️ TROIS PASSES, PAS UNE. Rogner une géométrie en déplace le bord, ce qui peut révéler un
  // chevauchement resté invisible tant que l'autre était plus large. Une seule passe laissait quatre cas
  // sur quarante-quatre ; on répète jusqu'à ce que le nettoyage n'ait plus rien à faire.
  // Largeur minimale d'une corniche pour qu'on puisse encore s'y recevoir au saut. En dessous, on renonce
  // à rogner : un chevauchement cosmétique vaut mieux qu'un appui amputé.
  const LARGEUR_UTILE = 3
  for (let passe = 0; passe < 3; passe++) {
    const chev = (a: { x: number; w: number }, b: { x: number; w: number }) =>
      Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const dansDalle = (p: { x: number; y: number; w: number }) =>
      rockBands.some((r) => r.x <= p.x && r.x + r.w >= p.x + p.w && r.y <= p.y && r.y + r.h > p.y)

    // 1) plateformes noyées dans une dalle : invisibles, et leur corps double celui de la dalle.
    // Chevauchement PARTIEL : on ne retire pas, on ROGNE au segment qui sort de la dalle — cette partie
    // est une vraie surface, la supprimer retirerait un appui.
    for (let i = platforms.length - 1; i >= 0; i--) {
      const p = platforms[i]!
      if (dansDalle(p)) { platforms.splice(i, 1); continue }
      for (const r of rockBands) {
        if (chev(p, r) <= 0 || r.y > p.y || r.y + r.h <= p.y) continue
        // ⚠️ ON NE ROGNE PAS EN DESSOUS DE LARGEUR_UTILE. Rogner sans garde-fou a cassé l'atteignabilité de
        // carriere-1 : une corniche réduite à une ou deux tuiles ne se reçoit plus au saut, et huit tests
        // sont tombés. Mieux vaut laisser un chevauchement cosmétique qu'amputer un appui.
        const reste = p.x < r.x ? r.x - p.x : (p.x + p.w > r.x + r.w ? p.x + p.w - (r.x + r.w) : 0)
        if (reste > 0 && reste < LARGEUR_UTILE) continue
        if (p.x < r.x) p.w = r.x - p.x
        else if (p.x + p.w > r.x + r.w) { const fin = p.x + p.w; p.x = r.x + r.w; p.w = fin - p.x }
        if (p.w <= 0) { platforms.splice(i, 1); break }
      }
    }

    // 2) plateformes dupliquées sur la MÊME rangée : on garde la plus large et on rogne l'autre
    for (let i = platforms.length - 1; i >= 0; i--) {
      const a = platforms[i]!
      for (let j = 0; j < platforms.length; j++) {
        if (i === j) continue
        const b = platforms[j]!
        if (a.y !== b.y || chev(a, b) <= 0) continue
        if (b.w > a.w || (b.w === a.w && j < i)) {
          // `a` est la moins large : on la rogne au segment qui dépasse, ou on la retire
          const reste = a.x < b.x ? b.x - a.x : (a.x + a.w > b.x + b.w ? a.x + a.w - (b.x + b.w) : 0)
          // ⚠️ PAS DE GARDE-FOU DE LARGEUR ICI, ET C'EST DÉMONTRABLE. Ailleurs, rogner une corniche peut
          // amputer un appui — d'où `LARGEUR_UTILE`. Mais ces deux-là sont sur la MÊME RANGÉE : ce qu'on
          // retire de la plus courte est, par construction, déjà couvert par la plus large, au même
          // niveau. Aucun appui ne disparaît, seulement une texture en double. Le garde-fou hérité
          // laissait passer les chevauchements dont le reste faisait moins de trois tuiles — des bavures
          // de couture entre une rampe d'accroche et le motif qu'elle raccorde, visibles à l'écran.
          if (a.x < b.x) a.w = b.x - a.x
          else if (a.x + a.w > b.x + b.w) { const fin = a.x + a.w; a.x = b.x + b.w; a.w = fin - a.x }
          else { platforms.splice(i, 1) }
          break
        }
      }
    }

    // 3) dalles de roche : celles contenues dans une autre disparaissent ; en chevauchement PARTIEL on
    // rogne la plus PETITE horizontalement (la masse reste, seul le doublon s'en va).
    for (let i = rockBands.length - 1; i >= 0; i--) {
      const a = rockBands[i]!
      if (rockBands.some((b, j) => j !== i && b.x <= a.x && b.x + b.w >= a.x + a.w
        && b.y <= a.y && b.y + b.h >= a.y + a.h)) { rockBands.splice(i, 1); continue }
      for (let j = 0; j < rockBands.length; j++) {
        if (i === j) continue
        const b = rockBands[j]!
        if (chev(a, b) <= 0 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) <= 0) continue
        // à surface ÉGALE, l'indice départage : sans ce tie-break les deux dalles se renvoient la balle
        // (« c'est à l'autre d'être rognée ») et le chevauchement survit à toutes les passes. Trois cas
        // restaient ainsi en début de terrain, là où le socle du module de départ touche celui du suivant.
        const aireA = a.w * a.h, aireB = b.w * b.h
        if (aireB < aireA || (aireB === aireA && j < i)) continue // c'est à l'autre d'être rognée
        if (a.x < b.x) a.w = b.x - a.x
        else if (a.x + a.w > b.x + b.w) { const fin = a.x + a.w; a.x = b.x + b.w; a.w = fin - a.x }
        // ⚠️ SI LA PORTÉE EST DÉJÀ CONTENUE, LE CHEVAUCHEMENT EST VERTICAL et rogner en x ne peut rien.
        // C'est le dernier cas resté après toutes les passes : une petite dalle logée dans la portée d'une
        // grande, mais débordant d'une rangée par le haut. On raccourcit alors sa HAUTEUR.
        else if (a.y < b.y) a.h = b.y - a.y
        else { const bas = a.y + a.h; a.y = b.y + b.h; a.h = bas - a.y }
        if (a.w <= 0 || a.h <= 0) { rockBands.splice(i, 1); break }
      }
    }

    // 4) pierre fragile : on rogne les rangées qui tombent dans de la matière déjà présente
    for (let i = breakables.length - 1; i >= 0; i--) {
      const b = breakables[i]!
      const occupee = (y: number) =>
        platforms.some((p) => chev(b, p) > 0 && p.y === y)
        || rockBands.some((r) => chev(b, r) > 0 && r.y <= y && r.y + r.h > y)
      let haut = b.y, bas = b.y + b.h - 1
      while (haut <= bas && occupee(haut)) haut++
      while (bas >= haut && occupee(bas)) bas--
      if (bas < haut) { breakables.splice(i, 1); continue }
      b.y = haut; b.h = bas - haut + 1
      // une rangée occupée AU MILIEU du mur reste possible : on tronque alors au segment du haut
      for (let y = haut; y <= bas; y++) if (occupee(y)) { b.h = y - haut; break }
      if (b.h <= 0) breakables.splice(i, 1)
    }
  }

  // CORNICHE DE PIERRE NUE (retour user : « je peux marcher sur la pierre même si j'ai la terre
  // au-dessus et c'est pas bien ») : là où le sommet d'une dalle affleure à nu sous une plateforme de
  // terre trop proche pour qu'on passe, on COMBLE l'air entre les deux — la pierre redevient le corps
  // sous la terre au lieu d'offrir un recoin de maçonnerie. Ne comble que l'impraticable, cf. roche.ts.
  rockBands.push(...comblements(rockBands, platforms))

  // ─── LE SOL SOUS UN ENCHAÎNEMENT DE SAUTS CONTOURNABLE EST RETIRÉ ────────────────────────────
  //
  // Demande du joueur : « les sauts qu'on peut éviter, tu dégages le sol en dessous ». Une suite de
  // plateformes suspendues avec du sol praticable dessous est du contenu que personne ne joue : on
  // passe dessous en marchant. On creuse donc, et sauter devient le chemin.
  //
  // ⚠️ QUATRE TENTATIVES ONT ÉCHOUÉ ICI, POUR QUATRE RAISONS DISTINCTES, ET TOUTES SONT ENCODÉES
  // CI-DESSOUS. Ce n'est pas un correctif prudent par tempérament, c'est la liste des factures payées :
  //
  //   1. creuser sous TOUTE la chaîne coupait le terrain en deux — le sol retiré était la route
  //      principale, les plateformes n'étaient que la variante haute. 53 tests rouges. On ne creuse
  //      donc que l'INTÉRIEUR, en laissant MARGE colonnes pleines de chaque côté : on garde les deux
  //      appuis d'entrée et de sortie, et le trou reste encadré ;
  //   2. le trou dépassait la portée d'un saut → `oversizedGaps` sait désormais qu'un gouffre couvert
  //      de bout en bout par une chaîne de plateformes n'est pas un gouffre. Les deux règles partagent
  //      la même borne (CHAINE_ECART = portée d'un saut à plat) : si l'une bouge, l'autre casse ;
  //   3. la chaîne avait une brèche → tolérance de chaînage resserrée à 3 tuiles (cf. le valideur) ;
  //   4. un coffre posé au sol se retrouvait au-dessus du vide → on ne creuse sous RIEN qui se pose
  //      « au sol » sans altitude (coffre, monstre, décor), ni sous un pied d'échelle, ni sous le
  //      départ ou la sortie.
  //
  // Le trou est creusé AVANT le comblement des poches closes, et c'est volontaire : une poche qu'on
  // vient d'ouvrir par le bas n'est plus close, donc on ne la rebouche pas juste après l'avoir percée.
  const MARGE_CHAINE = 2 // colonnes pleines conservées à chaque bout de la chaîne
  const intouchable = new Set<number>()
  for (const g of gaps) for (let x = g.x; x < g.x + g.w; x++) intouchable.add(x)
  for (const h of hazards) for (let x = h.x; x < h.x + h.w; x++) intouchable.add(x)
  for (const r of rockBands) {
    if (r.y > groundRow - 1 || r.y + r.h <= groundRow - 1) continue // ne touche pas la surface du sol
    for (let x = r.x; x < r.x + r.w; x++) intouchable.add(x)
  }
  for (const pr of props) if (pr.y === undefined) { intouchable.add(pr.x - 1); intouchable.add(pr.x); intouchable.add(pr.x + 1) }
  for (const sp of spawns) if (sp.y === undefined) { intouchable.add(sp.x - 1); intouchable.add(sp.x); intouchable.add(sp.x + 1) }
  for (const la of ladders) for (let d = -1; d <= 1; d++) intouchable.add(la.x + d)
  for (const pt of [start, exit]) if (pt) for (let d = -2; d <= 2; d++) intouchable.add(pt.x + d)
  // un trampoline REPOSE sur la surface qu'il touche : creuser dessous le laisse voler (desert-5 l'a
  // montré au premier essai). Sa largeur dépasse sa colonne, d'où la marge.
  for (const tr of trampolines) for (let d = -2; d <= 2; d++) intouchable.add(tr.x + d)

  const geo = () => ({
    id: opts.id, name: opts.name, biome: opts.biome, widthTiles: totalWidth, heightTiles,
    platforms, spawns: [], gaps, hazards, rockBands, bridges, ladders, trampolines,
    ...(start ? { start } : {}), ...(exit ? { exit } : {}),
  })
  // ⚠️ ON MESURE LES PIÈGES AVANT DE CREUSER, PAS SEULEMENT APRÈS. Certains terrains en ont déjà
  // (la sélection de graines les écartera) : exiger zéro après coup ferait porter au creusement la
  // faute d'un autre, et on renoncerait à creuser là où il n'y a rien à se reprocher.
  const piegesAvant = deadEndSurfaces(geo()).length
  const injoignablesAvant = unreachablePlatforms(geo()).length
  const creuses: number[] = [] // index, dans `gaps`, des trous posés par cette passe

  for (const chaine of chainesContournables(geo())) {
    const debut = chaine.x + MARGE_CHAINE
    const fin = chaine.x + chaine.w - MARGE_CHAINE // exclu
    let courant = -1
    const poser = (x: number) => {
      if (courant >= 0 && x - courant > 0) { creuses.push(gaps.length); gaps.push({ x: courant, w: x - courant }) }
      courant = -1
    }
    for (let x = debut; x < fin; x++) {
      if (intouchable.has(x)) { poser(x); continue }
      if (courant < 0) courant = x
    }
    poser(fin)
  }

  // ─── DEUX SURFACES À MOINS D'UN SAUT L'UNE DE L'AUTRE : ON ROGNE LE RECOUVREMENT ─────────────
  //
  // Retour du joueur : « j'en ai vu une qui revient et ça perturbe ». Deux corniches de terre à une ou
  // deux rangées d'écart qui se recouvrent, c'est un DOUBLE PLANCHER : on ne sait plus sur laquelle on
  // marche, on se cogne à celle du dessus, et la plus basse ne sert à rien puisqu'on ne tient pas
  // debout dessous. Mesuré : soixante paires sur les 58 terrains.
  //
  // ⚠️ ON ROGNE, ON NE REHAUSSE PAS. Rehausser la corniche du dessus a été tenté et rend la génération
  // INSOLUBLE (plus de dix-huit minutes de recherche sans une graine valide, contre cent secondes
  // d'habitude) : déplacer une surface casse toutes les liaisons calculées autour d'elle. Rogner ne
  // déplace rien — on retire la partie REDONDANTE de la plus COURTE des deux, celle qui a le plus de
  // chances d'être un accessoire et non la route. Et on garde le garde-fou des passes de nettoyage :
  // jamais de moignon sous LARGEUR_UTILE, sinon on ampute un appui au lieu de nettoyer un doublon.
  const rognages: { p: { x: number; w: number }; x: number; w: number }[] = []
  const ECART_DOUBLE_PLANCHER = 2 // rangées : au-delà, on passe dessous debout, ce n'est plus un doublon
  // ⚠️ ON NE ROGNE PAS SOUS CE QUI EST POSÉ DESSUS. Une corniche porte parfois un monstre, un coffre ou
  // un trampoline : la raccourcir laisse l'objet en l'air, et c'est ce que `monstersOffSurface` a
  // signalé au premier essai (jungle-1, montagne-2). Un doublon visuel vaut mieux qu'un ours qui vole.
  const ancrees = new Set<number>()
  // marge de ±1 : `monstersOffSurface` tolère qu'un mob déborde d'une tuile de sa corniche, donc la
  // corniche doit survivre une tuile au-delà de lui aussi.
  for (const sp of spawns) if (sp.y !== undefined) for (let d = -1; d <= 1; d++) ancrees.add(sp.x + d)
  for (const pr of props) if (pr.y !== undefined) for (let d = -1; d <= 1; d++) ancrees.add(pr.x + d)
  for (const tr of trampolines) for (let d = -2; d <= 2; d++) ancrees.add(tr.x + d)
  for (const la of ladders) { ancrees.add(la.x); ancrees.add(la.x + 1) }
  for (const pt of [start, exit]) if (pt) for (let d = -1; d <= 1; d++) ancrees.add(pt.x + d)
  const porteQuelqueChose = (x0: number, x1: number) => {
    for (let x = x0; x < x1; x++) if (ancrees.has(x)) return true
    return false
  }
  // Sous-ensemble des ancrages que RIEN ne sait replacer : coffres, trampolines, pieds d'échelle,
  // départ et sortie. Les monstres n'y sont pas — le filet de fin d'assemblage les repose au sol.
  const ancresDures = new Set<number>()
  for (const pr of props) if (pr.y !== undefined) for (let d = -1; d <= 1; d++) ancresDures.add(pr.x + d)
  for (const tr of trampolines) for (let d = -2; d <= 2; d++) ancresDures.add(tr.x + d)
  for (const la of ladders) { ancresDures.add(la.x); ancresDures.add(la.x + 1) }
  for (const pt of [start, exit]) if (pt) for (let d = -1; d <= 1; d++) ancresDures.add(pt.x + d)
  const ancreesDures = (x0: number, x1: number) => {
    for (let x = x0; x < x1; x++) if (ancresDures.has(x)) return true
    return false
  }
  for (let i = 0; i < platforms.length; i++) for (let j = 0; j < platforms.length; j++) {
    if (i === j) continue
    const a = platforms[i]!, b = platforms[j]!
    if (a.solid || b.solid) continue // la pierre pleine est un mur, pas une corniche : hors sujet
    const dy = Math.abs(a.y - b.y)
    if (dy === 0 || dy > ECART_DOUBLE_PLANCHER) continue
    if (a.w > b.w || (a.w === b.w && i < j)) continue // c'est à l'autre d'être rognée
    const chev = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    if (chev < 3) continue
    const reste = a.x < b.x ? b.x - a.x : (a.x + a.w > b.x + b.w ? a.x + a.w - (b.x + b.w) : 0)
    if (reste > 0 && reste < LARGEUR_UTILE) continue // le moignon ne se recevrait plus au saut
    // le segment qu'on s'apprête à retirer : de `a` moins ce qui reste du bon côté
    const perduX = reste === 0 ? a.x : (a.x < b.x ? b.x : a.x)
    const perduFin = reste === 0 ? a.x + a.w : (a.x < b.x ? a.x + a.w : b.x + b.w)
    if (porteQuelqueChose(perduX, perduFin)) continue
    rognages.push({ p: a, x: a.x, w: a.w })
    if (reste === 0) { a.w = 0; continue } // entièrement doublée : elle disparaît
    if (a.x < b.x) a.w = b.x - a.x
    else { const fin = a.x + a.w; a.x = b.x + b.w; a.w = fin - a.x }
  }
  // ─── UNE CORNICHE COLLÉE AU SOL DU MONDE N'EST PAS UN ÉTAGE, C'EST UN DOUBLON ────────────────
  //
  // Retour du joueur, capture à l'appui : « y a deux sols qui sont juste empilés, donc si je marche
  // sur le premier sans sauter je passe à travers le deuxième. On a dit pas deux sols trop proches en
  // hauteur pour éviter ce genre d'écueil. » Exact, et le cas échappait au nettoyage précédent parce
  // que celui-ci ne compare que les plateformes ENTRE ELLES : le sol du monde n'en est pas une.
  //
  // Un module dont le plancher tombe à l'altitude 1 pose une plateforme sur la rangée juste au-dessus
  // du sol : deux bandes d'herbe l'une sur l'autre, sans un pouce d'air entre les deux. Mesuré : 256
  // occurrences, réparties sur une trentaine de motifs — ce n'est pas un motif fautif, c'est une
  // conséquence mécanique de `alt = 1`. On retire donc la corniche : le sol du monde porte déjà la
  // marche et la collision, et rien de jouable ne change.
  //
  // ⚠️ SEULEMENT À UNE RANGÉE D'ÉCART. À deux, il reste un interstice — laid, mais c'est un relief, et
  // le supprimer déplacerait la surface marchable de deux rangées sous tout ce qui s'y accroche.
  // ─── UNE PLATEFORME POSÉE **SUR** LA RANGÉE DU SOL EST UN DOUBLON PUR ────────────────────────
  //
  // Retour du joueur, trois fois : « y a deux sols qui sont juste empilés ». Je cherchais des corniches
  // une rangée AU-DESSUS du sol ; le cas qu'il voyait était pire — une plateforme dessinée dans la
  // MÊME case que le sol du monde, deux textures superposées au pixel près. Aucun test ne pouvait le
  // voir : `superpositions` compare les plateformes entre elles et avec la roche, et le sol du monde
  // n'est ni l'un ni l'autre.
  //
  // Ça arrive dès qu'un motif pose son plancher à l'altitude 0 (`alt = entryAlt` avec une entrée au
  // sol). Un seul cas subsistait dans les plans gravés — sur `trampoline-plat`, dans Vallon, c'est-à-dire
  // exactement le terrain qu'il testait. On le retire ici plutôt que dans le motif : c'est vrai de TOUS
  // les motifs, présents et à venir, et le sol du monde porte déjà la marche et la collision.
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i]!
    if (p.solid || p.y < groundRow) continue
    let surSol = false
    for (let x = p.x; x < p.x + p.w && !surSol; x++) {
      if (gaps.some((g) => x >= g.x && x < g.x + g.w)) continue
      if (hazards.some((h) => h.kind === 'water' && x >= h.x && x < h.x + h.w)) continue
      surSol = true
    }
    if (surSol) platforms.splice(i, 1)
  }

  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i]!
    if (p.solid || p.y !== groundRow - 1) continue
    const solPorteur = (x: number) => !gaps.some((g) => x >= g.x && x < g.x + g.w)
      && !hazards.some((h) => h.kind === 'water' && x >= h.x && x < h.x + h.w)
      // ⚠️ ON NE REJETTE QUE LES MURS, PAS LES SOCLES. Une dalle qui couvre la rangée du sol est le CORPS
      // du terrain (socle de mesa, comblement) : elle ne gêne rien, la surface reste au même endroit.
      // Une dalle qui MONTE au-dessus, en revanche, est un mur : la corniche est peut-être le seul pont
      // par-dessus, et la retirer a muré une plateforme d'enfer-2. Le premier jet confondait les deux et
      // rejetait 196 corniches sur 256 pour rien.
      && !rockBands.some((r) => x >= r.x && x < r.x + r.w && r.y < groundRow - 1 && r.y + r.h > groundRow - 1)
    // ⚠️ TOUT OU RIEN, ET C'EST UN ARBITRAGE MESURÉ. Une corniche de module court souvent sur toute sa
    // portée, et une seule colonne interdite (un trou, une cuve, un coffre) suffit à l'épargner : 215
    // corniches sur 256 survivent ainsi. Le retrait SEGMENT PAR SEGMENT a été écrit puis abandonné — il
    // fragmente le plancher du module en morceaux disjoints, et vingt-neuf tests d'atteignabilité
    // tombent. Un plancher, ça se retire en entier ou pas du tout.
    //
    // Ce qui épargne une corniche :
    //   · une colonne où le sol du monde n'est pas foulable (trou, cuve) — sans lui, la corniche EST le
    //     chemin ;
    //   · un MUR de roche à moins d'une colonne : elle est peut-être le seul pont par-dessus (retirer
    //     sans ce garde a muré une plateforme d'enfer-2) ;
    //   · un coffre, un trampoline, un pied d'échelle, le départ ou la sortie. Les MONSTRES, eux,
    //     n'arrêtent rien : le filet de fin d'assemblage les repose au sol, pile une rangée dessous.
    // ⚠️ LE CONTRÔLE DÉBORDE D'UNE COLONNE DE CHAQUE CÔTÉ, ET Y RENONCER COÛTE HUIT TESTS. Resserré à
    // la seule portée de la corniche, le nettoyage devient trop gourmand : il retire des corniches qui
    // servaient de raccord au module voisin (atteignabilité stricte, superpositions, quatre plans
    // gravés). Une colonne de marge de chaque côté est le prix à payer pour ne retirer que du doublon
    // franc — c'est ce qui limite la passe à 41 corniches sur 256, et c'est assumé.
    let colle = true
    for (let x = p.x - 1; x <= p.x + p.w && colle; x++) if (!solPorteur(x)) colle = false
    if (!colle) continue
    if (ancreesDures(p.x, p.x + p.w)) continue
    rognages.push({ p, x: p.x, w: p.w })
    p.w = 0
  }
  for (let i = platforms.length - 1; i >= 0; i--) if (platforms[i]!.w <= 0) platforms.splice(i, 1)

  // ⚠️ ET ON REBOUCHE SI LE CREUSEMENT A FABRIQUÉ UN PIÈGE SANS RETOUR. C'est la première cause de
  // l'échec de 2026-08-03 (« le sol qu'on creuse EST la route principale ») : la chaîne de plateformes
  // n'est la route que si le modèle de mouvement sait la parcourir. Quand il ne sait pas — carriere-1,
  // quatorze surfaces devenues des culs-de-sac au premier essai — on retire les trous un par un, du
  // dernier au premier, jusqu'à retomber sur le compte d'origine. On perd un creusement, jamais un
  // terrain. Le coût est de DEUX parcours dans le cas normal, et il n'augmente que sur les terrains
  // qui régressent vraiment.
  // On défait D'ABORD les rognages (moins précieux : ils ne font que du ménage visuel), puis les trous.
  const regresse = () => deadEndSurfaces(geo()).length > piegesAvant
    || unreachablePlatforms(geo()).length > injoignablesAvant
  if ((creuses.length || rognages.length) && regresse()) {
    for (let i = rognages.length - 1; i >= 0 && regresse(); i--) {
      const r = rognages[i]!
      if (r.p.w <= 0 || !platforms.includes(r.p as typeof platforms[number])) platforms.push(r.p as typeof platforms[number])
      r.p.x = r.x; r.p.w = r.w
    }
    for (let i = creuses.length - 1; i >= 0 && regresse(); i--) gaps.splice(creuses[i]!, 1)
  }

  // ─── AUCUNE POCHE DE VIDE CLOSE : ON COMBLE EN PIERRE ────────────────────────────────────────
  //
  // Retour joueur, deux captures : « une poche d'air entourée par un carré d'herbe mais inaccessible »,
  // « un carré de terre vide et bizarre ». Une corniche court au-dessus du vide, les socles des modules
  // voisins murent ce vide à gauche et à droite, le sol le ferme en bas : il reste un rectangle de
  // décor de fond au milieu du terrain, où personne n'entrera jamais.
  //
  // ⚠️ ON COMBLE, ON NE CREUSE PAS, et c'est un arbitrage assumé. L'autre issue serait d'ouvrir la poche
  // par le bas (un vrai trou mortel). Mais un module ne sait pas si son voisin va le murer — c'est
  // justement pour ça que le défaut existe — et creuser un trou sous une corniche change la JOUABILITÉ
  // (« creuser sous toute la chaîne coupe le niveau en deux », 53 tests rouges le 3 août). Combler ne
  // change RIEN de jouable : on remplit un espace où le panda ne peut pas se rendre, et le rendu retrouve
  // ce que le jeu affirme partout ailleurs — sous une coiffe de biome, il y a de la pierre.
  //
  // Post-traitement d'assemblage, donc les plans gravés restent valables : c'est la géométrie produite
  // qu'on répare, pas le plan de modules. `tests/data/poches-closes.test.ts` en est le garde-fou.
  const geoPoches = {
    id: opts.id, name: opts.name, biome: opts.biome, widthTiles: totalWidth, heightTiles,
    platforms, spawns: [], gaps, rockBands, ladders, ...(breakables.length ? { breakables } : {}),
  }
  for (const poche of sealedVoids(geoPoches)) {
    const l = geoPoches
    // ⚠️ ON NE COMBLE JAMAIS UNE POCHE QUI CONTIENT UNE ÉCHELLE. Une échelle enfermée dans la pierre
    // est le défaut qu'on vient de corriger ailleurs (cf. laddersInRock) : la couler dans du roc le
    // rendrait invisible au lieu de le supprimer. On laisse la poche telle quelle, et le test tombe.
    if (ladders.some((l) => l.x >= poche.x && l.x < poche.x + poche.w
      && l.y < poche.y + poche.h && l.y + l.h > poche.y)) continue
    // ⚠️ NI UNE POCHE QUI REPOSE SUR UNE PLATEFORME. Le comblement la coulerait dans la pierre : à
    // l'écran, une bande d'herbe prise en sandwich au milieu d'un bloc de roche — « y a de la terre qui
    // se superpose à de la pierre, c'est nul » (25 cas, presque tous sur le palier de secours du
    // trampoline). Une plateforme est faite pour qu'on se pose dessus ; l'enterrer pour masquer un vide
    // échange un défaut contre un pire.
    if (l.platforms.some((p) => p.y === poche.y + poche.h
      && p.x < poche.x + poche.w && p.x + p.w > poche.x)) continue
    // ⚠️ SANS `solid`, ET C'EST DÉLIBÉRÉ. Le comblement remplit un espace où le panda ne peut pas se
    // rendre : la collision n'y change rien pour lui. En revanche, le déclarer SOLIDE le ferait entrer
    // dans les validateurs qui raisonnent sur les plafonds d'un CHEMIN — `caveCeilingClearance` a
    // aussitôt vu six « plafonds de grotte trop bas » sur plaine-6, là où il n'y a ni grotte ni chemin.
    for (const seg of poche.runs) rockBands.push({ x: seg.x, y: seg.y, w: seg.w, h: 1 })
  }

  // ANTI-ROCHE (règle user : AUCUN monstre DANS la pierre — « impossible ») : si le CORPS d'un spawn
  // (la rangée juste au-dessus de ses pieds) chevauche une dalle de roche, on le DÉCALE horizontalement
  // vers la colonne la PLUS PROCHE libre de roche. À défaut de place propre dans la fenêtre, on le RETIRE
  // (jamais de mob enfermé dans la pierre, quelle que soit la dalle). Filet en amont du déclustering.
  const bodyInRock = (x: number, feet: number) =>
    rockBands.some((r) => x >= r.x && x < r.x + r.w && feet - 1 >= r.y && feet - 1 < r.y + r.h)
  const cleanedSpawns: LevelDef['spawns'] = []
  for (const s of spawns) {
    const feet = s.y ?? groundRow
    if (!bodyInRock(s.x, feet)) { cleanedSpawns.push(s); continue }
    let nx: number | null = null
    for (let d = 1; d <= 10 && nx === null; d++) {
      for (const cand of [s.x - d, s.x + d]) {
        if (cand >= 1 && cand < totalWidth - 1 && !bodyInRock(cand, feet)) { nx = cand; break }
      }
    }
    if (nx !== null) cleanedSpawns.push({ ...s, x: nx })
  }
  spawns.length = 0
  spawns.push(...cleanedSpawns)

  // ─── AUCUN MONSTRE SUR UNE CORNICHE QUI N'EXISTE PLUS ────────────────────────────────────────
  //
  // Un spawn porteur d'une rangée annonce « je me tiens sur CETTE surface ». Or plusieurs passes
  // d'assemblage ROGNENT les plateformes après coup — le dédoublonnage, et depuis ce lot le nettoyage
  // des doubles planchers. Quand le segment rogné est celui qui portait le monstre, il se retrouve en
  // l'air : `monstersOffSurface` l'a signalé sur jungle-1 et montagne-2.
  //
  // ⚠️ MÊME TOLÉRANCE QUE LE VALIDATEUR (±1 tuile), sinon on déplacerait des monstres parfaitement
  // posés — un mob a le droit de déborder d'une tuile de sa corniche, c'est ce que le jeu affiche.
  // Même geste que l'anti-roche juste au-dessus : on décale vers la colonne valide la plus proche, et
  // on RETIRE à défaut. Un monstre en moins vaut mieux qu'un monstre qui flotte.
  const surSurface = (x: number, row: number) =>
    platforms.some((p) => x >= p.x - 1 && x <= p.x + p.w && p.y === row)
    || bridges.some((b) => x >= b.x - 1 && x <= b.x + b.w && b.y === row)
  const poses: LevelDef['spawns'] = []
  for (const s of spawns) {
    if (s.y === undefined || surSurface(s.x, s.y)) { poses.push(s); continue }
    let nx: number | null = null
    for (let d = 1; d <= 12 && nx === null; d++) {
      for (const cand of [s.x - d, s.x + d]) {
        if (cand >= 1 && cand < totalWidth - 1 && surSurface(cand, s.y) && !bodyInRock(cand, s.y)) { nx = cand; break }
      }
    }
    if (nx !== null) { poses.push({ ...s, x: nx }); continue }
    // ⚠️ ON REPOSE AU SOL PLUTÔT QUE DE SUPPRIMER, ET CE N'EST PAS DU CONFORT. Le niveau calibré d'une
    // espèce dérive du PREMIER biome où elle apparaît (cf. core/mob-level) : retirer le dernier faucon
    // d'un biome précoce le fait bondir de 12 à 23, et tout l'équilibrage suit. Un filet de sécurité
    // n'a pas le droit de changer la calibration du jeu — il replace, il ne dépeuple pas.
    const solLibre = (x: number) => x >= 1 && x < totalWidth - 1
      && !gaps.some((g) => x >= g.x && x < g.x + g.w)
      && !hazards.some((h) => h.kind === 'water' && x >= h.x && x < h.x + h.w)
      && !bodyInRock(x, groundRow)
    let sx: number | null = solLibre(s.x) ? s.x : null
    for (let d = 1; d <= 12 && sx === null; d++) {
      for (const cand of [s.x - d, s.x + d]) if (solLibre(cand)) { sx = cand; break }
    }
    if (sx !== null) { const { y: _ignore, ...auSol } = s; poses.push({ ...auSol, x: sx }); continue }
  }
  spawns.length = 0
  spawns.push(...poses)

  // ─── UN OISEAU NE SORT PAS DE TERRE ──────────────────────────────────────────────────────────
  //
  // Retour du joueur : « et les oiseaux partent souvent de sous le sol, for some reason ? »
  //
  // ⚠️ LA CONVENTION « SANS y = AU SOL » N'A JAMAIS ÉTÉ PENSÉE POUR CE QUI VOLE. Elle sert aux
  // terrestres et aux aquatiques : ne pas écrire de rangée, c'est laisser la scène les poser sur la
  // surface. Appliquée à un corbeau, elle le fait APPARAÎTRE DANS LE SOL, d'où il s'extrait en volant.
  //
  // Deux chemins y menaient, et ce sont deux gestes raisonnables pris isolément : des motifs rangent un
  // aérien dans leur liste « au sol » (il n'y reçoit pas d'altitude), et le filet de sécurité juste
  // au-dessus repose AU SOL un monstre dont la corniche a disparu — en lui retirant son `y`, sans se
  // demander s'il vole. Cent vingt spawns sur cent soixante-douze étaient dans ce cas.
  //
  // On corrige ICI plutôt que dans chaque motif : la règle « ce qui vole vole » ne dépend d'aucun
  // décor, et la disséminer, c'est se garantir qu'un motif futur l'oubliera.
  const ALTITUDE_VOL = 7 // rangées au-dessus de la surface : assez haut pour se lire comme du ciel
  for (const s of spawns) {
    if (!MONSTERS[s.monsterId]?.aerial) continue
    if (s.y !== undefined && s.y < groundRow - 1) continue
    // on part de la surface locale (une corniche compte) pour ne pas noyer l'oiseau dans un relief
    let surface = groundRow
    for (const p of platforms) if (s.x >= p.x && s.x < p.x + p.w) surface = Math.min(surface, p.y)
    s.y = Math.max(1, surface - ALTITUDE_VOL)
  }

  // ─── AUCUN DÉCOR, AUCUN COFFRE ENCHÂSSÉ DANS LA PIERRE ────────────────────────────────────────
  //
  // Retour du user sur Vallon : « y a un trésor qui est collé à de la pierre et c'est bizarre ».
  //
  // Un prop sans altitude signifie « pose-le au sol » — le générateur d'un motif dit « un coffre par
  // ici » sans connaître la géométrie assemblée, et c'est légitime. Mais la rangée du sol n'est pas
  // toujours libre : une dalle de roche (socle de mesa, seuil de grotte) peut l'occuper, et le coffre
  // se retrouvait dedans. Quatre coffres sur 132 étaient dans ce cas, dont celui de Vallon.
  //
  // ⚠️ ON DÉPLACE LE PROP DE CÔTÉ, ON NE LUI INVENTE PAS UNE ALTITUDE. Premier essai : remonter le prop
  // au-dessus de la pile de pierre. Ça marchait à l'écran et ça cassait tout le reste — « sans altitude »
  // est un CONTRAT que lisent aussi le rendu, le validateur d'atteignabilité des coffres et le test
  // d'invariants (un coffre est soit au sol, soit exactement une rangée au-dessus d'une plateforme).
  // Lui donner une altitude arbitraire faisait échouer la sélection de graine sur 81 tentatives, et le
  // terrain retombait sur une géométrie non validée. Glisser d'une colonne préserve tous les contrats.
  const solRock = (x: number) =>
    rockBands.some((r) => x >= r.x && x < r.x + r.w && groundRow - 1 >= r.y && groundRow - 1 < r.y + r.h)
  const trouEn = (x: number) => gaps.some((g) => x >= g.x && x < g.x + g.w)
  const malPose = (x: number) => solRock(x) || trouEn(x)
  for (const pr of props) {
    if (pr.y !== undefined || !malPose(pr.x)) continue
    for (let d = 1; d <= 14; d++) {
      if (pr.x - d >= 1 && !malPose(pr.x - d)) { pr.x -= d; break }
      if (pr.x + d < totalWidth - 1 && !malPose(pr.x + d)) { pr.x += d; break }
    }
  }

  // AU PLUS UN ÉLITE (mvp) par terrain (retour user : « un terrain avec deux élites c'est trop »).
  // On garde le PREMIER mob élite rencontré et on retire les élites suivants (ex. plaine tardive qui
  // sortait à la fois l'angeling du pool ET le poring doré du slot mvp).
  {
    let eliteSeen = false
    const noDoubleElite = spawns.filter((s) => {
      if (!MONSTERS[s.monsterId]?.mvp) return true
      if (eliteSeen) return false
      eliteSeen = true
      return true
    })
    spawns.length = 0
    spawns.push(...noDoubleElite)
  }

  // DÉCO AU SOL (herbe/champignon) POSÉE SUR LA VRAIE SURFACE (retour user : « des champignons DANS la
  // roche »). Le sol du terrain ONDULE (bosses de roche au-dessus de groundRow) : poser la déco à
  // groundRow l'enterrait dans la bosse. On la pose donc PILE sur le sommet de roche/plateforme de sa
  // colonne (surface marchable), jamais dedans. On saute les colonnes surplombées par un PLAFOND bas.
  const decoKind = opts.biome === 'foret' || opts.biome === 'jungle' ? 'champignon' : 'herbe'
  const rockTopAt = (x: number): number => { // rangée du DESSUS de la roche/plateforme la plus haute à x (sinon sol)
    let top = groundRow
    for (const rb of rockBands) if (x >= rb.x && x < rb.x + rb.w) top = Math.min(top, rb.y)
    for (const pl of platforms) if (x >= pl.x && x < pl.x + pl.w) top = Math.min(top, pl.y)
    return top
  }
  const coveredByRock = (x: number, surfTop: number): boolean => // une dalle juste AU-DESSUS de la surface ? (grotte/plafond → pas de déco)
    rockBands.some((rb) => x >= rb.x && x < rb.x + rb.w && rb.y < surfTop && rb.y + rb.h >= surfTop - 1)
  for (const f of [0.18, 0.45, 0.72]) {
    const x0 = Math.round(totalWidth * f)
    let placed = false
    for (let d = 0; d <= 20 && !placed; d++) {
      for (const x of d === 0 ? [x0] : [x0 - d, x0 + d]) {
        if (x < 1 || x >= totalWidth - 1) continue
        const surf = rockTopAt(x)
        if (!coveredByRock(x, surf)) { props.push({ kind: decoKind, x, y: surf }); placed = true; break }
      }
    }
  }

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

  // ── AUCUN MONSTRE POSÉ DANS UN DANGER (dernier filet, après tous les placements) ──────────────
  // Retour user : « l'angeling dans Bocage est positionné sur des flammes ». Le placeur ne vérifiait
  // QUE la distance au départ, jamais les dangers : le mob naissait dans le feu, y cuisait et mourait
  // seul — un élite censé être un événement devenait une farce. Le test
  // tests/data/spawns-on-hazards.test.ts a montré que le cas n'était PAS isolé (5 terrains).
  //
  // On DÉCALE au lieu de supprimer : retirer un spawn ferait baisser l'XP du terrain (et pourrait
  // faire tomber le test d'économie d'XP). Et on ne décale que vers une colonne encore PORTÉE par la
  // même surface, sinon on remplacerait un mob qui brûle par un mob qui flotte dans le vide.
  const dangers = hazards.filter((h) => h.kind === 'spikes' || (h.kind === 'water' && h.water === 'lave'))
  if (dangers.length) {
    const inDanger = (x: number, y?: number) => dangers.some((h) =>
      x >= h.x && x < h.x + h.w && (y === undefined || h.top === undefined || Math.abs(y - h.top) <= 1))
    const inGap = (x: number) => gaps.some((g) => x >= g.x && x < g.x + g.w)
    const carried = (x: number, y?: number) => y === undefined
      ? !inGap(x) // spawn au sol : porté partout sauf au-dessus d'un trou
      : platforms.some((pl) => pl.y === y && x >= pl.x && x < pl.x + pl.w)
    for (const sp of safeSpawns) {
      const m = MONSTERS[sp.monsterId]
      if (!m || m.aerial || m.aquatic) continue // volants et aquatiques ne posent pas les pieds là
      if (!inDanger(sp.x, sp.y)) continue
      let moved = false
      for (let d = 1; d <= 10 && !moved; d++) {
        for (const cand of [sp.x - d, sp.x + d]) {
          if (cand <= 0 || cand >= totalWidth - 1) continue
          if (inDanger(cand, sp.y) || !carried(cand, sp.y)) continue
          sp.x = cand
          moved = true
          break
        }
      }
      // aucune colonne saine à portée : mieux vaut pas de monstre qu'un monstre qui brûle sur place
      if (!moved) sp.monsterId = ''
    }
    for (let i = safeSpawns.length - 1; i >= 0; i--) if (!safeSpawns[i]!.monsterId) safeSpawns.splice(i, 1)
    safeSpawns.sort((a, b) => a.x - b.x)
  }

  // ── UN POISSON EST DANS L'EAU (dernier filet) ─────────────────────────────────────────────────
  // Retour joueur : « il se passe un truc bizarre dans Ravin, j'ai trois poissons sur du sol empilés ».
  // Mesuré : 182 mobs aquatiques posés HORS de toute cuve, dont requin + méduse + piranha sur la MÊME
  // tuile de berge à deux pas du bassin (desert-5 x176, bassin à x178).
  //
  // Deux causes se cumulaient. (1) Les motifs « plan d'eau » reçoivent la liste aquatique dans leur slot
  // `ground` (cf. `o.aquatic` dans planModules) : le placeur générique du motif les pose donc sur la
  // SURFACE marchable — la berge — au lieu du fond. (2) Les aquatiques sont volontairement EXCLUS du
  // déclustering (« bancs en cuve », sinon les plans d'eau se videraient), donc rien ne les sépare et ils
  // s'empilent au même x.
  // On les REPLACE dans la cuve la plus proche, RÉPARTIS sur sa largeur, et on retire ceux qui n'ont
  // aucune eau à portée : un requin sur le sable n'est pas une menace, c'est un bug qui se voit.
  // ⚠️ LES AMPHIBIES SONT ÉPARGNÉS. `aquatic` veut dire « ne se noie pas », pas « doit être immergé » :
  // le crabe de plage est aquatique ET c'est une sentinelle sur le sable. Seul `amphibie` fait la part.
  const nageur = (id: string) => !!MONSTERS[id]?.aquatic && !MONSTERS[id]?.amphibie
  const cuves = hazards.filter((h) => h.kind === 'water' && h.water !== 'lave' && h.w > 0)
  if (cuves.length) {
    // 1) chaque nageur rejoint la cuve la plus proche du point où le motif voulait le poser
    for (const sp of safeSpawns) {
      if (!nageur(sp.monsterId)) continue
      if (cuves.some((h) => sp.x >= h.x && sp.x < h.x + h.w)) continue
      let best = -1, bestD = Infinity
      cuves.forEach((h, i) => {
        const d = sp.x < h.x ? h.x - sp.x : sp.x - (h.x + h.w - 1)
        if (d < bestD) { bestD = d; best = i }
      })
      if (best < 0 || bestD > 24) { sp.monsterId = '' ; continue } // aucune eau à portée : on retire
      sp.x = cuves[best]!.x
    }
    for (let i = safeSpawns.length - 1; i >= 0; i--) if (!safeSpawns[i]!.monsterId) safeSpawns.splice(i, 1)
    // 2) RÉPARTITION DANS LA CUVE, sur TOUS ses nageurs et pas seulement ceux qu'on vient de déplacer :
    // les piles existaient AUSSI dans l'eau (trois espèces sur la même tuile), et le déclustering ne
    // passe volontairement pas par là. Un banc s'étale, il ne s'empile pas.
    cuves.forEach((h) => {
      const dedans = safeSpawns.filter((s) => nageur(s.monsterId) && s.x >= h.x && s.x < h.x + h.w)
      // Pas d'au moins 1 colonne, calé sur le BORD de la cuve : tant qu'elle a autant de colonnes que de
      // nageurs, chacun a la sienne. Une cuve plus étroite que son banc en empile fatalement quelques-uns
      // (le test le tolère explicitement dans ce seul cas).
      const pas = dedans.length && h.w >= dedans.length ? Math.floor(h.w / dedans.length) : 1
      dedans.forEach((s, k) => {
        s.x = h.x + Math.min(h.w - 1, pas * k)
        delete s.y // sans y = au FOND, immergé : c'est la convention des menaces d'eau
      })
    })
    safeSpawns.sort((a, b) => a.x - b.x)
  }

  // ─── PAS DEUX FOIS LE MÊME TROU ──────────────────────────────────────────────────────────────
  // Plusieurs passes posent des `gaps` (motifs, cascades au-dessus du vide, creusement sous les sauts
  // contournables) et rien ne les empêchait de se recouvrir. Une entrée entièrement contenue dans une
  // autre ne creuse rien de plus : elle ne fait qu'alourdir la donnée et fausser tout comptage de
  // trous. Mesuré : 1360 entrées pour 480 trous réels, dont 14 purement redondantes.
  for (let i = gaps.length - 1; i >= 0; i--) {
    const a = gaps[i]!
    if (gaps.some((b, j) => j !== i && b.x <= a.x && b.x + b.w >= a.x + a.w
      && (b.w > a.w || (b.w === a.w && j < i)))) gaps.splice(i, 1)
  }

  // ─── UN SOCLE SANS COIFFE N'A PLUS DE RAISON D'EXISTER ───────────────────────────────────────
  //
  // Retour du joueur, capture à l'appui : « encore de la pierre qui vole au-dessus du sol, ça continue
  // d'arriver ». Trois colonnes de roche nues, montant du sol jusqu'au ciel, sans un brin d'herbe
  // dessus. Son intuition était juste : « je pense que c'est dû au fait que la couche du bas tu la
  // comptes pas pareil. »
  //
  // La cause est en amont, dans mes propres passes : un socle est posé pour porter une plateforme, puis
  // cette plateforme est retirée (doublon avec le sol du monde, ou rognage de double plancher) — et le
  // socle survit à sa coiffe. Il ne porte plus rien, ne se marche pas, et se lit comme un mur planté au
  // milieu du décor.
  //
  // ⚠️ ON NE REGARDE QUE LES SOCLES, PAS TOUTE LA PIERRE. Une dalle qui ne touche pas le sol est autre
  // chose — plafond de grotte, coiffe d'échelle suspendue, paroi de cuve — et elle a le droit de n'avoir
  // rien au-dessus. Le critère est donc « elle descend jusqu'au sol ET rien ne la coiffe ».
  for (let i = rockBands.length - 1; i >= 0; i--) {
    const r = rockBands[i]!
    if (r.y + r.h - 1 < groundRow - 1) continue // ne touche pas le sol : ce n'est pas un socle
    const chevauche = (x: number, w: number) => x < r.x + r.w && x + w > r.x
    const coiffe = platforms.some((p) => p.y === r.y - 1 && chevauche(p.x, p.w))
      || rockBands.some((o) => o !== r && o.y + o.h === r.y && chevauche(o.x, o.w))
      || breakables.some((b) => b.y + b.h === r.y && chevauche(b.x, b.w))
      || hazards.some((h) => h.kind === 'water' && chevauche(h.x, h.w))
      || (ladders ?? []).some((l) => l.x >= r.x && l.x < r.x + r.w)
    if (!coiffe) rockBands.splice(i, 1)
  }

  // Un puits plus large que ça n'est plus un piège : c'est un couloir, et on le franchit d'un saut.
  const PUITS_LARGEUR_MAX = Math.floor(maxJumpGapPx() / TILE)

  // ─── UN PUITS ÉTROIT ENTRE DEUX SOCLES EST UN PIÈGE : ON LE COMBLE ───────────────────────────
  //
  // `escalier-pierre` pose ses marches de pierre ISOLÉES, avec un trou d'air entre chaque — c'est ce qui
  // empêche de se coincer, et le motif promet noir sur blanc « rater un saut = retomber au sol, jamais
  // de piège ». Mais chaque marche reçoit un SOCLE jusqu'au sol : le trou d'air devient un PUITS de deux
  // tuiles, muré de roche des deux côtés et fermé par le sol. On y tombe, et on ne remonte plus. Relevé
  // sur cave-1 : trois marches, deux puits de huit rangées. Cinquante-quatre des « murs » comptés sur
  // l'ensemble du jeu venaient de là.
  //
  // ⚠️ ON COMBLE EN ÉLARGISSANT LE SOCLE DU BAS, ON N'EMPILE PAS UNE BANDE NEUVE. Deux tentatives dans
  // l'autre sens ont échoué pour des raisons opposées, et les deux valent d'être retenues :
  //   — retirer le socle des marches : elles flottent, et les coffres qui s'y appuyaient partent en l'air ;
  //   — pousser une bande de remplissage : son sommet est nu, et c'est précisément ce que la passe des
  //     socles nus interdit — « de la pierre qui vole au-dessus du sol », le défaut d'à côté.
  // Élargir le socle du bas garde une seule bande, toujours coiffée par SA marche : le puits se comble
  // jusqu'à la surface de la marche basse, l'escalier reste lisible (contremarches de deux rangées,
  // franchissables), et plus rien ne se referme sur le joueur.
  {
    /** le socle (bande touchant le sol) le plus HAUT sur cette colonne, ou null si la colonne est libre */
    const socleEn = (x: number): { r: (typeof rockBands)[number]; i: number } | null => {
      let best: { r: (typeof rockBands)[number]; i: number } | null = null
      for (let i = 0; i < rockBands.length; i++) {
        const r = rockBands[i]!
        if (x < r.x || x >= r.x + r.w) continue
        if (r.y + r.h - 1 < groundRow - 1) continue // ne descend pas jusqu'au sol : ce n'est pas un socle
        if (best === null || r.y < best.r.y) best = { r, i }
      }
      return best
    }
    for (let x = 1; x < totalWidth - 1; x++) {
      if (socleEn(x)) continue
      let fin = x
      while (fin < totalWidth && !socleEn(fin)) fin++
      const largeur = fin - x
      x = fin - 1
      if (largeur > PUITS_LARGEUR_MAX) continue
      const bordG = socleEn(fin - largeur - 1)?.r, bordD = socleEn(fin)?.r
      if (!bordG || !bordD) continue
      // rien qui traverse le puits ne doit être enseveli : coffre posé au sol, échelle, eau, cassable
      const dansLePuits = (px: number) => px >= fin - largeur && px < fin
      if (props.some((pr) => dansLePuits(pr.x))) continue
      if ((ladders ?? []).some((l) => dansLePuits(l.x))) continue
      if (hazards.some((h) => h.x < fin && h.x + h.w > fin - largeur)) continue
      if (breakables.some((b) => b.x < fin && b.x + b.w > fin - largeur)) continue
      if (platforms.some((pl) => pl.x < fin && pl.x + pl.w > fin - largeur)) continue
      // on élargit la marche BASSE (le y le plus grand) jusqu'à toucher l'autre : une seule bande, coiffée
      const bord = bordG.y >= bordD.y ? bordG : bordD
      if (bord === bordG) bord.w = fin - bord.x
      else { bord.w += bord.x - (fin - largeur); bord.x = fin - largeur }
    }
  }

  // ─── UNE FALAISE SE FRANCHIT EN DEUX FOIS : ON LUI POSE UNE MARCHE ───────────────────────────
  //
  // « Colline : le terrain est infaisable dès le début, y a un giga mur trop haut pour être sauté. »
  // Les validateurs de graphe ne pouvaient pas le voir : ils demandent « cette plateforme est-elle
  // atteignable ? », jamais « puis-je avancer d'un pas ? ». Un terrain peut être intégralement
  // atteignable et rester injouable — il suffit d'une face de mesa de huit rangées en travers du
  // chemin. `marchesInfranchissables` la voit ; cette passe-ci la répare.
  //
  // Le remède est une MARCHE DE PIERRE flottante à mi-hauteur, deux tuiles de large, posée EN ARRIÈRE
  // de la face : on saute dessus depuis le sol bas, puis de là sur le sommet. Deux sauts au lieu d'un
  // impossible. On ne touche pas à la falaise elle-même — la retailler déferait les mesas, et le motif
  // qui les pose a ses raisons.
  //
  // ⚠️ ON REPOSE TOUT SI LA MOINDRE AUTRE PROMESSE RECULE. Une marche mal placée fabrique une plateforme
  // injoignable ou un cul-de-sac, et le remède serait pire que le mal : on mesure avant, on mesure
  // après, et au premier recul le terrain repart tel qu'il était. C'est le protocole déjà éprouvé au
  // creusement sous les chaînes contournables.
  {
    const sauteRangees = Math.floor(maxJumpTiles())
    const probe = () => ({ ...geo(), breakables })
    // ⚠️ LA BATTERIE DE REPLI COMPTE QUATRE PROMESSES, PAS DEUX. Les deux premières versions n'en
    // mesuraient que deux, et l'escalier cassait les autres sans qu'on le voie : ses marches empilaient
    // un QUATRIÈME palier sur des colonnes déjà chargées, et trois marches alignées au-dessus d'un sol
    // praticable se lisent comme une CHAÎNE CONTOURNABLE — la grimpette gratuite qu'on a passé la soirée
    // à supprimer. Un remède qui rouvre le défaut d'à côté n'est pas un remède.
    const mesure = () => ({
      pieges: deadEndSurfaces(probe()).length, orphelines: unreachablePlatforms(probe()).length,
      empiles: overStackedColumns(probe()).length, chaines: chainesContournables(probe()).length,
    })
    const avant = mesure()
    const posees: typeof platforms = []
    /** paliers déjà empilés sur cette colonne, sol du monde compris (cf. overStackedColumns) */
    const paliers = (x: number) => (gaps.some((g) => x >= g.x && x < g.x + g.w) ? 0 : 1)
      + platforms.filter((p) => x >= p.x && x < p.x + p.w).length
      + bridges.filter((b) => x >= b.x && x < b.x + b.w).length
    const occupe = (x: number, y: number) =>
      rockBands.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
      || breakables.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)
      || platforms.some((p) => x >= p.x && x < p.x + p.w && p.y === y)
      // ⚠️ UN DANGER SANS `top` EST POSÉ AU SOL, PAS AU PLAFOND. Le lire comme « rangée 0 » condamnait
      // toute la colonne depuis le ciel : 91 refus d'escalier sur 94 murs venaient de cette seule ligne,
      // et les cases prétendument occupées étaient de l'air pur.
      || hazards.some((h) => {
        const haut = h.top ?? groundRow - 1
        return x >= h.x && x < h.x + h.w && y >= haut && y < haut + (h.h ?? 1)
      })
      || (ladders ?? []).some((l) => l.x === x && y >= l.y && y < l.y + l.h)

    for (const mur of marchesInfranchissables(probe())) {
      // Un mur est, par définition du validateur, plus haut qu'un saut : une seule marche intermédiaire
      // ne suffit donc pas toujours. On pose un ESCALIER — autant de marches de pierre qu'il faut de
      // sauts, chacune à portée de la précédente, la plus haute collée à la face.
      //
      // ⚠️ UNE SEULE IMPLANTATION, ET C'EST MESURÉ. Balayer plusieurs reculs a été essayé : sur les
      // trente-six murs qui résistent, il posait UN escalier de plus et n'en débloquait AUCUN. Ce qui
      // reste n'est pas une affaire de calage — ce sont des faces de neuf à trente et une rangées en
      // terrain dense, où un escalier flottant n'a pas sa place. Leur remède est dans le motif qui les
      // engendre, pas ici, et une passe d'assemblage plus compliquée ne ferait que le masquer.
      const marches = Math.ceil(mur.hauteur / sauteRangees) - 1
      if (marches < 1) continue
      const candidates: typeof platforms = []
      let libre = true
      for (let k = 1; k <= marches && libre; k++) {
        const y = mur.de - sauteRangees * k
        if (y <= mur.a) break // on a rejoint le sommet : les marches restantes seraient en l'air
        const x = mur.x - 2 * (marches - k + 1)
        if (x < 1 || x + 2 > totalWidth) { libre = false; break }
        for (let dx = 0; dx < 2; dx++) {
          // la marche ET la rangée au-dessus doivent être libres (sinon on se cogne en montant),
          // et jamais un QUATRIÈME palier : la règle des trois étages vaut aussi pour nous
          if (occupe(x + dx, y) || occupe(x + dx, y - 1) || paliers(x + dx) >= 3) libre = false
        }
        // ⚠️ ET LA MARCHE NE DOIT PAS COIFFER UNE FENTE. Posée pile entre deux colonnes de roche, elle
        // referme le vide qui court dessous : une POCHE CLOSE, ce que le jeu s'interdit depuis qu'on en
        // a compté cent quarante-deux. Le comblement des poches tourne AVANT cette passe et ne peut donc
        // rien rattraper. Relevé sur enfer-3 après regravure — deux colonnes, trois rangées, invisibles.
        if (occupe(x - 1, y + 1) && occupe(x + 2, y + 1)) libre = false
        if (libre) candidates.push({ x, y, w: 2, solid: true })
      }
      if (!libre || !candidates.length) continue
      for (const m of candidates) { platforms.push(m); posees.push(m) }
    }

    if (posees.length) {
      const apres = mesure()
      if (apres.pieges > avant.pieges || apres.orphelines > avant.orphelines
        || apres.empiles > avant.empiles || apres.chaines > avant.chaines) {
        for (const m of posees) platforms.splice(platforms.indexOf(m), 1)
      }
    }
  }

  // ─── UNE PLATEFORME ENFERMÉE DANS LA ROCHE N'EXISTE PAS ──────────────────────────────────────
  //
  // `LevelScene` refuse déjà de la DESSINER (« une plateforme entièrement noyée dans une dalle de roche
  // est invisible et son corps est redondant »). Mais elle restait dans les données, et les validateurs
  // la voyaient : `strictReach` la comptait comme « plateforme murée » — un défaut bien réel dans ses
  // termes, sur une surface qui n'existe ni à l'écran ni sous les pieds.
  //
  // Le déclencheur a été l'allongement des tunnels immergés : une dalle de plafond qui passe de sept à
  // seize colonnes finit par recouvrir une corniche voisine. On pourrait rogner la dalle — mais c'est
  // la plateforme qui est de trop : personne ne peut s'y tenir, personne ne la voit. On l'efface, et le
  // rendu comme la mesure disent enfin la même chose.
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i]!
    const noyee = rockBands.some((r) => r.x <= p.x && r.x + r.w >= p.x + p.w && r.y <= p.y && r.y + r.h > p.y)
    if (noyee) platforms.splice(i, 1)
  }

  // ─── UNE PIERRE QUI NE TOUCHE RIEN NE TIENT À RIEN ───────────────────────────────────────────
  //
  // Retour du joueur, le troisième sur ce thème : « on a encore un problème graphique avec des pierres
  // qui volent (exemple le motif où y a une échelle qui descend et des pierres à cassser à droite pour
  // aller prendre un coffre, ça clairement ça vole) ».
  //
  // ⚠️ LA PASSE DES SOCLES NUS NE POUVAIT PAS LES VOIR, et c'est ce qui rendait le défaut increvable.
  // Elle traque la pierre qui MONTE DU SOL sans rien porter — un pilier. Ici c'est l'inverse : une
  // masse en L'AIR, sans appui dessous, sans coiffe dessus, et sans rien sur les côtés. Elle naît
  // souvent de cette passe-là : on supprime un mur de grotte devenu inutile, et le plafond qu'il tenait
  // latéralement reste suspendu. Corriger un défaut en fabriquait un autre, deux passes plus loin.
  //
  // Le critère est donc le CONTACT, sur les quatre côtés : une dalle collée à quoi que ce soit se lit
  // comme une avancée, un surplomb, un plafond de couloir. Une dalle qui ne touche rien ne se lit pas,
  // elle flotte. Quatre-vingt-dix-neuf relevées.
  //
  // ⚠️ ON BOUCLE JUSQU'À STABILITÉ : retirer une masse peut en isoler une autre qui s'appuyait dessus.
  // Une seule passe laisserait la deuxième couche, et le joueur reviendrait dire « ça continue ».
  {
    const pleinEn = (x: number, y: number): boolean =>
      y <= 0 // le TOIT du monde est plein, comme son sol : une dalle qui y pend est un plafond, pas une pierre en l'air
      || y >= groundRow
      || rockBands.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
      || breakables.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)
      || platforms.some((p) => x >= p.x && x < p.x + p.w && p.y === y)
    // ⚠️ UN PLAFOND IMMERGÉ NE FLOTTE PAS, IL EST SOUS L'EAU — et c'est toute la mécanique du « long U ».
    // Il pend au milieu d'une cuve, sans rien au-dessus ni en dessous que de l'eau : au critère du
    // contact il est parfaitement isolé. L'oublier ici SUPPRIMAIT les tunnels de plongée des trois
    // motifs de grotte noyée, sans qu'aucun autre test ne s'en aperçoive.
    const sousLEau = (r: { x: number; y: number; w: number; h: number }) =>
      hazards.some((h) => h.kind === 'water' && r.x < h.x + h.w && r.x + r.w > h.x
        && r.y + r.h > (h.top ?? 0) && r.y < (h.top ?? 0) + (h.h ?? 0))
    const toucheQuelqueChose = (r: { x: number; y: number; w: number; h: number }): boolean => {
      if (sousLEau(r)) return true
      for (let x = r.x; x < r.x + r.w; x++) if (pleinEn(x, r.y + r.h) || pleinEn(x, r.y - 1)) return true
      for (let y = r.y; y < r.y + r.h; y++) if (pleinEn(r.x - 1, y) || pleinEn(r.x + r.w, y)) return true
      return false
    }
    for (let tour = 0; tour < 4; tour++) {
      const avant = rockBands.length
      for (let i = rockBands.length - 1; i >= 0; i--) {
        if (!toucheQuelqueChose(rockBands[i]!)) rockBands.splice(i, 1)
      }
      if (rockBands.length === avant) break
    }
  }

  // ─── UN TRAMPOLINE COINCÉ SOUS UN PLATEAU NE SERT À RIEN ─────────────────────────────────────
  //
  // Retour du joueur : « il y a des trampolines qui sont mis juste en dessous d'un plateau, donc on peut
  // juste pas sauter dessus. Faut peut-être rajouter un test de hauteur minimale entre trampoline et
  // plateau juste au-dessus qui fait 2 sauts genre. »
  //
  // ⚠️ ET C'EST PIRE QU'INUTILE, C'EST TROMPEUR. Un trampoline annonce « d'ici, on monte » : le joueur
  // insiste, croit avoir raté son timing, et finit par croire que l'engin est cassé. Vingt-cinq cas
  // mesurés, tous à trois tuiles de dégagement — de quoi cogner, pas de quoi décoller.
  //
  // ⚠️ ON DÉCALE, ON NE SUPPRIME PAS. Aucun motif ne pose ses trampolines sous un plafond : ils
  // arrivent sous les corniches des modules VOISINS, ou sous les résidus laissés par les passes de
  // rognage. Le tapis est donc au bon endroit du point de vue de son motif, et le retirer amputerait un
  // chemin que `canReachByBounce` a peut-être déjà validé. On le fait glisser sur SA propre surface
  // porteuse, à la colonne dégagée la plus proche — et on ne le retire que si sa surface entière est
  // couverte, auquel cas il n'y avait rien à sauver.
  {
    const clair = Math.floor(CLAIR_TRAMPOLINE)
    const plafondSur = (x: number, sous: number): number | null => {
      let best: number | null = null
      const garde = (row: number) => { if (row < sous && (best === null || row > best)) best = row }
      for (const p of platforms) if (x >= p.x && x < p.x + p.w) garde(p.y)
      for (const b of bridges) if (x >= b.x && x < b.x + b.w) garde(b.y)
      for (const r of rockBands) if (x >= r.x && x < r.x + r.w) garde(r.y + r.h - 1)
      return best
    }
    const degage = (x: number, y: number) => { const c = plafondSur(x, y); return c === null || y - c >= clair }

    // ⚠️ DÉGAGÉ NE VEUT PAS DIRE UTILE, et le premier jet s'est arrêté à mi-chemin. Retour du joueur,
    // capture à l'appui : « le trampoline est mal placé ». Il l'était — sur foret-4, glissé à la
    // première colonne ayant du ciel au-dessus, c'est-à-dire face à RIEN. Un trampoline qui catapulte
    // vers le vide est aussi trompeur qu'un trampoline qui cogne : il annonce un ailleurs qui n'existe
    // pas. On préfère donc, à dégagement égal, une colonne d'où le rebond DESSERT une plateforme —
    // et une plateforme hors de portée d'un saut simple, sinon l'engin ne sert à rien qu'on ne sache
    // déjà faire.
    // ⚠️ « PLUS HAUT » N'EST PAS LE SEUL SERVICE RENDU. Le premier critère exigeait une plateforme
    // au-dessus du tapis — il déclarait donc inutiles les onze trampolines des motifs de TRAVERSÉE, dont
    // les deux berges sont à la MÊME altitude : leur service est horizontal, on survole six tuiles de
    // vide qu'un saut (trois) ne franchit pas. Ce qui compte est « le rebond y va, le saut n'y va pas »,
    // pas la direction.
    const dessertQuelqueChose = (x: number, y: number) => platforms.some((p) => {
      // ⚠️ `y + 1` ET PAS `y` : le tapis repose SUR une plateforme, sa rangée est donc une de moins que
      // celle de sa propre surface. Comparer à `y` excluait la berge d'en face d'une traversée à plat —
      // exactement les onze trampolines qu'on cherchait à valider.
      if (p.y > y + 1) return false // franchement sous le tapis : on y tombe, on n'y rebondit pas
      const ecart = Math.max(0, p.x > x ? p.x - x : x - (p.x + p.w - 1))
      return canReachByBounce(y, p, ecart) && !canReach(y, p, ecart)
    })

    // ⚠️ ET IL NE DOIT PAS ÊTRE COLLÉ À UN MUR. Troisième retour du joueur sur le même engin : « faut pas
    // trop les coller aux murs non plus. Horizontalement je veux au moins 2 fois la largeur du
    // trampoline d'écart au minimum. Là c'est pas stylé. » Ce n'est pas qu'une question de goût : on
    // ARRIVE sur un trampoline en courant et on en repart en montant — collé à une paroi, on s'y écrase
    // dans les deux sens.
    const murA = (x: number, y: number) => {
      for (let dy = 0; dy < 2; dy++) {
        const yy = y - dy
        if (rockBands.some((r) => x >= r.x && x < r.x + r.w && yy >= r.y && yy < r.y + r.h)) return true
        if (platforms.some((p) => p.solid && x >= p.x && x < p.x + p.w && p.y === yy)) return true
      }
      return false
    }
    const ecartMur = (x: number, y: number) => {
      let g = 0, d = 0
      while (g < ECART_MUR_TRAMPOLINE && x - 1 - g >= 0 && !murA(x - 1 - g, y)) g++
      while (d < ECART_MUR_TRAMPOLINE && x + 1 + d < totalWidth && !murA(x + 1 + d, y)) d++
      return Math.min(g, d)
    }

    // ⚠️ JAMAIS AU-DESSUS D'UN TROU, MÊME PORTÉ PAR UNE CORNICHE. Un tapis posé sur une plateforme qui
    // surplombe le vide se lit comme suspendu dans les airs — et le joueur qui le rate tombe au lieu de
    // rebondir. La règle existait déjà pour le sol ; elle vaut pour toute la colonne.
    const auDessusDunTrou = (x: number) => gaps.some((g) => x >= g.x && x < g.x + g.w)

    for (const t of trampolines) {
      // ⚠️ SI L'ENGIN EST DÉJÀ À SA PLACE, ON N'Y TOUCHE PAS. Le classement ci-dessous optimise l'écart
      // aux murs — et il a déplacé de deux colonnes le tapis de `trampoline-mur`, dont TOUTE la raison
      // d'être est d'être près du mur : le sommet est sorti de la portée du rebond, et le motif est
      // devenu infaisable à toutes les largeurs. Un motif qui sait ce qu'il fait passe avant une règle
      // d'esthétique générale.
      // ⚠️ UN TAPIS MARQUÉ `fixe` NE BOUGE PAS. Les motifs où le rebond est la SEULE solution placent
      // l'engin à une distance calculée du mur ou de la berge : le déplacer de deux colonnes suffit à
      // sortir l'arrivée de sa portée, et le motif devient infaisable à toutes les largeurs — ce qui
      // est arrivé, et ce qui a coûté trois tentatives avant qu'on comprenne que le coupable était
      // notre propre passe d'esthétique. Un motif qui sait ce qu'il fait passe avant une règle générale.
      if (t.fixe) continue
      if (degage(t.x, t.y) && dessertQuelqueChose(t.x, t.y) && !auDessusDunTrou(t.x)) continue
      // ⚠️ ON NE SE LIMITE PLUS À LA SEULE PLATEFORME PORTEUSE. Beaucoup de surfaces sont faites de
      // plusieurs plateformes bout à bout, ou d'un dessus de roche : chercher dans la seule dalle sous
      // le tapis interdisait des colonnes parfaitement valables deux tuiles plus loin, et laissait
      // dix-huit engins collés à un mur. Ce qui compte, c'est qu'il y ait UNE SURFACE à porter, d'où
      // qu'elle vienne — et qu'on puisse y aller sans traverser un trou.
      const porte = (x: number) => !auDessusDunTrou(x) && (
        platforms.some((p) => p.y === t.y + 1 && x >= p.x && x < p.x + p.w)
        || rockBands.some((r) => x >= r.x && x < r.x + r.w && r.y === t.y + 1)
        || t.y + 1 >= groundRow)
      let gMin = t.x, gMax = t.x
      while (gMin - 1 >= 1 && porte(gMin - 1)) gMin--
      while (gMax + 1 < totalWidth - 1 && porte(gMax + 1)) gMax++
      // ⚠️ ON NOTE, ON NE FILTRE PLUS. Trois exigences se contredisent souvent (du ciel au-dessus, une
      // corniche à desservir, de l'air de chaque côté) : les enchaîner en cascade de « si » donnait un
      // engin qui satisfaisait la première et ratait les deux autres. On classe donc TOUTES les colonnes
      // de la surface porteuse, et on prend la meilleure — un compromis mesuré vaut mieux qu'une
      // priorité arbitraire.
      const note = (x: number) => (auDessusDunTrou(x) ? -1000 : 0) + (degage(x, t.y) ? 100 : 0)
        + (dessertQuelqueChose(x, t.y) ? 50 : 0)
        + ecartMur(x, t.y) * 3
        - Math.abs(x - t.x) // à qualité égale, on bouge le moins possible
      let meilleur = t.x, meilleureNote = note(t.x)
      for (let x = gMin; x <= gMax; x++) {
        const n = note(x)
        if (n > meilleureNote) { meilleureNote = n; meilleur = x }
      }
      t.x = meilleur
    }

    // ce qui n'a PAS trouvé de ciel au-dessus après ce classement n'a plus rien à sauver : il cogne.
    for (let i = trampolines.length - 1; i >= 0; i--) {
      if (!degage(trampolines[i]!.x, trampolines[i]!.y)) trampolines.splice(i, 1)
    }
  }

  // ─── ET ON REPASSE UN COUP DE CREUSEMENT, PARCE QUE LES CHAÎNES NAISSENT APRÈS ───────────────
  //
  // ⚠️ LA PREMIÈRE PASSE DE CREUSEMENT NE VOIT PAS LES CHAÎNES QU'ELLE NE PEUT PAS ENCORE VOIR, et
  // c'est ce qui laissait vivre la dernière. Sur plage-2, elle a bien traité la chaîne du moment
  // (x367, creusée) — mais celle qui subsiste à l'arrivée est ailleurs (x343), fabriquée PLUS TARD par
  // les passes de rognage, de comblement et d'escaliers. Mesurer tôt et n'agir qu'une fois, sur une
  // géométrie qui continue de bouger derrière, revient à corriger un terrain qui n'existe plus.
  //
  // On repasse donc à la fin, quand plus rien ne bouge. Même prudence qu'au premier tour : on mesure
  // avant, on mesure après, et au moindre recul on rebouche ce qu'on vient d'ouvrir.
  {
    const sonde = () => ({ ...geo(), breakables })
    const avant = { pieges: deadEndSurfaces(sonde()).length, orphelines: unreachablePlatforms(sonde()).length }
    const ouverts: number[] = []
    for (const chaine of chainesContournables(sonde())) {
      const debut = chaine.x + MARGE_CHAINE
      const fin = chaine.x + chaine.w - MARGE_CHAINE
      for (let x = debut; x < fin; x++) {
        if (intouchable.has(x)) continue
        if (gaps.some((g) => x >= g.x && x < g.x + g.w)) continue
        ouverts.push(gaps.length)
        gaps.push({ x, w: 1 })
      }
    }
    if (ouverts.length) {
      const apres = { pieges: deadEndSurfaces(sonde()).length, orphelines: unreachablePlatforms(sonde()).length }
      if (apres.pieges > avant.pieges || apres.orphelines > avant.orphelines) {
        for (const i of ouverts.slice().reverse()) gaps.splice(i, 1)
      }
    }
  }

  // ─── UNE TERRE POSÉE SUR DU PLEIN EST SOLIDE, PAS TRAVERSABLE ────────────────────────────────
  //
  // Retour du joueur : « quand j'ai de la pierre et direct au-dessus du sol, je peux être sur la pierre
  // et du coup marcher à travers le sol. Ça c'est impoooossible. En gros je rentre par le côté et je
  // passe à travers la terre. Il faudrait que dans le cas où j'ai de la terre sur de la pierre, je
  // puisse pas passer à travers la terre. »
  //
  // Il a raison, et la règle est plus simple que le défaut : une plateforme de terre est TRAVERSABLE
  // PAR LE BAS (`landsFromAbove`) pour qu'on puisse sauter dedans depuis dessous. C'est tout son
  // intérêt quand elle FLOTTE. Mais quand elle coiffe une masse de pierre ou le sol du monde, il n'y a
  // rien dessous d'où sauter : la traversée ne sert plus à rien, et elle se retourne contre le joueur —
  // on entre par le côté et on se retrouve DANS le décor.
  //
  // ⚠️ ON LE MARQUE DANS LA DONNÉE, PAS AU RENDU. Le faire seulement dans LevelScene ferait diverger la
  // physique et les validateurs : le modèle croirait qu'on traverse là où le jeu bloque, et
  // l'atteignabilité deviendrait un mensonge.
  //
  // ⚠️ ET C'EST `ancree`, PAS `solid`. `solid` veut dire « marche de PIERRE » : il change la TEXTURE
  // autant que la collision. L'utiliser ici repeindrait 2534 plateformes de terre en roche — la moitié
  // du jeu. `ancree` ne touche qu'à la collision : la terre reste de la terre, elle cesse juste d'être
  // un rideau qu'on traverse.
  for (const p of platforms) {
    if (p.solid) continue
    let poseeSurDuPlein = true
    for (let x = p.x; x < p.x + p.w && poseeSurDuPlein; x++) {
      const sousElle = p.y + 1
      const surRoche = rockBands.some((r) => x >= r.x && x < r.x + r.w && sousElle >= r.y && sousElle < r.y + r.h)
      const surSol = sousElle >= groundRow && !gaps.some((g) => x >= g.x && x < g.x + g.w)
      const autrePlat = platforms.some((q) => q !== p && q.y === sousElle && x >= q.x && x < q.x + q.w)
      if (!surRoche && !surSol && !autrePlat) poseeSurDuPlein = false
    }
    // ⚠️ JAMAIS SOUS UNE ÉCHELLE QUI LA TRAVERSE. La collision pleine ne connaît pas `landsFromAbove` :
    // elle bloquerait le grimpeur au passage, et l'échelle ne desservirait plus rien. Une corniche
    // traversée reste donc one-way — on se pose dessus en retombant, on la franchit en grimpant.
    const traverseeParEchelle = ladders.some((l) => l.x >= p.x && l.x < p.x + p.w
      && p.y > l.y && p.y < l.y + l.h)
    if (poseeSurDuPlein && !traverseeParEchelle) p.ancree = true
  }

  // ─── FOND DE CUVE REMONTÉ : CE QUI SE POSE « AU SOL » SE POSE SUR LE FOND ────────────────────
  // La convention du jeu est « sans y = au sol du monde », et elle suffisait tant qu'une cuve
  // descendait jusque-là. Depuis la borne d'apnée, le fond d'un bassin est bien plus haut : un coffre
  // de plongée ou un banc de requins posés « au sol » se retrouveraient DANS le socle de pierre coulé
  // sous le lac. On les repose donc sur le fond réel — et seulement dans les cuves effectivement
  // rognées, pour ne rien changer partout ailleurs.
  //
  // ⚠️ ON NE TOUCHE PAS AUX SPAWNS, ET C'EST UNE CONVENTION QU'IL FAUT RESPECTER, PAS CONTOURNER.
  // « Un mob aquatique est IMMERGÉ, posé au fond, SANS rangée imposée » (tests/data/mobs-aquatiques) :
  // lui écrire un `y` le colle à une rangée et le fait juger comme un marcheur. C'est donc la LECTURE
  // du « sans y » qui doit connaître le fond des cuves — cf. `spawnFeetRow` (core/level-validator),
  // partagée par les validateurs et par la scène.
  for (const h of hazards) {
    if (h.kind !== 'water' || h.water === 'cascade' || h.top === undefined || h.h === undefined) continue
    const fond = h.top + h.h - 1
    if (fond >= groundRow) continue // cuve non rognée : la convention historique suffit
    for (const pr of props) if (pr.y === undefined && pr.x >= h.x && pr.x < h.x + h.w) pr.y = fond
  }

  // ⚠️ DERNIER MOT SUR LES CULS-DE-SAC, ET IL SE DIT ICI PARCE QUE C'EST LE SEUL ENDROIT SÛR.
  //
  // Ouvrir le sol sous les motifs de saut peut fabriquer des corniches sans issue. Le rebouchage ciblé
  // en règle la plupart, mais pas toutes — et surtout, PLUSIEURS PASSES TOURNENT ENCORE APRÈS LUI
  // (creusement final, terre ancrée, remontée des fonds de cuve). Mesurer en cours de route, c'est
  // juger un terrain qui va encore changer : c'est exactement ce qui laissait quatre culs-de-sac sur
  // enfer-4 alors qu'un repli existait et croyait avoir fait son travail.
  //
  // Ici, plus rien ne bouge. S'il reste un piège, on remet le sol que le « fond de vide » a retiré sur
  // CE terrain. Un terrain moins mortel vaut mieux qu'un terrain qui enferme : « enfermer vivant » est
  // le pire défaut que ce projet reconnaisse — une mort, on la recommence ; un enfermement, on quitte
  // le jeu. Et le compromis est mesuré : il ne coûte qu'un terrain, pas la règle.
  if (trousDeVide.length && deadEndSurfaces({ ...geo(), breakables }).length > 0) {
    for (const t of trousDeVide) {
      const i = gaps.indexOf(t)
      if (i >= 0) gaps.splice(i, 1)
    }
  }

  return {
    id: opts.id, name: opts.name, biome: opts.biome,
    widthTiles: totalWidth, heightTiles,
    start, exit,
    platforms, bridges,
    ...(trampolines.length ? { trampolines } : {}),
    ...(arches.length ? { arches } : {}), ...(breakables.length ? { breakables } : {}), gaps, hazards, ladders, rockBands, spawns: safeSpawns, props,
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
  // ⚠️ PAS DE `water: true` SUR CES DEUX-LÀ, ET C'EST DÉLIBÉRÉ. Ce drapeau retire un motif des pools
  // génériques pour le réserver au canal des « plans d'eau imposés » — un canal qui compte une douzaine
  // de places pour une trentaine de motifs, donc incapable d'accueillir quoi que ce soit de plus sans en
  // évincer un autre (essayé : le pas-japonais a disparu du jeu). Sans le drapeau, ils passent par
  // l'ordonnanceur général « le moins servi d'abord », qui dispose de ~800 créneaux et garantit la
  // couverture par arithmétique. Ils posent leur propre eau, ils n'ont pas besoin du canal dédié.
  'bassin-creuse': { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'marine', above: 'air', chest: true },
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
  // ⚠️ TIER RAMENÉ DE 5 À 4. À 5, ce motif n'était éligible que dans les biomes de plus haut palier, où les
  // slots de TENSION se comptent sur les doigts d'une main : il n'a jamais été généré, pas une seule fois sur
  // les 58 terrains. Un motif de précision n'a pas besoin d'être réservé à la toute fin du jeu pour être dur.
  'atterrissage-etroit': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [12, 18], below: 'sol', above: 'air' },
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
  // ─── PIERRE FRAGILE ───────────────────────────────────────────────────────────────────────
  // Entrée et sortie au MÊME niveau ('milieu' → 'milieu') pour les trois motifs de grotte : le
  // chemin traverse à plat et la cavité est creusée EN DESSOUS, donc le module ne déplace pas
  // l'altitude courante. `chest: true` : chacun cache un coffre derrière sa pierre.
  'grotte-scellee': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'roche', above: 'roche', chest: true },
  'sol-fragile': { tier: 3, family: 'tension', entry: 'milieu', exit: 'milieu', width: [16, 24], below: 'roche', above: 'air', chest: true },
  // ── MOTIFS INVERSÉS : `entry: 'haut'` / `exit: 'bas'`, l'inverse exact de leur original. Ces balises
  // sont l'information qui manquait au planificateur — il ne savait chaîner que du montant.
  'echelle-tranquille-inverse': { tier: 1, family: 'filler', entry: 'haut', exit: 'bas', width: [16, 22], below: 'sol', above: 'air', ladder: true },
  'echelle-zigzag-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [24, 32], below: 'vide', above: 'air', ladder: true },
  'echelles-decalees-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [24, 34], below: 'vide', above: 'air', ladder: true },
  'escalier-saut-inverse': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [20, 30], below: 'vide', above: 'air' },
  // (pas de `forcedOnly` : hérité de l'original, il ne serait JAMAIS tiré — donc absent du jeu,
  //  ce que `couverture-motifs` refuse. Un motif imposé doit être imposé QUELQUE PART.)
  'trampoline-corniche-inverse': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [20, 28], below: 'sol', above: 'air' },
  'cage-echelles-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [22, 30], below: 'sol', above: 'air', ladder: true },
  'echelle-vs-sauts-inverse': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [20, 28], below: 'sol', above: 'air', ladder: true },
  'echelle-exposee-inverse': { tier: 4, family: 'tension', entry: 'haut', exit: 'bas', width: [18, 26], below: 'sol', above: 'air', ladder: true },
  'escalier-pierre-inverse': { tier: 2, family: 'traverse', entry: 'haut', exit: 'bas', width: [22, 30], below: 'sol', above: 'air' },
  'echelle-trou-echelle-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [24, 30], below: 'vide', above: 'air', ladder: true },
  'echelles-successives-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [22, 30], below: 'vide', above: 'air', ladder: true },
  'tour-creuse-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [24, 34], below: 'sol', above: 'air', ladder: true },
  'passerelles-plein-inverse': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [20, 28], below: 'vide', above: 'air' },
  'echelles-lianes-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [22, 32], below: 'vide', above: 'air', ladder: true },
  'echelles-zigzag-inverse': { tier: 3, family: 'vertical', entry: 'haut', exit: 'bas', width: [18, 26], below: 'vide', above: 'air', ladder: true },
  'grotte-u-brisable': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [24, 32], below: 'roche', above: 'air', chest: true },
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
  'echelles-decalees': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 28], below: 'vide', above: 'air', ladder: true },
  // PASSERELLES FLOTTANTES sur SOL PLEIN (variante « full sol » du miroir)
  'passerelles-plein': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 22], below: 'vide', above: 'air' },
  // R168 — ÉCHELLE-DESCENTE PIÉGÉE (on descend, trou mortel, saut sur passerelle coiffée de roche)
  // ⚠️ PLACEMENT CHOISI. Distribué librement par l'ordonnanceur, ce motif atterrit sur des terrains où sa
  // passerelle ne sort pas (cave-1 : 0 pont alors que sa définition en exige un). Il dépend d'une altitude
  // d'entrée qu'on ne lui garantit qu'en le posant à la main.
  'echelle-descente-piegee': { forcedOnly: true, tier: 3, family: 'vertical', entry: 'bas', exit: 'milieu', width: [18, 26], below: 'sol', above: 'roche', ladder: true },
  // R168 — VARIANTES DE CASCADES
  'cascade-grotte': { tier: 3, family: 'risque', entry: 'bas', exit: 'milieu', width: [22, 32], below: 'marine', above: 'roche', chest: true, water: true },
  'cascade-trou': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 24], below: 'cascade', above: 'air', water: true },
  'cascade-large': { tier: 2, family: 'risque', entry: 'bas', exit: 'milieu', width: [20, 30], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-trouee': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'vide', above: 'air', water: true },
  'cascade-cul-de-sac': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [20, 30], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-w': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'vide', above: 'air', chest: true, water: true },
  'cascade-saut-ange': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'marine', above: 'air', chest: true, water: true },
  'cascade-large-pierre': { tier: 4, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 24], below: 'vide', above: 'air', chest: true, water: true },
  'echelles-lianes': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'vide', above: 'air', ladder: true, forcedOnly: true },
  'echelles-zigzag': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [12, 20], below: 'vide', above: 'air', ladder: true, forcedOnly: true },
  'lacs-cascade-montee': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [18, 30], below: 'marine', above: 'air', chest: true, water: true, forcedOnly: true },
  'lacs-cascade-descente': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [40, 46], below: 'marine', above: 'air', chest: true, water: true, forcedOnly: true },
  // R171 — LAC → CASCADE → PLATEAU (lac horizontal + cascade remontable vers un plateau haut)
  'lac-cascade-plateau': { tier: 2, family: 'risque', entry: 'bas', exit: 'haut', width: [22, 32], below: 'marine', above: 'air', chest: true, water: true },
  // R171 — ESCALIER À GRANDS PAS (marches espacées, saut franc) — motif VERTICAL/traversée sec
  'escalier-saut': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'vide', above: 'air' },
  // R171 — ÉCHELLES SUCCESSIVES (échelle puis échelle, court palier) — motif VERTICAL
  'echelles-successives': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'vide', above: 'air', ladder: true },

  // ─── TRAMPOLINES ──────────────────────────────────────────────────────────────────────────────
  // ⚠️ `forcedOnly` SUR LES CINQ, ET C'EST INDISPENSABLE. Sans ce marqueur, le planificateur les tire
  // dans ses pools génériques dès qu'ils existent : ils sont apparus d'un coup dans les 58 terrains, y
  // compris en grotte et en enfer, et trois validateurs sont tombés — atteignabilité stricte (les
  // plateformes hautes d'un trampoline sont injoignables pour qui ne sait pas ce qu'est un trampoline),
  // et jusqu'aux NIVEAUX DES MONSTRES, qui dérivent de la carte et se sont décalés parce que les oiseaux
  // changeaient de terrain. On les place donc explicitement, terrain par terrain (forcedKinds).
  // Cinq motifs demandés, du plus inoffensif au plus exigeant. Le premier existe pour APPRENDRE l'objet
  // sans rien risquer : découvrir un rebond ×3 au-dessus d'un vide serait une mort gratuite, et le
  // joueur n'aurait pas compris à quoi sert l'engin. Les quatre autres l'utilisent pour de bon.
  'trampoline-plat': { forcedOnly: true, tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [12, 18], below: 'sol', above: 'air' },
  'trampoline-corniche': { forcedOnly: true, tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 22], below: 'sol', above: 'air' },

  // ⚠️ LES DEUX SEULS OÙ LE REBOND EST OBLIGATOIRE, et c'est leur raison d'être. Les cinq ci-dessus ont
  // tous une issue de secours — mesuré : vingt-sept trampolines sur vingt-neuf se contournent. Ceux-ci
  // ne posent AUCUNE surface entre le départ et l'arrivée : c'est la fermeture, pas la taille, qui rend
  // un obstacle infranchissable autrement.
  // ⚠️ FOND DE VIDE, ET C'EST CE QUI A DÉBLOQUÉ LE MOTIF APRÈS CINQ TENTATIVES. En fond de SOL, la
  // plateforme d'approche reçoit un socle de pierre jusqu'au sol — et ce socle ENTERRE la rangée du sol
  // du monde sous tout le motif. Le validateur, qui part du sol pour explorer, n'avait donc plus de
  // point de départ, et déclarait le sommet injoignable quelles que soient la hauteur du mur et la
  // position du tapis. Le défaut n'était ni dans la difficulté ni dans la portée du rebond : il était
  // dans ce qu'on avait coulé SOUS le motif sans le vouloir.
  'trampoline-mur': { forcedOnly: true, tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [20, 28], below: 'vide', above: 'air' },
  'trampoline-saut-vide': { forcedOnly: true, tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [22, 30], below: 'sol', above: 'air' },
  'trampoline-saut-eau': { forcedOnly: true, tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [22, 30], below: 'sol', above: 'air', water: true },
  'trampoline-saut-flammes': { forcedOnly: true, tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [22, 30], below: 'sol', above: 'air' },
  'trampoline-fosse-ardente': { forcedOnly: true, tier: 5, family: 'tension', entry: 'milieu', exit: 'milieu', width: [24, 32], below: 'sol', above: 'air' },
  'trampoline-mur-trou': { forcedOnly: true, tier: 4, family: 'vertical', entry: 'bas', exit: 'haut', width: [22, 30], below: 'vide', above: 'air' },

  // ─── MOTIFS EAU / GROTTE DEMANDÉS ─────────────────────────────────────────────────────────────
  // ⚠️ CES QUATRE-LÀ SONT DES MOTIFS D'EAU (`water: true`), et c'est ce qui les rend posables SANS RISQUE.
  // Les motifs d'eau ne sont PAS tirés dans les pools génériques : ils sont imposés séparément, par la
  // rotation WATER_ROT de data/levels. Les ajouter n'évince donc aucun motif central — contrairement aux
  // trampolines, dont le placement forcé avait fait disparaître des familles entières du jeu.
  'cascade-plus-haute': { tier: 2, family: 'risque', entry: 'bas', exit: 'haut', width: [18, 28], below: 'cascade', above: 'air', chest: true, water: true },
  'cascade-deux-passages': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [20, 30], below: 'cascade', above: 'air', chest: true, water: true },
  'cascade-deux-passages-g': { tier: 3, family: 'risque', entry: 'bas', exit: 'bas', width: [20, 30], below: 'cascade', above: 'air', chest: true, water: true },
  'boyau-tresor-retour': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [18, 28], below: 'marine', above: 'air', chest: true, water: true },
  // Les colonnes, elles, sont un motif de TENSION : réservées au placement explicite, comme les trampolines.
  'colonnes-perilleuses': { forcedOnly: true, tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [22, 34], below: 'vide', above: 'air' },
  'aqueduc': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'vide', above: 'air' },
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
  return buildLevelFromModules(planModules(o), {
    id: o.id, name: o.name, biome: o.biome, seed: o.seed,
  })
}

// Sélection DÉTERMINISTE de la liste de modules d'un niveau (sans expansion géométrique). Extrait de
// composeLevel pour être INTROSPECTABLE (rapport de diversité des motifs, cf. LEVEL_MODULE_KINDS) —
// composeLevel = planModules + buildLevelFromModules. Aucune logique de choix modifiée.
// ─── ÉQUILIBRAGE GLOBAL DE L'USAGE DES MOTIFS ───────────────────────────────────────────────────
//
// Demande du user, sans ambiguïté : « je veux que TOUT apparaisse, et plusieurs fois ! Un module créé pour
// n'apparaître qu'une fois… useless !!! »
//
// ⚠️ ON REMPLACE LE TIRAGE AU SORT PAR « LE MOINS SERVI D'ABORD ». C'est la correction de fond, et elle rend
// obsolète tout l'échafaudage d'épinglage manuel. Avec un tirage, la couverture était une loterie : mesuré
// sur les 58 terrains, 7 motifs sur 82 n'apparaissaient NULLE PART et 15 une seule fois. Épingler un motif
// à un terrain réglait un cas et en cassait un autre ailleurs — j'ai fait ce jeu de bascule trois fois.
//
// Ici, à chaque slot central, on prend le motif ÉLIGIBLE le moins servi jusqu'ici, TOUS TERRAINS CONFONDUS.
// La couverture devient une conséquence arithmétique : avec ~800 slots pour 82 motifs, chacun sort une
// dizaine de fois et aucun ne peut être oublié.
//
// DÉTERMINISME : les terrains sont construits dans un ordre fixe au chargement du module, donc le compteur
// évolue toujours de la même façon — deux joueurs voient les mêmes terrains. La graine sert encore à
// départager les égalités, sinon le même motif ouvrirait systématiquement chaque terrain.
const USAGE_GLOBAL: Partial<Record<ModuleKind, number>> = {}

/** Motif le MOINS servi du pool ; égalités départagées par la graine (pas de biais alphabétique). */
function moinsServi(cands: ModuleKind[], graine: number): ModuleKind {
  let best = cands[0]!
  let bestN = USAGE_GLOBAL[best] ?? 0
  for (let i = 1; i < cands.length; i++) {
    const k = cands[i]!
    const n = USAGE_GLOBAL[k] ?? 0
    if (n < bestN || (n === bestN && (graine + i) % cands.length === 0)) { best = k; bestN = n }
  }
  return best
}

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
  // ⚠️ LES RÔLES STRUCTURELS NE COMPTENT PAS DANS LE PLAFOND DE RÉPÉTITION, et c'est un arbitrage.
  // Les y inclure semblait plus juste (un motif ne devrait pas sortir quatre fois dans un terrain) —
  // essayé, et ça a rendu cimetiere-1 impossible à valider : ses rôles de départ et de montée n'avaient
  // plus de candidat libre et retombaient sur un motif qui ne chaîne pas. Le plafond de variété se règle
  // donc côté TEST, où il tient compte de la longueur : quatre occurrences sur vingt modules, c'est la
  // même densité que deux sur dix.
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
  // ⚠️ DEUX MONSTRES PAR MODULE, PAS UN. Demande du user après le doublement des terrains : « tu peux
  // rajouter des mobs aussi, hein, si tu as doublé la taille ». Un module en portait un seul, quelle que
  // soit sa largeur : sur des terrains deux fois plus longs, on traversait de longues portions sans
  // rencontrer personne, et la récompense d'un terrain (XP, butin) ne suivait plus sa durée.
  // Le second est tiré de la même file (rotation des espèces du biome) → aucune espèce nouvelle, juste
  // une densité qui correspond à la longueur. Les modules d'EAU gardent leur peuplement propre, et le
  // déclustering (une rencontre par fenêtre de 10 tuiles) empêche toujours les grappes.
  const nextGround = (): string[] => {
    const un = groundQ.length ? groundQ.shift()! : (o.ground.length ? o.ground[0]! : null)
    if (un === null) return []
    const deux = groundQ.length ? groundQ.shift()! : (o.ground.length ? o.ground[0]! : null)
    return deux === null ? [un] : [un, deux]
  }
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
    const pool = fresh.length ? fresh : notLast.length ? notLast : cands
    let kind = moinsServi(pool, hashSeed((o.seed ?? o.id) + ':' + idx))
    if (CATALOG[kind].chest && chests >= 3) {
      // budget de coffres atteint : on cherche un motif SANS coffre — d'abord dans le pool du bucket,
      // sinon en REPLI CROISÉ sur traversée/filler (à bas tier, le bucket 'risque' n'a que detour-balcon,
      // à coffre → sans repli on dépassait 3 coffres sur les niveaux longs). Cap DUR à 3 coffres.
      let noChest = cands.filter((k) => !CATALOG[k].chest)
      if (!noChest.length) noChest = kindsOf('traverse').filter((k) => !CATALOG[k].chest && k !== lastKind)
      if (!noChest.length) noChest = kindsOf('filler').filter((k) => !CATALOG[k].chest)
      if (noChest.length) kind = moinsServi(noChest, hashSeed((o.seed ?? o.id) + ':nc' + idx))
    }
    if (CATALOG[kind].chest) chests++
    usage[kind] = (usage[kind] ?? 0) + 1
    USAGE_GLOBAL[kind] = (USAGE_GLOBAL[kind] ?? 0) + 1
    const spec = CATALOG[kind]
    const mvpHere = o.mvp && bucket === 'risque' && idx >= order.length - 2 && !modules.some((m) => m.ground?.includes(o.mvp!))
    // ⚠️ PAS DE MONSTRE TERRESTRE SUR UN MODULE DONT LE SOL EST UNE CUVE. L'assembleur répartit les mobs
    // au sol sur la portée du module ; au-dessus d'un bassin, il n'y a pas de surface où les poser et le
    // validateur les signale « aucune-surface » (constaté sur cave-1 en ajoutant bassin-creuse). Les
    // motifs du canal « plan d'eau imposé » recevaient déjà `o.aquatic` pour cette raison ; la règle
    // vaut pour tout module à fond marine, d'où qu'il vienne.
    // ⚠️ LA RÈGLE VISE LES DEUX NOUVEAUX MOTIFS, PAS TOUS LES FONDS MARINE. Élargie à `below === 'marine'`,
    // elle a privé de monstres des modules qui, eux, ont bien une surface au-dessus de leur cuve (cave-1
    // s'est mis à sortir sans graine valide). Ces deux-ci noient toute leur portée : il n'y a nulle part
    // où poser un mob terrestre, et le validateur le signale « aucune-surface ».
    const surCuve = kind === 'bassin-creuse'
    modules.push(mk(kind, {
      ground: surCuve ? (o.aquatic ?? []) : [...(mvpHere ? [o.mvp!] : []), ...nextGround()],
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
