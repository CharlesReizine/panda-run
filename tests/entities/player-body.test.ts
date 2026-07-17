import { describe, it, expect } from 'vitest'
import { PANDA_TEX, PANDA_BODY, bodyIsGrounded } from '../../src/entities/player-body'

describe('hitbox du panda', () => {
  it('est centrée horizontalement et pieds au sol', () => {
    expect(bodyIsGrounded(PANDA_TEX, PANDA_BODY)).toBe(true)
  })

  it('est plus petite que la texture (marge pour coiffe/ombrage)', () => {
    expect(PANDA_BODY.w).toBeLessThan(PANDA_TEX.w)
    expect(PANDA_BODY.h).toBeLessThan(PANDA_TEX.h)
  })

  it('rejette une hitbox décentrée ou flottante', () => {
    expect(bodyIsGrounded(PANDA_TEX, { w: 34, h: 62, offsetX: 0, offsetY: 24 })).toBe(false) // décentrée
    expect(bodyIsGrounded(PANDA_TEX, { w: 34, h: 20, offsetX: 15, offsetY: 24 })).toBe(false) // pieds trop hauts
  })
})
