import { describe, it, expect } from 'vitest'
import { audio } from '../../src/audio/audio-engine'

// Web Audio est absent en Node : setVolume/getVolume restent pilotables (pas de gain à appliquer),
// on vérifie ici le contrat de bornage 0..1 sans toucher au son.
describe('audio volume', () => {
  it('borne les valeurs entre 0 et 1', () => {
    audio.setVolume(0.5)
    expect(audio.getVolume()).toBe(0.5)
    audio.setVolume(2)
    expect(audio.getVolume()).toBe(1)
    audio.setVolume(-1)
    expect(audio.getVolume()).toBe(0)
  })
})
