import Phaser from 'phaser'

// Plancher de hitbox (px de texture source) : même une flèche fine et longue reçoit une boîte de
// collision d'au moins ce côté → un tir qui passe sur un mob au même niveau le touche de façon
// FIABLE (anti-tunnel), au lieu de le frôler sans jamais déclencher l'overlap.
const HITBOX_MIN = 22

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number
  fromPlayer: boolean
  pierce = false // traverse tout : ne se détruit pas au 1er impact
  // Flèche enflammée : à l'impact, applique une brûlure (DoT) à l'ennemi touché (voir LevelScene).
  burn: { dmgPerTick: number; durationMs: number } | null = null
  // Flèche explosive : au lieu des dégâts directs, détone en zone à l'impact (sol ou ennemi).
  explosive: { radius: number; damage: number; color: number } | null = null
  // Grosse boule de feu : dégâts directs PUIS petite explosion (gerbe de feu) à l'impact sur un ennemi.
  blast: { radius: number; color: number } | null = null
  readonly hitEnemies = new Set<object>() // pour ne toucher chaque cible qu'une fois
  private startX: number
  private startY: number
  private rangePx: number
  private readonly launchVX: number
  private readonly launchVY: number
  private trailSinceMs = 0
  private readonly trailEveryMs = 35

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number, dirY: number, damage: number, fromPlayer: boolean, rangePx: number) {
    super(scene, x, y, 'projectile')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    const v = new Phaser.Math.Vector2(dirX, dirY).normalize().scale(420)
    this.launchVX = v.x
    this.launchVY = v.y
    this.setVelocity(v.x, v.y)
    this.setRotation(Math.atan2(v.y, v.x)) // oriente le sprite dans l'axe du tir dès le départ
    this.damage = damage
    this.fromPlayer = fromPlayer
    this.startX = x
    this.startY = y
    this.rangePx = rangePx
    if (!fromPlayer) this.setTint(0xff5252)
    // hitbox généreuse et centrée dès la création (avant tout swap de texture)
    this.syncHitbox()
  }

  // Hitbox GÉNÉREUSE et CENTRÉE, resynchronisée à CHAQUE changement de texture. Sans ça, le corps
  // Arcade conservait la taille de la texture INITIALE ('projectile') après un setTexture (fx-arrow,
  // fx-fireball…) : hitbox décalée et souvent trop petite → des tirs qui « ratent » un mob pourtant
  // traversé. On plancher les deux côtés (HITBOX_MIN) pour fiabiliser la détection (anti-tunnel).
  private syncHitbox() {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) return // appelé pendant la construction (super() → setTexture) : corps pas encore prêt
    const w = Math.max(this.width, HITBOX_MIN)
    const h = Math.max(this.height, HITBOX_MIN)
    body.setSize(w, h, true) // center=true : la boîte est recentrée sur le frame courant
  }

  // resynchronise la hitbox après CHAQUE swap de texture (voir syncHitbox)
  setTexture(key: string): this {
    super.setTexture(key)
    this.syncHitbox()
    return this
  }

  // À rappeler APRÈS l'ajout à un groupe physique : un Phaser.Physics.Arcade.Group réapplique
  // ses défauts (vélocité 0) à chaque add(), ce qui écrase la vélocité posée au constructeur.
  // Sans ce relancement, les tirs restaient immobiles (puis tombaient si la gravité était ON).
  launch(): this {
    this.setVelocity(this.launchVX, this.launchVY)
    return this
  }

  preUpdate(t: number, d: number) {
    super.preUpdate(t, d)
    // au-delà de sa portée : on se détruit ET ON SORT. Sans ce return, la suite lisait
    // this.body (mis à null par destroy()) → « Cannot read properties of undefined
    // (reading 'angularVelocity') », exception non gérée dans le step Phaser qui TUE la boucle
    // RAF (la frame suivante n'est jamais reprogrammée) → gel définitif du jeu.
    if (Phaser.Math.Distance.Between(this.x, this.y, this.startX, this.startY) > this.rangePx) {
      this.destroy()
      return
    }
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body) return
    // les tirs droits pointent vers leur trajectoire ; les tirs en cloche tournent déjà
    // sur eux-mêmes via angularVelocity (bambou), qu'on ne veut pas écraser ici
    if (body.angularVelocity === 0 && (body.velocity.x !== 0 || body.velocity.y !== 0)) {
      this.setRotation(Math.atan2(body.velocity.y, body.velocity.x))
    }
    this.trailSinceMs += d
    if (this.trailSinceMs >= this.trailEveryMs) {
      this.trailSinceMs = 0
      this.spawnTrailEcho()
    }
  }

  // On tue les tweens visant ce projectile avant destruction : certains tirs (boule de feu)
  // portent un tween de scintillement en repeat:-1 qui, sans ça, continuerait de modifier un
  // sprite détruit à chaque frame (fuite / accès invalide).
  destroy(fromScene?: boolean) {
    this.scene?.tweens?.killTweensOf(this)
    super.destroy(fromScene)
  }

  // traînée lumineuse : échos de la texture courante qui s'estompent derrière le projectile
  private spawnTrailEcho() {
    if (!this.scene) return
    const echo = this.scene.add.image(this.x, this.y, this.texture.key)
      .setRotation(this.rotation)
      .setScale(this.scaleX * 0.9, this.scaleY * 0.9)
      .setTint(this.tintTopLeft)
      .setAlpha(0.4)
      .setDepth((this.depth ?? 0) - 1)
    this.scene.tweens.add({
      targets: echo, alpha: 0, scaleX: echo.scaleX * 0.5, scaleY: echo.scaleY * 0.5,
      duration: 220, onComplete: () => echo.destroy(),
    })
  }
}
