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

// iOS Safari : les barres d'outils/onglets rognent le viewport et bougent après coup.
// innerHeight est la seule mesure fiable sur tous les iOS : on dimensionne le body
// dessus puis on recalcule le FIT, à chaque resize/rotation (avec un tick de retard,
// iOS met à jour innerHeight après l'événement).
function fitViewport() {
  document.body.style.height = `${window.innerHeight}px`
  game.scale.refresh()
}
window.addEventListener('resize', () => setTimeout(fitViewport, 150))
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300))
fitViewport()
