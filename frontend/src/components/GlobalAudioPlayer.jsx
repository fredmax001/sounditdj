import React, { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import usePlayerStore from '@store/playerStore'
import useAuthStore from '@store/authStore'
import { resolveTrackAudioUrl } from '../utils/audioUrl'

/**
 * Persistent global HTML5 audio engine mounted once at the top level of MainApp.
 * - Streams local Mac/Windows files via `soundit-media://` with full Range seeking
 * - Streams cloud files via authenticated HTTP URLs
 * - Drives 60fps playhead updates for smooth scrolling beatgrid waveforms
 */
export default function GlobalAudioPlayer() {
  const audioRef = useRef(null)
  const loadedUrlRef = useRef(null)
  const token = useAuthStore((s) => s.token)

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    repeat,
    registerAudioElement,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setAudioError,
    nextTrack,
  } = usePlayerStore()

  // Register audio element once
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.muted = isMuted
    registerAudioElement(el)
    return () => registerAudioElement(null)
  }, [registerAudioElement])

  // Load new track URL whenever currentTrack changes
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    if (!currentTrack) {
      el.pause()
      el.removeAttribute('src')
      loadedUrlRef.current = null
      return
    }

    const url = resolveTrackAudioUrl(currentTrack, token)
    if (!url) {
      setAudioError('No audio file path available for this track.')
      setIsPlaying(false)
      toast.error('Audio file path is missing for this track.')
      return
    }

    if (loadedUrlRef.current !== url) {
      loadedUrlRef.current = url
      setAudioError(null)
      el.src = url
      el.load()
    }

    if (usePlayerStore.getState().isPlaying) {
      el.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Audio play failed:', err)
          setAudioError(`Playback failed: ${err.message}`)
          setIsPlaying(false)
        }
      })
    }
  }, [currentTrack?.id, currentTrack?.path, token])

  // Sync play / pause state
  useEffect(() => {
    const el = audioRef.current
    if (!el || !loadedUrlRef.current) return

    if (isPlaying) {
      el.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Play error:', err)
          setAudioError(`Could not play audio: ${err.message}`)
          setIsPlaying(false)
        }
      })
    } else {
      el.pause()
    }
  }, [isPlaying])

  // Sync volume & mute
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
    el.muted = isMuted
  }, [volume, isMuted])

  // Smooth 60fps playhead sync while playing so zoomed waveform scrolls smoothly
  useEffect(() => {
    if (!isPlaying) return undefined
    let rafId
    const tick = () => {
      const el = audioRef.current
      if (el && !el.paused) {
        setCurrentTime(el.currentTime)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, setCurrentTime])

  // Spacebar shortcut for play/pause when not typing in an input
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (!usePlayerStore.getState().currentTrack) return
      e.preventDefault()
      usePlayerStore.getState().togglePlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleLoadedMetadata = () => {
    const el = audioRef.current
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration)
    }
  }

  const handleTimeUpdate = () => {
    const el = audioRef.current
    if (el) setCurrentTime(el.currentTime)
  }

  const handleEnded = () => {
    const el = audioRef.current
    if (repeat === 'one' && el) {
      el.currentTime = 0
      el.play().catch(() => {})
    } else {
      nextTrack()
    }
  }

  const handleError = () => {
    const el = audioRef.current
    const code = el?.error?.code
    const msg = code === 4
      ? 'Audio file not found or format unsupported on this system.'
      : 'Audio playback error — check that the local file exists on disk.'
    setAudioError(msg)
    setIsPlaying(false)
    toast.error(msg)
  }

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onError={handleError}
      style={{ display: 'none' }}
    />
  )
}
