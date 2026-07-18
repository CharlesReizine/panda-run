import { describe, it, expect, beforeEach } from 'vitest'
import { logEvent, logError, getLogs, clearLogs } from '../../src/core/logger'

// En environnement node (vitest par défaut), localStorage est absent : le module ne doit
// pas planter — c'est justement ce que ces tests vérifient implicitement.
describe('logger', () => {
  beforeEach(() => clearLogs())

  it('getLogs renvoie les entrées dans l\'ordre d\'insertion', () => {
    logEvent('info', 'a', 'un', undefined, 1)
    logEvent('warn', 'b', 'deux', undefined, 2)
    logEvent('error', 'c', 'trois', undefined, 3)
    expect(getLogs().map((e) => e.msg)).toEqual(['un', 'deux', 'trois'])
    expect(getLogs().map((e) => e.t)).toEqual([1, 2, 3])
  })

  it('le ring buffer plafonne à 100 (le 101e éjecte le plus vieux)', () => {
    for (let i = 0; i < 101; i++) logEvent('info', 'ring', `msg-${i}`, undefined, i)
    const logs = getLogs()
    expect(logs).toHaveLength(100)
    expect(logs[0]!.msg).toBe('msg-1') // msg-0 a été éjecté
    expect(logs[99]!.msg).toBe('msg-100')
  })

  it('clearLogs vide le buffer', () => {
    logEvent('info', 'a', 'un', undefined, 1)
    expect(getLogs()).toHaveLength(1)
    clearLogs()
    expect(getLogs()).toHaveLength(0)
  })

  it('logError extrait message + stack d\'une Error', () => {
    const err = new Error('boum')
    logError('window', err, 42)
    const e = getLogs()[0]!
    expect(e.level).toBe('error')
    expect(e.tag).toBe('window')
    expect(e.msg).toBe('boum')
    expect(e.stack).toBe(err.stack)
    expect(e.t).toBe(42)
  })

  it('logError gère une valeur non-Error (sans stack)', () => {
    logError('promise', 'rejet brut', 7)
    const e = getLogs()[0]!
    expect(e.msg).toBe('rejet brut')
    expect(e.stack).toBeUndefined()
  })

  it('getLogs renvoie une copie (immuable de l\'extérieur)', () => {
    logEvent('info', 'a', 'un', undefined, 1)
    getLogs().push({ t: 9, level: 'info', tag: 'x', msg: 'injecté' })
    expect(getLogs()).toHaveLength(1)
  })
})
