import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Activity,
  Music,
  FileCode,
  Disc3,
  Radio,
  Cpu,
  Disc,
  Headphones,
  ListMusic,
  FolderOpen,
  FilePlus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  CheckSquare,
  Square,
  FolderInput,
  Sliders,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useLibraryStore from '@store/libraryStore'
import axios from '../config/axios.js'

const FULL_IMPORT_SOURCES = [
  {
    id: 'tracks',
    label: 'Tracks',
    badge: 'AUDIO',
    icon: Music,
    desc: 'Import individual audio files or scan an entire music folder (MP3, WAV, FLAC, AIFF, M4A, AAC).',
    extensions: ['mp3', 'wav', 'flac', 'aiff', 'aif', 'm4a', 'aac', 'ogg'],
  },
  {
    id: 'rekordbox-xml',
    label: 'Rekordbox XML',
    badge: 'RB',
    icon: FileCode,
    desc: 'Import tracks, cue points, loops, beatgrids, and folder playlists from a Rekordbox XML export.',
    hint: 'In Rekordbox: File → Export Collection in xml format',
    extensions: ['xml'],
  },
  {
    id: 'rekordbox',
    label: 'Rekordbox',
    badge: 'RB',
    icon: Disc3,
    desc: 'Auto-discover Rekordbox libraries and XML exports in PioneerDJ folders.',
    hint: 'Scans ~/Music/PioneerDJ and ~/Library/Pioneer/rekordbox',
    extensions: ['xml'],
  },
  {
    id: 'traktor',
    label: 'TRAKTOR',
    badge: 'TR',
    icon: Radio,
    desc: 'Import Native Instruments Traktor collection.nml with hot cues, beatgrids, and playlists.',
    hint: 'Scans ~/Documents/Native Instruments for collection.nml',
    extensions: ['nml'],
  },
  {
    id: 'serato',
    label: 'Serato',
    badge: 'SR',
    icon: Cpu,
    desc: 'Import Serato DJ Pro / Lite crates, nested subcrates (%%), database V2 metadata, hot cues, and beatgrids.',
    hint: 'Scans ~/Music/_Serato_/Subcrates, Crates, and database V2',
    extensions: ['crate'],
  },
  {
    id: 'virtualdj',
    label: 'VirtualDJ',
    badge: 'VDJ',
    icon: Disc,
    desc: 'Import VirtualDJ database.xml, folders, BPM, key, and POI cue points.',
    hint: 'Scans ~/Documents/VirtualDJ for database.xml and playlists',
    extensions: ['xml', 'm3u', 'm3u8'],
  },
  {
    id: 'engine-dj',
    label: 'Engine DJ',
    badge: 'EDJ',
    icon: Headphones,
    desc: 'Import Denon DJ / Engine DJ libraries, XML sidecars, and M3U playlists.',
    hint: 'Scans ~/Music/Engine Library',
    extensions: ['db', 'xml', 'm3u', 'm3u8'],
  },
  {
    id: 'djay-pro',
    label: 'djay Pro',
    badge: 'DJ',
    icon: Sliders,
    desc: 'Import Algoriddim djay Pro exported XML, CSV, or M3U playlists.',
    hint: 'Scans ~/Music/djay',
    extensions: ['xml', 'm3u', 'm3u8', 'csv'],
  },
  {
    id: 'itunes',
    label: 'iTunes/Music',
    badge: 'AM',
    icon: Music,
    desc: 'Import Apple Music / iTunes Library XML including playlists, folders, ratings, and local tracks.',
    hint: 'In Apple Music / iTunes: File → Library → Export Library...',
    extensions: ['xml', 'plist'],
  },
  {
    id: 'djxml',
    label: 'DJXML',
    badge: 'XML',
    icon: FileCode,
    desc: 'Import universal DJXML / Rekordbox-compatible XML files.',
    extensions: ['xml'],
  },
]

const M3U_IMPORT_SOURCES = [
  {
    id: 'm3u',
    label: 'M3U Playlists',
    badge: 'M3U',
    icon: ListMusic,
    desc: 'Import standard .m3u and .m3u8 playlist files from any media player or DJ app.',
    extensions: ['m3u', 'm3u8'],
  },
  {
    id: 'ultramixer',
    label: 'Ultramixer',
    badge: 'UM',
    icon: ListMusic,
    desc: 'Import Ultramixer exported M3U / M3U8 playlists.',
    extensions: ['m3u', 'm3u8'],
  },
]

const ALL_SOURCES = [...FULL_IMPORT_SOURCES, ...M3U_IMPORT_SOURCES]

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatEta(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--'
  if (seconds <= 1) return '< 1 sec'
  if (seconds < 60) return `${Math.round(seconds)} secs`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins} min ${secs}s` : `${mins} mins`
}

export default function ImportView({ initialSection = 'serato', onGoToLibrary }) {
  const [selectedSection, setSelectedSection] = useState(initialSection)
  const [discoveredFiles, setDiscoveredFiles] = useState([])
  const [discoveryMeta, setDiscoveryMeta] = useState(null)
  const [selectedPaths, setSelectedPaths] = useState(new Set())
  const [customDir, setCustomDir] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [hideEmptyCrates, setHideEmptyCrates] = useState(true)
  const [analyzeOnImport, setAnalyzeOnImport] = useState(true)
  const [customPickedFiles, setCustomPickedFiles] = useState([])
  const [pickedFolder, setPickedFolder] = useState(null)
  const [folderScanInfo, setFolderScanInfo] = useState(null)
  const [preserveSubfolders, setPreserveSubfolders] = useState(true)
  const [lastResult, setLastResult] = useState(null)

  const fileInputRef = useRef(null)

  const {
    importProgress,
    setImportProgress,
    mergeImportedLibrary,
    fetchTracks,
    fetchPlaylists,
  } = useLibraryStore()

  useEffect(() => {
    if (initialSection) setSelectedSection(initialSection)
  }, [initialSection])

  // Subscribe to Electron live import progress events
  useEffect(() => {
    if (!window.electronAPI?.onLocalImportProgress) return undefined
    const unsubscribe = window.electronAPI.onLocalImportProgress((payload) => {
      if (payload.stage === 'parse') {
        setImportProgress({
          active: true,
          status: 'running',
          stage: 'parse',
          message: payload.message || 'Parsing library...',
          steps: {
            save: 'running',
            analyze: 'pending',
            smartPlaylists: 'pending',
            artwork: 'pending',
            upload: 'pending',
            sync: 'pending',
          },
        })
      } else if (payload.stage === 'save') {
        setImportProgress({
          active: true,
          status: 'running',
          stage: 'save',
          total: payload.total || 0,
          analyzed: 0,
          message: payload.message || 'Saved to Sound It DJ',
          steps: {
            save: 'complete',
            analyze: payload.total > 0 ? 'running' : 'complete',
            smartPlaylists: 'pending',
            artwork: 'pending',
            upload: 'pending',
            sync: 'pending',
          },
        })
      } else if (payload.stage === 'analyze') {
        setImportProgress({
          active: true,
          status: 'running',
          stage: 'analyze',
          analyzed: payload.analyzed || 0,
          total: payload.total || 0,
          failed: payload.failed || 0,
          speed: payload.speed || 0,
          etaSeconds: payload.etaSeconds,
          recentTracks: payload.recentTracks || [],
          steps: {
            save: 'complete',
            analyze: 'running',
            smartPlaylists: 'pending',
            artwork: 'pending',
            upload: 'pending',
            sync: 'pending',
          },
        })
      } else if (payload.stage === 'complete') {
        setImportProgress({
          active: false,
          status: payload.status || 'complete',
          stage: 'complete',
          analyzed: payload.analyzed || 0,
          total: payload.total || 0,
          failed: payload.failed || 0,
          speed: 0,
          etaSeconds: 0,
          recentTracks: payload.recentTracks || [],
          logFile: payload.logFile || null,
          steps: {
            save: 'complete',
            analyze: 'complete',
            smartPlaylists: 'complete',
            artwork: 'complete',
            upload: 'complete',
            sync: 'complete',
          },
        })
      } else if (payload.stage === 'error') {
        setImportProgress({
          active: false,
          status: 'error',
          stage: 'error',
          error: payload.error || 'Import failed',
          logFile: payload.logFile || null,
        })
      }
    })
    return unsubscribe
  }, [setImportProgress])

  const currentSource = useMemo(
    () => ALL_SOURCES.find((s) => s.id === selectedSection) || null,
    [selectedSection],
  )

  // Auto-discover local DJ libraries whenever a software source is selected
  const runDiscovery = async (sourceId, overrideDir = null) => {
    if (!sourceId || sourceId === 'progress' || sourceId === 'tracks') {
      setDiscoveredFiles([])
      setDiscoveryMeta(null)
      setSelectedPaths(new Set())
      return
    }

    setIsScanning(true)
    setDiscoveredFiles([])
    setSelectedPaths(new Set())
    setCustomPickedFiles([])
    setSearchTerm('')

    try {
      let files = []
      let meta = null
      if (window.electronAPI?.discoverLibraries) {
        const res = await window.electronAPI.discoverLibraries(sourceId, overrideDir)
        if (Array.isArray(res)) {
          files = res
        } else {
          files = res?.files || []
          meta = res?.meta || null
        }
      } else {
        const res = await axios.get(`/api/import/discover/${sourceId}`)
        files = Array.isArray(res.data) ? res.data : []
      }

      setDiscoveredFiles(files)
      setDiscoveryMeta(meta)

      // For Serato, pre-select non-empty crates if any exist, otherwise first 50
      if (sourceId === 'serato') {
        const nonEmpty = files.filter((f) => (f.trackCount ?? 1) > 0)
        const initial = nonEmpty.length ? nonEmpty : files
        setSelectedPaths(new Set(initial.map((f) => f.path)))
      } else {
        setSelectedPaths(new Set(files.map((f) => f.path)))
      }
    } catch (err) {
      console.error('Discovery error:', err)
      setDiscoveredFiles([])
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    setCustomDir(null)
    setPickedFolder(null)
    setCustomPickedFiles([])
    if (selectedSection !== 'progress') {
      runDiscovery(selectedSection, null)
    }
  }, [selectedSection])

  // Filtered list of discovered files
  const visibleFiles = useMemo(() => {
    let list = discoveredFiles
    if (selectedSection === 'serato' && hideEmptyCrates) {
      list = list.filter((f) => f.trackCount === undefined || f.trackCount > 0)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (f) =>
          (f.displayName || f.name || '').toLowerCase().includes(q) ||
          (f.folderPath || '').toLowerCase().includes(q) ||
          (f.path || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [discoveredFiles, selectedSection, hideEmptyCrates, searchTerm])

  const selectedVisibleCount = useMemo(
    () => visibleFiles.filter((f) => selectedPaths.has(f.path)).length,
    [visibleFiles, selectedPaths],
  )

  const togglePath = (p) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      visibleFiles.forEach((f) => next.add(f.path))
      return next
    })
  }

  const deselectAllVisible = () => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      visibleFiles.forEach((f) => next.delete(f.path))
      return next
    })
  }

  const handleBrowseCustomFolder = async () => {
    if (!window.electronAPI?.selectDirectory) {
      toast.error('Folder browsing is available in the Sound It DJ desktop app.')
      return
    }
    const dir = await window.electronAPI.selectDirectory(discoveryMeta?.detectedDir)
    if (!dir) return

    if (selectedSection === 'tracks') {
      setPickedFolder(dir)
      setCustomPickedFiles([])
      setFolderScanInfo(null)
      if (window.electronAPI?.scanAudioFolder) {
        const info = await window.electronAPI.scanAudioFolder(dir)
        setFolderScanInfo(info)
        if (!info?.totalFiles) {
          toast('No audio files found inside that folder.')
        }
      }
      return
    }

    // Check if the chosen folder has DJ library files for this source; if not, check if it's an audio folder!
    setCustomDir(dir)
    const res = window.electronAPI?.discoverLibraries
      ? await window.electronAPI.discoverLibraries(selectedSection, dir)
      : { files: [] }
    const foundFiles = Array.isArray(res) ? res : (res?.files || [])
    if (foundFiles.length > 0) {
      setDiscoveredFiles(foundFiles)
      setDiscoveryMeta(res?.meta || null)
      setSelectedPaths(new Set(foundFiles.map((f) => f.path)))
    } else if (window.electronAPI?.scanAudioFolder) {
      const audioInfo = await window.electronAPI.scanAudioFolder(dir)
      if (audioInfo?.totalFiles > 0) {
        setSelectedSection('tracks')
        setTimeout(() => {
          setPickedFolder(dir)
          setCustomPickedFiles([])
          setFolderScanInfo(audioInfo)
        }, 0)
        toast.success(`Found ${audioInfo.totalFiles} audio file(s) in folder — ready to import!`)
      } else {
        setDiscoveredFiles([])
        toast('No matching library or audio files found in that folder.')
      }
    }
  }

  const handleBrowseCustomFiles = async () => {
    if (window.electronAPI?.selectFiles && selectedSection === 'tracks') {
      const files = await window.electronAPI.selectFiles()
      if (files?.length) {
        setCustomPickedFiles(files)
        setPickedFolder(null)
      }
      return
    }
    if (window.electronAPI?.selectImportFiles) {
      const exts = currentSource?.extensions || ['*']
      const files = await window.electronAPI.selectImportFiles({
        defaultPath: discoveryMeta?.detectedDir,
        filters: [{ name: currentSource?.label || 'Library Files', extensions: exts }],
      })
      if (files?.length) {
        const added = files.map((fp) => {
          const base = fp.split(/[\\/]/).pop() || fp
          const name = base.replace(/\.[^.]+$/, '')
          const parts = name.split('%%').map((s) => s.trim()).filter(Boolean)
          return {
            name,
            displayName: parts[parts.length - 1] || name,
            folderPath: parts.length > 1 ? parts.slice(0, -1).join(' / ') : fp.slice(0, fp.length - base.length),
            path: fp,
            size: 0,
          }
        })
        setDiscoveredFiles((prev) => {
          const existing = new Set(prev.map((x) => x.path))
          return [...added.filter((x) => !existing.has(x.path)), ...prev]
        })
        setSelectedPaths((prev) => {
          const next = new Set(prev)
          added.forEach((x) => next.add(x.path))
          return next
        })
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleWebFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setSelectedSection('progress')
    setImportProgress({
      active: true,
      status: 'running',
      stage: 'parse',
      source: currentSource?.label || selectedSection,
      analyzed: 0,
      total: files.length,
      failed: 0,
      speed: 0,
      etaSeconds: null,
      recentTracks: [],
      error: null,
      steps: { save: 'running', analyze: 'pending', smartPlaylists: 'pending', artwork: 'pending', upload: 'pending', sync: 'pending' },
    })

    let completed = 0
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('source', selectedSection)
        formData.append('name', file.name.replace(/\.[^.]+$/, ''))
        await axios.post('/api/import/dj-software', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        completed += 1
        setImportProgress({
          analyzed: completed,
          total: files.length,
          recentTracks: [file.name],
        })
      } catch (err) {
        console.error('Upload import error:', err)
      }
    }
    await fetchTracks()
    await fetchPlaylists()
    setImportProgress({
      active: false,
      status: 'complete',
      stage: 'complete',
      analyzed: completed,
      total: files.length,
      steps: { save: 'complete', analyze: 'complete', smartPlaylists: 'complete', artwork: 'complete', upload: 'complete', sync: 'complete' },
    })
    toast.success(`Imported ${completed} file(s)`)
  }

  const handleStartImport = async () => {
    if (!window.electronAPI?.parseAndAnalyzeLocalImport) {
      fileInputRef.current?.click()
      return
    }

    const activePaths = selectedSection === 'tracks'
      ? customPickedFiles
      : visibleFiles.filter((f) => selectedPaths.has(f.path)).map((f) => f.path)

    if (selectedSection === 'tracks' && !pickedFolder && !activePaths.length) {
      toast.error('Select audio files or a music folder first.')
      return
    }
    if (selectedSection !== 'tracks' && !activePaths.length) {
      toast.error(`Select at least one ${currentSource?.label || ''} file or crate to import.`)
      return
    }

    // Switch immediately to Progress tab (MIXO workflow!)
    const sourceLabel = currentSource?.label || selectedSection
    setSelectedSection('progress')
    setLastResult(null)
    setImportProgress({
      active: true,
      status: 'running',
      stage: 'parse',
      source: sourceLabel,
      message: `Reading ${activePaths.length || 1} ${sourceLabel} item(s)...`,
      analyzed: 0,
      total: 0,
      failed: 0,
      speed: 0,
      etaSeconds: null,
      recentTracks: [],
      error: null,
      logFile: null,
      steps: {
        save: 'running',
        analyze: 'pending',
        smartPlaylists: 'pending',
        artwork: 'pending',
        upload: 'pending',
        sync: 'pending',
      },
    })

    try {
      const result = await window.electronAPI.parseAndAnalyzeLocalImport({
        source: selectedSection,
        filePaths: activePaths,
        folderPath: pickedFolder,
        seratoDir: selectedSection === 'serato' ? (customDir || discoveryMeta?.detectedDir) : null,
        analyzeAudio: analyzeOnImport,
        preserveSubfolders,
      })

      setLastResult(result)

      if (result?.tracks?.length || result?.playlists?.length) {
        await mergeImportedLibrary({
          tracks: result.tracks || [],
          playlists: result.playlists || [],
          folders: result.folders || [],
        })
      }

      if (result?.success) {
        toast.success(
          `Imported ${result.stats?.tracks || 0} tracks across ${result.stats?.playlists || 0} playlists from ${sourceLabel}`,
        )
      } else if (result?.cancelled) {
        toast('Import cancelled — partial results saved.')
      } else {
        toast.error(result?.error || 'Import failed')
      }
    } catch (err) {
      toast.error(err.message || 'Import failed')
      setImportProgress({
        active: false,
        status: 'error',
        stage: 'error',
        error: err.message,
      })
    }
  }

  const handleCancelImport = async () => {
    if (window.electronAPI?.cancelLocalImport) {
      await window.electronAPI.cancelLocalImport()
      toast('Cancelling import safely...')
    }
  }

  const handleOpenLogs = () => {
    if (importProgress?.logFile && window.electronAPI?.openPath) {
      window.electronAPI.openPath(importProgress.logFile)
    } else if (window.electronAPI?.openFolder) {
      window.electronAPI.openFolder('logs')
    }
  }

  const analyzePercent = importProgress.total > 0
    ? Math.min(100, Math.round((importProgress.analyzed / importProgress.total) * 100))
    : importProgress.status === 'complete' ? 100 : 0

  const renderStepIcon = (status) => {
    if (status === 'complete') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
    if (status === 'running') return <Loader2 className="w-4 h-4 text-brand-accent animate-spin shrink-0" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
    return <Clock className="w-4 h-4 text-text-muted shrink-0" />
  }

  return (
    <div className="h-full flex bg-background-primary overflow-hidden select-none">
      {/* Hidden web fallback file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleWebFileUpload}
        className="hidden"
      />

      {/* Left MIXO-Style Import Sub-Sidebar */}
      <aside className="w-60 bg-background-secondary border-r border-border flex flex-col overflow-y-auto shrink-0 py-3">
        {/* Progress Tab */}
        <div className="px-2.5 mb-3">
          <button
            onClick={() => setSelectedSection('progress')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              selectedSection === 'progress'
                ? 'bg-background-tertiary text-brand-accent border border-brand-accent/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Activity className="w-4 h-4 text-brand-sky" />
                {importProgress.active && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-accent animate-ping" />
                )}
              </div>
              <span>Progress</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>
        </div>

        {/* FULL IMPORTS */}
        <div className="px-3 mb-1.5">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            FULL IMPORTS
          </span>
        </div>
        <div className="px-2 space-y-0.5 mb-4">
          {FULL_IMPORT_SOURCES.map((src) => {
            const Icon = src.icon
            const isActive = selectedSection === src.id
            return (
              <button
                key={src.id}
                onClick={() => setSelectedSection(src.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? 'bg-brand-accent text-brand-primary font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      isActive
                        ? 'bg-brand-primary/15 text-brand-primary'
                        : 'bg-background-primary text-brand-accent border border-border/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{src.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-primary' : 'opacity-40'}`} />
              </button>
            )
          })}
        </div>

        {/* M3U IMPORTS */}
        <div className="px-3 mb-1.5 pt-2 border-t border-border/50">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            M3U IMPORTS
          </span>
        </div>
        <div className="px-2 space-y-0.5">
          {M3U_IMPORT_SOURCES.map((src) => {
            const Icon = src.icon
            const isActive = selectedSection === src.id
            return (
              <button
                key={src.id}
                onClick={() => setSelectedSection(src.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? 'bg-brand-accent text-brand-primary font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-brand-primary/15 text-brand-primary'
                        : 'bg-background-primary text-brand-sky border border-border/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{src.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-primary' : 'opacity-40'}`} />
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedSection === 'progress' ? (
          /* ── MIXO IMPORT PROGRESS SCREEN ────────────────────────────────── */
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-wide uppercase">
                  Import Progress
                </h1>
                <p className="text-xs text-text-secondary mt-1">
                  {importProgress.source
                    ? `Source: ${importProgress.source}`
                    : 'Select any DJ software on the left to start importing your library.'}
                </p>
              </div>
              {importProgress.status === 'complete' && onGoToLibrary && (
                <button
                  onClick={onGoToLibrary}
                  className="px-4 py-2 rounded-lg bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Open Library
                </button>
              )}
            </div>

            {importProgress.status === 'idle' ? (
              <div className="bg-background-secondary border border-border rounded-xl p-10 text-center">
                <Sparkles className="w-10 h-10 text-brand-accent mx-auto mb-3 opacity-80" />
                <h2 className="text-base font-semibold text-text-primary mb-1">No Active Import</h2>
                <p className="text-xs text-text-secondary max-w-md mx-auto mb-5">
                  Choose Serato, Rekordbox, TRAKTOR, VirtualDJ, Engine DJ, djay Pro, iTunes/Music, or Tracks from the sidebar to discover and import your DJ crates and playlists.
                </p>
                <button
                  onClick={() => setSelectedSection('serato')}
                  className="px-5 py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-xs font-bold uppercase tracking-wider"
                >
                  Import From Serato
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Checklist Card */}
                <div className="bg-background-secondary border border-border rounded-xl p-6 space-y-4">
                  {/* Step 1: Save to Sound It DJ */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {renderStepIcon(importProgress.steps.save)}
                      <span className="text-sm font-medium text-text-primary">Save to Sound It DJ</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 capitalize">
                      {importProgress.steps.save}
                    </span>
                  </div>

                  {/* Step 2: Analyse Tracks (with progress bar) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {renderStepIcon(importProgress.steps.analyze)}
                        <span className="text-sm font-medium text-text-primary">Analyse Tracks</span>
                      </div>
                      <span className="text-xs font-mono text-brand-accent">
                        {analyzePercent}% ({importProgress.analyzed} of {importProgress.total})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-background-primary rounded-full overflow-hidden border border-border/60">
                      <div
                        className="h-full bg-gradient-to-r from-brand-sky to-brand-accent transition-all duration-300"
                        style={{ width: `${analyzePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps 3-6 */}
                  {[
                    { key: 'smartPlaylists', label: 'Update Smart Playlists' },
                    { key: 'artwork', label: 'Upload Artwork' },
                    { key: 'upload', label: 'Upload Tracks' },
                    { key: 'sync', label: 'Sync databases' },
                  ].map((step) => (
                    <div key={step.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {renderStepIcon(importProgress.steps[step.key])}
                        <span className="text-sm text-text-secondary">{step.label}</span>
                      </div>
                      <span className="text-xs font-mono text-text-muted capitalize">
                        {importProgress.steps[step.key]}
                      </span>
                    </div>
                  ))}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-border/60 flex items-center gap-3">
                    {importProgress.active && (
                      <button
                        onClick={handleCancelImport}
                        className="px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors"
                      >
                        Cancel Import
                      </button>
                    )}
                    <button
                      onClick={handleOpenLogs}
                      className="px-4 py-2 rounded-lg bg-background-tertiary hover:bg-background-elevated text-text-primary border border-border text-xs font-medium transition-colors"
                    >
                      Open Logs Folder
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {importProgress.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-200">{importProgress.error}</div>
                  </div>
                )}

                {/* Metrics Strip (MIXO-style Analysis Speed / Time Remaining / Failed) */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-background-secondary border border-border rounded-xl p-4">
                    <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">
                      Analysis Speed
                    </div>
                    <div className="text-lg font-bold font-mono text-brand-sky">
                      {importProgress.speed ? `${importProgress.speed} tracks/min` : '--'}
                    </div>
                  </div>
                  <div className="bg-background-secondary border border-border rounded-xl p-4">
                    <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">
                      Time Remaining
                    </div>
                    <div className="text-lg font-bold font-mono text-brand-accent">
                      {formatEta(importProgress.etaSeconds)}
                    </div>
                  </div>
                  <div className="bg-background-secondary border border-border rounded-xl p-4">
                    <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">
                      Failed to Analyse
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-bold font-mono ${importProgress.failed > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {importProgress.failed || 0}
                      </span>
                      <button
                        onClick={handleOpenLogs}
                        className="text-[11px] text-brand-sky hover:underline"
                      >
                        View Logs
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary Warnings */}
                {lastResult?.warnings?.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="text-xs font-semibold text-amber-300 mb-2">
                      Import Notes ({lastResult.warnings.length})
                    </div>
                    <ul className="space-y-1 text-[11px] text-amber-200/80 max-h-28 overflow-y-auto font-mono">
                      {lastResult.warnings.slice(0, 15).map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Live Track Activity Stream */}
                <div className="bg-background-secondary border border-border rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Recent Tracks Processed
                  </div>
                  {importProgress.recentTracks?.length ? (
                    <div className="space-y-1 max-h-52 overflow-y-auto font-mono text-xs text-text-secondary">
                      {importProgress.recentTracks.map((name, idx) => (
                        <div key={idx} className="truncate py-0.5 border-b border-border/30 last:border-0">
                          <span className="text-brand-accent mr-2">♪</span>
                          {name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted italic py-3">
                      {importProgress.message || 'Waiting for track metadata...'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : currentSource ? (
          /* ── SOFTWARE SOURCE IMPORT SCREEN ──────────────────────────────── */
          <div className="max-w-4xl mx-auto flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold text-text-primary uppercase tracking-wide">
                    Import {currentSource.label}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-accent-dim text-brand-accent border border-brand-accent/30">
                    {currentSource.badge}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{currentSource.desc}</p>
                {currentSource.hint && (
                  <p className="text-[11px] text-brand-sky mt-1 font-mono">{currentSource.hint}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleBrowseCustomFiles}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border text-xs font-medium text-text-primary transition-colors"
                >
                  <FilePlus className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Browse File</span>
                </button>
                <button
                  onClick={handleBrowseCustomFolder}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border text-xs font-medium text-text-primary transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-brand-sky" />
                  <span>Browse Folder</span>
                </button>
                {selectedSection !== 'tracks' && (
                  <button
                    onClick={() => runDiscovery(selectedSection, customDir)}
                    disabled={isScanning}
                    className="p-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary hover:text-brand-accent transition-colors"
                    title="Rescan local library"
                  >
                    <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {selectedSection === 'tracks' ? (
              /* ── DIRECT AUDIO TRACKS / FOLDER IMPORT ────────────────────── */
              <div className="bg-background-secondary border border-border rounded-xl p-8 text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-accent-dim border border-brand-accent/30 flex items-center justify-center mx-auto">
                  <FolderInput className="w-7 h-7 text-brand-accent" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Import Local Audio Files or Music Folders
                  </h2>
                  <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                    Select MP3, WAV, FLAC, AIFF, M4A, or AAC tracks from your computer or external hard drive. Sound It DJ will scan metadata, BPM, key, and add them to your library without moving your original files.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleBrowseCustomFiles}
                    className="px-5 py-2.5 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border text-xs font-semibold text-text-primary"
                  >
                    Choose Audio Files
                  </button>
                  <button
                    onClick={handleBrowseCustomFolder}
                    className="px-5 py-2.5 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border text-xs font-semibold text-text-primary"
                  >
                    Choose Music Folder
                  </button>
                </div>

                {(pickedFolder || customPickedFiles.length > 0) && (
                  <div className="bg-background-primary border border-brand-accent/40 rounded-lg p-4 text-left max-w-xl mx-auto space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-brand-accent">
                        {pickedFolder ? 'Selected Music Folder:' : `Selected ${customPickedFiles.length} Audio File(s):`}
                      </span>
                      {pickedFolder && folderScanInfo && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-sky-dim text-brand-sky">
                          {folderScanInfo.totalFiles} audio file(s) · {folderScanInfo.subfolders} folder(s)
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-text-secondary truncate">
                      {pickedFolder || customPickedFiles.slice(0, 5).map((f) => f.split(/[\\/]/).pop()).join(', ')}
                    </div>
                    {pickedFolder && folderScanInfo?.sampleFiles?.length > 0 && (
                      <div className="text-[11px] text-text-muted font-mono truncate">
                        Preview: {folderScanInfo.sampleFiles.slice(0, 4).join(' · ')}
                      </div>
                    )}
                    {pickedFolder && (
                      <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={preserveSubfolders}
                          onChange={(e) => setPreserveSubfolders(e.target.checked)}
                          className="accent-[#FAE1AF]"
                        />
                        <span>Create playlists for each subfolder</span>
                      </label>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleStartImport}
                    disabled={!pickedFolder && !customPickedFiles.length}
                    className="px-7 py-3 rounded-lg bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 text-brand-primary font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    {pickedFolder && folderScanInfo?.totalFiles
                      ? `Import ${folderScanInfo.totalFiles} Tracks to Sound It DJ`
                      : 'Import to Sound It DJ'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── DISCOVERED CRATES / LIBRARIES CHECKLIST ────────────────── */
              <div className="flex-1 flex flex-col min-h-0 bg-background-secondary border border-border rounded-xl overflow-hidden">
                {/* Status & Filter Toolbar */}
                <div className="p-4 border-b border-border space-y-3 bg-background-secondary">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
                      <span className="font-mono text-[11px] bg-background-primary px-2.5 py-1 rounded border border-border/70 truncate max-w-md">
                        {customDir || discoveryMeta?.detectedDir || 'Auto-scanned local folders'}
                      </span>
                      {selectedSection === 'serato' && discoveryMeta?.hasDatabase && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          database V2 linked
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {selectedSection === 'serato' && (
                        <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hideEmptyCrates}
                            onChange={(e) => setHideEmptyCrates(e.target.checked)}
                            className="accent-[#FAE1AF]"
                          />
                          <span>Hide empty crates</span>
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={analyzeOnImport}
                          onChange={(e) => setAnalyzeOnImport(e.target.checked)}
                          className="accent-[#FAE1AF]"
                        />
                        <span>Analyse tracks</span>
                      </label>
                    </div>
                  </div>

                  {/* Search + Select All */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`Filter ${currentSource.label} crates & playlists...`}
                        className="w-full pl-9 pr-3 py-1.5 bg-background-primary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent"
                      />
                    </div>
                    <button
                      onClick={selectAllVisible}
                      className="px-2.5 py-1.5 rounded-md bg-background-tertiary hover:bg-background-elevated text-[11px] font-medium text-text-primary border border-border/60"
                    >
                      Select All ({visibleFiles.length})
                    </button>
                    <button
                      onClick={deselectAllVisible}
                      className="px-2.5 py-1.5 rounded-md bg-background-tertiary hover:bg-background-elevated text-[11px] font-medium text-text-secondary border border-border/60"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* File / Crate List */}
                <div className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-[260px]">
                  {isScanning ? (
                    <div className="h-full flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="w-7 h-7 text-brand-accent animate-spin" />
                      <p className="text-xs text-text-secondary">
                        Scanning your computer for {currentSource.label} libraries...
                      </p>
                    </div>
                  ) : visibleFiles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-14 px-6 text-center">
                      <AlertTriangle className="w-8 h-8 text-brand-accent/70 mb-3" />
                      <h3 className="text-sm font-semibold text-text-primary mb-1">
                        No {currentSource.label} files found automatically
                      </h3>
                      <p className="text-xs text-text-secondary max-w-md mb-4">
                        {currentSource.hint || `Use "Browse File" or "Browse Folder" above to select your ${currentSource.label} library file from your computer or external drive.`}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleBrowseCustomFiles}
                          className="px-4 py-2 rounded-lg bg-brand-accent text-brand-primary text-xs font-bold"
                        >
                          Browse {currentSource.label} File
                        </button>
                        <button
                          onClick={handleBrowseCustomFolder}
                          className="px-4 py-2 rounded-lg bg-background-tertiary text-text-primary border border-border text-xs font-medium"
                        >
                          Choose Folder
                        </button>
                      </div>
                    </div>
                  ) : (
                    visibleFiles.map((item) => {
                      const checked = selectedPaths.has(item.path)
                      return (
                        <div
                          key={item.path}
                          onClick={() => togglePath(item.path)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            checked ? 'bg-brand-accent-dim/40' : 'hover:bg-background-tertiary/50'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-brand-accent shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-text-muted shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-text-primary truncate">
                                {item.displayName || item.name}
                              </span>
                              {item.folderPath && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background-primary text-brand-sky border border-border/60 truncate max-w-[260px]">
                                  {item.folderPath}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-text-muted truncate mt-0.5">
                              {item.path}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
                            {item.trackCount !== undefined && (
                              <span className={`px-2 py-0.5 rounded ${item.trackCount > 0 ? 'bg-brand-sky-dim text-brand-sky' : 'bg-background-primary text-text-muted'}`}>
                                {item.trackCount} tracks
                              </span>
                            )}
                            <span className="text-text-muted w-16 text-right">
                              {formatBytes(item.size)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Bottom Action Bar */}
                <div className="p-4 border-t border-border bg-background-primary/60 flex items-center justify-between gap-4">
                  <div className="text-xs text-text-secondary">
                    <span className="font-bold text-brand-accent font-mono">{selectedVisibleCount}</span> of{' '}
                    <span className="font-mono">{discoveredFiles.length}</span> {currentSource.label} item(s) selected
                  </div>
                  <button
                    onClick={handleStartImport}
                    disabled={selectedVisibleCount === 0 || importProgress.active}
                    className="px-6 py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 text-brand-primary font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                  >
                    {importProgress.active ? 'Import Running...' : `Import to Sound It DJ`}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
