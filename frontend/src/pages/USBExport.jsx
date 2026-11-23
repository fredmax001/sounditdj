import React, { useState, useEffect } from 'react'
import {
  Usb,
  HardDrive,
  Music,
  Check,
  RefreshCw,
  Folder,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  RekordboxIcon,
  SeratoIcon,
  EngineDjIcon,
  TraktorIcon,
  VirtualDjIcon,
  UsbStorageIcon,
} from '@components/icons/DjLogos'
import useLibraryStore from '@store/libraryStore'
import TransferProgressDrawer from '@components/TransferProgressDrawer'
import axios from '../config/axios'
import toast from 'react-hot-toast'

const EXPORT_PROFILES = [
  {
    id: 'rekordbox-usb',
    name: 'Pioneer CDJ / XDJ (Rekordbox)',
    icon: RekordboxIcon,
    desc: 'AlphaTheta / Pioneer hardware compatible. Writes export.pdb DeviceSQL & ANLZ beatgrids/cues.',
    hardware: 'CDJ-3000, 2000NXS2, XDJ-XZ, RX3, OPUS-QUAD, OMNIS-DUO',
  },
  {
    id: 'engine-dj',
    name: 'Denon DJ (Engine OS)',
    icon: EngineDjIcon,
    desc: 'Engine DJ database structure compatible with Prime 4, SC6000, and SC Live series.',
    hardware: 'Prime 4+, SC6000M, SC Live 2/4, Numark Mixstream',
  },
  {
    id: 'serato',
    name: 'Serato DJ Pro',
    icon: SeratoIcon,
    desc: 'Generates _Serato_/Subcrates directory and track performance tags for Serato USB reading.',
    hardware: 'Serato DJ Pro / Lite controllers & DVS mixers',
  },
  {
    id: 'traktor',
    name: 'Native Instruments Traktor',
    icon: TraktorIcon,
    desc: 'Generates Traktor NML collection file and playlist trees with hot cues & beatgrid.',
    hardware: 'Traktor Kontrol S4/S3/S2, X1, Z2, Traktor Pro 3/4',
  },
  {
    id: 'virtualdj',
    name: 'VirtualDJ',
    icon: VirtualDjIcon,
    desc: 'VirtualDJ library XML & M3U playlist format with performance POI points.',
    hardware: 'VirtualDJ laptop & supported standalone setups',
  },
  {
    id: 'generic-usb',
    name: 'Universal Audio USB',
    icon: UsbStorageIcon,
    desc: 'Organized audio folder hierarchy for car stereos, media players & general USBs.',
    hardware: 'All standard USB audio players & media systems',
  },
]

export default function USBExport() {
  const {
    connectedDevices,
    fetchConnectedDevices,
    playlists,
    fetchPlaylists,
    tracks,
    fetchTracks,
  } = useLibraryStore()

  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState('rekordbox-usb')
  const [selectedPlaylists, setSelectedPlaylists] = useState([])
  const [exportAllTracks, setExportAllTracks] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeJob, setActiveJob] = useState(null)

  // Performance options
  const [copyAudio, setCopyAudio] = useState(true)
  const [exportCues, setExportCues] = useState(true)
  const [exportBeatgrid, setExportBeatgrid] = useState(true)
  const [folderStructure, setFolderStructure] = useState('artist-album')

  useEffect(() => {
    fetchConnectedDevices()
    fetchPlaylists()
    if (!tracks.length) fetchTracks()
  }, [])

  useEffect(() => {
    if (connectedDevices.length > 0 && !selectedDevice) {
      setSelectedDevice(connectedDevices[0])
    }
  }, [connectedDevices])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const devices = await fetchConnectedDevices()
      if (devices.length === 0) {
        toast('No USB drives detected. Connect a drive and retry.', { icon: 'ℹ️' })
      } else {
        toast.success(`Found ${devices.length} drive${devices.length === 1 ? '' : 's'}`)
      }
    } catch {
      toast.error('Failed to scan USB devices')
    } finally {
      setIsScanning(false)
    }
  }

  const togglePlaylist = (id) => {
    setSelectedPlaylists((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleStartExport = async () => {
    if (!selectedDevice) {
      toast.error('Please select a destination USB drive')
      return
    }
    if (!exportAllTracks && selectedPlaylists.length === 0) {
      toast.error('Select at least one playlist or choose "Export Entire Collection"')
      return
    }

    setIsExporting(true)
    try {
      if (window.electronAPI?.exportLocalUsb) {
        const chosenPlaylists = exportAllTracks
          ? playlists
          : playlists.filter((p) => selectedPlaylists.includes(p.id))
        const neededIds = new Set()
        for (const pl of chosenPlaylists) {
          for (const tid of pl.trackIds || []) neededIds.add(String(tid))
        }
        const chosenTracks = exportAllTracks || neededIds.size === 0
          ? tracks
          : tracks.filter((t) => neededIds.has(String(t.id)))

        const res = await window.electronAPI.exportLocalUsb({
          target: selectedProfile,
          mountPoint: selectedDevice.mountPoint,
          tracks: chosenTracks,
          playlists: chosenPlaylists,
          folders: [],
          options: {
            folderStructure,
            copyAudio,
            exportCues,
            exportBeatgrid,
          },
        })
        if (res?.success) {
          toast.success(`Exported ${res.filesWritten || chosenTracks.length} file(s) to ${selectedDevice.name}!`)
        } else {
          toast.error(res?.error || 'USB export failed')
        }
        return
      }

      const payload = {
        deviceId: selectedDevice.id,
        mountPoint: selectedDevice.mountPoint,
        profile: selectedProfile,
        trackIds: exportAllTracks ? tracks.map((t) => t.id) : [],
        playlistIds: exportAllTracks ? [] : selectedPlaylists,
        options: {
          folderStructure,
          copyAudio,
          exportCues,
          exportBeatgrid,
        },
      }

      const res = await axios.post('/api/transfer/export', payload)
      const job = res.data?.job || res.data
      setActiveJob(job)
      toast.success(`Export queued for ${selectedDevice.name}!`)
    } catch (err) {
      console.error('Export error:', err)
      toast.error(err.response?.data?.error || err.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full bg-background-primary flex flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-accent-dim flex items-center justify-center text-brand-accent">
            <Usb className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-wide">
              USB EXPORT ENGINE
            </h1>
            <p className="text-xs text-text-secondary">
              Transfer playlists and music collections directly to DJ-compatible external media.
            </p>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-3.5 py-1.5 bg-background-secondary hover:bg-background-tertiary border border-border text-text-primary rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-brand-accent' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Refresh Devices'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left: Device Selection & Playlist Selection */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 1: USB Destination */}
          <div className="bg-background-secondary border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>1. Destination Drive</span>
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {connectedDevices.length} available
              </span>
            </div>

            {connectedDevices.length === 0 ? (
              <div className="py-6 px-4 bg-background-primary/50 border border-dashed border-border rounded-lg text-center">
                <Usb className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-text-secondary">No External Drives Detected</p>
                <p className="text-[11px] text-text-muted mt-1 max-w-xs mx-auto">
                  Plug in an eligible FAT32, exFAT, or APFS formatted USB flash drive or SSD.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {connectedDevices.map((device) => {
                  const isSelected = selectedDevice?.id === device.id
                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-brand-accent bg-brand-accent-dim text-text-primary shadow-xs'
                          : 'border-border/60 bg-background-primary/60 hover:bg-background-tertiary text-text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <HardDrive className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-accent' : 'text-text-muted'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{device.name}</p>
                          <p className="text-[10px] text-text-muted font-mono">
                            {device.mountPoint} · {device.free || 'Ready'} free
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-brand-accent shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 2: Playlists to Export */}
          <div className="bg-background-secondary border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" />
                <span>2. Content to Export</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportAllTracks}
                  onChange={(e) => setExportAllTracks(e.target.checked)}
                  className="rounded accent-brand-accent"
                />
                <span className="text-[11px]">All Collection Tracks ({tracks.length})</span>
              </label>
            </div>

            {!exportAllTracks && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {playlists.length === 0 ? (
                  <p className="text-xs text-text-muted py-4 text-center">No playlists found in library</p>
                ) : (
                  playlists.map((pl) => {
                    const isChecked = selectedPlaylists.includes(pl.id)
                    return (
                      <div
                        key={pl.id}
                        onClick={() => togglePlaylist(pl.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isChecked
                            ? 'border-brand-accent/70 bg-brand-accent-dim/60 text-text-primary'
                            : 'border-border/40 bg-background-primary/40 hover:bg-background-tertiary text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Folder className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-brand-accent' : 'text-text-muted'}`} />
                          <span className="truncate">{pl.name}</span>
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">
                          {pl.trackCount ?? pl.track_count ?? 0} tracks
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Target Ecosystem Profile & Advanced Options */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Hardware Profile */}
          <div className="bg-background-secondary border border-border rounded-xl p-4">
            <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider block mb-3">
              3. Target DJ Ecosystem Profile
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {EXPORT_PROFILES.map((profile) => {
                const isSelected = selectedProfile === profile.id
                const Icon = profile.icon

                return (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-dim/50 shadow-xs'
                        : 'border-border/60 bg-background-primary/60 hover:bg-background-tertiary'
                    }`}
                  >
                    <div className={`p-2 rounded-md shrink-0 ${isSelected ? 'bg-brand-accent text-brand-primary' : 'bg-background-tertiary text-text-muted'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-primary">{profile.name}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-brand-accent" />}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {profile.desc}
                      </p>
                      <p className="text-[10px] text-brand-sky/80 mt-1 truncate">
                        Hardware: {profile.hardware}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Performance & File Options */}
          <div className="bg-background-secondary border border-border rounded-xl p-4">
            <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wider block mb-3">
              4. Transfer & Performance Options
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 text-xs text-text-secondary">
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
                    checked={exportCues}
                    onChange={(e) => setExportCues(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Export Hot Cues & Memory Cues</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={exportBeatgrid}
                    onChange={(e) => setExportBeatgrid(e.target.checked)}
                    className="rounded accent-brand-accent"
                  />
                  <span>Export Beatgrid & BPM Anchors</span>
                </label>
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-mono block mb-1.5">
                  Folder Structure
                </label>
                <select
                  value={folderStructure}
                  onChange={(e) => setFolderStructure(e.target.value)}
                  className="w-full bg-background-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                >
                  <option value="artist-album">Artist / Album / Title.ext</option>
                  <option value="artist-title">Artist / Title.ext</option>
                  <option value="playlist">Playlist Name / Title.ext</option>
                  <option value="flat">Flat (Contents Root)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-text-muted">
              {selectedDevice ? (
                <span className="text-text-secondary">
                  Ready to export to <span className="text-brand-accent font-medium">{selectedDevice.name}</span>
                </span>
              ) : (
                <span>Select a destination drive to begin</span>
              )}
            </div>

            <button
              onClick={handleStartExport}
              disabled={isExporting || !selectedDevice || (!exportAllTracks && selectedPlaylists.length === 0)}
              className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-xs font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Starting Export...' : 'Start USB Transfer'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Drawer */}
      {activeJob && (
        <TransferProgressDrawer
          job={activeJob}
          onDismiss={() => setActiveJob(null)}
        />
      )}
    </div>
  )
}
