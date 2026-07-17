import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { acceptQuest, refreshQuestProgress, claimQuest } from '../../src/core/quests'
import { QUESTS } from '../../src/data/shops'

const QUEST_ID = 'chasse-aux-monstres'

describe('quests', () => {
  it('accepter une quête capture le compteur de départ', () => {
    const p = newPlayer('Panda')
    p.monstersKilled = 3
    acceptQuest(p, QUEST_ID)
    expect(p.quests[QUEST_ID]).toEqual({ startCount: 3, progress: 0, done: false, claimed: false })
  })

  it('accepter une quête déjà acceptée ne réinitialise pas la progression', () => {
    const p = newPlayer('Panda')
    acceptQuest(p, QUEST_ID)
    p.monstersKilled = 5
    refreshQuestProgress(p, QUEST_ID)
    acceptQuest(p, QUEST_ID)
    expect(p.quests[QUEST_ID]!.progress).toBe(5)
  })

  it('la progression ne compte que les kills après acceptation', () => {
    const p = newPlayer('Panda')
    p.monstersKilled = 4
    acceptQuest(p, QUEST_ID)
    p.monstersKilled = 6
    refreshQuestProgress(p, QUEST_ID)
    expect(p.quests[QUEST_ID]!.progress).toBe(2)
    expect(p.quests[QUEST_ID]!.done).toBe(false)
  })

  it('la quête est marquée terminée une fois la cible atteinte', () => {
    const p = newPlayer('Panda')
    acceptQuest(p, QUEST_ID)
    p.monstersKilled = QUESTS[QUEST_ID]!.targetCount
    refreshQuestProgress(p, QUEST_ID)
    expect(p.quests[QUEST_ID]!.done).toBe(true)
  })

  it('réclamer la récompense verse l\'or et marque la quête réclamée', () => {
    const p = newPlayer('Panda')
    acceptQuest(p, QUEST_ID)
    p.monstersKilled = QUESTS[QUEST_ID]!.targetCount
    refreshQuestProgress(p, QUEST_ID)
    const goldBefore = p.gold
    expect(claimQuest(p, QUEST_ID)).toBe(true)
    expect(p.gold).toBe(goldBefore + QUESTS[QUEST_ID]!.rewardGold)
    expect(p.quests[QUEST_ID]!.claimed).toBe(true)
  })

  it('refuse de réclamer une quête non terminée', () => {
    const p = newPlayer('Panda')
    acceptQuest(p, QUEST_ID)
    expect(claimQuest(p, QUEST_ID)).toBe(false)
  })

  it('refuse de réclamer deux fois', () => {
    const p = newPlayer('Panda')
    acceptQuest(p, QUEST_ID)
    p.monstersKilled = QUESTS[QUEST_ID]!.targetCount
    refreshQuestProgress(p, QUEST_ID)
    claimQuest(p, QUEST_ID)
    expect(claimQuest(p, QUEST_ID)).toBe(false)
  })
})
