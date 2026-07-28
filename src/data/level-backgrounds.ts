// Fonds de terrain illustrés (public/art/bg-<levelId>.png) : quels terrains en ont un, et comment
// les charger.
//
// CHARGÉS À LA DEMANDE, PAS AU BOOT. Un fond fait 1024×1024 = 4 Mo de VRAM (une texture WebGL coûte
// l×h×4 octets non compressés), et il y en a 49 — soit ~196 Mo résidents en permanence pour UN SEUL
// fond affiché à la fois. C'est la moitié de l'empreinte mémoire qui rendait le jeu de plus en plus
// lent sur iPhone (WebKit purge puis re-uploade en boucle sous cette pression). LevelScene charge
// donc le fond de SON terrain dans son preload() et le décharge à son shutdown.
//
// Les fichiers restent tous précachés par le service worker (cf. asset-manifest.json) : le jeu reste
// jouable hors connexion, c'est seulement la mémoire vive/GPU qu'on libère.

// Terrains disposant d'une VRAIE illustration de fond dédiée — un décor UNIQUE par niveau, nommé
// d'après le terrain. Les niveaux de BOSS retombent volontairement sur le fond de biome.
export const LEVELS_WITH_BG = new Set<string>([
  'plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5', 'plaine-6', 'plaine-7',
  'foret-1', 'foret-2', 'foret-3', 'foret-4', 'foret-5', 'foret-6', 'foret-7',
  'desert-1', 'desert-2', 'desert-3', 'desert-4', 'desert-5', 'desert-6', 'desert-7', 'desert-8', 'desert-9', 'desert-10', 'desert-11',
  'jungle-1', 'jungle-2', 'jungle-3', 'jungle-4', 'jungle-5',
  'montagne-1', 'montagne-2', 'montagne-3',
  'cimetiere-1', 'cimetiere-2',
  'plage-1', 'plage-2', 'plage-3', 'plage-4',
  'cave-1', 'carriere-1', 'epave-1',
  'enfer-1', 'enfer-2', 'enfer-3', 'enfer-4', 'enfer-5', 'enfer-6', 'enfer-7',
])

// Clé de texture du fond d'un terrain. `null` = ce terrain n'a pas d'illustration dédiée (niveau de
// boss ou terrain sans art) → LevelScene.addBackground retombe sur biome-<clé> puis sur le procédural.
export function bgKeyFor(levelId: string, isBoss = false): string | null {
  if (isBoss || !LEVELS_WITH_BG.has(levelId)) return null
  return `bg-${levelId}`
}

// Chemin du fichier à charger. Tous les fonds sont livrés en PNG.
export function bgPathFor(levelId: string): string {
  return `art/bg-${levelId}.png`
}
