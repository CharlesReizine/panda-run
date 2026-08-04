import type { PlayerState, QuestState } from './player-state'
import type { QuestDef } from '../data/shops'
import { QUESTS, QUEST_CHAIN } from '../data/shops'
import { grantXp, xpToNext } from './progression'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'XP DE QUÊTE EST DÉRIVÉE DE LA COURBE, PAS ÉCRITE EN DUR
//
// Retour joueur : « là le jeu incite pas trop à les faire. et faudrait gagner de l'xpppp ». Il avait
// raison au pied de la lettre : `claimQuest` versait de l'or, des potions et un objet — et ZÉRO XP. Une
// quête ne faisait donc pas progresser, alors que farmer trois minutes, si.
//
// On l'exprime en PART DE NIVEAU et non en nombre d'XP : un nombre en dur vaudrait un demi-niveau au
// début et trois miettes à la fin, et il faudrait le réviser à chaque retouche de `xpToNext` (dont le
// coefficient a déjà bougé deux fois). Une part de niveau reste juste pour toujours.
//
// Une quête de CHASSE vaut un demi-niveau ; une quête de BOSS un niveau plein — c'est le seul type qui
// demande d'aller battre quelque chose d'unique. La part se calcule sur le niveau AU MOMENT de réclamer :
// une quête faite tard rapporte plus en valeur absolue, mais toujours autant en progression ressentie.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const PART_DE_NIVEAU: Record<QuestDef['type'], number> = {
  'kill-any': 0.5,
  'kill-type': 0.5,
  'fetch': 0.5,
  'kill-boss': 1,
}

/** XP que rapporterait cette quête si elle était réclamée MAINTENANT (sert aussi à l'affichage). */
export function questXpReward(p: PlayerState, def: QuestDef): number {
  return Math.max(1, Math.floor(xpToNext(p.level) * PART_DE_NIVEAU[def.type]))
}

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
  // L'XP EN DERNIER, et via `grantXp` : c'est lui qui gère les montées de niveau (points de compétence
  // et de statistique inclus). L'ajouter à la main à `p.xp` laisserait le joueur au-dessus du palier sans
  // jamais passer le niveau — un bug silencieux, et une progression qui semble se perdre.
  grantXp(p, questXpReward(p, def))
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
