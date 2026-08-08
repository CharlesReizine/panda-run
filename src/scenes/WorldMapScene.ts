import Phaser from 'phaser'
import { WORLD_NODES, WORLD_EDGES, isNodeUnlocked, neighborsOf, type MapNode } from '../data/worldmap'
import { getPlayer } from '../state'
import { canChangeClass, canEvolveClass } from '../core/progression'
import { save } from '../core/save'
import { audio } from '../audio/audio-engine'
import { isLevelSeen } from './LevelIntroScene'
import { VIEW_H, VIEW_W, centerCamera } from '../core/viewport'
import { installUiClickSound } from '../ui/click-sound'
import { spreadLabels } from './label-spread'

const NODE_COLORS = { town: 0xffd700, level: 0x66bb6a, boss: 0xef5350 } as const
const LOCKED_COLOR = 0x555555
const RADIUS = { town: 22, level: 12, boss: 20 } as const

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap') }

  create() {
    // chaque bouton de cet écran sonne, sans avoir à l'annoter (cf. ui/click-sound.ts)
    installUiClickSound(this)
    // espace de conception 0→960 recentré sur l'écran élargi (core/viewport.ts) :
    // une seule ligne, aucune coordonnée à retoucher
    centerCamera(this)
    audio.playMusic('carte')
    // la scène est réutilisée entre deux niveaux : on REMET À ZÉRO le verrou de voyage, sinon il
    // reste bloqué à true après le 1er trajet (scene.start part pendant l'anim) → carte figée au retour.
    this.traveling = false

    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))
    this.drawBackground()

    // TITRE TOUJOURS LISIBLE. Il était brun foncé, posé à même la carte : sur les zones sombres (voile
    // de brouillard, désert de nuit) il devenait illisible. Plaque noire opaque + texte blanc + depth
    // au-dessus du voile (qui est en depth 6) → lisible sur n'importe quel fond, en toutes circonstances.
    const titleTxt = 'Carte du monde'
    const tw = titleTxt.length * 15 + 36
    this.add.rectangle(480, 26, tw, 36, 0x000000, 0.82).setDepth(40).setStrokeStyle(1, 0xffffff, 0.25)
    this.add.text(480, 26, titleTxt, { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(41)

    const p = getPlayer()
    const current = byId.get(p.currentNode)!
    const anchors = this.computeAnchors(p)
    const revealed = this.computeRevealed(anchors)

    this.drawRoads(byId)

    // Étiquettes de nœuds collectées pour être écartées APRÈS coup : deux nœuds voisins (Clairière /
    // Sylve) voyaient leurs noms se croiser. Même module que les enseignes de ville.
    const nodeLabels: Phaser.GameObjects.Text[] = []
    for (const n of WORLD_NODES) {
      const unlocked = isNodeUnlocked(n.id, p.completedLevels)
      const done = n.levelId ? p.completedLevels.includes(n.levelId) : false
      const isCurrent = n.id === p.currentNode
      // règles d'interaction : on n'avance QUE vers le front de progression (terrain voisin du
      // nœud courant, débloqué, PAS encore complété) ; interdit de revenir sur un terrain déjà
      // fait/derrière. EXCEPTION de VOYAGE : une ville déjà DÉCOUVERTE (révélée) et débloquée
      // reste accessible pour y RETOURNER (achat/craft), même après avoir avancé. Le nœud courant
      // ne se « rejoint » pas — sauf si c'est une ville, qu'on ouvre alors directement.
      // voyage LIBRE vers tout nœud DÉBLOQUÉ + RÉVÉLÉ (plus seulement les voisins) : on peut faire
      // les branches parallèles (Orée ↔ Champs) et revisiter sans détour forcé. Le brouillard cache
      // toujours le lointain non découvert → pas de « balade » vers l'inconnu.
      const canTravel = !isCurrent && unlocked && revealed.has(n.id)
      const canEnterTown = isCurrent && n.type === 'town'
      // nœud COURANT qui est un TERRAIN (ou boss), pas une ville : on le LANCE directement, comme on
      // entre dans une ville. Indispensable pour (re)jouer le niveau courant NON complété — ex.
      // Prairie au tout début : c'est le nœud courant, on doit pouvoir le démarrer depuis la carte.
      const canEnterLevel = isCurrent && n.type !== 'town' && !!n.levelId
      const interactive = canTravel || canEnterTown || canEnterLevel
      const radius = RADIUS[n.type]
      const color = interactive ? NODE_COLORS[n.type] : LOCKED_COLOR

      // ─── DEUX HALOS DIFFÉRENTS : « JAMAIS FAIT » ET « DÉJÀ FAIT » ───────────────────────────
      //
      // Retour du user : « il faut prévoir un truc visuellement sur la carte pour faire apparaître en
      // surbrillance les cartes accessibles mais où je ne suis pas encore allé — ça devrait grossir,
      // réduire par exemple. Là ce n'est pas toujours clair. Et fais peut-être rayonner moins loin les
      // terrains déjà découverts, mais rayonner un peu les terrains accessibles. »
      //
      // ⚠️ TOUT CE QUI EST JOUABLE PULSAIT PAREIL — c'était le défaut. Un terrain déjà bouclé et un
      // terrain jamais vu portaient exactement le même halo : la carte disait « tu peux y aller » là où
      // le joueur cherchait « où dois-je aller ». Le ✓ existait bien, mais il faut le LIRE, alors qu'un
      // mouvement se repère du coin de l'œil.
      //
      // Le NEUF respire largement (halo ample, cycle lent, il grossit puis se réduit) ; le DÉJÀ FAIT
      // garde une lueur discrète, deux fois plus serrée et bien plus sourde — présent, jamais attirant.
      if (interactive) {
        const neuf = !done
        const halo = this.add.circle(n.x, n.y, radius + (neuf ? 12 : 5), NODE_COLORS[n.type], neuf ? 0.32 : 0.12)
        this.tweens.add({
          targets: halo,
          scale: neuf ? 1.55 : 1.12,
          alpha: neuf ? 0.06 : 0.04,
          yoyo: true, repeat: -1,
          duration: neuf ? 1100 : 1600,
          ease: 'Sine.inOut',
        })
        if (neuf) {
          // un second anneau, plus fin et décalé d'un demi-cycle : l'onde double se remarque de loin
          // sans clignoter — c'est le « grossir/réduire » demandé, appliqué au seul cas qui compte.
          const onde = this.add.circle(n.x, n.y, radius + 4, 0xffffff, 0.18)
          this.tweens.add({
            targets: onde, scale: 1.9, alpha: 0, yoyo: false, repeat: -1,
            duration: 1400, ease: 'Cubic.out',
          })
        }
      }

      // VILLES : aucun dessin — l'illustration de la carte de fond montre déjà clairement la ville
      // (retour user). Seuls le halo « jouable » + l'étiquette + la zone cliquable subsistent.
      if (n.type !== 'town') {
        const g = this.add.graphics()
        if (n.type === 'boss') this.drawSkull(g, n.x, n.y, radius, color, interactive)
        else this.drawTent(g, n.x, n.y, radius, color, interactive)
      }

      // étiquette ancrée sous le nœud : affichée UNIQUEMENT pour les nœuds DÉCOUVERTS (révélés). Le
      // lointain non découvert reste anonyme sous le brouillard (retour joueur : « ce qui n'est pas
      // découvert ne doit pas être écrit »). Blanc + contour noir, au-dessus du brouillard, retour ligne.
      if (revealed.has(n.id)) {
        nodeLabels.push(this.add.text(n.x, n.y + radius + 5, n.name, {
          fontSize: '11px', color: '#ffffff', fontStyle: isCurrent ? 'bold' : 'normal',
          align: 'center', wordWrap: { width: 96 },
          stroke: '#000000', strokeThickness: 3,
          backgroundColor: 'rgba(20,14,8,0.35)', padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 0).setDepth(7))
      }

      if (done) {
        // ⚠️ REMONTÉ AU-DESSUS du nœud. Posé à `n.y - radius + 2`, il empiétait sur l'étiquette du nom
        // (dessinée juste sous le nœud, à `n.y + radius + 5`) quand le nom remontait — « Taillis » était
        // barré par le ✓. On l'écarte franchement vers le haut-droit, hors de la colonne du libellé.
        this.add.text(n.x + radius + 2, n.y - radius - 6, '✓', {
          fontSize: '14px', color: '#2e7d32', fontStyle: 'bold', backgroundColor: '#ffffff', padding: { x: 2, y: 0 },
        }).setOrigin(0.5).setDepth(9)
      }

      if (interactive) {
        const hit = this.add.circle(n.x, n.y, radius + 10, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
        hit.on('pointerdown', () => {
          audio.playSfx('ui-tap')
          canEnterTown ? this.enterCurrentTown() : this.travelTo(n.id)
        })
      }
    }

    // brouillard de guerre INVERSÉ : voile sombre plein écran, percé autour de chaque nœud ANCRE
    // (fait/courant) d'un double cercle de révélation (intérieur net + anneau à 50 %). Dessiné APRÈS
    // les nœuds/labels pour teinter le lointain ; sous les boutons d'UI ci-dessous (depth supérieur).
    // ANTI-CHEVAUCHEMENT : on remonte les noms qui se croisent. `spreadLabels` ne déplace JAMAIS en x
    // — un nom doit rester au-dessus du nœud qu'il désigne, sinon il désignerait le voisin.
    // Les étiquettes ont l'origine (0.5, 0) : leur `y` est le HAUT, alors que le module raisonne sur le
    // BAS. On convertit dans les deux sens plutôt que d'adapter le module, qui est partagé et testé.
    const boxes = nodeLabels.map((t) => ({ x: t.x, y: t.y + t.height, w: t.width, h: t.height }))
    const dys = spreadLabels(boxes, 4, 2)
    nodeLabels.forEach((t, i) => { t.y += dys[i]! })

    this.drawFog(anchors, revealed)

    // marqueur du panda sur le nœud courant
    const marker = this.add.image(current.x, current.y - RADIUS[current.type] - 14, `panda-${p.classId}`).setDisplaySize(26, 26).setDepth(8)
    this.travelMarker = marker
    this.tweens.add({ targets: marker, y: marker.y - 5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' })

    const btnMenu = this.add.text(30, 495, 'Menu', { fontSize: '20px', color: '#ffffff', backgroundColor: '#33691e', padding: { x: 14, y: 6 } }).setDepth(20)
    btnMenu.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Menu'))
    // ── PASTILLE « DES POINTS T'ATTENDENT » ────────────────────────────────────────────────────
    //
    // Retour du joueur : « les stats, je découvre qu'on peut les augmenter. Est-ce que quelqu'un a déjà
    // fait ça ? » — non, probablement personne, et c'est le défaut. On gagne deux points par niveau, et
    // RIEN nulle part ne le disait : ni ici, ni dans le HUD, ni à la montée de niveau. Seul le menu les
    // montrait, à condition de l'ouvrir au bon moment et de regarder au bon endroit.
    //
    // Même remède que pour le journal de quêtes : une pastille sur le chemin du joueur. Elle n'explique
    // rien — elle donne juste une raison d'ouvrir, et c'est tout ce qui manquait.
    try {
      const points = getPlayer().statPoints
      if (points > 0) {
        const px = btnMenu.x + btnMenu.width + 6, py = btnMenu.y - 2
        const pastille = this.add.circle(px, py, 13, 0xffd54f).setDepth(21).setStrokeStyle(2, 0x8d6e00)
        this.add.text(px, py, `${points}`, { fontSize: '13px', color: '#3e2723', fontStyle: 'bold' })
          .setOrigin(0.5).setDepth(22)
        this.tweens.add({ targets: pastille, scale: 1.18, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
    } catch { /* pas de partie chargée : rien à signaler */ }

    // accès à l'inventaire dédié (icône « tenue ») — à droite du bouton Menu
    this.add.circle(148, 505, 24, 0x263238, 0.9).setStrokeStyle(2, 0xffca28, 0.8).setDepth(20)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Inventory', { return: 'WorldMap' }))
    this.add.image(148, 505, 'ui-inventory').setDisplaySize(34, 34).setDepth(21)

    // pastille : points de skill à dépenser
    if (p.skillPoints > 0) {
      // ⚠️ DÉPLACÉE AU-DESSUS du bouton « Menu », pas dessus. À (96, 488) elle recouvrait le bouton
      // (posé en 30,495 avec du remplissage) : on ne lisait ni le nombre ni « Menu ».
      const b = this.add.text(40, 462, `${p.skillPoints}`, { fontSize: '14px', color: '#ffffff', backgroundColor: '#e53935', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(22)
      this.tweens.add({ targets: b, scale: 1.2, yoyo: true, repeat: -1, duration: 500 })
    }

    if (canChangeClass(p)) {
      const t = this.add.text(480, 495, '★ Changer de classe ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ffd700', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    } else if (canEvolveClass(p)) {
      const t = this.add.text(480, 495, '★ Évolution disponible ! ★', { fontSize: '22px', color: '#000000', backgroundColor: '#ce93d8', padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ClassChange'))
      this.tweens.add({ targets: t, scale: 1.08, yoyo: true, repeat: -1, duration: 500 })
    }
  }

  // Ensemble des nœuds RÉVÉLÉS (hors brouillard). MÊME règle pour villes ET terrains : un nœud est
  // révélé s'il est complété, s'il est le nœud courant, ou s'il est adjacent à un nœud
  // complété/courant (les prochains choix visibles). Les villes ne sont PAS pré-révélées : elles
  // se découvrent comme le reste. (Une ville reste ensuite révélée en permanence car son terrain
  // voisin complété la maintient adjacente à un nœud complété → on peut y re-voyager, voir plus bas.)
  private computeRevealed(anchors: Set<string>): Set<string> {
    const revealed = new Set<string>(anchors)
    for (const id of anchors) for (const nb of neighborsOf(id)) revealed.add(nb)
    return revealed
  }

  // Nœuds ANCRES : terrains complétés + nœud courant. Ce sont les seuls autour desquels on perce le
  // brouillard (double cercle) ; leurs voisins ne sont que devinés via l'anneau à 50 %.
  private computeAnchors(p: ReturnType<typeof getPlayer>): Set<string> {
    const done = (n: MapNode) => (n.levelId ? p.completedLevels.includes(n.levelId) : false)
    const anchors = new Set<string>()
    for (const n of WORLD_NODES) if (done(n) || n.id === p.currentNode) anchors.add(n.id)
    return anchors
  }

  // Brouillard INVERSÉ : tout est OBSCUR par défaut. On peint un voile sombre BIEN OPAQUE plein écran
  // dans une DynamicTexture, puis on perce autour de chaque nœud ANCRE (fait / courant) un DOUBLE
  // cercle de révélation : un disque INTÉRIEUR (rayon modéré) 100 % clair — terrain net —, entouré
  // d'un ANNEAU EXTÉRIEUR à ~50 % — on devine sans voir net. Au-delà : voile sombre opaque (lointain
  // vraiment caché). Aucun noir pur : gris bleuté profond, alpha global élevé → le reste de la map
  // marqueur panda (position courante) + garde-fou pour ne pas relancer un voyage pendant l'anim.
  private travelMarker?: Phaser.GameObjects.Image
  private traveling = false

  // est nettement masqué.
  private readonly DARK_COLOR = 0x060812 // bleu nuit très sombre, jamais 0x000000
  private readonly DARK_ALPHA = 0.97 // opacité du voile (bien plus opaque qu'avant : lointain masqué)
  private readonly REVEAL_IN = 130 // rayon du cercle INTÉRIEUR (net, 100 % clair) — 2× plus grand (on voit clair en découvrant)
  private readonly REVEAL_OUT = 200 // rayon du cercle EXTÉRIEUR (anneau à 50 %, on devine) — élargi en proportion

  private drawFog(anchors: Set<string>, revealed: Set<string>) {
    this.ensurePuffTexture()
    const key = 'fog-dark'
    const dt = this.getFogTexture(key)
    dt.fill(this.DARK_COLOR, 1) // voile plein écran
    for (const n of WORLD_NODES) {
      if (anchors.has(n.id)) this.revealNode(dt, n) // fait/courant : anneau deviné + disque net
      else if (revealed.has(n.id)) { // PROCHAINE map : disque NET (bien visible, plus de clic à l'aveugle)
        this.punch(dt, 'fog-clear', n.x, n.y, this.REVEAL_IN)
        this.punch(dt, 'fog-clear', n.x, n.y + 26, this.REVEAL_IN * 0.72)
      }
    }
    dt.render()
    // ⚠️ POSÉ À −BLEED_X, PAS À 0. Le voile fait VIEW_W de large, mais la caméra est décalée par
    // centerCamera : posé à la coordonnée de conception 0, il laissait une BANDE DE 105 px NON
    // BROUILLARDÉE sur le bord gauche (on y voyait la carte brute) et débordait d'autant à droite.
    // La texture travaille donc en coordonnées ÉCRAN, et `punch()` y compense l'écart (cf. plus bas).
    this.add.image(480 - VIEW_W / 2, 0, key).setOrigin(0, 0).setDepth(6).setAlpha(this.DARK_ALPHA)
  }

  // DynamicTexture pleine page (réutilisée entre scènes) sur laquelle composer le voile.
  private getFogTexture(key: string): Phaser.Textures.DynamicTexture {
    if (this.textures.exists(key)) {
      const t = this.textures.get(key) as Phaser.Textures.DynamicTexture
      t.clear()
      return t
    }
    return this.textures.addDynamicTexture(key, VIEW_W, VIEW_H)!
  }

  // Double cercle de révélation autour d'un nœud ancre : d'abord l'ANNEAU extérieur à 50 % (perce la
  // moitié du voile → on devine), puis par-dessus le disque INTÉRIEUR à 100 % (perce tout → net), plus
  // un petit disque net sous le nœud pour dégager son étiquette. Ordre important : le clair passe
  // APRÈS le devine, sinon le 50 % re-voilerait le centre.
  private revealNode(dt: Phaser.Textures.DynamicTexture, n: MapNode) {
    this.punch(dt, 'fog-guess', n.x, n.y, this.REVEAL_OUT) // anneau extérieur ~50 % clair
    this.punch(dt, 'fog-clear', n.x, n.y, this.REVEAL_IN) // disque intérieur 100 % clair
    this.punch(dt, 'fog-clear', n.x, n.y + 26, this.REVEAL_IN * 0.72) // étiquette dégagée
  }

  // efface un disque flou de rayon `radius` (px) centré en (x,y) via le puff `key` (blend ERASE) :
  // le puff `fog-clear` retire tout l'alpha (trou net) ; `fog-guess` n'en retire que ~50 % (voile
  // aminci → on devine). Le puff fait 128 px (rayon 64) → scale = radius/64.
  private punch(dt: Phaser.Textures.DynamicTexture, key: string, x: number, y: number, radius: number) {
    // Les nœuds sont en coordonnées de CONCEPTION (0→960) alors que la texture du voile couvre
    // l'ÉCRAN (VIEW_W) et est posée à −BLEED_X. On décale donc ici, à l'unique point de passage de
    // tous les perçages : sinon chaque trou de révélation serait à 105 px de son nœud.
    const offX = (VIEW_W - 960) / 2
    dt.stamp(key, undefined, x + offX, y, {
      scale: (radius * 2) / 128, originX: 0.5, originY: 0.5, blendMode: Phaser.BlendModes.ERASE,
    })
  }

  // Deux textures « puff » (masques d'effacement à dégradé radial), plein au centre → transparent au
  // bord pour des contours flous : `fog-clear` (alpha 1 → efface tout, cercle net) et `fog-guess`
  // (alpha 0.5 → n'efface que la moitié, anneau où l'on devine). Palier presque plat jusqu'à 0.82 du
  // rayon puis chute → le rayon demandé ≈ le rayon vraiment perçu.
  private ensurePuffTexture() {
    this.makePuff('fog-clear', 1)
    this.makePuff('fog-guess', 0.5)
  }

  private makePuff(key: string, peak: number) {
    if (this.textures.exists(key)) return
    const size = 128
    const tex = this.textures.createCanvas(key, size, size)
    if (!tex) return
    const ctx = tex.getContext()
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grd.addColorStop(0, `rgba(255,255,255,${peak})`)
    grd.addColorStop(0.82, `rgba(255,255,255,${peak})`)
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    tex.refresh()
  }

  // Fond illustré de la carte : la belle vue fantasy `map-monde.jpg`, ÉTIRÉE pour remplir EXACTEMENT
  // le cadre 960×540 dans lequel vivent les nœuds (setDisplaySize, pas de « cover » qui croppait le
  // haut et décalait les points). Un nœud en (x,y) tombe ainsi pile sur la carte. Léger voile sombre
  // par-dessus pour le contraste. Repli sur le parchemin procédural si l'illustration manque.
  private drawBackground() {
    if (this.textures.exists('map-monde')) {
      // ⚠️ TAILLE DE CONCEPTION (960×540), PAS VIEW_W — RÉGRESSION CORRIGÉE.
      // Les NŒUDS de la carte vivent en coordonnées 0→960. Étirer l'illustration sur VIEW_W (1169)
      // ne déplaçait que le décor : seul x = 480 restait aligné, et la dérive atteignait ~86 px aux
      // bords — l'étiquette « Prontera » et le marqueur du panda tombaient à DROITE du château
      // dessiné. En prime, une illustration 16:9 étirée en 2,16:1 se déforme de +22 % en largeur.
      // Le débord latéral est couvert par un fond sombre, puis par le voile de brouillard.
      this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x0d1208).setDepth(-31)
      this.add.image(480, 270, 'map-monde').setDisplaySize(960, 540).setDepth(-30)
      this.add.rectangle(480, 270, VIEW_W, VIEW_H, 0x1a1208, 0.2).setDepth(-29)
      return
    }
    const bg = this.add.graphics()
    const top: [number, number, number] = [0xf1, 0xe2, 0xbd]
    const bottom: [number, number, number] = [0xc9, 0xa8, 0x6a]
    const bands = 24
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1)
      const r = Math.round(top[0] + (bottom[0] - top[0]) * t)
      const gg = Math.round(top[1] + (bottom[1] - top[1]) * t)
      const b = Math.round(top[2] + (bottom[2] - top[2]) * t)
      const color = (r << 16) | (gg << 8) | b
      const y0 = Math.floor((540 / bands) * i)
      const h = Math.ceil(540 / bands) + 1
      bg.fillStyle(color, 1).fillRect(0, y0, 960, h)
    }
    // quelques taches façon vieux papier
    for (let i = 0; i < 18; i++) {
      const x = 40 + ((i * 197) % 900)
      const y = 40 + ((i * 131) % 470)
      bg.fillStyle(0x8d6e3f, 0.05).fillEllipse(x, y, 90, 60)
    }
    bg.lineStyle(6, 0x8d6e3f, 0.5).strokeRect(6, 6, 948, 528)
  }

  // routes en pointillés épais entre les nœuds reliés
  private drawRoads(byId: Map<string, MapNode>) {
    const g = this.add.graphics()
    for (const [a, b] of WORLD_EDGES) {
      const na = byId.get(a)!, nb = byId.get(b)!
      this.dashedLine(g, na.x, na.y, nb.x, nb.y, 0x6d4c37, 5, 14, 9)
    }
  }

  private dashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number, dash: number, gap: number) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    const step = dash + gap
    const nx = dx / len, ny = dy / len
    g.lineStyle(width, color, 0.55)
    for (let d = 0; d < len; d += step) {
      const segLen = Math.min(dash, len - d)
      g.beginPath()
      g.moveTo(x1 + nx * d, y1 + ny * d)
      g.lineTo(x1 + nx * (d + segLen), y1 + ny * (d + segLen))
      g.strokePath()
    }
  }

  // château crénelé : deux tourelles + tour centrale + drapeau — bien reconnaissable, en gros
  private drawCastle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x5d4037 : 0x3a3a3a
    const w = r * 1.7
    const towerW = w * 0.32
    const bodyH = r * 1.15
    const left = x - w / 2, right = x + w / 2
    // corps du château
    g.fillStyle(color).fillRect(left, y - bodyH * 0.15, w, bodyH * 0.75)
    g.lineStyle(2, dark, 0.9).strokeRect(left, y - bodyH * 0.15, w, bodyH * 0.75)
    // tourelles latérales
    for (const tx of [left, right - towerW]) {
      g.fillStyle(color).fillRect(tx, y - bodyH * 0.6, towerW, bodyH)
      g.lineStyle(2, dark, 0.9).strokeRect(tx, y - bodyH * 0.6, towerW, bodyH)
      // créneaux
      for (let i = 0; i < 3; i++) g.fillStyle(color).fillRect(tx + i * (towerW / 3), y - bodyH * 0.6 - 6, towerW / 3 - 2, 6)
    }
    // tour centrale + drapeau
    const cx = x - towerW * 0.45
    g.fillStyle(color).fillRect(cx, y - bodyH * 0.95, towerW * 0.9, bodyH * 0.5)
    g.lineStyle(2, dark, 0.9).strokeRect(cx, y - bodyH * 0.95, towerW * 0.9, bodyH * 0.5)
    g.lineStyle(2, dark, 0.9).lineBetween(x, y - bodyH * 0.95, x, y - bodyH * 1.35)
    g.fillStyle(lit ? 0xef5350 : 0x777777).fillTriangle(x, y - bodyH * 1.35, x, y - bodyH * 1.15, x + 12, y - bodyH * 1.25)
    // porte
    g.fillStyle(dark, 0.9).fillRoundedRect(x - 5, y + bodyH * 0.35, 10, bodyH * 0.25, 3)
  }

  // petite icône de terrain : tente à bannière
  private drawTent(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x2e7d32 : 0x3a3a3a
    g.fillStyle(color).fillTriangle(x - r, y + r * 0.6, x + r, y + r * 0.6, x, y - r * 0.7)
    g.lineStyle(2, dark, 0.9).strokeTriangle(x - r, y + r * 0.6, x + r, y + r * 0.6, x, y - r * 0.7)
    g.fillStyle(dark, 0.6).fillTriangle(x, y + r * 0.6, x + r * 0.35, y + r * 0.6, x, y - r * 0.2)
    g.lineStyle(2, dark, 0.9).lineBetween(x, y - r * 0.7, x, y - r * 1.3)
    g.fillStyle(lit ? 0xffeb3b : 0x777777).fillTriangle(x, y - r * 1.3, x, y - r * 1.05, x + r * 0.6, y - r * 1.17)
  }

  // crâne menaçant surmonté d'une couronne — pour les nœuds boss
  private drawSkull(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, lit: boolean) {
    const dark = lit ? 0x1a1a1a : 0x2a2a2a
    const skullColor = lit ? 0xecebe4 : 0x8a8a8a
    g.fillStyle(skullColor).fillCircle(x, y - r * 0.15, r * 0.85)
    g.fillStyle(skullColor).fillRoundedRect(x - r * 0.5, y, r, r * 0.5, 4) // mâchoire
    g.fillStyle(dark).fillEllipse(x - r * 0.35, y - r * 0.15, r * 0.32, r * 0.42)
    g.fillStyle(dark).fillEllipse(x + r * 0.35, y - r * 0.15, r * 0.32, r * 0.42)
    g.fillStyle(color, 0.9).fillCircle(x - r * 0.35, y - r * 0.15, r * 0.12)
    g.fillStyle(color, 0.9).fillCircle(x + r * 0.35, y - r * 0.15, r * 0.12)
    g.fillStyle(dark).fillTriangle(x - r * 0.12, y + r * 0.05, x + r * 0.12, y + r * 0.05, x, y + r * 0.28) // nez
    for (let i = -2; i <= 2; i++) g.fillStyle(dark).fillRect(x + i * (r * 0.18) - 2, y + r * 0.32, 4, r * 0.16) // dents
    // couronne menaçante
    g.fillStyle(lit ? 0xffd700 : 0x8a8a3a)
      .fillTriangle(x - r * 0.7, y - r * 0.6, x - r * 0.35, y - r * 0.6, x - r * 0.5, y - r * 1.15)
      .fillTriangle(x - r * 0.15, y - r * 0.6, x + r * 0.15, y - r * 0.6, x, y - r * 1.35)
      .fillTriangle(x + r * 0.35, y - r * 0.6, x + r * 0.7, y - r * 0.6, x + r * 0.5, y - r * 1.15)
    g.fillRect(x - r * 0.7, y - r * 0.65, r * 1.4, r * 0.12)
  }

  // le joueur est déjà dans une ville (nœud courant) : on ouvre directement sans se déplacer
  private enterCurrentTown() {
    this.scene.start('Town')
  }

  // voyage vers un nœud voisin débloqué : ville → déplace le marqueur et va en ville,
  // niveau/boss → entre dans le niveau avec la direction déduite de la position relative
  private travelTo(targetId: string) {
    if (this.traveling) return // anim de voyage en cours : on ignore les taps supplémentaires
    const p = getPlayer()
    const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))
    const target = byId.get(targetId)!
    const tx = target.x
    const ty = target.y - RADIUS[target.type] - 14

    // petite anim de voyage : on voit le panda AVANCER le long jusqu'au nœud choisi (~2 s) avant
    // d'entrer. Simple et lisible : tween de position + léger dandinement, flipX selon la direction.
    this.traveling = true
    this.walkMarkerTo(tx, ty, () => {
      if (target.type === 'town') {
        p.currentNode = targetId
        save(p)
        this.scene.start('Town')
        return
      }
      const dir = 'forward' as const // toujours gauche→droite : jouer un niveau « à l'envers » était contre-nature
      const data = { levelId: target.levelId, fromNode: p.currentNode, targetNode: targetId, dir }
      // Première entrée dans ce terrain → écran d'intro (présentation des monstres et loots).
      // Les fois suivantes → directement le jeu, pas de re-présentation.
      const scene = target.levelId && !isLevelSeen(target.levelId) ? 'LevelIntro' : 'Level'
      this.scene.start(scene, data)
    })
  }

  // déplace le marqueur panda jusqu'à (tx, ty) sur ~2 s avec un léger dandinement, puis appelle then().
  private walkMarkerTo(tx: number, ty: number, then: () => void) {
    const m = this.travelMarker
    if (!m) { then(); return }
    this.tweens.killTweensOf(m) // stoppe le bob sur place
    m.setFlipX(tx < m.x) // le panda regarde vers sa destination
    this.tweens.add({ targets: m, angle: { from: -7, to: 7 }, yoyo: true, repeat: -1, duration: 150 })
    this.tweens.add({ targets: m, x: tx, y: ty, duration: 2000, ease: 'Sine.inOut', onComplete: () => then() })
  }
}
