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
  { id: 'craft-casque-croc', resultItemId: 'casque-croc', level: 5, materials: { 'gelee-slime': 4, 'cuir-souple': 3, 'croc-de-loup': 1 }, gold: 80 },
  { id: 'craft-baton-lumineux', resultItemId: 'baton-lumineux', level: 8, materials: { 'bois-brut': 4, 'herbe-tendre': 3, 'spore-lumineuse': 2, 'chapeau-champi': 1 }, gold: 120 },
  { id: 'craft-chapeau-du-magicien', resultItemId: 'chapeau-du-magicien', level: 15, materials: { 'cuir-souple': 6, 'minerai-fer': 4, 'croc-de-loup': 2 }, gold: 760 },
  // PALIER 15 — sans elle, la forge n'avait RIEN d'aussi fort que la vitrine à ce palier (48 contre
  // 52) : forger y aurait été un détour coûteux pour un résultat inférieur. Une arbalète se fabrique.
  { id: 'craft-arbalete', resultItemId: 'arbalete', level: 15, materials: { 'bois-brut': 6, 'cuir-souple': 4, 'croc-de-loup': 2 }, gold: 480 },
  { id: 'craft-plastron-fer', resultItemId: 'plastron-fer', level: 17, materials: { 'minerai-fer': 4, 'lingot-cuivre': 2, 'cuir-souple': 3 }, gold: 240 },
  { id: 'craft-epee-fer-forgee', resultItemId: 'epee-fer-forgee', level: 19, materials: { 'minerai-fer': 5, 'bois-brut': 3, 'pierre-brute': 2 }, gold: 280 },
  { id: 'craft-heaume-du-chevalier', resultItemId: 'heaume-du-chevalier', level: 19, materials: { 'cuir-souple': 6, 'minerai-fer': 4, 'croc-de-loup': 2 }, gold: 720 },
  { id: 'craft-amulette-de-l-aube', resultItemId: 'amulette-de-l-aube', level: 19, materials: { 'lingot-cuivre': 6, 'pierre-brute': 4, 'gemme-brute': 2, 'trefle-chance': 1 }, gold: 840 },
  // HAUT DE GAMME DU PALIER, BASCULÉ EN EXCLUSIVITÉ FORGE. Sans eux la forge restait SOUS la vitrine
  // à trois paliers (19, 25 et 38) : forger y aurait été un détour coûteux pour un résultat inférieur.
  { id: 'craft-masse-etoilee', resultItemId: 'masse-etoilee', level: 19, materials: { 'minerai-fer': 6, 'pierre-brute': 4, 'croc-de-loup': 2 }, gold: 320 },
  { id: 'craft-amulette-gemme', resultItemId: 'amulette-gemme', level: 21, materials: { 'lingot-cuivre': 3, 'pierre-brute': 3, 'gemme-brute': 1 }, gold: 200 },
  { id: 'craft-sabre-de-samourai', resultItemId: 'sabre-de-samourai', level: 25, materials: { 'minerai-fer': 6, 'pierre-brute': 4, 'dard-de-scorpion': 2 }, gold: 520 },
  { id: 'craft-robe-arcanique', resultItemId: 'robe-arcanique', level: 25, materials: { 'minerai-fer': 6, 'carapace-chitine': 4, 'cuir-souple': 2, 'gemme-brute': 2 }, gold: 680 },
  { id: 'craft-oeil-de-basilic', resultItemId: 'oeil-de-basilic', level: 25, materials: { 'lingot-cuivre': 6, 'pierre-brute': 4, 'gemme-brute': 2, 'trefle-chance': 1 }, gold: 800 },
  { id: 'craft-baton-de-tempete', resultItemId: 'baton-de-tempete', level: 25, materials: { 'bois-brut': 6, 'lingot-cuivre': 4, 'spore-lumineuse': 2 }, gold: 380 },
  { id: 'craft-lame-scorpion', resultItemId: 'lame-scorpion', level: 26, materials: { 'minerai-fer': 10, 'carapace-chitine': 8, 'dard-de-scorpion': 6, 'gemme-brute': 2 }, gold: 2400 },
  { id: 'craft-arc-du-faucon', resultItemId: 'arc-du-faucon', level: 31, materials: { 'bois-brut': 6, 'cuir-souple': 4, 'croc-de-loup': 2 }, gold: 560 },
  { id: 'craft-anneau-du-dragon', resultItemId: 'anneau-du-dragon', level: 31, materials: { 'lingot-cuivre': 14, 'pierre-brute': 12, 'gemme-brute': 6, 'trefle-chance': 5 }, gold: 5400 },
  { id: 'craft-casque-de-dragon', resultItemId: 'casque-de-dragon', level: 31, materials: { 'cuir-souple': 14, 'minerai-fer': 12, 'croc-de-loup': 6 }, gold: 6200 },
  { id: 'craft-armure-carapace', resultItemId: 'armure-carapace', level: 32, materials: { 'carapace-chitine': 14, 'cuir-souple': 10, 'minerai-fer': 8, 'gemme-brute': 6 }, gold: 3200 },
  { id: 'craft-talisman-trefle', resultItemId: 'talisman-trefle', level: 36, materials: { 'herbe-tendre': 12, 'pierre-brute': 10, 'spore-lumineuse': 6, 'trefle-chance': 8 }, gold: 3600 },
  { id: 'craft-sceptre-d-ombre', resultItemId: 'sceptre-d-ombre', level: 38, materials: { 'bois-brut': 6, 'lingot-cuivre': 4, 'spore-lumineuse': 2, 'gemme-brute': 1 }, gold: 600 },
  { id: 'craft-armure-de-mithril', resultItemId: 'armure-de-mithril', level: 38, materials: { 'minerai-fer': 6, 'carapace-chitine': 4, 'cuir-souple': 2, 'gemme-brute': 2 }, gold: 640 },
  { id: 'craft-cuirasse-de-magma', resultItemId: 'cuirasse-de-magma', level: 38, materials: { 'minerai-fer': 8, 'carapace-chitine': 6, 'cuir-souple': 4, 'gemme-brute': 3 }, gold: 900 },
  { id: 'craft-lame-du-neant', resultItemId: 'lame-du-neant', level: 45, materials: { 'minerai-fer': 14, 'pierre-brute': 12, 'dard-de-scorpion': 6 }, gold: 3200 },
  { id: 'craft-epee-du-jugement', resultItemId: 'epee-du-jugement', level: 45, materials: { 'minerai-fer': 14, 'pierre-brute': 12, 'dard-de-scorpion': 6 }, gold: 3400 },
  { id: 'craft-arc-du-crepuscule', resultItemId: 'arc-du-crepuscule', level: 45, materials: { 'bois-brut': 14, 'cuir-souple': 12, 'croc-de-loup': 6 }, gold: 3600 },
  { id: 'craft-arc-des-etoiles', resultItemId: 'arc-des-etoiles', level: 45, materials: { 'bois-brut': 14, 'cuir-souple': 12, 'croc-de-loup': 6 }, gold: 3800 },
  { id: 'craft-sceptre-du-chaos', resultItemId: 'sceptre-du-chaos', level: 45, materials: { 'bois-brut': 14, 'lingot-cuivre': 12, 'spore-lumineuse': 6, 'gemme-brute': 5 }, gold: 4000 },
  { id: 'craft-baton-de-l-aube', resultItemId: 'baton-de-l-aube', level: 45, materials: { 'bois-brut': 14, 'lingot-cuivre': 12, 'spore-lumineuse': 6, 'gemme-brute': 5 }, gold: 4200 },
  { id: 'craft-plastron-de-dragon', resultItemId: 'plastron-de-dragon', level: 45, materials: { 'minerai-fer': 14, 'carapace-chitine': 12, 'cuir-souple': 10, 'gemme-brute': 6 }, gold: 4400 },
  { id: 'craft-armure-d-obsidienne', resultItemId: 'armure-d-obsidienne', level: 45, materials: { 'minerai-fer': 14, 'carapace-chitine': 12, 'cuir-souple': 10, 'gemme-brute': 6 }, gold: 4600 },
  { id: 'craft-robe-celeste', resultItemId: 'robe-celeste', level: 45, materials: { 'minerai-fer': 14, 'carapace-chitine': 12, 'cuir-souple': 10, 'gemme-brute': 6 }, gold: 4800 },
  { id: 'craft-armure-du-valhalla', resultItemId: 'armure-du-valhalla', level: 45, materials: { 'minerai-fer': 14, 'carapace-chitine': 12, 'cuir-souple': 10, 'gemme-brute': 6 }, gold: 5000 },
  { id: 'craft-carapace-du-roi-scarabee', resultItemId: 'carapace-du-roi-scarabee', level: 45, materials: { 'minerai-fer': 14, 'carapace-chitine': 12, 'cuir-souple': 10, 'gemme-brute': 6 }, gold: 5200 },
  { id: 'craft-coeur-de-golem', resultItemId: 'coeur-de-golem', level: 45, materials: { 'lingot-cuivre': 14, 'pierre-brute': 12, 'gemme-brute': 6, 'trefle-chance': 5 }, gold: 5600 },
  { id: 'craft-larme-d-etoile', resultItemId: 'larme-d-etoile', level: 45, materials: { 'lingot-cuivre': 14, 'pierre-brute': 12, 'gemme-brute': 6, 'trefle-chance': 5 }, gold: 5800 },
  { id: 'craft-sceau-des-anciens', resultItemId: 'sceau-des-anciens', level: 45, materials: { 'lingot-cuivre': 14, 'pierre-brute': 12, 'gemme-brute': 6, 'trefle-chance': 5 }, gold: 6000 },
  { id: 'craft-couronne-du-roi-demon', resultItemId: 'couronne-du-roi-demon', level: 45, materials: { 'cuir-souple': 14, 'minerai-fer': 12, 'croc-de-loup': 6 }, gold: 6400 },
]
