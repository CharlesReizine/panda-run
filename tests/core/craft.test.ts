import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { canCraft, doCraft } from '../../src/core/craft'
import type { RecipeDef } from '../../src/data/recipes'

const recipe: RecipeDef = {
  id: 'craft-test',
  resultItemId: 'epee-fer-forgee',
  materials: { 'minerai-fer': 5, 'croc-de-loup': 2 },
  gold: 60,
}

describe('craft', () => {
  it('canCraft renvoie true avec assez de matériaux et d\'or', () => {
    const p = newPlayer('Panda')
    p.gold = 60
    p.materials = { 'minerai-fer': 5, 'croc-de-loup': 2 }
    expect(canCraft(p, recipe)).toBe(true)
  })

  it('canCraft renvoie false si un matériau manque', () => {
    const p = newPlayer('Panda')
    p.gold = 60
    p.materials = { 'minerai-fer': 4, 'croc-de-loup': 2 }
    expect(canCraft(p, recipe)).toBe(false)
  })

  it('canCraft renvoie false si l\'or manque', () => {
    const p = newPlayer('Panda')
    p.gold = 59
    p.materials = { 'minerai-fer': 5, 'croc-de-loup': 2 }
    expect(canCraft(p, recipe)).toBe(false)
  })

  it('canCraft gère une recette sans coût en or', () => {
    const p = newPlayer('Panda')
    p.gold = 0
    p.materials = { 'herbe-tendre': 2 }
    expect(canCraft(p, { id: 'r', resultItemId: 'x', materials: { 'herbe-tendre': 2 } })).toBe(true)
  })

  it('doCraft débite matériaux + or et ajoute l\'objet', () => {
    const p = newPlayer('Panda')
    p.gold = 100
    p.materials = { 'minerai-fer': 7, 'croc-de-loup': 3 }
    expect(doCraft(p, recipe)).toBe(true)
    expect(p.gold).toBe(40)
    expect(p.materials['minerai-fer']).toBe(2)
    expect(p.materials['croc-de-loup']).toBe(1)
    expect(p.inventory).toEqual(['epee-fer-forgee'])
  })

  it('doCraft refuse et ne mute rien si ressources insuffisantes', () => {
    const p = newPlayer('Panda')
    p.gold = 60
    p.materials = { 'minerai-fer': 3, 'croc-de-loup': 2 }
    expect(doCraft(p, recipe)).toBe(false)
    expect(p.gold).toBe(60)
    expect(p.materials).toEqual({ 'minerai-fer': 3, 'croc-de-loup': 2 })
    expect(p.inventory).toEqual([])
  })
})
