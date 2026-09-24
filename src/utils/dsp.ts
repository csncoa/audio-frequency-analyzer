/**
 * Digital Signal Processing (DSP) & Fast Fourier Transform (FFT) Engine
 * Implements real-time / offline WAV signal analysis for Audio Frequency Analyzer.
 * Features:
 * - Stereo to Mono Mixdown (L + R) / 2
 * - Multiple Windowing Functions (Hann, Hamming, Blackman, Rectangular)
 * - Welch's Averaged Periodogram for True Power Spectral Density (PSD)
 * - Linear & Decibel (dB) Magnitude Scaling
 * - Harmonic Peak & Musical Pitch (Note + Cents) Detection
 */

export type WindowFunction = 'hann' | 'hamming' | 'blackman' | 'rectangular'
export type AnalysisMethod = 'welch' | 'peak'

export interface DspAnalysisOptions {
  windowFunction?: WindowFunction
  method?: AnalysisMethod
  maxFrequency?: number // e.g. 2000, 5000, 22050
  dbScale?: boolean
}

export interface AudioSignalData {
  fileName: string
  fileSize: number
  sampleRate: number
  duration: number
  totalSamples: number
  channels: number
  waveformData: { t: number; v: number }[]
  fftData: { hz: number; mag: number; magDb: number; dominant: boolean; isHarmonic?: boolean }[]
  dominantFrequency: number
  peakMagnitude: number
  peakMagnitudeDb: number
  secondaryHarmonics: number[]
  nearestNote: string
  noteDeviationCents: number
  nyquistFrequency: number
  windowUsed: WindowFunction
  methodUsed: AnalysisMethod
}

// Predefined musical notes
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Maps a frequency in Hz to the nearest musical note and cent deviation
 */
export function frequencyToNote(freq: number): { note: string; cents: number } {
  if (freq <= 0) return { note: 'N/A', cents: 0 }
  const midi = 69 + 12 * Math.log2(freq / 440)
  const roundedMidi = Math.round(midi)
  const noteIndex = ((roundedMidi % 12) + 12) % 12
  const octave = Math.floor(roundedMidi / 12) - 1
  const cents = Math.round((midi - roundedMidi) * 100)
  return {
    note: `${NOTE_NAMES[noteIndex]}${octave}`,
    cents,
  }
}

/**
 * Calculates window weighting value for sample n of N
 */
export function applyWindowWeight(n: number, N: number, win: WindowFunction): number {
  if (N <= 1) return 1.0
  switch (win) {
    case 'hamming':
      return 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1))
    case 'blackman':
      return (
        0.42 -
        0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) +
        0.08 * Math.cos((4 * Math.PI * n) / (N - 1))
      )
    case 'rectangular':
      return 1.0
    case 'hann':
    default:
      return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
  }
}

/**
 * Radix-2 In-place Cooley-Tukey FFT algorithm
 */
export function cooleyTukeyFFT(re: Float64Array, im: Float64Array) {
  const n = re.length
  if (n <= 1) return

  // Bit-reversal permutation
  let j = 0
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = re[i]; re[i] = re[j]; re[j] = tempR
      const tempI = im[i]; im[i] = im[j]; im[j] = tempI
    }
    let k = n >> 1
    while (k <= j) {
      j -= k
      k >>= 1
    }
    j += k
  }

  // Cooley-Tukey decimation in time
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angle = (-2 * Math.PI) / len
    const wStepR = Math.cos(angle)
    const wStepI = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let wR = 1.0
      let wI = 0.0
      for (let k = 0; k < half; k++) {
        const uR = re[i + k]
        const uI = im[i + k]
        const vR = re[i + k + half] * wR - im[i + k + half] * wI
        const vI = re[i + k + half] * wI + im[i + k + half] * wR

        re[i + k] = uR + vR
        im[i + k] = uI + vI
        re[i + k + half] = uR - vR
        im[i + k + half] = uI - vI

        const nextWR = wR * wStepR - wI * wStepI
        wI = wR * wStepI + wI * wStepR
        wR = nextWR
      }
    }
  }
}

/**
 * Generates synthetic baseline 440 Hz data (for demo / initial state)
 */
export function generateDemoAudioData(options: DspAnalysisOptions = {}): AudioSignalData {
  const sampleRate = 44100
  const duration = 2.0
  const totalSamples = 88200
  const numWavePoints = 300
  const win = options.windowFunction || 'hann'
  const method = options.method || 'welch'

  // Generate 300 waveform points
  const waveformData = Array.from({ length: numWavePoints }, (_, i) => {
    const t = (i / numWavePoints) * duration
    const v =
      0.70 * Math.sin(2 * Math.PI * 440 * t) +
      0.20 * Math.sin(2 * Math.PI * 880 * t) +
      0.06 * Math.sin(2 * Math.PI * 1320 * t) +
      (Math.random() - 0.5) * 0.04
    return {
      t: parseFloat(t.toFixed(4)),
      v: parseFloat(v.toFixed(4)),
    }
  })

  // Generate FFT spectrum (0 to 5000 Hz, 10 Hz step)
  const maxHz = options.maxFrequency || 5000
  const stepHz = maxHz > 10000 ? 50 : maxHz > 3000 ? 15 : 8
  const fftData: AudioSignalData['fftData'] = []

  for (let hz = 0; hz <= maxHz; hz += stepHz) {
    let mag = 0
    mag += 0.85 * Math.exp(-Math.pow((hz - 440) / 10, 2))
    mag += 0.35 * Math.exp(-Math.pow((hz - 880) / 12, 2))
    mag += 0.18 * Math.exp(-Math.pow((hz - 1320) / 14, 2))
    mag += 0.09 * Math.exp(-Math.pow((hz - 1760) / 16, 2))
    mag += Math.random() * 0.01

    const magClamped = Math.max(1e-4, Math.min(1.0, mag))
    const magDb = parseFloat(Math.max(-80, 20 * Math.log10(magClamped)).toFixed(1))

    const dominant = hz >= 420 && hz <= 460
    const isHarmonic =
      (hz >= 860 && hz <= 900) ||
      (hz >= 1300 && hz <= 1340) ||
      (hz >= 1740 && hz <= 1780)

    fftData.push({
      hz,
      mag: parseFloat(magClamped.toFixed(4)),
      magDb,
      dominant,
      isHarmonic,
    })
  }

  return {
    fileName: 'demo_440hz_tone.wav',
    fileSize: 176444,
    sampleRate,
    duration,
    totalSamples,
    channels: 1,
    waveformData,
    fftData,
    dominantFrequency: 440,
    peakMagnitude: 0.85,
    peakMagnitudeDb: parseFloat((20 * Math.log10(0.85)).toFixed(1)),
    secondaryHarmonics: [880, 1320, 1760],
    nearestNote: 'A4',
    noteDeviationCents: 0,
    nyquistFrequency: 22050,
    windowUsed: win,
    methodUsed: method,
  }
}

/**
 * Decodes and calculates real DSP and FFT from an uploaded WAV / Audio File
 * Supports Stereo Mixdown, Welch's Averaged PSD, and custom windowing functions.
 */
export async function analyzeAudioFile(
  file: File,
  options: DspAnalysisOptions = {}
): Promise<AudioSignalData> {
  const windowFunction = options.windowFunction || 'hann'
  const method = options.method || 'welch'
  const maxDisplayFreq = options.maxFrequency || 5000

  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const duration = audioBuffer.duration
    const totalSamples = audioBuffer.length
    const channels = audioBuffer.numberOfChannels

    // 1. Stereo to Mono Mixdown: (L + R) / 2
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : null
    const pcmData = new Float32Array(totalSamples)

    if (rightChannel) {
      for (let i = 0; i < totalSamples; i++) {
        pcmData[i] = (leftChannel[i] + rightChannel[i]) * 0.5
      }
    } else {
      pcmData.set(leftChannel)
    }

    // 2. Downsampled Waveform for Chart (approx 300 points)
    const targetPoints = 300
    const step = Math.max(1, Math.floor(totalSamples / targetPoints))
    const waveformData: { t: number; v: number }[] = []

    for (let i = 0; i < targetPoints && i * step < totalSamples; i++) {
      const idx = i * step
      const t = parseFloat((idx / sampleRate).toFixed(4))
      const v = parseFloat(pcmData[idx].toFixed(4))
      waveformData.push({ t, v })
    }

    // 3. FFT Computation (Radix-2 Cooley-Tukey)
    const N = 4096
    const halfN = N >> 1
    const binResolution = sampleRate / N
    const accumulatedMagnitudes = new Float64Array(halfN)

    if (method === 'welch' && totalSamples >= N * 2) {
      // Welch's Method: Multiple overlapping windows (50% overlap) across the signal
      const numSegments = Math.min(24, Math.floor((totalSamples - N) / (N / 2)) + 1)
      const segmentStep = Math.max(N / 2, Math.floor((totalSamples - N) / Math.max(1, numSegments - 1)))

      const re = new Float64Array(N)
      const im = new Float64Array(N)

      for (let seg = 0; seg < numSegments; seg++) {
        const start = seg * segmentStep
        for (let i = 0; i < N; i++) {
          const sampleVal = start + i < totalSamples ? pcmData[start + i] : 0
          const w = applyWindowWeight(i, N, windowFunction)
          re[i] = sampleVal * w
          im[i] = 0.0
        }

        cooleyTukeyFFT(re, im)

        for (let k = 0; k < halfN; k++) {
          const mag = (2 * Math.sqrt(re[k] * re[k] + im[k] * im[k])) / N
          accumulatedMagnitudes[k] += mag
        }
      }

      // Average magnitudes
      for (let k = 0; k < halfN; k++) {
        accumulatedMagnitudes[k] /= numSegments
      }
    } else {
      // Peak Energy Window method
      let startIdx = 0
      let maxEnergy = 0
      const scanStep = Math.max(1, Math.floor((totalSamples - N) / 20))

      if (totalSamples > N) {
        for (let s = 0; s <= totalSamples - N; s += scanStep) {
          let energy = 0
          for (let k = 0; k < N; k += 4) {
            energy += pcmData[s + k] * pcmData[s + k]
          }
          if (energy > maxEnergy) {
            maxEnergy = energy
            startIdx = s
          }
        }
      }

      const re = new Float64Array(N)
      const im = new Float64Array(N)

      for (let i = 0; i < N; i++) {
        const sampleVal = startIdx + i < totalSamples ? pcmData[startIdx + i] : 0
        const w = applyWindowWeight(i, N, windowFunction)
        re[i] = sampleVal * w
        im[i] = 0.0
      }

      cooleyTukeyFFT(re, im)

      for (let k = 0; k < halfN; k++) {
        accumulatedMagnitudes[k] = (2 * Math.sqrt(re[k] * re[k] + im[k] * im[k])) / N
      }
    }

    // 4. Peak & Dominant Frequency Detection
    const minBin = Math.max(2, Math.floor(30 / binResolution))
    const searchMaxFreq = Math.min(sampleRate / 2, Math.max(4000, maxDisplayFreq))
    const maxSearchBin = Math.min(halfN, Math.ceil(searchMaxFreq / binResolution))

    let maxMag = 0
    let peakBin = minBin

    for (let k = minBin; k < maxSearchBin; k++) {
      if (accumulatedMagnitudes[k] > maxMag) {
        maxMag = accumulatedMagnitudes[k]
        peakBin = k
      }
    }

    // Parabolic interpolation for fine sub-bin frequency accuracy
    let peakFreq = peakBin * binResolution
    if (peakBin > minBin && peakBin < halfN - 1) {
      const alpha = accumulatedMagnitudes[peakBin - 1]
      const beta = accumulatedMagnitudes[peakBin]
      const gamma = accumulatedMagnitudes[peakBin + 1]
      const delta = (0.5 * (alpha - gamma)) / (alpha - 2 * beta + gamma || 1e-9)
      peakFreq = (peakBin + delta) * binResolution
    }

    peakFreq = Math.round(peakFreq)
    const normFactor = maxMag > 0 ? 0.9 / maxMag : 1.0

    // 5. Secondary Harmonics Detection
    const secondaryHarmonics: number[] = []
    const nyquist = Math.round(sampleRate / 2)
    for (let h = 2; h <= 4; h++) {
      const harmHz = peakFreq * h
      if (harmHz < nyquist && harmHz < maxDisplayFreq) {
        secondaryHarmonics.push(harmHz)
      }
    }

    // 6. Build Display Data for Bar Chart
    const targetHzMax = Math.min(nyquist, maxDisplayFreq)
    const displayStepHz = targetHzMax > 10000 ? 50 : targetHzMax > 3000 ? 20 : 10
    const fftData: AudioSignalData['fftData'] = []

    for (let hz = 0; hz <= targetHzMax; hz += displayStepHz) {
      const targetBin = Math.round(hz / binResolution)
      let magVal = 0
      if (targetBin >= 0 && targetBin < halfN) {
        magVal = accumulatedMagnitudes[targetBin] * normFactor
      }

      const magClamped = Math.max(1e-4, Math.min(1.0, magVal))
      const magDb = parseFloat(Math.max(-80, 20 * Math.log10(magClamped)).toFixed(1))

      const isDom = Math.abs(hz - peakFreq) <= displayStepHz
      const isHarm = secondaryHarmonics.some(h => Math.abs(hz - h) <= displayStepHz * 1.5)

      fftData.push({
        hz,
        mag: parseFloat(magClamped.toFixed(4)),
        magDb,
        dominant: isDom,
        isHarmonic: isHarm,
      })
    }

    const noteInfo = frequencyToNote(peakFreq)
    const peakMagNormalized = parseFloat((maxMag * normFactor).toFixed(2))
    const peakMagDb = parseFloat((20 * Math.log10(Math.max(1e-4, peakMagNormalized))).toFixed(1))

    return {
      fileName: file.name,
      fileSize: file.size,
      sampleRate,
      duration: parseFloat(duration.toFixed(2)),
      totalSamples,
      channels,
      waveformData,
      fftData,
      dominantFrequency: peakFreq,
      peakMagnitude: peakMagNormalized,
      peakMagnitudeDb: peakMagDb,
      secondaryHarmonics,
      nearestNote: noteInfo.note,
      noteDeviationCents: noteInfo.cents,
      nyquistFrequency: nyquist,
      windowUsed: windowFunction,
      methodUsed: method,
    }
  } finally {
    audioCtx.close().catch(() => {})
  }
}
