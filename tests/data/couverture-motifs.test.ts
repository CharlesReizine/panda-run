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
// ⚠️ CETTE LISTE EST VIDE, ET C'EST L'ABOUTISSEMENT. Elle a compté jusqu'à six motifs « écrits mais jamais
// posés », chacun avec sa raison. Le user a tranché : « c'est quoi les tous inventoriés, c'est hors de
// question ». Les six ont donc été repris un par un — et aucun n'était réellement injouable, tous étaient
// MAL DÉCLARÉS : un déversoir de 3 rangées annoncé comme cascade remontable, un lac sans berge d'un côté,
// une échelle suspendue là où une corniche suffisait, une sortie de module au sommet d'un rideau qui rendait
// tout l'aval injoignable. Le validateur ne refusait pas des motifs difficiles, il refusait des motifs
// incohérents. On garde la structure du test : si un motif redevient non plaçable, il faudra l'écrire ici.
const NON_POSES: Record<string, string> = {}

describe('tout le catalogue est joué', () => {
  it('aucun motif n\'est oublié, hors dette inventoriée', () => {
    const oublies = tous.filter((k) => n(k) === 0 && !NON_POSES[k])
    expect(oublies, `motifs jamais générés : ${oublies.join(', ')}`).toEqual([])
  })

  it('la dette ne contient aucune entrée périmée', () => {
    const perimes = Object.keys(NON_POSES).filter((k) => n(k as ModuleKind) > 0)
    expect(perimes, `à retirer de NON_POSES : ${perimes.join(', ')}`).toEqual([])
  })

  it('AUCUN motif n\'est oublié — zéro, pas « presque zéro »', () => {
    // Le user a refusé net l'idée d'un inventaire de motifs non posés : « c'est quoi les tous inventoriés,
    // c'est hors de question ». Les six qui restaient ont donc été repris, et aucun n'était injouable — tous
    // étaient MAL DÉCLARÉS (un déversoir de 3 rangées annoncé comme cascade remontable, un lac sans berge
    // d'un côté, une échelle suspendue là où une corniche suffisait). Ce test interdit le retour d'un oubli.
    expect(tous.filter((k) => n(k) === 0)).toEqual([])
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
