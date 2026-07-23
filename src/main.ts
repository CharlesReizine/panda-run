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
import { TrainingScene } from './scenes/TrainingScene'
import { GRAVITY } from './core/platforming'

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
    width: 960,
    height: 540,
    antialias: true,
    roundPixels: false,
    backgroundColor: '#87ceeb',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY } } },
    // on gère TOUT l'audio via notre moteur Web Audio (src/audio) → on désactive le gestionnaire
    // de son de Phaser, qui créait un 2e AudioContext (échec « failed to start audio device » sur iOS)
    audio: { noAudio: true },
    scene: [BootScene, PreloadScene, TitleScene, WorldMapScene, LevelIntroScene, TownScene, LevelScene, UIScene, PauseScene, MenuScene, InventoryScene, ClassChangeScene, SkillEquipScene, BestiaryScene, TrainingScene],
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
}

// On dimensionne le conteneur #game EXACTEMENT sur la zone visible (visualViewport, qui
// exclut les barres Safari et suit l'encoche en paysage), et on le positionne à son
// offset. Phaser (Scale.FIT) rentre alors toujours dans du visible → jamais coupé.
function fitViewport() {
  const vv = window.visualViewport
  const w = Math.round(vv?.width ?? window.innerWidth)
  const h = Math.round(vv?.height ?? window.innerHeight)
  const el = document.getElementById('game')
  if (el) {
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.left = `${Math.round(vv?.offsetLeft ?? 0)}px`
    el.style.top = `${Math.round(vv?.offsetTop ?? 0)}px`
  }
  game?.scale.refresh()
}
// Crochet de débogage réservé au dev (retiré du build de production par tree-shaking sur
// import.meta.env.DEV) : permet à un harnais headless de piloter le jeu.
if (import.meta.env.DEV && game) {
  const g = game
  void import('./state').then(({ setPlayer }) => import('./core/player-state').then(({ newPlayer }) => {
    ;(window as unknown as { __panda: unknown }).__panda = { game: g, setPlayer, newPlayer }
  }))
}

window.visualViewport?.addEventListener('resize', fitViewport)
window.visualViewport?.addEventListener('scroll', fitViewport)
window.addEventListener('resize', () => setTimeout(fitViewport, 150))
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300))
fitViewport()

if (game) {
  const g = game
  g.events.once(Phaser.Core.Events.READY, fitViewport)

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
    if (idle > 3000 && !freezeReported) {
      freezeReported = true // on n'émet qu'une fois par épisode de gel (pas de spam)
      const active = g.scene.getScenes(true).map((s) => s.scene.key).join(', ') || '(aucune)'
      const msg = `Boucle figée depuis ${Math.round(idle)}ms — dernière scène active : ${active}`
      logEvent('error', 'freeze', msg)
      showErrorOverlay('Jeu figé', msg)
    }
  }, 2000)
}
