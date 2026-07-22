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

    // halo doux au sol (ADD) — plus de « ligne orange » pleine qui faisait cheap.
    const scene = this.scene
    const glow = scene.add.image(this.x, this.groundY, 'ring').setTint(0xff7043).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5).setAlpha(0.4).setDisplaySize(this.wallWidth * 1.15, 40)
    scene.tweens.add({ targets: glow, alpha: 0.18, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.embers.push(glow)

    // REFONTE FLAMMES : nappe illustrée fx-mur-de-flamme qui ondule sur toute la largeur (si dispo).
    const hasSprite = scene.textures.exists('fx-mur-de-flamme')
    if (hasSprite) {
      // blend NORMAL (pas ADD) → garde les oranges du sprite au lieu de cramer en blanc.
      const sheet = scene.add.image(this.x, this.groundY, 'fx-mur-de-flamme').setOrigin(0.5, 1).setDepth(5)
        .setAlpha(0.95).setDisplaySize(this.wallWidth, this.wallHeight)
      const sx = sheet.scaleX, sy = sheet.scaleY
      // « respiration » : grossit/rétrécit symétriquement (largeur ET hauteur) en continu.
      scene.tweens.add({ targets: sheet, scaleX: sx * 1.06, scaleY: sy * 1.1, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.embers.push(sheet)
    }

    // colonnes de flammes montantes (rangée de colonnes de feu + braises) par-dessus la nappe :
    // corps OPAQUE orange/rouge + cœur ADD jaune vif + braise fugace. Dense sur toute la largeur.
    this.flameTimer = scene.time.addEvent({
      delay: 24, loop: true, callback: () => {
        if (!this.active) return
        const fx = this.x + Phaser.Math.FloatBetween(-this.wallWidth / 2, this.wallWidth / 2)
        const bodyCol = Phaser.Math.RND.pick([0xff7043, 0xff5252, 0xf4511e, 0xe64a19])
        const baseY = this.groundY - Phaser.Math.Between(0, 8)
        const w = Phaser.Math.Between(8, 14), h = Phaser.Math.Between(22, 38)
        const rise = Phaser.Math.Between(this.wallHeight * 0.22, this.wallHeight * 0.45) // flammes basses, collées au sol
        const dur = Phaser.Math.Between(360, 580)
        const flame = scene.add.rectangle(fx, baseY, w, h, bodyCol).setDepth(5).setAlpha(0.95).setOrigin(0.5, 1)
        scene.tweens.add({ targets: flame, y: baseY - rise, scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => flame.destroy() })
        // cœur orange (plus jaune-blanc) et moins opaque → moins de cramage blanc
        const core = scene.add.rectangle(fx, baseY, w * 0.5, h * 0.7, 0xffa726).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.55).setOrigin(0.5, 1)
        scene.tweens.add({ targets: core, y: baseY - rise * 0.9, scaleX: 0.3, scaleY: 0.4, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => core.destroy() })
        // braise qui monte et scintille
        const ember = scene.add.circle(fx, baseY - Phaser.Math.Between(0, 20), Phaser.Math.Between(1, 3), 0xffcc80).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.9)
        scene.tweens.add({ targets: ember, y: ember.y - Phaser.Math.Between(30, 70), x: fx + Phaser.Math.Between(-10, 10), alpha: 0, duration: Phaser.Math.Between(500, 800), ease: 'Sine.out', onComplete: () => ember.destroy() })
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
