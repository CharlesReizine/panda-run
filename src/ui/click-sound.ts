// Clic sonore GLOBAL pour les écrans d'interface.
//
// POURQUOI UN CROCHET ET PAS UN playSfx PAR BOUTON. Le jeu compte 64 gestionnaires `pointerdown`
// répartis dans les scènes, dont 13 seulement jouaient un son — TownScene en avait 22, tous muets.
// Annoter chaque bouton à la main aurait « réparé » l'existant en laissant le prochain bouton créé
// silencieux, et il faudrait y repenser à chaque ajout. On écoute donc l'évènement de scène
// `gameobjectdown` : Phaser l'émet pour TOUT objet interactif pressé, donc chaque bouton — présent
// comme futur — sonne sans rien avoir à déclarer.
//
// ⚠️ À NE PAS INSTALLER SUR LevelScene / UIScene : leurs objets interactifs sont les commandes de JEU
// (saut, attaque, joystick). Un clic d'interface à chaque coup d'épée serait insupportable. Ces deux
// scènes gardent leurs quelques appels explicites sur leurs vrais boutons de menu.
//
// Le doublon avec un appel explicite resté dans une scène est absorbé en amont : l'AudioEngine ignore
// un 'ui-tap' survenant moins de 60 ms après le précédent.

import { audio } from '../audio/audio-engine'

export function installUiClickSound(scene: Phaser.Scene): void {
  scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, () => {
    audio.unlock() // iOS : le contexte audio ne démarre que sur un geste — un clic en est un
    audio.playSfx('ui-tap')
  })
}
