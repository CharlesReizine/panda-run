import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { acceptQuest, refreshQuestProgress, claimQuest, currentChainQuest, questXpReward } from '../../src/core/quests'
import { xpToNext } from '../../src/core/progression'
import { QUESTS, QUEST_CHAIN } from '../../src/data/shops'

// ids réels de la chaîne (un par type)
const KILL_ANY = 'chasse-aux-monstres' // kill-any 10
const KILL_TYPE = 'nettoyage-plaine' // kill-type gloopy 15
const FETCH = 'collecte-crocs' // fetch croc-de-loup 4
const KILL_BOSS = 'traque-gardien-sylve' // kill-boss boss-sylve

describe('quêtes — type kill-any', () => {
  it('accepter capture le compteur global de départ', () => {
    const p = newPlayer('Panda')
    p.monstersKilled = 3
    acceptQuest(p, KILL_ANY)
    expect(p.quests[KILL_ANY]).toEqual({ startCount: 3, progress: 0, done: false, claimed: false })
  })

  it('ne compte que les kills après acceptation, puis termine à la cible', () => {
    const p = newPlayer('Panda')
    p.monstersKilled = 4
    acceptQuest(p, KILL_ANY)
    p.monstersKilled = 6
    refreshQuestProgress(p, KILL_ANY)
    expect(p.quests[KILL_ANY]!.progress).toBe(2)
    expect(p.quests[KILL_ANY]!.done).toBe(false)
    p.monstersKilled = 4 + QUESTS[KILL_ANY]!.targetCount
    refreshQuestProgress(p, KILL_ANY)
    expect(p.quests[KILL_ANY]!.done).toBe(true)
  })

  it('réclamer verse or + potions', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[KILL_ANY]!
    acceptQuest(p, KILL_ANY)
    p.monstersKilled = def.targetCount
    refreshQuestProgress(p, KILL_ANY)
    const gold = p.gold
    const potions = p.potions
    expect(claimQuest(p, KILL_ANY)).toBe(true)
    expect(p.gold).toBe(gold + def.rewardGold)
    expect(p.potions).toBe(potions + (def.rewardPotions ?? 0))
    expect(p.quests[KILL_ANY]!.claimed).toBe(true)
  })
})

describe('quêtes — type kill-type', () => {
  it('progresse sur le monstre ciblé, ignore les autres', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[KILL_TYPE]!
    p.killsByMonster = { gloopy: 2, corbeau: 99 }
    acceptQuest(p, KILL_TYPE) // startCount = 2 (gloopy)
    p.killsByMonster.corbeau = 200 // d'autres kills ne comptent pas
    p.killsByMonster.gloopy = 5
    refreshQuestProgress(p, KILL_TYPE)
    expect(p.quests[KILL_TYPE]!.progress).toBe(3)
    p.killsByMonster.gloopy = 2 + def.targetCount
    refreshQuestProgress(p, KILL_TYPE)
    expect(p.quests[KILL_TYPE]!.done).toBe(true)
  })

  it('réclamer pousse l\'objet de récompense dans l\'inventaire', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[KILL_TYPE]!
    acceptQuest(p, KILL_TYPE)
    p.killsByMonster.gloopy = def.targetCount
    refreshQuestProgress(p, KILL_TYPE)
    expect(claimQuest(p, KILL_TYPE)).toBe(true)
    expect(p.inventory).toContain(def.rewardItemId)
  })
})

describe('quêtes — type kill-boss', () => {
  it('terminée dès que le boss est tué une fois après acceptation', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[KILL_BOSS]!
    acceptQuest(p, KILL_BOSS)
    refreshQuestProgress(p, KILL_BOSS)
    expect(p.quests[KILL_BOSS]!.done).toBe(false)
    p.killsByMonster[def.targetId!] = 1
    refreshQuestProgress(p, KILL_BOSS)
    expect(p.quests[KILL_BOSS]!.done).toBe(true)
  })

  it('un boss déjà tué AVANT acceptation ne valide pas la quête', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[KILL_BOSS]!
    p.killsByMonster[def.targetId!] = 1
    acceptQuest(p, KILL_BOSS)
    refreshQuestProgress(p, KILL_BOSS)
    expect(p.quests[KILL_BOSS]!.done).toBe(false)
  })
})

describe('quêtes — type fetch', () => {
  it('progresse selon les matériaux détenus et termine à la cible', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[FETCH]!
    acceptQuest(p, FETCH)
    p.materials[def.targetId!] = def.targetCount - 1
    refreshQuestProgress(p, FETCH)
    expect(p.quests[FETCH]!.done).toBe(false)
    p.materials[def.targetId!] = def.targetCount
    refreshQuestProgress(p, FETCH)
    expect(p.quests[FETCH]!.done).toBe(true)
  })

  it('réclamer CONSOMME les matériaux et verse la récompense', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[FETCH]!
    acceptQuest(p, FETCH)
    p.materials[def.targetId!] = def.targetCount + 2 // surplus
    refreshQuestProgress(p, FETCH)
    const gold = p.gold
    expect(claimQuest(p, FETCH)).toBe(true)
    expect(p.materials[def.targetId!]).toBe(2) // N consommés
    expect(p.gold).toBe(gold + def.rewardGold)
    expect(p.inventory).toContain(def.rewardItemId)
  })

  it('refuse la remise si les matériaux ont été dépensés entre-temps', () => {
    const p = newPlayer('Panda')
    const def = QUESTS[FETCH]!
    acceptQuest(p, FETCH)
    p.materials[def.targetId!] = def.targetCount
    refreshQuestProgress(p, FETCH)
    p.materials[def.targetId!] = 0 // dépensés avant de réclamer
    expect(claimQuest(p, FETCH)).toBe(false)
  })
})

describe('quêtes — chaîne du garde', () => {
  it('propose la première quête non réclamée dans l\'ordre', () => {
    const p = newPlayer('Panda')
    expect(currentChainQuest(p)!.id).toBe(QUEST_CHAIN[0]!.id)
  })

  it('avance à la quête suivante une fois la courante réclamée', () => {
    const p = newPlayer('Panda')
    const first = QUEST_CHAIN[0]!
    acceptQuest(p, first.id)
    p.monstersKilled = first.targetCount
    refreshQuestProgress(p, first.id)
    claimQuest(p, first.id)
    expect(currentChainQuest(p)!.id).toBe(QUEST_CHAIN[1]!.id)
  })

  it('renvoie null quand toute la chaîne est réclamée', () => {
    const p = newPlayer('Panda')
    for (const def of QUEST_CHAIN) p.quests[def.id] = { startCount: 0, progress: def.targetCount, done: true, claimed: true }
    expect(currentChainQuest(p)).toBeNull()
  })

  it('une quête en cours (non finie) ne fait pas avancer la chaîne', () => {
    const p = newPlayer('Panda')
    const first = QUEST_CHAIN[0]!
    acceptQuest(p, first.id)
    expect(currentChainQuest(p)!.id).toBe(first.id)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'XP DE QUÊTE — retour joueur : « là le jeu incite pas trop à les faire. et faudrait gagner de l'xpppp »
//
// `claimQuest` versait de l'or, des potions et un objet, et ZÉRO XP : une quête ne faisait donc pas
// progresser, alors que farmer trois minutes, si. L'XP est exprimée en PART DE NIVEAU (et non en nombre
// d'XP en dur) pour rester juste quand la courbe bouge — son coefficient a déjà changé deux fois.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('XP de quête', () => {
  const finir = (p: ReturnType<typeof newPlayer>, def: typeof QUEST_CHAIN[number]) => {
    acceptQuest(p, def.id)
    p.quests[def.id] = { startCount: 0, progress: def.targetCount, done: true, claimed: false }
  }

  it('réclamer une quête DONNE de l\'XP', () => {
    const p = newPlayer('Panda')
    const avant = p.xp
    const def = QUEST_CHAIN[0]!
    finir(p, def)
    expect(claimQuest(p, def.id)).toBe(true)
    expect(p.xp + xpToNext(1) * (p.level - 1)).toBeGreaterThan(avant) // l'XP a bougé, niveau compris
  })

  it('une quête de CHASSE vaut un demi-niveau, une quête de BOSS un niveau plein', () => {
    const p = newPlayer('Panda')
    p.level = 10
    const chasse = QUEST_CHAIN.find((d) => d.type === 'kill-any')!
    const boss = QUEST_CHAIN.find((d) => d.type === 'kill-boss')!
    expect(questXpReward(p, chasse)).toBe(Math.floor(xpToNext(10) * 0.5))
    expect(questXpReward(p, boss)).toBe(xpToNext(10))
  })

  it('la récompense SUIT la courbe : elle vaut toujours la même part de niveau', () => {
    // C'est tout l'intérêt de ne pas l'écrire en dur : à n'importe quel niveau, une quête de chasse
    // reste un demi-niveau. Un nombre fixe vaudrait un demi-niveau au début et trois miettes à la fin.
    const chasse = QUEST_CHAIN.find((d) => d.type === 'kill-any')!
    for (const niveau of [1, 5, 20, 40]) {
      const p = newPlayer('Panda')
      p.level = niveau
      expect(questXpReward(p, chasse) / xpToNext(niveau)).toBeCloseTo(0.5, 2)
    }
  })

  it('l\'XP passe par grantXp : une quête peut FAIRE MONTER de niveau', () => {
    // Le piège évité : ajouter à la main à `p.xp` laisserait le joueur au-dessus du palier sans jamais
    // passer le niveau, et sans recevoir ses points de compétence — une progression qui semble se perdre.
    const p = newPlayer('Panda')
    p.xp = xpToNext(1) - 1 // à une XP du niveau 2
    const def = QUEST_CHAIN[0]!
    finir(p, def)
    claimQuest(p, def.id)
    expect(p.level).toBeGreaterThan(1)
    expect(p.skillPoints).toBeGreaterThan(0)
  })
})
