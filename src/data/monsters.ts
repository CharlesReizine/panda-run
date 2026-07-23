import type { MonsterDef } from '../core/types'
import type { MobRole } from '../core/mob-stats'
import { statsForLevel } from '../core/mob-stats'

const goldSmall = { kind: 'gold', chance: 1, min: 2, max: 6 } as const
const goldMid = { kind: 'gold', chance: 1, min: 5, max: 12 } as const
const potion = { kind: 'potion', chance: 0.25, min: 1, max: 1 } as const

// Monstre NORMAL : les PV/ATK/DÉF DÉRIVENT du niveau via le rôle (core/mob-stats) — plus aucune stat
// posée à la main (fin des incohérences niv↔stats). On ne fournit donc que le niveau + le rôle.
type NormalSpec = Omit<MonsterDef, 'hp' | 'atk' | 'def'> & { role: MobRole }
function M(s: NormalSpec): MonsterDef {
  const st = statsForLevel(s.level, s.role, s.size === 'grand')
  return { ...s, hp: st.hp, atk: st.atk, def: st.def }
}

const list: MonsterDef[] = [
  // ═══ Zone 1 — plaine / forêt ═══
  M({ id: 'gloopy', name: 'Gloopy', lore: 'Une petite bulle rose écervelée : plus curieuse que méchante, elle rebondit de joie.', color: 0xff9ecb, xp: 220, level: 1, role: 'frele', speed: 40, behavior: 'contact', drops: [goldSmall, potion] }),
  M({ id: 'angeling', name: 'Angeling', lore: 'Un ange dodu et candide qui flotte doucement, porte-bonheur ailé au cœur tendre.', color: 0xffffff, xp: 260, level: 5, role: 'frele', speed: 30, behavior: 'contact', mvp: true, floatPx: 10, drops: [goldSmall, potion, { kind: 'material', materialId: 'trefle-chance', chance: 0.03, min: 1, max: 1 }, { kind: 'item', itemId: 'ailes-angeling', chance: 0.02, min: 1, max: 1 }] }),
  M({ id: 'fabre', name: 'Fabre', lore: 'Une chenille pataude et placide qui broute l\'herbe tendre sans jamais presser le pas.', color: 0x8bc34a, xp: 260, level: 5, role: 'normal', speed: 15, behavior: 'contact', drops: [goldSmall, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.08, min: 1, max: 1 }] }),
  M({ id: 'mandragore', name: 'Mandragore', lore: 'Râleuse et sédentaire, elle crache des projectiles plutôt que de bouger son popotin.', color: 0x7bc86c, xp: 380, level: 11, role: 'distant', speed: 0, behavior: 'projectile', drops: [goldSmall, potion] }),
  M({ id: 'lunatic', name: 'Lunatic', lore: 'Un lapin lunatique aux humeurs imprévisibles qui fonce tête baissée sur un coup de sang.', color: 0xff8fc0, xp: 500, level: 1, role: 'frele', speed: 110, behavior: 'charge', drops: [goldMid, potion] }),
  M({ id: 'lapin-bondissant', name: 'Lapin bondissant', lore: 'Boule de poils survoltée qui zigzague dans les herbes et bondit sur l\'intrus dès qu\'il approche.', color: 0xf5deb3, xp: 290, level: 9, role: 'rapide', speed: 118, behavior: 'charge', drops: [goldSmall, potion, { kind: 'material', materialId: 'trefle-chance', chance: 0.03, min: 1, max: 1 }] }),
  M({ id: 'poporing', name: 'Poporing', lore: 'Un slime vert farceur, coiffé de son antenne, qui gigote avec une insouciance contagieuse.', color: 0x2e7d32, xp: 560, level: 13, role: 'costaud', speed: 20, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'louveteau', name: 'Louveteau', lore: 'Jeune loup fougueux et joueur, il mord d\'abord et réfléchit ensuite, tout en crocs.', color: 0x9a9a9a, xp: 520, level: 14, role: 'rapide', speed: 90, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'rocker', name: 'Rocker', lore: 'Une créature de mousse et de cailloux, planquée dans les fourrés, qui bombarde les passants de loin.', color: 0x558b2f, xp: 640, level: 18, role: 'distant', speed: 40, behavior: 'projectile', drops: [goldMid, potion] }),
  M({ id: 'willow', name: 'Willow', lore: 'Vieille souche endormie et débonnaire, elle avance à peine mais encaisse comme du bon bois.', color: 0x6d4c41, xp: 620, level: 16, role: 'tank', speed: 8, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'chapeau-champi', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'ronce-cracheuse', name: 'Ronce cracheuse', lore: 'Buisson d\'épines enraciné et hargneux : incapable de bouger, il crache des dards acérés sur qui passe à portée.', color: 0x497a3a, xp: 640, level: 20, role: 'distant', speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] }),
  // Oiseaux VOLANTS (aerial)
  M({ id: 'corbeau', name: 'Corbeau', lore: 'Rapace noir des grands airs : il plane en cercles puis fond en piqué sur l\'imprudent avant de reprendre de la hauteur.', color: 0x37474f, xp: 300, level: 5, role: 'volant', speed: 90, behavior: 'charge', aerial: true, drops: [goldSmall, potion] }),
  M({ id: 'faucon', name: 'Faucon', lore: 'Rapace brun des reliefs arides : plus vif et plus hargneux que le corbeau, il fond en piqué éclair sur sa proie.', color: 0x8b5a2b, xp: 720, level: 28, role: 'volant', speed: 125, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'ara', name: 'Ara', lore: 'Perroquet tropical au plumage flamboyant, criard et curieux, il voltige au-dessus des frondaisons et pique les intrus.', color: 0x1e88e5, xp: 1300, level: 42, role: 'volant', speed: 110, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'harfang-spectral', name: 'Harfang spectral', lore: 'Chouette fantomatique au plumage blafard, elle plane sans bruit dans la brume du cimetière et fond en silence, plus coriace qu\'elle n\'en a l\'air.', color: 0xe3f2fd, xp: 3100, level: 52, role: 'volant', speed: 85, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  // ═══ Zone 2 — désert ═══
  M({ id: 'scorpion', name: 'Scorpion', lore: 'Chasseur du sable, patient et venimeux, il détend son dard dès qu\'une ombre s\'approche.', color: 0xd98e32, xp: 650, level: 27, role: 'costaud', speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'fourmi-geante', name: 'Fourmi géante', lore: 'Insecte des dunes vif et increvable, elle détale en tous sens puis fond droit sur l\'intrus, mandibules ouvertes.', color: 0x8a4b2a, xp: 760, level: 27, role: 'rapide', speed: 135, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'scarabee-cornu', name: 'Scarabée cornu', lore: 'Coléoptère cuirassé au front armé d\'une corne : il baisse la tête et charge tout ce qui bouge.', color: 0x5b6b3a, xp: 900, level: 27, role: 'tank', speed: 92, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'orc-guerrier', name: 'Orc guerrier', lore: 'Brute belliqueuse qui adore la bagarre : il charge en beuglant, hache au poing.', color: 0x4a7c3f, xp: 1050, level: 27, role: 'costaud', speed: 50, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'momie', name: 'Momie', lore: 'Revenante des tombeaux, elle traîne ses bandelettes d\'un pas lent mais implacable.', color: 0xd8cfae, xp: 950, level: 27, role: 'tank', speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'vautour', name: 'Vautour', lore: 'Charognard opportuniste qui tournoie haut avant de fondre en piqué sur les faibles.', color: 0x8a6f5c, xp: 750, level: 27, role: 'rapide', speed: 110, behavior: 'charge', drops: [goldMid, potion, { kind: 'item', itemId: 'arc-souple', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'zombie', name: 'Zombie', lore: 'Cadavre ambulant et hagard, il avance en titubant, mû par une faim qui ne meurt jamais.', color: 0x6b8e63, xp: 900, level: 27, role: 'costaud', speed: 22, behavior: 'contact', drops: [goldMid, potion] }),
  M({
    id: 'mini-baphomet', name: 'Mini Baphomet', lore: 'Diablotin cornu au sourire mauvais, minuscule mais déjà rongé par la malice infernale.', color: 0x6a1b4d, xp: 1500, level: 27, role: 'rapide', speed: 80, behavior: 'charge',
    drops: [{ kind: 'gold', chance: 1, min: 20, max: 40 }, { kind: 'potion', chance: 0.4, min: 1, max: 1 }, { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 }],
  }),
  M({ id: 'serpent-des-sables', name: 'Serpent des sables', lore: 'Reptile fauve qui ondule sous les dunes, invisible jusqu\'à ce qu\'il jaillisse du sable pour fondre d\'une ruée sur sa proie.', color: 0xd2a679, xp: 700, level: 30, role: 'rapide', speed: 120, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'elementaire-de-sable', name: 'Élémentaire de sable', lore: 'Colosse de grains agglomérés animé par les vents brûlants : lent et massif, il encaisse les coups en s\'effritant à peine avant de se recomposer.', color: 0xc2a15a, xp: 1100, level: 35, role: 'tank', speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'djinn-mineur', name: 'Djinn mineur', lore: 'Esprit facétieux échappé d\'une lampe fêlée : il tournoie hors d\'atteinte et lance des éclats de feu ardent sur les curieux.', color: 0x9c6ade, xp: 1150, level: 38, role: 'distant', speed: 35, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  // ═══ Route alternative — cave ═══
  M({ id: 'squelette', name: 'Squelette', lore: 'Os blanchis animés par un vieux sortilège, il cliquette dans le noir sans jamais se lasser.', color: 0xe8e8e8, xp: 900, level: 40, role: 'normal', speed: 50, behavior: 'contact', drops: [goldMid, potion] }),
  M({ id: 'chauve-souris', name: 'Chauve-souris', lore: 'Bestiole nerveuse et imprévisible, elle zigzague dans l\'ombre et pique dès qu\'on baisse la garde.', color: 0x6b4f9e, xp: 600, level: 40, role: 'rapide', speed: 120, behavior: 'charge', drops: [goldMid, potion] }),
  M({ id: 'fantome', name: 'Fantôme', lore: 'Âme errante et mélancolique qui hante les cavernes et souffle des projectiles glacés.', color: 0xb2ebf2, xp: 700, level: 40, role: 'distant', speed: 35, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.04, min: 1, max: 1 }] }),
  M({ id: 'mage-noir', name: 'Mage noir', lore: 'Sorcier félon tapi dans l\'obscurité, il tisse ses maléfices à distance, sournois et calculateur.', color: 0x7e57c2, xp: 850, level: 40, role: 'distant', speed: 45, behavior: 'caster', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  // MVP — élites rares (mvp: true) : stats POSÉES À LA MAIN (versions surpuissantes, drops rares)
  {
    id: 'poring-dore', name: 'Poring doré', lore: 'Slime légendaire tout d\'or vêtu : rare, insaisissable et convoité de tous les aventuriers.', color: 0xffd700, hp: 220, atk: 32, def: 14, xp: 2200, level: 8, speed: 30, behavior: 'contact', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 40, max: 80 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'couronne-royale', chance: 0.12, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.08, min: 1, max: 1 },
    ],
  },
  {
    id: 'orc-seigneur', name: 'Orc seigneur', lore: 'Chef de guerre couturé de cicatrices, il règne sur la horde par la seule force de ses poings.', color: 0x2f5a26, hp: 520, atk: 125, def: 32, xp: 4200, level: 33, speed: 55, behavior: 'charge', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 70, max: 130 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'epee-fer-forgee', chance: 0.15, min: 1, max: 1 },
      { kind: 'item', itemId: 'casque-croc', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'lame-scorpion', chance: 0.05, min: 1, max: 1 },
    ],
  },
  {
    id: 'roi-crabe', name: 'Roi Crabe', lore: 'Colosse de carapace au blindage insolent, il avance de côté, pinces claquantes et fier de l\'être.', color: 0xe64a19, hp: 640, atk: 115, def: 48, xp: 4400, level: 60, speed: 35, behavior: 'contact', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 80, max: 140 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'armure-carapace', chance: 0.05, min: 1, max: 1 },
    ],
  },
  {
    id: 'spectre-ancien', name: 'Spectre ancien', lore: 'Revenant millénaire drapé de brume, son regard vide glace le sang de qui ose l\'approcher.', color: 0xb39ddb, hp: 920, atk: 195, def: 36, xp: 6800, level: 56, speed: 45, behavior: 'projectile', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 120, max: 200 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.12, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'talisman-trefle', chance: 0.06, min: 1, max: 1 },
    ],
  },
  {
    id: 'dragon-flamme', name: 'Dragon de flamme', lore: 'Terreur écailleuse au souffle brûlant : majestueux, féroce, il ne laisse que des cendres.', color: 0xc62828, hp: 1450, atk: 235, def: 52, xp: 9500, level: 67, speed: 60, behavior: 'charge', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 180, max: 300 },
      { kind: 'potion', chance: 0.6, min: 1, max: 1 },
      { kind: 'item', itemId: 'baton-lumineux', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'couronne-royale', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'lame-scorpion', chance: 0.08, min: 1, max: 1 },
      { kind: 'item', itemId: 'armure-carapace', chance: 0.05, min: 1, max: 1 },
    ],
  },
  // Boss
  {
    id: 'roi-gloopy', name: 'Roi Gloopy', lore: 'Le plus gros des slimes, couronné et fier, il écrase ses sujets sous sa masse rose.', color: 0xff5fa8, hp: 1150, atk: 52, def: 10, xp: 3200, level: 1, speed: 60, behavior: 'charge', boss: true, bossClass: 'novice', bossSummon: 'gloopy',
    drops: [
      { kind: 'gold', chance: 1, min: 60, max: 100 },
      { kind: 'item', itemId: 'epee-bambou', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'arc-souple', chance: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'pharaon-scarabee', name: 'Pharaon Scarabée', lore: 'Souverain des sables réveillé de son sarcophage, il fend l\'air de sa lame d\'or et fond sur l\'intrus d\'un bond fulgurant.', color: 0x3fb7b0, hp: 3200, atk: 100, def: 26, xp: 6000, level: 35, speed: 120, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'scarabee-cornu',
    drops: [
      { kind: 'gold', chance: 1, min: 150, max: 250 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
  // ═══ Zone 3 — jungle ═══
  M({ id: 'flora-vorace', name: 'Flora vorace', lore: 'Plante carnivore enracinée et affamée, elle crache ses graines acides sur tout ce qui passe à portée.', color: 0xb0245e, xp: 1450, level: 41, role: 'distant', speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'frelon-geant', name: 'Frelon géant', lore: 'Bourdon furieux et territorial, il fond en vrombissant sur quiconque frôle son nid.', color: 0xf9a825, xp: 1400, level: 41, role: 'rapide', speed: 130, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'singe-grimpeur', name: 'Singe grimpeur', lore: 'Chapardeur agile et chahuteur, il saute de branche en branche pour mieux vous tomber dessus.', color: 0x795548, xp: 1500, level: 18, role: 'costaud', speed: 90, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'ours-brun', name: 'Ours brun', lore: 'Masse de muscles et de fourrure : lent mais redoutable, il se dresse de toute sa hauteur avant d\'abattre ses pattes.', color: 0x6d4325, xp: 1620, level: 19, role: 'tank', speed: 55, behavior: 'contact', size: 'grand', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.08, min: 1, max: 1 }] }),
  // ═══ Route alternative — plage : AQUATIQUES (aquatic:true) ═══
  M({ id: 'crabe-geant', name: 'Crabe géant', lore: 'Sentinelle bardée de carapace sur la plage, lente mais coriace, elle ne cède pas un pouce de sable.', color: 0xe64a19, xp: 1400, level: 57, role: 'tank', speed: 40, behavior: 'contact', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'meduse', name: 'Méduse', lore: 'Beauté translucide et trompeuse, elle dérive au gré des flots et décharge ses filaments urticants.', color: 0xba68c8, xp: 1350, level: 27, role: 'distant', speed: 25, behavior: 'projectile', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  // MENACES D'EAU GÉNÉRIQUES (aquatic:true) — pas spécifiques d'un biome, placées dans les plans d'eau
  // de TOUTES les zones : elles nagent sans se noyer et INFLIGENT des dégâts au joueur immergé (contact
  // pour le requin/piranha, filaments pour la méduse). Le requin a son art (art-requin) ; le piranha
  // RÉUTILISE l'illustration décorative fish-piranha (via tex).
  M({ id: 'requin', name: 'Requin', lore: 'Prédateur silencieux des eaux profondes : il glisse dans le bleu puis fond sur le nageur, gueule béante.', color: 0x546e7a, xp: 980, level: 27, role: 'rapide', speed: 130, behavior: 'charge', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'piranha', name: 'Piranha', lore: 'Nuée de dents miniature : seul il n\'est rien, en banc il déchiquette tout ce qui remue dans l\'eau.', color: 0xc0392b, xp: 520, level: 27, role: 'frele', speed: 100, behavior: 'contact', aquatic: true, tex: 'fish-piranha', drops: [goldMid, potion] }),
  // AQUATIQUE de zone TARDIVE (plage profonde) : le kraken juvénile nage sans se noyer et malmène le
  // nageur au contact. Épinglé à un plan d'eau de plage tardive (cf. PINNED_SPAWNS dans levels.ts).
  M({ id: 'kraken-juvenile', name: 'Kraken juvénile', lore: 'Jeune céphalopode des grands fonds, déjà bardé de tentacules : il patrouille les lagons profonds et enserre quiconque ose nager dans son domaine.', color: 0x2e6f8e, xp: 4200, level: 60, role: 'costaud', speed: 110, behavior: 'charge', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] }),
  // ═══ Zone 4 — montagne ═══
  M({ id: 'harpie', name: 'Harpie', lore: 'Furie ailée au cri strident, elle fond des cimes en piqué, serres en avant et sans pitié.', color: 0x8d6e63, xp: 2200, level: 48, role: 'rapide', speed: 140, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'yeti', name: 'Yéti', lore: 'Colosse des neiges au grand cœur bourru, paisible tant qu\'on ne trouble pas sa montagne.', color: 0xeceff1, xp: 2600, level: 51, role: 'tank', speed: 45, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.04, min: 1, max: 1 }] }),
  M({ id: 'loup-des-neiges', name: 'Loup des neiges', lore: 'Prédateur au pelage givré, silencieux dans la poudreuse : il fond sur sa proie en une charge fulgurante avant qu\'elle n\'entende ses pas.', color: 0xcfe8f5, xp: 2300, level: 49, role: 'rapide', speed: 122, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.06, min: 1, max: 1 }] }),
  // ═══ Route alternative — carrière ═══
  M({ id: 'golem-de-pierre', name: 'Golem de pierre', lore: 'Monolithe animé, impassible et lent, il broie tout sur son passage sans jamais s\'énerver.', color: 0x8a8078, xp: 2400, level: 43, role: 'tank', speed: 25, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.08, min: 1, max: 1 }, { kind: 'item', itemId: 'carapace-scarabee', chance: 0.03, min: 1, max: 1 }] }),
  M({ id: 'gobelin-mineur', name: 'Gobelin mineur', lore: 'Petit fouineur cupide de la carrière, il balance ses cailloux avant de détaler en ricanant.', color: 0x6d8a3f, xp: 2000, level: 40, role: 'distant', speed: 60, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] }),
  // ═══ Zone 5 — cimetière ═══
  M({ id: 'goule', name: 'Goule', lore: 'Charognarde des tombes, vorace et griffue, elle traque la chair fraîche au fond du cimetière.', color: 0x556b2f, xp: 3200, level: 52, role: 'costaud', speed: 70, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.03, min: 1, max: 1 }] }),
  M({ id: 'banshee', name: 'Banshee', lore: 'Spectre plaintif au hurlement funeste, son chant déchirant transperce l\'âme à distance.', color: 0x9575cd, xp: 3000, level: 52, role: 'distant', speed: 50, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'pretre-goule', name: 'Prêtre-goule', lore: 'Officiant corrompu des morts, il psalmodie des malédictions et anime les ombres à sa guise.', color: 0x455a64, xp: 3200, level: 52, role: 'distant', speed: 40, behavior: 'caster', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'totem-maudit', name: 'Totem maudit', lore: 'Mât funéraire gravé de visages hurlants, scellé au sol : il vomit des feux follets maudits sur qui s\'approche.', color: 0x5a4636, xp: 3100, level: 52, role: 'distant', speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'liche-mineure', name: 'Liche mineure', lore: 'Nécromancien desséché dont l\'âme s\'accroche encore aux os : de loin, elle darde des salves de givre nécrotique sur les vivants.', color: 0x6a7b8c, xp: 3200, level: 53, role: 'distant', speed: 40, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] }),
  // ═══ Zone 6 — enfer ═══
  M({ id: 'diablotin', name: 'Diablotin', lore: 'Farceur des flammes, vif et hargneux, il fonce en ricanant droit sorti des enfers.', color: 0xd84315, xp: 4200, level: 63, role: 'rapide', speed: 150, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'gargouille', name: 'Gargouille', lore: 'Statue de pierre qui feint le sommeil, puis s\'éveille d\'un coup pour fondre sur l\'imprudent.', color: 0x546e7a, xp: 4800, level: 64, role: 'tank', speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'arc-souple', chance: 0.03, min: 1, max: 1 }] }),
  M({ id: 'golem-de-lave', name: 'Golem de lave', lore: 'Colosse de roche en fusion aux veines incandescentes : chaque pas fait fumer le sol, chaque coup calcine.', color: 0xb3401a, xp: 4700, level: 63, role: 'tank', speed: 32, behavior: 'contact', size: 'grand', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.08, min: 1, max: 1 }] }),
  M({ id: 'cerbere', name: 'Cerbère', lore: 'Molosse à trois gueules gardant les portes infernales : chacune de ses têtes crache la fureur et il charge en meute à lui seul.', color: 0x7a1f1f, xp: 5200, level: 67, role: 'costaud', speed: 130, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.07, min: 1, max: 1 }, { kind: 'item', itemId: 'casque-croc', chance: 0.04, min: 1, max: 1 }] }),
  // ═══ VARIANTES GÉANTES (réutilisent l'art de la base, size 'grand', niveau + stats en hausse) ═══
  // Placées dans des pools de biomes PLUS AVANCÉS que la base → niveau calibré supérieur (cf. mob-level).
  M({ id: 'gloopy-geant', name: 'Gloopy géant', lore: 'Un slime rose gonflé à bloc, énorme et gélatineux : la même bonne bouille écervelée, en dix fois plus lourd.', color: 0xff9ecb, xp: 720, level: 19, role: 'frele', speed: 34, behavior: 'contact', size: 'grand', artFrom: 'gloopy', drops: [goldMid, potion] }),
  M({ id: 'fabre-geant', name: 'Fabre géant', lore: 'Chenille monstrueuse et bardée de bourrelets, elle broute des buissons entiers et encaisse comme un tronc.', color: 0x8bc34a, xp: 760, level: 19, role: 'tank', speed: 13, behavior: 'contact', size: 'grand', artFrom: 'fabre', drops: [goldMid, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.1, min: 1, max: 1 }] }),
  M({ id: 'scorpion-geant', name: 'Scorpion géant', lore: 'Cuirasse de chitine grande comme un char, son dard perce l\'armure et son venin foudroie.', color: 0xd98e32, xp: 1500, level: 41, role: 'costaud', speed: 55, behavior: 'contact', size: 'grand', artFrom: 'scorpion', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.08, min: 1, max: 1 }] }),
  // GROS variantes DÉSERT (art réutilisé) : gardent le désert profond thématiquement PUR (remplacent les
  // emprunts jungle/montagne des terrains-passerelles). Même xp que le mob remplacé → cumul désert quasi
  // inchangé (onde de choc de calibration minimale).
  M({ id: 'scarabee-geant', name: 'Scarabée colosse', lore: 'Coléoptère cuirassé devenu titan des sables : sa charge fait trembler les dunes.', color: 0x5b6b3a, xp: 1400, level: 47, role: 'tank', speed: 74, behavior: 'charge', size: 'grand', artFrom: 'scarabee-cornu', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.08, min: 1, max: 1 }] }),
  M({ id: 'vautour-geant', name: 'Vautour royal', lore: 'Charognard colossal au bec d\'acier : il éclipse le soleil avant de fondre en piqué.', color: 0x8a6f5c, xp: 2200, level: 55, role: 'rapide', speed: 118, behavior: 'charge', aerial: true, size: 'grand', artFrom: 'vautour', drops: [goldMid, potion] }),
  M({ id: 'momie-geante', name: 'Momie géante', lore: 'Colosse embaumé traînant des bandelettes lourdes de siècles, chaque pas ébranle le tombeau.', color: 0xd8cfae, xp: 3000, level: 52, role: 'tank', speed: 26, behavior: 'contact', size: 'grand', artFrom: 'momie', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'squelette-geant', name: 'Squelette géant', lore: 'Ossature titanesque recollée par la nécromancie : ses phalanges seules pèsent le poids d\'un homme.', color: 0xe8e8e8, xp: 2600, level: 52, role: 'tank', speed: 44, behavior: 'contact', size: 'grand', artFrom: 'squelette', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] }),
  M({ id: 'singe-geant', name: 'Singe géant', lore: 'Primate colossal au poitrail de tambour : il martèle le sol et jette des rochers en hurlant.', color: 0x795548, xp: 2600, level: 51, role: 'costaud', speed: 80, behavior: 'contact', size: 'grand', artFrom: 'singe-grimpeur', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.06, min: 1, max: 1 }] }),
  M({ id: 'goule-geante', name: 'Goule géante', lore: 'Charogne enflée jusqu\'à la démesure, griffes comme des faux, elle éventre d\'un seul revers.', color: 0x556b2f, xp: 4800, level: 55, role: 'costaud', speed: 62, behavior: 'contact', size: 'grand', artFrom: 'goule', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.07, min: 1, max: 1 }] }),
  M({ id: 'diablotin-geant', name: 'Diablotin géant', lore: 'Démon des braises boursouflé de rage, ses cornes raclent la voûte et son rire calcine.', color: 0xd84315, xp: 6200, level: 66, role: 'rapide', speed: 132, behavior: 'charge', size: 'grand', artFrom: 'diablotin', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.08, min: 1, max: 1 }] }),
  // ═══ Gardiens — « boss de palier » (stats posées à la main, GARDIEN_LEVEL_BONUS) ═══
  { id: 'gardien-sylve', name: 'Gardien Sylve', lore: 'Colosse de bois ancien planté en travers du chemin, immobile et patient, il barre la route depuis des siècles.', color: 0x4e342e, hp: 2200, atk: 55, def: 45, xp: 2000, level: 1, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 }] },
  { id: 'gardien-pierre', name: 'Gardien Pierre', lore: 'Sentinelle de roc dressée depuis l\'aube des temps, inébranlable, elle veille sans jamais ciller.', color: 0x707070, hp: 3200, atk: 80, def: 55, xp: 3200, level: 1, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.2, min: 1, max: 2 }] },
  { id: 'gardien-flamme', name: 'Gardien Flamme', lore: 'Colosse ardent scellé aux portes de l\'enfer, brasier vivant qui calcine quiconque prétend passer.', color: 0xbf360c, hp: 5000, atk: 130, def: 65, xp: 6000, level: 75, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.25, min: 1, max: 2 }] },
  // Boss — zone 3 (jungle)
  {
    id: 'seigneur-liane', name: 'Seigneur Liane', lore: 'Souverain de la jungle aux mille lianes, archimage sylvestre : il embrase l\'air de sphères ardentes et fait pleuvoir le feu du ciel.', color: 0x1b5e20, hp: 5200, atk: 122, def: 34, xp: 9000, level: 49, speed: 60, behavior: 'projectile', boss: true, bossClass: 'mage', bossSummon: 'flora-vorace',
    drops: [
      { kind: 'gold', chance: 1, min: 200, max: 320 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'plastron-feuilles', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss — zone 4 (montagne)
  {
    id: 'golem-ancien', name: 'Golem Ancien', lore: 'Titan de pierre gravé de runes oubliées : ses runes crachent des salves d\'éclats perçants et un déluge de pierres du ciel.', color: 0x78909c, hp: 7600, atk: 142, def: 50, xp: 13000, level: 65, speed: 55, behavior: 'projectile', boss: true, bossClass: 'archer', bossSummon: 'gobelin-mineur', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 280, max: 420 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.4, min: 1, max: 1 },
    ],
  },
  // Boss — zone 5 (cimetière)
  {
    id: 'roi-liche', name: 'Roi Liche', lore: 'Seigneur mort-vivant au sceptre glacé, sorcier suprême : il déchaîne des novae nécrotiques et des salves d\'os hurlantes depuis son trône.', color: 0x4527a0, hp: 10500, atk: 176, def: 46, xp: 18000, level: 58, speed: 50, behavior: 'projectile', boss: true, bossClass: 'sorcier', bossSummon: 'squelette',
    drops: [
      { kind: 'gold', chance: 1, min: 350, max: 520 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss final — zone 6 (enfer)
  {
    id: 'seigneur-dechu', name: 'Seigneur Déchu', lore: 'Maître ultime des enfers, ange tombé rongé de haine : il manie les meilleures armes de chaque classe — lame, feu, flèches et néant.', color: 0x8a1414, hp: 16500, atk: 205, def: 60, xp: 30000, level: 75, speed: 90, behavior: 'charge', boss: true, bossClass: 'chevalier', bossSummon: 'diablotin',
    drops: [
      { kind: 'gold', chance: 1, min: 500, max: 800 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 1, min: 1, max: 1 },
    ],
  },
  // ─── Boss du monde carte A (placeholders d'art réutilisés) ───
  {
    id: 'boss-sylve', name: 'Gardien de la Sylve', lore: 'Colosse de bois millénaire éveillé par la profanation de sa forêt : il abat ses branches comme des massues et invoque les ronces pour étouffer l\'intrus.', color: 0x3e5e2a, hp: 1900, atk: 60, def: 16, xp: 3600, level: 30, speed: 62, behavior: 'charge', boss: true, bossClass: 'novice', bossSummon: 'ronce-cracheuse',
    drops: [
      { kind: 'gold', chance: 1, min: 70, max: 120 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'plastron-feuilles', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  {
    id: 'boss-golem-cave', name: 'Golem des Cavernes', lore: 'Titan de roche brute scellé au cœur des cavernes : il pilonne l\'écho de ses poings de granit et fait pleuvoir des éclats du plafond.', color: 0x7c7168, hp: 5200, atk: 132, def: 46, xp: 9200, level: 44, speed: 48, behavior: 'projectile', boss: true, bossClass: 'archer', bossSummon: 'gobelin-mineur', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 200, max: 320 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'casque-croc', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: 'boss-yeti', name: 'Yéti Géant', lore: 'Seigneur des cimes gelées, montagne de fourrure et de fureur : il fond sur sa proie d\'un bond qui fait trembler la neige et abat ses griffes comme des lames.', color: 0xdfe9ef, hp: 6600, atk: 152, def: 42, xp: 11500, level: 54, speed: 118, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'louveteau', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 240, max: 360 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.4, min: 1, max: 1 },
      { kind: 'item', itemId: 'armure-carapace', chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: 'boss-crabe', name: 'Roi des Crabes', lore: 'Monarque cuirassé des récifs, blindage insolent et pinces tranchantes : il claque ses tenailles comme des cisailles et bondit de côté pour broyer l\'imprudent.', color: 0xd8431a, hp: 5600, atk: 142, def: 58, xp: 10200, level: 64, speed: 96, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'crabe-geant', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 220, max: 340 },
      { kind: 'item', itemId: 'armure-carapace', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.4, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.3, min: 1, max: 1 },
    ],
  },
]

// SKILLS SIGNATURE (contexte joueur, affichés bestiaire + aperçu de carte). Boss = 3 skills de leur
// classe incarnée ; ÉLITES (mvp) = 1 skill thématique. Ids réels de data/skills (icônes skill-<id>).
const MOB_SKILLS: Record<string, string[]> = {
  // ── Boss (3) ──
  'boss-sylve': ['calin-brutal', 'bambou-jete', 'rugissement-panda'],
  'roi-gloopy': ['calin-brutal', 'bambou-jete', 'rugissement-panda'],
  'pharaon-scarabee': ['taillade', 'tourbillon', 'attaque-chargee'],
  'boss-yeti': ['taillade', 'tourbillon', 'plongeon'],
  'boss-crabe': ['taillade', 'tourbillon', 'attaque-chargee'],
  'boss-golem-cave': ['fleche-percante', 'pluie-de-fleches', 'piege'],
  'golem-ancien': ['fleche-percante', 'pluie-de-fleches', 'nuee-de-fleches'],
  'seigneur-liane': ['boule-de-feu', 'mur-de-flamme', 'nova-de-givre'],
  'roi-liche': ['faille-du-neant', 'pluie-de-meteores', 'blizzard'],
  'seigneur-dechu': ['charge-lanciere', 'grand-croix', 'epee-fantome'],
  // ── Élites / MVP (1) ──
  'angeling': ['grand-croix'],
  'poring-dore': ['rugissement-panda'],
  'orc-seigneur': ['attaque-chargee'],
  'spectre-ancien': ['eclair'],
  'roi-crabe': ['tourbillon'],
  'dragon-flamme': ['pluie-de-meteores'],
}
for (const m of list) { const s = MOB_SKILLS[m.id]; if (s) m.skills = s }

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]))
