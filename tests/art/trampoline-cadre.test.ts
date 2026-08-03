import { describe, it, expect } from 'vitest'
import { ART_IMAGES } from '../../src/data/art-dimensions.generated'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE TRAMPOLINE NE DOIT PLUS VOLER AU-DESSUS DU SOL
//
// Signalé trois fois par le user (« le trampoline vole un peu au-dessus du sol », « il est trop haut il
// vole au-dessus »). La cause n'était pas dans le code de placement mais DANS LE FICHIER : le PNG
// mesurait 256×223 alors que le dessin s'arrêtait à la rangée 143 — 80 rangées transparentes sous les
// pieds de bambou, plus un filigrane de 6 px collé à la dernière rangée qui faisait échouer tout
// recadrage naïf (`Image.getbbox()` ne regarde que « alpha non nul »). Le moteur pose l'origine BASSE de
// l'image sur le sol : cette marge vide devenait un coussin d'air de 42 px, et la zone de rebond partait
// 33 px trop haut avec elle.
//
// ⚠️ ON MESURE LES PROPORTIONS DU FICHIER, PAS LE RENDU, et c'est suffisant : le moteur impose la largeur
// (TRAMPO_W) et déduit la hauteur des proportions du dessin, donc une marge transparente en bas se
// traduit MÉCANIQUEMENT en vol. Un ré-export non recadré fait remonter le ratio à 0,87 et tombe ici.

const dim = (nom: string) => {
  const img = ART_IMAGES.find((i) => i.name === nom)
  if (!img) throw new Error(`${nom} absent du manifeste (régénérer : node scripts/gen-art-dimensions.mjs)`)
  return img
}

const ETATS = ['decor-trampoline.png', 'decor-trampoline-saut.png']

describe('cadrage des dessins de trampoline', () => {
  it('sont recadrés au trait (aucune marge vide sous les pieds)', () => {
    for (const nom of ETATS) {
      const { w, h } = dim(nom)
      const ratio = h / w
      // le dessin recadré tient autour de 0,56 ; la version fautive valait 0,87
      expect(ratio, `${nom} : ${w}×${h} (ratio ${ratio.toFixed(3)})`).toBeGreaterThan(0.5)
      expect(ratio, `${nom} : ${w}×${h} (ratio ${ratio.toFixed(3)})`).toBeLessThan(0.62)
    }
  })

  it('ont les MÊMES proportions d\'un état à l\'autre', () => {
    // Le moteur verrouille la largeur et déduit la hauteur : deux ratios différents feraient SAUTER la
    // taille de l'engin au moment du rebond (l'état « sauté » plus grand ou plus petit que l'état posé).
    const [a, b] = ETATS.map(dim)
    const ra = a!.h / a!.w, rb = b!.h / b!.w
    expect(Math.abs(ra - rb), `${ra.toFixed(3)} vs ${rb.toFixed(3)}`).toBeLessThan(0.03)
  })
})
