import type { PlayerState } from './player-state'
import { START_NODE } from '../data/worldmap'

export const SAVE_KEY = 'panda-run-save'
const VERSION = 7

interface SaveFile { version: number; player: PlayerState }

export function serialize(p: PlayerState): string {
  const file: SaveFile = { version: VERSION, player: p }
  return JSON.stringify(file)
}

export function deserialize(json: string): PlayerState {
  const file = JSON.parse(json) as SaveFile
  if (file.version < 1 || file.version > VERSION) throw new Error(`version de sauvegarde inconnue : ${file.version}`)
  // migrations cumulatives vers la version courante
  const raw = file.player as PlayerState & { unlockedSkills?: string[]; monstersKilled?: number; quests?: PlayerState['quests']; currentNode?: string; statPoints?: number; allocated?: PlayerState['allocated']; upgrades?: PlayerState['upgrades'] }
  let pl: PlayerState = raw
  if (file.version === 1) pl = { ...pl, materials: {} } // v1 → v2 : collection de matériaux
  if (file.version <= 2) {
    // v2 → v3 : les skills débloqués deviennent des rangs (débloqué = rang 1)
    const skillLevels: Record<string, number> = {}
    for (const id of raw.unlockedSkills ?? []) skillLevels[id] = 1
    pl = { ...pl, skillLevels }
    delete (pl as PlayerState & { unlockedSkills?: string[] }).unlockedSkills
  }
  if (file.version <= 3) {
    // v3 → v4 : quêtes de ville (compteur de kills + suivi de progression)
    pl = { ...pl, monstersKilled: raw.monstersKilled ?? 0, quests: raw.quests ?? {} }
  }
  if (file.version <= 4) {
    // v4 → v5 : position courante sur la carte du monde
    pl = { ...pl, currentNode: raw.currentNode ?? START_NODE }
  }
  if (file.version <= 5) {
    // v5 → v6 : répartition de stats (STR/AGI/INT) + points de stat non dépensés
    pl = { ...pl, statPoints: raw.statPoints ?? 0, allocated: raw.allocated ?? { str: 0, agi: 0, int: 0 } }
  }
  if (file.version <= 6) {
    // v6 → v7 : niveaux de réforge par objet
    pl = { ...pl, upgrades: raw.upgrades ?? {} }
  }
  return pl
}

export function save(p: PlayerState, storage: Storage = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(p))
}

export function load(storage: Storage = localStorage): PlayerState | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : deserialize(raw)
}
