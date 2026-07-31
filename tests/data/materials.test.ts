import { describe, it, expect } from 'vitest'
import { MATERIALS } from '../../src/data/materials'

describe('données matériaux', () => {
  it('14 matériaux, ids/noms/couleurs/rareté renseignés', () => {
    const all = Object.values(MATERIALS)
    expect(all).toHaveLength(14)
    for (const m of all) {
      expect(m.id.length).toBeGreaterThan(0)
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.color).toBeGreaterThanOrEqual(0)
      expect(['commune', 'rare']).toContain(m.rarity)
    }
  })

  it('la clé du record correspond à l id', () => {
    for (const [key, m] of Object.entries(MATERIALS)) expect(m.id).toBe(key)
  })

  it('assez de matières COMMUNES pour que le craft se lise (bois / bronze / fer + drops de bêtes)', () => {
    // Retour joueur : « ptet qu'il faudrait plusieurs types d'objets pour craft. Genre bois, bronze, fer,
    // + des trucs droppés par des monstres ». Une poignée de trophées ne fait pas sentir une montée en
    // gamme : il faut une VRAIE famille de matières de base, de quoi couvrir les trois paliers de biomes.
    const communes = Object.values(MATERIALS).filter((m) => m.rarity === 'commune')
    expect(communes.length, 'il faut une vraie famille de matières de base').toBeGreaterThanOrEqual(6)
    // L'échelle des métaux doit exister NOMMÉMENT — c'est elle que le joueur cherchait sans la trouver.
    for (const id of ['bois-brut', 'lingot-cuivre', 'minerai-fer']) {
      expect(MATERIALS[id]?.rarity, `${id} doit être une commune`).toBe('commune')
    }
  })

  it('deux matières n\'ont jamais la même couleur (l\'icône est GÉNÉRÉE à partir d\'elle)', () => {
    // material-<id> est dessiné à partir de la teinte : deux matières de même couleur deviennent
    // indiscernables d'un coup d'œil dans le butin comme dans le récap de la forge.
    const colors = Object.values(MATERIALS).map((m) => m.color)
    expect(new Set(colors).size, 'couleurs dupliquées').toBe(colors.length)
  })

  it('deux matières n\'ont jamais le même PREMIER MOT (c\'est tout ce que la forge affiche)', () => {
    // TownScene.shortMat ne garde que le 1er mot du nom : deux « Minerai de … » afficheraient tous deux
    // « Minerai 2/4 », coût de recette illisible. D'où « Lingot de cuivre » face à « Minerai de fer ».
    const firsts = Object.values(MATERIALS).map((m) => m.name.split(' ')[0]!)
    const dupes = firsts.filter((f, i) => firsts.indexOf(f) !== i)
    expect(dupes, `premier(s) mot(s) en doublon : ${[...new Set(dupes)].join(', ')}`).toEqual([])
  })
})
