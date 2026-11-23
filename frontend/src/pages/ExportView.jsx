import React, { useState, useEffect, useMemo } from 'react'
import {
  Usb,
  HardDrive,
  FileCode,
  Disc3,
  Radio,
  Cpu,
  Disc,
  Headphones,
  Sliders,
  Music,
  Tag,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useLibraryStore from '@store/libraryStore'
import axios from '../config/axios.js'

const USB_EXPORT_TARGETS = [
  {
    id: 'rekordbox-usb',
    label: 'Rekordbox USB',
    beta: true,
    icon: Usb,
    family: 'Pioneer DJ / AlphaTheta CDJ-3000, CDJ-2000NXS2, XDJ-XZ, XDJ-RX3',
    desc: 'Writes PIONEER/rekordbox/export.pdb DeviceSQL database, ANLZ waveform/cue files, and copies audio tracks directly to your USB drive.',
    compat: {
      audio: 'MP3, WAV, AIFF, FLAC (NXS2/3000), AAC',
      playlists: 'Full nested folders & track ordering',
      library: 'Native DeviceSQL export.pdb + ANLZ',
      performance: 'Hot cues, memory cues, loops & beatgrids',
    },
  },
  {
    id: 'engine-dj-usb',
    label: 'Engine DJ USB',
    beta: true,
    icon: Usb,
    family: 'Denon DJ Prime 4+, SC6000, SC Live 4, Numark Mixstream Pro',
    desc: 'Copies organized audio files, M3U8 playlists, and an Engine-importable XML sidecar to your external USB drive.',
    compat: {
      audio: 'MP3, WAV, AIFF, FLAC, AAC, OGG',
      playlists: 'M3U8 playlists + XML collection sidecar',
      library: 'Folder structure + Engine Library XML',
      performance: 'Cues/beatgrids imported via Engine DJ Desktop XML',
    },
  },
  {
    id: 'virtualdj-usb',
    label: 'VirtualDJ USB',
    beta: true,
    icon: Usb,
    family: 'VirtualDJ 2021 / 2023 / 2024 / 2025 (macOS & Windows)',
    desc: 'Exports organized audio tracks and a portable VirtualDJ/database.xml directly to your USB drive.',
    compat: {
      audio: 'MP3, WAV, FLAC, AIFF, M4A, AAC, OGG',
      playlists: 'VirtualDJ playlists & folder tree',
      library: 'Native VirtualDJ database.xml',
      performance: 'POI hot cues, loops, BPM & key tags',
    },
  },
]

const FULL_EXPORT_TARGETS = [
  {
    id: 'rekordbox-xml',
    label: 'Rekordbox XML',
    icon: FileCode,
    family: 'Pioneer DJ Rekordbox 5 / 6 / 7',
    desc: 'Generates a standard rekordbox.xml file with full collection metadata, cue points, loops, beatgrids, and nested playlist folders.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'Nested folder tree & ordered playlists',
      library: 'Standard DJ_PLAYLISTS XML v1.0',
      performance: 'Hot cues, memory cues, loops & TEMPO beatgrid',
    },
  },
  {
    id: 'rekordbox',
    label: 'Rekordbox',
    icon: Disc3,
    family: 'Pioneer DJ Rekordbox (PioneerDJ Folder)',
    desc: 'Writes rekordbox.xml directly to your PioneerDJ folder so Rekordbox can import your playlists and cues immediately.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'Nested folder tree & ordered playlists',
      library: 'Rekordbox XML in ~/Music/PioneerDJ',
      performance: 'Hot cues, memory cues, loops & TEMPO beatgrid',
    },
  },
  {
    id: 'traktor',
    label: 'TRAKTOR',
    icon: Radio,
    family: 'Native Instruments Traktor Pro 3 / Pro 4',
    desc: 'Generates a Native Instruments collection.nml file with tracks, BPM, AutoGrid anchor, CUE_V2 hot cues/loops, and playlists.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'All selected playlists under $ROOT',
      library: 'Traktor NML v19',
      performance: 'CUE_V2 hot cues, loops & AutoGrid beatgrid',
    },
  },
  {
    id: 'serato',
    label: 'Serato',
    icon: Cpu,
    family: 'Serato DJ Pro / Serato DJ Lite',
    desc: 'Writes real binary UTF-16BE .crate files directly into ~/Music/_Serato_/Subcrates (preserving %% nested folders) and optional Serato GEOB ID3 tags.',
    compat: {
      audio: 'MP3, WAV, AIFF, FLAC, ALAC, AAC',
      playlists: 'Native .crate & %% nested subcrates',
      library: 'Direct ~/Music/_Serato_/Subcrates write',
      performance: 'Optional Serato Markers2 & BeatGrid ID3 tags (MP3/AIFF)',
    },
  },
  {
    id: 'virtualdj',
    label: 'VirtualDJ',
    icon: Disc,
    family: 'VirtualDJ (macOS & Windows)',
    desc: 'Generates VirtualDJ database.xml containing tracks, BPM, musical key, POI cue markers, and playlists.',
    compat: {
      audio: 'All local audio formats supported by VDJ',
      playlists: 'Playlist references in database.xml',
      library: 'Native VirtualDJ database.xml',
      performance: 'POI hot cues, loops, BPM & key',
    },
  },
  {
    id: 'engine-dj',
    label: 'Engine DJ',
    icon: Headphones,
    family: 'Denon DJ Engine DJ Desktop',
    desc: 'Exports M3U8 playlists plus a Rekordbox-compatible XML library file for instant import inside Engine DJ Desktop.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'M3U8 playlists + XML folder tree',
      library: 'Engine DJ Desktop XML import ready',
      performance: 'Hot cues, loops & beatgrids via XML import',
    },
  },
  {
    id: 'djay-pro',
    label: 'djay Pro',
    icon: Sliders,
    family: 'Algoriddim djay Pro (macOS / iOS)',
    desc: 'Exports M3U8 playlists and a compatible XML library for Algoriddim djay Pro.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'Ordered M3U8 playlists',
      library: 'M3U8 + XML collection',
      performance: 'Standard metadata tags (cues via XML)',
    },
  },
  {
    id: 'itunes',
    label: 'iTunes/Music',
    icon: Music,
    family: 'Apple Music / iTunes (macOS & Windows)',
    desc: 'Generates an Apple Music / iTunes plist XML file (iTunes Music Library.xml) with tracks, folders, playlists, ratings, and BPM.',
    compat: {
      audio: 'MP3, AAC, M4A, AIFF, WAV, ALAC',
      playlists: 'Full nested playlist folders & tracks',
      library: 'Standard Apple plist XML',
      performance: 'BPM, rating & tags (no DJ cue points in Apple Music)',
    },
  },
  {
    id: 'djxml',
    label: 'DJXML',
    icon: FileCode,
    family: 'Universal DJXML',
    desc: 'Exports your library to universal DJXML format for archiving or cross-platform DJ migration.',
    compat: {
      audio: 'References local audio paths',
      playlists: 'Full folder & playlist hierarchy',
      library: 'Standard DJXML',
      performance: 'Cues, loops & beatgrids included',
    },
  },
  {
    id: 'track-tags',
    label: 'Track Tags',
    icon: Tag,
    family: 'Local MP3 & AIFF Audio Files',
    desc: 'Writes Sound It DJ hot cues, loops, and beatgrid markers directly into your local MP3/AIFF file ID3 GEOB tags without modifying audio bytes.',
    compat: {
      audio: 'MP3 and AIFF local files',
      playlists: 'N/A (writes directly to audio file tags)',
      library: 'Embedded ID3v2 GEOB frames',
      performance: 'Serato Markers2 hot cues, loops & BeatGrid',
    },
  },
]

const ALL_TARGETS = [...USB_EXPORT_TARGETS, ...FULL_EXPORT_TARGETS]

export default function ExportView({ initialTarget = 'rekordbox-usb' }) {
  const [selectedTarget, setSelectedTarget] = useState(initialTarget)
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [customUsbPath, setCustomUsbPath] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [exportScope, setExportScope] = useState('playlists') // 'all' | 'playlists'
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(new Set())
  const [playlistSearch, setPlaylistSearch] = useState('')

  // Options
  const [folderStructure, setFolderStructure] = useState('artist-album')
  const [duplicatePolicy, setDuplicatePolicy] = useState('skip')
  const [backupExisting, setBackupExisting] = useState(true)
  const [preserveHierarchy, setPreserveHierarchy] = useState(true)
  const [writeSeratoTags, setWriteSeratoTags] = useState(false)

  // Live Export Progress
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(null)
  const [exportResult, setExportResult] = useState(null)

  const {
    tracks,
    playlists,
    folders,
    connectedDevices,
    fetchConnectedDevices,
    fetchTracks,
    fetchPlaylists,
    fetchPlaylistTracks,
    fetchFolders,
  } = useLibraryStore()

  useEffect(() => {
    fetchConnectedDevices()
    if (!tracks.length) fetchTracks()
    if (!playlists.length) fetchPlaylists()
    if (!folders.length) fetchFolders()
  }, [])

  // Subscribe to Electron live export progress
  useEffect(() => {
    if (!window.electronAPI?.onLocalExportProgress) return undefined
    return window.electronAPI.onLocalExportProgress((payload) => {
      setExportProgress(payload)
    })
  }, [])

  // Load default destination folder when switching Full Export target
  useEffect(() => {
    setExportResult(null)
    setExportProgress(null)
    if (window.electronAPI?.getDefaultPaths) {
      window.electronAPI.getDefaultPaths(selectedTarget).then((paths) => {
        if (paths?.exportDir) setOutputDir(paths.exportDir)
      })
    }
  }, [selectedTarget])

  // Auto-select first connected USB device
  useEffect(() => {
    if (connectedDevices.length && !connectedDevices.find((d) => d.id === selectedDeviceId)) {
      setSelectedDeviceId(connectedDevices[0].id)
    }
  }, [connectedDevices, selectedDeviceId])

  // Auto-select playlists if user has some, else default to All Tracks
  useEffect(() => {
    if (playlists.length > 0 && selectedPlaylistIds.size === 0) {
      setSelectedPlaylistIds(new Set(playlists.map((p) => String(p.id))))
    } else if (playlists.length === 0) {
      setExportScope('all')
    }
  }, [playlists])

  const targetConfig = useMemo(
    () => ALL_TARGETS.find((t) => t.id === selectedTarget) || USB_EXPORT_TARGETS[0],
    [selectedTarget],
  )
  const isUsbTarget = useMemo(
    () => USB_EXPORT_TARGETS.some((t) => t.id === selectedTarget),
    [selectedTarget],
  )
  const selectedDevice = useMemo(
    () => connectedDevices.find((d) => d.id === selectedDeviceId) || null,
    [connectedDevices, selectedDeviceId],
  )

  const filteredPlaylists = useMemo(() => {
    if (!playlistSearch.trim()) return playlists
    const q = playlistSearch.toLowerCase()
    return playlists.filter((p) => (p.name || '').toLowerCase().includes(q))
  }, [playlists, playlistSearch])

  const togglePlaylist = (id) => {
    const key = String(id)
    setSelectedPlaylistIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Compute tracks & playlists to include in the export
  const exportSelection = useMemo(() => {
    if (exportScope === 'all' || playlists.length === 0) {
      return {
        tracks,
        playlists,
        folders,
      }
    }
    const chosenPlaylists = playlists.filter((p) => selectedPlaylistIds.has(String(p.id)))
    const neededTrackIds = new Set()
    for (const pl of chosenPlaylists) {
      for (const tid of pl.trackIds || []) neededTrackIds.add(String(tid))
    }
    const chosenTracks = neededTrackIds.size
      ? tracks.filter((t) => neededTrackIds.has(String(t.id)))
      : tracks
    return {
      tracks: chosenTracks,
      playlists: chosenPlaylists,
      folders,
    }
  }, [exportScope, tracks, playlists, folders, selectedPlaylistIds])

  const handleChooseOutputDir = async () => {
    if (!window.electronAPI?.selectDirectory) {
      toast.error('Folder picker is available in the desktop app.')
      return
    }
    const dir = await window.electronAPI.selectDirectory(outputDir || undefined)
    if (dir) setOutputDir(dir)
  }

  const handleChooseUsbFolder = async () => {
    if (!window.electronAPI?.selectDirectory) {
      toast.error('Folder picker is available in the desktop app.')
      return
    }
    const dir = await window.electronAPI.selectDirectory(customUsbPath || selectedDevice?.mountPoint || '/Volumes')
    if (dir) {
      setCustomUsbPath(dir)
      setSelectedDeviceId('')
    }
  }

  const effectiveUsbMount = customUsbPath || selectedDevice?.mountPoint || ''
  const effectiveUsbName = customUsbPath
    ? (customUsbPath.split(/[\\/]/).filter(Boolean).pop() || customUsbPath)
    : (selectedDevice?.name || '')

  const handleRunExport = async () => {
    if (isUsbTarget && !effectiveUsbMount) {
      toast.error('Select a connected USB drive or click "Browse Drive / Folder".')
      return
    }

    setIsExporting(true)
    setExportResult(null)
    setExportProgress({ stage: 'starting', progress: 5, message: `Preparing ${targetConfig.label} export...` })

    try {
      // Hydrate any cloud playlists that do not yet have trackIds cached locally
      let resolvedPlaylists = exportSelection.playlists
      let resolvedTracks = exportSelection.tracks
      if (exportScope === 'playlists' && resolvedPlaylists.length > 0) {
        const hydrated = []
        const extraTracksMap = new Map(tracks.map((t) => [String(t.id), t]))
        for (const pl of resolvedPlaylists) {
          if (Array.isArray(pl.trackIds) && pl.trackIds.length > 0) {
            hydrated.push(pl)
          } else {
            const detail = await fetchPlaylistTracks(pl.id).catch(() => null)
            const plTracks = detail?.tracks || []
            for (const t of plTracks) extraTracksMap.set(String(t.id), t)
            hydrated.push({ ...pl, trackIds: plTracks.map((t) => String(t.id)) })
          }
        }
        resolvedPlaylists = hydrated
        const needed = new Set()
        for (const pl of resolvedPlaylists) {
          for (const tid of pl.trackIds || []) needed.add(String(tid))
        }
        if (needed.size > 0) {
          resolvedTracks = Array.from(needed).map((id) => extraTracksMap.get(id)).filter(Boolean)
        }
      }

      if (!resolvedTracks.length) {
        toast.error('No tracks in your selection to export. Import tracks first!')
        setIsExporting(false)
        setExportProgress(null)
        return
      }

      // Desktop Electron local export (fast, works offline & directly writes to USB / DJ folders!)
      if (isUsbTarget && window.electronAPI?.exportLocalUsb) {
        const res = await window.electronAPI.exportLocalUsb({
          target: selectedTarget,
          mountPoint: effectiveUsbMount,
          tracks: resolvedTracks,
          playlists: resolvedPlaylists,
          folders: exportSelection.folders,
          options: {
            folderStructure,
            duplicatePolicy,
            backup: backupExisting,
          },
        })
        setExportResult(res)
        if (res?.success) {
          toast.success(`Exported to ${effectiveUsbName} (${targetConfig.label})!`)
        } else {
          toast.error(res?.error || 'USB export failed')
        }
        return
      }

      if (!isUsbTarget && window.electronAPI?.exportLocalSoftware) {
        const res = await window.electronAPI.exportLocalSoftware({
          target: selectedTarget,
          outputDir,
          tracks: resolvedTracks,
          playlists: resolvedPlaylists,
          folders: exportSelection.folders,
          options: {
            preserveHierarchy,
            writeSeratoTags,
          },
        })
        setExportResult(res)
        if (res?.success) {
          toast.success(`Exported ${res.filesWritten || 1} file(s) for ${targetConfig.label}!`)
        } else {
          toast.error(res?.error || 'Export failed')
        }
        return
      }

      // Web browser fallback via backend API
      const formatMap = {
        'rekordbox-xml': 'xml',
        rekordbox: 'xml',
        djxml: 'xml',
        traktor: 'm3u',
        serato: 'm3u',
        virtualdj: 'm3u',
        itunes: 'm3u',
      }
      const fmt = formatMap[selectedTarget] || 'm3u'
      const firstPlaylistId = exportSelection.playlists[0]?.id
      if (!firstPlaylistId) {
        throw new Error('Select a playlist to download in web mode.')
      }
      const response = await axios.get(`/api/export/playlist/${fmt}?playlistId=${firstPlaylistId}`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sounditdj-${selectedTarget}.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setExportResult({ success: true, filesWritten: 1, outputPath: 'Downloads' })
      toast.success(`Downloaded ${targetConfig.label} export`)
    } catch (err) {
      toast.error(err.message || 'Export failed')
      setExportResult({ success: false, error: err.message })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full flex bg-background-primary overflow-hidden select-none">
      {/* Left MIXO-Style Export Sub-Sidebar */}
      <aside className="w-60 bg-background-secondary border-r border-border flex flex-col overflow-y-auto shrink-0 py-3">
        {/* USB EXPORTS */}
        <div className="px-3 mb-1.5">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            USB EXPORTS
          </span>
        </div>
        <div className="px-2 space-y-0.5 mb-4">
          {USB_EXPORT_TARGETS.map((item) => {
            const Icon = item.icon
            const isActive = selectedTarget === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSelectedTarget(item.id)}
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
                  <span className="truncate">{item.label}</span>
                  {item.beta && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${
                        isActive
                          ? 'bg-brand-primary/20 text-brand-primary'
                          : 'bg-brand-accent-dim text-brand-accent'
                      }`}
                    >
                      BETA
                    </span>
                  )}
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-primary' : 'opacity-40'}`} />
              </button>
            )
          })}
        </div>

        {/* FULL EXPORTS */}
        <div className="px-3 mb-1.5 pt-2 border-t border-border/50">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            FULL EXPORTS
          </span>
        </div>
        <div className="px-2 space-y-0.5">
          {FULL_EXPORT_TARGETS.map((item) => {
            const Icon = item.icon
            const isActive = selectedTarget === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSelectedTarget(item.id)}
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
                        : 'bg-background-primary text-brand-accent border border-border/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-primary' : 'opacity-40'}`} />
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main Export Workspace */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-text-primary uppercase tracking-wide">
                  Export {targetConfig.label}
                </h1>
                {targetConfig.beta && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-accent-dim text-brand-accent border border-brand-accent/30">
                    USB ENGINE
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-sky font-medium mt-0.5">{targetConfig.family}</p>
              <p className="text-xs text-text-secondary mt-1">{targetConfig.desc}</p>
            </div>
          </div>

          {/* 4-Dimension Compatibility Matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Audio', value: targetConfig.compat.audio },
              { label: 'Playlists', value: targetConfig.compat.playlists },
              { label: 'Library Format', value: targetConfig.compat.library },
              { label: 'Cues & Beatgrids', value: targetConfig.compat.performance },
            ].map((cell) => (
              <div key={cell.label} className="bg-background-secondary border border-border/80 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent mb-1">
                  <ShieldCheck className="w-3 h-3 text-brand-sky" />
                  <span>{cell.label}</span>
                </div>
                <div className="text-[11px] text-text-secondary leading-snug">{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Destination Card (USB Drive OR Local Software Folder) */}
          <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
            {isUsbTarget ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    1. Select Destination USB Drive
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleChooseUsbFolder}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background-tertiary hover:bg-background-elevated text-[11px] text-text-primary border border-border/60 transition-colors"
                    >
                      <FolderOpen className="w-3 h-3 text-brand-accent" />
                      <span>Browse Drive / Folder</span>
                    </button>
                    <button
                      onClick={() => fetchConnectedDevices()}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background-tertiary hover:bg-background-elevated text-[11px] text-text-secondary hover:text-brand-accent border border-border/60 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh Drives</span>
                    </button>
                  </div>
                </div>

                {customUsbPath && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-brand-accent-dim/50 border border-brand-accent/60 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="w-4 h-4 text-brand-accent shrink-0" />
                      <span className="font-mono text-text-primary truncate">{customUsbPath}</span>
                    </div>
                    <button
                      onClick={() => setCustomUsbPath('')}
                      className="text-[11px] text-text-muted hover:text-text-primary shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {connectedDevices.length === 0 && !customUsbPath ? (
                  <div className="bg-background-primary/60 border border-dashed border-border rounded-lg p-6 text-center">
                    <Usb className="w-7 h-7 text-brand-sky/70 mx-auto mb-2" />
                    <div className="text-xs font-semibold text-text-primary">No External USB Drives Detected</div>
                    <p className="text-[11px] text-text-muted mt-1">
                      Plug in a FAT32, exFAT, or HFS+ USB flash drive — or click &ldquo;Browse Drive / Folder&rdquo; above to pick any mounted USB volume or folder.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {connectedDevices.map((dev) => {
                      const active = !customUsbPath && dev.id === selectedDeviceId
                      return (
                        <button
                          key={dev.id}
                          onClick={() => {
                            setCustomUsbPath('')
                            setSelectedDeviceId(dev.id)
                          }}
                          className={`text-left p-3.5 rounded-lg border transition-all ${
                            active
                              ? 'border-brand-accent bg-brand-accent-dim/50 ring-1 ring-brand-accent/40'
                              : 'border-border bg-background-primary/50 hover:bg-background-tertiary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <HardDrive className={`w-4 h-4 shrink-0 ${active ? 'text-brand-accent' : 'text-brand-sky'}`} />
                              <span className="text-sm font-semibold text-text-primary truncate">{dev.name}</span>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background-secondary text-brand-sky">
                              {dev.filesystem || 'USB'}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-text-muted">
                            <span className="truncate">{dev.mountPoint}</span>
                            <span className="shrink-0 ml-2 text-brand-accent">{dev.free || 'Ready'} free</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* USB Transfer Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-1">
                      Folder Layout
                    </label>
                    <select
                      value={folderStructure}
                      onChange={(e) => setFolderStructure(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                    >
                      <option value="artist-album">Artist / Album</option>
                      <option value="playlist">By Playlist</option>
                      <option value="flat">Flat Contents Folder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-1">
                      Duplicate Audio Files
                    </label>
                    <select
                      value={duplicatePolicy}
                      onChange={(e) => setDuplicatePolicy(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                    >
                      <option value="skip">Skip Existing (Fast Sync)</option>
                      <option value="overwrite">Overwrite All</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupExisting}
                        onChange={(e) => setBackupExisting(e.target.checked)}
                        className="accent-[#FAE1AF]"
                      />
                      <span>Backup existing USB DB</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  1. Export Destination Folder
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder="Choose destination directory..."
                    className="flex-1 px-3 py-2 rounded-lg bg-background-primary border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-brand-accent"
                  />
                  <button
                    onClick={handleChooseOutputDir}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border text-xs font-medium text-text-primary transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-brand-accent" />
                    <span>Change Folder</span>
                  </button>
                </div>

                {selectedTarget === 'serato' && (
                  <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-border/50 text-xs text-text-secondary">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preserveHierarchy}
                        onChange={(e) => setPreserveHierarchy(e.target.checked)}
                        className="accent-[#FAE1AF]"
                      />
                      <span>Preserve nested folder hierarchy (%% subcrates)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={writeSeratoTags}
                        onChange={(e) => setWriteSeratoTags(e.target.checked)}
                        className="accent-[#FAE1AF]"
                      />
                      <span>Write Serato Markers2 cues & BeatGrid to MP3/AIFF tags</span>
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Playlist & Track Selection Card */}
          <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  2. Select Content to Export
                </h2>
                <div className="flex items-center gap-1 bg-background-primary p-0.5 rounded-lg border border-border/60">
                  <button
                    onClick={() => setExportScope('all')}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      exportScope === 'all'
                        ? 'bg-brand-accent text-brand-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    All Tracks ({tracks.length})
                  </button>
                  <button
                    onClick={() => setExportScope('playlists')}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      exportScope === 'playlists'
                        ? 'bg-brand-accent text-brand-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Playlists ({playlists.length})
                  </button>
                </div>
              </div>

              {exportScope === 'playlists' && playlists.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={playlistSearch}
                      onChange={(e) => setPlaylistSearch(e.target.value)}
                      placeholder="Filter playlists..."
                      className="pl-8 pr-2.5 py-1 rounded-md bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent w-44"
                    />
                  </div>
                  <button
                    onClick={() => setSelectedPlaylistIds(new Set(filteredPlaylists.map((p) => String(p.id))))}
                    className="px-2 py-1 rounded bg-background-tertiary text-[11px] text-text-primary border border-border/50"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedPlaylistIds(new Set())}
                    className="px-2 py-1 rounded bg-background-tertiary text-[11px] text-text-secondary border border-border/50"
                  >
                    None
                  </button>
                </div>
              )}
            </div>

            {exportScope === 'playlists' && (
              <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
                {filteredPlaylists.length === 0 ? (
                  <div className="p-6 text-center text-xs text-text-muted italic">
                    {playlists.length === 0
                      ? 'No playlists yet — switch to "All Tracks" or import crates from the Import tab.'
                      : 'No playlists match your filter.'}
                  </div>
                ) : (
                  filteredPlaylists.map((pl) => {
                    const checked = selectedPlaylistIds.has(String(pl.id))
                    const count = pl.track_count ?? pl.trackIds?.length ?? 0
                    return (
                      <div
                        key={pl.id}
                        onClick={() => togglePlaylist(pl.id)}
                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                          checked ? 'bg-brand-accent-dim/40' : 'hover:bg-background-tertiary/50'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-brand-accent shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-text-muted shrink-0" />
                        )}
                        <span className="flex-1 text-xs font-medium text-text-primary truncate">{pl.name}</span>
                        <span className="text-[11px] font-mono text-text-muted">{count} tracks</span>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Export Trigger Footer */}
            <div className="p-4 border-t border-border bg-background-primary/60 flex items-center justify-between gap-4">
              <div className="text-xs text-text-secondary">
                Ready to export{' '}
                <span className="font-bold text-brand-accent font-mono">{exportSelection.tracks.length}</span> track(s)
                {exportSelection.playlists.length > 0 && (
                  <>
                    {' '}across{' '}
                    <span className="font-bold text-brand-sky font-mono">{exportSelection.playlists.length}</span>{' '}
                    playlist(s)
                  </>
                )}
              </div>

              <button
                onClick={handleRunExport}
                disabled={isExporting || !exportSelection.tracks.length || (isUsbTarget && !effectiveUsbMount)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 text-brand-primary font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
              >
                {isExporting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isExporting ? 'Exporting...' : `Export to ${targetConfig.label}`}</span>
              </button>
            </div>
          </div>

          {/* Live Transfer Progress */}
          {exportProgress && (isExporting || exportProgress.stage !== 'complete') && (
            <div className="bg-background-secondary border border-brand-sky/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-primary flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-brand-sky animate-spin" />
                  {exportProgress.message || 'Exporting...'}
                </span>
                <span className="font-mono text-brand-accent">{exportProgress.progress || 0}%</span>
              </div>
              <div className="w-full h-2 bg-background-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-sky to-brand-accent transition-all duration-300"
                  style={{ width: `${exportProgress.progress || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Export Verification Result */}
          {exportResult && (
            <div
              className={`rounded-xl p-5 border ${
                exportResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {exportResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={`text-sm font-bold ${exportResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                      {exportResult.success
                        ? `${targetConfig.label} Export Verified & Complete`
                        : 'Export Failed'}
                    </div>
                    {exportResult.error ? (
                      <p className="text-xs text-red-200 mt-1">{exportResult.error}</p>
                    ) : (
                      <p className="text-xs text-text-secondary font-mono mt-1 break-all">
                        Destination: {exportResult.outputPath}
                        {exportResult.filesWritten ? ` (${exportResult.filesWritten} file(s) written)` : ''}
                      </p>
                    )}
                    {exportResult.warnings?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200 font-mono">
                        {exportResult.warnings.slice(0, 8).map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {exportResult.success && exportResult.outputPath && window.electronAPI?.openPath && (
                  <button
                    onClick={() => window.electronAPI.openPath(exportResult.outputPath)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border text-xs font-semibold text-brand-accent shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Folder</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
