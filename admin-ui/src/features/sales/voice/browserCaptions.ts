import { joinText } from './audio'

/* Minimal Web Speech API typings (not part of the TypeScript DOM library). */
interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechAlternative
}
interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}
interface SpeechErrorEvent {
  error: string
}
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}
type RecognitionConstructor = new () => SpeechRecognitionLike

function recognitionClass(): RecognitionConstructor | null {
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

/** Errors after which the browser's speech service will not recover by restarting. */
export const FATAL_SPEECH_ERRORS = ['not-allowed', 'service-not-allowed', 'network', 'language-not-supported', 'audio-capture', 'bad-grammar']

interface BrowserCaptionsOptions {
  onText: (text: string) => void
  onFatal?: (code: string) => void
  lang: 'uz' | 'ru'
}

/**
 * Fallback captions with the browser's Web Speech API (used when Gemini is not configured).
 * Quality depends on the browser: Chrome sends audio to Google; Safari uses Apple dictation, which has no Uzbek.
 */
export class BrowserCaptions {
  static supported(): boolean {
    return typeof window !== 'undefined' && recognitionClass() !== null
  }

  final = ''
  interim = ''
  active = true
  error: string | null = null
  failed: string | null = null
  private restarts: number[] = []
  private done: (() => void) | null = null
  private readonly recognition: SpeechRecognitionLike
  private readonly onText: (text: string) => void
  private readonly onFatal?: (code: string) => void

  constructor({ onText, onFatal, lang }: BrowserCaptionsOptions) {
    const Recognition = recognitionClass()
    if (!Recognition) throw new Error('speech_unsupported')
    this.onText = onText
    this.onFatal = onFatal
    this.recognition = new Recognition()
    this.recognition.lang = lang === 'ru' ? 'ru-RU' : 'uz-UZ'
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]
        if (result.isFinal) this.final += `${result[0].transcript} `
        else interim += result[0].transcript
      }
      this.interim = interim
      this.onText(joinText([this.final, this.interim]))
    }
    this.recognition.onerror = (event) => {
      this.error = event.error
      if (FATAL_SPEECH_ERRORS.includes(event.error)) this.fail(event.error)
    }
    this.recognition.onend = () => {
      if (this.active) {
        // Chrome ends a session after a pause; restart it, but never spin on a broken service.
        const now = Date.now()
        this.restarts = this.restarts.filter((time) => now - time < 3000).concat(now)
        if (this.restarts.length > 4) {
          this.fail(this.error ?? 'network')
          return
        }
        try {
          this.recognition.start()
        } catch {
          /* already started */
        }
      } else {
        this.done?.()
      }
    }
  }

  private fail(code: string) {
    if (this.failed) return
    this.failed = code
    this.active = false
    this.onFatal?.(code)
  }

  start() {
    this.recognition.start()
  }

  /** Stops listening and resolves with everything heard (after `onend`, or 1.5 s at the latest). */
  stop(): Promise<string> {
    this.active = false
    return new Promise((resolve) => {
      const finish = () => resolve(joinText([this.final, this.interim]))
      this.done = finish
      try {
        this.recognition.stop()
      } catch {
        finish()
      }
      setTimeout(finish, 1500)
    })
  }

  abort() {
    this.active = false
    try {
      ;(this.recognition.abort ?? this.recognition.stop).call(this.recognition)
    } catch {
      /* ignore */
    }
  }
}
