import { describe, it, expect } from 'vitest'
import { annulerPousseeEnAttente, schedulePush, setAutoPushKey } from '../../src/cloud/sync-service'
import { newPlayer } from '../../src/core/player-state'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CHANGER D'IDENTITÉ ANNULE LA POUSSÉE EN ATTENTE — SIXIÈME PERTE DE SAUVEGARDE, ET LA PLUS NETTE
//
// Ce test n'est pas préventif : il rejoue un accident dont la trace était encore dans la vraie base le
// 4 août. `saves/charlychoulove` contenait « megastock, niveau 1, novice », écrit à 10 h 58 — l'instant
// où une nouvelle partie a été créée sur cet appareil. Le chasseur 30 du joueur, lui, était intact sous
// `saves/charlychoulov`. Ce n'est donc pas sa partie qui avait disparu : c'est sa CLÉ qui avait été
// écrasée par la partie d'un autre personnage.
//
// L'enchaînement :
//   1. au démarrage, TitleScene arme la poussée automatique avec le pseudo MÉMORISÉ ;
//   2. `startFresh` sauvegarde le nouveau personnage → le crochet onSaved programme une poussée à
//      +3 s, portant la clé encore armée (celle de l'ancien joueur) ;
//   3. la clé courante change ensuite… mais la poussée déjà programmée garde la sienne ;
//   4. trois secondes plus tard, le niveau 1 part sur la clé du joueur précédent.
//
// ⚠️ DEUX GESTES, PAS UN. TitleScene arme désormais la clé AVANT la première sauvegarde, et
// `setAutoPushKey` annule toute poussée en attente quand l'identité change. Le premier suffit pour ce
// chemin-là ; le second couvre tous les autres, y compris ceux qui n'existent pas encore. Une poussée
// en attente appartient à l'identité qui l'a demandée — quand elle change, la livrer n'est jamais bon.

const perso = () => newPlayer('peu-importe')

describe('poussée automatique et changement d\'identité', () => {
  it('une poussée programmée est bien en attente, et annulable', () => {
    setAutoPushKey('charlychoulove')
    schedulePush('charlychoulove', perso(), 1, 10_000)
    expect(annulerPousseeEnAttente(), 'une poussée devait être en attente').toBe(true)
    expect(annulerPousseeEnAttente(), 'plus rien à annuler ensuite').toBe(false)
  })

  it('réarmer la MÊME clé ne jette pas la poussée en attente', () => {
    setAutoPushKey('charlychoulove')
    schedulePush('charlychoulove', perso(), 1, 10_000)
    setAutoPushKey('charlychoulove')
    expect(annulerPousseeEnAttente(), 'la poussée du même joueur doit survivre').toBe(true)
  })

  it('CHANGER de clé jette la poussée en attente — le cas du 4 août', () => {
    setAutoPushKey('charlychoulove')
    schedulePush('charlychoulove', perso(), 1, 10_000) // la sauvegarde du nouveau perso, mauvaise clé
    setAutoPushKey('megastock')                        // on bascule sur la nouvelle identité
    expect(annulerPousseeEnAttente(), 'la poussée de l\'ancienne clé devait être annulée').toBe(false)
  })

  it('se déconnecter (clé nulle) jette aussi la poussée en attente', () => {
    setAutoPushKey('charlychoulove')
    schedulePush('charlychoulove', perso(), 1, 10_000)
    setAutoPushKey(null)
    expect(annulerPousseeEnAttente()).toBe(false)
  })
})
