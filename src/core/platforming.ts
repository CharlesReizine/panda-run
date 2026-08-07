// Constantes de plateforme partagées par le jeu (Player/main) ET les tests, pour qu'on
// ne puisse pas régler un saut / poser une plateforme qui la rendrait inatteignable
// sans casser un test.

export const TILE = 32
// Hauteur de monde par DÉFAUT (en tuiles) et rangée de sol associée. Un niveau peut désormais
// être plus HAUT (LevelDef.heightTiles) ; sa rangée de sol se calcule alors avec groundRowFor().
// GROUND_ROW reste la valeur historique (monde de 16 rangées) pour ne rien régresser.
export const DEFAULT_HEIGHT_TILES = 16
export const GROUND_ROW = 14 // rangée du sol par défaut (= DEFAULT_HEIGHT_TILES - 2)
// Physique calibrée pour un saut NERVEUX (moins « lune ») : par rapport à l'ancien réglage
// (G=1200, JUMP=560, RUN=220) tout est mis à l'échelle ×1,25 sur JUMP / ×1,5625 sur GRAVITY /
// ×1,25 sur RUN → la HAUTEUR de saut (JUMP²/2G) ET la PORTÉE horizontale d'un gap (RUN·2·JUMP/G)
// restent IDENTIQUES (atteignabilité de tous les niveaux préservée), mais le TEMPS DE VOL baisse
// de ~20 % → chute plus franche, fini l'impression de gravité lunaire.
export const GRAVITY = 1875
export const JUMP_SPEED = 700 // magnitude de la vitesse de saut
export const RUN_SPEED = 275
// Vitesse VERTICALE de nage (px/s), en montée comme en descente. Déclarée ICI et pas dans Player
// parce qu'elle n'est pas qu'un réglage de ressenti : c'est elle qui décide, avec la réserve de
// souffle (core/breath), de la PROFONDEUR qu'une cuve peut avoir sans être un piège mortel. Le
// générateur en dépend (cf. level-validator.maxDiveRows) ; deux copies dériveraient, et la cuve
// deviendrait infranchissable sans qu'aucun test ne le voie.
export const SWIM_SPEED = 150
// Ralentissement HORIZONTAL dans l'eau. Déclaré ici pour la même raison que SWIM_SPEED : ce n'est pas
// qu'un réglage de ressenti, c'est lui qui décide de la LONGUEUR qu'un tunnel immergé peut avoir sans
// noyer (cf. level-validator.maxSwimTiles). Player l'importe au lieu d'en garder une copie — deux
// valeurs qui dérivent, et le tunnel devient infranchissable sans qu'aucun test ne le voie.
export const SWIM_RUN_MULT = 0.7
// Le sol est TOUJOURS au bas du monde : deux rangées pleines (sol + sous-sol) → groundRow = h - 2.
export function groundRowFor(heightTiles = DEFAULT_HEIGHT_TILES): number {
  return heightTiles - 2
}
// Marge de confort du saut. Resserrée (0.6 → 0.55) : « atteignable » signifie désormais
// CONFORTABLEMENT atteignable, pas « atteignable pile au pixel au sommet de la parabole ». On
// n'exige donc plus le saut parfait, mais on refuse les plateformes réellement trop écartées.
const SAFETY = 0.55

export function maxJumpHeightPx(): number {
  return (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
}

// Distance horizontale FRANCHISSABLE d'un trou au saut SIMPLE (sol → sol) : vitesse de course ×
// temps de vol d'un saut à plat × marge de confort. Un trou plus large que ça n'est pas garanti
// franchissable (voir level-validator.oversizedGaps). Même marge SAFETY que canReach.
export function maxJumpGapPx(): number {
  const airtime = (2 * JUMP_SPEED) / GRAVITY // durée d'un saut à plat (montée + descente)
  return RUN_SPEED * airtime * SAFETY
}
export function maxJumpTiles(): number {
  return maxJumpHeightPx() / TILE
}

// Hauteur minimale d'une échelle, en tuiles : au moins deux fois la hauteur de saut max, pour
// qu'aucune échelle ne puisse se franchir d'un simple saut (elle doit se grimper).
export const MIN_LADDER_TILES = Math.ceil(2 * maxJumpTiles())

// Hauteur MAXIMALE d'une échelle, en tuiles. Au-delà, on obtient une « échelle de l'enfer » qui
// monte pendant des plombes — grotesque à grimper. Les GRANDES montées verticales se font donc en
// SEGMENTS d'échelle empilés (chacun ≤ MAX_LADDER_TILES) séparés par de VRAIS PALIERS (plateformes)
// où l'on sort de l'échelle, on marche, puis on reprend l'échelle suivante — voir le builder `tower`.
export const MAX_LADDER_TILES = 13

export function ladderTooShort(h: number): boolean {
  return h < MIN_LADDER_TILES
}

export function ladderTooLong(h: number): boolean {
  return h > MAX_LADDER_TILES
}

// Prédicat de collision « one-way » (plateformes traversables par le bas) : on ne retient la
// collision que si le joueur DESCEND (velocityY >= 0). Tant qu'il monte, il traverse librement
// par le bas ; en retombant, il se pose dessus. On le retient tant que ses pieds (mesurés au
// DÉBUT de la frame, d'où prevBottom) ne sont pas passés SOUS le dessous de la dalle.
//
// On borne sur le DESSOUS de la dalle (et non sur « le dessus + 8px ») par ROBUSTESSE : dès que
// les pieds chevauchent la dalle en descendant, chaque frame les re-pose, sans risque qu'un
// enfoncement de quelques pixels franchisse une limite trop serrée et laisse le panda repartir
// en chute libre. (La vraie cause de la traversée du 2e étage d'un escalier était ailleurs — un
// squash d'atterrissage vertical qui déformait le corps physique, corrigé dans Player ; ce
// seuil élargi est un filet supplémentaire.) Le processCallback dans LevelScene s'appuie dessus.
export function landsOnOneWayPlatform(prevBottom: number, velocityY: number, platformBottom: number, margin = 0): boolean {
  return velocityY >= 0 && prevBottom <= platformBottom + margin
}

/**
 * Une corniche traversable doit-elle être IGNORÉE à cause d'une échelle ?
 *
 * ⚠️ C'EST « EN TRAIN DE GRIMPER » QUI COMPTE, PAS « À CÔTÉ D'UNE ÉCHELLE ». La première version
 * regardait le simple CHEVAUCHEMENT (`onLadder`, vrai dès que le centre du panda entre dans le
 * rectangle de l'échelle) — donc debout sur une corniche, sous une échelle, sans rien toucher, la
 * collision one-way disparaissait et le panda TOMBAIT AU TRAVERS. Signalé trois fois par le joueur :
 * « on passe à travers le sol quand on est sur de la terre sous une échelle, sans être agrippé ou
 * quoi, juste en marchant », puis « je tombe à travers quand je suis sur un sol avec une échelle
 * au-dessus, c'est hyper contre-intuitif ».
 *
 * Le perçage des corniches sous les échelles avait été supprimé POUR CE SYMPTÔME — à tort : le trou
 * n'était pas la cause, cette porte l'était. La raison d'être de la traversée reste entière (« une
 * échelle que je peux pas descendre ») : elle ne vaut que pendant la grimpe, et grimper suppose
 * d'avoir poussé haut ou bas. Debout, on se tient sur ce qu'on voit.
 */
export function traverseCornichesEnGrimpant(climbing: boolean): boolean {
  return climbing
}

export interface Plat { x: number; y: number; w: number }

// Peut-on, en sautant depuis une surface à la rangée surfaceRow, atteindre la plateforme b
// dont le bord horizontal le plus proche est à hgapTiles ? On modélise la vraie parabole :
// on doit pouvoir monter jusqu'à la hauteur de b ET avoir parcouru assez horizontalement
// (au moment où la trajectoire repasse à cette hauteur), le tout avec une marge de confort.
export function canReach(surfaceRow: number, b: Plat, hgapTiles: number): boolean {
  const rise = (surfaceRow - b.y) * TILE // > 0 : b est plus haute
  const H = maxJumpHeightPx()
  if (rise > H) return false // trop haut pour le saut
  const disc = JUMP_SPEED * JUMP_SPEED - 2 * GRAVITY * rise
  const t = (JUMP_SPEED + Math.sqrt(Math.max(0, disc))) / GRAVITY
  const dxReachPx = RUN_SPEED * t * SAFETY
  return hgapTiles * TILE <= dxReachPx
}

// ─── REBOND DE TRAMPOLINE : TROIS PALIERS, RÉGLÉS À L'OREILLE DU USER ──────────────────────────
//
// Demande, après essai : « le premier fait la hauteur d'un saut normal, le deuxième 2, le troisième
// 2,5 × la hauteur normale ». Avant, le PREMIER rebond valait déjà trois sauts et le troisième montait à
// 24 tuiles : « c'est nawak, c'est juste trop trop haut ». Le trampoline ne doit pas être un ascenseur,
// c'est une mécanique qu'on APPREND — on rebondit une fois pour comprendre, deux pour viser, trois pour
// atteindre ce qu'on ne pouvait pas.
//
// ⚠️ CONSÉQUENCE À NE PAS MANQUER : LE MINIMUM N'EST PLUS CE QUI GARANTIT L'ATTEIGNABILITÉ.
// Tant que le premier rebond valait 3 sauts, les validateurs pouvaient supposer le minimum et déclarer
// atteignable une corniche posée au-dessus d'un trampoline. À 1 saut, cette supposition rendrait la
// moitié des motifs à trampoline infranchissables sur le papier. C'est donc le PLAFOND qu'ils supposent
// désormais (cf. canReachByBounce) : le joueur peut toujours enchaîner trois rebonds, il retombe sur le
// tapis entre chaque. La garantie change de nature — « atteignable d'un bond » devient « atteignable en
// s'y reprenant » — et c'est exactement le geste que le motif demande.
export const BOUNCE_SPEED = JUMP_SPEED // premier rebond : la hauteur d'un saut normal
export const BOUNCE_RUN_MULT = 1.45

// Hauteurs visées, en multiples d'un saut normal : 1 → 2 → 2,5. On travaille en VITESSES (h = v²/2g),
// d'où les racines. Le plafond est atteint au troisième rebond, pas avant.
export const BOUNCE_SPEED_MAX = JUMP_SPEED * Math.sqrt(2.5)

/**
 * Vitesse de rebond en fonction de la vitesse de CHUTE à l'impact.
 *
 * `vIn` est la vitesse verticale descendante (px/s, positive vers le bas) ; se poser en douceur rend
 * exactement BOUNCE_SPEED — un saut normal.
 *
 * Le gain est choisi pour que la suite fasse 1 → 2 → 2,5 : depuis une hauteur h, on retombe à la vitesse
 * √(2gh), et on veut ressortir à la hauteur suivante. En hauteurs, h₂ = 1 + G·h₁ et h₃ = 1 + G·h₂ avec
 * h₁ = 1 : G = 1 donne 1 → 2 → 3, trop ; on plafonne donc à 2,5, ce qui donne 1 → 2 → 2,5.
 */
export const BOUNCE_GAIN = 1 // h_sortie = 1 + h_chute (en hauteurs de saut), plafonné à 2,5

export function bounceSpeedFrom(vIn: number): number {
  const chute = Math.max(0, vIn)
  return Math.min(BOUNCE_SPEED_MAX, Math.sqrt(BOUNCE_SPEED * BOUNCE_SPEED + BOUNCE_GAIN * chute * chute))
}

/** Hauteur maximale atteinte depuis un trampoline, en pixels. */
/**
 * Hauteur maximale atteignable depuis un trampoline — celle du TROISIÈME rebond, pas du premier.
 * C'est ce que les validateurs doivent supposer : le joueur retombe sur le tapis entre chaque bond.
 */
export const maxBounceHeightPx = (): number => (BOUNCE_SPEED_MAX * BOUNCE_SPEED_MAX) / (2 * GRAVITY)

/**
 * Peut-on atteindre `b` en rebondissant sur un trampoline posé sur une surface à `surfaceRow` ?
 * Même parabole que `canReach`, avec la vitesse de rebond et la vitesse latérale élargie.
 */
export function canReachByBounce(surfaceRow: number, b: Plat, hgapTiles: number): boolean {
  const rise = (surfaceRow - b.y) * TILE
  if (rise > maxBounceHeightPx()) return false
  const disc = BOUNCE_SPEED_MAX * BOUNCE_SPEED_MAX - 2 * GRAVITY * rise
  const t = (BOUNCE_SPEED_MAX + Math.sqrt(Math.max(0, disc))) / GRAVITY
  return hgapTiles * TILE <= RUN_SPEED * BOUNCE_RUN_MULT * t * SAFETY
}

function hgap(a: Plat, b: Plat): number {
  return Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
}

// Plateformes qu'on ne peut atteindre ni depuis le sol ni de proche en proche. Le sol du niveau
// est à groundRow (bas du monde) — paramétrable pour les mondes hauts.
export function unreachablePlatforms(platforms: Plat[], widthTiles: number, groundRow = GROUND_ROW): Plat[] {
  const ground: Plat = { x: 0, y: groundRow, w: widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < platforms.length; i++) {
      if (reachable.has(i)) continue
      const b = platforms[i]!
      const surfaces = [ground, ...[...reachable].map((j) => platforms[j]!)]
      if (surfaces.some((a) => canReach(a.y, b, hgap(a, b)))) {
        reachable.add(i)
        changed = true
      }
    }
  }
  return platforms.filter((_, i) => !reachable.has(i))
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SE POSER SUR LA CORNICHE EN LÂCHANT UNE ÉCHELLE
//
// Retour du joueur, capture à l'appui : « quand je suis en haut de l'échelle, je tombe encore même si
// je marche juste et je suis pas sur l'échelle », puis « l'échelle me permet de faire un bug graphique
// bizarre, je passe sous la terre ». Sur l'image, le panda est à MOITIÉ ENFONCÉ dans la corniche.
//
// ⚠️ LA CAUSE EST DANS LA RÈGLE DU ONE-WAY, PAS DANS LE TERRAIN. Une corniche de terre ne bloque que
// si les pieds étaient AU-DESSUS d'elle à la frame précédente — c'est ce qui empêche de se coincer
// contre la contremarche d'un escalier. Or, agrippé à une échelle, on TRAVERSE les corniches : on lâche
// donc en étant déjà DANS la tuile, la condition est fausse pour toujours, et on passe au travers.
//
// On corrige à l'instant du lâcher, pas dans la règle de collision : la relâcher rouvrirait le
// coincement d'escalier, qui a coûté assez cher comme ça.
//
// Fonction PURE : une scène Phaser ne s'instancie pas en test, et c'est précisément dans ces
// enchaînements-là que les défauts se logent.

/** Une corniche traversable, en tuiles. `y` est la rangée de son DESSUS. */
export interface Corniche { x: number; y: number; w: number }

/**
 * De combien de pixels remonter le panda pour qu'il se pose sur la corniche qu'il traverse.
 *
 * `basPx` = position de ses pieds ; `xPx` = son centre. Rend 0 quand il n'y a rien à corriger :
 * aucune corniche sous lui, ou il est déjà au-dessus (on ne le fait jamais DESCENDRE).
 */
export function releveApresEchelle(basPx: number, xPx: number, corniches: Corniche[]): number {
  const colonne = Math.floor(xPx / TILE)
  const rangeePieds = Math.floor((basPx - 1) / TILE)
  for (const c of corniches) {
    if (colonne < c.x || colonne >= c.x + c.w) continue
    // le dessus de la corniche est la tuile des pieds, ou celle juste en dessous ; au-delà le panda
    // est franchement en l'air et doit retomber normalement.
    if (c.y !== rangeePieds && c.y !== rangeePieds + 1) continue
    const dessus = c.y * TILE
    if (basPx <= dessus) return 0 // déjà posé
    return basPx - dessus
  }
  return 0
}
