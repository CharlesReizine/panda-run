// Recettes de la forge : transforment des matériaux collectés (materials.ts) — plus un peu d'or — en
// équipement forgé (items.ts).
//
// STRUCTURE IMPOSÉE À CHAQUE RECETTE : du VOLUME en matières communes + UN accent rare (deux pour un
// légendaire). Avant, c'était l'inverse : quatre recettes ne demandaient QUE des trophées à 3-8 %, et
// trois exigeaient du minerai de fer dont la première source jouable est à ~Nv15 (entrée du désert) alors
// que la forge s'ouvre à Prontera vers Nv4 → « jamais trouvé de minerai, pas clair comment je crafte ».
// Désormais les deux premières recettes se bouclent avec la seule PLAINE, et l'échelle des matières
// (bois/cuir/gelée → pierre/cuivre → fer/chitine) se lit dans l'ordre des lignes de la forge.
//
// QUANTITÉS calées sur le rendement RÉEL d'un terrain, pas sur une intuition : un clear de plaine lâche
// ~3 gelées mais ~0,7 cuir et ~0,4 croc (le générateur pose 4-8 Gloopy pour UN seul lapin ou louveteau).
// D'où des volumes modestes sur les matières portées par une espèce peu nombreuse, et le gros du coût mis
// sur celles qui pullulent — sinon la « recette accessible » redevient dix re-clears du même terrain.
// L'or monte avec le palier : la forge reste un investissement, pas un distributeur.

export interface RecipeDef {
  id: string
  resultItemId: string
  materials: Record<string, number>
  gold?: number
  // PALIER DE PROGRESSION VISÉ (niveau joueur). Ce n'est PAS un verrou — canCraft ne regarde que les
  // matériaux et l'or — mais le CONTRAT d'atteignabilité verrouillé par tests/data/craft-reachability :
  // chaque matière exigée doit tomber sur un monstre d'un terrain traversé au plus tard à ce niveau.
  // C'est ce contrat qui rend impossible le retour du bug « recette qui réclame une matière
  // introuvable ». Le tableau est TRIÉ par level croissant → la forge (TownScene rend dans l'ordre du
  // tableau, paginé) présente les recettes de la plus accessible à la plus prestigieuse.
  level: number
}

export const RECIPES: RecipeDef[] = [
  // ── PALIER PLAINE : forgeable au tout premier passage à Prontera ─────────────────────────────────
  // PREMIER OBJET DU JEU forgeable : un CHAPEAU, utile à TOUTES les classes (une épée ou un bâton
  // n'auraient servi qu'à la moitié des builds). Gelée sur les Gloopy dès Prairie, cuir sur les Lapins
  // dès Champs, crocs sur les Louveteaux de Bocage : aucun détour, aucun farm de plusieurs heures.
  { id: 'craft-casque-croc', resultItemId: 'casque-croc', level: 5, materials: { 'gelee-slime': 4, 'cuir-souple': 3, 'croc-de-loup': 1 }, gold: 80 },
  // Bois de mandragore/souche + spores de poporing : la 2e recette reste 100 % plaine. Elle REDONNE UN
  // USAGE au chapeau de champi, qui n'était consommé par AUCUNE recette (contenu mort, jamais utile).
  { id: 'craft-baton-lumineux', resultItemId: 'baton-lumineux', level: 8, materials: { 'bois-brut': 4, 'herbe-tendre': 3, 'spore-lumineuse': 2, 'chapeau-champi': 1 }, gold: 120 },
  // ── PALIER DÉSERT : le fer, désormais réellement farmable (30-35 % au lieu de 6 %), et le
  // « bronze » de la forêt (pierre + lingot de cuivre du Rocker) qui l'accompagne ──────────────────
  { id: 'craft-plastron-fer', resultItemId: 'plastron-fer', level: 17, materials: { 'minerai-fer': 4, 'lingot-cuivre': 2, 'cuir-souple': 3 }, gold: 240 },
  { id: 'craft-epee-fer-forgee', resultItemId: 'epee-fer-forgee', level: 19, materials: { 'minerai-fer': 5, 'bois-brut': 3, 'pierre-brute': 2 }, gold: 280 },
  { id: 'craft-amulette-gemme', resultItemId: 'amulette-gemme', level: 21, materials: { 'lingot-cuivre': 3, 'pierre-brute': 3, 'gemme-brute': 1 }, gold: 200 },
  // ── LÉGENDAIRES : gros volume de communes + DEUX rares → vrai objectif de fin de biome ───────────
  { id: 'craft-lame-scorpion', resultItemId: 'lame-scorpion', level: 26, materials: { 'minerai-fer': 5, 'carapace-chitine': 4, 'dard-de-scorpion': 3, 'gemme-brute': 1 }, gold: 600 },
  { id: 'craft-armure-carapace', resultItemId: 'armure-carapace', level: 32, materials: { 'carapace-chitine': 7, 'cuir-souple': 5, 'minerai-fer': 4, 'gemme-brute': 2 }, gold: 900 },
  // Le talisman (légendaire, PV +60) était la recette la PLUS FACILE du jeu (4 trèfles + 3 herbes, tout
  // en plaine) : ses 4 trèfles se farment sur les lapins (patte porte-bonheur) et surtout sur le poring
  // doré, l'élite « porte-chance » — un objectif de farm assumé, à la hauteur du bonus.
  // « Un trèfle à quatre feuilles PÉTRIFIÉ » (cf. son texte) : la pierre est donc dans le lore, et c'est
  // elle qui porte le volume — trois trophées d'affilée en auraient fait un mur de farm.
  { id: 'craft-talisman-trefle', resultItemId: 'talisman-trefle', level: 36, materials: { 'herbe-tendre': 6, 'pierre-brute': 5, 'spore-lumineuse': 3, 'trefle-chance': 4 }, gold: 1200 },
]
