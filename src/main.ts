import { registerSW } from 'virtual:pwa-register'
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'

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
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'
import { MenuScene } from './scenes/MenuScene'
import { ClassChangeScene } from './scenes/ClassChangeScene'
import { SkillEquipScene } from './scenes/SkillEquipScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  antialias: true,
  roundPixels: false,
  backgroundColor: '#87ceeb',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1200 } } },
  scene: [BootScene, PreloadScene, TitleScene, WorldMapScene, LevelScene, UIScene, MenuScene, ClassChangeScene, SkillEquipScene],
})

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
  game.scale.refresh()
}
game.events.once(Phaser.Core.Events.READY, fitViewport)
window.visualViewport?.addEventListener('resize', fitViewport)
window.visualViewport?.addEventListener('scroll', fitViewport)
window.addEventListener('resize', () => setTimeout(fitViewport, 150))
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300))
fitViewport()
