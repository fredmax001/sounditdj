import { MEDIA_BASE_URL } from '@config/axios'

/**
 * Resolve a playable URL for any track — works seamlessly for:
 * 1. Local files on Mac/Windows inside Electron via custom `soundit-media://` protocol (supports Range seeking & Web Audio CORS)
 * 2. Cloud/backend tracks via HTTP `/api/media/...` or `/uploads/...`
 */
export function resolveTrackAudioUrl(track, token = null) {
  if (!track) return null

  const isElectron = Boolean(window.electronAPI?.isElectron)
  const rawPath = track.path || track.filePath || ''

  // Check if track has a real local filesystem path (macOS/Linux `/...` or Windows `C:\...`)
  const isLocalFsPath =
    rawPath &&
    !rawPath.startsWith('http://') &&
    !rawPath.startsWith('https://') &&
    !rawPath.startsWith('imported://') &&
    !rawPath.startsWith('/uploads/') &&
    !rawPath.startsWith('/api/') &&
    (rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath))

  if (isElectron && isLocalFsPath) {
    return `soundit-media://local?path=${encodeURIComponent(rawPath)}`
  }

  const candidate = track.audioUrl || track.audio_url || (rawPath.startsWith('/uploads/') || rawPath.startsWith('/api/') || rawPath.startsWith('http') ? rawPath : null)
  if (candidate) {
    let url = candidate.startsWith('http') ? candidate : `${MEDIA_BASE_URL}${candidate}`
    if (!candidate.startsWith('http') && token) {
      url += `${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    }
    return url
  }

  if (track.id && !String(track.id).startsWith('local-')) {
    let url = `${MEDIA_BASE_URL}/api/media/stream/${encodeURIComponent(track.id)}`
    if (token) url += `?token=${encodeURIComponent(token)}`
    return url
  }

  return null
}
