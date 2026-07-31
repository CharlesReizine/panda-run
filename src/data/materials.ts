// MATIÈRES PREMIÈRES du craft (consommées par data/recipes + core/reforge, récoltées sur les drops de
// data/monsters). Chaque entrée génère son icône au chargement (material-<id>, cf. PreloadScene →
// art/skill-icon-canvas materialGlyph) : une matière NON déclarée ici retomberait sur la pastille ronde
// générique, interdit par tests/data/no-placeholder-icons.
//
// DEUX FAMILLES, et c'est le cœur de la lisibilité du craft (retour joueur : « jamais trouvé de minerai
// donc pas clair pour moi comment je fais des objets ?? Ptet qu'il faudrait plusieurs types d'objets pour
// craft. Genre bois, bronze, fer, + des trucs droppés par des monstres ») :
//
//   • 'commune' — la MATIÈRE DE BASE, façon RPG classique. Elle tombe SOUVENT (≥ 25 % sur ses monstres
//     thématiques, cf. tests/data/craft-reachability) et se ramasse par poignées. C'est ce qui manquait
//     TOTALEMENT : les 8 matières historiques étaient toutes des trophées à 3-8 %, si bien qu'aucune
//     boucle « je tue → j'accumule → je forge » n'était visible. Elles s'échelonnent en TROIS PALIERS
//     calés sur les biomes, pour que la montée en gamme se lise sans wiki :
//         plaine  → gelée de slime, bois brut, cuir souple, herbe tendre  (organique)
//         forêt   → pierre brute, minerai de cuivre                       (le palier « bronze »)
//         désert  → minerai de fer, carapace de chitine                   (le palier « fer »)
//   • 'rare' — le TROPHÉE de farm (3-25 %), réservé à l'accent prestigieux d'une recette (une seule pour
//     un objet épique, deux pour un légendaire). Une recette faite QUE de rares serait un mur.
//
// Le minerai de FER a changé de camp : longtemps trophée à 6 % introuvable avant le désert (~Nv15) alors
// que 3 recettes sur 8 ET la réforge dès son niveau 0 en réclamaient, il est désormais une commune du
// palier 3 (30-35 % sur les mobs de roche/métal). Il RESTE au désert : l'échelle bois → bronze → fer est
// une progression, pas un blocage, et le joueur voit du MINERAI (cuivre) dès la forêt.
export interface MaterialDef {
  id: string
  name: string
  color: number
  // 'commune' = matière de base ramassée par poignées ; 'rare' = trophée de farm. Pilote les invariants
  // de tests/data/craft-reachability (plancher de drop des communes, plafond des rares).
  rarity: 'commune' | 'rare'
}

const list: MaterialDef[] = [
  // ── PALIER 1 — plaine (dès Prairie / Champs, niveau joueur 1-4) ──────────────────────────────────
  // La gelée est la matière du TOUT PREMIER terrain : Prairie ne contient QUE des Gloopy, qui ne
  // droppaient aucune matière — on finissait le premier niveau du jeu avec un inventaire vide.
  { id: 'gelee-slime', name: 'Gelée de slime', color: 0xf48fb1, rarity: 'commune' },
  { id: 'bois-brut', name: 'Bois brut', color: 0xa1734b, rarity: 'commune' },
  { id: 'cuir-souple', name: 'Cuir souple', color: 0x6d4c33, rarity: 'commune' },
  { id: 'herbe-tendre', name: 'Herbe tendre', color: 0x7cb342, rarity: 'commune' },
  // ── PALIER 2 — forêt (niveau joueur ~7) : la pierre et le « bronze » ────────────────────────────
  { id: 'pierre-brute', name: 'Pierre brute', color: 0x9e9e9e, rarity: 'commune' },
  // « Lingot » et non « Minerai » de cuivre : TownScene.shortMat n'affiche que le PREMIER MOT du nom, donc
  // deux « Minerai de … » rendraient le coût d'une recette illisible (« Minerai 2/4 · Minerai 0/3 »).
  { id: 'lingot-cuivre', name: 'Lingot de cuivre', color: 0xc87137, rarity: 'commune' },
  // ── PALIER 3 — désert (niveau joueur ~10-15) : le fer et la chitine ─────────────────────────────
  { id: 'minerai-fer', name: 'Minerai de fer', color: 0x90a4ae, rarity: 'commune' },
  { id: 'carapace-chitine', name: 'Carapace de chitine', color: 0x7a8b3c, rarity: 'commune' },
  // ── TROPHÉES (rares) : l'accent prestigieux d'une recette, jamais son volume ────────────────────
  { id: 'trefle-chance', name: 'Trèfle porte-chance', color: 0x33691e, rarity: 'rare' },
  { id: 'chapeau-champi', name: 'Chapeau de champi', color: 0xef6c00, rarity: 'rare' },
  { id: 'spore-lumineuse', name: 'Spore lumineuse', color: 0xba68c8, rarity: 'rare' },
  { id: 'croc-de-loup', name: 'Croc de loup', color: 0xe0e0e0, rarity: 'rare' },
  { id: 'dard-de-scorpion', name: 'Dard de scorpion', color: 0xd98e32, rarity: 'rare' },
  { id: 'gemme-brute', name: 'Gemme brute', color: 0x4dd0e1, rarity: 'rare' },
]

export const MATERIALS: Record<string, MaterialDef> = Object.fromEntries(list.map((m) => [m.id, m]))
