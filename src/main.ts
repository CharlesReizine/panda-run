import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { TitleScene } from './scenes/TitleScene'
import { WorldMapScene } from './scenes/WorldMapScene'
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'
import { MenuScene } from './scenes/MenuScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  pixelArt: true,
  backgroundColor: '#87ceeb',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1200 } } },
  scene: [BootScene, PreloadScene, TitleScene, WorldMapScene, LevelScene, UIScene, MenuScene],
})
