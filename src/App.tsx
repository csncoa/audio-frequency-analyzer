import { useState, useRef, useCallback, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

// ── Sidebar nav items ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',       icon: GridIcon },
  { id: 'analysis',   label: 'Audio Analysis',  icon: WaveIcon },
  { id: 'fft',        label: 'FFT Spectrum',     icon: SpectrumIcon },
  { id: 'about',      label: 'About',            icon: InfoIcon },
]

// ── Generate demo data (440 Hz in 44100 Hz) ────────────────────────────────────
function generateWaveform(samples = 300): { t: number; v: number }[] {
  const sr = 44100
  const duration = 2
  const f = 440
  const f2 = 880
  const noise = 0.06
  return Array.from({ length: samples }, (_, i) => {
    const t = (i / samples) * duration
    const v =
      0.70 * Math.sin(2 * Math.PI * f * t) +
      0.20 * Math.sin(2 * Math.PI * f2 * t) +
      0.06 * Math.sin(2 * Math.PI * 1320 * t) +
      (Math.random() - 0.5) * noise
    return { t: parseFloat(t.toFixed(4)), v: parseFloat(v.toFixed(4)) }
  })
}

function generateFFT(): { hz: number; mag: number; dominant: boolean }[] {
  const bins: { hz: number; mag: number; dominant: boolean }[] = []
  // Create bins from 0 to 5000 Hz (display range)
  for (let hz = 0; hz <= 5000; hz += 10) {
    let mag = 0
    // 440 Hz fundamental — dominant
    mag += 0.85 * Math.exp(-Math.pow((hz - 440) / 8, 2))
    // 880 Hz 2nd harmonic
    mag += 0.35 * Math.exp(-Math.pow((hz - 880) / 10, 2))
    // 1320 Hz 3rd harmonic
    mag += 0.18 * Math.exp(-Math.pow((hz - 1320) / 12, 2))
    // 1760 Hz 4th harmonic (faint)
    mag += 0.09 * Math.exp(-Math.pow((hz - 1760) / 14, 2))
    // noise floor
    mag += Math.random() * 0.015
    bins.push({ hz, mag: parseFloat(mag.toFixed(4)), dominant: hz >= 430 && hz <= 450 })
  }
  return bins
}

const WAVEFORM_DATA = generateWaveform()
const FFT_DATA = generateFFT()

// ── Tiny SVG icons ─────────────────────────────────────────────────────────────
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

// ── Custom tooltip for charts ──────────────────────────────────────────────────
function WaveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1526] border border-[#1e2e4a] rounded px-3 py-1.5 text-xs mono">
      <p className="text-[#64748b]">t = {label}s</p>
      <p className="text-[#22d3ee]">A = {payload[0]?.value}</p>
    </div>
  )
}
function FFTTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1526] border border-[#1e2e4a] rounded px-3 py-1.5 text-xs mono">
      <p className="text-[#64748b]">{label} Hz</p>
      <p className="text-[#22d3ee]">|X| = {payload[0]?.value}</p>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, sub, accent = false
}: { label: string; value: string; unit: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl p-5 border flex flex-col gap-2 transition-all duration-200 ${
        accent
          ? 'bg-[#0d1c3a] border-[#22d3ee]/30 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
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
      {sub && <p className="text-[11px] text-[#64748b]">{sub}</p>}
    </div>
  )
}

// ── Section card wrapper ───────────────────────────────────────────────────────
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
  const [isDragging, setIsDragging] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(80)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const duration = 2.00
  const sampleRate = 44100
  const samples = 88200

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && (dropped.name.endsWith('.wav') || dropped.type === 'audio/wav' || dropped.type === 'audio/wave')) {
      loadFile(dropped)
    }
  }, [])

  const loadFile = (f: File) => {
    setFile(f)
    setAnalyzed(false)
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    const url = URL.createObjectURL(f)
    audioUrlRef.current = url
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.load()
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  const togglePlay = () => {
    if (!audioRef.current || !file) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      if (progressInterval.current) clearInterval(progressInterval.current)
    } else {
      audioRef.current.volume = volume / 100
      audioRef.current.play().catch(() => {})
      setPlaying(true)
      progressInterval.current = setInterval(() => {
        if (audioRef.current) {
          const dur = audioRef.current.duration || duration
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
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const dur = audioRef.current.duration || duration
    audioRef.current.currentTime = pct * dur
    setProgress(pct * 100)
    setCurrentTime(pct * dur)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v / 100
  }

  const handleAnalyze = () => {
    if (!file) return
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      setAnalyzed(true)
    }, 1200)
  }

  const handleReset = () => {
    setFile(null)
    setAnalyzed(false)
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
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

  const handleDownload = () => {
    const lines = [
      'Audio Frequency Analyzer — FFT Analysis Report',
      '================================================',
      `File: ${file?.name ?? 'demo_440hz.wav'}`,
      `Sampling Rate: ${sampleRate.toLocaleString()} Hz`,
      `Duration: ${duration.toFixed(2)} s`,
      `Samples: ${samples.toLocaleString()}`,
      '',
      'FFT Results',
      '-----------',
      'Dominant Frequency: 440 Hz',
      'Peak Magnitude: 0.85',
      'Frequency Range: 0 – 22,050 Hz',
      'Analysis Method: Fast Fourier Transform (FFT)',
      '',
      'Interpretation:',
      'The analyzed signal contains a dominant frequency component at 440 Hz (A4 musical note).',
      'Secondary harmonics detected at 880 Hz and 1,320 Hz.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'fft_analysis_report.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  // Decimate FFT data for chart performance
  const fftChartData = FFT_DATA.filter((_, i) => i % 2 === 0)

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, sans-serif', background: '#080d1a', color: '#e2e8f0' }}>
      <audio ref={audioRef} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[#1e2e4a] bg-[#0d1526]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1e2e4a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#22d3ee]/10 border border-[#22d3ee]/30 flex items-center justify-center">
              <SpectrumIcon size={14} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#e2e8f0] leading-tight">AFA</p>
              <p className="text-[9px] text-[#64748b] leading-tight uppercase tracking-wider">DSP Analyzer</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left w-full ${
                activeNav === id
                  ? 'bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#111d33]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Info blurb */}
        <div className="mx-3 mb-4 p-3 rounded-lg bg-[#111d33] border border-[#1e2e4a]">
          <p className="text-[10px] text-[#64748b] leading-relaxed">
            Analyze audio signals in time and frequency domains using Fast Fourier Transform.
          </p>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-7 py-4 border-b border-[#1e2e4a] bg-[#0d1526]">
          <div>
            <h1 className="text-lg font-bold text-[#e2e8f0] leading-tight tracking-tight">
              Audio Frequency Analyzer
            </h1>
            <p className="text-[11px] text-[#64748b] mt-0.5 mono">Digital Signal Processing — FFT Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-[#64748b] mono">Ready</span>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {/* Row 1: Upload + Player */}
          <div className="grid grid-cols-2 gap-5">

            {/* Upload */}
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
                  <button className="mt-1 px-4 py-1.5 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee] text-[12px] font-medium hover:bg-[#22d3ee]/20 transition-colors">
                    Browse File
                  </button>
                  <p className="text-[10px] text-[#4a5568] mono">Supported: .wav — Max 50 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1526] border border-[#22d3ee]/20">
                    <div className="w-8 h-8 rounded bg-[#22d3ee]/10 flex items-center justify-center flex-shrink-0">
                      <WaveIcon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#e2e8f0] truncate">{file.name}</p>
                      <p className="text-[10px] text-[#64748b] mono">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {[
                      ['Duration', `${duration.toFixed(2)} s`],
                      ['Sample Rate', `${sampleRate.toLocaleString()} Hz`],
                      ['Samples', samples.toLocaleString()],
                      ['Channels', '1 (Mono)'],
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

            {/* Audio player */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mb-4">
                Audio Player
              </p>
              <div className="flex flex-col gap-4">
                {/* Filename */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0d1526] border border-[#1e2e4a]">
                  <div className="w-7 h-7 rounded bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                    <WaveIcon size={13} />
                  </div>
                  <p className="text-[12px] text-[#94a3b8] truncate mono">{file?.name ?? '—  No file loaded'}</p>
                </div>

                {/* Play controls */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    disabled={!file}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      file
                        ? 'bg-[#22d3ee] text-[#080d1a] hover:bg-[#38bdf8] shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                        : 'bg-[#1e2e4a] text-[#2a4070] cursor-not-allowed'
                    }`}
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
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3">
                  <VolumeIcon />
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

          {/* Row 2: Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Sampling Rate" value="44,100" unit="Hz" sub="Standard CD quality" />
            <StatCard label="Duration" value="2.00" unit="s" sub="Total signal length" />
            <StatCard label="Samples" value="88,200" unit="pts" sub="N = sr × duration" />
            <StatCard label="Dominant Frequency" value="440" unit="Hz" sub="A4 musical note" accent />
          </div>

          {/* Row 3: Waveform */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] font-semibold text-[#e2e8f0]">Time Domain — Waveform</p>
                <p className="text-[11px] text-[#64748b] mt-0.5">Amplitude of the audio signal over time.</p>
              </div>
              <span className="mono text-[10px] text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 px-2 py-0.5 rounded">
                x(t)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={WAVEFORM_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2e4a" vertical={false} />
                <XAxis
                  dataKey="t" tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `${v}s`}
                  interval={Math.floor(WAVEFORM_DATA.length / 6)}
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

          {/* Row 4: FFT Spectrum */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] font-semibold text-[#e2e8f0]">Frequency Domain — FFT Spectrum</p>
                <p className="text-[11px] text-[#64748b] mt-0.5">Frequency components obtained using Fast Fourier Transform (FFT).</p>
              </div>
              <span className="mono text-[10px] text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded">
                |X(f)|
              </span>
            </div>

            {/* Dominant freq label */}
            <div className="mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
              <span className="text-[11px] mono font-semibold text-[#22d3ee]">Dominant Frequency: 440 Hz</span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fftChartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }} barCategoryGap={0}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2e4a" vertical={false} />
                <XAxis
                  dataKey="hz" tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `${v}`}
                  interval={Math.floor(fftChartData.length / 7)}
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
                      fill={entry.dominant ? '#22d3ee' : entry.mag > 0.25 ? '#3b82f6' : '#1d4ed8'}
                      opacity={entry.dominant ? 1 : entry.mag > 0.25 ? 0.85 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Row 5: Analysis result + Actions */}
          <div className="grid grid-cols-2 gap-5">

            {/* Analysis result */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b] mb-4">
                Analysis Result
              </p>
              {analyzed ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#22d3ee]/5 border border-[#22d3ee]/20 mb-2">
                    <p className="text-[11px] text-[#22d3ee]/80 leading-relaxed">
                      The analyzed signal contains a dominant frequency component around{' '}
                      <span className="font-semibold text-[#22d3ee]">440 Hz</span>, corresponding to
                      the musical note A4. Secondary harmonics at 880 Hz and 1,320 Hz are also present.
                    </p>
                  </div>
                  {[
                    ['Dominant Frequency', '440 Hz'],
                    ['Peak Magnitude', '0.85'],
                    ['Frequency Range', '0 – 22,050 Hz'],
                    ['Analysis Method', 'Fast Fourier Transform (FFT)'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-[#1e2e4a] last:border-0">
                      <span className="text-[12px] text-[#64748b]">{k}</span>
                      <span className="text-[12px] font-semibold mono text-[#e2e8f0]">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1e2e4a] flex items-center justify-center">
                    <SpectrumIcon size={18} />
                  </div>
                  <p className="text-[12px] text-[#64748b] text-center">
                    Upload a WAV file and click<br />"Analyze Signal" to see results.
                  </p>
                </div>
              )}
            </Card>

            {/* Actions */}
            <Card className="p-5 flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
                Actions
              </p>

              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className={`w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                  file && !analyzing
                    ? 'bg-[#22d3ee] text-[#080d1a] hover:bg-[#38bdf8] shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                    : 'bg-[#1e2e4a] text-[#2a4070] cursor-not-allowed'
                }`}
              >
                {analyzing ? (
                  <>
                    <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Analyzing…
                  </>
                ) : (
                  <><SpectrumIcon size={14} /> Analyze Signal</>
                )}
              </button>

              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl text-[13px] font-medium text-[#94a3b8] border border-[#1e2e4a] flex items-center justify-center gap-2 hover:border-[#2a4070] hover:text-[#e2e8f0] transition-all duration-200"
              >
                <RefreshIcon /> Reset
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
                <DownloadIcon /> Download Result
              </button>

              {/* Legend */}
              <div className="mt-auto pt-4 border-t border-[#1e2e4a] grid grid-cols-2 gap-2 text-[10px] text-[#64748b] mono">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22d3ee]" />440 Hz dominant</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" />harmonics</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1d4ed8]" />noise floor</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />signal active</div>
              </div>
            </Card>
          </div>

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </main>
    </div>
  )
}
