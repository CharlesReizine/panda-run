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

// RÈGLES DE VERTICALITÉ (toutes vérifiées par level-validator.ts, saut SIMPLE) :
// - saut max ≈ 4 tuiles de haut ; le SOL couvre toute la largeur (écart horizontal = 0 vers
//   n'importe quelle plateforme), donc toute plateforme à la rangée ≥ 10 est atteignable du sol.
// - pour MONTER plus haut on enchaîne des paliers : +4 ou +3 rangées → écart ≤ 2 tuiles ; +2/+1
//   ou même rangée → écart ≤ 3 ; en DESCENDANT → écart ≤ 4.
// - échelle : hauteur ≥ 9 tuiles, pied au sol (l.y + h ≥ 14), palier de sommet posé 1 à 2
//   rangées SOUS le haut du montant (l.y+1..l.y+2) et adjacent horizontalement.
// Chaque niveau normal a un PROFIL DISTINCT (nb d'étages, position des échelles, alternance
// haut/bas, pics/eau) : escalier, buttes, tour d'échelle, vallée, zigzag, colonnes, cimes…

const list: LevelDef[] = [
  // zone1-1 : escalier montant doux (11→5) + tour d'échelle à droite (palier row7 → sommet)
  { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', widthTiles: 90,
    platforms: [plat(12, 11, 5), plat(20, 9, 4), plat(27, 7, 4), plat(34, 5, 4), plat(50, 10, 5), plat(66, 7, 4)],
    spawns: [{ monsterId: 'gloopy', x: 12 }, { monsterId: 'angeling', x: 25 }, { monsterId: 'fabre', x: 38 }, { monsterId: 'poring-dore', x: 44 }, { monsterId: 'gloopy', x: 50 }, { monsterId: 'mandragore', x: 62 }, { monsterId: 'gloopy', x: 75 }],
    props: [prop('herbe', 10), prop('champignon', 44), prop('herbe', 68), prop('coffre', 7), prop('coffre', 35, 4)],
    ladders: [ladder(70, 5, 9)] },
  // zone1-2 : deux buttes qui montent (row4) encadrant une descente centrale au-dessus d'un bassin
  { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', widthTiles: 100,
    platforms: [plat(14, 10, 5), plat(21, 7, 4), plat(27, 4, 4), plat(45, 12, 4), plat(55, 13, 4), plat(70, 10, 4), plat(77, 8, 4), plat(84, 6, 4)],
    spawns: [{ monsterId: 'gloopy', x: 18 }, { monsterId: 'mandragore', x: 48 }, { monsterId: 'gloopy', x: 58 }, { monsterId: 'mandragore', x: 65 }, { monsterId: 'lunatic', x: 76 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 12), prop('champignon', 52), prop('herbe', 90), prop('coffre', 8), prop('coffre', 28, 3)],
    hazards: [{ kind: 'water', x: 48, w: 6 }],
    bridges: [{ x: 47, y: 13, w: 8 }] },
  // zone1-3 : tour d'échelle plein gauche (row4) menant à une plateforme très haute (row3) + îlots
  { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', widthTiles: 100,
    platforms: [plat(14, 6, 4), plat(20, 3, 4), plat(40, 11, 4), plat(47, 9, 4), plat(54, 7, 4), plat(72, 10, 5), plat(85, 10, 4)],
    spawns: [{ monsterId: 'louveteau', x: 14 }, { monsterId: 'gardien-sylve', x: 26 }, { monsterId: 'mandragore', x: 44 }, { monsterId: 'poporing', x: 55 }, { monsterId: 'mandragore', x: 70 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 8), prop('champignon', 48), prop('herbe', 95), prop('coffre', 10), prop('coffre', 21, 2)],
    ladders: [ladder(18, 4, 10)] },
  // zone1-4 : vallée haut→bas→haut, gouffre de pics au centre, coffre bas (fond) et coffre haut
  { id: 'zone1-4', name: 'Forêt profonde', biome: 'foret', widthTiles: 110,
    platforms: [plat(14, 10, 5), plat(21, 7, 4), plat(38, 12, 4), plat(46, 13, 5), plat(64, 10, 4), plat(71, 8, 4), plat(78, 6, 4), plat(95, 11, 4)],
    spawns: [{ monsterId: 'louveteau', x: 14 }, { monsterId: 'willow', x: 30 }, { monsterId: 'louveteau', x: 44 }, { monsterId: 'rocker', x: 55 }, { monsterId: 'louveteau', x: 62 }, { monsterId: 'louveteau', x: 90 }, { monsterId: 'mandragore', x: 100 }],
    props: [prop('herbe', 10), prop('champignon', 65), prop('herbe', 105), prop('coffre', 47, 12), prop('coffre', 81, 5)],
    hazards: [{ kind: 'spikes', x: 52, w: 4 }] },
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-gloopy' },
  // zone2-1 : longue montée en zigzag jusqu'à un sommet (row3) puis redescente à droite ; pics au sol
  { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert', widthTiles: 100,
    platforms: [plat(16, 11, 4), plat(23, 9, 4), plat(30, 7, 4), plat(37, 5, 4), plat(44, 3, 4), plat(62, 11, 4), plat(69, 9, 4), plat(78, 10, 4), plat(88, 12, 4)],
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'orc-seigneur', x: 38 }, { monsterId: 'scorpion', x: 62 }, { monsterId: 'vautour', x: 68 }, { monsterId: 'orc-guerrier', x: 74 }, { monsterId: 'scorpion', x: 88 }],
    props: [prop('roche', 12), prop('herbe', 40), prop('roche', 90), prop('coffre', 10), prop('coffre', 45, 2)],
    hazards: [{ kind: 'spikes', x: 54, w: 4 }] },
  // zone2-2 : échelle centrale + grand plateau haut (row4) au-dessus d'un gouffre d'eau ; pics à droite
  { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert', widthTiles: 110,
    platforms: [plat(14, 11, 4), plat(20, 9, 4), plat(26, 7, 4), plat(32, 4, 4), plat(38, 4, 7), plat(60, 10, 4), plat(67, 8, 4), plat(85, 11, 4), plat(93, 11, 4)],
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'gardien-pierre', x: 27 }, { monsterId: 'momie', x: 48 }, { monsterId: 'vautour', x: 60 }, { monsterId: 'momie', x: 70 }, { monsterId: 'scorpion', x: 100 }],
    props: [prop('roche', 10), prop('herbe', 52), prop('roche', 70), prop('herbe', 105), prop('coffre', 12), prop('coffre', 40, 3)],
    hazards: [{ kind: 'water', x: 48, w: 6 }, { kind: 'spikes', x: 78, w: 4 }],
    bridges: [{ x: 47, y: 13, w: 8 }],
    ladders: [ladder(30, 5, 9)] },
  // zone2-3 : on démarre dans une fosse basse (row12/13) avec des pics, puis on grimpe un pic (row4)
  { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert', widthTiles: 110,
    platforms: [plat(20, 13, 5), plat(30, 12, 4), plat(48, 11, 5), plat(60, 10, 4), plat(67, 8, 4), plat(74, 6, 4), plat(81, 4, 4), plat(98, 11, 4)],
    spawns: [{ monsterId: 'momie', x: 14 }, { monsterId: 'vautour', x: 48 }, { monsterId: 'zombie', x: 72 }, { monsterId: 'vautour', x: 82 }, { monsterId: 'momie', x: 90 }, { monsterId: 'mini-baphomet', x: 105 }],
    props: [prop('roche', 12), prop('herbe', 44), prop('roche', 105), prop('coffre', 14), prop('coffre', 82, 3)],
    hazards: [{ kind: 'spikes', x: 38, w: 4 }] },
  // cave-1 : trois étagères empilées à gauche (11/8/5) + échelle vers un balcon (row4) ; pics au sol
  { id: 'cave-1', name: 'Cave aux échos', biome: 'cave', widthTiles: 105,
    platforms: [plat(16, 11, 6), plat(20, 8, 6), plat(24, 5, 6), plat(56, 7, 4), plat(62, 4, 4), plat(80, 11, 4), plat(87, 9, 4)],
    spawns: [{ monsterId: 'chauve-souris', x: 14 }, { monsterId: 'squelette', x: 44 }, { monsterId: 'fantome', x: 50 }, { monsterId: 'mage-noir', x: 76 }, { monsterId: 'chauve-souris', x: 70 }, { monsterId: 'squelette', x: 82 }, { monsterId: 'chauve-souris', x: 95 }],
    props: [prop('roche', 10), prop('champignon', 42), prop('roche', 90), prop('coffre', 10), prop('coffre', 28, 4)],
    hazards: [{ kind: 'spikes', x: 44, w: 4 }],
    ladders: [ladder(60, 5, 9)] },
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
  // Zone 3 — jungle (+ route alternative plage)
  // zone3-1 : canopée haute (row5) au-dessus d'un ruisseau à pont + échelle vers cime (row4) + bas
  { id: 'zone3-1', name: 'Lisière de la jungle', biome: 'jungle', widthTiles: 130,
    platforms: [plat(12, 11, 5), plat(19, 8, 4), plat(25, 5, 4), plat(45, 12, 6), plat(56, 10, 4), plat(71, 7, 4), plat(77, 4, 4), plat(95, 13, 6), plat(105, 11, 4), plat(112, 9, 4)],
    spawns: [{ monsterId: 'poporing', x: 10 }, { monsterId: 'frelon-geant', x: 22 }, { monsterId: 'singe-grimpeur', x: 40 }, { monsterId: 'flora-vorace', x: 52 }, { monsterId: 'gardien-sylve', x: 63 }, { monsterId: 'singe-grimpeur', x: 88 }, { monsterId: 'flora-vorace', x: 100 }, { monsterId: 'frelon-geant', x: 118 }],
    props: [prop('champignon', 18), prop('herbe', 48), prop('champignon', 92), prop('coffre', 12), prop('coffre', 26, 4), prop('coffre', 57, 9)],
    hazards: [{ kind: 'water', x: 33, w: 5 }],
    bridges: [{ x: 32, y: 13, w: 7 }],
    ladders: [ladder(75, 5, 9)],
    checkpoints: [{ x: 45 }, { x: 90 }] },
  // zone3-2 : marécage suspendu, alternance haut (row4) / bas (row13), deux bassins et un pic mortel
  { id: 'zone3-2', name: 'Marécages suspendus', biome: 'jungle', widthTiles: 140,
    platforms: [plat(16, 10, 4), plat(22, 7, 4), plat(28, 4, 4), plat(52, 11, 5), plat(62, 13, 4), plat(80, 10, 4), plat(87, 8, 4), plat(94, 6, 4), plat(115, 11, 5), plat(125, 13, 5)],
    spawns: [{ monsterId: 'frelon-geant', x: 12 }, { monsterId: 'singe-grimpeur', x: 26 }, { monsterId: 'flora-vorace', x: 45 }, { monsterId: 'frelon-geant', x: 65 }, { monsterId: 'singe-grimpeur', x: 80 }, { monsterId: 'flora-vorace', x: 95 }, { monsterId: 'frelon-geant', x: 110 }, { monsterId: 'singe-grimpeur', x: 130 }],
    props: [prop('champignon', 22), prop('herbe', 55), prop('champignon', 120), prop('coffre', 15), prop('coffre', 29, 3), prop('coffre', 88, 7)],
    hazards: [{ kind: 'water', x: 40, w: 6 }, { kind: 'spikes', x: 68, w: 4 }, { kind: 'water', x: 110, w: 5 }],
    bridges: [{ x: 39, y: 13, w: 8 }, { x: 109, y: 13, w: 7 }],
    checkpoints: [{ x: 55 }, { x: 95 }] },
  { id: 'zone3-boss', name: 'Cœur de la Jungle', biome: 'jungle', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-liane' },
  // plage-1 : récifs montants (11→5) au-dessus d'un lagon à pont, puis descente et pics
  { id: 'plage-1', name: 'Rivage de corail', biome: 'plage', widthTiles: 110,
    platforms: [plat(14, 11, 4), plat(21, 9, 4), plat(28, 7, 4), plat(34, 5, 4), plat(58, 12, 4), plat(66, 10, 4), plat(73, 8, 4), plat(92, 11, 5), plat(102, 13, 4)],
    spawns: [{ monsterId: 'crabe-geant', x: 12 }, { monsterId: 'meduse', x: 24 }, { monsterId: 'crabe-geant', x: 45 }, { monsterId: 'roi-crabe', x: 50 }, { monsterId: 'meduse', x: 55 }, { monsterId: 'crabe-geant', x: 68 }, { monsterId: 'meduse', x: 85 }, { monsterId: 'crabe-geant', x: 95 }, { monsterId: 'meduse', x: 104 }],
    props: [prop('roche', 20), prop('herbe', 50), prop('roche', 92), prop('coffre', 14), prop('coffre', 35, 4), prop('coffre', 59, 11)],
    hazards: [{ kind: 'water', x: 44, w: 5 }, { kind: 'spikes', x: 82, w: 4 }],
    bridges: [{ x: 43, y: 13, w: 7 }] },
  // plage-2 : colonnes en dents de scie (montées row6/row7 séparées par deux lagons à ponts)
  { id: 'plage-2', name: 'Récif immergé', biome: 'plage', widthTiles: 120,
    platforms: [plat(14, 12, 4), plat(20, 9, 4), plat(26, 6, 4), plat(46, 11, 5), plat(58, 13, 4), plat(66, 10, 4), plat(72, 7, 4), plat(100, 12, 5), plat(112, 10, 4)],
    spawns: [{ monsterId: 'meduse', x: 10 }, { monsterId: 'crabe-geant', x: 28 }, { monsterId: 'meduse', x: 42 }, { monsterId: 'crabe-geant', x: 60 }, { monsterId: 'meduse', x: 72 }, { monsterId: 'crabe-geant', x: 90 }, { monsterId: 'meduse', x: 105 }, { monsterId: 'crabe-geant', x: 118 }],
    props: [prop('roche', 30), prop('herbe', 58), prop('roche', 108), prop('coffre', 16), prop('coffre', 27, 5), prop('coffre', 47, 10)],
    hazards: [{ kind: 'water', x: 35, w: 5 }, { kind: 'water', x: 88, w: 5 }],
    bridges: [{ x: 34, y: 13, w: 7 }, { x: 87, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 78 }] },
  // Zone 4 — montagne (+ route alternative carrière)
  // zone4-1 : ascension de cime jusqu'à row2 (le point le plus haut du jeu) + échelle-cime à droite
  { id: 'zone4-1', name: 'Sentier des cimes', biome: 'montagne', widthTiles: 135,
    platforms: [plat(16, 11, 4), plat(22, 8, 4), plat(28, 5, 4), plat(34, 2, 4), plat(62, 12, 4), plat(70, 10, 4), plat(88, 7, 4), plat(94, 4, 4), plat(112, 11, 4), plat(120, 13, 4)],
    spawns: [{ monsterId: 'harpie', x: 12 }, { monsterId: 'yeti', x: 28 }, { monsterId: 'harpie', x: 42 }, { monsterId: 'yeti', x: 58 }, { monsterId: 'harpie', x: 72 }, { monsterId: 'yeti', x: 88 }, { monsterId: 'harpie', x: 105 }, { monsterId: 'yeti', x: 125 }],
    props: [prop('roche', 18), prop('herbe', 48), prop('roche', 100), prop('coffre', 10), prop('coffre', 35, 1), prop('coffre', 63, 11)],
    hazards: [{ kind: 'water', x: 48, w: 5 }, { kind: 'spikes', x: 78, w: 4 }],
    bridges: [{ x: 47, y: 13, w: 7 }],
    ladders: [ladder(92, 5, 9)],
    checkpoints: [{ x: 45 }, { x: 90 }] },
  // zone4-2 : col glacé, nombreux pics traîtres + étages, remontée finale (row5)
  { id: 'zone4-2', name: 'Col glacé', biome: 'montagne', widthTiles: 145,
    platforms: [plat(14, 10, 4), plat(20, 7, 4), plat(26, 4, 4), plat(56, 11, 4), plat(64, 13, 4), plat(72, 10, 4), plat(90, 11, 4), plat(96, 8, 4), plat(102, 5, 4), plat(128, 11, 5), plat(138, 13, 4)],
    spawns: [{ monsterId: 'yeti', x: 10 }, { monsterId: 'harpie', x: 26 }, { monsterId: 'yeti', x: 40 }, { monsterId: 'harpie', x: 58 }, { monsterId: 'yeti', x: 72 }, { monsterId: 'harpie', x: 86 }, { monsterId: 'yeti', x: 102 }, { monsterId: 'harpie', x: 118 }, { monsterId: 'yeti', x: 138 }],
    props: [prop('roche', 20), prop('champignon', 52), prop('roche', 110), prop('coffre', 16), prop('coffre', 27, 3), prop('coffre', 97, 7)],
    hazards: [{ kind: 'spikes', x: 36, w: 4 }, { kind: 'water', x: 44, w: 5 }, { kind: 'spikes', x: 80, w: 4 }, { kind: 'water', x: 115, w: 4 }],
    bridges: [{ x: 43, y: 13, w: 7 }, { x: 114, y: 13, w: 6 }],
    checkpoints: [{ x: 50 }, { x: 105 }] },
  { id: 'zone4-boss', name: 'Pic du Golem Ancien', biome: 'montagne', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'golem-ancien' },
  // carriere-1 : paliers de carrière montant droit (12→4), pics sous la montée, gouffre d'eau à pont
  { id: 'carriere-1', name: 'Carrière abandonnée', biome: 'carriere', widthTiles: 115,
    platforms: [plat(14, 12, 5), plat(22, 10, 4), plat(29, 8, 4), plat(36, 6, 4), plat(43, 4, 4), plat(76, 12, 4), plat(84, 10, 4), plat(91, 8, 4), plat(102, 10, 5)],
    spawns: [{ monsterId: 'golem-de-pierre', x: 10 }, { monsterId: 'gobelin-mineur', x: 22 }, { monsterId: 'golem-de-pierre', x: 32 }, { monsterId: 'gardien-pierre', x: 41 }, { monsterId: 'golem-de-pierre', x: 58 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 82 }, { monsterId: 'gobelin-mineur', x: 95 }, { monsterId: 'golem-de-pierre', x: 108 }],
    props: [prop('roche', 20), prop('roche', 55), prop('roche', 95), prop('coffre', 12), prop('coffre', 44, 3), prop('coffre', 77, 11)],
    hazards: [{ kind: 'spikes', x: 25, w: 4 }, { kind: 'water', x: 64, w: 5 }],
    bridges: [{ x: 63, y: 13, w: 7 }] },
  // carriere-2 : fosse profonde + tour d'escalade (13→5), puis fond bas et remontée droite (row7)
  { id: 'carriere-2', name: 'Fosse des golems', biome: 'carriere', widthTiles: 120,
    platforms: [plat(14, 13, 4), plat(22, 11, 4), plat(29, 9, 4), plat(36, 7, 4), plat(43, 5, 4), plat(62, 12, 4), plat(70, 10, 4), plat(88, 13, 5), plat(98, 11, 4), plat(105, 9, 4), plat(112, 7, 4)],
    spawns: [{ monsterId: 'gobelin-mineur', x: 10 }, { monsterId: 'golem-de-pierre', x: 26 }, { monsterId: 'gobelin-mineur', x: 40 }, { monsterId: 'golem-de-pierre', x: 55 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 80 }, { monsterId: 'gobelin-mineur', x: 92 }, { monsterId: 'golem-de-pierre', x: 105 }, { monsterId: 'gobelin-mineur', x: 115 }],
    props: [prop('roche', 18), prop('champignon', 50), prop('roche', 95), prop('coffre', 14), prop('coffre', 44, 4), prop('coffre', 89, 12)],
    hazards: [{ kind: 'water', x: 50, w: 5 }, { kind: 'spikes', x: 78, w: 4 }],
    bridges: [{ x: 49, y: 13, w: 7 }],
    checkpoints: [{ x: 55 }, { x: 100 }] },
  // Zone 5 — cimetière
  // zone5-1 : nécropole à étages, montée gauche (row5) puis creux/bosses et remontée droite (row7)
  { id: 'zone5-1', name: 'Nécropole oubliée', biome: 'cimetiere', widthTiles: 140,
    platforms: [plat(16, 11, 4), plat(23, 9, 4), plat(30, 7, 4), plat(36, 5, 4), plat(56, 12, 4), plat(64, 10, 4), plat(72, 13, 4), plat(84, 11, 4), plat(91, 9, 4), plat(98, 7, 4), plat(116, 11, 5), plat(128, 13, 4)],
    spawns: [{ monsterId: 'goule', x: 10 }, { monsterId: 'banshee', x: 28 }, { monsterId: 'goule', x: 42 }, { monsterId: 'pretre-goule', x: 50 }, { monsterId: 'banshee', x: 58 }, { monsterId: 'goule', x: 72 }, { monsterId: 'spectre-ancien', x: 78 }, { monsterId: 'banshee', x: 88 }, { monsterId: 'goule', x: 102 }, { monsterId: 'banshee', x: 118 }, { monsterId: 'goule', x: 132 }],
    props: [prop('roche', 22), prop('herbe', 52), prop('roche', 115), prop('coffre', 12), prop('coffre', 37, 4), prop('coffre', 85, 10)],
    hazards: [{ kind: 'water', x: 44, w: 5 }, { kind: 'spikes', x: 108, w: 4 }],
    bridges: [{ x: 43, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 90 }] },
  // zone5-2 : cryptes, vagues de montées/descentes répétées, flèche de crypte (row4) et pics
  { id: 'zone5-2', name: 'Cryptes hurlantes', biome: 'cimetiere', widthTiles: 150,
    platforms: [plat(14, 12, 4), plat(20, 9, 4), plat(26, 6, 4), plat(46, 11, 4), plat(54, 13, 4), plat(62, 10, 4), plat(68, 7, 4), plat(74, 4, 4), plat(98, 12, 5), plat(110, 10, 4), plat(128, 11, 4), plat(135, 9, 4)],
    spawns: [{ monsterId: 'banshee', x: 10 }, { monsterId: 'goule', x: 26 }, { monsterId: 'banshee', x: 38 }, { monsterId: 'goule', x: 55 }, { monsterId: 'banshee', x: 66 }, { monsterId: 'goule', x: 80 }, { monsterId: 'banshee', x: 92 }, { monsterId: 'goule', x: 108 }, { monsterId: 'banshee', x: 120 }, { monsterId: 'goule', x: 140 }],
    props: [prop('roche', 24), prop('champignon', 58), prop('roche', 122), prop('coffre', 16), prop('coffre', 75, 3), prop('coffre', 99, 11)],
    hazards: [{ kind: 'water', x: 34, w: 5 }, { kind: 'water', x: 86, w: 5 }, { kind: 'spikes', x: 118, w: 4 }],
    bridges: [{ x: 33, y: 13, w: 7 }, { x: 85, y: 13, w: 7 }],
    checkpoints: [{ x: 50 }, { x: 108 }] },
  { id: 'zone5-boss', name: 'Trône du Roi Liche', biome: 'cimetiere', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-liche' },
  // Zone 6 — enfer (zone finale) : le niveau le plus vertical — deux sommets (row2 par sauts, row4
  // par échelle) séparés par des fosses de lave (pics) et des rivières de feu à ponts
  { id: 'zone6-1', name: 'Sentier des Damnés', biome: 'enfer', widthTiles: 155,
    platforms: [plat(16, 11, 4), plat(22, 8, 4), plat(28, 5, 4), plat(34, 2, 4), plat(56, 12, 4), plat(64, 13, 4), plat(80, 11, 4), plat(96, 7, 4), plat(102, 4, 4), plat(124, 11, 4), plat(131, 9, 4), plat(138, 7, 4), plat(148, 13, 5)],
    spawns: [{ monsterId: 'diablotin', x: 10 }, { monsterId: 'gargouille', x: 28 }, { monsterId: 'diablotin', x: 40 }, { monsterId: 'dragon-flamme', x: 48 }, { monsterId: 'gargouille', x: 55 }, { monsterId: 'diablotin', x: 66 }, { monsterId: 'gargouille', x: 78 }, { monsterId: 'diablotin', x: 92 }, { monsterId: 'gargouille', x: 108 }, { monsterId: 'gardien-flamme', x: 127 }, { monsterId: 'gargouille', x: 135 }, { monsterId: 'diablotin', x: 148 }],
    props: [prop('roche', 30), prop('champignon', 70), prop('roche', 140), prop('coffre', 14), prop('coffre', 35, 1), prop('coffre', 150)],
    hazards: [{ kind: 'water', x: 44, w: 5 }, { kind: 'spikes', x: 70, w: 4 }, { kind: 'water', x: 90, w: 5 }, { kind: 'spikes', x: 115, w: 4 }],
    bridges: [{ x: 43, y: 13, w: 7 }, { x: 89, y: 13, w: 7 }],
    ladders: [ladder(100, 5, 9)],
    checkpoints: [{ x: 50 }, { x: 108 }] },
  { id: 'zone6-boss', name: 'Antre du Seigneur Déchu', biome: 'enfer', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-dechu' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
