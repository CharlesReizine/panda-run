export type ClassId = 'novice' | 'swordsman' | 'mage' | 'archer' | 'chevalier' | 'sorcier' | 'chasseur'
export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'hat'
// Famille d'arme d'un objet weapon (silhouette + restriction de classe) : lame (mêlée : épée,
// masse, faux, griffe), arc (tir : arc, arbalète) ou bâton (magie : sceptre, orbe). Sert à choisir
// la silhouette affichée (Player/PreloadScene) et à savoir quelles classes peuvent l'équiper (equip.ts).
export type WeaponType = 'sword' | 'bow' | 'staff'

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

export type SkillKind = 'melee' | 'projectile' | 'aoe' | 'heal' | 'charge' | 'dive' | 'buff' | 'zone' | 'trap' | 'lightning' | 'passive' | 'channel' | 'aura'

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
  // Rang MAXIMAL de ce skill (défaut MAX_SKILL_RANK = 5). Les gros sorts SIGNATURE (nukes / ultimes)
  // montent jusqu'à 10 : le gain par rang est alors plus DOUX (interpolation sur 9 paliers, voir
  // skillDamageMult). Les petits sorts restent à 5.
  maxRank?: number
  // ── Mécaniques d'entrée (maintien) ───────────────────────────────────────────
  // ESTOC RAPIDE (sabreur) : pas de cooldown réel (cooldownMs ~1), mais coût mana ÉLEVÉ par coup —
  // spam à la ressource. `manaCost` force le coût d'énergie (sinon dérivé du multiplicateur).
  spam?: boolean
  manaCost?: number
  // CHARGE (mage) : maintenir CHARGE l'attaque ; relâchée chargée = très puissante, relâchée tôt =
  // plus faible. La puissance interpole entre CHARGE_MIN_MULT et 1 selon la fraction de charge.
  chargeable?: boolean
  // CANALISÉ (maintien) : tant que le bouton est tenu, l'effet se répète (ticks) et draine le mana ;
  // le joueur peut se DÉPLACER. `tall` = le jet couvre HAUT + BAS (lance-flammes du sorcier).
  channel?: { tickMs: number; manaPerTick: number; tall?: boolean }
  // AURA OFFENSIVE (mage — aura d'épines) : blesse en continu tout ennemi proche tant qu'elle dure.
  aura?: { tickMs: number; durationMs: number; radius: number }
  // DÉVOTION (chevalier) : buff défensif — réduit les dégâts SUBIS pendant la durée (dmgTakenMult<1).
  guard?: { dmgTakenMult: number; durationMs: number }
  // FAILLE DU NÉANT (sorcier) : zone courte portée qui ASPIRE puis TUE INSTANTANÉMENT les ennemis
  // « faibles » (tout sauf boss/élite, et de niveau < joueur). Boss/élites/mobs ≥ niveau = poussés.
  voidRift?: boolean
  lance?: boolean // CHARGE LANCIÈRE (chevalier) : trait perçant en ligne
  storm?: boolean // TEMPÊTE FOUDROYANTE (sorcier) : nuke d'orage sur zone
  blizzard?: boolean // BLIZZARD (sorcier) : nuke de glace sur zone
  grapple?: boolean // FLÈCHE-GRAPPIN (archer) : s'accroche à une plateforme devant/au-dessus et TRACTE le joueur
  falconBlitz?: boolean // ASSAUT DU FAUCON (chasseur) : le faucon fond en coups multiples
  // ── Archer / Chasseur ──────────────────────────────────────────────────────
  arrows?: number // projectile : nombre de flèches tirées ensemble (double flèche = 2)
  homing?: boolean // projectile : flèche AUTOGUIDÉE — traverse murs/terrain et enchaîne l'ennemi le plus proche non encore touché (nombre de cibles = rang du skill), dans une portée max ~largeur d'écran

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
  // passif « double attaque » (chevalier : frappe-doublee ; archer/chasseur : reflexes-felins) :
  // réduit le cooldown de l'ATTAQUE DE BASE selon le rang appris — cooldown × (1 / (1 + rang/rangMax)).
  // Au rang MAX, cooldown /2 → le panda frappe 2× plus souvent (voir basicAttackCooldownFactor).
  doubleStrike?: boolean
}

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire'

export interface ItemDef {
  id: string
  name: string
  slot: EquipSlot
  bonus: Partial<Pick<StatBlock, 'atk' | 'def' | 'maxHp'>>
  rarity?: Rarity // défaut 'commun' si absent
  description?: string // phrase courte et thématique (fiche info de l'inventaire)
  // Famille d'arme (uniquement pour slot 'weapon') : pilote la silhouette affichée et la restriction
  // d'équipement par classe. Absente sur les objets non-weapon.
  weaponType?: WeaponType
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
