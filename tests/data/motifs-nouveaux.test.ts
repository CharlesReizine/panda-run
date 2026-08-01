import { describe, it, expect } from 'vitest'
import { LEVEL_MODULE_KINDS, LEVELS } from '../../src/data/levels'
import { CATALOG, type ModuleKind } from '../../src/data/level-modules'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES NOUVEAUX MOTIFS EXISTENT VRAIMENT DANS LE JEU
//
// Demande du user : cinq motifs eau/grotte, plus des trampolines, « et inclus-en dans des niveaux à tous
// niveaux, je trouve que c'est un peu répétitif là ».
//
// ⚠️ CE TEST EXISTE PARCE QUE J'AI FAILLI LIVRER DES MOTIFS FANTÔMES. Ajoutés en fin de la rotation d'eau,
// les quatre motifs n'apparaissaient dans AUCUN terrain : la rotation est lue en `idx % longueur`, et les
// entrées de fin ne sont atteintes que par les biomes assez longs. Le code existait, le contenu non — et
// rien ne le signalait. Un motif écrit mais jamais généré coûte exactement autant qu'un motif absent.

const kindsUtilises = new Set<string>(Object.values(LEVEL_MODULE_KINDS).flat())
const terrainsAvec = (k: ModuleKind) =>
  Object.entries(LEVEL_MODULE_KINDS).filter(([, ks]) => ks.includes(k)).map(([id]) => id)

describe('les motifs posés sont réellement générés', () => {
  const poses: ModuleKind[] = ['cascade-plus-haute', 'boyau-tresor-retour', 'trampoline-plat', 'trampoline-vide', 'trampoline-corniche']

  it.each(poses)('%s apparaît dans au moins un terrain', (k) => {
    expect(terrainsAvec(k).length, `${k} n'est généré nulle part`).toBeGreaterThan(0)
  })

  it('ils sont répartis du début à la fin du jeu, pas groupés', () => {
    const ordre = Object.keys(LEVELS)
    const idx = poses.flatMap((k) => terrainsAvec(k)).map((id) => ordre.indexOf(id))
    expect(Math.min(...idx), 'rien en début de jeu').toBeLessThan(ordre.length / 2)
    expect(Math.max(...idx), 'rien en fin de jeu').toBeGreaterThan(ordre.length / 2)
  })
})

describe('les motifs écrits mais NON posés restent disponibles', () => {
  // Trois motifs sont écrits et jouables en isolation mais pas placés : le budget de modules par terrain
  // est plein, et en poser un de plus évince un motif central au point de faire disparaître des familles
  // entières du jeu. Ce test documente cet état et empêche qu'ils soient supprimés par mégarde.
  const enAttente: ModuleKind[] = ['cascade-deux-passages', 'cascade-deux-passages-g', 'colonnes-perilleuses', 'trampoline-echelle']

  it.each(enAttente)('%s existe au catalogue', (k) => {
    expect(CATALOG[k], `${k} a disparu du catalogue`).toBeDefined()
  })

  it('ils ne sont PAS posés — les poser casse la couverture globale', () => {
    for (const k of enAttente) expect(kindsUtilises.has(k), `${k} est posé alors qu'il ne valide pas`).toBe(false)
  })
})

describe('les aqueducs décoratifs sont bien là', () => {
  const avec = Object.values(LEVELS).filter((l) => (l.arches ?? []).length > 0)

  it('un bon nombre de terrains en portent un', () => {
    expect(avec.length).toBeGreaterThan(10)
  })

  it('leur largeur VARIE, comme demandé', () => {
    const largeurs = new Set(avec.flatMap((l) => (l.arches ?? []).map((a) => a.w)))
    expect(largeurs.size).toBeGreaterThan(3)
  })

  it('les deux dessous existent : eau ET vide', () => {
    const fills = new Set(avec.flatMap((l) => (l.arches ?? []).map((a) => a.fill)))
    expect(fills.has('eau')).toBe(true)
    expect(fills.has('vide')).toBe(true)
  })

  it('ils restent HORS de la zone de jeu : jamais au niveau du sol', () => {
    // c'est ce qui les rend inoffensifs par construction, donc invisibles pour les validateurs
    for (const l of avec) {
      const groundRow = (l.heightTiles ?? 30) - 3
      for (const a of l.arches ?? []) {
        expect(groundRow - a.y, `${l.id}: aqueduc trop bas`).toBeGreaterThanOrEqual(8)
      }
    }
  })
})
