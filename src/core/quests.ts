import type { PlayerState, QuestState } from './player-state'
import type { QuestDef } from '../data/shops'
import { QUESTS, QUEST_CHAIN } from '../data/shops'

// Compteur de départ capturé à l'acceptation, selon le type de quête : seule la progression
// RÉALISÉE APRÈS l'acceptation compte (des kills antérieurs ne valident pas la quête). Le fetch
// n'a pas de snapshot — il lit directement la quantité de matériaux détenue.
function baseline(p: PlayerState, def: QuestDef): number {
  switch (def.type) {
    case 'kill-any':
      return p.monstersKilled
    case 'kill-type':
    case 'kill-boss':
      return p.killsByMonster[def.targetId!] ?? 0
    case 'fetch':
      return 0
  }
}

// Progression courante (non bornée) d'une quête acceptée.
function currentProgress(p: PlayerState, def: QuestDef, q: QuestState): number {
  switch (def.type) {
    case 'kill-any':
      return p.monstersKilled - q.startCount
    case 'kill-type':
    case 'kill-boss':
      return (p.killsByMonster[def.targetId!] ?? 0) - q.startCount
    case 'fetch':
      return p.materials[def.targetId!] ?? 0
  }
}

// Accepte une quête : capture le point de départ adapté à son type.
export function acceptQuest(p: PlayerState, questId: string): void {
  if (p.quests[questId]) return // déjà acceptée
  const def = QUESTS[questId]
  if (!def) return
  p.quests[questId] = { startCount: baseline(p, def), progress: 0, done: false, claimed: false }
}

// Recalcule la progression d'une quête acceptée à partir des compteurs / de l'inventaire courants.
export function refreshQuestProgress(p: PlayerState, questId: string): void {
  const q = p.quests[questId]
  const def = QUESTS[questId]
  if (!q || !def || q.claimed) return
  q.progress = Math.min(def.targetCount, Math.max(0, currentProgress(p, def, q)))
  q.done = q.progress >= def.targetCount
}

// Réclame la récompense d'une quête terminée. Pour un fetch, re-vérifie la possession puis CONSOMME
// les N matériaux. Verse l'or, les potions et l'objet éventuels. Renvoie false si non réclamable.
export function claimQuest(p: PlayerState, questId: string): boolean {
  const q = p.quests[questId]
  const def = QUESTS[questId]
  if (!q || !def || !q.done || q.claimed) return false
  if (def.type === 'fetch') {
    const have = p.materials[def.targetId!] ?? 0
    if (have < def.targetCount) return false // les objets ont été dépensés entre-temps
    p.materials[def.targetId!] = have - def.targetCount
  }
  q.claimed = true
  p.gold += def.rewardGold
  if (def.rewardPotions) p.potions += def.rewardPotions
  if (def.rewardItemId) p.inventory.push(def.rewardItemId)
  return true
}

// Prochaine quête de la chaîne proposée par le garde : la première (dans l'ordre) qui n'a pas
// encore été réclamée. Renvoie null quand toute la chaîne est accomplie.
export function currentChainQuest(p: PlayerState): QuestDef | null {
  for (const def of QUEST_CHAIN) {
    const q = p.quests[def.id]
    if (!q || !q.claimed) return def
  }
  return null
}
