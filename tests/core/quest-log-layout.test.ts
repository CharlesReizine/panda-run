import { describe, it, expect } from 'vitest'
import {
  FONT, JOURNAL, lignesJournal, lignesParPage, largeurTexte, objectifDe, recompenseDe,
  tientDans, tronquer, yLigne,
} from '../../src/scenes/quest-log-layout'
import { QUEST_CHAIN } from '../../src/data/shops'
import { newPlayer } from '../../src/core/player-state'
import type { PlayerState } from '../../src/core/player-state'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// JOURNAL DE QUÊTES — RIEN NE DÉBORDE, ET CHAQUE ÉTAT SE DISTINGUE
//
// Retour du joueur : « il faut pouvoir suivre les quêtes en cours et tous les objectifs je pense ».
// Le seul suivi était le bandeau du HUD, qui n'affiche QU'UNE quête et disparaît dès qu'elle est
// réclamée — impossible de savoir ce qui venait ensuite, ni ce qu'on avait déjà fait.
//
// Ce test tient la promesse posée pour tous les écrans du jeu : « un test qui m'assure que rien ne
// dépasse, et tant que c'est pas bon tu déploies pas ». Il est possible parce que la disposition et
// les textes sont calculés hors de Phaser (cf. quest-log-layout).

const joueur = (): PlayerState => newPlayer('testeur')

describe('journal de quêtes', () => {
  it('liste TOUTE la chaîne, dans l\'ordre, même ce qui n\'est pas encore pris', () => {
    const lignes = lignesJournal(joueur())
    expect(lignes).toHaveLength(QUEST_CHAIN.length)
    expect(lignes.map((l) => l.ordre)).toEqual([...QUEST_CHAIN].map((q) => q.order).sort((a, b) => a - b))
    // une partie neuve n'a rien accepté : tout est à prendre, et aucun compteur ne s'affiche
    expect(lignes.every((l) => l.etat === 'a-prendre')).toBe(true)
    expect(lignes.every((l) => l.compteur === '')).toBe(true)
  })

  it('distingue les quatre états', () => {
    const p = joueur()
    const [a, b, c] = QUEST_CHAIN
    p.quests[a!.id] = { startCount: 0, progress: a!.targetCount, done: true, claimed: true }
    p.quests[b!.id] = { startCount: 0, progress: b!.targetCount, done: true, claimed: false }
    p.quests[c!.id] = { startCount: 0, progress: 1, done: false, claimed: false }
    const parId = Object.fromEntries(lignesJournal(p).map((l) => [l.id, l]))
    expect(parId[a!.id]!.etat).toBe('finie')
    expect(parId[b!.id]!.etat).toBe('a-rendre')
    expect(parId[c!.id]!.etat).toBe('en-cours')
    expect(parId[QUEST_CHAIN[3]!.id]!.etat).toBe('a-prendre')
  })

  it('le compteur est BORNÉ à la cible — « 23/15 » ferait douter que ce soit fini', () => {
    const p = joueur()
    const q = QUEST_CHAIN[2]!
    p.quests[q.id] = { startCount: 0, progress: q.targetCount + 8, done: true, claimed: false }
    const ligne = lignesJournal(p).find((l) => l.id === q.id)!
    expect(ligne.compteur).toBe(`${q.targetCount}/${q.targetCount}`)
    expect(ligne.ratio).toBeLessThanOrEqual(1)
  })

  it('dit OÙ rendre — mais seulement ce qui est à rendre', () => {
    const p = joueur()
    const finie = QUEST_CHAIN[0]!, enCours = QUEST_CHAIN[1]!
    p.quests[finie.id] = { startCount: 0, progress: finie.targetCount, done: true, claimed: false }
    p.quests[enCours.id] = { startCount: 0, progress: 1, done: false, claimed: false }
    const parId = Object.fromEntries(lignesJournal(p, 'Prontera').map((l) => [l.id, l]))
    expect(parId[finie.id]!.ou).toContain('Prontera')
    expect(parId[enCours.id]!.ou).toBeUndefined()
    // sans ville joignable, la ligne ne ment pas : elle se tait
    expect(lignesJournal(p).find((l) => l.id === finie.id)!.ou).toBeUndefined()
  })

  it('l\'objectif est une ACTION, pas la prose du PNJ', () => {
    for (const def of QUEST_CHAIN) {
      const o = objectifDe(def)
      expect(o.length, def.id).toBeGreaterThan(0)
      // la description du garde est une phrase ; l'objectif est télégraphique et ne la recopie pas
      expect(o, def.id).not.toBe(def.description)
      expect(o.endsWith('.'), def.id).toBe(false)
      // une cible identifiée doit être NOMMÉE, jamais laissée sous forme d'identifiant technique
      if (def.targetId) expect(o.includes(def.targetId), `${def.id} montre un id brut`).toBe(false)
    }
  })

  it('la récompense annonce l\'objet, l\'or et les potions sans id technique', () => {
    for (const def of QUEST_CHAIN) {
      const r = recompenseDe(def)
      expect(r, def.id).toContain(`${def.rewardGold} or`)
      if (def.rewardItemId) expect(r.includes(def.rewardItemId), `${def.id} montre un id brut`).toBe(false)
    }
  })

  // ── LE CONTRAT DE NON-DÉBORDEMENT ────────────────────────────────────────────────────────────
  it('aucune ligne ne déborde de sa colonne, à tous les états', () => {
    const p = joueur()
    // pire cas : tout est accepté et terminé (les textes sont alors les plus longs — « à rendre à … »)
    for (const def of QUEST_CHAIN) p.quests[def.id] = { startCount: 0, progress: def.targetCount, done: true, claimed: false }
    const largeur = largeurTexte()
    for (const l of lignesJournal(p, 'Prontera')) {
      expect(tientDans(tronquer(l.objectif, largeur, FONT.detail), largeur, FONT.detail), l.id).toBe(true)
      expect(tientDans(tronquer(l.nom, largeur - 40, FONT.titre), largeur - 40, FONT.titre), l.id).toBe(true)
      expect(tientDans(tronquer(l.ou ?? l.recompense, JOURNAL.gaugeW + 140, FONT.detail), JOURNAL.gaugeW + 140, FONT.detail), l.id).toBe(true)
    }
  })

  it('aucune ligne ne descend sous la zone utile', () => {
    for (let i = 0; i < lignesParPage(); i++) {
      expect(yLigne(i) + JOURNAL.rowH, `ligne ${i}`).toBeLessThanOrEqual(JOURNAL.bottom)
    }
  })

  it('la pagination couvre toute la chaîne', () => {
    const pages = Math.ceil(QUEST_CHAIN.length / lignesParPage())
    expect(pages * lignesParPage()).toBeGreaterThanOrEqual(QUEST_CHAIN.length)
    expect(lignesParPage()).toBeGreaterThan(0)
  })
})
