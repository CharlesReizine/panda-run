export type Biome = string // clé du registre BIOMES

export interface LevelDef {
  id: string
  name: string
  biome: Biome
  widthTiles: number
  platforms: { x: number; y: number; w: number }[] // en tuiles ; y depuis le haut (16 lignes visibles)
  spawns: { monsterId: string; x: number }[] // x en tuiles
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number }[] // spikes = danger ; water = zone nageable (x, largeur en tuiles)
  bridges?: { x: number; y: number; w: number }[] // ponts de planches (plateformes fines)
  ladders?: { x: number; y: number; h: number }[] // échelles (x tuile, y tuile du haut, hauteur en tuiles)
  checkpoints?: { x: number }[] // drapeaux de réapparition (x en tuiles)
  boss?: string
}

const plat = (x: number, y: number, w: number) => ({ x, y, w })
const prop = (kind: string, x: number, y?: number) => ({ kind, x, y })
const ladder = (x: number, y: number, h: number) => ({ x, y, h })

const list: LevelDef[] = [
  { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', widthTiles: 90,
    platforms: [plat(22, 11, 5), plat(26, 8, 4), plat(55, 11, 4)],
    spawns: [{ monsterId: 'gloopy', x: 12 }, { monsterId: 'angeling', x: 25 }, { monsterId: 'fabre', x: 38 }, { monsterId: 'gloopy', x: 50 }, { monsterId: 'mandragore', x: 62 }, { monsterId: 'gloopy', x: 75 }],
    props: [prop('herbe', 10), prop('champignon', 44), prop('herbe', 68), prop('coffre', 7), prop('coffre', 28, 7)],
    ladders: [ladder(54, 11, 3)] },
  { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', widthTiles: 100,
    platforms: [plat(15, 12, 5), plat(40, 11, 4), plat(44, 8, 4), plat(75, 11, 5)],
    spawns: [{ monsterId: 'gloopy', x: 18 }, { monsterId: 'mandragore', x: 48 }, { monsterId: 'gloopy', x: 58 }, { monsterId: 'mandragore', x: 65 }, { monsterId: 'lunatic', x: 76 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 12), prop('champignon', 52), prop('herbe', 90), prop('coffre', 8), prop('coffre', 46, 7)] },
  { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', widthTiles: 100,
    platforms: [plat(20, 11, 4), plat(24, 8, 4), plat(28, 5, 4), plat(60, 10, 4)],
    // le gardien sylve bloque le chemin au sol sous l'escalier de plateformes (20→32) : il faut
    // grimper pour le contourner plutôt que d'affronter ce piège quasi increvable
    spawns: [{ monsterId: 'louveteau', x: 14 }, { monsterId: 'gardien-sylve', x: 26 }, { monsterId: 'mandragore', x: 44 }, { monsterId: 'poporing', x: 55 }, { monsterId: 'mandragore', x: 70 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 8), prop('champignon', 48), prop('herbe', 95), prop('coffre', 10), prop('coffre', 30, 4)],
    ladders: [ladder(59, 10, 4)] },
  { id: 'zone1-4', name: 'Forêt profonde', biome: 'foret', widthTiles: 110,
    platforms: [plat(20, 11, 5), plat(48, 12, 6), plat(80, 11, 4), plat(84, 8, 4)],
    spawns: [{ monsterId: 'louveteau', x: 14 }, { monsterId: 'willow', x: 30 }, { monsterId: 'louveteau', x: 44 }, { monsterId: 'rocker', x: 55 }, { monsterId: 'louveteau', x: 62 }, { monsterId: 'louveteau', x: 90 }, { monsterId: 'mandragore', x: 100 }],
    props: [prop('herbe', 10), prop('champignon', 65), prop('herbe', 105), prop('coffre', 50, 11), prop('coffre', 86, 7)] },
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-gloopy' },
  { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert', widthTiles: 100,
    platforms: [plat(28, 11, 4), plat(46, 11, 4), plat(50, 8, 4), plat(78, 10, 4)],
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'scorpion', x: 62 }, { monsterId: 'vautour', x: 68 }, { monsterId: 'orc-guerrier', x: 74 }, { monsterId: 'scorpion', x: 88 }],
    props: [prop('roche', 12), prop('herbe', 40), prop('roche', 90), prop('coffre', 52, 7)] },
  { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert', widthTiles: 110,
    platforms: [plat(22, 11, 4), plat(26, 8, 4), plat(30, 5, 4), plat(78, 11, 4), plat(82, 8, 4)],
    // gardien pierre posté sous l'escalier de plateformes (22→34) : détour obligatoire par le haut
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'gardien-pierre', x: 27 }, { monsterId: 'momie', x: 48 }, { monsterId: 'vautour', x: 60 }, { monsterId: 'momie', x: 70 }, { monsterId: 'scorpion', x: 100 }],
    props: [prop('roche', 10), prop('herbe', 52), prop('roche', 70), prop('herbe', 105), prop('coffre', 32, 4), prop('coffre', 84, 7)],
    ladders: [ladder(77, 11, 3)] },
  { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert', widthTiles: 110,
    platforms: [plat(30, 12, 6), plat(60, 11, 4), plat(64, 8, 4), plat(95, 11, 4)],
    spawns: [{ monsterId: 'momie', x: 14 }, { monsterId: 'vautour', x: 48 }, { monsterId: 'zombie', x: 72 }, { monsterId: 'vautour', x: 82 }, { monsterId: 'momie', x: 90 }, { monsterId: 'mini-baphomet', x: 105 }],
    props: [prop('roche', 12), prop('herbe', 44), prop('roche', 105), prop('coffre', 66, 7)] },
  { id: 'cave-1', name: 'Cave aux échos', biome: 'cave', widthTiles: 105,
    platforms: [plat(18, 11, 4), plat(22, 8, 4), plat(26, 5, 4), plat(58, 11, 4), plat(62, 8, 4)],
    spawns: [{ monsterId: 'chauve-souris', x: 14 }, { monsterId: 'squelette', x: 44 }, { monsterId: 'fantome', x: 50 }, { monsterId: 'mage-noir', x: 76 }, { monsterId: 'chauve-souris', x: 70 }, { monsterId: 'squelette', x: 82 }, { monsterId: 'chauve-souris', x: 95 }],
    props: [prop('roche', 10), prop('champignon', 42), prop('roche', 90), prop('coffre', 28, 4), prop('coffre', 64, 7)],
    ladders: [ladder(57, 11, 3)] },
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
  // Zone 3 — jungle (+ route alternative plage)
  { id: 'zone3-1', name: 'Lisière de la jungle', biome: 'jungle', widthTiles: 130,
    platforms: [plat(15, 11, 5), plat(20, 8, 4), plat(24, 5, 4), plat(45, 12, 6), plat(56, 11, 4), plat(60, 9, 4), plat(66, 6, 4), plat(80, 10, 5), plat(95, 13, 6), plat(105, 11, 4), plat(110, 10, 4), plat(115, 7, 4)],
    // gardien sylve sous l'escalier de plateformes (56→70) : contournement par le haut
    spawns: [{ monsterId: 'poporing', x: 10 }, { monsterId: 'frelon-geant', x: 22 }, { monsterId: 'singe-grimpeur', x: 40 }, { monsterId: 'flora-vorace', x: 52 }, { monsterId: 'gardien-sylve', x: 63 }, { monsterId: 'singe-grimpeur', x: 88 }, { monsterId: 'flora-vorace', x: 100 }, { monsterId: 'frelon-geant', x: 118 }],
    props: [prop('champignon', 18), prop('herbe', 48), prop('champignon', 92), prop('coffre', 12), prop('coffre', 57, 10)],
    hazards: [{ kind: 'water', x: 33, w: 5 }],
    bridges: [{ x: 32, y: 13, w: 7 }],
    ladders: [ladder(79, 10, 4)],
    checkpoints: [{ x: 45 }, { x: 90 }] },
  { id: 'zone3-2', name: 'Marécages suspendus', biome: 'jungle', widthTiles: 140,
    platforms: [plat(18, 12, 4), plat(24, 9, 4), plat(30, 6, 4), plat(50, 11, 5), plat(70, 13, 5), plat(85, 10, 4), plat(90, 7, 4), plat(96, 4, 4), plat(115, 11, 5), plat(125, 13, 5)],
    spawns: [{ monsterId: 'frelon-geant', x: 12 }, { monsterId: 'singe-grimpeur', x: 26 }, { monsterId: 'flora-vorace', x: 45 }, { monsterId: 'frelon-geant', x: 65 }, { monsterId: 'singe-grimpeur', x: 80 }, { monsterId: 'flora-vorace', x: 95 }, { monsterId: 'frelon-geant', x: 110 }, { monsterId: 'singe-grimpeur', x: 130 }],
    props: [prop('champignon', 22), prop('herbe', 55), prop('champignon', 120), prop('coffre', 15), prop('coffre', 86, 9)],
    hazards: [{ kind: 'water', x: 40, w: 6 }, { kind: 'spikes', x: 60, w: 4 }, { kind: 'water', x: 105, w: 5 }],
    bridges: [{ x: 39, y: 13, w: 8 }, { x: 104, y: 13, w: 7 }],
    checkpoints: [{ x: 55 }, { x: 95 }] },
  { id: 'zone3-boss', name: 'Cœur de la Jungle', biome: 'jungle', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-liane' },
  { id: 'plage-1', name: 'Rivage de corail', biome: 'plage', widthTiles: 110,
    platforms: [plat(16, 11, 4), plat(20, 8, 4), plat(40, 12, 5), plat(60, 13, 4), plat(64, 10, 4), plat(70, 7, 4), plat(90, 11, 5), plat(100, 13, 4)],
    spawns: [{ monsterId: 'crabe-geant', x: 12 }, { monsterId: 'meduse', x: 24 }, { monsterId: 'crabe-geant', x: 45 }, { monsterId: 'meduse', x: 55 }, { monsterId: 'crabe-geant', x: 68 }, { monsterId: 'meduse', x: 85 }, { monsterId: 'crabe-geant', x: 95 }, { monsterId: 'meduse', x: 104 }],
    props: [prop('roche', 20), prop('herbe', 50), prop('roche', 92), prop('coffre', 14), prop('coffre', 61, 12)],
    hazards: [{ kind: 'water', x: 30, w: 5 }, { kind: 'spikes', x: 80, w: 4 }],
    bridges: [{ x: 29, y: 13, w: 7 }] },
  { id: 'plage-2', name: 'Récif immergé', biome: 'plage', widthTiles: 120,
    platforms: [plat(14, 12, 4), plat(18, 9, 4), plat(22, 6, 4), plat(45, 11, 5), plat(65, 13, 4), plat(70, 10, 4), plat(75, 13, 4), plat(80, 10, 4), plat(100, 12, 5), plat(115, 10, 4)],
    spawns: [{ monsterId: 'meduse', x: 10 }, { monsterId: 'crabe-geant', x: 28 }, { monsterId: 'meduse', x: 42 }, { monsterId: 'crabe-geant', x: 60 }, { monsterId: 'meduse', x: 72 }, { monsterId: 'crabe-geant', x: 90 }, { monsterId: 'meduse', x: 105 }, { monsterId: 'crabe-geant', x: 118 }],
    props: [prop('roche', 30), prop('herbe', 58), prop('roche', 108), prop('coffre', 16), prop('coffre', 46, 10)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'water', x: 90, w: 5 }],
    bridges: [{ x: 34, y: 13, w: 7 }, { x: 89, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 78 }] },
  // Zone 4 — montagne (+ route alternative carrière)
  { id: 'zone4-1', name: 'Sentier des cimes', biome: 'montagne', widthTiles: 135,
    platforms: [plat(16, 11, 4), plat(20, 8, 4), plat(24, 5, 4), plat(45, 12, 6), plat(65, 13, 4), plat(69, 10, 4), plat(73, 7, 4), plat(95, 11, 5), plat(110, 13, 4), plat(118, 10, 4), plat(122, 7, 4)],
    spawns: [{ monsterId: 'harpie', x: 12 }, { monsterId: 'yeti', x: 28 }, { monsterId: 'harpie', x: 42 }, { monsterId: 'yeti', x: 58 }, { monsterId: 'harpie', x: 72 }, { monsterId: 'yeti', x: 88 }, { monsterId: 'harpie', x: 105 }, { monsterId: 'yeti', x: 125 }],
    props: [prop('roche', 18), prop('herbe', 48), prop('roche', 100), prop('coffre', 10), prop('coffre', 46, 11)],
    hazards: [{ kind: 'water', x: 55, w: 5 }, { kind: 'spikes', x: 100, w: 4 }],
    bridges: [{ x: 54, y: 13, w: 7 }],
    ladders: [ladder(94, 11, 3)],
    checkpoints: [{ x: 45 }, { x: 90 }] },
  { id: 'zone4-2', name: 'Col glacé', biome: 'montagne', widthTiles: 145,
    platforms: [plat(14, 12, 4), plat(18, 9, 4), plat(22, 6, 4), plat(42, 13, 5), plat(55, 10, 4), plat(60, 13, 4), plat(66, 11, 4), plat(80, 12, 4), plat(84, 9, 4), plat(88, 6, 4), plat(105, 11, 5), plat(120, 13, 5), plat(130, 10, 4), plat(135, 7, 4)],
    spawns: [{ monsterId: 'yeti', x: 10 }, { monsterId: 'harpie', x: 26 }, { monsterId: 'yeti', x: 40 }, { monsterId: 'harpie', x: 58 }, { monsterId: 'yeti', x: 72 }, { monsterId: 'harpie', x: 86 }, { monsterId: 'yeti', x: 102 }, { monsterId: 'harpie', x: 118 }, { monsterId: 'yeti', x: 138 }],
    props: [prop('roche', 20), prop('champignon', 52), prop('roche', 110), prop('coffre', 16), prop('coffre', 81, 11)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'spikes', x: 95, w: 4 }, { kind: 'water', x: 115, w: 4 }],
    bridges: [{ x: 34, y: 13, w: 7 }, { x: 114, y: 13, w: 6 }],
    checkpoints: [{ x: 50 }, { x: 105 }] },
  { id: 'zone4-boss', name: 'Pic du Golem Ancien', biome: 'montagne', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'golem-ancien' },
  { id: 'carriere-1', name: 'Carrière abandonnée', biome: 'carriere', widthTiles: 115,
    platforms: [plat(16, 12, 5), plat(35, 13, 4), plat(39, 10, 4), plat(43, 7, 4), plat(60, 11, 5), plat(75, 13, 4), plat(85, 12, 4), plat(89, 9, 4), plat(100, 10, 5)],
    // gardien pierre sous l'escalier de plateformes (35→47) : contournement par le haut
    spawns: [{ monsterId: 'golem-de-pierre', x: 10 }, { monsterId: 'gobelin-mineur', x: 22 }, { monsterId: 'golem-de-pierre', x: 32 }, { monsterId: 'gardien-pierre', x: 41 }, { monsterId: 'golem-de-pierre', x: 58 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 82 }, { monsterId: 'gobelin-mineur', x: 95 }, { monsterId: 'golem-de-pierre', x: 108 }],
    props: [prop('roche', 20), prop('roche', 55), prop('roche', 95), prop('coffre', 12), prop('coffre', 61, 10)],
    hazards: [{ kind: 'spikes', x: 25, w: 4 }, { kind: 'water', x: 65, w: 5 }],
    bridges: [{ x: 64, y: 13, w: 7 }] },
  { id: 'carriere-2', name: 'Fosse des golems', biome: 'carriere', widthTiles: 120,
    platforms: [plat(15, 13, 4), plat(19, 10, 4), plat(23, 7, 4), plat(45, 11, 5), plat(60, 12, 4), plat(64, 9, 4), plat(68, 12, 4), plat(85, 13, 5), plat(100, 11, 4), plat(104, 8, 4), plat(108, 5, 4)],
    spawns: [{ monsterId: 'gobelin-mineur', x: 10 }, { monsterId: 'golem-de-pierre', x: 26 }, { monsterId: 'gobelin-mineur', x: 40 }, { monsterId: 'golem-de-pierre', x: 55 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 80 }, { monsterId: 'gobelin-mineur', x: 92 }, { monsterId: 'golem-de-pierre', x: 105 }, { monsterId: 'gobelin-mineur', x: 115 }],
    props: [prop('roche', 18), prop('champignon', 50), prop('roche', 95), prop('coffre', 14), prop('coffre', 46, 10)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'spikes', x: 78, w: 4 }],
    bridges: [{ x: 34, y: 13, w: 7 }],
    checkpoints: [{ x: 55 }, { x: 100 }] },
  // Zone 5 — cimetière
  { id: 'zone5-1', name: 'Nécropole oubliée', biome: 'cimetiere', widthTiles: 140,
    platforms: [plat(16, 12, 4), plat(20, 9, 4), plat(24, 6, 4), plat(45, 11, 5), plat(60, 13, 4), plat(64, 10, 4), plat(70, 13, 4), plat(85, 12, 4), plat(89, 9, 4), plat(93, 6, 4), plat(110, 11, 5), plat(125, 13, 4)],
    spawns: [{ monsterId: 'goule', x: 10 }, { monsterId: 'banshee', x: 28 }, { monsterId: 'goule', x: 42 }, { monsterId: 'pretre-goule', x: 50 }, { monsterId: 'banshee', x: 58 }, { monsterId: 'goule', x: 72 }, { monsterId: 'banshee', x: 88 }, { monsterId: 'goule', x: 102 }, { monsterId: 'banshee', x: 118 }, { monsterId: 'goule', x: 132 }],
    props: [prop('roche', 22), prop('herbe', 52), prop('roche', 115), prop('coffre', 12), prop('coffre', 46, 10)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'spikes', x: 100, w: 4 }],
    bridges: [{ x: 34, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 90 }] },
  { id: 'zone5-2', name: 'Cryptes hurlantes', biome: 'cimetiere', widthTiles: 150,
    platforms: [plat(14, 12, 4), plat(18, 9, 4), plat(22, 6, 4), plat(42, 13, 5), plat(60, 11, 4), plat(64, 8, 4), plat(68, 5, 4), plat(85, 12, 5), plat(100, 10, 4), plat(104, 13, 4), plat(110, 11, 4), plat(125, 12, 4), plat(129, 9, 4), plat(133, 6, 4)],
    spawns: [{ monsterId: 'banshee', x: 10 }, { monsterId: 'goule', x: 26 }, { monsterId: 'banshee', x: 38 }, { monsterId: 'goule', x: 55 }, { monsterId: 'banshee', x: 66 }, { monsterId: 'goule', x: 80 }, { monsterId: 'banshee', x: 92 }, { monsterId: 'goule', x: 108 }, { monsterId: 'banshee', x: 120 }, { monsterId: 'goule', x: 140 }],
    props: [prop('roche', 24), prop('champignon', 58), prop('roche', 122), prop('coffre', 16), prop('coffre', 86, 11)],
    hazards: [{ kind: 'water', x: 32, w: 5 }, { kind: 'water', x: 95, w: 4 }, { kind: 'spikes', x: 118, w: 4 }],
    bridges: [{ x: 31, y: 13, w: 7 }, { x: 94, y: 13, w: 6 }],
    checkpoints: [{ x: 50 }, { x: 108 }] },
  { id: 'zone5-boss', name: 'Trône du Roi Liche', biome: 'cimetiere', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-liche' },
  // Zone 6 — enfer (zone finale)
  { id: 'zone6-1', name: 'Sentier des Damnés', biome: 'enfer', widthTiles: 155,
    platforms: [plat(16, 12, 4), plat(20, 9, 4), plat(24, 6, 4), plat(42, 11, 5), plat(58, 13, 4), plat(62, 10, 4), plat(68, 13, 4), plat(80, 12, 4), plat(84, 9, 4), plat(88, 6, 4), plat(105, 11, 5), plat(122, 12, 4), plat(126, 9, 4), plat(130, 6, 4), plat(145, 13, 5)],
    // gardien flamme sous l'escalier de plateformes (122→134) : contournement par le haut
    spawns: [{ monsterId: 'diablotin', x: 10 }, { monsterId: 'gargouille', x: 28 }, { monsterId: 'diablotin', x: 40 }, { monsterId: 'gargouille', x: 55 }, { monsterId: 'diablotin', x: 66 }, { monsterId: 'gargouille', x: 78 }, { monsterId: 'diablotin', x: 92 }, { monsterId: 'gargouille', x: 108 }, { monsterId: 'gardien-flamme', x: 127 }, { monsterId: 'gargouille', x: 135 }, { monsterId: 'diablotin', x: 148 }],
    props: [prop('roche', 30), prop('champignon', 70), prop('roche', 140), prop('coffre', 14), prop('coffre', 43, 10), prop('coffre', 150)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'water', x: 95, w: 5 }, { kind: 'spikes', x: 115, w: 4 }, { kind: 'spikes', x: 138, w: 4 }],
    bridges: [{ x: 34, y: 13, w: 7 }, { x: 94, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 108 }] },
  { id: 'zone6-boss', name: 'Antre du Seigneur Déchu', biome: 'enfer', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-dechu' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
