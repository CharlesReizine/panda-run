import { describe, it, expect } from 'vitest'
import { ART_IMAGES, BOOT_BUDGET_MB, capFor } from '../../src/data/art-dimensions.generated'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// BUDGET DE VRAM — invariant verrouillé.
//
// Une texture WebGL coûte largeur × hauteur × 4 octets de mémoire GPU, NON COMPRESSÉS : une image
// 1024×1024 = 4 Mo, quelle que soit la taille du PNG sur disque. L'art de panda-run était généré en
// 1024×1024 et affiché entre 18 px (pièce d'or) et 100 px (PNJ) — mesuré sur build R272 : 736
// textures uploadées au boot = 532 Mo de VRAM + 368 Mo de tas JS, ~900 Mo avant même d'entrer dans
// un terrain. Sur iPhone, WebKit purge puis re-uploade en boucle sous cette pression : le jeu
// ralentit de plus en plus à mesure qu'on visite des terrains, et seul un reload le guérit.
//
// Ce test verrouille deux choses, pour que de l'art REGÉNÉRÉ ne puisse pas ramener le problème :
//   1. aucune image ne dépasse le plafond de sa famille (≈2× sa taille d'affichage réelle) ;
//   2. la VRAM des familles RÉSIDENTES AU BOOT reste sous le budget.
//
// Les dimensions viennent de src/data/art-dimensions.generated.ts (régénéré par
// `node scripts/gen-asset-manifest.mjs`, lancé automatiquement avant chaque `pnpm build`).
// Les plafonds sont définis dans scripts/art-caps.mjs. Pour redimensionner : `node
// scripts/shrink-art.mjs` (puis régénérer les dimensions).

const mb = (bytes: number) => bytes / 1048576
const vram = (img: { w: number; h: number }) => img.w * img.h * 4

describe('budget de VRAM des textures', () => {
  it('le manifeste de dimensions est bien généré', () => {
    // garde-fou : un manifeste vide ferait passer tous les autres tests pour de mauvaises raisons
    expect(ART_IMAGES.length).toBeGreaterThan(200)
  })

  it('aucune image ne dépasse le plafond de sa famille', () => {
    const offenders = ART_IMAGES
      .filter((img) => Math.max(img.w, img.h) > capFor(img.name).max)
      .map((img) => `${img.name} : ${img.w}×${img.h} (plafond ${capFor(img.name).max}, ${mb(vram(img)).toFixed(2)} Mo de VRAM)`)
    expect(offenders, `${offenders.length} image(s) trop grande(s) — lancer \`node scripts/shrink-art.mjs\` :\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('la VRAM résidente au boot tient dans le budget', () => {
    // familles `lazy` exclues : elles gardent leur résolution plein cadre mais sont chargées à
    // l'entrée de la scène qui les utilise et déchargées en sortant (jamais toutes résidentes)
    const resident = ART_IMAGES.filter((img) => !capFor(img.name).lazy)
    const totalMB = mb(resident.reduce((s, img) => s + vram(img), 0))
    const worst = [...resident].sort((a, b) => vram(b) - vram(a)).slice(0, 5)
      .map((img) => `${img.name} ${img.w}×${img.h} = ${mb(vram(img)).toFixed(2)} Mo`)
    expect(totalMB, `VRAM résidente ${totalMB.toFixed(1)} Mo > budget ${BOOT_BUDGET_MB} Mo. Les 5 plus grosses :\n  ${worst.join('\n  ')}`).toBeLessThan(BOOT_BUDGET_MB)
  })
})
