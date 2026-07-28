// SOURCE DE VÉRITÉ des tailles d'art. Consommée par gen-asset-manifest.mjs (qui l'inline dans
// src/data/art-dimensions.generated.ts pour le test) et par shrink-art.mjs (qui redimensionne).
//
// POURQUOI : l'art est généré en 1024×1024 mais affiché entre 18 et 100 px. Une texture WebGL coûte
// largeur × hauteur × 4 octets de VRAM, non compressés — 1024² = 4 MB. Mesuré : 736 textures
// uploadées au boot = 532 MB de VRAM + 368 MB de tas JS, soit ~900 MB avant même d'entrer dans un
// terrain. Sur iPhone, WebKit purge et re-uploade en boucle sous cette pression → ralentissement
// progressif qui empire avec le nombre de terrains visités, et que seul un reload guérit.
//
// Règle : `max` = la plus grande dimension autorisée, choisie à ≈2× la taille d'affichage réelle
// (marge écran retina). `lazy` = image plein cadre qui garde sa résolution mais NE DOIT PAS être
// résidente au boot (chargée à l'entrée de la scène qui s'en sert, déchargée en sortant).

export const ART_CAPS = [
  // ─── petites images, résidentes au boot : plafonnées fort ───
  { pattern: /^art-/, max: 128, why: 'mobs normalisés à 46 px de large (Enemy.ts:199)' },
  { pattern: /^item-/, max: 128, why: 'icônes boutique/inventaire ≤ 48 px' },
  { pattern: /^cosmetic-/, max: 128, why: 'chapeaux portés ≤ 40 px' },
  { pattern: /^fish-/, max: 128, why: 'menaces aquatiques, taille de mob' },
  { pattern: /^(coin|potion-drop)\./, max: 96, why: 'butin flottant 18-26 px' },
  // 384 et pas 256 : les sprites de base du panda sont déjà en 320×182 (0,22 Mo, sains) — on ne les
  // touche pas, on ne vise que les poses de NAGE générées en 1344×768 (3,94 Mo chacune, ×14).
  { pattern: /^panda-/, max: 384, why: 'panda affiché ~92 px (poses de nage incluses)' },
  { pattern: /^npc-/, max: 256, why: 'PNJ de ville ~90 px' },
  { pattern: /^death-panda\./, max: 256, why: 'sprite de mort, taille du panda' },
  { pattern: /^fx-/, max: 256, why: 'effets ≤ 120 px' },
  { pattern: /^splash\./, max: 1024, why: 'écran de lancement plein cadre' },

  // ─── images plein cadre : résolution gardée, mais chargées À LA DEMANDE ───
  { pattern: /^bg-/, max: 1024, lazy: true, why: 'fond de terrain 960×540 — 1 seul affiché à la fois' },
  { pattern: /^biome-/, max: 1024, lazy: true, why: 'fond de biome (repli), plein cadre' },
  { pattern: /^town-/, max: 1024, lazy: true, why: 'maps et bâtiments de ville, vus en ville seulement' },
  { pattern: /^(map-|mapfill-)/, max: 1024, lazy: true, why: 'carte du monde, vue sur WorldMap seulement' },
]

// Plafond par défaut pour un fichier qui ne matche aucune famille : petit, pour que tout nouvel
// asset non classé se fasse remarquer plutôt que de repartir en 1024².
export const DEFAULT_CAP = 256

// Budget de VRAM (Mo) des textures RÉSIDENTES AU BOOT (familles non-lazy). Les textures générées
// à l'exécution (tuiles, icônes de sorts, armes procédurales…) s'ajoutent par-dessus.
export const BOOT_BUDGET_MB = 45

export function capFor(name) {
  for (const c of ART_CAPS) if (c.pattern.test(name)) return c
  return { pattern: null, max: DEFAULT_CAP, why: 'famille non classée → plafond par défaut' }
}
