import type { PlayerState } from './player-state'
import { QUESTS } from '../data/shops'

// Accepte une quête : capture le compteur courant comme point de départ, pour que seule
// la progression réalisée APRÈS acceptation compte (des kills antérieurs ne la valident pas).
export function acceptQuest(p: PlayerState, questId: string): void {
  if (p.quests[questId]) return // déjà acceptée
  p.quests[questId] = { startCount: p.monstersKilled, progress: 0, done: false, claimed: false }
}

// Recalcule la progression d'une quête acceptée à partir des compteurs courants du joueur.
export function refreshQuestProgress(p: PlayerState, questId: string): void {
  const q = p.quests[questId]
  const def = QUESTS[questId]
  if (!q || !def || q.claimed) return
  q.progress = Math.min(def.targetCount, p.monstersKilled - q.startCount)
  q.done = q.progress >= def.targetCount
}

// Réclame la récompense d'une quête terminée ; renvoie false si elle n'est pas prête/déjà réclamée.
export function claimQuest(p: PlayerState, questId: string): boolean {
  const q = p.quests[questId]
  const def = QUESTS[questId]
  if (!q || !def || !q.done || q.claimed) return false
  q.claimed = true
  p.gold += def.rewardGold
  return true
}
