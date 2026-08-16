/**
 * Convert a Blob recorded by MediaRecorder (audio/webm or audio/mp4) to a
 * 16kHz mono PCM WAV data URL using the browser's Web Audio API.
 *
 * Gemini's interactions API accepts audio/wav natively, so the server does not
 * need ffmpeg/child_process for audio conversion — this keeps the standalone
 * Next.js build small and Windows-compatible.
 */
export async function blobToWavDataUrl(blob: Blob): Promise<string> {
  if (typeof AudioContext === 'undefined') {
    throw new Error('Web Audio API is not supported in this browser')
  }
  const buf = await blob.arrayBuffer()
  const ac = new AudioContext()
  const audioBuffer = await ac.decodeAudioData(buf.slice(0))
  ac.close()

  const sampleRate = 16000
  const offline = new OfflineAudioContext(1, Math.round(audioBuffer.duration * sampleRate), sampleRate)
  const src = offline.createBufferSource()
  src.buffer = audioBuffer
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)
  const n = samples.length

  const buffer = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buffer)
  const ws = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  ws(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  ws(8, 'WAVE')
  ws(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ws(36, 'data')
  view.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  const bin = String.fromCharCode(...new Uint8Array(buffer))
  return 'data:audio/wav;base64,' + btoa(bin)
}
