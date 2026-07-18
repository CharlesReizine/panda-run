// Logger pur et persistant, SANS aucune dépendance Phaser (testable en isolation).
// Sur mobile il n'y a pas de console : on garde les N derniers évènements en mémoire ET
// dans localStorage pour que l'utilisateur puisse les relire via l'écran « Logs ».

export type LogLevel = 'error' | 'warn' | 'info'

export interface LogEntry {
  t: number
  level: LogLevel
  tag: string
  msg: string
  stack?: string
}

const MAX_ENTRIES = 100
const STORAGE_KEY = 'panda-run-logs'
const MAX_BYTES = 64 * 1024

// Ring buffer en mémoire : au-delà de MAX_ENTRIES, la plus vieille entrée est éjectée.
let buffer: LogEntry[] = []

// Accès localStorage défensif : indisponible en test (env node) ou en navigation privée Safari.
function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

// Recharge le buffer depuis la session précédente au premier import.
function hydrate(): void {
  const s = safeStorage()
  if (!s) return
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as LogEntry[]
    if (Array.isArray(parsed)) buffer = parsed.slice(-MAX_ENTRIES)
  } catch { /* JSON corrompu : on repart d'un buffer vide */ }
}

function persist(): void {
  const s = safeStorage()
  if (!s) return
  try {
    // On tronque tant que la sérialisation dépasse ~64KB (quota localStorage souvent réduit).
    let slice = buffer
    let json = JSON.stringify(slice)
    while (json.length > MAX_BYTES && slice.length > 1) {
      slice = slice.slice(Math.ceil(slice.length / 2))
      json = JSON.stringify(slice)
    }
    s.setItem(STORAGE_KEY, json)
  } catch { /* quota dépassé / Safari privé : on conserve au moins le buffer mémoire */ }
}

// Pose le dernier crash sur window pour un futur bot headless (garde-fou si window absent).
function setLastError(entry: LogEntry): void {
  if (typeof window === 'undefined') return
  try {
    ;(window as unknown as { __pandaLastError?: LogEntry }).__pandaLastError = entry
  } catch { /* environnement figé : sans importance */ }
}

// `t` est injectable pour les tests ; en runtime on tolère Date.now() par défaut.
export function logEvent(level: LogLevel, tag: string, msg: string, stack?: string, t: number = Date.now()): void {
  const entry: LogEntry = { t, level, tag, msg }
  if (stack) entry.stack = stack
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES)
  if (level === 'error') setLastError(entry)
  persist()
}

export function logError(tag: string, err: unknown, t: number = Date.now()): void {
  if (err instanceof Error) {
    logEvent('error', tag, err.message, err.stack, t)
  } else {
    logEvent('error', tag, String(err), undefined, t)
  }
}

export function getLogs(): LogEntry[] {
  return buffer.slice()
}

export function clearLogs(): void {
  buffer = []
  const s = safeStorage()
  if (!s) return
  try { s.removeItem(STORAGE_KEY) } catch { /* sans importance */ }
}

// Crochet de lecture pour un futur bot headless : window.__pandaLog() renvoie les logs.
if (typeof window !== 'undefined') {
  try {
    ;(window as unknown as { __pandaLog?: typeof getLogs }).__pandaLog = getLogs
  } catch { /* environnement figé : sans importance */ }
}

hydrate()
