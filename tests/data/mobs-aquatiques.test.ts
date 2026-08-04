import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN POISSON EST DANS L'EAU — TEST NÉ D'UN RETOUR DE JEU
//
// « Il se passe un truc bizarre dans Ravin, j'ai trois poissons sur du sol empilés. » Mesuré à ce
// moment-là : **182** mobs aquatiques posés hors de toute cuve, sur presque tous les terrains à plan
// d'eau — et dans desert-5 (Ravin), requin + méduse + piranha sur la MÊME tuile de berge, à deux
// colonnes du bassin.
//
// Deux causes se cumulaient, et aucun test ne regardait :
//   1. les motifs « plan d'eau » reçoivent la liste aquatique dans leur slot `ground` (`o.aquatic` dans
//      planModules), donc le placeur générique du motif les posait sur la SURFACE marchable — la berge ;
//   2. les aquatiques sont volontairement exclus du déclustering (sinon les plans d'eau se videraient et
//      l'XP des biomes aquatiques s'effondrerait), donc rien ne les séparait : ils s'empilaient au même x.
//
// `monstersOffSurface` ne pouvait pas l'attraper : il distingue AÉRIEN de TERRESTRE, et un poisson posé
// sur une plateforme est parfaitement « sur une surface ». D'où ce test, qui vérifie le MILIEU.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ⚠️ `aquatic` VEUT DIRE « NE SE NOIE PAS », PAS « DOIT ÊTRE IMMERGÉ ». Le crabe géant est aquatique et
// c'est pourtant une sentinelle de plage (« elle ne cède pas un pouce de sable », dit son lore). C'est
// `amphibie` qui fait la part, et ce test ne juge que les vrais nageurs.
const terrains = Object.values(LEVELS)
const aquatiques = (l: (typeof terrains)[number]) =>
  l.spawns.filter((s) => MONSTERS[s.monsterId]?.aquatic && !MONSTERS[s.monsterId]?.amphibie)
const cuves = (l: (typeof terrains)[number]) =>
  (l.hazards ?? []).filter((h) => h.kind === 'water' && h.water !== 'lave')

describe('les mobs aquatiques vivent dans l\'eau', () => {
  it('aucun mob aquatique n\'est posé hors d\'une cuve', () => {
    const dehors: string[] = []
    for (const l of terrains) {
      const eaux = cuves(l)
      for (const s of aquatiques(l)) {
        if (!eaux.some((h) => s.x >= h.x && s.x < h.x + h.w)) dehors.push(`${l.id} ${s.monsterId} x${s.x}`)
      }
    }
    expect(dehors, `${dehors.length} aquatique(s) hors de l'eau : ${dehors.slice(0, 12).join(' | ')}`).toEqual([])
  })

  it('deux nageurs ne partagent une colonne que si leur cuve est trop étroite', () => {
    // Un banc de poissons est bienvenu, une PILE non : trois espèces sur la même tuile, c'est ce que le
    // joueur a vu. La règle est donc « une colonne chacun » — MAIS elle est physiquement impossible dans
    // une cuve d'une seule colonne (un rideau de cascade en est une). On n'exige donc l'étalement que là
    // où il tient : c'est une limite de place, pas une tolérance de confort.
    const piles: string[] = []
    for (const l of terrains) {
      for (const h of cuves(l)) {
        const dedans = aquatiques(l).filter((s) => s.x >= h.x && s.x < h.x + h.w)
        if (dedans.length <= h.w) {
          const parX = new Map<number, string[]>()
          for (const s of dedans) parX.set(s.x, [...(parX.get(s.x) ?? []), s.monsterId])
          for (const [x, ids] of parX) {
            if (ids.length > 1) piles.push(`${l.id} x${x} (cuve x${h.x}+${h.w}, ${dedans.length} nageurs) : ${ids.join(' + ')}`)
          }
        }
      }
    }
    expect(piles, `${piles.length} pile(s) de poissons évitable(s) : ${piles.slice(0, 12).join(' | ')}`).toEqual([])
  })

  it('un mob aquatique est IMMERGÉ (posé au fond, sans rangée imposée)', () => {
    // La convention des menaces d'eau : pas de `y` → le mob est placé au FOND de la cuve et nage. Un `y`
    // explicite le colle à une rangée, ce qui n'a de sens que pour une surface marchable.
    const perches: string[] = []
    for (const l of terrains) {
      for (const s of aquatiques(l)) if (s.y !== undefined) perches.push(`${l.id} ${s.monsterId} x${s.x} y${s.y}`)
    }
    expect(perches, `${perches.length} aquatique(s) accroché(s) à une rangée : ${perches.slice(0, 12).join(' | ')}`).toEqual([])
  })
})
