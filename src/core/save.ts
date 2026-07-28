import type { PlayerState } from './player-state'
import { START_NODE } from '../data/worldmap'

export const SAVE_KEY = 'panda-run-save'
const VERSION = 8

// `savedAt` (epoch ms) décrit le FICHIER, pas le joueur → il vit dans l'enveloppe, pas dans
// PlayerState. Il sert à comparer la sauvegarde locale à la sauvegarde cloud (cf. core/sync.ts) :
// sans lui, impossible de savoir laquelle est la plus récente, ni si les deux ont divergé.
//
// ⚠️ AUCUN BUMP DE VERSION pour ce champ, et c'est VOLONTAIRE. `deserialize` rejette
// `version > VERSION` : une save écrite en v9 serait illisible par une build encore en cache sur le
// téléphone (elle la traiterait comme absente → « j'ai perdu ma partie », précisément ce qu'on veut
// éviter). Un champ OPTIONNEL ajouté à l'enveloppe est ignoré sans bruit par les anciennes builds :
// compatible dans les deux sens, aucune porte à sens unique. Ne bumper que pour un changement de
// forme de PlayerState, qui exige une migration.
interface SaveFile { version: number; player: PlayerState; savedAt?: number }

// Sauvegarde + son horodatage. `savedAt` vaut 0 pour un fichier d'avant la version 9 : il passe
// alors toujours pour le plus ancien, ce qui est le comportement voulu (le cloud fait foi).
export interface StampedSave { player: PlayerState; savedAt: number }

// L'horloge est un PARAMÈTRE (et non un Date.now() en dur) pour que la sérialisation reste
// déterministe et testable.
export function serialize(p: PlayerState, savedAt: number = Date.now()): string {
  const file: SaveFile = { version: VERSION, player: p, savedAt }
  return JSON.stringify(file)
}

export function deserializeStamped(json: string): StampedSave {
  const savedAt = (JSON.parse(json) as SaveFile).savedAt ?? 0
  return { player: deserialize(json), savedAt }
}

export function deserialize(json: string): PlayerState {
  const file = JSON.parse(json) as SaveFile
  if (file.version < 1 || file.version > VERSION) throw new Error(`version de sauvegarde inconnue : ${file.version}`)
  // migrations cumulatives vers la version courante
  const raw = file.player as PlayerState & { unlockedSkills?: string[]; monstersKilled?: number; quests?: PlayerState['quests']; currentNode?: string; statPoints?: number; allocated?: PlayerState['allocated']; upgrades?: PlayerState['upgrades']; killsByMonster?: PlayerState['killsByMonster'] }
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
  if (file.version <= 7) {
    // v7 → v8 : suivi des kills par type de monstre (découverte au Bestiaire)
    pl = { ...pl, killsByMonster: raw.killsByMonster ?? {} }
  }
  return pl
}

export function save(p: PlayerState, storage: Storage = localStorage, savedAt: number = Date.now()): void {
  storage.setItem(SAVE_KEY, serialize(p, savedAt))
}

export function load(storage: Storage = localStorage): PlayerState | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : deserialize(raw)
}

// Variante horodatée, pour la synchro cloud (core/sync.ts).
export function loadStamped(storage: Storage = localStorage): StampedSave | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : deserializeStamped(raw)
}
