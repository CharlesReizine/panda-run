// Géométrie PURE (sans Phaser) de la fiche détail du Bestiaire — partagée entre BestiaryScene et le
// test de non-débordement (tests/core/bestiary-layout.test.ts).
//
// DISPOSITION EN QUATRE QUARTS, telle que demandée par le user :
//   ┌─────────────────────────────────────────────┐
//   │ Angeling (Nv 8)          ← nom, niveau à côté│
//   ├──────────┬──────────────────────────────────┤
//   │ image    │ (trait) COMPÉTENCES              │
//   │          │                                  │
//   ├──────────┴──────────────────────────────────┤
//   │ BUTIN — sur TOUTE la largeur                │
//   └─────────────────────────────────────────────┘
//
// ⚠️ AUCUNE STAT DANS CETTE FICHE, ET C'EST DEMANDÉ : « mets pas les PV ça sert à rien, juste le
// niveau c'est ok ». Une version précédente logeait PV/ATK/DÉF à droite de l'image, ce qui repoussait
// le trait vertical au milieu de la fiche et écrasait les compétences — alors que la consigne disait
// « à droite de ÇA », c'est-à-dire à droite de l'image. Le quart gauche fait donc la largeur de
// l'image, et les compétences prennent tout le reste.
// Les deux quarts du haut sont indépendants ; les deux du bas sont fusionnés pour le butin, qui a
// besoin de largeur (image + nom + probabilité par ligne).
//
// POURQUOI UNE GÉOMÉTRIE PURE. Le user a exigé « un test qui m'assure que rien ne dépasse, et tant
// que c'est pas bon tu déploies pas ». Un test ne peut vérifier ça que si la disposition est calculable
// SANS rendu : ces fonctions sont donc la source de vérité, et la scène ne fait que les peindre.

import { charsPerLine } from './text-metrics'

/** Zone utile de la fiche, dans l'espace de conception (0→960 × 0→540). */
export const CARD = {
  left: 24,
  right: 936,
  top: 56,
  /** Rien ne doit descendre sous cette ligne : c'est là que commencent les boutons. */
  bottom: 496,
}

export const BD = {
  /** hauteur de la ligne d'en-tête (nom + niveau), au-dessus des deux quarts */
  headerH: 34,
  /** taille de l'illustration du monstre */
  portrait: 118,
  /** colonne de séparation : juste après l'image, pas au milieu de la fiche */
  splitX: 24 + 118 + 18,
  /** hauteur de la bande du haut (image / compétences) */
  topH: 168,
  /** bande de PRÉSENTATION du monstre (caractère, habitat, dangerosité) — 3 lignes de 13 px */
  loreH: 58,
  loreFont: 13,
  loreLines: 3,
  gap: 10,
  /** hauteur d'une ligne de compétence et d'une ligne de butin */
  skillRowH: 40,
  lootRowH: 34,
  /** longueur max d'une description de compétence (au-delà : tronquée) */
  descMax: 66,
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Ligne d'en-tête : le nom, et le niveau JUSTE À CÔTÉ entre parenthèses. Toute la largeur. */
export const headerBox = (): Rect => ({
  x: CARD.left, y: CARD.top, w: CARD.right - CARD.left, h: BD.headerH,
})

/** Quart gauche : l'illustration seule, sous l'en-tête. */
export const identityBox = (): Rect => ({
  x: CARD.left, y: CARD.top + BD.headerH, w: BD.splitX - CARD.left - BD.gap, h: BD.topH,
})

export const skillsBox = (): Rect => ({
  x: BD.splitX + BD.gap, y: CARD.top + BD.headerH, w: CARD.right - BD.splitX - BD.gap, h: BD.topH,
})

/**
 * Bande de PRÉSENTATION : le paragraphe qui décrit le monstre (caractère, habitat, dangerosité).
 *
 * Demande du user : « rajoute un petit paragraphe pour chaque monstre qui le présente en disant ses
 * caractéristiques, craintif joyeux colérique joueur, sa dangerosité, où il vit ». Le texte EXISTAIT
 * déjà pour les 86 monstres (MonsterDef.lore) mais n'était affiché NULLE PART.
 *
 * Elle est prise sur la bande de butin, qui était largement surdimensionnée : le monstre le plus chargé
 * du jeu a 6 butins, soit 2 rangées de 34 px, là où la bande en offrait 228.
 */
export const loreBox = (): Rect => ({
  x: CARD.left, y: CARD.top + BD.headerH + BD.topH + BD.gap,
  w: CARD.right - CARD.left, h: BD.loreH,
})

/** Bande du butin : sous la présentation, sur TOUTE la largeur. */
export const lootBox = (): Rect => {
  const y = CARD.top + BD.headerH + BD.topH + BD.gap + BD.loreH + BD.gap
  return { x: CARD.left, y, w: CARD.right - CARD.left, h: CARD.bottom - y }
}

/** Nombre de caractères de présentation qui tiennent dans la bande, sans troncature. */
export const loreCapacity = (): number =>
  charsPerLine(loreBox().w, BD.loreFont) * BD.loreLines

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
