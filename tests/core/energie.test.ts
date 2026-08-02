import { describe, it, expect } from 'vitest'
import { energyCostOf } from '../../src/core/skill-executor'
import { SKILLS } from '../../src/data/skills'
import { CLASSES } from '../../src/data/classes'
import type { ClassId } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ÉNERGIE DOIT MANQUER — SINON CE N'EST PAS UNE RESSOURCE
//
// Retour du user : « le regen de mana doit être plus lent, là je peux enchaîner les skills sans
// problème ». À 8 points par seconde, la barre se remplissait plus vite qu'on ne la vidait : les
// cooldowns devenaient la seule limite du jeu, et la jauge d'énergie un décor.
//
// ⚠️ CE TEST NE VÉRIFIE PAS UN CHIFFRE, IL VÉRIFIE UN RAPPORT. Le réglage se fera à l'oreille et
// bougera ; ce qui ne doit pas bouger, c'est que lancer des sorts en continu VIDE la barre. On compare
// donc le débit de la régénération au coût d'un enchaînement réel, classe par classe.

const REGEN_PAR_SEC = 4 // cf. ENERGY_REGEN_PER_SEC dans Player.ts
const ENERGIE_MAX = 100
const GAIN_PAR_KILL = 6 // cf. GAIN_ENERGIE_KILL dans LevelScene.ts

/** Coût moyen d'un sort ACTIF de la classe (les passifs ne se lancent pas). */
function coutMoyen(classId: ClassId): number {
  const actifs = CLASSES[classId].skillIds
    .map((id) => SKILLS[id])
    .filter((s): s is NonNullable<typeof s> => !!s && s.kind !== 'passive')
  return actifs.reduce((a, s) => a + energyCostOf(s), 0) / actifs.length
}

describe('économie d\'énergie', () => {
  it('la régénération passive ne paie pas un sort par seconde', () => {
    // Le seuil : si la régénération d'une seconde couvrait le coût moyen d'un sort, on pourrait lancer
    // en boucle sans jamais regarder sa barre — c'est exactement ce que le user décrit.
    for (const cls of ['swordsman', 'mage', 'archer', 'chevalier', 'sorcier', 'chasseur'] as ClassId[]) {
      expect(REGEN_PAR_SEC, `${cls}`).toBeLessThan(coutMoyen(cls))
    }
  })

  it('une barre pleine donne quelques sorts, pas une dizaine', () => {
    // Entre 3 et 7 sorts d'affilée : assez pour un engagement, pas assez pour toute une traversée.
    for (const cls of ['swordsman', 'mage', 'archer', 'chevalier', 'sorcier', 'chasseur'] as ClassId[]) {
      const n = ENERGIE_MAX / coutMoyen(cls)
      expect(n, `${cls} : ${n.toFixed(1)} sorts par barre`).toBeGreaterThanOrEqual(3)
      expect(n, `${cls} : ${n.toFixed(1)} sorts par barre`).toBeLessThanOrEqual(7)
    }
  })

  it('tuer rend de quoi enchaîner, pas de quoi ignorer la barre', () => {
    // « Un peu de regen mana quand on tue un mob, mais qui reste faible. » La borne haute est ce qui
    // fait la différence entre une récompense et une fontaine : il faut plusieurs kills pour un sort.
    for (const cls of ['swordsman', 'mage', 'archer'] as ClassId[]) {
      expect(GAIN_PAR_KILL, `${cls}`).toBeLessThan(coutMoyen(cls) / 2)
    }
    expect(GAIN_PAR_KILL).toBeGreaterThan(0)
  })

  it('aucun sort ne coûte plus qu\'une barre pleine', () => {
    // Un sort inlançable même à l'énergie maximale serait un bouton mort dans la barre de compétences.
    for (const s of Object.values(SKILLS)) {
      if (s.kind === 'passive') continue
      expect(energyCostOf(s), s.id).toBeLessThanOrEqual(ENERGIE_MAX)
    }
  })
})
