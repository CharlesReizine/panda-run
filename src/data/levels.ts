export type Biome = string // clé du registre BIOMES

export interface LevelDef {
  id: string
  name: string
  biome: Biome
  widthTiles: number
  // Hauteur du monde en tuiles. Défaut 16 (comportement historique : sol rangée 14, un écran de
  // haut). Un niveau HAUT (ex. 40-52) fait scroller la caméra en vertical ; le sol reste au bas
  // (groundRow = heightTiles - 2). Tous les y (plateformes, échelles, eau…) sont comptés DEPUIS LE
  // HAUT, donc les rangées basses (proches du sol) ont un y proche de groundRow.
  heightTiles?: number
  // Point de DÉPART du joueur (tuiles ; y = rangée de la corniche sur laquelle il se pose). Absent →
  // sol, bord gauche (comportement historique). Placé en MILIEU de hauteur, il ouvre de vraies routes
  // vers le HAUT et vers le BAS depuis le départ (on n'est plus scotché à l'altitude 0).
  start?: { x: number; y: number }
  // SORTIE de fin de niveau (tuiles ; y = rangée de la corniche sous la porte). Absent → sol, bord
  // droit. Placée à une altitude NETTEMENT différente du départ (plus haut ou plus bas).
  exit?: { x: number; y: number }
  // en tuiles ; y depuis le haut. `solid` (défaut absent = false) : marche/plateforme de PIERRE
  // RIGIDE — collision PLEINE (on ne la traverse pas, ni par le bas ni par les côtés). Absent →
  // plateforme de TERRE one-way (traversable par le bas, cf. landsFromAbove). Les marches solides
  // sont posées ISOLÉES (trou d'air entre chaque) pour ne jamais coincer le panda.
  platforms: { x: number; y: number; w: number; solid?: boolean }[]
  // x en tuiles ; y (tuiles) OPTIONNEL = rangée de la corniche sur laquelle le monstre apparaît POSÉ
  // (pas en l'air, pas dans le sol). Absent → au sol. Sert à peupler la VERTICALE (monstres en hauteur).
  spawns: { monsterId: string; x: number; y?: number }[]
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  // PANNEAUX décoratifs (plongeoir « saut de la foi ») : poteau + flèche vers le bas, dessinés en
  // primitives par LevelScene. Aucune collision, aucun drop — pur décor indiquant où plonger.
  signs?: { x: number; y: number }[]
  // spikes = danger ; water = plan d'eau. Pour les PICS, `top` = rangée de la surface qui PORTE les
  // pics (dessus d'une corniche/plateforme en hauteur) ; absent → pics au SOL (rétrocompat exacte).
  // Les pics infligent les mêmes dégâts et se chevauchent pareil, quelle que soit la hauteur.
  // Pour l'EAU : top = rangée de surface, h = profondeur en
  // rangées (sans top/h → ancienne bande près du sol, rétrocompat). Le champ `water` choisit la FORME
  // du plan d'eau :
  //   • absent      → nappe LIBRE héritée : aucun mur (rétrocompat exacte des niveaux non refondus).
  //   • 'basin'     → PUITS/BASSIN CONTENU : parois rocheuses RIGIDES (gauche/droite) qu'on ne
  //                   traverse pas en marchant ; on plonge par le HAUT et on nage dedans ; fond = sol
  //                   du monde (mettre h = groundRow - top) ; galets/algues/coquillages en déco de
  //                   fond (sans collision). Un coffre au fond = récompense de plongée.
  //   • 'waterfall' → CASCADE : source rocheuse visible en haut + rideau d'eau qui s'écoule (animé).
  //                   Réservée aux VRAIES chutes, jamais à un bassin.
  //   • 'cascade'   → CASCADE REMONTABLE : colonne d'eau CLAIRE (bleu clair) en cuve de pierre, à
  //                   COURANT ASCENDANT — on la remonte comme une échelle et on NE SE NOIE PAS
  //                   (contrairement à 'basin'). Vers une corniche/coffre secret en hauteur.
  //   • 'lave'      → CUVE DE LAVE (enfer) : même cuve de pierre que 'basin', mais rendue ROUGE/ORANGE
  //                   incandescente (lueur + bulles) et MORTELLE au contact (gros dégâts continus, cf.
  //                   LevelScene.updateLava). Aucun coffre au fond (y plonger = mourir).
  // `openSide` (eau uniquement) : ouvre une PAROI de la cuve (pas de mur rigide de ce côté) → PASSAGE
  // SOUS-MARIN. On plonge par le HAUT du lac et on ressort sur le CÔTÉ ouvert (nage immergée), vers
  // une corniche basse de la zone suivante. 'left' | 'right' | 'both'. Absent → cuve close (2 murs).
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number; top?: number; h?: number; water?: 'basin' | 'waterfall' | 'cascade' | 'lave'; openSide?: 'left' | 'right' | 'both' }[]
  bridges?: { x: number; y: number; w: number }[] // ponts de planches (plateformes fines)
  // trous MORTELS dans le sol : à ces emplacements (x en tuiles, largeur w en tuiles) on ne
  // dessine PAS les rangées de sol pleines (groundRow/+1) → c'est le vide. Tomber dedans = mort.
  // Chaque trou doit rester FRANCHISSABLE au saut simple (w ≤ distance de saut confortable,
  // vérifié par level-validator.oversizedGaps / reachable.test.ts).
  gaps?: { x: number; w: number }[]
  // BANDES DE ROCHE décoratives (aucune collision) : dalles de pierre pleine rendues avec la texture
  // du biome. Servent à REFERMER visuellement un tunnel (PLAFOND de roche au-dessus de la surface
  // marchable + remplissage sous le sol de la grotte) et à donner un socle plein au départ (mesa).
  // Purement visuelles : la hauteur libre sous un plafond reste toujours >= un saut confortable (le
  // joueur ne se cogne jamais). NE PAS confondre avec le plafond du MONDE (traversable).
  // x,y,w,h en tuiles ; y = rangée du haut de la dalle. `solid` (défaut absent = false) : dalle de
  // PLAFOND DE ROCHE avec COLLISION PLEINE — on ne peut PAS la traverser au saut (le boyau garde un
  // dégagement > saut sous le plafond). Absent → dalle purement décorative (socle/mesa sous le sol).
  rockBands?: { x: number; y: number; w: number; h: number; solid?: boolean }[]
  ladders?: { x: number; y: number; h: number }[] // échelles (x tuile, y tuile du haut, hauteur en tuiles)
  // POCHES D'AIR (niveaux immergés type Épave) : bulles d'air respirable disséminées dans l'eau. Quand
  // le panda en touche une, son souffle remonte au MAX (comme une surface locale) — sans elles, rester
  // sous l'eau = noyade continue. x,y en tuiles = CENTRE de la poche ; r = rayon en tuiles (défaut 1,6).
  airPockets?: { x: number; y: number; r?: number }[]
  checkpoints?: { x: number }[] // drapeaux de réapparition (x en tuiles)
  boss?: string
}

import { composeLevel, planModules, countFeatureModules, type ComposeOpts, type ModuleKind, type Tier } from './level-modules'
import {
  overStackedColumns, unlevelWaterBanks, deadEndSurfaces, suspendedWaterBanks,
  unreachablePlatforms, laddersToNowhere, unreachableLadders, unreachableChests,
  oversizedGaps, oversizedLadders, monstersOffSurface, startExitProblems, caveCeilingClearance,
  longEmptyFlats,
} from '../core/level-validator'
import { MONSTERS } from './monsters'

// Motifs (module kinds) EFFECTIVEMENT retenus par niveau de terrain — peuplé pendant la construction
// de `list`. Sert au rapport de diversité (script d'instrumentation) et au test de variété : on peut
// vérifier quels motifs sortent, leur fréquence, et qu'aucun catalogue n'est laissé inutilisé.
export const LEVEL_MODULE_KINDS: Record<string, ModuleKind[]> = {}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MONDE CARTE A (docs/worldmap-spec.md) — 48 niveaux jouables + 9 arènes de boss.
// Chaque niveau de terrain est GÉNÉRÉ par composeLevel (kit de modules, docs/level-module-kit.md) :
// départ plat à mi-hauteur, courbe de difficulté plafonnée par le tier du biome, dosage 30/40/20/10,
// au moins un plan d'eau + un coffre, sortie à une altitude ≠ du départ, tout atteignable au saut
// simple (validateurs reachable.test). Le SEED = l'id du nœud → chaque niveau est distinct, même
// entre deux terrains du même biome. Les arènes de boss restent des niveaux À LA MAIN (plateformes
// posées pour esquiver les patterns), sans monstre normal ni coffre.
// ══════════════════════════════════════════════════════════════════════════════════════════════

interface BiomePool { ground: string[]; birds: string[]; aquatic?: string[]; mvp?: string; tier: Tier; lava?: boolean }

// MENACE D'EAU GÉNÉRIQUE (retour playtest) : requin + méduse + piranha nagent dans les plans d'eau de
// TOUTES les zones (hors lave), indépendamment du biome, et blessent le nageur. Injectée dans le pool
// aquatique de chaque biome à eau ; le premier plan d'eau croisé est en désert → calibrées ~niv 30.
const WATER_THREATS = ['requin', 'meduse', 'piranha']

// Pools de monstres par biome (réutilisent les monstres existants ; ordre ≈ difficulté croissante).
// Les VARIANTES GÉANTES (<base>-geant) sont posées dans un biome PLUS AVANCÉ que leur base → niveau
// calibré supérieur (le niveau dérive du 1er biome où le monstre apparaît, cf. mob-level).
const POOLS: Record<string, BiomePool> = {
  plaine: { tier: 1, ground: ['gloopy', 'fabre', 'angeling', 'lapin-bondissant', 'mandragore', 'poporing', 'louveteau', 'willow', 'ronce-cracheuse'], birds: ['corbeau'], mvp: 'poring-dore' },
  foret: { tier: 2, ground: ['louveteau', 'willow', 'poporing', 'mandragore', 'ronce-cracheuse', 'rocker', 'singe-grimpeur', 'ours-brun', 'gloopy-geant', 'fabre-geant'], birds: ['corbeau'], mvp: 'poring-dore' },
  desert: { tier: 2, ground: ['scorpion', 'fourmi-geante', 'scarabee-cornu', 'momie', 'vautour', 'orc-guerrier', 'zombie', 'mini-baphomet'], birds: ['faucon'], aquatic: WATER_THREATS, mvp: 'orc-seigneur' },
  jungle: { tier: 3, ground: ['willow', 'frelon-geant', 'flora-vorace', 'singe-grimpeur', 'ours-brun', 'ronce-cracheuse', 'scorpion-geant'], birds: ['ara'], aquatic: WATER_THREATS },
  cave: { tier: 3, ground: ['chauve-souris', 'squelette', 'fantome', 'gobelin-mineur', 'fourmi-geante', 'mage-noir', 'golem-de-pierre'], birds: ['corbeau'], aquatic: WATER_THREATS },
  montagne: { tier: 3, ground: ['harpie', 'ours-brun', 'yeti', 'louveteau', 'singe-geant'], birds: ['faucon'], aquatic: WATER_THREATS },
  cimetiere: { tier: 4, ground: ['squelette', 'goule', 'totem-maudit', 'banshee', 'fantome', 'pretre-goule', 'momie-geante', 'squelette-geant', 'goule-geante'], birds: ['harfang-spectral'], aquatic: WATER_THREATS, mvp: 'spectre-ancien' },
  plage: { tier: 3, ground: ['crabe-geant', 'harpie'], birds: ['ara'], aquatic: ['meduse', 'crabe-geant', 'requin', 'piranha'], mvp: 'roi-crabe' },
  carriere: { tier: 4, ground: ['gobelin-mineur', 'golem-de-pierre', 'gargouille', 'scarabee-cornu'], birds: ['faucon'], aquatic: WATER_THREATS },
  enfer: { tier: 5, ground: ['diablotin', 'mage-noir', 'golem-de-lave', 'gargouille', 'mini-baphomet', 'diablotin-geant', 'gardien-flamme'], birds: ['corbeau'], mvp: 'dragon-flamme', lava: true },
}

// Rotation de plans d'eau (variété d'un niveau à l'autre) : chaque entrée = les cuves imposées.
// L'ensemble couvre bassin marine (noyade) ET cascade remontable (exigé par reachable.test). Chaque
// entrée porte AU MOINS un coffre (bassin/tresor-bassin/cascade/sortie-humide/petit-pont). TOUTES les
// cuves sont FERMÉES à bancs égaux (plus de passage-immerge à bord ouvert = fini les lacs suspendus,
// cf. suspendedWaterBanks). On enrichit la rotation pour SORTIR les motifs d'eau jusque-là inutilisés
// (petit-pont, trou-filet, pas-japonais → pas de pierre / gués sur cuve) et varier les niveaux.
const WATER_ROT: ModuleKind[][] = [
  ['bassin', 'cascade'],
  ['tresor-bassin', 'sortie-humide'],
  ['pas-japonais', 'cascade'],
  ['petit-pont', 'bassin'],
  ['trou-filet', 'cascade'],
  ['tresor-bassin', 'cascade'],
  // REFONTE DES MOTIFS D'EAU (vrais passages) : plongeoir, puits étroit, cascade-bassin, boyau immergé.
  // Chaque entrée garde AU MOINS un coffre (plongeoir/puits/cascade-bassin en portent ; le boyau immergé
  // n'a pas de coffre → apparié à une cascade qui en pose un).
  ['plongeoir', 'cascade'],
  ['puits', 'bassin'],
  ['cascade-bassin', 'bassin'],
  ['boyau-immerge', 'cascade'],
  // R168 — VARIANTES DE CASCADES (appendues APRÈS l'index 5 → jamais tirées par le branchement LAVE,
  // qui reste sur WATER_ROT[idx % 6] historique). cascade-trou / cascade-trouee ne portent pas de coffre
  // → appariés à une cuve porteuse de coffre (bassin) pour garantir le coffre exigé par niveau.
  ['cascade-large', 'bassin'],
  ['cascade-grotte', 'cascade'],
  ['cascade-trou', 'bassin'],
  ['cascade-cul-de-sac', 'cascade'],
  ['cascade-trouee', 'bassin'],
  // R171 — LAC → CASCADE → PLATEAU (lac horizontal + cascade remontable vers un plateau haut ; porte
  // son propre coffre au fond du lac, apparié à un bassin pour la variété).
  ['lac-cascade-plateau', 'bassin'],
]

// Biomes ROCHEUX : on y autorise les MARCHES DE PIERRE rigides (escalier-pierre), jusque-là jamais
// posées. Ailleurs (prairie, forêt…) elles resteraient incongrues → réservées à la pierre/roche.
const STONY_BIOMES = new Set(['cave', 'montagne', 'carriere', 'enfer'])

// PLANS D'EAU SPÉCIAUX (passages sous-marins) placés sur des niveaux thématiquement adaptés :
//   • LAC EN U : plonger, nager sous un plafond de roche immergé, ressortir à la MÊME hauteur ;
//   • GROTTE NOYÉE : lac en U coiffé d'un TOIT DE ROCHE (grotte inondée), coffre au fond.
// Toujours APPARIÉ à une cuve porteuse de coffre (cascade/bassin) → chaque niveau garde son coffre
// exigé (la grotte noyée pose elle-même un coffre au fond, mais on garde une 2ᵉ cuve pour la variété).
// Réservés aux biomes rocheux / souterrains / littoraux. Plage = mobs aquatiques (méduse/crabe).
const SPECIAL_WATER_LEVELS: Record<string, ModuleKind[]> = {
  'plage-2': ['lac-en-u', 'cascade'],
  'jungle-5': ['lac-en-u', 'bassin'],
  'cave-1': ['grotte-noyee', 'cascade'],
  'plage-3': ['grotte-noyee', 'bassin'],
  'carriere-1': ['grotte-noyee', 'cascade'],
  'montagne-2': ['lac-en-u', 'cascade'],
  // R171 — GROTTE SOUS-MARINE garantie TÔT (retour joueur : « 7-8 niveaux sans en voir »). On en pose
  // une dans les tout premiers terrains de plaine ET de forêt (biomes early), plus un lac-en-u forêt →
  // on en croise une dès les premiers niveaux, et elles deviennent nettement plus fréquentes.
  'plaine-4': ['grotte-noyee', 'cascade'],
  'foret-1': ['grotte-noyee', 'bassin'],
  'foret-4': ['lac-en-u', 'cascade'],
  // R171 — LAC → CASCADE → PLATEAU épinglé à un terrain early pour le sortir tôt et souvent.
  'plaine-6': ['lac-cascade-plateau', 'cascade'],
  'foret-6': ['lac-cascade-plateau', 'bassin'],
  // R168 — VARIANTES DE CASCADES épinglées à des terrains thématiques (elles n'apparaîtraient sinon que
  // très rarement, car appendues en fin de WATER_ROT que peu de biomes atteignent par `idx % len`).
  // cascade-trou / cascade-trouee ne portent pas de coffre → appariées à une cuve à coffre (bassin).
  'foret-3': ['cascade-grotte', 'cascade'],
  'jungle-1': ['cascade-large', 'bassin'],
  'montagne-1': ['cascade-trou', 'bassin'],
  'jungle-3': ['cascade-cul-de-sac', 'cascade'],
  'plage-4': ['cascade-trouee', 'bassin'],
  'jungle-2': ['cascade-w', 'bassin'], // NOUVEAU motif : cascade en W (rideaux mortels + îlot central)
  // NB : motifs 'cascade-saut-ange' et 'cascade-large-pierre' définis (builder + META) mais PAS encore
  // placés — leur chaînage d'altitude (perchoir/exit haut) casse la composition ; à raffiner avant pose.
}

// Motifs NON-eau IMPOSÉS par terrain (ComposeOpts.forcedKinds) : gros motifs signature qu'on place à la
// main, surtout sur les biomes PAUVRES en variété (cimetière, cave) pour les enrichir. Ces terrains
// peuvent être rallongés et sont exemptés de la règle d'XP stricte (cf. xp-economy.test).
const SPECIAL_FORCED: Record<string, ModuleKind[]> = {
  'cave-2': ['echelles-lianes'],
  'cimetiere-1': ['echelles-lianes'],
  // NB : 'lacs-cascade-montee' et 'lacs-cascade-descente' définis (builder + META) mais PAS placés —
  // reachability à raffiner (émergences de cascade à chaîner ; cascades de descente ≥ 8 rangées).
}

// Biomes ROCHEUX / SOUTERRAINS / JUNGLE PROFONDE : on y autorise les GROTTES-TUNNELS (boyaux de
// roche francs). Ailleurs (prairie, désert ouvert…) une caverne fermée serait incongrue.
const CAVE_BIOMES = new Set(['cave', 'montagne', 'carriere', 'enfer', 'jungle', 'foret'])

// DÉSERT TARDIF (Col sec / Fourche / Braise) : ces trois terrains désertiques sont RÉINSÉRÉS très loin
// dans la progression (avant montagne / plage / enfer), où le joueur ATTENDU est ~Nv40-52. Le pool
// désert standard (mobs ~Nv27, calibrés sur l'ENTRÉE du désert) y devenait TRIVIAL : dégâts plafonnés
// à 1, difficulté mesurée ~0,00 (moteur de jouabilité). On leur donne donc un pool de la BANDE HAUTE
// du désert — serpent des sables (Nv32), élémentaire de sable (Nv35), djinn mineur (Nv38), scorpion
// géant (Nv41, variante géante désert). Tous ces mobs apparaissent DÉJÀ plus tôt (PINNED_SPAWNS désert
// pour les trois premiers, pool jungle pour le scorpion géant), donc leur niveau calibré est INCHANGÉ
// (mob-level dérive de la 1RE apparition dans l'ordre de `list`) → aucun recalibrage. Le 1ER mob du
// pool est le plus RÉPÉTÉ par le remplissage (nextGround retombe dessus une fois la file vidée) : on y
// met le plus menaçant (scorpion géant) pour porter l'essentiel de la difficulté.
// Le 1ER mob (le plus RÉPÉTÉ) porte l'essentiel de la difficulté : à ces niveaux de joueur (Nv40-52),
// seuls des fonceurs/costauds AU NIVEAU du joueur infligent un vrai grignotage (les mobs sous le niveau
// voient leurs dégâts plafonnés à 1). Les mobs choisis restent CALIBRÉS À L'IDENTIQUE car ils
// apparaissent déjà plus tôt dans l'ordre de `list` : scorpion géant/frelon géant (pool jungle, ~idx 26-30
// < desert-9 idx 32) et harpie (pool montagne, idx 33 < desert-10 idx 40 < desert-11 idx 48). On garde
// l'ADN désert (scorpion géant, djinn de feu, serpent des sables) et on laisse la faune du biome SUIVANT
// déborder sur ces terrains-passerelles (jungle→montagne pour Col sec, montagne pour Fourche/Braise),
// comme le fait déjà TRANSITION_MIX aux entrées de biome.
// DÉSERT PROFOND THÉMATIQUEMENT PUR (retour joueur : « bien enfoncé dans le désert = que des monstres
// désert ») : on remplace les emprunts jungle (frelon-géant) / montagne (harpie) par des GROS variantes
// DÉSERT (scarabée colosse, vautour royal) de même niveau — l'ADN désert (scorpion géant, djinn, serpent)
// est conservé. Les transitions douces restent assurées par TRANSITION_MIX aux ENTRÉES de biome.
const LATE_DESERT_GROUND: Record<string, string[]> = {
  'desert-9': ['scorpion-geant', 'scarabee-geant', 'djinn-mineur', 'serpent-des-sables'],
  'desert-10': ['vautour-geant', 'scorpion-geant', 'djinn-mineur', 'serpent-des-sables'],
  'desert-11': ['vautour-geant', 'scorpion-geant', 'djinn-mineur', 'serpent-des-sables'],
}

// Fait tourner le pool de monstres pour que deux niveaux d'un même biome ne se ressemblent pas.
const rotate = <T>(arr: T[], by: number): T[] => (arr.length ? arr.map((_, i) => arr[(i + by) % arr.length]!) : arr)

// Un niveau de terrain : biome + rang (1-based) dans le biome → composeLevel calibré.
function terrain(id: string, name: string, biome: string, rank: number): LevelDef {
  const pool = POOLS[biome]!
  const idx = rank - 1
  const ending: 'bas' | 'haut' = idx % 2 === 0 ? 'bas' : 'haut'
  // NIVEAUX PLUS LONGS (retour joueur : « une pause toilette = 1-2 niveaux, un niveau doit DURER »).
  // On AUGMENTE nettement le nombre de modules centraux, avec une PROGRESSION : base plus haute pour les
  // biomes avancés (tier) + croissance par rang DANS le biome (les premiers terrains un peu plus courts,
  // ça s'allonge). Chaque niveau enchaîne ainsi plusieurs séquences de motifs (plusieurs minutes de jeu).
  const midBase = pool.tier <= 1 ? 8 : pool.tier === 2 ? 9 : pool.tier === 5 ? 12 : pool.tier + 7
  // NB : on ne rallonge PAS plaine-1 (un +1 module suffisait à faire basculer TOUTE la plaine-2 de
  // niveau 5 → 6 via l'XP cumulée → mur de difficulté au 2e terrain). plaine-1 reste à la longueur de
  // base (≈8 porings, largement de quoi passer niveau 2), la rampe de niveaux reste douce.
  const midCount = midBase + Math.floor((rank - 1) / 2) + (idx % 2)
  // Échelles autorisées PARTOUT, y compris plaine-1 : sans échelle, une chute dans un creux/bassin
  // pouvait piéger le joueur sans remontée possible (retour joueur « je tombe et je peux pas remonter »).
  const allowLadders = true
  // NIVEAUX EARLY (retour playtest : « les 6 premiers sont TRÈS répétitifs, aucun gros motif ») : les
  // premiers terrains (toute la plaine + l'orée de forêt) DÉBRIDENT la variété — composeCap relève le
  // plafond de sélection à tier 2-3 (motifs de tier 2-3 accessibles TÔT, plus seulement en fin de jeu),
  // earlyBoost comprime le filler plat, et featureFloor GARANTIT ≥ N gros motifs par niveau. La TENSION
  // (pics) reste bornée par tierCap → pas de piège punitif imprévisible. plaine-1 reste le plus doux
  // (composeCap 2, sans échelle), la variété/exigence monte ensuite.
  const early = biome === 'plaine' || (biome === 'foret' && rank <= 2)
  const composeCap: Tier = early ? ((biome === 'plaine' && rank === 1 ? 2 : 3) as Tier) : pool.tier
  const featureFloor = early ? (biome === 'plaine' && rank === 1 ? 3 : 4) : 0
  // MVP posé seulement sur un niveau tardif du biome (dernier ou avant-dernier terrain)
  const useMvp = pool.mvp && rank >= 2
  // ITEM 1 — GROTTE DE DÉPART souterraine : sur le 1er terrain des biomes rocheux (hors enfer, où l'eau
  // n'a pas de sens), le spawn est une grotte fermée avec un bassin immergé à franchir à la nage.
  const caveStart = STONY_BIOMES.has(biome) && biome !== 'enfer' && rank === 1
  // ITEM 7 — ZIGZAG dès le tout début du jeu : les deux premiers terrains de plaine ouvrent sur un zigzag.
  const openZigzag = biome === 'plaine' && rank <= 2
  // ITEM 11 — RELIEF VALLONNÉ (silhouette plus haute/découpée) : vallons, collines, montagne, jungle.
  const hilly = (biome === 'plaine' && (rank === 3 || rank === 5)) || biome === 'montagne' || biome === 'jungle'
  // ITEM 10 — DIFFÉRENCIER NETTEMENT plaine-1/2/3 (Prairie / Champs / Vallon) : signature d'eau distincte.
  //   Prairie = bassin + cascade (doux) · Champs = petit pont sur mare + cascade · Vallon = plongeoir + bassin.
  const PLAINE_WATER: Record<number, ModuleKind[]> = { 1: ['bassin', 'cascade'], 2: ['petit-pont', 'cascade'], 3: ['plongeoir', 'bassin'] }
  // PACING (retour playtest : « n'introduis pas trop de mobs distincts DÈS le début ») : en plaine,
  // montée PROGRESSIVE du nombre d'espèces (2 au 1er terrain → tout le pool en fin de plaine) ; à l'orée
  // de forêt, cap modéré ; ailleurs, rotation complète. Aux TRANSITIONS de biome (1er terrain), on
  // MÉLANGE 1 mob du biome PRÉCÉDENT — déjà croisé, donc son niveau calibré (1er biome où il apparaît)
  // est INCHANGÉ → aucun recalibrage — pour lisser le passage d'un biome à l'autre.
  const TRANSITION_MIX: Record<string, string> = {
    desert: 'ours-brun', jungle: 'scorpion', cave: 'scorpion', montagne: 'gobelin-mineur',
    cimetiere: 'squelette', carriere: 'squelette', enfer: 'gargouille',
  }
  // plaine-1 = UNIQUEMENT des porings (gloopy) : premier terrain « école », le joueur apprend à jouer
  // sur un seul mob de contact inoffensif (retour joueur : « niveau 1 trop dur, meurs sans arrêt »).
  // La variété monte ensuite (2 espèces en plaine-2, etc.).
  const distinctCap = biome === 'plaine' ? (rank === 1 ? 1 : Math.min(pool.ground.length, 1 + rank))
    : (biome === 'foret' && rank <= 2) ? 4 + rank : pool.ground.length
  let groundPool = LATE_DESERT_GROUND[id]
    ?? (biome === 'plaine' ? pool.ground.slice(0, distinctCap) : rotate(pool.ground, idx).slice(0, distinctCap))
  const mix = TRANSITION_MIX[biome]
  if (rank === 1 && mix && !groundPool.includes(mix)) groundPool = [mix, ...groundPool]
  // RAMPE AÉRIENNE (retour joueur : « des corbeaux Nv4 qui plongent en GRAPPES dès le 1er niveau, ça
  // défonce »). Les oiseaux (corbeau : aérien PIQUEUR à comportement charge) sont ce qui rend le tout
  // début injouable. On plafonne donc leur DENSITÉ par un cap croissant : plaine-1 = 0 oiseau (début
  // CHILL, on apprend à jouer sur des mobs de contact inoffensifs) ; plaine-2/3 = UN corbeau ISOLÉ max
  // par motif (jamais de nuée) ; plaine-4/5 = 2 ; ensuite densité pleine. À l'orée de forêt, cap modéré.
  // Ailleurs (undefined) → densité normale du biome.
  const birdCap: number | undefined = biome === 'plaine'
    ? (rank === 1 ? 0 : rank <= 3 ? 1 : rank <= 5 ? 2 : undefined)
    : (biome === 'foret' && rank <= 2) ? 2 : undefined
  const base = {
    id, name, biome,
    tierCap: pool.tier,
    ending,
    ground: groundPool,
    birds: pool.birds,
    ...(birdCap !== undefined ? { birdCap } : {}),
    ...(pool.aquatic ? { aquatic: pool.aquatic } : {}),
    ...(useMvp ? { mvp: pool.mvp } : {}),
    midCount,
    allowLadders,
    ...(early ? { composeCap, earlyBoost: true, featureFloor } : {}),
    stony: STONY_BIOMES.has(biome),
    caves: CAVE_BIOMES.has(biome),
    ...(caveStart ? { caveStart: true } : {}),
    ...(openZigzag ? { openZigzag: true } : {}),
    ...(hilly ? { hilly: true } : {}),
    // En ENFER, les cuves marine deviennent de la LAVE (aucun coffre de plongée) : on garantit alors
    // au moins une CASCADE remontable (seule cuve qui pose un coffre en biome lave) → chaque niveau
    // conserve son coffre exigé par la registry de props.
    // En ENFER (lava), on reste sur les 6 rotations HISTORIQUES (les nouveaux motifs marine — plongeoir,
    // puits, boyau immergé — n'ont pas de sémantique de LAVE cohérente et créaient des impasses) ; les
    // biomes non-lave profitent de toute la rotation enrichie.
    waterKinds: SPECIAL_WATER_LEVELS[id]
      ? SPECIAL_WATER_LEVELS[id]!
      : biome === 'plaine' && PLAINE_WATER[rank]
        ? PLAINE_WATER[rank]!
        : pool.lava
          ? (WATER_ROT[idx % 6]!.some((w) => w === 'cascade' || w === 'sortie-humide')
            ? WATER_ROT[idx % 6]!
            : (['bassin', 'cascade'] as ModuleKind[]))
          : WATER_ROT[idx % WATER_ROT.length]!,
    ...(SPECIAL_FORCED[id] ? { forcedKinds: SPECIAL_FORCED[id] } : {}),
    ...(pool.lava ? { lava: true } : {}),
  }
  // Certaines graines produisent une colonne à 4 paliers empilés, un rebord de lac désaxé, ou un
  // piège sans retour (softlock). On essaie des graines salées et on garde la PREMIÈRE silhouette
  // conforme à TOUS ces invariants — déterministe (aucun Math.random), stable d'un build à l'autre.
  // Conforme à TOUS les invariants vérifiés par reachable.test : silhouette (≤3 paliers), eau (bancs
  // à niveau, jamais suspendue), pas de piège sans retour, ET atteignabilité physique complète
  // (plateformes/échelles/coffres joignables, trous et échelles dans les bornes, monstres posables).
  // La rotation de plans d'eau (WATER_ROT) + le rejet de l'eau suspendue font bouger la géométrie →
  // sans cette batterie complète, une graine pouvait produire un niveau injouable non rejeté
  // (plateforme injoignable). Déterministe (aucun Math.random) : même silhouette d'un build à l'autre.
  const isAerial = (mid: string) => !!MONSTERS[mid]?.aerial
  // ANTI-ENNUI (retour user : « parfois une immense bande de plat sans rien, je me fais chier ») : on
  // AJOUTE longEmptyFlats à la batterie → une graine qui produit une longue bande de sol plat SANS
  // AUCUN élément d'intérêt (monstre, coffre, relief, obstacle, échelle…) est REJETÉE. Le générateur
  // MEUBLE donc toute portion plate longue en changeant de graine (les 80+ salées font varier motifs,
  // reliefs et placements). SEUIL ADAPTATIF : on vise 16 tuiles de plat vide max ; si AUCUNE graine
  // propre ne passe sur ce terrain (contrainte trop dure), on assouplit à 18 puis 20 — le garde-fou
  // reste TOUJOURS actif, on tolère juste une bande un peu plus longue plutôt qu'une génération cassée.
  const cleanAt = (l: LevelDef, maxFlat: number): boolean =>
    overStackedColumns(l, 3).length === 0 && unlevelWaterBanks(l).length === 0
    && suspendedWaterBanks(l).length === 0 && deadEndSurfaces(l).length === 0
    && unreachablePlatforms(l).length === 0 && laddersToNowhere(l).length === 0
    && unreachableLadders(l).length === 0 && unreachableChests(l).length === 0
    && oversizedGaps(l).length === 0 && oversizedLadders(l).length === 0
    && monstersOffSurface(l, isAerial).length === 0
    && startExitProblems(l).length === 0 && caveCeilingClearance(l).length === 0
    && longEmptyFlats(l, maxFlat).length === 0
  const salts = [`${id}-${ending}`, ...Array.from({ length: 80 }, (_, i) => `${id}-${ending}-${i}`)]
  let chosen = salts[0]!
  let level = composeLevel({ ...base, seed: chosen })
  // On garde la PREMIÈRE graine conforme à TOUS les invariants (clean) ET portant assez de GROS MOTIFS
  // (featureFloor, 0 hors early → premier clean, comportement historique). Repli sur le premier clean
  // si aucune graine n'atteint le plancher de motifs (jamais observé, mais garantit un niveau valide).
  for (const maxFlat of [16, 18, 20]) {
    let firstClean: string | null = null
    let found = false
    for (const seed of salts) {
      const l = composeLevel({ ...base, seed })
      if (!cleanAt(l, maxFlat)) continue
      found = true
      if (firstClean === null) { firstClean = seed; level = l; chosen = seed }
      const feats = countFeatureModules(planModules({ ...(base as ComposeOpts), seed }).map((m) => m.kind))
      if (feats >= featureFloor) { level = l; chosen = seed; break }
    }
    if (found) break // seuil satisfait → on ne relâche pas davantage
  }
  LEVEL_MODULE_KINDS[id] = planModules({ ...(base as ComposeOpts), seed: chosen }).map((m) => m.kind)
  return level
}

// ITEM 12 — arène de boss PLUS GRANDE et VARIÉE, à PLUS de plateformes, GARANTIES atteignables :
// deux rangées BASSES (12 et 10) joignables directement du sol (rise ≤ 4 tuiles), plus une rangée
// HAUTE (8) posée PILE au-dessus des plateformes médianes (saut court hgap 0, rise 2) → tout est
// atteignable au saut simple (vérifié par reachable.test), l'arène offre plus d'appuis pour esquiver.
// `spacing`/`pw` varient d'une arène à l'autre → silhouettes distinctes. Sol plein sur toute la largeur.
function bigArena(id: string, name: string, biome: string, boss: string, w: number, spacing = 10, pw = 5): LevelDef {
  const plats: { x: number; y: number; w: number }[] = []
  const n = Math.floor((w - 6) / spacing)
  for (let i = 0; i <= n; i++) {
    const x = 6 + i * spacing
    plats.push({ x, y: i % 2 === 0 ? 12 : 10, w: pw }) // rangées basses/médianes (atteignables du sol)
  }
  for (let i = 1; i <= n; i += 2) {
    plats.push({ x: 6 + i * spacing, y: 8, w: pw }) // rangée haute PILE au-dessus d'une médiane
  }
  return { id, name, biome, widthTiles: w, platforms: plats, spawns: [], boss }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ÉPAVE — niveau bespoke ENTIÈREMENT SOUS-MARIN (galion coulé), branché à gauche de la plage.
// Tout est immergé : une seule cuve marine FERMÉE couvre le monde de la voûte de roche (toit de la
// caverne noyée) jusqu'au fond de roche/épave. Il n'y a AUCUNE surface d'air praticable — le souffle
// descend en continu et, une fois épuisé, la noyade s'installe. On survit en enchaînant les POCHES
// D'AIR disséminées dans l'épave (elles rechargent le souffle au max, cf. LevelScene.updateWater).
// Les coffres (récompenses de plongée) sont posés sur les débris de l'épave ; les mobs aquatiques
// (crabe géant, méduse) nagent sans se noyer et gardent le butin. Dur mais jouable : poche → coffre
// → poche. Géométrie correct-par-construction (chaîne de débris atteignable au saut depuis le fond,
// cuve close à bancs égaux hors-monde, toit de roche à dégagement de saut) — vérifié par reachable.test.
function epave(): LevelDef {
  const W = 60
  const H = 22
  const groundRow = H - 2 // 20
  const chest = (x: number, row: number) => ({ kind: 'coffre', x, y: row - 1 })
  // débris de l'épave : chaîne de corniches atteignables au saut depuis le fond (rise ≤ 3, écart ≤ 3),
  // sommet à la rangée 9 (dégagement > saut sous le toit de roche). Chaque corniche porte un coffre.
  const platforms = [
    { x: 5, y: 17, w: 6 }, { x: 13, y: 14, w: 6 }, { x: 21, y: 11, w: 6 }, { x: 30, y: 9, w: 7 },
    { x: 40, y: 11, w: 6 }, { x: 48, y: 14, w: 6 }, { x: 55, y: 17, w: 5 },
    { x: 17, y: 17, w: 4 }, { x: 36, y: 17, w: 4 }, { x: 51, y: 17, w: 4 },
  ]
  return {
    id: 'epave-1', name: 'Épave', biome: 'plage', widthTiles: W, heightTiles: H,
    start: { x: 3, y: 8 }, exit: { x: 57, y: 17 },
    platforms,
    // TOIT DE ROCHE de la caverne noyée : dalle pleine (collision) sur toute la largeur, sous la ligne
    // d'eau → interdit de remonter respirer « en surface » (le souffle ne peut donc plus se recharger
    // qu'aux poches d'air). Dégagement > saut sous le toit (sommet des débris rangée 9, bas du toit 3).
    rockBands: [{ x: 0, y: 1, w: W, h: 3, solid: true }],
    // UNE cuve marine FERMÉE couvre tout le monde (bords hors-carte → bancs à niveau, jamais suspendue).
    hazards: [{ kind: 'water', x: 0, w: W, top: 0, h: H, water: 'basin' }],
    // coffres = récompenses de plongée, un par débris (10 coffres)
    props: platforms.map((p) => chest(p.x + Math.floor(p.w / 2), p.y)),
    // mobs AQUATIQUES (nagent sans se noyer) : gardent le fond et les débris. Densité élevée = dur.
    spawns: [
      { monsterId: 'crabe-geant', x: 8 }, { monsterId: 'meduse', x: 15 },
      { monsterId: 'crabe-geant', x: 24, y: 11 }, { monsterId: 'meduse', x: 33 },
      { monsterId: 'crabe-geant', x: 38 }, { monsterId: 'meduse', x: 44 },
      { monsterId: 'crabe-geant', x: 50, y: 14 }, { monsterId: 'meduse', x: 55 },
      { monsterId: 'crabe-geant', x: 30 },
    ],
    // POCHES D'AIR disséminées : rechargent le souffle au max (route poche → coffre/mob → poche).
    airPockets: [
      { x: 16, y: 10 }, { x: 10, y: 17 }, { x: 21, y: 13 }, { x: 33, y: 11 },
      { x: 44, y: 13 }, { x: 53, y: 16 },
    ],
  }
}

// Assemblés dans l'ORDRE DE PROGRESSION (pilote la courbe de niveau des monstres via mob-level.ts).
const list: LevelDef[] = [
  // Plaine (avant Prontera)
  terrain('plaine-1', 'Prairie', 'plaine', 1),
  terrain('plaine-2', 'Champs', 'plaine', 2),
  terrain('plaine-3', 'Vallon', 'plaine', 3),
  terrain('plaine-4', 'Pré fleuri', 'plaine', 4),
  terrain('plaine-5', 'Colline', 'plaine', 5),
  terrain('plaine-6', 'Bocage', 'plaine', 6),
  terrain('plaine-7', 'Clairière', 'plaine', 7),
  // Forêt
  terrain('foret-1', 'Orée', 'foret', 1),
  terrain('foret-2', 'Sylve', 'foret', 2),
  terrain('foret-3', 'Taillis', 'foret', 3),
  terrain('foret-4', 'Sous-bois', 'foret', 4),
  terrain('foret-5', 'Ronces', 'foret', 5),
  terrain('foret-6', 'Halliers', 'foret', 6),
  terrain('foret-7', 'Lisière', 'foret', 7),
  bigArena('boss-01', 'Gardien de la Sylve', 'foret', 'boss-sylve', 52, 10, 5),
  // Désert (début)
  terrain('desert-1', 'Piste', 'desert', 1),
  terrain('desert-2', 'Dunes', 'desert', 2),
  terrain('desert-3', 'Erg', 'desert', 3),
  bigArena('boss-02', 'Pyramide du Pharaon', 'desert', 'pharaon-scarabee', 56, 9, 6),
  terrain('desert-4', 'Oasis', 'desert', 4),
  terrain('desert-5', 'Ravin', 'desert', 5),
  terrain('desert-6', 'Gorge', 'desert', 6),
  terrain('desert-7', 'Sables', 'desert', 7),
  terrain('desert-8', 'Carrefour', 'desert', 8),
  // Cave
  terrain('cave-1', 'Caverne', 'cave', 1),
  bigArena('boss-03', 'Cœur de la Caverne', 'cave', 'boss-golem-cave', 54, 11, 5),
  // Jungle
  terrain('jungle-1', 'Palmeraie', 'jungle', 1),
  terrain('jungle-2', 'Jungle', 'jungle', 2),
  terrain('jungle-3', 'Canopée', 'jungle', 3),
  terrain('jungle-4', 'Fourré', 'jungle', 4),
  terrain('jungle-5', 'Marais', 'jungle', 5),
  bigArena('boss-04', 'Cœur de la Jungle', 'jungle', 'seigneur-liane', 54, 10, 4),
  // Montagne
  terrain('desert-9', 'Col sec', 'desert', 9),
  terrain('montagne-1', 'Cimes', 'montagne', 1),
  terrain('montagne-2', 'Crête', 'montagne', 2),
  terrain('montagne-3', 'Névé', 'montagne', 3),
  bigArena('boss-05', 'Repaire du Yéti', 'montagne', 'boss-yeti', 58, 12, 5),
  // Cimetière
  terrain('cimetiere-1', 'Tombes', 'cimetiere', 1),
  terrain('cimetiere-2', 'Ossuaire', 'cimetiere', 2),
  bigArena('boss-06', 'Trône du Roi Liche', 'cimetiere', 'roi-liche', 56, 10, 6),
  // Plage
  terrain('desert-10', 'Fourche', 'desert', 10),
  terrain('plage-1', 'Rivage', 'plage', 1),
  terrain('plage-2', 'Lagon', 'plage', 2),
  terrain('plage-3', 'Récif', 'plage', 3),
  terrain('plage-4', 'Corail', 'plage', 4),
  bigArena('boss-07', 'Antre du Roi Crabe', 'plage', 'boss-crabe', 54, 9, 5),
  // Carrière
  terrain('carriere-1', 'Carrière', 'carriere', 1),
  bigArena('boss-08', 'Pic du Golem Ancien', 'carriere', 'golem-ancien', 58, 11, 5),
  // Enfer (zone finale)
  terrain('desert-11', 'Braise', 'desert', 11),
  terrain('enfer-1', 'Sentier', 'enfer', 1),
  terrain('enfer-2', 'Cendres', 'enfer', 2),
  terrain('enfer-3', 'Fournaise', 'enfer', 3),
  terrain('enfer-4', 'Coulée', 'enfer', 4),
  terrain('enfer-5', 'Brasier', 'enfer', 5),
  terrain('enfer-6', 'Abîme', 'enfer', 6),
  terrain('enfer-7', 'Géhenne', 'enfer', 7),
  bigArena('boss-09', 'Antre du Seigneur Déchu', 'enfer', 'seigneur-dechu', 64, 10, 6),
  // ÉPAVE — branche sous-marine de la plage (nœud à gauche de Corail sur la carte). Placée en FIN de
  // liste : elle n'introduit aucun monstre inédit (crabe/méduse vus dès la plage), donc son rang ne
  // recalibre AUCUN niveau de monstre (mob-level.ts lit l'ordre de `list`).
  epave(),
]

// COUVERTURE DU ROSTER : le déclustering (level-modules) privilégie l'espacement et la diversité, mais
// dans un biome à un seul terrain, une espèce qui n'apparaît qu'en NUÉE serrée (p. ex. l'oiseau unique
// du cimetière) peut être entièrement évincée de TOUS les niveaux → un monstre conçu ne spawnerait plus
// nulle part (contenu mort, niveau calibré à 1 aberrant). On garantit ici, globalement, qu'au moins une
// instance de chaque espèce attendue de chaque pool subsiste, en l'injectant dans son biome d'origine à
// un emplacement libre (respectant l'espacement et la marge de départ). Déterministe (aucun Math.random).
function ensureRosterCoverage(levels: LevelDef[]): void {
  const present = new Set<string>()
  for (const l of levels) for (const s of l.spawns) present.add(s.monsterId)
  for (const [biome, pool] of Object.entries(POOLS)) {
    const expected = [...pool.ground, ...pool.birds, ...(pool.aquatic ?? []), ...(pool.mvp ? [pool.mvp] : [])]
    for (const id of expected) {
      if (present.has(id)) continue
      const home = levels.find((l) => l.biome === biome && !l.boss && l.id !== 'epave-1')
      if (!home) continue
      const startX = home.start?.x ?? 0
      const xs = home.spawns.map((s) => s.x)
      let x = -1
      for (let cand = 12; cand < home.widthTiles - 4; cand++) {
        if (Math.abs(cand - startX) < 8) continue
        if (xs.every((sx) => Math.abs(sx - cand) >= 10)) { x = cand; break }
      }
      if (x < 0) continue
      if (MONSTERS[id]?.aerial) {
        home.spawns.push({ monsterId: id, x, y: Math.max(2, Math.floor((home.heightTiles ?? 16) / 3)) })
      } else {
        const pl = home.platforms.find((p) => x >= p.x && x < p.x + p.w)
        if (!pl) continue
        home.spawns.push({ monsterId: id, x, y: pl.y - 1 })
      }
      present.add(id)
    }
  }
}

// PLACEMENTS CIBLÉS (audit lot 3 — combler les TROUS DE GRANULARITÉ de niveau). Les mobs ci-dessous
// ne sont PAS versés dans les POOLS de biome : un mob de pool apparaît dès le RANG 1 de son biome (la
// couverture le force sur le 1er terrain), si bien que tous les mobs d'un biome se calent sur le même
// niveau calibré (tout le désert à 27, toute la montagne à 47…) → aucune granularité intermédiaire.
// On les ÉPINGLE donc au TERRAIN dont le niveau calibré vise la bande à combler : mob-level dérive le
// niveau de la 1RE apparition dans l'ordre de `list`, donc le premier terrain listé fixe le niveau.
// Espacement ≥10 tuiles et marge de départ respectés (même logique que ensureRosterCoverage).
// Déterministe (aucun Math.random).
const PINNED_SPAWNS: Record<string, string[]> = {
  'corbeau': ['plaine-2'],                           // ANCRE le corbeau tôt (1er vu = plaine-2 → Nv ~5,
                                                     // stable) : sinon le placement RNG des oiseaux le
                                                     // décale de terrain quand la géométrie change et
                                                     // son niveau calibré saute (retour joueur : début doux)
  'serpent-des-sables': ['desert-3', 'desert-4'],   // désert (bande ~30, transition plaine→désert)
  'elementaire-de-sable': ['desert-6', 'desert-7'], // milieu de désert (bande ~35)
  'djinn-mineur': ['desert-8'],                     // fin de désert (bande ~38)
  'loup-des-neiges': ['montagne-2', 'montagne-3'],  // montagne (bande ~48)
  'liche-mineure': ['cimetiere-2'],                 // cimetière tardif (bande ~53)
  'kraken-juvenile': ['plage-4'],                   // plage tardive, plan d'eau profond (bande ~59)
  'cerbere': ['enfer-4', 'enfer-5'],                // enfer profond (bande ~66)
  'gargouille': ['enfer-7'],                         // dernier terrain d'enfer : garantit assez d'XP
                                                     // au clear (règle 0,5–2× le level-up, cf. xp-economy.test)
}

// Injecte les placements ciblés dans leurs terrains dédiés, à un emplacement libre (≥10 tuiles des
// autres spawns, ≥8 de la position de départ), sur une surface (aérien → en l'air). Appelé AVANT la
// couverture de roster : ces mobs n'étant pas dans les POOLS, la couverture les ignore.
function injectPinnedSpawns(levels: LevelDef[]): void {
  for (const [id, levelIds] of Object.entries(PINNED_SPAWNS)) {
    for (const lid of levelIds) {
      const home = levels.find((l) => l.id === lid)
      if (!home || home.boss) continue
      const startX = home.start?.x ?? 0
      const xs = home.spawns.map((s) => s.x)
      const aerial = !!MONSTERS[id]?.aerial
      let placed = false
      for (let cand = 12; cand < home.widthTiles - 4 && !placed; cand++) {
        if (Math.abs(cand - startX) < 8) continue
        if (!xs.every((sx) => Math.abs(sx - cand) >= 10)) continue
        if (aerial) {
          home.spawns.push({ monsterId: id, x: cand, y: Math.max(2, Math.floor((home.heightTiles ?? 16) / 3)) })
          placed = true
          break
        }
        // surface d'accueil : le monstre est posé À LA MÊME rangée que sa plateforme (monstersOffSurface
        // impose p.y === s.y). Le validateur retient la PREMIÈRE plateforme couvrant (cand, y) dans la
        // plage [p.x-1, p.x+p.w] : on choisit donc une rangée où CETTE plateforme est LARGE (≥3 tuiles,
        // marge de patrouille), en émulant exactement sa sélection pour ne jamais tomber sur un rebord étroit.
        const rows = [...new Set(home.platforms.filter((p) => p.w >= 3 && cand >= p.x && cand < p.x + p.w).map((p) => p.y))]
        for (const y of rows) {
          const found = home.platforms.find((p) => cand >= p.x - 1 && cand <= p.x + p.w && p.y === y)
          if (found && found.w >= 3) { home.spawns.push({ monsterId: id, x: cand, y }); placed = true; break }
        }
      }
    }
  }
}
injectPinnedSpawns(list)
ensureRosterCoverage(list)

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
