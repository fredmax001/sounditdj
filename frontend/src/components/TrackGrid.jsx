import React from 'react'
import { Play, Pause, Music, Star, Clock } from 'lucide-react'
import usePlayerStore from '@store/playerStore'

function TrackGrid({ tracks, selectedTrackId, onSelectTrack, onPlayTrack }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayerStore()

  const handlePlay = (track, e) => {
    e.stopPropagation()
    if (currentTrack?.id === track.id) {
      togglePlay()
    } else {
      onPlayTrack?.(track)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const renderStars = (rating = 0) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-2.5 h-2.5 ${
            star <= rating ? 'text-brand-accent fill-brand-accent' : 'text-text-muted'
          }`}
        />
      ))}
    </div>
  )

  const renderTags = (track) => {
    if (!track.tags) return null
    try {
      const tags = Array.isArray(track.tags) ? track.tags : JSON.parse(track.tags)
      if (!Array.isArray(tags) || tags.length === 0) return null
      return (
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-brand-accent-dim text-brand-accent text-[9px] rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )
    } catch (e) {
      return null
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-center">
          <Music className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm font-medium">No tracks found</p>
          <p className="text-text-muted text-xs mt-1">Import audio files to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id
          const isCurrent = currentTrack?.id === track.id
          const isPlayingCurrent = isCurrent && isPlaying

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack?.(track)}
              className={`group relative bg-background-secondary border rounded-lg overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? 'border-brand-accent shadow-lg shadow-brand-accent/10'
                  : 'border-border hover:border-brand-accent/30'
              }`}
            >
              {/* Artwork */}
              <div className="aspect-square bg-background-tertiary relative overflow-hidden">
                {track.artwork ? (
                  <img src={track.artwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-8 h-8 text-text-muted" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                  isPlayingCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <button
                    onClick={(e) => handlePlay(track, e)}
                    className="w-10 h-10 flex items-center justify-center bg-brand-accent rounded-full text-brand-primary"
                  >
                    {isPlayingCurrent ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                </div>

                {/* BPM badge */}
                {track.bpm && (
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-brand-accent">
                    {Math.round(track.bpm)} BPM
                  </div>
                )}

                {/* Duration badge */}
                {track.duration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-text-primary flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDuration(track.duration)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <h3 className={`text-[12px] font-medium truncate ${isSelected ? 'text-brand-accent' : 'text-text-primary'}`}>
                  {track.title || 'Unknown Title'}
                </h3>
                <p className="text-[11px] text-text-secondary truncate mt-0.5">
                  {track.artist || 'Unknown Artist'}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  {renderStars(track.rating)}
                  {track.key && (
                    <span className="text-[10px] font-mono text-text-muted">{track.key}</span>
                  )}
                </div>
                {renderTags(track)}
                {track.genre && (
                  <div className="mt-1.5">
                    <span className="text-[9px] text-text-muted bg-background-tertiary px-1.5 py-0.5 rounded">
                      {track.genre}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TrackGrid
