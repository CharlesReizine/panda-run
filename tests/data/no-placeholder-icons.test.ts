import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { ITEMS } from '../../src/data/items'
import { MATERIALS } from '../../src/data/materials'
import { MATERIAL_GLYPH_IDS } from '../../src/art/skill-icon-canvas'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUNE FICHE NE DOIT TOMBER SUR UNE IMAGE PAR DÉFAUT.
//
// Demande explicite du user : « vérifie et crée un test pour que chaque fiche ait pas d'image par
// défaut », « et pour les élites aussi ». Le jeu possède plusieurs REPLIS génériques — `item-drop`,
// `material-drop` (pastille teintée), et le dessin procédural de monstre. Ils évitent un crash, mais
// à l'écran ils donnent les « vieux cercles de couleurs » signalés dans l'aperçu de terrain.
//
// Ce test interdit que le repli soit ATTEINT, en vérifiant que la vraie ressource existe.
// Les fichiers sont énumérés par Vite (import.meta.glob), sans dépendre de node:fs — les tests sont
// type-checkés par tsc et @types/node n'est pas installé.

const artFiles = new Set(
  Object.keys(import.meta.glob('../../public/art/*.png')).map((p) => p.split('/').pop()!),
)
const has = (file: string) => artFiles.has(file)

// Chapeaux dessinés vectoriellement (cosmetic-<id> dans PreloadScene) : ce n'est PAS un repli
// générique mais un vrai visuel dédié, donc admis. Miroir de tests/data/item-images.test.ts.
const COSMETIC_DRAWN = new Set([
  'ruban', 'sakkat', 'bonnet-champi', 'chapeau-poring', 'casque-orc', 'casque-croc', 'ailes-angeling',
  'couronne-royale', 'corne-kaho', 'bandeau-guerrier', 'plume-eclaireur', 'bonnet-laine', 'oreilles-chat',
  'chapeau-sorciere', 'lunettes-aviateur', 'casque-viking', 'diademe-fee', 'aureole-sacree',
  'couronne-glace', 'masque-demon',
])

describe('aucune image par défaut — monstres', () => {
  it('chaque monstre a une VRAIE illustration (art-<id>.png, artFrom, ou texture dédiée)', () => {
    const missing = Object.values(MONSTERS)
      .filter((m) => {
        if (m.tex) return false // texture explicite réutilisée (ex. piranha → fish-piranha)
        // variante (géante / mini) : elle réutilise l'illustration de sa base
        const base = m.artFrom ?? m.id
        return !has(`art-${base}.png`)
      })
      .map((m) => `${m.id}${m.artFrom ? ` (artFrom ${m.artFrom})` : ''}`)
    expect(missing, `monstre(s) sans illustration → dessin procédural de repli : ${missing.join(', ')}`).toEqual([])
  })

  it('chaque ÉLITE et chaque BOSS a une illustration (ce sont les fiches les plus regardées)', () => {
    const missing = Object.values(MONSTERS)
      .filter((m) => m.mvp || m.boss)
      .filter((m) => !m.tex && !has(`art-${m.artFrom ?? m.id}.png`))
      .map((m) => `${m.boss ? 'BOSS' : 'ÉLITE'} ${m.id}`)
    expect(missing, `élite(s)/boss sans illustration : ${missing.join(', ')}`).toEqual([])
  })
})

describe('aucune image par défaut — butins', () => {
  // Tout ce qui peut tomber d'un monstre, sans doublon.
  const drops = Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => ({ m: m.id, d })))

  it('l\'or et les potions ont leur image (jamais un rond de couleur)', () => {
    if (drops.some(({ d }) => d.kind === 'gold')) expect(has('coin.png'), 'coin.png manquant').toBe(true)
    if (drops.some(({ d }) => d.kind === 'potion')) expect(has('potion-drop.png'), 'potion-drop.png manquant').toBe(true)
  })

  it('chaque OBJET droppé a une image dédiée (jamais le repli item-drop)', () => {
    const missing = drops
      .filter(({ d }) => d.kind === 'item')
      .filter(({ d }) => {
        const id = d.itemId
        if (!id) return true
        if (has(`item-${id}.png`)) return false
        return !(ITEMS[id]?.slot === 'hat' && COSMETIC_DRAWN.has(id))
      })
      .map(({ m, d }) => `${m} → ${d.itemId}`)
    expect(missing, `objet(s) droppé(s) sans image : ${missing.join(', ')}`).toEqual([])
  })

  it('chaque MATÉRIAU droppé est déclaré (son icône est générée à partir de MATERIALS)', () => {
    // material-<id> est dessiné au chargement pour CHAQUE entrée de MATERIALS ; un materialId non
    // déclaré est donc le seul cas qui retomberait sur la pastille générique `material-drop`.
    const missing = drops
      .filter(({ d }) => d.kind === 'material')
      .filter(({ d }) => !d.materialId || !MATERIALS[d.materialId])
      .map(({ m, d }) => `${m} → ${d.materialId ?? '(aucun id)'}`)
    expect(missing, `matériau(x) droppé(s) non déclaré(s) dans MATERIALS : ${missing.join(', ')}`).toEqual([])
  })

  it('chaque matériau a un GLYPHE dédié (jamais le rond de couleur du `default`)', () => {
    // Être déclaré dans MATERIALS ne suffit pas : materialGlyph dessine une forme par `case` d'id et
    // retombe sinon sur `default: orb(...)`, une pastille ronde teintée — le repli que le joueur a
    // rejeté mot pour mot (« on voit rien c'est des vieux cercles de couleurs »). Une matière ajoutée
    // sans son glyphe passerait donc les autres tests tout en RÉGRESSANT à l'écran. Le switch n'étant pas
    // inspectable statiquement, skill-icon-canvas EXPORTE la liste des ids qu'il couvre : c'est elle
    // qu'on confronte au registre des matières.
    const covered = new Set(MATERIAL_GLYPH_IDS)
    const orphans = Object.keys(MATERIALS).filter((id) => !covered.has(id))
    expect(orphans, `matériau(x) sans glyphe dédié (→ pastille ronde) : ${orphans.join(', ')}`).toEqual([])
    // …et l'inverse : un glyphe qui ne correspond plus à aucune matière est du code mort qui laisse
    // croire que la couverture est bonne.
    const stale = MATERIAL_GLYPH_IDS.filter((id) => !MATERIALS[id])
    expect(stale, `glyphe(s) sans matériau correspondant : ${stale.join(', ')}`).toEqual([])
  })
})
