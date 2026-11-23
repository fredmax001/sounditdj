import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Sliders,
  ArrowRight,
  Disc,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react'
import {
  RekordboxIcon,
  SeratoIcon,
  EngineDjIcon,
  TraktorIcon,
  VirtualDjIcon,
  UsbStorageIcon,
} from '@components/icons/DjLogos'
import axios from '../config/axios'
import toast from 'react-hot-toast'

const PROFILES = [
  {
    id: 'rekordbox-usb',
    name: 'Pioneer CDJ / XDJ (Rekordbox)',
    icon: RekordboxIcon,
    desc: 'AlphaTheta / Pioneer hardware compatible. Writes export.pdb database & ANLZ beatgrid/cues.',
    compatibility: {
      audio: 'MP3, WAV, AIFF, FLAC, AAC',
      cues: 'Hot Cues (up to 8) & Memory Cues',
      loops: 'Saved loops & active loops',
      grids: 'Pioneer DAT/EXT beatgrid anchors',
      hardware: 'CDJ-3000, CDJ-2000NXS2, XDJ-XZ, XDJ-RX3, OPUS-QUAD, OMNIS-DUO',
    },
  },
  {
    id: 'engine-dj',
    name: 'Denon DJ (Engine OS)',
    icon: EngineDjIcon,
    desc: 'Engine DJ database structure compatible with Prime 4, SC6000, SC Live series.',
    compatibility: {
      audio: 'MP3, WAV, AIFF, FLAC, ALAC, OGG',
      cues: 'Hot Cues (up to 8)',
      loops: 'Saved loops',
      grids: 'Engine OS dynamic beatgrids',
      hardware: 'Denon Prime 4+, SC6000M, SC Live 2/4, Numark Mixstream',
    },
  },
  {
    id: 'serato',
    name: 'Serato DJ Pro',
    icon: SeratoIcon,
    desc: 'Writes _Serato_/Subcrates and track tags for Serato USB library reading.',
    compatibility: {
      audio: 'MP3, WAV, AIFF, FLAC, AAC, OGG',
      cues: 'Hot Cues (up to 8) with color codes',
      loops: 'Saved loops',
      grids: 'Serato beatgrid markers',
      hardware: 'All Serato DJ Pro & Lite controllers and DVS mixers',
    },
  },
  {
    id: 'traktor',
    name: 'Native Instruments Traktor',
    icon: TraktorIcon,
    desc: 'Generates Traktor NML collection file and playlist trees.',
    compatibility: {
      audio: 'MP3, WAV, AIFF, FLAC, AAC, OGG',
      cues: 'Hot Cues (up to 8) & Grid Cues',
      loops: 'Traktor loop markers',
      grids: 'Traktor beatgrid & autogrid',
      hardware: 'Traktor Kontrol S4/S3/S2, X1, Z2, Traktor Pro 3/4',
    },
  },
  {
    id: 'virtualdj',
    name: 'VirtualDJ',
    icon: VirtualDjIcon,
    desc: 'VirtualDJ library XML & M3U playlist format with performance tags.',
    compatibility: {
      audio: 'All standard formats',
      cues: 'Hot Cues & POI points',
      loops: 'Saved loops',
      grids: 'VirtualDJ 4/4 and dynamic grids',
      hardware: 'VirtualDJ laptop & supported standalone setups',
    },
  },
  {
    id: 'generic-usb',
    name: 'Universal Audio USB',
    icon: UsbStorageIcon,
    desc: 'Direct lossless/high-bitrate folder hierarchy for car stereos, media players & general USBs.',
    compatibility: {
      audio: 'Original file formats preserved',
      cues: 'Embedded ID3 cues where supported',
      loops: 'N/A',
      grids: 'N/A',
      hardware: 'Any USB-compatible media player or audio system',
    },
  },
]

export default function ExportToUsbModal({
  isOpen,
  onClose,
  tracks = [],
  playlist = null,
  devices = [],
  onStartExport,
}) {
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState('rekordbox-usb')
  const [folderStructure, setFolderStructure] = useState('artist-album')
  const [copyAudio, setCopyAudio] = useState(true)
  const [exportCues, setExportCues] = useState(true)
  const [exportBeatgrid, setExportBeatgrid] = useState(true)
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Default to first writable device
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const preferred = devices.find((d) => d.writable !== false) || devices[0]
      setSelectedDevice(preferred)
    }
  }, [devices, selectedDevice])

  // Calculate required disk space
  const totalRequiredBytes = useMemo(() => {
    return tracks.reduce((sum, t) => sum + (Number(t.fileSize) || Number(t.file_size) || 12 * 1024 * 1024), 0)
  }, [tracks])

  const formatSize = (bytes) => {
    const val = Number(bytes) || 0
    if (val <= 0) return '0 MB'
    const mb = val / (1024 * 1024)
    if (mb < 1000) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  const freeBytes = selectedDevice?.freeBytes || 0
  const hasEnoughSpace = freeBytes > totalRequiredBytes
  const currentProfileObj = PROFILES.find((p) => p.id === selectedProfile) || PROFILES[0]

  if (!isOpen) return null

  const handleExecuteExport = async () => {
    if (!selectedDevice) {
      toast.error('Please select a destination USB device')
      return
    }
    if (!hasEnoughSpace && freeBytes > 0) {
      toast.error('Destination device does not have enough free space')
      return
    }

    setIsExporting(true)
    try {
      // Desktop Electron local USB export (writes directly to the mounted USB drive!)
      if (window.electronAPI?.exportLocalUsb) {
        const res = await window.electronAPI.exportLocalUsb({
          target: selectedProfile,
          mountPoint: selectedDevice.mountPoint,
          tracks,
          playlists: playlist ? [playlist] : [],
          folders: [],
          options: {
            folderStructure,
            duplicatePolicy: overwriteDuplicates ? 'overwrite' : 'skip',
            copyAudio,
            exportCues,
            exportBeatgrid,
          },
        })
        if (res?.success) {
          toast.success(`Exported ${res.filesWritten || tracks.length} file(s) to ${selectedDevice.name}!`)
          onClose()
        } else {
          toast.error(res?.error || 'USB export failed')
        }
        return
      }

      const payload = {
        deviceId: selectedDevice.id,
        mountPoint: selectedDevice.mountPoint,
        profile: selectedProfile,
        trackIds: tracks.map((t) => t.id),
        playlistIds: playlist?.id ? [playlist.id] : [],
        options: {
          folderStructure,
          copyAudio,
          exportCues,
          exportBeatgrid,
          overwriteDuplicates,
        },
      }

      const res = await axios.post('/api/transfer/export', payload)
      const job = res.data?.job || res.data
      toast.success(`Export job queued for ${selectedDevice.name}!`)
      onStartExport?.(job)
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      toast.error(err.response?.data?.error || err.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background-secondary border border-border rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-primary/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-accent-dim flex items-center justify-center text-brand-accent">
              <UsbStorageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                Export to DJ USB / External Device
              </h2>
              <p className="text-xs text-text-muted">
                {playlist ? `Exporting playlist "${playlist.name}"` : `Exporting ${tracks.length} tracks`}
                {' · '}
                Estimated size: <span className="font-mono text-brand-accent">{formatSize(totalRequiredBytes)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-tertiary text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Destination Device */}
          <div>
            <label className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider block mb-2 flex items-center justify-between">
              <span>1. Destination USB Drive</span>
              <span className="text-text-muted text-[10px] font-normal">
                {devices.length} drive{devices.length === 1 ? '' : 's'} connected
              </span>
            </label>

            {devices.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-5 text-center bg-background-primary/40">
                <AlertTriangle className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-text-secondary">No USB Drives Detected</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Connect a FAT32, exFAT, or APFS formatted USB drive to export music.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {devices.map((device) => {
                  const isSelected = selectedDevice?.id === device.id
                  const isWritable = device.writable !== false

                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-accent bg-brand-accent-dim/40 shadow-sm'
                          : 'border-border bg-background-primary hover:border-border-light'
                      } ${!isWritable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <HardDrive className={`w-4 h-4 ${isSelected ? 'text-brand-accent' : 'text-text-muted'}`} />
                          <span className="text-xs font-semibold text-text-primary truncate max-w-[170px]">
                            {device.name || 'Removable Device'}
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-accent" />}
                      </div>

                      <div className="text-[11px] text-text-muted font-mono truncate">{device.mountPoint}</div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        <span className="text-text-secondary">
                          <span className="text-brand-accent font-medium">{device.free || formatSize(device.freeBytes)}</span> free
                        </span>
                        <span className="text-text-muted text-[10px] uppercase font-mono">
                          {device.filesystem || 'exFAT'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 2: Target DJ Profile */}
          <div>
            <label className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider block mb-2">
              2. Target DJ Hardware & Software Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROFILES.map((profile) => {
                const isSelected = selectedProfile === profile.id
                const Icon = profile.icon

                return (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-dim/40 shadow-sm'
                        : 'border-border bg-background-primary hover:border-border-light'
                    }`}
                  >
                    <div className={`p-2 rounded-md ${isSelected ? 'bg-brand-accent text-brand-primary' : 'bg-background-tertiary text-text-muted'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-text-primary flex items-center justify-between">
                        <span>{profile.name}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-brand-accent" />}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {profile.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step 3: Performance Metadata & Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Folder Organization */}
            <div className="p-4 rounded-lg bg-background-primary border border-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <FolderTree className="w-4 h-4 text-brand-tertiary" />
                <span>Folder Organization</span>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'artist-album', label: 'Artist / Album / Title.ext' },
                  { id: 'artist-title', label: 'Artist / Title.ext' },
                  { id: 'playlist', label: 'Playlist Name / Title.ext' },
                  { id: 'flat', label: 'Flat (Contents Root Folder)' },
                ].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary hover:text-text-primary">
                    <input
                      type="radio"
                      name="folderStructure"
                      checked={folderStructure === opt.id}
                      onChange={() => setFolderStructure(opt.id)}
                      className="accent-brand-accent"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Performance Metadata */}
            <div className="p-4 rounded-lg bg-background-primary border border-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Sliders className="w-4 h-4 text-brand-tertiary" />
                <span>Performance Data</span>
              </div>

              <div className="space-y-2 text-xs text-text-secondary">
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={exportCues}
                    onChange={(e) => setExportCues(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Hot Cues & Memory Cues</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={exportBeatgrid}
                    onChange={(e) => setExportBeatgrid(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Beatgrids & BPM Anchors</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={copyAudio}
                    onChange={(e) => setCopyAudio(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Copy Audio Files to USB</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={overwriteDuplicates}
                    onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Overwrite existing tracks</span>
                </label>
              </div>
            </div>
          </div>

          {/* Compatibility Breakdown Card */}
          <div className="p-4 rounded-lg bg-background-tertiary/40 border border-border/80">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-text-primary">
              <Info className="w-3.5 h-3.5 text-brand-sky" />
              <span>Compatibility Breakdown ({currentProfileObj.name})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-text-muted block text-[10px] uppercase">Audio</span>
                <span className="text-text-secondary">{currentProfileObj.compatibility.audio}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase">Cues</span>
                <span className="text-text-secondary">{currentProfileObj.compatibility.cues}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase">Loops & Grid</span>
                <span className="text-text-secondary">{currentProfileObj.compatibility.grids}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase">Hardware</span>
                <span className="text-text-secondary">{currentProfileObj.compatibility.hardware}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background-primary/50 flex items-center justify-between">
          <div className="text-xs">
            {selectedDevice && !hasEnoughSpace ? (
              <span className="text-red-400 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Insufficient space on {selectedDevice.name} (Need {formatSize(totalRequiredBytes)})
              </span>
            ) : selectedDevice ? (
              <span className="text-green-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready to transfer {tracks.length} track{tracks.length === 1 ? '' : 's'} ({formatSize(totalRequiredBytes)})
              </span>
            ) : (
              <span className="text-text-muted">Select a destination device to continue</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-medium rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteExport}
              disabled={!selectedDevice || !hasEnoughSpace || isExporting}
              className={`px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                !selectedDevice || !hasEnoughSpace || isExporting
                  ? 'bg-brand-accent/30 text-brand-primary/50 cursor-not-allowed'
                  : 'bg-brand-accent hover:bg-brand-accent-hover text-brand-primary shadow-md hover:shadow-lg'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  <span>Preparing Export...</span>
                </>
              ) : (
                <>
                  <span>Export to USB</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
