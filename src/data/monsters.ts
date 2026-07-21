import type { MonsterDef } from '../core/types'

const goldSmall = { kind: 'gold', chance: 1, min: 2, max: 6 } as const
const goldMid = { kind: 'gold', chance: 1, min: 5, max: 12 } as const
const potion = { kind: 'potion', chance: 0.25, min: 1, max: 1 } as const

const list: MonsterDef[] = [
  // Zone 1 — plaine / forêt
  { id: 'gloopy', name: 'Gloopy', lore: 'Une petite bulle rose écervelée : plus curieuse que méchante, elle rebondit de joie.', color: 0xff9ecb, hp: 30, atk: 8, def: 0, xp: 220, level: 1, speed: 40, behavior: 'contact', drops: [goldSmall, potion] },
  { id: 'angeling', name: 'Angeling', lore: 'Un ange dodu et candide qui flotte doucement, porte-bonheur ailé au cœur tendre.', color: 0xffffff, hp: 32, atk: 6, def: 1, xp: 260, level: 1, speed: 30, behavior: 'contact', drops: [goldSmall, potion, { kind: 'material', materialId: 'trefle-chance', chance: 0.03, min: 1, max: 1 }] },
  { id: 'fabre', name: 'Fabre', lore: 'Une chenille pataude et placide qui broute l\'herbe tendre sans jamais presser le pas.', color: 0x8bc34a, hp: 38, atk: 9, def: 3, xp: 260, level: 1, speed: 15, behavior: 'contact', drops: [goldSmall, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.08, min: 1, max: 1 }] },
  { id: 'mandragore', name: 'Mandragore', lore: 'Râleuse et sédentaire, elle crache des projectiles plutôt que de bouger son popotin.', color: 0x7bc86c, hp: 45, atk: 11, def: 2, xp: 380, level: 1, speed: 0, behavior: 'projectile', drops: [goldSmall, potion] },
  { id: 'lunatic', name: 'Lunatic', lore: 'Un lapin lunatique aux humeurs imprévisibles qui fonce tête baissée sur un coup de sang.', color: 0xff8fc0, hp: 50, atk: 14, def: 1, xp: 500, level: 1, speed: 110, behavior: 'charge', drops: [goldMid, potion] },
  // MOBILE-MÊLÉE (charge/bond) — plaine. Détale et BONDIT sur le joueur par à-coups (variante ruée).
  { id: 'lapin-bondissant', name: 'Lapin bondissant', lore: 'Boule de poils survoltée qui zigzague dans les herbes et bondit sur l\'intrus dès qu\'il approche.', color: 0xf5deb3, hp: 46, atk: 12, def: 1, xp: 290, level: 1, speed: 118, behavior: 'charge', drops: [goldSmall, potion, { kind: 'material', materialId: 'trefle-chance', chance: 0.03, min: 1, max: 1 }] },
  { id: 'poporing', name: 'Poporing', lore: 'Un slime vert farceur, coiffé de son antenne, qui gigote avec une insouciance contagieuse.', color: 0x2e7d32, hp: 60, atk: 18, def: 4, xp: 560, level: 4, speed: 20, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'louveteau', name: 'Louveteau', lore: 'Jeune loup fougueux et joueur, il mord d\'abord et réfléchit ensuite, tout en crocs.', color: 0x9a9a9a, hp: 55, atk: 15, def: 2, xp: 520, level: 6, speed: 90, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  { id: 'rocker', name: 'Rocker', lore: 'Une créature de mousse et de cailloux, planquée dans les fourrés, qui bombarde les passants de loin.', color: 0x558b2f, hp: 70, atk: 21, def: 5, xp: 640, level: 19, speed: 40, behavior: 'projectile', drops: [goldMid, potion] },
  { id: 'willow', name: 'Willow', lore: 'Vieille souche endormie et débonnaire, elle avance à peine mais encaisse comme du bon bois.', color: 0x6d4c41, hp: 95, atk: 19, def: 10, xp: 620, level: 9, speed: 8, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'chapeau-champi', chance: 0.05, min: 1, max: 1 }] },
  // IMMOBILE-DISTANCE — ronce enracinée (forêt/jungle). Ne bouge pas, CRACHE ses épines dès que le
  // joueur est à portée (même modèle que mandragore/rocker, mais épines vertes).
  { id: 'ronce-cracheuse', name: 'Ronce cracheuse', lore: 'Buisson d\'épines enraciné et hargneux : incapable de bouger, il crache des dards acérés sur qui passe à portée.', color: 0x497a3a, hp: 74, atk: 22, def: 6, xp: 640, level: 14, speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  // Oiseau — monstre VOLANT de plein air (corniches & vide, crêtes, volées). Plane en sinus, pique
  // sur le joueur puis remonte ; gravité coupée (aerial). Tuable. Placeholder dessiné en code.
  { id: 'corbeau', name: 'Corbeau', lore: 'Rapace noir des grands airs : il plane en cercles puis fond en piqué sur l\'imprudent avant de reprendre de la hauteur.', color: 0x37474f, hp: 34, atk: 10, def: 1, xp: 300, level: 1, speed: 90, behavior: 'charge', aerial: true, drops: [goldSmall, potion] },
  // Autres OISEAUX (aerial) — même modèle de vol que le corbeau, calibrés sur leurs biomes.
  // Placeholders dessinés en code (PreloadScene) ; art Gemini art-<id>.png pris automatiquement.
  { id: 'faucon', name: 'Faucon', lore: 'Rapace brun des reliefs arides : plus vif et plus hargneux que le corbeau, il fond en piqué éclair sur sa proie.', color: 0x8b5a2b, hp: 90, atk: 105, def: 8, xp: 720, level: 25, speed: 125, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  { id: 'ara', name: 'Ara', lore: 'Perroquet tropical au plumage flamboyant, criard et curieux, il voltige au-dessus des frondaisons et pique les intrus.', color: 0x1e88e5, hp: 150, atk: 120, def: 10, xp: 1300, level: 35, speed: 110, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'harfang-spectral', name: 'Harfang spectral', lore: 'Chouette fantomatique au plumage blafard, elle plane sans bruit dans la brume du cimetière et fond en silence, plus coriace qu\'elle n\'en a l\'air.', color: 0xe3f2fd, hp: 380, atk: 190, def: 28, xp: 3100, level: 45, speed: 85, behavior: 'charge', aerial: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  // Zone 2 — désert
  { id: 'scorpion', name: 'Scorpion', lore: 'Chasseur du sable, patient et venimeux, il détend son dard dès qu\'une ombre s\'approche.', color: 0xd98e32, hp: 100, atk: 88, def: 15, xp: 650, level: 25, speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] },
  // MOBILE-MÊLÉE rapide (charge) — désert/cave. Détale vite et fond en ligne droite sur sa proie.
  { id: 'fourmi-geante', name: 'Fourmi géante', lore: 'Insecte des dunes vif et increvable, elle détale en tous sens puis fond droit sur l\'intrus, mandibules ouvertes.', color: 0x8a4b2a, hp: 106, atk: 90, def: 12, xp: 760, level: 25, speed: 135, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.05, min: 1, max: 1 }] },
  // MOBILE-MÊLÉE (charge cornue) — désert/carrière. Charge tête baissée, corne en avant.
  { id: 'scarabee-cornu', name: 'Scarabée cornu', lore: 'Coléoptère cuirassé au front armé d\'une corne : il baisse la tête et charge tout ce qui bouge.', color: 0x5b6b3a, hp: 132, atk: 96, def: 22, xp: 900, level: 25, speed: 92, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] },
  { id: 'orc-guerrier', name: 'Orc guerrier', lore: 'Brute belliqueuse qui adore la bagarre : il charge en beuglant, hache au poing.', color: 0x4a7c3f, hp: 145, atk: 112, def: 20, xp: 1050, level: 28, speed: 50, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] },
  { id: 'momie', name: 'Momie', lore: 'Revenante des tombeaux, elle traîne ses bandelettes d\'un pas lent mais implacable.', color: 0xd8cfae, hp: 150, atk: 75, def: 18, xp: 950, level: 25, speed: 30, behavior: 'contact', drops: [goldMid, potion, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.05, min: 1, max: 1 }] },
  { id: 'vautour', name: 'Vautour', lore: 'Charognard opportuniste qui tournoie haut avant de fondre en piqué sur les faibles.', color: 0x8a6f5c, hp: 90, atk: 100, def: 10, xp: 750, level: 25, speed: 110, behavior: 'charge', drops: [goldMid, potion, { kind: 'item', itemId: 'arc-souple', chance: 0.05, min: 1, max: 1 }] },
  { id: 'zombie', name: 'Zombie', lore: 'Cadavre ambulant et hagard, il avance en titubant, mû par une faim qui ne meurt jamais.', color: 0x6b8e63, hp: 165, atk: 72, def: 16, xp: 900, level: 26, speed: 22, behavior: 'contact', drops: [goldMid, potion] },
  {
    id: 'mini-baphomet', name: 'Mini Baphomet', lore: 'Diablotin cornu au sourire mauvais, minuscule mais déjà rongé par la malice infernale.', color: 0x6a1b4d, hp: 240, atk: 125, def: 24, xp: 1500, level: 29, speed: 80, behavior: 'charge',
    drops: [{ kind: 'gold', chance: 1, min: 20, max: 40 }, { kind: 'potion', chance: 0.4, min: 1, max: 1 }, { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 }],
  },
  // Route alternative — cave
  { id: 'squelette', name: 'Squelette', lore: 'Os blanchis animés par un vieux sortilège, il cliquette dans le noir sans jamais se lasser.', color: 0xe8e8e8, hp: 130, atk: 81, def: 16, xp: 900, level: 34, speed: 50, behavior: 'contact', drops: [goldMid, potion] },
  { id: 'chauve-souris', name: 'Chauve-souris', lore: 'Bestiole nerveuse et imprévisible, elle zigzague dans l\'ombre et pique dès qu\'on baisse la garde.', color: 0x6b4f9e, hp: 70, atk: 106, def: 8, xp: 600, level: 34, speed: 120, behavior: 'charge', drops: [goldMid, potion] },
  { id: 'fantome', name: 'Fantôme', lore: 'Âme errante et mélancolique qui hante les cavernes et souffle des projectiles glacés.', color: 0xb2ebf2, hp: 80, atk: 75, def: 22, xp: 700, level: 34, speed: 35, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.04, min: 1, max: 1 }] },
  { id: 'mage-noir', name: 'Mage noir', lore: 'Sorcier félon tapi dans l\'obscurité, il tisse ses maléfices à distance, sournois et calculateur.', color: 0x7e57c2, hp: 100, atk: 88, def: 12, xp: 850, level: 34, speed: 45, behavior: 'caster', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  // MVP — élites rares (mvp: true) : versions surpuissantes d'un biome, stats bien au-dessus des
  // mobs mais loin d'un boss ; xp élevé ; drops rares (objets épiques/légendaires à faible %)
  {
    id: 'poring-dore', name: 'Poring doré', lore: 'Slime légendaire tout d\'or vêtu : rare, insaisissable et convoité de tous les aventuriers.', color: 0xffd700, hp: 220, atk: 32, def: 14, xp: 2200, level: 11, speed: 30, behavior: 'contact', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 40, max: 80 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'couronne-royale', chance: 0.12, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.08, min: 1, max: 1 },
    ],
  },
  {
    id: 'orc-seigneur', name: 'Orc seigneur', lore: 'Chef de guerre couturé de cicatrices, il règne sur la horde par la seule force de ses poings.', color: 0x2f5a26, hp: 520, atk: 125, def: 32, xp: 4200, level: 30, speed: 55, behavior: 'charge', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 70, max: 130 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'epee-fer-forgee', chance: 0.15, min: 1, max: 1 },
      { kind: 'item', itemId: 'casque-croc', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'lame-scorpion', chance: 0.05, min: 1, max: 1 },
    ],
  },
  {
    id: 'roi-crabe', name: 'Roi Crabe', lore: 'Colosse de carapace au blindage insolent, il avance de côté, pinces claquantes et fier de l\'être.', color: 0xe64a19, hp: 640, atk: 115, def: 48, xp: 4400, level: 52, speed: 35, behavior: 'contact', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 80, max: 140 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'armure-carapace', chance: 0.05, min: 1, max: 1 },
    ],
  },
  {
    id: 'spectre-ancien', name: 'Spectre ancien', lore: 'Revenant millénaire drapé de brume, son regard vide glace le sang de qui ose l\'approcher.', color: 0xb39ddb, hp: 920, atk: 195, def: 36, xp: 6800, level: 48, speed: 45, behavior: 'projectile', mvp: true,
    drops: [
      { kind: 'gold', chance: 1, min: 120, max: 200 },
      { kind: 'potion', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.12, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.1, min: 1, max: 1 },
      { kind: 'item', itemId: 'talisman-trefle', chance: 0.06, min: 1, max: 1 },
    ],
  },
  {
    id: 'dragon-flamme', name: 'Dragon de flamme', lore: 'Terreur écailleuse au souffle brûlant : majestueux, féroce, il ne laisse que des cendres.', color: 0xc62828, hp: 1450, atk: 235, def: 52, xp: 9500, level: 59, speed: 60, behavior: 'charge', mvp: true,
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
    id: 'pharaon-scarabee', name: 'Pharaon Scarabée', lore: 'Souverain des sables réveillé de son sarcophage, il fend l\'air de sa lame d\'or et fond sur l\'intrus d\'un bond fulgurant.', color: 0x3fb7b0, hp: 3200, atk: 100, def: 26, xp: 6000, level: 32, speed: 120, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'scarabee-cornu',
    drops: [
      { kind: 'gold', chance: 1, min: 150, max: 250 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
  // Zone 3 — jungle
  { id: 'flora-vorace', name: 'Flora vorace', lore: 'Plante carnivore enracinée et affamée, elle crache ses graines acides sur tout ce qui passe à portée.', color: 0xb0245e, hp: 190, atk: 119, def: 20, xp: 1450, level: 35, speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'frelon-geant', name: 'Frelon géant', lore: 'Bourdon furieux et territorial, il fond en vrombissant sur quiconque frôle son nid.', color: 0xf9a825, hp: 160, atk: 138, def: 12, xp: 1400, level: 35, speed: 130, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'spore-lumineuse', chance: 0.05, min: 1, max: 1 }] },
  { id: 'singe-grimpeur', name: 'Singe grimpeur', lore: 'Chapardeur agile et chahuteur, il saute de branche en branche pour mieux vous tomber dessus.', color: 0x795548, hp: 210, atk: 125, def: 18, xp: 1500, level: 17, speed: 90, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'herbe-tendre', chance: 0.06, min: 1, max: 1 }] },
  // MOBILE-MÊLÉE, GRAND & TANKY (contact) — forêt/jungle & montagne. Colosse à fourrure : il avance,
  // se plante à portée et ASSÈNE un coup lourd télégraphié (gabarit 'grand' → rendu + hitbox agrandis).
  { id: 'ours-brun', name: 'Ours brun', lore: 'Masse de muscles et de fourrure : lent mais redoutable, il se dresse de toute sa hauteur avant d\'abattre ses pattes.', color: 0x6d4325, hp: 470, atk: 132, def: 35, xp: 1620, level: 20, speed: 55, behavior: 'contact', size: 'grand', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.08, min: 1, max: 1 }] },
  // Route alternative — plage
  // AQUATIQUES (aquatic:true) : crabe et méduse nagent dans l'eau marine sans se noyer (§ noyade mob).
  { id: 'crabe-geant', name: 'Crabe géant', lore: 'Sentinelle bardée de carapace sur la plage, lente mais coriace, elle ne cède pas un pouce de sable.', color: 0xe64a19, hp: 230, atk: 112, def: 30, xp: 1400, level: 48, speed: 40, behavior: 'contact', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  { id: 'meduse', name: 'Méduse', lore: 'Beauté translucide et trompeuse, elle dérive au gré des flots et décharge ses filaments urticants.', color: 0xba68c8, hp: 150, atk: 125, def: 10, xp: 1350, level: 48, speed: 25, behavior: 'projectile', aquatic: true, drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  // Zone 4 — montagne
  { id: 'harpie', name: 'Harpie', lore: 'Furie ailée au cri strident, elle fond des cimes en piqué, serres en avant et sans pitié.', color: 0x8d6e63, hp: 260, atk: 162, def: 20, xp: 2200, level: 41, speed: 140, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'croc-de-loup', chance: 0.05, min: 1, max: 1 }] },
  { id: 'yeti', name: 'Yéti', lore: 'Colosse des neiges au grand cœur bourru, paisible tant qu\'on ne trouble pas sa montagne.', color: 0xeceff1, hp: 380, atk: 175, def: 35, xp: 2600, level: 44, speed: 45, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'plastron-feuilles', chance: 0.04, min: 1, max: 1 }] },
  // Route alternative — carrière
  { id: 'golem-de-pierre', name: 'Golem de pierre', lore: 'Monolithe animé, impassible et lent, il broie tout sur son passage sans jamais s\'énerver.', color: 0x8a8078, hp: 340, atk: 150, def: 40, xp: 2400, level: 37, speed: 25, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.08, min: 1, max: 1 }, { kind: 'item', itemId: 'carapace-scarabee', chance: 0.03, min: 1, max: 1 }] },
  { id: 'gobelin-mineur', name: 'Gobelin mineur', lore: 'Petit fouineur cupide de la carrière, il balance ses cailloux avant de détaler en ricanant.', color: 0x6d8a3f, hp: 220, atk: 138, def: 18, xp: 2000, level: 34, speed: 60, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }] },
  // Zone 5 — cimetière
  { id: 'goule', name: 'Goule', lore: 'Charognarde des tombes, vorace et griffue, elle traque la chair fraîche au fond du cimetière.', color: 0x556b2f, hp: 420, atk: 200, def: 30, xp: 3200, level: 48, speed: 70, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }, { kind: 'item', itemId: 'baton-feuillu', chance: 0.03, min: 1, max: 1 }] },
  { id: 'banshee', name: 'Banshee', lore: 'Spectre plaintif au hurlement funeste, son chant déchirant transperce l\'âme à distance.', color: 0x9575cd, hp: 320, atk: 225, def: 20, xp: 3000, level: 45, speed: 50, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 }] },
  { id: 'pretre-goule', name: 'Prêtre-goule', lore: 'Officiant corrompu des morts, il psalmodie des malédictions et anime les ombres à sa guise.', color: 0x455a64, hp: 360, atk: 188, def: 25, xp: 3200, level: 48, speed: 40, behavior: 'caster', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] },
  // IMMOBILE-DISTANCE — totem planté (cimetière). Racine funeste : il ne bouge pas et CRACHE des
  // projectiles nécrotiques dès que le joueur est à portée.
  { id: 'totem-maudit', name: 'Totem maudit', lore: 'Mât funéraire gravé de visages hurlants, scellé au sol : il vomit des feux follets maudits sur qui s\'approche.', color: 0x5a4636, hp: 340, atk: 205, def: 26, xp: 3100, level: 45, speed: 0, behavior: 'projectile', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] },
  // Zone 6 — enfer
  { id: 'diablotin', name: 'Diablotin', lore: 'Farceur des flammes, vif et hargneux, il fonce en ricanant droit sorti des enfers.', color: 0xd84315, hp: 480, atk: 238, def: 35, xp: 4200, level: 55, speed: 150, behavior: 'charge', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.06, min: 1, max: 1 }] },
  { id: 'gargouille', name: 'Gargouille', lore: 'Statue de pierre qui feint le sommeil, puis s\'éveille d\'un coup pour fondre sur l\'imprudent.', color: 0x546e7a, hp: 620, atk: 250, def: 55, xp: 4800, level: 57, speed: 60, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.06, min: 1, max: 1 }, { kind: 'item', itemId: 'arc-souple', chance: 0.03, min: 1, max: 1 }] },
  // MOBILE-MÊLÉE, GRAND & TANKY (contact) — enfer. Titan de roche en fusion : lent, brûlant, il se
  // plante à portée et abat un coup dévastateur télégraphié (gabarit 'grand' → rendu + hitbox agrandis).
  { id: 'golem-de-lave', name: 'Golem de lave', lore: 'Colosse de roche en fusion aux veines incandescentes : chaque pas fait fumer le sol, chaque coup calcine.', color: 0xb3401a, hp: 790, atk: 246, def: 52, xp: 4700, level: 55, speed: 32, behavior: 'contact', size: 'grand', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.08, min: 1, max: 1 }] },
  // Gardiens — « boss de palier » postés en obstacle immobile sur le chemin au sol : niveau
  // nettement au-dessus des mobs de la zone (GARDIEN_LEVEL_BONUS), PV/def très élevés et atk de
  // contact lourde (mais NON fatale d'un coup) → coriaces mais TUABLES avec effort, ou à contourner
  // par les plateformes. Bon XP puisqu'ils demandent un vrai combat.
  { id: 'gardien-sylve', name: 'Gardien Sylve', lore: 'Colosse de bois ancien planté en travers du chemin, immobile et patient, il barre la route depuis des siècles.', color: 0x4e342e, hp: 2200, atk: 55, def: 45, xp: 2000, level: 1, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 }] },
  { id: 'gardien-pierre', name: 'Gardien Pierre', lore: 'Sentinelle de roc dressée depuis l\'aube des temps, inébranlable, elle veille sans jamais ciller.', color: 0x707070, hp: 3200, atk: 80, def: 55, xp: 3200, level: 1, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'minerai-fer', chance: 0.2, min: 1, max: 2 }] },
  { id: 'gardien-flamme', name: 'Gardien Flamme', lore: 'Colosse ardent scellé aux portes de l\'enfer, brasier vivant qui calcine quiconque prétend passer.', color: 0xbf360c, hp: 5000, atk: 130, def: 65, xp: 6000, level: 67, speed: 0, behavior: 'contact', drops: [goldMid, potion, { kind: 'material', materialId: 'gemme-brute', chance: 0.25, min: 1, max: 2 }] },
  // Boss — zone 3 (jungle)
  {
    id: 'seigneur-liane', name: 'Seigneur Liane', lore: 'Souverain de la jungle aux mille lianes, archimage sylvestre : il embrase l\'air de sphères ardentes et fait pleuvoir le feu du ciel.', color: 0x1b5e20, hp: 5200, atk: 122, def: 34, xp: 9000, level: 43, speed: 60, behavior: 'projectile', boss: true, bossClass: 'mage', bossSummon: 'flora-vorace',
    drops: [
      { kind: 'gold', chance: 1, min: 200, max: 320 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'plastron-feuilles', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss — zone 4 (montagne)
  {
    id: 'golem-ancien', name: 'Golem Ancien', lore: 'Titan de pierre gravé de runes oubliées : ses runes crachent des salves d\'éclats perçants et un déluge de pierres du ciel.', color: 0x78909c, hp: 7600, atk: 142, def: 50, xp: 13000, level: 57, speed: 55, behavior: 'projectile', boss: true, bossClass: 'archer', bossSummon: 'gobelin-mineur', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 280, max: 420 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.4, min: 1, max: 1 },
    ],
  },
  // Boss — zone 5 (cimetière)
  {
    id: 'roi-liche', name: 'Roi Liche', lore: 'Seigneur mort-vivant au sceptre glacé, sorcier suprême : il déchaîne des novae nécrotiques et des salves d\'os hurlantes depuis son trône.', color: 0x4527a0, hp: 10500, atk: 176, def: 46, xp: 18000, level: 50, speed: 50, behavior: 'projectile', boss: true, bossClass: 'sorcier', bossSummon: 'squelette',
    drops: [
      { kind: 'gold', chance: 1, min: 350, max: 520 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss final — zone 6 (enfer)
  {
    id: 'seigneur-dechu', name: 'Seigneur Déchu', lore: 'Maître ultime des enfers, ange tombé rongé de haine : il manie les meilleures armes de chaque classe — lame, feu, flèches et néant.', color: 0x8a1414, hp: 16500, atk: 205, def: 60, xp: 30000, level: 65, speed: 90, behavior: 'charge', boss: true, bossClass: 'chevalier', bossSummon: 'diablotin',
    drops: [
      { kind: 'gold', chance: 1, min: 500, max: 800 },
      { kind: 'item', itemId: 'griffe-royale', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 1, min: 1, max: 1 },
    ],
  },
  // ─── Nouveaux boss du monde carte A (placeholders d'art réutilisés : art-boss-*.png = copies) ───
  // Boss-01 — Gardien Sylve (forêt) : colosse de bois INCARNANT le Novice (bond fracassant, bambou,
  // rugissement), premier boss du sentier. Art placeholder = art-gardien-sylve.png.
  {
    id: 'boss-sylve', name: 'Gardien de la Sylve', lore: 'Colosse de bois millénaire éveillé par la profanation de sa forêt : il abat ses branches comme des massues et invoque les ronces pour étouffer l\'intrus.', color: 0x3e5e2a, hp: 1900, atk: 60, def: 16, xp: 3600, level: 27, speed: 62, behavior: 'charge', boss: true, bossClass: 'novice', bossSummon: 'ronce-cracheuse',
    drops: [
      { kind: 'gold', chance: 1, min: 70, max: 120 },
      { kind: 'item', itemId: 'baton-feuillu', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'plastron-feuilles', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.5, min: 1, max: 1 },
    ],
  },
  // Boss-03 — Golem des Cavernes (cave) : monolithe INCARNANT l'Archer (déluge de pierres, salves).
  // Art placeholder = art-golem-de-pierre.png.
  {
    id: 'boss-golem-cave', name: 'Golem des Cavernes', lore: 'Titan de roche brute scellé au cœur des cavernes : il pilonne l\'écho de ses poings de granit et fait pleuvoir des éclats du plafond.', color: 0x7c7168, hp: 5200, atk: 132, def: 46, xp: 9200, level: 37, speed: 48, behavior: 'projectile', boss: true, bossClass: 'archer', bossSummon: 'gobelin-mineur', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 200, max: 320 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'casque-croc', chance: 0.5, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.3, min: 1, max: 1 },
    ],
  },
  // Boss-05 — Yéti Géant (montagne) : colosse des neiges INCARNANT le Sabreur (taillade bondissante,
  // charge). Art placeholder = art-yeti.png.
  {
    id: 'boss-yeti', name: 'Yéti Géant', lore: 'Seigneur des cimes gelées, montagne de fourrure et de fureur : il fond sur sa proie d\'un bond qui fait trembler la neige et abat ses griffes comme des lames.', color: 0xdfe9ef, hp: 6600, atk: 152, def: 42, xp: 11500, level: 47, speed: 118, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'louveteau', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 240, max: 360 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.4, min: 1, max: 1 },
      { kind: 'item', itemId: 'armure-carapace', chance: 0.3, min: 1, max: 1 },
    ],
  },
  // Boss-07 — Roi Crabe (plage) : colosse de carapace INCARNANT le Sabreur (taillade de pinces, bond).
  // Art placeholder = art-roi-crabe.png (distinct du MVP 'roi-crabe').
  {
    id: 'boss-crabe', name: 'Roi des Crabes', lore: 'Monarque cuirassé des récifs, blindage insolent et pinces tranchantes : il claque ses tenailles comme des cisailles et bondit de côté pour broyer l\'imprudent.', color: 0xd8431a, hp: 5600, atk: 142, def: 58, xp: 10200, level: 56, speed: 96, behavior: 'charge', boss: true, bossClass: 'swordsman', bossSummon: 'crabe-geant', size: 'grand',
    drops: [
      { kind: 'gold', chance: 1, min: 220, max: 340 },
      { kind: 'item', itemId: 'armure-carapace', chance: 1, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.4, min: 1, max: 1 },
      { kind: 'item', itemId: 'amulette-gemme', chance: 0.3, min: 1, max: 1 },
    ],
  },
]

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]))
