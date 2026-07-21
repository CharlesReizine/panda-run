export type ClassId = 'novice' | 'swordsman' | 'mage' | 'archer' | 'chevalier' | 'sorcier' | 'chasseur'
export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'hat'

export interface StatBlock {
  atk: number
  def: number
  maxHp: number
  attackSpeed: number // attaques de base par seconde
}

export interface ClassDef {
  id: ClassId
  name: string
  tint: number // teinte placeholder du panda pour cette classe
  baseStats: StatBlock
  growth: StatBlock // gain par niveau (attackSpeed ignoré)
  skillIds: string[]
}

export type SkillKind = 'melee' | 'projectile' | 'aoe' | 'heal' | 'charge' | 'dive' | 'buff' | 'zone' | 'trap' | 'lightning' | 'passive'

export interface SkillDef {
  id: string
  name: string
  description: string // phrase courte décrivant l'effet du skill (affichée en jeu)
  classId: ClassId
  kind: SkillKind
  multiplier: number // × ATK (heal : fraction de maxHp)
  cooldownMs: number
  range: number // px (melee: portée hitbox, aoe: rayon, projectile: durée de vie en px)
  pierce?: boolean // projectile qui traverse tout (ne s'arrête pas au premier impact)
  arc?: boolean // projectile lancé en cloche (soumis à la gravité, rebondit)
  buff?: { atkMult: number; durationMs: number } // cri de guerre : booste l'ATK sortante un temps donné
  flame?: boolean // épée enflammée : pendant le buff, la lame s'embrase → +dégâts + brûlure (DoT) sur les coups
  fear?: { durationMs: number } // folie enragée : aura rouge sang + terreur sur les mobs de niveau ≤ joueur (fuite lente + -50% DÉF), hors boss
  minLevel?: number // niveau joueur minimum pour débloquer/monter ce skill (défaut : aucun)
  requires?: string // id d'un skill prérequis à débloquer avant celui-ci (défaut : aucun)
  // ── Archer / Chasseur ──────────────────────────────────────────────────────
  arrows?: number // projectile : nombre de flèches tirées ensemble (double flèche = 2)
  burn?: boolean // projectile : la flèche enflamme la cible (applyBurn / DoT) à l'impact
  explode?: boolean // projectile en cloche : explose à l'impact (sol ou ennemi) → dégâts de zone
  explodeRadius?: number // rayon de l'explosion (px) pour un projectile `explode`
  root?: number // piège : durée d'immobilisation (ms) infligée à l'ennemi qui le déclenche
  rain?: number // zone : nombre de flèches déversées du ciel sur la zone visée (densité de la pluie)
  // ── Mage / Sorcier ─────────────────────────────────────────────────────────
  blast?: number // projectile : rayon de la petite explosion déclenchée à l'impact (grosse boule de feu)
  meteors?: number // zone : nombre de météores qui tombent et explosent sur la zone visée
  wall?: { durationMs: number; height: number } // zone : mur de flammes temporaire (brûle + bloque les ennemis)
  // passif : bonus par rang appris (jamais équipé). hpRegenPerSec = régénération de PV/s (sabreur).
  passive?: { atk?: number; def?: number; maxHp?: number; attackSpeed?: number; hpRegenPerSec?: number }
}

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire'

export interface ItemDef {
  id: string
  name: string
  slot: EquipSlot
  bonus: Partial<Pick<StatBlock, 'atk' | 'def' | 'maxHp'>>
  rarity?: Rarity // défaut 'commun' si absent
  description?: string // phrase courte et thématique (fiche info de l'inventaire)
}

export interface DropEntry {
  kind: 'gold' | 'potion' | 'item' | 'material'
  itemId?: string
  materialId?: string
  chance: number // 0..1
  min: number // quantité min (gold) ; 1 pour potion/item/material
  max: number
}

export type MonsterBehavior = 'contact' | 'projectile' | 'charge' | 'caster'

export interface MonsterDef {
  id: string
  name: string
  lore: string // phrase de bestiaire décrivant le caractère du monstre (affichée en jeu)
  color: number // couleur placeholder
  hp: number
  atk: number
  def: number
  xp: number
  level: number // niveau calibré sur l'économie d'XP (voir core/mob-level.ts)
  speed: number // px/s
  behavior: MonsterBehavior
  boss?: boolean
  // ── BOSS (MVP « une classe ») : le boss incarne une CLASSE et se bat avec SES skills. La
  // LOGIQUE des trois skills + grosse attaque chargée + invocation vit dans BossController ; ces
  // champs ne portent que l'IDENTITÉ et le réglage (le script est choisi sur l'id du boss).
  bossClass?: ClassId // classe incarnée (affichée à l'apparition ; pilote le kit de skills)
  bossSummon?: string // id du mob invoqué par la vague d'adds (compte à rebours visible)
  mvp?: boolean // élite rare : stats renforcées, drops rares, ni mob ni boss
  // monstre VOLANT (oiseau) : gravité coupée, patrouille en sinus dans les airs et PIQUE vers le
  // joueur par à-coups puis remonte. Ignore sol/rebords (voir Enemy). Exempté de la contrainte
  // « posé sur une surface » des validateurs de niveau.
  aerial?: boolean
  // monstre AQUATIQUE (méduse, crabe) : nage sans souci dans l'eau marine. Les monstres NON
  // aquatiques (ni volants) qui se retrouvent immergés dans une eau marine profonde SE NOIENT
  // (dégâts périodiques jusqu'à la mort, cf. Enemy.checkDrown). Absent → terrestre, se noie.
  aquatic?: boolean
  // GABARIT physique du monstre : 'grand' = rendu et hitbox agrandis (GRAND_SCALE dans Enemy),
  // silhouette imposante (ours, golem). Absent → 'normal' (rétrocompat exacte).
  size?: 'normal' | 'grand'
  drops: DropEntry[]
}
