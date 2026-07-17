export interface MaterialDef { id: string; name: string; color: number }

const list: MaterialDef[] = [
  { id: 'herbe-tendre', name: 'Herbe tendre', color: 0x7cb342 },
  { id: 'trefle-chance', name: 'Trèfle porte-chance', color: 0x33691e },
  { id: 'chapeau-champi', name: 'Chapeau de champi', color: 0xef6c00 },
  { id: 'spore-lumineuse', name: 'Spore lumineuse', color: 0xba68c8 },
  { id: 'minerai-fer', name: 'Minerai de fer', color: 0x90a4ae },
  { id: 'gemme-brute', name: 'Gemme brute', color: 0x4dd0e1 },
  { id: 'croc-de-loup', name: 'Croc de loup', color: 0xe0e0e0 },
  { id: 'dard-de-scorpion', name: 'Dard de scorpion', color: 0xd98e32 },
]

export const MATERIALS: Record<string, MaterialDef> = Object.fromEntries(list.map((m) => [m.id, m]))
