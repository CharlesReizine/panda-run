// Génère public/asset-manifest.json : la liste de TOUS les assets (art + audio) que le bouton
// « Télécharger pour hors-ligne » (TitleScene) va précharger d'un coup dans le cache du service
// worker. Lancé avant chaque build (cf. package.json → "build").
import { readdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
