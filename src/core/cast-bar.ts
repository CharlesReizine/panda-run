// Logique PURE de la barre de chargement d'attaque (le rendu est dans entities/cast-bar.ts).
//
// POURQUOI UNE BARRE DE CHARGEMENT. Demande du user : « j'aimerais que les attaques et sorts des
// monstres aient un chargement (voir que je l'ai aussi) + qu'on voit le nom de l'attaque, ça serait
// plus simple ». Le jeu télégraphiait DÉJÀ certaines attaques (arc rouge qui se remplit pour la mêlée,
// zone au sol pour les sorts), mais rien ne disait COMBIEN de temps il restait ni CE QUE c'était : on
// voyait qu'il se passait quelque chose sans pouvoir décider s'il fallait esquiver ou frapper.
//
// Cette logique est isolée ici parce qu'elle a deux propriétés qu'on veut tester sans rendu : la
// progression est BORNÉE (jamais < 0 ni > 1, y compris si l'horloge saute — ce qui arrive après une
// mise en pause), et la largeur de la barre s'adapte au nom sans jamais descendre sous un minimum
// lisible.

export const CAST_BAR = {
  /** largeur minimale de la barre, quel que soit le nom */
  minW: 54,
  maxW: 132,
  h: 6,
  /** hauteur de l'étiquette, pour la placer au-dessus de la barre */
  labelH: 12,
  /** écart entre la tête de l'entité et le bas de la barre */
  gap: 12,
  /** largeur approchée d'un caractère en police 10 px monospace (police par défaut de Phaser) */
  charW: 6,
}

/**
 * Avancement d'un chargement, de 0 (vient de commencer) à 1 (prêt à partir).
 * Borné aux deux bouts : après une pause de scène l'horloge peut sauter loin devant `startedAt`.
 */
export function castProgress(t: number, startedAt: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  const p = (t - startedAt) / durationMs
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/** Un chargement est-il encore en cours ? */
export const casting = (t: number, startedAt: number, durationMs: number): boolean =>
  durationMs > 0 && t >= startedAt && t < startedAt + durationMs

/** Largeur de la barre pour ce nom d'attaque : assez large pour le lire, jamais démesurée. */
export function castBarWidth(name: string): number {
  const w = name.length * CAST_BAR.charW + 12
  return Math.max(CAST_BAR.minW, Math.min(CAST_BAR.maxW, w))
}

/** Hauteur totale occupée au-dessus de la tête (étiquette + barre + écart). */
export const castBarTotalH = (): number => CAST_BAR.labelH + CAST_BAR.h + 3
