import { registerSW } from 'virtual:pwa-register'
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { logError, logEvent } from './core/logger'
import { showErrorOverlay } from './ui/error-overlay'

// Mise à jour auto : dès qu'une nouvelle version est déployée, on l'applique et on recharge.
// On sonde aussi toutes les 30 s pour qu'une session déjà ouverte se mette à jour seule.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(_url, reg) { if (reg) setInterval(() => reg.update(), 30000) },
})
import { PreloadScene } from './scenes/PreloadScene'
import { TitleScene } from './scenes/TitleScene'
import { WorldMapScene } from './scenes/WorldMapScene'
import { LevelIntroScene } from './scenes/LevelIntroScene'
import { TownScene } from './scenes/TownScene'
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'
import { PauseScene } from './scenes/PauseScene'
import { MenuScene } from './scenes/MenuScene'
import { InventoryScene } from './scenes/InventoryScene'
import { ClassChangeScene } from './scenes/ClassChangeScene'
import { SkillEquipScene } from './scenes/SkillEquipScene'
import { BestiaryScene } from './scenes/BestiaryScene'
import { QuestLogScene } from './scenes/QuestLogScene'
import { TrainingScene } from './scenes/TrainingScene'
import { LeaderboardScene } from './scenes/LeaderboardScene'
import { GRAVITY } from './core/platforming'
import { VIEW_W, VIEW_H } from './core/viewport'
import { LEVELS } from './data/levels'
import { audio } from './audio/audio-engine'

// ─── Capture globale des erreurs ────────────────────────────────────────────
// Sur iPhone il n'y a pas de console : toute exception non gérée doit devenir VISIBLE.
// On installe ces gardes AVANT la création du jeu pour attraper aussi un crash au boot.
function detail(err: unknown): string {
  return err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
}
window.addEventListener('error', (e) => {
  logError('window', e.error ?? e.message)
  const where = e.filename ? ` (${e.filename}:${e.lineno}:${e.colno})` : ''
  const stack = e.error instanceof Error ? `\n\n${e.error.stack ?? ''}` : ''
  showErrorOverlay('Erreur JS', `${e.message}${where}${stack}`)
})
window.addEventListener('unhandledrejection', (e) => {
  logError('promise', e.reason)
  showErrorOverlay('Promesse rejetée', detail(e.reason))
})

// La création du jeu elle-même peut planter (WebGL indispo, config invalide…) → overlay.
let game: Phaser.Game | undefined
try {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    // Largeur LOGIQUE calculée d'après le format de l'écran (cf. core/viewport.ts) : le jeu remplit
    // toute la largeur au lieu de letterboxer un 16:9 sur un écran en 2,16:1. La hauteur reste 540,
    // donc toutes les coordonnées verticales existantes sont intactes.
    width: VIEW_W,
    height: VIEW_H,
    antialias: true,
    roundPixels: false,
    backgroundColor: '#87ceeb',
    // ⚠️ SCALE.NONE, PAS FIT — ET C'EST DÉLIBÉRÉ APRÈS QUATRE ÉCHECS.
    // Avec FIT, Phaser mesure lui-même son conteneur et en déduit la taille du canvas. Sur iOS
    // Safari cette mesure est fausse et INSTABLE : mesuré sur captures d'écran, le canvas occupait
    // 69 % de la largeur sur un écran, 59 % sur un autre, décalé et coupé en bas — la hauteur du
    // conteneur variant avec la barre d'URL, FIT recalculait une échelle différente à chaque scène.
    // En NONE, Phaser ne touche plus au CSS du canvas : c'est refit() qui l'étire EXACTEMENT sur la
    // zone visible (visualViewport). Comme la taille logique est déjà calculée au format de l'écran
    // (core/viewport.ts), l'étirement résiduel est de quelques pourcents, invisible — et il n'y a
    // plus ni bande noire, ni décalage, ni bas coupé possible.
    scale: { mode: Phaser.Scale.NONE },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY } } },
    // on gère TOUT l'audio via notre moteur Web Audio (src/audio) → on désactive le gestionnaire
    // de son de Phaser, qui créait un 2e AudioContext (échec « failed to start audio device » sur iOS)
    audio: { noAudio: true },
    scene: [BootScene, PreloadScene, TitleScene, WorldMapScene, LevelIntroScene, TownScene, LevelScene, UIScene, PauseScene, MenuScene, InventoryScene, ClassChangeScene, SkillEquipScene, BestiaryScene, QuestLogScene, TrainingScene, LeaderboardScene],
  })
} catch (err) {
  logError('boot', err)
  showErrorOverlay('Échec du démarrage', detail(err))
}

// Crochets de pilotage headless (inoffensifs en prod : simple lecture) — l'émulateur lit
// l'instance Phaser et le heartbeat courant du watchdog pour piloter le jeu et détecter un gel.
// Exposés inconditionnellement car l'émulateur joue le build de PRODUCTION (dist/).
if (game) {
  ;(window as unknown as { __pandaGame?: Phaser.Game }).__pandaGame = game
  // Liste des terrains, pour les sondes de cadrage : elles doivent pouvoir parcourir TOUS les terrains
  // sans qu'on maintienne la liste en double dans un script (une liste recopiée finit désynchronisée, et
  // une sonde qui saute des terrains ne prouve rien). Lecture seule, aucun effet sur le jeu.
  ;(window as unknown as { __pandaLevelIds?: string[] }).__pandaLevelIds = Object.keys(LEVELS)
  // Et les définitions complètes : la sonde de terrains choisit son échantillon d'après ce que chaque
  // terrain CONTIENT (trampolines, aqueducs, eau, boss) plutôt que d'après une liste d'identifiants
  // écrite à la main, qui vieillirait sans prévenir dès qu'un motif change de place.
  ;(window as unknown as { __pandaLevels?: typeof LEVELS }).__pandaLevels = LEVELS
  // Moteur audio, pour les sondes de son. Un bug de son est INOBSERVABLE en headless autrement : rien ne
  // sort d'un contexte Web Audio qu'on puisse lire. Sans ce crochet, la seule façon de savoir si un effet
  // part vraiment serait de demander au user de tendre l'oreille — c'est exactement ce qu'on veut éviter.
  ;(window as unknown as { __pandaAudio?: unknown }).__pandaAudio = audio
  // État du joueur, pour les sondes : plusieurs écrans (la ville, par exemple) lisent le nœud courant
  // au lieu de recevoir un paramètre. Sans ce crochet, une sonde ne peut pas ouvrir Morocc — elle
  // ouvrait la ville générique et j'ai cru le bug corrigé alors que je regardais un autre écran.
  void import('./state').then(({ getPlayer }) => {
    ;(window as unknown as { __pandaEtatJoueur?: () => unknown }).__pandaEtatJoueur = () => {
      try { return getPlayer() } catch { return null }
    }
  })
}

// Le conteneur #game est dimensionné en CSS PUR (100dvw/100dvh + insets safe-area symétriques,
// cf. index.html) : les unités « dynamic viewport » suivent nativement l'apparition/disparition de la
// barre d'URL de Safari. On ne mesure PLUS visualViewport en JS pour poser width/height/top/left —
// c'était la cause du bas coupé et du décentrage sur iPhone : une mesure JS est périmée dès la frame
// suivante, et écrire ces styles entrait en conflit avec le CSS.
//
// Il reste à PRÉVENIR Phaser que la zone a changé, pour qu'il recalcule son échelle : c'est tout ce
// que fait refit(). Aucun calcul de notre côté, Phaser lit la taille réelle du conteneur.
// Place le canvas dans la zone RÉELLEMENT visible, EN CONSERVANT SON RAPPORT.
//
// C'est un « FIT » calculé À LA MAIN. Deux raisons de ne pas laisser Phaser le faire :
//   · avec Scale.FIT il mesure lui-même son conteneur, et sur iOS Safari cette mesure est fausse et
//     instable (mesuré : 69 % de largeur sur un écran, 59 % sur un autre, décalé et coupé en bas) ;
//   · `visualViewport` est la seule mesure fiable sur iOS — elle exclut la barre d'URL et suit l'encoche.
//
// ⚠️ ON NE DÉFORME PAS. Une version précédente étirait le canvas sur toute la zone visible sans
// respecter le rapport : « tout est déformé, c'est ignoble ». On prend donc la plus grande taille au
// BON rapport qui rentre, et on la centre. Comme la taille logique est déjà calculée au format de
// l'écran (core/viewport.ts), le liseré restant est minime — et surtout rien n'est jamais déformé
// ni coupé.
function refit() {
  if (!game) return
  const vv = window.visualViewport
  const availW = Math.round(vv?.width ?? window.innerWidth)
  const availH = Math.round(vv?.height ?? window.innerHeight)
  if (!availW || !availH) return
  const k = Math.min(availW / VIEW_W, availH / VIEW_H)
  const cw = Math.round(VIEW_W * k)
  const ch = Math.round(VIEW_H * k)
  const c = game.canvas
  c.style.position = 'fixed'
  c.style.margin = '0'
  c.style.width = `${cw}px`
  c.style.height = `${ch}px`
  c.style.left = `${Math.round((vv?.offsetLeft ?? 0) + (availW - cw) / 2)}px`
  c.style.top = `${Math.round((vv?.offsetTop ?? 0) + (availH - ch) / 2)}px`
  // indispensable : Phaser doit relire les bornes du canvas, sinon la conversion clic → coordonnées
  // de jeu reste calée sur l'ancienne taille et les boutons deviennent décalés
  game.scale.refresh()
}

window.visualViewport?.addEventListener('resize', refit)
window.addEventListener('resize', refit)
// la rotation n'est effective qu'APRÈS l'événement : un seul délai suffit, le CSS a déjà la bonne
// taille, on ne fait que demander à Phaser de la relire
window.addEventListener('orientationchange', () => setTimeout(refit, 300))
window.addEventListener('load', refit)
window.addEventListener('pageshow', refit) // reprise PWA / bfcache
refit()

// Crochet de débogage réservé au dev (retiré du build de production par tree-shaking sur
// import.meta.env.DEV) : permet à un harnais headless (scripts/leak-probe.mjs) de piloter le jeu.
if (import.meta.env.DEV && game) {
  const g = game
  void import('./state').then(({ setPlayer }) => import('./core/player-state').then(({ newPlayer }) => {
    ;(window as unknown as { __panda: unknown }).__panda = { game: g, setPlayer, newPlayer }
  }))
}

if (game) {
  const g = game
  g.events.once(Phaser.Core.Events.READY, refit)

  // ─── Watchdog anti-freeze ──────────────────────────────────────────────────
  // La boucle Phaser émet POST_STEP ('poststep') à chaque frame, tant qu'elle vit.
  // IMPORTANT : elle continue de « stepper » même quand une SCÈNE est en pause (menu,
  // PauseScene) — seul l'arrêt TOTAL de la boucle (RAF mort, exception dans le step) fige
  // le heartbeat. Un heartbeat figé = vrai gel, pas une simple pause : aucun flag pause
  // n'est donc nécessaire.
  // On surveille via setInterval (piloté par un timer, indépendant de requestAnimationFrame) :
  // il survit à une boucle RAF morte, ce qui lui permet justement de détecter et signaler le gel.
  let lastBeat = performance.now()
  let freezeReported = false
  g.events.on(Phaser.Core.Events.POST_STEP, () => {
    lastBeat = performance.now()
    // exposé pour l'émulateur headless : (performance.now() - __pandaBeat) > 3000 ⇒ gel
    ;(window as unknown as { __pandaBeat?: number }).__pandaBeat = lastBeat
    freezeReported = false // le heartbeat repart → on réarme l'alerte pour le prochain épisode
  })

  setInterval(() => {
    // Onglet en arrière-plan : RAF est throttlé par le navigateur → faux positif, on ignore.
    if (document.visibilityState !== 'visible') return
    const idle = performance.now() - lastBeat
    const active = g.scene.getScenes(true).map((s) => s.scene.key)
    // Pendant le CHARGEMENT (Boot/Preload), décoder des centaines d'assets sur mobile — surtout
    // pendant une ROTATION d'écran (iOS suspend le RAF le temps de la bascule) — peut bloquer le
    // thread principal plusieurs secondes SANS que le jeu soit réellement mort. On relâche donc le
    // seuil dans ces phases (sinon faux positif « Jeu figé » au lancement). Vrai gel encore attrapé (15 s).
    const loading = active.some((k) => k === 'Boot' || k === 'Preload')
    const threshold = loading ? 15000 : 3000
    if (idle > threshold && !freezeReported) {
      freezeReported = true // on n'émet qu'une fois par épisode de gel (pas de spam)
      const msg = `Boucle figée depuis ${Math.round(idle)}ms — dernière scène active : ${active.join(', ') || '(aucune)'}`
      logEvent('error', 'freeze', msg)
      showErrorOverlay('Jeu figé', msg)
    }
  }, 2000)
}
