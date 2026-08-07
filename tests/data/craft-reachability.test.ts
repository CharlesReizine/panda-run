import { describe, it, expect } from 'vitest'
import { RECIPES } from '../../src/data/recipes'
import { MATERIALS } from '../../src/data/materials'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { ITEMS } from '../../src/data/items'
import { expectedLevel } from '../../src/core/playability-sim'
import { coutAmelioration, NIVEAU_MAX, NIVEAU_SUR } from '../../src/core/amelioration'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ATTEIGNABILITÉ DU CRAFT — « jamais trouvé de minerai donc pas clair comment je fais des objets »
//
// Le bug signalé n'était pas un bug de code : c'était une recette qui réclamait une matière dont la
// PREMIÈRE SOURCE JOUABLE arrive bien après le moment où on ouvre la forge. Concrètement, le minerai de
// fer ne tombait que sur des mobs du désert (niveau joueur attendu ~15) à 6 %, alors que trois recettes
// sur huit — dont la première ligne affichée — en exigeaient, et que la forge s'ouvre à Prontera vers
// Nv4. Rien dans la suite de tests ne pouvait l'attraper : les données étaient parfaitement VALIDES,
// juste injouables.
//
// Ce fichier ferme le trou en croisant les trois sources de vérité qui n'étaient jamais confrontées :
//   RECIPES (ce qu'on demande) × MONSTERS.drops (ce qui tombe) × LEVELS (où l'on peut aller quand).
// `expectedLevel` (core/playability-sim) donne le niveau joueur ATTENDU à l'entrée d'un terrain — la
// même fonction que celle qui arbitre l'économie d'XP, donc la même notion de « quand j'y passe ».

// Terrains où un monstre APPARAÎT RÉELLEMENT (spawns + boss). Les gardiens, par exemple, ne sont posés
// dans aucun terrain : leurs drops ne comptent donc pas comme une source pour le joueur — c'est
// exactement le genre de source fantôme qui donnerait une fausse garantie d'atteignabilité.
function terrainsOfMonster(monsterId: string): string[] {
  const out: string[] = []
  for (const lv of Object.values(LEVELS)) {
    if (lv.spawns.some((s) => s.monsterId === monsterId) || lv.boss === monsterId) out.push(lv.id)
  }
  return out
}

// matière → 1re source jouable : niveau joueur attendu, monstre, terrain, et la MEILLEURE chance de drop
// toutes sources confondues. Absente de la table = matière INTROUVABLE en jeu.
interface Source { level: number; monster: string; terrain: string; chance: number }
const FIRST_SOURCE: Record<string, Source> = (() => {
  const out: Record<string, Source> = {}
  for (const m of Object.values(MONSTERS)) {
    const terrains = terrainsOfMonster(m.id)
    if (terrains.length === 0) continue
    const best = terrains.reduce((acc, id) => (expectedLevel(id) < acc.lv ? { lv: expectedLevel(id), id } : acc), { lv: Infinity, id: '' })
    for (const d of m.drops) {
      if (d.kind !== 'material' || !d.materialId) continue
      const prev = out[d.materialId]
      const chance = Math.max(prev?.chance ?? 0, d.chance)
      out[d.materialId] = !prev || best.lv < prev.level
        ? { level: best.lv, monster: m.id, terrain: best.id, chance }
        : { ...prev, chance }
    }
  }
  return out
})()
const describeSource = (s: Source) => `${s.monster} (${s.terrain}, Nv ${s.level})`

const RECIPES_BY_LEVEL = [...RECIPES].sort((a, b) => a.level - b.level)

describe('atteignabilité des matières de craft', () => {
  it('chaque matière d\'une recette tombe dans un terrain traversé AU PLUS TARD à son palier', () => {
    // LE test qui rend le bug impossible à réintroduire. Une recette de palier N ne peut demander que
    // des matières déjà récoltables sur la route parcourue pour ATTEINDRE le niveau N — sinon le joueur
    // lit une recette dont il ne peut pas savoir où trouver les ingrédients.
    const faults: string[] = []
    for (const r of RECIPES) {
      for (const matId of Object.keys(r.materials)) {
        const src = FIRST_SOURCE[matId]
        if (!src) { faults.push(`${r.id} : « ${matId} » ne tombe sur AUCUN monstre placé dans un terrain`); continue }
        if (src.level > r.level) {
          faults.push(`${r.id} (palier ${r.level}) : « ${matId} » n'apparaît que sur ${describeSource(src)}`)
        }
      }
    }
    expect(faults, `matière(s) hors de portée de leur recette :\n  ${faults.join('\n  ')}`).toEqual([])
  })

  it('la recette la plus accessible se boucle avec la SEULE plaine (premier craft sans détour)', () => {
    // Promesse de design : « clear les premiers terrains ⇒ je forge mon premier objet ». On vérifie donc
    // que la recette de plus bas palier ne dépend QUE de matières dont la 1re source est un terrain de
    // plaine (le tronçon d'avant Prontera, où se trouve la forge), et pas d'un aller-retour en forêt.
    const first = RECIPES_BY_LEVEL[0]!
    for (const matId of Object.keys(first.materials)) {
      const src = FIRST_SOURCE[matId]!
      const biome = LEVELS[src.terrain]!.biome
      expect(biome, `${first.id} : « ${matId} » vient de ${describeSource(src)}, biome ${biome}`).toBe('plaine')
      expect(src.level, `${first.id} : « ${matId} » n'apparaît que sur ${describeSource(src)}`).toBeLessThanOrEqual(first.level)
    }
  })

  it('le tout premier terrain du jeu donne déjà une matière (Prairie ne contient que des Gloopy)', () => {
    // Sinon on finit le niveau 1 avec un inventaire vide : la boucle « je tue → j'accumule → je forge »
    // n'est jamais amorcée, et le craft reste une abstraction (c'est ce que décrivait le joueur).
    const first = Object.values(LEVELS).find((l) => l.id === 'plaine-1')!
    const dropped = new Set(
      first.spawns.flatMap((s) => (MONSTERS[s.monsterId]?.drops ?? []))
        .filter((d) => d.kind === 'material' && d.materialId)
        .map((d) => d.materialId!),
    )
    expect([...dropped].length, 'aucune matière ne tombe sur le premier terrain').toBeGreaterThan(0)
    for (const id of dropped) expect(MATERIALS[id]!.rarity, `${id} sur plaine-1`).toBe('commune')
  })
})

describe('hiérarchie des matières', () => {
  it('toute matière COMMUNE a une source à ≥ 25 % (une matière de base à 5 % est invisible)', () => {
    const faults = Object.values(MATERIALS)
      .filter((m) => m.rarity === 'commune')
      .filter((m) => (FIRST_SOURCE[m.id]?.chance ?? 0) < 0.25)
      .map((m) => `${m.id} (meilleure chance ${FIRST_SOURCE[m.id]?.chance ?? 0})`)
    expect(faults, `commune(s) trop rare(s) pour se ramasser par poignées : ${faults.join(', ')}`).toEqual([])
  })

  it('toute matière RARE reste un trophée (≤ 25 %)', () => {
    const faults = Object.values(MATERIALS)
      .filter((m) => m.rarity === 'rare')
      .filter((m) => (FIRST_SOURCE[m.id]?.chance ?? 0) > 0.25)
      .map((m) => `${m.id} (${FIRST_SOURCE[m.id]?.chance})`)
    expect(faults, `rare(s) devenue(s) banale(s) : ${faults.join(', ')}`).toEqual([])
  })

  it('aucune matière MORTE : tout ce qui est déclaré tombe quelque part ET sert à quelque chose', () => {
    // `chapeau-champi` a longtemps été droppé sans être consommé par AUCUNE recette : du contenu mort
    // qui encombre l'inventaire et brouille la lecture du craft.
    const consumed = new Set<string>([
      ...RECIPES.flatMap((r) => Object.keys(r.materials)),
      // ⚠️ LA SOURCE A CHANGÉ DE NOM MAIS PAS DE RÔLE : la réforge a été remplacée par l'amélioration
      // (core/amelioration), qui consomme elle aussi des matériaux. Oublier de la citer ici ferait
      // passer le minerai et la gemme pour des matières MORTES et casserait ce test à côté du sujet.
      ...Array.from({ length: NIVEAU_MAX }, (_, lv) =>
        Object.entries(coutAmelioration(lv, 1).materials).filter(([, n]) => n > 0).map(([m]) => m)).flat(),
    ])
    for (const m of Object.values(MATERIALS)) {
      expect(FIRST_SOURCE[m.id], `${m.id} n'est droppé par aucun monstre placé`).toBeDefined()
      expect(consumed.has(m.id), `${m.id} n'est consommé par aucune recette ni par la réforge`).toBe(true)
    }
  })

  it('les recettes montent en gamme : palier croissant, et un légendaire coûte plus qu\'un épique', () => {
    for (let i = 1; i < RECIPES.length; i++) {
      expect(RECIPES[i]!.level, `${RECIPES[i]!.id} doit venir après ${RECIPES[i - 1]!.id}`).toBeGreaterThanOrEqual(RECIPES[i - 1]!.level)
    }
    const epiques = RECIPES.filter((r) => ITEMS[r.resultItemId]!.rarity === 'epique')
    const legendaires = RECIPES.filter((r) => ITEMS[r.resultItemId]!.rarity === 'legendaire')
    expect(legendaires.length, 'il doit rester des légendaires à forger').toBeGreaterThan(0)
    const gold = (ids: typeof RECIPES) => Math.max(...ids.map((r) => r.gold ?? 0))
    expect(Math.min(...legendaires.map((r) => r.gold ?? 0)), 'un légendaire doit coûter plus cher que tout épique')
      .toBeGreaterThan(gold(epiques))
  })

  it('chaque recette mélange du VOLUME commun et un accent rare (jamais 100 % de trophées)', () => {
    // Une recette faite QUE de rares est un mur (l'ancien état : 4 recettes sur 8) ; une recette faite
    // QUE de communes n'a aucun goût de récompense. On impose donc au moins une commune, et on borne les
    // rares à 2 (un épique en porte une, un légendaire deux).
    for (const r of RECIPES) {
      const ids = Object.keys(r.materials)
      const communes = ids.filter((id) => MATERIALS[id]!.rarity === 'commune')
      const rares = ids.filter((id) => MATERIALS[id]!.rarity === 'rare')
      expect(communes.length, `${r.id} n'a aucune matière commune`).toBeGreaterThan(0)
      expect(rares.length, `${r.id} empile trop de trophées rares`).toBeLessThanOrEqual(2)
    }
  })
})

describe('amélioration', () => {
  // ⚠️ LA RÈGLE SE DÉDOUBLE, PARCE QUE LES DEUX MOITIÉS DU MÉCANISME N'ONT PAS LE MÊME PUBLIC.
  // Monter à +3 est le chemin NORMAL : tout le monde doit pouvoir le faire, donc matières communes et
  // franchement farmables. Pousser au-delà est un PARI qu'on choisit de prendre : y demander une
  // matière rare est cohérent — ce qu'on risque doit avoir coûté quelque chose. Elle reste soumise au
  // seuil de farmabilité : rare ne veut pas dire introuvable, sinon l'onglet redevient décoratif.
  it('monter jusqu\'au palier sûr ne coûte que des matières COMMUNES et farmables', () => {
    for (let lv = 0; lv < NIVEAU_SUR; lv++) {
      for (const [matId, qte] of Object.entries(coutAmelioration(lv, 1).materials)) {
        if (qte <= 0) continue
        expect(MATERIALS[matId], `${matId} (+${lv + 1}) doit être déclaré`).toBeDefined()
        expect(MATERIALS[matId]!.rarity, `${matId} (+${lv + 1}) est sur le chemin normal`).toBe('commune')
        expect(FIRST_SOURCE[matId]!.chance, `${matId} (+${lv + 1}) doit être farmable`).toBeGreaterThanOrEqual(0.25)
      }
    }
  })

  it('au-delà, les matières restent déclarées et farmables', () => {
    for (let lv = NIVEAU_SUR; lv < NIVEAU_MAX; lv++) {
      for (const [matId, qte] of Object.entries(coutAmelioration(lv, 1).materials)) {
        if (qte <= 0) continue
        expect(MATERIALS[matId], `${matId} (+${lv + 1}) doit être déclaré`).toBeDefined()
        expect(FIRST_SOURCE[matId], `${matId} (+${lv + 1}) doit tomber quelque part`).toBeDefined()
        expect(FIRST_SOURCE[matId]!.chance, `${matId} (+${lv + 1}) doit rester farmable`).toBeGreaterThanOrEqual(0.1)
      }
    }
  })
})
