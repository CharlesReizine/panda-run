import type { PlayerState } from './core/player-state'

let current: PlayerState | null = null

export function setPlayer(p: PlayerState): void { current = p }

export function getPlayer(): PlayerState {
  if (!current) throw new Error('aucun joueur chargé')
  return current
}
