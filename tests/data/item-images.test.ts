import { describe, it, expect } from 'vitest'
import { ITEMS } from '../../src/data/items'

// énumère les PNG d'objets présents (via Vite, sans dépendre de fs/node)
const artPaths = Object.keys(import.meta.glob('../../public/art/item-*.png'))

// COMPLÉTUDE DES IMAGES D'OBJETS (retour user : « check tous les objets, si j'ai bien une image »).
// Chaque objet doit avoir une VRAIE image, pas un placeholder :
//  - illustration PNG public/art/item-<id>.png (armes, armures, accessoires, la plupart des chapeaux), OU
//  - pour un CHAPEAU sans PNG : un dessin vectoriel cosmetic-<id> (drawCosmetic dans PreloadScene).
// La liste ci-dessous recense les chapeaux dessinés à la main (cas de drawCosmetic). Un NOUVEL objet
// sans PNG et hors de cette liste fera échouer le test → on saura qu'il faut lui fournir une image.
const COSMETIC_DRAWN = new Set([
  'ruban', 'sakkat', 'bonnet-champi', 'chapeau-poring', 'casque-orc', 'casque-croc', 'ailes-angeling',
  'couronne-royale', 'corne-kaho', 'bandeau-guerrier', 'plume-eclaireur', 'bonnet-laine', 'oreilles-chat',
  'chapeau-sorciere', 'lunettes-aviateur', 'casque-viking', 'diademe-fee', 'aureole-sacree',
  'couronne-glace', 'masque-demon',
])

const hasPng = (id: string) => artPaths.some((p) => p.endsWith(`/item-${id}.png`))

describe('complétude des images d\'objets', () => {
  it('chaque objet a une image (PNG illustré OU chapeau dessiné cosmetic-<id>)', () => {
    const missing = Object.values(ITEMS)
      .filter((it) => !hasPng(it.id) && !(it.slot === 'hat' && COSMETIC_DRAWN.has(it.id)))
      .map((it) => `${it.slot}:${it.id}`)
    expect(missing, `objets sans image : ${missing.join(', ')}`).toEqual([])
  })
})
