import fs from 'fs-extra'
import path from 'path'

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
  normalizeColor,
  parseDuration,
  rgbToHex,
} from '../model.js'

// ── Serato binary primitives ────────────────────────────────────────────────

function readU32BE(buffer, offset) {
  if (offset + 4 > buffer.length) return null
  return buffer.readUInt32BE(offset)
}

function decodeUtf16Be(buffer) {
  if (!buffer || buffer.length === 0) return ''
  const even = buffer.length - (buffer.length % 2)
  const swapped = Buffer.from(buffer.subarray(0, even))
  swapped.swap16()
  return swapped.toString('utf16le').replace(/\0+$/g, '')
}

function decodeStringTag(value) {
  if (!value || value.length === 0) return ''
  if (value.length >= 2 && value[0] === 0) return decodeUtf16Be(value)
  return value.toString('utf8').replace(/\0+$/g, '')
}

/**
 * Serato stores macOS paths relative to the boot volume ("Users/name/...").
 * Normalize them so file existence checks and relinking work.
 */
function normalizeSeratoFilePath(filePath) {
  let value = String(filePath || '').replace(/\\/g, '/')
  if (!value) return value
  if (process.platform === 'win32') {
    if (/^[A-Za-z]:/.test(value)) return value
    return value
  }
  if (!value.startsWith('/')) value = `/${value}`
  return value
}

function encodeUtf16Be(value) {
  const text = String(value || '')
  const buffer = Buffer.alloc(text.length * 2)
  for (let index = 0; index < text.length; index += 1) {
    buffer.writeUInt16BE(text.charCodeAt(index), index * 2)
  }
  return buffer
}

/**
 * Read the tagged chunks Serato uses. Each chunk is a 4-byte ASCII tag, a
 * big-endian uint32 length and a raw payload.
 */
export function readTaggedChunks(buffer, start = 0, end = buffer.length) {
  const chunks = []
  let offset = start
  while (offset + 8 <= end) {
    const tag = buffer.subarray(offset, offset + 4).toString('ascii')
    const length = buffer.readUInt32BE(offset + 4)
    const payloadStart = offset + 8
    const payloadEnd = payloadStart + length
    if (payloadEnd > end + 1 || length > end - payloadStart + 1) {
      // Truncated data is common in damaged libraries. Stop rather than guess.
      break
    }
    chunks.push({ tag, length, payload: buffer.subarray(payloadStart, Math.min(payloadEnd, end)) })
    offset = payloadEnd
  }
  return chunks
}

function parseTaggedFieldMap(buffer) {
  const fields = {}
  for (const chunk of readTaggedChunks(buffer)) {
    fields[chunk.tag] = chunk.payload
  }
  return fields
}

export function parseSeratoDatabase(buffer) {
  const library = createLibrary(SOURCE_FORMATS.SERATO)
  const chunks = readTaggedChunks(buffer)
  library.sourceVersion = decodeStringTag(chunks.find((chunk) => chunk.tag === 'vrsn')?.payload)

  for (const chunk of chunks) {
    if (chunk.tag !== 'otrk') continue
    const fields = parseTaggedFieldMap(chunk.payload)
    const filePath = normalizeSeratoFilePath(decodeStringTag(fields.pfil))
    if (!filePath) continue

    const rawLabel = fields.ulbl && fields.ulbl.length >= 4 ? fields.ulbl : null
    let color = null
    if (rawLabel) {
      const alpha = rawLabel[0]
      const red = rawLabel[1]
      const green = rawLabel[2]
      const blue = rawLabel[3]
      // Serato writes 0x00FFFFFF when the track has no label. Only treat a
      // label as present when it differs from that sentinel.
      if (!(red === 255 && green === 255 && blue === 255) && (alpha !== 0 || red || green || blue)) {
        color = rgbToHex(red, green, blue)
      }
    }

    const track = createTrack({
      sourceId: `serato-${library.tracks.length + 1}`,
      title: decodeStringTag(fields.tsng) || basename(filePath),
      artist: decodeStringTag(fields.tart),
      album: decodeStringTag(fields.talb),
      genre: decodeStringTag(fields.tgen),
      comment: decodeStringTag(fields.tcom),
      composer: decodeStringTag(fields.tcmp),
      key: decodeStringTag(fields.tkey),
      bpm: fields.tbpm ? Number(decodeStringTag(fields.tbpm)) || null : null,
      duration: parseDuration(decodeStringTag(fields.tlen)),
      path: filePath,
      filename: basename(filePath),
      fileSize: parseSeratoSize(decodeStringTag(fields.tsiz)),
      bitrate: parseSeratoBitrate(decodeStringTag(fields.tbit)),
      sampleRate: parseSeratoSampleRate(decodeStringTag(fields.tsmp)),
      trackNumber: fields.utkn ? Number(decodeStringTag(fields.utkn)) || null : null,
      dateAdded: parseSeratoDate(decodeStringTag(fields.tadd)),
      color,
      sourceMeta: {
        type: decodeStringTag(fields.ttyp),
        id: decodeStringTag(fields.tiid),
        tags: Object.fromEntries(
          Object.entries(fields)
            .filter(([tag]) => !tag.startsWith('b') && !tag.startsWith('u'))
            .map(([tag, payload]) => [tag, decodeStringTag(payload)]),
        ),
      },
    })
    library.tracks.push(track)
  }

  return library
}

function parseSeratoSize(value) {
  if (!value) return null
  const match = String(value).match(/([\d.]+)\s*(KB|MB|GB)/i)
  if (!match) return null
  const multiplier = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[match[2].toUpperCase()]
  return Math.round(Number(match[1]) * multiplier)
}

function parseSeratoBitrate(value) {
  if (!value) return null
  const match = String(value).match(/([\d.]+)\s*kbps/i)
  return match ? Math.round(Number(match[1])) : null
}

function parseSeratoSampleRate(value) {
  if (!value) return null
  const match = String(value).match(/([\d.]+)\s*k/i)
  return match ? Math.round(Number(match[1]) * 1000) : null
}

function parseSeratoDate(value) {
  if (!value) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  const date = new Date(number * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function parseSeratoCrate(buffer) {
  const paths = []
  const chunks = readTaggedChunks(buffer)
  for (const chunk of chunks) {
    if (chunk.tag !== 'otrk') continue
    const fields = parseTaggedFieldMap(chunk.payload)
    const filePath = normalizeSeratoFilePath(decodeStringTag(fields.ptrk || fields.pfil))
    if (filePath) paths.push(filePath)
  }
  return paths
}

export function generateSeratoCrate(trackPaths, version = '1.0/Serato ScratchLive Crate') {
  const chunks = []
  chunks.push(wrapTag('vrsn', encodeUtf16Be(version)))
  for (const filePath of trackPaths) {
    const ptrk = Buffer.concat([
      Buffer.from('ptrk', 'ascii'),
      u32(encodeUtf16Be(filePath).length),
      encodeUtf16Be(filePath),
    ])
    chunks.push(wrapTag('otrk', ptrk))
  }
  return Buffer.concat(chunks)
}

function u32(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value >>> 0, 0)
  return buffer
}

function wrapTag(tag, payload) {
  return Buffer.concat([Buffer.from(tag, 'ascii'), u32(payload.length), payload])
}

// ── ID3 GEOB / Serato performance tags ──────────────────────────────────────

function syncsafeToInt(buffer) {
  return (buffer[0] << 21) | (buffer[1] << 14) | (buffer[2] << 7) | buffer[3]
}

function intToSyncsafe(value) {
  const buffer = Buffer.alloc(4)
  buffer[0] = (value >> 21) & 0x7f
  buffer[1] = (value >> 14) & 0x7f
  buffer[2] = (value >> 7) & 0x7f
  buffer[3] = value & 0x7f
  return buffer
}

function readNullTerminated(buffer, start) {
  const end = buffer.indexOf(0, start)
  if (end === -1) return { value: buffer.subarray(start), next: buffer.length }
  return { value: buffer.subarray(start, end), next: end + 1 }
}

export function parseId3Frames(buffer) {
  if (!buffer || buffer.length < 10 || buffer.subarray(0, 3).toString('ascii') !== 'ID3') return null
  const version = buffer[3]
  const revision = buffer[4]
  const flags = buffer[5]
  const tagSize = syncsafeToInt(buffer.subarray(6, 10))
  const end = Math.min(buffer.length, 10 + tagSize)
  const frames = []
  let offset = 10

  // Extended header: skip it rather than misinterpret its contents.
  if (flags & 0x40) {
    if (version === 4) {
      const extendedSize = syncsafeToInt(buffer.subarray(offset, offset + 4))
      offset += extendedSize
    } else {
      offset += 4 + buffer.readUInt32BE(offset)
    }
  }

  while (offset + 10 <= end) {
    const id = buffer.subarray(offset, offset + 4).toString('ascii')
    if (!/^[A-Z0-9]{4}$/.test(id)) break
    const size = version === 4
      ? syncsafeToInt(buffer.subarray(offset + 4, offset + 8))
      : buffer.readUInt32BE(offset + 4)
    const frameFlags = buffer.readUInt16BE(offset + 8)
    const payloadStart = offset + 10
    const payloadEnd = payloadStart + size
    if (size < 0 || payloadEnd > end) break
    frames.push({ id, size, flags: frameFlags, payload: buffer.subarray(payloadStart, payloadEnd), offset })
    offset = payloadEnd
  }

  return {
    version,
    revision,
    flags,
    size: tagSize,
    frames,
    audioStart: 10 + tagSize,
    raw: buffer,
  }
}

export function parseGeob(payload) {
  if (!payload || payload.length === 0) return null
  const encoding = payload[0]
  let offset = 1
  const mime = readNullTerminated(payload, offset)
  offset = mime.next
  const filename = readNullTerminated(payload, offset)
  offset = filename.next
  const description = readNullTerminated(payload, offset)
  offset = description.next
  const decode = encoding === 1 || encoding === 2
    ? (buf) => buf.subarray(0, buf.length - (buf.length % 2)).swap16().toString('utf16le')
    : (buf) => buf.toString('utf8')
  return {
    encoding,
    mime: mime.value.toString('ascii'),
    filename: decode(filename.value),
    description: decode(description.value),
    data: payload.subarray(offset),
  }
}

export function extractGeobs(buffer) {
  const tag = parseId3Frames(buffer)
  if (!tag) return []
  return tag.frames
    .filter((frame) => frame.id === 'GEOB')
    .map((frame) => parseGeob(frame.payload))
    .filter(Boolean)
}

function decodeMarkers2Payload(data) {
  // ID3 GEOB data starts with the 01 01 marker version followed by base64.
  if (data.length < 2 || data[0] !== 1 || data[1] !== 1) return null
  let encoded = data.subarray(2).toString('ascii').replace(/\0+$/g, '').replace(/\s+/g, '')
  encoded = encoded.replace(/[^A-Za-z0-9+/=]/g, '')
  if (!encoded) return null
  while (encoded.length % 4 !== 0) encoded += '='
  let decoded
  try {
    decoded = Buffer.from(encoded, 'base64')
  } catch {
    return null
  }
  if (decoded.length < 2 || decoded[0] !== 1 || decoded[1] !== 1) return null
  return decoded
}

export function parseMarkers2(data) {
  const decoded = decodeMarkers2Payload(data)
  if (!decoded) return { entries: [], raw: null }
  const entries = []
  let offset = 2
  while (offset < decoded.length) {
    const typeField = readNullTerminated(decoded, offset)
    const type = typeField.value.toString('ascii')
    offset = typeField.next
    if (!type) break
    if (offset + 4 > decoded.length) break
    const length = decoded.readUInt32BE(offset)
    offset += 4
    if (offset + length > decoded.length) break
    const value = decoded.subarray(offset, offset + length)
    offset += length

    if (type === 'CUE' && value.length >= 13) {
      entries.push({
        type,
        data: {
          index: value[1],
          positionMs: value.readUInt32BE(2),
          color: rgbToHex(value[7], value[8], value[9]),
          name: value.subarray(12).toString('utf8').replace(/\0+$/g, ''),
        },
      })
    } else if (type === 'LOOP' && value.length >= 21) {
      entries.push({
        type,
        data: {
          index: value[1],
          startMs: value.readUInt32BE(2),
          endMs: value.readUInt32BE(6),
          color: rgbToHex(value[15], value[16], value[17]),
          locked: value[19] === 1,
          name: value.subarray(21).toString('utf8').replace(/\0+$/g, ''),
        },
      })
    } else if (type === 'COLOR' && value.length >= 4) {
      entries.push({ type, data: { color: rgbToHex(value[1], value[2], value[3]) } })
    } else if (type === 'BPMLOCK') {
      entries.push({ type, data: { locked: value[0] === 1 } })
    } else {
      entries.push({ type, data: null })
    }
  }
  return { entries, raw: decoded }
}

export function parseBeatGrid(data) {
  if (!data || data.length < 7) return null
  if (data[0] !== 1) return null
  const markerCount = data.readUInt32BE(2)
  if (markerCount <= 0) return null
  let offset = 6
  if (offset + 8 > data.length) return null
  const anchor = data.readFloatBE(offset)
  const bpm = data.readFloatBE(offset + 4)
  if (!Number.isFinite(bpm) || bpm <= 0) return null
  return createBeatgrid({ bpm, anchor: Number.isFinite(anchor) ? Math.max(0, anchor) : 0, beats: markerCount })
}

/** Apply Serato Markers2 and BeatGrid GEOB tags to a normalized track. */
export function applySeratoPerformanceTags(track, geobs) {
  for (const geob of geobs) {
    if (geob.description === 'Serato Markers2') {
      const parsed = parseMarkers2(geob.data)
      for (const entry of parsed.entries) {
        if (entry.type === 'CUE') {
          track.cues.push(createCue({
            kind: CUE_KINDS.HOT,
            slot: entry.data.index + 1,
            name: entry.data.name || null,
            position: entry.data.positionMs / 1000,
            color: entry.data.color,
            sourceId: `serato-cue-${entry.data.index}`,
          }))
        } else if (entry.type === 'LOOP') {
          track.loops.push(createLoop({
            slot: entry.data.index + 1,
            name: entry.data.name || null,
            start: entry.data.startMs / 1000,
            end: entry.data.endMs / 1000,
            color: entry.data.color,
            locked: entry.data.locked,
            sourceId: `serato-loop-${entry.data.index}`,
          }))
        } else if (entry.type === 'COLOR') {
          track.color = entry.data.color
        } else if (entry.type === 'BPMLOCK' && track.beatgrid) {
          track.beatgrid.locked = entry.data.locked
        }
      }
    } else if (geob.description === 'Serato BeatGrid') {
      const grid = parseBeatGrid(geob.data)
      if (grid) track.beatgrid = grid
    }
  }
  return track
}

export async function readSeratoPerformanceTags(filePath) {
  const buffer = await fs.readFile(filePath)
  return extractGeobs(buffer)
}

/**
 * Load a Serato library from disk. The source database is opened read-only.
 * Audio tags are not read unless `enrichTags` is true, because doing that for
 * an entire library is much slower than reading the database.
 */
async function getMountedVolumeRoots() {
  const roots = []
  if (process.platform === 'darwin') {
    try {
      const entries = await fs.readdir('/Volumes')
      for (const name of entries) {
        if (!name || name.startsWith('.')) continue
        const full = path.join('/Volumes', name)
        try {
          const stat = await fs.lstat(full)
          if (stat.isDirectory() && !stat.isSymbolicLink()) roots.push(full)
        } catch {
          // ignore unreadable mount
        }
      }
    } catch {
      // ignore
    }
  } else if (process.platform === 'win32') {
    for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      const drive = `${letter}:\\`
      if (await fs.pathExists(drive)) roots.push(drive)
    }
  }
  return roots
}

export async function resolveTrackOnVolumes(filePath, volumeRoots = null) {
  if (!filePath) return { path: filePath, exists: false }
  if (await fs.pathExists(filePath)) return { path: filePath, exists: true }
  const roots = volumeRoots || (await getMountedVolumeRoots())
  const rel = String(filePath).replace(/^[\\/]+/, '')
  for (const root of roots) {
    const candidate = path.join(root, rel)
    if (await fs.pathExists(candidate)) {
      return { path: candidate, exists: true }
    }
  }
  return { path: filePath, exists: false }
}

export async function loadSeratoLibrary(seratoDir, options = {}) {
  const volumeRoots = await getMountedVolumeRoots()
  const databasePath = path.join(seratoDir, 'database V2')
  const hasDatabase = await fs.pathExists(databasePath)
  const library = hasDatabase
    ? parseSeratoDatabase(await fs.readFile(databasePath))
    : createLibrary(SOURCE_FORMATS.SERATO)
  library.sourcePath = seratoDir

  // Also merge any external-drive `_Serato_/database V2` (e.g. /Volumes/LaCie/_Serato_/database V2)
  for (const volRoot of volumeRoots) {
    const volDb = path.join(volRoot, '_Serato_', 'database V2')
    if (volDb === databasePath) continue
    if (await fs.pathExists(volDb)) {
      try {
        const extLib = parseSeratoDatabase(await fs.readFile(volDb))
        for (const t of extLib.tracks) {
          const rel = String(t.path || '').replace(/^\/+/, '')
          t.path = path.join(volRoot, rel)
          t.sourceId = `serato-ext-${library.tracks.length + 1}`
          library.tracks.push(t)
        }
      } catch {
        // non-fatal
      }
    }
  }

  if (!hasDatabase && !library.tracks.length) {
    library.warnings.push('database V2 was not found; reading tracks directly from crates.')
  }

  // Remap Serato paths and auto-resolve external volume paths (e.g. /MAX MUSIC/... -> /Volumes/LaCie/MAX MUSIC/...)
  for (const track of library.tracks) {
    track.path = remapSeratoPath(track.path, options.relink || [])
  }

  const subcratesLower = path.join(seratoDir, 'Subcrates')
  const subcratesMixed = path.join(seratoDir, 'SubCrates')
  const cratesDir = path.join(seratoDir, 'Crates')
  const cratesRoot = (await fs.pathExists(subcratesLower))
    ? subcratesLower
    : (await fs.pathExists(subcratesMixed))
      ? subcratesMixed
      : cratesDir
  const allCrateFiles = await scanCrates(cratesRoot)
  const selectedCrateSet = Array.isArray(options.cratePaths) && options.cratePaths.length
    ? new Set(options.cratePaths.map((p) => normalizeComparablePath(path.resolve(p))))
    : null
  const crateFiles = selectedCrateSet
    ? allCrateFiles.filter((p) => selectedCrateSet.has(normalizeComparablePath(path.resolve(p))))
    : allCrateFiles
  // Also include any explicitly requested crate paths outside cratesRoot
  if (selectedCrateSet) {
    const seen = new Set(crateFiles.map((p) => normalizeComparablePath(path.resolve(p))))
    for (const p of options.cratePaths) {
      const resolved = path.resolve(p)
      if (!seen.has(normalizeComparablePath(resolved)) && (await fs.pathExists(resolved))) {
        crateFiles.push(resolved)
      }
    }
  }
  const trackByPath = new Map(library.tracks.map((track) => [normalizeComparablePath(track.path), track]))
  const folderByKey = new Map()

  for (const cratePath of crateFiles) {
    const rawRelative = path.relative(cratesRoot, cratePath).replace(/\\/g, '/')
    const relative = rawRelative.startsWith('..') ? path.basename(cratePath) : rawRelative
    const withoutExtension = relative.replace(/\.crate$/i, '')
    const segments = withoutExtension.split('/').flatMap((part) => part.split('%%')).filter(Boolean)
    let parentId = null
    let folderKey = ''
    for (const folderName of segments.slice(0, -1)) {
      folderKey = folderKey ? `${folderKey}/${folderName}` : folderName
      if (!folderByKey.has(folderKey)) {
        const sourceId = `serato-folder-${folderByKey.size + 1}`
        library.playlists.push(createPlaylist({
          sourceId,
          name: folderName,
          parentId,
          isFolder: true,
        }))
        folderByKey.set(folderKey, sourceId)
      }
      parentId = folderByKey.get(folderKey)
    }

    const crateName = segments[segments.length - 1] || path.basename(cratePath, '.crate')
    const cratePaths = parseSeratoCrate(await fs.readFile(cratePath))
    const trackIds = []
    const unresolved = []
    for (const crateTrackPath of cratePaths) {
      const remapped = remapSeratoPath(crateTrackPath, options.relink || [])
      let track = trackByPath.get(normalizeComparablePath(remapped))
      let finalPath = remapped
      let exists = false

      if (!track) {
        const resolved = await resolveTrackOnVolumes(remapped, volumeRoots)
        finalPath = resolved.path
        exists = resolved.exists
        track = trackByPath.get(normalizeComparablePath(finalPath))
      }

      if (track) {
        if (exists) {
          track.path = finalPath
          track.missing = false
        }
        trackIds.push(track.sourceId)
      } else {
        const id = `serato-crate-track-${library.tracks.length + 1}`
        const created = createTrack({
          sourceId: id,
          title: basename(finalPath).replace(/\.[^.]+$/, ''),
          path: finalPath,
          filename: basename(finalPath),
          missing: !exists,
        })
        library.tracks.push(created)
        trackByPath.set(normalizeComparablePath(finalPath), created)
        trackByPath.set(normalizeComparablePath(remapped), created)
        trackIds.push(id)
        if (!exists) unresolved.push(finalPath)
      }
    }

    if (unresolved.length) {
      library.warnings.push(`Crate "${crateName}" contains ${unresolved.length} track(s) missing from the Serato database.`)
    }

    library.playlists.push(createPlaylist({
      sourceId: `serato-crate-${library.playlists.length + 1}`,
      name: crateName,
      parentId,
      trackIds,
      sourceTrackRefs: trackIds,
      sourceMeta: { cratePath, relative },
    }))
  }

  if (selectedCrateSet && !options.includeUnreferencedTracks) {
    const usedIds = new Set()
    for (const pl of library.playlists) {
      for (const id of pl.trackIds || []) usedIds.add(id)
    }
    library.tracks = library.tracks.filter((track) => usedIds.has(track.sourceId))
  }

  if (options.enrichTags) {
    for (const track of library.tracks) {
      if (!track.path) continue
      const exists = await fs.pathExists(track.path)
      track.missing = !exists
      if (!exists) continue
      try {
        applySeratoPerformanceTags(track, await readSeratoPerformanceTags(track.path))
      } catch (error) {
        library.warnings.push(`Could not read performance tags for ${track.filename}: ${error.message}`)
      }
    }
  }

  return library
}

function normalizeComparablePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase()
}

function remapSeratoPath(trackPath, relink = []) {
  let value = String(trackPath || '')
  for (const rule of relink) {
    if (!rule?.from || !rule?.to) continue
    if (value.startsWith(rule.from)) value = rule.to + value.slice(rule.from.length)
  }
  return value
}

async function scanCrates(root) {
  const results = []
  if (!(await fs.pathExists(root))) return results
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await scanCrates(fullPath)))
    } else if (entry.isFile() && /\.crate$/i.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results.sort((a, b) => a.localeCompare(b))
}

export async function listSeratoCrates(seratoDir) {
  const roots = [
    path.join(seratoDir, 'SubCrates'),
    path.join(seratoDir, 'Crates'),
  ]
  const files = []
  for (const root of roots) files.push(...(await scanCrates(root)))
  return files
}

// ── Serato tag writers (operate on exported copies only) ────────────────────

function encodeMarkers2Entry(type, data) {
  return Buffer.concat([
    Buffer.from(`${type}\0`, 'ascii'),
    u32(data.length),
    data,
  ])
}

export function buildMarkers2(cues = [], loops = [], options = {}) {
  const entries = []
  if (options.color) {
    const color = normalizeColor(options.color)
    if (color) {
      entries.push(encodeMarkers2Entry('COLOR', Buffer.from([
        0,
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ])))
    }
  }

  for (const cue of cues) {
    if (cue.kind === CUE_KINDS.MEMORY) continue
    const slot = Math.max(0, Math.min(7, (cue.slot || 1) - 1))
    const color = normalizeColor(cue.color) || '#CC0000'
    const name = Buffer.from(String(cue.name || ''), 'utf8')
    const data = Buffer.concat([
      Buffer.from([0, slot]),
      u32(Math.max(0, Math.round(Number(cue.position || 0) * 1000))),
      Buffer.from([0]),
      Buffer.from([
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ]),
      Buffer.from([0, 0]),
      name,
      Buffer.from([0]),
    ])
    entries.push(encodeMarkers2Entry('CUE', data))
  }

  for (const loop of loops) {
    const slot = Math.max(0, Math.min(7, (loop.slot || 1) - 1))
    const color = normalizeColor(loop.color) || '#27AAE1'
    const name = Buffer.from(String(loop.name || ''), 'utf8')
    const data = Buffer.concat([
      Buffer.from([0, slot]),
      u32(Math.max(0, Math.round(Number(loop.start || 0) * 1000))),
      u32(Math.max(0, Math.round(Number(loop.end || 0) * 1000))),
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00]),
      Buffer.from([
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
        0,
        loop.locked ? 1 : 0,
      ]),
      name,
      Buffer.from([0]),
    ])
    entries.push(encodeMarkers2Entry('LOOP', data))
  }

  if (options.bpmLocked) {
    entries.push(encodeMarkers2Entry('BPMLOCK', Buffer.from([1])))
  }

  const decoded = Buffer.concat([
    Buffer.from([0x01, 0x01]),
    ...entries,
    Buffer.from([0]),
  ])

  // Serato wraps the base64 in 01 01, inserts a newline every 72 characters and
  // may omit the final base64 character. We follow that layout exactly enough
  // for Serato and Mixxx to read it back.
  const blocks = []
  for (let offset = 0; offset < decoded.length; offset += 54) {
    blocks.push(decoded.subarray(offset, offset + 54))
  }
  const encoded = blocks
    .map((block, index) => {
      let text = block.toString('base64').replace(/=+$/g, '')
      if (block.length % 3) text = text.slice(0, -1)
      return `${index > 0 ? '\n' : ''}${text}`
    })
    .join('')
  const outer = Buffer.concat([Buffer.from([0x01, 0x01]), Buffer.from(encoded, 'ascii')])
  const minimum = Math.max(470, outer.length + 1)
  return Buffer.concat([outer, Buffer.alloc(minimum - outer.length)])
}

export function buildBeatGrid(beatgrid) {
  if (!beatgrid?.bpm) return null
  const header = Buffer.from([0x01, 0x00])
  const count = u32(1)
  const marker = Buffer.alloc(8)
  marker.writeFloatBE(Number(beatgrid.anchor || 0), 0)
  marker.writeFloatBE(Number(beatgrid.bpm), 4)
  return Buffer.concat([header, count, marker, Buffer.from([0x37])])
}

function buildGeobFrame(description, data, version = 3) {
  const payload = Buffer.concat([
    Buffer.from([0]),
    Buffer.from('application/octet-stream\0\0', 'ascii'),
    Buffer.from(`${description}\0`, 'ascii'),
    data,
  ])
  const header = Buffer.alloc(10)
  header.write('GEOB', 0, 'ascii')
  if (version === 4) header.set(intToSyncsafe(payload.length), 4)
  else header.writeUInt32BE(payload.length, 4)
  header.writeUInt16BE(0, 8)
  return Buffer.concat([header, payload])
}

/**
 * Replace Serato GEOB frames in an MP3/AIFF ID3v2 tag and return a new file
 * buffer. Audio bytes are preserved byte-for-byte.
 */
export function writeSeratoTagsToId3(buffer, { markers2, beatgrid } = {}) {
  const tag = parseId3Frames(buffer)
  let version = tag?.version || 3
  if (version !== 3 && version !== 4) version = 3
  const audio = tag ? buffer.subarray(tag.audioStart) : buffer

  const preserved = []
  if (tag) {
    for (const frame of tag.frames) {
      if (frame.id === 'GEOB') {
        const geob = parseGeob(frame.payload)
        if (geob?.description === 'Serato Markers2' || geob?.description === 'Serato BeatGrid') continue
      }
      const header = Buffer.alloc(10)
      header.write(frame.id, 0, 'ascii')
      if (version === 4) header.set(intToSyncsafe(frame.payload.length), 4)
      else header.writeUInt32BE(frame.payload.length, 4)
      header.writeUInt16BE(frame.flags, 8)
      preserved.push(Buffer.concat([header, frame.payload]))
    }
  }

  const newFrames = [...preserved]
  if (markers2) newFrames.push(buildGeobFrame('Serato Markers2', markers2, version))
  if (beatgrid) newFrames.push(buildGeobFrame('Serato BeatGrid', beatgrid, version))

  const padding = Buffer.alloc(1024)
  const body = Buffer.concat([...newFrames, padding])
  const header = Buffer.alloc(10)
  header.write('ID3', 0, 'ascii')
  header[3] = version
  header[4] = 0
  header[5] = 0
  header.set(intToSyncsafe(body.length), 6)
  return Buffer.concat([header, body, audio])
}

/** Convenience wrapper used by exporters after copying a file. */
export async function writeSeratoTags(filePath, track) {
  const extension = path.extname(filePath).toLowerCase()
  if (!['.mp3', '.aiff', '.aif'].includes(extension)) {
    throw new Error(`Serato performance tags can only be written to MP3/AIFF in this build (got ${extension})`)
  }
  const cues = (track.cues || []).filter((cue) => cue.kind !== CUE_KINDS.MEMORY)
  const beatgrid = buildBeatGrid(track.beatgrid || (track.bpm ? { bpm: track.bpm, anchor: 0 } : null))
  if (!cues.length && !(track.loops || []).length && !beatgrid && !track.color) return false
  const markers2 = buildMarkers2(cues, track.loops || [], {
    color: track.color,
    bpmLocked: track.beatgrid?.locked,
  })
  const original = await fs.readFile(filePath)
  const updated = writeSeratoTagsToId3(original, { markers2, beatgrid })
  await fs.writeFile(filePath, updated)
  return true
}

export const seratoAdapter = {
  id: SOURCE_FORMATS.SERATO,
  label: 'Serato DJ',
  canImport: true,
  canExport: true,
  loadLibrary: loadSeratoLibrary,
  parseDatabase: parseSeratoDatabase,
  parseCrate: parseSeratoCrate,
  generateCrate: generateSeratoCrate,
  writeTags: writeSeratoTags,
  readTags: readSeratoPerformanceTags,
}
