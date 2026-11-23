import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import usePlayerStore from '@store/playerStore'
import useAuthStore from '@store/authStore'
import { getCachedWaveform, loadTrackWaveformPeaks } from '../utils/audioAnalyzer'

function formatTime(seconds) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Production Dual-Waveform DJ Player (MIXO-style):
 * - Top: Full-track 3-band overview waveform (click/drag to seek anywhere)
 * - Bottom: Zoomed 16-second scrolling beatgrid waveform centered on the playhead
 * - Real audio peaks decoded via Web Audio API (`soundit-media://` in Electron or HTTP)
 */
export default function InteractiveWaveform({ track, cues = [] }) {
  const overviewCanvasRef = useRef(null)
  const zoomedCanvasRef = useRef(null)
  const overviewWrapRef = useRef(null)
  const zoomedWrapRef = useRef(null)

  const [peaks, setPeaks] = useState(null)
  const [decodedDuration, setDecodedDuration] = useState(0)
  const [isDecoding, setIsDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState(null)
  const [hoverRatio, setHoverRatio] = useState(null)
  const [isScrubbingOverview, setIsScrubbingOverview] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ ovW: 800, ovH: 36, zmW: 800, zmH: 80 })

  const token = useAuthStore((s) => s.token)
  const { currentTrack, currentTime, duration, seek, playTrack } = usePlayerStore()

  const isCurrentTrack = Boolean(currentTrack && track && String(currentTrack.id) === String(track.id))
  const activeDuration =
    (isCurrentTrack && duration > 0 ? duration : 0) ||
    decodedDuration ||
    Number(track?.duration) ||
    0
  const activeTime = isCurrentTrack ? currentTime : 0
  const progressRatio = activeDuration > 0 ? Math.min(1, Math.max(0, activeTime / activeDuration)) : 0

  // Decode real audio peaks whenever track changes
  useEffect(() => {
    let cancelled = false
    setDecodeError(null)

    if (!track) {
      setPeaks(null)
      setDecodedDuration(0)
      return undefined
    }

    // 1. Check track.waveform_data or memory cache first for instant display
    const cached = getCachedWaveform(track.id || track.path)
    if (Array.isArray(cached) && cached.length > 40) {
      setPeaks(cached)
      setIsDecoding(false)
      return undefined
    }
    if (track.waveform_data) {
      try {
        const parsed = typeof track.waveform_data === 'string'
          ? JSON.parse(track.waveform_data)
          : track.waveform_data
        if (Array.isArray(parsed) && parsed.length > 40 && typeof parsed[0] === 'object') {
          setPeaks(parsed)
          setIsDecoding(false)
          return undefined
        }
      } catch {
        // decode real audio below
      }
    }

    // 2. Decode real audio file via Web Audio API
    setPeaks(null)
    setIsDecoding(true)
    loadTrackWaveformPeaks(track, token)
      .then((res) => {
        if (cancelled) return
        if (Array.isArray(res)) {
          setPeaks(res)
        } else if (res?.peaks) {
          setPeaks(res.peaks)
          if (res.duration) setDecodedDuration(res.duration)
        } else {
          setDecodeError('Audio file unavailable for waveform decoding')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDecodeError(err.message || 'Could not decode waveform')
        }
      })
      .finally(() => {
        if (!cancelled) setIsDecoding(false)
      })

    return () => {
      cancelled = true
    }
  }, [track?.id, track?.path, track?.waveform_data, token])

  // Observe container dimensions accurately (fixes Retina / DPR clipping bug)
  useEffect(() => {
    const updateSizes = () => {
      const ov = overviewWrapRef.current?.getBoundingClientRect()
      const zm = zoomedWrapRef.current?.getBoundingClientRect()
      setCanvasSize({
        ovW: Math.max(100, Math.floor(ov?.width || 800)),
        ovH: Math.max(24, Math.floor(ov?.height || 36)),
        zmW: Math.max(100, Math.floor(zm?.width || 800)),
        zmH: Math.max(48, Math.floor(zm?.height || 80)),
      })
    }
    updateSizes()
    const ro = new ResizeObserver(updateSizes)
    if (overviewWrapRef.current) ro.observe(overviewWrapRef.current)
    if (zoomedWrapRef.current) ro.observe(zoomedWrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Draw Overview Waveform (Full Track)
  useEffect(() => {
    const canvas = overviewCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasSize.ovW
    const h = canvasSize.ovH
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Subtle center baseline
    const midY = h / 2
    ctx.strokeStyle = 'rgba(149, 205, 251, 0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()

    if (Array.isArray(peaks) && peaks.length > 0) {
      const count = peaks.length
      const barW = w / count
      for (let i = 0; i < count; i += 1) {
        const p = peaks[i]
        const amp = (typeof p === 'number' ? p : p.height || 10) / 100
        const bass = typeof p === 'object' ? (p.bass || 33) : 40
        const barH = Math.max(2, amp * (h * 0.88))
        const x = i * barW
        const played = i / count <= progressRatio

        if (played) {
          ctx.fillStyle = bass > 45 ? '#FAE1AF' : '#95CDFB'
        } else {
          ctx.fillStyle = bass > 45 ? 'rgba(250, 225, 175, 0.48)' : 'rgba(149, 205, 251, 0.38)'
        }
        ctx.fillRect(x, midY - barH / 2, Math.max(1.2, barW - 0.5), barH)
      }
    }

    // Highlight current zoomed window (~16s wide) on overview
    if (activeDuration > 0) {
      const zoomSpan = Math.min(1, 16 / activeDuration)
      const winW = Math.max(12, zoomSpan * w)
      const winX = Math.max(0, Math.min(w - winW, progressRatio * w - winW / 2))
      ctx.fillStyle = 'rgba(250, 225, 175, 0.10)'
      ctx.fillRect(winX, 0, winW, h)
      ctx.strokeStyle = 'rgba(250, 225, 175, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(winX + 0.5, 0.5, winW - 1, h - 1)
    }

    // Cue markers on overview
    if (Array.isArray(cues) && activeDuration > 0) {
      for (const cue of cues) {
        const cx = Math.min(1, Math.max(0, (Number(cue.position) || 0) / activeDuration)) * w
        ctx.fillStyle = cue.color || '#FAE1AF'
        ctx.fillRect(cx - 1, 0, 2, h)
      }
    }

    // Hover guide
    if (hoverRatio !== null) {
      const hx = hoverRatio * w
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(hx, 0)
      ctx.lineTo(hx, h)
      ctx.stroke()
    }

    // Playhead
    const px = progressRatio * w
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, h)
    ctx.stroke()
  }, [peaks, progressRatio, hoverRatio, cues, activeDuration, canvasSize])

  // Draw Zoomed Beatgrid Waveform (±8 seconds centered on playhead)
  useEffect(() => {
    const canvas = zoomedCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasSize.zmW
    const h = canvasSize.zmH
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const midY = h / 2
    const windowSec = 16 // 8 seconds before playhead, 8 seconds after
    const startSec = activeTime - windowSec / 2
    const endSec = activeTime + windowSec / 2

    // Center line
    ctx.strokeStyle = 'rgba(250, 225, 175, 0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()

    // Real beatgrid lines (if BPM is known)
    const bpm = Number(track?.bpm || track?.beatgrid?.bpm || 0)
    if (bpm >= 50 && bpm <= 220) {
      const beatSec = 60 / bpm
      const anchor = Number(track?.beatgrid?.anchor || 0)
      const firstBeatIndex = Math.floor((startSec - anchor) / beatSec)
      const lastBeatIndex = Math.ceil((endSec - anchor) / beatSec)
      for (let b = firstBeatIndex; b <= lastBeatIndex; b += 1) {
        const beatTime = anchor + b * beatSec
        if (beatTime < 0) continue
        const x = ((beatTime - startSec) / windowSec) * w
        const isDownbeat = ((b % 4) + 4) % 4 === 0
        ctx.strokeStyle = isDownbeat ? 'rgba(250, 225, 175, 0.42)' : 'rgba(149, 205, 251, 0.15)'
        ctx.lineWidth = isDownbeat ? 1.5 : 1
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
    }

    // Draw zoomed 3-band waveform bars
    if (Array.isArray(peaks) && peaks.length > 0 && activeDuration > 0) {
      const barStepPx = 3
      const numBars = Math.ceil(w / barStepPx)
      for (let i = 0; i < numBars; i += 1) {
        const x = i * barStepPx
        const t = startSec + (x / w) * windowSec
        if (t < 0 || t > activeDuration) continue
        const idx = Math.min(peaks.length - 1, Math.max(0, Math.floor((t / activeDuration) * peaks.length)))
        const p = peaks[idx]
        const amp = (typeof p === 'number' ? p : p.height || 10) / 100
        const bass = typeof p === 'object' ? (p.bass || 33) : 40
        const high = typeof p === 'object' ? (p.high || 20) : 20
        const barH = Math.max(3, amp * (h * 0.84))
        const isPast = t <= activeTime

        // Tri-band DJ coloring: Bass = Champagne Gold, Mid = Sky Blue, Crisp Highs = Ice White
        let fill
        if (bass > 46) {
          fill = isPast ? '#FAE1AF' : 'rgba(250, 225, 175, 0.72)'
        } else if (high > 38) {
          fill = isPast ? '#E2F1FF' : 'rgba(226, 241, 255, 0.65)'
        } else {
          fill = isPast ? '#95CDFB' : 'rgba(149, 205, 251, 0.68)'
        }
        ctx.fillStyle = fill
        ctx.fillRect(x, midY - barH / 2, 2.2, barH)
      }
    }

    // Cue markers on zoomed grid
    if (Array.isArray(cues)) {
      for (const cue of cues) {
        const pos = Number(cue.position) || 0
        if (pos < startSec || pos > endSec) continue
        const cx = ((pos - startSec) / windowSec) * w
        const color = cue.color || '#FAE1AF'
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, 0)
        ctx.lineTo(cx, h)
        ctx.stroke()

        // Cue flag label
        ctx.fillStyle = color
        ctx.fillRect(cx, 2, 42, 13)
        ctx.fillStyle = '#00101D'
        ctx.font = 'bold 9px SF Mono, Menlo, monospace'
        ctx.fillText((cue.name || 'CUE').slice(0, 6), cx + 3, 11)
      }
    }

    // Center Playhead Marker (Fixed Center, MIXO / Serato / Rekordbox style)
    const centerX = w / 2
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.shadowColor = '#FAE1AF'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, h)
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#FAE1AF'
    ctx.beginPath()
    ctx.moveTo(centerX - 5, 0)
    ctx.lineTo(centerX + 5, 0)
    ctx.lineTo(centerX, 7)
    ctx.closePath()
    ctx.fill()
  }, [peaks, activeTime, activeDuration, cues, track?.bpm, track?.beatgrid, canvasSize])

  const seekOverviewFromEvent = useCallback((e) => {
    if (!overviewWrapRef.current || activeDuration <= 0) return
    const rect = overviewWrapRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const targetSec = ratio * activeDuration
    if (!isCurrentTrack && track) {
      playTrack(track)
      setTimeout(() => seek(targetSec), 120)
    } else {
      seek(targetSec)
    }
  }, [activeDuration, isCurrentTrack, track, playTrack, seek])

  const handleZoomedClick = useCallback((e) => {
    if (!zoomedWrapRef.current || activeDuration <= 0) return
    const rect = zoomedWrapRef.current.getBoundingClientRect()
    const deltaRatio = (e.clientX - rect.left) / rect.width - 0.5
    const targetSec = Math.max(0, Math.min(activeDuration, activeTime + deltaRatio * 16))
    if (!isCurrentTrack && track) {
      playTrack(track)
      setTimeout(() => seek(targetSec), 120)
    } else {
      seek(targetSec)
    }
  }, [activeDuration, activeTime, isCurrentTrack, track, playTrack, seek])

  useEffect(() => {
    if (!isScrubbingOverview) return undefined
    const onMove = (e) => seekOverviewFromEvent(e)
    const onUp = () => setIsScrubbingOverview(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isScrubbingOverview, seekOverviewFromEvent])

  const remaining = Math.max(0, activeDuration - activeTime)

  return (
    <div className="bg-background-primary border-b border-border/60 select-none">
      {/* Top: Full-Track Overview Waveform */}
      <div
        ref={overviewWrapRef}
        onMouseDown={(e) => {
          setIsScrubbingOverview(true)
          seekOverviewFromEvent(e)
        }}
        onMouseMove={(e) => {
          if (!overviewWrapRef.current) return
          const rect = overviewWrapRef.current.getBoundingClientRect()
          setHoverRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
        }}
        onMouseLeave={() => setHoverRatio(null)}
        className="h-9 relative cursor-pointer border-b border-border/40 bg-[#000b14]"
        title="Click or drag anywhere to seek"
      >
        <canvas ref={overviewCanvasRef} className="w-full h-full block" />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-background-primary/80 text-[10px] font-mono text-brand-accent pointer-events-none">
          {formatTime(activeTime)}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-background-primary/80 text-[10px] font-mono text-brand-sky pointer-events-none">
          -{formatTime(remaining)}
        </div>
      </div>

      {/* Bottom: Zoomed Scrolling Beatgrid Waveform */}
      <div
        ref={zoomedWrapRef}
        onClick={handleZoomedClick}
        className="h-20 relative cursor-pointer bg-background-primary overflow-hidden"
        title="Click left/right of center playhead to nudge"
      >
        <canvas ref={zoomedCanvasRef} className="w-full h-full block" />

        {isDecoding && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background-primary/70 text-xs text-brand-accent font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-brand-sky" />
            <span>Decoding real audio waveform...</span>
          </div>
        )}

        {!isDecoding && decodeError && !peaks && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-text-muted font-mono px-4 text-center">
            {decodeError}
          </div>
        )}
      </div>
    </div>
  )
}
