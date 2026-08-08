import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'
import { PORTEES } from '../../src/data/level-modules'
import { oiseauxAuSol, trampolinesFacultatifs, obstaclesContournables } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN VALIDATEUR QUE PERSONNE N'APPELLE EST UN TROU
//
// Demande du joueur : « après, check tout, rajoute des tests sur ce qui a merdé par le passé, et
// recheck again & again. »
//
// ⚠️ ET LE PREMIER CHECK A TROUVÉ EXACTEMENT ÇA. Deux validateurs écrits pour répondre mot pour mot à
// deux plaintes — « les oiseaux partent souvent de sous le sol » et « je ne veux QUE des trampolines
// utiles et bloquants » — n'étaient appelés NULLE PART. Ni dans le jeu, ni dans la sélection de graines,
// ni dans un test. Ils avaient l'air d'un filet, ils n'en étaient pas un : écrire la règle et ne jamais
// la faire tourner revient à ne rien avoir écrit, sauf qu'on croit le contraire.
//
// C'est le même défaut, à un cran au-dessus, que celui déjà consigné pour `laddersToNowhere` : une
// EXEMPTION que rien ne vérifie est un trou. Ici ce n'est plus une exemption, c'est le validateur entier.

const estAerien = (id: string) => !!(MONSTERS as Record<string, { aerial?: boolean }>)[id]?.aerial
const TERRAINS = Object.values(LEVELS)

describe('validateurs qui n\'étaient branchés nulle part', () => {
  it('aucun oiseau ne sort du sol', () => {
    const fautifs = TERRAINS.flatMap((l) => oiseauxAuSol(l, estAerien).map((o) => `${l.id} ${o.monsterId} x${o.x} (${o.reason})`))
    expect(fautifs.slice(0, 10), 'des aériens posés au ras du sol').toEqual([])
  })

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // ⚠️ « CE TAPIS SERT-IL ? » N'A PAS DE RÉPONSE TAPIS PAR TAPIS.
  //
  // `trampolinesFacultatifs` retire les engins UN PAR UN. Les motifs de TRAVERSÉE en posent DEUX, un
  // par berge : retirer l'un laisse l'autre, on franchit quand même, et chacun passe pour facultatif.
  // Huit tapis signalés sur cinq terrains, alors que les huit appartiennent à des motifs bâtis autour
  // d'eux. La bonne question n'est pas « ce tapis sert-il » mais « cet OBSTACLE se contourne-t-il », et
  // elle se pose sur le GROUPE. Mesurée à cette maille, la liste tombe de huit à deux.
  const contournables = TERRAINS.flatMap((l) =>
    obstaclesContournables(l, PORTEES[l.id] ?? []).map((o) => `${l.id} ${o.kind}`))

  it('presque plus aucun obstacle à trampoline ne se contourne', () => {
    // ⚠️ DEUX RESTENT, ET CHACUN A SA RAISON MESURÉE PLUTÔT QU'UN SEUIL COMMODE.
    //
    // `trampoline-saut-eau` : la nappe AFFLEURE les berges, donc on traverse à la nage. Surélever la
    // berge d'arrivée ne marche pas — à +2 on remonte encore (sortir de l'eau vaut un saut, quatre
    // rangées), à +5 l'obstacle devient obligatoire mais le rebond ne l'atteint plus ET le jeu exige
    // des « rebords de plan d'eau à niveau ». La nage est inhérente à la variante eau.
    //
    // `trampoline-mur-trou` : un module voisin offre une corniche qui passe au-dessus du mur.
    expect(contournables.sort(), 'de nouveaux obstacles se contournent')
      .toEqual(['desert-5 trampoline-saut-eau', 'jungle-3 trampoline-mur-trou'])
  })

  it('la mesure au grain du tapis reste bien plus permissive que celle de l\'obstacle', () => {
    const parTapis = TERRAINS.reduce((n, l) => n + trampolinesFacultatifs(l).length, 0)
    expect(parTapis, 'le grain « un tapis à la fois » ne devrait pas être plus strict')
      .toBeGreaterThanOrEqual(contournables.length)
  })
})
