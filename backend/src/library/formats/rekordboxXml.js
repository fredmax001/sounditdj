import { XMLParser } from 'fast-xml-parser'
import path from 'path'

import {
  CUE_KINDS,
  SOURCE_FORMATS,
  createBeatgrid,
  createCue,
  createLibrary,
  createLoop,
  createPlaylist,
  createTrack,
  escapeXml,
  formatDuration,
  normalizeColor,
  parseDuration,
  rgbToHex,
} from '../model.js'

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'TRACK' || name === 'POSITION_MARK' || name === 'NODE' || name === 'TEMPO',
}

function arrayify(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function attr(node, name, fallback = null) {
  if (!node || typeof node !== 'object') return fallback
  return node[`@_${name}`] ?? fallback
}

function text(node, name) {
  if (node === undefined || node === null) return null
  if (typeof node === 'object') return node[name] ?? null
  return null
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function locationToPath(location) {
  if (!location) return null
  let value = String(location)
  value = value.replace(/^file:\/\/localhost/i, '').replace(/^file:\/\//i, '')
  try {
    value = decodeURIComponent(value)
  } catch {
    // Keep the raw value when malformed percent escapes are present.
  }
  if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(value)) value = value.slice(1)
  return value
}

export function pathToLocation(filePath) {
  if (!filePath) return ''
  let normalized = String(filePath).replace(/\\/g, '/')
  if (!normalized.startsWith('/') && !/^[A-Za-z]:/.test(normalized)) normalized = `/${normalized}`
  const encoded = normalized
    .split('/')
    .map((segment) => (segment ? encodeURIComponent(segment) : ''))
    .join('/')
  return process.platform === 'win32' || /^\/[A-Za-z]:/.test(encoded)
    ? `file://localhost/${encoded.replace(/^\//, '')}`
    : `file://localhost${encoded}`
}

function parseRating(value) {
  const rating = toNumber(value)
  if (rating === null) return null
  // Rekordbox XML stores 0, 51, 102, 153, 204, 255 for 0-5 stars.
  if (rating > 5) return Math.round((rating / 255) * 5)
  return rating
}

function xmlColor(node) {
  const colour = attr(node, 'Colour') || attr(node, 'Color')
  if (colour) return normalizeColor(String(colour).replace(/^0x/i, '#'))
  const red = toNumber(attr(node, 'Red'))
  const green = toNumber(attr(node, 'Green'))
  const blue = toNumber(attr(node, 'Blue'))
  if (red !== null && green !== null && blue !== null) {
    return rgbToHex(red * 255, green * 255, blue * 255)
  }
  return null
}

/**
 * Parse a rekordbox collection/playlist XML export.
 * This is deliberately independent of rekordbox's encrypted local database.
 */
export function parseRekordboxXml(xmlContent) {
  const parser = new XMLParser(parserOptions)
  const data = parser.parse(String(xmlContent || '').replace(/^\uFEFF/, ''))
  const root = data.DJ_PLAYLISTS
  if (!root) throw new Error('Not a rekordbox XML file: missing DJ_PLAYLISTS root element')

  const library = createLibrary(SOURCE_FORMATS.REKORDBOX_XML, {
    sourceVersion: attr(root, 'Version'),
  })
  const product = root.PRODUCT || {}
  library.sourceProduct = attr(product, 'Name')
  library.sourceProductVersion = attr(product, 'Version')

  const collectionTracks = arrayify(root.COLLECTION?.TRACK)
  const trackIdMap = new Map()

  for (const node of collectionTracks) {
    const sourceId = String(attr(node, 'TrackID') ?? '')
    if (!sourceId) {
      library.warnings.push('Skipped a collection track with no TrackID')
      continue
    }
    const folder = attr(node, 'Folder')
    const location = attr(node, 'Location')
    const track = createTrack({
      sourceId,
      title: attr(node, 'Name'),
      artist: attr(node, 'Artist'),
      album: attr(node, 'Album'),
      albumArtist: attr(node, 'AlbumArtist'),
      genre: attr(node, 'Genre'),
      comment: attr(node, 'Comments') ?? attr(node, 'Comment'),
      composer: attr(node, 'Composer'),
      bpm: toNumber(attr(node, 'Tempo') ?? attr(node, 'AverageBpm')),
      key: attr(node, 'Tonality'),
      duration: parseDuration(attr(node, 'TotalTime')),
      path: locationToPath(location),
      filename: folder ? path.basename(String(folder).replace(/\\/g, '/')) : null,
      fileSize: toNumber(attr(node, 'Size')),
      bitrate: toNumber(attr(node, 'BitRate')),
      sampleRate: toNumber(attr(node, 'SampleRate')),
      trackNumber: toNumber(attr(node, 'TrackNumber')),
      discNumber: toNumber(attr(node, 'DiscNumber')),
      year: toNumber(attr(node, 'Year')),
      rating: parseRating(attr(node, 'Rating')),
      color: xmlColor(node),
      dateAdded: attr(node, 'DateAdded'),
      playCount: toNumber(attr(node, 'PlayCount')),
      sourceMeta: { kind: attr(node, 'Kind'), location, folder },
    })

    const marks = arrayify(node.POSITION_MARK)
    for (const mark of marks) {
      const start = toNumber(attr(mark, 'Start'))
      if (start === null) continue
      const type = Number(attr(mark, 'Type') ?? 0)
      const num = Number(attr(mark, 'Num') ?? -1)
      const color = xmlColor(mark)
      const name = attr(mark, 'Name')
      if (type === 4) {
        const end = toNumber(attr(mark, 'End'))
        track.loops.push(createLoop({
          slot: num >= 0 ? num + 1 : null,
          name,
          start,
          end: end !== null ? end : start + 1,
          color,
          sourceId: `rb-${sourceId}-loop-${num}`,
        }))
      } else if (type === 0) {
        const isMemory = num === -1
        track.cues.push(createCue({
          kind: isMemory ? CUE_KINDS.MEMORY : CUE_KINDS.HOT,
          slot: isMemory ? null : num + 1,
          name,
          position: start,
          color,
          sourceId: `rb-${sourceId}-cue-${num}`,
        }))
      }
      // Types 1/2/3 (fade in/out/load) have no normalized equivalent yet.
      if (![0, 4].includes(type)) {
        library.unsupported.push({ trackId: sourceId, type: `position-mark-type-${type}` })
      }
    }

    const tempos = arrayify(node.TEMPO)
    const gridTempo = tempos.find((tempo) => toNumber(attr(tempo, 'Inizio')) !== null)
    if (gridTempo) {
      track.beatgrid = createBeatgrid({
        bpm: toNumber(attr(gridTempo, 'Bpm')) ?? track.bpm,
        anchor: toNumber(attr(gridTempo, 'Inizio')) ?? 0,
        timeSignature: Number(attr(gridTempo, 'Metro')) || 4,
        locked: String(attr(gridTempo, 'Locked') ?? '0') === '1',
        beats: null,
      })
    } else if (track.bpm) {
      track.beatgrid = createBeatgrid({ bpm: track.bpm, anchor: 0 })
    }

    if (node.PQTZ || node.PCOB || node.PCO2) {
      library.unsupported.push({ trackId: sourceId, type: 'embedded-pioneer-analysis' })
    }

    library.tracks.push(track)
    trackIdMap.set(sourceId, track)
  }

  const rootPlaylist = root.PLAYLISTS?.NODE
  if (rootPlaylist) {
    parsePlaylistNode(rootPlaylist, library, trackIdMap, null)
  }

  return library
}

function parsePlaylistNode(node, library, trackIdMap, parentId) {
  const nodes = arrayify(node)
  for (const item of nodes) {
    const sourceId = `rb-playlist-${library.playlists.length + 1}`
    const type = Number(attr(item, 'Type') ?? 1)
    const name = attr(item, 'Name') || (type === 0 ? 'Folder' : 'Playlist')
    const refs = arrayify(item.TRACK)
      .map((ref) => String(attr(ref, 'Key') ?? ''))
      .filter(Boolean)

    if (type === 0) {
      const folder = createPlaylist({
        sourceId,
        name,
        parentId,
        isFolder: true,
        children: [],
      })
      library.playlists.push(folder)
      parsePlaylistNode(item.NODE, library, trackIdMap, sourceId)
      folder.children = library.playlists
        .filter((playlist) => playlist.parentId === sourceId)
        .map((playlist) => playlist.sourceId)
      continue
    }

    const playlist = createPlaylist({
      sourceId,
      name,
      parentId,
      isFolder: false,
      sourceTrackRefs: refs,
      trackIds: refs.filter((ref) => trackIdMap.has(ref)),
    })
    const missing = refs.filter((ref) => !trackIdMap.has(ref))
    if (missing.length) {
      library.warnings.push(`Playlist "${name}" references ${missing.length} track(s) missing from COLLECTION`)
    }
    library.playlists.push(playlist)
  }
}

function xmlCueAttrs(cue) {
  const color = cue.color ? normalizeColor(cue.color) : null
  const attrs = [
    `Name="${escapeXml(cue.name || '')}"`,
    `Type="0"`,
    `Start="${Number(cue.position || 0).toFixed(3)}"`,
    `Num="${cue.kind === CUE_KINDS.MEMORY ? -1 : Math.max(0, (cue.slot || 1) - 1)}"`,
  ]
  if (color) {
    const rgb = hexToUnitValues(color)
    attrs.push(`Red="${rgb.red}"`, `Green="${rgb.green}"`, `Blue="${rgb.blue}"`)
  }
  return attrs.join(' ')
}

function hexToUnitValues(hex) {
  const clean = normalizeColor(hex) || '#000000'
  return {
    red: parseInt(clean.slice(1, 3), 16) / 255,
    green: parseInt(clean.slice(3, 5), 16) / 255,
    blue: parseInt(clean.slice(5, 7), 16) / 255,
  }
}

function xmlLoopAttrs(loop) {
  const color = loop.color ? normalizeColor(loop.color) : null
  const attrs = [
    `Name="${escapeXml(loop.name || '')}"`,
    `Type="4"`,
    `Start="${Number(loop.start || 0).toFixed(3)}"`,
    `End="${Number(loop.end || 0).toFixed(3)}"`,
    `Num="${Math.max(0, (loop.slot || 1) - 1)}"`,
  ]
  if (color) {
    const rgb = hexToUnitValues(color)
    attrs.push(`Red="${rgb.red}"`, `Green="${rgb.green}"`, `Blue="${rgb.blue}"`)
  }
  return attrs.join(' ')
}

function isSafeXmlChar(code) {
  return code === 0x9 || code === 0xa || code === 0xd || code >= 0x20
}

function sanitizeXmlText(value) {
  return String(value || '')
    .split('')
    .filter((char) => isSafeXmlChar(char.charCodeAt(0)))
    .join('')
}

/**
 * Serialize a normalized library to rekordbox XML 1.0.0.
 * TrackIDs are assigned deterministically from array order.
 */
export function generateRekordboxXml(library) {
  const tracks = library?.tracks || []
  const playlistById = new Map((library?.playlists || []).map((playlist) => [playlist.sourceId, playlist]))
  const trackKey = new Map()
  tracks.forEach((track, index) => trackKey.set(track.sourceId || `track-${index}`, index + 1))

  const usedKeys = new Set()
  for (const track of tracks) {
    const key = trackKey.get(track.sourceId)
    usedKeys.add(key)
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<DJ_PLAYLISTS Version="1.0.0">\n'
  xml += '  <PRODUCT Name="Sound It DJ" Version="1.0.0" Company="Sound It DJ"/>\n'
  xml += `  <COLLECTION Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    const trackId = index + 1
    const attrs = [
      `TrackID="${trackId}"`,
      `Name="${xmlAttr(track.title)}"`,
      `Artist="${xmlAttr(track.artist)}"`,
      `Album="${xmlAttr(track.album)}"`,
      `Genre="${xmlAttr(track.genre)}"`,
      `Comments="${xmlAttr(track.comment)}"`,
      `TotalTime="${formatDuration(track.duration)}"`,
    ]
    if (track.bpm) attrs.push(`Tempo="${Number(track.bpm).toFixed(2)}"`)
    if (track.key) attrs.push(`Tonality="${xmlAttr(track.key)}"`)
    if (track.filename) attrs.push(`Folder="${xmlAttr(path.dirname(track.path || '') + '/' + track.filename)}"`)
    if (track.rating !== null && track.rating !== undefined) attrs.push(`Rating="${Math.round(Number(track.rating) * 51)}"`)
    if (track.dateAdded) attrs.push(`DateAdded="${xmlAttr(track.dateAdded)}"`)
    if (track.trackNumber) attrs.push(`TrackNumber="${track.trackNumber}"`)
    if (track.discNumber) attrs.push(`DiscNumber="${track.discNumber}"`)
    if (track.year) attrs.push(`Year="${track.year}"`)
    if (track.color) attrs.push(`Colour="${normalizeColor(track.color)}"`)
    if (track.fileSize) attrs.push(`Size="${track.fileSize}"`)
    if (track.bitrate) attrs.push(`BitRate="${track.bitrate}"`)
    if (track.sampleRate) attrs.push(`SampleRate="${track.sampleRate}"`)
    attrs.push(`Location="${xmlAttr(pathToLocation(track.path || ''))}"`)

    xml += `    <TRACK ${attrs.join(' ')}>\n`

    if (track.beatgrid?.bpm) {
      const grid = track.beatgrid
      xml += `      <TEMPO Inizio="${Number(grid.anchor || 0).toFixed(3)}" Bpm="${Number(grid.bpm).toFixed(2)}" Metro="${grid.timeSignature || 4}" Battito="1"/>\n`
    }

    for (const cue of track.cues || []) {
      xml += `      <POSITION_MARK ${xmlCueAttrs(cue)}/>\n`
    }
    for (const loop of track.loops || []) {
      xml += `      <POSITION_MARK ${xmlLoopAttrs(loop)}/>\n`
    }

    xml += '    </TRACK>\n'
  })

  xml += '  </COLLECTION>\n'
  xml += '  <PLAYLISTS>\n'
  xml += '    <NODE Type="0" Name="ROOT" Count="1">\n'

  const roots = (library?.playlists || []).filter(
    (playlist) => !playlist.parentId || !playlistById.has(playlist.parentId),
  )
  // Folders are emitted only once, never duplicated for each child.
  for (const node of roots) {
    xml += serializePlaylistNode(node, library, playlistById, trackKey, 3)
  }

  xml += '    </NODE>\n'
  xml += '  </PLAYLISTS>\n'
  xml += '</DJ_PLAYLISTS>\n'
  return xml
}

function serializePlaylistNode(node, library, playlistById, trackKey, depth) {
  const indent = '  '.repeat(depth)
  if (!node) return ''
  if (node.isFolder) {
    const children = (library.playlists || []).filter((playlist) => playlist.parentId === node.sourceId)
    let xml = `${indent}<NODE Type="0" Name="${xmlAttr(node.name)}" Count="${children.length}">\n`
    for (const child of children) {
      xml += serializePlaylistNode(child, library, playlistById, trackKey, depth + 1)
    }
    xml += `${indent}</NODE>\n`
    return xml
  }

  const refs = (node.sourceTrackRefs || node.trackIds || [])
    .map((ref) => trackKey.get(ref))
    .filter((key) => key !== undefined)
  let xml = `${indent}<NODE Name="${xmlAttr(node.name)}" Type="1" KeyType="0" Entries="${refs.length}">\n`
  for (const key of refs) {
    xml += `${indent}  <TRACK Key="${key}"/>\n`
  }
  xml += `${indent}</NODE>\n`
  return xml
}

function xmlAttr(value) {
  return escapeXml(sanitizeXmlText(value))
}

export const rekordboxXmlAdapter = {
  id: SOURCE_FORMATS.REKORDBOX_XML,
  label: 'Rekordbox XML',
  extensions: ['.xml'],
  canImport: true,
  canExport: true,
  parse: parseRekordboxXml,
  generate: generateRekordboxXml,
}
