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
  // (les deux `cascade-deux-passages` ont été corrigés : leur corniche de sortie était fixée au bord du
  // module et s'éloignait du tunnel à mesure qu'on l'élargissait — 6 tuiles de vide à la même altitude.)
}

const plateauNeutre = (w: number, extra: Partial<Module> = {}): Module => ({
  kind: 'plateau', widthRange: [w, w], fillBelow: 'sol', fillAbove: 'air', tags: [], ...extra,
})

const ov = (a: { x: number; w: number }, b: { x: number; w: number }) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)

/** Défauts du motif planté seul entre deux plateaux : injoignables, et surfaces qui se recouvrent. */
function mesure(kind: ModuleKind, w: number): { injoignables: number; recouvrements: number } {
  const meta = CATALOG[kind]!
  const modules: Module[] = [
    plateauNeutre(20, { spawnHere: true, startAlt: 0 }),
    { kind, widthRange: [w, w], fillBelow: meta.below, fillAbove: meta.above, tags: [], ground: [], birds: [] },
    plateauNeutre(20, { exitHere: true }),
  ]
  const l = buildLevelFromModules(modules, { id: `isole-${kind}-${w}`, name: 'isolé', biome: 'plaine', seed: 'isolé' })
  // le motif occupe [20, 20+w) : la marge de bord gauche de l'assembleur vaut 2, plus 18 de plateau
  const dans = (p: { x: number }) => p.x >= 20 && p.x <= 20 + w
  const injoignables = (unreachablePlatforms(l) as unknown as { x: number }[]).filter(dans).length
  // DEUX SURFACES DE MÊME ALTITUDE QUI SE RECOUVRENT : c'est la faute qui produisait les superpositions
  // visibles à l'écran, et elle vient presque toujours du même geste — une corniche de sortie posée au
  // bord du module alors qu'une plateforme de même altitude court déjà jusque-là.
  const plats = l.platforms.filter(dans)
  let recouvrements = 0
  for (let i = 0; i < plats.length; i++) for (let j = i + 1; j < plats.length; j++) {
    if (plats[i]!.y === plats[j]!.y && ov(plats[i]!, plats[j]!) > 0) recouvrements++
  }
  return { injoignables, recouvrements }
}

// ⚠️ ON BALAYE TOUTES LES LARGEURS, PAS TROIS. La première version n'essayait que min / médiane / max, et
// la dernière superposition du jeu (plage-3) est passée exactement par là : elle n'apparaissait qu'à une
// largeur intermédiaire. Un motif est une famille de géométries, pas trois.
const tousLesMotifs = (Object.keys(CATALOG) as ModuleKind[]).map((kind) => {
  const [wmin, wmax] = CATALOG[kind]!.width
  const fautes: { w: number; quoi: string }[] = []
  const recouvre: { w: number; quoi: string }[] = []
  for (let w = wmin; w <= wmax; w++) {
    const { injoignables, recouvrements } = mesure(kind, w)
    if (injoignables) fautes.push({ w, quoi: `${injoignables} injoignable(s)` })
    if (recouvrements) recouvre.push({ w, quoi: `${recouvrements} recouvrement(s)` })
  }
  return { kind, fautes, recouvre }
})

describe('chaque motif se tient debout seul', () => {
  it('aucun motif n\'a de plateforme injoignable sans l\'aide d\'un voisin', () => {
    const fautifs = tousLesMotifs
      .filter((m) => m.fautes.length > 0 && !INVENTAIRE[m.kind])
      .map((m) => `${m.kind} (${m.fautes.map((f) => `largeur ${f.w} → ${f.quoi}`).join(', ')})`)
    expect(fautifs, `motifs fautifs seuls :\n   ${fautifs.join('\n   ')}`).toEqual([])
  })

  // ⚠️ L'INVENTAIRE N'EXCUSE QUE L'ATTEIGNABILITÉ, JAMAIS UN RECOUVREMENT — et cette distinction s'est
  // payée. En excusant un motif EN ENTIER, l'inventaire cachait le recouvrement de `trampoline-echelle`
  // (dont l'atteignabilité, elle, n'est pas mesurable ici faute de modèle du rebond) : c'est précisément
  // la superposition qui restait dans le jeu. Une limite du modèle de MESURE ne dispense pas d'un défaut
  // de GÉOMÉTRIE, qui se voit à l'œil nu.
  it('aucun motif ne pose deux surfaces qui se recouvrent (aucune dérogation)', () => {
    const fautifs = tousLesMotifs
      .filter((m) => m.recouvre.length > 0)
      .map((m) => `${m.kind} (${m.recouvre.map((f) => `largeur ${f.w} → ${f.quoi}`).join(', ')})`)
    expect(fautifs, `motifs qui se recouvrent :\n   ${fautifs.join('\n   ')}`).toEqual([])
  })

  it('l\'inventaire ne contient que des motifs RÉELLEMENT encore fautifs', () => {
    const guerisSansRetrait = Object.keys(INVENTAIRE)
      .filter((k) => !tousLesMotifs.find((m) => m.kind === k)?.fautes.length)
    expect(guerisSansRetrait, `à retirer de l'INVENTAIRE, ils sont sains : ${guerisSansRetrait.join(', ')}`).toEqual([])
  })
})
