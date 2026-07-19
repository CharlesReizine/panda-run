import Phaser from 'phaser'

// Mur de flamme (Mage / Sorcier) : barrière de feu STATIQUE et TEMPORAIRE invoquée par la visée
// de zone. Corps de collision plein → BLOQUE le passage des ennemis (collider dans LevelScene) ;
// overlap → les ennemis au contact prennent une BRÛLURE (applyBurn). Le sprite porteur est
// invisible : tout le spectacle vient des colonnes de flammes animées semées sur sa largeur.
// Se dissout de lui-même à la fin de sa durée (le membre détruit quitte automatiquement le groupe).
export class FlameWall extends Phaser.Physics.Arcade.Image {
  readonly dmgPerTick: number
  private flameTimer: Phaser.Time.TimerEvent | null = null
  private embers: Phaser.GameObjects.GameObject[] = []
  private readonly wallWidth: number
  private readonly wallHeight: number
  private readonly groundY: number

  constructor(scene: Phaser.Scene, cx: number, groundY: number, width: number, height: number, dmgPerTick: number) {
    super(scene, cx, groundY - height / 2, 'projectile')
    scene.add.existing(this)
    this.setVisible(false).setDisplaySize(width, height)
    this.dmgPerTick = dmgPerTick
    this.wallWidth = width
    this.wallHeight = height
    this.groundY = groundY
  }

  // Cale le corps statique sur la géométrie du mur (à appeler après l'ajout au groupe statique,
  // qui crée le corps). Puis lance les flammes et programme la dissolution.
  activate(durationMs: number) {
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) { body.setSize(this.wallWidth, this.wallHeight); body.updateFromGameObject() }

    // socle de braises OPAQUE au sol (lisible même sur ciel clair) + halo ADD par-dessus
    const scene = this.scene
    const base = scene.add.rectangle(this.x, this.groundY, this.wallWidth, 22, 0xd84315).setDepth(4).setAlpha(0.85).setOrigin(0.5, 1)
    scene.tweens.add({ targets: base, alpha: 0.55, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    const glow = scene.add.image(this.x, this.groundY, 'ring').setTint(0xff7043).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5).setAlpha(0.5).setDisplaySize(this.wallWidth * 1.15, 44)
    scene.tweens.add({ targets: glow, alpha: 0.22, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.embers.push(base, glow)

    // colonnes de flammes montantes : corps OPAQUE (orange/rouge, blend normal → reste vif sur
    // fond clair) + cœur ADD jaune vif par-dessus. Dense sur toute la largeur du mur.
    this.flameTimer = scene.time.addEvent({
      delay: 26, loop: true, callback: () => {
        if (!this.active) return
        const fx = this.x + Phaser.Math.FloatBetween(-this.wallWidth / 2, this.wallWidth / 2)
        const bodyCol = Phaser.Math.RND.pick([0xff7043, 0xff5252, 0xf4511e, 0xe64a19])
        const baseY = this.groundY - Phaser.Math.Between(0, 8)
        const w = Phaser.Math.Between(8, 14), h = Phaser.Math.Between(20, 34)
        const rise = Phaser.Math.Between(this.wallHeight * 0.55, this.wallHeight)
        const dur = Phaser.Math.Between(360, 580)
        const flame = scene.add.rectangle(fx, baseY, w, h, bodyCol).setDepth(5).setAlpha(0.95).setOrigin(0.5, 1)
        scene.tweens.add({ targets: flame, y: baseY - rise, scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => flame.destroy() })
        const core = scene.add.rectangle(fx, baseY, w * 0.5, h * 0.7, 0xffee58).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.95).setOrigin(0.5, 1)
        scene.tweens.add({ targets: core, y: baseY - rise * 0.9, scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => core.destroy() })
      },
    })

    // dissolution : on éteint le mur (baisse d'intensité) juste avant de le détruire
    scene.time.delayedCall(durationMs, () => this.destroy())
  }

  destroy(fromScene?: boolean) {
    this.flameTimer?.remove()
    this.flameTimer = null
    for (const e of this.embers) e.destroy()
    this.embers = []
    super.destroy(fromScene)
  }
}
