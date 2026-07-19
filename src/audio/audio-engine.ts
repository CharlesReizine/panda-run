// Moteur audio maison, 100 % synthèse Web Audio (aucun fichier son externe).
// - Aucun effet de bord à l'import : l'AudioContext n'est créé qu'au premier usage réel
//   (guard `typeof AudioContext`), pour que le build et vitest (Node, sans Web Audio) tiennent.
// - Déblocage iOS/Safari : appeler unlock() sur un geste utilisateur pour (re)démarrer le contexte.

const MUTE_KEY = 'panda-run:muted'
const VOLUME_KEY = 'panda-run:volume'
// plafond de gain master historique (headroom) ; le volume utilisateur (0..1) le module
const BASE_MASTER = 0.9

export type SfxName =
  | 'jump' | 'attack' | 'hit' | 'enemy-death' | 'coin' | 'potion' | 'skill'
  | 'level-up' | 'player-hit' | 'player-death' | 'boss-victory' | 'ui-tap' | 'buy'

export type MusicTrack =
  | 'titre' | 'ville' | 'carte' | 'plaine' | 'foret' | 'desert' | 'cave'
  | 'jungle' | 'montagne' | 'plage' | 'cimetiere' | 'enfer' | 'boss'

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine'
// la musique n'emploie que des ondes rondes (douces) : triangle et sine
type MusicWave = 'triangle' | 'sine'

// note MIDI → fréquence (Hz) ; 0 réservé au silence dans les séquences
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface TrackDef {
  stepMs: number // durée d'un pas en ms (tempo posé : voir valeurs par biome)
  wave: MusicWave
  melody: number[] // notes MIDI (0 = silence), phrases aérées avec respirations
  bass: number[] // notes MIDI (0 = silence), discrète, jouée en notes tenues
  gain: number
}

// boucles douces et mélodiques, une par ambiance ; en gammes majeures/pentatoniques pour
// une écoute longue non fatigante. Le séquenceur reboucle sur la longueur de melody.
// Volumes doux (voir musicGain + filtre passe-bas du bus musique).
const A = 0 // silence lisible dans les tableaux
const TRACKS: Record<MusicTrack, TrackDef> = {
  titre: { stepMs: 300, wave: 'triangle', gain: 0.85,
    melody: [72, A, 76, A, 79, A, 76, 74, 72, A, 74, A, 67, A, 69, A],
    bass: [48, A, A, A, 55, A, A, A, 53, A, A, A, 55, A, A, A] },
  ville: { stepMs: 300, wave: 'triangle', gain: 0.82,
    melody: [67, A, 72, A, 74, A, 72, A, 76, A, 74, 72, 69, A, 67, A],
    bass: [48, A, A, A, 52, A, A, A, 53, A, A, A, 55, A, A, A] },
  carte: { stepMs: 320, wave: 'triangle', gain: 0.8,
    melody: [69, A, 72, A, 74, A, 76, A, 72, A, 69, A, 67, A, 69, A],
    bass: [45, A, A, A, 52, A, A, A, 50, A, A, A, 52, A, A, A] },
  plaine: { stepMs: 300, wave: 'triangle', gain: 0.8,
    melody: [72, A, 74, 76, A, 79, A, 76, 74, A, 72, A, 69, A, 72, A],
    bass: [48, A, A, A, 55, A, A, A, 53, A, A, A, 50, A, A, A] },
  foret: { stepMs: 320, wave: 'triangle', gain: 0.78,
    melody: [64, A, 67, A, 69, A, 72, A, 69, 67, A, 64, A, 62, A, 64, A],
    bass: [45, A, A, A, 52, A, A, A, 50, A, A, A, 48, A, A, A] },
  desert: { stepMs: 340, wave: 'sine', gain: 0.76,
    melody: [69, A, 72, A, 74, A, 72, A, 67, A, 69, A, 64, A, A, A],
    bass: [45, A, A, A, 50, A, A, A, 45, A, A, A, 48, A, A, A] },
  cave: { stepMs: 380, wave: 'sine', gain: 0.72,
    melody: [60, A, A, A, 63, A, A, A, 62, A, A, A, 60, A, A, A],
    bass: [36, A, A, A, A, A, A, A, 41, A, A, A, A, A, A, A] },
  jungle: { stepMs: 300, wave: 'triangle', gain: 0.78,
    melody: [64, A, 67, A, 71, A, 69, 67, 64, A, 67, A, 62, A, 64, A],
    bass: [40, A, A, A, 47, A, A, A, 45, A, A, A, 47, A, A, A] },
  montagne: { stepMs: 340, wave: 'triangle', gain: 0.8,
    melody: [67, A, 72, A, 74, A, 72, A, 69, A, 67, A, 62, A, 67, A],
    bass: [43, A, A, A, 50, A, A, A, 48, A, A, A, 50, A, A, A] },
  plage: { stepMs: 300, wave: 'triangle', gain: 0.78,
    melody: [76, A, 74, A, 72, A, 74, A, 76, A, 79, A, 76, 74, 72, A],
    bass: [48, A, A, A, 55, A, A, A, 53, A, A, A, 50, A, A, A] },
  cimetiere: { stepMs: 380, wave: 'sine', gain: 0.7,
    melody: [57, A, A, A, 60, A, A, A, 59, A, A, A, 56, A, A, A],
    bass: [33, A, A, A, A, A, A, A, 39, A, A, A, A, A, A, A] },
  enfer: { stepMs: 300, wave: 'triangle', gain: 0.72,
    melody: [55, A, 58, A, 60, A, 58, A, 55, A, 53, A, 55, A, A, A],
    bass: [31, A, A, A, 34, A, A, A, 31, A, A, A, 30, A, A, A] },
  boss: { stepMs: 280, wave: 'triangle', gain: 0.75,
    melody: [62, A, 65, A, 69, A, 67, 65, 62, A, 65, A, 60, A, 62, A],
    bass: [38, A, 45, A, 43, A, 45, A, 38, A, 45, A, 41, A, 45, A] },
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private volume = 1 // volume utilisateur 0..1, appliqué en plus du BASE_MASTER
  private currentTrack: MusicTrack | null = null
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private nextStepTime = 0

  constructor() {
    // lecture de l'état muet — sans effet de bord audio (localStorage seulement)
    try {
      if (typeof localStorage !== 'undefined') {
        this.muted = localStorage.getItem(MUTE_KEY) === '1'
        const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '')
        if (Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v))
      }
    } catch { /* localStorage inaccessible (mode privé) : on reste non-muet */ }
  }

  // gain effectif du bus master : 0 si muet, sinon headroom × volume utilisateur
  private masterLevel() { return this.muted ? 0 : BASE_MASTER * this.volume }

  // crée l'AudioContext au premier vrai usage ; renvoie false si Web Audio indisponible (Node)
  private ensure(): boolean {
    if (this.ctx) return true
    const Ctor: typeof AudioContext | undefined =
      typeof AudioContext !== 'undefined' ? AudioContext
      : typeof (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined'
        ? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!Ctor) return false
    // toute défaillance Web Audio (matériel indispo, « failed to start audio device » iOS, quota
    // de contextes) NE DOIT jamais planter le jeu : on échoue silencieusement et le jeu reste muet
    try {
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = this.masterLevel()
      master.connect(ctx.destination)
      const music = ctx.createGain()
      music.gain.value = 0.18 // musique volontairement sous les SFX
      // filtre passe-bas doux sur tout le bus musique : arrondit le timbre, retire la dureté aiguë
      const musicFilter = ctx.createBiquadFilter()
      musicFilter.type = 'lowpass'
      musicFilter.frequency.value = 2800
      musicFilter.Q.value = 0.7
      music.connect(musicFilter).connect(master)
      const sfx = ctx.createGain()
      sfx.gain.value = 0.5
      sfx.connect(master)
      this.ctx = ctx
      this.master = master
      this.musicGain = music
      this.sfxGain = sfx
      return true
    } catch {
      return false
    }
  }

  // à appeler sur un geste utilisateur (iOS/Safari bloquent le son sinon)
  unlock() {
    if (!this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  resume() { this.unlock() }

  isMuted() { return this.muted }

  setMuted(muted: boolean) {
    this.muted = muted
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch { /* ignore */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.02)
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  getVolume() { return this.volume }

  // règle le volume master (0..1), persiste et applique en douceur au gain master
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v))
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_KEY, String(this.volume))
    } catch { /* ignore */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.02)
    }
  }

  // ---- SFX -----------------------------------------------------------------

  private getNoise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf
    return buf
  }

  // oscillateur + enveloppe de gain rapide (attaque quasi nulle, decay exponentiel)
  private tone(wave: Wave, freq: number, at: number, dur: number, peak: number, freqEnd?: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(Math.max(1, freq), at)
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), at + dur)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g).connect(this.sfxGain!)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  // bruit blanc filtré (impacts, souffles)
  private noise(at: number, dur: number, peak: number, filterType: BiquadFilterType, cutoff: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.getNoise()
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(filter).connect(g).connect(this.sfxGain!)
    src.start(at)
    src.stop(at + dur + 0.02)
  }

  playSfx(name: SfxName) {
    if (this.muted) return
    if (!this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const t = this.ctx.currentTime
    switch (name) {
      case 'jump':
        this.tone('square', 320, t, 0.16, 0.5, 640)
        break
      case 'attack':
        this.tone('square', 220, t, 0.09, 0.45, 120)
        this.noise(t, 0.07, 0.18, 'highpass', 1800)
        break
      case 'hit':
        this.tone('square', 180, t, 0.08, 0.4, 90)
        this.noise(t, 0.09, 0.25, 'bandpass', 1200)
        break
      case 'enemy-death':
        this.tone('square', 400, t, 0.28, 0.4, 70)
        this.noise(t, 0.18, 0.2, 'lowpass', 900)
        break
      case 'coin':
        this.tone('square', 988, t, 0.07, 0.4)
        this.tone('square', 1319, t + 0.07, 0.14, 0.4)
        break
      case 'potion':
        this.tone('triangle', 523, t, 0.1, 0.4, 784)
        this.tone('triangle', 784, t + 0.1, 0.18, 0.35, 1047)
        break
      case 'skill':
        this.tone('sawtooth', 300, t, 0.22, 0.35, 1200)
        this.tone('square', 600, t, 0.18, 0.25, 1500)
        break
      case 'level-up':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, t + i * 0.09, 0.16, 0.4))
        break
      case 'player-hit':
        this.tone('sawtooth', 200, t, 0.16, 0.4, 80)
        this.noise(t, 0.12, 0.3, 'bandpass', 700)
        break
      case 'player-death':
        this.tone('sawtooth', 300, t, 0.7, 0.45, 55)
        this.noise(t, 0.4, 0.25, 'lowpass', 500)
        break
      case 'boss-victory':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, t + i * 0.12, 0.24, 0.4))
        this.tone('triangle', 1568, t + 0.6, 0.5, 0.35)
        break
      case 'ui-tap':
        this.tone('square', 660, t, 0.05, 0.3, 880)
        break
      case 'buy':
        this.tone('square', 784, t, 0.08, 0.4)
        this.tone('square', 1047, t + 0.08, 0.14, 0.4)
        break
    }
  }

  // ---- Musique -------------------------------------------------------------

  playMusic(track: MusicTrack) {
    // Musique synthétisée DÉSACTIVÉE : elle sonnait « synthé » et déplaisait. En attente d'une vraie
    // piste instrumentale (fichier audio) qui la remplacera ici. Les bruitages (SFX) restent actifs.
    return
    if (!this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.currentTrack === track && this.schedulerTimer !== null) return
    this.stopMusic()
    this.currentTrack = track
    this.step = 0
    this.nextStepTime = this.ctx.currentTime + 0.1
    this.schedulerTimer = setInterval(() => this.scheduleAhead(), 25)
  }

  stopMusic() {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
    this.currentTrack = null
  }

  // séquenceur à horizon glissant : planifie les pas à venir en avance de phase
  private scheduleAhead() {
    if (!this.ctx || !this.currentTrack) return
    // contexte suspendu (avant déblocage) : on ne planifie rien et on garde la phase alignée
    if (this.ctx.state !== 'running') {
      this.nextStepTime = this.ctx.currentTime + 0.1
      return
    }
    const def = TRACKS[this.currentTrack]
    const horizon = this.ctx.currentTime + 0.12
    const stepDur = def.stepMs / 1000
    while (this.nextStepTime < horizon) {
      const i = this.step % def.melody.length
      const mel = def.melody[i] ?? A
      if (mel > 0) this.melodyTone(def.wave, midiToFreq(mel), this.nextStepTime, stepDur, def.gain)
      const bassNote = def.bass[i % def.bass.length] ?? A
      if (bassNote > 0) this.melodyTone('triangle', midiToFreq(bassNote), this.nextStepTime, stepDur * 1.6, def.gain * 0.8)
      this.step++
      this.nextStepTime += stepDur
    }
  }

  // note mélodique : enveloppe douce (attaque progressive + release long, aucune coupure sèche),
  // routée sur le bus musique. Supprime clics et dureté d'attaque.
  private melodyTone(wave: MusicWave, freq: number, at: number, dur: number, peak: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, at)
    const attack = 0.02 // ~20 ms de montée douce
    const release = 0.09 // ~90 ms de descente progressive
    const body = Math.max(0.04, dur - release) // fin du maintien avant le release
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + attack)
    g.gain.setValueAtTime(peak, at + body)
    g.gain.exponentialRampToValueAtTime(0.0001, at + body + release)
    osc.connect(g).connect(this.musicGain!)
    osc.start(at)
    osc.stop(at + body + release + 0.02)
  }
}

// singleton — aucune instanciation d'AudioContext ici (ensure() différé)
export const audio = new AudioEngine()
