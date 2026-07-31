import { describe, it, expect } from 'vitest'
import { INTRO, INTRO_ROW, introHeaderBottom, introNavTop, introNavBottom, introChromeClears, introRowSpans } from '../../src/scenes/level-intro-layout'
import { CARD, lootFits, skillsFit } from '../../src/scenes/bestiary-layout'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'
import { SKILLS } from '../../src/data/skills'
import type { MonsterDef } from '../../src/core/types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ÉCRAN DE DÉBUT DE TERRAIN — RIEN NE DÉBORDE, ET LA FICHE A TOUTE SA PLACE
//
// Retour user : « y a un problème sur l'image au début de terrain pour décrire les monstres (et pas le
// bestiaire), là ça déborde complet et c'est pas le format que je veux. »
//
// La cause était structurelle : l'écran entassait TOUS les monstres du terrain dans une grille, avec
// pour chacun image + badge + nom + butin complet + compétences. Sur un terrain à 4 monstres, chaque
// carte tombait à ~90 px de large — l'information ne pouvait pas y tenir, quelle que soit la finesse du
// calcul. On affiche donc UNE fiche à la fois, dans le format demandé (celui du bestiaire), avec une
// navigation. Ces tests figent les deux propriétés qui rendent le débordement impossible :
//   1. le chrome (sur-titre, rangée du bas) ne mord jamais sur la zone de fiche ;
//   2. la fiche d'UN monstre suffit toujours, ce qui est déjà garanti par bestiary-layout — on le
//      revérifie ici sur les monstres réellement présents dans chaque terrain, boss inclus.

const uniqueMonsters = (levelId: string): MonsterDef[] => {
  const level = LEVELS[levelId]
  const ids: string[] = []
  for (const s of level?.spawns ?? []) if (!ids.includes(s.monsterId)) ids.push(s.monsterId)
  if (level?.boss && !ids.includes(level.boss)) ids.push(level.boss)
  return ids.map((id) => MONSTERS[id]).filter((m): m is MonsterDef => !!m)
}

describe('le chrome laisse la fiche tranquille', () => {
  it('le sur-titre s\'arrête AVANT le haut de la fiche', () => {
    expect(introHeaderBottom()).toBeLessThanOrEqual(CARD.top)
  })

  it('la rangée du bas commence APRÈS le bas de la fiche et reste dans le cadre', () => {
    expect(introNavTop()).toBeGreaterThanOrEqual(CARD.bottom)
    expect(introNavBottom()).toBeLessThanOrEqual(540)
  })

  it('résumé : le chrome dégage la zone de fiche', () => {
    expect(introChromeClears()).toBe(true)
  })

  it('les quatre éléments de la rangée du bas ne se recouvrent PAS', () => {
    const spans = introRowSpans().sort((a, b) => a.l - b.l)
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1]!, cur = spans[i]!
      expect(cur.l, `${prev.name} → ${cur.name}`).toBeGreaterThanOrEqual(prev.r)
    }
  })

  it('la rangée du bas tient dans la largeur de conception', () => {
    for (const s of introRowSpans()) {
      expect(s.l, `${s.name} gauche`).toBeGreaterThanOrEqual(0)
      expect(s.r, `${s.name} droite`).toBeLessThanOrEqual(960)
    }
  })

  it('« Commencer ! » ne peut pas se retrouver sous un bouton de navigation', () => {
    const start = INTRO_ROW.start
    for (const nav of [INTRO_ROW.prev, INTRO_ROW.counter, INTRO_ROW.next]) {
      expect(start.x - start.w / 2).toBeGreaterThanOrEqual(nav.x + nav.w / 2)
    }
    expect(INTRO.navY).toBeGreaterThan(CARD.bottom)
  })
})

describe('chaque monstre de chaque terrain rentre dans sa fiche', () => {
  const levelIds = Object.keys(LEVELS)

  it('il y a bien des terrains à vérifier', () => {
    expect(levelIds.length).toBeGreaterThan(0)
  })

  it('le butin de chaque monstre présenté tient dans la bande', () => {
    const over: string[] = []
    for (const id of levelIds) {
      for (const m of uniqueMonsters(id)) {
        if (!lootFits(m.drops.length)) over.push(`${id}/${m.id} : ${m.drops.length} butins`)
      }
    }
    expect(over, `butin débordant :\n  ${over.join('\n  ')}`).toEqual([])
  })

  it('les compétences de chaque monstre présenté tiennent dans leur quart', () => {
    const over: string[] = []
    for (const id of levelIds) {
      for (const m of uniqueMonsters(id)) {
        const n = (m.skills ?? []).filter((s) => SKILLS[s]).length
        if (n > 0 && !skillsFit(n)) over.push(`${id}/${m.id} : ${n} compétences`)
      }
    }
    expect(over, `compétences débordantes :\n  ${over.join('\n  ')}`).toEqual([])
  })
})
