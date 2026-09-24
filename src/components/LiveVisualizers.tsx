import { useEffect, useRef } from 'react'
import { RealtimeAudioAnalyzer } from '../utils/realtimeAudio'

interface LiveOscilloscopeProps {
  analyzer: RealtimeAudioAnalyzer
  isPlaying: boolean
  height?: number
}

/**
 * 60fps High-Performance Real-time Oscilloscope (Time-Domain Waveform)
 */
export function LiveOscilloscope({ analyzer, isPlaying, height = 180 }: LiveOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const render = () => {
      if (!running) return

      const width = canvas.width
      const h = canvas.height

      // Dark background
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, width, h)

      // Grid lines
      ctx.strokeStyle = '#142036'
      ctx.lineWidth = 1
      ctx.beginPath()
      // Center zero line
      ctx.moveTo(0, h / 2)
      ctx.lineTo(width, h / 2)
      // Top & bottom grid
      ctx.moveTo(0, h * 0.25); ctx.lineTo(width, h * 0.25)
      ctx.moveTo(0, h * 0.75); ctx.lineTo(width, h * 0.75)
      ctx.stroke()

      const data = analyzer.getByteTimeDomainData()

      if (data && isPlaying) {
        ctx.lineWidth = 2
        ctx.strokeStyle = '#22d3ee'
        ctx.shadowColor = '#22d3ee'
        ctx.shadowBlur = 8
        ctx.beginPath()

        const sliceWidth = width / data.length
        let x = 0

        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0 // Normalized [0, 2] -> 1 is center
          const y = (v * h) / 2

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
          x += sliceWidth
        }

        ctx.lineTo(width, h / 2)
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        // Flat center line when idle
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#1e2e4a'
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(width, h / 2)
        ctx.stroke()
      }

      if (isPlaying) {
        animRef.current = requestAnimationFrame(render)
      }
    }

    render()

    return () => {
      running = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [analyzer, isPlaying])

  return (
    <div className="w-full rounded-lg overflow-hidden border border-[#1e2e4a] bg-[#080d1a] relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full h-full block"
      />
      <div className="absolute top-2 right-3 pointer-events-none flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#22d3ee] animate-pulse' : 'bg-[#64748b]'}`} />
        <span className="text-[10px] mono text-[#64748b]">
          {isPlaying ? 'LIVE OSCILLOSCOPE (60 FPS)' : 'STANDBY'}
        </span>
      </div>
    </div>
  )
}

interface LiveSpectrumBarsProps {
  analyzer: RealtimeAudioAnalyzer
  isPlaying: boolean
  height?: number
  onLiveDominantChange?: (info: { freq: number; note: string; magnitude: number }) => void
}

/**
 * 60fps High-Performance Real-time Frequency Spectrum Analyzer
 */
export function LiveSpectrumBars({ analyzer, isPlaying, height = 200, onLiveDominantChange }: LiveSpectrumBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number | null>(null)
  const lastCallbackTime = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const render = (time: number) => {
      if (!running) return

      const width = canvas.width
      const h = canvas.height

      // Background
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, width, h)

      // Subtle horizontal grid
      ctx.strokeStyle = '#142036'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h * 0.25); ctx.lineTo(width, h * 0.25)
      ctx.moveTo(0, h * 0.50); ctx.lineTo(width, h * 0.50)
      ctx.moveTo(0, h * 0.75); ctx.lineTo(width, h * 0.75)
      ctx.stroke()

      const data = analyzer.getByteFrequencyData()

      if (data && isPlaying) {
        // Show frequency range up to ~5000 Hz
        const bufferLength = Math.min(data.length, 256)
        const barWidth = (width / bufferLength) * 1.4
        let x = 0

        // Find max peak for live stats
        let maxVal = 0
        let maxIdx = 0

        for (let i = 0; i < bufferLength; i++) {
          const val = data[i]
          if (i > 2 && val > maxVal) {
            maxVal = val
            maxIdx = i
          }

          const barHeight = (val / 255) * (h - 20)

          // Gradient color: Cyan at top, Blue at bottom
          const grad = ctx.createLinearGradient(0, h, 0, h - barHeight)
          if (val > 190) {
            grad.addColorStop(0, '#1d4ed8')
            grad.addColorStop(0.6, '#38bdf8')
            grad.addColorStop(1, '#22d3ee')
          } else {
            grad.addColorStop(0, '#0f172a')
            grad.addColorStop(0.5, '#1e3a8a')
            grad.addColorStop(1, '#3b82f6')
          }

          ctx.fillStyle = grad
          ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight)

          // Peak cap
          if (val > 100) {
            ctx.fillStyle = '#22d3ee'
            ctx.fillRect(x, h - barHeight - 2, barWidth - 1, 2)
          }

          x += barWidth
        }

        // Notify parent of live dominant frequency at ~15 fps throttle
        if (onLiveDominantChange && time - lastCallbackTime.current > 65) {
          lastCallbackTime.current = time
          const audioCtx = analyzer.getContext()
          const aNode = analyzer.getAnalyser()
          if (audioCtx && aNode && maxVal > 20) {
            const binWidth = audioCtx.sampleRate / aNode.fftSize
            const liveFreq = Math.round(maxIdx * binWidth)
            const liveNote = analyzer.getLiveDominantFrequency().note
            onLiveDominantChange({
              freq: liveFreq,
              note: liveNote,
              magnitude: parseFloat((maxVal / 255).toFixed(2)),
            })
          }
        }
      } else {
        // Idle placeholder bars
        const numBars = 64
        const barWidth = width / numBars
        for (let i = 0; i < numBars; i++) {
          const fakeH = 4
          ctx.fillStyle = '#1e2e4a'
          ctx.fillRect(i * barWidth, h - fakeH, barWidth - 2, fakeH)
        }
      }

      if (isPlaying) {
        animRef.current = requestAnimationFrame(render)
      }
    }

    render(0)

    return () => {
      running = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [analyzer, isPlaying, onLiveDominantChange])

  return (
    <div className="w-full rounded-lg overflow-hidden border border-[#1e2e4a] bg-[#080d1a] relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full h-full block"
      />
      <div className="absolute top-2 right-3 pointer-events-none flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#22d3ee] animate-pulse' : 'bg-[#64748b]'}`} />
        <span className="text-[10px] mono text-[#64748b]">
          {isPlaying ? 'REAL-TIME FFT (60 FPS)' : 'STANDBY'}
        </span>
      </div>
    </div>
  )
}
