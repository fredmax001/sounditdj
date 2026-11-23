import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Search, 
  Play, 
  Pause, 
  MoreVertical, 
  Music,
  Clock,
  Key,
  FolderPlus,
  Filter,
  Trash2,
  Edit3,
  X,
  Disc3,
  Waves,
  ListMusic,
  GripVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useLibraryStore from '@store/libraryStore'
import usePlayerStore from '@store/playerStore'

const sortOptions = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'bpm', label: 'BPM' },
  { value: 'key', label: 'Key' },
]

const Library = () => {
  const [selectedTracks, setSelectedTracks] = useState([])
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [editingTrack, setEditingTrack] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [activePanel, setActivePanel] = useState('tracks') // tracks | playlists

  const {
    tracks,
    isLoading,
    searchQuery,
    sortBy,
    sortOrder,
    playlists,
    uploadProgress,
    isUploading,
    fetchTracks,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    uploadTrack,
    updateTrack,
    deleteTrack,
    createPlaylist,
    addTrackToPlaylist,
    getFilteredTracks,
  } = useLibraryStore()

  const {
    currentTrack,
    isPlaying,
    setCurrentTrack,
    togglePlay,
    setQueue,
  } = usePlayerStore()

  useEffect(() => {
    fetchTracks()
  }, [])

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      if (!file.type.startsWith('audio/')) {
        toast.error(`${file.name} is not an audio file`)
        continue
      }

      try {
        await toast.promise(
          uploadTrack(file, (progress) => {
            console.log(`Upload progress: ${progress}%`)
          }),
          {
            loading: `Uploading ${file.name}...`,
            success: `${file.name} uploaded successfully`,
            error: `Failed to upload ${file.name}`,
          }
        )
      } catch (error) {
        console.error('Upload error:', error)
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'],
    },
  })

  const filteredTracks = getFilteredTracks()

  const handlePlayTrack = (track) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
    } else {
      setCurrentTrack(track)
      setQueue(filteredTracks)
      usePlayerStore.getState().setIsPlaying(true)
    }
  }

  const handleDeleteTrack = async (trackId) => {
    if (window.confirm('Are you sure you want to delete this track?')) {
      try {
        await deleteTrack(trackId)
        toast.success('Track deleted')
      } catch (error) {
        toast.error('Failed to delete track')
      }
    }
  }

  const handleEditTrack = (track) => {
    setEditingTrack(track)
    setEditForm({
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      bpm: track.bpm || '',
      key: track.key || '',
    })
  }

  const handleSaveEdit = async () => {
    try {
      await updateTrack(editingTrack.id, editForm)
      toast.success('Track updated')
      setEditingTrack(null)
    } catch (error) {
      toast.error('Failed to update track')
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    try {
      await createPlaylist(newPlaylistName)
      toast.success('Playlist created')
      setNewPlaylistName('')
      setShowPlaylistModal(false)
    } catch (error) {
      toast.error('Failed to create playlist')
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-full flex flex-col bg-background-primary">
      {/* Browser Toolbar */}
      <div className="h-10 bg-background-secondary border-b border-mixer-border flex items-center px-3 gap-3">
        {/* View Toggle */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setActivePanel('tracks')}
            className={`px-3 py-1 text-[11px] font-medium transition-colors ${
              activePanel === 'tracks'
                ? 'bg-background-tertiary text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5 inline mr-1" />
            Tracks
          </button>
          <button
            onClick={() => setActivePanel('playlists')}
            className={`px-3 py-1 text-[11px] font-medium transition-colors ${
              activePanel === 'playlists'
                ? 'bg-background-tertiary text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5 inline mr-1" />
            Playlists
          </button>
        </div>

        <div className="w-px h-5 bg-mixer-border" />

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-background-primary border border-mixer-border text-[11px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-deck-a/50 transition-colors h-6"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-1 bg-background-primary border border-mixer-border text-text-primary text-[11px] focus:outline-none focus:border-deck-a/50 h-6"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="p-1 border border-mixer-border text-text-muted hover:text-text-secondary hover:border-mixer-border transition-all h-6 w-6 flex items-center justify-center"
        >
          <Filter className={`w-3 h-3 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
        </button>

        <div className="w-px h-5 bg-mixer-border" />

        {/* Upload Dropzone */}
        <div {...getRootProps()} className="flex items-center">
          <input {...getInputProps()} />
          <button className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-colors h-6 ${
            isDragActive
              ? 'bg-deck-a text-white'
              : 'bg-background-tertiary text-text-secondary hover:text-text-primary border border-mixer-border'
          }`}>
            <Upload className="w-3 h-3" />
            Import
          </button>
        </div>

        <button
          onClick={() => setShowPlaylistModal(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-background-tertiary border border-mixer-border text-text-secondary hover:text-text-primary text-[11px] font-medium transition-all h-6"
        >
          <FolderPlus className="w-3 h-3" />
          New Playlist
        </button>
      </div>

      {/* Upload Progress */}
      {isUploading && Object.keys(uploadProgress).length > 0 && (
        <div className="px-3 py-2 bg-background-secondary border-b border-mixer-border">
          <div className="space-y-1.5 max-w-lg">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted w-40 truncate">{fileName}</span>
                <div className="flex-1 h-1 bg-background-tertiary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-deck-a"
                  />
                </div>
                <span className="text-[10px] text-deck-a font-mono w-8">{progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track Table Header */}
      <div className="grid grid-cols-[40px_1fr_1fr_80px_60px_70px_80px] gap-0 px-0 border-b border-mixer-border bg-background-secondary">
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider"></div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Title</div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Artist</div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">BPM</div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Key</div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Time</div>
        <div className="px-2 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Actions</div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-deck-a border-t-transparent"
            />
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="text-center py-12">
            <Disc3 className="w-8 h-8 text-text-disabled mx-auto mb-3" />
            <p className="text-text-secondary text-xs font-medium mb-1">No tracks found</p>
            <p className="text-text-muted text-[11px]">
              Import audio files to get started
            </p>
          </div>
        ) : (
          <div>
            {filteredTracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className={`grid grid-cols-[40px_1fr_1fr_80px_60px_70px_80px] gap-0 px-0 items-center border-b border-mixer-border/50 transition-colors group ${
                  currentTrack?.id === track.id 
                    ? 'bg-deck-a-dim' 
                    : index % 2 === 0 ? 'bg-background-primary' : 'bg-background-secondary/30'
                } hover:bg-background-tertiary`}
              >
                {/* Play / Drag */}
                <div className="px-2 flex items-center justify-center">
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className={`w-6 h-6 flex items-center justify-center transition-all ${
                      currentTrack?.id === track.id && isPlaying
                        ? 'text-deck-a'
                        : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary'
                    }`}
                  >
                    {currentTrack?.id === track.id && isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-px" />
                    )}
                  </button>
                </div>

                {/* Title */}
                <div className="px-2 py-1.5 flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 bg-background-tertiary border border-mixer-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {track.artwork ? (
                      <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-3 h-3 text-text-disabled" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-primary truncate font-medium">
                      {track.title || 'Unknown Title'}
                    </p>
                    {track.album && (
                      <p className="text-[10px] text-text-muted truncate">{track.album}</p>
                    )}
                  </div>
                </div>

                {/* Artist */}
                <div className="px-2 py-1.5 text-[11px] text-text-secondary truncate">
                  {track.artist || 'Unknown Artist'}
                </div>

                {/* BPM */}
                <div className="px-2 py-1.5 text-center">
                  {track.bpm ? (
                    <span className="text-[11px] font-mono text-deck-a">
                      {Math.round(track.bpm)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-text-disabled">--</span>
                  )}
                </div>

                {/* Key */}
                <div className="px-2 py-1.5 text-center">
                  {track.key ? (
                    <span className="text-[11px] font-mono text-text-secondary">
                      {track.key}
                    </span>
                  ) : (
                    <span className="text-[11px] text-text-disabled">--</span>
                  )}
                </div>

                {/* Duration */}
                <div className="px-2 py-1.5 text-center text-[11px] text-text-secondary font-mono">
                  {formatDuration(track.duration)}
                </div>

                {/* Actions */}
                <div className="px-2 py-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditTrack(track)}
                    className="p-1 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteTrack(track.id)}
                    className="p-1 text-text-muted hover:text-error transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="h-6 bg-background-secondary border-t border-mixer-border flex items-center px-3 text-[10px] text-text-muted">
        <span>{filteredTracks.length} tracks</span>
        <span className="mx-2 text-mixer-border">|</span>
        <span>{playlists.length} playlists</span>
      </div>

      {/* Edit Track Modal */}
      <AnimatePresence>
        {editingTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-background-secondary border border-mixer-border p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">Edit Track</h3>
                <button
                  onClick={() => setEditingTrack(null)}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary focus:outline-none focus:border-deck-a/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Artist</label>
                  <input
                    type="text"
                    value={editForm.artist}
                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                    className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary focus:outline-none focus:border-deck-a/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Album</label>
                  <input
                    type="text"
                    value={editForm.album}
                    onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                    className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary focus:outline-none focus:border-deck-a/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">BPM</label>
                    <input
                      type="number"
                      value={editForm.bpm}
                      onChange={(e) => setEditForm({ ...editForm, bpm: e.target.value })}
                      className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary focus:outline-none focus:border-deck-a/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Key</label>
                    <input
                      type="text"
                      value={editForm.key}
                      onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                      className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary focus:outline-none focus:border-deck-a/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setEditingTrack(null)}
                  className="flex-1 px-4 py-2 border border-mixer-border text-[11px] text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-deck-a text-white text-[11px] font-medium hover:bg-deck-a/80 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Playlist Modal */}
      <AnimatePresence>
        {showPlaylistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-background-secondary border border-mixer-border p-5"
            >
              <h3 className="text-sm font-semibold text-text-primary mb-3">Create New Playlist</h3>
              <input
                type="text"
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3 py-2 bg-background-primary border border-mixer-border text-[11px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-deck-a/50 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="flex-1 px-4 py-2 border border-mixer-border text-[11px] text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  className="flex-1 px-4 py-2 bg-deck-a text-white text-[11px] font-medium hover:bg-deck-a/80 transition-all"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Library
