import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { TitleScene } from './scenes/TitleScene'
import { WorldMapScene } from './scenes/WorldMapScene'
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'
import { MenuScene } from './scenes/MenuScene'
import { ClassChangeScene } from './scenes/ClassChangeScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  pixelArt: true,
  backgroundColor: '#87ceeb',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1200 } } },
  scene: [BootScene, PreloadScene, TitleScene, WorldMapScene, LevelScene, UIScene, MenuScene, ClassChangeScene],
})

// iOS Safari : les barres d'outils/onglets rognent la zone visible et bougent après coup,
// ce qui coupait le bas du jeu (le perso) en paysage. window.visualViewport.height donne
// la hauteur RÉELLEMENT visible (hors barres), contrairement à innerHeight qui inclut
// parfois la zone sous les barres. On dimensionne le body dessus puis on recalcule le FIT.
function fitViewport() {
  const vh = window.visualViewport?.height ?? window.innerHeight
  const vw = window.visualViewport?.width ?? window.innerWidth
  document.body.style.height = `${vh}px`
  document.body.style.width = `${vw}px`
  game.scale.refresh()
}
window.visualViewport?.addEventListener('resize', fitViewport)
window.addEventListener('resize', () => setTimeout(fitViewport, 150))
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300))
fitViewport()
