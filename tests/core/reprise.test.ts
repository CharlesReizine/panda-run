import { describe, it, expect } from 'vitest'
import { decideReprise, decideNouvelle, type Trouvaille } from '../../src/core/reprise'
import { newPlayer } from '../../src/core/player-state'
import type { StampedSave } from '../../src/core/save'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// REPRENDRE UNE PARTIE — LA MATRICE COMPLÈTE, PARCE QUE CE CHOIX A PERDU DES DONNÉES QUATRE FOIS
//
// Historique, dans l'ordre, tel que le user l'a vécu :
//   1. « quand je le choisis et que je dis continuer, ça me remet niveau 1 au début du jeu »
//   2. « je peux pas toujours reloader ma partie »
//   3. « enfin il me trouve mais j'ai une map vide quand je load, et j'ai un novice »
//   4. « dans classement on voit un archer de niveau 29 et pourtant quand je load j'ai un novice 1 »
//   5. « charlychoulove n'existe pas » — alors que le document était intact dans Firestore
//
// ⚠️ À CHACUN DE CES CINQ ÉPISODES, LES FONCTIONS PURES ÉTAIENT VERTES. `plusAvancee`, `memeJoueur`,
// `pseudoKey`, `unParJoueur` : tous testés, tous corrects. Le défaut était chaque fois dans
// l'ENCHÎNEMENT au sein de `TitleScene.continueGame` — un `catch` qui avale l'erreur, un `null` qui veut
// dire deux choses différentes, un délai d'attente qui expire. Aucun test ne pouvait le voir : une scène
// Phaser ne s'instancie pas en test. D'où l'extraction dans core/reprise.ts, et d'où ce fichier.
//
// La matrice ci-dessous est EXHAUSTIVE sur les trois états de la recherche cloud × la présence d'un local.

const save = (nom: string, niveau: number, at: number): StampedSave => {
  const p = newPlayer(nom)
  p.level = niveau
  return { player: p, savedAt: at }
}

const TROUVE = (s: StampedSave): Trouvaille => ({ etat: 'trouve', save: s })
const ABSENT: Trouvaille = { etat: 'absent' }
const ECHEC: Trouvaille = { etat: 'echec', raison: 'pas de réponse après 20 s' }

describe('decideReprise — le cas qui a coûté la sauvegarde', () => {
  it('recherche ÉCHOUÉE et aucun local : on RÉESSAIE, on ne propose JAMAIS une nouvelle partie', () => {
    // C'est exactement l'écran de la capture : « charlychoulove n'existe pas / Oui, nouvelle partie ».
    // L'archer 29 était dans la base ; seule la lecture avait dépassé le délai. Accepter l'offre
    // écrasait le personnage par un novice 1. Ce test est le garde-fou de cette classe entière de bugs.
    const r = decideReprise(ECHEC, null)
    expect(r.action).toBe('reessayer')
    expect(r.action === 'reessayer' && r.raison).toContain('20 s')
  })

  it('recherche ABSENTE et aucun local : LÀ on peut proposer une nouvelle partie', () => {
    // la seule situation où l'offre est légitime : on a bien cherché, et il n'y a rien
    expect(decideReprise(ABSENT, null).action).toBe('proposer-nouvelle')
  })

  it('échec au cloud mais un local existe : on charge le local, sans rien demander', () => {
    // hors connexion sur son propre téléphone : le jeu doit juste démarrer
    const r = decideReprise(ECHEC, save('charly', 29, 1000))
    expect(r.action).toBe('reprendre')
    expect(r.action === 'reprendre' && r.source).toBe('local')
  })
})

describe('decideReprise — entre deux sauvegardes, la plus avancée gagne', () => {
  it('préfère le cloud quand il est plus avancé (« j\'ai un novice alors que le classement dit 29 »)', () => {
    const r = decideReprise(TROUVE(save('charly', 29, 1000)), save('charly', 1, 9999))
    expect(r.action === 'reprendre' && r.save.player.level).toBe(29)
    expect(r.action === 'reprendre' && r.source).toBe('cloud')
  })

  it('préfère le local quand il est plus avancé (cloud périmé)', () => {
    const r = decideReprise(TROUVE(save('charly', 4, 9999)), save('charly', 30, 1000))
    expect(r.action === 'reprendre' && r.save.player.level).toBe(30)
    expect(r.action === 'reprendre' && r.source).toBe('local')
  })

  it('NE REGARDE PAS L\'HORODATAGE avant le niveau — le piège du correctif n°3', () => {
    // Le novice 1 créé par erreur portait un horodatage PLUS FRAIS que l'archer 29 : trier par date
    // ressuscitait le novice. Le niveau ne redescend jamais, la date si.
    const r = decideReprise(TROUVE(save('charly', 29, 1_000_000)), save('charly', 1, 9_000_000))
    expect(r.action === 'reprendre' && r.save.player.level).toBe(29)
  })

  it('à niveau ÉGAL, départage sur la plus récente', () => {
    const cloudRecent = decideReprise(TROUVE(save('c', 20, 9000)), save('c', 20, 1000))
    expect(cloudRecent.action === 'reprendre' && cloudRecent.source).toBe('cloud')
    const localRecent = decideReprise(TROUVE(save('c', 20, 1000)), save('c', 20, 9000))
    expect(localRecent.action === 'reprendre' && localRecent.source).toBe('local')
  })

  it('charge le cloud quand il n\'y a pas de local (reprise sur un autre téléphone)', () => {
    const r = decideReprise(TROUVE(save('charly', 29, 1000)), null)
    expect(r.action === 'reprendre' && r.source).toBe('cloud')
    expect(r.action === 'reprendre' && r.save.player.level).toBe(29)
  })

  it('charge le local quand le cloud est vide (première synchro à venir)', () => {
    const r = decideReprise(ABSENT, save('charly', 12, 1000))
    expect(r.action === 'reprendre' && r.source).toBe('local')
  })

  it('ne perd JAMAIS de niveau, quelle que soit la combinaison', () => {
    // propriété générale : la décision rend toujours au moins le niveau le plus élevé disponible.
    const niveaux = [-1, 1, 5, 29, 30]
    for (const nc of niveaux) for (const nl of niveaux) for (const etat of ['trouve', 'absent', 'echec'] as const) {
      const cloud: Trouvaille = etat === 'trouve' && nc >= 0 ? TROUVE(save('c', nc, 500))
        : etat === 'echec' ? ECHEC : ABSENT
      const local = nl >= 0 ? save('c', nl, 400) : null
      const attendu = Math.max(cloud.etat === 'trouve' ? nc : -1, nl)
      const r = decideReprise(cloud, local)
      if (attendu < 0) {
        expect(['reessayer', 'proposer-nouvelle'], `${etat}/${nc}/${nl}`).toContain(r.action)
      } else {
        expect(r.action, `${etat}/${nc}/${nl}`).toBe('reprendre')
        expect(r.action === 'reprendre' && r.save.player.level, `${etat}/${nc}/${nl}`).toBe(attendu)
      }
    }
  })
})

describe('decideNouvelle — créer sans écraser par accident', () => {
  it('une partie existe : on DEMANDE avant d\'écraser', () => {
    expect(decideNouvelle(TROUVE(save('c', 29, 1)))).toBe('confirmer-ecrasement')
  })

  it('rien sous ce pseudo : on crée directement', () => {
    expect(decideNouvelle(ABSENT)).toBe('creer')
  })

  it('vérification IMPOSSIBLE : on réessaie, on ne crée pas', () => {
    // L'ancien code démarrait quand même (« hors connexion, la synchro suivra ») ; la partie neuve
    // écrasait ensuite, à la première synchronisation, la sauvegarde distante jamais lue.
    expect(decideNouvelle(ECHEC)).toBe('reessayer')
  })
})
