import { describe, it, expect } from 'vitest'
import { villeLaPlusProche, WORLD_NODES, START_NODE } from '../../src/data/worldmap'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE BANDEAU DE QUÊTE DIT OÙ ALLER
//
// Retour du joueur : « pour le statut des quêtes il faut afficher la ville où je dois aller chercher
// la récompense ». Le bandeau annonçait « récompense prête chez le garde » — exact, et inutilisable :
// le garde tient une échoppe dans CHAQUE ville. On répond par la carte, en nombre de traversées, pas
// en pixels : ce qui coûte au joueur, ce sont les terrains à retraverser.

describe('la ville où rendre sa quête', () => {
  it('depuis une ville, c\'est cette ville-là', () => {
    for (const n of WORLD_NODES.filter((x) => x.type === 'town')) {
      expect(villeLaPlusProche(n.id)?.id, n.id).toBe(n.id)
    }
  })

  it('depuis n\'importe quel nœud de la carte, une ville est trouvée', () => {
    for (const n of WORLD_NODES) {
      expect(villeLaPlusProche(n.id), `${n.id} n'a aucune ville joignable`).not.toBeNull()
    }
  })

  it('depuis le départ, c\'est la première ville du jeu', () => {
    expect(villeLaPlusProche(START_NODE)?.type).toBe('town')
  })

  it('un nœud inconnu ne fait pas planter le bandeau', () => {
    expect(villeLaPlusProche('nœud-qui-nexiste-pas')).toBeNull()
  })
})
