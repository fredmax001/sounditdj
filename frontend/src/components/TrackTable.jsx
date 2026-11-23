import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  Music,
  Star,
  Pencil,
  Tag,
  X,
  Plus,
  Share2,
  HardDrive,
  BarChart3,
  ListPlus,
  Check,
  FolderInput,
  Trash2,
  ExternalLink,
  Copy,
  Loader2,
} from 'lucide-react'
import usePlayerStore from '@store/playerStore'
import useLibraryStore from '@store/libraryStore'
import toast from 'react-hot-toast'

export default function TrackTable({
  tracks = [],
  selectedTrackId,
  onSelectTrack,
  onPlayTrack,
  onOpenExportModal,
  isUsbView = false,
}) {
  const { currentTrack, isPlaying, togglePlay } = usePlayerStore()
  const {
    updateTrack,
    deleteTrack,
    playlists,
    addTrackToPlaylist,
    analyzeTrack,
    analyzeTracksBatch,
    analyzingTrackIds,
    importLocalFromUsb,
  } = useLibraryStore()

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const [editingTrack, setEditingTrack] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [newTag, setNewTag] = useState('')

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null) // { x, y, track, isBulk }
  const [playlistSubmenuOpen, setPlaylistSubmenuOpen] = useState(false)
  const contextMenuRef = useRef(null)

  // Sync selectedTrackId prop if given
  useEffect(() => {
    if (selectedTrackId && selectedIds.size <= 1) {
      setSelectedIds(new Set([selectedTrackId]))
    }
  }, [selectedTrackId])

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
        setPlaylistSubmenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
        setPlaylistSubmenuOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        // Select all visible tracks
        e.preventDefault()
        setSelectedIds(new Set(tracks.map((t) => t.id)))
      }
    }
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [tracks])

  const handleRowClick = (track, index, e) => {
    e.stopPropagation()
    onSelectTrack?.(track)

    let newSet = new Set(selectedIds)

    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const range = tracks.slice(start, end + 1).map((t) => t.id)
      newSet = new Set([...selectedIds, ...range])
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle
      if (newSet.has(track.id)) newSet.delete(track.id)
      else newSet.add(track.id)
      setLastSelectedIndex(index)
    } else {
      // Single select
      newSet = new Set([track.id])
      setLastSelectedIndex(index)
    }

    setSelectedIds(newSet)
  }

  const handleContextMenu = (track, e) => {
    e.preventDefault()
    e.stopPropagation()

    // If right-clicked track is not in selection, select it
    if (!selectedIds.has(track.id)) {
      setSelectedIds(new Set([track.id]))
      onSelectTrack?.(track)
    }

    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 300),
      track,
      isBulk: selectedIds.size > 1 && selectedIds.has(track.id),
    })
    setPlaylistSubmenuOpen(false)
  }

  const getSelectedTracks = () => {
    return tracks.filter((t) => selectedIds.has(t.id))
  }

  const handlePlay = (track, e) => {
    e.stopPropagation()
    if (currentTrack?.id === track.id) {
      togglePlay()
    } else {
      onPlayTrack?.(track)
    }
  }

  // Drag and drop start
  const handleDragStart = (track, e) => {
    const draggingTracks = selectedIds.has(track.id)
      ? getSelectedTracks()
      : [track]

    const payload = {
      type: 'sounditdj/tracks',
      trackIds: draggingTracks.map((t) => t.id),
      filePaths: draggingTracks.map((t) => t.path || t.filePath).filter(Boolean),
    }

    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  // Batch / Context Menu Actions
  const handleExportSelected = () => {
    const selected = getSelectedTracks()
    if (!selected.length) return
    onOpenExportModal?.(selected)
    setContextMenu(null)
  }

  const handleAnalyzeSelected = async () => {
    const selected = getSelectedTracks()
    if (!selected.length) return
    setContextMenu(null)
    toast.promise(
      analyzeTracksBatch(selected.map((t) => t.id)),
      {
        loading: `Analyzing ${selected.length} track${selected.length === 1 ? '' : 's'} in background...`,
        success: `Analyzed ${selected.length} track${selected.length === 1 ? '' : 's'}!`,
        error: 'Track analysis encountered an issue',
      }
    )
  }

  const handleImportLocally = async () => {
    const selected = getSelectedTracks()
    const paths = selected.map((t) => t.path).filter(Boolean)
    if (!paths.length) return
    setContextMenu(null)
    toast.promise(
      importLocalFromUsb(paths, true),
      {
        loading: `Importing ${paths.length} track${paths.length === 1 ? '' : 's'} into library...`,
        success: `Imported ${paths.length} track${paths.length === 1 ? '' : 's'}!`,
        error: 'Local import failed',
      }
    )
  }

  const handleAddToPlaylist = async (playlistId) => {
    const selected = getSelectedTracks()
    setContextMenu(null)
    setPlaylistSubmenuOpen(false)
    for (const t of selected) {
      await addTrackToPlaylist(playlistId, t.id).catch(() => {})
    }
    toast.success(`Added ${selected.length} track${selected.length === 1 ? '' : 's'} to playlist`)
  }

  const handleDeleteSelected = async () => {
    const selected = getSelectedTracks()
    if (!selected.length) return
    if (!window.confirm(`Delete ${selected.length} track${selected.length === 1 ? '' : 's'} from Sound It DJ library?`)) return
    setContextMenu(null)
    for (const t of selected) {
      await deleteTrack(t.id).catch(() => {})
    }
    setSelectedIds(new Set())
    toast.success('Track(s) removed from library')
  }

  const handleCopyPath = (track) => {
    if (track?.path) {
      navigator.clipboard.writeText(track.path)
      toast.success('File path copied to clipboard')
    }
    setContextMenu(null)
  }

  // Edit track modal handling
  const handleEdit = (track, e) => {
    e.stopPropagation()
    setEditingTrack(track)
    setEditForm({
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      bpm: track.bpm || '',
      key: track.key || '',
      genre: track.genre || '',
      rating: track.rating || 0,
      tags: track.tags ? (typeof track.tags === 'string' ? JSON.parse(track.tags) : track.tags) : [],
    })
    setContextMenu(null)
  }

  const handleSaveEdit = async () => {
    if (!editingTrack) return
    await updateTrack(editingTrack.id, {
      title: editForm.title,
      artist: editForm.artist,
      album: editForm.album,
      bpm: editForm.bpm ? Number(editForm.bpm) : null,
      key: editForm.key,
      genre: editForm.genre,
      rating: editForm.rating,
      tags: editForm.tags,
    })
    setEditingTrack(null)
    toast.success('Track metadata updated')
  }

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '--/--/--'
    const d = new Date(dateString)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(2)}`
  }

  const renderStars = (rating = 0) => (
    <div className="flex items-center gap-0.5 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${star <= rating ? 'text-brand-accent fill-brand-accent' : 'text-text-muted/40'}`}
        />
      ))}
    </div>
  )

  const selectedCount = selectedIds.size

  return (
    <div className="flex-1 flex flex-col min-h-0 relative select-none">
      {/* Bulk Selection Bar */}
      {selectedCount > 1 && (
        <div className="px-4 py-2 bg-brand-secondary border-b border-border flex items-center justify-between z-20 shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-brand-accent font-mono">
              {selectedCount} tracks selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              className="px-2.5 py-1 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Export to USB</span>
            </button>

            <button
              onClick={handleAnalyzeSelected}
              className="px-2.5 py-1 bg-background-tertiary hover:bg-background-elevated text-text-primary text-xs font-medium rounded flex items-center gap-1.5 transition-colors border border-border"
            >
              <BarChart3 className="w-3.5 h-3.5 text-brand-sky" />
              <span>Analyze</span>
            </button>

            {isUsbView && (
              <button
                onClick={handleImportLocally}
                className="px-2.5 py-1 bg-background-tertiary hover:bg-background-elevated text-text-primary text-xs font-medium rounded flex items-center gap-1.5 transition-colors border border-border"
              >
                <FolderInput className="w-3.5 h-3.5 text-green-400" />
                <span>Import Locally</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Track Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-background-secondary border-b border-border text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              <th className="px-2 py-2 w-7 text-center">
                <input
                  type="checkbox"
                  checked={tracks.length > 0 && selectedCount === tracks.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(tracks.map((t) => t.id)))
                    else setSelectedIds(new Set())
                  }}
                  className="rounded accent-brand-accent cursor-pointer"
                />
              </th>
              <th className="px-1 py-2 w-7"></th>
              <th className="px-2 py-2 w-8 text-center">#</th>
              <th className="px-2 py-2 w-10 text-center">Art</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Artist</th>
              <th className="px-2 py-2">Album</th>
              <th className="px-2 py-2 w-16 text-center">Time</th>
              <th className="px-2 py-2 w-14 text-center">BPM</th>
              <th className="px-2 py-2 w-12 text-center">Key</th>
              <th className="px-2 py-2 w-20 text-center">Rating</th>
              <th className="px-2 py-2 w-24">Genre</th>
              {isUsbView && <th className="px-2 py-2 w-20 text-center">Format</th>}
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>

          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-20">
                  <Music className="w-10 h-10 text-text-muted/60 mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-secondary">No tracks to display</p>
                  <p className="text-xs text-text-muted mt-1">
                    {isUsbView ? 'This USB directory contains no supported audio files' : 'Drop audio files or connect a DJ USB drive'}
                  </p>
                </td>
              </tr>
            ) : (
              tracks.map((track, index) => {
                const isSelected = selectedIds.has(track.id)
                const isCurrent = currentTrack?.id === track.id
                const isPlayingCurrent = isCurrent && isPlaying
                const isAnalyzing = analyzingTrackIds?.has(track.id)

                return (
                  <tr
                    key={track.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(track, e)}
                    onClick={(e) => handleRowClick(track, index, e)}
                    onContextMenu={(e) => handleContextMenu(track, e)}
                    className={`border-b border-border/40 cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-brand-accent-dim/60 border-l-2 border-l-brand-accent'
                        : index % 2 === 0
                        ? 'bg-background-primary'
                        : 'bg-background-secondary/30'
                    } hover:bg-background-tertiary`}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds)
                          if (e.target.checked) newSet.add(track.id)
                          else newSet.delete(track.id)
                          setSelectedIds(newSet)
                        }}
                        className="rounded accent-brand-accent cursor-pointer"
                      />
                    </td>

                    {/* Play Button */}
                    <td className="px-1 py-1.5 text-center">
                      <button
                        onClick={(e) => handlePlay(track, e)}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                          isPlayingCurrent
                            ? 'text-brand-accent'
                            : 'text-text-muted opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isPlayingCurrent ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                    </td>

                    {/* # */}
                    <td className="px-2 py-1.5 text-[11px] text-text-muted font-mono text-center">
                      {index + 1}
                    </td>

                    {/* Artwork */}
                    <td className="px-2 py-1.5 text-center">
                      <div className="w-8 h-8 bg-background-tertiary rounded overflow-hidden flex items-center justify-center mx-auto border border-border/40">
                        {track.artwork ? (
                          <img src={track.artwork} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </div>
                    </td>

                    {/* Title */}
                    <td className={`px-2 py-1.5 text-[12px] font-medium truncate max-w-[220px] ${
                      isSelected ? 'text-brand-accent' : 'text-text-primary'
                    }`}>
                      <div className="truncate flex items-center gap-1.5">
                        <span>{track.title || track.filename || 'Unknown Title'}</span>
                        {isAnalyzing && (
                          <Loader2 className="w-3 h-3 text-brand-accent animate-spin shrink-0" />
                        )}
                      </div>
                    </td>

                    {/* Artist */}
                    <td className="px-2 py-1.5 text-[12px] text-text-secondary truncate max-w-[160px]">
                      {track.artist || 'Unknown Artist'}
                    </td>

                    {/* Album */}
                    <td className="px-2 py-1.5 text-[12px] text-text-muted truncate max-w-[160px]">
                      {track.album || ''}
                    </td>

                    {/* Time */}
                    <td className="px-2 py-1.5 text-[11px] text-text-secondary font-mono text-center">
                      {formatDuration(track.duration)}
                    </td>

                    {/* BPM */}
                    <td className="px-2 py-1.5 text-[11px] font-mono text-center">
                      {track.bpm ? (
                        <span className="text-brand-accent font-medium">{Math.round(track.bpm)}</span>
                      ) : (
                        <span className="text-text-muted/60">--</span>
                      )}
                    </td>

                    {/* Key */}
                    <td className="px-2 py-1.5 text-[11px] font-mono text-center text-brand-sky">
                      {track.key || '--'}
                    </td>

                    {/* Rating */}
                    <td className="px-2 py-1.5 text-center">
                      {renderStars(track.rating)}
                    </td>

                    {/* Genre */}
                    <td className="px-2 py-1.5 text-[11px] text-text-secondary truncate max-w-[120px]">
                      {track.genre || ''}
                    </td>

                    {/* USB Format */}
                    {isUsbView && (
                      <td className="px-2 py-1.5 text-center text-[10px] font-mono text-text-muted uppercase">
                        {track.format || 'AUDIO'}
                      </td>
                    )}

                    {/* Actions / Edit */}
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={(e) => handleEdit(track, e)}
                        className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-brand-accent transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-56 bg-background-secondary border border-border rounded-lg shadow-2xl py-1 text-xs text-text-secondary animate-fade-in"
        >
          <div className="px-3 py-1.5 border-b border-border text-[10px] font-semibold text-text-muted uppercase tracking-wider truncate">
            {contextMenu.isBulk ? `${selectedCount} Tracks Selected` : (contextMenu.track.title || 'Track Options')}
          </div>

          <button
            onClick={handleExportSelected}
            className="w-full px-3 py-2 text-left hover:bg-brand-accent-dim hover:text-brand-accent flex items-center gap-2 transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Export to USB...</span>
          </button>

          <button
            onClick={handleAnalyzeSelected}
            className="w-full px-3 py-2 text-left hover:bg-background-tertiary hover:text-text-primary flex items-center gap-2 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-brand-sky" />
            <span>Analyze Track(s)</span>
          </button>

          {/* Add to Playlist Submenu */}
          <div
            className="relative"
            onMouseEnter={() => setPlaylistSubmenuOpen(true)}
            onMouseLeave={() => setPlaylistSubmenuOpen(false)}
          >
            <button className="w-full px-3 py-2 text-left hover:bg-background-tertiary hover:text-text-primary flex items-center justify-between transition-colors">
              <span className="flex items-center gap-2">
                <ListPlus className="w-3.5 h-3.5" />
                <span>Add to Playlist</span>
              </span>
              <span className="text-[10px]">›</span>
            </button>

            {playlistSubmenuOpen && (
              <div className="absolute left-full top-0 ml-0.5 w-48 bg-background-secondary border border-border rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto">
                {playlists.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-text-muted italic">No playlists yet</div>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => handleAddToPlaylist(pl.id)}
                      className="w-full px-3 py-1.5 text-left hover:bg-brand-accent-dim hover:text-brand-accent text-xs truncate transition-colors"
                    >
                      {pl.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {isUsbView && (
            <button
              onClick={handleImportLocally}
              className="w-full px-3 py-2 text-left hover:bg-background-tertiary hover:text-green-400 flex items-center gap-2 transition-colors"
            >
              <FolderInput className="w-3.5 h-3.5 text-green-400" />
              <span>Import Locally</span>
            </button>
          )}

          <div className="my-1 border-t border-border" />

          <button
            onClick={() => handleCopyPath(contextMenu.track)}
            className="w-full px-3 py-1.5 text-left hover:bg-background-tertiary hover:text-text-primary flex items-center gap-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-text-muted" />
            <span>Copy File Path</span>
          </button>

          {!isUsbView && (
            <>
              <button
                onClick={(e) => handleEdit(contextMenu.track, e)}
                className="w-full px-3 py-1.5 text-left hover:bg-background-tertiary hover:text-text-primary flex items-center gap-2 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-text-muted" />
                <span>Edit Metadata...</span>
              </button>

              <button
                onClick={handleDeleteSelected}
                className="w-full px-3 py-1.5 text-left hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Track{selectedCount > 1 ? 's' : ''}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit Track Modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-background-secondary border border-border rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">Edit Track Metadata</h2>
              <button
                onClick={() => setEditingTrack(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-tertiary text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">Artist</label>
                  <input
                    type="text"
                    value={editForm.artist}
                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">Album</label>
                  <input
                    type="text"
                    value={editForm.album}
                    onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">Genre</label>
                  <input
                    type="text"
                    value={editForm.genre}
                    onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">BPM</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.bpm}
                    onChange={(e) => setEditForm({ ...editForm, bpm: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase mb-1 block">Musical Key</label>
                  <input
                    type="text"
                    value={editForm.key}
                    onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                    className="w-full bg-background-primary border border-border text-xs text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-background-primary/40">
              <button
                onClick={() => setEditingTrack(null)}
                className="px-4 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-accent hover:bg-brand-accent-hover text-brand-primary rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
