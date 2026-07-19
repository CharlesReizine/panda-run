import type { ClassId, SkillDef } from '../core/types'
import { CLASSES } from './classes'

const list: SkillDef[] = [
  // Novice
  { id: 'calin-brutal', name: 'Câlin brutal', description: 'Une étreinte si vigoureuse qu\'elle assomme l\'ennemi au corps à corps.', classId: 'novice', kind: 'melee', multiplier: 1.5, cooldownMs: 2000, range: 50 },
  { id: 'bambou-jete', name: 'Bambou jeté', description: 'Lance un bambou en cloche qui retombe lourdement sur l\'ennemi.', classId: 'novice', kind: 'projectile', multiplier: 1.2, cooldownMs: 3000, range: 520, arc: true },
  { id: 'rugissement-panda', name: 'Rugissement du panda', description: 'Un cri qui galvanise : frappe autour de soi et booste les dégâts un instant.', classId: 'novice', kind: 'aoe', multiplier: 0.7, cooldownMs: 4500, range: 90, buff: { atkMult: 1.4, durationMs: 6000 } },
  // Sabreur — arbre de compétences (les dévastateurs verrouillés par niveau / prérequis)
  { id: 'taillade', name: 'Taillade', description: 'Un coup d\'épée fulgurant qui fend la garde adverse d\'un grand arc lumineux.', classId: 'swordsman', kind: 'melee', multiplier: 1.8, cooldownMs: 2000, range: 70 },
  { id: 'estoc-rapide', name: 'Estoc rapide', description: 'Une botte vive et perçante qui harcèle l\'ennemi sans répit.', classId: 'swordsman', kind: 'melee', multiplier: 1.4, cooldownMs: 1500, range: 55 },
  { id: 'tourbillon', name: 'Tourbillon', description: 'Le sabreur pivote, lames au vent, et frappe tout autour de lui.', classId: 'swordsman', kind: 'aoe', multiplier: 1.5, cooldownMs: 6000, range: 120, minLevel: 6 },
  { id: 'attaque-chargee', name: 'Attaque chargée', description: 'Le panda concentre sa force un court instant, aura grandissante, puis lâche un coup dévastateur : onde de choc, flash et tremblement.', classId: 'swordsman', kind: 'charge', multiplier: 3.0, cooldownMs: 9000, range: 100, minLevel: 8 },
  { id: 'lancer-epee', name: 'Lancer d\'épée', description: 'Projette sa lame tournoyante droit devant : elle traverse la ligne ennemie de part en part.', classId: 'swordsman', kind: 'projectile', multiplier: 2.2, cooldownMs: 5000, range: 560, pierce: true, minLevel: 10 },
  { id: 'epee-enflammee', name: 'Épée enflammée', description: 'La lame s\'embrase : dégâts renforcés et chaque coup enflamme l\'ennemi qui brûle dans la durée.', classId: 'swordsman', kind: 'buff', multiplier: 1.2, cooldownMs: 12000, range: 0, buff: { atkMult: 1.5, durationMs: 8000 }, flame: true, minLevel: 12 },
  { id: 'plongeon', name: 'Plongeon dévastateur', description: 'En plein saut, le panda pique vers le sol : à l\'impact, une explosion en cercle d\'autant plus large et brutale que la chute fut haute.', classId: 'swordsman', kind: 'dive', multiplier: 2.8, cooldownMs: 8000, range: 130, minLevel: 15 },
  { id: 'lame-ultime', name: 'Lame ultime', description: 'L\'aboutissement de l\'art du sabre : double arc géant, flash aveuglant, onde de choc et gel du temps.', classId: 'swordsman', kind: 'melee', multiplier: 4.0, cooldownMs: 15000, range: 80, minLevel: 25, requires: 'attaque-chargee' },
  // Mage — arbre refondu : boule de feu imposante, éclairs dévastateurs, mur de flamme & pluie de
  // météores en visée de zone, deux passifs qui renforcent le panda en permanence une fois appris.
  { id: 'boule-de-feu', name: 'Boule de feu', description: 'Une énorme sphère de flammes projetée droit devant, qui détone en une gerbe de feu à l\'impact.', classId: 'mage', kind: 'projectile', multiplier: 2.0, cooldownMs: 3000, range: 470, blast: 74 },
  { id: 'eclair', name: 'Éclairs foudroyants', description: 'De gros éclairs bleus zigzaguent devant le mage : courte portée, mais dégâts frontaux dévastateurs.', classId: 'mage', kind: 'lightning', multiplier: 3.2, cooldownMs: 6500, range: 250, minLevel: 10 },
  { id: 'mur-de-flamme', name: 'Mur de flamme', description: 'Vise une zone : un mur de flammes jaillit du sol, brûle et bloque le passage des ennemis tant qu\'il dure.', classId: 'mage', kind: 'zone', multiplier: 1.6, cooldownMs: 13000, range: 92, wall: { durationMs: 5200, height: 158 }, minLevel: 14 },
  { id: 'pluie-de-meteores', name: 'Pluie de météores', description: 'Vise une zone : une pluie de météores ardents s\'abat du ciel et explose au sol dans un fracas de flammes.', classId: 'mage', kind: 'zone', multiplier: 2.6, cooldownMs: 17000, range: 150, meteors: 7, minLevel: 20 },
  { id: 'nova-de-givre', name: 'Nova de givre', description: 'Une déflagration glaciale qui gèle tout dans un large rayon.', classId: 'mage', kind: 'aoe', multiplier: 1.4, cooldownMs: 7000, range: 135 },
  { id: 'soin-du-panda', name: 'Soin du panda', description: 'Une douce vague de magie qui referme les blessures du panda.', classId: 'mage', kind: 'heal', multiplier: 0.35, cooldownMs: 10000, range: 0 },
  { id: 'maitrise-arcanique', name: 'Maîtrise arcanique', description: 'Passif : la maîtrise des arcanes augmente durablement la puissance d\'attaque du panda. Jamais équipé — actif dès qu\'il est appris.', classId: 'mage', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { atk: 6 }, minLevel: 8 },
  { id: 'vitalite-magique', name: 'Vitalité magique', description: 'Passif : le flux magique renforce durablement les points de vie maximum du panda. Jamais équipé — actif dès qu\'il est appris.', classId: 'mage', kind: 'passive', multiplier: 1, cooldownMs: 1, range: 0, passive: { maxHp: 30 }, minLevel: 12 },
  // Anciens skills mage conservés au registre (compat saves / emprunts) mais hors de l'arbre actif
  { id: 'meteore', name: 'Météore', description: 'Fait tomber un météore ardent qui pulvérise la zone d\'impact.', classId: 'mage', kind: 'aoe', multiplier: 2.5, cooldownMs: 12000, range: 100 },
  { id: 'tempete-arcanique', name: 'Tempête arcanique', description: 'Déchaîne un maelström d\'arcanes qui ravage tout aux alentours.', classId: 'mage', kind: 'aoe', multiplier: 3.0, cooldownMs: 18000, range: 160 },
  { id: 'soin-majeur', name: 'Soin majeur', description: 'Un flux de magie puissante qui restaure une large part des PV.', classId: 'mage', kind: 'heal', multiplier: 0.5, cooldownMs: 16000, range: 0 },
  { id: 'rayon-arcanique', name: 'Rayon arcanique', description: 'Un rayon d\'énergie pure qui transperce tous les ennemis alignés.', classId: 'mage', kind: 'projectile', multiplier: 2.0, cooldownMs: 9000, range: 550, pierce: true },
  // Archer — arbre de compétences refondu (les dévastateurs verrouillés par niveau / prérequis)
  { id: 'fleche-percante', name: 'Flèche perçante', description: 'Une grosse flèche d\'énergie à la traînée bleue lumineuse qui traverse toute la file ennemie, d\'un bout à l\'autre de l\'écran.', classId: 'archer', kind: 'projectile', multiplier: 2.0, cooldownMs: 2500, range: 700, pierce: true },
  { id: 'tir-instinctif', name: 'Tir instinctif', description: 'Des tirs réflexes enchaînés à la vitesse de l\'instinct.', classId: 'archer', kind: 'projectile', multiplier: 0.8, cooldownMs: 1000, range: 400, minLevel: 3 },
  { id: 'double-tir', name: 'Double flèche', description: 'Deux flèches tirées ensemble, cordées si serré qu\'elles frappent comme une seule.', classId: 'archer', kind: 'projectile', multiplier: 1.2, cooldownMs: 2200, range: 480, arrows: 2, minLevel: 5 },
  { id: 'piege', name: 'Piège à mâchoires', description: 'Pose un piège au sol : le premier ennemi qui marche dessus est immobilisé net et mordu jusqu\'au sang.', classId: 'archer', kind: 'trap', multiplier: 0.9, cooldownMs: 7000, range: 60, root: 2600 },
  { id: 'fleche-enflammee', name: 'Flèche enflammée', description: 'Une flèche embrasée qui perce la ligne ennemie et laisse chaque cible brûler dans la durée.', classId: 'archer', kind: 'projectile', multiplier: 2.2, cooldownMs: 6000, range: 660, pierce: true, burn: true, minLevel: 10 },
  { id: 'fleche-explosive', name: 'Flèche explosive', description: 'Un tir en cloche à tête explosive : il retombe et détone au sol dans une gerbe de feu.', classId: 'archer', kind: 'projectile', multiplier: 2.4, cooldownMs: 7000, range: 560, arc: true, explode: true, explodeRadius: 120, minLevel: 12 },
  { id: 'tir-charge', name: 'Tir chargé', description: 'Une flèche longuement bandée qui transperce tout sur sa route.', classId: 'archer', kind: 'projectile', multiplier: 2.8, cooldownMs: 10000, range: 650, pierce: true, minLevel: 14, requires: 'fleche-percante' },
  { id: 'pluie-de-fleches', name: 'Pluie de flèches', description: 'Vise une zone : une nuée de flèches s\'abat du ciel et crible tout le secteur, encore et encore.', classId: 'archer', kind: 'zone', multiplier: 1.5, cooldownMs: 12000, range: 150, rain: 46, minLevel: 18 },
  // Skills archer historiques conservés dans le registre (saves + emprunts) mais hors de l'arbre actif
  { id: 'fleche-de-bambou', name: 'Flèche de bambou', description: 'Une flèche de bambou taillée maison, simple et redoutablement efficace.', classId: 'archer', kind: 'projectile', multiplier: 1.3, cooldownMs: 3000, range: 400 },
  { id: 'salve-ultime', name: 'Salve ultime', description: 'Une nuée de flèches déversée d\'un coup sur un large secteur.', classId: 'archer', kind: 'aoe', multiplier: 3.2, cooldownMs: 16000, range: 180 },
  { id: 'tir-en-cloche', name: 'Tir en cloche', description: 'Une flèche lobée qui retombe par-dessus la garde adverse.', classId: 'archer', kind: 'projectile', multiplier: 1.6, cooldownMs: 4500, range: 480, arc: true },
  // Chevalier (évolution du Sabreur) — arbre royal, dévastateurs verrouillés haut
  { id: 'garde-imperiale', name: 'Garde impériale', description: 'Un revers impérial qui balaye large : anneaux dorés et couronne de lames dressées refoulent les assaillants.', classId: 'chevalier', kind: 'aoe', multiplier: 2.4, cooldownMs: 7000, range: 180, minLevel: 30 },
  { id: 'sceau-du-heaume', name: 'Sceau du heaume', description: 'Projette un sceau héraldique tournoyant qui percute la cible de plein fouet.', classId: 'chevalier', kind: 'projectile', multiplier: 3.0, cooldownMs: 6000, range: 480, minLevel: 31 },
  { id: 'jugement-royal', name: 'Jugement royal', description: 'Un verdict d\'acier appelé du ciel : colonne de lumière, arc géant et onde de choc s\'abattent, implacables.', classId: 'chevalier', kind: 'melee', multiplier: 4.8, cooldownMs: 12000, range: 100, minLevel: 32, requires: 'garde-imperiale' },
  // Sorcier (évolution du Mage) — versions renforcées du mage + ultime dévastateur
  { id: 'cataclysme', name: 'Cataclysme', description: 'L\'ultime du sorcier : le ciel se déchire sur la zone visée — pluie de météores, colonnes de feu et déflagrations en chaîne rasent tout le secteur.', classId: 'sorcier', kind: 'zone', multiplier: 5.5, cooldownMs: 22000, range: 220, meteors: 12, minLevel: 40, requires: 'pluie-de-meteores' },
  { id: 'faille-du-neant', name: 'Faille du néant', description: 'Ouvre une déchirure du néant qui embroche tous les ennemis alignés, d\'un bout à l\'autre du champ de bataille.', classId: 'sorcier', kind: 'projectile', multiplier: 3.5, cooldownMs: 7000, range: 620, pierce: true },
  { id: 'benediction-du-panda', name: 'Bénédiction du panda', description: 'Une bénédiction rayonnante qui régénère largement le panda.', classId: 'sorcier', kind: 'heal', multiplier: 0.7, cooldownMs: 14000, range: 0 },
  // Chasseur (évolution de l'Archer) — arbre haut de gamme, dévastateurs verrouillés
  { id: 'nuee-de-fleches', name: 'Nuée de flèches', description: 'Vise une zone : le ciel s\'assombrit d\'une nuée dense qui s\'abat en tapis sur tout le secteur.', classId: 'chasseur', kind: 'zone', multiplier: 2.2, cooldownMs: 12000, range: 210, rain: 64, minLevel: 30 },
  { id: 'tir-du-faucon', name: 'Tir du faucon', description: 'Une flèche lobée avec l\'œil du faucon : elle fond du ciel et détone à sa retombée.', classId: 'chasseur', kind: 'projectile', multiplier: 2.8, cooldownMs: 3500, range: 620, arc: true, explode: true, explodeRadius: 150, minLevel: 31 },
  { id: 'fleche-mortelle', name: 'Flèche mortelle', description: 'Le tir ultime du chasseur : un trait fulgurant à traînée bleue qui embroche toute la ligne ennemie et brûle ce qui reste debout.', classId: 'chasseur', kind: 'projectile', multiplier: 5.0, cooldownMs: 9000, range: 900, pierce: true, burn: true, minLevel: 34, requires: 'nuee-de-fleches' },
]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]))

export function skillsOf(classId: ClassId): SkillDef[] {
  return CLASSES[classId].skillIds.map((id) => SKILLS[id]!)
}
