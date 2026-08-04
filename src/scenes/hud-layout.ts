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
  // BANDEAU DE QUÊTE EN COURS, en haut au CENTRE. Retour joueur : « pense aussi à un visuel en jeu pour
  // voir les quêtes en cours (ptet en haut de la fenêtre) [...] là le jeu incite pas trop à les faire ».
  // Le centre est le SEUL espace libre de la rangée haute : la colonne gauche porte la vie et l'XP, la
  // droite le son, la pause et les fioles. On le déclare ici pour que le test de non-recouvrement le
  // couvre comme les autres — c'est précisément ce fichier qui existe pour ça.
  //
  // ⚠️ IL COMMENCE SOUS LE NOM DU TERRAIN, ET C'EST UNE COLLISION CORRIGÉE. `LevelScene` écrit le nom du
  // terrain au CENTRE, en (480, 8) : le bandeau, posé à y = 4, lui passait dessus. Ça ne se voyait pas
  // tant qu'il ne s'affichait qu'avec une quête en cours ; depuis qu'il est PERMANENT (état passif
  // « Voir les quêtes »), il recouvrait le nom en permanence — « "voir quête" ça s'écrit au-dessus du
  // nom du terrain, donc nul ». Le nom occupe la bande 8 → 26 ; le bandeau commence à 30.
  //
  // ⚠️ CETTE ZONE EST LA SEULE DU HUD À CROISER UN OBJET QUI N'EST PAS DÉCLARÉ ICI. Le nom du terrain
  // appartient à `LevelScene`, pas à l'interface, donc le test de non-recouvrement ne le voit pas. On le
  // déclare donc, pour que le test couvre enfin les deux.
  questTracker: { x: 320, y: 30, w: 320, h: 34 } as HudRect,
  /** Nom du terrain, écrit par LevelScene en (480, 8) — déclaré ici pour entrer dans le test. */
  nomTerrain: { x: 380, y: 6, w: 200, h: 22 } as HudRect,
}

export const centerOf = (r: HudRect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export function overlap(a: HudRect, b: HudRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
