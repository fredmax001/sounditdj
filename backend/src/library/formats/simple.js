import path from 'path'
import fs from 'fs-extra'
import { XMLParser } from 'fast-xml-parser'

import {
  CUE_KINDS,
  SOURCE_FORMATS,
  basename,
  createBeatgrid,
  createCue,
  createLibrary,
  createLoop,
  createPlaylist,
  createTrack,
  parseDuration,
} from '../model.js'

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.aiff', '.aif', '.m4a', '.aac', '.ogg', '.opus', '.wma'])

function safeDecode(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value).replace(/\+/g, '%20'))
  } catch {
    return String(value)
  }
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

export function parseM3u(content, options = {}) {
  const library = createLibrary(SOURCE_FORMATS.M3U)
  const baseDir = options.baseDir || null
  const lines = String(content || '').split(/\r?\n/)
  let current = null
  let playlistName = options.name || 'M3U Playlist'

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#EXTM3U')) continue
    if (line.startsWith('#PLAYLIST:')) {
      playlistName = line.slice('#PLAYLIST:'.length).trim() || playlistName
      continue
    }
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/^#EXTINF:(-?\d+(?:\.\d+)?)\s*,(.*)$/)
      if (match) {
        const titlePart = match[2].trim()
        const separator = titlePart.indexOf(' - ')
        current = {
          duration: Number(match[1]) > 0 ? Number(match[1]) : null,
          artist: separator >= 0 ? titlePart.slice(0, separator).trim() : null,
          title: separator >= 0 ? titlePart.slice(separator + 3).trim() : titlePart || null,
        }
      }
      continue
    }
    if (line.startsWith('#')) continue

    const filePath = safeDecode(line)
    const resolvedPath = resolvePlaylistPath(filePath, baseDir)
    const track = createTrack({
      sourceId: `m3u-${library.tracks.length + 1}`,
      title: current?.title || basename(resolvedPath).replace(/\.[^.]+$/, ''),
      artist: current?.artist || null,
      duration: current?.duration || null,
      path: resolvedPath,
      filename: basename(resolvedPath),
    })
    library.tracks.push(track)
    current = null
  }

  library.playlists.push(createPlaylist({
    sourceId: 'm3u-playlist',
    name: playlistName,
    trackIds: library.tracks.map((track) => track.sourceId),
    sourceTrackRefs: library.tracks.map((track) => track.sourceId),
  }))
  return library
}

function resolvePlaylistPath(filePath, baseDir) {
  if (!filePath) return ''
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('/') || /^[a-z]+:\/\//i.test(filePath)) {
    return filePath.replace(/^file:\/\//i, '')
  }
  return baseDir ? path.resolve(baseDir, filePath) : filePath
}

export function parseCsv(content, options = {}) {
  const library = createLibrary(SOURCE_FORMATS.CSV)
  const lines = String(content || '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return library
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().trim())
  const baseDir = options.baseDir || null

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index])
    const row = {}
    headers.forEach((header, column) => {
      row[header] = values[column] || ''
    })
    const filePath = resolvePlaylistPath(
      safeDecode(row.filename || row.file || row.location || row.path || ''),
      baseDir,
    )
    const track = createTrack({
      sourceId: row.id || `csv-${library.tracks.length + 1}`,
      title: safeDecode(row.title || row.name || row.track || '') || (filePath ? basename(filePath) : null),
      artist: safeDecode(row.artist || row.author || '') || null,
      album: safeDecode(row.album || '') || null,
      genre: row.genre || null,
      comment: row.comment || row.comments || null,
      bpm: row.bpm ? Number(row.bpm) : null,
      key: row.key || row.tonality || null,
      duration: row.duration ? parseDuration(row.duration) : null,
      rating: row.rating ? Number(row.rating) : null,
      color: row.color || row.colour || null,
      path: filePath || null,
      filename: filePath ? basename(filePath) : null,
    })

    // Optional cue columns: cue1,cue1_time or cue_1,cue_1_time.
    for (let cueIndex = 1; cueIndex <= 32; cueIndex += 1) {
      const name = row[`cue${cueIndex}`] || row[`cue_${cueIndex}`]
      const time = row[`cue${cueIndex}_time`] || row[`cue_${cueIndex}_time`] || row[`cue${cueIndex}_position`]
      if (time !== undefined && time !== '') {
        const seconds = parseDuration(time)
        if (seconds !== null) {
          track.cues.push(createCue({
            kind: CUE_KINDS.HOT,
            slot: cueIndex,
            name: name || null,
            position: seconds,
            color: row[`cue${cueIndex}_color`] || null,
          }))
        }
      }
    }

    library.tracks.push(track)
  }

  library.playlists.push(createPlaylist({
    sourceId: 'csv-playlist',
    name: options.name || 'CSV Playlist',
    trackIds: library.tracks.map((track) => track.sourceId),
    sourceTrackRefs: library.tracks.map((track) => track.sourceId),
  }))
  return library
}

export function parseJson(content) {
  const data = typeof content === 'string' ? JSON.parse(content) : content
  if (data?.modelVersion && Array.isArray(data.tracks)) {
    // Already a Sound It DJ document. Keep unknown fields intact.
    const library = createLibrary(SOURCE_FORMATS.JSON, data)
    if (!library.playlists.some((playlist) => !playlist.isFolder)) {
      library.playlists.push(createPlaylist({
        sourceId: 'json-playlist',
        name: 'Imported Playlist',
        trackIds: library.tracks.map((track) => track.sourceId),
        sourceTrackRefs: library.tracks.map((track) => track.sourceId),
      }))
    }
    return library
  }

  const tracks = Array.isArray(data) ? data : data.tracks || data.playlist?.tracks || []
  const library = createLibrary(SOURCE_FORMATS.JSON)
  for (const item of tracks) {
    const track = createTrack({
      sourceId: item.id || item.sourceId || `json-${library.tracks.length + 1}`,
      title: item.title || item.name || null,
      artist: item.artist || null,
      album: item.album || null,
      genre: item.genre || null,
      comment: item.comment || item.comments || null,
      bpm: item.bpm || null,
      key: item.key || null,
      duration: item.duration || null,
      path: item.path || item.filePath || item.location || null,
      filename: basename(item.path || item.filePath || item.location || '') || null,
      rating: item.rating ?? null,
      color: item.color || null,
      cues: Array.isArray(item.cues)
        ? item.cues.map((cue) => createCue({ ...cue, position: cue.position ?? cue.start ?? 0 }))
        : [],
      loops: Array.isArray(item.loops)
        ? item.loops.map((loop) => createLoop({ ...loop, start: loop.start ?? 0, end: loop.end ?? 0 }))
        : [],
      beatgrid: item.beatgrid ? createBeatgrid(item.beatgrid) : null,
    })
    library.tracks.push(track)
  }
  library.playlists.push(createPlaylist({
    sourceId: 'json-playlist',
    name: data.name || 'Imported Playlist',
    trackIds: library.tracks.map((track) => track.sourceId),
    sourceTrackRefs: library.tracks.map((track) => track.sourceId),
  }))
  return library
}

/** Import a Traktor collection. Performance data is read, never written. */
export function parseTraktorNml(content) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    isArray: (name) => ['ENTRY', 'CUE_V2', 'NODE'].includes(name),
  })
  const data = parser.parse(String(content || '').replace(/^\uFEFF/, ''))
  const nml = data.NML
  if (!nml) throw new Error('Not a Traktor NML file: missing NML root element')
  const library = createLibrary(SOURCE_FORMATS.TRAKTOR, { sourceVersion: nml?.['@_VERSION'] })
  const entries = Array.isArray(nml.COLLECTION?.ENTRY) ? nml.COLLECTION.ENTRY : [nml.COLLECTION?.ENTRY].filter(Boolean)
  const trackByKey = new Map()

  for (const entry of entries) {
    const location = entry.LOCATION || {}
    const info = entry.INFO || {}
    const tempo = entry.TEMPO || {}
    const album = entry.ALBUM || {}
    const dir = safeDecode(location?.['@_DIR'] || '')
    const file = safeDecode(location?.['@_FILE'] || '')
    const filePath = dir && file ? path.posix.join(dir, file) : file
    const track = createTrack({
      sourceId: entry?.['@_TITLE'] ? `${entry['@_TITLE']}-${library.tracks.length}` : `traktor-${library.tracks.length + 1}`,
      title: entry?.['@_TITLE'] || (file ? basename(file) : null),
      artist: entry?.['@_ARTIST'] || null,
      album: album?.['@_TITLE'] || null,
      genre: info?.['@_GENRE'] || null,
      comment: info?.['@_COMMENT'] || null,
      key: info?.['@_KEY'] || null,
      bpm: tempo?.['@_BPM'] ? Number(tempo['@_BPM']) : null,
      duration: info?.['@_PLAYTIME'] ? Number(info['@_PLAYTIME']) : null,
      path: filePath || null,
      filename: file || null,
      rating: info?.['@_RATING'] ? Math.round(Number(info['@_RATING']) / 51) : null,
      sourceMeta: { key: entry?.['@_TITLE'] || null, location },
    })
    const cueEntries = Array.isArray(entry.CUE_V2) ? entry.CUE_V2 : [entry.CUE_V2].filter(Boolean)
    for (const cue of cueEntries) {
      const start = Number(cue?.['@_START'])
      if (!Number.isFinite(start)) continue
      const type = Number(cue?.['@_TYPE'] ?? 0)
      const hotcue = Number(cue?.['@_HOTCUE'] ?? -1)
      const name = cue?.['@_NAME'] || null
      if (type === 4) {
        track.loops.push(createLoop({
          slot: hotcue >= 0 ? hotcue + 1 : null,
          name,
          start,
          end: start + (Number(cue?.['@_LEN']) || 1),
        }))
      } else {
        track.cues.push(createCue({
          kind: hotcue >= 0 ? CUE_KINDS.HOT : CUE_KINDS.MEMORY,
          slot: hotcue >= 0 ? hotcue + 1 : null,
          name,
          position: start,
        }))
      }
    }
    if (track.bpm) track.beatgrid = createBeatgrid({ bpm: track.bpm, anchor: Number(tempo?.['@_BPM_QUALITY'] ? 0 : 0) })
    library.tracks.push(track)
    trackByKey.set(entry?.['@_TITLE'] || filePath, track.sourceId)
  }

  const rootNodes = Array.isArray(nml.PLAYLISTS?.NODE) ? nml.PLAYLISTS.NODE : [nml.PLAYLISTS?.NODE].filter(Boolean)
  for (const node of rootNodes) {
    walkTraktorPlaylist(node, library, trackByKey, null)
  }
  if (!library.playlists.some((playlist) => !playlist.isFolder)) {
    library.playlists.push(createPlaylist({
      sourceId: 'traktor-all',
      name: 'All Tracks',
      trackIds: library.tracks.map((track) => track.sourceId),
      sourceTrackRefs: library.tracks.map((track) => track.sourceId),
    }))
  }
  return library
}

function walkTraktorPlaylist(node, library, trackByKey, parentId) {
  const nodes = Array.isArray(node) ? node : [node]
  for (const item of nodes) {
    if (!item) continue
    const type = item?.['@_TYPE']
    const sourceId = `traktor-playlist-${library.playlists.length + 1}`
    if (type === 'folder') {
      library.playlists.push(createPlaylist({
        sourceId,
        name: item?.['@_NAME'] || 'Folder',
        parentId,
        isFolder: true,
      }))
      walkTraktorPlaylist(item.NODE, library, trackByKey, sourceId)
      continue
    }
    const keys = (Array.isArray(item.ENTRY) ? item.ENTRY : [item.ENTRY].filter(Boolean))
      .map((entry) => entry?.PRIMARYKEY?.['@_KEY'])
      .filter(Boolean)
    const trackIds = keys.map((key) => trackByKey.get(key)).filter(Boolean)
    library.playlists.push(createPlaylist({
      sourceId,
      name: item?.['@_NAME'] || 'Playlist',
      parentId,
      trackIds,
      sourceTrackRefs: trackIds,
    }))
  }
}

/** Walk a folder and build a normalized library with optional metadata reads. */
export async function loadFolderLibrary(folderPath, options = {}) {
  const library = createLibrary(SOURCE_FORMATS.FOLDER)
  const recursive = options.recursive !== false
  const maxFiles = options.maxFiles || 100000
  const files = await collectAudioFiles(folderPath, recursive, maxFiles)
  const metadata = options.readMetadata ? await import('music-metadata') : null
  for (const filePath of files) {
    const track = createTrack({
      sourceId: `folder-${library.tracks.length + 1}`,
      title: basename(filePath).replace(/\.[^.]+$/, ''),
      path: filePath,
      filename: basename(filePath),
    })
    if (metadata) {
      try {
        const parsed = await metadata.parseFile(filePath)
        track.title = parsed.common.title || track.title
        track.artist = parsed.common.artist || null
        track.album = parsed.common.album || null
        track.genre = parsed.common.genre?.[0] || null
        track.bpm = parsed.common.bpm || null
        track.key = parsed.common.key || null
        track.duration = parsed.format.duration || null
        track.bitrate = parsed.format.bitrate ? Math.round(parsed.format.bitrate / 1000) : null
        track.sampleRate = parsed.format.sampleRate || null
        track.trackNumber = parsed.common.track?.no || null
        track.year = parsed.common.year || null
      } catch {
        // Unreadable tags do not make the file unusable.
      }
    }
    library.tracks.push(track)
  }
  library.playlists.push(createPlaylist({
    sourceId: 'folder-all',
    name: path.basename(folderPath),
    trackIds: library.tracks.map((track) => track.sourceId),
    sourceTrackRefs: library.tracks.map((track) => track.sourceId),
  }))
  return library
}

async function collectAudioFiles(root, recursive, maxFiles) {
  const results = []
  async function walk(dir) {
    if (results.length >= maxFiles) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive && !entry.name.startsWith('.')) await walk(fullPath)
      } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath)
      }
    }
  }
  await walk(root)
  return results
}

function escapeXmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Generate a Native Instruments Traktor collection.nml file from a normalized library.
 */
export function generateTraktorNml(library) {
  const tracks = library.tracks || []
  const trackKeyById = new Map()
  const entryLines = []

  for (const track of tracks) {
    const rawPath = String(track.path || '').replace(/\\/g, '/')
    const volumeMatch = rawPath.match(/^([A-Za-z]:)(.*)$/)
    const volume = volumeMatch ? volumeMatch[1] : 'Macintosh HD'
    const normalizedPath = volumeMatch ? volumeMatch[2] : rawPath
    const dirName = path.posix.dirname(normalizedPath)
    const fileName = path.posix.basename(normalizedPath) || track.filename || `${track.title || 'Track'}.mp3`
    const traktorDir = `/${dirName.replace(/^\/+/, '').replace(/\//g, '/:')}/:`.replace(/^\/:\/:$/, '/:')
    const key = `${volume}${traktorDir}${fileName}`
    trackKeyById.set(String(track.sourceId || track.id), key)

    const cues = []
    if (track.beatgrid?.bpm || track.bpm) {
      const anchorMs = Math.round(Number(track.beatgrid?.anchor || 0) * 1000)
      cues.push(`      <CUE_V2 NAME="AutoGrid" DISPL_ORDER="0" TYPE="4" START="${anchorMs}" LEN="0" REPEATS="-1" HOTCUE="0"/>`)
    }
    for (const [idx, cue] of (track.cues || []).entries()) {
      const slot = cue.slot ?? idx
      const startMs = Math.round(Number(cue.position || 0) * 1000)
      cues.push(`      <CUE_V2 NAME="${escapeXmlAttr(cue.name || `Cue ${slot + 1}`)}" DISPL_ORDER="0" TYPE="0" START="${startMs}" LEN="0" REPEATS="-1" HOTCUE="${Math.max(0, Math.min(7, slot))}"/>`)
    }
    for (const [idx, loop] of (track.loops || []).entries()) {
      const startMs = Math.round(Number(loop.start || 0) * 1000)
      const lenMs = Math.max(0, Math.round((Number(loop.end || 0) - Number(loop.start || 0)) * 1000))
      const slot = loop.slot ?? Math.min(7, (track.cues?.length || 0) + idx)
      cues.push(`      <CUE_V2 NAME="${escapeXmlAttr(loop.name || `Loop ${idx + 1}`)}" DISPL_ORDER="0" TYPE="5" START="${startMs}" LEN="${lenMs}" REPEATS="-1" HOTCUE="${Math.max(0, Math.min(7, slot))}"/>`)
    }

    const attrs = [
      `TITLE="${escapeXmlAttr(track.title || fileName)}"`,
      track.artist ? `ARTIST="${escapeXmlAttr(track.artist)}"` : null,
    ].filter(Boolean).join(' ')

    entryLines.push(
      `    <ENTRY ${attrs}>`,
      `      <LOCATION DIR="${escapeXmlAttr(traktorDir)}" FILE="${escapeXmlAttr(fileName)}" VOLUME="${escapeXmlAttr(volume)}"/>`,
      track.album ? `      <ALBUM TITLE="${escapeXmlAttr(track.album)}"/>` : null,
      `      <INFO PLAYTIME="${Math.round(Number(track.duration || 0))}"${track.genre ? ` GENRE="${escapeXmlAttr(track.genre)}"` : ''}${track.comment ? ` COMMENT="${escapeXmlAttr(track.comment)}"` : ''}${track.key ? ` KEY="${escapeXmlAttr(track.key)}"` : ''}/>`,
      track.bpm ? `      <TEMPO BPM="${Number(track.bpm).toFixed(2)}" BPM_QUALITY="100"/>` : null,
      ...cues,
      `    </ENTRY>`,
    )
  }

  const playlists = (library.playlists || []).filter((pl) => !pl.isFolder)
  const playlistNodes = playlists.map((pl) => {
    const entries = (pl.trackIds || [])
      .map((tid) => trackKeyById.get(String(tid)))
      .filter(Boolean)
      .map((key) => `          <ENTRY><PRIMARYKEY TYPE="TRACK" KEY="${escapeXmlAttr(key)}"/></ENTRY>`)
    return [
      `        <NODE TYPE="PLAYLIST" NAME="${escapeXmlAttr(pl.name || 'Playlist')}">`,
      `          <PLAYLIST ENTRIES="${entries.length}" TYPE="LIST" UUID="${escapeXmlAttr(pl.sourceId || pl.id || pl.name)}">`,
      ...entries,
      `          </PLAYLIST>`,
      `        </NODE>`,
    ].join('\n')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<NML VERSION="19">',
    '  <HEAD COMPANY="Sound It DJ" PROGRAM="Sound It DJ"/>',
    `  <COLLECTION ENTRIES="${tracks.length}">`,
    ...entryLines.filter(Boolean),
    '  </COLLECTION>',
    '  <PLAYLISTS>',
    '    <NODE TYPE="FOLDER" NAME="$ROOT">',
    `      <SUBNODES COUNT="${playlistNodes.length}">`,
    ...playlistNodes,
    '      </SUBNODES>',
    '    </NODE>',
    '  </PLAYLISTS>',
    '</NML>',
  ].join('\n')
}

export const simpleAdapters = {
  m3u: { id: SOURCE_FORMATS.M3U, label: 'M3U Playlist', canImport: true, canExport: true, parse: parseM3u },
  csv: { id: SOURCE_FORMATS.CSV, label: 'CSV', canImport: true, canExport: true, parse: parseCsv },
  json: { id: SOURCE_FORMATS.JSON, label: 'Sound It DJ JSON', canImport: true, canExport: true, parse: parseJson },
  traktor: { id: SOURCE_FORMATS.TRAKTOR, label: 'Traktor', canImport: true, canExport: true, parse: parseTraktorNml, generate: generateTraktorNml },
  folder: { id: SOURCE_FORMATS.FOLDER, label: 'Folder', canImport: true, canExport: false, load: loadFolderLibrary },
}
