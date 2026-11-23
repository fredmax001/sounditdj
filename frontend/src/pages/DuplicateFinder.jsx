import React, { useState, useEffect } from 'react'
import { Copy, Trash2, Music, AlertTriangle, CheckCircle2 } from 'lucide-react'
import useLibraryStore from '@store/libraryStore'

function DuplicateFinder() {
  const { tracks, deleteTrack, fetchTracks } = useLibraryStore()
  const [duplicates, setDuplicates] = useState([])
  const [selectedDup, setSelectedDup] = useState(null)
  const [deleted, setDeleted] = useState([])

  useEffect(() => {
    findDuplicates()
  }, [tracks])

  const findDuplicates = () => {
    const groups = new Map()
    tracks.forEach(track => {
      const key = `${track.title?.toLowerCase()?.trim()}-${track.artist?.toLowerCase()?.trim()}`
      if (key !== '-') {
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(track)
      }
    })
    const dupGroups = Array.from(groups.values()).filter(g => g.length > 1)
    setDuplicates(dupGroups)
  }

  const handleDelete = async (track) => {
    if (!window.confirm(`Delete "${track.title}" by ${track.artist}?`)) return
    await deleteTrack(track.id)
    setDeleted([...deleted, track.id])
    await fetchTracks()
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDupTracks = duplicates.reduce((sum, g) => sum + g.length, 0)

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Copy className="w-6 h-6 text-brand-accent" />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Duplicate Finder</h1>
            <p className="text-sm text-text-muted">
              {duplicates.length} duplicate groups found ({totalDupTracks} tracks total)
            </p>
          </div>
        </div>

        {duplicates.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-xl p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text-primary mb-1">No Duplicates Found</h3>
            <p className="text-sm text-text-muted">Your library is clean — no duplicate tracks detected.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group, idx) => (
              <div key={idx} className="bg-background-secondary border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-background-tertiary border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-text-primary">
                      {group[0].title || 'Unknown Title'}
                    </span>
                    <span className="text-sm text-text-muted">— {group[0].artist || 'Unknown Artist'}</span>
                  </div>
                  <span className="text-xs text-text-muted bg-background-primary px-2 py-1 rounded">
                    {group.length} copies
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {group.map((track) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        selectedDup === track.id ? 'bg-brand-accent-dim' : 'hover:bg-background-tertiary'
                      }`}
                      onClick={() => setSelectedDup(track.id)}
                    >
                      <div className="w-10 h-10 bg-background-tertiary rounded overflow-hidden flex items-center justify-center shrink-0">
                        {track.artwork ? (
                          <img src={track.artwork} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-text-primary truncate">{track.original_name || track.filename}</div>
                        <div className="text-[11px] text-text-muted">
                          {track.bpm ? `${Math.round(track.bpm)} BPM` : 'No BPM'} • {track.key || 'No Key'} • {formatDuration(track.duration)} • {track.genre || 'No Genre'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(track) }}
                        className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DuplicateFinder
