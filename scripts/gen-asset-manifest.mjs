// Génère DEUX artefacts, lancé avant chaque build (cf. package.json → "build") :
//
// 1. public/asset-manifest.json : la liste de TOUS les assets (art + audio) que le bouton
//    « Télécharger pour hors-ligne » (TitleScene) va précharger d'un coup dans le cache du SW.
// 2. src/data/art-dimensions.generated.ts : les dimensions de chaque image + les plafonds de
//    scripts/art-caps.mjs, pour que tests/perf/art-budget.test.ts puisse verrouiller le budget de
//    VRAM SANS lire le disque (les tests sont type-checkés par tsc et @types/node n'est pas
//    installé → aucun import de 'node:fs' n'est permis dans tests/).
import { readdirSync, writeFileSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ART_CAPS, DEFAULT_CAP, BOOT_BUDGET_MB, capFor } from './art-caps.mjs'

const PUB = 'public'
const DIRS = ['art', 'audio']
const list = []
for (const d of DIRS) {
  let entries = []
  try { entries = readdirSync(join(PUB, d)) } catch { continue }
  for (const f of entries) {
    if (f.startsWith('.') || f.endsWith('.md')) continue
    if (statSync(join(PUB, d, f)).isFile()) list.push(`${d}/${f}`)
  }
}
list.sort()
writeFileSync(join(PUB, 'asset-manifest.json'), JSON.stringify(list))
console.log(`asset-manifest.json : ${list.length} assets listés`)

// ─── Dimensions des images ───────────────────────────────────────────────────
// Lecture des en-têtes seulement (pas de décodage) : PNG = IHDR à l'offset 16, JPEG = on scanne
// les marqueurs SOFn. Renvoie null si le format n'est pas reconnu.
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 portent les dimensions
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

const images = []
for (const f of readdirSync(join(PUB, 'art'))) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue
  const buf = readFileSync(join(PUB, 'art', f))
  const size = pngSize(buf) ?? jpegSize(buf)
  if (!size) { console.warn(`  dimensions illisibles, ignoré : ${f}`); continue }
  images.push({ name: f, w: size.w, h: size.h })
}
images.sort((a, b) => a.name.localeCompare(b.name))

// On inline les plafonds sous forme de source (les RegExp ne survivent pas à JSON.stringify).
const capsSrc = ART_CAPS
  .map((c) => `  { pattern: ${c.pattern}, max: ${c.max}${c.lazy ? ', lazy: true' : ''} },`)
  .join('\n')
const imagesSrc = images.map((i) => `  { name: '${i.name}', w: ${i.w}, h: ${i.h} },`).join('\n')

writeFileSync(join('src', 'data', 'art-dimensions.generated.ts'), `// GÉNÉRÉ par scripts/gen-asset-manifest.mjs — NE PAS ÉDITER À LA MAIN.
// Dimensions réelles de public/art/* + plafonds de scripts/art-caps.mjs. Sert au test de budget
// de VRAM (tests/perf/art-budget.test.ts), qui ne peut pas lire le disque.

export interface ArtCap { pattern: RegExp; max: number; lazy?: boolean }
export interface ArtImage { name: string; w: number; h: number }

export const ART_CAPS: ArtCap[] = [
${capsSrc}
]

export const DEFAULT_CAP = ${DEFAULT_CAP}
export const BOOT_BUDGET_MB = ${BOOT_BUDGET_MB}

export const ART_IMAGES: ArtImage[] = [
${imagesSrc}
]

export function capFor(name: string): ArtCap {
  for (const c of ART_CAPS) if (c.pattern.test(name)) return c
  return { pattern: /(?:)/, max: DEFAULT_CAP }
}
`)
const totalMB = images.reduce((s, i) => s + i.w * i.h * 4, 0) / 1048576
const bootMB = images.filter((i) => !capFor(i.name).lazy).reduce((s, i) => s + i.w * i.h * 4, 0) / 1048576
console.log(`art-dimensions.generated.ts : ${images.length} images — VRAM totale ${totalMB.toFixed(1)} Mo, résidente au boot ${bootMB.toFixed(1)} Mo (budget ${BOOT_BUDGET_MB} Mo)`)
