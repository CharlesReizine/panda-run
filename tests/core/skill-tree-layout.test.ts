import { describe, it, expect } from 'vitest'
import { layoutSkillTree, type TreeSkill } from '../../src/scenes/skill-tree-layout'
import { SKILLS } from '../../src/data/skills'
import { CLASSES } from '../../src/data/classes'
import type { ClassId } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ARBRE DE COMPÉTENCES — placement.
//
// Ce qui doit être vrai pour que l'écran soit lisible :
//   · un sort est TOUJOURS à droite de son prérequis (sinon la flèche remonte et on ne comprend rien) ;
//   · deux sorts ne partagent jamais la même case (colonne, rangée) ;
//   · aucun sort ne DISPARAÎT, même si son prérequis appartient à une autre classe ;
//   · le placement est DÉTERMINISTE (deux rendus identiques).
// Et surtout : ça doit tenir sur le VRAI jeu de données, pour chaque classe.

const t = (id: string, requires?: string, minLevel?: number): TreeSkill => ({ id, requires, minLevel })

describe('layoutSkillTree', () => {
  it('place les racines en colonne 0', () => {
    const tree = layoutSkillTree([t('a'), t('b')])
    expect(tree.nodes.every((n) => n.tier === 0)).toBe(true)
    expect(tree.tiers).toBe(1)
  })

  it('un sort est toujours dans une colonne PLUS À DROITE que son prérequis', () => {
    const tree = layoutSkillTree([t('a'), t('b', 'a'), t('c', 'b')])
    const tier = new Map(tree.nodes.map((n) => [n.id, n.tier]))
    for (const e of tree.edges) {
      expect(tier.get(e.to)!, `${e.to} après ${e.from}`).toBeGreaterThan(tier.get(e.from)!)
    }
  })

  it('produit une arête par dépendance, et aucune de plus', () => {
    const tree = layoutSkillTree([t('a'), t('b', 'a'), t('c', 'a'), t('d')])
    expect(tree.edges).toHaveLength(2)
    expect(tree.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['a>b', 'a>c'])
  })

  it('centre un parent sur ses enfants', () => {
    const tree = layoutSkillTree([t('p'), t('k1', 'p'), t('k2', 'p')])
    const row = new Map(tree.nodes.map((n) => [n.id, n.row]))
    expect(row.get('p')).toBe((row.get('k1')! + row.get('k2')!) / 2)
  })

  it('deux sorts n\'occupent jamais la même case', () => {
    const tree = layoutSkillTree([t('a'), t('b', 'a'), t('c', 'a'), t('d'), t('e', 'd'), t('f', 'b')])
    const cells = tree.nodes.map((n) => `${n.tier}:${n.row}`)
    expect(new Set(cells).size).toBe(cells.length)
  })

  it('ne perd PAS un sort dont le prérequis est absent de la liste (autre classe)', () => {
    // cas réel : un sort évolué dont le prérequis appartient à la classe de base
    const tree = layoutSkillTree([t('evolue', 'sort-d-une-autre-classe')])
    expect(tree.nodes.map((n) => n.id)).toEqual(['evolue'])
    expect(tree.nodes[0]!.tier).toBe(0) // traité comme racine
  })

  it('est déterministe', () => {
    const input = [t('z', undefined, 9), t('a', undefined, 1), t('m', 'a', 5)]
    expect(layoutSkillTree(input)).toEqual(layoutSkillTree(input))
  })

  it('tient sur une liste vide', () => {
    expect(layoutSkillTree([])).toEqual({ nodes: [], edges: [], tiers: 0, rows: 0 })
  })
})

describe('arbre de compétences sur le VRAI roster', () => {
  const classIds = Object.keys(CLASSES) as ClassId[]

  it('chaque classe produit un arbre cohérent et sans case partagée', () => {
    for (const cls of classIds) {
      const skills = Object.values(SKILLS).filter((s) => s.classId === cls)
      if (!skills.length) continue
      const tree = layoutSkillTree(skills)
      // aucun sort perdu
      expect(tree.nodes.length, `${cls}: nombre de sorts`).toBe(skills.length)
      // pas deux sorts sur la même case
      const cells = tree.nodes.map((n) => `${n.tier}:${n.row}`)
      expect(new Set(cells).size, `${cls}: cases distinctes`).toBe(cells.length)
      // filiation toujours vers la droite
      const tier = new Map(tree.nodes.map((n) => [n.id, n.tier]))
      for (const e of tree.edges) {
        expect(tier.get(e.to)!, `${cls}: ${e.to} après ${e.from}`).toBeGreaterThan(tier.get(e.from)!)
      }
    }
  })

  it('AUCUN lignage d\'enfer : profondeur de dépendance ≤ 3', () => {
    // Règle de design posée par le user : « max 3 lignes, fais pas de lignages d'enfer ». Une chaîne
    // plus longue rend le dernier sort inatteignable sans farmer trois prérequis, et l'arbre devient
    // illisible en paysage. Ce test est le garde-fou : ajouter un 4e étage fait tomber la suite.
    for (const cls of classIds) {
      const skills = Object.values(SKILLS).filter((s) => s.classId === cls)
      if (!skills.length) continue
      expect(layoutSkillTree(skills).tiers, `${cls}: profondeur`).toBeLessThanOrEqual(3)
    }
  })

  it('le novice part d\'une racine unique (Câlin brutal)', () => {
    // demandé explicitement : le câlin conditionne les deux autres sorts du novice, ce qui donne un
    // vrai petit arbre au lieu de trois sorts posés côte à côte sans lien
    const tree = layoutSkillTree(Object.values(SKILLS).filter((s) => s.classId === 'novice'))
    expect(tree.nodes.filter((n) => n.tier === 0).map((n) => n.id)).toEqual(['calin-brutal'])
    expect(tree.edges).toHaveLength(2)
  })
})
