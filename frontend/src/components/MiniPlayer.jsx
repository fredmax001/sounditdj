import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  ListMusic,
  Maximize2,
  Heart,
  Repeat,
  Shuffle
} from 'lucide-react'
import usePlayerStore from '@store/playerStore'
import useAuthStore from '@store/authStore'
import toast from 'react-hot-toast'
import { MEDIA_BASE_URL } from '@config/axios'

const MiniPlayer = () => {
  const audioRef = useRef(null)
  const progressRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const token = useAuthStore((state) => state.token)
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
  } = usePlayerStore()

  // Construct full audio URL when track changes
  useEffect(() => {
    if (currentTrack?.audioUrl) {
      let fullUrl = currentTrack.audioUrl.startsWith('http') 
        ? currentTrack.audioUrl 
        : `${MEDIA_BASE_URL}${currentTrack.audioUrl}`
      if (!currentTrack.audioUrl.startsWith('http') && token) {
        fullUrl += `${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      }
      setAudioUrl(fullUrl)
      
      // Reset audio element when track changes
      if (audioRef.current) {
        audioRef.current.src = fullUrl
        audioRef.current.load()
        if (isPlaying) {
          audioRef.current.play().catch(err => {
            console.error('Audio play error:', err)
            setIsPlaying(false)
          })
        }
      }
    }
  }, [currentTrack, isPlaying, setIsPlaying])

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err)
          setIsPlaying(false)
          toast.error('Failed to play audio')
        })
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, audioUrl, setIsPlaying])

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (repeat === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else {
      nextTrack()
    }
  }

  const handleProgressClick = (e) => {
    if (progressRef.current && audioRef.current && duration) {
      const rect = progressRef.current.getBoundingClientRect()
      const percent = (e.clientX - rect.left) / rect.width
      const newTime = percent * duration
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  if (!currentTrack) return null

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-create-red/30"
    >
      {/* Animated border glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-create-red to-transparent" />
      
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        crossOrigin="anonymous"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-24">
          {/* Track Info */}
          <div className="flex items-center gap-4 w-72 flex-shrink-0">
            <motion.div 
              className="w-14 h-14 rounded-xl bg-background-tertiary overflow-hidden flex-shrink-0 border border-create-red/20"
              animate={isPlaying ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {currentTrack.artwork ? (
                <img
                  src={currentTrack.artwork.startsWith('http') ? currentTrack.artwork : `${MEDIA_BASE_URL}${currentTrack.artwork}`}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ListMusic className="w-6 h-6 text-create-red" />
                </div>
              )}
            </motion.div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {currentTrack.title || 'Unknown Title'}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {currentTrack.artist || 'Unknown Artist'}
              </p>
            </div>
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2 rounded-lg transition-all ${
                isLiked ? 'text-create-red' : 'text-text-muted hover:text-create-red'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="flex items-center gap-5">
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-lg transition-all ${
                  shuffle ? 'text-create-red' : 'text-text-secondary hover:text-create-red'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              
              <button
                onClick={previousTrack}
                className="p-2 rounded-lg text-text-secondary hover:text-create-red transition-all hover:scale-110"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full bg-create-red flex items-center justify-center text-black hover:shadow-glow transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </motion.button>
              
              <button
                onClick={nextTrack}
                className="p-2 rounded-lg text-text-secondary hover:text-create-red transition-all hover:scale-110"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              <button
                onClick={toggleRepeat}
                className={`p-2 rounded-lg transition-all ${
                  repeat !== 'none' ? 'text-create-red' : 'text-text-secondary hover:text-create-red'
                }`}
              >
                <Repeat className="w-4 h-4" />
                {repeat === 'one' && <span className="sr-only">Repeat One</span>}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md flex items-center gap-3">
              <span className="text-xs text-text-muted w-10 text-right font-mono">
                {formatTime(currentTime)}
              </span>
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="flex-1 h-1.5 bg-background-tertiary rounded-full cursor-pointer group"
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-create-red to-create-red-light rounded-full relative"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-create-red rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-glow" />
                </motion.div>
              </div>
              <span className="text-xs text-text-muted w-10 font-mono">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume & Extra */}
          <div className="flex items-center gap-3 w-56 justify-end">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg text-text-secondary hover:text-create-red transition-all"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24"
            />
            
            <button className="p-2 rounded-lg text-text-secondary hover:text-create-red transition-all">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Waveform Visualization */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden opacity-60">
        <div className="flex items-end justify-center gap-0.5 h-full">
          {Array.from({ length: 60 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-create-red rounded-t"
              animate={{
                height: isPlaying
                  ? [`${Math.random() * 100}%`, `${Math.random() * 100}%`]
                  : '10%',
              }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                repeatType: 'reverse',
                delay: i * 0.01,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default MiniPlayer
