// Orchestration de la synchro : la partie IMPURE (I/O, localStorage, réseau). Toute la décision
// vit dans core/sync.ts, qui est pur et testé — ici on ne fait qu'exécuter.
//
// `lastSyncedAt` est stocké dans SA PROPRE clé localStorage, volontairement PAS dans le fichier de
// sauvegarde : il décrit la relation de CET appareil avec le cloud, pas l'état du joueur. Le mettre
// dans la save le ferait voyager avec elle jusqu'au cloud puis jusqu'au second appareil, qui croirait
// alors avoir déjà synchronisé ce qu'il n'a jamais vu — et la détection de divergence tomberait.

import { decideSync, type SyncAction } from '../core/sync'
import { loadStamped, save, onSaved, type StampedSave } from '../core/save'
import { pull, push } from './cloud-save'
import { publish } from './leaderboard'
import { BUILD } from '../core/build'
import type { PlayerState } from '../core/player-state'

const LAST_SYNC_KEY = 'panda-run-last-sync'

// Accès défensif : localStorage est indisponible en navigation privée Safari et en test (env node).
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readLastSyncedAt(): number {
  const s = safeStorage()
  if (!s) return 0
  const raw = s.getItem(LAST_SYNC_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function writeLastSyncedAt(ts: number): void {
  safeStorage()?.setItem(LAST_SYNC_KEY, String(ts))
}

export interface SyncOutcome {
  action: SyncAction
  local: StampedSave | null
  cloud: StampedSave | null
}

// Décide quoi faire, et applique TOUT SAUF le cas ambigu. `demander` est renvoyé tel quel :
// c'est à l'interface de faire trancher le joueur, jamais à ce module de deviner.
export async function syncNow(key: string): Promise<SyncOutcome> {
  const local = loadStamped()
  const cloud = await pull(key)
  const action = decideSync(local, cloud, readLastSyncedAt())

  switch (action) {
    case 'prendre-le-cloud':
      if (cloud) adoptCloud(cloud)
      break
    case 'pousser-le-local':
    case 'garder-le-local':
      if (local) await pushLocal(key, local)
      break
    case 'rien':
      // les deux côtés portent le même état : on note juste le point de synchro
      if (local) writeLastSyncedAt(local.savedAt)
      break
    case 'demander':
      break // décision rendue à l'appelant
  }
  return { action, local, cloud }
}

// Écrit la sauvegarde cloud en local et cale le point de synchro dessus.
export function adoptCloud(cloud: StampedSave): void {
  save(cloud.player, localStorage, cloud.savedAt)
  writeLastSyncedAt(cloud.savedAt)
}

export async function pushLocal(key: string, local: StampedSave): Promise<void> {
  await push(key, local.player, local.savedAt, BUILD)
  writeLastSyncedAt(local.savedAt)
  await publishRank(key, local.player, local.savedAt)
}

// Ligne de classement : la VITRINE (pseudo, niveau, classe), publique en lecture. Séparée de la
// sauvegarde, qui reste privée. Échec silencieux : rater une mise à jour de classement ne doit
// jamais empêcher de jouer ni de sauvegarder.
async function publishRank(key: string, p: PlayerState, at: number): Promise<void> {
  try {
    await publish(key, p.name, p.level, p.classId, at)
  } catch { /* classement indisponible : sans conséquence sur la partie */ }
}

// Écriture en cours de partie : DÉBOUNCÉE et « fire-and-forget ». Le jeu ne doit jamais attendre le
// réseau. Un échec (avion, tunnel) laisse simplement le local en avance : la prochaine synchro le
// verra plus récent que `lastSyncedAt` et le poussera. Rien à rejouer, rien à fusionner — l'état
// complet du joueur est réécrit à chaque fois, le dernier gagne.
let pending: ReturnType<typeof setTimeout> | null = null

// Branche la poussée automatique sur TOUTES les sauvegardes locales, via le crochet onSaved de
// core/save.ts. On s'abonne UNE SEULE FOIS pour la vie de la page et on ne fait ensuite que changer
// l'utilisateur courant — s'abonner à chaque connexion empilerait les écritures.
let autoKey: string | null = null
let attached = false

export function setAutoPushKey(key: string | null): void {
  autoKey = key
  if (attached) return
  attached = true
  onSaved((player, savedAt) => {
    if (autoKey) schedulePush(autoKey, player, savedAt)
  })
}

export function schedulePush(key: string, player: PlayerState, savedAt: number, delayMs = 3000): void {
  if (pending) clearTimeout(pending)
  pending = setTimeout(() => {
    pending = null
    void push(key, player, savedAt, BUILD)
      .then(() => {
        writeLastSyncedAt(savedAt)
        return publishRank(key, player, savedAt)
      })
      .catch(() => { /* hors réseau : le local reste en avance, poussé à la prochaine synchro */ })
  }, delayMs)
}
