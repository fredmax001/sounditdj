import React, { useState, useMemo } from 'react'
import {
  FileX,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Music,
  FolderSearch,
  HardDrive,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useLibraryStore from '@store/libraryStore'

export default function MissingTracks() {
  const {
    tracks,
    deleteTrack,
    fetchMissingFiles,
    relocateMissingFromFolder,
  } = useLibraryStore()

  const [isScanning, setIsScanning] = useState(false)
  const [isRelocating, setIsRelocating] = useState(false)
  const [lastSummary, setLastSummary] = useState(null)

  const missingTracks = useMemo(
    () => (Array.isArray(tracks) ? tracks.filter((t) => Boolean(t?.missing)) : []),
    [tracks],
  )

  const handleAutoRecheck = async () => {
    setIsScanning(true)
    setLastSummary(null)
    try {
      const res = await fetchMissingFiles()
      const relinked = res?.relinkedCount || 0
      const remaining = Array.isArray(res?.missing) ? res.missing.length : 0
      setLastSummary({
        type: 'recheck',
        relinked,
        remaining,
      })
      if (relinked > 0) {
        toast.success(`Auto-relinked ${relinked} track(s) from connected drives!`)
      } else if (remaining === 0) {
        toast.success('All tracks verified on disk!')
      } else {
        toast(`${remaining} track(s) still missing — use "Search Folder to Relocate" to find them.`)
      }
    } catch (err) {
      toast.error(err.message || 'Library scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const handleRelocateFromFolder = async () => {
    if (!window.electronAPI?.selectDirectory) {
      toast.error('Folder search is available in the Sound It DJ desktop app.')
      return
    }
    const dir = await window.electronAPI.selectDirectory('/Volumes')
    if (!dir) return

    setIsRelocating(true)
    setLastSummary(null)
    try {
      const res = await relocateMissingFromFolder(dir)
      if (res?.success) {
        setLastSummary({
          type: 'relocate',
          searchDir: dir,
          relinked: res.relinkedCount || 0,
          remaining: res.stillMissingCount || 0,
          indexedFiles: res.indexedFiles || 0,
        })
        if (res.relinkedCount > 0) {
          toast.success(`Relocated ${res.relinkedCount} missing track(s) from ${dir}!`)
        } else {
          toast(`Scanned ${res.indexedFiles || 0} audio files in folder — no matching filenames found.`)
        }
      } else {
        toast.error(res?.error || 'Relocation failed')
      }
    } catch (err) {
      toast.error(err.message || 'Relocation failed')
    } finally {
      setIsRelocating(false)
    }
  }

  const handleDeleteOne = async (track) => {
    await deleteTrack(track.id)
    toast.success(`Removed "${track.title || track.filename}"`)
  }

  const handleDeleteAll = async () => {
    if (!missingTracks.length) return
    if (!window.confirm(`Remove all ${missingTracks.length} missing tracks from your library?`)) return
    for (const track of missingTracks) {
      await deleteTrack(track.id)
    }
    toast.success(`Removed ${missingTracks.length} missing tracks`)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '--'
    const d = new Date(dateString)
    return Number.isNaN(d.getTime()) ? '--' : d.toLocaleDateString()
  }

  return (
    <div className="h-full p-6 overflow-auto bg-background-primary">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header & Primary Actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent-dim border border-brand-accent/30 flex items-center justify-center">
              <FileX className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary uppercase tracking-wide">
                Missing Tracks & Relocation
              </h1>
              <p className="text-xs text-text-secondary">
                Auto-detect tracks on connected drives (e.g. LaCie / external USB) or search any folder to relink moved files.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAutoRecheck}
              disabled={isScanning || isRelocating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-50 text-brand-primary text-xs font-bold uppercase tracking-wider transition-colors"
            >
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
              <span>{isScanning ? 'Scanning Drives...' : 'Auto-Scan Drives'}</span>
            </button>

            <button
              onClick={handleRelocateFromFolder}
              disabled={isScanning || isRelocating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-brand-sky/40 text-brand-sky text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isRelocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />}
              <span>{isRelocating ? 'Searching Folder...' : 'Search Folder to Relocate'}</span>
            </button>
          </div>
        </div>

        {/* Summary Banner after Scan / Relocate */}
        {lastSummary && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-emerald-200">
              {lastSummary.type === 'relocate' ? (
                <>
                  Searched <span className="font-mono text-brand-accent">{lastSummary.searchDir}</span> ({lastSummary.indexedFiles} audio files indexed):{' '}
                  <strong className="text-emerald-300">{lastSummary.relinked} track(s) relocated</strong>, {lastSummary.remaining} still missing.
                </>
              ) : (
                <>
                  Drive check complete: <strong className="text-emerald-300">{lastSummary.relinked} track(s) auto-relinked</strong>, {lastSummary.remaining} missing.
                </>
              )}
            </div>
          </div>
        )}

        {/* Missing Tracks List or All Found State */}
        {missingTracks.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-xl p-12 text-center">
            <CheckCircle2 className="w-11 h-11 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-text-primary mb-1">All Files Found</h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto mb-5">
              All {Array.isArray(tracks) ? tracks.length : 0} tracks in your library have valid audio file links. Click &ldquo;Auto-Scan Drives&rdquo; anytime to re-verify your collection on disk.
            </p>
            <button
              onClick={handleAutoRecheck}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border text-xs font-medium text-text-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Re-Check Library Now</span>
            </button>
          </div>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {missingTracks.length} missing file{missingTracks.length !== 1 ? 's' : ''} detected
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    If your music is on an external drive (e.g. LaCie), connect it and click &ldquo;Auto-Scan Drives&rdquo; or &ldquo;Search Folder to Relocate&rdquo;.
                  </div>
                </div>
              </div>
              <button
                onClick={handleDeleteAll}
                className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors"
              >
                Remove All ({missingTracks.length})
              </button>
            </div>

            <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
              <div className="max-h-[480px] overflow-auto divide-y divide-border/40">
                {missingTracks.slice(0, 500).map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-background-tertiary/60 transition-colors"
                  >
                    <div className="w-9 h-9 bg-background-primary rounded overflow-hidden flex items-center justify-center shrink-0 border border-border/50">
                      <Music className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text-primary truncate">
                        {track.title || track.original_name || track.filename || 'Unknown Track'}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate">
                        {track.artist || 'Unknown Artist'}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300/90 mt-0.5 truncate">
                        {track.path || 'No stored path'}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-text-muted shrink-0">
                      {formatDate(track.created_at || track.createdAt)}
                    </div>
                    <button
                      onClick={() => handleDeleteOne(track)}
                      title="Remove from library"
                      className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {missingTracks.length > 500 && (
                  <div className="px-4 py-3 text-center text-xs text-text-muted font-mono">
                    Showing first 500 of {missingTracks.length} missing tracks — Auto-Scan Drives &amp; Relocate will process all {missingTracks.length}.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
