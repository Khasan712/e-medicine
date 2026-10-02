/* 16 kHz mono PCM16 capture for Gemini Live (ported from the old dashboard sales.js). */

/**
 * AudioWorklet that downsamples the microphone to 16 kHz mono 16-bit PCM in 100 ms chunks (1600 samples) —
 * the Gemini Live input format. `flush` posts the partial chunk and then the string `flushed`.
 */
export const PCM_WORKLET = `
class PcmDownsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.next = this.ratio;
    this.position = 0;
    this.sum = 0;
    this.count = 0;
    this.chunk = new Int16Array(1600);
    this.length = 0;
    this.port.onmessage = (event) => {
      if (event.data !== 'flush') return;
      if (this.length) this.port.postMessage(this.chunk.slice(0, this.length).buffer);
      this.length = 0;
      this.port.postMessage('flushed');
    };
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i];
      this.count += 1;
      this.position += 1;
      if (this.position >= this.next) {
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.chunk[this.length++] = value < 0 ? value * 0x8000 : value * 0x7fff;
        this.sum = 0;
        this.count = 0;
        this.next += this.ratio;
        if (this.length === this.chunk.length) {
          this.port.postMessage(this.chunk.buffer.slice(0));
          this.length = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-downsampler', PcmDownsampler);
`

export interface PcmSession {
  context: AudioContext
  source: MediaStreamAudioSourceNode
  pcm?: AudioWorkletNode
  sink?: GainNode
  flushed?: () => void
}

let workletUrl: string | null = null

/** Starts PCM capture together with the microphone, so nothing said is lost while Live connects. */
export async function startPcm(session: PcmSession, onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
  workletUrl ??= URL.createObjectURL(new Blob([PCM_WORKLET], { type: 'application/javascript' }))
  await session.context.audioWorklet.addModule(workletUrl)
  const pcm = new AudioWorkletNode(session.context, 'pcm-downsampler')
  const sink = session.context.createGain()
  sink.gain.value = 0 // keeps the graph running without playing the microphone back
  session.source.connect(pcm)
  pcm.connect(sink)
  sink.connect(session.context.destination)
  pcm.port.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
    if (event.data === 'flushed') {
      session.flushed?.()
      return
    }
    if (typeof event.data !== 'string') onChunk(event.data)
  }
  session.pcm = pcm
  session.sink = sink
}

/** Sends the last partial chunk (resolves on `flushed`, or after 150 ms at the latest). */
export function flushPcm(session: PcmSession): Promise<void> {
  const pcm = session.pcm
  if (!pcm) return Promise.resolve()
  return new Promise((resolve) => {
    session.flushed = resolve
    pcm.port.postMessage('flush')
    setTimeout(resolve, 150)
  })
}

export function stopPcm(session: PcmSession) {
  if (!session.pcm) return
  session.pcm.port.onmessage = null
  session.pcm.disconnect()
  session.sink?.disconnect()
}
