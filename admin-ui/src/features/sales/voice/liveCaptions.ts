import type { VoiceToken } from '../../../api/types'
import { joinText, toBase64, withTimeout } from './audio'

const CONNECTING = 0
const OPEN = 1

type SocketFactory = (url: string) => WebSocket

interface LiveMessage {
  setupComplete?: unknown
  setup_complete?: unknown
  serverContent?: LiveContent
  server_content?: LiveContent
}

interface LiveContent {
  inputTranscription?: { text?: string; finished?: boolean }
  input_transcription?: { text?: string; finished?: boolean }
  interimInputTranscription?: { text?: string }
  interim_input_transcription?: { text?: string }
  turnComplete?: boolean
  turn_complete?: boolean
}

/**
 * Real-time captions through the Gemini Live API (the browser connects with a server-minted single-use token).
 * Captions are feedback while speaking; the order itself is understood from the full recording.
 * Audio captured before `setupComplete` is buffered and sent once the session is ready.
 */
export class LiveCaptions {
  finals: string[] = []
  interim = ''
  /** Audio captured before the socket was ready (up to 90 s of 100 ms chunks). */
  queue: ArrayBuffer[] = []
  ready = false
  failed = false
  closed = false
  stopping = false
  socket: WebSocket | null = null

  private resolveReady: () => void = () => {}
  private rejectReady: (error: Error) => void = () => {}
  private finish: (() => void) | null = null
  private readonly onText: (text: string) => void
  private readonly createSocket: SocketFactory

  constructor(onText: (text: string) => void, createSocket: SocketFactory = (url) => new WebSocket(url)) {
    this.onText = onText
    this.createSocket = createSocket
  }

  push(chunk: ArrayBuffer) {
    if (this.ready && this.socket?.readyState === OPEN) this.send(chunk)
    else if (!this.failed && this.queue.length < 900) this.queue.push(chunk)
  }

  private send(chunk: ArrayBuffer) {
    this.socket?.send(
      JSON.stringify({ realtimeInput: { audio: { data: toBase64(chunk), mimeType: 'audio/pcm;rate=16000' } } }),
    )
  }

  /** Opens the socket, sends `setup` first and resolves on `setupComplete` (7 s timeout). */
  async connect(session: VoiceToken, timeoutMs = 7000): Promise<void> {
    const socket = this.createSocket(`${session.url}?access_token=${encodeURIComponent(session.token)}`)
    this.socket = socket
    const ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    // A rejection after a timeout must not surface as "unhandled".
    ready.catch(() => {})
    socket.onopen = () => socket.send(JSON.stringify(session.setup))
    socket.onmessage = async (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text()
      let message: LiveMessage
      try {
        message = JSON.parse(raw) as LiveMessage
      } catch {
        return
      }
      this.handle(message)
    }
    socket.onerror = () => this.rejectReady(new Error('live_socket_error'))
    socket.onclose = (event: CloseEvent) => {
      this.closed = true
      if (event.code !== 1000 && !this.stopping) {
        this.failed = true
        console.warn('Gemini Live closed', event.code, event.reason)
      }
      this.rejectReady(new Error(`live_closed_${event.code}`))
      this.finish?.()
    }
    await withTimeout(ready, timeoutMs, 'live_setup_timeout')
  }

  handle(message: LiveMessage) {
    if (message.setupComplete || message.setup_complete) {
      this.ready = true
      // What was said while connecting.
      for (const chunk of this.queue) this.send(chunk)
      this.queue = []
      this.resolveReady()
      return
    }
    const content = message.serverContent ?? message.server_content
    if (!content) return
    const interim = content.interimInputTranscription ?? content.interim_input_transcription
    const final = content.inputTranscription ?? content.input_transcription
    if (interim?.text) this.interim = interim.text
    if (final?.text) {
      this.finals.push(final.text)
      this.interim = ''
    }
    this.onText(this.text(true))
    if (this.finish && (final?.finished || content.turnComplete || content.turn_complete)) this.finish()
  }

  text(withInterim = false): string {
    return joinText(withInterim ? [...this.finals, this.interim] : this.finals)
  }

  /** Ends the audio stream, waits briefly for the last transcription and closes the socket. */
  async stop(waitMs = 700): Promise<string> {
    this.stopping = true
    const socket = this.socket
    if (socket && socket.readyState === OPEN && this.ready) {
      socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }))
      await new Promise<void>((resolve) => {
        this.finish = resolve
        setTimeout(resolve, waitMs)
      })
    }
    if (socket && socket.readyState <= OPEN) socket.close(1000)
    return this.text(true)
  }

  /** Closes the socket without waiting (cancel / unmount). */
  abort() {
    this.stopping = true
    this.failed = true
    const socket = this.socket
    if (socket && (socket.readyState === CONNECTING || socket.readyState === OPEN)) socket.close(1000)
  }
}
