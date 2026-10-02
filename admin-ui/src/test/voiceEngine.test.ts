/* The voice engine in isolation: Gemini Live protocol, PCM worklet, Web Speech fallback and the recording session. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceToken } from '../api/types'
import { DEFAULT_SALE_FORM } from '../features/sales/cart'
import { toBase64 } from '../features/sales/voice/audio'
import { BrowserCaptions } from '../features/sales/voice/browserCaptions'
import { TAIL_MS, VoiceController, type UnderstandInput, type VoiceUiPatch } from '../features/sales/voice/controller'
import { LiveCaptions } from '../features/sales/voice/liveCaptions'
import { PCM_WORKLET } from '../features/sales/voice/pcm'
import type { Snapshot } from '../features/sales/voiceResult'

// ------------------------------------------------------------------ fakes
class FakeSocket {
  static instances: FakeSocket[] = []
  static OPEN = 1
  readyState = 0
  sent: string[] = []
  closedWith: number | null = null
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.onopen?.()
    })
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000) {
    this.readyState = 3
    this.closedWith = code
    this.onclose?.({ code, reason: '' })
  }

  /** A message from the Gemini Live server. */
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  messages() {
    return this.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>)
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function pcm(value: number, samples = 4): ArrayBuffer {
  return new Int16Array(samples).fill(value).buffer
}

function audioMessage(buffer: ArrayBuffer) {
  return { realtimeInput: { audio: { data: toBase64(buffer), mimeType: 'audio/pcm;rate=16000' } } }
}

const TOKEN: VoiceToken = { token: 'tok/1', url: 'wss://live.test/ws', setup: { setup: { model: 'gemini-live' } } }

// ------------------------------------------------------------------ Gemini Live captions
describe('LiveCaptions (Gemini Live)', () => {
  beforeEach(() => {
    FakeSocket.instances = []
  })

  it('sends setup first, buffers audio until setupComplete, then streams it in order', async () => {
    const captions: string[] = []
    const live = new LiveCaptions((text) => captions.push(text), (url) => new FakeSocket(url) as unknown as WebSocket)

    live.push(pcm(1)) // spoken while the socket is still connecting
    const connecting = live.connect(TOKEN)
    const socket = FakeSocket.instances[0]
    expect(socket.url).toBe('wss://live.test/ws?access_token=tok%2F1')

    await tick()
    expect(socket.messages()).toEqual([{ setup: { model: 'gemini-live' } }])

    live.push(pcm(2)) // socket open, but the session is not set up yet
    expect(socket.sent).toHaveLength(1)

    socket.receive({ setupComplete: {} })
    await connecting
    expect(socket.messages().slice(1)).toEqual([audioMessage(pcm(1)), audioMessage(pcm(2))])

    live.push(pcm(3))
    expect(socket.messages().at(-1)).toEqual(audioMessage(pcm(3)))

    socket.receive({ serverContent: { interimInputTranscription: { text: 'ikki' } } })
    socket.receive({ serverContent: { inputTranscription: { text: 'ikkita chizburger' } } })
    socket.receive({ serverContent: { interimInputTranscription: { text: 'va kola' } } })
    expect(captions).toEqual(['ikki', 'ikkita chizburger', 'ikkita chizburger va kola'])

    const stopping = live.stop()
    expect(socket.messages().at(-1)).toEqual({ realtimeInput: { audioStreamEnd: true } })
    socket.receive({ serverContent: { inputTranscription: { text: 'va kola', finished: true } } })
    await expect(stopping).resolves.toBe('ikkita chizburger va kola')
    expect(socket.closedWith).toBe(1000)
  })

  it('accepts snake_case messages too', async () => {
    const captions: string[] = []
    const live = new LiveCaptions((text) => captions.push(text), (url) => new FakeSocket(url) as unknown as WebSocket)
    const connecting = live.connect(TOKEN)
    await tick()
    FakeSocket.instances[0].receive({ setup_complete: {} })
    await connecting
    FakeSocket.instances[0].receive({ server_content: { input_transcription: { text: 'salom' } } })
    expect(captions).toEqual(['salom'])
  })

  it('fails when the session is not set up in time', async () => {
    const live = new LiveCaptions(() => {}, (url) => new FakeSocket(url) as unknown as WebSocket)
    await expect(live.connect(TOKEN, 30)).rejects.toThrow('live_setup_timeout')
  })

  it('fails when the server closes the socket', async () => {
    const live = new LiveCaptions(() => {}, (url) => new FakeSocket(url) as unknown as WebSocket)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const connecting = live.connect(TOKEN)
    await tick()
    FakeSocket.instances[0].close(1008)
    await expect(connecting).rejects.toThrow('live_closed_1008')
    expect(live.failed).toBe(true)
    expect(warn).toHaveBeenCalled()
  })
})

// ------------------------------------------------------------------ PCM worklet
describe('PCM worklet (16 kHz PCM16, 100 ms chunks)', () => {
  function loadProcessor(sampleRate: number) {
    const posted: unknown[] = []
    let Processor: (new () => { process: (inputs: Float32Array[][]) => boolean; port: { onmessage: ((event: { data: unknown }) => void) | null } }) | null = null
    class WorkletBase {
      port = { postMessage: (message: unknown) => posted.push(message), onmessage: null as ((event: { data: unknown }) => void) | null }
    }
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', PCM_WORKLET)(
      WorkletBase,
      (_name: string, cls: typeof Processor) => {
        Processor = cls
      },
      sampleRate,
    )
    return { processor: new Processor!(), posted }
  }

  it('downsamples 48 kHz to 16 kHz and posts 1600-sample chunks', () => {
    const { processor, posted } = loadProcessor(48_000)
    const second = new Float32Array(4800).fill(0.5) // 100 ms at 48 kHz
    expect(processor.process([[second.subarray(0, 2400)]])).toBe(true)
    expect(posted).toHaveLength(0)
    processor.process([[second.subarray(2400)]])
    expect(posted).toHaveLength(1)
    const chunk = new Int16Array(posted[0] as ArrayBuffer)
    expect(chunk).toHaveLength(1600)
    expect(chunk.every((value) => value === Math.trunc(0.5 * 0x7fff))).toBe(true)
  })

  it('flushes the partial chunk on request', () => {
    const { processor, posted } = loadProcessor(48_000)
    processor.process([[new Float32Array(300).fill(-1)]])
    processor.port.onmessage?.({ data: 'flush' })
    expect(posted).toHaveLength(2)
    expect(Array.from(new Int16Array(posted[0] as ArrayBuffer))).toEqual(new Array(100).fill(-32768))
    expect(posted[1]).toBe('flushed')
  })
})

// ------------------------------------------------------------------ Web Speech fallback
describe('BrowserCaptions (Web Speech API fallback)', () => {
  class FakeRecognition {
    static last: FakeRecognition
    lang = ''
    continuous = false
    interimResults = false
    onresult: ((event: unknown) => void) | null = null
    onerror: ((event: { error: string }) => void) | null = null
    onend: (() => void) | null = null
    starts = 0
    constructor() {
      FakeRecognition.last = this
    }
    start() {
      this.starts += 1
    }
    stop() {
      setTimeout(() => this.onend?.(), 0)
    }
  }

  beforeEach(() => {
    Object.assign(window, { webkitSpeechRecognition: FakeRecognition })
  })
  afterEach(() => {
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  const result = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } })

  it('joins final and interim text, restarts after pauses and stops with what it heard', async () => {
    const texts: string[] = []
    const captions = new BrowserCaptions({ onText: (text) => texts.push(text), lang: 'ru' })
    const recognition = FakeRecognition.last
    expect(BrowserCaptions.supported()).toBe(true)
    expect([recognition.lang, recognition.continuous, recognition.interimResults]).toEqual(['ru-RU', true, true])

    captions.start()
    recognition.onresult?.({ resultIndex: 0, results: [result('две пиццы', true)] })
    recognition.onresult?.({ resultIndex: 1, results: [result('две пиццы', true), result('и кола', false)] })
    expect(texts.at(-1)).toBe('две пиццы и кола')

    recognition.onend?.() // Chrome ends the session after a pause
    expect(recognition.starts).toBe(2)

    await expect(captions.stop()).resolves.toBe('две пиццы и кола')
  })

  it('reports fatal errors once and does not spin on a broken service', () => {
    const fatal: string[] = []
    new BrowserCaptions({ onText: () => {}, onFatal: (code) => fatal.push(code), lang: 'uz' })
    const recognition = FakeRecognition.last
    expect(recognition.lang).toBe('uz-UZ')
    for (let index = 0; index < 6; index++) recognition.onend?.()
    expect(fatal).toEqual(['network'])

    const second: string[] = []
    new BrowserCaptions({ onText: () => {}, onFatal: (code) => second.push(code), lang: 'uz' })
    FakeRecognition.last.onerror?.({ error: 'not-allowed' })
    FakeRecognition.last.onerror?.({ error: 'not-allowed' })
    expect(second).toEqual(['not-allowed'])
  })
})

// ------------------------------------------------------------------ the recording session
describe('VoiceController (recording session)', () => {
  const BEFORE: Snapshot = { items: [{ product_id: 1, quantity: 1 }], form: DEFAULT_SALE_FORM, statusAuto: true }
  let media: ReturnType<typeof installMedia>

  function installMedia(options: { getUserMedia?: () => Promise<unknown> } = {}) {
    const tracks = [{ stop: vi.fn<() => void>() }]
    const workletNodes: FakeWorkletNode[] = []
    const contexts: FakeAudioContext[] = []
    const recorders: FakeRecorder[] = []

    class FakeWorkletNode {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: vi.fn<(message: unknown) => void>((message) => {
          if (message === 'flush') queueMicrotask(() => this.port.onmessage?.({ data: 'flushed' }))
        }),
      }
      connect = vi.fn<() => void>()
      disconnect = vi.fn<() => void>()
      constructor() {
        workletNodes.push(this)
      }
      /** Audio produced by the worklet. */
      emit(buffer: ArrayBuffer) {
        this.port.onmessage?.({ data: buffer })
      }
    }
    class FakeAudioContext {
      state = 'running'
      destination = {}
      audioWorklet = { addModule: vi.fn<() => Promise<void>>(async () => {}) }
      close = vi.fn<() => Promise<void>>(async () => {})
      resume = vi.fn<() => Promise<void>>(async () => {})
      constructor() {
        contexts.push(this)
      }
      createMediaStreamSource() {
        return { connect: vi.fn<() => void>() }
      }
      createAnalyser() {
        return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 64, getByteFrequencyData: (data: Uint8Array) => data.fill(60) }
      }
      createGain() {
        return { gain: { value: 1 }, connect: vi.fn<() => void>(), disconnect: vi.fn<() => void>() }
      }
    }
    class FakeRecorder {
      static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus'
      state = 'inactive'
      mimeType: string
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? ''
        recorders.push(this)
      }
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['opus-bytes'], { type: this.mimeType }) })
        this.onstop?.()
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn<() => Promise<unknown>>(options.getUserMedia ?? (async () => ({ getTracks: () => tracks }))) },
    })
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('WebSocket', FakeSocket)
    return { tracks, workletNodes, contexts, recorders }
  }

  function controller(config: { gemini: boolean; live: boolean }, fetchToken = async () => TOKEN) {
    const updates: VoiceUiPatch[] = []
    const understood: Array<{ input: UnderstandInput; before: Snapshot }> = []
    const instance = new VoiceController({
      config: () => ({ ...config, lang: 'uz' }),
      update: (patch) => updates.push(patch),
      message: (key) => key,
      snapshot: () => BEFORE,
      understand: async (input, before) => {
        understood.push({ input, before })
      },
      fetchToken,
      bars: () => [],
      levelTarget: () => null,
    })
    const states = () => updates.flatMap((patch) => (patch.state ? [patch.state] : []))
    return { instance, updates, understood, states }
  }

  beforeEach(() => {
    FakeSocket.instances = []
    media = installMedia()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
  })

  it('Live: buffers audio until setupComplete, shows captions, keeps a 350 ms tail and sends the full recording', async () => {
    const { instance, updates, understood, states } = controller({ gemini: true, live: true })

    await instance.start()
    expect(instance.phase).toBe('listening')
    expect(states()).toEqual(['starting', 'listening'])
    expect(updates).toContainEqual({ engine: 'live' })
    expect(media.recorders[0].mimeType).toBe('audio/webm;codecs=opus')

    const worklet = media.workletNodes[0]
    worklet.emit(pcm(7)) // captured before Live is connected
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    const socket = FakeSocket.instances[0]
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1)) // setup
    worklet.emit(pcm(8))
    socket.receive({ setupComplete: {} })
    expect(socket.messages().slice(1)).toEqual([audioMessage(pcm(7)), audioMessage(pcm(8))])

    socket.receive({ serverContent: { inputTranscription: { text: 'ikkita chizburger' } } })
    expect(updates).toContainEqual({ caption: 'ikkita chizburger' })

    const stoppedAt = Date.now()
    const stopping = instance.stop()
    expect(instance.phase).toBe('processing')
    await vi.waitFor(() => expect(socket.messages().at(-1)).toEqual({ realtimeInput: { audioStreamEnd: true } }))
    expect(Date.now() - stoppedAt).toBeGreaterThanOrEqual(TAIL_MS - 5)
    expect(worklet.port.postMessage).toHaveBeenCalledWith('flush')
    socket.receive({ serverContent: { turnComplete: true } })
    await stopping

    expect(understood).toHaveLength(1)
    const { input, before } = understood[0]
    expect(input.audio).toBeInstanceOf(Blob)
    expect(input.audio?.type).toBe('audio/webm;codecs=opus')
    expect(input.liveText).toBe('ikkita chizburger')
    expect(input.text).toBeUndefined()
    expect(before).toBe(BEFORE)
    expect(media.tracks[0].stop).toHaveBeenCalled()
    expect(media.contexts[0].close).toHaveBeenCalled()
    expect(socket.closedWith).toBe(1000)
    expect(instance.phase).toBe('idle')
  })

  it('falls back to the recording when Live is unavailable', async () => {
    const { instance, updates, understood } = controller({ gemini: true, live: true }, async () => {
      throw new Error('live_unavailable')
    })
    await instance.start()
    await vi.waitFor(() => expect(updates).toContainEqual({ engine: 'record' }))
    media.workletNodes[0].emit(pcm(1)) // dropped — no captions without Live

    await new Promise((resolve) => setTimeout(resolve, 720))
    await instance.stop()
    expect(FakeSocket.instances).toHaveLength(0)
    expect(understood[0].input.audio).toBeInstanceOf(Blob)
    expect(understood[0].input.liveText).toBe('')
  })

  it('says "too short" for a tap without speech and cancels without sending anything', async () => {
    const short = controller({ gemini: true, live: false })
    await short.instance.start()
    await short.instance.stop()
    expect(short.updates.at(-1)).toEqual({ state: 'idle', error: 'voice_too_short' })
    expect(short.understood).toHaveLength(0)

    const cancelled = controller({ gemini: true, live: false })
    await cancelled.instance.start()
    await cancelled.instance.stop(true)
    expect(cancelled.updates.at(-1)).toEqual({ state: 'idle', caption: '' })
    expect(cancelled.understood).toHaveLength(0)
    expect(media.tracks[0].stop).toHaveBeenCalled()
  })

  it('uses the browser speech recognition without Gemini and sends its text', async () => {
    class FakeRecognition {
      static current: FakeRecognition | null = null
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      onerror = null
      constructor() {
        FakeRecognition.current = this
      }
      start() {}
      stop() {
        setTimeout(() => this.onend?.(), 0)
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    const { instance, updates, understood } = controller({ gemini: false, live: false })

    await instance.start()
    expect(updates).toContainEqual({ engine: 'browser' })
    expect(media.recorders).toHaveLength(0) // nothing to upload without Gemini
    FakeRecognition.current!.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'bitta pepperoni' } }] })
    expect(updates).toContainEqual({ caption: 'bitta pepperoni' })

    await instance.stop()
    expect(understood[0].input).toEqual({ text: 'bitta pepperoni' })
  })

  it('stops with a precise message when speech recognition is not allowed', async () => {
    class FakeRecognition {
      static current: FakeRecognition | null = null
      lang = ''
      continuous = false
      interimResults = false
      onresult = null
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      constructor() {
        FakeRecognition.current = this
      }
      start() {}
      stop() {
        setTimeout(() => this.onend?.(), 0)
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    const { instance, updates, understood } = controller({ gemini: false, live: false })
    await instance.start()
    FakeRecognition.current!.onerror?.({ error: 'not-allowed' })
    await vi.waitFor(() => expect(updates.at(-1)).toEqual({ state: 'idle', caption: '', error: 'voice_speech_denied' }))
    expect(understood).toHaveLength(0)
  })

  it('reports microphone problems precisely', async () => {
    media = installMedia({ getUserMedia: async () => Promise.reject(new DOMException('busy', 'NotReadableError')) })
    const { instance, updates } = controller({ gemini: true, live: false })
    await instance.start()
    expect(updates.at(-1)).toEqual({ state: 'idle', error: 'voice_mic_busy' })
    expect(instance.phase).toBe('idle')
  })

  it('needs an engine: Gemini or browser speech recognition', async () => {
    const { instance, updates } = controller({ gemini: false, live: false })
    await instance.start()
    expect(updates).toEqual([{ error: 'voice_no_engine' }])
  })
})
