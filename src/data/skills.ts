import type { ClassId, SkillDef } from '../core/types'
import { CLASSES } from './classes'

const list: SkillDef[] = [
  // Novice
  { id: 'calin-brutal', name: 'Câlin brutal', classId: 'novice', kind: 'melee', multiplier: 1.5, cooldownMs: 2000, range: 50 },
  { id: 'bambou-jete', name: 'Bambou jeté', classId: 'novice', kind: 'projectile', multiplier: 1.2, cooldownMs: 3000, range: 520, arc: true },
  { id: 'rugissement-panda', name: 'Rugissement du panda', classId: 'novice', kind: 'aoe', multiplier: 0.7, cooldownMs: 4500, range: 90 },
  // Sabreur
  { id: 'taillade', name: 'Taillade', classId: 'swordsman', kind: 'melee', multiplier: 1.8, cooldownMs: 2000, range: 60 },
  { id: 'tourbillon', name: 'Tourbillon', classId: 'swordsman', kind: 'aoe', multiplier: 1.3, cooldownMs: 6000, range: 110 },
  { id: 'charge-bambou', name: 'Charge bambou', classId: 'swordsman', kind: 'melee', multiplier: 2.2, cooldownMs: 8000, range: 90 },
  { id: 'cri-de-guerre', name: 'Cri de guerre', classId: 'swordsman', kind: 'aoe', multiplier: 0.8, cooldownMs: 5000, range: 140 },
  { id: 'provocation', name: 'Provocation', classId: 'swordsman', kind: 'aoe', multiplier: 0.5, cooldownMs: 4000, range: 160 },
  { id: 'lame-ultime', name: 'Lame ultime', classId: 'swordsman', kind: 'melee', multiplier: 3.5, cooldownMs: 15000, range: 70 },
  { id: 'estoc-rapide', name: 'Estoc rapide', classId: 'swordsman', kind: 'melee', multiplier: 1.4, cooldownMs: 1500, range: 55 },
  { id: 'onde-tranchante', name: 'Onde tranchante', classId: 'swordsman', kind: 'projectile', multiplier: 1.6, cooldownMs: 4000, range: 380 },
  // Mage
  { id: 'boule-de-feu', name: 'Boule de feu', classId: 'mage', kind: 'projectile', multiplier: 1.8, cooldownMs: 3000, range: 450 },
  { id: 'eclair', name: 'Éclair', classId: 'mage', kind: 'projectile', multiplier: 1.4, cooldownMs: 1500, range: 500 },
  { id: 'nova-de-givre', name: 'Nova de givre', classId: 'mage', kind: 'aoe', multiplier: 1.2, cooldownMs: 7000, range: 130 },
  { id: 'meteore', name: 'Météore', classId: 'mage', kind: 'aoe', multiplier: 2.5, cooldownMs: 12000, range: 100 },
  { id: 'soin-du-panda', name: 'Soin du panda', classId: 'mage', kind: 'heal', multiplier: 0.3, cooldownMs: 10000, range: 0 },
  { id: 'tempete-arcanique', name: 'Tempête arcanique', classId: 'mage', kind: 'aoe', multiplier: 3.0, cooldownMs: 18000, range: 160 },
  { id: 'soin-majeur', name: 'Soin majeur', classId: 'mage', kind: 'heal', multiplier: 0.5, cooldownMs: 16000, range: 0 },
  { id: 'rayon-arcanique', name: 'Rayon arcanique', classId: 'mage', kind: 'projectile', multiplier: 2.0, cooldownMs: 9000, range: 550, pierce: true },
  // Archer
  { id: 'fleche-percante', name: 'Flèche perçante', classId: 'archer', kind: 'projectile', multiplier: 2.0, cooldownMs: 2500, range: 700, pierce: true },
  { id: 'double-tir', name: 'Double tir', classId: 'archer', kind: 'projectile', multiplier: 1.0, cooldownMs: 2000, range: 450 },
  { id: 'pluie-de-fleches', name: 'Pluie de flèches', classId: 'archer', kind: 'aoe', multiplier: 1.4, cooldownMs: 8000, range: 140 },
  { id: 'tir-charge', name: 'Tir chargé', classId: 'archer', kind: 'projectile', multiplier: 2.8, cooldownMs: 10000, range: 650, pierce: true },
  { id: 'fleche-de-bambou', name: 'Flèche de bambou', classId: 'archer', kind: 'projectile', multiplier: 1.3, cooldownMs: 3000, range: 400 },
  { id: 'salve-ultime', name: 'Salve ultime', classId: 'archer', kind: 'aoe', multiplier: 3.2, cooldownMs: 16000, range: 180 },
  { id: 'tir-instinctif', name: 'Tir instinctif', classId: 'archer', kind: 'projectile', multiplier: 0.8, cooldownMs: 1000, range: 400 },
  { id: 'tir-en-cloche', name: 'Tir en cloche', classId: 'archer', kind: 'projectile', multiplier: 1.6, cooldownMs: 4500, range: 480, arc: true },
]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]))

export function skillsOf(classId: ClassId): SkillDef[] {
  return CLASSES[classId].skillIds.map((id) => SKILLS[id]!)
}
