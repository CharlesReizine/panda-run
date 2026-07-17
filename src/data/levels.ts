export type Biome = 'plaine' | 'foret' | 'desert' | 'cave'

export interface LevelDef {
  id: string
  name: string
  biome: Biome
  widthTiles: number
  platforms: { x: number; y: number; w: number }[] // en tuiles ; y depuis le haut (16 lignes visibles)
  spawns: { monsterId: string; x: number }[] // x en tuiles
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  boss?: string
}

const plat = (x: number, y: number, w: number) => ({ x, y, w })
const prop = (kind: string, x: number, y?: number) => ({ kind, x, y })

const list: LevelDef[] = [
  { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', widthTiles: 90,
    platforms: [plat(20, 11, 4), plat(40, 9, 5)],
    spawns: [{ monsterId: 'gloopy', x: 18 }, { monsterId: 'gloopy', x: 30 }, { monsterId: 'gloopy', x: 45 }, { monsterId: 'mandragore', x: 60 }, { monsterId: 'gloopy', x: 75 }],
    props: [prop('herbe', 10), prop('champignon', 38), prop('herbe', 68), prop('coffre', 22, 10), prop('coffre', 42, 8)] },
  { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', widthTiles: 100,
    platforms: [plat(25, 10, 5), plat(55, 11, 4), plat(70, 9, 4)],
    spawns: [{ monsterId: 'gloopy', x: 20 }, { monsterId: 'mandragore', x: 35 }, { monsterId: 'gloopy', x: 50 }, { monsterId: 'mandragore', x: 65 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 12), prop('champignon', 45), prop('herbe', 78), prop('coffre', 57, 10), prop('coffre', 72, 8)] },
  { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', widthTiles: 100,
    platforms: [plat(15, 10, 4), plat(35, 8, 5), plat(60, 10, 6)],
    spawns: [{ monsterId: 'louveteau', x: 25 }, { monsterId: 'mandragore', x: 40 }, { monsterId: 'louveteau', x: 55 }, { monsterId: 'mandragore', x: 70 }, { monsterId: 'louveteau', x: 85 }],
    props: [prop('herbe', 8), prop('champignon', 48), prop('herbe', 95), prop('coffre', 37, 7), prop('coffre', 62, 9)] },
  { id: 'zone1-4', name: 'Forêt profonde', biome: 'foret', widthTiles: 110,
    platforms: [plat(20, 9, 4), plat(45, 11, 5), plat(75, 9, 5)],
    spawns: [{ monsterId: 'louveteau', x: 20 }, { monsterId: 'louveteau', x: 38 }, { monsterId: 'mandragore', x: 55 }, { monsterId: 'louveteau', x: 72 }, { monsterId: 'louveteau', x: 90 }, { monsterId: 'mandragore', x: 100 }],
    props: [prop('herbe', 10), prop('champignon', 30), prop('herbe', 65), prop('champignon', 105), prop('coffre', 47, 10), prop('coffre', 77, 8)] },
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-gloopy' },
  { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert', widthTiles: 100,
    platforms: [plat(30, 10, 5), plat(60, 11, 4)],
    spawns: [{ monsterId: 'scorpion', x: 20 }, { monsterId: 'scorpion', x: 40 }, { monsterId: 'vautour', x: 60 }, { monsterId: 'scorpion', x: 80 }],
    props: [prop('roche', 12), prop('herbe', 48), prop('roche', 90), prop('coffre', 32, 9), prop('coffre', 62, 10)] },
  { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert', widthTiles: 110,
    platforms: [plat(25, 9, 5), plat(50, 11, 5), plat(80, 9, 4)],
    spawns: [{ monsterId: 'scorpion', x: 25 }, { monsterId: 'momie', x: 45 }, { monsterId: 'vautour', x: 65 }, { monsterId: 'momie', x: 85 }, { monsterId: 'scorpion', x: 100 }],
    props: [prop('roche', 10), prop('herbe', 35), prop('roche', 70), prop('herbe', 105), prop('coffre', 52, 10), prop('coffre', 82, 8)] },
  { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert', widthTiles: 110,
    platforms: [plat(20, 10, 4), plat(45, 8, 5), plat(75, 10, 5)],
    spawns: [{ monsterId: 'momie', x: 25 }, { monsterId: 'vautour', x: 45 }, { monsterId: 'momie', x: 60 }, { monsterId: 'vautour', x: 80 }, { monsterId: 'momie', x: 95 }],
    props: [prop('roche', 12), prop('herbe', 38), prop('roche', 105), prop('coffre', 47, 7), prop('coffre', 77, 9)] },
  { id: 'cave-1', name: 'Cave aux échos', biome: 'cave', widthTiles: 105,
    platforms: [plat(20, 9, 5), plat(45, 11, 4), plat(70, 9, 6)],
    spawns: [{ monsterId: 'chauve-souris', x: 20 }, { monsterId: 'squelette', x: 40 }, { monsterId: 'chauve-souris', x: 60 }, { monsterId: 'squelette', x: 80 }, { monsterId: 'chauve-souris', x: 95 }],
    props: [prop('roche', 10), prop('champignon', 32), prop('roche', 52), prop('champignon', 90), prop('coffre', 47, 10), prop('coffre', 72, 8)] },
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
