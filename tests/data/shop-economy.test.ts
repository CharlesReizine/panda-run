// ÉCONOMIE DE BOUTIQUE — ce fichier verrouille l'INTENTION de la courbe de prix, pas ses valeurs.
//
// Retour joueur à l'origine de ces tests : « les chapeaux ne sont pas du tout assez chers, je suis
// arrivé à Prontera je pouvais tout acheter. » Un test qui figerait « ruban = 250 or » n'aurait rien
// protégé : il aurait juste rendu le prochain rééquilibrage pénible. On mesure donc l'or que le jeu
// DISTRIBUE vraiment (drops de data/monsters + coffres de data/props, recalculés ici depuis les
// données) et on verrouille les RAPPORTS entre ce revenu et les prix affichés. Retoucher un prix à la
// marge reste libre ; casser la courbe (rendre la vitrine dévalisable, aplatir les raretés) échoue.

import { describe, it, expect } from 'vitest'
import { LEVELS, type LevelDef } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'
import { PROPS } from '../../src/data/props'
import { WORLD_NODES } from '../../src/data/worldmap'
import { ITEMS, RARITY_PRICE } from '../../src/data/items'
import { SHOP_BY_TOWN, buyPrice, sellPrice, type ShopItemDef } from '../../src/data/shops'
import type { DropEntry, Rarity } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Modèle de REVENU EN OR (miroir de ce que core/playability-sim fait pour l'XP)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// playability-sim cumule la récompense d'XP terrain par terrain pour savoir à quel niveau un joueur
// arrive quelque part ; on fait le même exercice pour l'or, seule grandeur qui compte face à un prix.
// Deux lectures de la même table de drops :
//  - `expected` : espérance mathématique (chance × moyenne de la fourchette) = le joueur médian ;
//  - `floor`    : ce que le jeu GARANTIT (seules les entrées à chance 1, valeur minimale) = le joueur
//                 le plus malchanceux possible. C'est lui qui doit pouvoir s'acheter une arme.

type Luck = 'expected' | 'floor'

function goldOf(drops: DropEntry[], mode: Luck): number {
  let g = 0
  for (const d of drops) {
    if (d.kind !== 'gold') continue
    if (mode === 'floor') g += d.chance >= 1 ? d.min : 0
    else g += d.chance * ((d.min + d.max) / 2)
  }
  return g
}

// Or rapporté par un terrain nettoyé de fond en comble : tous ses mobs, tous ses props (les coffres
// pèsent lourd : 42,5 or d'espérance chacun), plus son boss d'arène s'il en a un.
function levelGold(level: LevelDef, mode: Luck): number {
  let g = 0
  for (const s of level.spawns) { const m = MONSTERS[s.monsterId]; if (m) g += goldOf(m.drops, mode) }
  for (const p of level.props ?? []) { const d = PROPS[p.kind]; if (d) g += goldOf(d.drops, mode) }
  if (level.boss) { const b = MONSTERS[level.boss]; if (b) g += goldOf(b.drops, mode) }
  return g
}

// Or cumulé en clearant UNE FOIS chaque terrain de la carte situé AVANT la ville donnée (l'ordre de
// WORLD_NODES est celui de la progression). Modèle du joueur « juste à l'heure » : il n'a pas rejoué
// les terrains, il vient d'arriver — le cas le plus contraignant pour juger d'une vitrine.
function goldOnArrival(townId: string, mode: Luck = 'expected'): number {
  const idx = WORLD_NODES.findIndex((n) => n.id === townId)
  let g = 0
  for (const n of WORLD_NODES.slice(0, idx)) {
    const l = n.levelId ? LEVELS[n.levelId] : undefined
    if (l) g += levelGold(l, mode)
  }
  return g
}

// Or de la campagne ENTIÈRE clearée une fois (58 terrains, hors primes de quêtes et hors reventes).
// Sert de plafond « fin de partie sans farm » : ce qui coûte plus que ça est un objectif, pas un achat.
function goldWholeGame(): number {
  return Object.values(LEVELS).reduce((sum, l) => sum + levelGold(l, 'expected'), 0)
}

const RARITY_ORDER: Rarity[] = ['commun', 'rare', 'epique', 'legendaire']
const rarityOf = (itemId: string): Rarity => ITEMS[itemId]?.rarity ?? 'commun'
const stockOf = (townId: string): ShopItemDef[] => {
  const s = SHOP_BY_TOWN[townId]!
  return [...s.weapons, ...s.armors, ...s.hats]
}
const allStock = (): ShopItemDef[] => Object.keys(SHOP_BY_TOWN).flatMap(stockOf)

describe('économie de boutique — le revenu du jeu est bien la référence', () => {
  it('les montants de référence sont bien ceux d\'un début de partie (garde-fou du modèle)', () => {
    // Si ces ordres de grandeur bougent (nouveaux terrains avant Prontera, coffres retirés…), c'est le
    // MODÈLE qui a changé et les rapports verrouillés plus bas doivent être relus, pas contournés.
    const arrival = goldOnArrival('prontera')
    expect(arrival).toBeGreaterThan(300)
    expect(arrival).toBeLessThan(3000)
    // le pire tirage possible reste du même ordre : le jeu ne laisse jamais un joueur les poches vides
    expect(goldOnArrival('prontera', 'floor')).toBeGreaterThan(arrival * 0.4)
    // Morocc est bien plus loin sur la route : on y arrive avec plusieurs fois le pécule de Prontera
    expect(goldOnArrival('morocc')).toBeGreaterThan(arrival * 2)
  })

  it('le stock de Prontera coûte des dizaines de fois l\'or gagné pour y arriver', () => {
    // LE test du retour joueur : « j'arrive à Prontera, je peux tout acheter ». La vitrine entière doit
    // rester une ambition de plusieurs dizaines d'heures, pas un caddie.
    const arrival = goldOnArrival('prontera')
    const total = stockOf('prontera').reduce((s, e) => s + e.price, 0)
    expect(total).toBeGreaterThan(arrival * 20)
  })

  it('en arrivant à Prontera on s\'offre un ou deux articles, jamais quatre', () => {
    // On achète du moins cher au plus cher (le pire cas pour la vitrine) et on compte combien d'articles
    // le pécule d'arrivée couvre. Trois au maximum : de quoi s'armer et se protéger, rien de plus.
    let budget = goldOnArrival('prontera')
    const prices = stockOf('prontera').map((e) => e.price).sort((a, b) => a - b)
    let bought = 0
    for (const p of prices) { if (p > budget) break; budget -= p; bought++ }
    expect(bought).toBeGreaterThanOrEqual(1) // …mais au moins un : une vitrine inatteignable ne sert à rien
    expect(bought).toBeLessThanOrEqual(3)
  })

  it('on peut TOUJOURS s\'armer en arrivant, même avec le pire butin du monde', () => {
    // Piège à éviter en renchérissant : rendre le jeu injouable pour le joueur malchanceux. Chaque
    // famille d'arme (épée / arc / bâton) doit avoir une entrée payable avec l'or GARANTI du parcours,
    // sinon un mage arrivé sans chance reste bloqué à mains nues.
    const floor = goldOnArrival('prontera', 'floor')
    for (const family of ['sword', 'bow', 'staff'] as const) {
      const cheapest = Math.min(...SHOP_BY_TOWN['prontera']!.weapons
        .filter((e) => ITEMS[e.itemId]!.weaponType === family)
        .map((e) => e.price))
      expect(cheapest).toBeLessThanOrEqual(floor)
    }
  })

  it('aucun chapeau au-delà du commun n\'est accessible en arrivant à Prontera', () => {
    // Cœur du retour joueur : la parure est le PREMIER objectif de farm. Un chapeau rare doit coûter
    // au moins une fois et demie le pécule d'arrivée — donc un aller-retour en plaine, minimum.
    const arrival = goldOnArrival('prontera')
    const fancy = SHOP_BY_TOWN['prontera']!.hats.filter((e) => rarityOf(e.itemId) !== 'commun')
    expect(fancy.length).toBeGreaterThan(0)
    for (const e of fancy) expect(e.price).toBeGreaterThan(arrival * 1.5)
  })

  it('un légendaire coûte plus que la campagne entière clearée une fois', () => {
    // « Hors de portée longtemps » se mesure : même en nettoyant les 58 terrains, l'or des terrains
    // seuls ne paye pas un légendaire. Il faut y ajouter les quêtes, les reventes et du farm.
    const whole = goldWholeGame()
    const legendaries = allStock().filter((e) => rarityOf(e.itemId) === 'legendaire')
    expect(legendaries.length).toBeGreaterThan(0)
    for (const e of legendaries) expect(e.price).toBeGreaterThan(whole)
  })
})

describe('économie de boutique — la rareté pilote le prix', () => {
  it('les bandes de prix par rareté ne se chevauchent pas', () => {
    // Régression visée : bonnet-champi COMMUN valait 700 or quand le sabre-acier RARE en valait 420 —
    // la couleur de rareté ne disait plus rien à la caisse. Le plus cher d'un palier doit rester sous
    // le moins cher du palier suivant, sur l'union de TOUTES les villes.
    const byRarity = new Map<Rarity, number[]>()
    for (const e of allStock()) {
      const r = rarityOf(e.itemId)
      byRarity.set(r, [...(byRarity.get(r) ?? []), e.price])
    }
    const present = RARITY_ORDER.filter((r) => byRarity.has(r))
    for (let i = 1; i < present.length; i++) {
      const below = Math.max(...byRarity.get(present[i - 1]!)!)
      const above = Math.min(...byRarity.get(present[i]!)!)
      expect(above).toBeGreaterThan(below)
    }
  })

  it('un légendaire vaut au moins 50 fois un commun', () => {
    const commons = allStock().filter((e) => rarityOf(e.itemId) === 'commun').map((e) => e.price)
    const legendaries = allStock().filter((e) => rarityOf(e.itemId) === 'legendaire').map((e) => e.price)
    expect(Math.min(...legendaries)).toBeGreaterThanOrEqual(Math.max(...commons) * 50)
  })

  it('le barème par rareté (repli des objets forgés) tombe DANS la bande de sa rareté', () => {
    // RARITY_PRICE sert de prix aux objets jamais vendus en ville (forgés, butin). S'il sortait de la
    // bande, un légendaire forgé se revendrait à un tarif incohérent avec la vitrine.
    for (const r of RARITY_ORDER) {
      const prices = allStock().filter((e) => rarityOf(e.itemId) === r).map((e) => e.price)
      if (prices.length === 0) continue
      expect(RARITY_PRICE[r]).toBeGreaterThanOrEqual(Math.min(...prices))
      expect(RARITY_PRICE[r]).toBeLessThanOrEqual(Math.max(...prices))
    }
  })

  it('Morocc est une ville de palier supérieur : sa vitrine coûte plus cher article par article', () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
    expect(median(stockOf('morocc').map((e) => e.price)))
      .toBeGreaterThan(median(stockOf('prontera').map((e) => e.price)))
  })
})

describe('économie de boutique — la revente ne court-circuite pas la courbe', () => {
  it('la revente reste strictement croissante avec la rareté', () => {
    // Le taux de revente est dégressif (12 % sur un légendaire contre 50 % sur un commun) : il faut
    // vérifier que le taux baisse MOINS vite que le prix ne monte, sinon écouler un épique rapporterait
    // moins qu'écouler un rare — absurde pour le joueur, quel que soit le raisonnement derrière.
    const sells = new Map<Rarity, number[]>()
    for (const e of allStock()) {
      const r = rarityOf(e.itemId)
      sells.set(r, [...(sells.get(r) ?? []), sellPrice(e.itemId)])
    }
    const present = RARITY_ORDER.filter((r) => sells.has(r))
    for (let i = 1; i < present.length; i++) {
      expect(Math.min(...sells.get(present[i]!)!)).toBeGreaterThan(Math.max(...sells.get(present[i - 1]!)!))
    }
  })

  it('revendre l\'objet forgé le plus précieux ne finance même pas le premier épique', () => {
    // LE piège de la revente : la forge produit des légendaires pour ~100 or plus des matériaux
    // (data/recipes). Si leur revente approchait le prix d'un épique de vitrine, forger-revendre
    // deviendrait la façon la plus rapide de s'enrichir et la courbe de prix ne voudrait plus rien dire.
    const forged = Object.values(ITEMS)
      .filter((i) => !allStock().some((e) => e.itemId === i.id))
      .map((i) => sellPrice(i.id))
    const cheapestEpic = Math.min(...allStock().filter((e) => rarityOf(e.itemId) === 'epique').map((e) => e.price))
    expect(Math.max(...forged)).toBeLessThan(cheapestEpic)
  })

  it('revendre ne rapporte jamais plus que ce que l\'objet a coûté', () => {
    for (const id of Object.keys(ITEMS)) expect(sellPrice(id)).toBeLessThan(buyPrice(id))
  })
})
