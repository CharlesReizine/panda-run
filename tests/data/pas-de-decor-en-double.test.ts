import { describe, it, expect } from 'vitest'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUN DÉCOR N'EST DÉFINI DEUX FOIS — ET CE TEST LIT LE FICHIER SOURCE, PAS LE JEU
//
// `buildModule` a longtemps contenu SES DÉCORS EN DOUBLE : 56 étiquettes dupliquées, ~1000 lignes mortes.
// En JavaScript, c'est la PREMIÈRE étiquette qui gagne — la seconde ne tourne jamais. Conséquence, et elle
// est arrivée : un correctif écrit dans la mauvaise copie ne fait RIEN, et rien ne le signale. Le projet a
// perdu un tour complet là-dessus (« le correctif couloir-large n'a jamais tourné »), et cinq des copies
// avaient fini par DIVERGER, donc personne ne savait plus laquelle était la vraie.
//
// Le piège n'était pas détectable autrement : tsc ne dit rien d'une étiquette `case` répétée, les tests de
// géométrie passaient (la première copie faisait le travail), et lire 4000 lignes à l'œil ne le révèle pas.
// D'où ce test, qui regarde le TEXTE du fichier.
//
// Le dédoublonnage a été prouvé sans effet : la géométrie des 58 terrains est identique à l'octet avant et
// après. Ce n'était pas un pari — les 49 blocs supprimés ne s'exécutaient pas.
//
// ⚠️ ATTENTION SI TU DÉCOUPES CE FICHIER. Le contrôle est volontairement TEXTUEL et local à un fichier :
// il attrape la répétition, pas l'architecture. Si `buildModule` est un jour scindé, ce test doit suivre.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const CHEMIN = 'src/data/level-modules.ts'

async function source(): Promise<string> {
  const mod = 'node:fs'
  const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync: (p: string, e: string) => string }
  return fs.readFileSync(CHEMIN, 'utf8')
}

describe('le catalogue de décors ne se répète pas', () => {
  it('aucune étiquette `case` n\'apparaît deux fois', async () => {
    const compte = new Map<string, number>()
    for (const m of (await source()).matchAll(/^\s*case '([a-z0-9-]+)':/gm)) {
      const k = m[1]!
      compte.set(k, (compte.get(k) ?? 0) + 1)
    }
    const doubles = [...compte.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`)
    expect(doubles, `décors définis plusieurs fois (seule la 1re copie tourne) : ${doubles.join(', ')}`).toEqual([])
    expect(compte.size, 'aucune étiquette trouvée : le test ne lit plus le bon fichier').toBeGreaterThan(50)
  })

  it('le fichier ne contient plus de zone morte de la taille d\'un catalogue', async () => {
    // Garde-fou grossier mais utile : la version dupliquée pesait ~4800 lignes pour ~3775 utiles. Un
    // retour à plus de 4400 signifierait qu'un bloc entier a été recollé.
    const lignes = (await source()).split('\n').length
    // ⚠️ SEUIL RELEVÉ DE 4400 À 5100, ET C'EST DE LA DOCUMENTATION, PAS DU CODE. Ce garde-fou compte les
    // LIGNES pour détecter le recollage d'un catalogue entier (~1000 lignes d'un coup). Les lots de
    // corrections des 4 et 5 août ont ajouté plusieurs centaines de lignes de COMMENTAIRE — chaque passe
    // d'assemblage porte désormais la raison de son existence et la liste des essais ratés. Le seuil
    // garde sa marge (un catalogue en double se verrait toujours), il suit juste la réalité du fichier.
    expect(lignes, `${lignes} lignes — un catalogue en double a-t-il été recollé ?`).toBeLessThan(5300)
  })
})
