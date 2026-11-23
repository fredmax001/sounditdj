import plist from 'plist'
import bplist from 'bplist-parser'

import {
  SOURCE_FORMATS,
  basename,
  createLibrary,
  createPlaylist,
  createTrack,
  parseDuration,
} from '../model.js'
import { locationToPath, pathToLocation } from './rekordboxXml.js'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isStreamingTrack(raw, filePath) {
  const kind = String(raw.Kind || '')
  const trackType = String(raw['Track Type'] || '')
  if (trackType === 'Remote') return true
  if (!filePath) return true
  if (/^https?:/i.test(filePath)) return true
  if (/Apple Music/i.test(kind) && !filePath) return true
  return raw['Cloud Status'] === 'Matched' && !filePath
}

/**
 * Parse an Apple Music / iTunes library XML export.
 *
 * Apple's local library database is not read directly. Users export XML via
 * File > Library > Export Library. Streaming items are deliberately flagged so
 * they are never presented as exportable local audio.
 */
export function parseAppleMusicXml(xmlContent) {
  const raw = plist.parse(String(xmlContent || '').replace(/^\uFEFF/, ''))
  const library = createLibrary(SOURCE_FORMATS.APPLE_MUSIC, {
    sourceVersion: raw['Major Version'] ? `${raw['Major Version']}.${raw['Minor Version'] || 0}` : null,
  })

  const trackIdMap = new Map()
  const tracks = raw.Tracks && typeof raw.Tracks === 'object' ? raw.Tracks : {}
  for (const [trackId, entry] of Object.entries(tracks)) {
    if (!entry || typeof entry !== 'object') continue
    const filePath = locationToPath(entry.Location || '')
    const streaming = isStreamingTrack(entry, filePath)
    const protectedTrack = Boolean(entry.Protected) || /protected|drm/i.test(String(entry.Kind || ''))
    const track = createTrack({
      sourceId: String(trackId),
      title: entry.Name || null,
      artist: entry.Artist || null,
      album: entry.Album || null,
      albumArtist: entry['Album Artist'] || null,
      genre: entry.Genre || null,
      comment: entry.Comments || null,
      composer: entry.Composer || null,
      duration: parseDuration(entry['Total Time'] ? Number(entry['Total Time']) / 1000 : null),
      path: streaming ? null : filePath,
      filename: filePath ? basename(filePath) : null,
      fileSize: toNumber(entry.Size),
      bitrate: toNumber(entry['Bit Rate']),
      sampleRate: toNumber(entry['Sample Rate']),
      trackNumber: toNumber(entry['Track Number']),
      discNumber: toNumber(entry['Disc Number']),
      year: toNumber(entry.Year),
      rating: entry.Rating !== undefined ? Math.round(Number(entry.Rating) / 20) : null,
      dateAdded: parseDate(entry['Date Added']),
      playCount: toNumber(entry['Play Count']),
      streaming,
      protected: protectedTrack,
      missing: !streaming && !filePath,
      sourceMeta: {
        kind: entry.Kind || null,
        persistentId: entry['Persistent ID'] || null,
        trackType: entry['Track Type'] || null,
        cloudStatus: entry['Cloud Status'] || null,
        location: entry.Location || null,
      },
    })
    library.tracks.push(track)
    trackIdMap.set(String(trackId), track.sourceId)
    if (streaming) {
      library.warnings.push(`"${track.title || trackId}" is a streaming item and cannot be exported.`)
    } else if (protectedTrack) {
      library.warnings.push(`"${track.title || trackId}" is protected and cannot be exported.`)
    }
  }

  const rawPlaylists = Array.isArray(raw.Playlists) ? raw.Playlists : []
  const playlistIdMap = new Map()
  const deferredParents = []

  for (const entry of rawPlaylists) {
    if (!entry || typeof entry !== 'object') continue
    const sourceId = `apple-playlist-${entry['Playlist ID'] ?? library.playlists.length + 1}`
    const isFolder = Boolean(entry.Folder)
    const itemTrackIds = (entry.Items || [])
      .map((item) => trackIdMap.get(String(item?.['Track ID'])))
      .filter(Boolean)
    const playlist = createPlaylist({
      sourceId,
      name: entry.Name || (isFolder ? 'Folder' : 'Playlist'),
      isFolder,
      parentId: null,
      trackIds: itemTrackIds,
      sourceTrackRefs: itemTrackIds,
      sourceMeta: {
        persistentId: entry['Persistent ID'] || null,
        distinguishedKind: entry['Distinguished Kind'] ?? null,
        smart: Boolean(entry['Smart Info']),
      },
    })
    library.playlists.push(playlist)
    playlistIdMap.set(String(entry['Playlist ID']), sourceId)
    if (entry['Parent Persistent ID']) {
      deferredParents.push({ playlist, parentPersistentId: String(entry['Parent Persistent ID']) })
    }
  }

  // Parent links in iTunes XML are persistent IDs, not Playlist IDs.
  const persistentToSource = new Map()
  for (const entry of rawPlaylists) {
    if (!entry?.['Persistent ID']) continue
    persistentToSource.set(String(entry['Persistent ID']), playlistIdMap.get(String(entry['Playlist ID'])))
  }
  for (const { playlist, parentPersistentId } of deferredParents) {
    playlist.parentId = persistentToSource.get(parentPersistentId) || null
  }

  // Apple emits a "Library" and "Music" smart playlist even when they are not
  // meaningful imports. Keep them, but mark them so the UI can filter.
  return library
}

/**
 * Parse the binary `iTunes Library` file. This requires the file to be a plain
 * bplist; encrypted/newer databases are rejected with an actionable message.
 */
export async function parseAppleMusicBinary(buffer) {
  const parsed = await bplist.parseBuffer(Buffer.from(buffer))
  const root = parsed?.[0]
  if (!root || !root.Tracks) throw new Error('Binary Apple Music library has no Tracks section')
  // Convert binary plist structures to the XML writer's rough shape.
  const tracks = {}
  for (const [id, track] of Object.entries(root.Tracks)) {
    tracks[id] = {
      ...track,
      Location: track.Location,
      'Date Added': track['Date Added'] instanceof Date ? track['Date Added'].toISOString() : track['Date Added'],
    }
  }
  const fakeXml = plist.build({ ...root, Tracks: tracks })
  return parseAppleMusicXml(fakeXml)
}

export function generateAppleMusicXml(library) {
  const tracksObj = {}
  const trackNumById = new Map()
  let nextTrackId = 1

  for (const track of library.tracks || []) {
    const id = nextTrackId++
    const key = String(track.sourceId || track.id || id)
    trackNumById.set(key, id)
    const entry = {
      'Track ID': id,
      Name: track.title || track.filename || `Track ${id}`,
      'Track Type': 'File',
      Location: track.path ? pathToLocation(track.path) : '',
    }
    if (track.artist) entry.Artist = track.artist
    if (track.album) entry.Album = track.album
    if (track.genre) entry.Genre = track.genre
    if (track.comment) entry.Comments = track.comment
    if (track.duration) entry['Total Time'] = Math.round(Number(track.duration) * 1000)
    if (track.bpm) entry.BPM = Math.round(Number(track.bpm))
    if (track.year) entry.Year = Number(track.year)
    if (track.bitrate) entry['Bit Rate'] = Number(track.bitrate)
    if (track.sampleRate) entry['Sample Rate'] = Number(track.sampleRate)
    if (track.fileSize) entry.Size = Number(track.fileSize)
    if (track.rating) entry.Rating = Math.min(100, Math.round(Number(track.rating) * 20))
    tracksObj[String(id)] = entry
  }

  const playlists = [
    {
      Name: 'Library',
      Master: true,
      'Playlist ID': 1,
      'Playlist Persistent ID': '0000000000000001',
      'All Items': true,
      'Playlist Items': Object.keys(tracksObj).map((id) => ({ 'Track ID': Number(id) })),
    },
  ]

  let nextPlaylistId = 2
  const persistBySource = new Map()
  const allPlaylists = library.playlists || []
  for (const pl of allPlaylists) {
    const pid = nextPlaylistId++
    const persistent = pid.toString(16).toUpperCase().padStart(16, '0')
    persistBySource.set(String(pl.sourceId || pl.id), persistent)
  }

  nextPlaylistId = 2
  for (const pl of allPlaylists) {
    const pid = nextPlaylistId++
    const persistent = persistBySource.get(String(pl.sourceId || pl.id))
    const entry = {
      Name: pl.name || 'Playlist',
      'Playlist ID': pid,
      'Playlist Persistent ID': persistent,
      'All Items': true,
    }
    if (pl.isFolder) {
      entry.Folder = true
    } else {
      entry['Playlist Items'] = (pl.trackIds || [])
        .map((tid) => trackNumById.get(String(tid)))
        .filter(Boolean)
        .map((id) => ({ 'Track ID': id }))
    }
    if (pl.parentId && persistBySource.has(String(pl.parentId))) {
      entry['Parent Persistent ID'] = persistBySource.get(String(pl.parentId))
    }
    playlists.push(entry)
  }

  return plist.build({
    'Major Version': 1,
    'Minor Version': 1,
    'Application Version': 'Sound It DJ 1.0',
    Date: new Date(),
    'Features': 5,
    'Show Content Ratings': true,
    Tracks: tracksObj,
    Playlists: playlists,
  })
}

export const appleMusicAdapter = {
  id: SOURCE_FORMATS.APPLE_MUSIC,
  label: 'Apple Music / iTunes',
  extensions: ['.xml', '.plist'],
  canImport: true,
  canExport: true,
  parse: parseAppleMusicXml,
  parseBinary: parseAppleMusicBinary,
  generate: generateAppleMusicXml,
}
