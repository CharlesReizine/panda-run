// MOTEUR DE TEST DE JOUABILITÉ (headless).
//
// But : simuler un joueur AU NIVEAU ATTENDU traversant chaque niveau, pour repérer les terrains
// injouables ou injustes AVANT qu'un joueur ne les subisse (aurait attrapé « plaine-1 injouable » :
// des corbeaux Nv5 piquant en grappe sur un novice Nv1). Le modèle est APPROXIMATIF mais COHÉRENT
// avec le vrai moteur (core/combat.physicalDamage, core/stats.computeStats, invulnérabilité 800 ms
// après un coup reçu, cf. LevelScene.hitPlayer).
//
// Tout est en LECTURE SEULE : on consomme les données de jeu générées (LEVELS, MONSTERS, courbe d'XP)
// sans jamais les modifier.

import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'
import { LEVELS, type LevelDef } from '../data/levels'
import { MONSTERS } from '../data/monsters'
import { WORLD_NODES } from '../data/worldmap'
import { physicalDamage } from './combat'
import { cumXpBelow, LEVEL_ORDER, playerLevelForXp } from './mob-level'
import { computeStats } from './stats'
import { newPlayer, type PlayerState } from './player-state'
import type { ClassId, MonsterDef } from './types'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1) NIVEAU ATTENDU par nœud
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// L'ordre de progression du jeu EST l'ordre du tableau `list` de levels.ts (préservé par LEVEL_ORDER,
// cf. mob-level.ts). Le niveau ATTENDU à l'ENTRÉE d'un terrain = le niveau d'un joueur ayant encaissé
// l'XP de TOUS les niveaux situés avant lui, SANS le facteur d'avance 1,5 (ZONE_XP_FACTOR) qui, lui,
// sert à CALIBRER les monstres (mob-level.ts). On modélise donc le joueur « juste à l'heure », pas
// celui qui a farmé — c'est le cas le plus exigeant, et le bon pour détecter l'injuste.

const LEVEL_INDEX: Record<string, number> = {}
LEVEL_ORDER.forEach((l, i) => { LEVEL_INDEX[l.id] = i })

// Résout le levelId d'un nœud de la carte (terrain/boss portent un levelId ; les villes n'en ont pas).
function levelIdOfNode(nodeId: string): string | undefined {
  const n = WORLD_NODES.find((w) => w.id === nodeId)
  if (!n) return LEVELS[nodeId] ? nodeId : undefined // tolère un levelId passé directement
  return n.levelId
}

// Niveau attendu à l'entrée du niveau d'index donné dans l'ordre de progression.
function expectedLevelForIndex(index: number): number {
  return playerLevelForXp(cumXpBelow(index))
}

// Niveau ATTENDU du joueur à l'entrée d'un nœud (id de nœud carte OU id de niveau).
// Ville (sans levelId) → niveau attendu du terrain qui la précède dans l'ordre de la carte.
export function expectedLevel(nodeId: string): number {
  const levelId = levelIdOfNode(nodeId)
  if (levelId && LEVEL_INDEX[levelId] !== undefined) return expectedLevelForIndex(LEVEL_INDEX[levelId])
  // ville : on remonte les nœuds de la carte jusqu'au terrain précédent
  const idx = WORLD_NODES.findIndex((w) => w.id === nodeId)
  for (let i = idx - 1; i >= 0; i--) {
    const lid = WORLD_NODES[i]!.levelId
    if (lid && LEVEL_INDEX[lid] !== undefined) return expectedLevelForIndex(LEVEL_INDEX[lid])
  }
  return 1
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2) JOUEUR REPRÉSENTATIF au niveau attendu
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Classe représentative selon le niveau (le jeu démarre novice, se choisit une classe au Nv10, évolue
// au Nv30) : novice → sabreur → chevalier (voie mêlée équilibrée, la plus « moyenne »). On équipe UNE
// arme du palier attendu (sans armure/accessoire : hypothèse conservatrice, cf. consigne « stats via
// stats.ts + une arme de palier »). Les 2 points de stat/niveau sont répartis de façon réaliste
// (STR pour l'ATK, INT pour les PV, un peu d'AGI) — un joueur ne les laisse pas dormir.

function representativeClass(level: number): ClassId {
  if (level < 10) return 'novice'
  if (level < 30) return 'swordsman'
  return 'chevalier'
}

// Arme de palier (bonus d'ATK croissant) selon le niveau attendu. Les id existent dans data/items.
function tierWeapon(level: number): string {
  if (level < 5) return 'epee-bambou'      // +5 atk
  if (level < 10) return 'sabre-acier'      // +9
  if (level < 18) return 'epee-large'       // +11
  if (level < 30) return 'griffe-royale'    // +14
  if (level < 48) return 'faux-sombre'      // +20 atk / +4 def
  return 'katana-eclair'                    // +21
}

export interface RepresentativePlayer {
  level: number
  classId: ClassId
  atk: number
  def: number
  maxHp: number
  attackSpeed: number
}

export function representativePlayer(level: number): RepresentativePlayer {
  const classId = representativeClass(level)
  const p: PlayerState = newPlayer('sim')
  p.classId = classId
  p.level = level
  // arme de palier (computeStats lit ITEMS[id].bonus quelle que soit la classe)
  const weapon = tierWeapon(level)
  if (ITEMS[weapon]) p.equipment = { weapon }
  // répartition réaliste des points de stat (2/niveau) : 50% STR, 40% INT, 10% AGI
  const pts = Math.max(0, (level - 1)) * 2
  p.allocated = { str: Math.round(pts * 0.5), int: Math.round(pts * 0.4), agi: Math.round(pts * 0.1) }
  const s = computeStats(p)
  return { level, classId, atk: s.atk, def: s.def, maxHp: s.maxHp, attackSpeed: s.attackSpeed }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3) MODÈLE DE COMBAT
// ══════════════════════════════════════════════════════════════════════════════════════════════

// Fenêtre d'invulnérabilité après un coup reçu (LevelScene.invulnUntil = now + 800).
const INVULN_S = 0.8

// EXPOSITION par silhouette de combat : combien de coups on encaisse « naturellement » d'un mob de
// ce type avant de s'en dégager (multiplié ensuite par la coriacité, cf. plus bas). Un mob de contact
// LENT se gère facilement ; un fonceur (charge) rattrape ; un aérien piqueur inflige des dégâts
// largement INÉVITABLES ; un tireur distant grignote pendant l'approche.
function exposure(m: MonsterDef): number {
  if (m.aerial) return 1.7                         // piqueur aérien : dégâts inévitables
  switch (m.behavior) {
    case 'charge': return m.speed >= 110 ? 1.5 : 1.2 // fonceur (d'autant plus vite qu'il est rapide)
    case 'projectile': return 0.9                    // tireur fixe : chip à l'approche
    case 'caster': return 1.1
    case 'contact':
    default: return m.speed <= 40 ? 0.6 : 1.0        // contact lent = quasi maîtrisé
  }
}

export interface MobThreat {
  id: string
  level: number
  hp: number
  atk: number
  def: number
  ttk: number          // temps pour tuer le mob (s)
  dmgPerHit: number    // dégâts reçus par coup du mob
  hits: number         // coups estimés encaissés sur l'engagement
  hpLost: number       // PV perdus en engageant ce mob
  oneShot: boolean     // un seul coup vide toute la vie au niveau attendu
  levelGap: number     // mob.level - niveau attendu
  aerial: boolean
}

// Menace d'UN mob pour le joueur représentatif.
export function mobThreat(m: MonsterDef, pl: RepresentativePlayer): MobThreat {
  const dmgPerBlow = physicalDamage(pl.atk, m.def, 1)           // attaque de base, mult 1
  const playerDps = Math.max(1, pl.attackSpeed * dmgPerBlow)
  const ttk = m.hp / playerDps
  const dmgPerHit = physicalDamage(m.atk, pl.def)               // dégâts reçus par coup
  // nombre de coups encaissés : le mob peut frapper une fois par fenêtre d'invulnérabilité tant qu'il
  // vit et reste au contact. On borne par l'exposition (silhouette) et un plafond (on finit par se
  // dégager / boire une potion). ttk/INVULN = nb de fenêtres pendant lesquelles il peut frapper.
  const windows = ttk / INVULN_S
  const hits = Math.max(0.5, Math.min(windows, 6)) * exposure(m)
  const hpLost = hits * dmgPerHit
  return {
    id: m.id, level: m.level, hp: m.hp, atk: m.atk, def: m.def,
    ttk, dmgPerHit, hits, hpLost,
    oneShot: dmgPerHit >= pl.maxHp,
    levelGap: m.level - pl.level,
    aerial: !!m.aerial,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4) SIMULATION D'UN NIVEAU
// ══════════════════════════════════════════════════════════════════════════════════════════════

// Fenêtre de CLUSTERING en tuiles : des mobs à moins de CLUSTER_TILES l'un de l'autre sont subis en
// BURST (on ne les tue pas assez vite pour les prendre un par un).
const CLUSTER_TILES = 7
// Dans un burst, on encaisse au plus ce nombre de coups de chaque mob concurrent avant de percer.
const BURST_HITS_CAP = 2

export interface PlayabilityResult {
  nodeId: string
  levelId: string
  biome: string
  expectedLevel: number
  survivable: boolean
  difficulty: number       // 0..1
  flags: string[]
  // diagnostics
  mobCount: number
  peakBurst: number        // PV perdus dans le pire cluster
  totalHpLost: number      // PV perdus sur toute la traversée (attrition)
  maxHp: number
  worstOneHit: number      // pire dégât d'un seul coup
  maxLevelGap: number      // pire écart (mob.level - attendu)
  worstMobId: string       // mob au pire écart de niveau
  maxCluster: number       // plus gros amas de mobs (fenêtre CLUSTER_TILES)
  aerialCount: number
}

// Simule un niveau (par id de nœud OU id de niveau) avec une population de mobs donnée (défaut :
// les spawns réels du niveau). On peut passer une population custom (spawns synthétiques) pour tester
// des scénarios — c'est ce qui permet de PROUVER que le moteur aurait attrapé l'ancien plaine-1.
export function simulateLevel(
  nodeOrLevelId: string,
  opts?: { spawns?: { monsterId: string; x: number }[]; level?: LevelDef },
): PlayabilityResult {
  const levelId = levelIdOfNode(nodeOrLevelId) ?? nodeOrLevelId
  const level = opts?.level ?? LEVELS[levelId]
  if (!level) throw new Error(`niveau introuvable : ${nodeOrLevelId}`)
  const exp = expectedLevel(nodeOrLevelId)
  const pl = representativePlayer(exp)

  const spawns = opts?.spawns ?? level.spawns
  // on ignore le boss ici (combats scriptés à part) et les gardiens (obstacles contournables) : la
  // jouabilité d'un terrain se juge sur ses mobs NORMAUX.
  const mobs = spawns
    .map((s) => ({ x: s.x, m: MONSTERS[s.monsterId] }))
    .filter((e): e is { x: number; m: MonsterDef } => !!e.m && !e.m.boss && !e.m.id.startsWith('gardien-'))

  const threats = mobs.map((e) => ({ x: e.x, t: mobThreat(e.m, pl) }))

  let totalHpLost = 0
  let worstOneHit = 0
  let maxLevelGap = -Infinity
  let worstMobId = ''
  let aerialCount = 0
  for (const { t } of threats) {
    totalHpLost += t.hpLost
    if (t.dmgPerHit > worstOneHit) worstOneHit = t.dmgPerHit
    if (t.levelGap > maxLevelGap) { maxLevelGap = t.levelGap; worstMobId = t.id }
    if (t.aerial) aerialCount++
  }
  if (threats.length === 0) maxLevelGap = 0

  // PEAK BURST : pour chaque mob, on regarde l'amas dans une fenêtre de CLUSTER_TILES autour de lui et
  // on somme les dégâts encaissés (bornés à BURST_HITS_CAP coups chacun) → le pire amas.
  const sorted = [...threats].sort((a, b) => a.x - b.x)
  let peakBurst = 0
  let maxCluster = 0
  for (let i = 0; i < sorted.length; i++) {
    let burst = 0
    let count = 0
    for (let j = i; j < sorted.length && sorted[j]!.x - sorted[i]!.x <= CLUSTER_TILES; j++) {
      const t = sorted[j]!.t
      burst += Math.min(t.hits, BURST_HITS_CAP) * t.dmgPerHit
      count++
    }
    if (burst > peakBurst) peakBurst = burst
    if (count > maxCluster) maxCluster = count
  }

  // ── SEUILS (documentés) ──────────────────────────────────────────────────────────────────────
  // maxHp = budget de PV « instantané ». On considère qu'un joueur dispose EN PLUS d'une potion et
  // peut battre en retraite → un burst est TENABLE jusqu'à BURST_TOLERANCE × maxHp. Au-delà, la mort
  // dans l'amas est quasi certaine (injouable).
  const BURST_TOLERANCE = 1.35
  const survivable = worstOneHit < pl.maxHp && peakBurst < pl.maxHp * BURST_TOLERANCE

  // DIFFICULTÉ 0..1 : mélange du pic (ce qui tue) et de l'attrition (usure sur toute la traversée).
  // Le budget d'usure est GÉNÉREUX (4× maxHp) car un joueur récupère ENTRE les combats (potions,
  // régen, soins, retour en ville) — sans ça, un niveau LONG saturerait à tort. Le pic pèse le plus
  // (0,65) : c'est lui qui décide de la survie, l'attrition ne fait que colorer la pénibilité.
  const burstRatio = peakBurst / pl.maxHp
  const attritionRatio = totalHpLost / (pl.maxHp * 4)
  let difficulty = 0.65 * burstRatio + 0.35 * attritionRatio
  difficulty = Math.max(0, Math.min(1, difficulty))

  // ── FLAGS ────────────────────────────────────────────────────────────────────────────────────
  const flags: string[] = []
  if (worstOneHit >= pl.maxHp) flags.push('one-shot')
  if (maxCluster >= 3 && burstRatio >= 0.6) flags.push('swarm/cluster')
  // écart de niveau INJUSTE : un mob nettement au-dessus (≥ +10) ET réellement mortel (fort chip)
  // sans farm intercalé. Les pics VOLONTAIRES bornés (transition plaine→désert, ~ +6/+8) ne flaggent
  // pas ; seul l'excès non tenable le fait.
  if (maxLevelGap >= 10 && worstOneHit >= pl.maxHp * 0.33) flags.push('level-gap-injuste')
  // DENSITÉ : beaucoup de mobs au mètre linéaire.
  if (level.widthTiles && mobs.length / level.widthTiles >= 0.14) flags.push('densité')
  // DÉBUT TROP DUR : sur les tout premiers terrains (plaine 1-2), un pic doux déjà dépassé.
  const isVeryEarly = levelId === 'plaine-1' || levelId === 'plaine-2'
  if (isVeryEarly && burstRatio >= 0.55) flags.push('début-trop-dur')
  if (!survivable && !flags.includes('one-shot')) flags.push('injouable')

  const node = WORLD_NODES.find((w) => w.levelId === levelId || w.id === nodeOrLevelId)
  return {
    nodeId: node?.id ?? levelId,
    levelId,
    biome: level.biome,
    expectedLevel: exp,
    survivable,
    difficulty: Math.round(difficulty * 1000) / 1000,
    flags,
    mobCount: mobs.length,
    peakBurst: Math.round(peakBurst),
    totalHpLost: Math.round(totalHpLost),
    maxHp: pl.maxHp,
    worstOneHit,
    maxLevelGap: maxLevelGap === -Infinity ? 0 : maxLevelGap,
    worstMobId,
    maxCluster,
    aerialCount,
  }
}

// Simule TOUS les terrains jouables (hors arènes de boss et gardiens), dans l'ordre de progression.
export function simulateAll(): PlayabilityResult[] {
  return LEVEL_ORDER.filter((l) => !l.boss).map((l) => simulateLevel(l.id))
}
