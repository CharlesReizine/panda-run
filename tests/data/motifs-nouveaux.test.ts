import { describe, it, expect } from 'vitest'
import { LEVEL_MODULE_KINDS, LEVELS } from '../../src/data/levels'
import { CATALOG, buildLevelFromModules, type ModuleKind } from '../../src/data/level-modules'
import { TILE, maxJumpHeightPx } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES NOUVEAUX MOTIFS EXISTENT VRAIMENT DANS LE JEU
//
// Demande du user : cinq motifs eau/grotte, plus des trampolines, « et inclus-en dans des niveaux à tous
// niveaux, je trouve que c'est un peu répétitif là ».
//
// ⚠️ CE TEST EXISTE PARCE QUE J'AI FAILLI LIVRER DES MOTIFS FANTÔMES. Ajoutés en fin de la rotation d'eau,
// les quatre motifs n'apparaissaient dans AUCUN terrain : la rotation est lue en `idx % longueur`, et les
// entrées de fin ne sont atteintes que par les biomes assez longs. Le code existait, le contenu non — et
// rien ne le signalait. Un motif écrit mais jamais généré coûte exactement autant qu'un motif absent.

const kindsUtilises = new Set<string>(Object.values(LEVEL_MODULE_KINDS).flat())
const terrainsAvec = (k: ModuleKind) =>
  Object.entries(LEVEL_MODULE_KINDS).filter(([, ks]) => ks.includes(k)).map(([id]) => id)

describe('les motifs posés sont réellement générés', () => {
  const poses: ModuleKind[] = ['cascade-plus-haute', 'boyau-tresor-retour', 'trampoline-plat', 'trampoline-vide', 'trampoline-corniche']

  it.each(poses)('%s apparaît dans au moins un terrain', (k) => {
    expect(terrainsAvec(k).length, `${k} n'est généré nulle part`).toBeGreaterThan(0)
  })

  it('ils sont répartis du début à la fin du jeu, pas groupés', () => {
    const ordre = Object.keys(LEVELS)
    const idx = poses.flatMap((k) => terrainsAvec(k)).map((id) => ordre.indexOf(id))
    expect(Math.min(...idx), 'rien en début de jeu').toBeLessThan(ordre.length / 2)
    expect(Math.max(...idx), 'rien en fin de jeu').toBeGreaterThan(ordre.length / 2)
  })
})

describe('les motifs longtemps retenus sont enfin posés', () => {
  // ⚠️ CE BLOC AFFIRMAIT L'INVERSE, ET C'EST LE POINT INTÉRESSANT. Trois motifs étaient écrits mais NON
  // posés : le budget de modules par terrain était plein, et en poser un de plus faisait disparaître des
  // familles entières du jeu. Deux changements ont levé le blocage, tous deux autorisés explicitement :
  // les terrains ont été RALLONGÉS (« rajoute des modules, je m'en fous de ton 50 ») et la couverture des
  // familles est désormais ÉPINGLÉE au lieu d'être tirée au sort — donc en ajouter un n'en supprime plus
  // un autre. Le motif à double passage a en plus reçu le droit d'être TRÈS HAUT (« fais un truc très haut
  // c'est top »), avec une exception nommée à la règle de silhouette.
  const desormaisPoses: ModuleKind[] = ['cascade-deux-passages', 'cascade-deux-passages-g', 'colonnes-perilleuses']

  it.each(desormaisPoses)('%s est bien généré quelque part', (k) => {
    expect(terrainsAvec(k).length, `${k} n'est généré nulle part`).toBeGreaterThan(0)
  })

  it('« trampoline-echelle » est posé lui aussi : plus aucun motif écarté', () => {
    // Écarté un temps (« oublie pour le moment »), puis réclamé (« je veux retrouver TOUS les motifs »).
    // Il a fallu poser son échelle sur une corniche au lieu de la suspendre : deux validateurs sur trois ne
    // modélisent pas le rebond et la déclaraient « pied dans le vide ». La sensation est la même — on saute
    // dans le vide pour attraper l'échelle — mais elle se vérifie.
    expect(CATALOG['trampoline-echelle'], 'le motif a disparu du catalogue').toBeDefined()
    expect(terrainsAvec('trampoline-echelle').length).toBeGreaterThan(0)
  })
})

describe('les aqueducs sont MARCHABLES, plus décoratifs', () => {
  // ⚠️ CE BLOC A CHANGÉ DE NATURE, ET C'EST LE POINT. Il vérifiait un décor de fond posé dix rangées au-dessus
  // du terrain. Retour du user : « je veux pas que ça soit décoratif dessiné, je veux que ça soit de la
  // matière sur laquelle on peut marcher ». L'aqueduc est donc devenu un MODULE : son tablier remplace le sol
  // et se traverse à pied. Ce qu'on vérifie maintenant, c'est justement qu'on peut marcher dessus.
  const avec = Object.values(LEVELS).filter((l) => (l.arches ?? []).length > 0)

  it('des terrains en portent, distribués par l\'ordonnanceur', () => {
    expect(avec.length).toBeGreaterThan(3)
  })

  it('chaque aqueduc a une PLATEFORME sous ses pieds : c\'est ce qui le rend marchable', () => {
    for (const l of avec) {
      for (const a of l.arches ?? []) {
        const tablier = l.platforms.some((p) => p.y === a.y && p.x <= a.x && p.x + p.w >= a.x + a.w)
        expect(tablier, `${l.id}: aqueduc en x${a.x} sans tablier`).toBe(true)
      }
    }
  })

  it('sous le tablier, il y a vraiment quelque chose : du vide ou de l\'eau', () => {
    for (const l of avec) {
      for (const a of l.arches ?? []) {
        const vide = (l.gaps ?? []).some((g) => g.x >= a.x && g.x < a.x + a.w)
        const eau = (l.hazards ?? []).some((h) => h.kind === 'water' && h.x < a.x + a.w && h.x + h.w > a.x)
        expect(vide || eau, `${l.id}: aqueduc en x${a.x} posé sur du sol plein`).toBe(true)
      }
    }
  })

  it('leur largeur VARIE : ce n\'est pas le même ouvrage recopié', () => {
    const largeurs = new Set(avec.flatMap((l) => (l.arches ?? []).map((a) => a.w)))
    expect(largeurs.size).toBeGreaterThan(1)
  })
})

describe('le zigzag OBLIGE vraiment à faire gauche-droite-gauche', () => {
  // Retour du user : « les paliers sont trop proches en hauteur, j'ai même pas besoin de faire
  // gauche-droite-gauche, je peux juste sauter et ça passe. »
  //
  // Il avait raison, et le défaut était arithmétique. Les passerelles de TERRE se traversent PAR LE BAS
  // (one-way) : ce qui décide si on peut tricher, ce n'est donc pas l'écart entre deux marches
  // successives, mais l'écart entre deux marches de la MÊME COLONNE. À +2 rangées par marche, la même
  // colonne revenait 4 rangées plus haut — 128 px, juste sous les ~130 px de saut. On montait tout droit
  // en traversant ses propres passerelles.
  //
  // ⚠️ ON TESTE LE MODULE SEUL, pas un terrain complet : dans un terrain assemblé, d'autres motifs posent
  // des plateformes étroites aux mêmes abscisses et le test mesurerait leur écart à elles. Le motif isolé
  // dit exactement ce qu'on veut savoir.
  const seul = buildLevelFromModules(
    [{ kind: 'passerelles-zigzag', widthRange: [22, 22], fillBelow: 'sol', fillAbove: 'air', tags: [] }],
    { id: 'test-zigzag', name: 'Zigzag', biome: 'plaine' },
  )

  it('le motif est bien posé dans de vrais terrains', () => {
    const zig = Object.keys(LEVELS).filter((id) => (LEVEL_MODULE_KINDS[id] ?? []).includes('passerelles-zigzag'))
    expect(zig.length, 'passerelles-zigzag n\'est généré nulle part').toBeGreaterThan(0)
  })

  it('deux passerelles de la MÊME colonne sont hors de portée d\'un saut', () => {
    const saut = maxJumpHeightPx()
    const colonnes = new Map<number, number[]>()
    for (const pf of seul.platforms) {
      if (pf.w > 4) continue // berges et palier de sortie : ce ne sont pas des passerelles
      colonnes.set(pf.x, [...(colonnes.get(pf.x) ?? []), pf.y])
    }
    expect(colonnes.size, 'aucune passerelle étroite : le motif a changé de forme').toBeGreaterThan(1)
    for (const [x, ys] of colonnes) {
      const tries = [...ys].sort((a, b) => b - a)
      for (let i = 1; i < tries.length; i++) {
        const ecart = (tries[i - 1]! - tries[i]!) * TILE
        expect(ecart, `colonne x${x} : deux passerelles à ${ecart} px — on monte tout droit`).toBeGreaterThan(saut)
      }
    }
  })

  it('mais la marche EN DIAGONALE, elle, reste franchissable', () => {
    const saut = maxJumpHeightPx()
    const etroites = seul.platforms.filter((pf) => pf.w <= 4).sort((a, b) => b.y - a.y)
    for (let i = 1; i < etroites.length; i++) {
      const ecart = (etroites[i - 1]!.y - etroites[i]!.y) * TILE
      expect(ecart, 'la marche suivante est devenue inatteignable').toBeLessThanOrEqual(saut)
    }
  })
})
