import { describe, it, expect } from 'vitest'
import { monstersInRock } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES PIÈGES QUI ONT DÉJÀ MORDU, RENDUS IMPOSSIBLES À REFAIRE
//
// Demande du joueur : « rajoute des tests sur ce qui a merdé par le passé, et recheck again & again. »
//
// Ces trois-là ne se voient dans AUCUN test de données : le jeu tourne, les terrains sont jouables, et
// le défaut est dans la façon dont le code se surveille LUI-MÊME. Un filet troué a l'air d'un filet.

const nodefs = async () => {
  const mod = 'node:fs'
  return (await import(/* @vite-ignore */ mod)) as {
    readFileSync: (p: string, e: string) => string
    readdirSync: (p: string, o: { withFileTypes: true }) => { name: string; isDirectory: () => boolean }[]
  }
}
const RACINE = new URL('../../', import.meta.url).pathname

async function arborescence(dossiers: string[]): Promise<{ chemin: string; texte: string }[]> {
  const fs = await nodefs()
  const out: { chemin: string; texte: string }[] = []
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`
      if (e.isDirectory()) marcher(p)
      else if (p.endsWith('.ts')) out.push({ chemin: p.slice(RACINE.length), texte: fs.readFileSync(p, 'utf8') })
    }
  }
  for (const d of dossiers) marcher(`${RACINE}${d}`)
  return out
}

describe('pièges déjà tombés', () => {
  // ⚠️ PIÈGE Nº1 — UNE SONDE SANS SPAWNS NE VOIT AUCUN MONSTRE MURÉ. Il a mordu DEUX FOIS le même jour.
  // `geo()` construit un terrain de mesure avec `spawns: []` (elle sert aux mesures de relief). Deux
  // filets successifs — le comblement des recoins, puis les piliers d'échelle — s'en sont servis pour
  // appeler `monstersInRock`, qui répondait donc toujours ZÉRO. Des monstres ont été emmurés vivants
  // sous la surveillance d'un garde-fou écrit exprès pour l'empêcher.
  it('aucun garde-fou n\'interroge monstersInRock avec une sonde sans spawns', async () => {
    const fs = await nodefs()
    const texte = fs.readFileSync(`${RACINE}src/data/level-modules.ts`, 'utf8')
    const appels = [...texte.matchAll(/monstersInRock\(([^)]*)\)/g)].map((m) => m[1]!.trim())
    expect(appels.length, 'plus aucun garde-fou ne surveille les monstres murés ?').toBeGreaterThan(0)
    for (const a of appels) {
      expect(a, `monstersInRock(${a}) : sonde sans spawns`).not.toBe('geo()')
      expect(a, `monstersInRock(${a}) : sonde sans spawns`).not.toMatch(/spawns: *\[\]/)
    }
  })

  // ⚠️ PIÈGE Nº2 — UN SPAWN N'A PAS TOUJOURS DE RANGÉE, et c'est le cas NORMAL. `y` est facultatif :
  // absent, il veut dire « pose-le sur la surface », et `spawnFeetRow` la calcule depuis le relief. Un
  // garde-fou écrit avec `sp.y === uneRangée` ne compare donc rien pour la majorité des monstres —
  // c'est exactement ce qui a laissé vingt-trois monstres se faire emmurer.
  //
  // ⚠️ ET LE TEST EST COMPORTEMENTAL, PAS TEXTUEL. La première version cherchait `.y` dans la source et
  // signalait les dizaines d'usages parfaitement légitimes. Ce qui compte n'est pas qu'on écrive `.y`,
  // c'est que le validateur attrape un monstre SANS rangée enfermé dans la roche.
  it('monstersInRock attrape un monstre SANS rangée écrite', () => {
    const base = {
      id: 't', name: 't', biome: 'foret', widthTiles: 20, heightTiles: 12,
      platforms: [], gaps: [], hazards: [], bridges: [], ladders: [],
      rockBands: [{ x: 4, y: 8, w: 4, h: 3, solid: true }],
    }
    const sansRangee = monstersInRock({ ...base, spawns: [{ monsterId: 'gloopy', x: 5 }] } as never)
    expect(sansRangee.length, 'un monstre sans y posé dans la roche passe inaperçu').toBe(1)
    expect(monstersInRock({ ...base, spawns: [{ monsterId: 'gloopy', x: 15 }] } as never)).toEqual([])
  })

  // ⚠️ PIÈGE Nº3 — UN VALIDATEUR QUE PERSONNE N'APPELLE EST UN TROU. Deux règles écrites pour répondre
  // mot pour mot à des plaintes du joueur (« les oiseaux partent de sous le sol », « je ne veux QUE des
  // trampolines utiles ») n'étaient branchées NULLE PART : ni dans le jeu, ni dans la sélection de
  // graines, ni dans un test.
  //
  // ⚠️ ET LA PREMIÈRE VERSION DE CE TEST AVAIT LE DÉFAUT QU'ELLE DÉNONCE : une liste de fichiers tenue
  // à la main, qui déclarait `maxDiveRows` orpheline alors que `lacs-apnee.test.ts` l'appelle. Un test
  // qui repose sur une liste à maintenir périme à la première addition. Il parcourt donc l'arbre.
  it('chaque validateur exporté est appelé quelque part', async () => {
    const fichiers = await arborescence(['src', 'tests'])
    const validateur = fichiers.find((f) => f.chemin.endsWith('core/level-validator.ts'))!
    const noms = [...validateur.texte.matchAll(/^export function ([a-zA-Zé][\w]*)/gm)].map((m) => m[1]!)
    expect(noms.length, 'plus de validateurs ?').toBeGreaterThan(20)
    const ailleurs = fichiers.filter((f) => f !== validateur).map((f) => f.texte).join('\n')
    const orphelins = noms.filter((n) => !new RegExp(`\\b${n}\\s*\\(`).test(ailleurs))
    expect(orphelins, 'des validateurs que rien n\'appelle').toEqual([])
  })
})
