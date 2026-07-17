// Registre des biomes : palettes + type de décor. Ajouter un style = ajouter une entrée ici.
export interface BiomePalette {
  tile: { soil: number; top: number; speck: number }
  skyTop: number
  skyBot: number
  hillFar: number
  hillNear: number
  deco: 'buisson' | 'arbre' | 'cactus' | 'stalagmite' | 'palmier' | 'pierre' | 'tombe' | 'flamme' | 'liane' | 'sapin'
  clouds: boolean
}

export const BIOMES: Record<string, BiomePalette> = {
  plaine: { tile: { soil: 0x6b4a2f, top: 0x5cb85c, speck: 0x4a9d4a }, skyTop: 0x6ec6f0, skyBot: 0xcdeeff, hillFar: 0x8fd18f, hillNear: 0x5cb85c, deco: 'buisson', clouds: true },
  foret: { tile: { soil: 0x4a3320, top: 0x2e7d32, speck: 0x256528 }, skyTop: 0x7fc6b4, skyBot: 0xd6f0e6, hillFar: 0x4a8f5a, hillNear: 0x2e7d32, deco: 'arbre', clouds: true },
  desert: { tile: { soil: 0xcaa85a, top: 0xe0c068, speck: 0xd4b46a }, skyTop: 0xf6c66b, skyBot: 0xfdeec2, hillFar: 0xe6c878, hillNear: 0xd4a94a, deco: 'cactus', clouds: true },
  cave: { tile: { soil: 0x3f3f3f, top: 0x616161, speck: 0x525252 }, skyTop: 0x1e1e2a, skyBot: 0x2c2c3c, hillFar: 0x34343f, hillNear: 0x45454f, deco: 'stalagmite', clouds: false },
  jungle: { tile: { soil: 0x33421f, top: 0x3f8f2f, speck: 0x2f6f22 }, skyTop: 0x4fae8f, skyBot: 0xc7f0d8, hillFar: 0x2f7d4a, hillNear: 0x1f5e32, deco: 'liane', clouds: true },
  montagne: { tile: { soil: 0x5a5148, top: 0x8a8078, speck: 0x6f665e }, skyTop: 0x8fb8e0, skyBot: 0xdfeaf5, hillFar: 0x9aa7b5, hillNear: 0x6f7d8c, deco: 'sapin', clouds: true },
  plage: { tile: { soil: 0xd8c48a, top: 0xf0e0a8, speck: 0xe6d090 }, skyTop: 0x5fc6e8, skyBot: 0xd4f4ff, hillFar: 0x7fd0c0, hillNear: 0x4fb0a0, deco: 'palmier', clouds: true },
  carriere: { tile: { soil: 0x776b5e, top: 0x998b7a, speck: 0x877a6a }, skyTop: 0xc8bfae, skyBot: 0xe8e0d0, hillFar: 0x9a8f7e, hillNear: 0x776b5e, deco: 'pierre', clouds: true },
  cimetiere: { tile: { soil: 0x3a3f45, top: 0x556069, speck: 0x454e56 }, skyTop: 0x3a3550, skyBot: 0x6a6280, hillFar: 0x4a4560, hillNear: 0x39354a, deco: 'tombe', clouds: false },
  enfer: { tile: { soil: 0x3a1414, top: 0x8a2a1a, speck: 0x5a1e14 }, skyTop: 0x3a0d0d, skyBot: 0x8a2f1a, hillFar: 0x5a1a14, hillNear: 0x3a1010, deco: 'flamme', clouds: false },
}

export type BiomeId = keyof typeof BIOMES
