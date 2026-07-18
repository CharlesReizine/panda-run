// Overlay en DOM PUR (surtout pas Phaser) : si la boucle Phaser est morte, un overlay
// rendu par Phaser ne s'afficherait jamais. Le DOM natif, lui, reste toujours vivant.
import { getLogs, type LogEntry } from '../core/logger'

const OVERLAY_ID = 'panda-error-overlay'

// Idempotent : un seul <div> plein écran, créé une fois puis réutilisé.
function ensureOverlay(): HTMLDivElement {
  const found = document.getElementById(OVERLAY_ID) as HTMLDivElement | null
  if (found) return found
  const el = document.createElement('div')
  el.id = OVERLAY_ID
  Object.assign(el.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647',
    background: 'rgba(60,0,0,0.94)', color: '#ffffff',
    font: '13px/1.45 ui-monospace, Menlo, Consolas, monospace',
    padding: '16px', boxSizing: 'border-box', overflow: 'auto', display: 'none',
    pointerEvents: 'auto', WebkitOverflowScrolling: 'touch',
  } as Partial<CSSStyleDeclaration>)
  document.body.appendChild(el)
  return el
}

function mkButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  Object.assign(b.style, {
    padding: '8px 14px', fontSize: '14px', fontWeight: 'bold',
    background: '#ffffff', color: '#3c0000', border: 'none',
    borderRadius: '8px', cursor: 'pointer',
  } as Partial<CSSStyleDeclaration>)
  b.addEventListener('click', onClick)
  return b
}

function render(title: string, detail: string, extra?: HTMLButtonElement[]): void {
  const el = ensureOverlay()
  el.textContent = ''
  el.style.display = 'block'
  el.scrollTop = 0

  const bar = document.createElement('div')
  Object.assign(bar.style, {
    display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px',
    position: 'sticky', top: '0', paddingBottom: '8px',
  } as Partial<CSSStyleDeclaration>)

  const copyBtn = mkButton('Copier', () => {
    const text = `${title}\n\n${detail}`
    try {
      void navigator.clipboard?.writeText(text).then(() => { copyBtn.textContent = 'Copié !' }).catch(() => {})
    } catch { /* clipboard indisponible : sans importance */ }
  })
  bar.append(copyBtn, mkButton('Fermer', hideOverlay))
  if (extra) for (const b of extra) bar.append(b)

  const h = document.createElement('div')
  h.textContent = title
  Object.assign(h.style, { fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' } as Partial<CSSStyleDeclaration>)

  const body = document.createElement('pre')
  body.textContent = detail
  Object.assign(body.style, { margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } as Partial<CSSStyleDeclaration>)

  el.append(bar, h, body)
}

export function showErrorOverlay(title: string, detail: string): void {
  if (typeof document === 'undefined') return
  render(title, detail)
}

export function hideOverlay(): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(OVERLAY_ID)
  if (el) el.style.display = 'none'
}

function fmt(e: LogEntry): string {
  const tail = e.stack ? `\n${e.stack}` : ''
  return `[${e.level.toUpperCase()}] ${e.tag} @${Math.round(e.t)}\n${e.msg}${tail}`
}

// Écran de consultation des logs (lisible sur iPhone, sans ordinateur).
export function showLogsOverlay(): void {
  if (typeof document === 'undefined') return
  const logs = getLogs()
  const detail = logs.length ? logs.map(fmt).join('\n\n') : '(aucun log)'
  render(`Logs (${logs.length})`, detail)
}
