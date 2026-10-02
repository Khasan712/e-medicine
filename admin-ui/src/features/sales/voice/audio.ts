/* Small helpers of the voice assistant (ported from the old dashboard sales.js). */

export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function joinText(parts: string[]): string {
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function withTimeout<T>(promise: Promise<T>, ms: number, code = 'timeout'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The best recording format the browser supports (Gemini accepts all of them). */
export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ''
  )
}

/** File name for the uploaded clip (the extension matters to the server). */
export function audioFileName(type: string): string {
  return `voice.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`
}
