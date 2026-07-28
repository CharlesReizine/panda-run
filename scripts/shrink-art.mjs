// Redimensionne public/art/* à la taille RÉELLEMENT affichée, d'après les plafonds de
// scripts/art-caps.mjs. Idempotent : relancer ne fait rien de plus. À relancer après toute
// génération d'art (generate_art.py sort du 1024×1024 par défaut).
//
// POURQUOI : une texture WebGL coûte l×h×4 octets de VRAM non compressés. 1024×1024 = 4 Mo, pour un
// sprite affiché à 46 px. Mesuré sur R272 : 532 Mo de VRAM au boot → cause du ralentissement
// progressif sur iPhone (WebKit purge/re-uploade en boucle sous pression mémoire).
//
// Outil : `sips`, intégré à macOS (aucune dépendance npm). L'alpha des PNG est préservé (colorType 6
// vérifié). Tout l'art est suivi par git → `git checkout -- public/art` annule tout.
//
// Usage : node scripts/shrink-art.mjs [--dry]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { capFor } from './art-caps.mjs'

const DIR = join('public', 'art')
const DRY = process.argv.includes('--dry')

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const m = buf[i + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

let vramBefore = 0, vramAfter = 0, diskBefore = 0, diskAfter = 0, touched = 0
const plan = []

for (const f of readdirSync(DIR)) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue
  const path = join(DIR, f)
  const buf = readFileSync(path)
  const size = pngSize(buf) ?? jpegSize(buf)
  if (!size) { console.warn(`  dimensions illisibles, ignoré : ${f}`); continue }
  const bytes = statSync(path).size
  diskBefore += bytes
  vramBefore += size.w * size.h * 4

  const cap = capFor(f).max
  const longest = Math.max(size.w, size.h)
  if (longest <= cap) {
    vramAfter += size.w * size.h * 4
    diskAfter += bytes
    continue
  }
  const ratio = cap / longest
  const nw = Math.round(size.w * ratio), nh = Math.round(size.h * ratio)
  plan.push({ f, path, from: `${size.w}×${size.h}`, to: `${nw}×${nh}`, cap })
  vramAfter += nw * nh * 4
  touched++
}

const mb = (b) => (b / 1048576).toFixed(1)
for (const p of plan) console.log(`  ${p.f.padEnd(34)} ${p.from.padStart(11)} → ${p.to} (plafond ${p.cap})`)

if (DRY) {
  console.log(`\n[--dry] ${touched} image(s) à redimensionner.`)
  console.log(`VRAM : ${mb(vramBefore)} Mo → ${mb(vramAfter)} Mo`)
  process.exit(0)
}

for (const p of plan) execFileSync('sips', ['-Z', String(p.cap), p.path], { stdio: 'ignore' })

// poids disque réel après coup
diskAfter = 0
for (const f of readdirSync(DIR)) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue
  diskAfter += statSync(join(DIR, f)).size
}

console.log(`\n${touched} image(s) redimensionnée(s).`)
console.log(`VRAM  : ${mb(vramBefore)} Mo → ${mb(vramAfter)} Mo`)
console.log(`Disque: ${mb(diskBefore)} Mo → ${mb(diskAfter)} Mo`)
console.log(`\nPenser à régénérer les dimensions : node scripts/gen-asset-manifest.mjs`)
