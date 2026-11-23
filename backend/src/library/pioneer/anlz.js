/**
 * Pioneer ANLZ analysis files.
 *
 * `ANLZ0000.DAT` stores the path, beat grid and standard cue list.
 * `ANLZ0000.EXT` stores extended cue data (colors), the extended beat grid and
 * higher resolution waveform previews. Players read the path recorded in the
 * PDB, so the writer only has to keep the PDB path and the files in sync.
 *
 * Both files start with a PMAI section whose `len_tag` is the whole file size.
 * That is how rekordbox writes them, even though it looks like a nested tag.
 *
 * ANLZ is big-endian. Times are milliseconds; BPM values are BPM * 100.
 */

import { createHash } from 'crypto'

export const ANLZ_MAGIC = 'PMAI'
export const PDB_ANALYSIS_PREFIX = '/PIONEER/USBANLZ'

const HEADER = 12

function u8(value) {
  const out = Buffer.alloc(1)
  out[0] = value & 0xff
  return out
}

function u16(value) {
  const out = Buffer.alloc(2)
  out.writeUInt16BE(value & 0xffff, 0)
  return out
}

function i16(value) {
  const out = Buffer.alloc(2)
  out.writeInt16BE(value, 0)
  return out
}

function u32(value) {
  const out = Buffer.alloc(4)
  out.writeUInt32BE(value >>> 0, 0)
  return out
}

function i32(value) {
  const out = Buffer.alloc(4)
  out.writeInt32BE(value, 0)
  return out
}

function section(tag, headerLength, parts, totalLength) {
  const payload = Buffer.concat(Array.isArray(parts) ? parts : [parts])
  const total = totalLength ?? HEADER + payload.length
  return Buffer.concat([
    Buffer.from(tag, 'ascii'),
    u32(headerLength),
    u32(total),
    payload,
  ])
}

function toMs(seconds) {
  const value = Number(seconds)
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 1000)) : 0
}

function clampBpm(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.max(1, Math.min(0xffff, Math.round(number * 100)))
}

/**
 * Stable analysis directory hash. Players do not recompute this; the path is
 * read from the PDB. It is kept deterministic so re-exports reuse folders.
 */
export function analysisHash(mediaPath = '') {
  let hash = 2166136261
  for (const byte of Buffer.from(String(mediaPath), 'utf8')) {
    hash ^= byte
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % 200003
}

/** Build the USB analysis path recorded in the PDB track row. */
export function analysisPathForMediaPath(mediaPath = '') {
  const hash = analysisHash(mediaPath)
  const page = (hash % 2000) + 1
  return `${PDB_ANALYSIS_PREFIX}/P${page.toString(16).toUpperCase().padStart(3, '0')}/${hash
    .toString(16)
    .toUpperCase()
    .padStart(8, '0')}/ANLZ0000.DAT`
}

/** Split an analysis path into its directory and base name. */
export function splitAnalysisPath(analysisPath = '') {
  const normalized = String(analysisPath).replace(/\\/g, '/')
  const directory = normalized.slice(0, normalized.lastIndexOf('/'))
  return { directory, fileName: normalized.split('/').pop() || 'ANLZ0000.DAT' }
}

function buildPmai(fileSize) {
  const payload = Buffer.concat([u32(fileSize), u32(1), u32(0x00010000), u32(0x00010000)])
  return section('PMAI', 28, payload, fileSize)
}

function buildPpth(mediaPath) {
  const pathBytes = Buffer.from(`${mediaPath}\u0000`, 'utf16le')
  const be = Buffer.alloc(pathBytes.length)
  // Buffer's utf16le writes little-endian; swap every pair for UTF-16BE.
  for (let i = 0; i < pathBytes.length; i += 2) {
    be[i] = pathBytes[i + 1]
    be[i + 1] = pathBytes[i]
  }
  return section('PPTH', 16, [u32(be.length), be])
}

/**
 * Build PQTZ entries from a beatgrid. When only BPM and anchor are known a
 * constant grid is generated; when no BPM exists the grid is left empty rather
 * than invented.
 */
export function buildBeatgridEntries(track = {}, maxBeats = 20000) {
  const grid = track.beatgrid || {}
  const bpm = Number(grid.bpm || track.bpm || 0)
  if (!(bpm > 0)) return []
  const anchor = Number(grid.anchor || 0)
  const duration = Number(track.duration || 0)
  const explicit = Array.isArray(grid.beats) ? grid.beats : null

  if (explicit && explicit.length) {
    const entries = []
    for (let index = 0; index < explicit.length && entries.length < maxBeats; index += 1) {
      const item = explicit[index]
      const position = typeof item === 'number' ? item : Number(item?.position)
      if (!Number.isFinite(position)) continue
      entries.push({
        beat: (index % 4) + 1,
        tempo: clampBpm(typeof item === 'object' && item?.bpm ? item.bpm : bpm),
        time: toMs(position),
      })
    }
    return entries
  }

  if (!(duration > 0)) return []
  const beatSeconds = 60 / bpm
  const entries = []
  const start = anchor
  for (let index = 0; index < maxBeats; index += 1) {
    const time = start + index * beatSeconds
    if (time > duration + 0.05) break
    entries.push({ beat: (index % 4) + 1, tempo: clampBpm(bpm), time: toMs(time) })
  }
  return entries
}

function buildPqtz(entries) {
  const parts = [u32(0), u32(0x00080000), u32(entries.length)]
  for (const entry of entries) {
    parts.push(u16(entry.beat), u16(entry.tempo), u32(entry.time))
  }
  return section('PQTZ', 24, parts)
}

function buildPqt2(entries) {
  const first = entries.slice(0, 2)
  while (first.length < 2) first.push({ beat: first.length + 1, tempo: 0, time: 0 })
  const parts = [
    u32(0),
    u32(0x01000002),
    u32(0),
  ]
  for (const entry of first) {
    parts.push(u16(entry.beat), u16(entry.tempo), u32(entry.time))
  }
  parts.push(u32(entries.length), u32(0), u32(0), u32(0))
  for (const entry of entries) {
    parts.push(u8(entry.beat), u8(0))
  }
  return section('PQT2', 56, parts)
}

function buildCuePoint(cue, { hotCue, type, time, loopTime, orderFirst, orderLast, status = 4 }) {
  const parts = [
    u32(hotCue || 0),
    u32(status),
    u32(0x00010000),
    i16(orderFirst),
    i16(orderLast),
    u8(type),
    u8(0),
    u16(1000),
    u32(time),
    i32(loopTime == null ? -1 : loopTime),
    Buffer.alloc(16),
  ]
  return section('PCPT', 28, parts)
}

function buildPcob(cueType, entries) {
  const parts = [
    u32(cueType),
    u16(0),
    u16(entries.length),
    i32(cueType === 1 ? -1 : 0),
  ]
  entries.forEach((entry, index) => {
    parts.push(
      buildCuePoint(entry, {
        hotCue: entry.hotCue,
        type: entry.type,
        time: entry.time,
        loopTime: entry.loopTime,
        orderFirst: entries.length === 1 ? -1 : index === 0 ? -1 : index - 1,
        orderLast: index === entries.length - 1 ? -1 : index + 1,
      }),
    )
  })
  return section('PCOB', 24, parts)
}

function commentBytes(comment) {
  if (!comment) return Buffer.alloc(0)
  const text = String(comment).slice(0, 255)
  const le = Buffer.from(text, 'utf16le')
  const be = Buffer.alloc(le.length)
  for (let i = 0; i < le.length; i += 2) {
    be[i] = le[i + 1]
    be[i + 1] = le[i]
  }
  return be
}

function buildCuePoint2(entry) {
  const comment = commentBytes(entry.comment)
  const color = entry.color && /^#[0-9a-f]{6}$/i.test(entry.color)
    ? [
        parseInt(entry.color.slice(1, 3), 16),
        parseInt(entry.color.slice(3, 5), 16),
        parseInt(entry.color.slice(5, 7), 16),
      ]
    : [0, 0, 0]
  // A real PCP2 entry is `88 + comment bytes` long: a 12-byte tag header,
  // 32 bytes of fixed fields, the UTF-16BE comment and a 44-byte tail
  // (color flag/rgb followed by reserved zeros).
  const entryLength = 88 + comment.length
  const parts = [
    u32(entry.hotCue || 0),
    u8(entry.type || 1),
    u8(0),
    u16(1000),
    u32(entry.time || 0),
    i32(entry.loopTime == null ? -1 : entry.loopTime),
    u8(entry.colorId || 0),
    u8(1),
    u16(0),
    u32(0),
    u16(entry.loopNumerator || 4),
    u16(entry.loopDenominator || 4),
    u32(comment.length),
    comment,
    u8(entry.color ? 1 : 0),
    u8(color[0]),
    u8(color[1]),
    u8(color[2]),
  ]
  const payload = Buffer.concat(parts)
  const padded = Buffer.concat([
    payload,
    Buffer.alloc(Math.max(0, entryLength - HEADER - payload.length)),
  ])
  return section('PCP2', 16, padded, entryLength)
}

function buildPco2(cueType, entries) {
  // PCO2 puts the cue type and count before each list, then PCP2 entries.
  const body = Buffer.concat([
    u32(cueType),
    u16(entries.length),
    u16(0),
    ...entries.map(buildCuePoint2),
  ])
  return section('PCO2', 20, body)
}

function buildPwav(bytes) {
  const data = Buffer.from(bytes)
  return section('PWAV', 20, [u32(20 + data.length), u32(data.length), data])
}

function buildPwv2(bytes) {
  const data = Buffer.from(bytes)
  return section('PWV2', 20, [u32(20 + data.length), u32(data.length), data])
}

function buildPwv3(bytes) {
  const data = Buffer.from(bytes)
  return section('PWV3', 24, [u32(1), u32(data.length), u32(0x00960000), data])
}

function buildPwv4(entries = []) {
  const bytes = Buffer.alloc(entries.length * 6)
  entries.forEach((entry, index) => {
    const values = entry || [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 6; i += 1) bytes[index * 6 + i] = values[i] || 0
  })
  return section('PWV4', 24, [u32(6), u32(entries.length), u32(0), bytes])
}

function neutralWaveform(length = 400) {
  return Buffer.alloc(length, 0x00)
}

function cueColorHex(cue) {
  return cue.color || null
}

function hotCueNumber(cue, fallback) {
  const slot = Number(cue.slot)
  if (Number.isFinite(slot) && slot >= 1 && slot <= 8) return Math.trunc(slot)
  return fallback
}

/**
 * Convert normalized cues and loops into the two ANLZ cue lists.
 * Memory cues belong to the memory list; hot cues and hot loops to the hot
 * list. Loops that only have a position become memory loops.
 */
export function cueLists(track = {}) {
  const cues = Array.isArray(track.cues) ? track.cues : []
  const loops = Array.isArray(track.loops) ? track.loops : []
  const hot = []
  const memory = []
  let hotFallback = 1

  for (const cue of cues) {
    if (cue.kind === 'memory') {
      memory.push({
        hotCue: 0,
        type: 1,
        time: toMs(cue.position),
        loopTime: -1,
        color: cueColorHex(cue),
        colorId: colorIdForColor(cue.color),
        comment: cue.name || cue.comment || '',
      })
    } else {
      const slot = hotCueNumber(cue, hotFallback)
      hotFallback = Math.max(hotFallback + 1, slot + 1)
      hot.push({
        hotCue: slot,
        type: 1,
        time: toMs(cue.position),
        loopTime: -1,
        color: cueColorHex(cue),
        colorId: colorIdForColor(cue.color),
        comment: cue.name || cue.comment || '',
      })
    }
  }

  for (const loop of loops) {
    const start = toMs(loop.start)
    const end = toMs(loop.end)
    const length = Math.max(0, end - start)
    const slot = Number(loop.slot)
    const isHot = Number.isFinite(slot) && slot >= 1 && slot <= 8
    const entry = {
      hotCue: isHot ? Math.trunc(slot) : 0,
      type: 2,
      time: start,
      loopTime: length,
      color: loop.color || null,
      colorId: colorIdForColor(loop.color),
      comment: loop.name || loop.comment || '',
      loopNumerator: 4,
      loopDenominator: 4,
    }
    if (isHot) hot.push(entry)
    else memory.push(entry)
  }

  return { hot, memory }
}

const COLOR_RGB = {
  1: [255, 0, 127],
  2: [255, 0, 0],
  3: [255, 127, 0],
  4: [255, 255, 0],
  5: [0, 255, 0],
  6: [0, 255, 255],
  7: [0, 0, 255],
  8: [127, 0, 255],
}

export function colorIdForColor(value) {
  if (!value) return 0
  const match = String(value).trim().match(/^#?([0-9a-f]{6})$/i)
  if (!match) return 0
  const rgb = [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ]
  let best = 0
  let bestDistance = Infinity
  for (const [id, color] of Object.entries(COLOR_RGB)) {
    const distance =
      (rgb[0] - color[0]) ** 2 + (rgb[1] - color[1]) ** 2 + (rgb[2] - color[2]) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = Number(id)
    }
  }
  return best
}

/**
 * Build the `.DAT` analysis file. `mediaPath` is the path from the USB root,
 * e.g. `/Contents/Artist/Track.mp3`.
 */
export function buildAnlzDat(track, mediaPath, options = {}) {
  const entries = buildBeatgridEntries(track)
  const lists = cueLists(track)
  const sections = [
    buildPpth(mediaPath),
    buildPqtz(entries),
    buildPwav(neutralWaveform(options.previewLength || 400)),
    buildPwv2(neutralWaveform(options.preview2Length || 100)),
    buildPcob(1, lists.hot),
    buildPcob(0, lists.memory),
  ]
  // PMAI's length field is the entire file. Build it after the other sections.
  const total = 28 + sections.reduce((sum, item) => sum + item.length, 0)
  return Buffer.concat([buildPmai(total), ...sections])
}

/** Build the `.EXT` analysis file with colors, extended grid and previews. */
export function buildAnlzExt(track, mediaPath, options = {}) {
  const entries = buildBeatgridEntries(track)
  const lists = cueLists(track)
  const sections = [
    buildPpth(mediaPath),
    buildPwv3(neutralWaveform(options.preview3Length || 400)),
    buildPcob(1, []),
    buildPcob(0, []),
    buildPco2(1, lists.hot),
    buildPco2(0, lists.memory),
    buildPqt2(entries),
    buildPwv4([]),
  ]
  const total = 28 + sections.reduce((sum, item) => sum + item.length, 0)
  return Buffer.concat([buildPmai(total), ...sections])
}

/** Parse the tag sequence of an ANLZ file (PMAI is skipped as a container). */
export function parseAnlz(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 28) throw new Error('Not an ANLZ file')
  const magic = buffer.subarray(0, 4).toString('ascii')
  if (magic !== ANLZ_MAGIC) throw new Error(`Unexpected ANLZ magic: ${magic}`)
  const fileLength = buffer.readUInt32BE(8)
  const tags = []
  let offset = 28
  while (offset + HEADER <= buffer.length) {
    const tag = buffer.subarray(offset, offset + 4).toString('ascii')
    if (!/^[A-Z0-9]{4}$/.test(tag)) break
    const headerLength = buffer.readUInt32BE(offset + 4)
    const length = buffer.readUInt32BE(offset + 8)
    if (headerLength < HEADER || length < HEADER || offset + length > buffer.length + 1) break
    tags.push({ tag, headerLength, length, offset })
    if (length < HEADER) break
    offset += length
  }
  return { fileLength, tags, parsedBytes: offset, ok: offset >= buffer.length - 16 }
}

/** Return the beat grid and cue lists from a DAT/EXT buffer. */
export function readAnlzDetails(buffer) {
  const parsed = parseAnlz(buffer)
  const details = { beatgrid: [], hotCues: [], memoryCues: [], loops: [] }
  for (const { tag, headerLength, length, offset } of parsed.tags) {
    if (tag === 'PQTZ') {
      const count = buffer.readUInt32BE(offset + 20)
      for (let i = 0; i < count; i += 1) {
        const entryOffset = offset + 24 + i * 8
        if (entryOffset + 8 > offset + length) break
        details.beatgrid.push({
          beat: buffer.readUInt16BE(entryOffset),
          bpm: buffer.readUInt16BE(entryOffset + 2) / 100,
          time: buffer.readUInt32BE(entryOffset + 4) / 1000,
        })
      }
    }
    if (tag === 'PCOB') {
      const cueType = buffer.readUInt32BE(offset + 12)
      const count = buffer.readUInt16BE(offset + 18)
      for (let i = 0; i < count; i += 1) {
        const entryOffset = offset + headerLength + i * 56
        if (entryOffset + 56 > offset + length) break
        const hot = buffer.readUInt32BE(entryOffset + 12)
        const type = buffer[entryOffset + 28]
        const time = buffer.readUInt32BE(entryOffset + 32) / 1000
        const loopTime = buffer.readInt32BE(entryOffset + 36)
        const cue = {
          kind: cueType === 1 ? 'hot' : 'memory',
          slot: hot || null,
          position: time,
          isLoop: type === 2,
          length: loopTime >= 0 ? loopTime / 1000 : 0,
          source: 'PCOB',
        }
        if (type === 2) details.loops.push(cue)
        else if (cueType === 1) details.hotCues.push(cue)
        else details.memoryCues.push(cue)
      }
    }
    if (tag === 'PCO2') {
      const cueType = buffer.readUInt32BE(offset + 12)
      const count = buffer.readUInt16BE(offset + 16)
      let entryOffset = offset + headerLength
      for (let i = 0; i < count; i += 1) {
        if (entryOffset + 12 > offset + length) break
        if (buffer.subarray(entryOffset, entryOffset + 4).toString('ascii') !== 'PCP2') break
        const entryLength = buffer.readUInt32BE(entryOffset + 8)
        if (entryLength < 12 || entryOffset + entryLength > offset + length) break
        const hot = buffer.readUInt32BE(entryOffset + 12)
        const type = buffer[entryOffset + 16]
        const time = buffer.readUInt32BE(entryOffset + 20) / 1000
        const loopTime = buffer.readInt32BE(entryOffset + 24)
        const colorId = buffer[entryOffset + 28]
        const commentLength = buffer.readUInt32BE(entryOffset + 40)
        const commentStart = entryOffset + 44
        const commentEnd = Math.min(commentStart + Math.min(commentLength, 510), entryOffset + entryLength)
        let comment = ''
        if (commentEnd > commentStart) {
          const le = Buffer.from(buffer.subarray(commentStart, commentEnd))
          for (let b = 0; b < le.length; b += 2) {
            const tmp = le[b]
            le[b] = le[b + 1] ?? 0
            le[b + 1] = tmp
          }
          comment = le.toString('utf16le').replace(/\u0000+$/, '')
        }
        const cue = {
          kind: cueType === 1 ? 'hot' : 'memory',
          slot: hot || null,
          position: time,
          isLoop: type === 2,
          length: loopTime >= 0 ? loopTime / 1000 : 0,
          colorId,
          comment,
          source: 'PCO2',
        }
        const detail = details.extendedCues || (details.extendedCues = [])
        detail.push(cue)
        if (type === 2) details.loops.push(cue)
        else if (cueType === 1) details.hotCues.push(cue)
        else details.memoryCues.push(cue)
        entryOffset += entryLength
      }
    }
  }
  return { ...parsed, ...details }
}

/** Structural validation of a generated DAT/EXT pair. */
export function validateAnlz(datBuffer, extBuffer = null) {
  const issues = []
  try {
    const dat = readAnlzDetails(datBuffer)
    if (!dat.ok) issues.push('DAT tag sequence does not end at the file boundary.')
    if (!dat.tags.some((tag) => tag.tag === 'PQTZ')) issues.push('DAT has no beat grid section.')
    if (!dat.tags.some((tag) => tag.tag === 'PCOB')) issues.push('DAT has no cue list section.')
    if (extBuffer) {
      const ext = readAnlzDetails(extBuffer)
      if (!ext.ok) issues.push('EXT tag sequence does not end at the file boundary.')
      if (!ext.tags.some((tag) => tag.tag === 'PCO2')) issues.push('EXT has no extended cue list.')
      if (!ext.tags.some((tag) => tag.tag === 'PQT2')) issues.push('EXT has no extended beat grid.')
    }
  } catch (error) {
    issues.push(error.message)
  }
  return { ok: issues.length === 0, issues }
}

/** Directory-safe file name for an analysis file. */
export function anlzFileNames(baseName = 'ANLZ0000') {
  return { dat: `${baseName}.DAT`, ext: `${baseName}.EXT` }
}

/** Deterministic short fingerprint used in export reports. */
export function anlzFingerprint(buffer) {
  return createHash('sha1').update(buffer).digest('hex').slice(0, 12)
}
