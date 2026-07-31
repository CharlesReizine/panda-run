// Anneau DÉCHIRÉ et ONDULANT, dessiné à la main. Le look partagé par tous les cercles du jeu.
//
// POURQUOI CE MODULE EXISTE. Deux visuels distincts affichaient un cercle : l'ÉCLAT au lancement d'un
// sort de zone (LevelScene.aoeRing) et l'AURA PERSISTANTE d'un buff (Player.applyAtkBuff). Le premier
// a été refait en polygone irrégulier, le second est resté une image d'anneau lisse agrandie en
// yoyo — d'où le retour user : « c'est stylé pendant une demi-seconde et après j'ai un vieux cercle
// jaune dégueulasse ». Un seul dessin partagé, et les deux se ressemblent enfin.
//
// L'aspect voulu : « globalement arrondi mais texturé en surface, électrique, en colère ». On l'obtient
// par trois ingrédients, aucun ne suffisant seul :
//   1. `jag` — une amplitude FIXE par sommet → la silhouette est déchirée, et différente à chaque
//      création (deux lancers ne se ressemblent pas) ;
//   2. une ondulation fonction du TEMPS → le contour respire au lieu d'être une forme figée qu'on zoome ;
//   3. des micro-décrochages haute fréquence → l'aspect « grésillement électrique » plutôt que
//      « vague lisse ».

import Phaser from 'phaser'

/** Amplitudes par sommet. À créer UNE FOIS et à réutiliser à chaque frame, sinon la forme scintille. */
export function makeJag(segments: number, min = 0.78, max = 1.2): number[] {
  return Array.from({ length: segments }, () => Phaser.Math.FloatBetween(min, max))
}

export interface JaggedRingOptions {
  /** épaisseur du trait */
  width?: number
  /** opacité */
  alpha?: number
  /** vitesse et sens de rotation (rad/s ; négatif = sens inverse) */
  spin?: number
  /** amplitude de l'ondulation (fraction du rayon) */
  wobble?: number
  /** amplitude du grésillement haute fréquence (fraction du rayon) */
  crackle?: number
}

/**
 * Trace l'anneau dans `g` (sans effacer : l'appelant décide, ce qui permet d'empiler des couches).
 * `timeMs` pilote l'animation — passer `scene.time.now` suffit.
 */
export function drawJaggedRing(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, radius: number, color: number,
  timeMs: number, jag: number[], opts: JaggedRingOptions = {},
): void {
  const { width = 4, alpha = 1, spin = 1, wobble = 0.09, crackle = 0.05 } = opts
  const seg = jag.length
  const t = timeMs / 1000
  g.lineStyle(width, color, alpha)
  g.beginPath()
  for (let i = 0; i <= seg; i++) {
    const k = i % seg
    const a = (k / seg) * Math.PI * 2 + spin * t
    // ondulation lente (la respiration) + grésillement rapide (le côté électrique)
    const wob = 1 + Math.sin(k * 3 + t * 9) * wobble + Math.sin(k * 11 + t * 27) * crackle
    const rr = radius * jag[k]! * wob
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py)
  }
  g.closePath()
  g.strokePath()
}

/**
 * Aura PERSISTANTE : deux couches déchirées tournant en sens opposé, plus quelques arcs d'éclair.
 * À appeler à chaque frame après un `g.clear()`.
 */
export function drawAura(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, radius: number, color: number,
  timeMs: number, jag: number[], jagInner: number[],
): void {
  g.clear()
  // la respiration globale : le rayon lui-même pulse, sinon l'aura semble collée
  const pulse = 1 + Math.sin(timeMs / 260) * 0.07
  drawJaggedRing(g, x, y, radius * pulse, color, timeMs, jag, { width: 4, alpha: 0.9, spin: 0.7 })
  drawJaggedRing(g, x, y, radius * pulse * 0.8, color, timeMs * 1.3, jagInner, { width: 2, alpha: 0.5, spin: -1.1, wobble: 0.12, crackle: 0.08 })

  // ARCS D'ÉCLAIR : quelques segments courts sur le pourtour, redessinés à des angles qui sautent →
  // impression de décharge. C'est ce qui donne « en colère » plutôt que « joli halo ».
  const n = 4
  g.lineStyle(2, color, 0.85)
  for (let i = 0; i < n; i++) {
    // l'angle saute par paliers (floor) au lieu de tourner régulièrement : ça crépite
    const step = Math.floor(timeMs / 90 + i * 7) % 24
    const a0 = (step / 24) * Math.PI * 2 + i * 1.7
    const r0 = radius * pulse * 0.92
    const r1 = radius * pulse * 1.16
    g.beginPath()
    g.moveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0)
    const amid = a0 + 0.12
    g.lineTo(x + Math.cos(amid) * r1 * 0.98, y + Math.sin(amid) * r1 * 0.98)
    g.lineTo(x + Math.cos(a0 + 0.24) * r0, y + Math.sin(a0 + 0.24) * r0)
    g.strokePath()
  }
}
