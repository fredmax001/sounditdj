import express from 'express'
import axios from 'axios'

import {
  ValidationError,
  assertNumber,
  assertString,
  assertUrl,
  sendValidationError,
} from '../security/validation.js'

const router = express.Router()

export const RAPIDAPI_HOSTS = {
  shazam: 'shazam-song-recognition-api.p.rapidapi.com',
  soundcloud: 'soundcloud-scraper-and-downloader-api.p.rapidapi.com',
  soundcloudLegacy: 'soundcloud-api3.p.rapidapi.com',
  audiomack: 'audiomack-scraper.p.rapidapi.com',
  hearthis: 'hearthis-at.p.rapidapi.com',
  boomplay: 'boomplay-scraper.p.rapidapi.com',
  youtube: 'youtube138.p.rapidapi.com',
}

const DEFAULT_SHAZAM_RECOGNIZE_PATH = 'recognize/url'

function getRapidApiKey() {
  return process.env.RAPIDAPI_KEY || ''
}

export function getShazamRecognizePath() {
  const configured = String(process.env.SHAZAM_RECOGNIZE_PATH || DEFAULT_SHAZAM_RECOGNIZE_PATH).trim()
  return configured.replace(/^\/+|\/+$/g, '') || DEFAULT_SHAZAM_RECOGNIZE_PATH
}

export function ensureRapidApiConfigured(res) {
  const key = getRapidApiKey()
  if (!key) {
    res.status(503).json({
      success: false,
      error: 'Music integration is not configured. Set RAPIDAPI_KEY in backend/.env.',
    })
    return null
  }
  return key
}

export function buildRapidApiUrl(host, path) {
  return `https://${host}/${String(path || '').replace(/^\/+/, '')}`
}

export function getRapidApiHeaders(host, key, extraHeaders = {}) {
  return {
    'x-rapidapi-host': host,
    'x-rapidapi-key': key,
    ...extraHeaders,
  }
}

export function normalizeProviderError(error, fallbackMessage) {
  const payload = error?.response?.data
  const status = error?.response?.status

  // Detect quota/rate-limit errors from RapidAPI
  const rawText = typeof payload === 'string' ? payload : JSON.stringify(payload || '')
  if (
    status === 429 ||
    rawText.includes('exceeded') ||
    rawText.includes('MONTHLY quota') ||
    rawText.includes('rate limit') ||
    rawText.includes('Too Many Requests')
  ) {
    return 'SoundCloud monthly quota exceeded — try Audiomack or Boomplay instead.'
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }

    if (typeof payload.status === 'string' && payload.status.trim() && payload.status.trim().toLowerCase() !== 'success') {
      return payload.status
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

export function isQuotaError(error) {
  const payload = error?.response?.data
  const status = error?.response?.status
  const rawText = typeof payload === 'string' ? payload : JSON.stringify(payload || '')
  return (
    status === 429 ||
    rawText.includes('exceeded') ||
    rawText.includes('MONTHLY quota') ||
    rawText.includes('rate limit') ||
    rawText.includes('Too Many Requests')
  )
}

function assertInteger(value, field, options = {}) {
  const parsed = assertNumber(value, field, options)
  if (!Number.isInteger(parsed)) {
    throw new ValidationError(`${field} must be an integer`, field)
  }
  return parsed
}

function extractSpotifyTrackId(input) {
  const value = String(input || '').trim()
  if (!value) return null

  const idMatch = value.match(/^[A-Za-z0-9]{22}$/)
  if (idMatch) {
    return idMatch[0]
  }

  try {
    const parsed = new URL(value)
    const trackMatch = parsed.pathname.match(/\/track\/([A-Za-z0-9]{22})/)
    return trackMatch ? trackMatch[1] : null
  } catch {
    return null
  }
}

function normalizeSpotifyReference(songId) {
  const reference = assertString(songId, 'songId', { min: 1, max: 240 })
  const trackId = extractSpotifyTrackId(reference)

  if (!trackId) {
    throw new ValidationError('songId must be a Spotify track URL or 22-character track ID', 'songId')
  }

  return {
    songId: `https://open.spotify.com/track/${trackId}`,
    trackId,
  }
}

function normalizeSpotifyDownloadPayload(payload, fallbackTrackId) {
  const source = payload?.data || payload || {}

  return {
    trackId: source.id || fallbackTrackId,
    title: source.title || null,
    artist: source.artist || source.artists || null,
    album: source.album || null,
    artworkUrl: source.cover || source.artwork || null,
    releaseDate: source.releaseDate || null,
    downloadUrl: source.downloadLink || source.url || null,
  }
}

function extractLineText(entry) {
  if (!entry) return ''

  if (typeof entry === 'string') {
    return entry.trim()
  }

  if (Array.isArray(entry)) {
    return entry.map((item) => extractLineText(item)).filter(Boolean).join(' ').trim()
  }

  if (typeof entry !== 'object') {
    return ''
  }

  if (typeof entry.words === 'string' && entry.words.trim()) {
    return entry.words.trim()
  }

  if (typeof entry.text === 'string' && entry.text.trim()) {
    return entry.text.trim()
  }

  if (typeof entry.line === 'string' && entry.line.trim()) {
    return entry.line.trim()
  }

  if (typeof entry.lyrics === 'string' && entry.lyrics.trim()) {
    return entry.lyrics.trim()
  }

  if (Array.isArray(entry.syllables)) {
    return entry.syllables
      .map((syllable) => {
        if (typeof syllable === 'string') return syllable
        if (typeof syllable?.text === 'string') return syllable.text
        return ''
      })
      .join('')
      .trim()
  }

  return ''
}

function extractLyricsLines(payload) {
  const collected = []
  const queue = [payload]
  const visited = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    if (typeof current === 'string') {
      if (current.includes('\n')) {
        collected.push(
          ...current
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        )
      }
      continue
    }

    if (typeof current !== 'object' || visited.has(current)) {
      continue
    }

    visited.add(current)

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item))
      continue
    }

    Object.entries(current).forEach(([key, value]) => {
      if (!value) return

      if (typeof value === 'string' && /lyrics$/i.test(key) && value.trim()) {
        queue.push(value)
        return
      }

      if (Array.isArray(value) && /(lines|lyrics|content|sections)/i.test(key)) {
        value.forEach((entry) => {
          const line = extractLineText(entry)
          if (line) {
            collected.push(line)
          }
          queue.push(entry)
        })
        return
      }

      if (typeof value === 'object') {
        queue.push(value)
      }
    })
  }

  return Array.from(new Set(collected.map((line) => line.trim()).filter(Boolean)))
}

function normalizeReposter(user) {
  return {
    id: user.id,
    username: user.username || user.permalink || 'Unknown',
    fullName: user.full_name || user.first_name || null,
    avatarUrl: user.avatar_url || null,
    permalinkUrl: user.permalink_url || null,
    followersCount: user.followers_count ?? 0,
    likesCount: user.likes_count ?? 0,
    playlistCount: user.playlist_count ?? 0,
    verified: Boolean(user.verified || user.badges?.verified),
    city: user.city || null,
    countryCode: user.country_code || null,
  }
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function collectShazamCandidates(payload) {
  const candidates = []
  const visited = new Set()
  const roots = [payload, payload?.track, payload?.data, payload?.data?.track, payload?.result, payload?.result?.track]

  const addCandidate = (value) => {
    if (!value || typeof value !== 'object' || visited.has(value)) {
      return
    }

    visited.add(value)
    candidates.push(value)

    if (value.attributes && typeof value.attributes === 'object') {
      addCandidate(value.attributes)
    }

    if (value.data && typeof value.data === 'object') {
      addCandidate(value.data)
    }
  }

  roots.forEach(addCandidate)

  const resources =
    payload?.resources ||
    payload?.data?.resources ||
    payload?.result?.resources ||
    payload?.data?.result?.resources ||
    {}

  const shazamSongs = resources?.['shazam-songs']

  if (Array.isArray(shazamSongs)) {
    shazamSongs.forEach(addCandidate)
  } else if (shazamSongs && typeof shazamSongs === 'object') {
    Object.values(shazamSongs).forEach(addCandidate)
  }

  return candidates
}

function extractAlbumFromCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const metadata = Array.isArray(candidate.sections)
    ? candidate.sections.flatMap((section) => section?.metadata || [])
    : []

  const albumEntry = metadata.find((entry) => {
    const title = String(entry?.title || entry?.key || '').toLowerCase()
    return title.includes('album')
  })

  return firstNonEmptyString(
    albumEntry?.text,
    candidate.album?.title,
    candidate.album,
    candidate.albums?.[0]?.title,
    candidate.albums?.[0]?.name
  )
}

function normalizeShazamResult(payload) {
  const candidates = collectShazamCandidates(payload)
  const track = candidates[0] || null

  return {
    title: firstNonEmptyString(...candidates.map((candidate) => candidate?.title || candidate?.heading?.title || candidate?.name)),
    artist: firstNonEmptyString(
      ...candidates.map(
        (candidate) =>
          candidate?.subtitle ||
          candidate?.heading?.subtitle ||
          candidate?.artist ||
          candidate?.artistName ||
          candidate?.artist_name
      )
    ),
    album: firstNonEmptyString(...candidates.map(extractAlbumFromCandidate)),
    artworkUrl: firstNonEmptyString(
      ...candidates.map(
        (candidate) =>
          candidate?.images?.coverart ||
          candidate?.images?.background ||
          candidate?.image ||
          candidate?.artworkUrl ||
          candidate?.artwork?.url ||
          candidate?.cover
      )
    ),
    shazamUrl: firstNonEmptyString(...candidates.map((candidate) => candidate?.url || candidate?.share?.href || candidate?.href)),
    payload,
  }
}

async function fetchSpotifyDownload(key, rawSongId) {
  const { songId, trackId } = normalizeSpotifyReference(rawSongId)

  const response = await axios.get(buildRapidApiUrl(RAPIDAPI_HOSTS.spotifyDownloader, 'downloadSong'), {
    params: { songId },
    headers: getRapidApiHeaders(RAPIDAPI_HOSTS.spotifyDownloader, key),
    timeout: 20000,
  })

  const normalized = normalizeSpotifyDownloadPayload(response.data, trackId)

  if (!normalized.downloadUrl) {
    throw new Error('Spotify downloader did not return a download link')
  }

  return normalized
}

async function fetchSpotifyLyrics(key, rawSongId) {
  const { trackId } = normalizeSpotifyReference(rawSongId)

  const response = await axios.get(buildRapidApiUrl(RAPIDAPI_HOSTS.spotifyLyrics, 'track_lyrics/'), {
    params: { id: trackId },
    headers: getRapidApiHeaders(RAPIDAPI_HOSTS.spotifyLyrics, key),
    timeout: 20000,
    validateStatus: (status) => status < 500,
  })

  if (response.status >= 400 && response.data?.status !== 'success') {
    const providerError = new Error('Spotify lyrics provider returned an error')
    providerError.response = { data: response.data }
    throw providerError
  }

  const lines = extractLyricsLines(response.data)

  return {
    trackId,
    providerHttpStatus: response.status,
    providerStatus: response.data?.status || null,
    hasLyrics: lines.length > 0,
    lines,
    lyrics: lines.join('\n'),
    providerFields: Object.keys(response.data || {}),
  }
}

async function fetchAudiomackPlay(key, songId) {
  const normalizedSongId = assertString(songId, 'songId', { min: 1, max: 40 })

  const response = await axios.get(
    buildRapidApiUrl(RAPIDAPI_HOSTS.audiomack, `audiomack/song/${encodeURIComponent(normalizedSongId)}/play`),
    {
      headers: getRapidApiHeaders(RAPIDAPI_HOSTS.audiomack, key),
      timeout: 20000,
    }
  )

  if (!response.data?.signedUrl) {
    const providerError = new Error(
      normalizeProviderError(
        { response: { data: response.data } },
        'Audiomack did not return a playable stream URL'
      )
    )
    providerError.response = { data: response.data }
    throw providerError
  }

  return {
    songId: normalizedSongId,
    streamUrl: response.data.signedUrl,
    playUuid: response.data?.playUuid || null,
  }
}

// Resolve a SoundCloud URL directly to a download_url using the new scraper provider
async function fetchSoundCloudDirect(key, soundcloudUrl) {
  const host = RAPIDAPI_HOSTS.soundcloud
  const response = await axios.get(buildRapidApiUrl(host, 'sc/track/direct'), {
    params: { url: soundcloudUrl },
    headers: getRapidApiHeaders(host, key),
    timeout: 25000,
  })
  return response.data
}

// Resolve a SoundCloud playlist URL to an array of items with download_url
async function fetchSoundCloudPlaylistDirect(key, soundcloudUrl) {
  const host = RAPIDAPI_HOSTS.soundcloud
  const response = await axios.get(buildRapidApiUrl(host, 'sc/playlist/direct'), {
    params: { url: soundcloudUrl },
    headers: getRapidApiHeaders(host, key),
    timeout: 30000,
  })
  return response.data
}

// Legacy: kept for the fallback download chain (searches by keyword via Audiomack instead)
async function fetchSoundCloudSearch(key, query) {
  // The new scraper provider doesn't support keyword search — we fall through to Audiomack
  throw new Error('SoundCloud keyword search not supported on this provider; use a SoundCloud URL or Audiomack.')
}

async function fetchHearthisFeatures(key, trackPath) {
  const response = await axios.get(buildRapidApiUrl(RAPIDAPI_HOSTS.hearthis, trackPath), {
    headers: getRapidApiHeaders(RAPIDAPI_HOSTS.hearthis, key),
    timeout: 20000,
  })

  return {
    trackPath,
    data: response.data,
  }
}

async function fetchBoomplaySearch(key, query) {
  const response = await axios.get(buildRapidApiUrl(RAPIDAPI_HOSTS.boomplay, 'api/v1/artists/search'), {
    params: { query },
    headers: getRapidApiHeaders(RAPIDAPI_HOSTS.boomplay, key),
    timeout: 20000,
  })

  return {
    query,
    data: response.data,
  }
}

export async function fetchShazamRecognition(key, audioUrl) {
  const recognizePath = getShazamRecognizePath()
  const attempts = [
    {
      method: 'get',
      url: buildRapidApiUrl(RAPIDAPI_HOSTS.shazam, recognizePath),
      config: {
        params: { url: audioUrl },
        headers: getRapidApiHeaders(RAPIDAPI_HOSTS.shazam, key, {
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      },
    },
    {
      method: 'post',
      url: buildRapidApiUrl(RAPIDAPI_HOSTS.shazam, recognizePath),
      config: {
        data: new URLSearchParams({ url: audioUrl }).toString(),
        headers: getRapidApiHeaders(RAPIDAPI_HOSTS.shazam, key, {
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      },
    },
  ]

  let lastError = null

  for (const attempt of attempts) {
    try {
      const response = await axios({
        method: attempt.method,
        url: attempt.url,
        timeout: 20000,
        ...attempt.config,
      })

      return {
        recognizePath,
        method: attempt.method.toUpperCase(),
        result: normalizeShazamResult(response.data),
      }
    } catch (error) {
      lastError = error
      const message = normalizeProviderError(error, '')
      if (error?.response?.status === 404 || message.includes('does not exist')) {
        continue
      }
      throw error
    }
  }

  const notFoundError = new Error(
    `Shazam provider route "${recognizePath}" is not responding. Update SHAZAM_RECOGNIZE_PATH if your RapidAPI listing uses a different path.`
  )
  notFoundError.statusCode = 502
  notFoundError.cause = lastError
  throw notFoundError
}

export async function fetchShazamRawRecognition(key, rawBuffer) {
  try {
    const host = RAPIDAPI_HOSTS.shazam
    const url = buildRapidApiUrl(host, 'recognize/file')
    const response = await axios.post(url, rawBuffer, {
      headers: getRapidApiHeaders(host, key, {
        'Content-Type': 'application/octet-stream',
      }),
      timeout: 20000,
    })

    return {
      result: normalizeShazamResult(response.data),
    }
  } catch (error) {
    console.error('Shazam raw recognition error:', error.response?.data || error.message)
    throw error
  }
}

router.get('/providers', (req, res) => {
  res.json({
    success: true,
    configured: Boolean(getRapidApiKey()),
    shazamRecognizePath: getShazamRecognizePath(),
    providers: RAPIDAPI_HOSTS,
  })
})

router.post('/recognize', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const audioUrl = assertUrl(req.body.audioUrl, 'audioUrl')
    const recognition = await fetchShazamRecognition(key, audioUrl)

    res.json({
      success: true,
      ...recognition,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Shazam recognition error:', error.response?.data || error.message)
    const statusCode = error.statusCode || 502
    res.status(statusCode).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to recognize track'),
      shazamRecognizePath: getShazamRecognizePath(),
    })
  }
})

// Spotify routes removed due to provider shutdown

router.get('/audiomack/play/:songId', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const result = await fetchAudiomackPlay(key, req.params.songId)

    if (!result.streamUrl) {
      return res.status(502).json({
        success: false,
        error: 'Audiomack did not return a playable stream URL',
      })
    }

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Audiomack play error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch Audiomack stream'),
    })
  }
})

function extractSearchQueryFromUrl(input) {
  const sanitized = String(input || '').trim()
  if (!sanitized) return ''

  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    return sanitized
  }

  try {
    const url = new URL(sanitized)
    const host = url.hostname.toLowerCase()

    if (host.includes('soundcloud.com')) {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const artist = parts[0]
        const trackSlug = parts[1]
        return `${artist.replace(/[-_]/g, ' ')} ${trackSlug.replace(/[-_]/g, ' ')}`
      } else if (parts.length === 1) {
        return parts[0].replace(/[-_]/g, ' ')
      }
    } else if (host.includes('boomplay.com')) {
      const parts = url.pathname.split('/').filter(Boolean)
      const lastPart = parts[parts.length - 1] || ''
      if (lastPart) {
        const nameParts = lastPart.split(/[-_]/)
        if (nameParts.length > 1) {
          if (/^\d+$/.test(nameParts[0])) {
            return nameParts.slice(1).join(' ')
          }
          return nameParts.join(' ')
        }
        return lastPart
      }
    }
  } catch (err) {
    console.error('Failed to parse URL in query extractor:', err.message)
  }

  return sanitized
}

router.get('/soundcloud/search', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const rawQuery = assertString(req.query.query, 'query', { min: 1, max: 500 }).trim()

    // ── Playlist URL ──────────────────────────────────────────────
    if (rawQuery.includes('soundcloud.com') && rawQuery.includes('/sets/')) {
      const data = await fetchSoundCloudPlaylistDirect(key, rawQuery)

      if (data.status !== 'success') {
        throw new Error(data.error || 'Playlist resolve failed')
      }

      const items = data.items || []
      const results = items.map((item) => ({
        id: item.webpage_url,
        title: item.title || 'Unknown',
        artist: data.uploader || 'SoundCloud',
        artworkUrl: '',
        permalink: item.webpage_url || '',
        downloadUrl: item.download_url || null,
        // Legacy compat fields — not needed for new provider but kept for frontend
        tracks: [],
        trackAuthorization: '',
      }))

      return res.json({
        success: true,
        isPlaylist: true,
        playlist: {
          title: data.title || 'SoundCloud Playlist',
          artworkUrl: '',
          trackCount: data.count || items.length,
        },
        results,
      })
    }

    // ── Single track URL ──────────────────────────────────────────
    if (rawQuery.includes('soundcloud.com') && !rawQuery.includes('/sets/')) {
      const data = await fetchSoundCloudDirect(key, rawQuery)

      if (data.status !== 'success') {
        throw new Error(data.error || 'Track resolve failed')
      }

      return res.json({
        success: true,
        results: [
          {
            id: rawQuery,
            title: data.title || 'SoundCloud Track',
            artist: data.uploader || 'SoundCloud',
            artworkUrl: '',
            permalink: rawQuery,
            downloadUrl: data.download_url || null,
            tracks: [],
            trackAuthorization: '',
          },
        ],
      })
    }

    // ── Keyword search — not supported by this provider ───────────
    return res.json({
      success: true,
      results: [],
      hint: 'Paste a SoundCloud track or playlist URL to resolve and download. Keyword search is not available — try Audiomack or Boomplay for keyword search.',
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('SoundCloud search error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to resolve SoundCloud URL'),
    })
  }
})

// Resolve a SoundCloud track URL to a direct download link
router.get('/soundcloud/download', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    // New provider: accepts a SoundCloud URL and returns download_url directly
    const trackUrl = req.query.url
      ? assertUrl(req.query.url, 'url')
      : null

    if (!trackUrl) {
      return res.status(400).json({
        success: false,
        error: 'Provide a SoundCloud track URL via ?url=',
      })
    }

    const data = await fetchSoundCloudDirect(key, trackUrl)

    if (data.status !== 'success' || !data.download_url) {
      throw new Error(data.error || 'No download URL returned')
    }

    res.json({
      success: true,
      downloadUrl: data.download_url,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('SoundCloud download fetch error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch SoundCloud download link'),
    })
  }
})

router.get('/hearthis/features', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const path = assertString(req.query.path, 'path', { min: 1, max: 200 })
    const result = await fetchHearthisFeatures(key, path)

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Hearthis error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch Hearthis features'),
    })
  }
})

router.get('/boomplay/search', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const rawQuery = assertString(req.query.query, 'query', { min: 1, max: 500 }).trim()
    const host = RAPIDAPI_HOSTS.boomplay

    let artistId = null

    // Check if query is an artist URL
    if (rawQuery.includes('boomplay.com') && rawQuery.includes('/artists/')) {
      const parts = rawQuery.split('/').filter(Boolean)
      const lastPart = parts[parts.length - 1] || ''
      if (/^\d+$/.test(lastPart)) {
        artistId = lastPart
      } else {
        const match = lastPart.match(/^(\d+)/)
        if (match) artistId = match[1]
      }
    }

    if (!artistId) {
      const query = extractSearchQueryFromUrl(rawQuery)
      const searchResponse = await axios.get(buildRapidApiUrl(host, 'api/v1/artists/search'), {
        params: { query },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })
      const artists = searchResponse.data?.data?.artists || []
      if (artists.length > 0) {
        artistId = artists[0].id
      }
    }

    if (artistId) {
      const songsResponse = await axios.get(buildRapidApiUrl(host, 'api/v1/artists/songs'), {
        params: { artist_id: artistId },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })
      const songs = songsResponse.data?.data?.songs || []
      const results = songs.map(s => ({
        id: s.songId,
        title: s.songName,
        artist: s.artistName,
        artworkUrl: s.cover_url || '',
        permalink: s.songUrl || '',
      }))

      return res.json({
        success: true,
        results,
      })
    }

    res.json({
      success: true,
      results: [],
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Boomplay search error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch Boomplay search results'),
    })
  }
})

router.get('/audiomack/search', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const rawQuery = assertString(req.query.query, 'query', { min: 1, max: 500 }).trim()
    const host = RAPIDAPI_HOSTS.audiomack

    const isPlaylist = rawQuery.includes('audiomack.com') && rawQuery.includes('/playlist/')
    const isAlbum = rawQuery.includes('audiomack.com') && rawQuery.includes('/album/')

    if (isPlaylist || isAlbum) {
      const endpoint = isPlaylist ? 'audiomack/playlist' : 'audiomack/album'
      const response = await axios.get(buildRapidApiUrl(host, endpoint), {
        params: { url: rawQuery },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })
      const playlistDetails = response.data?.results || response.data || {}
      const rawTracks = playlistDetails.tracks || []
      const tracks = rawTracks.map(t => ({
        id: t.song_id || t.id,
        title: t.title,
        artist: t.artist,
        artworkUrl: t.image || t.image_base || (t.images?.original?.filename) || '',
        permalink: t.url_slug || '',
      }))

      return res.json({
        success: true,
        isPlaylist: true,
        playlist: {
          title: playlistDetails.title || (isPlaylist ? 'Audiomack Playlist' : 'Audiomack Album'),
          artworkUrl: playlistDetails.image || playlistDetails.image_base || '',
          trackCount: playlistDetails.track_count || tracks.length || 0,
          id: playlistDetails.id || 'playlist',
        },
        results: tracks,
      })
    } else if (rawQuery.includes('audiomack.com') && rawQuery.includes('/song/')) {
      const response = await axios.get(buildRapidApiUrl(host, 'audiomack/song'), {
        params: { url: rawQuery },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })
      const songDetails = response.data?.results || response.data || {}
      if (songDetails.id) {
        return res.json({
          success: true,
          results: [{
            id: songDetails.id,
            title: songDetails.title,
            artist: songDetails.artist,
            artworkUrl: songDetails.image || songDetails.image_base || '',
            permalink: songDetails.url_slug || '',
          }],
        })
      }
      return res.json({ success: true, results: [] })
    } else {
      const response = await axios.get(buildRapidApiUrl(host, 'audiomack/search'), {
        params: { q: rawQuery },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })
      const rawResults = response.data?.results || []
      const tracks = rawResults
        .filter(item => item.type === 'song' || !item.type)
        .map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          artworkUrl: t.image || t.image_base || '',
          permalink: t.url_slug || '',
        }))
      return res.json({
        success: true,
        results: tracks,
      })
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Audiomack search error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch Audiomack results'),
    })
  }
})

router.get('/spotify/search', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const rawQuery = assertString(req.query.query, 'query', { min: 1, max: 500 }).trim()
    const host = 'spotify-scraper.p.rapidapi.com'

    if (rawQuery.includes('spotify.com') && rawQuery.includes('/playlist/')) {
      let playlistId = ''
      try {
        const url = new URL(rawQuery)
        const parts = url.pathname.split('/').filter(Boolean)
        const playlistIndex = parts.indexOf('playlist')
        if (playlistIndex !== -1 && parts[playlistIndex + 1]) {
          playlistId = parts[playlistIndex + 1].split('?')[0]
        }
      } catch {
        const match = rawQuery.match(/\/playlist\/([A-Za-z0-9]+)/)
        if (match) playlistId = match[1]
      }

      if (!playlistId) {
        throw new ValidationError('Could not extract Spotify playlist ID', 'query')
      }

      const response = await axios.get(buildRapidApiUrl(host, 'v1/playlist/contents'), {
        params: { playlistId },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })

      const playlistData = response.data || {}
      const rawItems = playlistData.contents?.items || []
      const tracks = rawItems.map(item => ({
        id: item.id,
        title: item.name,
        artist: item.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        artworkUrl: item.album?.cover?.[0]?.url || '',
        permalink: item.shareUrl || '',
      }))

      return res.json({
        success: true,
        isPlaylist: true,
        playlist: {
          title: playlistData.name || 'Spotify Playlist',
          artworkUrl: playlistData.images?.[0]?.[0]?.url || playlistData.images?.[0]?.url || '',
          trackCount: playlistData.contents?.totalCount || tracks.length || 0,
          id: playlistId,
        },
        results: tracks,
      })
    } else {
      let term = rawQuery
      if (rawQuery.includes('spotify.com') && rawQuery.includes('/track/')) {
        let trackId = ''
        try {
          const url = new URL(rawQuery)
          const parts = url.pathname.split('/').filter(Boolean)
          const trackIndex = parts.indexOf('track')
          if (trackIndex !== -1 && parts[trackIndex + 1]) {
            trackId = parts[trackIndex + 1].split('?')[0]
          }
        } catch {
          const match = rawQuery.match(/\/track\/([A-Za-z0-9]+)/)
          if (match) trackId = match[1]
        }
        if (trackId) {
          term = trackId
        }
      }

      const response = await axios.get(buildRapidApiUrl(host, 'v1/search'), {
        params: { term, type: 'track' },
        headers: getRapidApiHeaders(host, key),
        timeout: 20000,
      })

      const rawItems = response.data?.tracks?.items || []
      const tracks = rawItems.map(item => ({
        id: item.id,
        title: item.name,
        artist: item.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        artworkUrl: item.album?.cover?.[0]?.url || '',
        permalink: item.shareUrl || '',
      }))

      return res.json({
        success: true,
        results: tracks,
      })
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Spotify search error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to fetch Spotify results'),
    })
  }
})

router.get('/fallback/download', async (req, res) => {
  try {
    const key = ensureRapidApiConfigured(res)
    if (!key) return

    const title = assertString(req.query.title, 'title')
    const artist = assertString(req.query.artist, 'artist')

    const searchQuery = `${title} ${artist}`
    console.log(`Fallback download search for: "${searchQuery}"`)

    let downloadUrl = null
    let errorLog = []

    // 1. Try SoundCloud fallback (skip on quota errors)
    try {
      console.log(`Trying SoundCloud fallback for: "${searchQuery}"`)
      const searchResult = await fetchSoundCloudSearch(key, searchQuery)
      const tracks = searchResult.results || []

      if (tracks.length > 0) {
        const matchedTrack = tracks[0]
        const progressiveTrack = (matchedTrack.tracks || []).find(t => t.protocol === 'progressive') || (matchedTrack.tracks || [])[0]
        if (progressiveTrack) {
          const host = RAPIDAPI_HOSTS.soundcloud
          const response = await axios.get(buildRapidApiUrl(host, 'v2/stream/get'), {
            params: {
              streamId: progressiveTrack.streamId,
              trackAuthorization: matchedTrack.trackAuthorization,
            },
            headers: getRapidApiHeaders(host, key),
            timeout: 20000,
          })
          downloadUrl = response.data?.data?.streamUrl || response.data?.streamUrl || null
        }
      }
    } catch (scError) {
      const quotaHit = isQuotaError(scError)
      console.warn(`SoundCloud fallback failed (quota=${quotaHit}):`, scError.message)
      errorLog.push(`SoundCloud: ${quotaHit ? 'monthly quota exceeded' : scError.message}`)
    }

    // 2. If SoundCloud fails or returns no downloadUrl, try Audiomack fallback
    if (!downloadUrl) {
      try {
        console.log(`SoundCloud fallback failed or returned no link. Trying Audiomack fallback for: "${searchQuery}"`)
        const host = RAPIDAPI_HOSTS.audiomack
        const response = await axios.get(buildRapidApiUrl(host, 'audiomack/search'), {
          params: { q: searchQuery },
          headers: getRapidApiHeaders(host, key),
          timeout: 20000,
        })
        const results = response.data?.results || []
        const songs = results.filter(item => item.type === 'song' || !item.type)
        if (songs.length > 0) {
          const matchedSong = songs[0]
          const playResult = await fetchAudiomackPlay(key, matchedSong.id)
          downloadUrl = playResult.streamUrl
        }
      } catch (amError) {
        console.warn('Audiomack fallback failed:', amError.message)
        errorLog.push(`Audiomack: ${amError.message}`)
      }
    }

    if (!downloadUrl) {
      return res.status(502).json({
        success: false,
        error: 'Failed to resolve fallback download stream. Details: ' + errorLog.join(' | '),
      })
    }

    res.json({
      success: true,
      downloadUrl,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Fallback download error:', error.response?.data || error.message)
    res.status(502).json({
      success: false,
      error: normalizeProviderError(error, 'Failed to resolve fallback download stream'),
    })
  }
})

router.get('/download-file', async (req, res) => {
  try {
    const url = assertString(req.query.url, 'url')
    const filename = assertString(req.query.filename, 'filename')

    console.log(`Proxying download from URL: ${url} as filename: ${filename}`)

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg')

    response.data.pipe(res)
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }
    console.error('Direct download proxy error:', error.message)
    res.status(502).json({
      success: false,
      error: 'Failed to stream the file from the origin server: ' + error.message,
    })
  }
})

router.get('/search', (req, res) => {
  res.json({
    success: true,
    results: [],
    total: 0,
    message: 'Text search is not available with the configured provider set.',
  })
})

export async function fetchYouTubeSearch(key, query) {
  const url = buildRapidApiUrl(RAPIDAPI_HOSTS.youtube, 'search/')
  const response = await axios.get(url, {
    params: { q: query, hl: 'en', gl: 'US' },
    headers: getRapidApiHeaders(RAPIDAPI_HOSTS.youtube, key),
  })

  return response.data
}

export default router
