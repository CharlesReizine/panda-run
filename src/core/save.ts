import type { PlayerState } from './player-state'

export const SAVE_KEY = 'panda-run-save'
const VERSION = 1

interface SaveFile { version: number; player: PlayerState }

export function serialize(p: PlayerState): string {
  const file: SaveFile = { version: VERSION, player: p }
  return JSON.stringify(file)
}

export function deserialize(json: string): PlayerState {
  const file = JSON.parse(json) as SaveFile
  if (file.version !== VERSION) throw new Error(`version de sauvegarde inconnue : ${file.version}`)
  return file.player
}

export function save(p: PlayerState, storage: Storage = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(p))
}

export function load(storage: Storage = localStorage): PlayerState | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : deserialize(raw)
}
