import { describe, it, expect } from 'vitest'
import {
  indiceDe, terrainsDuMonstre, terrainsDuMateriau, nomDeTerrain, MAX_TERRAINS_CITES,
} from '../../src/core/indices-quete'
import { QUEST_CHAIN } from '../../src/data/shops'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { WORLD_NODES } from '../../src/data/worldmap'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// OÙ TROUVER CE QU'UNE QUÊTE DEMANDE
//
// Demande du joueur : « dans les quêtes tu peux mettre un petit "i" sur chaque quête, et on peut voir
// dans quelles maps on peut trouver les mobs ou autres indices. Ça peut être vachement plus sympa pour
// l'utilisateur. »
//
// ⚠️ L'INFORMATION EXISTAIT DÉJÀ, ELLE N'ÉTAIT NULLE PART. Un joueur à qui l'on demande quinze Gloopy
// devait les CHERCHER : rien, dans le jeu, ne disait où ils vivent. Il reparcourait donc des terrains au
// hasard — et comme la carte est longue, il finissait par jouer à autre chose. Le croisement
// « monstre → terrains » se calcule pourtant en deux boucles sur des données disponibles depuis
// toujours. C'est le genre d'aide dont l'absence ne se voit dans aucun test.

describe('indices de quête', () => {
  it('chaque quête de la chaîne produit un indice utilisable', () => {
    for (const def of QUEST_CHAIN) {
      const i = indiceDe(def)
      expect(i.quoi.trim().length, def.id).toBeGreaterThan(0)
      // une quête ciblée DOIT dire où aller ; seule `kill-any` a le droit de ne rien citer
      if (def.type !== 'kill-any') {
        expect(i.ou.length, `${def.id} : aucun terrain cité`).toBeGreaterThan(0)
      }
      expect(i.ou.length, `${def.id} cite trop de terrains`).toBeLessThanOrEqual(MAX_TERRAINS_CITES)
    }
  })

  // ⚠️ ON NOMME LES TERRAINS COMME LA CARTE LES NOMME. `levels.ts` connaît « jungle-5 », la carte
  // affiche « Marais ». Un indice qui répondrait « jungle-5 » ferait chercher sur la carte un nom qui
  // n'y figure pas : l'indice serait un second problème plutôt qu'une aide.
  it('les terrains sont nommés comme sur la carte, jamais par leur id', () => {
    const nomsCarte = new Set(WORLD_NODES.map((n) => n.name))
    for (const def of QUEST_CHAIN) {
      for (const ou of indiceDe(def).ou) {
        const nom = ou.replace(/ \(\d+ %\)$/, '') // les matériaux portent leur taux entre parenthèses
        expect(nomsCarte.has(nom), `${def.id} cite « ${nom} », absent de la carte`).toBe(true)
        expect(nom, `${def.id} montre un id brut`).not.toMatch(/^[a-z]+-\d+$/)
      }
    }
  })

  it('« quels qu\'ils soient » ne cite aucun terrain, et le DIT', () => {
    const any = QUEST_CHAIN.find((q) => q.type === 'kill-any')!
    const i = indiceDe(any)
    expect(i.ou).toEqual([])
    // une liste vide sans explication se lirait comme un bug : l'astuce est ici obligatoire
    expect(i.astuce, 'rien n\'explique la liste vide').toBeTruthy()
  })

  it('un monstre est cité sur TOUS les terrains où il apparaît, boss compris', () => {
    const gloopy = terrainsDuMonstre('gloopy')
    expect(gloopy.length).toBeGreaterThan(0)
    for (const id of gloopy) {
      const l = LEVELS[id]!
      expect(l.spawns.some((s) => s.monsterId === 'gloopy') || l.boss === 'gloopy', id).toBe(true)
    }
    // et aucun terrain qui le porte n'est oublié
    const attendus = Object.values(LEVELS)
      .filter((l) => l.spawns.some((s) => s.monsterId === 'gloopy') || l.boss === 'gloopy').map((l) => l.id)
    expect(new Set(gloopy)).toEqual(new Set(attendus))
  })

  it('un monstre inconnu ne fait pas semblant de savoir', () => {
    expect(terrainsDuMonstre('monstre-qui-n-existe-pas')).toEqual([])
  })

  // ⚠️ LES MATÉRIAUX SE CLASSENT PAR CHANCE DE BUTIN, PAS PAR PROXIMITÉ. Un matériau qui tombe à 2 %
  // sur le terrain d'à côté et à 40 % trois cartes plus loin s'y farme trois fois plus vite malgré le
  // trajet : citer le plus proche d'abord enverrait le joueur au mauvais endroit avec la bénédiction
  // du jeu.
  it('les sources d\'un matériau sont classées du plus généreux au moins généreux', () => {
    const fetch = QUEST_CHAIN.find((q) => q.type === 'fetch' && q.targetId)
    if (!fetch?.targetId) return
    const sources = terrainsDuMateriau(fetch.targetId)
    expect(sources.length).toBeGreaterThan(0)
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i]!.chance, `${sources[i]!.levelId} après ${sources[i - 1]!.levelId}`)
        .toBeLessThanOrEqual(sources[i - 1]!.chance)
    }
    for (const s of sources) expect(s.chance, s.levelId).toBeGreaterThan(0)
  })

  it('le nom d\'un terrain inconnu ne plante pas', () => {
    expect(nomDeTerrain('terrain-fantome')).toBe('terrain-fantome')
  })

  it('une liste tronquée dit combien de terrains elle tait', () => {
    for (const def of QUEST_CHAIN) {
      const i = indiceDe(def)
      if (def.type === 'kill-any') continue
      const total = def.type === 'fetch' && def.targetId
        ? terrainsDuMateriau(def.targetId).length
        : def.targetId ? terrainsDuMonstre(def.targetId).length : 0
      if (total > MAX_TERRAINS_CITES) {
        expect(i.astuce, `${def.id} tronque sans le dire`).toMatch(/autres/)
      }
    }
  })

  // ── LA TÊTE DU MONSTRE ─────────────────────────────────────────────────────────────────────
  //
  // Demande du joueur : « dans les quêtes où faut défoncer du mob, tu peux mettre la photo du mob à
  // défoncer en plus d'où on peut le trouver ». Un nom se LIT, une bestiole se RECONNAÎT : savoir où
  // aller ne sert à rien si, une fois sur place, on ne sait pas laquelle des cinq espèces présentes on
  // est censé chasser.
  it('une quête qui vise un monstre donne son id, pour qu\'on puisse montrer sa tête', () => {
    for (const def of QUEST_CHAIN) {
      const i = indiceDe(def)
      if (def.type === 'kill-type' || def.type === 'kill-boss') {
        expect(i.monstreId, `${def.id} ne dit pas quel monstre montrer`).toBe(def.targetId)
        expect(MONSTERS[i.monstreId!], `${def.id} cite un monstre inconnu`).toBeDefined()
      } else {
        // ⚠️ ET LES AUTRES N'EN DONNENT PAS. Une quête « tue 10 monstres quels qu'ils soient » ou une
        // collecte de matériau n'a pas de tête à montrer : en inventer une désignerait une cible fausse.
        expect(i.monstreId, `${def.id} ne devrait montrer aucun monstre`).toBeUndefined()
      }
    }
  })
})