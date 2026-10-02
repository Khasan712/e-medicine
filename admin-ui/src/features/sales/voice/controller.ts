/*
 * Voice order entry — the recording session (ported from the old dashboard sales.js, `salesPos`):
 *  - Gemini Live (`voice.live`): an AudioWorklet streams 16 kHz PCM16 in 100 ms chunks over a WebSocket for live
 *    captions; audio is captured from the first moment and buffered until `setupComplete`.
 *  - The full recording (MediaRecorder, `voice.gemini`) is authoritative: it is sent to /voice/parse, the live text
 *    is only a fallback. Stopping keeps recording 350 ms more (the last word is not cut) and flushes the PCM buffer.
 *  - Without Gemini the browser's Web Speech API gives the text (demo mode).
 * The session lives outside React state: it holds audio nodes and sockets, and identity checks must stay exact.
 */
import type { VoiceToken } from '../../../api/types'
import type { DictKey } from '../../../i18n/dict'
import type { Snapshot } from '../voiceResult'
import { microphoneErrorKey, speechErrorKey } from '../voiceResult'
import { pickMimeType, sleep } from './audio'
import { BrowserCaptions } from './browserCaptions'
import { LiveCaptions } from './liveCaptions'
import { flushPcm, startPcm, stopPcm, type PcmSession } from './pcm'

export const MAX_RECORDING_MS = 90_000
/** Keep recording briefly after "stop" so the last word is not cut off. */
export const TAIL_MS = 350
export const BAR_COUNT = 32
const MIN_DURATION_MS = 700

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'processing'
export type VoiceEngine = '' | 'live' | 'record' | 'browser'

export interface VoiceUiPatch {
  state?: 'idle' | 'starting' | 'listening' | 'processing' | 'done'
  engine?: VoiceEngine
  caption?: string
  transcript?: string
  reply?: string
  unmatched?: string[]
  error?: string
  seconds?: number
  submit?: boolean
}

export interface UnderstandInput {
  text?: string
  audio?: Blob
  liveText?: string
}

export interface VoiceControllerDeps {
  config: () => { gemini: boolean; live: boolean; lang: 'uz' | 'ru' }
  update: (patch: VoiceUiPatch) => void
  message: (key: DictKey) => string
  snapshot: () => Snapshot
  /** Sends text or the recording to /voice/parse and applies the result. */
  understand: (input: UnderstandInput, before: Snapshot) => Promise<void>
  fetchToken: () => Promise<VoiceToken>
  /** Waveform bars and the element that receives `--voice-level` (0…1). */
  bars: () => HTMLElement[]
  levelTarget: () => HTMLElement | null
}

/** The engine shown on the card: what the current session uses (Live can fall back to recording) or will use. */
export function displayEngine(current: VoiceEngine, voice: { gemini: boolean; live: boolean }): VoiceEngine {
  if (current === 'record') return 'record'
  if (voice.live) return 'live'
  if (voice.gemini) return 'record'
  return BrowserCaptions.supported() ? 'browser' : ''
}

interface Session extends PcmSession {
  stream: MediaStream
  analyser: AnalyserNode
  recorder: MediaRecorder | null
  chunks: Blob[]
  live: LiveCaptions | null
  browser: BrowserCaptions | null
  startedAt: number
  timer?: ReturnType<typeof setInterval>
  frame?: number
}

export class VoiceController {
  phase: VoicePhase = 'idle'
  private active: Session | null = null
  private before: Snapshot | null = null
  private disposed = false
  private readonly deps: VoiceControllerDeps

  constructor(deps: VoiceControllerDeps) {
    this.deps = deps
  }

  /** Space / the mic button. */
  toggle() {
    if (this.phase === 'listening') void this.stop()
    else if (this.phase === 'idle') void this.start()
  }

  async sendText(text: string) {
    const value = text.trim()
    if (!value || this.phase !== 'idle') return
    const before = this.deps.snapshot()
    this.phase = 'processing'
    this.deps.update({ state: 'processing', caption: value, error: '', reply: '', unmatched: [], submit: false })
    try {
      await this.deps.understand({ text: value }, before)
    } finally {
      this.phase = 'idle'
    }
  }

  async start() {
    if (this.phase !== 'idle') return
    const { gemini, live } = this.deps.config()
    const t = this.deps.message
    if (!navigator.mediaDevices?.getUserMedia) {
      this.deps.update({ error: t(window.isSecureContext === false ? 'voice_insecure' : 'voice_no_mic') })
      return
    }
    if (!gemini && !BrowserCaptions.supported()) {
      this.deps.update({ error: t('voice_no_engine') })
      return
    }

    this.before = this.deps.snapshot()
    this.phase = 'starting'
    this.deps.update({
      state: 'starting',
      engine: '',
      caption: '',
      transcript: '',
      reply: '',
      unmatched: [],
      error: '',
      seconds: 0,
      submit: false,
    })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (error) {
      this.phase = 'idle'
      this.deps.update({ state: 'idle', error: t(microphoneErrorKey(error)) })
      return
    }
    if (this.disposed) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextClass()
    if (context.state === 'suspended') await context.resume().catch(() => {})
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)

    const session: Session = {
      stream,
      context,
      source,
      analyser,
      recorder: null,
      chunks: [],
      live: null,
      browser: null,
      startedAt: 0,
    }
    this.active = session

    if (gemini && typeof MediaRecorder !== 'undefined') {
      try {
        const mimeType = pickMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recorder.ondataavailable = (event) => {
          if (event.data.size) session.chunks.push(event.data)
        }
        recorder.start(250)
        session.recorder = recorder
      } catch {
        session.recorder = null // live captions can still work without a recording
      }
    }

    const onText = (text: string) => {
      if (this.active === session) this.deps.update({ caption: text })
    }
    const useLive = live && typeof AudioWorkletNode !== 'undefined'
    if (useLive) {
      // Capture starts before "listening" is shown; audio is queued until Live is connected.
      session.live = new LiveCaptions(onText)
      try {
        await startPcm(session, (chunk) => session.live?.push(chunk))
      } catch {
        session.live = null
      }
    }

    session.startedAt = Date.now()
    this.phase = 'listening'
    this.deps.update({ state: 'listening' })
    this.meter(session)
    let lastSecond = 0
    session.timer = setInterval(() => {
      const elapsed = Date.now() - session.startedAt
      const seconds = Math.floor(elapsed / 1000)
      if (seconds !== lastSecond) {
        lastSecond = seconds
        this.deps.update({ seconds })
      }
      if (elapsed > MAX_RECORDING_MS) void this.stop()
    }, 250)

    if (useLive) {
      this.deps.update({ engine: 'live' })
      void this.connectLive(session)
    } else if (gemini) {
      this.deps.update({ engine: 'record' })
    } else {
      this.deps.update({ engine: 'browser' })
      try {
        session.browser = new BrowserCaptions({
          onText,
          lang: this.deps.config().lang,
          onFatal: (code) => {
            if (this.active === session) void this.stop(true, code)
          },
        })
        session.browser.start()
      } catch {
        void this.stop(true, 'network')
      }
    }
  }

  private async connectLive(session: Session) {
    const live = session.live
    if (!live) {
      if (this.active === session) this.deps.update({ engine: 'record' })
      return
    }
    try {
      const token = await this.deps.fetchToken()
      await live.connect(token)
    } catch (error) {
      console.warn('Live captions unavailable; the recording is transcribed after you stop:', error)
      live.failed = true
      if (session.live === live) session.live = null
      if (this.active === session) this.deps.update({ engine: 'record' })
      live.abort()
    }
  }

  private meter(session: Session) {
    const data = new Uint8Array(session.analyser.frequencyBinCount)
    const bars = this.deps.bars()
    const target = this.deps.levelTarget()
    const middle = (bars.length - 1) / 2
    const draw = () => {
      if (this.active !== session || this.phase !== 'listening') {
        bars.forEach((bar) => {
          bar.style.transform = 'scaleY(0.12)'
        })
        return
      }
      session.analyser.getByteFrequencyData(data)
      let peak = 0
      bars.forEach((bar, index) => {
        // Symmetric wave: low (speech-heavy) frequencies in the middle, higher ones towards the edges.
        const value = data[Math.min(data.length - 1, 1 + Math.round(Math.abs(index - middle)))] / 255
        peak = Math.max(peak, value)
        bar.style.transform = `scaleY(${Math.max(0.12, Math.min(1, value * 1.35))})`
      })
      target?.style.setProperty('--voice-level', peak.toFixed(2))
      session.frame = requestAnimationFrame(draw)
    }
    draw()
  }

  /** Stop (understand what was said), cancel (`cancel`, Esc) or fail with a speech error code. */
  async stop(cancel = false, failure: string | null = null) {
    const session = this.active
    if (!session || this.phase !== 'listening') return
    const t = this.deps.message
    const duration = Date.now() - session.startedAt
    const aborted = cancel || !!failure
    this.phase = aborted ? 'idle' : 'processing'
    this.deps.update({ state: aborted ? 'idle' : 'processing' })
    clearInterval(session.timer)
    if (session.frame) cancelAnimationFrame(session.frame)

    // People press stop right after the last word: keep listening a moment so it is not cut off.
    if (!aborted) await sleep(TAIL_MS)
    await flushPcm(session)

    const stopRecorder = () =>
      new Promise<Blob | null>((resolve) => {
        const recorder = session.recorder
        if (!recorder || recorder.state === 'inactive') {
          resolve(null)
          return
        }
        recorder.onstop = () => resolve(new Blob(session.chunks, { type: recorder.mimeType || 'audio/webm' }))
        recorder.stop()
      })
    const [liveText, browserText, audio] = await Promise.all([
      session.live ? session.live.stop().catch(() => '') : Promise.resolve(''),
      session.browser ? session.browser.stop() : Promise.resolve(''),
      stopRecorder(),
    ])
    this.release(session)

    if (failure) {
      this.deps.update({ state: 'idle', caption: '', error: t(speechErrorKey(failure)) })
      return
    }
    if (cancel) {
      this.deps.update({ state: 'idle', caption: '' })
      return
    }
    const heard = liveText || browserText
    if (duration < MIN_DURATION_MS && !heard) {
      this.phase = 'idle'
      this.deps.update({ state: 'idle', error: t('voice_too_short') })
      return
    }

    const before = this.before ?? this.deps.snapshot()
    try {
      if (audio && audio.size > 0 && this.deps.config().gemini) {
        // The complete recording is the source of truth; live captions are sent as a fallback only.
        if (heard) this.deps.update({ caption: heard })
        await this.deps.understand({ audio, liveText: heard }, before)
      } else if (heard) {
        this.deps.update({ caption: heard })
        await this.deps.understand({ text: heard }, before)
      } else {
        const reason = session.browser?.error
        this.deps.update({ state: 'idle', error: reason ? t(speechErrorKey(reason)) : t('voice_nothing_heard') })
      }
    } finally {
      this.phase = 'idle'
    }
  }

  private release(session: Session) {
    stopPcm(session)
    session.stream.getTracks().forEach((track) => track.stop())
    void session.context.close().catch(() => {})
    if (this.active === session) this.active = null
    this.deps.levelTarget()?.style.setProperty('--voice-level', '0')
  }

  /** Stops everything at once (leaving the page). */
  dispose() {
    this.disposed = true
    const session = this.active
    if (!session) return
    clearInterval(session.timer)
    if (session.frame) cancelAnimationFrame(session.frame)
    session.live?.abort()
    session.browser?.abort()
    try {
      if (session.recorder && session.recorder.state !== 'inactive') session.recorder.stop()
    } catch {
      /* ignore */
    }
    this.release(session)
    this.phase = 'idle'
  }
}
