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
  checkpoints?: { x: number }[] // drapeaux de réapparition (x en tuiles)
  boss?: string
}

import { composeLevel, planModules, type ComposeOpts, type ModuleKind, type Tier } from './level-modules'
import {
  overStackedColumns, unlevelWaterBanks, deadEndSurfaces, suspendedWaterBanks,
  unreachablePlatforms, laddersToNowhere, unreachableLadders, unreachableChests,
  oversizedGaps, oversizedLadders, monstersOffSurface,
} from '../core/level-validator'
import { MONSTERS } from './monsters'

// Motifs (module kinds) EFFECTIVEMENT retenus par niveau de terrain — peuplé pendant la construction
// de `list`. Sert au rapport de diversité (script d'instrumentation) et au test de variété : on peut
// vérifier quels motifs sortent, leur fréquence, et qu'aucun catalogue n'est laissé inutilisé.
export const LEVEL_MODULE_KINDS: Record<string, ModuleKind[]> = {}

const plat = (x: number, y: number, w: number) => ({ x, y, w })

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

// Pools de monstres par biome (réutilisent les monstres existants ; ordre ≈ difficulté croissante).
const POOLS: Record<string, BiomePool> = {
  plaine: { tier: 1, ground: ['gloopy', 'fabre', 'angeling', 'lapin-bondissant', 'mandragore', 'poporing', 'louveteau', 'willow', 'ronce-cracheuse'], birds: ['corbeau'], mvp: 'poring-dore' },
  foret: { tier: 2, ground: ['louveteau', 'willow', 'poporing', 'mandragore', 'ronce-cracheuse', 'rocker', 'singe-grimpeur', 'ours-brun'], birds: ['corbeau'], mvp: 'poring-dore' },
  desert: { tier: 2, ground: ['scorpion', 'fourmi-geante', 'scarabee-cornu', 'momie', 'vautour', 'orc-guerrier', 'zombie', 'mini-baphomet'], birds: ['faucon'], mvp: 'orc-seigneur' },
  jungle: { tier: 3, ground: ['willow', 'frelon-geant', 'flora-vorace', 'singe-grimpeur', 'ours-brun', 'ronce-cracheuse'], birds: ['ara'] },
  cave: { tier: 3, ground: ['chauve-souris', 'squelette', 'fantome', 'gobelin-mineur', 'fourmi-geante', 'mage-noir', 'golem-de-pierre'], birds: ['corbeau'] },
  montagne: { tier: 3, ground: ['harpie', 'ours-brun', 'yeti', 'louveteau'], birds: ['faucon'] },
  cimetiere: { tier: 4, ground: ['squelette', 'goule', 'totem-maudit', 'banshee', 'fantome', 'pretre-goule'], birds: ['harfang-spectral'], mvp: 'spectre-ancien' },
  plage: { tier: 3, ground: ['crabe-geant', 'harpie'], birds: ['ara'], aquatic: ['meduse', 'crabe-geant'], mvp: 'roi-crabe' },
  carriere: { tier: 4, ground: ['gobelin-mineur', 'golem-de-pierre', 'gargouille', 'scarabee-cornu'], birds: ['faucon'] },
  enfer: { tier: 5, ground: ['diablotin', 'mage-noir', 'golem-de-lave', 'gargouille', 'mini-baphomet', 'gardien-flamme'], birds: ['corbeau'], mvp: 'dragon-flamme', lava: true },
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
}

// Biomes ROCHEUX / SOUTERRAINS / JUNGLE PROFONDE : on y autorise les GROTTES-TUNNELS (boyaux de
// roche francs). Ailleurs (prairie, désert ouvert…) une caverne fermée serait incongrue.
const CAVE_BIOMES = new Set(['cave', 'montagne', 'carriere', 'enfer', 'jungle', 'foret'])

// Fait tourner le pool de monstres pour que deux niveaux d'un même biome ne se ressemblent pas.
const rotate = <T>(arr: T[], by: number): T[] => (arr.length ? arr.map((_, i) => arr[(i + by) % arr.length]!) : arr)

// Un niveau de terrain : biome + rang (1-based) dans le biome → composeLevel calibré.
function terrain(id: string, name: string, biome: string, rank: number): LevelDef {
  const pool = POOLS[biome]!
  const idx = rank - 1
  const ending: 'bas' | 'haut' = idx % 2 === 0 ? 'bas' : 'haut'
  const midCount = (pool.tier <= 2 ? 6 : pool.tier === 5 ? 8 : 7) + (idx % 2)
  const allowLadders = !(biome === 'plaine' && rank === 1) // le tout premier niveau reste le plus simple
  // MVP posé seulement sur un niveau tardif du biome (dernier ou avant-dernier terrain)
  const useMvp = pool.mvp && rank >= 2
  const base = {
    id, name, biome,
    tierCap: pool.tier,
    ending,
    ground: rotate(pool.ground, idx),
    birds: pool.birds,
    ...(pool.aquatic ? { aquatic: pool.aquatic } : {}),
    ...(useMvp ? { mvp: pool.mvp } : {}),
    midCount,
    allowLadders,
    stony: STONY_BIOMES.has(biome),
    caves: CAVE_BIOMES.has(biome),
    // En ENFER, les cuves marine deviennent de la LAVE (aucun coffre de plongée) : on garantit alors
    // au moins une CASCADE remontable (seule cuve qui pose un coffre en biome lave) → chaque niveau
    // conserve son coffre exigé par la registry de props.
    waterKinds: SPECIAL_WATER_LEVELS[id]
      ? SPECIAL_WATER_LEVELS[id]!
      : pool.lava && !WATER_ROT[idx % WATER_ROT.length]!.some((w) => w === 'cascade' || w === 'sortie-humide')
        ? (['bassin', 'cascade'] as ModuleKind[])
        : WATER_ROT[idx % WATER_ROT.length]!,
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
  const clean = (l: LevelDef) =>
    overStackedColumns(l, 3).length === 0 && unlevelWaterBanks(l).length === 0
    && suspendedWaterBanks(l).length === 0 && deadEndSurfaces(l).length === 0
    && unreachablePlatforms(l).length === 0 && laddersToNowhere(l).length === 0
    && unreachableLadders(l).length === 0 && unreachableChests(l).length === 0
    && oversizedGaps(l).length === 0 && oversizedLadders(l).length === 0
    && monstersOffSurface(l, isAerial).length === 0
  const salts = [`${id}-${ending}`, ...Array.from({ length: 80 }, (_, i) => `${id}-${ending}-${i}`)]
  let chosen = salts[0]!
  let level = composeLevel({ ...base, seed: chosen })
  for (const seed of salts) {
    const l = composeLevel({ ...base, seed })
    if (clean(l)) { level = l; chosen = seed; break }
  }
  LEVEL_MODULE_KINDS[id] = planModules({ ...(base as ComposeOpts), seed: chosen }).map((m) => m.kind)
  return level
}

// Une arène de boss : plateaux posés à la main pour esquiver les patterns, aucun monstre normal.
function arena(id: string, name: string, biome: string, boss: string, widthTiles: number, platforms: LevelDef['platforms']): LevelDef {
  return { id, name, biome, widthTiles, platforms, spawns: [], boss }
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
  arena('boss-01', 'Gardien de la Sylve', 'foret', 'boss-sylve', 40, [plat(8, 11, 4), plat(18, 10, 5), plat(28, 11, 4)]),
  // Désert (début)
  terrain('desert-1', 'Piste', 'desert', 1),
  terrain('desert-2', 'Dunes', 'desert', 2),
  terrain('desert-3', 'Erg', 'desert', 3),
  arena('boss-02', 'Pyramide du Pharaon', 'desert', 'pharaon-scarabee', 44, [plat(7, 12, 6), plat(13, 10, 5), plat(18, 8, 8), plat(26, 10, 5), plat(32, 12, 6)]),
  terrain('desert-4', 'Oasis', 'desert', 4),
  terrain('desert-5', 'Ravin', 'desert', 5),
  terrain('desert-6', 'Gorge', 'desert', 6),
  terrain('desert-7', 'Sables', 'desert', 7),
  terrain('desert-8', 'Carrefour', 'desert', 8),
  // Cave
  terrain('cave-1', 'Caverne', 'cave', 1),
  arena('boss-03', 'Cœur de la Caverne', 'cave', 'boss-golem-cave', 42, [plat(6, 12, 5), plat(15, 10, 5), plat(24, 10, 5), plat(33, 12, 5)]),
  // Jungle
  terrain('jungle-1', 'Palmeraie', 'jungle', 1),
  terrain('jungle-2', 'Jungle', 'jungle', 2),
  terrain('jungle-3', 'Canopée', 'jungle', 3),
  terrain('jungle-4', 'Fourré', 'jungle', 4),
  terrain('jungle-5', 'Marais', 'jungle', 5),
  arena('boss-04', 'Cœur de la Jungle', 'jungle', 'seigneur-liane', 42, [plat(5, 11, 4), plat(13, 10, 5), plat(24, 10, 5), plat(33, 11, 4)]),
  // Montagne
  terrain('desert-9', 'Col sec', 'desert', 9),
  terrain('montagne-1', 'Cimes', 'montagne', 1),
  terrain('montagne-2', 'Crête', 'montagne', 2),
  terrain('montagne-3', 'Névé', 'montagne', 3),
  arena('boss-05', 'Repaire du Yéti', 'montagne', 'boss-yeti', 46, [plat(6, 12, 5), plat(14, 10, 4), plat(24, 11, 5), plat(34, 10, 4), plat(40, 12, 4)]),
  // Cimetière
  terrain('cimetiere-1', 'Tombes', 'cimetiere', 1),
  terrain('cimetiere-2', 'Ossuaire', 'cimetiere', 2),
  arena('boss-06', 'Trône du Roi Liche', 'cimetiere', 'roi-liche', 44, [plat(6, 11, 6), plat(8, 9, 5), plat(17, 12, 10), plat(33, 11, 6), plat(31, 9, 5)]),
  // Plage
  terrain('desert-10', 'Fourche', 'desert', 10),
  terrain('plage-1', 'Rivage', 'plage', 1),
  terrain('plage-2', 'Lagon', 'plage', 2),
  terrain('plage-3', 'Récif', 'plage', 3),
  terrain('plage-4', 'Corail', 'plage', 4),
  arena('boss-07', 'Antre du Roi Crabe', 'plage', 'boss-crabe', 42, [plat(6, 12, 5), plat(15, 10, 5), plat(24, 10, 5), plat(33, 12, 5)]),
  // Carrière
  terrain('carriere-1', 'Carrière', 'carriere', 1),
  arena('boss-08', 'Pic du Golem Ancien', 'carriere', 'golem-ancien', 46, [plat(6, 12, 5), plat(14, 10, 4), plat(24, 11, 5), plat(34, 10, 4), plat(40, 12, 4)]),
  // Enfer (zone finale)
  terrain('desert-11', 'Braise', 'desert', 11),
  terrain('enfer-1', 'Sentier', 'enfer', 1),
  terrain('enfer-2', 'Cendres', 'enfer', 2),
  terrain('enfer-3', 'Fournaise', 'enfer', 3),
  terrain('enfer-4', 'Coulée', 'enfer', 4),
  terrain('enfer-5', 'Brasier', 'enfer', 5),
  terrain('enfer-6', 'Abîme', 'enfer', 6),
  terrain('enfer-7', 'Géhenne', 'enfer', 7),
  arena('boss-09', 'Antre du Seigneur Déchu', 'enfer', 'seigneur-dechu', 50, [plat(6, 12, 5), plat(15, 10, 7), plat(23, 8, 7), plat(31, 10, 7), plat(42, 12, 5)]),
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
