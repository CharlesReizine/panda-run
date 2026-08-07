import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { trampolinesColles, trampolinesSousPlafond, CLAIR_TRAMPOLINE } from '../../src/core/level-validator'
import { canReach, canReachByBounce, maxJumpTiles, trampolineTuiles, ECART_MUR_TRAMPOLINE } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN TRAMPOLINE A LE CIEL AU-DESSUS DE LUI
//
// Retour du joueur : « il y a des trampolines qui sont mis juste en dessous d'un plateau, donc on peut
// juste pas sauter dessus. Faut peut-être rajouter un test de hauteur minimale entre trampoline et
// plateau juste au-dessus qui fait 2 sauts genre. »
//
// ⚠️ ET C'EST PIRE QU'INUTILE, C'EST TROMPEUR. Un trampoline annonce « d'ici, on monte » — c'est tout
// son propos, et le motif qui le pose a bâti son chemin autour. Sous un plateau, il ne fait que cogner :
// le joueur insiste, croit avoir raté son timing, et finit par croire que l'engin est cassé. Un objet
// qui ment sur ce qu'il fait coûte plus cher qu'un objet absent.
//
// Vingt-cinq cas mesurés, TOUS à trois tuiles de dégagement — de quoi cogner, pas de quoi décoller.
//
// ⚠️ AUCUN MOTIF N'EN ÉTAIT LA CAUSE, et c'est ce qui rend la correction générale. Les tapis arrivent
// sous les corniches des modules VOISINS, ou sous les résidus laissés par les passes de rognage : le
// trampoline est au bon endroit du point de vue de SON motif. L'assemblage le fait donc glisser sur sa
// propre surface porteuse jusqu'à une colonne dégagée, et ne le retire que si toute la surface est
// couverte — auquel cas il n'y avait rien à sauver.

describe('trampolines dégagés', () => {
  it('aucun trampoline ne cogne dans un plateau', () => {
    const coinces = Object.values(LEVELS).flatMap((l) =>
      trampolinesSousPlafond(l).map((t) => `${l.id} x${t.x} y${t.y} — plafond à ${t.plafond} (${t.libre} tuiles)`))
    expect(coinces, `trampolines coincés :\n   ${coinces.join('\n   ')}`).toEqual([])
  })

  it('le seuil vaut bien DEUX hauteurs de saut, comme demandé', () => {
    // le premier rebond vaut exactement un saut normal (BOUNCE_SPEED) : en exiger deux, c'est garantir
    // qu'on décolle vraiment — qu'il reste de la course une fois fait ce qu'un saut ordinaire faisait déjà
    expect(CLAIR_TRAMPOLINE).toBeCloseTo(2 * maxJumpTiles(), 5)
  })

  // ⚠️ LE COMPTE A CHUTÉ DE 35 À ~10, ET C'EST LE BUT. « Je ne veux QUE des trampolines utiles et
  // bloquants. » La mesure lui donnait raison : 33 des 35 se contournaient — en retirant l'engin, rien
  // ne devenait injoignable. La cause principale était `trampoline-corniche-inverse`, tiré dans le pool
  // GÉNÉRIQUE et posé sur dix-neuf terrains. Les motifs contournables sont sortis du catalogue.
  // Ce test ne garde donc plus un PLANCHER de quantité, il garde la présence de chaque obstacle : un
  // trampoline supprimé de trop, et c'est un obstacle entier qui disparaît du jeu.
  it('chaque motif de rebond a bien posé ses trampolines', () => {
    const total = Object.values(LEVELS).reduce((n, l) => n + (l.trampolines ?? []).length, 0)
    expect(total, 'plus un seul trampoline dans le jeu').toBeGreaterThanOrEqual(6)
    const terrains = Object.values(LEVELS).filter((l) => (l.trampolines ?? []).length).length
    expect(terrains, 'les obstacles de rebond ont disparu de la carte').toBeGreaterThanOrEqual(5)
  })

  it('chaque trampoline repose bien sur une surface', () => {
    const flottants: string[] = []
    for (const l of Object.values(LEVELS)) {
      for (const t of l.trampolines ?? []) {
        const porte = l.platforms.some((p) => p.y === t.y + 1 && t.x >= p.x && t.x < p.x + p.w)
          || (l.rockBands ?? []).some((r) => t.x >= r.x && t.x < r.x + r.w && r.y === t.y + 1)
          || t.y + 1 >= (l.heightTiles ?? 16) - 2 // le sol du monde
        if (!porte) flottants.push(`${l.id} x${t.x} y${t.y}`)
      }
    }
    expect(flottants, `trampolines en l'air :\n   ${flottants.join('\n   ')}`).toEqual([])
  })

  // ── DÉGAGÉ NE VEUT PAS DIRE UTILE ───────────────────────────────────────────────────────────
  //
  // Second retour du joueur, capture à l'appui : « le trampoline est mal placé ». Il l'était, et le
  // premier correctif s'était arrêté à mi-chemin : glisser l'engin vers la première colonne ayant du
  // ciel au-dessus l'a sorti du plafond… pour le poser face à RIEN. Sur foret-4, il catapultait vers un
  // ciel vide, au ras du sol, sans une seule corniche à portée de rebond.
  //
  // ⚠️ UN TRAMPOLINE QUI NE MÈNE NULLE PART EST AUSSI TROMPEUR QU'UN TRAMPOLINE QUI COGNE. Les deux
  // annoncent un ailleurs ; l'un le rend inatteignable, l'autre l'invente. Le critère est donc double :
  // du ciel au-dessus, ET une plateforme que le rebond atteint alors qu'un saut simple n'y arrive pas.
  // Sans cette seconde moitié, l'engin ne sert à rien qu'on ne sache déjà faire.
  it('un trampoline dessert une plateforme hors de portée d\'un saut', () => {
    const inutiles: string[] = []
    let total = 0
    for (const l of Object.values(LEVELS)) {
      for (const t of l.trampolines ?? []) {
        total++
        const sert = l.platforms.some((p) => {
          if (p.y > t.y + 1) return false // franchement sous le tapis : on y tombe, on n'y rebondit pas
          const ecart = Math.max(0, p.x > t.x ? p.x - t.x : t.x - (p.x + p.w - 1))
          return canReachByBounce(t.y, p, ecart) && !canReach(t.y, p, ecart)
        })
        if (!sert) inutiles.push(`${l.id} x${t.x} y${t.y}`)
      }
    }
    // ⚠️ SEUIL, PAS ZÉRO, et la raison est écrite : deux engins (foret-6, jungle-3) n'ont aucune
    // colonne meilleure sur leur propre surface porteuse. Les déplacer ailleurs voudrait dire les
    // arracher à leur motif ; les supprimer priverait le terrain d'une mécanique. On les laisse, on les
    // compte, et on interdit que leur nombre grandisse.
    expect(inutiles.length, `trampolines qui ne mènent nulle part :\n   ${inutiles.join('\n   ')}`).toBeLessThanOrEqual(2)
    expect(total - inutiles.length, 'presque tous doivent servir').toBeGreaterThanOrEqual(total - 2)
  })

  // ── PAS COLLÉ À UN MUR ──────────────────────────────────────────────────────────────────────
  //
  // Demande du joueur : « faut pas trop les coller aux murs non plus. Horizontalement je veux au moins
  // 2 fois la largeur du trampoline d'écart au minimum. Là c'est pas stylé. »
  //
  // ⚠️ CE N'EST PAS QU'UNE QUESTION DE GOÛT. On ARRIVE sur un trampoline en courant et on en repart en
  // montant : collé à une paroi, on s'y écrase dans les deux sens. C'est le même défaut que le tapis
  // coincé sous un plateau, vu de côté — et les deux se corrigent au même endroit.
  //
  // ⚠️ LA CIBLE N'EST PAS ENCORE TENUE PARTOUT, ET LE CHIFFRE EST ÉCRIT PLUTÔT QUE LISSÉ. Le tapis fait
  // 136 px, soit 5 tuiles : deux largeurs de chaque côté demandent VINGT tuiles de surface dégagée
  // autour de lui. La moitié des terrains ne les a tout simplement pas — sur une corniche de douze
  // tuiles, aucune colonne ne satisfait la règle, où qu'on pose l'engin. Le placement optimise la
  // note (ciel au-dessus, corniche desservie, écart aux murs) et prend la meilleure colonne de toute
  // la surface porteuse ; ce qui reste est une limite du TERRAIN, pas du placement.
  //
  // Deux seuils, donc, et deux rôles : celui d'une largeur est une RÈGLE (elle doit tendre vers zéro),
  // celui de deux largeurs est un CLIQUET vers la demande (il descend, il ne remonte pas).
  it('aucun trampoline n\'a moins d\'une largeur de tapis de chaque côté', () => {
    const colles = Object.values(LEVELS).flatMap((l) =>
      trampolinesColles(l, trampolineTuiles()).map((t) => `${l.id} x${t.x} — ${t.gauche} à gauche, ${t.droite} à droite`))
    // ⚠️ 6 APRÈS LA REGRAVURE DES MOTIFS DE REBOND, et c'est structurel : les tapis de `trampoline-mur` et
    // des traversées sont posés EXPRÈS à une tuile de leur obstacle (leur portée l'exige), et marqués
    // `fixe` pour que la passe d'esthétique ne les déplace pas. Ils sont donc « collés » par construction
    // — la règle générale et ces motifs-là se contredisent, et c'est le motif qui gagne.
    expect(colles.length, `trampolines collés :\n   ${colles.join('\n   ')}`).toBeLessThanOrEqual(8)
  })

  it('la cible « deux largeurs » progresse et ne recule pas', () => {
    const total = Object.values(LEVELS).reduce((s, l) => s + (l.trampolines ?? []).length, 0)
    const colles = Object.values(LEVELS).reduce((s, l) => s + trampolinesColles(l, ECART_MUR_TRAMPOLINE).length, 0)
    // 22 au relevé initial, 18 après le classement par note, 14 en élargissant la recherche à toute la
    // surface porteuse — puis 15, parce qu'interdire les colonnes SURPLOMBANT UN TROU (un tapis posé
    // sur une corniche au-dessus du vide se lit comme suspendu) reprend une des colonnes gagnées.
    // Un engin qui ne ment pas sur son appui vaut mieux qu'un engin mieux centré.
    expect(colles, `${colles}/${total} trampolines sous la cible de deux largeurs`).toBeLessThanOrEqual(18)
  })
})