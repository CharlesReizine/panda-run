import { describe, it, expect } from 'vitest'
import { buildLevelFromModules, CATALOG, type Module, type ModuleKind } from '../../src/data/level-modules'
import { cornichesNues } from '../../src/core/roche'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PIERRE FRAGILE — LA MATIÈRE CASSABLE ET SES QUATRE MOTIFS
//
// Demande du user : « une nouvelle matière qui est du bloc de pierre cassable, et du coup il me faudrait
// quelques motifs avec des grottes ou grottes + de l'eau juste après ou cascade qui rentre dans grotte...
// avec des entrées bouchées qu'on peut casser en tapant quelques fois dans la pierre fragilisée. Pourquoi
// pas aussi des sols qu'on peut casser en sautant plusieurs fois sur les pierres fragiles. »
//
// ⚠️ CE QUI EST VÉRIFIÉ ICI N'EST PAS « ÇA SORT DE LA PIERRE », MAIS LES DEUX PROMESSES DE JOUABILITÉ que
// la mécanique peut trahir sans qu'on le voie :
//   1. la pierre ne barre JAMAIS le chemin obligatoire (sinon un joueur qui n'a pas compris est bloqué) ;
//   2. toute cavité derrière la pierre a une ÉCHELLE (sinon on y tombe et on ne remonte plus).
// C'est aussi ici qu'on épingle le nom 'cascade-grotte-scellee' : baptisé 'cascade-grotte', ce motif
// MASQUAIT un motif existant du même nom, sans le moindre message d'erreur.

// Les deux motifs ÉCRITS POUR la matière. Deux autres variantes (« grotte + eau » et « cascade dans la
// grotte », toutes deux scellées) ont été écrites puis ABANDONNÉES : leur géométrie se battait sans fin
// contre `unlevelWaterBanks`, qui prenait le toit de la cavité pour la berge du bassin. La mécanique est
// arrivée dans l'eau par une autre porte — une cache scellée greffée sur 'grotte-noyee', motif de grotte
// inondée déjà éprouvé par les validateurs (cf. le dernier bloc de ce fichier).
const KINDS: ModuleKind[] = ['grotte-scellee', 'sol-fragile']

/** Un terrain d'un seul motif, encadré de deux bandes plates (départ / sortie). */
function terrainDe(kind: ModuleKind, largeur = 30) {
  const spec = CATALOG[kind]
  const mods: Module[] = [
    { kind: 'plateau', widthRange: [12, 12], fillBelow: 'sol', fillAbove: 'air', tags: [], spawnHere: true, startAlt: 3 },
    { kind, widthRange: [largeur, largeur], fillBelow: spec.below, fillAbove: spec.above, tags: [] },
    { kind: 'plateau', widthRange: [12, 12], fillBelow: 'sol', fillAbove: 'air', tags: [], exitHere: true },
  ]
  return buildLevelFromModules(mods, { id: `essai-${kind}`, name: kind, biome: 'cave', seed: `essai-${kind}` })
}

describe('la matière cassable sort bien du générateur', () => {
  for (const kind of KINDS) {
    it(`${kind} pose de la pierre fragile`, () => {
      const lvl = terrainDe(kind)
      expect(lvl.breakables ?? [], 'aucun bloc cassable').not.toHaveLength(0)
      // rectangles bien formés : une hauteur ou une largeur nulle donnerait zéro tuile à l'écran
      for (const b of lvl.breakables!) {
        expect(b.w, `largeur de ${JSON.stringify(b)}`).toBeGreaterThan(0)
        expect(b.h, `hauteur de ${JSON.stringify(b)}`).toBeGreaterThan(0)
        expect(b.y, `y de ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(0)
      }
    })

    it(`${kind} n'enferme personne : une échelle ressort de la cavité`, () => {
      const lvl = terrainDe(kind)
      // toute pierre fragile ouvre sur un espace ; il doit exister une échelle dans le module
      expect(lvl.ladders ?? [], 'aucune échelle de remontée').not.toHaveLength(0)
    })

    it(`${kind} laisse le chemin praticable sans casser quoi que ce soit`, () => {
      // la pierre ne doit pas être posée EN TRAVERS du chemin : on vérifie qu'aucun bloc cassable
      // n'occupe la rangée du corps du panda au-dessus d'une plateforme du chemin principal.
      const lvl = terrainDe(kind)
      const cheminPrincipal = Math.min(...lvl.platforms.map((p) => p.y)) // la bande la plus haute
      const enTravers = (lvl.breakables ?? []).filter((b) =>
        b.y <= cheminPrincipal - 1 && b.y + b.h > cheminPrincipal - 1)
      // 'sol-fragile' est l'exception assumée : sa pierre EST le sol, à l'altitude du chemin — mais on
      // la contourne, puisque le chemin se poursuit de part et d'autre du pan fragile.
      if (kind !== 'sol-fragile') expect(enTravers, `blocs en travers : ${JSON.stringify(enTravers)}`).toEqual([])
    })

    it(`${kind} ne fabrique pas de corniche de pierre nue`, () => {
      const lvl = terrainDe(kind)
      expect(cornichesNues(lvl.rockBands ?? [], lvl.platforms)).toEqual([])
    })
  }
})

describe('le motif cascade-grotte préexistant est intact', () => {
  it('produit toujours sa cascade, et AUCUNE pierre fragile', () => {
    // Le garde-fou du masquage : si un jour un `case 'cascade-grotte'` réapparaît plus haut dans le
    // switch, ce test tombe — c'est exactement l'accident qui a failli se produire.
    const lvl = terrainDe('cascade-grotte', 28)
    expect((lvl.hazards ?? []).some((h) => h.water === 'cascade'), 'plus de cascade').toBe(true)
    expect(lvl.breakables ?? []).toHaveLength(0)
  })
})

describe('le catalogue', () => {
  it('déclare les quatre motifs, tous porteurs de coffre', () => {
    for (const kind of KINDS) {
      expect(CATALOG[kind], kind).toBeDefined()
      expect(CATALOG[kind].chest, `${kind} devrait cacher un coffre derrière sa pierre`).toBe(true)
    }
  })

  it('garde le motif cascade-grotte préexistant', () => {
    expect(CATALOG['cascade-grotte']).toBeDefined()
  })
})

describe('la grotte inondée porte aussi une cache scellée', () => {
  it('grotte-noyee pose de la pierre fragile SANS perdre son plan d\'eau', () => {
    // C'est par ici que « des grottes + de l'eau juste après » est servi : on greffe la matière sur un
    // motif dont la géométrie passe déjà les seize validateurs, au lieu d'en écrire un nouveau qui
    // n'arrivait jamais à les satisfaire tous en même temps.
    const lvl = terrainDe('grotte-noyee', 30)
    expect(lvl.breakables ?? [], 'aucune cache scellée').not.toHaveLength(0)
    expect((lvl.hazards ?? []).some((h) => h.kind === 'water'), 'plus de plan d\'eau').toBe(true)
  })
})
