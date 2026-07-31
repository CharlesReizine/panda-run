// Placement de l'ARBRE DE COMPÉTENCES. Géométrie PURE (aucune dépendance Phaser) → testable seule,
// comme scenes/bestiary-layout.ts.
//
// POURQUOI UN ARBRE ET PAS UNE GRILLE. Les sorts ont déjà un lien de dépendance dans les données
// (`SkillDef.requires` : « Tourbillon exige Estoc rapide »), mais l'écran les affichait en grille plate
// avec une mention textuelle « Nécessite : … ». On lisait donc la structure au lieu de la VOIR, et
// rien ne montrait qu'un sort en débloque deux autres.
//
// Chaque sort a AU PLUS un prérequis → le graphe est une FORÊT, pas un graphe quelconque. C'est ce qui
// rend le placement simple et déterministe : profondeur = colonne, et on empile les feuilles.
//
// ALGORITHME (Reingold–Tilford simplifié) :
//   1. `tier` = profondeur dans la chaîne de prérequis → la COLONNE.
//   2. parcours en profondeur, dans un ordre stable : chaque FEUILLE prend la rangée libre suivante.
//   3. un parent est CENTRÉ sur ses enfants → les flèches partent droit, l'œil suit la filiation.
// Résultat déterministe (aucun aléa) : deux rendus successifs sont identiques.

export interface TreeSkill {
  id: string
  requires?: string
  minLevel?: number
}

export interface TreeNode {
  id: string
  tier: number // colonne (0 = racine, sans prérequis)
  row: number // rangée (fractionnaire pour un parent centré sur ses enfants)
}

export interface TreeEdge {
  from: string // le prérequis
  to: string // le sort qu'il débloque
}

export interface SkillTree {
  nodes: TreeNode[]
  edges: TreeEdge[]
  tiers: number // nombre de colonnes
  rows: number // hauteur totale en rangées
}

export function layoutSkillTree(skills: TreeSkill[]): SkillTree {
  const byId = new Map(skills.map((s) => [s.id, s]))
  const children = new Map<string, string[]>()
  const roots: string[] = []

  // Un prérequis ABSENT de la liste (sort d'une autre classe, ou retiré du registre) ne doit pas faire
  // disparaître le sort : on le traite comme une racine. Sinon un onglet entier pourrait se vider.
  for (const s of skills) {
    const parent = s.requires && byId.has(s.requires) ? s.requires : null
    if (parent) {
      const list = children.get(parent) ?? []
      list.push(s.id)
      children.set(parent, list)
    } else {
      roots.push(s.id)
    }
  }

  // Ordre stable : par niveau requis puis par id. Sans ça, l'ordre de la source dicterait l'affichage
  // et le moindre remaniement de skills.ts réorganiserait visuellement tout l'arbre.
  const sortIds = (ids: string[]) => [...ids].sort((a, b) => {
    const sa = byId.get(a)!, sb = byId.get(b)!
    return (sa.minLevel ?? 0) - (sb.minLevel ?? 0) || a.localeCompare(b)
  })

  const nodes: TreeNode[] = []
  const edges: TreeEdge[] = []
  let nextRow = 0

  // Renvoie la rangée attribuée. Cycle impossible en théorie (un seul parent), mais on garde une
  // trace des visités : une donnée corrompue ne doit pas provoquer une récursion infinie.
  const seen = new Set<string>()
  const place = (id: string, tier: number): number => {
    if (seen.has(id)) return nextRow
    seen.add(id)
    const kids = sortIds(children.get(id) ?? [])
    let row: number
    if (!kids.length) {
      row = nextRow++
    } else {
      const rows = kids.map((k) => {
        edges.push({ from: id, to: k })
        return place(k, tier + 1)
      })
      // centré sur ses enfants : la flèche part à l'horizontale vers le milieu de sa descendance
      row = (Math.min(...rows) + Math.max(...rows)) / 2
    }
    nodes.push({ id, tier, row })
    return row
  }

  for (const r of sortIds(roots)) place(r, 0)

  const tiers = nodes.length ? Math.max(...nodes.map((n) => n.tier)) + 1 : 0
  return { nodes, edges, tiers, rows: nextRow }
}
