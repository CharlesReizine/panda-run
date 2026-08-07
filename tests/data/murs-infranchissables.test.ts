import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { marchesInfranchissables } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE MUR QU'ON SE PREND EN MARCHANT TOUT DROIT
//
// Retour du joueur : « Colline, le terrain est infaisable dès le début, y a un giga mur trop haut pour
// être sauté. Comment ça passe tes tests ??? »
//
// ⚠️ IL AVAIT RAISON, ET AUCUN VALIDATEUR NE POUVAIT LE VOIR — c'est toute la leçon de ce fichier.
// Sur ce terrain, `unreachablePlatforms`, `strictReach`, `deadEndSurfaces` et `unreachableLadders`
// répondaient tous ZÉRO. Ils raisonnent en GRAPHE : « existe-t-il un chemin, quel qu'il soit, vers
// cette plateforme ? » — et il en existait un, par un enchaînement d'échelles suspendues à l'autre bout
// du module. Le joueur, lui, ne parcourt pas un graphe : il avance vers la droite et se cogne.
//
// UN TERRAIN PEUT ÊTRE ENTIÈREMENT « ATTEIGNABLE » ET PARFAITEMENT INFAISABLE. C'est le trou de tout
// notre outillage, et il aura fallu qu'un joueur se cogne pour qu'on le voie.
//
// ⚠️ CE QUE CE TEST NE PROUVE PAS. Il mesure la SILHOUETTE, pas la jouabilité complète : un mur compté
// ici peut être contournable (on retombe au sol et on remonte ailleurs). C'est le cas de la majorité
// du résidu — `escalier-pierre` en tête, dont les blocs isolés se sautent. Il sert donc de SEUIL : il
// ne dit pas « tout va bien », il dit « ça n'a pas empiré ». Les faire baisser est un progrès ; les
// monter demande une raison écrite.
//
// LA CAUSE PRINCIPALE A ÉTÉ CORRIGÉE : la rampe d'accroche des motifs INVERSÉS s'arrêtait en route
// quand la montée dépassait ce que six tuiles permettent, laissant un mur de huit rangées au début de
// Colline. Elle prend désormais la largeur que son dénivelé réclame, mesurée en deux passes (bâtir le
// motif pour connaître son sommet, puis rejouer). 202 murs → 172, et Colline commence par un chemin.
//
// LE PRIX A ENSUITE ÉTÉ REMBOURSÉ. Les paliers ajoutés retombaient près du sol (corniches collées 77 →
// 136). Deux corrections l'ont effacé : une rampe ne pose plus de palier à l'altitude 1 (le sol du monde
// EST déjà cette surface), et les cinq derniers motifs qui plantaient leur plancher à 1 ont été relevés.
// Après regravure : murs 202 → 160, marches de rampe 13 → 0, collées 136 → 82, doubles planchers 4 → 2.

const nonBoss = Object.values(LEVELS).filter((l) => !l.boss)

// Comptes relevés terrain par terrain. Un terrain qui EMPIRE fait tomber le test avec son nom.
//
// ⚠️ RELEVÉS APRÈS REGRAVURE, et les plaines ont bougé dans les deux sens : plaine-4 tombe de 2 à 0,
// plaine-5 monte de 0 à 2. C'est le propre d'une regravure — les plans sont RE-CHOISIS sous la nouvelle
// géométrie, et un terrain n'est pas le même qu'avant. Le total, lui, ne remonte pas (38 → 35) : c'est
// lui qui fait foi, ces seuils-ci ne servent qu'à nommer le coupable quand il empire.
const SEUILS: Record<string, number> = {
  'plaine-1': 0, 'plaine-2': 0, 'plaine-3': 0, 'plaine-4': 0, 'plaine-5': 0, 'plaine-6': 0, 'plaine-7': 2,
}

describe('murs infranchissables', () => {
  it('le total ne remonte pas', () => {
    const total = nonBoss.reduce((n, l) => n + marchesInfranchissables(l).length, 0)
    // ⚠️ CE PLAFOND EST UN CLIQUET : il descend, il ne remonte jamais. 160 au relevé initial, 94 après le
    // comblement des puits entre marches de pierre, 66 après la pose d'escaliers contre les falaises,
    // 36 une fois l'EAU reconnue comme une aide — un bassin entre deux mesas se lisait comme un mur de
    // huit rangées alors qu'on le traverse à la nage, de plain-pied avec les deux rives.
    // Le baisser à chaque gain est ce qui empêche une passe suivante de reperdre le terrain gagné sans
    // que personne ne le voie — c'est exactement comme ça que les 160 étaient arrivés.
    //
    // 160 → 94 → 66 → 36, puis 38 le temps de dégager les trampolines coincés (ils excusaient deux
    // murs par simple voisinage, la mesure a cessé d'être flattée), 35 après regravure, 37 après la
    // seconde — celle qui ouvre le sol sous les motifs d'échelle et de saut. Deux murs de plus pour un
    // sol troué là où il devait l'être : le compte remonte parce que le terrain a changé de nature,
    // pas parce qu'il s'est dégradé. C'est le genre d'écart qui doit s'écrire, pas se lisser.
    // …38 depuis que les trampolines se placent à la meilleure colonne de leur surface (en bougeant, ils
    // cessent d'excuser par voisinage un mur déjà là), et 45 depuis l'arrivée des six motifs de rebond.
    //
    // ⚠️ CES SEPT-LÀ SONT DES MURS PAR CONSTRUCTION, ET C'EST LEUR RAISON D'ÊTRE. `trampoline-mur` pose
    // une colonne de pierre de huit rangées sans la moindre prise : c'est EXACTEMENT ce que ce validateur
    // cherche, et il a raison de la voir. La différence est qu'un trampoline est posé au pied, à portée
    // de rebond — ce que la mesure ne sait pas distinguer d'un mur subi. Le chiffre monte donc parce que
    // le jeu contient enfin des obstacles voulus, pas parce qu'il s'est dégradé.
    expect(total, 'des murs sont apparus depuis la dernière mesure').toBeLessThanOrEqual(45)
  })

  it('aucun terrain de plaine n\'empire', () => {
    const pires: string[] = []
    for (const [id, seuil] of Object.entries(SEUILS)) {
      const l = LEVELS[id]
      if (!l) continue
      const murs = marchesInfranchissables(l)
      if (murs.length > seuil) {
        pires.push(`${id} : ${murs.length} (seuil ${seuil}) — ` +
          murs.slice(0, 3).map((m) => `x${m.x} ${m.de}→${m.a} (${m.hauteur} rangées)`).join(' · '))
      }
    }
    expect(pires, `terrains dégradés :\n   ${pires.join('\n   ')}`).toEqual([])
  })

  // ── L'EAU N'EST PAS UN MUR : ON NAGE ────────────────────────────────────────────
  //
  // Le validateur rendait la silhouette du FOND d'un bassin. Un lac creusé entre deux mesas — rives à
  // la rangée 16, fond à la 23, sol du monde à la 24 — se comptait donc comme un mur de huit rangées,
  // alors qu'on le traverse à la SURFACE, de plain-pied avec les deux rives. Trente-deux des soixante-six
  // murs qui restaient étaient ce faux positif-là, et il désignait les mauvais coupables : plaine-1,
  // plaine-2 et plaine-3 n'avaient en réalité aucun mur.
  //
  // La lave, elle, reste un mur : on n'y nage pas, on y meurt. Et la profondeur ne se juge pas ici —
  // l'apnée a son propre validateur (`overDeepBasins`).
  const rive = (kind: 'basin' | 'lave') => ({
    id: 'test', name: 'test', biome: 'plaine', widthTiles: 30, heightTiles: 26,
    // rive gauche à la rangée 16, plan d'eau au milieu, rive droite à la 16 : de plain-pied
    platforms: [{ x: 0, y: 16, w: 10 }, { x: 20, y: 16, w: 10 }],
    rockBands: [{ x: 0, y: 17, w: 10, h: 8 }, { x: 20, y: 17, w: 10, h: 8 }],
    hazards: [{ kind: 'water' as const, x: 10, w: 10, top: 16, h: 8, water: kind }],
    spawns: [],
  })

  it('un lac entre deux rives ne compte pas comme un mur — on le traverse à la nage', () => {
    expect(marchesInfranchissables(rive('basin') as never)).toEqual([])
  })

  // Et la contrepartie : au bord de la LAVE, un vrai mur reste un mur. Si la lave comptait comme aide,
  // elle blanchirait tout ce qui se trouve à trois colonnes d'elle — y compris une face de mesa qui
  // n'a rien à voir avec elle, et qu'aucune nage ne franchira jamais.
  const bordDeLave = (kind: 'basin' | 'lave') => ({
    id: 'test', name: 'test', biome: 'enfer', widthTiles: 30, heightTiles: 26,
    // sol du monde à la rangée 24 ; mare en x10-13 ; puis 2 colonnes de sol ; puis une mesa de 8 rangées
    platforms: [{ x: 16, y: 16, w: 12 }],
    rockBands: [{ x: 16, y: 17, w: 12, h: 8 }],
    hazards: [{ kind: 'water' as const, x: 10, w: 4, top: 20, h: 4, water: kind }],
    spawns: [],
  })

  it("au bord de la lave, la face de mesa reste un mur — la lave n'aide personne", () => {
    expect(marchesInfranchissables(bordDeLave('lave') as never).length).toBeGreaterThan(0)
    // la même mare en EAU blanchit la face : on nage jusqu'à la surface, puis on prend pied
    expect(marchesInfranchissables(bordDeLave('basin') as never)).toEqual([])
  })

  it('un mur signalé est bien plus haut qu\'un saut, et se lit', () => {
    for (const l of nonBoss) {
      for (const m of marchesInfranchissables(l)) {
        expect(m.hauteur, `${l.id} x${m.x}`).toBeGreaterThan(4) // au-delà de la hauteur de saut
        expect(m.de - m.a, `${l.id} x${m.x}`).toBe(m.hauteur)   // la mesure est cohérente avec ses bornes
        expect(m.x).toBeGreaterThan(0)
        expect(m.x).toBeLessThan(l.widthTiles)
      }
    }
  })
})
