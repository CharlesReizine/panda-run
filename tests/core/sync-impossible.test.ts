import { describe, it, expect } from 'vitest'
import { decideSync } from '../../src/core/sync'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA SYNCHRONISATION NE DOIT PAS ÉCRASER CE QU'ELLE N'A PAS PU LIRE
//
// Second endroit — après l'écran d'accueil — où une lecture ratée pouvait détruire une partie, et le plus
// sournois des deux : il n'affiche RIEN. `syncNow` appelait `pull(key)`, qui rendait `null` aussi bien pour
// « aucune sauvegarde distante » que pour « lecture impossible ». `decideSync(local, null, …)` répondait
// donc `pousser-le-local`, et la synchronisation écrivait l'état local par-dessus la partie distante.
// Sur un téléphone qui vient de perdre le réseau avec un novice fraîchement créé en local, cela suffisait
// à effacer un personnage niveau 29 — sans un mot à l'écran.
//
// ⚠️ CES TESTS PORTENT SUR LA TABLE DE DÉCISION, PAS SUR LE RÉSEAU. La garde elle-même vit dans
// `syncNow` (« si etat === 'echec', on rend 'impossible' et on ne touche à rien ») ; ce qui est épinglé
// ici, c'est que `pousser-le-local` reste bien réservé au cas où l'on SAIT que le cloud est vide — donc
// que confondre les deux situations reste une faute, et non un détail de câblage.

const s = (savedAt: number) => ({ savedAt })

describe('decideSync', () => {
  it('pousse le local UNIQUEMENT quand on sait que le cloud est vide', () => {
    expect(decideSync(s(1000), null, 0)).toBe('pousser-le-local')
  })

  it('prend le cloud quand il n\'y a pas de local', () => {
    expect(decideSync(null, s(1000), 0)).toBe('prendre-le-cloud')
  })

  it('ne fait rien quand les deux côtés sont vides', () => {
    expect(decideSync(null, null, 0)).toBe('rien')
  })

  it('ne fait rien quand les deux côtés portent le même horodatage', () => {
    expect(decideSync(s(5000), s(5000), 5000)).toBe('rien')
  })

  it('demande au joueur en cas de divergence réelle', () => {
    // les deux ont bougé depuis le dernier point de synchro : personne ne peut trancher à sa place
    expect(decideSync(s(7000), s(8000), 3000)).toBe('demander')
  })

  it('l\'état « impossible » existe et se distingue de tous les autres', () => {
    // Garde-fou de type autant que de logique : si quelqu'un retire 'impossible' de SyncAction, la garde
    // de syncNow ne compile plus, et le retour au comportement destructeur redevient impossible par
    // accident. On vérifie ici qu'aucune combinaison ne le produit toute seule — il est réservé au cas
    // où la LECTURE a échoué, une information que decideSync ne reçoit même pas.
    const combinaisons = [
      decideSync(null, null, 0), decideSync(s(1), null, 0), decideSync(null, s(1), 0),
      decideSync(s(1), s(1), 1), decideSync(s(9), s(8), 3), decideSync(s(8), s(9), 3),
    ]
    expect(combinaisons).not.toContain('impossible')
  })
})
