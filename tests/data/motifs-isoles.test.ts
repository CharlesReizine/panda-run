import { describe, it, expect } from 'vitest'
import { buildLevelFromModules, CATALOG, type Module, type ModuleKind } from '../../src/data/level-modules'
import { unreachablePlatforms } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CHAQUE MOTIF SE TIENT DEBOUT SEUL — ET C'EST UN TEST NÉ D'UN BUG QUI A COÛTÉ UNE JOURNÉE.
//
// `cascade-plus-haute` était injoignable PAR CONSTRUCTION : trois de ses cinq plateformes hors d'atteinte,
// à toutes les largeurs. Son plancher de grotte était à 5 rangées de la berge d'entrée quand le saut
// garanti en fait 3, et il n'était pas non plus un « sommet de cascade » (2 rangées maximum sous le haut
// du rideau, il en était à 8). Rien ne l'avait jamais signalé : les rampes des modules VOISINS
// débordaient sur sa portée et lui fabriquaient un escalier par accident. Le jour où ces débordements
// ont été corrigés, les deux terrains qui imposent ce motif — plaine-7 et desert-7 — n'ont plus trouvé
// UNE SEULE graine valide, et la regravure a tourné 23 minutes pour rien.
//
// La leçon : valider un motif DANS un terrain ne le valide pas. Un voisin généreux masque le défaut, et
// on ne l'apprend que le jour où le voisin cesse de l'être. On plante donc chaque motif SEUL, entre deux
// plateaux neutres, à sa largeur minimale, médiane et maximale.
//
// Ce test ne remplace pas `graines.test.ts` (qui valide les terrains réels) : il dit d'où vient la faute.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// Motifs dont l'atteignabilité ne peut PAS être jugée par ce modèle, ou dette inventoriée. Comme pour
// `couverture-motifs`, cette liste est un inventaire, pas une dérogation : le test échoue aussi si l'un
// d'eux devient sain (il faudra retirer la ligne).
const INVENTAIRE: Record<string, string> = {
  // Ces deux-là ne s'atteignent qu'au REBOND de trampoline, que `computeReach` ne simule pas (c'est
  // `strictReach` qui modélise le rebond). Le défaut est dans le modèle de mesure, pas dans le motif.
  'trampoline-vide': 'atteignable au rebond, non simulé par computeReach',
  'trampoline-echelle': 'atteignable au rebond, non simulé par computeReach',
  // Dette réelle, à corriger avec le prochain lot de génération (une correction de motif = une
  // regravure) : une plateforme reste hors de portée aux grandes largeurs.
  'cascade-deux-passages': '1 plateforme hors de portée à la largeur maximale',
  'cascade-deux-passages-g': '1 plateforme hors de portée aux grandes largeurs',
}

const plateauNeutre = (w: number, extra: Partial<Module> = {}): Module => ({
  kind: 'plateau', widthRange: [w, w], fillBelow: 'sol', fillAbove: 'air', tags: [], ...extra,
})

/** Nombre de plateformes injoignables DANS le motif, planté seul entre deux plateaux. */
function injoignables(kind: ModuleKind, w: number): number {
  const meta = CATALOG[kind]!
  const modules: Module[] = [
    plateauNeutre(20, { spawnHere: true, startAlt: 0 }),
    { kind, widthRange: [w, w], fillBelow: meta.below, fillAbove: meta.above, tags: [], ground: [], birds: [] },
    plateauNeutre(20, { exitHere: true }),
  ]
  const l = buildLevelFromModules(modules, { id: `isole-${kind}-${w}`, name: 'isolé', biome: 'plaine', seed: 'isolé' })
  // le motif occupe [20, 20+w) : la marge de bord gauche de l'assembleur vaut 2, plus 18 de plateau
  return (unreachablePlatforms(l) as unknown as { x: number }[]).filter((p) => p.x >= 20 && p.x <= 20 + w).length
}

const tousLesMotifs = (Object.keys(CATALOG) as ModuleKind[]).map((kind) => {
  const [wmin, wmax] = CATALOG[kind]!.width
  const largeurs = [...new Set([wmin, Math.round((wmin + wmax) / 2), wmax])]
  const fautes = largeurs.map((w) => ({ w, n: injoignables(kind, w) })).filter((r) => r.n > 0)
  return { kind, fautes }
})

describe('chaque motif se tient debout seul', () => {
  it('aucun motif n\'a de plateforme injoignable sans l\'aide d\'un voisin', () => {
    const fautifs = tousLesMotifs
      .filter((m) => m.fautes.length > 0 && !INVENTAIRE[m.kind])
      .map((m) => `${m.kind} (${m.fautes.map((f) => `largeur ${f.w} → ${f.n} injoignable(s)`).join(', ')})`)
    expect(fautifs, `motifs injoignables seuls :\n   ${fautifs.join('\n   ')}`).toEqual([])
  })

  it('l\'inventaire ne contient que des motifs RÉELLEMENT encore fautifs', () => {
    const guerisSansRetrait = Object.keys(INVENTAIRE)
      .filter((k) => !tousLesMotifs.find((m) => m.kind === k)?.fautes.length)
    expect(guerisSansRetrait, `à retirer de l'INVENTAIRE, ils sont sains : ${guerisSansRetrait.join(', ')}`).toEqual([])
  })
})
