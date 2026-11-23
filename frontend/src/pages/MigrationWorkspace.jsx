import React, { useEffect, useMemo, useState } from 'react'
import axios from '../config/axios.js'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Disc3,
  Download,
  FileJson,
  FolderOpen,
  HardDrive,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  Usb,
} from 'lucide-react'

const SECTIONS = [
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'devices', label: 'Devices', icon: Usb },
  { id: 'converter', label: 'Library Converter', icon: ArrowRightLeft },
  { id: 'history', label: 'Transfer History', icon: History },
  { id: 'reports', label: 'Compatibility Reports', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Database },
]

const EXPORT_TARGETS = [
  { id: 'rekordbox-usb', label: 'Rekordbox USB (CDJ/XDJ)', device: true },
  { id: 'generic-usb', label: 'General audio USB', device: true },
  { id: 'rekordbox-xml', label: 'Rekordbox XML', device: false },
  { id: 'serato', label: 'Serato crates', device: false },
  { id: 'virtualdj', label: 'VirtualDJ XML', device: false },
  { id: 'm3u', label: 'M3U playlist', device: false },
  { id: 'csv', label: 'CSV', device: false },
  { id: 'json', label: 'Sound It DJ JSON', device: false },
]

function Stat({ label, value }) {
  return (
    <div className="bg-background-primary border border-border rounded-lg p-3">
      <div className="text-[11px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-text-primary mt-1">{value ?? '—'}</div>
    </div>
  )
}

function JsonBox({ data }) {
  if (!data) return null
  return (
    <pre className="text-[11px] leading-relaxed bg-background-primary border border-border rounded-lg p-3 overflow-auto max-h-72 text-text-secondary">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function MigrationWorkspace() {
  const [section, setSection] = useState('import')
  const [formats, setFormats] = useState(null)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [importPath, setImportPath] = useState('')
  const [importPreview, setImportPreview] = useState(null)
  const [importJob, setImportJob] = useState(null)
  const [importing, setImporting] = useState(false)

  const [exportTarget, setExportTarget] = useState('rekordbox-usb')
  const [exportPreview, setExportPreview] = useState(null)
  const [exportJob, setExportJob] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [folderStructure, setFolderStructure] = useState('artist-title')
  const [backupFirst, setBackupFirst] = useState(true)

  const [convertPath, setConvertPath] = useState('')
  const [convertTarget, setConvertTarget] = useState('rekordbox-xml')
  const [convertResult, setConvertResult] = useState(null)

  const [jobs, setJobs] = useState([])
  const [reports, setReports] = useState([])
  const [compatibility, setCompatibility] = useState(null)

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId || d.mountPoint === selectedDeviceId) || null
  const exportNeedsDevice = ['rekordbox-usb', 'generic-usb'].includes(exportTarget)

  const loadFormats = async () => {
    try {
      const { data } = await axios.get('/api/transfer/formats')
      setFormats(data)
    } catch (e) {
      // non-fatal
    }
  }

  const loadDevices = async () => {
    setLoadingDevices(true)
    try {
      if (window.electronAPI?.getUsbDevices) {
        const list = await window.electronAPI.getUsbDevices()
        setDevices(Array.isArray(list) ? list : [])
      } else {
        const { data } = await axios.get('/api/transfer/devices')
        setDevices(data.devices || [])
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoadingDevices(false)
    }
  }

  const loadHistory = async () => {
    try {
      const [{ data: jobsData }, { data: reportsData }] = await Promise.all([
        axios.get('/api/transfer/jobs'),
        axios.get('/api/transfer/reports'),
      ])
      setJobs(jobsData.jobs || [])
      setReports(reportsData.reports || [])
    } catch (e) {
      // ignore
    }
  }

  const loadCompatibility = async () => {
    try {
      const { data } = await axios.get('/api/transfer/compatibility')
      setCompatibility(data)
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    loadFormats()
    loadDevices()
    loadHistory()
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onUsbDevicesChanged) return
    return window.electronAPI.onUsbDevicesChanged(({ devices: next }) => {
      if (Array.isArray(next)) setDevices(next)
    })
  }, [])

  useEffect(() => {
    if (!importJob?.id || !['running', 'pending'].includes(importJob.status)) return
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/transfer/jobs/${importJob.id}`)
        setImportJob(data)
        if (['completed', 'error', 'cancelled'].includes(data.status)) {
          setImporting(false)
          loadHistory()
        }
      } catch {}
    }, 1200)
    return () => clearInterval(t)
  }, [importJob?.id, importJob?.status])

  useEffect(() => {
    if (!exportJob?.id || !['running', 'pending'].includes(exportJob.status)) return
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/transfer/jobs/${exportJob.id}`)
        setExportJob(data)
        if (['completed', 'error', 'cancelled'].includes(data.status)) {
          setExporting(false)
          loadHistory()
          loadDevices()
        }
      } catch {}
    }, 1200)
    return () => clearInterval(t)
  }, [exportJob?.id, exportJob?.status])

  const pickPath = async () => {
    if (window.electronAPI?.selectDirectory) {
      const dir = await window.electronAPI.selectDirectory()
      if (dir) return dir
    }
    if (window.electronAPI?.selectFiles) {
      const files = await window.electronAPI.selectFiles()
      if (files?.[0]) return files[0]
    }
    return null
  }

  const doImportPreview = async () => {
    if (!importPath) return
    setError(null)
    setNotice(null)
    try {
      const { data } = await axios.post('/api/transfer/import/preview', { path: importPath })
      setImportPreview(data)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  const doImport = async () => {
    if (!importPath) return
    setError(null)
    setImporting(true)
    try {
      const { data } = await axios.post('/api/transfer/import', { path: importPath })
      setImportJob({ id: data.jobId, status: 'running' })
      setNotice('Import started. Source libraries are never modified.')
    } catch (e) {
      setImporting(false)
      setError(e.response?.data?.error || e.message)
    }
  }

  const doExportPreview = async () => {
    setError(null)
    if (exportNeedsDevice && !selectedDevice?.mountPoint) {
      setError('Select a mounted device first.')
      return
    }
    try {
      const { data } = await axios.post('/api/transfer/export/preview', {
        profile: exportTarget,
        target: exportTarget,
        mountPoint: selectedDevice?.mountPoint,
        folderStructure,
      })
      setExportPreview(data)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  const doExport = async () => {
    setError(null)
    if (exportNeedsDevice && !selectedDevice?.mountPoint) {
      setError('Select a mounted device first.')
      return
    }
    setExporting(true)
    try {
      const { data } = await axios.post('/api/transfer/export', {
        profile: exportTarget,
        target: exportTarget,
        mountPoint: selectedDevice?.mountPoint,
        folderStructure,
        backup: backupFirst,
      })
      setExportJob({ id: data.jobId, status: 'running' })
      setNotice('Export started. Structural validation runs after writing; hardware playback is not verified automatically.')
    } catch (e) {
      setExporting(false)
      setError(e.response?.data?.error || e.message)
    }
  }

  const doConvert = async () => {
    if (!convertPath) return
    setError(null)
    try {
      const { data } = await axios.post('/api/transfer/convert', { path: convertPath, target: convertTarget })
      setConvertResult(data)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  const doBackup = async () => {
    try {
      const { data } = await axios.post('/api/transfer/backup', { label: 'manual' })
      setNotice(`Backup created: ${data.path} (${data.sizeLabel || ''})`)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="h-full flex bg-background-primary">
      <div className="w-64 border-r border-border bg-background-secondary p-3 space-y-1">
        <div className="px-2 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Migration</div>
        {SECTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => {
                setSection(item.id)
                setError(null)
                if (item.id === 'history') loadHistory()
                if (item.id === 'reports') loadCompatibility()
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                section === item.id
                  ? 'bg-brand-accent/10 text-brand-accent'
                  : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
        <div className="mt-4 px-2 text-[11px] text-text-muted leading-relaxed">
          Operations are non-destructive. Source libraries are not modified unless you explicitly choose a write target.
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Library Migration</h1>
            <p className="text-sm text-text-muted mt-1">
              Import, convert, export and verify DJ libraries with performance metadata preserved where supported.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-200 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{notice}</div>
            </div>
          )}

          {section === 'import' && (
            <div className="space-y-4">
              <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
                <label className="text-[11px] text-text-muted uppercase tracking-wider">Library file or folder</label>
                <div className="flex gap-2">
                  <input
                    value={importPath}
                    onChange={(e) => setImportPath(e.target.value)}
                    placeholder="Path to Serato folder, Rekordbox XML, VirtualDJ database, Apple Music XML, M3U/CSV/JSON, NML..."
                    className="flex-1 bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary"
                  />
                  <button onClick={async () => { const p = await pickPath(); if (p) setImportPath(p) }} className="px-3 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary">
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={doImportPreview} className="px-4 py-2 bg-background-tertiary rounded-lg text-sm text-text-primary">Preview</button>
                  <button onClick={doImport} disabled={importing || !importPath} className="px-4 py-2 bg-brand-accent text-brand-primary rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
                  </button>
                </div>
                <div className="text-[12px] text-text-muted">
                  Supported: Serato database/crates, Rekordbox XML, Rekordbox USB (inspection/export target), VirtualDJ XML, Apple Music/iTunes XML, Traktor NML, M3U, CSV, JSON, folders. Rekordbox local encrypted master.db is not imported directly.
                </div>
              </div>
              {importPreview && (
                <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Tracks" value={importPreview.summary?.tracks} />
                    <Stat label="Playlists" value={importPreview.summary?.playlists} />
                    <Stat label="Cues" value={importPreview.summary?.cues} />
                    <Stat label="Missing files" value={importPreview.summary?.missingFiles} />
                  </div>
                  <JsonBox data={importPreview.compatibility} />
                  {importPreview.warnings?.length > 0 && <JsonBox data={{ warnings: importPreview.warnings, unsupported: importPreview.unsupported }} />}
                </div>
              )}
              {importJob && <div className="bg-background-secondary border border-border rounded-xl p-5"><JsonBox data={importJob} /></div>}
            </div>
          )}

          {section === 'export' && (
            <div className="space-y-4">
              <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-text-muted uppercase tracking-wider">Target</label>
                    <select value={exportTarget} onChange={(e) => setExportTarget(e.target.value)} className="mt-2 w-full bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary">
                      {EXPORT_TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted uppercase tracking-wider">Device</label>
                    <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} disabled={!exportNeedsDevice} className="mt-2 w-full bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary disabled:opacity-50">
                      <option value="">Select mounted device...</option>
                      {devices.map((d) => <option key={d.id || d.mountPoint} value={d.id || d.mountPoint}>{d.name} — {d.mountPoint} ({d.free || d.size || 'unknown'})</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-text-muted uppercase tracking-wider">Folder structure</label>
                    <select value={folderStructure} onChange={(e) => setFolderStructure(e.target.value)} className="mt-2 w-full bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary">
                      <option value="artist-title">Artist / Title</option>
                      <option value="artist-album-title">Artist / Album / Title</option>
                      <option value="flat">Flat</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary mt-6">
                    <input type="checkbox" checked={backupFirst} onChange={(e) => setBackupFirst(e.target.checked)} />
                    Move existing PIONEER export into a backup folder before writing
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={loadDevices} className="px-3 py-2 border border-border rounded-lg text-text-secondary"><RefreshCw className={`w-4 h-4 ${loadingDevices ? 'animate-spin' : ''}`} /></button>
                  <button onClick={doExportPreview} className="px-4 py-2 bg-background-tertiary rounded-lg text-sm text-text-primary">Preview / Validate</button>
                  <button onClick={doExport} disabled={exporting} className="px-4 py-2 bg-brand-accent text-brand-primary rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export
                  </button>
                </div>
                <div className="text-[12px] text-text-muted">
                  Pioneer USB export writes PDB + ANLZ and is self-validated after writing. Physical CDJ/XDJ acceptance cannot be confirmed without hardware in this environment.
                </div>
              </div>
              {exportPreview && (
                <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Ready tracks" value={exportPreview.plan?.counts?.ready} />
                    <Stat label="Skipped" value={exportPreview.plan?.counts?.skipped} />
                    <Stat label="Required" value={exportPreview.plan?.required} />
                    <Stat label="Free" value={exportPreview.plan?.free} />
                  </div>
                  <JsonBox data={exportPreview.compatibility} />
                  <JsonBox data={exportPreview.plan} />
                </div>
              )}
              {exportJob && <div className="bg-background-secondary border border-border rounded-xl p-5"><JsonBox data={exportJob} /></div>}
            </div>
          )}

          {section === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={loadDevices} className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${loadingDevices ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <div className="grid gap-3">
                {devices.length === 0 && <div className="text-sm text-text-muted">No mounted removable/USB devices detected.</div>}
                {devices.map((device) => (
                  <div key={device.id || device.mountPoint} className="bg-background-secondary border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-text-primary font-medium"><HardDrive className="w-4 h-4 text-brand-accent" />{device.name}</div>
                        <div className="text-sm text-text-muted mt-1">{device.mountPoint}</div>
                        <div className="text-[12px] text-text-muted mt-1">{device.filesystem || 'unknown fs'} · {device.free || '—'} free / {device.size || device.total || '—'} · {device.status || 'mounted'} · writable: {String(device.writable)}</div>
                        {device.library?.detected?.length > 0 && <div className="text-[12px] text-brand-accent mt-2">Detected: {device.library.detected.join(', ')}</div>}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await axios.post(`/api/transfer/devices/${encodeURIComponent(device.id || device.mountPoint)}/eject`)
                            setNotice(`Ejected ${device.name}`)
                            loadDevices()
                          } catch (e) { setError(e.response?.data?.error || e.message) }
                        }}
                        className="px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary"
                      >
                        Eject
                      </button>
                    </div>
                    {device.library?.markers?.length > 0 && <div className="mt-3"><JsonBox data={device.library} /></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'converter' && (
            <div className="space-y-4">
              <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
                <label className="text-[11px] text-text-muted uppercase tracking-wider">Source library path</label>
                <div className="flex gap-2">
                  <input value={convertPath} onChange={(e) => setConvertPath(e.target.value)} className="flex-1 bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary" placeholder="Source file/folder to convert" />
                  <button onClick={async () => { const p = await pickPath(); if (p) setConvertPath(p) }} className="px-3 py-2 border border-border rounded-lg text-text-secondary"><FolderOpen className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider">Target format</label>
                  <select value={convertTarget} onChange={(e) => setConvertTarget(e.target.value)} className="mt-2 w-full bg-background-primary border border-border rounded-lg px-3 py-2.5 text-[13px] text-text-primary">
                    <option value="rekordbox-xml">Rekordbox XML</option>
                    <option value="virtualdj">VirtualDJ XML</option>
                    <option value="serato">Serato crates</option>
                    <option value="m3u">M3U</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <button onClick={doConvert} className="px-4 py-2 bg-brand-accent text-brand-primary rounded-lg text-sm font-medium flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Convert</button>
                <div className="text-[12px] text-text-muted">Conversion uses the normalized model and reports unsupported/lost data. Audio files are not rewritten.</div>
              </div>
              {convertResult && <div className="bg-background-secondary border border-border rounded-xl p-5"><JsonBox data={convertResult} /></div>}
            </div>
          )}

          {section === 'history' && (
            <div className="space-y-4">
              <button onClick={loadHistory} className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
              <div className="grid gap-3">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-background-secondary border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-text-primary">{job.kind} → {job.target || job.source || '—'}</div>
                      <div className="text-xs text-text-muted">{job.status} · {job.stage || ''}</div>
                    </div>
                    <div className="text-[12px] text-text-muted mt-1">{job.createdAt || job.created_at}</div>
                    {job.error && <div className="text-sm text-red-300 mt-2">{job.error}</div>}
                    <div className="mt-3"><JsonBox data={job} /></div>
                  </div>
                ))}
                {jobs.length === 0 && <div className="text-sm text-text-muted">No migration jobs yet.</div>}
              </div>
            </div>
          )}

          {section === 'reports' && (
            <div className="space-y-4">
              <button onClick={loadCompatibility} className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Refresh compatibility</button>
              {compatibility && <div className="bg-background-secondary border border-border rounded-xl p-5"><JsonBox data={compatibility} /></div>}
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-primary mb-3">Recent transfer reports</h3>
                <JsonBox data={reports} />
              </div>
            </div>
          )}

          {section === 'settings' && (
            <div className="space-y-4">
              <div className="bg-background-secondary border border-border rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-medium text-text-primary">Safety & backups</h3>
                <button onClick={doBackup} className="px-4 py-2 bg-background-tertiary rounded-lg text-sm text-text-primary">Create database backup</button>
                <div className="text-[12px] text-text-muted">Backups copy the local Sound It DJ database; they do not modify source DJ libraries.</div>
              </div>
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-primary mb-2">Known limitations</h3>
                <ul className="text-sm text-text-secondary space-y-1 list-disc pl-5">
                  <li>Rekordbox master.db is encrypted and cannot be read directly; import Rekordbox XML or a USB export.</li>
                  <li>Pioneer USB PDB/ANLZ output is structurally validated but not verified on physical CDJ/XDJ hardware in this environment.</li>
                  <li>Apple Music/iTunes XML cannot represent DJ cues, loops or beatgrids. Streaming/DRM tracks cannot be exported as audio.</li>
                  <li>Serato performance data is written only to exported audio copies/tags when that export path is used.</li>
                </ul>
              </div>
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-primary mb-3">Detected capabilities</h3>
                <JsonBox data={formats} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
