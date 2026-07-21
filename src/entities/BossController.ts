import Phaser from 'phaser'
import type { LevelScene } from '../scenes/LevelScene'
import type { Enemy } from './Enemy'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// BossController — les boss « MVP une classe ». Chaque boss INCARNE une classe et se bat avec SES
// skills (versions ennemies dirigées vers le joueur, mêmes FX que le panda). Le contrôleur pilote
// ENTIÈREMENT le boss (Enemy.aiDisabled = true) : locomotion, télégraphes, skills, phases.
//
// Trois piliers imposés à CHAQUE boss (lisibles + durs mais évitables) :
//   1. GROSSE ATTAQUE à barre de CHARGE : une réserve d'ÉNÉRGIE se remplit (jauge HUD dorée) ; pleine,
//      le boss CHARGE (barre rouge au-dessus de lui = télégraphe), lâche une attaque quasi fatale
//      ÉVITABLE, puis reste VULNÉRABLE en récupération (immobile, terni).
//   2. INVOCATION d'adds à COMPTE À REBOURS visible (3…2…1) — incite à tuer vite / gérer les adds.
//   3. Skills de CLASSE cadencés + alternance DISTANCE/MÊLÉE selon la classe.
// Phase 2 (sous 50 % PV) : énergie plus rapide, cadence resserrée, patterns plus agressifs.
// ══════════════════════════════════════════════════════════════════════════════════════════════

type Role = 'melee' | 'ranged'

interface Kit {
  role: Role
  desiredPx: number // distance de confort (mêlée : distance d'approche ; distance : à garder)
  energyFillMs: number // temps pour remplir la jauge d'énergie (→ grosse attaque)
  summonEveryMs: number
  summonCount: number
  skillEveryMs: number
  color: number // teinte signature des FX du boss
}

// Réglage par CLASSE incarnée. Les mêlées collent au joueur ; les distants gardent leurs distances.
// NB : les mêlées gardent une distance de confort LARGE (ils ne collent pas le joueur en continu —
// sinon les dégâts de contact deviennent inévitables). Ils menacent par des LUNGES télégraphiées et
// le bond chargé ; le joueur peut esquiver/sauter par-dessus. C'est le cœur du « dur mais évitable ».
const KITS: Record<string, Kit> = {
  novice: { role: 'melee', desiredPx: 78, energyFillMs: 9000, summonEveryMs: 11000, summonCount: 3, skillEveryMs: 2600, color: 0xff8fc0 },
  swordsman: { role: 'melee', desiredPx: 108, energyFillMs: 8500, summonEveryMs: 12000, summonCount: 2, skillEveryMs: 2400, color: 0xffca6b },
  mage: { role: 'ranged', desiredPx: 330, energyFillMs: 8000, summonEveryMs: 12000, summonCount: 3, skillEveryMs: 2200, color: 0xff7043 },
  archer: { role: 'ranged', desiredPx: 320, energyFillMs: 8500, summonEveryMs: 12000, summonCount: 3, skillEveryMs: 1900, color: 0xd7a86e },
  sorcier: { role: 'ranged', desiredPx: 340, energyFillMs: 7500, summonEveryMs: 10000, summonCount: 3, skillEveryMs: 2000, color: 0xb388ff },
  chevalier: { role: 'melee', desiredPx: 118, energyFillMs: 7000, summonEveryMs: 9000, summonCount: 3, skillEveryMs: 1900, color: 0xff5252 },
}

const MAX_ADDS = 6 // plafond d'adds vivants (hors boss) : on n'ensevelit jamais le joueur

export class BossController {
  private scene: LevelScene
  private boss: Enemy
  private kit: Kit
  private atk: number

  private energy = 0 // 0..1 (jauge HUD)
  private phase = 1
  private busyUntil = 0 // tant que now < busyUntil : une action scriptée est en cours (locomotion figée)
  private nextSummonAt: number
  private nextSkillAt: number
  private skillTurn = 0 // alterne les skills de classe

  // Barre de CHARGE au-dessus du boss (monde) : visible seulement pendant le télégraphe de la
  // grosse attaque ; fill<0 = cachée.
  private chargeFill = -1
  private chargeBar: Phaser.GameObjects.Graphics
  // Jauge d'ÉNÉRGIE (HUD, épinglée écran) sous la barre de vie du boss.
  private energyBar: Phaser.GameObjects.Rectangle
  private energyBarBg: Phaser.GameObjects.Rectangle
  private countdown: Phaser.GameObjects.Text | null = null

  constructor(scene: LevelScene, boss: Enemy) {
    this.scene = scene
    this.boss = boss
    boss.aiDisabled = true
    this.atk = boss.monster.atk
    this.kit = KITS[boss.monster.bossClass ?? 'novice'] ?? KITS.novice!

    // léger sursis d'ouverture : le joueur voit le boss avant la première salve
    const now = scene.time.now
    this.nextSummonAt = now + 6000
    this.nextSkillAt = now + 1400

    this.chargeBar = scene.add.graphics().setDepth(30)
    // jauge d'énergie HUD, sous la barre de vie du boss (y≈100)
    this.energyBarBg = scene.add.rectangle(480, 118, 304, 10, 0x000000, 0.55).setScrollFactor(0).setStrokeStyle(1, 0xffffff, 0.25).setDepth(19)
    this.energyBar = scene.add.rectangle(480 - 150, 118, 300, 6, 0xffd54f).setOrigin(0, 0.5).setScrollFactor(0).setDepth(19)

    // annonce d'identité : « incarne le Sabreur », etc.
    const label = this.classLabel(boss.monster.bossClass)
    const ann = scene.add.text(480, 44, `Incarne : ${label}`, { fontSize: '15px', color: '#ffe082', fontStyle: 'italic', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(20)
    scene.tweens.add({ targets: ann, alpha: 0, delay: 2600, duration: 900, onComplete: () => ann.destroy() })
  }

  private classLabel(id: string | undefined): string {
    return { novice: 'le Novice', swordsman: 'le Sabreur', mage: 'le Mage', archer: 'l\'Archer', sorcier: 'le Sorcier', chevalier: 'le Chevalier déchu' }[id ?? ''] ?? 'un Maître d\'armes'
  }

  // Appelé chaque frame par LevelScene.update tant que le boss vit.
  step(now: number, delta: number) {
    if (!this.boss.active) return
    const boss = this.boss
    const player = this.scene.player

    // phase 2 sous 50 % PV : plus rapide, plus agressif — une seule bascule.
    if (this.phase === 1 && boss.hp <= boss.monster.hp * 0.5) this.enterPhase2()

    // recharge d'énergie (gelée pendant une action en cours pour laisser respirer)
    if (now >= this.busyUntil) this.energy = Math.min(1, this.energy + delta / this.kit.energyFillMs)
    this.drawBars()

    if (now < this.busyUntil) return // action scriptée en cours → elle pilote tout

    // ── LOCOMOTION (alternance distance/mêlée) ────────────────────────────────────────────────
    const dx = player.x - boss.x
    const dir = dx < 0 ? -1 : 1
    const dist = Math.abs(dx)
    const spd = boss.monster.speed
    if (this.kit.role === 'melee') {
      boss.setVelocityX(dist > this.kit.desiredPx ? dir * spd : 0)
    } else {
      if (dist < this.kit.desiredPx - 90) boss.setVelocityX(-dir * spd) // trop près : recule
      else if (dist > this.kit.desiredPx + 130) boss.setVelocityX(dir * spd) // trop loin : approche
      else boss.setVelocityX(0)
    }

    // ── ORDONNANCEMENT : grosse attaque (énergie pleine) > invocation > skill de classe ──────────
    if (this.energy >= 1) { this.energy = 0; this.chargedAttack(now); return }
    if (now >= this.nextSummonAt) { this.nextSummonAt = now + this.kit.summonEveryMs; this.summonWave(now); return }
    if (now >= this.nextSkillAt) { this.nextSkillAt = now + this.kit.skillEveryMs; this.regularSkill(); return }
  }

  private enterPhase2() {
    this.phase = 2
    this.kit = { ...this.kit, energyFillMs: this.kit.energyFillMs * 0.6, summonEveryMs: this.kit.summonEveryMs * 0.7, skillEveryMs: this.kit.skillEveryMs * 0.65 }
    this.scene.showEnrageBanner()
  }

  // ══════════════════════════ SKILLS DE CLASSE (cadencés) ══════════════════════════
  private regularSkill() {
    const id = this.boss.monster.id
    const t = this.skillTurn++
    switch (this.boss.monster.bossClass) {
      case 'novice': return t % 2 === 0 ? this.novBambou() : this.novRoar()
      case 'swordsman': return this.swdLunge()
      case 'mage': return t % 2 === 0 ? this.mgFireball() : this.mgFireball(true)
      case 'archer': return t % 2 === 0 ? this.arcSalvo() : this.arcSalvo()
      case 'sorcier': return t % 2 === 0 ? this.sorBolts() : this.sorBolts()
      case 'chevalier': // Seigneur Déchu : les MEILLEURES attaques de CHAQUE classe, en rotation
        if (id === 'seigneur-dechu') {
          const pick = t % 4
          if (pick === 0) return this.swdLunge() // sabreur : taillade bondissante
          if (pick === 1) return this.mgFireball() // mage : boule de feu
          if (pick === 2) return this.arcSalvo() // archer : salve perçante
          return this.sorBolts() // sorcier : salve du néant
        }
        return this.swdLunge()
    }
  }

  // Novice — Bambou jeté (tir en cloche du moteur) : lob thématique vers le joueur.
  private novBambou() {
    this.announce('Bambou jeté !')
    this.scene.spawnEnemyLob(this.boss.x, this.boss.y - 12, this.scene.player.x, Math.round(this.atk * 1.1))
  }

  // Novice — Rugissement du panda : onde de choc autour du roi slime (mêlée large).
  private novRoar() {
    this.announce('Rugissement !')
    this.scene.bossExplode(this.boss.x, this.boss.y, 130, Math.round(this.atk * 1.2), this.kit.color)
  }

  // Sabreur / Déchu — Taillade bondissante : petit bond vers le joueur puis coup d'arc tranchant.
  private swdLunge() {
    const boss = this.boss
    const player = this.scene.player
    const dir = player.x < boss.x ? -1 : 1
    this.announce('Taillade !')
    this.busyUntil = this.scene.time.now + 520
    boss.setVelocityX(dir * boss.monster.speed * 2.4)
    boss.setVelocityY(-260)
    this.scene.time.delayedCall(280, () => {
      if (!boss.active) return
      this.scene.bossMeleeStrike(boss.x, boss.y, 128, Math.round(this.atk * 1.35), this.kit.color)
    })
  }

  // Mage / Déchu — Boule de feu (impact explosif). double=éclats latéraux (spread) en phase 2/agressif.
  private mgFireball(spread = false) {
    const boss = this.boss
    const p = this.scene.player
    this.announce('Boule de feu !')
    const shots = spread ? [-0.18, 0, 0.18] : [0]
    for (const off of shots) {
      this.scene.bossShoot(boss.x, boss.y - 16, p.x, p.y + off * 260, Math.round(this.atk * 1.15), 'fx-fireball', 1.8, 900)
    }
  }

  // Archer / Déchu — Salve perçante : trois éclats rapides en éventail (fx-rock, thème pierre/golem).
  private arcSalvo() {
    const boss = this.boss
    const p = this.scene.player
    this.announce('Salve perçante !')
    for (const off of [-0.14, 0, 0.14]) {
      this.scene.bossShoot(boss.x, boss.y - 14, p.x, p.y + off * 240, Math.round(this.atk * 1.1), 'fx-rock', 1.3, 1100)
    }
  }

  // Sorcier / Déchu — Salve du néant : bolts nécrotiques dirigés (fx-necro), harcèlement à distance.
  private sorBolts() {
    const boss = this.boss
    const p = this.scene.player
    this.announce('Salve du néant !')
    for (const off of [-0.22, 0, 0.22]) {
      this.scene.bossShoot(boss.x, boss.y - 16, p.x, p.y + off * 220, Math.round(this.atk * 1.1), 'fx-necro', 1.3, 950)
    }
  }

  // ══════════════════════════ INVOCATION (compte à rebours visible) ══════════════════════════
  private summonWave(now: number) {
    const summonId = this.boss.monster.bossSummon
    if (!summonId) return
    const alive = this.scene.enemies.getChildren().filter((e) => e !== this.boss && (e as Enemy).active).length
    if (alive >= MAX_ADDS) { this.nextSummonAt = now + 4000; return } // arène déjà pleine : on retente vite

    this.announce('Invocation…', 0xce93d8)
    // compte à rebours 3 → 2 → 1 au-dessus du boss, puis apparition
    let n = 3
    this.setCountdown(String(n))
    const tick = this.scene.time.addEvent({
      delay: 550, repeat: 2, callback: () => {
        n -= 1
        if (n > 0) { this.setCountdown(String(n)); return }
        this.setCountdown(null)
        if (!this.boss.active) return
        const count = Math.min(this.kit.summonCount, MAX_ADDS - alive)
        for (let i = 0; i < count; i++) {
          const spanX = this.scene.arenaWidthPx()
          const x = Phaser.Math.Clamp(this.boss.x + Phaser.Math.Between(-220, 220), 80, spanX - 80)
          this.scene.bossSpawnAdd(summonId, x)
        }
      },
    })
    void tick
  }

  // ══════════════════════════ GROSSE ATTAQUE CHARGÉE (énergie pleine) ══════════════════════════
  private chargedAttack(now: number) {
    switch (this.boss.monster.bossClass) {
      case 'mage':
      case 'sorcier': return this.chargedMeteorStorm(now)
      case 'archer': return this.chargedDeluge(now)
      case 'novice':
      case 'swordsman':
      case 'chevalier':
      default: return this.chargedLeapSlam(now)
    }
  }

  // Guerriers (novice/sabreur/chevalier) — BOND FRACASSANT : charge visible, saut vers le joueur, puis
  // retombée en onde de choc quasi fatale (évitable en dégageant la zone), enfin RÉCUP vulnérable.
  private chargedLeapSlam(now: number) {
    const boss = this.boss
    const CHARGE = 1200, LEAP = 750, RECOVER = 1700
    this.announce('CHARGE…', 0xff1744)
    this.busyUntil = now + CHARGE + LEAP + RECOVER
    boss.setVelocity(0, 0)
    this.runChargeBar(CHARGE, () => {
      if (!boss.active) return
      const targetX = Phaser.Math.Clamp(this.scene.player.x, 80, this.scene.arenaWidthPx() - 80)
      const dir = targetX < boss.x ? -1 : 1
      boss.setVelocityX(dir * Math.min(360, Math.abs(targetX - boss.x) / (LEAP / 1000)))
      boss.setVelocityY(-620)
      this.scene.screenShake(0.008, 200)
      this.scene.time.delayedCall(LEAP, () => {
        if (!boss.active) return
        boss.setVelocity(0, 0)
        this.scene.bossExplode(boss.x, this.scene.groundTopY() - 10, 165, Math.round(this.atk * 2.8), this.kit.color)
        this.scene.screenShake(0.02, 260)
        this.markVulnerable(RECOVER)
      })
    })
  }

  // Mage / Sorcier — PLUIE DE MÉTÉORES : charge, puis une salve de frappes télégraphiées balaie l'arène
  // en laissant un TROU SÛR (près du joueur au déclenchement) où se réfugier ; puis récup.
  private chargedMeteorStorm(now: number) {
    const boss = this.boss
    const CHARGE = 1300, RECOVER = 1600
    this.announce('CHARGE : MÉTÉORES…', 0xff1744)
    this.busyUntil = now + CHARGE + 1700 + RECOVER
    boss.setVelocity(0, 0)
    this.runChargeBar(CHARGE, () => {
      if (!boss.active) return
      const W = this.scene.arenaWidthPx()
      const safe = Phaser.Math.Clamp(this.scene.player.x + Phaser.Math.Between(-40, 40), 120, W - 120)
      const count = this.phase >= 2 ? 9 : 7
      for (let i = 0; i < count; i++) {
        const x = 120 + (i / (count - 1)) * (W - 240)
        if (Math.abs(x - safe) < 110) continue // trou sûr : refuge évitant la mort
        this.scene.time.delayedCall(i * 120, () => {
          if (boss.active) this.scene.bossTelegraphStrike(x, 78, 620, Math.round(this.atk * 2.4), this.kit.color)
        })
      }
      this.scene.flashScreen(this.kit.color, 0.12, 200)
      this.markVulnerable(RECOVER)
    })
  }

  // Archer (golem) — DÉLUGE DE PIERRES : charge, puis un tapis dense de frappes rapides s'abat sur toute
  // l'arène par vagues, mais chaque frappe est brièvement télégraphiée (on lit et on court) ; puis récup.
  private chargedDeluge(now: number) {
    const boss = this.boss
    const CHARGE = 1200, RAIN = 2000, RECOVER = 1500
    this.announce('CHARGE : DÉLUGE…', 0xff1744)
    this.busyUntil = now + CHARGE + RAIN + RECOVER
    boss.setVelocity(0, 0)
    this.runChargeBar(CHARGE, () => {
      if (!boss.active) return
      const W = this.scene.arenaWidthPx()
      const drops = this.phase >= 2 ? 16 : 12
      for (let i = 0; i < drops; i++) {
        this.scene.time.delayedCall(i * (RAIN / drops), () => {
          if (!boss.active) return
          const x = Phaser.Math.Between(100, W - 100)
          this.scene.bossTelegraphStrike(x, 52, 420, Math.round(this.atk * 1.7), this.kit.color)
        })
      }
      this.markVulnerable(RECOVER)
    })
  }

  // fenêtre de RÉCUPÉRATION : le boss reste planté, terni et « ! » (vulnérable) — moment de le punir.
  private markVulnerable(ms: number) {
    const boss = this.boss
    boss.setVelocityX(0)
    boss.setTint(0x8899ff)
    this.setCountdown('!')
    this.scene.time.delayedCall(ms, () => {
      if (!boss.active) return
      boss.clearTint()
      this.setCountdown(null)
    })
  }

  // Barre de charge (télégraphe) au-dessus du boss : se remplit sur `ms`, puis exécute `then`.
  private runChargeBar(ms: number, then: () => void) {
    this.chargeFill = 0
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: (tw) => { this.chargeFill = tw.getValue() ?? 0 },
      onComplete: () => { this.chargeFill = -1; then() },
    })
  }

  private setCountdown(txt: string | null) {
    if (txt === null) { this.countdown?.destroy(); this.countdown = null; return }
    if (!this.countdown) {
      this.countdown = this.scene.add.text(this.boss.x, this.boss.y, txt, { fontSize: '34px', color: '#ff5252', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(31)
    }
    this.countdown.setText(txt)
  }

  private announce(text: string, color = 0xffe082) {
    const hex = `#${color.toString(16).padStart(6, '0')}`
    const t = this.scene.add.text(this.boss.x, this.boss.y - this.boss.displayHeight * 0.6 - 18, text, {
      fontSize: '16px', color: hex, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(31)
    this.scene.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 800, onComplete: () => t.destroy() })
  }

  // redessine la jauge d'énergie (HUD) + la barre de charge au-dessus du boss + suit le compte à rebours.
  private drawBars() {
    this.energyBar.setDisplaySize(300 * this.energy, 6)
    this.energyBar.setFillStyle(this.energy >= 1 ? 0xff5252 : 0xffd54f)

    this.chargeBar.clear()
    if (this.chargeFill >= 0 && this.boss.active) {
      const w = 90, x = this.boss.x - w / 2, y = this.boss.y - this.boss.displayHeight * 0.6 - 34
      this.chargeBar.fillStyle(0x000000, 0.6).fillRect(x - 2, y - 2, w + 4, 12)
      this.chargeBar.fillStyle(0xff1744, 0.95).fillRect(x, y, w * this.chargeFill, 8)
    }
    if (this.countdown && this.boss.active) this.countdown.setPosition(this.boss.x, this.boss.y - this.boss.displayHeight * 0.6 - 30)
  }

  destroy() {
    this.chargeBar.destroy()
    this.energyBar.destroy()
    this.energyBarBg.destroy()
    this.countdown?.destroy()
  }
}
