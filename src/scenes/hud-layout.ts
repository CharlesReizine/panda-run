// Zones réservées de la colonne GAUCHE du HUD, en DÉCALAGE DEPUIS LE BORD GAUCHE de l'écran.
//
// ⚠️ CES ABSCISSES NE SONT PAS DES COORDONNÉES DE SCÈNE. UIScene est recentrée (centerCamera) : il faut
// les passer par `fromLeft()` (core/viewport.ts) au moment de poser l'objet. Posées telles quelles, elles
// tombent à ~111 px du bord sur un écran large — c'est le défaut « la vie c'est pas tout à gauche mais
// genre milieu gauche ». Ce fichier reste volontairement PUR (aucun import de viewport) pour que le test
// de non-recouvrement tourne sans DOM ; le décalage est ajouté au site d'appel.
//
// POURQUOI CE FICHIER EXISTE. Chaque élément du HUD était positionné par des littéraux dispersés dans
// UIScene, et ils ont fini par se marcher dessus : la pastille de buff ATK (x 12→116, y 86→110)
// recouvrait le bouton « Compétences » (x 47→185, y 78→102) ET le badge de points de compétence.
// Retour user : « les buff d'attaque et tout overlap avec la touche compétence, pas bien ça non plus ».
// C'était le DEUXIÈME chevauchement signalé après les noms de bâtiments en ville.
//
// On déclare donc les zones ici, une fois, et un test (tests/core/hud-layout.test.ts) vérifie
// qu'AUCUNE PAIRE ne se recouvre. Déplacer un élément sans regarder ses voisins devient impossible :
// le test tombe. C'est moins souple qu'un littéral dans le code, et c'est exactement le but.

export interface HudRect {
  x: number
  y: number
  w: number
  h: number
}

const BAR_W = 200 // largeur de la barre de vie (miroir de UIScene.BAR_W)

// Rangées empilées de haut en bas, avec un interligne d'au moins 8 px.
export const HUD_LEFT = {
  // panneau de vie / énergie / XP + libellé « compétences ▸ »
  lifePanel: { x: 8, y: 2, w: BAR_W + 16, h: 78 } as HudRect,
  // bouton explicite d'ouverture du menu de compétences
  skillsBtn: { x: 47, y: 88, w: 138, h: 24 } as HudRect,
  // pastille de buff d'attaque (⚔ ATK+) — n'apparaît que buff actif
  buffPill: { x: 12, y: 120, w: 104, h: 24 } as HudRect,
  // badge « points de compétence à dépenser » — n'apparaît que s'il en reste
  spBadge: { x: 40, y: 152, w: 152, h: 32 } as HudRect,
}

export const centerOf = (r: HudRect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export function overlap(a: HudRect, b: HudRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
