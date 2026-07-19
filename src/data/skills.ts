import type { ClassId, SkillDef } from '../core/types'
import { CLASSES } from './classes'

const list: SkillDef[] = [
  // Novice
  { id: 'calin-brutal', name: 'Câlin brutal', description: 'Une étreinte si vigoureuse qu\'elle assomme l\'ennemi au corps à corps.', classId: 'novice', kind: 'melee', multiplier: 1.5, cooldownMs: 2000, range: 50 },
  { id: 'bambou-jete', name: 'Bambou jeté', description: 'Lance un bambou en cloche qui retombe lourdement sur l\'ennemi.', classId: 'novice', kind: 'projectile', multiplier: 1.2, cooldownMs: 3000, range: 520, arc: true },
  { id: 'rugissement-panda', name: 'Rugissement du panda', description: 'Un cri qui galvanise : frappe autour de soi et booste les dégâts un instant.', classId: 'novice', kind: 'aoe', multiplier: 0.7, cooldownMs: 4500, range: 90, buff: { atkMult: 1.4, durationMs: 6000 } },
  // Sabreur
  { id: 'taillade', name: 'Taillade', description: 'Un coup d\'épée fulgurant qui fend la garde adverse.', classId: 'swordsman', kind: 'melee', multiplier: 1.8, cooldownMs: 2000, range: 60 },
  { id: 'tourbillon', name: 'Tourbillon', description: 'Le sabreur pivote, lames au vent, et frappe tout autour de lui.', classId: 'swordsman', kind: 'aoe', multiplier: 1.3, cooldownMs: 6000, range: 110 },
  { id: 'charge-bambou', name: 'Charge bambou', description: 'Une charge lancée pleine puissance qui embroche l\'ennemi de plein fouet.', classId: 'swordsman', kind: 'melee', multiplier: 2.2, cooldownMs: 8000, range: 90 },
  { id: 'cri-de-guerre', name: 'Cri de guerre', description: 'Un rugissement guerrier qui ébranle tous les ennemis alentour.', classId: 'swordsman', kind: 'aoe', multiplier: 0.8, cooldownMs: 5000, range: 140 },
  { id: 'provocation', name: 'Provocation', description: 'Une provocation cinglante qui secoue les ennemis sur un large rayon.', classId: 'swordsman', kind: 'aoe', multiplier: 0.5, cooldownMs: 4000, range: 160 },
  { id: 'lame-ultime', name: 'Lame ultime', description: 'Un unique coup dévastateur, l\'aboutissement de l\'art du sabre.', classId: 'swordsman', kind: 'melee', multiplier: 3.5, cooldownMs: 15000, range: 70 },
  { id: 'estoc-rapide', name: 'Estoc rapide', description: 'Une botte vive et répétée qui harcèle l\'ennemi sans répit.', classId: 'swordsman', kind: 'melee', multiplier: 1.4, cooldownMs: 1500, range: 55 },
  { id: 'onde-tranchante', name: 'Onde tranchante', description: 'Projette une lame d\'air tranchante qui file droit sur la cible.', classId: 'swordsman', kind: 'projectile', multiplier: 1.6, cooldownMs: 4000, range: 380 },
  // Mage
  { id: 'boule-de-feu', name: 'Boule de feu', description: 'Une sphère de flammes lancée droit devant, brûlante à souhait.', classId: 'mage', kind: 'projectile', multiplier: 1.8, cooldownMs: 3000, range: 450 },
  { id: 'eclair', name: 'Éclair', description: 'Un trait de foudre véloce qui frappe l\'ennemi en un éclair.', classId: 'mage', kind: 'projectile', multiplier: 1.4, cooldownMs: 1500, range: 500 },
  { id: 'nova-de-givre', name: 'Nova de givre', description: 'Une déflagration glaciale qui gèle tout dans un large rayon.', classId: 'mage', kind: 'aoe', multiplier: 1.2, cooldownMs: 7000, range: 130 },
  { id: 'meteore', name: 'Météore', description: 'Fait tomber un météore ardent qui pulvérise la zone d\'impact.', classId: 'mage', kind: 'aoe', multiplier: 2.5, cooldownMs: 12000, range: 100 },
  { id: 'soin-du-panda', name: 'Soin du panda', description: 'Une douce vague de magie qui referme les blessures du panda.', classId: 'mage', kind: 'heal', multiplier: 0.3, cooldownMs: 10000, range: 0 },
  { id: 'tempete-arcanique', name: 'Tempête arcanique', description: 'Déchaîne un maelström d\'arcanes qui ravage tout aux alentours.', classId: 'mage', kind: 'aoe', multiplier: 3.0, cooldownMs: 18000, range: 160 },
  { id: 'soin-majeur', name: 'Soin majeur', description: 'Un flux de magie puissante qui restaure une large part des PV.', classId: 'mage', kind: 'heal', multiplier: 0.5, cooldownMs: 16000, range: 0 },
  { id: 'rayon-arcanique', name: 'Rayon arcanique', description: 'Un rayon d\'énergie pure qui transperce tous les ennemis alignés.', classId: 'mage', kind: 'projectile', multiplier: 2.0, cooldownMs: 9000, range: 550, pierce: true },
  // Archer
  { id: 'fleche-percante', name: 'Flèche perçante', description: 'Une flèche décochée avec force qui traverse toute la file ennemie.', classId: 'archer', kind: 'projectile', multiplier: 2.0, cooldownMs: 2500, range: 700, pierce: true },
  { id: 'double-tir', name: 'Double tir', description: 'Deux flèches coup sur coup pour ne rien laisser passer.', classId: 'archer', kind: 'projectile', multiplier: 1.0, cooldownMs: 2000, range: 450 },
  { id: 'pluie-de-fleches', name: 'Pluie de flèches', description: 'Une volée retombe du ciel et crible toute la zone visée.', classId: 'archer', kind: 'aoe', multiplier: 1.4, cooldownMs: 8000, range: 140 },
  { id: 'tir-charge', name: 'Tir chargé', description: 'Une flèche longuement bandée qui transperce tout sur sa route.', classId: 'archer', kind: 'projectile', multiplier: 2.8, cooldownMs: 10000, range: 650, pierce: true },
  { id: 'fleche-de-bambou', name: 'Flèche de bambou', description: 'Une flèche de bambou taillée maison, simple et redoutablement efficace.', classId: 'archer', kind: 'projectile', multiplier: 1.3, cooldownMs: 3000, range: 400 },
  { id: 'salve-ultime', name: 'Salve ultime', description: 'Une nuée de flèches déversée d\'un coup sur un large secteur.', classId: 'archer', kind: 'aoe', multiplier: 3.2, cooldownMs: 16000, range: 180 },
  { id: 'tir-instinctif', name: 'Tir instinctif', description: 'Des tirs réflexes enchaînés à la vitesse de l\'instinct.', classId: 'archer', kind: 'projectile', multiplier: 0.8, cooldownMs: 1000, range: 400 },
  { id: 'tir-en-cloche', name: 'Tir en cloche', description: 'Une flèche lobée qui retombe par-dessus la garde adverse.', classId: 'archer', kind: 'projectile', multiplier: 1.6, cooldownMs: 4500, range: 480, arc: true },
  // Chevalier (évolution du Sabreur)
  { id: 'jugement-royal', name: 'Jugement royal', description: 'Un verdict d\'acier qui s\'abat, implacable, sur l\'ennemi.', classId: 'chevalier', kind: 'melee', multiplier: 4.5, cooldownMs: 12000, range: 90 },
  { id: 'garde-imperiale', name: 'Garde impériale', description: 'Balaye large d\'un revers impérial qui refoule les assaillants.', classId: 'chevalier', kind: 'aoe', multiplier: 2.2, cooldownMs: 7000, range: 180 },
  { id: 'sceau-du-heaume', name: 'Sceau du heaume', description: 'Projette un sceau sacré qui percute la cible de plein fouet.', classId: 'chevalier', kind: 'projectile', multiplier: 2.8, cooldownMs: 6000, range: 460 },
  // Sorcier (évolution du Mage)
  { id: 'cataclysme', name: 'Cataclysme', description: 'Un cataclysme dévastateur qui anéantit tout dans un vaste rayon.', classId: 'sorcier', kind: 'aoe', multiplier: 5.0, cooldownMs: 16000, range: 200 },
  { id: 'faille-du-neant', name: 'Faille du néant', description: 'Ouvre une déchirure du néant qui embroche tous les ennemis.', classId: 'sorcier', kind: 'projectile', multiplier: 3.5, cooldownMs: 7000, range: 620, pierce: true },
  { id: 'benediction-du-panda', name: 'Bénédiction du panda', description: 'Une bénédiction rayonnante qui régénère largement le panda.', classId: 'sorcier', kind: 'heal', multiplier: 0.7, cooldownMs: 14000, range: 0 },
  // Chasseur (évolution de l'Archer)
  { id: 'fleche-mortelle', name: 'Flèche mortelle', description: 'Un tir mortel qui traverse la ligne ennemie d\'un bout à l\'autre.', classId: 'chasseur', kind: 'projectile', multiplier: 4.8, cooldownMs: 9000, range: 800, pierce: true },
  { id: 'nuee-de-fleches', name: 'Nuée de flèches', description: 'Assombrit le ciel d\'une nuée qui s\'abat sur toute la zone.', classId: 'chasseur', kind: 'aoe', multiplier: 3.8, cooldownMs: 12000, range: 210 },
  { id: 'tir-du-faucon', name: 'Tir du faucon', description: 'Une flèche lobée avec l\'œil du faucon, fatale à sa retombée.', classId: 'chasseur', kind: 'projectile', multiplier: 2.4, cooldownMs: 3500, range: 560, arc: true },
]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]))

export function skillsOf(classId: ClassId): SkillDef[] {
  return CLASSES[classId].skillIds.map((id) => SKILLS[id]!)
}
