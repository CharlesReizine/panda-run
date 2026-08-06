import { describe, it, expect } from 'vitest'
import { BUILD } from '../../src/core/build'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE REPÈRE DE BUILD SUIT LE DERNIER LOT LIVRÉ
//
// Retour du joueur : « quand je me connecte je vois R342, même sur un nouvel onglet privé ». Ce
// n'était pas un cache : le repère était resté écrit en dur sur R342 pendant VINGT-CINQ lots.
//
// ⚠️ CE N'EST PAS QU'UN DÉTAIL D'AFFICHAGE. Ce numéro est joint à chaque sauvegarde cloud pour savoir
// quelle build a écrit quoi — c'est l'outil qu'on sort quand une partie disparaît, et il en a déjà
// disparu six. Un repère faux rend ce diagnostic-là faux aussi, en silence.
//
// La consigne « c'est ici qu'on bumpe à chaque livraison » était pourtant écrite en tête du fichier.
// Elle n'a pas suffi, et c'est la leçon : une consigne que rien ne vérifie finit par ne plus être lue.
// Le test compare donc le repère au dernier lot consigné dans l'historique — les deux avancent
// ensemble, ou la suite tombe.

const DOC = 'ETAT-DU-PROJET.md'

async function dernierLotConsigne(): Promise<string> {
  const mod = 'node:fs'
  const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync: (p: string, e: string) => string }
  const numeros = [...fs.readFileSync(DOC, 'utf8').matchAll(/^\| R(\d+) \|/gm)].map((m) => Number(m[1]))
  return `R${Math.max(...numeros)}`
}

describe('repère de build', () => {
  it('correspond au dernier lot consigné dans ETAT-DU-PROJET.md', async () => {
    const attendu = await dernierLotConsigne()
    expect(BUILD, `le repère affiché est ${BUILD} alors que le dernier lot livré est ${attendu} — ` +
      'bumper src/core/build.ts fait partie de la livraison, pas de l\'après-coup').toBe(attendu)
  })

  it('a bien la forme d\'un numéro de lot', () => {
    expect(BUILD).toMatch(/^R\d+$/)
  })
})
