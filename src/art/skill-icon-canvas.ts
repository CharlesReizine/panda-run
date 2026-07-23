// Rendu VECTORIEL des icônes de sorts (Canvas 2D) — remplace les glyphes procéduraux plats de
// PreloadScene par des icônes SOIGNÉES : cadre biseauté à dégradé radial + liseré coloré lumineux,
// glyphe en matière (dégradé clair→teinte + reflet blanc + ombre douce). Rendu à 2× (88px) pour la
// netteté, affiché à 44px. Synchrone et fiable (le loader SVG inline de Phaser 4 est capricieux) — la
// qualité visuelle est celle d'un SVG (courbes de Bézier, dégradés, halo).

export const ICON = 44 // taille logique
const S = 2            // suréchantillonnage → canvas 88×88

// ── couleurs ──────────────────────────────────────────────────────────────────────────────────
function rgb(hex: number): [number, number, number] { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255] }
function str(r: number, g: number, b: number, a = 1): string { return `rgba(${r | 0},${g | 0},${b | 0},${a})` }
function lighten(hex: number, t: number): string { const [r, g, b] = rgb(hex); return str(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t) }
function darken(hex: number, t: number): string { const [r, g, b] = rgb(hex); return str(r * (1 - t), g * (1 - t), b * (1 - t)) }
function solid(hex: number, a = 1): string { const [r, g, b] = rgb(hex); return str(r, g, b, a) }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// matière du glyphe : dégradé vertical teinte claire → teinte de base (relief)
function ink(ctx: CanvasRenderingContext2D, color: number, y0 = 6, y1 = 38): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, lighten(color, 0.45))
  g.addColorStop(1, solid(color))
  return g
}
const STEEL = 0xcfd8dc, GUARD = 0x8d6e63, WHITE = 0xffffff

// ── cadre commun ─────────────────────────────────────────────────────────────────────────────
function badge(ctx: CanvasRenderingContext2D, color: number) {
  // fond : dégradé radial slate (centre plus clair)
  const bg = ctx.createRadialGradient(22, 18, 4, 22, 24, 30)
  bg.addColorStop(0, '#2a3946')
  bg.addColorStop(1, '#141c25')
  roundRect(ctx, 1, 1, 42, 42, 9); ctx.fillStyle = bg; ctx.fill()
  // halo coloré interne (bas) pour ancrer la teinte
  const glow = ctx.createRadialGradient(22, 40, 2, 22, 40, 26)
  glow.addColorStop(0, solid(color, 0.28)); glow.addColorStop(1, solid(color, 0))
  roundRect(ctx, 1, 1, 42, 42, 9); ctx.fillStyle = glow; ctx.fill()
  // gloss du haut
  ctx.save(); roundRect(ctx, 1, 1, 42, 42, 9); ctx.clip()
  const gloss = ctx.createLinearGradient(0, 2, 0, 22)
  gloss.addColorStop(0, 'rgba(255,255,255,0.16)'); gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss; ctx.fillRect(2, 2, 40, 20); ctx.restore()
  // liseré coloré lumineux
  roundRect(ctx, 2, 2, 40, 40, 8)
  ctx.lineWidth = 2; ctx.strokeStyle = lighten(color, 0.2)
  ctx.shadowColor = solid(color, 0.9); ctx.shadowBlur = 4; ctx.stroke()
  ctx.shadowBlur = 0
}

// ── primitives de glyphe ────────────────────────────────────────────────────────────────────
function blade(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: number, w = 4.5) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = solid(color, 0.35); ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke() // ombre
  const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, darken(color, 0.15)); g.addColorStop(1, lighten(color, 0.5))
  ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke() // fil
  ctx.restore()
}
function guard(ctx: CanvasRenderingContext2D, cx: number, cy: number, a = 6) {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = solid(GUARD); ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(cx - a, cy + a); ctx.lineTo(cx + a, cy - a); ctx.stroke(); ctx.restore()
}
function tri(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, fill: string) {
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
}
function arrowhead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, color: number, s = 6) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang)
  tri(ctx, 0, 0, -s, -s * 0.6, -s, s * 0.6, lighten(color, 0.3)); ctx.restore()
}
function arrowShaft(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: number, w = 3) {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = solid(color); ctx.lineWidth = w
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  arrowhead(ctx, x1, y1, Math.atan2(y1 - y0, x1 - x0), color, w + 3); ctx.restore()
}
function flame(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, wdt: number) {
  const outer = ctx.createLinearGradient(0, base, 0, base - h)
  outer.addColorStop(0, '#ff7043'); outer.addColorStop(1, '#ffca28')
  ctx.beginPath(); ctx.moveTo(x - wdt, base)
  ctx.quadraticCurveTo(x - wdt, base - h * 0.6, x - wdt * 0.3, base - h * 0.55)
  ctx.quadraticCurveTo(x - wdt * 0.5, base - h * 0.85, x, base - h)
  ctx.quadraticCurveTo(x + wdt * 0.5, base - h * 0.85, x + wdt * 0.3, base - h * 0.55)
  ctx.quadraticCurveTo(x + wdt, base - h * 0.6, x + wdt, base)
  ctx.closePath(); ctx.fillStyle = outer; ctx.fill()
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x - wdt * 0.4, base - h * 0.45, x, base - h * 0.62)
  ctx.quadraticCurveTo(x + wdt * 0.4, base - h * 0.45, x, base); ctx.closePath(); ctx.fillStyle = '#fff3c0'; ctx.fill()
}
function orb(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: number) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.2, cx, cy, r)
  g.addColorStop(0, lighten(color, 0.6)); g.addColorStop(0.6, solid(color)); g.addColorStop(1, darken(color, 0.25))
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
  ctx.beginPath(); ctx.arc(cx - r * 0.32, cy - r * 0.38, r * 0.28, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
}
function stroke(ctx: CanvasRenderingContext2D, color: number, w: number, a = 1, glow = false) {
  ctx.strokeStyle = solid(color, a); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (glow) { ctx.shadowColor = solid(color, 0.8); ctx.shadowBlur = 3 } else ctx.shadowBlur = 0
}
function chevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: number, up = true) {
  stroke(ctx, color, 3.4, 1, true)
  ctx.beginPath()
  if (up) { ctx.moveTo(cx - 7, cy + 4); ctx.lineTo(cx, cy - 5); ctx.lineTo(cx + 7, cy + 4) }
  else { ctx.moveTo(cx - 7, cy - 4); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx + 7, cy - 4) }
  ctx.stroke(); ctx.shadowBlur = 0
}
function spark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: number) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = lighten(color, 0.5); ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill()
}
function heartShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: number) {
  const g = ctx.createLinearGradient(0, cy - s, 0, cy + s); g.addColorStop(0, lighten(color, 0.4)); g.addColorStop(1, solid(color))
  ctx.beginPath(); ctx.moveTo(cx, cy + s)
  ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.3, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35)
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.3, cx, cy + s)
  ctx.closePath(); ctx.fillStyle = g; ctx.fill()
  ctx.beginPath(); ctx.arc(cx - s * 0.4, cy - s * 0.35, s * 0.22, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
}

// ── glyphes ───────────────────────────────────────────────────────────────────────────────────
function glyph(ctx: CanvasRenderingContext2D, kind: string, color: number) {
  const cx = 22, cy = 22
  switch (kind) {
    case 'sword':
      blade(ctx, 13, 31, 31, 13, STEEL); guard(ctx, 14, 30); break
    case 'thrust':
      blade(ctx, cx, 33, cx, 7, STEEL); ctx.save(); stroke(ctx, GUARD, 3); ctx.beginPath(); ctx.moveTo(cx - 6, 27); ctx.lineTo(cx + 6, 27); ctx.stroke(); ctx.restore(); break
    case 'swordthrow':
      blade(ctx, 11, 26, 31, 17, STEEL); stroke(ctx, color, 2, 0.6); ctx.beginPath(); ctx.arc(22, 22, 15, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke(); break
    case 'swordx':
      blade(ctx, 12, 32, 32, 12, color); blade(ctx, 12, 12, 32, 32, color); spark(ctx, cx, cy, 3, color); break
    case 'flamesword':
      blade(ctx, 12, 32, 30, 14, STEEL); flame(ctx, 25, 22, 15, 5); flame(ctx, 30, 18, 12, 4); break
    case 'doublestrike':
      blade(ctx, 9, 27, 25, 9, color, 3); blade(ctx, 15, 31, 31, 13, color, 3); spark(ctx, 25, 9, 2, color); spark(ctx, 31, 13, 2, color); break
    case 'paw': {
      const g = ctx.createRadialGradient(cx - 2, cy + 1, 2, cx, cy + 3, 9); g.addColorStop(0, lighten(color, 0.4)); g.addColorStop(1, solid(color))
      ctx.beginPath(); ctx.arc(cx, cy + 4, 8, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
      for (const [dx, dy] of [[-7, -6], [0, -8], [7, -6]] as const) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 3, 0, Math.PI * 2); ctx.fillStyle = solid(color); ctx.fill() }
      break }
    case 'heart': heartShape(ctx, cx, cy, 11, color); break
    case 'regen':
      heartShape(ctx, cx, cy, 11, color); arrowShaft(ctx, cx, cy + 7, cx, cy - 9, WHITE, 2.5); break
    case 'cross': {
      const g = ink(ctx, color, 10, 34)
      ctx.fillStyle = g; roundRect(ctx, cx - 4, cy - 12, 8, 24, 2); ctx.fill(); roundRect(ctx, cx - 12, cy - 4, 24, 8, 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, cx - 3, cy - 11, 3, 22, 1); ctx.fill(); break }
    case 'bamboo':
      ctx.fillStyle = ink(ctx, 0x8bc34a, 8, 36); roundRect(ctx, cx - 3, 8, 6, 28, 3); ctx.fill()
      stroke(ctx, 0x33691e, 2); ctx.beginPath(); ctx.moveTo(cx - 3, 18); ctx.lineTo(cx + 3, 18); ctx.moveTo(cx - 3, 27); ctx.lineTo(cx + 3, 27); ctx.stroke(); break
    case 'bamboothrow':
      stroke(ctx, color, 2, 0.5); ctx.beginPath(); ctx.arc(cx, cy + 11, 13, Math.PI * 1.1, Math.PI * 1.92); ctx.stroke()
      blade(ctx, cx + 3, cy - 3, cx + 13, cy - 12, 0x9ccc65, 4); arrowhead(ctx, cx + 15, cy - 14, -Math.PI / 4, 0x9ccc65, 6); break
    case 'bambooarrow':
      arrowShaft(ctx, 8, 30, 26, 12, 0x8bc34a, 4)
      stroke(ctx, 0x33691e, 1.4); for (let i = 1; i < 4; i++) { const t = i / 4; ctx.beginPath(); ctx.moveTo(8 + t * 18 - 1.5, 30 - t * 18 - 1.5); ctx.lineTo(8 + t * 18 + 1.5, 30 - t * 18 + 1.5); ctx.stroke() } break
    case 'tornado':
      stroke(ctx, color, 3, 1, true); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, 13 + i * 8, 12 - i * 3.2, 0, Math.PI); ctx.stroke() } ctx.shadowBlur = 0; break
    case 'dash':
      blade(ctx, 15, 30, 31, 14, color, 4); stroke(ctx, color, 2, 0.55); ctx.beginPath(); ctx.moveTo(7, 20); ctx.lineTo(16, 20); ctx.moveTo(7, 26); ctx.lineTo(14, 26); ctx.stroke(); break
    case 'jump':
      chevron(ctx, cx, 16, color); chevron(ctx, cx, 26, color); stroke(ctx, 0xe1f5fe, 2, 0.7); ctx.beginPath(); ctx.moveTo(15, 37); ctx.lineTo(19, 37); ctx.moveTo(25, 37); ctx.lineTo(29, 37); ctx.stroke(); break
    case 'swift': case 'reflex-chevrons':
      for (let i = 0; i < 3; i++) { stroke(ctx, color, 3, 0.5 + i * 0.25, true); ctx.beginPath(); const ox = 11 + i * 7; ctx.moveTo(ox, 14); ctx.lineTo(ox + 7, cy); ctx.lineTo(ox, 30); ctx.stroke() } ctx.shadowBlur = 0; break
    case 'leap':
      stroke(ctx, color, 2, 0.5); ctx.beginPath(); ctx.arc(cx, cy + 12, 13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); chevron(ctx, cx, cy - 2, color); spark(ctx, cx + 12, cy - 3, 2, color); break
    case 'shout': case 'roar': {
      ctx.fillStyle = ink(ctx, color, 14, 30); tri(ctx, 12, 15, 12, 29, 23, 22, ink(ctx, color, 14, 30) as unknown as string)
      stroke(ctx, color, 2.2, 1, true); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(24, 22, 4 + i * 5, -0.7, 0.7); ctx.stroke() } ctx.shadowBlur = 0; break }
    case 'target': case 'devotion':
      stroke(ctx, color, 2.2, 1, true); ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; spark(ctx, cx, cy, 3, color); break
    case 'fireball':
      orb(ctx, cx, cy + 3, 9, 0xff7043); flame(ctx, cx, cy - 3, 12, 5); break
    case 'firearrow':
      arrowShaft(ctx, 12, 32, 30, 14, color, 3); flame(ctx, 14, 32, 12, 4); break
    case 'bolt': {
      const pts = [[24, 7], [15, 24], [22, 24], [18, 37], [31, 19], [23, 19]] as const
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
      const g = ctx.createLinearGradient(0, 7, 0, 37); g.addColorStop(0, lighten(color, 0.55)); g.addColorStop(1, solid(color))
      ctx.shadowColor = solid(color, 0.9); ctx.shadowBlur = 5; ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.stroke(); break }
    case 'snow':
      stroke(ctx, color, 2.2, 1, true); for (let a = 0; a < 6; a++) { const r = (a * 60) * Math.PI / 180; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(r) * 13, cy + Math.sin(r) * 13); ctx.stroke() } ctx.shadowBlur = 0; spark(ctx, cx, cy, 2.4, color); break
    case 'blizzard':
      stroke(ctx, color, 2, 0.9, true); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, 5 + i * 4, 0.35, 3.6); ctx.stroke() } ctx.shadowBlur = 0
      for (const [ax, ay] of [[-8, -6], [7, -4], [-5, 7], [9, 6], [0, -9]] as const) spark(ctx, cx + ax, cy + ay, 1.8, color); break
    case 'star': case 'arcane':
      spark(ctx, cx, cy, 4, color); for (const [x, y] of [[14, 14], [30, 16], [28, 30], [15, 29]] as const) spark(ctx, x, y, 2, 0xfff59d); break
    case 'arrow': arrowShaft(ctx, 12, 32, 32, 12, color, 3.2); break
    case 'arrow2': arrowShaft(ctx, 10, 30, 28, 12, color, 2.6); arrowShaft(ctx, 16, 34, 34, 16, color, 2.6); break
    case 'rain':
      for (const dx of [-9, 0, 9]) { const g = ctx.createLinearGradient(0, 12, 0, 34); g.addColorStop(0, lighten(color, 0.4)); g.addColorStop(1, solid(color)); tri(ctx, cx + dx - 3, 12, cx + dx + 3, 12, cx + dx, 34, g as unknown as string) } break
    case 'volley':
      for (const ang of [-28, 0, 28]) { const r = ang * Math.PI / 180; arrowShaft(ctx, cx - Math.cos(r) * 10, cy - 5 - Math.sin(r) * 10, cx + Math.cos(r) * 13, cy - 5 + Math.sin(r) * 13, color, 2.2) } break
    case 'quickshot':
      arrowShaft(ctx, 11, 27, 26, 12, color, 2.4); stroke(ctx, color, 2, 0.5); ctx.beginPath(); ctx.moveTo(6, 32); ctx.lineTo(15, 23); ctx.stroke(); break
    case 'lob':
      stroke(ctx, color, 2, 0.7); ctx.beginPath(); ctx.arc(cx, 30, 14, Math.PI, Math.PI * 2); ctx.stroke(); orb(ctx, cx + 14, 30, 3.4, color); ctx.fillStyle = solid(color, 0.4); ctx.beginPath(); ctx.arc(cx - 14, 30, 2.4, 0, 7); ctx.fill(); break
    case 'bowdraw':
      stroke(ctx, color, 3, 1, true); ctx.beginPath(); ctx.arc(14, cy, 12, -1.2, 1.2); ctx.stroke(); ctx.shadowBlur = 0
      stroke(ctx, 0xcfd8dc, 1.4); ctx.beginPath(); ctx.moveTo(18, cy - 11); ctx.lineTo(14, cy); ctx.lineTo(18, cy + 11); ctx.stroke(); arrowShaft(ctx, 14, cy, 32, cy, color, 2.4); break
    case 'homingarrow':
      arrowShaft(ctx, 14, 26, 29, 11, color, 3); ctx.fillStyle = solid(color, 0.6); for (let i = 0; i < 4; i++) { const t = i / 4; ctx.beginPath(); ctx.arc(6 + t * 8, 30 - Math.sin(t * Math.PI) * 8, 1.6, 0, 7); ctx.fill() } break
    case 'deatharrow':
      arrowShaft(ctx, 6, 28, 20, 14, color, 3); ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(26, 11, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(24, 10, 1.3, 0, 7); ctx.arc(28, 10, 1.3, 0, 7); ctx.fill(); ctx.fillRect(24.5, 13, 3, 2); break
    case 'exploarrow':
      arrowShaft(ctx, 8, 30, 25, 13, color, 3); stroke(ctx, 0xffca28, 2, 1, true); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(26 + Math.cos(a) * 3, 12 + Math.sin(a) * 3); ctx.lineTo(26 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5); ctx.stroke() } ctx.shadowBlur = 0; break
    case 'boomarrow':
      stroke(ctx, color, 2, 0.8); ctx.beginPath(); ctx.arc(cx, 24, 13, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); spark(ctx, cx + 13, 26, 4, 0xffe082); break
    case 'grenade': {
      orb(ctx, cx, cy + 5, 9, 0x6b8e23)
      stroke(ctx, 0x33450f, 1); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - 7, cy + 5 + i * 4); ctx.lineTo(cx + 7, cy + 5 + i * 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + i * 4, cy - 2); ctx.lineTo(cx + i * 4, cy + 12); ctx.stroke() }
      ctx.fillStyle = '#9e9e9e'; roundRect(ctx, cx - 4, cy - 8, 8, 4, 1); ctx.fill(); stroke(ctx, 0xbdbdbd, 2); ctx.beginPath(); ctx.moveTo(cx - 4, cy - 7); ctx.lineTo(cx - 11, cy - 10); ctx.stroke(); stroke(ctx, 0xffca28, 1.5); ctx.beginPath(); ctx.arc(cx - 12, cy - 11, 2.5, 0, 7); ctx.stroke(); break }
    case 'gatling':
      stroke(ctx, color, 2, 1, true); ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.stroke(); ctx.shadowBlur = 0
      orb(ctx, cx, cy, 3.4, color); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; orb(ctx, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 2.3, color) } break
    case 'talon':
      stroke(ctx, color, 3, 1, true); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 5, 10); ctx.lineTo(cx + i * 5 + 3, 26); ctx.stroke() } ctx.shadowBlur = 0
      for (let i = -1; i <= 1; i++) tri(ctx, cx + i * 5 + 3, 26, cx + i * 5 + 6, 24, cx + i * 5 + 5, 30, solid(color)); break
    case 'talonblitz':
      stroke(ctx, color, 3, 1, true); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 4 - 3, 8); ctx.lineTo(cx + i * 4, 20); ctx.stroke() } ctx.shadowBlur = 0
      for (const [sx, sy] of [[cx + 7, 24], [cx + 12, 17], [cx + 10, 29]] as const) spark(ctx, sx, sy, 2.4, 0xff8a65); break
    case 'grapple':
      arrowShaft(ctx, 8, 30, 22, 16, color, 3); stroke(ctx, color, 2); ctx.beginPath(); ctx.arc(25, 13, 4, 0, Math.PI * 1.5); ctx.stroke(); stroke(ctx, color, 1, 0.5); ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(6, 24); ctx.lineTo(9, 20); ctx.stroke(); break
    case 'trap':
      stroke(ctx, color, 3, 1, true); ctx.beginPath(); ctx.arc(cx, cy, 12, Math.PI * 1.11, Math.PI * 1.89); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 12, 0.11 * Math.PI, 0.89 * Math.PI); ctx.stroke(); ctx.shadowBlur = 0
      ctx.fillStyle = solid(color); for (let i = 0; i < 5; i++) { const px = cx - 10 + i * 5; tri(ctx, px, cy - 4, px + 4, cy - 4, px + 2, cy, solid(color)); tri(ctx, px, cy + 4, px + 4, cy + 4, px + 2, cy, solid(color)) } break
    case 'wave':
      stroke(ctx, color, 3, 1, true); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(8 + i * 2, 22, 9 + i * 6, -0.9, 0.9); ctx.stroke() } ctx.shadowBlur = 0; break
    case 'slam':
      arrowShaft(ctx, cx, 6, cx, 26, color, 4); stroke(ctx, color, 2, 1, true); for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(cx, 34, 6 + i * 6, Math.PI * 1.11, Math.PI * 1.89); ctx.stroke() } ctx.shadowBlur = 0; break
    case 'ray': {
      const g = ctx.createLinearGradient(0, 34, 0, 6); g.addColorStop(0, solid(color, 0)); g.addColorStop(1, solid(color, 0.5))
      tri(ctx, cx - 9, 34, cx + 9, 34, cx, 6, g as unknown as string); blade(ctx, cx, 32, cx, 8, color, 3); spark(ctx, cx, 8, 3, color); break }
    case 'flamewall':
      ctx.fillStyle = '#5d4037'; roundRect(ctx, 7, 33, 30, 4, 2); ctx.fill(); flame(ctx, 13, 34, 16, 5); flame(ctx, 22, 34, 22, 6); flame(ctx, 31, 34, 16, 5); break
    case 'flamethrower':
      ctx.fillStyle = '#607d8b'; roundRect(ctx, 7, cy - 3, 8, 6, 1); ctx.fill()
      { const g = ctx.createLinearGradient(15, 0, 34, 0); g.addColorStop(0, '#ffca28'); g.addColorStop(1, '#ff7043'); tri(ctx, 15, cy - 9, 15, cy + 9, 34, cy, g as unknown as string) }
      tri(ctx, 16, cy - 4, 16, cy + 4, 28, cy, '#fff3c0'); break
    case 'meteor':
      ctx.fillStyle = solid(color, 0.35); tri(ctx, 30, 8, 36, 11, 20, 24, solid(color, 0.35)); orb(ctx, 18, 26, 8, 0x6d4c41); flame(ctx, 16, 22, 8, 3); break
    case 'meteors':
      for (const [mx, my, r] of [[13, 22, 6], [26, 30, 5], [30, 14, 4]] as const) { ctx.fillStyle = solid(color, 0.35); tri(ctx, mx + r + 6, my - r - 6, mx + r + 10, my - r - 3, mx, my, solid(color, 0.35)); orb(ctx, mx, my, r, 0x6d4c41); spark(ctx, mx - r * 0.3, my - r * 0.3, r * 0.35, 0xff7043) } break
    case 'rage': {
      ctx.fillStyle = solid(0xd50000); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; tri(ctx, cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, cx + Math.cos(a + 0.3) * 9, cy + Math.sin(a + 0.3) * 9, cx + Math.cos(a + 0.15) * 18, cy + Math.sin(a + 0.15) * 18, solid(0xd50000)) }
      ctx.fillStyle = '#ffebee'; ctx.beginPath(); ctx.arc(cx, cy - 1, 8, 0, 7); ctx.fill(); roundRect(ctx, cx - 4, cy + 4, 8, 5, 1); ctx.fill()
      ctx.fillStyle = '#7f0000'; ctx.beginPath(); ctx.arc(cx - 3, cy - 1, 2.3, 0, 7); ctx.arc(cx + 3, cy - 1, 2.3, 0, 7); ctx.fill(); break }
    case 'aura':
      stroke(ctx, color, 2, 0.9, true); ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; spark(ctx, cx, cy, 3, color)
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; spark(ctx, cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 1.6, color) } break
    case 'eye':
      stroke(ctx, color, 2.2, 1, true); ctx.beginPath(); ctx.ellipse(cx, cy, 13, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0
      orb(ctx, cx, cy, 5, color); ctx.fillStyle = '#0d1b12'; ctx.beginPath(); ctx.ellipse(cx, cy, 1.6, 5, 0, 0, 7); ctx.fill(); break
    case 'reflex':
      stroke(ctx, color, 2.2, 1, true); ctx.beginPath(); ctx.ellipse(cx, cy, 13, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0
      ctx.fillStyle = '#ffee58'; ctx.beginPath(); ctx.ellipse(cx, cy, 9, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(cx, cy, 2, 6, 0, 0, 7); ctx.fill(); break
    default:
      blade(ctx, 13, 31, 31, 13, color); guard(ctx, 14, 30)
  }
}

// ── ICÔNES DE MATÉRIAUX (butin) ────────────────────────────────────────────────────────────────
// Petits objets détourés (fond transparent) rendus en vecteur — remplacent la pastille ronde tintée
// générique (« placeholder bleu clair » pour la gemme, etc.). 32×32 logique, rendu à 2×.
const MAT = 32
function materialGlyph(ctx: CanvasRenderingContext2D, id: string, color: number) {
  const cx = 16, cy = 16
  const drop = (fn: () => void) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; fn(); ctx.restore() }
  switch (id) {
    case 'gemme-brute': drop(() => { // gemme facettée
      const g = ctx.createLinearGradient(0, 4, 0, 28); g.addColorStop(0, lighten(color, 0.6)); g.addColorStop(1, darken(color, 0.15))
      ctx.beginPath(); ctx.moveTo(cx, 3); ctx.lineTo(27, 13); ctx.lineTo(cx, 29); ctx.lineTo(5, 13); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, 3); ctx.lineTo(cx, 29); ctx.moveTo(5, 13); ctx.lineTo(27, 13); ctx.stroke()
      tri(ctx, cx, 3, 27, 13, cx, 13, 'rgba(255,255,255,0.35)') })
      break
    case 'herbe-tendre': drop(() => { // brin d'herbe / feuille
      const g = ctx.createLinearGradient(0, 4, 0, 28); g.addColorStop(0, lighten(color, 0.4)); g.addColorStop(1, solid(color))
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, 28); ctx.quadraticCurveTo(cx + s * 10, 16, cx + s * 3, 5); ctx.quadraticCurveTo(cx + s * 1, 16, cx, 28); ctx.closePath(); ctx.fillStyle = g; ctx.fill() }
      ctx.beginPath(); ctx.moveTo(cx, 28); ctx.quadraticCurveTo(cx, 14, cx, 4); ctx.quadraticCurveTo(cx - 1, 16, cx, 28); ctx.closePath(); ctx.fillStyle = lighten(color, 0.5); ctx.fill() })
      break
    case 'trefle-chance': drop(() => { // trèfle 4 feuilles
      ctx.fillStyle = solid(color); for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as const) { ctx.beginPath(); ctx.ellipse(cx + dx * 0.7, cy + dy * 0.7, 5, 5, 0, 0, 7); ctx.fill() }
      ctx.strokeStyle = darken(color, 0.2); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + 1, cy + 4); ctx.quadraticCurveTo(cx + 4, 26, cx + 6, 29); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill() })
      break
    case 'chapeau-champi': case 'spore-lumineuse': drop(() => { // champignon
      const cap = ctx.createLinearGradient(0, 4, 0, 18); cap.addColorStop(0, lighten(color, 0.4)); cap.addColorStop(1, solid(color))
      ctx.fillStyle = '#f5e9d0'; roundRect(ctx, cx - 4, 15, 8, 12, 3); ctx.fill() // pied
      ctx.beginPath(); ctx.moveTo(cx - 11, 16); ctx.quadraticCurveTo(cx, 2, cx + 11, 16); ctx.closePath(); ctx.fillStyle = cap; ctx.fill() // chapeau
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const [dx, dy, r] of [[-5, 11, 1.6], [3, 9, 2], [7, 13, 1.4]] as const) { ctx.beginPath(); ctx.arc(cx + dx, dy, r, 0, 7); ctx.fill() } })
      break
    case 'minerai-fer': drop(() => { // caillou de minerai + éclats métalliques
      const g = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 13); g.addColorStop(0, lighten(color, 0.4)); g.addColorStop(1, darken(color, 0.2))
      ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(11, 6); ctx.lineTo(22, 7); ctx.lineTo(27, 16); ctx.lineTo(21, 27); ctx.lineTo(9, 25); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
      ctx.fillStyle = lighten(color, 0.7); for (const [x, y] of [[12, 12], [19, 17], [15, 21]] as const) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill() } })
      break
    case 'croc-de-loup': drop(() => { // croc / dent
      const g = ctx.createLinearGradient(0, 3, 0, 29); g.addColorStop(0, '#ffffff'); g.addColorStop(1, solid(color))
      ctx.beginPath(); ctx.moveTo(cx - 6, 6); ctx.quadraticCurveTo(cx - 7, 22, cx, 29); ctx.quadraticCurveTo(cx + 7, 22, cx + 6, 6); ctx.quadraticCurveTo(cx, 10, cx - 6, 6); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke() })
      break
    case 'dard-de-scorpion': drop(() => { // dard courbe barbelé
      ctx.strokeStyle = solid(color); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 27); ctx.quadraticCurveTo(24, 22, 22, 7); ctx.stroke()
      tri(ctx, 22, 3, 17, 10, 26, 9, lighten(color, 0.3)) // pointe
      ctx.strokeStyle = darken(color, 0.2); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(15, 19); ctx.lineTo(11, 16); ctx.moveTo(20, 14); ctx.lineTo(16, 12); ctx.stroke() })
      break
    default: drop(() => { orb(ctx, cx, cy, 10, color) })
  }
}

export function renderMaterialIcon(color: number, id: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = MAT * S; canvas.height = MAT * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  materialGlyph(ctx, id, color)
  return canvas
}

// rend une icône complète (cadre + glyphe) sur un canvas 88×88, prête pour textures.addCanvas.
export function renderSkillIcon(color: number, kind: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ICON * S; canvas.height = ICON * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  badge(ctx, color)
  ctx.save(); roundRect(ctx, 2, 2, 40, 40, 8); ctx.clip()
  glyph(ctx, kind, color)
  ctx.restore()
  return canvas
}
