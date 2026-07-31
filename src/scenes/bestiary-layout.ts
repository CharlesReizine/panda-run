// Géométrie PURE (sans Phaser) de la fiche détail du Bestiaire — partagée entre BestiaryScene et le
// test de non-débordement (tests/core/bestiary-layout.test.ts).
//
// DISPOSITION EN QUATRE QUARTS, telle que demandée par le user :
//   ┌──────────────────────┬──────────────────────┐
//   │ nom (Nv X)           │  (trait vertical)    │
//   │ image dessous, à     │  compétences         │
//   │ gauche               │                      │
//   ├──────────────────────┴──────────────────────┤
//   │ BUTIN — sur TOUTE la largeur                │
//   └─────────────────────────────────────────────┘
// Les deux quarts du haut sont indépendants ; les deux du bas sont fusionnés pour le butin, qui a
// besoin de largeur (image + nom + probabilité par ligne).
//
// POURQUOI UNE GÉOMÉTRIE PURE. Le user a exigé « un test qui m'assure que rien ne dépasse, et tant
// que c'est pas bon tu déploies pas ». Un test ne peut vérifier ça que si la disposition est calculable
// SANS rendu : ces fonctions sont donc la source de vérité, et la scène ne fait que les peindre.

/** Zone utile de la fiche, dans l'espace de conception (0→960 × 0→540). */
export const CARD = {
  left: 24,
  right: 936,
  top: 56,
  /** Rien ne doit descendre sous cette ligne : c'est là que commencent les boutons. */
  bottom: 496,
}

export const BD = {
  /** colonne de séparation entre le quart « identité » et le quart « compétences » */
  splitX: 430,
  /** hauteur de la bande du haut (identité / compétences) */
  topH: 190,
  gap: 10,
  /** taille de l'illustration du monstre */
  portrait: 118,
  /** hauteur d'une ligne de compétence et d'une ligne de butin */
  skillRowH: 40,
  lootRowH: 34,
  /** longueur max d'une description de compétence (au-delà : tronquée) */
  descMax: 66,
}

export interface Rect { x: number; y: number; w: number; h: number }

export const identityBox = (): Rect => ({
  x: CARD.left, y: CARD.top, w: BD.splitX - CARD.left - BD.gap, h: BD.topH,
})

export const skillsBox = (): Rect => ({
  x: BD.splitX + BD.gap, y: CARD.top, w: CARD.right - BD.splitX - BD.gap, h: BD.topH,
})

/** Bande du butin : sous les deux quarts du haut, sur TOUTE la largeur. */
export const lootBox = (): Rect => ({
  x: CARD.left, y: CARD.top + BD.topH + BD.gap,
  w: CARD.right - CARD.left, h: CARD.bottom - (CARD.top + BD.topH + BD.gap),
})

/** Nombre de colonnes de butin : le butin s'étale en largeur plutôt qu'en hauteur. */
export const LOOT_COLS = 3

/**
 * Hauteur de ligne de butin qui fait tenir `nDrops` entrées dans la bande, en `LOOT_COLS` colonnes.
 * Bornée en bas pour rester lisible : si ça ne rentre toujours pas, `lootFits` renvoie false et le
 * test échoue — on préfère un test rouge à un affichage qui déborde en silence.
 */
export function lootRowH(nDrops: number): number {
  const rows = Math.max(1, Math.ceil(nDrops / LOOT_COLS))
  const box = lootBox()
  const avail = box.h - 22 // moins le titre « BUTIN »
  return Math.max(18, Math.min(BD.lootRowH, Math.floor(avail / rows)))
}

/** Y du BAS de la dernière ligne de butin. */
export function lootBottom(nDrops: number): number {
  const rows = Math.max(1, Math.ceil(nDrops / LOOT_COLS))
  const box = lootBox()
  return box.y + 22 + rows * lootRowH(nDrops)
}

/** Le butin tient-il dans sa bande sans déborder ? */
export const lootFits = (nDrops: number): boolean => lootBottom(nDrops) <= CARD.bottom

/** Nombre de compétences affichables dans le quart haut-droit. */
export const maxSkillRows = (): number => Math.floor((BD.topH - 22) / BD.skillRowH)

/** Y du BAS de la dernière ligne de compétence. */
export function skillsBottom(nSkills: number): number {
  const box = skillsBox()
  return box.y + 22 + Math.min(nSkills, maxSkillRows()) * BD.skillRowH
}

export const skillsFit = (nSkills: number): boolean =>
  nSkills <= maxSkillRows() && skillsBottom(nSkills) <= skillsBox().y + skillsBox().h

/** Tronque un texte à `n` caractères (ellipsis) — évite le débordement dans une carte. */
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`
}
