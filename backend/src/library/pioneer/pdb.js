/**
 * Pioneer DeviceSQL database (`export.pdb`) reader and writer.
 *
 * The format is little-endian and page based. Every exporter in this module
 * writes a fresh database; existing rekordbox databases are never modified.
 *
 * Layout notes that are easy to get wrong:
 *  - page 0 holds a 28 byte header followed by 20 table pointers (16 bytes each)
 *  - every other page starts with a 40 byte header
 *  - rows grow forward from 0x28, the row index grows backwards from the page end
 *  - the row index is packed as `2 * slots + 4 * ceil(slots / 16)` bytes
 *  - a row offset is relative to the end of the page header (0x28)
 *  - track rows are 0x5e bytes of fixed data followed by 21 u16 string offsets
 *
 * The writer deliberately emits the conservative shapes used by rekordbox's
 * own exports (sentinel page, blank `empty_candidate` page, footer conventions)
 * instead of compacting anything. Structural self-validation is provided, but
 * this code cannot prove that a physical CDJ will accept the result.
 */

import path from 'path'

export const PAGE_SIZE = 4096
export const TABLE_COUNT = 20
export const TABLE_TYPES = Object.freeze({
  TRACKS: 0,
  GENRES: 1,
  ARTISTS: 2,
  ALBUMS: 3,
  LABELS: 4,
  KEYS: 5,
  COLORS: 6,
  PLAYLIST_TREE: 7,
  PLAYLIST_ENTRIES: 8,
  UNKNOWN_9: 9,
  UNKNOWN_10: 10,
  HISTORY_PLAYLISTS_ALT: 11,
  HISTORY_ENTRIES_ALT: 12,
  ARTWORK: 13,
  UNKNOWN_14: 14,
  UNKNOWN_15: 15,
  COLUMNS: 16,
  MENU_CATEGORY: 17,
  MENU_SORT: 18,
  HISTORY: 19,
})

const TRACK_ROW_SIZE = 0x5e + 21 * 2

/** Rekordbox's fixed color-label palette. */
export const PDB_COLORS = Object.freeze([
  { id: 1, name: 'Pink', hex: '#FF007F', rgb: [255, 0, 127] },
  { id: 2, name: 'Red', hex: '#FF0000', rgb: [255, 0, 0] },
  { id: 3, name: 'Orange', hex: '#FF7F00', rgb: [255, 127, 0] },
  { id: 4, name: 'Yellow', hex: '#FFFF00', rgb: [255, 255, 0] },
  { id: 5, name: 'Green', hex: '#00FF00', rgb: [0, 255, 0] },
  { id: 6, name: 'Aqua', hex: '#00FFFF', rgb: [0, 255, 255] },
  { id: 7, name: 'Blue', hex: '#0000FF', rgb: [0, 0, 255] },
  { id: 8, name: 'Purple', hex: '#7F00FF', rgb: [127, 0, 255] },
])

const FILE_TYPE_BY_EXT = Object.freeze({
  '.mp3': 1,
  '.mp4': 3,
  '.m4a': 4,
  '.flac': 5,
  '.alac': 6,
  '.wav': 11,
  '.aif': 12,
  '.aiff': 12,
})

function align(value, boundary) {
  return Math.ceil(value / boundary) * boundary
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toInt(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : fallback
}

/** Remove NULs and characters that are known to break player text rendering. */
export function sanitizeText(value, maxLength = 255) {
  if (value == null) return ''
  let text = String(value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  // Keep combining stacks short; long zalgo runs have hung CDJ firmware.
  text = text.replace(/\p{M}{4,}/gu, '')
  if (text.length > maxLength) text = text.slice(0, maxLength)
  return text
}

function basename(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
}

function extensionOf(filePath = '') {
  return path.extname(String(filePath || '')).toLowerCase()
}

function formatDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback
  if (Number.isNaN(date.getTime())) return fallback.toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function parseHexColor(value) {
  const match = String(value || '').trim().match(/^#?([0-9a-f]{6})$/i)
  if (!match) return null
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ]
}

/** Map an arbitrary color to the closest fixed CDJ color label. */
export function colorIdForHex(value) {
  const rgb = parseHexColor(value)
  if (!rgb) return 0
  let best = null
  for (const color of PDB_COLORS) {
    const distance =
      (rgb[0] - color.rgb[0]) ** 2 + (rgb[1] - color.rgb[1]) ** 2 + (rgb[2] - color.rgb[2]) ** 2
    if (!best || distance < best.distance) best = { id: color.id, distance }
  }
  return best ? best.id : 0
}

export function fileTypeCode(filePath) {
  return FILE_TYPE_BY_EXT[extensionOf(filePath)] || 0
}

// ---------------------------------------------------------------------------
// DeviceSQL strings
// ---------------------------------------------------------------------------

/** Encode a DeviceSQL string. The caller is responsible for 4-byte alignment. */
export function encodeDeviceString(value) {
  const text = sanitizeText(value)
  if (!text) return Buffer.from([0x03])

  const isAscii = [...text].every((char) => char.codePointAt(0) <= 0x7f)
  const ascii = Buffer.from(text, 'latin1')
  if (isAscii && ascii.length <= 126) {
    const out = Buffer.alloc(1 + ascii.length)
    out[0] = ((ascii.length + 1) << 1) | 1
    ascii.copy(out, 1)
    return out
  }

  if (isAscii) {
    const out = Buffer.alloc(4 + ascii.length)
    out[0] = 0x40
    out.writeUInt16LE(ascii.length + 4, 1)
    out[3] = 0
    ascii.copy(out, 4)
    return out
  }

  const utf16 = Buffer.from(text, 'utf16le')
  const out = Buffer.alloc(4 + utf16.length)
  out[0] = 0x90
  out.writeUInt16LE(utf16.length + 4, 1)
  out[3] = 0
  utf16.copy(out, 4)
  return out
}

/** Decode a DeviceSQL string at an absolute buffer offset. */
export function decodeDeviceString(buffer, offset) {
  if (offset < 0 || offset >= buffer.length) return ''
  const marker = buffer[offset]
  if (marker === 0x40 || marker === 0x90) {
    if (offset + 4 > buffer.length) return ''
    const total = buffer.readUInt16LE(offset + 1)
    if (total < 4) return ''
    const body = buffer.subarray(offset + 4, Math.min(offset + total, buffer.length))
    return marker === 0x90 ? body.toString('utf16le') : body.toString('latin1')
  }
  const length = (marker >> 1) - 1
  if (length < 0 || length > 126) return ''
  const start = offset + 1
  const end = Math.min(start + length, buffer.length)
  return buffer.subarray(start, end).toString('latin1')
}

/** True when the encoded string needs a 4-byte aligned header. */
function needsAlignedHeader(encoded) {
  return encoded.length > 0 && (encoded[0] === 0x40 || encoded[0] === 0x90)
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function writeRowStrings(fixed, strings, options = {}) {
  const parts = [fixed]
  let cursor = fixed.length
  const offsets = []
  strings.forEach((value, index) => {
    const encoded = encodeDeviceString(value)
    const forceAlign = options.alignAll || needsAlignedHeader(encoded) || index === options.forceAlignIndex
    if (forceAlign) {
      const aligned = align(cursor, 4)
      if (aligned > cursor) {
        parts.push(Buffer.alloc(aligned - cursor))
        cursor = aligned
      }
    }
    offsets.push(cursor)
    parts.push(encoded)
    cursor += encoded.length
  })
  return { buffer: Buffer.concat(parts), offsets, length: cursor }
}

function buildGenreRow(genre) {
  const fixed = Buffer.alloc(4)
  fixed.writeUInt32LE(genre.id, 0)
  return writeRowStrings(fixed, [genre.name]).buffer
}

function buildLabelRow(label) {
  const fixed = Buffer.alloc(4)
  fixed.writeUInt32LE(label.id, 0)
  return writeRowStrings(fixed, [label.name]).buffer
}

function buildKeyRow(key) {
  const fixed = Buffer.alloc(8)
  fixed.writeUInt32LE(key.id, 0)
  fixed.writeUInt32LE(key.id, 4)
  return writeRowStrings(fixed, [key.name]).buffer
}

function buildColorRow(color) {
  const fixed = Buffer.alloc(8)
  fixed[4] = color.id & 0xff
  fixed.writeUInt16LE(color.id, 5)
  fixed[7] = 0
  return writeRowStrings(fixed, [color.name]).buffer
}

function buildArtistRow(artist) {
  const encoded = encodeDeviceString(artist.name)
  const fixed = Buffer.alloc(10)
  fixed.writeUInt16LE(0x60, 0)
  fixed.writeUInt16LE((artist.slot || 0) * 0x20, 2)
  fixed.writeUInt32LE(artist.id, 4)
  fixed[8] = 0x03
  // Keep long-form headers 4-byte aligned relative to the row.
  const nameOffset = needsAlignedHeader(encoded) ? 12 : 10
  fixed[9] = nameOffset
  const out = Buffer.alloc(nameOffset + encoded.length)
  fixed.copy(out, 0)
  encoded.copy(out, nameOffset)
  return out
}

function buildAlbumRow(album) {
  const encoded = encodeDeviceString(album.name)
  const fixed = Buffer.alloc(22)
  fixed.writeUInt16LE(0x80, 0)
  fixed.writeUInt16LE((album.slot || 0) * 0x20, 2)
  fixed.writeUInt32LE(0, 4)
  fixed.writeUInt32LE(album.artistId || 0, 8)
  fixed.writeUInt32LE(album.id, 12)
  fixed.writeUInt32LE(0, 16)
  fixed[20] = 0x03
  const nameOffset = needsAlignedHeader(encoded) ? 24 : 22
  fixed[21] = nameOffset
  const out = Buffer.alloc(nameOffset + encoded.length)
  fixed.copy(out, 0)
  encoded.copy(out, nameOffset)
  return out
}

function buildPlaylistRow(playlist) {
  const fixed = Buffer.alloc(20)
  fixed.writeUInt32LE(playlist.parentId || 0, 0)
  fixed.writeUInt32LE(0, 4)
  fixed.writeUInt32LE(playlist.sortOrder || 0, 8)
  fixed.writeUInt32LE(playlist.id, 12)
  fixed.writeUInt32LE(playlist.isFolder ? 1 : 0, 16)
  return writeRowStrings(fixed, [playlist.name]).buffer
}

function buildPlaylistEntryRow(entry) {
  const row = Buffer.alloc(12)
  row.writeUInt32LE(entry.entryIndex, 0)
  row.writeUInt32LE(entry.trackId, 4)
  row.writeUInt32LE(entry.playlistId, 8)
  return row
}

/**
 * Build a track row. String slots, in order:
 * 0 isrc, 1 texter, 2..4 unknown, 5 message, 6 kuvo public, 7 autoload cues,
 * 8..9 unknown, 10 date added, 11 release date, 12 mix name, 13 unknown,
 * 14 analysis path, 15 date added (legacy), 16 comment, 17 title, 18 unknown,
 * 19 filename, 20 media path.
 */
export function buildTrackRow(track, options = {}) {
  // 0x5e fixed bytes followed by 21 string offsets. Strings start at 0x88 so
  // the offset table cannot overwrite the first encoded strings.
  const fixed = Buffer.alloc(0x5e + 21 * 2)
  fixed.writeUInt16LE(0x24, 0)
  fixed.writeUInt16LE(0, 2)
  fixed.writeUInt32LE(0x000c0700, 4)
  fixed.writeUInt32LE(clamp(toInt(track.sampleRate, 44100), 0, 0xffffffff), 8)
  fixed.writeUInt32LE(track.composerId || 0, 0x0c)
  fixed.writeUInt32LE(clamp(toInt(track.fileSize), 0, 0xffffffff), 0x10)
  fixed.writeUInt32LE(0, 0x14)
  fixed.writeUInt16LE(19048, 0x18)
  fixed.writeUInt16LE(30967, 0x1a)
  fixed.writeUInt32LE(track.artworkId || 0, 0x1c)
  fixed.writeUInt32LE(track.keyId || 0, 0x20)
  fixed.writeUInt32LE(track.originalArtistId || 0, 0x24)
  fixed.writeUInt32LE(track.labelId || 0, 0x28)
  fixed.writeUInt32LE(track.remixerId || 0, 0x2c)
  fixed.writeUInt32LE(clamp(toInt(track.bitrate), 0, 0xffffffff), 0x30)
  fixed.writeUInt32LE(clamp(toInt(track.trackNumber), 0, 0xffffffff), 0x34)
  fixed.writeUInt32LE(clamp(Math.round(Number(track.bpm || 0) * 100), 0, 0xffffffff), 0x38)
  fixed.writeUInt32LE(track.genreId || 0, 0x3c)
  fixed.writeUInt32LE(track.albumId || 0, 0x40)
  fixed.writeUInt32LE(track.artistId || 0, 0x44)
  fixed.writeUInt32LE(track.id, 0x48)
  fixed.writeUInt16LE(clamp(toInt(track.discNumber), 0, 0xffff), 0x4c)
  fixed.writeUInt16LE(clamp(toInt(track.playCount), 0, 0xffff), 0x4e)
  fixed.writeUInt16LE(clamp(toInt(track.year), 0, 0xffff), 0x50)
  fixed.writeUInt16LE(clamp(toInt(track.sampleDepth, 16), 0, 0xffff), 0x52)
  fixed.writeUInt16LE(clamp(Math.round(Number(track.duration || 0)), 0, 0xffff), 0x54)
  fixed.writeUInt16LE(41, 0x56)
  fixed[0x58] = track.colorId || 0
  fixed[0x59] = clamp(Math.round(Number(track.rating || 0)), 0, 5)
  fixed.writeUInt16LE(fileTypeCode(track.path || track.filename || ''), 0x5a)
  fixed.writeUInt16LE(3, 0x5c)

  const dateAdded = formatDate(track.dateAdded)
  const strings = [
    track.isrc || '',
    track.texter || '',
    '',
    '',
    '',
    '',
    track.kuvoPublic ? 'ON' : '',
    'ON',
    '',
    '',
    dateAdded,
    track.releaseDate || '',
    track.mixName || '',
    '',
    track.analysisPath || '',
    dateAdded,
    track.comment || '',
    track.title || '',
    '',
    track.filename || basename(track.path),
    track.usbPath || `/Contents/${basename(track.path)}`,
  ]

  const { buffer, offsets, length } = writeRowStrings(fixed, strings, {
    forceAlignIndex: 20,
  })
  const paddedLength = align(length, 4)
  const out = Buffer.alloc(paddedLength)
  buffer.copy(out, 0)
  offsets.forEach((offset, index) => {
    out.writeUInt16LE(offset, 0x5e + index * 2)
  })
  return out
}

/**
 * t19 is a small runtime ring used by older players to count songs. Writing the
 * newest id = number of tracks is what makes the player show the right count.
 */
export function buildRuntimeRow({ slot, id, date, deviceName = '', backgroundColor = 0, version = '1000' }) {
  const dateEncoded = encodeDeviceString(date)
  const versionEncoded = encodeDeviceString(version)
  const nameEncoded = encodeDeviceString(deviceName)
  const fixedLength = 12
  const dateOffset = fixedLength
  const afterDate = dateOffset + dateEncoded.length
  const versionOffset = afterDate + 2
  const nameOffset = versionOffset + versionEncoded.length
  let total = nameOffset + nameEncoded.length
  total = Math.max(40, align(total, 4))
  const row = Buffer.alloc(total)
  row.writeUInt16LE(0x0280, 0)
  row.writeUInt16LE((slot || 0) * 0x20, 2)
  row.writeUInt32LE(id >>> 0, 4)
  row.writeUInt32LE(0, 8)
  row.writeUInt8((backgroundColor || 0) & 0xff, 9)
  dateEncoded.copy(row, dateOffset)
  row.writeUInt16LE(versionOffset, afterDate)
  row.writeUInt16LE(nameOffset, afterDate + 2)
  versionEncoded.copy(row, versionOffset)
  nameEncoded.copy(row, nameOffset)
  return row
}

// ---------------------------------------------------------------------------
// Page writer
// ---------------------------------------------------------------------------

const TABLE_FOOTER_CONVENTIONS = new Map([
  [TABLE_TYPES.TRACKS, 'transaction'],
  [TABLE_TYPES.GENRES, 'transaction'],
  [TABLE_TYPES.ARTISTS, 'transaction'],
  [TABLE_TYPES.ALBUMS, 'transaction'],
  [TABLE_TYPES.LABELS, 'transaction'],
  [TABLE_TYPES.KEYS, 'transaction'],
  [TABLE_TYPES.COLORS, 'full'],
  [TABLE_TYPES.PLAYLIST_TREE, 'full'],
  [TABLE_TYPES.PLAYLIST_ENTRIES, 'transaction'],
  [TABLE_TYPES.ARTWORK, 'transaction'],
  [TABLE_TYPES.COLUMNS, 'full'],
  [TABLE_TYPES.MENU_CATEGORY, 'full'],
  [TABLE_TYPES.MENU_SORT, 'full'],
  [TABLE_TYPES.HISTORY, 'history'],
])

function indexSizeFor(slotCount) {
  return 2 * slotCount + 4 * Math.ceil(slotCount / 16)
}

function writePageHeader(page, { index, type, nextPage, flags, freeSize, usedSize, u5, numRl, u6 = 0, u7 = 0, slotCount = 0, rowCount = 0 }) {
  page.writeUInt32LE(0, 0x00)
  page.writeUInt32LE(index, 0x04)
  page.writeUInt32LE(type, 0x08)
  page.writeUInt32LE(nextPage, 0x0c)
  page.writeUInt32LE(1, 0x10)
  page.writeUInt32LE(0, 0x14)
  const packed = (slotCount & 0x1fff) | ((rowCount & 0x7ff) << 13)
  page.writeUIntLE(packed, 0x18, 3)
  page[0x1b] = flags
  page.writeUInt16LE(freeSize, 0x1c)
  page.writeUInt16LE(usedSize, 0x1e)
  page.writeUInt16LE(u5, 0x20)
  page.writeUInt16LE(numRl, 0x22)
  page.writeUInt16LE(u6, 0x24)
  page.writeUInt16LE(u7, 0x26)
}

function buildDataPage(rows, context) {
  const page = Buffer.alloc(PAGE_SIZE)
  const slotCount = rows.length
  const rowCount = rows.length
  let cursor = 0x28
  const offsets = []
  for (const row of rows) {
    offsets.push(cursor - 0x28)
    row.copy(page, cursor)
    cursor += row.length
  }
  const usedSize = cursor - 0x28
  const indexSize = indexSizeFor(slotCount)
  const freeSize = PAGE_SIZE - cursor - indexSize
  if (freeSize < 0) throw new Error('PDB data page overflow')

  const convention = TABLE_FOOTER_CONVENTIONS.get(context.type) || 'full'
  let u5
  let numRl
  if (convention === 'transaction') {
    u5 = 1
    numRl = Math.max(0, slotCount - 1)
  } else if (convention === 'history') {
    u5 = 2
    numRl = Math.max(0, slotCount - 2)
  } else {
    u5 = slotCount
    numRl = 0
  }

  writePageHeader(page, {
    index: context.index,
    type: context.type,
    nextPage: context.nextPage,
    flags: context.type === TABLE_TYPES.HISTORY ? 0x34 : 0x24,
    freeSize,
    usedSize,
    u5,
    numRl,
    u6: 0,
    u7: 0,
    slotCount,
    rowCount,
  })

  // Row index groups build backwards from the page end.
  const groupCount = Math.ceil(slotCount / 16)
  for (let group = 0; group < groupCount; group += 1) {
    const base = PAGE_SIZE - group * 0x24
    let presence = 0
    for (let n = 0; n < 16; n += 1) {
      const slot = group * 16 + n
      if (slot >= slotCount) break
      presence |= 1 << n
      page.writeUInt16LE(offsets[slot], base - 6 - 2 * n)
    }
    page.writeUInt16LE(presence, base - 4)
    let transaction
    if (convention === 'full') {
      transaction = presence
    } else if (convention === 'history') {
      // Newest row is active; the separately written footer below overrides
      // this for t19, but this keeps the default sane for other callers.
      transaction = presence
    } else {
      transaction = 0
      const groupStart = group * 16
      if (numRl >= groupStart && numRl < groupStart + 16) {
        transaction = 1 << (numRl - groupStart)
      }
    }
    page.writeUInt16LE(transaction, base - 2)
  }
  return page
}

function buildRuntimePage(rows, context) {
  const page = buildDataPage(rows, context)
  // t19 must mark only the newest row active. The newest row is the last one.
  const slotCount = rows.length
  const groupCount = Math.ceil(slotCount / 16)
  const newest = slotCount - 1
  const previous = slotCount - 2
  for (let group = 0; group < groupCount; group += 1) {
    const base = PAGE_SIZE - group * 0x24
    let presence = 0
    let transaction = 0
    for (let n = 0; n < 16; n += 1) {
      const slot = group * 16 + n
      if (slot >= slotCount) break
      if (slot === newest) {
        presence |= 1 << n
        transaction |= 1 << n
      }
      if (slot === previous) transaction |= 1 << n
    }
    page.writeUInt16LE(presence, base - 4)
    page.writeUInt16LE(transaction, base - 2)
  }
  page[0x1b] = 0x34
  return page
}

function buildSentinelPage({ index, type, nextPage, dataPageIndices }) {
  const page = Buffer.alloc(PAGE_SIZE)
  const entries = dataPageIndices.slice(0, 1004)
  writePageHeader(page, {
    index,
    type,
    nextPage,
    flags: 0x64,
    freeSize: 0,
    usedSize: 0,
    u5: 0x1fff,
    numRl: 0x1fff,
    u6: 0x03ec,
    u7: entries.length,
    slotCount: 0,
    rowCount: 0,
  })

  if (type === TABLE_TYPES.TRACKS) {
    // t00 uses the older index shape without the 0x03ffffff magic.
    page.writeUInt32LE(index, 0x28)
    page.writeUInt32LE(nextPage, 0x2c)
    page.writeUInt32LE(1, 0x30)
    page.writeUInt32LE(1, 0x34)
    page.writeUInt16LE(0, 0x38)
    page.writeUInt16LE(0, 0x3a)
    entries.forEach((pageIndex, entryIndex) => {
      page.writeUInt32LE((pageIndex * 8) >>> 0, 0x3c + entryIndex * 4)
    })
    return page
  }

  page.writeUInt32LE(index, 0x28)
  page.writeUInt32LE(nextPage, 0x2c)
  page.writeUInt32LE(0x03ffffff, 0x30)
  page.writeUInt32LE(0, 0x34)
  page.writeUInt16LE(entries.length, 0x38)
  page.writeUInt16LE(0x1fff, 0x3a)
  entries.forEach((pageIndex, entryIndex) => {
    page.writeUInt32LE((pageIndex * 8) >>> 0, 0x3c + entryIndex * 4)
  })
  // Empty index slots then the 20 zero bytes at the end of every index page.
  const firstEmpty = 0x3c + entries.length * 4
  const emptyEnd = PAGE_SIZE - 20
  for (let offset = firstEmpty; offset + 4 <= emptyEnd; offset += 4) {
    page.writeUInt32LE(0x1ffffff8, offset)
  }
  return page
}

// ---------------------------------------------------------------------------
// Library-to-PDB preparation
// ---------------------------------------------------------------------------

function makeDictionary() {
  return {
    map: new Map(),
    rows: [],
    nextId: 1,
    add(name, extra = {}) {
      const key = String(name || '').trim()
      if (!key) return 0
      const normalized = key.toLowerCase()
      if (this.map.has(normalized)) return this.map.get(normalized)
      const id = this.nextId++
      const entry = { id, name: key, ...extra, slot: this.rows.length }
      this.map.set(normalized, id)
      this.rows.push(entry)
      return id
    },
    idFor(name) {
      const key = String(name || '').trim().toLowerCase()
      return key ? this.map.get(key) || 0 : 0
    },
  }
}

function resolveTrackReference(reference, trackLookup, tracks) {
  if (reference == null) return null
  const text = String(reference)
  if (trackLookup.has(text)) return trackLookup.get(text)
  // Numeric references are accepted only when they name an existing 1-based id.
  if (/^\d+$/.test(text)) {
    const numeric = Number(text)
    if (numeric >= 1 && numeric <= tracks.length) return numeric
  }
  return null
}

/**
 * Convert a normalized library into PDB rows.
 *
 * `options.mediaPathForTrack(track)` and `options.analysisPathForTrack(track)`
 * return the paths as they will exist on the USB (starting with `/Contents/`
 * and `/PIONEER/`). The caller is responsible for copying the audio files.
 */
export function preparePdb(library, options = {}) {
  const tracks = Array.isArray(library?.tracks) ? library.tracks : []
  const warnings = []
  const genres = makeDictionary()
  const artists = makeDictionary()
  const albums = makeDictionary()
  const labels = makeDictionary()
  const keys = makeDictionary()

  const trackLookup = new Map()
  const pdbTracks = tracks.map((track, index) => {
    const id = index + 1
    trackLookup.set(String(track.sourceId || ''), id)
    trackLookup.set(String(track.id || ''), id)
    trackLookup.set(String(track.path || ''), id)
    trackLookup.set(String(index + 1), id)
    return { ...track, id }
  })

  const artistName = (track) => track.artist || track.albumArtist || 'Unknown Artist'
  for (const track of pdbTracks) {
    if (!track.title) warnings.push(`Track ${track.id} has no title; writing an empty title.`)
    genres.add(track.genre)
    artists.add(artistName(track))
    if (track.album) {
      albums.add(track.album, { artistName: artistName(track) })
    }
    labels.add(track.sourceMeta?.label)
    keys.add(track.key)
  }
  // Album ids must be assigned after every album name has been seen so the
  // album's artist link can be resolved consistently.
  for (const album of albums.rows) {
    album.artistId = artists.idFor(album.artistName)
  }

  const pdbTrackRows = pdbTracks.map((track) => {
    const albumArtist = artistName(track)
    return {
      ...track,
      title: sanitizeText(track.title || basename(track.path).replace(/\.[^.]+$/, '')),
      artistId: artists.idFor(albumArtist),
      albumId: track.album ? albums.idFor(track.album) : 0,
      genreId: genres.idFor(track.genre),
      keyId: keys.idFor(track.key),
      labelId: labels.idFor(track.sourceMeta?.label),
      composerId: artists.idFor(track.composer),
      remixerId: artists.idFor(track.sourceMeta?.remixer),
      originalArtistId: artists.idFor(track.sourceMeta?.originalArtist),
      colorId: colorIdForHex(track.color),
      usbPath: options.mediaPathForTrack
        ? options.mediaPathForTrack(track)
        : `/Contents/${track.filename || basename(track.path)}`,
      analysisPath: options.analysisPathForTrack
        ? options.analysisPathForTrack(track)
        : `/PIONEER/USBANLZ/P001/00000000/ANLZ0000.DAT`,
      sampleDepth: track.sampleDepth || 16,
    }
  })

  const trackById = new Map(pdbTrackRows.map((track) => [track.id, track]))

  // Playlist ids: folders and playlists share one id space.
  const playlistRows = []
  const entryRows = []
  const playlists = Array.isArray(library?.playlists) ? library.playlists : []
  const playlistLookup = new Map()
  let playlistId = 1

  const createPlaylist = (playlist, parentId = 0, sortOrder = 0) => {
    const id = playlistId++
    const row = {
      id,
      parentId,
      sortOrder,
      isFolder: Boolean(playlist.isFolder),
      name: sanitizeText(playlist.name || (playlist.isFolder ? 'Folder' : 'Playlist')),
      source: playlist,
    }
    playlistRows.push(row)
    playlistLookup.set(String(playlist.sourceId || ''), id)
    playlistLookup.set(String(playlist.id || ''), id)
    playlistLookup.set(String(playlist.name || ''), id)

    const children = Array.isArray(playlist.children) ? playlist.children : []
    let childSort = 0
    for (const child of children) {
      createPlaylist(child, id, childSort++)
    }

    if (!row.isFolder) {
      const refs = Array.isArray(playlist.trackIds)
        ? playlist.trackIds
        : Array.isArray(playlist.sourceTrackRefs)
          ? playlist.sourceTrackRefs
          : []
      let entryIndex = 1
      const seen = new Set()
      for (const reference of refs) {
        const trackId = resolveTrackReference(reference, trackLookup, pdbTracks)
        if (!trackId) {
          warnings.push(`Playlist "${row.name}" references a track that is not in the library.`)
          continue
        }
        if (seen.has(trackId)) {
          warnings.push(`Playlist "${row.name}" contains the same track twice; both entries are kept.`)
        }
        seen.add(trackId)
        entryRows.push({ entryIndex, trackId, playlistId: id })
        entryIndex += 1
      }
    }
    return row
  }

  let rootSort = 0
  for (const playlist of playlists) {
    createPlaylist(playlist, 0, rootSort++)
  }

  return {
    tracks: pdbTrackRows,
    trackById,
    genres: genres.rows,
    artists: artists.rows,
    albums: albums.rows,
    labels: labels.rows,
    keys: keys.rows,
    playlists: playlistRows,
    entries: entryRows,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// PDB writer
// ---------------------------------------------------------------------------

function buildTableRows(prepared) {
  const rows = new Map()
  rows.set(TABLE_TYPES.TRACKS, prepared.tracks.map((track) => buildTrackRow(track)))
  rows.set(TABLE_TYPES.GENRES, prepared.genres.map(buildGenreRow))
  rows.set(TABLE_TYPES.ARTISTS, prepared.artists.map(buildArtistRow))
  rows.set(TABLE_TYPES.ALBUMS, prepared.albums.map(buildAlbumRow))
  rows.set(TABLE_TYPES.LABELS, prepared.labels.map(buildLabelRow))
  rows.set(TABLE_TYPES.KEYS, prepared.keys.map(buildKeyRow))
  rows.set(TABLE_TYPES.COLORS, PDB_COLORS.map(buildColorRow))
  rows.set(TABLE_TYPES.PLAYLIST_TREE, prepared.playlists.map(buildPlaylistRow))
  rows.set(TABLE_TYPES.PLAYLIST_ENTRIES, prepared.entries.map(buildPlaylistEntryRow))

  // Runtime row page: newest id is the song count for older players.
  const trackCount = prepared.tracks.length
  const today = formatDate()
  const runtimeRows = []
  if (trackCount === 0) {
    runtimeRows.push(buildRuntimeRow({ slot: 0, id: 0, date: today }))
  } else {
    runtimeRows.push(buildRuntimeRow({ slot: 0, id: 0, date: today }))
    runtimeRows.push(buildRuntimeRow({ slot: 1, id: trackCount, date: today }))
  }
  rows.set(TABLE_TYPES.HISTORY, runtimeRows)

  return rows
}

function paginateRows(rows, type) {
  const pages = []
  let current = []
  let used = 0
  const cap = 255
  for (const row of rows) {
    const nextCount = current.length + 1
    const indexSize = indexSizeFor(nextCount)
    const nextUsed = used + row.length
    if (current.length >= cap || 0x28 + nextUsed + indexSize > PAGE_SIZE) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(row)
    used += row.length
  }
  if (current.length) pages.push(current)
  return pages
}

/**
 * Build a complete `export.pdb` buffer.
 *
 * The caller may pass the output of `preparePdb` or a normalized library. A
 * prepared object is preferred because it contains the USB media/analysis
 * paths and stable track ids.
 */
export function buildPdb(input, options = {}) {
  const prepared = input?.tracks && Array.isArray(input.tracks) && input.genres
    ? input
    : preparePdb(input, options)
  const rowsByTable = buildTableRows(prepared)

  // Plan all page indices first so sentinel entries and next pointers are final.
  const plan = []
  let nextIndex = 1
  for (let type = 0; type < TABLE_COUNT; type += 1) {
    const rows = rowsByTable.get(type) || []
    const dataPages = paginateRows(rows, type)
    const sentinelIndex = nextIndex++
    const dataIndices = []
    for (let i = 0; i < dataPages.length; i += 1) dataIndices.push(nextIndex++)
    const emptyCandidate = nextIndex++
    plan.push({ type, rows, dataPages, sentinelIndex, dataIndices, emptyCandidate })
  }
  const totalPages = nextIndex

  const pages = new Array(totalPages)
  for (const table of plan) {
    const entries = table.dataIndices
    const firstData = entries[0] ?? table.emptyCandidate
    pages[table.sentinelIndex] = buildSentinelPage({
      index: table.sentinelIndex,
      type: table.type,
      nextPage: firstData,
      dataPageIndices: entries,
    })
    table.dataPages.forEach((rows, index) => {
      const pageIndex = table.dataIndices[index]
      const isLast = index === table.dataPages.length - 1
      const nextPage = isLast ? table.emptyCandidate : table.dataIndices[index + 1]
      const context = { index: pageIndex, type: table.type, nextPage }
      pages[pageIndex] = table.type === TABLE_TYPES.HISTORY
        ? buildRuntimePage(rows, context)
        : buildDataPage(rows, context)
    })
    if (!pages[table.emptyCandidate]) pages[table.emptyCandidate] = Buffer.alloc(PAGE_SIZE)
  }

  const header = Buffer.alloc(PAGE_SIZE)
  header.writeUInt32LE(0, 0x00)
  header.writeUInt32LE(PAGE_SIZE, 0x04)
  header.writeUInt32LE(TABLE_COUNT, 0x08)
  header.writeUInt32LE(totalPages, 0x0c)
  header.writeUInt32LE(5, 0x10)
  header.writeUInt32LE(100, 0x14)
  header.writeUInt32LE(0, 0x18)
  for (const table of plan) {
    const offset = 0x1c + table.type * 16
    header.writeUInt32LE(table.type, offset)
    header.writeUInt32LE(table.emptyCandidate, offset + 4)
    header.writeUInt32LE(table.sentinelIndex, offset + 8)
    header.writeUInt32LE(table.dataIndices[table.dataIndices.length - 1] ?? table.sentinelIndex, offset + 12)
  }
  pages[0] = header

  return {
    buffer: Buffer.concat(pages.map((page) => page || Buffer.alloc(PAGE_SIZE))),
    prepared,
    tables: plan.map((table) => ({
      type: table.type,
      firstPage: table.sentinelIndex,
      lastPage: table.dataIndices[table.dataIndices.length - 1] ?? table.sentinelIndex,
      emptyCandidate: table.emptyCandidate,
      dataPages: table.dataIndices,
      rows: table.rows.length,
    })),
  }
}

// ---------------------------------------------------------------------------
// PDB reader / validator
// ---------------------------------------------------------------------------

function readPageHeader(buffer, pageIndex) {
  const offset = pageIndex * PAGE_SIZE
  if (offset + 0x28 > buffer.length) return null
  const packed = buffer.readUIntLE(offset + 0x18, 3)
  return {
    index: buffer.readUInt32LE(offset + 0x04),
    type: buffer.readUInt32LE(offset + 0x08),
    nextPage: buffer.readUInt32LE(offset + 0x0c),
    sequence: buffer.readUInt32LE(offset + 0x10),
    slotCount: packed & 0x1fff,
    rowCount: packed >>> 13,
    flags: buffer[offset + 0x1b],
    freeSize: buffer.readUInt16LE(offset + 0x1c),
    usedSize: buffer.readUInt16LE(offset + 0x1e),
    u5: buffer.readUInt16LE(offset + 0x20),
    numRl: buffer.readUInt16LE(offset + 0x22),
    u6: buffer.readUInt16LE(offset + 0x24),
    u7: buffer.readUInt16LE(offset + 0x26),
  }
}

function readPageRows(buffer, pageIndex, header) {
  if ((header.flags & 0x40) !== 0 || header.slotCount === 0) return []
  const pageOffset = pageIndex * PAGE_SIZE
  const rows = []
  const groupCount = Math.ceil(header.slotCount / 16)
  for (let group = 0; group < groupCount; group += 1) {
    const base = PAGE_SIZE - group * 0x24
    const presence = buffer.readUInt16LE(pageOffset + base - 4)
    for (let n = 0; n < 16; n += 1) {
      const slot = group * 16 + n
      if (slot >= header.slotCount) break
      if (!((presence >> n) & 1)) continue
      const relative = buffer.readUInt16LE(pageOffset + base - 6 - 2 * n)
      const rowOffset = pageOffset + 0x28 + relative
      if (rowOffset < pageOffset + 0x28 || rowOffset >= pageOffset + PAGE_SIZE) continue
      rows.push({ slot, offset: rowOffset })
    }
  }
  return rows
}

function readTrackRow(buffer, offset) {
  if (offset + TRACK_ROW_SIZE > buffer.length) return null
  const value = {
    subtype: buffer.readUInt16LE(offset),
    indexShift: buffer.readUInt16LE(offset + 2),
    bitmask: buffer.readUInt32LE(offset + 4),
    sampleRate: buffer.readUInt32LE(offset + 8),
    composerId: buffer.readUInt32LE(offset + 0x0c),
    fileSize: buffer.readUInt32LE(offset + 0x10),
    artworkId: buffer.readUInt32LE(offset + 0x1c),
    keyId: buffer.readUInt32LE(offset + 0x20),
    originalArtistId: buffer.readUInt32LE(offset + 0x24),
    labelId: buffer.readUInt32LE(offset + 0x28),
    remixerId: buffer.readUInt32LE(offset + 0x2c),
    bitrate: buffer.readUInt32LE(offset + 0x30),
    trackNumber: buffer.readUInt32LE(offset + 0x34),
    tempo: buffer.readUInt32LE(offset + 0x38),
    genreId: buffer.readUInt32LE(offset + 0x3c),
    albumId: buffer.readUInt32LE(offset + 0x40),
    artistId: buffer.readUInt32LE(offset + 0x44),
    id: buffer.readUInt32LE(offset + 0x48),
    discNumber: buffer.readUInt16LE(offset + 0x4c),
    playCount: buffer.readUInt16LE(offset + 0x4e),
    year: buffer.readUInt16LE(offset + 0x50),
    sampleDepth: buffer.readUInt16LE(offset + 0x52),
    duration: buffer.readUInt16LE(offset + 0x54),
    colorId: buffer[offset + 0x58],
    rating: buffer[offset + 0x59],
    fileType: buffer.readUInt16LE(offset + 0x5a),
  }
  value.bpm = value.tempo / 100
  const strings = []
  for (let i = 0; i < 21; i += 1) {
    const relative = buffer.readUInt16LE(offset + 0x5e + i * 2)
    strings.push(relative ? decodeDeviceString(buffer, offset + relative) : '')
  }
  value.isrc = strings[0]
  value.message = strings[5]
  value.kuvoPublic = strings[6] === 'ON'
  value.autoloadHotCues = strings[7] === 'ON'
  value.dateAdded = strings[10]
  value.releaseDate = strings[11]
  value.mixName = strings[12]
  value.analysisPath = strings[14]
  value.comment = strings[16]
  value.title = strings[17]
  value.filename = strings[19]
  value.filePath = strings[20]
  return value
}

function readSimpleRow(buffer, offset, type) {
  switch (type) {
    case TABLE_TYPES.GENRES:
    case TABLE_TYPES.LABELS:
      return {
        id: buffer.readUInt32LE(offset),
        name: decodeDeviceString(buffer, offset + 4),
      }
    case TABLE_TYPES.ARTISTS: {
      const subtype = buffer.readUInt16LE(offset)
      const near = buffer[offset + 9]
      const nameOffset = subtype & 0x04 ? buffer.readUInt16LE(offset + 0x0a) : near
      return {
        id: buffer.readUInt32LE(offset + 4),
        name: decodeDeviceString(buffer, offset + nameOffset),
      }
    }
    case TABLE_TYPES.ALBUMS: {
      const subtype = buffer.readUInt16LE(offset)
      const near = buffer[offset + 21]
      const nameOffset = subtype & 0x04 ? buffer.readUInt16LE(offset + 0x16) : near
      return {
        id: buffer.readUInt32LE(offset + 12),
        artistId: buffer.readUInt32LE(offset + 8),
        name: decodeDeviceString(buffer, offset + nameOffset),
      }
    }
    case TABLE_TYPES.KEYS:
      return {
        id: buffer.readUInt32LE(offset),
        name: decodeDeviceString(buffer, offset + 8),
      }
    case TABLE_TYPES.COLORS:
      return {
        id: buffer.readUInt16LE(offset + 5),
        name: decodeDeviceString(buffer, offset + 8),
      }
    case TABLE_TYPES.PLAYLIST_TREE:
      return {
        parentId: buffer.readUInt32LE(offset),
        sortOrder: buffer.readUInt32LE(offset + 8),
        id: buffer.readUInt32LE(offset + 12),
        isFolder: buffer.readUInt32LE(offset + 16) !== 0,
        name: decodeDeviceString(buffer, offset + 20),
      }
    case TABLE_TYPES.PLAYLIST_ENTRIES:
      return {
        entryIndex: buffer.readUInt32LE(offset),
        trackId: buffer.readUInt32LE(offset + 4),
        playlistId: buffer.readUInt32LE(offset + 8),
      }
    default:
      return null
  }
}

/**
 * Parse a PDB file. The returned object is intentionally close to the binary
 * format; `usbExport` maps it into the normalized library model.
 */
export function parsePdb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PAGE_SIZE) {
    throw new Error('Not a PDB file: smaller than one page')
  }
  const pageSize = buffer.readUInt32LE(0x04)
  if (pageSize !== PAGE_SIZE) throw new Error(`Unsupported PDB page size: ${pageSize}`)
  const tableCount = buffer.readUInt32LE(0x08)
  const tables = []
  for (let i = 0; i < Math.min(tableCount, 64); i += 1) {
    const offset = 0x1c + i * 16
    if (offset + 16 > PAGE_SIZE) break
    tables.push({
      type: buffer.readUInt32LE(offset),
      emptyCandidate: buffer.readUInt32LE(offset + 4),
      firstPage: buffer.readUInt32LE(offset + 8),
      lastPage: buffer.readUInt32LE(offset + 12),
    })
  }

  const result = {
    pageSize,
    tableCount,
    nextUnusedPage: buffer.readUInt32LE(0x0c),
    sequence: buffer.readUInt32LE(0x14),
    tables,
    rows: {},
  }

  for (const table of tables) {
    const rows = []
    const visited = new Set()
    let pageIndex = table.firstPage
    while (pageIndex > 0 && pageIndex * PAGE_SIZE < buffer.length && !visited.has(pageIndex)) {
      visited.add(pageIndex)
      const header = readPageHeader(buffer, pageIndex)
      if (!header) break
      if ((header.flags & 0x40) === 0 && header.type === table.type) {
        for (const entry of readPageRows(buffer, pageIndex, header)) {
          if (table.type === TABLE_TYPES.TRACKS) {
            const row = readTrackRow(buffer, entry.offset)
            if (row) rows.push(row)
          } else {
            const row = readSimpleRow(buffer, entry.offset, table.type)
            if (row) rows.push(row)
          }
        }
      }
      if (pageIndex === table.lastPage) break
      if (header.nextPage === pageIndex || header.nextPage === 0) break
      pageIndex = header.nextPage
    }
    result.rows[table.type] = rows
  }

  const byId = (rows) => new Map((rows || []).map((row) => [row.id, row]))
  result.genresById = byId(result.rows[TABLE_TYPES.GENRES])
  result.artistsById = byId(result.rows[TABLE_TYPES.ARTISTS])
  result.albumsById = byId(result.rows[TABLE_TYPES.ALBUMS])
  result.labelsById = byId(result.rows[TABLE_TYPES.LABELS])
  result.keysById = byId(result.rows[TABLE_TYPES.KEYS])
  result.colorsById = byId(result.rows[TABLE_TYPES.COLORS])
  result.playlistsById = byId(result.rows[TABLE_TYPES.PLAYLIST_TREE])
  result.playlistEntries = result.rows[TABLE_TYPES.PLAYLIST_ENTRIES] || []
  return result
}

/**
 * Structural validation of a PDB buffer. This is not a hardware test.
 */
export function validatePdb(buffer) {
  const issues = []
  const details = { pages: 0, tables: 0, tracks: 0, playlists: 0, entries: 0 }
  try {
    const parsed = parsePdb(buffer)
    details.pages = Math.floor(buffer.length / PAGE_SIZE)
    details.tables = parsed.tables.length
    details.tracks = parsed.rows[TABLE_TYPES.TRACKS].length
    details.playlists = parsed.rows[TABLE_TYPES.PLAYLIST_TREE].length
    details.entries = parsed.rows[TABLE_TYPES.PLAYLIST_ENTRIES].length

    // `next_unused_page` may legitimately point past the end of the physical
    // file: rekordbox exports truncate trailing unused pages. Do not treat
    // that as corruption.
    for (const table of parsed.tables) {
      if (table.firstPage <= 0 || table.firstPage >= details.pages) {
        issues.push(`Table ${table.type} has an invalid first page ${table.firstPage}.`)
        continue
      }
      if (table.lastPage <= 0 || table.lastPage >= details.pages) {
        issues.push(`Table ${table.type} has an invalid last page ${table.lastPage}.`)
      }
      const first = readPageHeader(buffer, table.firstPage)
      if (!first) {
        issues.push(`Table ${table.type} first page header is unreadable.`)
        continue
      }
      if (first.index !== table.firstPage) {
        issues.push(`Table ${table.type} sentinel page reports index ${first.index}.`)
      }
      if (first.type !== table.type) {
        issues.push(`Table ${table.type} sentinel page reports type ${first.type}.`)
      }
      if ((first.flags & 0x40) === 0) {
        issues.push(`Table ${table.type} first page is not a sentinel page.`)
      }
    }

    const playlistsById = new Map(
      (parsed.rows[TABLE_TYPES.PLAYLIST_TREE] || []).map((row) => [row.id, row]),
    )
    for (const entry of parsed.playlistEntries) {
      if (!playlistsById.has(entry.playlistId)) {
        issues.push(`Playlist entry references missing playlist ${entry.playlistId}.`)
      }
    }
    for (const track of parsed.rows[TABLE_TYPES.TRACKS]) {
      if (!track.id) issues.push('Track row has id 0.')
      if (!track.filePath) issues.push(`Track ${track.id} has no media path.`)
      if (track.filePath && !track.filePath.startsWith('/Contents/')) {
        issues.push(`Track ${track.id} media path is not under /Contents/: ${track.filePath}`)
      }
    }
  } catch (error) {
    issues.push(error.message)
  }
  return { ok: issues.length === 0, issues, details }
}
