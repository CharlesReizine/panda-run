import type { PlayerState } from './player-state'
import { START_NODE } from '../data/worldmap'

export const SAVE_KEY = 'panda-run-save'
const VERSION = 9

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
  if (file.version <= 8) {
    // ─── v8 → v9 : INT DEVIENT VIT, ET UNE VRAIE INTELLIGENCE APPARAÎT ────────────────────────
    //
    // ⚠️ CETTE MIGRATION EST OBLIGATOIRE, PAS COSMÉTIQUE. Jusqu'ici « INT » donnait des POINTS DE VIE —
    // un libellé qui mentait sur son effet, et probablement une des raisons pour lesquelles personne n'y
    // touchait. On renomme donc en VIT (vitalité), et INT devient la vraie intelligence : régénération
    // d'énergie, la ressource des compétences.
    //
    // Sans cette étape, les points déjà placés dans `int` changeraient d'effet du jour au lendemain :
    // le joueur perdrait des PV qu'il avait payés, sans rien avoir fait. On DÉPLACE donc l'ancien `int`
    // vers `vit`, et la nouvelle intelligence repart de zéro — personne ne perd ce qu'il a investi.
    const ancien = raw.allocated as unknown as { str?: number; agi?: number; int?: number; vit?: number } | undefined
    pl = {
      ...pl,
      allocated: {
        str: ancien?.str ?? 0,
        agi: ancien?.agi ?? 0,
        vit: ancien?.vit ?? ancien?.int ?? 0,
        int: ancien?.vit === undefined ? 0 : (ancien.int ?? 0),
      },
    }
  }
  return pl
}

// Observateurs notifiés après CHAQUE sauvegarde locale. Un seul consommateur aujourd'hui : la
// synchro cloud, qui pousse l'état en tâche de fond. Ce crochet existe pour ne PAS avoir à greffer
// un appel cloud sur chacun des appels à save() dispersés dans le jeu (fin de terrain, achat,
// level-up, réforge…) — un oubli y serait invisible et ferait silencieusement diverger le cloud.
type SaveListener = (p: PlayerState, savedAt: number) => void
const listeners: SaveListener[] = []

export function onSaved(cb: SaveListener): void {
  listeners.push(cb)
}

export function save(p: PlayerState, storage: Storage = localStorage, savedAt: number = Date.now()): void {
  storage.setItem(SAVE_KEY, serialize(p, savedAt))
  for (const l of listeners) l(p, savedAt)
}

// ⚠️ NI `load` NI `loadStamped` NE LÈVENT JAMAIS, et la garantie est ICI plutôt que chez l'appelant.
// La politique « une sauvegarde illisible est traitée comme absente » était documentée depuis longtemps,
// mais elle n'était appliquée qu'au seul endroit qui y avait pensé : `TitleScene.safeLoad`. Partout
// ailleurs — dont `syncNow`, qui tourne en tâche de fond — un JSON abîmé faisait remonter un SyntaxError.
// Un octet de travers dans le localStorage du téléphone suffisait donc à casser la synchronisation en
// silence. Une sonde l'a relevé : « une sauvegarde corrompue fait PLANTER load() ».
// Corriger à la source vaut mieux que d'espérer que chaque appelant se souvienne d'un try/catch.
/**
 * Une sauvegarde a-t-elle la FORME d'un joueur ? Attraper l'exception ne suffit pas : un JSON
 * parfaitement valide mais de mauvaise forme (`[]`, `null`, un objet d'une version inconnue) traverse la
 * désérialisation sans broncher et ressort en `undefined`, ou pire en `{ player: undefined }` du côté
 * horodaté. L'appelant croit alors tenir une sauvegarde et casse une ligne plus loin, sur
 * `save.player.level`. On vérifie donc le minimum vital dont dépend toute la suite du jeu.
 */
function formeValide(p: unknown): p is PlayerState {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.level === 'number' && Number.isFinite(o.level) && o.level >= 1 && typeof o.classId === 'string'
}

export function load(storage: Storage = localStorage): PlayerState | null {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (raw === null) return null
    const p = deserialize(raw)
    return formeValide(p) ? p : null
  } catch {
    return null
  }
}

// Variante horodatée, pour la synchro cloud (core/sync.ts). Même règle : illisible = absente.
export function loadStamped(storage: Storage = localStorage): StampedSave | null {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (raw === null) return null
    const s = deserializeStamped(raw)
    return s && formeValide(s.player) ? s : null
  } catch {
    return null
  }
}
