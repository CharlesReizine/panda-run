import { describe, it, expect } from 'vitest'
import {
  rollDrops, rollChestRareItem, chestRarePool, CHEST_RARE_CHANCE, CHEST_RARE_POOL, MARGE_NIVEAU_COFFRE,
  rollMobLegendary, mobLegendaryPool, MOB_LEGENDARY_CHANCE, MOB_LEGENDARY_SOUS, MOB_LEGENDARY_SUR,
  butinDecevant, consolationDeCoffre, CONSOLATIONS, NOM_COFFRE_VIDE,
} from '../../src/core/loot'
import { minLevelOf } from '../../src/core/item-level'
import { ITEMS } from '../../src/data/items'
import { PROPS } from '../../src/data/props'
import type { DropEntry } from '../../src/core/types'

const drops: DropEntry[] = [
  { kind: 'gold', chance: 1, min: 5, max: 10 },
  { kind: 'potion', chance: 0.5, min: 1, max: 1 },
  { kind: 'item', itemId: 'epee-bambou', chance: 0.1, min: 1, max: 1 },
  { kind: 'material', materialId: 'minerai-fer', chance: 0.2, min: 1, max: 1 },
]

describe('rollDrops', () => {
  it('rng à 0 : tout drop, quantités min', () => {
    const r = rollDrops(drops, () => 0)
    expect(r.gold).toBe(5)
    expect(r.potions).toBe(1)
    expect(r.items).toEqual(['epee-bambou'])
    expect(r.materials).toEqual(['minerai-fer'])
  })

  it('rng à 0.99 : seul le drop garanti tombe, quantité max', () => {
    const r = rollDrops(drops, () => 0.99)
    expect(r.gold).toBe(10)
    expect(r.potions).toBe(0)
    expect(r.items).toEqual([])
    expect(r.materials).toEqual([])
  })

  it('un DropEntry material à chance 1 sort dans result.materials', () => {
    const r = rollDrops([{ kind: 'material', materialId: 'gemme-brute', chance: 1, min: 1, max: 1 }], () => 0)
    expect(r.materials).toEqual(['gemme-brute'])
  })
})

describe('rollChestRareItem', () => {
  it('le pool ne contient que des équipements épiques/légendaires', () => {
    expect(CHEST_RARE_POOL.length).toBeGreaterThan(0)
    for (const id of CHEST_RARE_POOL) {
      const item = ITEMS[id]!
      expect(item.slot).toBeTruthy()
      expect(['epique', 'legendaire']).toContain(item.rarity)
    }
  })

  it('rng au-dessus du seuil : aucun objet rare (tirage commun)', () => {
    expect(rollChestRareItem(45, () => 0.99)).toBeNull()
    expect(rollChestRareItem(45, () => CHEST_RARE_CHANCE)).toBeNull()
  })

  it('rng sous le seuil : un objet du pool rare est tiré', () => {
    const id = rollChestRareItem(45, () => 0)
    expect(id).not.toBeNull()
    expect(CHEST_RARE_POOL).toContain(id)
  })

  // ── LE COFFRE NE LÂCHE QUE CE QUI A DU SENS LÀ OÙ IL EST ────────────────────────────────────
  //
  // « J'ai l'impression qu'Émile a chopé des objets légendaires de niveau 30 alors qu'il était tout au
  // début du jeu, c'est absurde non ? » — puis la règle : « un monstre devrait pouvoir lâcher que des
  // objets pas trop loin de son niveau ». Le tirage était pire que soupçonné : SOIXANTE-SEPT objets du
  // niveau 1 au 45, uniformément, un coffre sur vingt-cinq.
  //
  // Le vrai dégât n'est pas l'objet inutilisable trente niveaux durant — c'est qu'une fois le niveau
  // atteint, on l'a DÉJÀ, et que tout ce qu'on aurait pu convoiter entre-temps ne vaut plus rien.
  it('un coffre de début de jeu ne lâche jamais un objet de fin de jeu', () => {
    for (const id of chestRarePool(1)) {
      expect(minLevelOf(ITEMS[id]!), `${id} tombe au niveau 1`).toBeLessThanOrEqual(1 + MARGE_NIVEAU_COFFRE)
    }
  })

  it('le pool grandit avec le niveau du lieu, et couvre tout à la fin', () => {
    const tailles = [1, 10, 20, 30, 45].map((n) => chestRarePool(n).length)
    expect(tailles).toEqual([...tailles].sort((a, b) => a - b)) // monotone croissante
    expect(chestRarePool(45).length).toBe(CHEST_RARE_POOL.length) // au bout, plus rien n'est retenu
    expect(tailles[0]).toBeLessThan(tailles[tailles.length - 1]!)
  })

  it("le pool n'est JAMAIS vide, même au niveau 1", () => {
    for (let n = 1; n <= 45; n++) expect(chestRarePool(n).length, `niveau ${n}`).toBeGreaterThan(0)
  })

  it('le tirage respecte le niveau du lieu', () => {
    // rng = 0 → on tire le premier du pool ; rng juste sous 1 → le dernier. Les deux bouts doivent
    // rester sous le plafond, sinon le filtre serait appliqué à la probabilité mais pas au choix.
    for (const alea of [0, 0.999]) {
      const id = rollChestRareItem(3, () => (alea === 0 ? 0 : 0.001 + alea * 0))
      if (id) expect(minLevelOf(ITEMS[id]!)).toBeLessThanOrEqual(3 + MARGE_NIVEAU_COFFRE)
    }
    const tires = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const id = rollChestRareItem(3, (() => { let k = 0; return () => (k++ === 0 ? 0 : (i % 97) / 97) })())
      if (id) tires.add(id)
    }
    for (const id of tires) expect(minLevelOf(ITEMS[id]!), id).toBeLessThanOrEqual(3 + MARGE_NIVEAU_COFFRE)
  })

  it('la probabilité reste basse (événement rare)', () => {
    expect(CHEST_RARE_CHANCE).toBeLessThanOrEqual(0.05)
  })

  // ── UN MONSTRE PEUT LÂCHER UN LÉGENDAIRE DE SON NIVEAU, TRÈS TRÈS RAREMENT ──────────────────
  //
  // « Les mobs peuvent peut-être également drop du légendaire de leur niveau avec un très très très
  // faible taux. » C'est la contrepartie du bornage des coffres : une porte plus étroite, mais méritée.
  it('le taux reste de l\'ordre du millième', () => {
    expect(MOB_LEGENDARY_CHANCE).toBeLessThanOrEqual(0.002)
    expect(MOB_LEGENDARY_CHANCE).toBeGreaterThan(0)
    // et il est BIEN plus rare que le coffre, sinon la bête volerait la vedette au trésor
    expect(MOB_LEGENDARY_CHANCE).toBeLessThan(CHEST_RARE_CHANCE / 5)
  })

  it('le coffre est devenu moins fréquent', () => {
    expect(CHEST_RARE_CHANCE).toBeLessThanOrEqual(0.02)
  })

  it('rien ne tombe au-dessus du seuil', () => {
    expect(rollMobLegendary(40, () => 0.5)).toBeNull()
    expect(rollMobLegendary(40, () => MOB_LEGENDARY_CHANCE)).toBeNull()
  })

  it('la fenêtre est bornée DES DEUX CÔTÉS — pas de trophée dérisoire sur une grosse bête', () => {
    for (const niveau of [1, 7, 15, 20, 25, 31, 38, 45]) {
      for (const id of mobLegendaryPool(niveau)) {
        const n = minLevelOf(ITEMS[id]!)
        expect(n, `${id} sur une bête de niveau ${niveau}`).toBeGreaterThanOrEqual(niveau - MOB_LEGENDARY_SOUS)
        expect(n, `${id} sur une bête de niveau ${niveau}`).toBeLessThanOrEqual(niveau + MOB_LEGENDARY_SUR)
      }
    }
  })

  it('ne lâche QUE du légendaire', () => {
    for (const niveau of [1, 10, 20, 30, 45]) {
      for (const id of mobLegendaryPool(niveau)) expect(ITEMS[id]!.rarity, id).toBe('legendaire')
    }
  })

  it("une fenêtre vide ne lâche rien, plutôt que n'importe quoi", () => {
    for (let n = 1; n <= 50; n++) {
      const tire = rollMobLegendary(n, () => 0)
      if (mobLegendaryPool(n).length === 0) expect(tire, `niveau ${n}`).toBeNull()
      else expect(mobLegendaryPool(n), `niveau ${n}`).toContain(tire)
    }
  })

  // ── LE COFFRE DÉCEVANT ET SA PETITE HUMILIATION ────────────────────────────────────────────
  //
  // « On peut peut-être prévoir une petite anim pour les coffres quand on trouve rien dedans. Un truc
  // qui fout un peu le seum ? » Ce n'est pas qu'une blague : un coffre qui ne donne presque rien
  // produisait exactement la même chose qu'un coffre qui bugue — couvercle, onde dorée, puis rien de
  // notable. Une déception mise en scène est une information ; une déception muette est un doute.
  //
  // ⚠️ « RIEN » NE POUVAIT PAS ÊTRE PRIS AU PIED DE LA LETTRE. Aucun coffre du jeu ne peut être vide :
  // l'or tombe à 100 % partout. Descendre l'or du coffre de bois à 88 % a été essayé et REFUSÉ par
  // `shop-economy` — le pire tirage à l'arrivée à Prontera tombait à 334 pièces, sous les 350 de l'arme
  // la moins chère. Le jeu promet qu'on puisse s'armer en arrivant ; un gag ne vaut pas qu'on la reprenne.
  //
  // ⚠️ ET LE FAUX POSITIF EST CE QU'IL FAUT CRAINDRE : se moquer d'un joueur qui vient de gagner
  // quelque chose serait bien pire que le silence. Chaque source de butin est donc testée seule.
  const bois = PROPS['coffre']!.drops!
  const rien = { gold: 0, potions: 0, items: [] as string[], materials: [] as string[] }

  it('rien du tout, ou de l\'or au ras de la fourchette : le coffre a déçu', () => {
    expect(butinDecevant(rien, bois)).toBe(true)
    expect(butinDecevant({ ...rien, gold: 25 }, bois), '25 sur 25-60').toBe(true)
    expect(butinDecevant({ ...rien, gold: 42 }, bois), '42 sur 25-60').toBe(true)
  })

  it('un butin correct ne se fait jamais moquer', () => {
    expect(butinDecevant({ ...rien, gold: 55 }, bois), 'haut de fourchette').toBe(false)
    expect(butinDecevant({ ...rien, gold: 25, potions: 1 }, bois), 'potion').toBe(false)
    expect(butinDecevant({ ...rien, gold: 25, items: ['grelot-porte-bonheur'] }, bois), 'objet').toBe(false)
    expect(butinDecevant({ ...rien, gold: 25, materials: ['gemme-brute'] }, bois), 'materiau').toBe(false)
    expect(butinDecevant({ ...rien, gold: 25 }, bois, 'epee-du-jugement'), 'tresor rare').toBe(false)
  })

  it('« dérisoire » se juge par rapport à CE coffre, pas dans l\'absolu', () => {
    // 300 pièces sont une misère dans un coffre d'or (240-520) et une fortune dans un coffre de bois
    expect(butinDecevant({ ...rien, gold: 300 }, PROPS['coffre-or']!.drops!)).toBe(true)
    expect(butinDecevant({ ...rien, gold: 300 }, bois)).toBe(false)
    expect(butinDecevant({ ...rien, gold: 60 }, bois), 'plafond du coffre de bois').toBe(false)
  })

  it('la moquerie arrive assez souvent pour exister, assez rarement pour piquer', () => {
    // tirage déterministe : on balaie l'espace des probabilités au lieu de secouer un rng
    let decus = 0
    const N = 400
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N
      if (butinDecevant(rollDrops(bois, () => u), bois)) decus++
    }
    const taux = decus / N
    // ⚠️ LA BORNE BASSE A ÉTÉ RELEVÉE SUR RETOUR DE JEU : « j'ai des coffres où quand je les ouvre ça
    // fait pas d'anim même si y a rien ». À un coffre de bois sur sept, on en ouvrait cinq de suite
    // sans jamais la voir — une mise en scène qu'on ne rencontre pas n'existe pas.
    expect(taux, `taux de coffres décevants : ${Math.round(taux * 100)} %`).toBeGreaterThan(0.25)
    expect(taux, `taux de coffres décevants : ${Math.round(taux * 100)} %`).toBeLessThan(0.45)
  })

  // ── LE LOT DE CONSOLATION ──────────────────────────────────────────────────────────────────
  //
  // « Quand on trouve un objet tu l'affiches en gros. La même animation me va quand on trouve rien,
  // mais on peut peut-être display une plume ou une toile d'araignée ou un truc comme ça. »
  //
  // ⚠️ AUCUN N'ENTRE DANS L'INVENTAIRE, et c'est ce que ce test protège. Les faire ramasser obligerait
  // à les définir dans ITEMS, où chaque entrée attend une illustration, un emplacement et un palier de
  // niveau. Une plaisanterie ne doit pas coûter une ligne au modèle de données.
  it('les lots de consolation ne sont PAS des objets du jeu', () => {
    for (const lot of CONSOLATIONS) {
      expect(ITEMS[lot.key], `${lot.key} est entré dans ITEMS`).toBeUndefined()
      expect(lot.key.startsWith('lot-'), lot.key).toBe(true)
    }
  })

  // ⚠️ L'IMAGE VARIE, LE MOT NON. Demande explicite : « écris pas "plume, toile d'araignée…", si c'est
  // vide tu écris "Coffre vide" et tu gardes les images ». Nommer la plume la présentait comme un LOT —
  // on cherchait à quoi elle servait, on la guettait dans un inventaire où elle n'entre jamais. L'image
  // fait la blague, le mot fait le constat.
  it('tous les lots s\'annoncent « Coffre vide », quelle que soit l\'image', () => {
    expect(CONSOLATIONS.length).toBeGreaterThan(1)
    expect(new Set(CONSOLATIONS.map((l) => l.key)).size, 'les images, elles, doivent différer').toBe(CONSOLATIONS.length)
    for (const lot of CONSOLATIONS) {
      expect(lot.nom, lot.key).toBe(NOM_COFFRE_VIDE)
      // il s'affiche sous une icône plein cadre : au-delà, ça déborde
      expect(lot.nom.length, lot.nom).toBeLessThanOrEqual(28)
    }
  })

  it('le tirage reste dans le catalogue, aux deux bouts', () => {
    expect(CONSOLATIONS).toContain(consolationDeCoffre(() => 0))
    expect(CONSOLATIONS).toContain(consolationDeCoffre(() => 0.999))
    expect(CONSOLATIONS).toContain(consolationDeCoffre(() => 1)) // rng dégénéré : jamais undefined
  })

  // ⚠️ ET CHAQUE LOT DOIT AVOIR SON IMAGE. La révélation affiche `lot.key` en plein cadre : si la
  // texture n'était pas générée, on présenterait un carré vide en grande pompe — le bug aurait l'air
  // d'être la blague. Ces images ne viennent pas de `public/art` (ce ne sont pas des objets du jeu),
  // elles sont dessinées à la main dans PreloadScene, donc rien d'autre ne peut le vérifier.
  it('chaque lot de consolation a sa texture dessinée dans PreloadScene', async () => {
    const mod = 'node:fs'
    const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync: (p: string, e: string) => string }
    const source = fs.readFileSync('src/scenes/PreloadScene.ts', 'utf8')
    for (const lot of CONSOLATIONS) {
      expect(source, `${lot.key} n'est généré nulle part`).toContain(`generateTexture('${lot.key}'`)
    }
  })
})