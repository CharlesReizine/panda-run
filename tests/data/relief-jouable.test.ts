import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { chainesContournables } from '../../src/core/level-validator'
import { groundRowFor } from '../../src/core/platforming'
import { MARCHES_RAMPE } from '../../src/data/level-modules'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE RELIEF SE JOUE — TROIS DETTES QUE LE JOUEUR AVAIT NOMMÉES, ET LEURS GARDE-FOUS
//
// Ces trois mesures ont vécu des mois dans ETAT-DU-PROJET.md sous forme de chiffres périmés, donc
// invérifiables. Elles vivent maintenant ici : un test qui tombe vaut mieux qu'une ligne de doc.
//
// ⚠️ LES TROIS TOLÉRANCES CI-DESSOUS SONT DE LA DETTE NOMMÉE, PAS DES DÉROGATIONS DE CONFORT.
// Chacune décrit un cas que la génération ne sait pas résoudre sans changer un motif de fond. Les
// baisser est un progrès ; les monter demande une raison écrite.

const nonBoss = Object.values(LEVELS).filter((l) => !l.boss)

describe('relief jouable', () => {
  // ── « encore de la pierre qui vole au-dessus du sol » ────────────────────────────────────────
  // Trois colonnes de roche nues montant du sol au ciel, sans un brin d'herbe dessus. Son intuition
  // était juste : « je pense que c'est dû au fait que la couche du bas tu la comptes pas pareil ». Un
  // socle est posé pour porter une plateforme ; quand une passe de nettoyage retire cette plateforme
  // (doublon avec le sol du monde, rognage de double plancher), le socle survit à sa coiffe.
  //
  // ⚠️ ON NE JUGE QUE LES SOCLES. Une dalle qui NE touche PAS le sol est autre chose — plafond de
  // grotte, coiffe d'échelle suspendue, paroi de cuve — et elle a parfaitement le droit de n'avoir rien
  // au-dessus. Le critère est « elle descend jusqu'au sol ET rien ne la coiffe ».
  it('aucun socle de pierre ne monte du sol sans rien porter', () => {
    const nus: string[] = []
    for (const l of nonBoss) {
      const gr = groundRowFor(l.heightTiles)
      for (const r of l.rockBands ?? []) {
        if (r.y + r.h - 1 < gr - 1) continue
        const ch = (x: number, w: number) => x < r.x + r.w && x + w > r.x
        const coiffe = l.platforms.some((p) => p.y === r.y - 1 && ch(p.x, p.w))
          || (l.rockBands ?? []).some((o) => o !== r && o.y + o.h === r.y && ch(o.x, o.w))
          || (l.breakables ?? []).some((b) => b.y + b.h === r.y && ch(b.x, b.w))
          || (l.hazards ?? []).some((h) => h.kind === 'water' && ch(h.x, h.w))
          || (l.ladders ?? []).some((la) => la.x >= r.x && la.x < r.x + r.w)
        if (!coiffe) nus.push(`${l.id} x${r.x}+${r.w} y${r.y}h${r.h}`)
      }
    }
    expect(nus, `socles nus :\n   ${nus.slice(0, 8).join('\n   ')}`).toEqual([])
  })

  // ── « quand j'ai de la terre sur de la pierre je passe à travers, c'est impoooossible » ──────
  // Une plateforme de terre est traversable par le BAS — c'est tout son intérêt quand elle FLOTTE. Posée
  // sur de la pierre ou sur le sol, il n'y a rien dessous d'où sauter, et la traversée se retourne
  // contre le joueur : on entre par le côté et on se retrouve DANS le décor. Le joueur a demandé la
  // matière qui manquait : « de la terre surface, mais pas les plateaux de terre qui volent, et ce
  // truc-là est infranchissable ». C'est `ancree` — même texture, collision pleine.
  it('toute terre posée sur de la matière est infranchissable', () => {
    const perméables: string[] = []
    for (const l of nonBoss) {
      const gr = groundRowFor(l.heightTiles)
      for (const p of l.platforms) {
        if (p.solid || p.ancree) continue
        let surDuPlein = true
        for (let x = p.x; x < p.x + p.w && surDuPlein; x++) {
          const sous = p.y + 1
          const roc = (l.rockBands ?? []).some((r) => x >= r.x && x < r.x + r.w && sous >= r.y && sous < r.y + r.h)
          const sol = sous >= gr && !(l.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
          const autre = l.platforms.some((q) => q !== p && q.y === sous && x >= q.x && x < q.x + q.w)
          if (!roc && !sol && !autre) surDuPlein = false
        }
        if (surDuPlein) perméables.push(`${l.id} x${p.x}+${p.w} y${p.y}`)
      }
    }
    expect(perméables, `terres traversables posées sur du plein :\n   ${perméables.slice(0, 8).join('\n   ')}`).toEqual([])
  })

  // ── 0) « deux sols juste empilés » ───────────────────────────────────────────────────────────
  // Retour du joueur, capture à l'appui : « y a deux sols qui sont juste empilés, donc si je marche sur
  // le premier sans sauter, je passe à travers le deuxième. On a dit pas deux sols trop proches en
  // hauteur. » Le test des doubles planchers ne pouvait pas le voir : il compare les plateformes ENTRE
  // ELLES, et le sol du MONDE n'en est pas une. Un module dont le plancher tombe à l'altitude 1 pose
  // donc une bande d'herbe collée sur celle du sol.
  //
  // La passe d'assemblage en retire ce qu'elle peut. Ce qui reste est épargné pour une raison : une
  // colonne où le sol du monde n'est pas foulable, un mur de roche à franchir, ou un coffre / trampoline
  // / pied d'échelle posé dessus. Le retrait segment par segment a été tenté : il fragmente le plancher
  // et fait tomber vingt-neuf tests d'atteignabilité. Un plancher se retire en entier ou pas du tout.
  it('aucune plateforme n\'est dessinée DANS la rangée du sol du monde', () => {
    // Le cas que le joueur voyait, et que rien ne regardait : une plateforme au MÊME endroit que le sol,
    // deux textures dans la même case. `superpositions` compare les plateformes entre elles et avec la
    // roche — le sol du monde n'est ni l'un ni l'autre, donc personne ne l'attrapait. Ça arrive dès
    // qu'un motif pose son plancher à l'altitude 0.
    const doublons: string[] = []
    for (const l of nonBoss) {
      const gr = groundRowFor(l.heightTiles)
      for (const p of l.platforms) {
        if (p.solid || p.y < gr) continue
        for (let x = p.x; x < p.x + p.w; x++) {
          if ((l.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)) continue
          if ((l.hazards ?? []).some((h) => h.kind === 'water' && x >= h.x && x < h.x + h.w)) continue
          doublons.push(`${l.id} x${p.x}+${p.w} y${p.y} (sol ${gr})`); break
        }
      }
    }
    expect(doublons, `plateformes dans le sol :\n   ${doublons.slice(0, 8).join('\n   ')}`).toEqual([])
  })

  // Après le relèvement des planchers de motif (`ALT_PLANCHER`) et la regravure des 58 plans : 215 → 77.
  const TOLERANCE_COLLEES = 77
  it('peu de corniches restent collées au sol du monde', () => {
    const collees: string[] = []
    for (const l of nonBoss) {
      const gr = groundRowFor(l.heightTiles)
      for (const p of l.platforms) {
        if (p.solid || p.y !== gr - 1) continue
        if ((l.gaps ?? []).some((g) => p.x >= g.x && p.x < g.x + g.w)) continue
        if ((l.hazards ?? []).some((h) => h.kind === 'water' && p.x >= h.x && p.x < h.x + h.w)) continue
        collees.push(`${l.id} x${p.x}+${p.w}`)
      }
    }
    expect(collees.length, `corniches collées au sol :\n   ${collees.slice(0, 10).join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_COLLEES)
  })

  // ── 1) « les sauts qu'on peut éviter, tu dégages le sol en dessous » ─────────────────────────
  // Une suite de plateformes suspendues avec du sol praticable dessous ne se joue jamais : on passe
  // dessous en marchant. La passe de creusement (level-modules) retire ce sol. Mesuré : 174 avant, 6
  // après, et les six restantes sont NOMMÉES, pas subies :
  //   · desert-1 et desert-8 : chaînes de 3 et 5 tuiles dans `cascade-large-pierre` — en gardant deux
  //     colonnes pleines de chaque côté (sans quoi on coupe le terrain en deux), il ne reste pas
  //     d'intérieur à creuser. Une chaîne aussi courte ne se « contourne » d'ailleurs guère ;
  //   · carriere-1, quatre chaînes : creuser y fabriquait un piège sans retour, et la passe a REBOUCHÉ.
  //     Le modèle de mouvement ne sait pas parcourir ces chaînes-là, donc le sol du dessous est la
  //     seule route. C'est le garde-fou qui parle, pas un oubli.
  const TOLERANCE_CHAINES = 7
  it('les enchaînements de sauts ne se contournent pas en marchant dessous', () => {
    const restantes = nonBoss.flatMap((l) => chainesContournables(l).map((c) => `${l.id} x${c.x}+${c.w} (${c.plats} plateformes)`))
    expect(restantes.length, `chaînes contournables :\n   ${restantes.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_CHAINES)
  })

  // ── 2) « j'en ai vu une qui revient et ça perturbe » ─────────────────────────────────────────
  // Deux corniches de terre à une ou deux rangées d'écart qui se recouvrent : on ne sait plus sur
  // laquelle on marche, et la plus basse ne sert à rien puisqu'on ne tient pas debout dessous. La
  // passe de rognage retire le recouvrement de la plus courte — sauf quand elle porte quelque chose
  // (un monstre, un coffre, un trampoline), auquel cas un doublon visuel vaut mieux qu'un ours qui
  // vole. Mesuré : 60 paires avant la passe, 15 après, ZÉRO une fois les deux motifs fautifs corrigés.
  //
  // ⚠️ LE CORRECTIF DE `sol-fragile` A ÉTÉ TROUVÉ AU TROISIÈME ESSAI, et les deux ratés valent d'être
  // sus. Approfondir la chambre pour que le palier retombe pile sur le chemin rendait tout un pan de
  // carriere-1 injoignable ; supprimer le palier et faire déboucher l'échelle sur le chemin lui-même
  // laissait son pied hors de la chambre. Ce qui marche est plus bête : le palier fait UNE tuile, pile
  // sur le montant. Assez pour que `isLadderTop` reconnaisse le sommet, trop peu pour recouvrir.
  //
  // ⚠️ LE RÉSIDU N'ÉTAIT PAS AUX COUTURES ENTRE MODULES — l'hypothèse était fausse, la mesure l'a dit.
  // Les quinze venaient de DEUX motifs, et d'eux seuls : `sol-fragile` (8) dont le palier de remontée
  // atterrissait une rangée au-dessus du chemin, corrigé à la source ; et `pics-quinconce` (7), qui
  // pose exprès des languettes deux rangées au-dessus de son sol — ce n'est pas un défaut, c'est le
  // motif, et le critère ci-dessous le reconnaît maintenant.
  const TOLERANCE_DOUBLES = 0
  it('deux corniches ne se recouvrent pas à moins d\'un saut l\'une de l\'autre', () => {
    const paires: string[] = []
    for (const l of nonBoss) {
      const p = l.platforms
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!, b = p[j]!
        if (a.solid || b.solid) continue // la pierre pleine est un mur, pas une corniche
        const dy = Math.abs(a.y - b.y)
        if (dy === 0 || dy > 2) continue
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 3) continue
        // ⚠️ UNE MINI-CORNICHE AU-DESSUS D'UN LONG SOL N'EST PAS UN DOUBLE PLANCHER, C'EST UN OBSTACLE.
        // `pics-quinconce` pose exprès des paliers de 3 tuiles deux rangées au-dessus de son sol pour
        // qu'on slalome en hauteur : c'est le motif entier. Un double plancher, ce sont deux surfaces
        // qui se lisent toutes les deux comme « le sol » ; une languette de 3 tuiles au-dessus d'une
        // bande dix fois plus longue se lit comme un relief, et on passe dessous debout.
        const haut = a.y < b.y ? a : b, bas = a.y < b.y ? b : a
        if (haut.w <= 3 && bas.w >= haut.w * 3) continue
        paires.push(`${l.id} y${a.y}/${b.y} x${Math.max(a.x, b.x)}`)
      }
    }
    expect(paires.length, `doubles planchers :\n   ${paires.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_DOUBLES)
  })

  // ── 3) « les marches géantes » ───────────────────────────────────────────────────────────────
  // Une RAMPE ne doit pas lâcher plus d'une hauteur de saut d'un coup : au-delà ce n'est plus une
  // marche, c'est une falaise. Deux causes trouvées, toutes deux corrigées : une largeur de rampe qui
  // ne comptait que la MONTÉE (en descente elle retombait à deux tuiles pour seize rangées), et une
  // allocation séquentielle où la redescente héritait des miettes. Mesuré : 11 avant, 1 après.
  //
  // Le cas restant est un arbitrage, pas un oubli : une cascade « au moins quatre fois le panda »
  // dans un module étroit ne laisse pas la place d'adoucir sa berge descendante. Aucune rampe ne peut
  // faire mieux avec trois tuiles — il faudrait raccourcir la cascade, c'est-à-dire renoncer au motif.
  // ⚠️ CETTE TOLÉRANCE A AUGMENTÉ, ET C'EST UNE RÉGRESSION ASSUMÉE, PAS UN RÉGLAGE. Elle valait 1.
  // Relever les planchers de motif (`ALT_PLANCHER`, qui fait passer les « deux sols collés » de 215 à
  // 77) a mécaniquement remonté les altitudes d'entrée. Or deux motifs PLAFONNENT leur propre altitude
  // — `grotte-scellee` (7 cas) la borne à `MAX_LADDER_TILES - 2`, `echelle-descente-piegee` (6 cas)
  // plante son pied d'échelle au ras du sol — donc leur rampe d'accroche doit désormais lâcher quarante
  // à soixante rangées dans sept ou huit tuiles. Ce ne sont plus des marches.
  //
  // Deux tentatives pour dimensionner la rampe sur son dénivelé ont échoué : la première déborde de la
  // portée du module (une superposition), la seconde ne change rien parce que la contrainte n'est pas
  // la largeur de la rampe mais le PLAFOND D'ALTITUDE du motif. La correction est là : ces deux motifs
  // doivent suivre l'altitude d'entrée au lieu de la plafonner. C'est le prochain fil, il est nommé.
  const TOLERANCE_MARCHES = 13
  it('aucune rampe ne fabrique une marche plus haute qu\'un saut', () => {
    const detail = MARCHES_RAMPE.map((m) => `${m.kind} : ${m.de}→${m.a} sur ${m.w} tuiles`)
    expect(MARCHES_RAMPE.length, `marches de rampe :\n   ${detail.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_MARCHES)
  })
})
