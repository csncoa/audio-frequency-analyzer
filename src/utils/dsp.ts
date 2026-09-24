/**
 * Digital Signal Processing (DSP) & Fast Fourier Transform (FFT) Engine
 * Implements real-time / offline WAV signal analysis for Audio Frequency Analyzer.
 */

export interface AudioSignalData {
  fileName: string
  fileSize: number
  sampleRate: number
  duration: number
  totalSamples: number
  channels: number
  waveformData: { t: number; v: number }[]
  fftData: { hz: number; mag: number; dominant: boolean; isHarmonic?: boolean }[]
  dominantFrequency: number
  peakMagnitude: number
  secondaryHarmonics: number[]
  nearestNote: string
  noteDeviationCents: number
  nyquistFrequency: number
  thdPercent?: number
}

// Predefined musical notes
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Maps a frequency in Hz to the nearest musical note and cent deviation
 */
export function frequencyToNote(freq: number): { note: string; cents: number } {
  if (freq <= 0) return { note: 'N/A', cents: 0 }
  // A4 = 440 Hz is note number 69 in MIDI
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
 * Radix-2 In-place Cooley-Tukey FFT algorithm
 */
function cooleyTukeyFFT(re: Float64Array, im: Float64Array) {
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
export function generateDemoAudioData(): AudioSignalData {
  const sampleRate = 44100
  const duration = 2.0
  const totalSamples = 88200
  const numWavePoints = 300

  // Generate 300 waveform points
  const waveformData = Array.from({ length: numWavePoints }, (_, i) => {
    const t = (i / numWavePoints) * duration
    const v =
      0.70 * Math.sin(2 * Math.PI * 440 * t) +
      0.20 * Math.sin(2 * Math.PI * 880 * t) +
      0.06 * Math.sin(2 * Math.PI * 1320 * t) +
      (Math.random() - 0.5) * 0.05
    return {
      t: parseFloat(t.toFixed(4)),
      v: parseFloat(v.toFixed(4)),
    }
  })

  // Generate FFT spectrum (0 to 5000 Hz, 10 Hz step)
  const fftData: { hz: number; mag: number; dominant: boolean; isHarmonic?: boolean }[] = []
  for (let hz = 0; hz <= 5000; hz += 10) {
    let mag = 0
    mag += 0.85 * Math.exp(-Math.pow((hz - 440) / 10, 2))
    mag += 0.35 * Math.exp(-Math.pow((hz - 880) / 12, 2))
    mag += 0.18 * Math.exp(-Math.pow((hz - 1320) / 14, 2))
    mag += 0.09 * Math.exp(-Math.pow((hz - 1760) / 16, 2))
    mag += Math.random() * 0.012

    const dominant = hz >= 430 && hz <= 450
    const isHarmonic = (hz >= 870 && hz <= 890) || (hz >= 1310 && hz <= 1330) || (hz >= 1750 && hz <= 1770)
    fftData.push({
      hz,
      mag: parseFloat(mag.toFixed(4)),
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
    secondaryHarmonics: [880, 1320, 1760],
    nearestNote: 'A4',
    noteDeviationCents: 0,
    nyquistFrequency: 22050,
    thdPercent: 4.8,
  }
}

/**
 * Decodes and calculates real DSP and FFT from an uploaded WAV / Audio File
 */
export async function analyzeAudioFile(file: File): Promise<AudioSignalData> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const duration = audioBuffer.duration
    const totalSamples = audioBuffer.length
    const channels = audioBuffer.numberOfChannels
    const pcmData = audioBuffer.getChannelData(0) // Use first channel

    // 1. Compute Downsampled Waveform for Chart (approx 300 points)
    const targetPoints = 300
    const step = Math.max(1, Math.floor(totalSamples / targetPoints))
    const waveformData: { t: number; v: number }[] = []

    for (let i = 0; i < targetPoints && i * step < totalSamples; i++) {
      const idx = i * step
      const t = parseFloat((idx / sampleRate).toFixed(4))
      const v = parseFloat(pcmData[idx].toFixed(4))
      waveformData.push({ t, v })
    }

    // 2. Perform Real FFT
    // Choose FFT size N (power of 2, e.g. 4096 for fine frequency resolution ~ 10.7 Hz at 44.1 kHz)
    const N = 4096
    const re = new Float64Array(N)
    const im = new Float64Array(N)

    // Find the highest energy window in the signal to analyze
    let startIdx = 0
    let maxEnergy = 0
    const windowStep = Math.max(1, Math.floor((totalSamples - N) / 20))

    if (totalSamples > N) {
      for (let s = 0; s <= totalSamples - N; s += windowStep) {
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

    // Apply Hann Window to reduce spectral leakage
    for (let i = 0; i < N; i++) {
      const sampleVal = startIdx + i < totalSamples ? pcmData[startIdx + i] : 0
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
      re[i] = sampleVal * hann
      im[i] = 0.0
    }

    // Compute FFT
    cooleyTukeyFFT(re, im)

    // Calculate magnitude spectrum
    const halfN = N >> 1
    const binResolution = sampleRate / N
    const magnitudes = new Float64Array(halfN)
    let maxMag = 0
    let peakBin = 0

    // Ignore bin 0 and 1 (DC component / sub-bass rumble < 25 Hz)
    const minBin = Math.max(2, Math.floor(25 / binResolution))
    const maxFreqDisplay = 5000 // Display up to 5 kHz for clear readability
    const maxBinDisplay = Math.min(halfN, Math.ceil(maxFreqDisplay / binResolution))

    for (let k = minBin; k < halfN; k++) {
      const mag = (2 * Math.sqrt(re[k] * re[k] + im[k] * im[k])) / N
      magnitudes[k] = mag
      if (k <= maxBinDisplay && mag > maxMag) {
        maxMag = mag
        peakBin = k
      }
    }

    // Quadratic interpolation around peak bin for sub-bin frequency accuracy
    let peakFreq = peakBin * binResolution
    if (peakBin > minBin && peakBin < halfN - 1) {
      const alpha = magnitudes[peakBin - 1]
      const beta = magnitudes[peakBin]
      const gamma = magnitudes[peakBin + 1]
      const delta = (0.5 * (alpha - gamma)) / (alpha - 2 * beta + gamma || 1e-9)
      peakFreq = (peakBin + delta) * binResolution
    }

    peakFreq = Math.round(peakFreq)
    const normFactor = maxMag > 0 ? 0.9 / maxMag : 1

    // Build decimated FFT Data for Recharts Bar Chart
    const fftData: { hz: number; mag: number; dominant: boolean; isHarmonic?: boolean }[] = []
    const displayStepHz = 20
    const maxHz = Math.min(5000, sampleRate / 2)

    // Secondary harmonics search (around 2f, 3f, 4f)
    const secondaryHarmonics: number[] = []
    for (let h = 2; h <= 4; h++) {
      const targetHz = peakFreq * h
      if (targetHz < maxHz) {
        secondaryHarmonics.push(targetHz)
      }
    }

    for (let hz = 0; hz <= maxHz; hz += displayStepHz) {
      const targetBin = Math.round(hz / binResolution)
      let magVal = 0
      if (targetBin >= 0 && targetBin < halfN) {
        magVal = magnitudes[targetBin] * normFactor
      }

      // Check if near peak or harmonic
      const isDom = Math.abs(hz - peakFreq) < displayStepHz
      const isHarm = secondaryHarmonics.some(harm => Math.abs(hz - harm) < displayStepHz * 1.5)

      fftData.push({
        hz,
        mag: parseFloat(Math.min(1.0, magVal).toFixed(4)),
        dominant: isDom,
        isHarmonic: isHarm,
      })
    }

    const noteInfo = frequencyToNote(peakFreq)

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
      peakMagnitude: parseFloat((maxMag * normFactor).toFixed(2)),
      secondaryHarmonics,
      nearestNote: noteInfo.note,
      noteDeviationCents: noteInfo.cents,
      nyquistFrequency: Math.round(sampleRate / 2),
    }
  } finally {
    audioCtx.close().catch(() => {})
  }
}
