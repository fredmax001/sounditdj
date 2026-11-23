import { create } from 'zustand'
import axios, { getAuthToken } from '../config/axios.js'
import { analyzeTrackAudio } from '../utils/audioAnalyzer.js'

const useLibraryStore = create((set, get) => ({
  // Tracks
  tracks: [],
  isLoading: false,
  error: null,
  
  // Filters
  searchQuery: '',
  sortBy: 'dateAdded',
  sortOrder: 'desc',
  filterBpm: null,
  filterKey: null,
  filterGenre: null,
  filterTags: [],
  filterRating: null,
  
  // View mode (Mixo-style)
  viewMode: 'table', // 'table' | 'grid'

  // USB Devices & External Media
  connectedDevices: [],
  activeDevice: null,
  deviceTracks: [],
  isLoadingDevice: false,
  
  // Smart playlist filter (Mixo-style auto-crates)
  smartFilter: null, // { type: 'high-energy' | 'warm-up' | 'unanalyzed' | 'long-tracks' | 'missing-artwork' | 'recent' }
  
  // Playlists
  playlists: [],
  currentPlaylist: null,
  
  // Upload progress
  uploadProgress: {},
  isUploading: false,

  // Live DJ Import / Analysis Progress (MIXO-style global status)
  importProgress: {
    active: false,
    status: 'idle', // 'idle' | 'running' | 'complete' | 'cancelled' | 'error'
    stage: 'idle',
    source: '',
    message: '',
    analyzed: 0,
    total: 0,
    failed: 0,
    speed: 0,
    etaSeconds: null,
    recentTracks: [],
    logFile: null,
    error: null,
    steps: {
      save: 'pending',
      analyze: 'pending',
      smartPlaylists: 'pending',
      artwork: 'pending',
      upload: 'pending',
      sync: 'pending',
    },
  },

  setImportProgress: (patch) =>
    set((state) => ({
      importProgress: {
        ...state.importProgress,
        ...patch,
        steps: patch.steps
          ? { ...state.importProgress.steps, ...patch.steps }
          : state.importProgress.steps,
      },
    })),

  // Actions
  setTracks: (tracks) => set({ tracks }),
  
  fetchTracks: async () => {
    set({ isLoading: true, error: null })
    let localTracks = []
    try {
      if (window.electronAPI?.loadLocalLibrary) {
        const local = await window.electronAPI.loadLocalLibrary()
        localTracks = local?.tracks || []
      }
    } catch {
      // ignore local load error
    }
    try {
      const response = await axios.get('/api/library/list')
      const remoteTracks = response.data?.tracks || []
      const seen = new Set(remoteTracks.map((t) => String(t.path || t.id).toLowerCase()))
      const merged = [
        ...remoteTracks,
        ...localTracks.filter((t) => !seen.has(String(t.path || t.id).toLowerCase())),
      ]
      set({ tracks: merged, isLoading: false })
    } catch (error) {
      set({ tracks: localTracks, error: localTracks.length ? null : error.message, isLoading: false })
    }
  },

  addTrack: (track) => set((state) => ({ 
    tracks: [track, ...state.tracks] 
  })),

  updateTrack: async (id, updates) => {
    try {
      const response = await axios.put(`/api/library/update/${id}`, updates)
      set((state) => ({
        tracks: state.tracks.map((track) =>
          track.id === id ? response.data.track : track
        ),
      }))
      return response.data.track
    } catch (error) {
      console.error('Failed to update track:', error)
      throw error
    }
  },

  deleteTrack: async (id) => {
    set((state) => {
      const tracks = state.tracks.filter((track) => String(track.id) !== String(id))
      const playlists = state.playlists.map((pl) =>
        Array.isArray(pl.trackIds)
          ? {
              ...pl,
              trackIds: pl.trackIds.filter((tid) => String(tid) !== String(id)),
              track_count: pl.trackIds.filter((tid) => String(tid) !== String(id)).length,
            }
          : pl,
      )
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks, playlists, folders: state.folders })
      }
      return { tracks, playlists }
    })
    if (!String(id).startsWith('local-')) {
      try {
        await axios.delete(`/api/library/${id}`)
      } catch {
        // already deleted locally
      }
    }
  },

  // Filters
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setFilterBpm: (bpm) => set({ filterBpm: bpm }),
  setFilterKey: (key) => set({ filterKey: key }),
  setFilterGenre: (genre) => set({ filterGenre: genre }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  setFilterRating: (rating) => set({ filterRating: rating }),
  
  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Smart playlist filter
  setSmartFilter: (filter) => set({ smartFilter: filter }),
  clearAllFilters: () => set({ 
    searchQuery: '', 
    filterBpm: null, 
    filterKey: null, 
    filterGenre: null, 
    filterTags: [], 
    filterRating: null,
    smartFilter: null 
  }),

  // Get filtered and sorted tracks
  getFilteredTracks: () => {
    const { 
      tracks, searchQuery, sortBy, sortOrder, 
      filterBpm, filterKey, filterGenre, filterTags, filterRating,
      smartFilter 
    } = get()
    
    let filtered = tracks
    
    // Smart playlist filter (Mixo-style auto-crates)
    if (smartFilter) {
      switch (smartFilter) {
        case 'high-energy':
          filtered = filtered.filter(t => (t.bpm || 0) >= 128)
          break
        case 'warm-up':
          filtered = filtered.filter(t => (t.bpm || 999) < 120)
          break
        case 'unanalyzed':
          filtered = filtered.filter(t => !t.bpm || !t.key)
          break
        case 'long-tracks':
          filtered = filtered.filter(t => (t.duration || 0) > 300)
          break
        case 'missing-artwork':
          filtered = filtered.filter(t => !t.artwork)
          break
        case 'recent':
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          filtered = filtered.filter(t => new Date(t.created_at || t.createdAt || 0) > weekAgo)
          break
        case 'favorites':
          filtered = filtered.filter(t => (t.rating || 0) >= 4)
          break
        default:
          break
      }
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (track) =>
          track.title?.toLowerCase().includes(query) ||
          track.artist?.toLowerCase().includes(query) ||
          track.album?.toLowerCase().includes(query) ||
          track.genre?.toLowerCase().includes(query)
      )
    }
    
    // BPM filter
    if (filterBpm) {
      filtered = filtered.filter(
        (track) => track.bpm >= filterBpm.min && track.bpm <= filterBpm.max
      )
    }
    
    // Key filter
    if (filterKey) {
      filtered = filtered.filter((track) => track.key === filterKey)
    }
    
    // Genre filter
    if (filterGenre) {
      filtered = filtered.filter((track) => track.genre === filterGenre)
    }
    
    // Tags filter
    if (filterTags.length > 0) {
      filtered = filtered.filter((track) => {
        let trackTags = []
        if (Array.isArray(track.tags)) trackTags = track.tags
        else if (typeof track.tags === 'string' && track.tags.trim()) {
          try { trackTags = JSON.parse(track.tags) } catch { trackTags = [] }
        }
        return filterTags.some((tag) => trackTags.includes(tag))
      })
    }
    
    // Rating filter
    if (filterRating) {
      filtered = filtered.filter((track) => (track.rating || 0) >= filterRating)
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '')
          break
        case 'artist':
          comparison = (a.artist || '').localeCompare(b.artist || '')
          break
        case 'bpm':
          comparison = (a.bpm || 0) - (b.bpm || 0)
          break
        case 'key':
          comparison = (a.key || '').localeCompare(b.key || '')
          break
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0)
          break
        case 'genre':
          comparison = (a.genre || '').localeCompare(b.genre || '')
          break
        case 'dateAdded':
        default:
          comparison = new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return filtered
  },

  // Mixo-style collection health stats
  getCollectionHealth: () => {
    const { tracks } = get()
    const duplicates = []
    const seen = new Map()
    
    tracks.forEach(track => {
      const key = `${track.title?.toLowerCase()}-${track.artist?.toLowerCase()}`
      if (seen.has(key)) {
        duplicates.push(track)
      } else {
        seen.set(key, track)
      }
    })
    
    return {
      totalTracks: tracks.length,
      unanalyzed: tracks.filter(t => !t.bpm || !t.key).length,
      missingArtwork: tracks.filter(t => !t.artwork).length,
      duplicates: duplicates.length,
      totalDuration: tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
      avgBpm: tracks.length > 0 ? tracks.reduce((sum, t) => sum + (t.bpm || 0), 0) / tracks.filter(t => t.bpm).length : 0,
      genres: [...new Set(tracks.map(t => t.genre).filter(Boolean))],
    }
  },
  
  // Get all unique tags from tracks
  getAllTags: () => {
    const { tracks } = get()
    const tagSet = new Set()
    tracks.forEach((track) => {
      if (Array.isArray(track.tags)) {
        track.tags.forEach((tag) => tagSet.add(tag))
      } else if (typeof track.tags === 'string' && track.tags.trim()) {
        try {
          const tags = JSON.parse(track.tags)
          if (Array.isArray(tags)) tags.forEach((tag) => tagSet.add(tag))
        } catch {
          // ignore parse errors
        }
      }
    })
    return Array.from(tagSet).sort()
  },
  
  // Get all unique genres from tracks
  getAllGenres: () => {
    const { tracks } = get()
    return [...new Set(tracks.map(t => t.genre).filter(Boolean))].sort()
  },

  // Playlists
  fetchPlaylists: async () => {
    let localPlaylists = []
    let localFolders = []
    try {
      if (window.electronAPI?.loadLocalLibrary) {
        const local = await window.electronAPI.loadLocalLibrary()
        localPlaylists = local?.playlists || []
        localFolders = local?.folders || []
      }
    } catch {
      // ignore
    }
    try {
      const response = await axios.get('/api/playlist/list')
      const remotePlaylists = response.data?.playlists || []
      const seen = new Set(remotePlaylists.map((p) => String(p.id)))
      const merged = [
        ...remotePlaylists,
        ...localPlaylists.filter((p) => !seen.has(String(p.id))),
      ]
      set((state) => ({
        playlists: merged,
        folders: state.folders.length ? state.folders : localFolders,
      }))
    } catch (error) {
      if (localPlaylists.length || localFolders.length) {
        set((state) => ({
          playlists: localPlaylists,
          folders: state.folders.length ? state.folders : localFolders,
        }))
      } else {
        console.error('Failed to fetch playlists:', error)
      }
    }
  },

  mergeImportedLibrary: async ({ tracks: newTracks = [], playlists: newPlaylists = [], folders: newFolders = [] }) => {
    const state = get()
    const trackMap = new Map()
    for (const t of state.tracks) {
      trackMap.set(String(t.path || t.id).toLowerCase(), t)
    }
    const idRemap = new Map()
    const mergedTracks = [...state.tracks]
    for (const t of newTracks) {
      const key = String(t.path || t.id).toLowerCase()
      const existing = trackMap.get(key)
      if (existing) {
        idRemap.set(String(t.id), existing.id)
      } else {
        trackMap.set(key, t)
        mergedTracks.push(t)
        idRemap.set(String(t.id), t.id)
      }
    }

    const folderMap = new Map()
    for (const f of state.folders) {
      folderMap.set(`${f.parent_id || 'root'}::${String(f.name).toLowerCase()}`, f)
    }
    const folderIdRemap = new Map()
    const mergedFolders = [...state.folders]
    for (const f of newFolders) {
      const mappedParent = f.parent_id ? (folderIdRemap.get(String(f.parent_id)) || f.parent_id) : null
      const key = `${mappedParent || 'root'}::${String(f.name).toLowerCase()}`
      const existing = folderMap.get(key)
      if (existing) {
        folderIdRemap.set(String(f.id), existing.id)
      } else {
        const created = { ...f, parent_id: mappedParent }
        folderMap.set(key, created)
        mergedFolders.push(created)
        folderIdRemap.set(String(f.id), created.id)
      }
    }

    const playlistMap = new Map()
    for (const p of state.playlists) {
      playlistMap.set(`${p.folder_id || 'root'}::${String(p.name).toLowerCase()}`, p)
    }
    const mergedPlaylists = [...state.playlists]
    for (const p of newPlaylists) {
      const mappedFolder = p.folder_id ? (folderIdRemap.get(String(p.folder_id)) || p.folder_id) : null
      const mappedTrackIds = (p.trackIds || []).map((tid) => idRemap.get(String(tid)) || tid)
      const key = `${mappedFolder || 'root'}::${String(p.name).toLowerCase()}`
      const existing = playlistMap.get(key)
      if (existing) {
        const combinedIds = Array.from(new Set([...(existing.trackIds || []), ...mappedTrackIds]))
        existing.trackIds = combinedIds
        existing.track_count = combinedIds.length
      } else {
        const created = {
          ...p,
          folder_id: mappedFolder,
          trackIds: mappedTrackIds,
          track_count: mappedTrackIds.length,
        }
        playlistMap.set(key, created)
        mergedPlaylists.push(created)
      }
    }

    set({
      tracks: mergedTracks,
      playlists: mergedPlaylists,
      folders: mergedFolders,
    })

    if (window.electronAPI?.saveLocalLibrary) {
      await window.electronAPI.saveLocalLibrary({
        tracks: mergedTracks,
        playlists: mergedPlaylists,
        folders: mergedFolders,
      })
    }
  },

  createPlaylist: async (name, folderId = null) => {
    const cleanName = String(name || '').trim()
    if (!cleanName) return null

    // Always create locally first so adding playlists works offline & instantly in Desktop!
    const localPlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      folder_id: folderId || null,
      trackIds: [],
      track_count: 0,
      created_at: new Date().toISOString(),
    }

    try {
      const response = await axios.post('/api/playlist/create', { name: cleanName, folderId })
      const remotePl = response.data?.playlist
      if (remotePl?.id) {
        const mergedPl = { ...remotePl, trackIds: remotePl.trackIds || [], track_count: remotePl.track_count || 0 }
        set((state) => {
          const playlists = [...state.playlists, mergedPl]
          if (window.electronAPI?.saveLocalLibrary) {
            window.electronAPI.saveLocalLibrary({ tracks: state.tracks, playlists, folders: state.folders })
          }
          return { playlists }
        })
        return mergedPl
      }
    } catch {
      // Offline or not signed in to cloud — save locally cleanly
    }

    set((state) => {
      const playlists = [...state.playlists, localPlaylist]
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks: state.tracks, playlists, folders: state.folders })
      }
      return { playlists }
    })
    return localPlaylist
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    // Update locally immediately
    set((state) => {
      const playlists = state.playlists.map((pl) => {
        if (String(pl.id) !== String(playlistId)) return pl
        const existing = Array.isArray(pl.trackIds) ? pl.trackIds : []
        if (existing.some((id) => String(id) === String(trackId))) return pl
        const nextIds = [...existing, trackId]
        return { ...pl, trackIds: nextIds, track_count: nextIds.length }
      })
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks: state.tracks, playlists, folders: state.folders })
      }
      return { playlists }
    })

    if (!String(playlistId).startsWith('pl-') && !String(trackId).startsWith('local-')) {
      try {
        await axios.post('/api/playlist/add-track', { playlistId, trackId })
      } catch {
        // already persisted locally
      }
    }
  },

  // Cue Points (supports both local Serato/Rekordbox tracks & cloud tracks)
  fetchCuePoints: async (trackId) => {
    const localTrack = get().tracks.find((t) => String(t.id) === String(trackId))
    if (localTrack && Array.isArray(localTrack.cues) && localTrack.cues.length > 0) {
      return localTrack.cues.map((c, idx) => ({
        id: c.id || `cue-${trackId}-${idx}`,
        name: c.name || `CUE ${idx + 1}`,
        position: Number(c.position) || 0,
        color: c.color || '#FAE1AF',
        slot: c.slot ?? idx,
      }))
    }
    if (String(trackId).startsWith('local-')) {
      return localTrack?.cues || []
    }
    try {
      const response = await axios.get(`/api/library/cues/${trackId}`)
      return response.data.cues || []
    } catch {
      return localTrack?.cues || []
    }
  },

  createCuePoint: async (trackId, cueData) => {
    const newCue = {
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cueData.name || 'CUE',
      position: Number(cueData.position) || 0,
      color: cueData.color || '#FAE1AF',
      kind: 'hot',
    }

    // Update track locally right away and persist
    set((state) => {
      const tracks = state.tracks.map((t) =>
        String(t.id) === String(trackId)
          ? { ...t, cues: [...(t.cues || []), newCue] }
          : t,
      )
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks, playlists: state.playlists, folders: state.folders })
      }
      return { tracks }
    })

    if (!String(trackId).startsWith('local-')) {
      try {
        const response = await axios.post('/api/library/cues', { trackId, ...cueData })
        if (response.data?.cue) return response.data.cue
      } catch {
        // keep local cue
      }
    }
    return newCue
  },

  updateCuePoint: async (id, updates) => {
    try {
      const response = await axios.put(`/api/library/cues/${id}`, updates)
      return response.data.cue
    } catch (error) {
      console.error('Failed to update cue point:', error)
      throw error
    }
  },

  deleteCuePoint: async (id, trackId = null) => {
    set((state) => {
      const tracks = state.tracks.map((t) => {
        if (trackId && String(t.id) !== String(trackId)) return t
        if (!Array.isArray(t.cues)) return t
        const nextCues = t.cues.filter((c, idx) => String(c.id || `cue-${t.id}-${idx}`) !== String(id))
        return nextCues.length !== t.cues.length ? { ...t, cues: nextCues } : t
      })
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks, playlists: state.playlists, folders: state.folders })
      }
      return { tracks }
    })
    if (!String(id).startsWith('cue-')) {
      try {
        await axios.delete(`/api/library/cues/${id}`)
      } catch {
        // ignore
      }
    }
  },

  // Related Tracks
  fetchRelatedTracks: async (trackId) => {
    try {
      const response = await axios.get(`/api/library/related/${trackId}`)
      return response.data.related || response.data.tracks || []
    } catch (error) {
      console.error('Failed to fetch related tracks:', error)
      return []
    }
  },

  // Playlist detail
  fetchPlaylistTracks: async (playlistId) => {
    const { playlists, tracks } = get()
    const localPlaylist = playlists.find((p) => String(p.id) === String(playlistId))
    if (localPlaylist && Array.isArray(localPlaylist.trackIds)) {
      const trackById = new Map(tracks.map((t) => [String(t.id), t]))
      const resolved = localPlaylist.trackIds.map((id) => trackById.get(String(id))).filter(Boolean)
      return { ...localPlaylist, tracks: resolved }
    }
    try {
      const response = await axios.get(`/api/playlist/${playlistId}`)
      return response.data.playlist
    } catch (error) {
      console.error('Failed to fetch playlist:', error)
      return localPlaylist ? { ...localPlaylist, tracks: [] } : null
    }
  },

  // Missing Files & Real Local Disk Relocation
  fetchMissingFiles: async () => {
    const { tracks, playlists, folders } = get()
    if (window.electronAPI?.recheckLocalTracks) {
      const res = await window.electronAPI.recheckLocalTracks(tracks)
      if (Array.isArray(res?.tracks)) {
        set({ tracks: res.tracks })
        if (window.electronAPI?.saveLocalLibrary) {
          await window.electronAPI.saveLocalLibrary({ tracks: res.tracks, playlists, folders })
        }
        return {
          missing: res.tracks.filter((t) => t.missing),
          relinkedCount: res.relinkedCount || 0,
        }
      }
    }
    try {
      const response = await axios.get('/api/library/missing-files')
      const list = Array.isArray(response.data?.missing) ? response.data.missing : []
      return { missing: list, relinkedCount: 0 }
    } catch (error) {
      console.error('Failed to fetch missing files:', error)
      return { missing: tracks.filter((t) => t.missing), relinkedCount: 0 }
    }
  },

  relocateMissingFromFolder: async (searchDir) => {
    const { tracks, playlists, folders } = get()
    if (!window.electronAPI?.relocateMissingTracks) {
      throw new Error('Folder relocation is available in the desktop app.')
    }
    const res = await window.electronAPI.relocateMissingTracks({ tracks, searchDir })
    if (res?.success && Array.isArray(res.tracks)) {
      set({ tracks: res.tracks })
      if (window.electronAPI?.saveLocalLibrary) {
        await window.electronAPI.saveLocalLibrary({ tracks: res.tracks, playlists, folders })
      }
    }
    return res
  },

  // Bulk Find & Replace
  bulkReplace: async (field, search, replace, trackIds) => {
    try {
      const response = await axios.post('/api/library/bulk-replace', { field, search, replace, trackIds })
      // Refresh tracks after bulk update
      await get().fetchTracks()
      return response.data
    } catch (error) {
      console.error('Failed to bulk replace:', error)
      throw error
    }
  },

  // Playlist Folders
  folders: [],

  fetchFolders: async () => {
    let localFolders = []
    try {
      if (window.electronAPI?.loadLocalLibrary) {
        const local = await window.electronAPI.loadLocalLibrary()
        localFolders = local?.folders || []
      }
    } catch {
      // ignore
    }
    try {
      const response = await axios.get('/api/playlist/folders')
      const remoteFolders = response.data?.folders || []
      const seen = new Set(remoteFolders.map((f) => String(f.id)))
      set({
        folders: [...remoteFolders, ...localFolders.filter((f) => !seen.has(String(f.id)))],
      })
    } catch (error) {
      if (localFolders.length) {
        set({ folders: localFolders })
      } else {
        console.error('Failed to fetch folders:', error)
      }
    }
  },

  createFolder: async (name, parentId = null) => {
    const cleanName = String(name || '').trim()
    if (!cleanName) return null
    const localFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      parent_id: parentId || null,
    }
    try {
      const response = await axios.post('/api/playlist/folders', { name: cleanName, parentId })
      if (response.data?.folder?.id) {
        set((state) => {
          const folders = [...state.folders, response.data.folder]
          if (window.electronAPI?.saveLocalLibrary) {
            window.electronAPI.saveLocalLibrary({ tracks: state.tracks, playlists: state.playlists, folders })
          }
          return { folders }
        })
        return response.data.folder
      }
    } catch {
      // Save locally cleanly
    }
    set((state) => {
      const folders = [...state.folders, localFolder]
      if (window.electronAPI?.saveLocalLibrary) {
        window.electronAPI.saveLocalLibrary({ tracks: state.tracks, playlists: state.playlists, folders })
      }
      return { folders }
    })
    return localFolder
  },

  // Upload
  setUploadProgress: (fileName, progress) =>
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [fileName]: progress },
    })),

  setIsUploading: (isUploading) => set({ isUploading }),

  uploadTrack: async (file, onProgress) => {
    const formData = new FormData()
    formData.append('audio', file)

    try {
      set((state) => ({ 
        isUploading: true,
        uploadProgress: { ...state.uploadProgress, [file.name]: 0 }
      }))
      
      const response = await axios.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          set((state) => ({
            uploadProgress: { ...state.uploadProgress, [file.name]: progress },
          }))
          if (onProgress) onProgress(progress)
        },
      })

      const newTrack = response.data.track
      set((state) => ({
        tracks: [newTrack, ...state.tracks],
        isUploading: false,
      }))
      
      return newTrack
    } catch (error) {
      set({ isUploading: false })
      throw error
    }
  },

  // Track Analysis Actions (Real Web Audio DSP: accurate BPM, Camelot Key, Beatgrid & 3-Band Waveform)
  analyzingTrackIds: new Set(),

  analyzeTrack: async (trackId) => {
    const targetTrack = get().tracks.find((t) => String(t.id) === String(trackId))
    if (!targetTrack) throw new Error('Track not found')

    set((state) => ({
      analyzingTrackIds: new Set([...state.analyzingTrackIds, trackId]),
    }))

    try {
      const token = getAuthToken()
      const dsp = await analyzeTrackAudio(targetTrack, token)
      const updated = { ...targetTrack, ...dsp }

      set((state) => {
        const tracks = state.tracks.map((t) => (String(t.id) === String(trackId) ? updated : t))
        if (window.electronAPI?.saveLocalLibrary) {
          window.electronAPI.saveLocalLibrary({
            tracks,
            playlists: state.playlists,
            folders: state.folders,
          })
        }
        return {
          tracks,
          analyzingTrackIds: new Set([...state.analyzingTrackIds].filter((id) => String(id) !== String(trackId))),
        }
      })

      // Also persist BPM/Key to backend if this is a cloud track
      if (!String(trackId).startsWith('local-')) {
        axios.put(`/api/library/update/${trackId}`, {
          bpm: updated.bpm,
          key: updated.key,
          duration: updated.duration,
        }).catch(() => {})
      }

      return updated
    } catch (error) {
      console.error('Track analysis failed:', error)
      set((state) => ({
        analyzingTrackIds: new Set([...state.analyzingTrackIds].filter((id) => String(id) !== String(trackId))),
      }))
      throw error
    }
  },

  analyzeTracksBatch: async (trackIds) => {
    const results = []
    for (const id of trackIds) {
      try {
        const track = await get().analyzeTrack(id)
        results.push({ id, success: true, track })
      } catch (err) {
        results.push({ id, success: false, error: err.message })
      }
    }
    return results
  },

  // USB Devices
  fetchConnectedDevices: async () => {
    try {
      if (window.electronAPI?.getUsbDevices) {
        const devices = await window.electronAPI.getUsbDevices()
        set({ connectedDevices: Array.isArray(devices) ? devices : [] })
        return devices
      }
      const response = await axios.get('/api/transfer/devices')
      const devices = response.data?.devices || []
      set({ connectedDevices: devices })
      return devices
    } catch (error) {
      console.warn('Failed to fetch USB devices:', error)
      set({ connectedDevices: [] })
      return []
    }
  },

  selectDevice: async (device) => {
    set({ activeDevice: device, isLoadingDevice: Boolean(device) })
    if (!device) {
      set({ deviceTracks: [] })
      return
    }
    try {
      if (window.electronAPI?.browseUsbDeviceTracks && device.mountPoint) {
        const tracks = await window.electronAPI.browseUsbDeviceTracks(device.mountPoint)
        set({ deviceTracks: Array.isArray(tracks) ? tracks : [], isLoadingDevice: false })
        return
      }
      const response = await axios.get(`/api/transfer/devices/${device.id}/tracks`)
      set({ deviceTracks: response.data?.tracks || [], isLoadingDevice: false })
    } catch (error) {
      console.error('Failed to load device tracks:', error)
      set({ deviceTracks: [], isLoadingDevice: false })
    }
  },

  ejectConnectedDevice: async (deviceId) => {
    try {
      if (window.electronAPI?.ejectUsbDevice) {
        await window.electronAPI.ejectUsbDevice(deviceId)
      } else {
        await axios.post(`/api/transfer/devices/${deviceId}/eject`)
      }
      const { activeDevice } = get()
      if (activeDevice?.id === deviceId) {
        set({ activeDevice: null, deviceTracks: [] })
      }
      await get().fetchConnectedDevices()
    } catch (error) {
      console.error('Eject failed:', error)
      throw error
    }
  },

  importLocalFromUsb: async (filePaths, copyAudio = true) => {
    try {
      const response = await axios.post('/api/transfer/devices/import-local', { filePaths, copyAudio })
      await get().fetchTracks()
      return response.data
    } catch (error) {
      console.error('Import locally failed:', error)
      throw error
    }
  },
}))

export default useLibraryStore
