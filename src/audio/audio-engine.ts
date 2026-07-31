// Moteur audio maison, 100 % synthèse Web Audio (aucun fichier son externe).
// - Aucun effet de bord à l'import : l'AudioContext n'est créé qu'au premier usage réel
//   (guard `typeof AudioContext`), pour que le build et vitest (Node, sans Web Audio) tiennent.
// - Déblocage iOS/Safari : appeler unlock() sur un geste utilisateur pour (re)démarrer le contexte.

const MUTE_KEY = 'panda-run:muted'
const VOLUME_KEY = 'panda-run:volume'
// plafond de gain master historique (headroom) ; le volume utilisateur (0..1) le module
const BASE_MASTER = 0.9
// piste de fond unique (fichier), doux par défaut ; modulé par le volume utilisateur
const MUSIC_URL = `${import.meta.env.BASE_URL}audio/bgm.m4a`
const MUSIC_VOLUME = 0.35

export type SfxName =
  | 'jump' | 'attack' | 'hit' | 'enemy-death' | 'coin' | 'potion' | 'skill'
  | 'level-up' | 'player-hit' | 'player-death' | 'boss-victory' | 'ui-tap' | 'buy'
  | 'stomp' | 'player-burn' | 'elite' | 'npc-talk' | 'bubble' | 'coins' | 'splash'

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
  // musique de fond : élément média HTML (robuste iOS), une seule piste pour tout le jeu
  private music: HTMLAudioElement | null = null
  // Nœud qui injecte la piste média DANS le graphe Web Audio.
  //
  // ⚠️ C'EST LA CLÉ DU VOLUME SUR iOS. Safari iOS IGNORE `HTMLMediaElement.volume` : le régler par
  // programmation ne fait RIEN sur iPhone (c'est pourquoi le bouton muet, lui, met en PAUSE au lieu de
  // baisser le volume). L'atténuation sous l'eau ne s'entendait donc que sur ordinateur. Router
  // l'élément via createMediaElementSource → musicGain rend le volume pilotable partout, parce que
  // c'est alors un GainNode Web Audio qui décide, plus l'élément média.
  private musicSrc: MediaElementAudioSourceNode | null = null
  // filtre du bus musique : on en balaie la coupure pour l'effet « sous l'eau » (cf. setUnderwater)
  private musicFilter: BiquadFilterNode | null = null
  private musicWanted = false // playMusic a été demandé au moins une fois
  // Anti-doublon du clic d'interface. Deux sources peuvent le déclencher pour un même appui : le
  // crochet global (ui/click-sound.ts) et les appels explicites restés dans certaines scènes. Sans
  // ce garde-fou on entendrait un « tac-tac » sur ces boutons-là. Vaut aussi quand deux objets
  // interactifs se recouvrent.
  private lastUiTapAt = 0
  // Atténuation temporaire de la musique (sous l'eau). Multiplie le volume au lieu de le remplacer,
  // pour ne jamais écraser le réglage utilisateur.
  private duck = 1

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
      music.gain.value = MUSIC_VOLUME * this.volume // piloté ensuite par applyMusicLevel (ducking inclus)
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
      this.musicFilter = musicFilter
      this.sfxGain = sfx
      // la piste média a pu être créée AVANT le contexte (playMusic au tout premier écran) : on la
      // branche maintenant, sinon son volume resterait à la merci de l'élément — ignoré sur iOS.
      this.connectMusicGraph()
      return true
    } catch {
      return false
    }
  }

  /**
   * Baisse (ou rétablit) la musique de fond — utilisé sous l'eau.
   *
   * POURQUOI : les bulles restaient inaudibles même à gain relevé, parce qu'elles luttaient contre la
   * musique dans la même bande. Baisser la MUSIQUE fait ressortir l'ambiance bien mieux que monter
   * encore l'effet, qui finirait par saturer. Demande du user : « baisse le son quand je suis sous
   * l'eau et mets plus de bulles. »
   */
  setUnderwater(on: boolean) {
    // ⚠️ ON ÉTOUFFE LA MUSIQUE, ON NE LA COUPE PAS. Historique de ce réglage : 0,3 → 0,08 → 0,03 parce
    // que le user n'entendait « aucune différence »… alors que la vraie cause était qu'iOS ignore
    // `HTMLMediaElement.volume` (corrigé depuis via connectMusicGraph). À 0,03 le ducking marchait enfin,
    // mais trop bien : « j'entends pas ma musique quand je suis sous l'eau ».
    // Donc la différence ne se joue plus sur le seul volume : on BALAIE LE PASSE-BAS du bus musique de
    // 2800 Hz à 700 Hz. C'est ce qui fait « sous l'eau » (l'eau absorbe les aigus), et ça s'entend
    // franchement tout en laissant la mélodie audible — un simple gain très bas donnait du silence.
    // Réglage final, à l'oreille du user : 70 % du volume (« là on entend pas assez, ça fait un truc
    // bizarre » à 40 %). À 40 % + coupure à 420 Hz il restait trop peu de musique ET trop peu d'aigus :
    // ça ne sonnait plus étouffé, ça sonnait cassé. On remonte les deux ensemble.
    const target = on ? 0.7 : 1 // 70 % : réglé à l'oreille par le user, cf. l'historique ci-dessus
    if (this.duck === target) return
    this.duck = target
    this.applyMusicLevel()
    if (this.musicFilter && this.ctx) {
      this.musicFilter.frequency.setTargetAtTime(on ? 700 : 2800, this.ctx.currentTime, 0.12)
    }
  }

  // Branche la piste média sur le bus musique du graphe Web Audio. Idempotent, et sans effet si le
  // contexte n'existe pas encore (il naît au premier geste utilisateur) : on rappellera plus tard.
  private connectMusicGraph() {
    if (this.musicSrc || !this.ctx || !this.music || !this.musicGain) return
    try {
      this.musicSrc = this.ctx.createMediaElementSource(this.music)
      this.musicSrc.connect(this.musicGain)
      // une fois routé dans le graphe, c'est musicGain qui porte le volume : l'élément reste à 1
      this.music.volume = 1
      this.applyMusicLevel()
    } catch { /* déjà routé, ou média non éligible : on retombe sur le volume de l'élément */ }
  }

  // Niveau du bus musique = volume de référence × réglage utilisateur × atténuation (ducking).
  private applyMusicLevel() {
    const level = MUSIC_VOLUME * this.volume * this.duck
    if (this.musicGain && this.ctx) {
      // rampe courte : un saut de gain claque, et on veut que la baisse s'ENTENDE comme une immersion
      this.musicGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.1)
    }
    // Repli pour les navigateurs où le routage a échoué. Sans effet sur iOS (volume ignoré), ce qui
    // était précisément le bug.
    if (this.music && !this.musicSrc) this.music.volume = level
  }

  // à appeler sur un geste utilisateur (iOS/Safari bloquent le son sinon)
  unlock() {
    // reprend la musique de fond si elle est demandée (le 1er tap débloque la lecture média iOS)
    this.applyMusicState()
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
    this.applyMusicState() // muet → pause la piste de fond ; démute → la reprend
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
    this.applyMusicState() // répercute le volume utilisateur sur la piste de fond
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

  // SYLLABE DE VOIX : une dent de scie (riche en harmoniques, comme des cordes vocales) passée dans
  // un BANDPASS étroit qui joue le rôle de formant — c'est le formant, pas la fréquence, qui fait
  // « entendre » une voix. Un glissando de hauteur sur la syllabe donne l'intonation, sinon ça sonne
  // robot. Aucun mot : juste la prosodie.
  private syllable(at: number, dur: number, freq: number, freqEnd: number, formant: number, peak: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const bp = ctx.createBiquadFilter()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, at)
    osc.frequency.linearRampToValueAtTime(freqEnd, at + dur)
    bp.type = 'bandpass'
    bp.frequency.value = formant
    bp.Q.value = 6
    // attaque et chute douces : une syllabe qui claque ferait « tac tac » au lieu de « gna gna »
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.02)
    g.gain.setValueAtTime(peak, at + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(bp).connect(g).connect(this.sfxGain!)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  playSfx(name: SfxName) {
    if (this.muted) return
    if (!this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const t = this.ctx.currentTime
    if (name === 'ui-tap') {
      const now = this.ctx.currentTime * 1000
      if (now - this.lastUiTapAt < 60) return
      this.lastUiTapAt = now
    }
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
      // SAUT SUR LA TÊTE : un impact du POIDS du panda, pas un coup d'épée. Trois couches — un thud
      // grave qui plonge (le choc), un corps de bruit filtré bas (l'écrasement), et un petit tic aigu
      // pour que ça claque au lieu de faire « bloup ». Plus fort que 'hit' : c'est le seul retour que
      // le joueur a pour savoir qu'il a bien touché, et l'ancien passait sous la musique.
      case 'stomp':
        this.tone('triangle', 150, t, 0.16, 0.62, 55)
        this.noise(t, 0.13, 0.34, 'lowpass', 700)
        this.tone('square', 520, t, 0.045, 0.2, 240)
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
        // Renforcé (retour user : « quand je me prends des coups ça fait pas assez de bruit »). Un
        // impact SUBI doit dominer brièvement le mixage : c'est l'information la plus urgente du jeu.
        this.tone('sawtooth', 190, t, 0.2, 0.72, 70)
        this.noise(t, 0.16, 0.5, 'bandpass', 620)
        this.tone('square', 95, t, 0.14, 0.4, 60) // sous-grave : le « coup dans le ventre »
        break
      // DÉGÂTS CONTINUS SUBIS (flammes, lave, noyade) : un souffle court et sourd, volontairement
      // PLUS DISCRET que 'player-hit'. Il se répète plusieurs fois par seconde tant qu'on cuit — un
      // vrai bruit de coup à chaque tick ferait mitraillette et deviendrait insupportable.
      case 'player-burn':
        this.noise(t, 0.1, 0.2, 'bandpass', 1500)
        this.tone('sawtooth', 165, t, 0.09, 0.2, 95)
        break
      // RENCONTRE D'UN ÉLITE : court motif « épique » — montée grave (la menace qui arrive), quinte
      // par-dessus (le côté solennel), puis une cloche claire. Volontairement bref : il se déclenche
      // en pleine action, pas sur un écran d'intro.
      case 'elite':
        this.tone('triangle', 82, t, 0.55, 0.5, 164)
        this.tone('triangle', 123, t + 0.06, 0.5, 0.34, 246)
        this.tone('sine', 880, t + 0.16, 0.6, 0.28, 660)
        this.noise(t, 0.3, 0.14, 'lowpass', 400)
        break
      // PNJ QUI PARLE : 4 à 5 syllabes de formant, façon « gnagnagna » — aucune langue, juste une
      // voix d'homme et une intonation. Les hauteurs descendent globalement (fin de phrase) avec des
      // variations par syllabe, sinon on entend une sirène plutôt que quelqu'un qui cause.
      case 'npc-talk': {
        const base = 118 // voix masculine (~fondamentale grave)
        const pattern = [1, 0.86, 1.08, 0.8, 0.92]
        const n = 4 + (Math.random() < 0.5 ? 0 : 1) // longueur variable : deux PNJ ne débitent pas pareil
        for (let i = 0; i < n; i++) {
          const f = base * pattern[i % pattern.length]!
          this.syllable(t + i * 0.115, 0.1, f, f * 0.9, 620 + (i % 2) * 260, 0.34)
        }
        break
      }
      // BULLE (« bloub ») : une sinusoide qui MONTE vite en frequence — c'est la montee qui fait
      // entendre une bulle qui creve, un son a hauteur fixe ferait « bip ». Tres court et discret :
      // il est rejoue en boucle tant qu'on nage.
      // PLOUF : entrée dans l'eau. Un volume d'eau déplacé, donc du BRUIT filtré bas (le « ffff »)
      // plus une tonalité qui PLONGE (l'impact qui s'enfonce). Le joueur l'a demandé aussi comme
      // vérification : s'il l'entend, la détection d'entrée dans l'eau est bonne.
      case 'splash':
        this.noise(t, 0.26, 0.55, 'lowpass', 1100)
        this.tone('sine', 420, t, 0.2, 0.4, 120)
        this.noise(t + 0.04, 0.14, 0.22, 'bandpass', 2600) // les éclaboussures, plus aiguës
        break
      case 'bubble':
        // « BLOP » : UNE bulle qui crève, pas deux. La montée rapide de hauteur fait tout le travail —
        // c'est elle qu'on entend comme une bulle ; un son à hauteur fixe ferait « bip ». La version
        // précédente empilait deux tons et un souffle, ce qui donnait un « bloub-bloub » brouillon là où
        // le joueur demande un « blop » net espacé d'une demi-seconde.
        this.tone('sine', 200, t, 0.12, 0.6, 760)
        this.noise(t + 0.075, 0.035, 0.09, 'highpass', 2600) // le petit « tsss » de la surface qui cède
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
      // PIÈCES qui s'entrechoquent (achat / vente chez un marchand). 'buy' et 'coin' n'étaient que
      // deux bips montants — ça sonnait « validation », pas « monnaie ». Plusieurs petits chocs
      // métalliques aigus, aux hauteurs et aux instants VOLONTAIREMENT irréguliers : des pièces
      // parfaitement régulières sonneraient comme un arpège, pas comme une poignée de piécettes.
      case 'coins': {
        const pitches = [1180, 1560, 1320, 1720, 1440]
        const n = 4 + (Math.random() < 0.5 ? 0 : 1)
        for (let i = 0; i < n; i++) {
          const at = t + i * 0.045 + Math.random() * 0.02
          this.tone('square', pitches[i % pitches.length]! * (0.94 + Math.random() * 0.12), at, 0.07, 0.26)
          this.noise(at, 0.035, 0.1, 'highpass', 4200) // le « tsss » du métal
        }
        break
      }
    }
  }

  // ---- Musique -------------------------------------------------------------

  playMusic(_track: MusicTrack) {
    // Musique synthétisée remplacée par une vraie piste instrumentale (fichier audio), jouée en
    // boucle. Une seule piste pour tout le jeu : le paramètre `track`/biome est ignoré pour l'instant.
    // La lecture média n'aboutit qu'après un geste utilisateur (iOS/Safari) : unlock() la relancera.
    this.musicWanted = true
    this.applyMusicState()
  }

  stopMusic() {
    // ancien séquenceur synthé (plus alimenté) : on garde l'arrêt propre par sécurité
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
    this.currentTrack = null
    this.musicWanted = false
    if (this.music) this.music.pause()
  }

  // crée (au besoin) l'élément média et aligne son état sur muet / volume / demande de lecture.
  // Robuste : pas d'`Audio` en Node (vitest), fichier absent ou lecture bloquée ne plantent pas.
  private applyMusicState() {
    if (typeof Audio === 'undefined') return // environnement sans média (Node/vitest)
    try {
      if (!this.music && this.musicWanted) {
        const el = new Audio(MUSIC_URL)
        el.loop = true
        el.preload = 'auto'
        this.music = el
      }
      if (!this.music) return
      this.connectMusicGraph()
      this.applyMusicLevel()
      if (this.muted || !this.musicWanted) {
        this.music.pause()
      } else {
        // play() renvoie une promesse rejetée tant qu'aucun geste utilisateur n'a eu lieu : on ignore
        void this.music.play().catch(() => { /* lecture différée jusqu'au prochain unlock() */ })
      }
    } catch { /* fichier introuvable / média indisponible : le jeu continue sans musique de fond */ }
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
