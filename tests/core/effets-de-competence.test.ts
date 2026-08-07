import { describe, it, expect } from 'vitest'
import { SKILLS } from '../../src/data/skills'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE COMPÉTENCE ACTIVE PRODUIT UN EFFET
//
// ⚠️ « DÉVOTION » NE FAISAIT RIEN DU TOUT, ET CE DEPUIS TOUJOURS. Le champ `guard` était déclaré dans
// les données, la méthode `applyGuard` écrite dans Player… et jamais appelée : une seule occurrence
// dans tout le dépôt, sa définition. Douze points d'énergie et seize secondes de recharge pour un
// clignotement d'une frame.
//
// Un test existait pourtant sur cette compétence — il vérifiait la DONNÉE (que `guard` était bien
// renseigné), pas son BRANCHEMENT. C'est le trou exact : entre « la donnée est là » et « quelque chose
// s'en sert », il n'y avait personne. Ce fichier tient la seconde moitié.
//
// ⚠️ IL LIT LE CODE DE LA SCÈNE, ET C'EST ASSUMÉ. Toute l'exécution des compétences vit dans
// LevelScene (Phaser, non instanciable en test) : le seul moyen de vérifier qu'un champ est CONSOMMÉ
// est de le chercher dans la source. Grossier, mais il attrape la seule chose qui compte — un effet
// déclaré que personne ne lit.

const CHAMPS_D_EFFET = ['buff', 'fear', 'guard', 'slow', 'aura', 'wall', 'blast', 'heal', 'summon'] as const

async function source(): Promise<string> {
  const mod = 'node:fs'
  const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync: (p: string, e: string) => string }
  return fs.readFileSync('src/scenes/LevelScene.ts', 'utf8')
}

describe('effets de compétence', () => {
  it('tout champ d\'effet déclaré est LU quelque part', async () => {
    const code = await source()
    const declares = new Set<string>()
    for (const s of Object.values(SKILLS) as unknown as Record<string, unknown>[]) {
      for (const champ of CHAMPS_D_EFFET) if (s[champ] !== undefined) declares.add(champ)
    }
    const morts = [...declares].filter((c) => !code.includes(`skill.${c}`))
    expect(morts, `champs déclarés que personne ne lit : ${morts.join(', ')}`).toEqual([])
  })

  it('« dévotion » applique bien sa réduction de dégâts', async () => {
    const code = await source()
    const devotion = (SKILLS['devotion'] ?? {}) as { guard?: { dmgTakenMult: number; durationMs: number } }
    expect(devotion.guard, 'la compétence a perdu son garde').toBeDefined()
    expect(devotion.guard!.dmgTakenMult).toBeLessThan(1)
    expect(code, 'applyGuard n\'est appelé nulle part').toContain('applyGuard(skill.guard.dmgTakenMult')
  })
})
