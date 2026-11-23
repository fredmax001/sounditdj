import React, { useState } from 'react'
import { SearchCheck, Replace, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import useLibraryStore from '@store/libraryStore'

const FIELDS = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'genre', label: 'Genre' },
]

function FindReplace() {
  const { tracks, bulkReplace } = useLibraryStore()
  const [field, setField] = useState('title')
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [selectedTrackIds, setSelectedTrackIds] = useState([])
  const [isReplacing, setIsReplacing] = useState(false)
  const [result, setResult] = useState(null)

  const matchedTracks = tracks.filter(track => {
    const value = track[field]?.toLowerCase() || ''
    return search && value.includes(search.toLowerCase())
  })

  const allSelected = selectedTrackIds.length === matchedTracks.length && matchedTracks.length > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedTrackIds([])
    } else {
      setSelectedTrackIds(matchedTracks.map(t => t.id))
    }
  }

  const toggleTrack = (id) => {
    if (selectedTrackIds.includes(id)) {
      setSelectedTrackIds(selectedTrackIds.filter(tid => tid !== id))
    } else {
      setSelectedTrackIds([...selectedTrackIds, id])
    }
  }

  const handleReplace = async () => {
    if (!search.trim()) return
    if (selectedTrackIds.length === 0 && matchedTracks.length > 0) {
      if (!window.confirm('No tracks selected. Replace in ALL matched tracks?')) return
    }
    setIsReplacing(true)
    try {
      const res = await bulkReplace(field, search, replace, selectedTrackIds.length > 0 ? selectedTrackIds : undefined)
      setResult({ success: true, count: res.updatedCount })
    } catch (error) {
      setResult({ success: false, error: error.message })
    }
    setIsReplacing(false)
  }

  const previewChanges = matchedTracks.map(track => {
    const oldValue = track[field] || ''
    const newValue = oldValue.replace(new RegExp(search, 'gi'), replace)
    return { ...track, oldValue, newValue }
  })

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <SearchCheck className="w-6 h-6 text-brand-accent" />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Find & Replace</h1>
            <p className="text-sm text-text-muted">Batch edit track metadata across your library</p>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-background-secondary border border-border rounded-xl p-5 mb-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[11px] text-text-muted uppercase mb-1 block">Field</label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="w-full bg-background-primary border border-border text-[13px] text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
              >
                {FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase mb-1 block">Find</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Text to find..."
                className="w-full bg-background-primary border border-border text-[13px] text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase mb-1 block">Replace With</label>
              <input
                type="text"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="Replacement text..."
                className="w-full bg-background-primary border border-border text-[13px] text-text-primary rounded px-3 py-2 focus:outline-none focus:border-brand-accent/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-muted">
              {matchedTracks.length} track{matchedTracks.length !== 1 ? 's' : ''} will be affected
              {selectedTrackIds.length > 0 && ` (${selectedTrackIds.length} selected)`}
            </span>
            <button
              onClick={handleReplace}
              disabled={!search.trim() || isReplacing}
              className="flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-primary text-[13px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReplacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
              Replace All
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm text-text-primary">
              {result.success ? `Successfully updated ${result.count} tracks.` : `Error: ${result.error}`}
            </span>
          </div>
        )}

        {/* Preview */}
        {search && matchedTracks.length > 0 && (
          <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-background-tertiary border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">Preview Changes</span>
              <button
                onClick={toggleAll}
                className="text-[11px] text-brand-accent hover:text-brand-accent-hover"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-96 overflow-auto">
              {previewChanges.map(track => {
                const isSelected = selectedTrackIds.includes(track.id)
                return (
                  <div
                    key={track.id}
                    onClick={() => toggleTrack(track.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand-accent-dim' : 'hover:bg-background-tertiary'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-brand-accent border-brand-accent' : 'border-text-muted'} flex items-center justify-center`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-brand-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-text-secondary truncate">{track.title} — {track.artist}</div>
                      <div className="text-[11px] mt-0.5">
                        <span className="text-red-400 line-through">{track.oldValue || '(empty)'}</span>
                        <span className="text-text-muted mx-1">→</span>
                        <span className="text-green-400">{track.newValue || '(empty)'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FindReplace
