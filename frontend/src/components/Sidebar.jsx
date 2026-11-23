import React, { useState, useEffect } from 'react'
import {
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  Play,
  Music,
  Clock,
  Disc3,
  User,
  HardDrive,
  Repeat,
  Radio,
  Usb,
  Settings,
  Plus,
  Cloud,
  Zap,
  BarChart3,
  Heart,
  Flame,
  Snowflake,
  AlertTriangle,
  ImageOff,
  LayoutGrid,
  List,
  X,
  Tag,
  Activity,
  Copy,
  SearchCheck,
  FileX,
  Link2,
  Download,
  Video,
  Image as ImageIcon,
  BarChart2,
  Settings2,
  History,
  HelpCircle,
  Keyboard,
  RefreshCcw,
  Sparkles,
} from 'lucide-react'
import useLibraryStore from '@store/libraryStore'
import toast from 'react-hot-toast'

const libraryNavItems = [
  { id: 'all-tracks', label: 'All Tracks', icon: Music },
  { id: 'recently-added', label: 'Recently Added', icon: Clock },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'missing-tracks', label: 'Missing Tracks', icon: FileX },
]

const toolsNavItems = [
  { id: 'converter', label: 'Audio Converter', icon: Repeat },
  { id: 'analyzer', label: 'Mix Analyzer', icon: BarChart3 },
  { id: 'identifier', label: 'Track Identifier', icon: Zap },
  { id: 'duplicate-finder', label: 'Duplicate Finder', icon: Copy },
  { id: 'find-replace', label: 'Find & Replace', icon: SearchCheck },
  { id: 'missing-tracks', label: 'Missing Tracks', icon: FileX },
  { id: 'usb-export', label: 'USB Export', icon: Usb },
  { id: 'dj-mixes', label: 'DJ Mixes', icon: Radio },
  { id: 'visualizer', label: 'Visualizer Studio', icon: Video },
  { id: 'cover-art', label: 'Cover Art', icon: ImageIcon },
]

const integrationNavItems = [
  { id: 'shazam', label: 'Shazam Recognition', icon: Zap },
  { id: 'soundcloud', label: 'SoundCloud Search', icon: Cloud },
  { id: 'audiomack', label: 'Audiomack', icon: Music },
  { id: 'boomplay', label: 'Boomplay Search', icon: Disc3 },
]

const settingsNavItems = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'backups', label: 'Backups', icon: History },
  { id: 'support', label: 'Support', icon: HelpCircle },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'reset-tools', label: 'Reset Tools', icon: RefreshCcw },
]

const smartPlaylists = [
  { id: 'high-energy', label: 'High Energy', icon: Flame, desc: 'BPM ≥ 128' },
  { id: 'warm-up', label: 'Warm Up', icon: Snowflake, desc: 'BPM < 120' },
  { id: 'favorites', label: 'Favorites', icon: Heart, desc: '4-5 stars' },
  { id: 'unanalyzed', label: 'Unanalyzed', icon: AlertTriangle, desc: 'Missing BPM/Key' },
  { id: 'missing-artwork', label: 'No Artwork', icon: ImageOff, desc: 'Missing cover' },
  { id: 'recent', label: 'Recent', icon: Clock, desc: 'Last 7 days' },
]

export default function Sidebar({
  activeTab,
  activeSubItem,
  onSubItemChange,
  onHealthClick,
  onOpenExportModal,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dragOverTarget, setDragOverTarget] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [creatingKind, setCreatingKind] = useState(null) // 'playlist' | 'folder' | null
  const [newName, setNewName] = useState('')

  const handleSubmitNewItem = async (e) => {
    e?.preventDefault?.()
    const clean = newName.trim()
    if (!clean) return
    try {
      if (creatingKind === 'folder') {
        await useLibraryStore.getState().createFolder(clean, null)
        toast.success(`Folder "${clean}" created`)
      } else {
        const pl = await useLibraryStore.getState().createPlaylist(clean, null)
        toast.success(`Playlist "${clean}" created`)
        if (pl?.id) {
          handleNavClick(`playlist-${pl.id}`)
        }
      }
      setNewName('')
      setCreatingKind(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to create')
    }
  }

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const {
    tracks,
    playlists,
    folders,
    fetchPlaylists,
    fetchFolders,
    smartFilter,
    setSmartFilter,
    filterBpm,
    setFilterBpm,
    filterKey,
    setFilterKey,
    filterGenre,
    setFilterGenre,
    filterTags,
    setFilterTags,
    filterRating,
    setFilterRating,
    clearAllFilters,
    getAllTags,
    getAllGenres,
    viewMode,
    setViewMode,
    getCollectionHealth,
    connectedDevices,
    fetchConnectedDevices,
    selectDevice,
    ejectConnectedDevice,
    addTrackToPlaylist,
  } = useLibraryStore()

  useEffect(() => {
    fetchPlaylists()
    fetchFolders()
    fetchConnectedDevices()

    let cleanup = null
    if (window.electronAPI?.onUsbDevicesChanged) {
      cleanup = window.electronAPI.onUsbDevicesChanged((payload) => {
        const list = Array.isArray(payload) ? payload : (payload?.devices || [])
        useLibraryStore.setState({ connectedDevices: list })
      })
    }

    const interval = setInterval(() => {
      fetchConnectedDevices()
    }, 5000)

    return () => {
      if (cleanup) cleanup()
      clearInterval(interval)
    }
  }, [fetchPlaylists, fetchFolders, fetchConnectedDevices])

  const recentlyAddedCount = tracks.filter((t) => {
    const date = new Date(t.createdAt || t.created_at)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return date > weekAgo
  }).length

  const health = getCollectionHealth()
  const allTags = getAllTags()
  const allGenres = getAllGenres()
  const hasActiveFilters = smartFilter || filterBpm || filterKey || filterGenre || filterTags.length > 0 || filterRating

  const getItemCount = (id) => {
    switch (id) {
      case 'all-tracks':
        return tracks.length
      case 'recently-added':
        return recentlyAddedCount
      case 'favorites':
        return tracks.filter((t) => (t.rating || 0) >= 4).length
      case 'duplicates':
        return health.duplicates
      case 'missing-tracks':
        return tracks.filter((t) => t.missing).length
      default:
        return null
    }
  }

  const getSmartPlaylistCount = (id) => {
    switch (id) {
      case 'high-energy':
        return tracks.filter((t) => (t.bpm || 0) >= 128).length
      case 'warm-up':
        return tracks.filter((t) => (t.bpm || 999) < 120).length
      case 'favorites':
        return tracks.filter((t) => (t.rating || 0) >= 4).length
      case 'unanalyzed':
        return tracks.filter((t) => !t.bpm || !t.key).length
      case 'missing-artwork':
        return tracks.filter((t) => !t.artwork).length
      case 'recent':
        return recentlyAddedCount
      default:
        return 0
    }
  }

  const handleNavClick = (id) => {
    setSmartFilter(null)
    selectDevice(null)
    onSubItemChange(id)
  }

  const handleDeviceClick = (device) => {
    setSmartFilter(null)
    selectDevice(device)
    onSubItemChange(`device-${device.id}`)
  }

  const handleEject = async (device, e) => {
    e.stopPropagation()
    if (!window.confirm(`Eject USB device "${device.name}"?`)) return
    try {
      await ejectConnectedDevice(device.id)
      toast.success(`Device ${device.name} safely ejected`)
    } catch (err) {
      toast.error('Failed to eject device')
    }
  }

  // Drag and Drop handlers for dropping tracks onto Playlists or USB Devices
  const handleDragOver = (targetId, e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverTarget(targetId)
  }

  const handleDragLeave = () => {
    setDragOverTarget(null)
  }

  const handleDropOnPlaylist = async (playlist, e) => {
    e.preventDefault()
    setDragOverTarget(null)
    try {
      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const data = JSON.parse(dataStr)
      if (Array.isArray(data.trackIds)) {
        for (const tid of data.trackIds) {
          await addTrackToPlaylist(playlist.id, tid).catch(() => {})
        }
        toast.success(`Added ${data.trackIds.length} track(s) to ${playlist.name}`)
      }
    } catch (err) {
      console.warn('Drop error:', err)
    }
  }

  const handleDropOnDevice = (device, e) => {
    e.preventDefault()
    setDragOverTarget(null)
    try {
      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const data = JSON.parse(dataStr)
      if (Array.isArray(data.trackIds)) {
        const droppedTracks = tracks.filter((t) => data.trackIds.includes(t.id))
        onOpenExportModal?.(droppedTracks, device)
      }
    } catch (err) {
      console.warn('Device drop error:', err)
    }
  }

  const renderNavItems = (items) => (
    <div className="space-y-0.5 px-3 py-2">
      {items.map((item) => {
        const Icon = item.icon
        const count = getItemCount(item.id)
        const isActive = activeSubItem === item.id && !smartFilter && !activeSubItem.startsWith('device-')

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-brand-accent text-brand-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">{item.label}</span>
            {count !== null && (
              <span className={`text-[11px] font-mono ${isActive ? 'text-brand-primary/80' : 'text-text-muted'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="w-64 bg-background-secondary border-r border-border flex flex-col h-full select-none shrink-0 overflow-hidden">
      {(activeTab === 'library' || activeTab === 'import' || activeTab === 'export') && (
        <>
          {/* View Mode Toggle */}
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1">
              View
            </span>
            <div className="flex items-center gap-0.5 bg-background-primary p-0.5 rounded border border-border">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1 rounded transition-colors ${viewMode === 'table' ? 'bg-brand-accent text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-brand-accent text-brand-primary' : 'text-text-muted hover:text-text-primary'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Standard Library Collections */}
          {renderNavItems(libraryNavItems)}

          {/* Connected Devices (DJ USB Drives) */}
          <div className="px-3 py-2 border-t border-border/50">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                <Usb className="w-3 h-3 text-brand-accent" />
                <span>Connected Devices</span>
              </span>
              <span className="text-[10px] text-text-muted font-mono">{connectedDevices.length}</span>
            </div>

            <div className="space-y-1">
              {connectedDevices.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-text-muted italic bg-background-primary/30 rounded border border-border/40 text-center">
                  No USB drives connected
                </div>
              ) : (
                connectedDevices.map((device) => {
                  const isActive = activeSubItem === `device-${device.id}`
                  const isDragTarget = dragOverTarget === `device-${device.id}`
                  const detected = device.library?.detected || []

                  return (
                    <div
                      key={device.id}
                      onDragOver={(e) => handleDragOver(`device-${device.id}`, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnDevice(device, e)}
                      onClick={() => handleDeviceClick(device)}
                      className={`group w-full p-2 rounded-lg cursor-pointer transition-all border ${
                        isDragTarget
                          ? 'border-brand-accent bg-brand-accent-dim/80 ring-2 ring-brand-accent/50'
                          : isActive
                          ? 'border-brand-accent/70 bg-brand-accent-dim text-brand-accent shadow-xs'
                          : 'border-border/40 bg-background-primary/40 hover:bg-background-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <HardDrive className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-accent' : 'text-brand-tertiary'}`} />
                          <span className="text-xs font-semibold truncate max-w-[130px]">
                            {device.name}
                          </span>
                        </div>

                        {/* Eject Button */}
                        <button
                          onClick={(e) => handleEject(device, e)}
                          title="Eject USB device"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted font-mono">
                        <span>{device.free || 'Ready'}</span>
                        {detected.length > 0 && (
                          <span className="text-[9px] uppercase tracking-wider text-brand-accent bg-brand-accent-dim px-1 rounded">
                            {detected[0].replace('-usb', '')}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Smart Auto-Crates */}
          <div className="px-3 py-1 border-t border-border/50">
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">
              Smart Crates
            </div>
            <div className="space-y-0.5">
              {smartPlaylists.slice(0, 4).map((playlist) => {
                const Icon = playlist.icon
                const count = getSmartPlaylistCount(playlist.id)
                const isActive = smartFilter === playlist.id

                return (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      setSmartFilter(isActive ? null : playlist.id)
                      selectDevice(null)
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      isActive
                        ? 'bg-brand-accent-dim text-brand-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="flex-1 text-left truncate">{playlist.label}</span>
                    <span className="text-text-muted text-[10px] font-mono">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Collection Health */}
          <div className="px-3 py-1.5">
            <button
              onClick={() => onHealthClick?.()}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded-md transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-brand-accent" />
              <span className="flex-1 text-left font-medium">Collection Health</span>
              {health.unanalyzed > 0 && (
                <span className="px-1.5 py-0.2 bg-yellow-400/20 text-yellow-300 text-[9px] font-mono rounded-full">
                  {health.unanalyzed}
                </span>
              )}
            </button>
          </div>

          {/* User Playlists & Crates (MIXO Hierarchical Folder Tree) */}
          <div className="flex-1 overflow-y-auto px-3 py-1 border-t border-border/50">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Playlists ({playlists.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setCreatingKind('folder')
                    setNewName('')
                  }}
                  className="text-text-muted hover:text-brand-sky transition-colors"
                  title="New Folder"
                >
                  <Folder className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setCreatingKind('playlist')
                    setNewName('')
                  }}
                  className="text-text-muted hover:text-brand-accent transition-colors"
                  title="New Playlist"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {creatingKind && (
              <form onSubmit={handleSubmitNewItem} className="mb-2 px-1 flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingKind(null)
                      setNewName('')
                    }
                  }}
                  placeholder={creatingKind === 'folder' ? 'Folder name...' : 'Playlist name...'}
                  className="flex-1 min-w-0 px-2 py-1 rounded bg-background-primary border border-brand-accent/60 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded bg-brand-accent text-brand-primary text-[11px] font-bold hover:bg-brand-accent-hover shrink-0"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingKind(null)
                    setNewName('')
                  }}
                  className="p-1 text-text-muted hover:text-text-primary shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}

            <div className="space-y-0.5">
              {playlists.length === 0 && folders.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-text-muted italic">No playlists yet</div>
              ) : (
                (() => {
                  // Build folder tree from folders + %% Serato naming
                  const virtualFolders = new Map()
                  const rootPlaylists = []
                  const byFolder = new Map()

                  for (const f of folders) {
                    virtualFolders.set(String(f.id), { id: String(f.id), name: f.name, parentId: f.parent_id ? String(f.parent_id) : null })
                  }

                  for (const pl of playlists) {
                    if (pl.folder_id && virtualFolders.has(String(pl.folder_id))) {
                      const fid = String(pl.folder_id)
                      if (!byFolder.has(fid)) byFolder.set(fid, [])
                      byFolder.get(fid).push(pl)
                    } else if (pl.name && pl.name.includes('%%')) {
                      const parts = pl.name.split('%%').map((s) => s.trim()).filter(Boolean)
                      let parentId = null
                      for (let i = 0; i < parts.length - 1; i += 1) {
                        const fid = `vfolder:${parts.slice(0, i + 1).join('/')}`
                        if (!virtualFolders.has(fid)) {
                          virtualFolders.set(fid, { id: fid, name: parts[i], parentId })
                        }
                        parentId = fid
                      }
                      const leaf = { ...pl, displayName: parts[parts.length - 1] }
                      if (parentId) {
                        if (!byFolder.has(parentId)) byFolder.set(parentId, [])
                        byFolder.get(parentId).push(leaf)
                      } else {
                        rootPlaylists.push(leaf)
                      }
                    } else {
                      rootPlaylists.push(pl)
                    }
                  }

                  const childFoldersByParent = new Map()
                  for (const f of virtualFolders.values()) {
                    const key = f.parentId || 'root'
                    if (!childFoldersByParent.has(key)) childFoldersByParent.set(key, [])
                    childFoldersByParent.get(key).push(f)
                  }

                  const renderPlaylistRow = (playlist, depth = 0) => {
                    const isActive = activeSubItem === `playlist-${playlist.id}` && !smartFilter
                    const isDragTarget = dragOverTarget === `playlist-${playlist.id}`
                    const count = playlist.track_count ?? playlist.trackIds?.length

                    return (
                      <button
                        key={playlist.id}
                        onDragOver={(e) => handleDragOver(`playlist-${playlist.id}`, e)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnPlaylist(playlist, e)}
                        onClick={() => handleNavClick(`playlist-${playlist.id}`)}
                        style={{ paddingLeft: `${10 + depth * 12}px` }}
                        className={`w-full flex items-center gap-2 pr-2 py-1 text-[12px] rounded-md transition-colors ${
                          isDragTarget
                            ? 'border border-brand-accent bg-brand-accent-dim ring-1 ring-brand-accent'
                            : isActive
                            ? 'bg-brand-accent-dim text-brand-accent font-medium'
                            : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                        }`}
                      >
                        <Disc3 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                        <span className="flex-1 text-left truncate">{playlist.displayName || playlist.name}</span>
                        {count !== undefined && (
                          <span className="text-text-muted text-[10px] font-mono">({count})</span>
                        )}
                      </button>
                    )
                  }

                  const renderFolderBranch = (folder, depth = 0) => {
                    const isOpen = expandedFolders.has(folder.id)
                    const subFolders = (childFoldersByParent.get(folder.id) || []).sort((a, b) => a.name.localeCompare(b.name))
                    const subPlaylists = (byFolder.get(folder.id) || []).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))

                    return (
                      <div key={folder.id}>
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          style={{ paddingLeft: `${6 + depth * 12}px` }}
                          className="w-full flex items-center gap-1.5 pr-2 py-1 text-[12px] text-text-primary/90 hover:bg-background-tertiary rounded-md transition-colors"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
                          ) : (
                            <ChevronRight className="w-3 h-3 shrink-0 text-text-muted" />
                          )}
                          <Folder className="w-3.5 h-3.5 shrink-0 text-brand-accent/85" />
                          <span className="flex-1 text-left truncate font-medium">{folder.name}</span>
                          <span className="text-[10px] font-mono text-text-muted">
                            {subPlaylists.length + subFolders.length}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="space-y-0.5 mt-0.5">
                            {subFolders.map((sf) => renderFolderBranch(sf, depth + 1))}
                            {subPlaylists.map((pl) => renderPlaylistRow(pl, depth + 1))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  const topFolders = (childFoldersByParent.get('root') || []).sort((a, b) => a.name.localeCompare(b.name))
                  const sortedRootPlaylists = [...rootPlaylists].sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))

                  return (
                    <>
                      {topFolders.map((f) => renderFolderBranch(f, 0))}
                      {sortedRootPlaylists.map((pl) => renderPlaylistRow(pl, 0))}
                    </>
                  )
                })()
              )}
            </div>
          </div>

          {/* New Playlist Action Footer */}
          <div className="p-3 border-t border-border">
            <button
              onClick={() => {
                setCreatingKind('playlist')
                setNewName('')
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-background-tertiary hover:bg-background-elevated text-text-secondary hover:text-brand-accent text-[12px] font-medium rounded-lg transition-colors border border-border/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playlist</span>
            </button>
          </div>
        </>
      )}

      {activeTab === 'tools' && renderNavItems(toolsNavItems)}
      {activeTab === 'integration' && renderNavItems(integrationNavItems)}
      {activeTab === 'settings' && renderNavItems(settingsNavItems)}
    </div>
  )
}
