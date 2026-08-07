import { describe, it, expect } from 'vitest'
import { PREMIERS_PAS, doitMontrerPremiersPas, CLE_PREMIERS_PAS } from '../../src/core/premiers-pas'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA RÈGLE DU JEU, DITE UNE BONNE FOIS
//
// Demande du joueur : « au début, explique CLAIREMENT qu'il FAUT tuer un maxxx de monstres pour gagner
// l'XP et devenir fort. C'est pas clair pour tous les joueurs. »
//
// ⚠️ RIEN NE LE DISAIT, ET C'EST LA BOUCLE ENTIÈRE DU JEU. On arrive sur le premier terrain avec une
// sortie à droite : tout invite à courir vers elle. Or courir vers la sortie ne fait pas monter d'un
// niveau — et le terrain suivant monte en difficulté. Le joueur qui traverse sans combattre arrive
// systématiquement sous-niveau, meurt, et n'a aucun moyen de comprendre pourquoi.
//
// Il parlait des AUTRES joueurs, pas de lui, ce qui rend le retour encore plus juste : celui qui
// connaît le jeu ne peut pas mesurer ce qui manque à celui qui le découvre.

describe('premiers pas', () => {
  // ⚠️ LA CONDITION EST « NIVEAU 1 », PAS « PREMIER TERRAIN ». Un joueur qui recommence sur un autre
  // pseudo, ou qui revient après avoir tout perdu, a autant besoin de la consigne que le premier jour ;
  // un joueur de niveau 20 qui rejoue la Prairie n'a pas besoin qu'on la lui répète. C'est l'état du
  // personnage qui décide, pas l'historique de la carte.
  it('s\'impose au débutant, une seule fois', () => {
    expect(doitMontrerPremiersPas(1, false)).toBe(true)
    expect(doitMontrerPremiersPas(1, true), 'déjà vu').toBe(false)
  })

  it('ne s\'impose plus dès qu\'on a monté un niveau', () => {
    for (const niveau of [2, 5, 20, 45]) {
      expect(doitMontrerPremiersPas(niveau, false), `niveau ${niveau}`).toBe(false)
    }
  })

  // ⚠️ ON L'ÉCRIT EN IMPÉRATIF, PAS EN DESCRIPTION. « Les monstres donnent de l'expérience » est une
  // note de bas de page ; « Tue tout ce que tu croises » est une consigne. La différence décide si le
  // message est lu ou parcouru — et c'est tout l'objet de la demande (« explique CLAIREMENT »).
  it('la consigne est un ORDRE, et elle est en tête', () => {
    const premiere = PREMIERS_PAS.lignes.find((l) => l.trim().length > 0)!
    expect(premiere.toUpperCase(), 'la première ligne ne commande rien').toContain('TUE')
    expect(premiere).toBe(premiere.toUpperCase().replace('⚔', '⚔')) // criée, pas murmurée
  })

  it('dit les trois choses qui manquaient : d\'où vient l\'XP, à quoi elle sert, qu\'on peut refarmer', () => {
    const texte = PREMIERS_PAS.lignes.join(' ').toLowerCase()
    expect(texte, 'ne dit pas d\'où vient l\'expérience').toContain('expérience')
    expect(texte, 'ne dit pas ce que monter de niveau apporte').toMatch(/pv|attaque|défense/)
    expect(texte, 'ne dit pas qu\'un terrain se rejoue').toMatch(/rejou|revien|farm/)
  })

  it('tient dans un panneau : lignes courtes et pas trop nombreuses', () => {
    expect(PREMIERS_PAS.lignes.length, 'panneau trop long, on ne le lira pas').toBeLessThanOrEqual(14)
    for (const l of PREMIERS_PAS.lignes) {
      expect(l.length, `ligne trop longue : « ${l} »`).toBeLessThanOrEqual(84)
    }
    expect(PREMIERS_PAS.titre.length).toBeLessThanOrEqual(24)
    expect(PREMIERS_PAS.pied.trim().length).toBeGreaterThan(0)
  })

  it('la clé de mémorisation est stable et nommée', () => {
    expect(CLE_PREMIERS_PAS).toMatch(/^panda-/)
  })
})
