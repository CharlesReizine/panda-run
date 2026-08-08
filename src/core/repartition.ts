import type { ClassId } from './types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES QUATRE STATS, CE QU'ELLES FONT, ET COMMENT ON LES RÉPARTIT
//
// Demande du joueur : « je suis chaud si tu peux faire une page "Stat" et je peux changer les stats
// (quitte à rajouter des stats genre VIT, INT), et une jolie toile où je vois comment j'ai pondéré mon
// perso (en pourcentage de points affectés). Je veux aussi un bouton "Suggérer" qui suit un build un peu
// classique par classe. »
//
// ⚠️ « INT » DONNAIT DES POINTS DE VIE, ET C'ÉTAIT LE NŒUD À DÉFAIRE. Le jeu avait trois stats — STR,
// AGI, INT — et l'intelligence augmentait les PV. Personne ne s'attend à ça : dans tout jeu qui
// ressemble à celui-ci, c'est la VITALITÉ qui donne les PV et l'intelligence qui sert à la magie. Le
// libellé mentait sur son effet, et c'est probablement une des raisons pour lesquelles personne n'y
// touchait (l'autre étant qu'on ne pouvait pas le découvrir, cf. R383).
//
// On renomme donc INT → VIT, et on crée une VRAIE intelligence : elle accélère la régénération
// d'énergie, la ressource des compétences. Chaque classe a désormais une stat qui la sert vraiment.
//
// ⚠️ ET LA MIGRATION EST OBLIGATOIRE, PAS OPTIONNELLE. Les parties existantes ont des points dans
// `int` qui leur donnaient des PV : les laisser tels quels les transformerait d'un coup en points
// d'énergie, et le joueur perdrait des PV sans rien avoir fait. `int` devient donc `vit` au chargement,
// et la nouvelle intelligence repart de zéro. Voir core/save.ts.

export type StatId = 'str' | 'agi' | 'vit' | 'int'

export interface StatDef {
  id: StatId
  nom: string
  /** Une ligne, à l'impératif : ce que le point FAIT, pas ce qu'il représente. */
  effet: string
  /** Teinte de la stat sur la toile et dans la liste. */
  couleur: number
}

export const STATS: StatDef[] = [
  { id: 'str', nom: 'FOR', effet: '+2 attaque par point', couleur: 0xef5350 },
  { id: 'agi', nom: 'AGI', effet: '+vitesse d\'attaque et défense', couleur: 0x66bb6a },
  { id: 'vit', nom: 'VIT', effet: '+4 points de vie par point', couleur: 0xffa726 },
  { id: 'int', nom: 'INT', effet: '+régénération d\'énergie (compétences)', couleur: 0x42a5f5 },
]

export type Repartition = Record<StatId, number>

export const VIDE: Repartition = { str: 0, agi: 0, vit: 0, int: 0 }

/** Total des points effectivement répartis. */
export function totalReparti(r: Repartition): number {
  return STATS.reduce((n, s) => n + (r[s.id] ?? 0), 0)
}

/**
 * Pondération du personnage, en pourcentages ENTIERS dont la somme fait exactement 100.
 *
 * ⚠️ ARRONDIR CHAQUE PART SÉPARÉMENT NE DONNE PAS 100, et une toile dont les parts affichées font 99 %
 * ou 101 % se remarque immédiatement. On distribue donc le reste sur les plus gros restes (méthode du
 * plus fort reste) : c'est la seule façon d'avoir des entiers ET une somme juste.
 */
export function pourcentages(r: Repartition): Record<StatId, number> {
  const total = totalReparti(r)
  if (total === 0) return { ...VIDE }
  const exacts = STATS.map((s) => ({ id: s.id, v: ((r[s.id] ?? 0) * 100) / total }))
  const out = {} as Record<StatId, number>
  for (const e of exacts) out[e.id] = Math.floor(e.v)
  let reste = 100 - exacts.reduce((n, e) => n + Math.floor(e.v), 0)
  for (const e of [...exacts].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (reste <= 0) break
    out[e.id]++
    reste--
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES BUILDS SUGGÉRÉS
//
// ⚠️ UNE SUGGESTION N'EST PAS UNE RÉPARTITION ÉGALE. Un build « classique » met l'essentiel dans la
// stat qui sert la classe, un peu de vitalité pour survivre, et le reste en accessoire. Distribuer à
// parts égales serait un non-conseil déguisé en conseil — le joueur qui appuie sur « Suggérer » veut
// qu'on décide POUR lui, pas qu'on lui rende son problème arrondi.
//
// Les poids sont donnés en parts, pas en pourcentages : ils se lisent mieux et se retouchent sans
// avoir à refaire la somme.
export const BUILDS: Record<ClassId, { nom: string; poids: Repartition }> = {
  novice: { nom: 'Équilibré', poids: { str: 3, agi: 2, vit: 3, int: 2 } },
  swordsman: { nom: 'Bretteur', poids: { str: 5, agi: 2, vit: 3, int: 0 } },
  chevalier: { nom: 'Rempart', poids: { str: 4, agi: 2, vit: 4, int: 0 } },
  archer: { nom: 'Tireur', poids: { str: 4, agi: 4, vit: 2, int: 0 } },
  chasseur: { nom: 'Traqueur', poids: { str: 4, agi: 4, vit: 2, int: 0 } },
  mage: { nom: 'Arcaniste', poids: { str: 1, agi: 1, vit: 3, int: 5 } },
  sorcier: { nom: 'Sorcier', poids: { str: 1, agi: 1, vit: 3, int: 5 } },
}

/**
 * Répartit `points` selon le build de la classe, en respectant ce qui est DÉJÀ placé.
 *
 * ⚠️ ON NE REDISTRIBUE PAS L'EXISTANT, ON COMPLÈTE. Les points déjà dépensés ne se reprennent pas dans
 * ce jeu : une suggestion qui ferait comme si la répartition partait de zéro proposerait un total
 * impossible à atteindre. On calcule donc la cible sur le TOTAL final, et on ne distribue que ce qui
 * reste — quitte à ne rien pouvoir corriger d'un mauvais départ, ce qui est la vérité du jeu.
 */
export function suggerer(classId: ClassId, actuel: Repartition, points: number): Repartition {
  const build = BUILDS[classId] ?? BUILDS.novice
  const sommePoids = totalReparti(build.poids)
  if (points <= 0 || sommePoids === 0) return { ...actuel }
  const total = totalReparti(actuel) + points

  // cible idéale par stat, puis ce qu'il manque pour l'atteindre (jamais négatif : on ne reprend rien)
  const manque = STATS.map((s) => {
    const cible = Math.round((total * (build.poids[s.id] ?? 0)) / sommePoids)
    return { id: s.id, manque: Math.max(0, cible - (actuel[s.id] ?? 0)) }
  })

  const out: Repartition = { ...actuel }
  let restants = points
  const sommeManque = manque.reduce((n, m) => n + m.manque, 0)
  if (sommeManque > 0) {
    // on sert au prorata du manque, puis on donne les miettes au plus gros manque restant
    for (const m of manque) {
      const part = Math.min(restants, Math.floor((points * m.manque) / sommeManque))
      out[m.id] += part
      restants -= part
    }
  }
  for (const m of [...manque].sort((a, b) => b.manque - a.manque)) {
    if (restants <= 0) break
    out[m.id]++
    restants--
  }
  // s'il reste encore quelque chose (build à poids nuls partout sauf une stat déjà servie), tout va
  // dans la stat principale : un point non dépensé serait un point perdu.
  if (restants > 0) {
    const principale = STATS.reduce((a, b) => ((build.poids[b.id] ?? 0) > (build.poids[a.id] ?? 0) ? b : a))
    out[principale.id] += restants
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA TOILE
//
// Un radar à quatre branches. La géométrie vit ici, pure, pour que l'écran n'ait qu'à tracer — et
// surtout pour qu'un test puisse vérifier que rien ne sort du cadre, comme pour tous les autres écrans
// de ce projet.

export interface PointToile { x: number; y: number }

/**
 * Sommets du polygone de pondération, dans l'ordre de `STATS`, sur un cercle de rayon `rayon`.
 *
 * ⚠️ LE DÉNOMINATEUR EST LE TOTAL DES POINTS AFFECTÉS, PAS LA PLUS GROSSE PART. La première version
 * calait la plus grosse branche sur le bord, pour que la forme remplisse la toile ; le joueur a tranché
 * l'inverse : « la toile d'araignée, le dénominateur du pourcentage, c'est le nombre total de points
 * assignés, et pas la dimension où il y a le max ».
 *
 * Il a raison, et c'est plus qu'une question d'échelle : normaliser sur le maximum rend la toile
 * MENTEUSE. Un perso 40/30/20/10 et un perso 100/75/50/25 dessinent alors EXACTEMENT la même figure, et
 * surtout la plus grosse branche touche toujours le bord — quelle que soit sa part. On lisait donc
 * « cette stat est au plafond » alors qu'elle pouvait valoir 26 %. Rapportée au total, la figure dit ce
 * que le chiffre affiché à côté d'elle dit déjà : la part réelle, sur cent.
 */
export function pointsToile(pct: Record<StatId, number>, cx: number, cy: number, rayon: number): PointToile[] {
  return STATS.map((s, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length
    const r = (rayon * (pct[s.id] ?? 0)) / 100
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  })
}

/** Sommets du cadre (le contour à 100 %), pour dessiner la grille de fond. */
export function cadreToile(cx: number, cy: number, rayon: number): PointToile[] {
  return STATS.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length
    return { x: cx + Math.cos(angle) * rayon, y: cy + Math.sin(angle) * rayon }
  })
}
