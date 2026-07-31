import Phaser from 'phaser'
import { CAST_BAR, castBarWidth, castProgress, casting } from '../core/cast-bar'

// Barre de chargement affichée AU-DESSUS d'une entité pendant qu'elle prépare une attaque ou un sort :
// le nom de l'attaque, et une jauge qui se remplit jusqu'au déclenchement.
//
// Demande du user : « j'aimerais que les attaques et sorts des monstres aient un chargement (voir que je
// l'ai aussi) + qu'on voit le nom de l'attaque, ça serait plus simple ». C'est de la lisibilité de
// combat : savoir QUOI arrive et DANS COMBIEN DE TEMPS, pour choisir entre esquiver et frapper.
//
// ⚠️ CRÉÉE À LA DEMANDE ET DÉTRUITE À LA FIN. Un jeu de plateforme peut avoir des dizaines de monstres
// à l'écran ; garder en permanence trois objets d'affichage par monstre (fond, jauge, texte) coûte de la
// mémoire et du temps de rendu pour rien, alors qu'un chargement dure quelques centaines de
// millisecondes. C'est le même principe que les autres effets d'Enemy (télégraphe, halo d'élite), qui
// se détruisent dès qu'ils ne servent plus — et la leçon du ralentissement progressif de cette session,
// où c'était l'accumulation d'objets qui coûtait.
export class CastBar {
  private bg: Phaser.GameObjects.Rectangle | null = null
  private fill: Phaser.GameObjects.Rectangle | null = null
  private label: Phaser.GameObjects.Text | null = null
  private startedAt = 0
  private duration = 0
  private w = CAST_BAR.minW

  constructor(private readonly scene: Phaser.Scene) {}

  /** Démarre (ou remplace) un chargement nommé. `t` est l'horloge de la scène. */
  start(name: string, durationMs: number, color: number, t: number, depth = 0): void {
    this.startedAt = t
    this.duration = durationMs
    this.w = castBarWidth(name)
    this.destroyParts()
    this.bg = this.scene.add.rectangle(0, 0, this.w, CAST_BAR.h, 0x000000, 0.7).setOrigin(0, 0.5).setDepth(depth)
    this.fill = this.scene.add.rectangle(0, 0, 1, CAST_BAR.h - 2, color, 1).setOrigin(0, 0.5).setDepth(depth + 1)
    this.label = this.scene.add.text(0, 0, name, {
      fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(depth + 1)
  }

  /**
   * À appeler chaque frame avec la position de la TÊTE de l'entité. Replace la barre, avance la jauge,
   * et se démonte toute seule dès que le chargement est terminé — l'appelant n'a rien à surveiller.
   */
  update(t: number, headX: number, headY: number): void {
    if (!this.bg) return
    if (!casting(t, this.startedAt, this.duration)) { this.stop(); return }
    const p = castProgress(t, this.startedAt, this.duration)
    const left = headX - this.w / 2
    const barY = headY - CAST_BAR.gap
    this.bg.setPosition(left, barY)
    this.fill!.setPosition(left + 1, barY).setDisplaySize(Math.max(1, (this.w - 2) * p), CAST_BAR.h - 2)
    this.label!.setPosition(headX, barY - CAST_BAR.h / 2 - 2)
  }

  /** Interrompt le chargement et retire l'affichage (attaque annulée, monstre mort, entité gelée). */
  stop(): void {
    this.duration = 0
    this.destroyParts()
  }

  destroy(): void { this.stop() }

  private destroyParts(): void {
    this.bg?.destroy(); this.bg = null
    this.fill?.destroy(); this.fill = null
    this.label?.destroy(); this.label = null
  }
}
