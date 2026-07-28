import { describe, it, expect } from 'vitest'
import { decideSync } from '../../src/core/sync'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DÉCISION DE SYNCHRO local ↔ cloud — c'est ICI qu'on perd une sauvegarde si on se trompe.
//
// Le piège, et la raison d'être de `lastSyncedAt` : comparer local.savedAt à cloud.savedAt dit
// seulement lequel est le plus récent, JAMAIS si les deux ont divergé. Je joue sur l'iPhone (local
// avance), puis sur le Mac (cloud avance encore plus) : le cloud est le plus récent, donc « prendre
// le cloud » — et la session iPhone est écrasée en silence. `lastSyncedAt` (le savedAt du dernier
// état réellement échangé avec le cloud) sert de point de référence commun et rend la divergence
// détectable. Voir docs/specs/2026-07-28-authent-google-sauvegarde-cloud-design.md.

const at = (savedAt: number) => ({ savedAt })

describe('decideSync', () => {
  it('rien à faire quand il n\'y a de sauvegarde nulle part', () => {
    expect(decideSync(null, null, 0)).toBe('rien')
  })

  it('pousse le local à la 1re connexion (aucune sauvegarde cloud)', () => {
    // le cas de la toute première connexion : la partie en cours ne doit PAS être perdue
    expect(decideSync(at(1000), null, 0)).toBe('pousser-le-local')
  })

  it('prend le cloud quand il n\'y a rien en local (nouvel appareil)', () => {
    expect(decideSync(null, at(1000), 0)).toBe('prendre-le-cloud')
  })

  it('ne fait rien si ni le local ni le cloud n\'a changé depuis la dernière synchro', () => {
    expect(decideSync(at(1000), at(1000), 1000)).toBe('rien')
  })

  it('prend le cloud quand SEUL le cloud a changé', () => {
    // j'ai joué sur un autre appareil ; ici je n'ai rien fait depuis la dernière synchro
    expect(decideSync(at(1000), at(2000), 1000)).toBe('prendre-le-cloud')
  })

  it('garde le local quand SEUL le local a changé', () => {
    expect(decideSync(at(2000), at(1000), 1000)).toBe('garder-le-local')
  })

  it('DEMANDE au joueur quand les deux ont divergé', () => {
    // iPhone à 2000, Mac à 3000, dernière synchro à 1000 : les DEUX ont avancé depuis.
    // Une simple comparaison de dates dirait « prendre le cloud » et écraserait la partie iPhone.
    expect(decideSync(at(2000), at(3000), 1000)).toBe('demander')
    // symétrique : le local est le plus récent, mais le cloud a bougé aussi → toujours ambigu
    expect(decideSync(at(3000), at(2000), 1000)).toBe('demander')
  })

  it('ne demande rien si les deux portent le MÊME horodatage (même état)', () => {
    // jamais synchronisé (lastSyncedAt = 0) mais les deux côtés sont identiques : rien d'ambigu
    expect(decideSync(at(2000), at(2000), 0)).toBe('rien')
  })

  it('traite une sauvegarde locale sans horodatage (migration) comme la plus ancienne', () => {
    // savedAt = 0 = save d'avant la version 9 : elle ne doit pas passer pour « modifiée »
    expect(decideSync(at(0), at(5000), 0)).toBe('prendre-le-cloud')
  })

  it('demande quand les deux existent et qu\'on n\'a jamais synchronisé', () => {
    // 1re connexion sur un appareil qui a DÉJÀ une partie locale, alors que le cloud en a une autre :
    // réellement ambigu, on ne tranche pas à la place du joueur
    expect(decideSync(at(2000), at(5000), 0)).toBe('demander')
  })
})
