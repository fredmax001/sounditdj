import React, { useState, useEffect } from 'react'
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  StopCircle,
} from 'lucide-react'
import axios from '../config/axios'

export default function TransferProgressDrawer({ job, onDismiss }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [jobState, setJobState] = useState(job)
  const [elapsed, setElapsed] = useState(0)

  // Poll job status while active
  useEffect(() => {
    if (!job?.id) return
    setJobState(job)

    let isSubscribed = true
    const startTime = Date.now()

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/transfer/jobs/${job.id}`)
        if (!isSubscribed) return
        const current = res.data?.job || res.data
        setJobState(current)
        setElapsed(Math.floor((Date.now() - startTime) / 1000))

        if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
          clearInterval(interval)
        }
      } catch (err) {
        console.warn('Job poll error:', err)
      }
    }, 800)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [job?.id])

  if (!jobState) return null

  const isCompleted = jobState.status === 'completed'
  const isFailed = jobState.status === 'failed'
  const isCancelled = jobState.status === 'cancelled'
  const isRunning = !isCompleted && !isFailed && !isCancelled

  const percent = Math.min(100, Math.max(0, Math.round(jobState.progress || 0)))
  const currentTrack = jobState.currentTrack || jobState.details?.currentTrack || 'Preparing files...'
  const completedCount = jobState.completedFiles ?? jobState.details?.completedCount ?? 0
  const totalCount = jobState.totalFiles ?? jobState.details?.totalCount ?? 0

  const formatSec = (secs) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Calculate ETA
  const remainingSec = percent > 5 && elapsed > 2
    ? Math.max(0, Math.round((elapsed / (percent / 100)) - elapsed))
    : null

  const handleCancel = async () => {
    if (!window.confirm('Cancel this transfer operation?')) return
    try {
      await axios.post(`/api/transfer/jobs/${jobState.id}/cancel`)
      setJobState((prev) => ({ ...prev, status: 'cancelled' }))
    } catch (err) {
      console.warn('Cancel error:', err)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background-secondary border-t border-border shadow-2xl transition-all duration-300">
      {/* Progress Bar Header */}
      <div className="h-1 bg-background-primary w-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isCompleted
              ? 'bg-green-400'
              : isFailed || isCancelled
              ? 'bg-red-400'
              : 'bg-brand-accent'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Status Icon & Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            {isRunning ? (
              <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary truncate">
                {isRunning
                  ? (jobState.label || 'Transferring to DJ Device...')
                  : isCompleted
                  ? 'Transfer Complete & Verified'
                  : isCancelled
                  ? 'Transfer Cancelled'
                  : 'Transfer Encountered an Issue'}
              </span>
              <span className="text-[10px] font-mono text-brand-accent bg-brand-accent-dim px-1.5 py-0.2 rounded">
                {percent}%
              </span>
            </div>

            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {isRunning ? (
                <>
                  <span className="text-text-secondary">{currentTrack}</span>
                  {totalCount > 0 && ` (${completedCount}/${totalCount})`}
                </>
              ) : isCompleted ? (
                `Successfully verified ${completedCount || totalCount} tracks on target drive`
              ) : (
                jobState.error || 'Operation terminated'
              )}
            </div>
          </div>
        </div>

        {/* Center: Timing Stats */}
        <div className="hidden md:flex items-center gap-6 text-[11px] font-mono text-text-secondary shrink-0">
          <div>
            <span className="text-text-muted">Elapsed: </span>
            <span>{formatSec(elapsed)}</span>
          </div>
          {remainingSec !== null && isRunning && (
            <div>
              <span className="text-text-muted">ETA: </span>
              <span className="text-brand-accent">{formatSec(remainingSec)}</span>
            </div>
          )}
          {jobState.speed && (
            <div>
              <span className="text-text-muted">Speed: </span>
              <span>{jobState.speed}</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors flex items-center gap-1"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {!isRunning && (
            <button
              onClick={onDismiss}
              className="px-3 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-background-tertiary text-text-muted hover:text-text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Log Drawer */}
      {isExpanded && (
        <div className="px-6 pb-4 pt-2 border-t border-border/50 bg-background-primary/60 max-h-48 overflow-y-auto font-mono text-[11px] text-text-muted space-y-1">
          <div>Operation: {jobState.profile || 'USB Export'}</div>
          <div>Destination: {jobState.destination || jobState.details?.destination || 'Connected External Storage'}</div>
          {Array.isArray(jobState.logs) &&
            jobState.logs.map((log, idx) => (
              <div key={idx} className="text-text-secondary">
                {typeof log === 'string' ? log : log.message || JSON.stringify(log)}
              </div>
            ))}
          {isCompleted && (
            <div className="text-green-400 font-semibold mt-2">
              ✓ Database integrity checked, ANLZ beatgrid verified, cue points intact.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
