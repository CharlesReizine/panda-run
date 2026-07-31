// Génère src/data/art-dimensions.generated.ts : les dimensions de chaque image de public/art + les
// plafonds de scripts/art-caps.mjs, pour que tests/perf/art-budget.test.ts puisse verrouiller le
// budget de VRAM SANS lire le disque (les tests sont type-checkés par tsc et @types/node n'est pas
// installé → aucun import de 'node:fs' n'est permis dans tests/).
//
// Lancé avant chaque build (cf. package.json → "build").
//
// Ce script générait aussi public/asset-manifest.json, la liste que le bouton « Télécharger l'app »
// préchargeait pour jouer hors connexion. Fonctionnalité RETIRÉE (le user ne joue jamais sans
// réseau) : il ne reste que les dimensions. Le cache runtime du service worker (CacheFirst sur
// images/sons, cf. vite.config.ts) garde les assets au fil du jeu — c'est de la perf, plus une
// garantie hors-ligne.
import { readdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ART_CAPS, DEFAULT_CAP, BOOT_BUDGET_MB, capFor } from './art-caps.mjs'

const PUB = 'public'

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

// ─── GARDE-FOU : usage de `Phaser` À L'EXÉCUTION sans import ──────────────────────────────────
// La build R285 est partie en production avec un « ReferenceError: Can't find variable: Phaser »
// qui tuait le boot dès le premier create(). `tsc` ne peut PAS l'attraper : phaser déclare un
// namespace `Phaser` GLOBAL côté types, donc un fichier qui lit `Phaser.Input.Events.X` sans
// importer phaser compile parfaitement et casse seulement dans le navigateur.
//
// On échoue donc la BUILD. On ne signale que les usages de VALEUR (`Phaser.Xxx` suivi d'un accès),
// pas les annotations de TYPE (`: Phaser.Scene`, `<Phaser.GameObjects.Text>`), qui sont effacées à
// la compilation et n'ont besoin d'aucun import.
function checkPhaserImports() {
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.ts')) continue
      const src = readFileSync(full, 'utf8')
      if (/^import Phaser from 'phaser'/m.test(src)) continue
      const hits = new Set()
      for (const line of src.split('\n')) {
        const code = line.replace(/\/\/.*$/, '') // on ignore les commentaires
        // usage de VALEUR : `Phaser.X` qui n'est PAS précédé de ':' '<' '|' 'as' (= annotation de type)
        const re = /(^|[^\w:<|])Phaser\.([A-Za-z_$][\w$]*)/g
        let m
        while ((m = re.exec(code))) {
          const before = code.slice(0, m.index + m[1].length).trimEnd()
          if (/[:<|]$/.test(before) || /\bas$/.test(before)) continue // annotation de type
          hits.add('Phaser.' + m[2])
        }
      }
      if (hits.size) offenders.push(`${full} → ${[...hits].join(', ')}`)
    }
  }
  walk('src')
  if (offenders.length) {
    console.error('\n❌ `Phaser` utilisé à l\'EXÉCUTION sans `import Phaser from \'phaser\'` :')
    for (const o of offenders) console.error('   ' + o)
    console.error('\n   tsc ne voit pas ce bug (namespace Phaser global côté types) — il ne casse QU\'À L\'EXÉCUTION.')
    process.exit(1)
  }
}
checkPhaserImports()
console.log('garde-fou : aucun usage de Phaser sans import')
