/**
 * Library migration API: import, export, devices, conversion and history.
 *
 * These routes work on the normalized library model. They never modify source
 * libraries: imports read source files, exports copy audio to a destination.
 */

import path from 'path'
import fs from 'fs-extra'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import * as musicMetadata from 'music-metadata'

import {
  ADAPTERS,
  importLibraryPath,
} from '../library/formats/index.js'
import {
  IMPORT_FORMATS,
  SOURCE_FORMATS,
  TARGET_PROFILES,
  buildCompatibilityReport,
  summarizeLibrary,
} from '../library/model.js'
import {
  backupDatabase,
  commitLibraryImport,
  ensureMigrationSchema,
  logMigration,
  setJobState,
} from '../library/db.js'
import {
  browseDevice,
  browseDeviceTracks,
  ejectDevice,
  formatBytes,
  getDevice,
  inspectDeviceLibrary,
  listDevices,
  startDeviceWatcher,
} from '../library/devices.js'
import {
  EXPORT_PROFILES,
  exportLibraryToUsb,
  planUsbExport,
} from '../library/pioneer/usbExport.js'
import { generateRekordboxXml } from '../library/formats/rekordboxXml.js'
import { generateVirtualDjXml } from '../library/formats/virtualdj.js'
import { generateSeratoCrate } from '../library/formats/serato.js'

const router = express.Router()

const activeJobs = new Map()

function userExportsDir(req) {
  return path.join(req.app.locals.runtime.tempDir, 'migration-exports')
}

/**
 * Rebuild a normalized library from the application database.
 * Optional `playlistIds` limits the export to selected playlists (and their
 * ancestor folders) while still de-duplicating tracks.
 */
export async function buildLibraryFromDatabase(db, userId, options = {}) {
  const trackRows = await db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId)
  const cueRows = await db.prepare(
    `SELECT c.* FROM cue_points c JOIN tracks t ON t.id = c.track_id WHERE t.user_id = ?`,
  ).all(userId)
  const loopRows = await db.prepare(
    `SELECT l.* FROM track_loops l JOIN tracks t ON t.id = l.track_id WHERE t.user_id = ?`,
  ).all(userId)
  const folderRows = await db.prepare('SELECT * FROM playlist_folders WHERE user_id = ?').all(userId)
  const playlistRows = await db.prepare('SELECT * FROM playlists WHERE user_id = ?').all(userId)
  const entryRows = await db.prepare(
    `SELECT pt.playlist_id, pt.track_id, pt.position
     FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id
     WHERE p.user_id = ? ORDER BY pt.playlist_id, pt.position`,
  ).all(userId)

  const cuesByTrack = new Map()
  for (const cue of cueRows) {
    if (!cuesByTrack.has(cue.track_id)) cuesByTrack.set(cue.track_id, [])
    cuesByTrack.get(cue.track_id).push({
      kind: cue.kind === 'memory' ? 'memory' : 'hot',
      slot: cue.slot ?? null,
      name: cue.name || null,
      position: Number(cue.position) || 0,
      color: cue.color || null,
      comment: cue.comment || null,
      sourceId: cue.source_id || cue.id,
    })
  }
  const loopsByTrack = new Map()
  for (const loop of loopRows) {
    if (!loopsByTrack.has(loop.track_id)) loopsByTrack.set(loop.track_id, [])
    loopsByTrack.get(loop.track_id).push({
      slot: loop.slot ?? null,
      name: loop.name || null,
      start: Number(loop.start_position) || 0,
      end: Number(loop.end_position) || 0,
      color: loop.color || null,
      locked: Boolean(loop.locked),
      sourceId: loop.source_id || loop.id,
    })
  }
  const entriesByPlaylist = new Map()
  for (const entry of entryRows) {
    if (!entriesByPlaylist.has(entry.playlist_id)) entriesByPlaylist.set(entry.playlist_id, [])
    entriesByPlaylist.get(entry.playlist_id).push(entry.track_id)
  }

  const selected = Array.isArray(options.playlistIds) && options.playlistIds.length
    ? new Set(options.playlistIds.map(String))
    : null
  const trackIdsToInclude = new Set()
  if (selected) {
    for (const playlistId of selected) {
      for (const trackId of entriesByPlaylist.get(playlistId) || []) trackIdsToInclude.add(trackId)
    }
  }

  const tracks = trackRows
    .filter((row) => !selected || trackIdsToInclude.has(row.id))
    .map((row) => ({
      sourceId: row.id,
      id: row.id,
      title: row.title || row.original_name || null,
      artist: row.artist || null,
      album: row.album || null,
      albumArtist: row.artist || null,
      genre: row.genre || null,
      comment: row.comment || null,
      composer: row.composer || null,
      bpm: row.bpm == null ? null : Number(row.bpm),
      key: row.key || null,
      duration: row.duration == null ? null : Number(row.duration),
      path: row.path || null,
      filename: row.filename || null,
      fileSize: row.file_size == null ? null : Number(row.file_size),
      bitrate: row.bitrate == null ? null : Number(row.bitrate),
      sampleRate: row.sample_rate == null ? null : Number(row.sample_rate),
      trackNumber: row.track_number == null ? null : Number(row.track_number),
      discNumber: row.disc_number == null ? null : Number(row.disc_number),
      year: row.year == null ? null : Number(row.year),
      rating: row.rating == null ? null : Number(row.rating),
      color: row.color || null,
      dateAdded: row.date_added || null,
      playCount: row.play_count == null ? null : Number(row.play_count),
      cues: cuesByTrack.get(row.id) || [],
      loops: loopsByTrack.get(row.id) || [],
      beatgrid: row.beatgrid ? safeJson(row.beatgrid) : null,
      tags: row.tags ? safeJson(row.tags) : [],
      streaming: Boolean(row.streaming),
      protected: Boolean(row.protected),
      missing: Boolean(row.missing),
      sourceMeta: row.metadata ? safeJson(row.metadata) || {} : {},
    }))

  const nodes = new Map()
  for (const row of folderRows) {
    nodes.set(row.id, {
      sourceId: row.id,
      id: row.id,
      name: row.name || 'Folder',
      parentId: row.parent_id || null,
      isFolder: true,
      trackIds: [],
      children: [],
    })
  }
  for (const row of playlistRows) {
    if (selected && !selected.has(row.id)) continue
    nodes.set(row.id, {
      sourceId: row.id,
      id: row.id,
      name: row.name || 'Playlist',
      parentId: row.folder_id || null,
      isFolder: false,
      trackIds: (entriesByPlaylist.get(row.id) || []).filter((trackId) => !selected || trackIdsToInclude.has(trackId)),
      children: [],
    })
  }
  const roots = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }

  return {
    modelVersion: 1,
    source: 'sounditdj-database',
    generatedAt: new Date().toISOString(),
    tracks,
    playlists: roots,
    warnings: [],
    unsupported: [],
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function requireDb(req) {
  if (!req.app.locals.db) throw new Error('Database is not available')
  return req.app.locals.db
}

function jobSummary(job) {
  if (!job) return null
  return {
    id: job.id,
    kind: job.kind,
    source: job.source,
    target: job.target,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    stats: job.stats ? safeJson(job.stats) || job.stats : null,
    error: job.error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
  }
}

async function createJob(db, userId, fields) {
  const id = uuidv4()
  await db.prepare(
    `INSERT INTO migration_jobs (id, user_id, kind, source, target, status, stage, progress, stats, report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, userId, fields.kind, fields.source || null, fields.target || null,
    fields.status || 'pending', fields.stage || 'queued', 0,
    JSON.stringify(fields.stats || {}), fields.report ? JSON.stringify(fields.report) : null,
  )
  return id
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

router.get('/formats', (req, res) => {
  res.json({
    import: IMPORT_FORMATS,
    adapters: ADAPTERS,
    targets: TARGET_PROFILES,
    usbProfiles: EXPORT_PROFILES,
    limitations: [
      'Rekordbox local master.db is SQLCipher-encrypted and cannot be imported directly; use rekordbox XML or a USB export.',
      'Pioneer PDB/ANLZ output is structurally validated, not tested on physical CDJ/XDJ hardware.',
      'Apple Music streaming and DRM-protected tracks cannot be copied or exported.',
    ],
  })
})

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

router.get('/devices', async (req, res) => {
  try {
    const devices = await listDevices()
    res.json({ devices })
  } catch (error) {
    res.status(500).json({ error: `Could not enumerate devices: ${error.message}` })
  }
})

router.get('/devices/:id', async (req, res) => {
  try {
    const device = await getDevice(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    res.json({ device })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/devices/:id/browse', async (req, res) => {
  try {
    const device = await getDevice(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    const entries = await browseDevice(device.mountPoint, req.query.path || '')
    res.json({ mountPoint: device.mountPoint, path: req.query.path || '', entries })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/devices/:id/inspect', async (req, res) => {
  try {
    const device = await getDevice(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    const library = await inspectDeviceLibrary(device.mountPoint)
    res.json({ device, library })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/devices/:id/tracks', async (req, res) => {
  try {
    const device = await getDevice(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    const tracks = await browseDeviceTracks(device.mountPoint, req.query.path || '')
    res.json({ mountPoint: device.mountPoint, path: req.query.path || '', tracks })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/devices/import-local', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user?.id || 'default'
    const { filePaths, copyAudio = true } = req.body

    if (!Array.isArray(filePaths) || !filePaths.length) {
      return res.status(400).json({ error: 'filePaths array is required' })
    }

    const uploadsDir = path.join(process.cwd(), 'backend', 'uploads')
    const tracksDir = path.join(uploadsDir, 'tracks')
    const artworkDir = path.join(uploadsDir, 'artwork')
    await fs.ensureDir(tracksDir)
    await fs.ensureDir(artworkDir)

    const imported = []
    for (const srcPath of filePaths) {
      if (!(await fs.pathExists(srcPath))) continue

      let finalPath = srcPath
      const filename = path.basename(srcPath)

      if (copyAudio) {
        const destFilename = `${uuidv4()}-${filename}`
        finalPath = path.join(tracksDir, destFilename)
        await fs.copy(srcPath, finalPath)
      }

      let metadata = {}
      let bpm = null
      let key = null
      let duration = null
      let artwork = null
      let genre = null

      try {
        const parsed = await musicMetadata.parseFile(srcPath)
        metadata = parsed.common || {}
        duration = parsed.format.duration || null
        if (metadata.bpm) bpm = metadata.bpm
        if (metadata.key) key = metadata.key
        if (metadata.genre) genre = Array.isArray(metadata.genre) ? metadata.genre[0] : metadata.genre

        if (metadata.picture && metadata.picture.length > 0) {
          const picture = metadata.picture[0]
          const artFilename = `${uuidv4()}.jpg`
          const artDest = path.join(artworkDir, artFilename)
          await fs.writeFile(artDest, picture.data)
          artwork = `/uploads/artwork/${artFilename}`
        }
      } catch (err) {
        console.warn('Metadata read error on import:', err.message)
      }

      const trackId = uuidv4()
      const ext = path.extname(filename)
      const baseName = path.basename(filename, ext)
      let title = metadata.title || baseName
      let artist = metadata.artist || 'Unknown Artist'
      if (!metadata.title && baseName.includes(' - ')) {
        const parts = baseName.split(' - ')
        artist = parts[0].trim()
        title = parts.slice(1).join(' - ').trim()
      }

      await db
        .prepare(
          `INSERT INTO tracks (
            id, user_id, filename, original_name, path, title, artist, album, bpm, key, duration, artwork, metadata, genre
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          trackId,
          userId,
          path.basename(finalPath),
          filename,
          finalPath,
          title,
          artist,
          metadata.album || null,
          bpm,
          key,
          duration,
          artwork,
          JSON.stringify(metadata),
          genre
        )

      imported.push({
        id: trackId,
        title,
        artist,
        album: metadata.album || null,
        bpm,
        key,
        duration,
        artwork,
        genre,
        path: finalPath,
        filename,
      })
    }

    res.json({ success: true, count: imported.length, tracks: imported })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/devices/:id/eject', async (req, res) => {
  try {
    const result = await ejectDevice(req.params.id)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/devices-watch/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders?.()
  const stop = startDeviceWatcher((devices, error) => {
    res.write(`event: devices\ndata: ${JSON.stringify({ devices, error: error?.message || null })}\n\n`)
  })
  req.on('close', stop)
})

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

router.post('/import/preview', async (req, res) => {
  try {
    const library = await importLibraryPath(req.body.path, {
      format: req.body.format || undefined,
      relink: req.body.relink || [],
      enrichTags: req.body.enrichTags !== false,
    })
    res.json({
      summary: summarizeLibrary(library),
      compatibility: buildCompatibilityReport(library, req.body.target || 'rekordbox-usb'),
      warnings: library.warnings || [],
      unsupported: library.unsupported || [],
      sampleTracks: library.tracks.slice(0, 25).map((track) => ({
        sourceId: track.sourceId,
        title: track.title,
        artist: track.artist,
        bpm: track.bpm,
        key: track.key,
        path: track.path,
        missing: track.missing,
        streaming: track.streaming,
        protected: track.protected,
        cues: track.cues?.length || 0,
        loops: track.loops?.length || 0,
        hasBeatgrid: Boolean(track.beatgrid && Number(track.beatgrid.bpm || track.bpm) > 0),
      })),
      playlists: library.playlists.slice(0, 50).map((playlist) => ({
        name: playlist.name,
        isFolder: Boolean(playlist.isFolder),
        tracks: playlist.trackIds?.length || playlist.children?.length || 0,
      })),
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/import', async (req, res) => {
  const db = requireDb(req)
  let jobId
  try {
    jobId = await createJob(db, req.user.id, {
      kind: 'import',
      source: req.body.path,
      target: 'sounditdj',
      status: 'running',
      stage: 'importing',
    })
    activeJobs.set(jobId, {
      id: jobId,
      kind: 'import',
      source: req.body.path,
      target: 'sounditdj',
      status: 'running',
      stage: 'importing',
      progress: 0,
    })
    res.status(202).json({ jobId })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }

  const run = async () => {
    try {
      await logMigration(db, jobId, req.user.id, 'info', `Importing ${req.body.path}`)
      const library = await importLibraryPath(req.body.path, {
        format: req.body.format || undefined,
        relink: req.body.relink || [],
        enrichTags: req.body.enrichTags !== false,
        readMetadata: req.body.readMetadata !== false,
      })
      const summary = summarizeLibrary(library)
      const compatibility = buildCompatibilityReport(library, req.body.target || 'rekordbox-usb')
      await setJobState(db, jobId, { status: 'running', stage: 'saving', progress: 60, stats: summary })
      activeJobs.set(jobId, {
        id: jobId,
        kind: 'import',
        status: 'running',
        stage: 'saving',
        progress: 60,
        stats: summary,
      })
      const result = await commitLibraryImport(db, req.user.id, library, {
        relink: req.body.relink || [],
        sourcePath: req.body.path,
        sourceLabel: req.body.label || undefined,
      })
      const report = {
        summary,
        stats: result.stats,
        compatibility,
        warnings: [...(library.warnings || []), ...(result.stats.warnings || [])],
        unsupported: library.unsupported || [],
        source: library.source,
        sourcePath: req.body.path,
      }
      await setJobState(db, jobId, {
        status: 'completed',
        stage: 'done',
        progress: 100,
        stats: { ...summary, ...result.stats },
        report,
      })
      activeJobs.set(jobId, {
        id: jobId,
        kind: 'import',
        status: 'completed',
        stage: 'done',
        progress: 100,
        report,
      })
      await logMigration(db, jobId, req.user.id, 'info', 'Import finished', result.stats)
    } catch (error) {
      await setJobState(db, jobId, {
        status: 'error',
        stage: 'error',
        error: error.message,
      })
      activeJobs.set(jobId, {
        id: jobId,
        kind: 'import',
        status: 'error',
        stage: 'error',
        error: error.message,
      })
      await logMigration(db, jobId, req.user.id, 'error', `Import failed: ${error.message}`)
    }
  }
  run()
})

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function prepareExport(req) {
  const db = requireDb(req)
  const library = await buildLibraryFromDatabase(db, req.user.id, {
    playlistIds: req.body.playlistIds,
  })
  if (!library.tracks.length) throw new Error('No tracks match the export selection.')
  const target = req.body.profile || req.body.target || 'rekordbox-usb'
  const isDeviceTarget = Boolean(
    EXPORT_PROFILES[target] || ['rekordbox-usb', 'generic-usb', 'audio-usb'].includes(target)
  )
  const mountPoint = req.body.mountPoint || (req.body.deviceId ? (await getDevice(req.body.deviceId))?.mountPoint : null)
  if (isDeviceTarget && !mountPoint) throw new Error('A mounted destination device is required.')
  return { db, library, mountPoint, isDeviceTarget, target }
}

router.post('/export/preview', async (req, res) => {
  try {
    const { library, mountPoint, isDeviceTarget, target } = await prepareExport(req)
    if (isDeviceTarget) {
      const plan = await planUsbExport(library, mountPoint, {
        profile: target,
        folderStructure: req.body.folderStructure,
        duplicatePolicy: req.body.duplicatePolicy,
      })
      const compatibility = buildCompatibilityReport(library, target)
      return res.json({
        target: mountPoint,
        plan,
        summary: summarizeLibrary(library),
        compatibility,
      })
    }
    const compatibility = TARGET_PROFILES[target] ? buildCompatibilityReport(library, target) : null
    res.json({
      target,
      summary: summarizeLibrary(library),
      compatibility,
      plan: {
        counts: {
          ready: library.tracks.length,
          skipped: 0,
        },
        required: 'Direct file export',
        free: 'N/A',
      },
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/export', async (req, res) => {
  const db = requireDb(req)
  let jobId
  let prepared
  try {
    prepared = await prepareExport(req)
    const target = prepared.target
    jobId = await createJob(db, req.user.id, {
      kind: 'export',
      source: 'sounditdj',
      target,
      status: 'running',
      stage: 'planning',
    })
    activeJobs.set(jobId, {
      id: jobId,
      kind: 'export',
      source: 'sounditdj',
      target,
      status: 'running',
      stage: 'planning',
      progress: 0,
    })
    res.status(202).json({ jobId })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  const run = async () => {
    const { library, mountPoint, isDeviceTarget, target } = prepared
    try {
      if (!isDeviceTarget) {
        await logMigration(db, jobId, req.user.id, 'info', `Exporting library to ${target}`)
        const targetDir = path.join(userExportsDir(req), `${target}-${Date.now()}`)
        await fs.ensureDir(targetDir)

        let outputPath
        if (target === 'rekordbox-xml') {
          outputPath = path.join(targetDir, 'rekordbox.xml')
          await fs.writeFile(outputPath, generateRekordboxXml(library))
        } else if (target === 'virtualdj') {
          outputPath = path.join(targetDir, 'database.xml')
          await fs.writeFile(outputPath, generateVirtualDjXml(library))
        } else if (target === 'serato') {
          const crateDir = path.join(targetDir, 'SubCrates')
          await fs.ensureDir(crateDir)
          for (const playlist of flattenPlaylists(library.playlists)) {
            const trackPaths = (playlist.trackIds || [])
              .map((id) => library.tracks.find((track) => String(track.sourceId) === String(id))?.path)
              .filter(Boolean)
            if (!trackPaths.length) continue
            await fs.writeFile(
              path.join(crateDir, `${sanitizeFile(playlist.name)}.crate`),
              generateSeratoCrate(trackPaths),
            )
          }
          outputPath = crateDir
        } else if (target === 'm3u') {
          outputPath = path.join(targetDir, 'library.m3u8')
          await fs.writeFile(outputPath, generateM3u(library))
        } else if (target === 'csv') {
          outputPath = path.join(targetDir, 'library.csv')
          await fs.writeFile(outputPath, generateCsv(library))
        } else {
          outputPath = path.join(targetDir, 'library.json')
          await fs.writeFile(outputPath, JSON.stringify(library, null, 2))
        }

        const report = {
          ok: true,
          target,
          outputPath,
          counts: {
            tracks: library.tracks.length,
            playlists: library.playlists.length,
            cues: library.tracks.reduce((sum, t) => sum + (t.cues?.length || 0), 0),
          },
          errors: [],
          warnings: library.warnings || [],
        }
        await setJobState(db, jobId, {
          status: 'completed',
          stage: 'done',
          progress: 100,
          stats: report.counts,
          report,
        })
        activeJobs.set(jobId, {
          id: jobId,
          kind: 'export',
          status: 'completed',
          stage: 'done',
          progress: 100,
          report,
        })
        await logMigration(db, jobId, req.user.id, 'info', `Export to ${target} finished`, report.counts)
        return
      }

      await logMigration(db, jobId, req.user.id, 'info', `Exporting to ${mountPoint}`)
      const report = await exportLibraryToUsb(library, mountPoint, {
        profile: target,
        folderStructure: req.body.folderStructure,
        duplicatePolicy: req.body.duplicatePolicy,
        backup: Boolean(req.body.backup),
        onProgress: (event) => {
          const current = activeJobs.get(jobId) || {}
          const progress = event.phase === 'copy' && event.total
            ? Math.round((event.index / event.total) * 70)
            : event.phase === 'analysis'
              ? 75
              : event.phase === 'database'
                ? 92
                : current.progress || 0
          activeJobs.set(jobId, { ...current, id: jobId, kind: 'export', status: 'running', stage: event.phase, progress })
        },
      })
      await setJobState(db, jobId, {
        status: report.ok ? 'completed' : 'error',
        stage: 'done',
        progress: 100,
        stats: report.counts,
        report,
        error: report.errors.length ? report.errors[0].error || report.errors[0].message || 'Export failed' : null,
      })
      activeJobs.set(jobId, {
        id: jobId,
        kind: 'export',
        status: report.ok ? 'completed' : 'error',
        stage: 'done',
        progress: 100,
        report,
      })
      await logMigration(db, jobId, req.user.id, report.ok ? 'info' : 'error', 'Export finished', report.counts)
    } catch (error) {
      await setJobState(db, jobId, { status: 'error', stage: 'error', error: error.message })
      activeJobs.set(jobId, { id: jobId, kind: 'export', status: 'error', stage: 'error', error: error.message })
      await logMigration(db, jobId, req.user.id, 'error', `Export failed: ${error.message}`)
    }
  }
  run()
})

// ---------------------------------------------------------------------------
// File conversion (rekordbox XML, VirtualDJ, M3U, CSV, JSON, Serato crates)
// ---------------------------------------------------------------------------

router.post('/convert', async (req, res) => {
  try {
    const sourcePath = req.body.path
    if (!sourcePath) return res.status(400).json({ error: 'A source path is required.' })
    const target = req.body.target || 'rekordbox-xml'
    const library = await importLibraryPath(sourcePath, {
      format: req.body.format || undefined,
      relink: req.body.relink || [],
      enrichTags: false,
    })
    if (!TARGET_PROFILES[target] && !['serato', 'm3u', 'csv', 'json'].includes(target)) {
      return res.status(400).json({ error: `Unknown conversion target: ${target}` })
    }
    const targetDir = path.join(userExportsDir(req), `${target}-${Date.now()}`)
    await fs.ensureDir(targetDir)

    let outputPath
    if (target === 'rekordbox-xml') {
      outputPath = path.join(targetDir, 'rekordbox.xml')
      await fs.writeFile(outputPath, generateRekordboxXml(library))
    } else if (target === 'virtualdj') {
      outputPath = path.join(targetDir, 'database.xml')
      await fs.writeFile(outputPath, generateVirtualDjXml(library))
    } else if (target === 'serato') {
      const crateDir = path.join(targetDir, 'SubCrates')
      await fs.ensureDir(crateDir)
      for (const playlist of flattenPlaylists(library.playlists)) {
        const trackPaths = (playlist.trackIds || [])
          .map((id) => library.tracks.find((track) => String(track.sourceId) === String(id))?.path)
          .filter(Boolean)
        if (!trackPaths.length) continue
        await fs.writeFile(
          path.join(crateDir, `${sanitizeFile(playlist.name)}.crate`),
          generateSeratoCrate(trackPaths),
        )
      }
      outputPath = crateDir
    } else if (target === 'm3u') {
      outputPath = path.join(targetDir, 'library.m3u8')
      await fs.writeFile(outputPath, generateM3u(library))
    } else if (target === 'csv') {
      outputPath = path.join(targetDir, 'library.csv')
      await fs.writeFile(outputPath, generateCsv(library))
    } else {
      outputPath = path.join(targetDir, 'library.json')
      await fs.writeFile(outputPath, JSON.stringify(library, null, 2))
    }

    res.json({
      outputPath,
      target,
      summary: summarizeLibrary(library),
      compatibility: TARGET_PROFILES[target]
        ? buildCompatibilityReport(library, target)
        : null,
      warnings: library.warnings || [],
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

function flattenPlaylists(playlists, out = []) {
  for (const playlist of playlists || []) {
    if (!playlist.isFolder) out.push(playlist)
    if (playlist.children?.length) flattenPlaylists(playlist.children, out)
  }
  return out
}

function sanitizeFile(value) {
  return String(value || 'playlist').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
}

function generateM3u(library) {
  const lines = ['#EXTM3U']
  for (const track of library.tracks) {
    const duration = track.duration ? Math.round(track.duration) : -1
    lines.push(`#EXTINF:${duration},${track.artist ? `${track.artist} - ` : ''}${track.title || ''}`)
    lines.push(track.path || '')
  }
  return `${lines.join('\n')}\n`
}

function generateCsv(library) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const header = 'Title,Artist,Album,Genre,BPM,Key,Duration,Rating,Color,Comment,Path,Cues,Loops,Beatgrid'
  const rows = library.tracks.map((track) => [
    track.title, track.artist, track.album, track.genre, track.bpm, track.key,
    track.duration, track.rating, track.color, track.comment, track.path,
    track.cues?.length || 0, track.loops?.length || 0,
    track.beatgrid?.bpm || track.bpm || '',
  ].map(escape).join(','))
  return `${[header, ...rows].join('\n')}\n`
}

// ---------------------------------------------------------------------------
// History, reports, backups, compatibility
// ---------------------------------------------------------------------------

router.get('/jobs', async (req, res) => {
  try {
    const db = requireDb(req)
    const rows = await db.prepare(
      `SELECT * FROM migration_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).all(req.user.id)
    res.json({ jobs: rows.map(jobSummary) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/jobs/:jobId', async (req, res) => {
  try {
    const active = activeJobs.get(req.params.jobId)
    if (active) return res.json(active)
    const db = requireDb(req)
    const row = await db.prepare(
      'SELECT * FROM migration_jobs WHERE id = ? AND user_id = ?',
    ).get(req.params.jobId, req.user.id)
    if (!row) return res.status(404).json({ error: 'Job not found' })
    res.json({ ...jobSummary(row), report: row.report ? safeJson(row.report) : null })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/jobs/:jobId/logs', async (req, res) => {
  try {
    const db = requireDb(req)
    const rows = await db.prepare(
      `SELECT * FROM migration_logs WHERE job_id = ? AND user_id = ? ORDER BY created_at ASC`,
    ).all(req.params.jobId, req.user.id)
    res.json({ logs: rows })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/reports', async (req, res) => {
  try {
    const db = requireDb(req)
    const rows = await db.prepare(
      `SELECT id, kind, source, target, status, stats, report, created_at, completed_at
       FROM migration_jobs WHERE user_id = ? AND report IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
    ).all(req.user.id)
    res.json({
      reports: rows.map((row) => ({
        ...jobSummary(row),
        report: safeJson(row.report),
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/backup', async (req, res) => {
  try {
    const db = requireDb(req)
    const backupDir = path.join(path.dirname(req.app.locals.runtime.dbPath), 'backups')
    const result = await backupDatabase(req.app.locals.runtime.dbPath, backupDir, req.body.label || 'manual')
    await db.prepare(
      `INSERT INTO migration_backups (id, user_id, label, path, size) VALUES (?, ?, ?, ?, ?)`,
    ).run(uuidv4(), req.user.id, req.body.label || 'manual', result.path, result.size)
    res.json({ ...result, sizeLabel: formatBytes(result.size) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/compatibility', async (req, res) => {
  try {
    const db = requireDb(req)
    const library = await buildLibraryFromDatabase(db, req.user.id)
    res.json({
      summary: summarizeLibrary(library),
      targets: Object.values(TARGET_PROFILES).map((target) => ({
        target,
        report: buildCompatibilityReport(library, target.id),
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** Ensure migration tables exist when this router is mounted in tests. */
router.ensureSchema = (db) => ensureMigrationSchema(db)

export default router
