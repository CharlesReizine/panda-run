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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DETTE D'ILLUSTRATIONS — ASSUMÉE, ET COMPTÉE À L'UNITÉ
//
// Le roster est passé de 61 à 150 objets sur demande du user (« il me faut des tonnes de trucs »), avec
// son accord explicite sur les visuels : « s'il manque quelques visuels on les générera ».
//
// ⚠️ CETTE LISTE EST UN INVENTAIRE, PAS UNE DÉROGATION. Elle est écrite en dur ICI, et pas lue depuis
// docs/art-a-generer.md, exprès : si le test lisait le fichier généré, il suffirait de relancer le script
// pour faire taire le test — la dette deviendrait invisible, ce qui est exactement le problème qu'on veut
// éviter. Ajouter un objet sans illustration force donc à venir l'inscrire ici à la main.
//
// Deux directions de vérification, et la seconde compte autant que la première :
//   · un objet sans image ET absent de la liste → échec (on a oublié l'art) ;
//   · un objet PRÉSENT dans la liste qui a MAINTENANT son PNG → échec aussi (entrée périmée). La liste
//     ne peut donc que rétrécir à mesure que les illustrations arrivent, et ne se transforme jamais en
//     fourre-tout dont personne ne sait ce qu'il contient encore.
//
// Régénérer l'état des lieux : `node scripts/art-manquant.mjs` → docs/art-a-generer.md
const ART_A_GENERER = new Set([
  'casquette-de-toile', 'foulard-de-pirate', 'cagoule-de-voleur', 'heaume-de-bronze',
  'couronne-de-fleurs', 'masque-de-renard', 'casque-a-plumet', 'mitre-du-clerc',
  'bandeau-du-moine', 'heaume-du-chevalier', 'chapeau-du-magicien', 'couronne-de-laurier',
  'casque-de-dragon', 'couronne-du-roi-demon', 'anneau-du-dragon', 'coeur-de-golem',
  'larme-d-etoile', 'sceau-des-anciens',
])

const hasPng = (id: string) => artPaths.some((p) => p.endsWith(`/item-${id}.png`))
const aUnVisuel = (id: string, slot: string) => hasPng(id) || (slot === 'hat' && COSMETIC_DRAWN.has(id))

describe('complétude des images d\'objets', () => {
  it('chaque objet a une image, ou figure explicitement dans la dette', () => {
    const oublies = Object.values(ITEMS)
      .filter((it) => !aUnVisuel(it.id, it.slot) && !ART_A_GENERER.has(it.id))
      .map((it) => `${it.slot}:${it.id}`)
    expect(oublies, `objets sans image et hors de la dette : ${oublies.join(', ')}`).toEqual([])
  })

  it('la dette ne contient aucune entrée périmée — un objet illustré doit en sortir', () => {
    const perimes = [...ART_A_GENERER].filter((id) => {
      const it = ITEMS[id]
      return !it || aUnVisuel(it.id, it.slot)
    })
    expect(perimes, `à retirer de ART_A_GENERER : ${perimes.join(', ')}`).toEqual([])
  })

  it('les ARMES restent lisibles sans PNG : leur silhouette est dessinée au chargement', () => {
    // bakeItemWeapons (PreloadScene) fabrique weapon-<id> pour CHAQUE arme, et l'inventaire comme la
    // boutique s'en servent en repli. Une arme en dette n'affiche donc jamais de pastille de couleur.
    const armesEnDette = [...ART_A_GENERER].filter((id) => ITEMS[id]?.slot === 'weapon')
    for (const id of armesEnDette) expect(ITEMS[id]!.weaponType, id).toBeDefined()
  })
})
