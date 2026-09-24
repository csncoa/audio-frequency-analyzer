import { useState, useRef, useCallback, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import {
  type AudioSignalData,
  generateDemoAudioData,
  analyzeAudioFile,
} from './utils/dsp'

// ── Sidebar nav items ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',       icon: GridIcon },
  { id: 'analysis',   label: 'Audio Analysis',  icon: WaveIcon },
  { id: 'fft',        label: 'FFT Spectrum',    icon: SpectrumIcon },
  { id: 'about',      label: 'About DSP',       icon: InfoIcon },
]

// ── SVG icons ─────────────────────────────────────────────────────────────────
function GridIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function WaveIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 12 Q4 4 6 12 Q8 20 10 12 Q12 4 14 12 Q16 20 18 12 Q20 4 22 12" strokeLinecap="round" />
    </svg>
  )
}
function SpectrumIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 20V14M7 20V8M11 20V4M15 20V10M19 20V6M23 20V12" strokeLinecap="round" />
    </svg>
  )
}
function InfoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" /><path d="M12 8v1M12 12v4" strokeLinecap="round" />
    </svg>
  )
}
function PlayIcon() {
  return <svg width={18} height={18} fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" /></svg>
}
function PauseIcon() {
  return <svg width={18} height={18} fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
}
function UploadIcon() {
  return (
    <svg width={40} height={40} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 16V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  )
}
function VolumeIcon() {
  return <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" /></svg>
}
function DownloadIcon() {
  return <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v12M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 20h16" strokeLinecap="round" /></svg>
}
function RefreshIcon() {
  return <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" /></svg>
}

// ── Custom Tooltips ───────────────────────────────────────────────────────────
function WaveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1526] border border-[#1e2e4a] rounded px-3 py-1.5 text-xs mono shadow-lg">
      <p className="text-[#64748b]">t = {label} s</p>
      <p className="text-[#22d3ee]">Amplitude = {payload[0]?.value}</p>
    </div>
  )
}

function FFTTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1526] border border-[#1e2e4a] rounded px-3 py-1.5 text-xs mono shadow-lg">
      <p className="text-[#64748b]">{label} Hz</p>
      <p className="text-[#22d3ee]">Magnitude |X(f)| = {payload[0]?.value}</p>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, sub, accent = false
}: { label: string; value: string; unit: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl p-5 border flex flex-col gap-2 transition-all duration-200 ${
        accent
          ? 'bg-[#0d1c3a] border-[#22d3ee]/40 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
          : 'bg-[#111d33] border-[#1e2e4a] hover:border-[#2a4070]'
      }`}
    >
      <p className="text-[11px] uppercase tracking-widest text-[#64748b] font-medium">{label}</p>
      <div className="flex items-end gap-1.5">
        <span className={`text-2xl font-bold mono leading-none ${accent ? 'text-[#22d3ee]' : 'text-[#e2e8f0]'}`}>
          {value}
        </span>
        <span className={`text-sm pb-0.5 ${accent ? 'text-[#22d3ee]/70' : 'text-[#64748b]'}`}>{unit}</span>
      </div>
      {sub && <p className="text-[11px] text-[#64748b] truncate">{sub}</p>}
    </div>
  )
}

// ── Card Container ────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111d33] border border-[#1e2e4a] rounded-xl ${className}`}>
      {children}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [file, setFile] = useState<File | null>(null)
  const [signalData, setSignalData] = useState<AudioSignalData>(generateDemoAudioData)
  const [isDemo, setIsDemo] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzed, setAnalyzed] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Player state
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(80)
  const [currentTime, setCurrentTime] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const synthOscRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stop synthetic audio if any
  const stopSyntheticTone = useCallback(() => {
    if (synthOscRef.current) {
      try {
        synthOscRef.current.osc.stop()
        synthOscRef.current.ctx.close()
      } catch {}
      synthOscRef.current = null
    }
  }, [])

  // Process file upload
  const loadFile = (f: File) => {
    stopSyntheticTone()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)

    setFile(f)
    setIsDemo(false)
    setAnalyzed(false)
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    setAnalysisError(null)

    const url = URL.createObjectURL(f)
    audioUrlRef.current = url
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.load()
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && (dropped.name.toLowerCase().endsWith('.wav') || dropped.type.includes('audio'))) {
      loadFile(dropped)
    } else {
      setAnalysisError('Please upload a valid WAV audio file (.wav).')
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  // Audio Playback
  const togglePlay = () => {
    if (playing) {
      if (isDemo) {
        stopSyntheticTone()
      } else if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlaying(false)
      if (progressInterval.current) clearInterval(progressInterval.current)
      return
    }

    if (isDemo) {
      // Synthesize demo tone (440 Hz) using Web Audio API
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        gain.gain.setValueAtTime((volume / 100) * 0.25, ctx.currentTime)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()

        synthOscRef.current = { ctx, osc, gain }
        setPlaying(true)

        const startT = Date.now()
        const demoDuration = 2.0
        progressInterval.current = setInterval(() => {
          const elapsed = (Date.now() - startT) / 1000
          if (elapsed >= demoDuration) {
            stopSyntheticTone()
            setPlaying(false)
            setProgress(0)
            setCurrentTime(0)
            clearInterval(progressInterval.current!)
          } else {
            setCurrentTime(elapsed)
            setProgress((elapsed / demoDuration) * 100)
          }
        }, 50)
      } catch (err) {
        console.error('Web Audio synth error:', err)
      }
    } else if (audioRef.current && file) {
      audioRef.current.volume = volume / 100
      audioRef.current.play().then(() => {
        setPlaying(true)
        progressInterval.current = setInterval(() => {
          if (audioRef.current) {
            const dur = audioRef.current.duration || signalData.duration || 1
            const ct = audioRef.current.currentTime
            setCurrentTime(ct)
            setProgress((ct / dur) * 100)
            if (ct >= dur) {
              setPlaying(false)
              setProgress(0)
              setCurrentTime(0)
              clearInterval(progressInterval.current!)
            }
          }
        }, 100)
      }).catch(err => {
        console.warn('Playback error:', err)
      })
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || isDemo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const dur = audioRef.current.duration || signalData.duration || 1
    audioRef.current.currentTime = pct * dur
    setProgress(pct * 100)
    setCurrentTime(pct * dur)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v / 100
    if (synthOscRef.current) {
      synthOscRef.current.gain.gain.setValueAtTime((v / 100) * 0.25, synthOscRef.current.ctx.currentTime)
    }
  }

  // DSP Analysis Handler (Runs Real FFT & Waveform Extraction)
  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    setAnalysisError(null)

    try {
      // Decode WAV and calculate real Cooley-Tukey Radix-2 FFT
      const results = await analyzeAudioFile(file)
      setSignalData(results)
      setAnalyzed(true)
    } catch (err: any) {
      console.error('DSP Analysis error:', err)
      setAnalysisError(err?.message || 'Failed to decode and analyze WAV audio file.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = () => {
    stopSyntheticTone()
    setFile(null)
    setIsDemo(true)
    setSignalData(generateDemoAudioData())
    setAnalyzed(true)
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    setAnalysisError(null)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Export DSP Report
  const handleDownload = () => {
    const lines = [
      '========================================================================',
      '      AUDIO FREQUENCY ANALYZER — DIGITAL SIGNAL PROCESSING REPORT',
      '========================================================================',
      `Generated At        : ${new Date().toLocaleString()}`,
      `File Name           : ${signalData.fileName}`,
      `File Size           : ${(signalData.fileSize / 1024).toFixed(2)} KB`,
      `Sampling Rate (Fs)  : ${signalData.sampleRate.toLocaleString()} Hz`,
      `Nyquist Frequency   : ${signalData.nyquistFrequency.toLocaleString()} Hz`,
      `Duration            : ${signalData.duration.toFixed(2)} s`,
      `Total Samples (N)   : ${signalData.totalSamples.toLocaleString()} samples`,
      `Channels            : ${signalData.channels === 1 ? 'Mono' : 'Stereo'}`,
      '------------------------------------------------------------------------',
      'FAST FOURIER TRANSFORM (FFT) ANALYSIS RESULTS',
      '------------------------------------------------------------------------',
      `Analysis Algorithm  : Radix-2 Cooley-Tukey FFT with Hann Windowing`,
      `Dominant Frequency  : ${signalData.dominantFrequency} Hz`,
      `Nearest Pitch Note  : ${signalData.nearestNote} (${signalData.noteDeviationCents >= 0 ? '+' : ''}${signalData.noteDeviationCents} cents)`,
      `Normalized Peak Mag : ${signalData.peakMagnitude}`,
      `Secondary Harmonics : ${signalData.secondaryHarmonics.length > 0 ? signalData.secondaryHarmonics.map(h => `${h} Hz`).join(', ') : 'None detected'}`,
      '',
      'SIGNAL INTERPRETATION:',
      `The discrete audio signal displays a primary spectral component centered at ${signalData.dominantFrequency} Hz.`,
      signalData.secondaryHarmonics.length > 0
        ? `Secondary harmonic peaks were detected at ${signalData.secondaryHarmonics.join(', ')} Hz, indicating a non-pure tone or harmonic instrument source.`
        : 'The frequency spectrum indicates a clean fundamental frequency with minimal harmonic distortion.',
      '========================================================================',
      'End of Digital Signal Processing Analysis Report.',
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DSP_Report_${signalData.fileName.replace(/\.[^/.]+$/, '')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  useEffect(() => {
    return () => {
      stopSyntheticTone()
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [stopSyntheticTone])

  // Filter FFT data points to keep bar chart responsive
  const fftChartData = signalData.fftData.filter((_, i) => i % 2 === 0)

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, sans-serif', background: '#080d1a', color: '#e2e8f0' }}>
      <audio ref={audioRef} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#1e2e4a] bg-[#0d1526]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1e2e4a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 flex items-center justify-center text-[#22d3ee]">
              <SpectrumIcon size={16} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#e2e8f0] leading-tight">AFA</p>
              <p className="text-[10px] text-[#64748b] leading-tight uppercase tracking-wider mono">DSP Analyzer</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 text-left w-full ${
                activeNav === id
                  ? 'bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/25 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#111d33]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Demo tone quick switch */}
        <div className="px-3 pb-3">
          <button
            onClick={handleReset}
            className="w-full py-2 px-3 rounded-lg text-[11px] font-medium bg-[#111d33] border border-[#1e2e4a] text-[#94a3b8] hover:text-[#22d3ee] hover:border-[#22d3ee]/30 transition-all flex items-center justify-between"
          >
            <span>Load 440 Hz Demo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]" />
          </button>
        </div>

        {/* Info Box */}
        <div className="mx-3 mb-4 p-3 rounded-lg bg-[#111d33] border border-[#1e2e4a]">
          <p className="text-[10px] text-[#64748b] leading-relaxed">
            Analyze audio signals in time and frequency domains using Fast Fourier Transform.
          </p>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-[#1e2e4a] bg-[#0d1526]">
          <div>
            <h1 className="text-lg font-bold text-[#e2e8f0] leading-tight tracking-tight">
              Audio Frequency Analyzer
            </h1>
            <p className="text-[11px] text-[#64748b] mt-0.5 mono">Digital Signal Processing — FFT Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-[#22d3ee] border border-[#22d3ee]/30 mono">
                Demo Mode
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-[11px] text-[#94a3b8] mono">{analyzing ? 'Processing FFT…' : 'Ready'}</span>
            </div>
          </div>
        </header>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* About DSP View */}
          {activeNav === 'about' && (
            <Card className="p-6 space-y-4">
              <div className="border-b border-[#1e2e4a] pb-3">
                <h2 className="text-base font-bold text-[#22d3ee]">Digital Signal Processing (DSP) &amp; FFT Overview</h2>
                <p className="text-xs text-[#64748b] mt-1">Mathematical foundations of discrete audio spectrum analysis.</p>
              </div>

              <div className="grid grid-cols-2 gap-5 text-xs text-[#94a3b8] leading-relaxed">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#e2e8f0]">1. Fast Fourier Transform (FFT)</h3>
                  <p>
                    The Discrete Fourier Transform (DFT) transforms a time-domain signal $x(n)$ into its complex frequency-domain spectrum $X(k)$:
                  </p>
                  <div className="p-3 bg-[#0d1526] border border-[#1e2e4a] rounded-lg mono text-[11px] text-[#22d3ee]">
                    X(k) = Σ [n=0 to N-1] x(n) · e^(-j · 2π · k · n / N)
                  </div>
                  <p>
                    By implementing the <strong>Radix-2 Cooley-Tukey algorithm</strong> with bit-reversal sorting and butterfly computation stages, computation complexity drops from O(N²) to O(N log N).
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#e2e8f0]">2. Nyquist-Shannon Sampling Theorem</h3>
                  <p>
                    To capture all frequencies without aliasing, the sampling rate (fs) must be at least twice the maximum frequency component (f_max):
                  </p>
                  <div className="p-3 bg-[#0d1526] border border-[#1e2e4a] rounded-lg mono text-[11px] text-[#22d3ee]">
                    f_nyquist = f_s / 2
                  </div>
                  <p>
                    For CD quality audio sampled at <strong>44,100 Hz</strong>, the audible band extends up to <strong>22,050 Hz</strong>. Window functions (such as Hann) are applied prior to FFT to attenuate spectral leakage at boundary samples.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setActiveNav('dashboard')}
                  className="px-4 py-2 rounded-lg bg-[#22d3ee] text-[#080d1a] font-semibold text-xs hover:bg-[#38bdf8] transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </Card>
          )}

          {/* Error Banner */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center justify-between">
              <span>{analysisError}</span>
              <button onClick={() => setAnalysisError(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
            </div>
          )}

          {/* Main Dashboard Rows */}
          {(activeNav === 'dashboard' || activeNav === 'analysis' || activeNav === 'fft') && (
            <>
              {/* Row 1: Upload + Audio Player */}
              <div className="grid grid-cols-2 gap-5">

                {/* Upload Card */}
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mb-4">
                    Upload Audio Signal
                  </p>

                  {!file ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-all duration-200 ${
                        isDragging
                          ? 'border-[#22d3ee]/60 bg-[#22d3ee]/5'
                          : 'border-[#1e2e4a] hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/5'
                      }`}
                    >
                      <div className={`${isDragging ? 'text-[#22d3ee]' : 'text-[#2a4070]'} transition-colors`}>
                        <UploadIcon />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-[#94a3b8] font-medium">Drag &amp; drop your WAV file here</p>
                        <p className="text-[11px] text-[#64748b] mt-1">or click to browse</p>
                      </div>
                      <button
                        type="button"
                        className="mt-1 px-4 py-1.5 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee] text-[12px] font-medium hover:bg-[#22d3ee]/20 transition-colors pointer-events-none"
                      >
                        Browse File
                      </button>
                      <p className="text-[10px] text-[#4a5568] mono">Supported: .wav — Max 50 MB</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1526] border border-[#22d3ee]/20">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-[#22d3ee]/10 flex items-center justify-center flex-shrink-0 text-[#22d3ee]">
                            <WaveIcon size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#e2e8f0] truncate">{file.name}</p>
                            <p className="text-[10px] text-[#64748b] mono">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-[#22d3ee] hover:underline mono ml-2 flex-shrink-0"
                        >
                          Change
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {[
                          ['Duration', `${signalData.duration.toFixed(2)} s`],
                          ['Sample Rate', `${signalData.sampleRate.toLocaleString()} Hz`],
                          ['Samples', signalData.totalSamples.toLocaleString()],
                          ['Channels', signalData.channels === 1 ? '1 (Mono)' : '2 (Stereo)'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between p-2 rounded bg-[#0d1526]">
                            <span className="text-[#64748b]">{k}</span>
                            <span className="text-[#94a3b8] mono font-medium">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept=".wav,audio/wav,audio/wave" className="hidden" onChange={handleFileInput} />
                </Card>

                {/* Audio Player Card */}
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mb-4">
                    Audio Player
                  </p>

                  <div className="flex flex-col gap-4">
                    {/* Track info */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0d1526] border border-[#1e2e4a]">
                      <div className="w-7 h-7 rounded bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0 text-[#3b82f6]">
                        <WaveIcon size={13} />
                      </div>
                      <p className="text-[12px] text-[#94a3b8] truncate mono">
                        {isDemo ? 'demo_440hz_tone.wav (Synthesized Demo)' : file?.name ?? '— No file loaded'}
                      </p>
                    </div>

                    {/* Play controls */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlay}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          file || isDemo
                            ? 'bg-[#22d3ee] text-[#080d1a] hover:bg-[#38bdf8] shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                            : 'bg-[#1e2e4a] text-[#2a4070] cursor-not-allowed'
                        }`}
                        title={playing ? 'Pause' : 'Play audio'}
                      >
                        {playing ? <PauseIcon /> : <PlayIcon />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div
                          className="h-2 rounded-full bg-[#1e2e4a] cursor-pointer relative overflow-hidden"
                          onClick={handleProgressClick}
                        >
                          <div
                            className="h-full rounded-full bg-[#22d3ee] transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] mono text-[#64748b]">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(signalData.duration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-3">
                      <span className="text-[#64748b]"><VolumeIcon /></span>
                      <input
                        type="range" min={0} max={100} value={volume}
                        onChange={handleVolumeChange}
                        className="flex-1 h-1.5 accent-[#22d3ee]"
                      />
                      <span className="text-[10px] mono text-[#64748b] w-8 text-right">{volume}%</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Row 2: 4 Stat Cards */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  label="Sampling Rate"
                  value={signalData.sampleRate.toLocaleString()}
                  unit="Hz"
                  sub={signalData.sampleRate >= 44100 ? 'Standard CD quality' : 'Audio sampling rate'}
                />
                <StatCard
                  label="Duration"
                  value={signalData.duration.toFixed(2)}
                  unit="s"
                  sub="Total signal length"
                />
                <StatCard
                  label="Samples"
                  value={signalData.totalSamples.toLocaleString()}
                  unit="pts"
                  sub="N = sr × duration"
                />
                <StatCard
                  label="Dominant Frequency"
                  value={signalData.dominantFrequency.toLocaleString()}
                  unit="Hz"
                  sub={`Nearest Note: ${signalData.nearestNote}`}
                  accent
                />
              </div>

              {/* Row 3: Waveform Visualization */}
              {(activeNav === 'dashboard' || activeNav === 'analysis') && (
                <Card className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[13px] font-semibold text-[#e2e8f0]">Time Domain — Waveform</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Amplitude of the audio signal over time.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 px-2 py-0.5 rounded">
                        x(t)
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={activeNav === 'analysis' ? 260 : 180}>
                    <LineChart data={signalData.waveformData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2e4a" vertical={false} />
                      <XAxis
                        dataKey="t" tickLine={false} axisLine={false}
                        tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={v => `${v}s`}
                        interval={Math.floor(signalData.waveformData.length / 6)}
                      />
                      <YAxis
                        tickLine={false} axisLine={false}
                        tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                        domain={[-1.2, 1.2]}
                        tickCount={5}
                      />
                      <Tooltip content={<WaveTooltip />} />
                      <ReferenceLine y={0} stroke="#2a4070" strokeWidth={1} />
                      <Line
                        type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={1.5}
                        dot={false} activeDot={{ r: 3, fill: '#22d3ee' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Row 4: FFT Spectrum Visualization */}
              {(activeNav === 'dashboard' || activeNav === 'fft') && (
                <Card className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#e2e8f0]">Frequency Domain — FFT Spectrum</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        Frequency components obtained using Fast Fourier Transform (FFT).
                      </p>
                    </div>
                    <span className="mono text-[10px] text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded">
                      |X(f)|
                    </span>
                  </div>

                  {/* Dominant freq badge */}
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
                      <span className="text-[11px] mono font-semibold text-[#22d3ee]">
                        Dominant Frequency: {signalData.dominantFrequency} Hz ({signalData.nearestNote})
                      </span>
                    </div>
                    {signalData.secondaryHarmonics.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] mono text-[#3b82f6]">
                        <span>Harmonics: {signalData.secondaryHarmonics.join(', ')} Hz</span>
                      </div>
                    )}
                  </div>

                  <ResponsiveContainer width="100%" height={activeNav === 'fft' ? 280 : 200}>
                    <BarChart data={fftChartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }} barCategoryGap={0}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2e4a" vertical={false} />
                      <XAxis
                        dataKey="hz" tickLine={false} axisLine={false}
                        tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={v => `${v}`}
                        interval={Math.floor(fftChartData.length / 8)}
                        label={{ value: 'Hz', position: 'insideRight', fill: '#64748b', fontSize: 10 }}
                      />
                      <YAxis
                        tickLine={false} axisLine={false}
                        tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                        domain={[0, 1]}
                        tickCount={4}
                      />
                      <Tooltip content={<FFTTooltip />} />
                      <Bar dataKey="mag" radius={[1, 1, 0, 0]}>
                        {fftChartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.dominant ? '#22d3ee' : entry.isHarmonic ? '#38bdf8' : entry.mag > 0.2 ? '#3b82f6' : '#1d4ed8'}
                            opacity={entry.dominant ? 1 : entry.isHarmonic ? 0.9 : entry.mag > 0.2 ? 0.8 : 0.45}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Row 5: Analysis Result & Action Buttons */}
              <div className="grid grid-cols-2 gap-5">

                {/* Analysis Result Card */}
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mb-4">
                    Analysis Result
                  </p>

                  {analyzed ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-[#22d3ee]/5 border border-[#22d3ee]/20 mb-2">
                        <p className="text-[11px] text-[#22d3ee]/90 leading-relaxed">
                          The analyzed signal contains a dominant frequency component around{' '}
                          <span className="font-semibold text-[#22d3ee]">{signalData.dominantFrequency} Hz</span>
                          {signalData.nearestNote ? ` (nearest note ${signalData.nearestNote})` : ''}.
                          {signalData.secondaryHarmonics.length > 0 && (
                            <> Secondary harmonics detected at {signalData.secondaryHarmonics.map(h => `${h} Hz`).join(', ')}.</>
                          )}
                        </p>
                      </div>

                      {[
                        ['Dominant Frequency', `${signalData.dominantFrequency} Hz`],
                        ['Musical Pitch', `${signalData.nearestNote} (${signalData.noteDeviationCents >= 0 ? '+' : ''}${signalData.noteDeviationCents} cents)`],
                        ['Peak Magnitude', `${signalData.peakMagnitude}`],
                        ['Nyquist Limit', `${signalData.nyquistFrequency.toLocaleString()} Hz`],
                        ['Analysis Method', 'Radix-2 Cooley-Tukey FFT (Hann Window)'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between py-2 border-b border-[#1e2e4a] last:border-0">
                          <span className="text-[12px] text-[#64748b]">{k}</span>
                          <span className="text-[12px] font-semibold mono text-[#e2e8f0]">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1e2e4a] flex items-center justify-center text-[#22d3ee]">
                        <SpectrumIcon size={18} />
                      </div>
                      <p className="text-[12px] text-[#64748b] text-center">
                        Upload a WAV file and click<br />"Analyze Signal" to run FFT.
                      </p>
                    </div>
                  )}
                </Card>

                {/* Actions Card */}
                <Card className="p-5 flex flex-col gap-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
                    Actions
                  </p>

                  <button
                    onClick={handleAnalyze}
                    disabled={!file || analyzing}
                    className={`w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                      file && !analyzing
                        ? 'bg-[#22d3ee] text-[#080d1a] hover:bg-[#38bdf8] shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                        : 'bg-[#1e2e4a] text-[#2a4070] cursor-not-allowed'
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Computing FFT Analysis…
                      </>
                    ) : (
                      <><SpectrumIcon size={14} /> Analyze Signal</>
                    )}
                  </button>

                  <button
                    onClick={handleReset}
                    className="w-full py-3 rounded-xl text-[13px] font-medium text-[#94a3b8] border border-[#1e2e4a] flex items-center justify-center gap-2 hover:border-[#2a4070] hover:text-[#e2e8f0] transition-all duration-200"
                  >
                    <RefreshIcon /> Reset / Load Demo
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!analyzed}
                    className={`w-full py-3 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 border transition-all duration-200 ${
                      analyzed
                        ? 'border-[#3b82f6]/40 text-[#3b82f6] hover:bg-[#3b82f6]/10'
                        : 'border-[#1e2e4a] text-[#2a4070] cursor-not-allowed'
                    }`}
                  >
                    <DownloadIcon /> Download Result (.txt)
                  </button>

                  {/* Legend */}
                  <div className="mt-auto pt-4 border-t border-[#1e2e4a] grid grid-cols-2 gap-2 text-[10px] text-[#64748b] mono">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22d3ee]" />dominant peak</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#38bdf8]" />harmonics</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1d4ed8]" />noise floor</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />signal ready</div>
                  </div>
                </Card>
              </div>
            </>
          )}

          <div className="h-4" />
        </div>
      </main>
    </div>
  )
}
