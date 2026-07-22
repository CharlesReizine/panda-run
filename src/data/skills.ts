import type { ClassId, SkillDef } from '../core/types'
import { CLASSES } from './classes'
import { MAX_SKILL_RANK } from '../core/player-state'

// Charge : puissance minimale d'une attaque chargée relâchée TÔT (fraction de la version chargée à fond).
export const CHARGE_MIN_MULT = 0.4

// Rang maximal d'un skill : par défaut MAX_SKILL_RANK (5). Les gros sorts SIGNATURE montent à 10.
export function maxRankOf(skill: { maxRank?: number }): number {
  return skill.maxRank ?? MAX_SKILL_RANK
}

// Multiplicateur de dégâts d'un skill au rang investi. Le gain TOTAL au rang max vaut +100% pour un
// skill normal (maxRank 5, identique à l'ancien 1 + 0,25·(rang−1)) et +150% pour une signature
// (maxRank 10) — mais réparti sur 9 paliers, donc un gain PAR RANG plus DOUX. Rang borné [1, maxRank].
export function skillDamageMult(skill: { multiplier: number; maxRank?: number }, rank: number): number {
  const mr = maxRankOf(skill)
  const r = Math.max(1, Math.min(rank, mr))
  if (mr <= 1) return skill.multiplier
  const bonusAtMax = mr >= 10 ? 1.5 : 1.0
  return skill.multiplier * (1 + (bonusAtMax * (r - 1)) / (mr - 1))
}

const list: SkillDef[] = [
  // Novice
  { id: 'calin-brutal', name: 'Câlin brutal', description: 'Une étreinte si vigoureuse qu\'elle assomme l\'ennemi au corps à corps.', classId: 'novice', kind: 'melee', multiplier: 1.5, cooldownMs: 2000, range: 50 },
  { id: 'bambou-jete', name: 'Bambou jeté', description: 'Lance un bambou en cloche qui retombe lourdement sur l\'ennemi.', classId: 'novice', kind: 'projectile', multiplier: 1.2, cooldownMs: 3000, range: 520, arc: true },
  { id: 'rugissement-panda', name: 'Rugissement du panda', description: 'Un cri qui galvanise : frappe autour de soi et booste les dégâts un instant.', classId: 'novice', kind: 'aoe', multiplier: 0.7, cooldownMs: 4500, range: 90, buff: { atkMult: 1.4, durationMs: 6000 } },

  // ═══════════ SABREUR ═══════════ (l'ultime « Lame ultime » migre au Chevalier sous « Épée fantôme »)
  // ESTOC RAPIDE : AUCUN cooldown, plus rapide que l'attaque de base, mais coût mana ÉLEVÉ par coup
  // (spam à la ressource). C'est le harcèlement du sabreur.
  { id: 'estoc-rapide', name: 'Estoc rapide', description: 'Une botte perçante sans temps de recharge, plus vive que l\'attaque de base — mais chaque coup coûte cher en énergie.', classId: 'swordsman', kind: 'melee', multiplier: 1.4, cooldownMs: 1, range: 55, spam: true, manaCost: 22 },
  { id: 'taillade', name: 'Taillade', description: 'Un coup d\'épée fulgurant qui fend la garde adverse d\'un grand arc lumineux.', classId: 'swordsman', kind: 'melee', multiplier: 1.8, cooldownMs: 2000, range: 70 },
  { id: 'tourbillon', name: 'Tourbillon', description: 'Le sabreur pivote, lames au vent, et frappe tout autour de lui.', classId: 'swordsman', kind: 'aoe', multiplier: 1.5, cooldownMs: 6000, range: 120, minLevel: 6, requires: 'estoc-rapide' },
  { id: 'lancer-epee', name: 'Lancer d\'épée', description: 'Projette sa lame tournoyante droit devant : elle traverse la ligne ennemie de part en part.', classId: 'swordsman', kind: 'projectile', multiplier: 2.2, cooldownMs: 5000, range: 560, pierce: true, minLevel: 10, requires: 'tourbillon' },
  { id: 'attaque-chargee', name: 'Attaque chargée', description: 'Le panda concentre sa force un court instant, aura grandissante, puis lâche un coup dévastateur : onde de choc, flash et tremblement.', classId: 'swordsman', kind: 'charge', multiplier: 3.0, cooldownMs: 9000, range: 100, minLevel: 8, requires: 'taillade' },
  { id: 'plongeon', name: 'Plongeon dévastateur', description: 'En plein saut, le panda pique vers le sol : à l\'impact, une explosion en cercle d\'autant plus large et brutale que la chute fut haute.', classId: 'swordsman', kind: 'dive', multiplier: 2.8, cooldownMs: 8000, range: 130, minLevel: 15, requires: 'attaque-chargee' },
  { id: 'folie-enragee', name: 'Folie enragée', description: 'Le panda entre en furie, nimbé d\'une aura rouge sang : tous les monstres de son niveau ou moins (hors boss) sont saisis de terreur, fuient lentement et perdent la moitié de leur défense.', classId: 'swordsman', kind: 'buff', multiplier: 1, cooldownMs: 16000, range: 0, minLevel: 18, requires: 'attaque-chargee', fear: { durationMs: 7000 } },
  { id: 'regeneration', name: 'Régénération', description: 'Passif : le sabreur récupère des PV au fil du temps, tant qu\'il n\'a pas été touché depuis quelques secondes. +4 PV/s par rang.', classId: 'swordsman', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, minLevel: 2, passive: { hpRegenPerSec: 4 } },

  // ═══════════ MAGE ═══════════
  // BOULE DE FEU : désormais CHARGEABLE — maintiens pour charger, relâche chargée = très puissante,
  // relâchée tôt = plus faible. ÉCLAIR : passe en CANALISÉ, très courte portée au contact.
  { id: 'boule-de-feu', name: 'Boule de feu', description: 'MAINTIENS pour charger une énorme sphère de flammes, puis relâche : plus la charge est longue, plus la déflagration est dévastatrice.', classId: 'mage', kind: 'projectile', multiplier: 2.0, cooldownMs: 3200, range: 470, blast: 74, chargeable: true },
  { id: 'eclair', name: 'Éclairs foudroyants', description: 'MAINTIENS : des éclairs bleus crépitent au contact devant le mage, foudroyant sans répit tout ennemi collé à lui. Draine le mana tant que tu tiens.', classId: 'mage', kind: 'channel', multiplier: 0.9, cooldownMs: 1, range: 150, minLevel: 10, requires: 'boule-de-feu', channel: { tickMs: 120, manaPerTick: 5 } },
  { id: 'mur-de-flamme', name: 'Mur de flamme', description: 'Vise une zone : un mur de flammes jaillit du sol, brûle et bloque le passage des ennemis tant qu\'il dure.', classId: 'mage', kind: 'zone', multiplier: 1.6, cooldownMs: 13000, range: 92, wall: { durationMs: 5200, height: 158 }, minLevel: 14, requires: 'eclair' },
  { id: 'nova-de-givre', name: 'Nova de givre', description: 'Une déflagration glaciale qui gèle tout dans un large rayon.', classId: 'mage', kind: 'aoe', multiplier: 1.4, cooldownMs: 7000, range: 135 },
  { id: 'soin-du-panda', name: 'Soin du panda', description: 'Une douce vague de magie qui referme les blessures du panda.', classId: 'mage', kind: 'heal', multiplier: 0.35, cooldownMs: 10000, range: 0, minLevel: 6, requires: 'nova-de-givre' },
  { id: 'aura-epines', name: 'Aura d\'épines', description: 'Le mage s\'entoure d\'une aura d\'arcanes crépitante d\'éclairs : tant qu\'elle dure, tout ennemi proche est BLESSÉ en continu (façon épines).', classId: 'mage', kind: 'aura', multiplier: 1.0, cooldownMs: 15000, range: 0, minLevel: 16, requires: 'eclair', aura: { tickMs: 380, durationMs: 8000, radius: 150 } },
  { id: 'maitrise-arcanique', name: 'Maîtrise arcanique', description: 'Passif : la maîtrise des arcanes augmente durablement la puissance d\'attaque du panda. Jamais équipé — actif dès qu\'il est appris.', classId: 'mage', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { atk: 6 }, minLevel: 8 },
  { id: 'vitalite-magique', name: 'Vitalité magique', description: 'Passif : le flux magique renforce durablement les points de vie maximum du panda. Jamais équipé — actif dès qu\'il est appris.', classId: 'mage', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { maxHp: 30 }, minLevel: 12, requires: 'maitrise-arcanique' },
  { id: 'meditation-arcanique', name: 'Méditation arcanique', description: 'Passif : le mage canalise le flux et régénère son mana bien plus vite. Jamais équipé — actif dès qu\'il est appris. +4 énergie/s par rang.', classId: 'mage', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { energyRegenPerSec: 4 }, minLevel: 6 },

  // ═══════════ ARCHER ═══════════ (flèche enflammée & explosive migrent au Chasseur)
  { id: 'fleche-percante', name: 'Flèche perçante', description: 'Une grosse flèche d\'énergie à la traînée bleue lumineuse qui traverse toute la file ennemie, d\'un bout à l\'autre de l\'écran.', classId: 'archer', kind: 'projectile', multiplier: 2.0, cooldownMs: 2500, range: 700, pierce: true, maxRank: 10 },
  { id: 'tir-instinctif', name: 'Tir instinctif', description: 'Des tirs réflexes enchaînés à la vitesse de l\'instinct.', classId: 'archer', kind: 'projectile', multiplier: 0.8, cooldownMs: 1000, range: 400, minLevel: 3 },
  { id: 'double-tir', name: 'Double flèche', description: 'Deux flèches tirées ensemble, cordées si serré qu\'elles frappent comme une seule.', classId: 'archer', kind: 'projectile', multiplier: 1.2, cooldownMs: 2200, range: 480, arrows: 2, minLevel: 5, requires: 'tir-instinctif' },
  { id: 'fleche-autoguidee', name: 'Flèche autoguidée', description: 'Une flèche vivante qui traverse murs et terrain et bondit d\'ennemi en ennemi, frappant à chaque rang une cible de plus (le plus proche non encore touché, à portée visible).', classId: 'archer', kind: 'projectile', multiplier: 1.7, cooldownMs: 8000, range: 900, homing: true, minLevel: 12, requires: 'fleche-percante' },
  { id: 'pluie-de-fleches', name: 'Pluie de flèches', description: 'Vise une zone : une nuée de flèches s\'abat du ciel et crible tout le secteur, encore et encore.', classId: 'archer', kind: 'zone', multiplier: 1.5, cooldownMs: 12000, range: 150, rain: 46, minLevel: 18, requires: 'fleche-percante' },
  { id: 'piege', name: 'Piège à mâchoires', description: 'Pose un piège au sol : le premier ennemi qui marche dessus est immobilisé net et mordu jusqu\'au sang.', classId: 'archer', kind: 'trap', multiplier: 0.9, cooldownMs: 7000, range: 60, root: 2600 },
  // COURSE RAPIDE (déplacement) : passif d'agilité — augmente durablement la vitesse de course.
  { id: 'course-rapide', name: 'Course rapide', description: 'Passif : l\'entraînement de l\'archer aiguise sa foulée et augmente durablement sa vitesse de déplacement. Jamais équipé — actif dès qu\'il est appris. +6% de vitesse par rang.', classId: 'archer', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { moveSpeedPct: 0.06 }, minLevel: 8 },
  { id: 'oeil-de-lynx', name: 'Œil du lynx', description: 'L\'archer entre en transe de précision, nimbé d\'une aura verte d\'agilité : ses tirs frappent bien plus fort un moment.', classId: 'archer', kind: 'buff', multiplier: 1, cooldownMs: 13000, range: 0, buff: { atkMult: 1.5, durationMs: 7000 }, minLevel: 16, requires: 'fleche-percante' },
  { id: 'reflexes-felins', name: 'Réflexes félins', description: 'Passif « double tir » : l\'entraînement aiguise les réflexes de l\'archer et raccourcit le temps de recharge de son tir de base. Au rang max, il tire 2× plus souvent. Jamais équipé — actif dès qu\'il est appris.', classId: 'archer', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, doubleStrike: true, minLevel: 6 },

  // ═══════════ CHEVALIER ═══════════ (évolution du Sabreur — zéro skill partagé avec lui)
  { id: 'garde-imperiale', name: 'Garde impériale', description: 'Un revers impérial qui balaye large : anneaux dorés et couronne de lames dressées refoulent les assaillants.', classId: 'chevalier', kind: 'aoe', multiplier: 2.4, cooldownMs: 7000, range: 180, minLevel: 30 },
  { id: 'charge-lanciere', name: 'Charge lancière', description: 'Le chevalier abaisse sa lance et FONCE droit devant : il embarque et repousse tout ennemi sur sa route, le lardant de coups tant qu\'il le pousse.', classId: 'chevalier', kind: 'projectile', multiplier: 3.0, cooldownMs: 6000, range: 620, lance: true, lanceCharge: { speedPx: 640, durationMs: 620, tickMs: 120, knockbackPx: 300 }, minLevel: 30 },
  { id: 'sceau-du-heaume', name: 'Sceau du heaume', description: 'Projette un sceau héraldique tournoyant qui percute la cible de plein fouet.', classId: 'chevalier', kind: 'projectile', multiplier: 2.6, cooldownMs: 6000, range: 480, minLevel: 31, requires: 'garde-imperiale' },
  { id: 'grand-croix', name: 'Grand-croix', description: 'Une immense croix de lumière s\'abat sur le champ de bataille : colonne céleste, bras horizontal et vertical d\'énergie sacrée pulvérisent tout sur leur passage.', classId: 'chevalier', kind: 'melee', multiplier: 4.8, cooldownMs: 12000, range: 130, minLevel: 32, requires: 'garde-imperiale', maxRank: 10 },
  { id: 'epee-fantome', name: 'Épée fantôme', description: 'L\'ultime du chevalier : une lame spectrale géante, flash aveuglant, double arc et gel du temps — l\'aboutissement de l\'art du sabre.', classId: 'chevalier', kind: 'melee', multiplier: 4.0, cooldownMs: 15000, range: 90, minLevel: 34, requires: 'grand-croix', maxRank: 10 },
  { id: 'devotion', name: 'Dévotion', description: 'Le chevalier invoque une garde sacrée : pendant un temps, les dégâts qu\'il subit sont fortement réduits.', classId: 'chevalier', kind: 'buff', multiplier: 1, cooldownMs: 16000, range: 0, minLevel: 30, guard: { dmgTakenMult: 0.5, durationMs: 7000 } },
  { id: 'frappe-doublee', name: 'Frappe doublée', description: 'Passif : la maîtrise martiale du chevalier raccourcit le temps de recharge de son attaque de base. Au rang max, il frappe 2× plus souvent. Jamais équipé — actif dès qu\'il est appris.', classId: 'chevalier', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, doubleStrike: true, minLevel: 30 },
  { id: 'double-saut', name: 'Double saut', description: 'Passif : débloque un second saut en plein vol. Le saut aérien CONSOMME de l\'énergie et démarre modeste (faible hauteur) ; monte son niveau pour qu\'il rattrape peu à peu la hauteur du premier saut. Jamais équipé — actif dès qu\'il est appris.', classId: 'chevalier', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, minLevel: 30 },

  // ═══════════ SORCIER ═══════════ (évolution du Mage)
  // FAILLE DU NÉANT : rework total — zone courte portée qui ASPIRE puis TUE INSTANTANÉMENT les
  // ennemis faibles (hors boss/élite, niveau < joueur). Les autres sont juste poussés.
  { id: 'faille-du-neant', name: 'Faille du néant', description: 'Ouvre une déchirure du néant à courte portée : elle ASPIRE les ennemis puis ANNIHILE d\'un coup les plus faibles (hors boss et élites, et de niveau inférieur au tien). Les autres sont violemment repoussés.', classId: 'sorcier', kind: 'aoe', multiplier: 3.0, cooldownMs: 9000, range: 160, voidRift: true, minLevel: 30, maxRank: 10 },
  { id: 'lance-flammes', name: 'Lance-flammes', description: 'MAINTIENS : un long jet de feu jaillit devant le sorcier, couvrant le haut ET le bas, brûlant tout sur sa portée. Draine le mana tant que tu tiens.', classId: 'sorcier', kind: 'channel', multiplier: 0.7, cooldownMs: 1, range: 320, minLevel: 30, channel: { tickMs: 90, manaPerTick: 4, tall: true } },
  { id: 'pluie-de-meteores', name: 'Pluie de météores', description: 'Vise une zone : une pluie de météores ardents s\'abat du ciel et explose au sol dans un fracas de flammes.', classId: 'mage', kind: 'zone', multiplier: 2.6, cooldownMs: 17000, range: 150, meteors: 7, minLevel: 32, maxRank: 10 },
  { id: 'tempete-foudroyante', name: 'Tempête foudroyante', description: 'Vise une zone : un orage déchaîné s\'y abat — éclairs en cascade et fracas de foudre ravagent le secteur.', classId: 'sorcier', kind: 'zone', multiplier: 3.2, cooldownMs: 18000, range: 165, storm: true, minLevel: 34, maxRank: 10 },
  { id: 'blizzard', name: 'Blizzard', description: 'Vise une zone : une tempête de glace s\'abat, lacérant et gelant tout dans un vortex de neige et d\'éclats.', classId: 'sorcier', kind: 'zone', multiplier: 3.0, cooldownMs: 18000, range: 175, blizzard: true, minLevel: 34, maxRank: 10 },
  { id: 'rayon-arcanique', name: 'Rayon arcanique', description: 'Un rayon d\'énergie pure qui transperce tous les ennemis alignés, d\'un bout à l\'autre du champ de bataille.', classId: 'sorcier', kind: 'projectile', multiplier: 2.4, cooldownMs: 9000, range: 620, pierce: true, minLevel: 36, maxRank: 10 },
  { id: 'benediction-du-panda', name: 'Bénédiction du panda', description: 'Une bénédiction rayonnante qui régénère largement le panda.', classId: 'sorcier', kind: 'heal', multiplier: 0.7, cooldownMs: 14000, range: 0, minLevel: 30 },
  { id: 'vol-arcanique', name: 'Vol arcanique', description: 'Passif : MAINTIENS le saut pour t\'élever et voler librement, gravité coupée (monte tant que tu tiens le saut, descends avec bas, gauche/droite libres). Le vol dévore le mana très vite — une jauge pleine tient 1 s par rang investi ; à court d\'énergie, le sorcier retombe. Jamais équipé — actif dès qu\'il est appris.', classId: 'sorcier', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, minLevel: 30 },

  // ═══════════ CHASSEUR ═══════════ (évolution de l\'Archer — zéro doublon avec lui)
  { id: 'mitraillette', name: 'Mitraillette', description: 'MAINTIENS : une rafale de tirs continue crache une pluie de flèches droit devant tant que tu tiens. Draine le mana à chaque salve.', classId: 'chasseur', kind: 'channel', multiplier: 0.7, cooldownMs: 1, range: 520, minLevel: 30, channel: { tickMs: 90, manaPerTick: 4 } },
  { id: 'tir-du-faucon', name: 'Tir du faucon', description: 'Une flèche lobée avec l\'œil du faucon : elle fond du ciel et détone à sa retombée.', classId: 'chasseur', kind: 'projectile', multiplier: 2.8, cooldownMs: 3500, range: 620, arc: true, explode: true, explodeRadius: 150, minLevel: 31 },
  { id: 'blitz-faucon', name: 'Assaut du faucon', description: 'Le faucon fond sur l\'ennemi et l\'assaille d\'une série de coups fulgurants en piqué.', classId: 'chasseur', kind: 'projectile', multiplier: 2.4, cooldownMs: 8000, range: 620, falconBlitz: true, minLevel: 32 },
  { id: 'nuee-de-fleches', name: 'Nuée de flèches', description: 'Vise une zone : le ciel s\'assombrit d\'une nuée dense qui s\'abat en tapis sur tout le secteur.', classId: 'chasseur', kind: 'zone', multiplier: 2.2, cooldownMs: 12000, range: 210, rain: 64, minLevel: 30 },
  { id: 'fleche-mortelle', name: 'Flèche mortelle', description: 'Le tir ultime du chasseur : un trait fulgurant à traînée bleue qui embroche toute la ligne ennemie et brûle ce qui reste debout.', classId: 'chasseur', kind: 'projectile', multiplier: 5.0, cooldownMs: 9000, range: 900, pierce: true, burn: true, minLevel: 34, requires: 'nuee-de-fleches', maxRank: 10 },
  // Flèche enflammée : DÉPLACÉE au chasseur en BUFF — toutes les flèches s\'embrasent un moment.
  { id: 'fleche-enflammee', name: 'Flèche enflammée', description: 'Le chasseur embrase son carquois : pendant un temps, TOUTES ses flèches sont enflammées et brûlent ce qu\'elles touchent.', classId: 'archer', kind: 'buff', multiplier: 1, cooldownMs: 12000, range: 0, buff: { atkMult: 1.3, durationMs: 8000 }, flame: true, minLevel: 31 },
  { id: 'fleche-explosive', name: 'Flèche explosive', description: 'Un tir en cloche à tête explosive : il retombe et détone au sol dans une gerbe de feu.', classId: 'archer', kind: 'projectile', multiplier: 2.4, cooldownMs: 7000, range: 560, arc: true, explode: true, explodeRadius: 120, minLevel: 31 },
  { id: 'bond-du-chasseur', name: 'Bond du chasseur', description: 'Passif : la détente du chasseur s\'affûte et augmente durablement la hauteur de son saut. Jamais équipé — actif dès qu\'il est appris. +5% de hauteur de saut par rang.', classId: 'chasseur', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { jumpBoostPct: 0.05 }, minLevel: 30 },
  { id: 'fleches-entravantes', name: 'Flèches entravantes', description: 'Le chasseur crible le champ de flèches entravantes : TOUS les ennemis à l\'écran sont ralentis un court instant — vitesse et cadence d\'attaque réduites.', classId: 'chasseur', kind: 'aoe', multiplier: 1, cooldownMs: 12000, range: 0, slow: { factor: 0.4, durationMs: 4000 }, minLevel: 31 },

  // ─── Registre historique (compat saves / emprunts) — hors de tout arbre actif ─────────────────
  { id: 'lame-ultime', name: 'Lame ultime', description: 'L\'aboutissement de l\'art du sabre : double arc géant, flash aveuglant, onde de choc et gel du temps.', classId: 'swordsman', kind: 'melee', multiplier: 4.0, cooldownMs: 15000, range: 80 },
  { id: 'epee-enflammee', name: 'Épée enflammée', description: 'La lame s\'embrase : dégâts renforcés et chaque coup enflamme l\'ennemi qui brûle dans la durée.', classId: 'swordsman', kind: 'buff', multiplier: 1.2, cooldownMs: 12000, range: 0, buff: { atkMult: 1.5, durationMs: 8000 }, flame: true },
  { id: 'fureur-arcanique', name: 'Fureur arcanique', description: 'Le mage s\'entoure d\'une aura d\'arcanes violette et crépitante : sa puissance magique décuple un long moment.', classId: 'mage', kind: 'buff', multiplier: 1, cooldownMs: 14000, range: 0, buff: { atkMult: 1.6, durationMs: 8000 } },
  { id: 'meteore', name: 'Météore', description: 'Fait tomber un météore ardent qui pulvérise la zone d\'impact.', classId: 'mage', kind: 'aoe', multiplier: 2.5, cooldownMs: 12000, range: 100 },
  { id: 'tempete-arcanique', name: 'Tempête arcanique', description: 'Déchaîne un maelström d\'arcanes qui ravage tout aux alentours.', classId: 'mage', kind: 'aoe', multiplier: 3.0, cooldownMs: 18000, range: 160 },
  { id: 'soin-majeur', name: 'Soin majeur', description: 'Un flux de magie puissante qui restaure une large part des PV.', classId: 'mage', kind: 'heal', multiplier: 0.5, cooldownMs: 16000, range: 0 },
  { id: 'jugement-royal', name: 'Jugement royal', description: 'Un verdict d\'acier appelé du ciel : colonne de lumière, arc géant et onde de choc s\'abattent, implacables.', classId: 'chevalier', kind: 'melee', multiplier: 4.8, cooldownMs: 12000, range: 100 },
  { id: 'cataclysme', name: 'Cataclysme', description: 'Le ciel se déchire sur la zone visée — pluie de météores, colonnes de feu et déflagrations en chaîne rasent tout le secteur.', classId: 'sorcier', kind: 'zone', multiplier: 5.5, cooldownMs: 22000, range: 220, meteors: 12 },
  { id: 'tir-charge', name: 'Tir chargé', description: 'Une flèche longuement bandée, lourde et fulgurante, qui frappe la première cible de plein fouet.', classId: 'archer', kind: 'projectile', multiplier: 2.8, cooldownMs: 10000, range: 650 },
  { id: 'fleche-de-bambou', name: 'Flèche de bambou', description: 'Une flèche de bambou taillée maison, simple et redoutablement efficace.', classId: 'archer', kind: 'projectile', multiplier: 1.3, cooldownMs: 3000, range: 400 },
  { id: 'salve-ultime', name: 'Salve ultime', description: 'Une nuée de flèches déversée d\'un coup sur un large secteur.', classId: 'archer', kind: 'aoe', multiplier: 3.2, cooldownMs: 16000, range: 180 },
  { id: 'tir-en-cloche', name: 'Tir en cloche', description: 'Une flèche lobée qui retombe par-dessus la garde adverse.', classId: 'archer', kind: 'projectile', multiplier: 1.6, cooldownMs: 4500, range: 480, arc: true },
]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]))

export function skillsOf(classId: ClassId): SkillDef[] {
  return CLASSES[classId].skillIds.map((id) => SKILLS[id]!)
}
