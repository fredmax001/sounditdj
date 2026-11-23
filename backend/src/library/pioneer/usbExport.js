/**
 * Pioneer USB export.
 *
 * The export is non-destructive: source audio is only read. Audio is copied
 * into `/Contents`, analysis files into `/PIONEER/USBANLZ`, and the database
 * into `/PIONEER/rekordbox/export.pdb`.
 *
 * Structural validation happens after writing. It proves the files parse and
 * agree with each other; it does not prove a CDJ/XDJ accepts them.
 */

import path from 'path'
import fs from 'fs-extra'
import { promises as fsp } from 'fs'
import { analysisPathForMediaPath, buildAnlzDat, buildAnlzExt, parseAnlz, validateAnlz } from './anlz.js'
import { buildPdb, parsePdb, preparePdb, validatePdb, TABLE_TYPES } from './pdb.js'
import { formatBytes } from '../devices.js'

export const CDJ_AUDIO_EXTENSIONS = Object.freeze([
  '.mp3',
  '.wav',
  '.aif',
  '.aiff',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
])

export const EXPORT_PROFILES = Object.freeze({
  'rekordbox-usb': {
    id: 'rekordbox-usb',
    name: 'Rekordbox USB (CDJ/XDJ)',
    writesPdb: true,
    writesAnlz: true,
    audioExtensions: CDJ_AUDIO_EXTENSIONS,
  },
  'audio-usb': {
    id: 'audio-usb',
    name: 'General audio USB',
    writesPdb: false,
    writesAnlz: false,
    audioExtensions: CDJ_AUDIO_EXTENSIONS,
  },
  'generic-usb': {
    id: 'generic-usb',
    name: 'General audio USB',
    writesPdb: false,
    writesAnlz: false,
    audioExtensions: CDJ_AUDIO_EXTENSIONS,
  },
})

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Make a single path segment safe for FAT32/exFAT/NTFS/HFS+/APFS. */
export function sanitizeSegment(value, fallback = 'Untitled') {
  let text = String(value ?? '')
    .normalize('NFC')
    // Control characters and characters Windows/players reject.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"\\|?*/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    // Trailing dots/spaces are invalid on Windows and confusing on DJ players.
    .replace(/[. ]+$/g, '')
  if (!text) text = fallback
  if (RESERVED_NAMES.test(text)) text = `_${text}`
  // Keep well below common 255-byte per-segment limits once UTF-8 is applied.
  return text.slice(0, 120)
}

function extensionFor(track) {
  const raw =
    path.extname(String(track.path || '')) ||
    path.extname(String(track.filename || '')) ||
    ''
  return raw.toLowerCase()
}

function baseNameFor(track) {
  const fromPath = track.path ? path.basename(String(track.path), path.extname(String(track.path))) : ''
  return sanitizeSegment(track.title || track.filename && path.basename(String(track.filename), path.extname(String(track.filename))) || fromPath, 'Untitled')
}

/**
 * Choose the USB media path for a track. Paths always start with `/Contents/`
 * because that is what Pioneer hardware expects, even on Windows volumes.
 */
export function mediaPathForTrack(track, options = {}) {
  const structure = options.folderStructure || 'artist-title'
  const extension = extensionFor(track)
  const base = baseNameFor(track)
  const artist = sanitizeSegment(track.artist || track.albumArtist, 'Unknown Artist')
  const album = sanitizeSegment(track.album, 'Unknown Album')
  let parts
  if (structure === 'flat') parts = [base]
  else if (structure === 'artist-album-title') parts = [artist, album, base]
  else if (structure === 'title') parts = [base]
  else parts = [artist, base]
  return `/Contents/${parts.join('/')}${extension}`
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function duplicateKey(track) {
  return [
    normalizeKey(track.artist || track.albumArtist),
    normalizeKey(track.title),
    track.duration ? Math.round(Number(track.duration) / 2) : '',
  ].join('|')
}

/**
 * Build an export plan without touching the destination.
 *
 * Returns every track with its destination, status and the reasons data was
 * dropped. The route layer uses this for the import/export preview.
 */
export async function planUsbExport(library, mountPoint, options = {}) {
  const profile = EXPORT_PROFILES[options.profile] || EXPORT_PROFILES['rekordbox-usb']
  const supported = new Set(profile.audioExtensions)
  const tracks = Array.isArray(library?.tracks) ? library.tracks : []
  const warnings = []
  const preserved = []
  const converted = []
  const lost = []
  const skipped = []
  const duplicates = []
  const planned = []
  const usedPaths = new Map()
  const seenSource = new Set()
  let bytesToCopy = 0

  for (const track of tracks) {
    const entry = {
      id: track.id || track.sourceId || track.path || null,
      title: track.title || null,
      artist: track.artist || null,
      sourcePath: track.path || null,
      destination: null,
      mediaPath: null,
      analysisPath: null,
      size: Number(track.fileSize) || null,
      status: 'pending',
      reason: null,
      cues: Array.isArray(track.cues) ? track.cues.length : 0,
      loops: Array.isArray(track.loops) ? track.loops.length : 0,
      hasBeatgrid: Boolean(track.beatgrid && Number(track.beatgrid.bpm || track.bpm) > 0),
    }

    if (track.streaming) {
      entry.status = 'skipped'
      entry.reason = 'Streaming track has no downloadable audio file.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    if (track.protected) {
      entry.status = 'skipped'
      entry.reason = 'Protected/DRM audio cannot be copied.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    if (!track.path) {
      entry.status = 'skipped'
      entry.reason = 'Track has no source path.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }

    let stat = null
    try {
      stat = await fs.stat(track.path)
    } catch {
      entry.status = 'missing'
      entry.reason = 'Source file is missing or unreadable.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    if (!stat.isFile()) {
      entry.status = 'missing'
      entry.reason = 'Source path is not a file.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    entry.size = stat.size

    const sourceKey = `${track.path}|${stat.size}`
    if (seenSource.has(sourceKey)) {
      entry.status = 'skipped'
      entry.reason = 'Duplicate of an earlier track in this export.'
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    seenSource.add(sourceKey)

    const extension = extensionFor(track)
    if (!extension) {
      entry.status = 'skipped'
      entry.reason = 'File has no extension; player support cannot be guaranteed.'
      lost.push({ id: entry.id, title: entry.title, data: 'audio', reason: entry.reason })
      skipped.push(entry)
      planned.push(entry)
      continue
    }
    if (!supported.has(extension)) {
      warnings.push(`${entry.title || entry.sourcePath}: ${extension} is not in the ${profile.name} supported list; it will be copied but hardware support is unverified.`)
      lost.push({
        id: entry.id,
        title: entry.title,
        data: 'hardware-playback',
        reason: `${extension} is outside the verified CDJ extension list.`,
      })
    }

    let mediaPath = mediaPathForTrack(track, options)
    const lower = mediaPath.toLowerCase()
    if (usedPaths.has(lower)) {
      const ext = path.extname(mediaPath)
      const stem = mediaPath.slice(0, -ext.length)
      let counter = 2
      while (usedPaths.has(`${stem} (${counter})${ext}`.toLowerCase())) counter += 1
      mediaPath = `${stem} (${counter})${ext}`
      warnings.push(`Filename collision for "${entry.title}"; exported as "${path.basename(mediaPath)}".`)
    }
    usedPaths.set(mediaPath.toLowerCase(), entry.id)

    const analysisPath = profile.writesAnlz ? analysisPathForMediaPath(mediaPath) : null

    entry.destination = path.join(mountPoint, mediaPath.split('/').join(path.sep))
    entry.mediaPath = mediaPath
    entry.analysisPath = analysisPath
    entry.status = 'ready'
    bytesToCopy += stat.size
    planned.push(entry)

    if (entry.cues || entry.loops) converted.push({ id: entry.id, title: entry.title, data: 'cues/loops' })
    if (entry.hasBeatgrid) converted.push({ id: entry.id, title: entry.title, data: 'beatgrid' })
    if (track.comment || track.color || track.rating) preserved.push({ id: entry.id, title: entry.title, data: 'tags' })
  }

  const ready = planned.filter((entry) => entry.status === 'ready')

  // Compare against tracks already on the device, when a PDB is present.
  const existingPdbPath = path.join(mountPoint, 'PIONEER', 'rekordbox', 'export.pdb')
  if (profile.writesPdb && (await fs.pathExists(existingPdbPath))) {
    try {
      const existing = parsePdb(await fs.readFile(existingPdbPath))
      const existingKeys = new Set(
        (existing.rows[TABLE_TYPES.TRACKS] || []).map((track) =>
          duplicateKey({ artist: track.artist, title: track.title, duration: track.duration }),
        ),
      )
      for (const entry of ready) {
        const key = duplicateKey({ artist: entry.artist, title: entry.title })
        if (existingKeys.has(key)) {
          const duplicate = { id: entry.id, title: entry.title, artist: entry.artist }
          duplicates.push(duplicate)
          if (options.duplicatePolicy === 'skip') {
            entry.status = 'skipped'
            entry.reason = 'Already present on the device.'
            skipped.push(entry)
            bytesToCopy -= entry.size || 0
          }
        }
      }
    } catch (error) {
      warnings.push(`Could not read the existing device database for duplicate checks: ${error.message}`)
    }
  }

  let freeBytes = null
  let totalBytes = null
  try {
    const statfs = await fs.statfs(mountPoint)
    freeBytes = Number(statfs.bavail) * Number(statfs.bsize)
    totalBytes = Number(statfs.blocks) * Number(statfs.bsize)
  } catch {
    warnings.push('Could not read free space for the destination.')
  }

  const overhead = ready.length * 8 * 1024
  const requiredBytes = bytesToCopy + overhead
  const required = formatBytes(requiredBytes)
  const free = freeBytes == null ? null : formatBytes(freeBytes)
  if (freeBytes != null && requiredBytes > freeBytes) {
    warnings.push(`Not enough space: need ${required} but only ${free} is free.`)
  }

  return {
    target: mountPoint,
    profile: profile.id,
    profileName: profile.name,
    counts: {
      total: planned.length,
      ready: ready.length,
      skipped: skipped.length,
      missing: planned.filter((entry) => entry.status === 'missing').length,
      duplicates: duplicates.length,
      cues: ready.reduce((sum, entry) => sum + entry.cues, 0),
      loops: ready.reduce((sum, entry) => sum + entry.loops, 0),
      beatgrids: ready.filter((entry) => entry.hasBeatgrid).length,
    },
    bytesToCopy,
    required: formatBytes(requiredBytes),
    free,
    total: totalBytes == null ? null : formatBytes(totalBytes),
    hasSpace: freeBytes == null ? null : requiredBytes <= freeBytes,
    tracks: planned,
    duplicates,
    warnings,
    preserved,
    converted,
    lost,
    skipped,
    playlists: (library?.playlists || []).length,
  }
}

async function copyFileWithProgress(source, destination, entry, options = {}) {
  await fs.ensureDir(path.dirname(destination))
  const temp = `${destination}.sounditdj-part`
  const sourceHandle = await fsp.open(source, 'r')
  const destHandle = await fsp.open(temp, 'w')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  let copied = 0
  try {
    while (true) {
      if (options.signal?.aborted) throw Object.assign(new Error('Export cancelled'), { cancelled: true })
      const { bytesRead } = await sourceHandle.read(buffer, 0, buffer.length, null)
      if (!bytesRead) break
      await destHandle.write(buffer, 0, bytesRead, null)
      copied += bytesRead
      options.onProgress?.({
        phase: 'copy',
        entry,
        bytesCopied: copied,
        bytesTotal: entry.size,
      })
    }
    await destHandle.sync().catch(() => {})
  } finally {
    await sourceHandle.close().catch(() => {})
    await destHandle.close().catch(() => {})
  }
  await fs.move(temp, destination, { overwrite: true })
  return copied
}

async function backupPioneerFiles(mountPoint, timestamp) {
  const backupRoot = path.join(mountPoint, '.sounditdj-backups', timestamp)
  const moves = [
    ['PIONEER/rekordbox/export.pdb', 'PIONEER/rekordbox/export.pdb'],
    ['PIONEER/USBANLZ', 'PIONEER/USBANLZ'],
  ]
  const moved = []
  for (const [sourceRel, destRel] of moves) {
    const source = path.join(mountPoint, sourceRel)
    if (!(await fs.pathExists(source))) continue
    const destination = path.join(backupRoot, destRel)
    await fs.ensureDir(path.dirname(destination))
    await fs.move(source, destination, { overwrite: true })
    moved.push(sourceRel)
  }
  return { root: backupRoot, moved }
}

/**
 * Export a normalized library to a mounted USB device.
 *
 * Options:
 * - profile: 'rekordbox-usb' | 'audio-usb'
 * - folderStructure: 'artist-title' | 'artist-album-title' | 'flat' | 'title'
 * - duplicatePolicy: 'copy' | 'skip'
 * - backup: move an existing PDB/USBANLZ into `.sounditdj-backups/<ts>`
 * - signal: AbortSignal for cancellation
 * - onProgress({ phase, entry, ... })
 */
export async function exportLibraryToUsb(library, mountPoint, options = {}) {
  const startedAt = new Date()
  const profile = EXPORT_PROFILES[options.profile] || EXPORT_PROFILES['rekordbox-usb']
  const report = {
    ok: false,
    cancelled: false,
    target: mountPoint,
    profile: profile.id,
    profileName: profile.name,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    durationMs: 0,
    counts: { tracks: 0, copied: 0, skipped: 0, failed: 0, playlists: 0, cues: 0, loops: 0 },
    bytesCopied: 0,
    bytesRequired: 0,
    freeBefore: null,
    freeAfter: null,
    backup: null,
    tracks: [],
    playlists: [],
    preserved: [],
    converted: [],
    lost: [],
    skipped: [],
    warnings: [],
    errors: [],
    validation: { pdb: null, anlz: [] },
  }

  const fail = (message) => {
    const error = new Error(message)
    error.report = report
    throw error
  }

  if (!mountPoint) fail('No destination device was provided.')
  if (!(await fs.pathExists(mountPoint))) fail(`Destination does not exist: ${mountPoint}`)
  const stat = await fs.stat(mountPoint)
  if (!stat.isDirectory()) fail(`Destination is not a directory: ${mountPoint}`)

  options.onProgress?.({ phase: 'planning' })
  const plan = await planUsbExport(library, mountPoint, options)
  await attachTracksToPlan(library, plan)
  report.tracks = plan.tracks
  report.warnings.push(...plan.warnings)
  report.preserved = plan.preserved
  report.converted = plan.converted
  report.lost = plan.lost
  report.skipped = plan.skipped
  report.bytesRequired = plan.bytesToCopy
  report.freeBefore = plan.free
  report.validation.plan = plan

  if (plan.hasSpace === false) {
    fail(`Not enough free space. Need ${plan.required}, ${plan.free} available.`)
  }

  try {
    const freeStat = await fs.statfs(mountPoint)
    report.freeBytesBefore = Number(freeStat.bavail) * Number(freeStat.bsize)
  } catch {
    report.freeBytesBefore = null
  }

  if (options.backup) {
    const timestamp = startedAt.toISOString().replace(/[:.]/g, '-')
    options.onProgress?.({ phase: 'backup' })
    report.backup = await backupPioneerFiles(mountPoint, timestamp)
  }

  const ready = plan.tracks.filter((entry) => entry.status === 'ready')

  try {
    for (let index = 0; index < ready.length; index += 1) {
      const entry = ready[index]
      if (options.signal?.aborted) throw Object.assign(new Error('Export cancelled'), { cancelled: true })
      options.onProgress?.({
        phase: 'copy',
        index,
        total: ready.length,
        entry,
      })
      try {
        await copyFileWithProgress(entry.sourcePath, entry.destination, entry, options)
        entry.status = 'copied'
        report.counts.copied += 1
        report.bytesCopied += entry.size || 0
      } catch (error) {
        if (error.cancelled) throw error
        entry.status = 'failed'
        entry.reason = error.message
        report.errors.push({ id: entry.id, title: entry.title, error: error.message })
        report.counts.failed += 1
      }
    }

    if (profile.writesAnlz) {
      const copied = ready.filter((entry) => entry.status === 'copied')
      for (let index = 0; index < copied.length; index += 1) {
        const entry = copied[index]
        if (options.signal?.aborted) throw Object.assign(new Error('Export cancelled'), { cancelled: true })
        options.onProgress?.({ phase: 'analysis', index, total: copied.length, entry })
        const track = entry.track
        const dat = buildAnlzDat(track, entry.mediaPath)
        const ext = buildAnlzExt(track, entry.mediaPath)
        const check = validateAnlz(dat, ext)
        report.validation.anlz.push({ id: entry.id, title: entry.title, ok: check.ok, issues: check.issues })
        if (!check.ok) {
          entry.status = 'analysis-failed'
          entry.reason = check.issues.join('; ')
          report.errors.push({ id: entry.id, title: entry.title, error: entry.reason })
          continue
        }
        const directory = path.join(mountPoint, entry.analysisPath.split('/').slice(0, -1).join('/'))
        await fs.ensureDir(directory)
        await fs.writeFile(path.join(directory, 'ANLZ0000.DAT'), dat)
        await fs.writeFile(path.join(directory, 'ANLZ0000.EXT'), ext)
        entry.status = 'exported'
        entry.analysisWritten = true
      }
    } else {
      ready.forEach((entry) => {
        if (entry.status === 'copied') entry.status = 'exported'
      })
    }

    if (profile.writesPdb) {
      options.onProgress?.({ phase: 'database' })
      const exportedTracks = ready
        .filter((entry) => entry.status === 'exported')
        .map((entry) => entry.track)
      const mediaPaths = new Map()
      const analysisPaths = new Map()
      for (const entry of ready) {
        if (entry.status !== 'exported') continue
        const track = entry.track
        for (const key of [track.sourceId, track.path, track.id]) {
          if (key != null) {
            mediaPaths.set(String(key), entry.mediaPath)
            analysisPaths.set(String(key), entry.analysisPath)
          }
        }
      }
      const resolve = (map) => (track) => {
        for (const key of [track.sourceId, track.path, track.id]) {
          if (key != null && map.has(String(key))) return map.get(String(key))
        }
        return `/Contents/${sanitizeSegment(track.filename || path.basename(track.path || ''), 'track')}`
      }
      const subset = { ...library, tracks: exportedTracks }
      const prepared = preparePdb(subset, {
        mediaPathForTrack: resolve(mediaPaths),
        analysisPathForTrack: resolve(analysisPaths),
      })
      report.warnings.push(...prepared.warnings)
      const pdb = buildPdb(prepared).buffer
      const pdbDirectory = path.join(mountPoint, 'PIONEER', 'rekordbox')
      await fs.ensureDir(pdbDirectory)
      const pdbPath = path.join(pdbDirectory, 'export.pdb')
      await fs.writeFile(pdbPath, pdb)
      const validation = validatePdb(pdb)
      const parsed = parsePdb(pdb)
      report.validation.pdb = {
        ...validation,
        path: pdbPath,
        bytes: pdb.length,
        parsedTracks: (parsed.rows[TABLE_TYPES.TRACKS] || []).length,
        parsedPlaylists: (parsed.rows[TABLE_TYPES.PLAYLIST_TREE] || []).length,
        parsedEntries: (parsed.rows[TABLE_TYPES.PLAYLIST_ENTRIES] || []).length,
      }
      report.counts.tracks = exportedTracks.length
      report.counts.playlists = prepared.playlists.filter((playlist) => !playlist.isFolder).length
      report.counts.cues = exportedTracks.reduce((sum, track) => sum + (track.cues?.length || 0), 0)
      report.counts.loops = exportedTracks.reduce((sum, track) => sum + (track.loops?.length || 0), 0)
      if (!validation.ok) {
        report.errors.push({ error: `PDB validation: ${validation.issues.join('; ')}` })
      }
      // Read-back check: every exported track must appear with its media path.
      const parsedByPath = new Set((parsed.rows[TABLE_TYPES.TRACKS] || []).map((track) => track.filePath))
      for (const entry of ready.filter((item) => item.status === 'exported')) {
        if (!parsedByPath.has(entry.mediaPath)) {
          report.errors.push({
            id: entry.id,
            title: entry.title,
            error: 'Exported track is missing from the written database.',
          })
        }
      }
    } else {
      report.counts.tracks = ready.filter((entry) => entry.status === 'exported').length
    }

    report.counts.skipped = plan.tracks.filter((entry) => entry.status === 'skipped').length
    report.ok = report.errors.length === 0
  } catch (error) {
    if (error.cancelled || options.signal?.aborted) {
      report.cancelled = true
      report.warnings.push('Export was cancelled. Partially copied tracks remain on the device.')
    } else {
      report.errors.push({ error: error.message })
      report.ok = false
    }
  } finally {
    report.finishedAt = new Date().toISOString()
    report.durationMs = Date.now() - startedAt.getTime()
    try {
      const freeStat = await fs.statfs(mountPoint)
      report.freeBytesAfter = Number(freeStat.bavail) * Number(freeStat.bsize)
      report.freeAfter = formatBytes(report.freeBytesAfter)
    } catch {
      report.freeAfter = null
    }
    options.onProgress?.({ phase: 'done', report })
  }

  return report
}

/** Attach the original track to each plan entry so the writer can use it. */
export async function attachTracksToPlan(library, plan) {
  const byKey = new Map()
  for (const track of library?.tracks || []) {
    for (const key of [track.sourceId, track.path, track.id]) {
      if (key != null) byKey.set(String(key), track)
    }
  }
  for (const entry of plan.tracks || []) {
    entry.track = byKey.get(String(entry.id)) || null
  }
  return plan
}
