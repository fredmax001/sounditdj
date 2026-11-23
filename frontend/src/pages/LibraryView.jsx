import React, { useState, useEffect } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Star,
  Music,
  X,
  Heart,
  Tag,
  AlertTriangle,
  ImageOff,
  Clock,
  Activity,
  Link2,
  Plus,
  HardDrive,
  Usb,
  FolderInput,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react'
import TrackTable from '@components/TrackTable'
import TrackGrid from '@components/TrackGrid'
import InteractiveWaveform from '@components/InteractiveWaveform'
import ExportToUsbModal from '@components/ExportToUsbModal'
import TransferProgressDrawer from '@components/TransferProgressDrawer'
import MissingTracks from '@pages/MissingTracks'
import DuplicateFinder from '@pages/DuplicateFinder'
import useLibraryStore from '@store/libraryStore'
import usePlayerStore from '@store/playerStore'
import toast from 'react-hot-toast'

function TransportControls({ isPlaying, onPlay }) {
  const {
    previousTrack,
    nextTrack,
    repeat,
    toggleRepeat,
    volume,
    isMuted,
    setVolume,
    toggleMute,
  } = usePlayerStore()

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={previousTrack}
        title="Previous / Restart Track"
        className="w-7 h-7 flex items-center justify-center bg-background-tertiary hover:bg-background-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onPlay}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        className="w-8 h-8 flex items-center justify-center bg-brand-accent hover:bg-brand-accent-hover rounded text-brand-primary transition-colors shadow-xs"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
      </button>
      <button
        onClick={nextTrack}
        title="Next Track"
        className="w-7 h-7 flex items-center justify-center bg-background-tertiary hover:bg-background-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={toggleRepeat}
        title={`Repeat: ${repeat}`}
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          repeat !== 'none'
            ? 'bg-brand-accent-dim text-brand-accent border border-brand-accent/40'
            : 'bg-background-tertiary hover:bg-background-elevated text-text-secondary hover:text-text-primary'
        }`}
      >
        <Repeat className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className="w-7 h-7 flex items-center justify-center bg-background-tertiary hover:bg-background-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
      >
        {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.02"
        value={isMuted ? 0 : volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-20 accent-[#FAE1AF] cursor-pointer"
        title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
      />
    </div>
  )
}

function CuePointStrip({ track, cues = [], onCuesChange }) {
  const { createCuePoint, deleteCuePoint } = useLibraryStore()
  const [newCueName, setNewCueName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const { currentTrack, currentTime, seek, playTrack } = usePlayerStore()

  const formatCueTime = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0))
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  const handleJumpToCue = (cue) => {
    const pos = Number(cue.position) || 0
    if (String(currentTrack?.id) !== String(track?.id)) {
      playTrack(track)
      setTimeout(() => seek(pos), 120)
    } else {
      seek(pos)
    }
  }

  const handleAddCue = async () => {
    const label = newCueName.trim() || `CUE ${cues.length + 1}`
    const cue = await createCuePoint(track.id, {
      name: label,
      position: currentTime || 0,
      color: '#FAE1AF',
    })
    onCuesChange?.([...cues, cue])
    setNewCueName('')
    setShowAdd(false)
  }

  const handleDeleteCue = async (e, id) => {
    e.stopPropagation()
    await deleteCuePoint(id, track?.id)
    onCuesChange?.(cues.filter((c) => c.id !== id))
  }

  const colors = {
    '#FAE1AF': 'bg-brand-accent text-brand-primary',
    '#95CDFB': 'bg-brand-sky text-brand-primary',
    '#EDC61E': 'bg-yellow-400 text-black',
    '#FF6B5B': 'bg-red-400 text-white',
    '#22C55E': 'bg-green-400 text-black',
    '#0080FF': 'bg-blue-400 text-white',
    '#A855F7': 'bg-purple-400 text-white',
  }

  return (
    <div className="px-4 py-2 bg-background-secondary border-b border-border">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted uppercase font-semibold">Hot Cues</span>
        <div className="flex-1 flex items-center gap-1.5 min-h-[22px] overflow-x-auto">
          {cues.map((cue) => (
            <div
              key={cue.id}
              onClick={() => handleJumpToCue(cue)}
              className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${colors[cue.color] || 'bg-brand-accent text-brand-primary'} hover:opacity-90 transition-opacity`}
              title={`Jump to ${cue.name} (${formatCueTime(cue.position)})`}
            >
              <span>{cue.name}</span>
              <span className="font-mono opacity-75">{formatCueTime(cue.position)}</span>
              <button
                onClick={(e) => handleDeleteCue(e, cue.id)}
                className="ml-0.5 opacity-60 hover:opacity-100"
                title="Delete cue"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {cues.length === 0 && (
            <span className="text-[10px] text-text-muted italic">No cue points set</span>
          )}
        </div>
        {showAdd ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newCueName}
              onChange={(e) => setNewCueName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCue()}
              placeholder="Cue name"
              autoFocus
              className="w-24 bg-background-primary border border-border text-[10px] text-text-primary rounded px-1.5 py-0.5 focus:outline-none focus:border-brand-accent/50"
            />
            <button onClick={handleAddCue} className="text-brand-accent hover:text-brand-accent-hover">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="text-text-muted hover:text-brand-accent transition-colors flex items-center gap-1 text-[11px]"
            title="Add cue point at current playhead"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cue</span>
          </button>
        )}
      </div>
    </div>
  )
}

function CollectionHealthPanel({ onClose }) {
  const health = useLibraryStore((state) => state.getCollectionHealth())
  const tracks = useLibraryStore((state) => state.tracks)

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  }

  const statCards = [
    { label: 'Total Tracks', value: health.totalTracks, icon: Music, color: 'text-brand-tertiary' },
    { label: 'Unanalyzed', value: health.unanalyzed, icon: AlertTriangle, color: 'text-yellow-400', warn: health.unanalyzed > 0 },
    { label: 'Missing Artwork', value: health.missingArtwork, icon: ImageOff, color: 'text-orange-400', warn: health.missingArtwork > 0 },
    { label: 'Duplicates', value: health.duplicates, icon: Activity, color: 'text-red-400', warn: health.duplicates > 0 },
  ]

  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-8 backdrop-blur-xs">
      <div className="bg-background-secondary border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-accent" />
            <h2 className="text-base font-semibold text-text-primary">Collection Health Dashboard</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-tertiary text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className={`bg-background-primary border border-border rounded-lg p-3 ${card.warn ? 'border-red-500/30' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${card.color}`} />
                    <span className="text-[11px] text-text-muted">{card.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${card.warn ? card.color : 'text-text-primary'}`}>
                    {card.value}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background-primary border border-border rounded-lg p-3">
              <div className="text-[11px] text-text-muted mb-1">Total Collection Duration</div>
              <div className="text-xl font-bold text-text-primary">{formatDuration(health.totalDuration)}</div>
            </div>
            <div className="bg-background-primary border border-border rounded-lg p-3">
              <div className="text-[11px] text-text-muted mb-1">Average Tempo</div>
              <div className="text-xl font-bold text-brand-accent">
                {health.avgBpm ? `${Math.round(health.avgBpm)} BPM` : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LibraryView({ activeSubItem, showHealthPanel, onCloseHealth, onOpenExportModal }) {
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const [trackCues, setTrackCues] = useState([])

  // Export to USB Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportModalTracks, setExportModalTracks] = useState([])
  const [exportModalPlaylist, setExportModalPlaylist] = useState(null)

  // Active Transfer Job
  const [activeTransferJob, setActiveTransferJob] = useState(null)

  const {
    tracks,
    fetchTracks,
    getFilteredTracks,
    viewMode,
    fetchPlaylistTracks,
    fetchCuePoints,
    connectedDevices,
    activeDevice,
    deviceTracks,
    isLoadingDevice,
    importLocalFromUsb,
    ejectConnectedDevice,
    analyzeTrack,
    analyzingTrackIds,
  } = useLibraryStore()

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  const isPlaylistView = activeSubItem?.startsWith('playlist-')
  const playlistId = isPlaylistView ? activeSubItem.replace('playlist-', '') : null
  const isDeviceView = activeSubItem?.startsWith('device-')

  useEffect(() => {
    fetchTracks()
  }, [fetchTracks])

  useEffect(() => {
    if (isPlaylistView && playlistId) {
      setCurrentPlaylist(null)
      fetchPlaylistTracks(playlistId).then((pl) => {
        setCurrentPlaylist(pl)
      })
    } else {
      setCurrentPlaylist(null)
    }
  }, [isPlaylistView, playlistId, fetchPlaylistTracks])

  // Always resolve the freshest version of the selected/playing track from the store
  const rawDisplay = selectedTrack || currentTrack
  const displayTrack = rawDisplay
    ? (tracks.find((t) => String(t.id) === String(rawDisplay.id)) || rawDisplay)
    : null
  const isAnalyzingDisplay = displayTrack ? analyzingTrackIds?.has(displayTrack.id) : false

  // Fetch cues whenever displayTrack changes
  useEffect(() => {
    if (displayTrack?.id) {
      fetchCuePoints(displayTrack.id).then((cues) => {
        setTrackCues(Array.isArray(cues) ? cues : [])
      })
    } else {
      setTrackCues([])
    }
  }, [displayTrack?.id, fetchCuePoints])

  const allFilteredTracks = getFilteredTracks()

  const filteredTracks = isDeviceView
    ? deviceTracks
    : isPlaylistView
    ? (currentPlaylist?.tracks || [])
    : activeSubItem === 'favorites'
    ? allFilteredTracks.filter((t) => (t.rating || 0) >= 4)
    : activeSubItem === 'recently-added'
    ? allFilteredTracks.filter((t) => {
        const d = new Date(t.createdAt || t.created_at || 0)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return d > weekAgo
      })
    : allFilteredTracks

  if (activeSubItem === 'missing-tracks') {
    return (
      <div className="h-full flex bg-background-primary relative overflow-hidden">
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {showHealthPanel && <CollectionHealthPanel onClose={onCloseHealth} />}
          <MissingTracks />
        </div>
      </div>
    )
  }

  if (activeSubItem === 'duplicates') {
    return (
      <div className="h-full flex bg-background-primary relative overflow-hidden">
        <div className="flex-1 min-w-0 h-full overflow-auto">
          {showHealthPanel && <CollectionHealthPanel onClose={onCloseHealth} />}
          <DuplicateFinder />
        </div>
      </div>
    )
  }

  const handleSelectTrack = (track) => setSelectedTrack(track)

  const handlePlayTrack = (track) => {
    setSelectedTrack(track)
    playTrack(track, filteredTracks)
  }

  const handleAnalyzeDisplayTrack = async () => {
    if (!displayTrack) return
    try {
      const updated = await analyzeTrack(displayTrack.id)
      if (updated) {
        setSelectedTrack(updated)
        toast.success(`Analyzed: ${updated.bpm ? `${updated.bpm} BPM` : '--'} · ${updated.key || '--'}`)
      }
    } catch (err) {
      toast.error(err.message || 'Audio analysis failed')
    }
  }

  // Open Export to USB modal
  const handleTriggerExport = (tracksToExport, targetDevice = null) => {
    setExportModalTracks(tracksToExport || filteredTracks)
    setExportModalPlaylist(currentPlaylist)
    setExportModalOpen(true)
  }

  const handleImportAllFromDevice = async () => {
    const paths = deviceTracks.map((t) => t.path).filter(Boolean)
    if (!paths.length) return
    toast.promise(
      importLocalFromUsb(paths, true),
      {
        loading: `Importing ${paths.length} tracks into local library...`,
        success: `Successfully imported ${paths.length} tracks!`,
        error: 'Import failed',
      }
    )
  }

  const handleEjectDevice = async () => {
    if (!activeDevice) return
    if (!window.confirm(`Safely eject "${activeDevice.name}"?`)) return
    try {
      await ejectConnectedDevice(activeDevice.id)
      toast.success(`${activeDevice.name} ejected safely`)
    } catch {
      toast.error('Failed to eject device')
    }
  }

  const detectedFormats = activeDevice?.library?.detected || []

  return (
    <div className="h-full flex bg-background-primary relative overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {showHealthPanel && <CollectionHealthPanel onClose={onCloseHealth} />}

        {/* USB Device Header Banner */}
        {isDeviceView && activeDevice && (
          <div className="px-6 py-3 bg-brand-secondary border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-accent-dim flex items-center justify-center text-brand-accent">
                <Usb className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">{activeDevice.name}</h2>
                  <span className="text-[10px] font-mono text-brand-accent bg-brand-accent-dim px-1.5 py-0.5 rounded uppercase">
                    {activeDevice.filesystem || 'USB STORAGE'}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5 font-mono">
                  <span>{activeDevice.mountPoint}</span>
                  <span>·</span>
                  <span>{activeDevice.free} available</span>
                  {detectedFormats.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-brand-sky">
                        Ecosystem: {detectedFormats.map((f) => f.replace('-usb', '')).join(', ').toUpperCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleImportAllFromDevice}
                disabled={deviceTracks.length === 0}
                className="px-3 py-1.5 bg-background-tertiary hover:bg-background-elevated text-text-primary text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors border border-border"
              >
                <FolderInput className="w-3.5 h-3.5 text-green-400" />
                <span>Import All Tracks</span>
              </button>

              <button
                onClick={handleEjectDevice}
                className="px-3 py-1.5 bg-background-tertiary hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors border border-border"
              >
                <X className="w-3.5 h-3.5" />
                <span>Eject Drive</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected Track Preview Banner & Waveform */}
        {displayTrack && (
          <div className="shrink-0">
            <div className="flex items-center gap-4 px-4 py-2.5 bg-background-secondary border-b border-border">
              <div className="w-12 h-12 bg-background-tertiary rounded overflow-hidden flex items-center justify-center shrink-0 border border-border/40">
                {displayTrack.artwork ? (
                  <img src={displayTrack.artwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-semibold text-text-primary truncate">
                  {displayTrack.title || displayTrack.filename || 'Unknown Title'}
                </h2>
                <p className="text-[11px] text-text-secondary truncate">{displayTrack.artist || 'Unknown Artist'}</p>
              </div>

              <div className="px-2 py-1 bg-background-tertiary rounded text-[11px] font-mono text-brand-accent">
                {displayTrack.bpm ? `${Number(displayTrack.bpm).toFixed(1)} BPM` : '-- BPM'}
              </div>
              <div className="px-2 py-1 bg-background-tertiary rounded text-[11px] font-mono text-brand-sky">
                {displayTrack.key || '--'}
              </div>
              {displayTrack.genre && (
                <div className="px-2 py-1 bg-background-tertiary rounded text-[11px] text-text-secondary truncate max-w-[120px]">
                  {displayTrack.genre}
                </div>
              )}
              <button
                onClick={handleAnalyzeDisplayTrack}
                disabled={isAnalyzingDisplay}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-accent-dim hover:bg-brand-accent text-brand-accent hover:text-brand-primary border border-brand-accent/40 text-[11px] font-semibold transition-colors disabled:opacity-50"
                title="Run real DSP BPM, Musical Key & Beatgrid analysis"
              >
                {isAnalyzingDisplay ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>{isAnalyzingDisplay ? 'Analysing...' : 'Analyse'}</span>
              </button>
            </div>

            <div className="border-b border-border">
              <div className="flex items-center gap-3 px-4 py-1.5 bg-background-secondary">
                <TransportControls
                  isPlaying={isPlaying && currentTrack?.id === displayTrack?.id}
                  onPlay={() => {
                    if (currentTrack?.id === displayTrack?.id) togglePlay()
                    else handlePlayTrack(displayTrack)
                  }}
                />
              </div>

              {/* Real Interactive Multi-band Waveform with seeking & cues */}
              <InteractiveWaveform track={displayTrack} cues={trackCues} />

              <CuePointStrip
                track={displayTrack}
                cues={trackCues}
                onCuesChange={setTrackCues}
              />
            </div>
          </div>
        )}

        {/* Subheader info bar */}
        <div className="px-4 py-1.5 bg-background-secondary border-b border-border flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {isDeviceView ? (
              <>
                <span className="font-medium text-text-secondary">{activeDevice?.name}</span>
                {' · '}{filteredTracks.length} audio tracks
              </>
            ) : isPlaylistView && currentPlaylist ? (
              <>
                <span className="font-medium text-text-secondary">{currentPlaylist.name}</span>
                {' · '}{filteredTracks.length} tracks
              </>
            ) : (
              <>
                {filteredTracks.length} of {tracks.length} tracks
                {filteredTracks.length !== tracks.length && ' (filtered)'}
              </>
            )}
          </span>

          <div className="flex items-center gap-3">
            {!isDeviceView && (
              <button
                onClick={() => handleTriggerExport(filteredTracks)}
                disabled={filteredTracks.length === 0}
                className="hover:text-brand-accent flex items-center gap-1 transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Export Collection to USB</span>
              </button>
            )}
            {viewMode === 'grid' && <span>Grid View</span>}
          </div>
        </div>

        {/* Table or Grid */}
        {viewMode === 'table' ? (
          <TrackTable
            tracks={filteredTracks}
            selectedTrackId={selectedTrack?.id}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={handlePlayTrack}
            onOpenExportModal={handleTriggerExport}
            isUsbView={isDeviceView}
          />
        ) : (
          <TrackGrid
            tracks={filteredTracks}
            selectedTrackId={selectedTrack?.id}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={handlePlayTrack}
          />
        )}
      </div>

      {/* Export to USB Modal */}
      <ExportToUsbModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        tracks={exportModalTracks}
        playlist={exportModalPlaylist}
        devices={connectedDevices}
        onStartExport={(job) => setActiveTransferJob(job)}
      />

      {/* Persistent Transfer Progress Drawer */}
      {activeTransferJob && (
        <TransferProgressDrawer
          job={activeTransferJob}
          onDismiss={() => setActiveTransferJob(null)}
        />
      )}
    </div>
  )
}
