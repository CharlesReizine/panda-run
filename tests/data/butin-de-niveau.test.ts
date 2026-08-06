import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { ITEMS } from '../../src/data/items'
import { minLevelOf } from '../../src/core/item-level'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN MONSTRE NE LÂCHE QUE DES OBJETS PAS TROP LOIN DE SON NIVEAU
//
// Règle énoncée par le joueur, après avoir vu la partie d'un autre : « j'ai l'impression qu'Émile a
// chopé des objets légendaires de niveau 30 alors qu'il était tout au début du jeu, c'est absurde
// non ? », puis « un monstre devrait pouvoir lâcher que des objets pas trop loin de son niveau ».
//
// ⚠️ LE COUPABLE N'ÉTAIT PAS LES MONSTRES, C'ÉTAIENT LES COFFRES (cf. tests/core/loot.test.ts) : leur
// tirage rare balayait uniformément les soixante-sept équipements épiques et légendaires du jeu, du
// niveau 1 au niveau 45. Les tables de butin des monstres, elles, sont écrites à la main et se tenaient
// déjà — trois écarts seulement sur l'ensemble du bestiaire.
//
// Ce test ne corrige donc rien : il VERROUILLE ce qui va bien. Une table de butin se retouche en une
// ligne, et rien ne signalait jusqu'ici qu'on venait d'accrocher un légendaire de fin de partie à une
// bestiole de départ.
//
// Les trois écarts existants, tous assumés comme récompense d'aspiration (on tue plus fort que soi
// pour l'obtenir), et tous à faible probabilité :
//   · poring-dore (niveau 12) → amulette-gemme (niveau 19), 8 %
//   · golem-ancien (niveau 39) → baton-cosmique (niveau 45), 2 %
//   · roi-liche (niveau 36) → faux-sombre (niveau 45), 2 %
// L'ÉCART EST UN PLAFOND, PAS UNE CIBLE. Le resserrer est une décision d'équilibrage qui revient au
// joueur ; le laisser dériver vers le haut, non.

const ECART_MAX = 9

describe('butin des monstres', () => {
  it('aucun monstre ne lâche un équipement très au-dessus de son niveau', () => {
    const ecarts: string[] = []
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops ?? []) {
        if (!d.itemId) continue
        const item = ITEMS[d.itemId]
        if (!item?.slot) continue // consommables et matériaux : pas de palier de port
        const requis = minLevelOf(item)
        if (requis > m.level + ECART_MAX) {
          ecarts.push(`${m.id} (niveau ${m.level}) → ${d.itemId} (niveau ${requis}), ${Math.round(d.chance * 100)} %`)
        }
      }
    }
    expect(ecarts, `butin hors de portée :\n   ${ecarts.join('\n   ')}`).toEqual([])
  })

  it('tout objet cité dans une table de butin existe', () => {
    const inconnus = Object.values(MONSTERS).flatMap((m) =>
      (m.drops ?? []).filter((d) => d.itemId && !ITEMS[d.itemId]).map((d) => `${m.id} → ${d.itemId}`))
    expect(inconnus).toEqual([])
  })
})
