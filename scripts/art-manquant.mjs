// Recense les ILLUSTRATIONS D'OBJETS QUI MANQUENT et réécrit docs/art-a-generer.md.
//
// POURQUOI CE SCRIPT EXISTE. Le roster d'équipement est passé de 61 à 150 objets (« il me faut des tonnes
// de trucs »), avec l'accord explicite du user : « s'il manque quelques visuels on les générera ». Une
// dette assumée doit être COMPTÉE, sinon elle devient invisible : sans inventaire, on ne sait plus quels
// objets affichent encore une pastille de couleur — et c'est justement le « vieux cercle de couleur » que
// le user a déjà rejeté ailleurs.
//
// Le fichier produit est la commande de travail : un chemin de PNG par ligne, avec le nom et la
// description de l'objet pour guider l'illustration. Il est régénéré, jamais édité à la main.
//
// La liste est verrouillée par tests/data/item-images.test.ts, qui échoue pour tout objet sans image ET
// absent de la liste. Ajouter un objet sans art oblige donc à relancer ce script.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const SRC = 'src/data/items.ts'
const OUT = 'docs/art-a-generer.md'

// Lecture des objets directement dans la source TypeScript : pas de compilation, pas de dépendance.
// On ne lit que des champs à plat et le script échoue bruyamment si le format change.
const src = readFileSync(SRC, 'utf8')
const re = /\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)', slot: '(\w+)'(?:, weaponType: '(\w+)')?, bonus: \{([^}]*)\}, rarity: '(\w+)', description: '((?:[^'\\]|\\.)*)' \}/g
const items = []
for (const m of src.matchAll(re)) {
  items.push({ id: m[1], name: m[2].replace(/\\'/g, "'"), slot: m[3], weaponType: m[4], bonus: m[5].trim(), rarity: m[6], description: m[7].replace(/\\'/g, "'") })
}
if (items.length < 100) {
  console.error(`❌ seulement ${items.length} objets lus dans ${SRC} — le format a changé, corrige l'expression`)
  process.exit(1)
}

const art = new Set(readdirSync('public/art'))
// Les chapeaux dessinés vectoriellement (drawCosmetic) ont un VRAI visuel dédié : ils ne manquent pas.
const cosmeticDrawn = new Set(
  [...readFileSync('src/scenes/PreloadScene.ts', 'utf8').matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]),
)

const manquants = items.filter((it) => {
  if (art.has(`item-${it.id}.png`)) return false
  if (it.slot === 'hat' && cosmeticDrawn.has(it.id)) return false
  return true
})

const SLOTS = { weapon: 'Armes', armor: 'Armures', hat: 'Chapeaux', accessory: 'Accessoires' }
const lignes = [
  '# Illustrations d\'objets à générer',
  '',
  '> Fichier **généré** par `node scripts/art-manquant.mjs`. Ne pas éditer à la main.',
  '',
  `${items.length} objets au total, **${manquants.length} sans illustration**.`,
  '',
  'Chaque entrée attend un PNG dans `public/art/`, fond transparent, cadré serré sur l\'objet.',
  'Les armes affichent en attendant leur silhouette dessinée au chargement (`weapon-<id>`), donc elles',
  'sont déjà lisibles en jeu ; les autres tombent sur une pastille de couleur.',
  '',
]
for (const [slot, titre] of Object.entries(SLOTS)) {
  const groupe = manquants.filter((m) => m.slot === slot)
  if (!groupe.length) continue
  lignes.push(`## ${titre} — ${groupe.length}`, '')
  lignes.push('| Fichier à créer | Nom | Rareté | Description |')
  lignes.push('|---|---|---|---|')
  for (const m of groupe) {
    lignes.push(`| \`public/art/item-${m.id}.png\` | ${m.name} | ${m.rarity} | ${m.description} |`)
  }
  lignes.push('')
}
if (!manquants.length) lignes.push('Rien à générer : tous les objets ont une illustration. 🎉', '')

writeFileSync(OUT, lignes.join('\n'))
console.log(`${items.length} objets · ${manquants.length} sans illustration → ${OUT}`)
for (const [slot, titre] of Object.entries(SLOTS)) {
  const n = manquants.filter((m) => m.slot === slot).length
  if (n) console.log(`   ${titre.padEnd(12)} ${n}`)
}
