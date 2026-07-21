// APNÉE — réserve de souffle liée au NIVEAU DU PERSO.
// Le souffle max (ms) avant que la noyade ne s'installe croît avec le niveau du joueur : un panda
// aguerri tient plus longtemps en apnée. Formule validée : 5000 ms de base + 250 ms par niveau.
// Fonction PURE (aucune dépendance Phaser) → utilisée par LevelScene.updateWater et testable seule.
export const BREATH_BASE_MS = 5000
export const BREATH_PER_LEVEL_MS = 250

export function breathMaxMs(playerLevel: number): number {
  return BREATH_BASE_MS + BREATH_PER_LEVEL_MS * playerLevel
}
