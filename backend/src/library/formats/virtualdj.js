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
  escapeXml,
  parseDuration,
} from '../model.js'
import { locationToPath, pathToLocation } from './rekordboxXml.js'

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ['Song', 'Poi', 'Playlist'].includes(name),
}

function arr(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function attr(node, name, fallback = null) {
  return node?.[`@_${name}`] ?? fallback
}

function attrAny(node, names, fallback = null) {
  for (const name of names) {
    const value = attr(node, name)
    if (value !== null && value !== undefined && value !== '') return value
  }
  return fallback
}

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Parse a VirtualDJ database XML export. */
export function parseVirtualDjXml(xmlContent) {
  const parser = new XMLParser(parserOptions)
  const data = parser.parse(String(xmlContent || '').replace(/^\uFEFF/, ''))
  const root = data.VirtualDJ_Database || data.VirtualDJ_DataBase
  if (!root) throw new Error('Not a VirtualDJ database: missing VirtualDJ_Database root element')

  const library = createLibrary(SOURCE_FORMATS.VIRTUALDJ, {
    sourceVersion: attr(root, 'Version'),
  })
  const songs = arr(root.Song)
  const trackByPath = new Map()

  for (const song of songs) {
    const filePath = attrAny(song, ['FilePath', 'Path'])
    const tags = song.Tags || {}
    const infos = song.Infos || {}
    const scan = song.Scan || {}
    const track = createTrack({
      sourceId: attr(song, 'ID') || `vdj-${library.tracks.length + 1}`,
      title: attrAny(tags, ['Title', 'title']) || (filePath ? basename(filePath) : null),
      artist: attrAny(tags, ['Author', 'Artist', 'artist']),
      album: attrAny(tags, ['Album', 'album']),
      genre: attrAny(tags, ['Genre', 'genre']),
      comment: attrAny(tags, ['Comment', 'comment']),
      key: attrAny(tags, ['Key', 'key']) || attrAny(scan, ['Key', 'key']),
      bpm: num(attrAny(tags, ['Bpm', 'BPM', 'bpm'])) ?? num(attrAny(scan, ['Bpm', 'BPM', 'bpm'])),
      duration: parseDuration(attrAny(infos, ['SongLength', 'songlength', 'Length'])),
      path: filePath || null,
      filename: filePath ? basename(filePath) : null,
      fileSize: num(attr(song, 'FileSize')),
      bitrate: num(attrAny(infos, ['Bitrate', 'BitRate'])),
      sampleRate: num(attrAny(infos, ['SampleRate'])),
      trackNumber: num(attrAny(tags, ['TrackNumber', 'Track'])),
      year: num(attrAny(tags, ['Year'])),
      rating: num(attrAny(tags, ['Rating', 'Stars'])),
      dateAdded: attrAny(song, ['DateAdded', 'Date']),
      playCount: num(attr(song, 'PlayCount')),
      sourceMeta: { user1: attrAny(tags, ['User1']), user2: attrAny(tags, ['User2']) },
    })

    for (const poi of arr(song.Poi)) {
      const type = String(attr(poi, 'Type') || 'cue').toLowerCase()
      const position = num(attr(poi, 'Pos'))
      if (position === null) continue
      const name = attr(poi, 'Name')
      const slot = num(attr(poi, 'Num'))
      const color = attr(poi, 'Color')
      const kind = type.includes('memory') ? CUE_KINDS.MEMORY : CUE_KINDS.HOT
      if (type.includes('loop')) {
        track.loops.push(createLoop({
          slot: slot !== null ? slot + 1 : null,
          name,
          start: position,
          end: num(attr(poi, 'End')) ?? position + 1,
          color,
          sourceId: attr(poi, 'Id') || null,
        }))
      } else {
        track.cues.push(createCue({
          kind,
          slot: kind === CUE_KINDS.HOT && slot !== null ? slot + 1 : null,
          name,
          position,
          color,
          sourceId: attr(poi, 'Id') || null,
        }))
      }
    }

    const beatgrid = song.BeatGrid || song.Beatgrid
    if (beatgrid) {
      track.beatgrid = createBeatgrid({
        bpm: num(attrAny(beatgrid, ['Bpm', 'BPM'])) ?? track.bpm,
        anchor: num(attrAny(beatgrid, ['Anchor', 'Pos'])) ?? 0,
      })
    } else if (track.bpm) {
      track.beatgrid = createBeatgrid({ bpm: track.bpm, anchor: 0 })
    }

    library.tracks.push(track)
    if (filePath) trackByPath.set(filePath.toLowerCase(), track.sourceId)
  }

  // VirtualDJ stores playlists as Playlist elements with Song children. Some
  // builds store a path list instead of references, so both are accepted.
  const playlists = arr(root.Playlist)
  const folderStack = new Map()
  for (const node of playlists) {
    const sourceId = attr(node, 'ID') || `vdj-playlist-${library.playlists.length + 1}`
    const name = attrAny(node, ['Name', 'Title']) || 'Playlist'
    const parentName = attr(node, 'Parent')
    const parentId = parentName ? folderStack.get(String(parentName).toLowerCase()) || null : null
    const isFolder = String(attr(node, 'Folder') || '').toLowerCase() === 'true' || attr(node, 'Type') === 'folder'
    const refs = arr(node.Song)
      .map((song) => attrAny(song, ['FilePath', 'Path']))
      .filter(Boolean)
      .map((filePath) => trackByPath.get(String(filePath).toLowerCase()))
      .filter(Boolean)

    const playlist = createPlaylist({
      sourceId,
      name,
      parentId,
      isFolder,
      trackIds: refs,
      sourceTrackRefs: refs,
    })
    library.playlists.push(playlist)
    if (isFolder) folderStack.set(name.toLowerCase(), sourceId)
  }

  if (!library.playlists.length && library.tracks.length) {
    library.playlists.push(createPlaylist({
      sourceId: 'vdj-all',
      name: 'All Tracks',
      trackIds: library.tracks.map((track) => track.sourceId),
      sourceTrackRefs: library.tracks.map((track) => track.sourceId),
    }))
  }

  return library
}

/** Serialize a normalized library to VirtualDJ XML. */
export function generateVirtualDjXml(library) {
  const tracks = library?.tracks || []
  const trackByRef = new Map()
  tracks.forEach((track, index) => {
    trackByRef.set(track.sourceId || `track-${index}`, index)
  })

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += `<VirtualDJ_Database Version="8.0">\n`
  tracks.forEach((track) => {
    xml += `  <Song FilePath="${escapeXml(track.path || '')}" FileSize="${track.fileSize || 0}" PlayCount="${track.playCount || 0}">\n`
    xml += `    <Tags Author="${escapeXml(track.artist || '')}" Title="${escapeXml(track.title || '')}" Album="${escapeXml(track.album || '')}" Genre="${escapeXml(track.genre || '')}" Comment="${escapeXml(track.comment || '')}"`
    if (track.key) xml += ` Key="${escapeXml(track.key)}"`
    if (track.bpm) xml += ` Bpm="${Number(track.bpm).toFixed(3)}"`
    if (track.rating !== null && track.rating !== undefined) xml += ` Rating="${track.rating}"`
    if (track.year) xml += ` Year="${track.year}"`
    if (track.trackNumber) xml += ` TrackNumber="${track.trackNumber}"`
    xml += '/>\n'
    xml += `    <Infos SongLength="${Number(track.duration || 0).toFixed(3)}" Bitrate="${track.bitrate || 0}" SampleRate="${track.sampleRate || 0}"/>\n`
    if (track.bpm) xml += `    <Scan Bpm="${Number(track.bpm).toFixed(3)}" Key="${escapeXml(track.key || '')}"/>\n`
    if (track.beatgrid?.bpm) {
      xml += `    <BeatGrid Bpm="${Number(track.beatgrid.bpm).toFixed(3)}" Anchor="${Number(track.beatgrid.anchor || 0).toFixed(3)}"/>\n`
    }
    for (const cue of track.cues || []) {
      xml += `    <Poi Type="${cue.kind === CUE_KINDS.MEMORY ? 'memory' : 'cue'}" Pos="${Number(cue.position || 0).toFixed(3)}" Num="${cue.kind === CUE_KINDS.MEMORY ? -1 : Math.max(0, (cue.slot || 1) - 1)}" Name="${escapeXml(cue.name || '')}"${cue.color ? ` Color="${escapeXml(cue.color)}"` : ''}/>\n`
    }
    for (const loop of track.loops || []) {
      xml += `    <Poi Type="loop" Pos="${Number(loop.start || 0).toFixed(3)}" End="${Number(loop.end || 0).toFixed(3)}" Num="${Math.max(0, (loop.slot || 1) - 1)}" Name="${escapeXml(loop.name || '')}"${loop.color ? ` Color="${escapeXml(loop.color)}"` : ''}/>\n`
    }
    xml += '  </Song>\n'
  })

  for (const playlist of library?.playlists || []) {
    if (playlist.isFolder) {
      xml += `  <Playlist Name="${escapeXml(playlist.name)}" Type="folder" Folder="true"/>\n`
      continue
    }
    const refs = playlist.trackIds || playlist.sourceTrackRefs || []
    xml += `  <Playlist Name="${escapeXml(playlist.name)}" Entries="${refs.length}">\n`
    for (const ref of refs) {
      const index = trackByRef.get(ref)
      if (index === undefined) continue
      xml += `    <Song FilePath="${escapeXml(tracks[index].path || '')}"/>\n`
    }
    xml += '  </Playlist>\n'
  }

  xml += '</VirtualDJ_Database>\n'
  return xml
}

export const virtualDjAdapter = {
  id: SOURCE_FORMATS.VIRTUALDJ,
  label: 'VirtualDJ',
  extensions: ['.xml'],
  canImport: true,
  canExport: true,
  parse: parseVirtualDjXml,
  generate: generateVirtualDjXml,
}
