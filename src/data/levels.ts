export type Biome = string // clé du registre BIOMES

export interface LevelDef {
  id: string
  name: string
  biome: Biome
  widthTiles: number
  platforms: { x: number; y: number; w: number }[] // en tuiles ; y depuis le haut (16 lignes visibles)
  spawns: { monsterId: string; x: number }[] // x en tuiles
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number }[] // pièges au sol (x, largeur en tuiles)
  bridges?: { x: number; y: number; w: number }[] // ponts de planches (plateformes fines)
  boss?: string
}

const plat = (x: number, y: number, w: number) => ({ x, y, w })
const prop = (kind: string, x: number, y?: number) => ({ kind, x, y })

const list: LevelDef[] = [
  { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', widthTiles: 90,
    platforms: [plat(22, 11, 5), plat(26, 8, 4), plat(55, 11, 4)],
    spawns: [{ monsterId: 'gloopy', x: 12 }, { monsterId: 'angeling', x: 25 }, { monsterId: 'fabre', x: 38 }, { monsterId: 'gloopy', x: 50 }, { monsterId: 'mandragore', x: 62 }, { monsterId: 'gloopy', x: 75 }],
    props: [prop('herbe', 10), prop('champignon', 44), prop('herbe', 68), prop('coffre', 7), prop('coffre', 28, 7)] },
  { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', widthTiles: 100,
    platforms: [plat(15, 12, 5), plat(40, 11, 4), plat(44, 8, 4), plat(75, 11, 5)],
    spawns: [{ monsterId: 'gloopy', x: 18 }, { monsterId: 'mandragore', x: 48 }, { monsterId: 'gloopy', x: 58 }, { monsterId: 'mandragore', x: 65 }, { monsterId: 'lunatic', x: 76 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 12), prop('champignon', 52), prop('herbe', 90), prop('coffre', 8), prop('coffre', 46, 7)] },
  { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', widthTiles: 100,
    platforms: [plat(20, 11, 4), plat(24, 8, 4), plat(28, 5, 4), plat(60, 10, 4)],
    spawns: [{ monsterId: 'louveteau', x: 14 }, { monsterId: 'mandragore', x: 44 }, { monsterId: 'poporing', x: 55 }, { monsterId: 'mandragore', x: 70 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 8), prop('champignon', 48), prop('herbe', 95), prop('coffre', 10), prop('coffre', 30, 4)] },
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
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'momie', x: 48 }, { monsterId: 'vautour', x: 60 }, { monsterId: 'momie', x: 70 }, { monsterId: 'scorpion', x: 100 }],
    props: [prop('roche', 10), prop('herbe', 52), prop('roche', 70), prop('herbe', 105), prop('coffre', 32, 4), prop('coffre', 84, 7)] },
  { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert', widthTiles: 110,
    platforms: [plat(30, 12, 6), plat(60, 11, 4), plat(64, 8, 4), plat(95, 11, 4)],
    spawns: [{ monsterId: 'momie', x: 14 }, { monsterId: 'vautour', x: 48 }, { monsterId: 'zombie', x: 72 }, { monsterId: 'vautour', x: 82 }, { monsterId: 'momie', x: 90 }, { monsterId: 'mini-baphomet', x: 105 }],
    props: [prop('roche', 12), prop('herbe', 44), prop('roche', 105), prop('coffre', 66, 7)] },
  { id: 'cave-1', name: 'Cave aux échos', biome: 'cave', widthTiles: 105,
    platforms: [plat(18, 11, 4), plat(22, 8, 4), plat(26, 5, 4), plat(58, 11, 4), plat(62, 8, 4)],
    spawns: [{ monsterId: 'chauve-souris', x: 14 }, { monsterId: 'squelette', x: 44 }, { monsterId: 'fantome', x: 50 }, { monsterId: 'chauve-souris', x: 70 }, { monsterId: 'squelette', x: 82 }, { monsterId: 'chauve-souris', x: 95 }],
    props: [prop('roche', 10), prop('champignon', 42), prop('roche', 90), prop('coffre', 28, 4), prop('coffre', 64, 7)] },
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
