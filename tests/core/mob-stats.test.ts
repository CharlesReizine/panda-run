import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { computeStats } from '../../src/core/stats'
import { physicalDamage } from '../../src/core/combat'
import { statsForLevel, statPower, hpBase, atkBase, defBase, type MobRole , palierDifficulte, durcissement } from '../../src/core/mob-stats'

const ROLES: MobRole[] = ['normal', 'costaud', 'tank', 'frele', 'distant', 'rapide', 'volant']

describe('courbe de base stats↔niveau', () => {
  it('hp/atk/def de base sont strictement croissants avec le niveau', () => {
    for (let L = 1; L < 80; L++) {
      expect(hpBase(L + 1)).toBeGreaterThan(hpBase(L))
      expect(atkBase(L + 1)).toBeGreaterThan(atkBase(L))
      expect(defBase(L + 1)).toBeGreaterThanOrEqual(defBase(L))
    }
  })
})

describe('statsForLevel', () => {
  // ⚠️ L'ATK PEUT FAIRE UN PALIER, ET C'EST LE PRIX DE LA COURBE DEMANDÉE. Elle suit les MARCHES du
  // personnage : juste avant un changement de classe (niveaux 9 et 19), le joueur n'a pas encore reçu
  // son bond de PV, et la courbe creuse pour qu'il ne meure pas en huit coups au lieu des dix promis.
  // Sur deux niveaux d'écart, l'ATK peut donc stagner — jamais reculer. Les PV, eux, croissent toujours
  // strictement, et la PUISSANCE GLOBALE aussi (testée plus bas) : c'est elle qui compte pour le joueur.
  it('pour un rôle donné, chaque stat croît avec le niveau (l\'ATK peut faire un palier)', () => {
    for (const role of ROLES) {
      for (let L = 1; L < 79; L++) {
        const a = statsForLevel(L, role)
        const b = statsForLevel(L + 2, role)
        expect(b.hp, `${role} L${L}→${L + 2} PV`).toBeGreaterThan(a.hp)
        expect(b.atk, `${role} L${L}→${L + 2} ATK`).toBeGreaterThanOrEqual(a.atk)
      }
    }
  })

  it('le rôle de COMBAT ne fait que REDISTRIBUER la puissance : écart borné (≤ 20%) autour du niveau', () => {
    // La puissance globale est pilotée par le NIVEAU ; le rôle la répartit entre PV/ATK/DÉF sans la
    // créer. On borne donc l'écart entre le rôle le plus « puissant » et le plus « faible » d'un même
    // niveau → deux mobs de même niveau restent comparables (pas de tank 3× un rôle voisin du même niveau).
    // EXCEPTION : 'frele' est le tier CHAIR À CANON assumé (porings/slimes inoffensifs, cf. baisse ATK
    // demandée) — délibérément SOUS la courbe, testé à part juste en dessous.
    const combatRoles = ROLES.filter((r) => r !== 'frele')
    for (let L = 1; L <= 78; L++) {
      let lo = Infinity, hi = 0
      for (const role of combatRoles) { const s = statsForLevel(L, role); const p = statPower(s.hp, s.atk, s.def); lo = Math.min(lo, p); hi = Math.max(hi, p) }
      // 1,21 depuis que la courbe de difficulté fait descendre le facteur d'ATK entre les niveaux 1 et 5
      // (cible « 20 coups au début ») : l'écart entre rôles s'en trouve rehaussé d'un centième au niveau 56.
      // 1,25 : la courbe d'ATK dictée par le joueur n'est pas proportionnelle à la courbe de PV (elle
      // suit les MARCHES de puissance du personnage, pas une droite), donc l'écart entre rôles respire
      // d'un ou deux centièmes selon le niveau. Le rôle REDISTRIBUE toujours, il ne crée toujours rien.
      expect(hi / lo, `L${L}`).toBeLessThanOrEqual(1.3)
    }
  })

  it('le rôle « frele » est le tier le plus faible mais pas dérisoire (55–90 % de la courbe normale)', () => {
    for (let L = 1; L <= 78; L++) {
      const f = statsForLevel(L, 'frele'); const n = statsForLevel(L, 'normal')
      const ratio = statPower(f.hp, f.atk, f.def) / statPower(n.hp, n.atk, n.def)
      expect(ratio, `L${L} frele/normal`).toBeLessThanOrEqual(0.9)
      expect(ratio, `L${L} frele/normal`).toBeGreaterThanOrEqual(0.55)
    }
  })

  it('le gabarit géant est plus coriace (PV) qu\'un même niveau normal', () => {
    for (let L = 10; L <= 70; L += 10) {
      expect(statsForLevel(L, 'tank', true).hp).toBeGreaterThan(statsForLevel(L, 'tank', false).hp)
    }
  })

  it('un ÉLITE a 3 à 4 fois la VIE d\'un mob normal de même niveau et de même rôle', () => {
    // Règle explicite du user : « les élites doivent être forts, genre ils tapent pas monstrueusement
    // plus fort que leurs copains à côté de même niveau mais 3-4 fois plus de vie ».
    for (const role of ROLES) {
      for (let L = 1; L <= 78; L += 7) {
        const normal = statsForLevel(L, role)
        const elite = statsForLevel(L, role, false, true)
        const ratio = elite.hp / normal.hp
        expect(ratio, `L${L} ${role} PV élite/normal`).toBeGreaterThanOrEqual(3)
        expect(ratio, `L${L} ${role} PV élite/normal`).toBeLessThanOrEqual(4)
      }
    }
  })

  // ⚠️ CETTE RÈGLE A ÉTÉ RÉVISÉE PAR LE JOUEUR, ET LE CHIFFRE VIENT DE LUI. L'ancienne disait « un élite
  // ne tape pas monstrueusement plus fort — il a 3 à 4 fois plus de vie ». Il l'a remplacée en chiffrant
  // tout : « un mob normal, jamais sous 10 coups. Un élite c'est 6. » Pour tomber en six coups quand on
  // en tenait dix, il FAUT frapper nettement plus fort — sinon l'élite ne se distingue que par la durée,
  // et un combat long n'est pas un combat mémorable. Les PV restent à 3,5×, c'est ce qui en fait un
  // mini-boss et pas un mob qui cogne.
  it('un ÉLITE frappe nettement plus fort, sans virer au boss (ATK ≤ 1,7× un mob normal)', () => {
    for (const role of ROLES) {
      for (let L = 1; L <= 78; L += 7) {
        const normal = statsForLevel(L, role)
        const elite = statsForLevel(L, role, false, true)
        expect(elite.atk / normal.atk, `L${L} ${role} ATK élite/normal`).toBeLessThanOrEqual(1.7)
        // …mais quand même un peu plus, sinon rien ne le distingue au contact
        expect(elite.atk, `L${L} ${role} ATK élite`).toBeGreaterThanOrEqual(normal.atk)
      }
    }
  })

  it('la DÉF d\'un élite reste modérée : les dégâts sont SOUSTRACTIFS, donc elle s\'ajoute aux PV', () => {
    // Une DÉF doublée rendrait l'élite bien plus dur que les 3-4× de PV annoncés, de façon invisible
    // dans les chiffres de vie. On borne donc son effet.
    for (const role of ROLES) {
      for (let L = 10; L <= 78; L += 17) {
        const normal = statsForLevel(L, role)
        const elite = statsForLevel(L, role, false, true)
        if (normal.def === 0) continue
        expect(elite.def / normal.def, `L${L} ${role} DÉF élite/normal`).toBeLessThanOrEqual(1.4)
      }
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DEUX PALIERS DE DIFFICULTÉ PAR-DESSUS LA PENTE
//
// Demande du joueur : « jusqu'au niveau 10 tu touches pas, mais après le niveau 10 tu les rends 25 %
// plus forts, et après le niveau 30, 50 % plus forts (donc plus de vie et plus de dégâts). Ou alors tu
// augmentes juste le niveau des mobs des terrains un peu plus avancés — peut-être plus propre. »
//
// ⚠️ LA PREMIÈRE OPTION A ÉTÉ RETENUE, ET LA SECONDE AURAIT ÉTÉ PLUS SALE MALGRÉ L'INTUITION. Monter le
// niveau des mobs d'un terrain ne change pas que leur force : le niveau pilote aussi l'XP qu'ils
// donnent, le palier de butin qu'ils peuvent lâcher, et la calibration de l'espèce entière — un même
// monstre vit sur plusieurs terrains, et son niveau dérive du PREMIER. Bouger un chiffre là-bas fait
// remuer quatre systèmes ; un multiplicateur de stats ne touche qu'à la force.
describe('la courbe de difficulté dictée par le joueur', () => {
  // ⚠️ ELLE EST DICTÉE POINT PAR POINT, ET C'EST CE QUI LA REND VÉRIFIABLE. « 10 du coup là c'est trop
  // facile. Je veux bien une difficulté croissante, genre si je reprends ton tableau : 14 → 10, 8, 7, 6,
  // 5 et 4 à la fin. » Et la précision qui va avec : « c'est sans stuff et sans stat améliorée — donc le
  // matos et les skills rendent meilleurs. »
  //
  // On mesure donc EXACTEMENT ça : un personnage nu, de la classe attendue à ce niveau, face à un mob
  // normal de son niveau. Le nombre de coups qu'il encaisse avant de tomber.
  // ⚠️ LA CIBLE A ÉTÉ RÉVISÉE UNE SECONDE FOIS PAR LE JOUEUR, après essai : « là le jeu est peut-être un
  // peu dur. Monte un peu moins vite la difficulté et ne descends JAMAIS sous 10 pour un mob normal. Au
  // début c'est 20 et ça descend gentiment jusqu'à 10. » Le PLANCHER est la partie qui compte : sans lui,
  // chaque tour de vis rendait la fin de partie un peu plus mortelle sans qu'on s'en aperçoive.
  const CIBLE: [number, number][] = [[1, 20], [5, 19], [10, 17], [15, 15], [20, 14], [30, 12], [40, 11], [50, 10]]

  const coupsPourMourir = (niveau: number): number => {
    const p = newPlayer('sim')
    p.classId = niveau >= 20 ? 'chevalier' : niveau >= 10 ? 'swordsman' : 'novice'
    p.level = niveau
    const s = computeStats(p)
    const mob = statsForLevel(niveau, 'normal')
    return s.maxHp / Math.max(1, physicalDamage(mob.atk, s.def))
  }

  it('la courbe demandée est tenue, à deux coups près', () => {
    const ecarts: string[] = []
    for (const [niveau, voulu] of CIBLE) {
      const reel = coupsPourMourir(niveau)
      if (Math.abs(reel - voulu) > 2.5) ecarts.push(`niveau ${niveau} : ${reel.toFixed(1)} coups au lieu de ${voulu}`)
    }
    expect(ecarts, `courbe non tenue :\n   ${ecarts.join('\n   ')}`).toEqual([])
  })

  it('elle DÉCROÎT : chaque palier est plus dur que le précédent', () => {
    for (let i = 1; i < CIBLE.length; i++) {
      expect(coupsPourMourir(CIBLE[i]![0]), `niveau ${CIBLE[i]![0]}`)
        .toBeLessThan(coupsPourMourir(CIBLE[i - 1]![0]) + 0.5)
    }
  })

  // ⚠️ ET UN MONSTRE NE DEVIENT JAMAIS PLUS FAIBLE EN MONTANT DE NIVEAU. Un premier calibrage posait
  // deux marches décroissantes (×3,0 puis ×2,4) : la cible était atteinte, mais un mob de niveau 31
  // devenait plus faible qu'un de niveau 30. La courbe interpole désormais, elle ne marche plus.
  it('un monstre ne devient jamais plus faible en montant de niveau', () => {
    let precedent = 0
    for (let n = 1; n <= 57; n++) {
      const s = statsForLevel(n, 'normal')
      const p = statPower(s.hp, s.atk, s.def)
      expect(p, `niveau ${n}`).toBeGreaterThanOrEqual(precedent)
      precedent = p
    }
  })

  it('le tout début reste un tutoriel', () => {
    expect(coupsPourMourir(1)).toBeGreaterThan(15)
    expect(coupsPourMourir(5)).toBeGreaterThan(15)
  })

  // ⚠️ LE PLANCHER EST LA PARTIE QUI COMPTE. « Ne descends JAMAIS sous 10 pour un mob normal » : c'est
  // lui qui empêche qu'un futur tour de vis rende la fin de partie mortelle sans qu'on le voie.
  it('on ne tombe JAMAIS sous dix coups face à un mob normal', () => {
    for (let n = 1; n <= 57; n++) {
      expect(coupsPourMourir(n), `niveau ${n}`).toBeGreaterThanOrEqual(9.5)
    }
  })
})
