import { describe, it, expect } from 'vitest'
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
  it('pour un rôle donné, chaque stat croît avec le niveau', () => {
    for (const role of ROLES) {
      for (let L = 1; L < 79; L++) {
        const a = statsForLevel(L, role)
        const b = statsForLevel(L + 2, role)
        expect(b.hp).toBeGreaterThan(a.hp)
        expect(b.atk).toBeGreaterThan(a.atk)
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
      expect(hi / lo, `L${L}`).toBeLessThanOrEqual(1.2)
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

  it('un ÉLITE ne tape PAS monstrueusement plus fort (ATK ≤ 1,15× un mob normal)', () => {
    for (const role of ROLES) {
      for (let L = 1; L <= 78; L += 7) {
        const normal = statsForLevel(L, role)
        const elite = statsForLevel(L, role, false, true)
        expect(elite.atk / normal.atk, `L${L} ${role} ATK élite/normal`).toBeLessThanOrEqual(1.15)
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
describe('paliers de difficulté', () => {
  // ⚠️ « APRÈS le niveau 10 » = À PARTIR DE 11. Le début de partie est calibré au monstre près, et le
  // niveau 10 en fait encore partie : la marche commence juste après.
  it('jusqu\'au niveau 10 inclus, rien ne change', () => {
    for (const n of [1, 5, 9, 10]) expect(palierDifficulte(n), `niveau ${n}`).toBe(1)
  })

  it('à partir de 11 : +25 %, à partir de 31 : +50 %', () => {
    for (const n of [11, 15, 30]) expect(palierDifficulte(n), `niveau ${n}`).toBe(1.25)
    for (const n of [31, 40, 57]) expect(palierDifficulte(n), `niveau ${n}`).toBe(1.5)
  })

  it('les paliers s\'AJOUTENT à la pente, ils ne la remplacent pas', () => {
    // la pente existait déjà : à 20, elle vaut ~1,35 en PV — le palier la multiplie, il ne l'écrase pas
    expect(durcissement(20).hp).toBeGreaterThan(1.25 * 1.3)
    expect(durcissement(9).hp).toBeLessThan(1.0001) // et sous le seuil, toujours rien
  })

  it('un monstre ne devient jamais plus faible en montant de niveau', () => {
    let precedent = 0
    for (let n = 1; n <= 57; n++) {
      const s = statsForLevel(n, 'normal')
      const p = statPower(s.hp, s.atk, s.def)
      expect(p, `niveau ${n}`).toBeGreaterThan(precedent)
      precedent = p
    }
  })

  it('le saut de palier se voit, sans être brutal', () => {
    const avant = statsForLevel(30, 'normal'), apres = statsForLevel(31, 'normal')
    const rapport = statPower(apres.hp, apres.atk, apres.def) / statPower(avant.hp, avant.atk, avant.def)
    expect(rapport, 'la marche doit se sentir').toBeGreaterThan(1.1)
    expect(rapport, 'mais pas doubler d\'un niveau à l\'autre').toBeLessThan(1.5)
  })
})
