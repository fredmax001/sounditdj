import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Download, Upload, FileMusic, FileSpreadsheet, FileCode, CheckCircle2, AlertTriangle,
  Music, Loader2, HardDrive, Radio, Disc, Cpu, Smartphone, ListMusic, Layers,
  ChevronRight, FolderOpen, Clock, BarChart3, X, FolderInput, File,
} from 'lucide-react'
import useLibraryStore from '@store/libraryStore'
import axios from '../config/axios.js'

// ============ IMPORT SOURCES (MIXO-style) ============
const IMPORT_SOURCES = [
  { id: 'm3u', label: 'M3U / M3U8', desc: 'Universal playlist file', icon: ListMusic, accept: '.m3u,.m3u8', ext: ['.m3u', '.m3u8'] },
  { id: 'csv', label: 'CSV Spreadsheet', desc: 'Exported track list', icon: FileSpreadsheet, accept: '.csv', ext: ['.csv'] },
  { id: 'rekordbox', label: 'Rekordbox XML', desc: 'Pioneer DJ export', icon: FileCode, accept: '.xml', ext: ['.xml'] },
  { id: 'traktor', label: 'TRAKTOR', desc: 'Native Instruments NML', icon: Radio, accept: '.nml', ext: ['.nml'] },
  { id: 'virtualdj', label: 'VirtualDJ', desc: 'VirtualDJ database', icon: Disc, accept: '.xml', ext: ['.xml'] },
  { id: 'serato', label: 'Serato', desc: 'Serato crate file', icon: Cpu, accept: '.crate,application/octet-stream', ext: ['.crate'] },
  { id: 'json', label: 'JSON', desc: 'Custom JSON export', icon: FileCode, accept: '.json', ext: ['.json'] },
]

// Common DJ software library paths on macOS
const LIBRARY_PATH_HINTS = {
  serato: [
    { label: 'Serato Crates', path: '~/Music/_Serato_/Crates' },
    { label: 'Serato Subcrates', path: '~/Music/_Serato_/Subcrates' },
  ],
  rekordbox: [
    { label: 'rekordbox Library', path: '~/Library/Pioneer/rekordbox' },
    { label: 'rekordbox Exports', path: '~/Music/PioneerDJ' },
  ],
  traktor: [
    { label: 'Traktor Collection', path: '~/Documents/Native Instruments' },
  ],
  virtualdj: [
    { label: 'VirtualDJ Database', path: '~/Documents/VirtualDJ' },
  ],
  m3u: [],
  csv: [],
  json: [],
}

const EXPORT_FORMATS = [
  { id: 'm3u', label: 'M3U Playlist', desc: 'Universal — works with all DJ software', icon: FileMusic, ext: 'm3u' },
  { id: 'csv', label: 'CSV Spreadsheet', desc: 'Generic — Rekordbox, Serato, Traktor', icon: FileSpreadsheet, ext: 'csv' },
  { id: 'xml', label: 'Rekordbox XML', desc: 'Pioneer DJ — Rekordbox 5/6/7 with cues', icon: FileCode, ext: 'xml' },
]

const STAGE_ICONS = {
  pending: Clock,
  running: Loader2,
  complete: CheckCircle2,
}

function DJSoftwareImportExport({ initialTab = 'export' }) {
  const { playlists, fetchPlaylists } = useLibraryStore()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedPlaylist, setSelectedPlaylist] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('m3u')

  // Import state
  const [selectedSource, setSelectedSource] = useState('m3u')
  const [importName, setImportName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importJobId, setImportJobId] = useState(null)
  const [importProgress, setImportProgress] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const [importMode, setImportMode] = useState('auto')
  const [discoveredFiles, setDiscoveredFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const folderInputRef = useRef(null)
  const [batchJobIds, setBatchJobIds] = useState([])
  const [batchResults, setBatchResults] = useState([])
  const [batchProgress, setBatchProgress] = useState(null)

  // Auto scan / discover state
  const [autoDiscoveredFiles, setAutoDiscoveredFiles] = useState([])
  const [selectedAutoFiles, setSelectedAutoFiles] = useState(new Set())
  const [isScanning, setIsScanning] = useState(false)

  // Auto scan for local libraries
  useEffect(() => {
    if (importMode !== 'auto') return

    const scan = async () => {
      setIsScanning(true)
      setAutoDiscoveredFiles([])
      setSelectedAutoFiles(new Set())
      setImportResult(null)
      setBatchResults([])

      try {
        let data
        if (window.electronAPI?.isElectron) {
          data = await window.electronAPI.discoverLibraries(selectedSource)
        } else {
          const res = await axios.get(`/api/import/discover/${selectedSource}`)
          data = res.data
        }
        setAutoDiscoveredFiles(data)
        // Select all by default
        setSelectedAutoFiles(new Set(data.map((_, i) => i)))
      } catch (err) {
        console.error('Scan error:', err)
      } finally {
        setIsScanning(false)
      }
    }

    scan()
  }, [importMode, selectedSource])

  // Poll for import progress
  useEffect(() => {
    if (!importJobId || !isImporting) return

    const poll = async () => {
      try {
        const { data } = await axios.get(`/api/import/progress/${importJobId}`)
        setImportProgress(data)

        if (data.status === 'complete') {
          setIsImporting(false)
          setImportResult({ success: true, ...data.result })
          setImportJobId(null)
          await fetchPlaylists()
        } else if (data.status === 'error') {
          setIsImporting(false)
          setImportResult({ success: false, error: data.error })
          setImportJobId(null)
        }
      } catch (err) {
        console.error('Progress poll error:', err)
      }
    }

    const interval = setInterval(poll, 800)
    return () => clearInterval(interval)
  }, [importJobId, isImporting, fetchPlaylists])

  // Poll for batch progress
  useEffect(() => {
    if (!batchJobIds.length) return

    const poll = async () => {
      try {
        const results = await Promise.all(
          batchJobIds.map(id => axios.get(`/api/import/progress/${id}`).then(r => r.data).catch(() => null))
        )
        const valid = results.filter(Boolean)
        if (!valid.length) return

        const complete = valid.filter(r => r.status === 'complete')
        const errors = valid.filter(r => r.status === 'error')
        const running = valid.filter(r => r.status !== 'complete' && r.status !== 'error')

        setBatchProgress({
          total: valid.length,
          completed: complete.length,
          failed: errors.length,
          running: running.length,
        })

        if (running.length === 0) {
          setIsImporting(false)
          setBatchResults(valid)
          setBatchJobIds([])
          await fetchPlaylists()
        }
      } catch (err) {
        console.error('Batch poll error:', err)
      }
    }

    const interval = setInterval(poll, 1000)
    return () => clearInterval(interval)
  }, [batchJobIds, fetchPlaylists])

  const handleExport = async () => {
    if (!selectedPlaylist) return
    const format = EXPORT_FORMATS.find(f => f.id === selectedFormat)
    try {
      const response = await axios.get(`/api/export/playlist/${format.id}?playlistId=${selectedPlaylist}`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: response.headers['content-type'] })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      
      let filename = `playlist_export.${format.ext}`
      const disposition = response.headers['content-disposition']
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        const matches = filenameRegex.exec(disposition)
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '')
        }
      }
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Failed to export playlist:', err)
      alert('Failed to export playlist. Please try again.')
    }
  }

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setImportName(file.name.replace(/\.[^.]+$/, ''))
    setDiscoveredFiles([])
    setSelectedFiles(new Set())
    setImportResult(null)
    setBatchResults([])
  }, [])

  const handleFolderSelect = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const source = IMPORT_SOURCES.find(s => s.id === selectedSource)
    const exts = source?.ext || []

    // Filter to relevant file types for the selected source
    const relevant = files.filter(f => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      return exts.includes(ext)
    })

    // Sort by name
    relevant.sort((a, b) => a.name.localeCompare(b.name))

    setDiscoveredFiles(relevant)
    setSelectedFiles(new Set(relevant.map((_, i) => i)))
    setSelectedFile(null)
    setImportResult(null)
    setBatchResults([])
  }, [selectedSource])

  const toggleFileSelection = (index) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectAllFiles = () => {
    setSelectedFiles(new Set(discoveredFiles.map((_, i) => i)))
  }

  const deselectAllFiles = () => {
    setSelectedFiles(new Set())
  }

  const startImport = async () => {
    if (!selectedFile) return

    setIsImporting(true)
    setImportResult(null)
    setImportProgress(null)

    const source = IMPORT_SOURCES.find(s => s.id === selectedSource)

    try {
      let response
      if (window.electronAPI?.isElectron && selectedFile.path) {
        response = await axios.post('/api/import/dj-software', {
          source: selectedSource,
          localPath: selectedFile.path,
          name: importName || selectedFile.name.replace(/\.[^.]+$/, '')
        })
      } else {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('source', selectedSource)
        formData.append('name', importName || selectedFile.name.replace(/\.[^.]+$/, ''))

        response = await axios.post('/api/import/dj-software', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      setImportJobId(response.data.jobId)
    } catch (error) {
      setIsImporting(false)
      setImportResult({
        success: false,
        error: error.response?.data?.error || 'Import failed to start',
      })
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startBatchImport = async () => {
    const filesToImport = discoveredFiles.filter((_, i) => selectedFiles.has(i))
    if (!filesToImport.length) return

    setIsImporting(true)
    setImportResult(null)
    setBatchResults([])
    setBatchProgress(null)

    const source = IMPORT_SOURCES.find(s => s.id === selectedSource)

    const jobs = []
    for (const file of filesToImport) {
      try {
        let response
        if (window.electronAPI?.isElectron && file.path) {
          response = await axios.post('/api/import/dj-software', {
            source: selectedSource,
            localPath: file.path,
            name: file.name.replace(/\.[^.]+$/, '')
          })
        } else {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('source', selectedSource)
          formData.append('name', file.name.replace(/\.[^.]+$/, ''))

          response = await axios.post('/api/import/dj-software', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
        jobs.push(response.data.jobId)
      } catch (error) {
        console.error('Failed to start import for', file.name, error)
      }
    }

    if (jobs.length) {
      setBatchJobIds(jobs)
    } else {
      setIsImporting(false)
      setImportResult({ success: false, error: 'Failed to start any imports' })
    }

    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  const toggleAutoFileSelection = (index) => {
    const next = new Set(selectedAutoFiles)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setSelectedAutoFiles(next)
  }

  const selectAllAutoFiles = () => {
    setSelectedAutoFiles(new Set(autoDiscoveredFiles.map((_, i) => i)))
  }

  const deselectAllAutoFiles = () => {
    setSelectedAutoFiles(new Set())
  }

  const startAutoImport = async () => {
    const filesToImport = autoDiscoveredFiles.filter((_, i) => selectedAutoFiles.has(i))
    if (!filesToImport.length) return

    setIsImporting(true)
    setImportResult(null)
    setBatchResults([])
    setBatchProgress(null)

    const jobs = []
    for (const file of filesToImport) {
      try {
        if (window.electronAPI?.isElectron && file.path) {
          const response = await axios.post('/api/import/dj-software', {
            source: selectedSource,
            localPath: file.path,
            name: file.name.replace(/\.[^.]+$/, '')
          })
          jobs.push(response.data.jobId)
        } else {
          const response = await axios.post('/api/import/dj-software', {
            source: selectedSource,
            localPath: file.path,
            name: file.name.replace(/\.[^.]+$/, '')
          })
          jobs.push(response.data.jobId)
        }
      } catch (error) {
        console.error('Failed to start import for', file.name, error)
      }
    }

    if (jobs.length) {
      setBatchJobIds(jobs)
    } else {
      setIsImporting(false)
      setImportResult({ success: false, error: 'Failed to start any imports' })
    }
  }

  const cancelImport = () => {
    setIsImporting(false)
    setImportJobId(null)
    setImportProgress(null)
    setBatchJobIds([])
    setBatchProgress(null)
  }

  const selectedPlaylistName = playlists.find(p => p.id === selectedPlaylist)?.name || ''
  const currentSource = IMPORT_SOURCES.find(s => s.id === selectedSource)
  const pathHints = LIBRARY_PATH_HINTS[selectedSource] || []

  return (
    <div className="h-full flex">
      {/* Left Sidebar — Import Sources (MIXO-style) */}
      {activeTab === 'import' && (
        <div className="w-64 border-r border-border bg-background-secondary flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Import Sources</h2>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {IMPORT_SOURCES.map((source) => {
              const Icon = source.icon
              const isActive = selectedSource === source.id
              return (
                <button
                  key={source.id}
                  onClick={() => {
                    setSelectedSource(source.id)
                    setSelectedFile(null)
                    setDiscoveredFiles([])
                    setSelectedFiles(new Set())
                    setImportResult(null)
                    setBatchResults([])
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-brand-accent/10 text-brand-accent border-l-2 border-brand-accent'
                      : 'text-text-secondary hover:bg-background-tertiary/50 border-l-2 border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-brand-accent' : 'text-text-muted'}`} />
                  <div className="min-w-0">
                    <div className={`text-[13px] font-medium ${isActive ? 'text-brand-accent' : 'text-text-primary'}`}>
                      {source.label}
                    </div>
                    <div className="text-[11px] text-text-muted truncate">{source.desc}</div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ml-auto shrink-0 ${isActive ? 'text-brand-accent' : 'text-text-muted'}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Download className="w-6 h-6 text-brand-accent" />
            <div>
              <h1 className="text-xl font-semibold text-text-primary">DJ Software Import / Export</h1>
              <p className="text-sm text-text-muted">Move playlists between Sound It DJ and your DJ software</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-background-secondary rounded-lg p-1 mb-6 w-fit">
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
                activeTab === 'export'
                  ? 'bg-background-tertiary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Download className="w-4 h-4" />
              Export to DJ Software
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
                activeTab === 'import'
                  ? 'bg-background-tertiary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Upload className="w-4 h-4" />
              Import from DJ Software
            </button>
          </div>

          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* Select Playlist */}
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <label className="text-[11px] text-text-muted uppercase mb-2 block tracking-wider">Select Playlist</label>
                <select
                  value={selectedPlaylist}
                  onChange={(e) => setSelectedPlaylist(e.target.value)}
                  className="w-full bg-background-primary border border-border text-[13px] text-text-primary rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-accent/50"
                >
                  <option value="">Choose a playlist...</option>
                  {playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.track_count || 0} tracks)</option>
                  ))}
                </select>
              </div>

              {/* Select Format */}
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <label className="text-[11px] text-text-muted uppercase mb-3 block tracking-wider">Export Format</label>
                <div className="grid grid-cols-3 gap-3">
                  {EXPORT_FORMATS.map((format) => {
                    const Icon = format.icon
                    return (
                      <button
                        key={format.id}
                        onClick={() => setSelectedFormat(format.id)}
                        className={`flex flex-col items-start gap-2 p-4 rounded-lg border transition-all text-left ${
                          selectedFormat === format.id
                            ? 'border-brand-accent bg-brand-accent/10'
                            : 'border-border bg-background-primary hover:border-brand-accent/30'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${selectedFormat === format.id ? 'text-brand-accent' : 'text-text-muted'}`} />
                        <div>
                          <div className={`text-[13px] font-medium ${selectedFormat === format.id ? 'text-brand-accent' : 'text-text-primary'}`}>
                            {format.label}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">{format.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={!selectedPlaylist}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-[14px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export {selectedPlaylistName && `"${selectedPlaylistName}"`} as {selectedFormat.toUpperCase()}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Source Info Card */}
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <div className="flex items-start gap-4">
                  {currentSource && (
                    <>
                      <div className="p-3 rounded-lg bg-brand-accent/10">
                        <currentSource.icon className="w-6 h-6 text-brand-accent" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[15px] font-semibold text-text-primary">{currentSource.label}</h3>
                        <p className="text-[13px] text-text-muted mt-0.5">{currentSource.desc}</p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-text-muted">
                          <FileCode className="w-3.5 h-3.5" />
                          Accepted: {currentSource.accept}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Import Mode Toggle */}
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <label className="text-[11px] text-text-muted uppercase mb-3 block tracking-wider">Import Mode</label>
                <div className="flex bg-background-primary rounded-lg p-1 w-fit mb-4">
                  <button
                    onClick={() => setImportMode('auto')}
                    className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
                      importMode === 'auto'
                        ? 'bg-background-tertiary text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    Auto Detect
                  </button>
                  <button
                    onClick={() => setImportMode('file')}
                    className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
                      importMode === 'file'
                        ? 'bg-background-tertiary text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    <File className="w-4 h-4" />
                    Single File
                  </button>
                  <button
                    onClick={() => setImportMode('folder')}
                    className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
                      importMode === 'folder'
                        ? 'bg-background-tertiary text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    <FolderInput className="w-4 h-4" />
                    Browse Folder
                  </button>
                </div>

                {/* Library path hints */}
                {importMode !== 'auto' && pathHints.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] text-text-muted uppercase mb-2">Common Library Locations</div>
                    <div className="flex flex-wrap gap-2">
                      {pathHints.map((hint) => (
                        <button
                          key={hint.path}
                          onClick={() => navigator.clipboard?.writeText(hint.path)}
                          title="Click to copy path"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background-primary border border-border rounded-lg text-[11px] text-text-secondary hover:text-brand-accent hover:border-brand-accent/30 transition-colors"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>{hint.label}</span>
                          <span className="text-text-muted">{hint.path}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {importMode !== 'auto' && (
                  <>
                    <label className="text-[11px] text-text-muted uppercase mb-2 block tracking-wider">Playlist Name (optional)</label>
                    <input
                      type="text"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder={importMode === 'folder' ? 'Will use filename for each crate' : 'Will use filename if left empty'}
                      disabled={isImporting}
                      className="w-full bg-background-primary border border-border text-[13px] text-text-primary rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-accent/50 mb-4 disabled:opacity-50"
                    />
                  </>
                )}

                {/* Auto Discover Input */}
                {importMode === 'auto' && (
                  <>
                    {isScanning ? (
                      <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                        <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-3" />
                        <div className="text-sm">Scanning for local {currentSource?.label} library...</div>
                      </div>
                    ) : autoDiscoveredFiles.length === 0 ? (
                      <div className="text-center py-8 px-4 border border-dashed border-border rounded-xl">
                        <AlertTriangle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                        <div className="text-sm font-medium text-text-primary">No local playlists found</div>
                        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                          We searched the standard path for {currentSource?.label}. If it is installed elsewhere, use "Single File" or "Browse Folder" to select your library manually.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[13px] font-medium text-text-primary">
                            Found {autoDiscoveredFiles.length} item{autoDiscoveredFiles.length !== 1 ? 's' : ''} in local library
                          </div>
                          <div className="flex gap-2">
                            <button
                               onClick={selectAllAutoFiles}
                               className="text-[11px] text-text-muted hover:text-brand-accent transition-colors"
                            >
                              Select all
                            </button>
                            <span className="text-text-muted">·</span>
                            <button
                               onClick={deselectAllAutoFiles}
                               className="text-[11px] text-text-muted hover:text-brand-accent transition-colors"
                            >
                              Deselect all
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-auto border border-border rounded-xl bg-background-primary">
                          {autoDiscoveredFiles.map((file, index) => (
                            <label
                              key={index}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-background-secondary ${
                                index !== autoDiscoveredFiles.length - 1 ? 'border-b border-border' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedAutoFiles.has(index)}
                                onChange={() => toggleAutoFileSelection(index)}
                                className="w-4 h-4 rounded border-border text-brand-accent focus:ring-brand-accent"
                              />
                              <FileCode className="w-4 h-4 text-text-muted shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-text-primary truncate">{file.name}</div>
                                <div className="text-[11px] text-text-muted truncate">{file.path}</div>
                              </div>
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>{selectedAutoFiles.size} selected</span>
                        </div>

                        {selectedAutoFiles.size > 0 && !isImporting && (
                          <button
                            onClick={startAutoImport}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-[14px] font-medium rounded-lg transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Import {selectedAutoFiles.size} Playlist{selectedAutoFiles.size !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Single File Input */}
                {importMode === 'file' && (
                  <>
                    {!selectedFile ? (
                      <label className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl hover:border-brand-accent/50 transition-colors cursor-pointer">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={currentSource?.accept}
                          onChange={handleFileSelect}
                          disabled={isImporting}
                          style={{
                            position: 'absolute',
                            width: '1px',
                            height: '1px',
                            padding: 0,
                            margin: '-1px',
                            overflow: 'hidden',
                            clip: 'rect(0, 0, 0, 0)',
                            whiteSpace: 'nowrap',
                            borderWidth: 0,
                          }}
                        />
                        <FolderOpen className="w-8 h-8 text-text-muted" />
                        <div className="text-center">
                          <div className="text-sm font-medium text-text-primary">Click to select file</div>
                          <div className="text-xs text-text-muted mt-1">
                            Import from {currentSource?.label} ({currentSource?.accept})
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-background-primary border border-border rounded-xl">
                        <FileCode className="w-6 h-6 text-brand-accent" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text-primary truncate">{selectedFile.name}</div>
                          <div className="text-[11px] text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                        </div>
                        {!isImporting && (
                          <button
                            onClick={() => { setSelectedFile(null); setImportName('') }}
                            className="p-1.5 hover:bg-background-secondary rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-text-muted" />
                          </button>
                        )}
                      </div>
                    )}

                    {selectedFile && !isImporting && (
                      <button
                        onClick={startImport}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-[14px] font-medium rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Start Import
                      </button>
                    )}
                  </>
                )}

                {/* Folder Input */}
                {importMode === 'folder' && (
                  <>
                    {discoveredFiles.length === 0 ? (
                      <label className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl hover:border-brand-accent/50 transition-colors cursor-pointer">
                        <input
                          ref={folderInputRef}
                          type="file"
                          webkitdirectory=""
                          directory=""
                          multiple
                          onChange={handleFolderSelect}
                          disabled={isImporting}
                          style={{
                            position: 'absolute',
                            width: '1px',
                            height: '1px',
                            padding: 0,
                            margin: '-1px',
                            overflow: 'hidden',
                            clip: 'rect(0, 0, 0, 0)',
                            whiteSpace: 'nowrap',
                            borderWidth: 0,
                          }}
                        />
                        <HardDrive className="w-8 h-8 text-text-muted" />
                        <div className="text-center">
                          <div className="text-sm font-medium text-text-primary">Browse DJ software library folder</div>
                          <div className="text-xs text-text-muted mt-1">
                            Select a folder containing {currentSource?.label} files
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[13px] font-medium text-text-primary">
                            {discoveredFiles.length} file{discoveredFiles.length !== 1 ? 's' : ''} found
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={selectAllFiles}
                              className="text-[11px] text-text-muted hover:text-brand-accent transition-colors"
                            >
                              Select all
                            </button>
                            <span className="text-text-muted">·</span>
                            <button
                              onClick={deselectAllFiles}
                              className="text-[11px] text-text-muted hover:text-brand-accent transition-colors"
                            >
                              Deselect all
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-auto border border-border rounded-xl bg-background-primary">
                          {discoveredFiles.map((file, index) => (
                            <label
                              key={index}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-background-secondary ${
                                index !== discoveredFiles.length - 1 ? 'border-b border-border' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.has(index)}
                                onChange={() => toggleFileSelection(index)}
                                className="w-4 h-4 rounded border-border text-brand-accent focus:ring-brand-accent"
                              />
                              <FileCode className="w-4 h-4 text-text-muted shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-text-primary truncate">{file.name}</div>
                                <div className="text-[11px] text-text-muted">{(file.size / 1024).toFixed(1)} KB</div>
                              </div>
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>{selectedFiles.size} selected</span>
                          <button
                            onClick={() => { setDiscoveredFiles([]); setSelectedFiles(new Set()) }}
                            className="text-text-muted hover:text-text-primary transition-colors"
                          >
                            Clear
                          </button>
                        </div>

                        {selectedFiles.size > 0 && !isImporting && (
                          <button
                            onClick={startBatchImport}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-[14px] font-medium rounded-lg transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Import {selectedFiles.size} Playlist{selectedFiles.size !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Import Progress Panel */}
              {isImporting && (importProgress || batchProgress) && (
                <div className="bg-background-secondary border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 uppercase tracking-wider">
                      Import Progress
                    </h3>
                    <div className="flex items-center gap-3">
                      {window.electronAPI?.isElectron && (
                        <button
                          onClick={() => window.electronAPI.openLogsFolder()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background-primary border border-border rounded-lg text-[11px] text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Open Logs Folder
                        </button>
                      )}
                      <button
                        onClick={cancelImport}
                        className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {batchProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-text-secondary">Batch import</span>
                        <span className="text-text-muted">
                          {batchProgress.completed}/{batchProgress.total} complete
                          {batchProgress.failed > 0 && ` · ${batchProgress.failed} failed`}
                        </span>
                      </div>
                      <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-accent rounded-full transition-all duration-500"
                          style={{ width: `${batchProgress.total ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {importProgress.stages?.map((stage) => {
                        const subtext = 
                          stage.name === 'parse' ? 'Extracting metadata, artwork and waveform data from your tracks.' :
                          stage.name === 'match' ? 'Matching local files with databases.' :
                          stage.name === 'save' ? 'Saving tracks, cues, playlists and folders to the database.' : ''
                          
                        return (
                          <div key={stage.name} className="flex gap-4 p-3 border-b border-border/20 last:border-0 hover:bg-background-primary/30 transition-colors">
                            <div className="flex-1">
                              <div className="text-[13px] font-bold text-text-primary mb-1">
                                {stage.label}
                              </div>
                              <div className="text-[11px] text-text-muted leading-relaxed max-w-md">
                                {subtext}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 justify-center w-32">
                              {stage.status === 'running' ? (
                                <div className="h-1 bg-background-tertiary w-full rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${stage.progress}%` }} />
                                </div>
                              ) : stage.status === 'complete' ? (
                                <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                                  <CheckCircle2 className="w-4 h-4" /> Done
                                </div>
                              ) : (
                                <div className="w-0.5 h-3 bg-text-muted/30 rounded mr-2" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Import Result */}
              {importResult && !isImporting && (
                <div className={`rounded-xl p-5 border ${importResult.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  {importResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-medium text-text-primary">
                          Imported "{importResult.playlist?.name}"
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-background-primary rounded-lg p-3 text-center border border-border">
                          <div className="text-xl font-bold text-text-primary">{importResult.stats?.totalInFile || 0}</div>
                          <div className="text-[11px] text-text-muted">Tracks in File</div>
                        </div>
                        <div className="bg-background-primary rounded-lg p-3 text-center border border-border">
                          <div className="text-xl font-bold text-green-400">{importResult.stats?.matched || 0}</div>
                          <div className="text-[11px] text-text-muted">Matched</div>
                        </div>
                        <div className="bg-background-primary rounded-lg p-3 text-center border border-border">
                          <div className="text-xl font-bold text-orange-400">{importResult.stats?.unmatched || 0}</div>
                          <div className="text-[11px] text-text-muted">Not in Library</div>
                        </div>
                      </div>
                      {importResult.stats?.unmatched > 0 && (
                        <div className="text-[11px] text-text-muted bg-background-primary rounded-lg p-3 border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3 h-3 text-orange-400" />
                            <span className="font-medium text-orange-400">Unmatched Tracks</span>
                          </div>
                          <div className="space-y-0.5 max-h-32 overflow-auto">
                            {importResult.stats.unmatchedTracks?.map((t, i) => (
                              <div key={i} className="truncate text-text-secondary">• {t.title || t.filePath || 'Unknown'}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="text-sm text-text-primary">{importResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Batch Results */}
              {batchResults.length > 0 && !isImporting && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-text-primary">Batch Import Complete</span>
                  </div>
                  <div className="max-h-64 overflow-auto border border-border rounded-xl bg-background-primary">
                    {batchResults.map((job, idx) => (
                      <div
                        key={job.id || idx}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          idx !== batchResults.length - 1 ? 'border-b border-border' : ''
                        }`}
                      >
                        {job.status === 'complete' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-text-primary truncate">
                            {job.result?.playlist?.name || `Job ${idx + 1}`}
                          </div>
                          <div className="text-[11px] text-text-muted">
                            {job.status === 'complete'
                              ? `${job.result?.stats?.matched || 0} matched · ${job.result?.stats?.unmatched || 0} unmatched`
                              : job.error || 'Failed'
                            }
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DJSoftwareImportExport
