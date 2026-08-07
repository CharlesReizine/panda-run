import { describe, it, expect } from 'vitest'
import {
  NIVEAU_SUR, NIVEAU_MAX, CASSE_PLATEAU, risqueDeCasse, pureteDe, coutAmelioration, coutLisible,
  blocageAmelioration, peutAmeliorer, tenterAmelioration, niveauDe,
} from '../../src/core/amelioration'
import { newPlayer } from '../../src/core/player-state'
import type { PlayerState } from '../../src/core/player-state'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AMÉLIORER — SÛR JUSQU'À +3, PUIS ÇA CASSE
//
// Demande du joueur : « la forge faut reprendre, je veux plus de "reforger", tu dégages. Par contre
// chaud d'un onglet "Améliorer" qui permet d'améliorer sans risque de casse jusqu'à +3 (et ça coûte un
// peu cher). Et le coût dépend de la pureté de l'objet. Et après ça casse. Genre +4 tu as 20 % de
// chance, +5 25 %, +6 28 %, +7 29 %, et après +8 c'est 30 % à chaque fois de casse. »
//
// ⚠️ CE N'EST PAS UN RENOMMAGE DE LA RÉFORGE. L'ancienne montait à +10 sans le moindre risque : la
// seule question était « ai-je assez de minerai ? », et la réponse finissait toujours par être oui. Il
// n'y avait aucune DÉCISION, juste une file d'attente. Le risque change la nature de l'objet — à +3 on
// tient quelque chose qu'on peut perdre.
//
// ⚠️ ET C'EST L'ARGENT DÉBITÉ SUR UN ÉCHEC QUI FAIT LE PARI. Rembourser une tentative ratée en ferait
// une attente, pas un risque. Ce test l'exige explicitement, parce que c'est exactement le genre de
// « gentillesse » qu'une relecture bien intentionnée ajouterait sans voir qu'elle vide la mécanique.

const joueur = (): PlayerState => {
  const p = newPlayer('forgeron')
  p.gold = 10_000_000
  p.materials = { 'minerai-fer': 9999, 'gemme-brute': 9999 }
  return p
}

describe('amélioration', () => {
  // ── LE BARÈME, TEL QUE DICTÉ ───────────────────────────────────────────────────────────────
  it('les trois premiers niveaux sont SÛRS', () => {
    for (let vise = 1; vise <= NIVEAU_SUR; vise++) expect(risqueDeCasse(vise), `+${vise}`).toBe(0)
  })

  it('le barème de casse est exactement celui demandé', () => {
    expect(risqueDeCasse(4)).toBe(0.20)
    expect(risqueDeCasse(5)).toBe(0.25)
    expect(risqueDeCasse(6)).toBe(0.28)
    expect(risqueDeCasse(7)).toBe(0.29)
    // « et après +8 c'est 30 % à chaque fois » : un plateau, pas une pente
    for (const vise of [8, 9, 10, 14]) expect(risqueDeCasse(vise), `+${vise}`).toBe(CASSE_PLATEAU)
  })

  it('le risque ne redescend jamais quand on monte', () => {
    for (let vise = 2; vise <= 14; vise++) {
      expect(risqueDeCasse(vise), `+${vise}`).toBeGreaterThanOrEqual(risqueDeCasse(vise - 1))
    }
  })

  // ── LA PURETÉ ──────────────────────────────────────────────────────────────────────────────
  //
  // « Le coût dépend de la pureté de l'objet. » L'écart doit être FRANC : si améliorer un légendaire
  // coûtait 20 % de plus qu'un commun, personne ne s'en apercevrait et la règle n'existerait pas.
  it('plus l\'objet est pur, plus il coûte cher — et nettement', () => {
    const rang = ['epee-bambou', 'baton-cristal', 'baton-lumineux', 'baton-cosmique'] // commun→légendaire
    const couts = rang.map((id) => coutAmelioration(0, pureteDe(id)).gold)
    expect(couts).toEqual([...couts].sort((a, b) => a - b)) // monotone croissant
    expect(couts[couts.length - 1]! / couts[0]!, 'écart commun → légendaire').toBeGreaterThanOrEqual(4)
  })

  it('le coût monte franchement à chaque cran', () => {
    const p = pureteDe('epee-bambou')
    for (let n = 1; n < NIVEAU_MAX; n++) {
      expect(coutAmelioration(n, p).gold, `+${n + 1}`).toBeGreaterThan(coutAmelioration(n - 1, p).gold)
    }
    // « ça coûte un peu cher » : le +3 d'un commun n'est pas une broutille de premier biome
    expect(coutAmelioration(2, p).gold).toBeGreaterThan(300)
  })

  it('le coût affiché ne montre pas de ligne « 0 gemme »', () => {
    const c = coutLisible(0, 1)
    for (const [mat, n] of Object.entries(c.materials)) expect(n, mat).toBeGreaterThan(0)
    // au-delà du palier sûr, la gemme apparaît : le prix du risque se voit dans la liste
    expect(Object.keys(coutLisible(NIVEAU_SUR, 1).materials)).toContain('gemme-brute')
  })

  // ── CE QUI BLOQUE ──────────────────────────────────────────────────────────────────────────
  it('dit CE QUI manque, pas juste « impossible »', () => {
    const p = joueur()
    p.gold = 0
    expect(blocageAmelioration(p, 'epee-bambou')).toContain('or')
    const q = joueur()
    q.materials = {}
    expect(blocageAmelioration(q, 'epee-bambou')).toContain('minerai-fer')
  })

  it('on n\'améliore pas au-delà du plafond', () => {
    const p = joueur()
    p.upgrades['epee-bambou'] = NIVEAU_MAX
    expect(peutAmeliorer(p, 'epee-bambou')).toBe(false)
    expect(blocageAmelioration(p, 'epee-bambou')).toContain(`+${NIVEAU_MAX}`)
  })

  // ── LA TENTATIVE ───────────────────────────────────────────────────────────────────────────
  it('sous le palier sûr, ça monte à tous les coups — même avec le pire tirage', () => {
    const p = joueur()
    p.inventory.push('epee-bambou')
    for (let n = 1; n <= NIVEAU_SUR; n++) {
      const r = tenterAmelioration(p, 'epee-bambou', () => 0) // rng le plus défavorable possible
      expect(r?.issue, `+${n}`).toBe('monte')
      expect(r?.niveau).toBe(n)
      expect(r?.risque).toBe(0)
    }
    expect(niveauDe(p, 'epee-bambou')).toBe(NIVEAU_SUR)
  })

  it('au-delà, un mauvais tirage DÉTRUIT l\'objet', () => {
    const p = joueur()
    p.inventory.push('epee-bambou')
    p.upgrades['epee-bambou'] = NIVEAU_SUR
    const r = tenterAmelioration(p, 'epee-bambou', () => 0)
    expect(r?.issue).toBe('casse')
    expect(p.inventory).not.toContain('epee-bambou')
    expect(p.upgrades['epee-bambou']).toBeUndefined()
  })

  // ⚠️ L'OBJET ÉQUIPÉ AUSSI. Ne nettoyer que l'inventaire laisserait un objet FANTÔME porté par le
  // panda, avec ses bonus, invendable et inaméliorable — un état que rien dans le jeu ne sait défaire.
  it('un objet qui casse quitte AUSSI l\'emplacement équipé', () => {
    const p = joueur()
    p.equipment.weapon = 'epee-bambou'
    p.upgrades['epee-bambou'] = NIVEAU_SUR
    tenterAmelioration(p, 'epee-bambou', () => 0)
    expect(p.equipment.weapon).toBeNull()
  })

  it('un bon tirage passe, au même niveau et au même risque', () => {
    const p = joueur()
    p.inventory.push('epee-bambou')
    p.upgrades['epee-bambou'] = NIVEAU_SUR
    const r = tenterAmelioration(p, 'epee-bambou', () => 0.99)
    expect(r?.issue).toBe('monte')
    expect(r?.niveau).toBe(NIVEAU_SUR + 1)
    expect(r?.risque).toBe(0.20)
    expect(p.inventory).toContain('epee-bambou')
  })

  // ⚠️ LE COÛT EST DÉBITÉ MÊME QUAND ÇA CASSE : c'est ce qui fait le pari. Une tentative ratée qui
  // rembourserait ne serait pas un risque, juste une attente.
  it('l\'échec coûte exactement ce que coûtait la tentative', () => {
    const p = joueur()
    p.inventory.push('epee-bambou')
    p.upgrades['epee-bambou'] = NIVEAU_SUR
    const attendu = coutLisible(NIVEAU_SUR, pureteDe('epee-bambou'))
    const orAvant = p.gold, ferAvant = p.materials['minerai-fer']!
    tenterAmelioration(p, 'epee-bambou', () => 0)
    expect(orAvant - p.gold).toBe(attendu.gold)
    expect(ferAvant - p.materials['minerai-fer']!).toBe(attendu.materials['minerai-fer'])
  })

  it('une tentative impossible ne mute RIEN', () => {
    const p = joueur()
    p.gold = 0
    const avant = JSON.stringify({ g: p.gold, m: p.materials, u: p.upgrades, i: p.inventory })
    expect(tenterAmelioration(p, 'epee-bambou', () => 0)).toBeNull()
    expect(JSON.stringify({ g: p.gold, m: p.materials, u: p.upgrades, i: p.inventory })).toBe(avant)
  })

  it('le taux de casse observé colle au barème annoncé', () => {
    // balayage déterministe de l'espace des probabilités, pas un rng secoué
    for (const vise of [4, 5, 8]) {
      let casses = 0
      const N = 1000
      for (let i = 0; i < N; i++) {
        const p = joueur()
        p.inventory.push('epee-bambou')
        p.upgrades['epee-bambou'] = vise - 1
        if (tenterAmelioration(p, 'epee-bambou', () => (i + 0.5) / N)?.issue === 'casse') casses++
      }
      expect(casses / N, `+${vise}`).toBeCloseTo(risqueDeCasse(vise), 2)
    }
  })
})
