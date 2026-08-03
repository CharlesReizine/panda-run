import { describe, it, expect } from 'vitest'
import { rangeeImpact, atteignableDuCiel, HORS_MONDE, type GeoChute } from '../../src/core/chute'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// « C'EST COMME DES CORPS SOUMIS À LA GRAVITÉ QUOI »
//
// Demande du user pour toutes les attaques du ciel (météores, pluies de flèches) : bloquées par tout sol
// au-dessus, et sinon ça descend jusqu'au sol en dessous. Ces tests épinglent les deux moitiés de la
// phrase, parce que le code d'avant se trompait sur les DEUX : la flèche traversait le plafond de grotte,
// et elle s'arrêtait en plein air quand on visait au-dessus d'un vide.

const geo = (o: Partial<GeoChute> = {}): GeoChute => ({ groundRow: 40, platforms: [], ...o })

describe('rangeeImpact — où s\'écrase un corps lâché du ciel', () => {
  it('descend jusqu\'au SOL DU MONDE quand la colonne est dégagée', () => {
    expect(rangeeImpact(geo(), 5)).toBe(40)
  })

  it('s\'arrête sur la première plateforme rencontrée, PAS sur le sol', () => {
    expect(rangeeImpact(geo({ platforms: [{ x: 0, y: 12, w: 10 }] }), 5)).toBe(12)
  })

  it('retient la plus HAUTE de plusieurs surfaces empilées', () => {
    const g = geo({ platforms: [{ x: 0, y: 30, w: 10 }, { x: 0, y: 12, w: 10 }, { x: 0, y: 22, w: 10 }] })
    expect(rangeeImpact(g, 5)).toBe(12)
  })

  it('ignore une surface qui ne couvre pas la colonne', () => {
    expect(rangeeImpact(geo({ platforms: [{ x: 20, y: 12, w: 5 }] }), 5)).toBe(40)
  })

  it('est arrêté par une dalle de roche SOLIDE, sur son dessus', () => {
    expect(rangeeImpact(geo({ rockBands: [{ x: 0, y: 18, w: 10, h: 6, solid: true }] }), 5)).toBe(18)
  })

  it('n\'est PAS arrêté par une dalle non solide (socle enterré, pas une surface)', () => {
    expect(rangeeImpact(geo({ rockBands: [{ x: 0, y: 18, w: 10, h: 6 }] }), 5)).toBe(40)
  })

  it('est arrêté par un pont de planches', () => {
    expect(rangeeImpact(geo({ bridges: [{ x: 0, y: 15, w: 8 }] }), 5)).toBe(15)
  })

  it('sort du monde au-dessus d\'un TROU : « ça descend jusqu\'au sol » n\'invente pas de sol', () => {
    expect(rangeeImpact(geo({ gaps: [{ x: 3, w: 4 }] }), 5)).toBe(HORS_MONDE)
    expect(rangeeImpact(geo({ gaps: [{ x: 3, w: 4 }] }), 8)).toBe(40) // hors du trou, le sol est là
  })

  it('au-dessus d\'un trou, une plateforme suspendue rattrape quand même le corps', () => {
    const g = geo({ gaps: [{ x: 3, w: 4 }], platforms: [{ x: 4, y: 25, w: 2 }] })
    expect(rangeeImpact(g, 5)).toBe(25)
    expect(rangeeImpact(g, 3)).toBe(HORS_MONDE) // colonne du trou non couverte par la plateforme
  })

  it('ne remonte jamais au-dessus du point de départ imposé', () => {
    const g = geo({ platforms: [{ x: 0, y: 12, w: 10 }, { x: 0, y: 30, w: 10 }] })
    expect(rangeeImpact(g, 5, 20)).toBe(30) // la plateforme y=12 est au-dessus du départ : ignorée
  })
})

describe('atteignableDuCiel — qui prend réellement les dégâts', () => {
  it('atteint une cible à découvert', () => {
    expect(atteignableDuCiel(geo(), 5, 38)).toBe(true)
  })

  it('NE PEUT PAS atteindre une cible abritée sous un toit', () => {
    // c'est le cœur de la demande : un monstre sous une dalle est protégé
    const g = geo({ rockBands: [{ x: 0, y: 20, w: 10, h: 4, solid: true }] })
    expect(atteignableDuCiel(g, 5, 38)).toBe(false)
  })

  it('atteint une cible POSÉE SUR le toit qui abrite les autres', () => {
    const g = geo({ rockBands: [{ x: 0, y: 20, w: 10, h: 4, solid: true }] })
    expect(atteignableDuCiel(g, 5, 20)).toBe(true) // sur le dessus, elle est à ciel ouvert
    expect(atteignableDuCiel(g, 5, 21)).toBe(false) // une rangée sous le dessus : déjà à l'abri
  })

  it('atteint tout le long d\'une colonne sans fond', () => {
    // rien pour arrêter le corps : il traverse, donc il touche à toute hauteur
    const g = geo({ gaps: [{ x: 3, w: 4 }] })
    expect(atteignableDuCiel(g, 5, 10)).toBe(true)
    expect(atteignableDuCiel(g, 5, 39)).toBe(true)
  })

  it('ne protège pas un monstre voisin hors de la portée du toit', () => {
    const g = geo({ rockBands: [{ x: 0, y: 20, w: 6, h: 4, solid: true }] })
    expect(atteignableDuCiel(g, 5, 38)).toBe(false)
    expect(atteignableDuCiel(g, 6, 38)).toBe(true) // le toit s'arrête à la colonne 5
  })
})
