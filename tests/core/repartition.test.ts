import { describe, it, expect } from 'vitest'
import {
  STATS, BUILDS, VIDE, pourcentages, totalReparti, suggerer, pointsToile, cadreToile,
  type Repartition,
} from '../../src/core/repartition'
import {
  PAGE, yLigneStat, etiquettesTiennent, listeTientDansLaPage, toileTientDansLaPage,
  largeurEffet, tronquer, tientDans, POLICE,
} from '../../src/scenes/stats-layout'
import { CLASSES } from '../../src/data/classes'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA PAGE STAT : QUATRE STATS, UNE TOILE, UN BOUTON QUI DÉCIDE
//
// Demande du joueur : « une page "Stat" où je peux changer les stats (quitte à rajouter VIT, INT), une
// jolie toile où je vois comment j'ai pondéré mon perso en pourcentage de points affectés, et un bouton
// "Suggérer" qui suit un build un peu classique par classe. »
//
// ⚠️ « INT » DONNAIT DES POINTS DE VIE, et c'était le nœud à défaire avant tout le reste. Le libellé
// mentait sur son effet — personne n'attend qu'un point d'intelligence rende plus résistant — et c'est
// probablement une des raisons pour lesquelles personne n'y touchait, l'autre étant qu'on ne pouvait pas
// découvrir le système. INT devient la vraie intelligence (régénération d'énergie), VIT porte les PV, et
// les parties existantes sont migrées pour que personne ne perde ce qu'il avait investi.

const r = (str: number, agi: number, vit: number, int: number): Repartition => ({ str, agi, vit, int })

describe('répartition des stats', () => {
  it('les quatre stats sont distinctes et décrivent leur effet', () => {
    expect(STATS).toHaveLength(4)
    expect(new Set(STATS.map((s) => s.id)).size).toBe(4)
    expect(new Set(STATS.map((s) => s.couleur)).size, 'deux stats de même couleur sur la toile').toBe(4)
    for (const s of STATS) {
      expect(s.effet.length, s.id).toBeGreaterThan(0)
      // à l'impératif et concret : le point FAIT quelque chose, il ne « représente » pas
      expect(s.effet, s.id).toMatch(/\+/)
    }
  })

  // ⚠️ ARRONDIR CHAQUE PART SÉPARÉMENT NE DONNE PAS 100, et une toile dont les parts font 99 % se
  // remarque immédiatement. On distribue le reste sur les plus gros restes.
  it('les pourcentages font TOUJOURS exactement 100', () => {
    const cas = [r(1, 0, 0, 0), r(1, 1, 1, 0), r(7, 3, 5, 2), r(1, 1, 1, 1), r(33, 33, 33, 1), r(2, 3, 5, 7)]
    for (const c of cas) {
      const p = pourcentages(c)
      const somme = STATS.reduce((n, s) => n + p[s.id], 0)
      expect(somme, `${JSON.stringify(c)} → ${JSON.stringify(p)}`).toBe(100)
    }
  })

  it('sans aucun point réparti, tout est à zéro — pas de division par zéro', () => {
    const p = pourcentages(VIDE)
    expect(STATS.every((s) => p[s.id] === 0)).toBe(true)
    expect(totalReparti(VIDE)).toBe(0)
  })

  // ── LE BOUTON SUGGÉRER ─────────────────────────────────────────────────────────────────────
  //
  // ⚠️ UNE SUGGESTION N'EST PAS UNE RÉPARTITION ÉGALE. Le joueur qui appuie veut qu'on décide POUR lui.
  // Distribuer à parts égales serait un non-conseil déguisé en conseil.
  it('chaque classe a un build, et il PENCHE vraiment — sauf le novice', () => {
    for (const c of Object.values(CLASSES)) {
      const b = BUILDS[c.id]
      expect(b, `${c.id} sans build`).toBeDefined()
      expect(b.nom.length).toBeGreaterThan(0)
      const poids = STATS.map((s) => b.poids[s.id])
      // ⚠️ LE NOVICE EST LA SEULE EXCEPTION, ET ELLE EST HONNÊTE : il n'a pas de spécialité, il n'a même
      // pas d'arme de base. Lui proposer un build penché serait le pousser vers une classe qu'il n'a pas
      // encore choisie ; l'équilibre EST le conseil classique tant qu'on ne sait pas ce qu'on deviendra.
      if (c.id === 'novice') { expect(Math.max(...poids) - Math.min(...poids)).toBeLessThanOrEqual(1); continue }
      expect(Math.max(...poids), `${c.id} : build plat`).toBeGreaterThan(Math.min(...poids) + 1)
    }
  })

  it('« Suggérer » dépense TOUS les points, jamais un de plus', () => {
    for (const c of Object.values(CLASSES)) {
      for (const points of [1, 2, 7, 30, 113]) {
        const avant = r(0, 0, 0, 0)
        const apres = suggerer(c.id, avant, points)
        expect(totalReparti(apres), `${c.id} +${points}`).toBe(points)
      }
    }
  })

  // ⚠️ ON NE REPREND JAMAIS UN POINT DÉJÀ PLACÉ. Ils ne se remboursent pas dans ce jeu : une suggestion
  // qui ferait comme si la répartition partait de zéro proposerait un total impossible à atteindre.
  it('elle COMPLÈTE la répartition existante, elle ne la reprend pas', () => {
    const actuel = r(10, 0, 0, 0)
    const apres = suggerer('mage', actuel, 10)
    for (const s of STATS) {
      expect(apres[s.id], `${s.id} a diminué`).toBeGreaterThanOrEqual(actuel[s.id])
    }
    expect(totalReparti(apres)).toBe(20)
  })

  it('elle sert d\'abord la stat de la classe', () => {
    const mage = suggerer('mage', VIDE, 20)
    expect(mage.int, 'un arcaniste sans intelligence').toBeGreaterThan(mage.str)
    const bretteur = suggerer('swordsman', VIDE, 20)
    expect(bretteur.str, 'un bretteur sans force').toBeGreaterThan(bretteur.int)
  })

  it('zéro point à répartir ne change rien', () => {
    const actuel = r(3, 1, 4, 1)
    expect(suggerer('archer', actuel, 0)).toEqual(actuel)
  })

  // ── LA TOILE ───────────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ L'ÉCHELLE EST RELATIVE À LA PLUS GROSSE PART, PAS À 100 %. Sur un perso réparti 40/30/20/10, une
  // toile calée sur 100 % serait un petit point au centre : illisible, et faussement modeste. C'est la
  // FORME qui dit « bretteur » ou « arcaniste », pas la taille.
  it('la plus grosse part touche le bord, les autres sont dedans', () => {
    const pts = pointsToile(pourcentages(r(4, 3, 2, 1)), 0, 0, 100)
    const rayons = pts.map((p) => Math.hypot(p.x, p.y))
    expect(Math.max(...rayons)).toBeCloseTo(100, 5)
    for (const rr of rayons) expect(rr).toBeLessThanOrEqual(100.001)
  })

  it('aucun sommet ne sort du cadre, même avec une répartition extrême', () => {
    for (const c of [r(1, 0, 0, 0), r(0, 0, 0, 1), r(50, 1, 1, 1), VIDE]) {
      for (const p of pointsToile(pourcentages(c), 480, 270, 130)) {
        expect(Math.hypot(p.x - 480, p.y - 270)).toBeLessThanOrEqual(130.001)
      }
    }
  })

  it('le cadre a bien un sommet par stat, tous à la même distance', () => {
    const cadre = cadreToile(0, 0, 60)
    expect(cadre).toHaveLength(STATS.length)
    for (const p of cadre) expect(Math.hypot(p.x, p.y)).toBeCloseTo(60, 5)
  })

  // ── LA MISE EN PAGE ────────────────────────────────────────────────────────────────────────
  //
  // Le contrat posé une fois pour toutes par le joueur : « un test qui m'assure que rien ne dépasse, et
  // tant que c'est pas bon tu déploies pas. »
  it('rien ne déborde de la page', () => {
    expect(listeTientDansLaPage(), 'la liste passe sous la rangée du bas').toBe(true)
    expect(toileTientDansLaPage(), 'la toile mord sur la liste ou sort du cadre').toBe(true)
    expect(etiquettesTiennent(), 'une étiquette de la toile sort de l\'écran').toBe(true)
    expect(yLigneStat(0)).toBeGreaterThan(PAGE.titreY + 30)
  })

  it('les libellés d\'effet tiennent dans leur colonne', () => {
    for (const s of STATS) {
      expect(tientDans(tronquer(s.effet, largeurEffet(), POLICE.effet), largeurEffet(), POLICE.effet), s.id).toBe(true)
    }
  })
})
