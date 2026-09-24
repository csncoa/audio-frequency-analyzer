/**
 * Real-time Web Audio API Engine
 * Handles live AnalyserNode connection, real-time FFT spectrum, and oscilloscope waveform.
 */

export interface RealtimeSpectrumData {
  frequencies: Float32Array
  timeDomain: Float32Array
  dominantFrequency: number
  peakMagnitude: number
  nearestNote: string
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function getNearestNote(freq: number): string {
  if (freq < 20 || freq > 20000) return '—'
  const midi = 69 + 12 * Math.log2(freq / 440)
  const roundedMidi = Math.round(midi)
  const noteIndex = ((roundedMidi % 12) + 12) % 12
  const octave = Math.floor(roundedMidi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

export class RealtimeAudioAnalyzer {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private freqBuffer: Uint8Array<ArrayBuffer> | null = null
  private timeBuffer: Uint8Array<ArrayBuffer> | null = null
  private animFrameId: number | null = null
  private onFrameCallback: ((data: { liveFreq: number; liveNote: string; peakMag: number }) => void) | null = null

  public isInitialized = false

  public init(audioElement: HTMLAudioElement) {
    if (this.isInitialized) return

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.82
      this.analyser.minDecibels = -90
      this.analyser.maxDecibels = -10

      this.source = this.ctx.createMediaElementSource(audioElement)
      this.source.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)

      this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
      this.timeBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
      this.isInitialized = true
    } catch (err) {
      console.warn('RealtimeAudioAnalyzer init error:', err)
    }
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  public getContext(): AudioContext | null {
    return this.ctx
  }

  public getByteFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.freqBuffer) return null
    this.analyser.getByteFrequencyData(this.freqBuffer)
    return this.freqBuffer
  }

  public getByteTimeDomainData(): Uint8Array | null {
    if (!this.analyser || !this.timeBuffer) return null
    this.analyser.getByteTimeDomainData(this.timeBuffer)
    return this.timeBuffer
  }

  /**
   * Computes the live instantaneous dominant frequency
   */
  public getLiveDominantFrequency(): { freq: number; note: string; magnitude: number } {
    if (!this.analyser || !this.freqBuffer || !this.ctx) {
      return { freq: 0, note: '—', magnitude: 0 }
    }
    this.analyser.getByteFrequencyData(this.freqBuffer)

    const binCount = this.analyser.frequencyBinCount
    const sampleRate = this.ctx.sampleRate
    const binWidth = sampleRate / this.analyser.fftSize

    // Ignore sub-bass rumble (< 40 Hz) and search up to 4000 Hz
    const minBin = Math.max(2, Math.floor(40 / binWidth))
    const maxBin = Math.min(binCount, Math.floor(4000 / binWidth))

    let maxVal = 0
    let peakBin = minBin

    for (let i = minBin; i < maxBin; i++) {
      if (this.freqBuffer[i] > maxVal) {
        maxVal = this.freqBuffer[i]
        peakBin = i
      }
    }

    if (maxVal < 15) {
      return { freq: 0, note: '—', magnitude: 0 }
    }

    const freq = Math.round(peakBin * binWidth)
    const note = getNearestNote(freq)
    const magnitude = parseFloat((maxVal / 255).toFixed(2))

    return { freq, note, magnitude }
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
    this.analyser = null
    this.source = null
    this.isInitialized = false
  }
}
