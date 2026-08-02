import { describe, it, expect } from 'vitest'
import { LEVELS, PLANS_CHOISIS, TERRAINS_HAUTS } from '../../src/data/levels'
import { PLANS_GRAVES } from '../../src/data/level-seeds.generated'
import { MONSTERS } from '../../src/data/monsters'
import type { LevelDef } from '../../src/data/levels'
import {
  caveCeilingClearance, deadEndSurfaces, laddersToNowhere, longEmptyFlats, monstersInRock,
  monstersOffSurface, overStackedColumns, oversizedGaps, oversizedLadders, startExitProblems,
  strictReach, suspendedWaterBanks, unlevelWaterBanks, unreachableChests, unreachableLadders,
  unreachablePlatforms,
} from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES PLANS DE TERRAIN SONT GRAVÉS — ET REVALIDÉS ICI, INTÉGRALEMENT
//
// Les terrains étaient reconstruits à CHAQUE DÉMARRAGE : jusqu'à 161 graines par terrain, chacune
// validée contre quatorze invariants, soit ~11 s avant le premier pixel. C'est ce coût qui interdisait
// de les allonger (44 s à ×2). Le résultat étant déterministe, il se calcule une fois pour toutes.
//
// ⚠️ CE FICHIER EST LA CONTREPARTIE DU RACCOURCI, ET IL N'EST PAS OPTIONNEL. En gravant, on retire la
// validation du chemin de démarrage : plus personne ne vérifie, à l'exécution, que le terrain produit
// est jouable. Si un motif change, un plan gravé hier peut donner aujourd'hui une plateforme
// injoignable, et le jeu l'afficherait sans broncher. Le test ci-dessous rejoue donc la batterie
// COMPLÈTE sur les terrains RÉELLEMENT construits — après toutes les passes de fin, pas seulement à la
// composition. Il doit rester aussi strict que la recherche qu'il remplace : sinon on n'a pas déplacé
// la vérification, on l'a supprimée.
//
// Regénérer après un changement de motif :
//   GEN_GRAINES=1 npx vitest run tests/data/graines.test.ts

const CHEMIN = 'src/data/level-seeds.generated.ts'
// Ni `node:fs` ni `process` ne sont typés ici : le projet ne dépend pas de @types/node, et l'ajouter
// ferait entrer les types Node dans TOUT le code du jeu (où `process` n'existe pas).
const glob = globalThis as {
  process?: { env?: Record<string, string | undefined> }
  __PANDA_GRAINES_INTERDITES?: Record<string, string[]>
}
const regenerer = glob.process?.env?.GEN_GRAINES === '1'
const isAerial = (id: string) => !!MONSTERS[id]?.aerial

/** Tous les défauts d'un terrain FINAL (après les passes appliquées à la liste entière). */
function defauts(l: LevelDef): string[] {
  const out: string[] = []
  const v = (nom: string, n: number) => { if (n) out.push(`${nom}(${n})`) }
  v('trous', oversizedGaps(l).length)
  v('échelles-hors-bornes', oversizedLadders(l).length)
  v('mobs-dans-roche', monstersInRock(l).length)
  v('départ-sortie', startExitProblems(l).length)
  v('échelles-sans-palier', laddersToNowhere(l).length)
  v('mobs-hors-surface', monstersOffSurface(l, isAerial).length)
  v('berges-désaxées', unlevelWaterBanks(l).length)
  v('eau-suspendue', suspendedWaterBanks(l).length)
  v('plafond-bas', caveCeilingClearance(l).length)
  // limite propre au terrain : les « terrains hauts » ont droit à six paliers (demande explicite)
  v('paliers-empilés', overStackedColumns(l, TERRAINS_HAUTS[l.id] ?? 3).length)
  v('bande-plate', longEmptyFlats(l, 20).length)
  v('piège-sans-retour', deadEndSurfaces(l).length)
  v('plateforme-injoignable', unreachablePlatforms(l).length)
  v('échelle-injoignable', unreachableLadders(l).length)
  v('coffre-injoignable', unreachableChests(l).length)
  // ⚠️ L'ATTEIGNABILITÉ STRICTE NE S'APPLIQUE PAS AUX TERRAINS « HAUTS ». Partout ailleurs elle a sa
  // place ici : la gravure peut rejeter une graine et recommencer, hors ligne, autant de fois qu'il faut.
  // Mais sur montagne-3 et cimetiere-1, les murs de roche SONT le motif (grande cascade, double passage
  // en falaise) : l'exiger fait rejeter toutes leurs graines, la boucle tourne dans le vide et finit par
  // livrer un terrain non validé — exactement ce qu'on voulait éviter. Vérifié trois fois.
  if (!TERRAINS_HAUTS[l.id]) v('plateforme-murée', strictReach(l).badPlats.length)
  return out
}

async function ecrire(chemin: string, contenu: string) {
  const mod = 'node:fs'
  const fs = (await import(/* @vite-ignore */ mod)) as { writeFileSync: (p: string, c: string) => void }
  fs.writeFileSync(chemin, contenu)
}

// Les arènes de boss ne passent pas par la recherche (géométrie écrite à la main).
const generes = () => Object.values(LEVELS).filter((l) => PLANS_CHOISIS[l.id] !== undefined)

describe('plans de terrain gravés', () => {
  if (regenerer) {
    // ─── GRAVURE ITÉRATIVE ────────────────────────────────────────────────────────────────────
    //
    // ⚠️ UN TERRAIN PEUT ÊTRE VALIDE À LA COMPOSITION ET FAUTIF APRÈS COUP. La recherche valide le
    // terrain tel que les modules le produisent ; ensuite, des passes s'appliquent à la LISTE ENTIÈRE
    // (couverture du bestiaire, placements ciblés, paliers de coffres) et peuvent le modifier. On ne
    // peut pas les déplacer dans la recherche : elles ont besoin de tous les terrains à la fois. On
    // boucle donc — on construit tout, on regarde les terrains FINAUX, on interdit les graines des
    // fautifs, et on recommence.
    it('grave les plans, en rejetant les graines qui ne survivent pas aux passes finales', async () => {
      glob.__PANDA_GRAINES_INTERDITES = {}
      let plans: Record<string, { seed: string; modules: unknown[] }> = {}
      let restants: string[] = []

      for (let passe = 1; passe <= 30; passe++) {
        const mod = await import(`../../src/data/levels?graines=${passe}`) as {
          LEVELS: Record<string, LevelDef>
          PLANS_CHOISIS: Record<string, { seed: string; modules: unknown[] }>
        }
        plans = mod.PLANS_CHOISIS
        const fautifs = Object.values(mod.LEVELS)
          .filter((l) => plans[l.id])
          .map((l) => ({ id: l.id, d: defauts(l) }))
          .filter((e) => e.d.length > 0)
        restants = fautifs.map((f) => `${f.id} ${f.d.join(' ')}`)
        const largeurs = Object.values(mod.LEVELS).map((l) => l.widthTiles).sort((a, b) => a - b)
        console.log(`passe ${passe} : ${fautifs.length} à reprendre · largeur médiane ${largeurs[Math.floor(largeurs.length / 2)]}`)
        if (!fautifs.length) break
        for (const f of fautifs) {
          const liste = glob.__PANDA_GRAINES_INTERDITES![f.id] ?? []
          liste.push(plans[f.id]!.seed)
          glob.__PANDA_GRAINES_INTERDITES![f.id] = liste
        }
      }

      const lignes = Object.entries(plans)
        .map(([id, g]) => `  ${JSON.stringify(id)}: ${JSON.stringify(g)},`)
        .join('\n')
      await ecrire(CHEMIN, [
        '// GÉNÉRÉ — ne pas éditer à la main. Regénérer avec :',
        '//   GEN_GRAINES=1 npx vitest run tests/data/graines.test.ts',
        '//',
        '// Plan de modules retenu pour chaque terrain, rejoué tel quel au démarrage : la recherche',
        '// (jusqu\'à 400 graines par terrain) ne tourne plus sur le téléphone du joueur. La génération',
        '// passe de ~11 s à moins d\'une seconde — c\'est ce qui rend abordables des terrains deux fois',
        '// plus longs.',
        '//',
        '// On grave le PLAN et non la graine : le choix des motifs passe par un compteur global (« le',
        '// moins servi d\'abord ») que la recherche fait avancer des centaines de fois, donc une graine',
        '// seule ne reproduit rien. buildLevelFromModules, lui, est pur.',
        "import type { Module } from './level-modules'",
        'export const PLANS_GRAVES: Record<string, { seed: string; modules: Module[] }> = {',
        lignes,
        '}',
        '',
      ].join('\n'))

      expect(restants, `terrains encore fautifs : ${restants.slice(0, 6).join(' | ')}`).toEqual([])
      expect(Object.keys(plans).length).toBeGreaterThan(40)
    }, 3_600_000)
    return
  }

  it('la table gravée couvre tous les terrains générés', () => {
    const manquants = generes().map((l) => l.id).filter((id) => !PLANS_GRAVES[id])
    expect(manquants, `à regénérer : ${manquants.slice(0, 5).join(', ')}`).toEqual([])
  })

  it('le jeu rejoue bien le plan gravé, sans chercher au démarrage', () => {
    for (const l of generes()) {
      if (PLANS_GRAVES[l.id]) expect(PLANS_CHOISIS[l.id]!.seed, l.id).toBe(PLANS_GRAVES[l.id]!.seed)
    }
  })

  it.each(generes().map((l) => [l.id, l] as const))('%s reste jouable avec son plan gravé', (_id, l) => {
    expect(defauts(l), `défauts : ${defauts(l).join(' ')}`).toEqual([])
  })
})
