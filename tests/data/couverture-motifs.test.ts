import { describe, it, expect } from 'vitest'
import { LEVEL_MODULE_KINDS } from '../../src/data/levels'
import { CATALOG, type ModuleKind } from '../../src/data/level-modules'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// COUVERTURE DU CATALOGUE DE MOTIFS
//
// Demande du user, sans détour : « je veux que TOUT apparaisse, et PLUSIEURS FOIS ! Un module créé pour
// n'apparaître qu'une fois… useless !!! »
//
// ⚠️ CE TEST EXISTE PARCE QUE LA COUVERTURE ÉTAIT UNE LOTERIE, ET QUE PERSONNE NE LE VOYAIT. Tant que la
// sélection des motifs était un tirage au sort, 7 motifs sur 82 n'apparaissaient nulle part et 15 une seule
// fois — du contenu écrit, testé, et jamais joué. Épingler un motif à un terrain réglait un cas et en
// cassait un autre ailleurs ; ce jeu de bascule a coûté trois tours complets.
// La sélection prend désormais « le moins servi d'abord », tous terrains confondus (USAGE_GLOBAL dans
// level-modules) : la couverture est une conséquence arithmétique, plus une chance.

const tous = Object.keys(CATALOG) as ModuleKind[]
const compte: Record<string, number> = {}
for (const ks of Object.values(LEVEL_MODULE_KINDS)) for (const k of ks) compte[k] = (compte[k] ?? 0) + 1
const n = (k: ModuleKind) => compte[k] ?? 0

// Motifs délibérément NON posés, chacun pour une raison vérifiée et écrite. Cette liste est un INVENTAIRE
// de dette, pas une dérogation : le test échoue aussi si l'un d'eux se met à apparaître (il faudra alors
// retirer la ligne) ou si un motif non listé disparaît.
const NON_POSES: Record<string, string> = {
  'passage-immerge': 'produit de l\'eau suspendue et une sortie à l\'altitude du départ (essayé sur plage-1)',
  'trampoline-cascade': 'son rideau et le plafond de roche voisin murent des plateformes (foret-6, desert-9)',
  'trampoline-echelle': 'écarté sur demande du user',
  'cascade-saut-ange': 'chaînage d\'altitude non résolu (perchoir haut)',
  'cascade-large-pierre': 'idem',
  'lacs-cascade-descente': 'le validateur ne modélise pas la chute : les lacs du haut sont injoignables',
}

describe('tout le catalogue est joué', () => {
  it('aucun motif n\'est oublié, hors dette inventoriée', () => {
    const oublies = tous.filter((k) => n(k) === 0 && !NON_POSES[k])
    expect(oublies, `motifs jamais générés : ${oublies.join(', ')}`).toEqual([])
  })

  it('la dette ne contient aucune entrée périmée', () => {
    const perimes = Object.keys(NON_POSES).filter((k) => n(k as ModuleKind) > 0)
    expect(perimes, `à retirer de NON_POSES : ${perimes.join(', ')}`).toEqual([])
  })

  it('la GRANDE MAJORITÉ des motifs sort plusieurs fois', () => {
    const joues = tous.filter((k) => !NON_POSES[k])
    const plusieurs = joues.filter((k) => n(k) >= 2)
    expect(plusieurs.length / joues.length, 'trop de motifs à une seule occurrence').toBeGreaterThan(0.85)
  })

  it('la médiane est franchement au-dessus de 1 — la variété est réelle, pas cosmétique', () => {
    const vals = tous.filter((k) => !NON_POSES[k]).map(n).sort((a, b) => a - b)
    expect(vals[Math.floor(vals.length / 2)]).toBeGreaterThanOrEqual(4)
  })

  it('aucun motif ne monopolise : le plus servi reste sous 12 % des slots', () => {
    const total = Object.values(compte).reduce((a, b) => a + b, 0)
    expect(Math.max(...Object.values(compte)) / total, 'un motif écrase les autres').toBeLessThan(0.12)
  })
})
