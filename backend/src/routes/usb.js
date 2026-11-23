import path from 'path'
import fs from 'fs-extra'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import drivelist from 'drivelist'

import { ValidationError, assertArray, assertEnum, assertString, assertUUID, sendValidationError } from '../security/validation.js'

const router = express.Router()

const activeJobs = new Map()

router.get('/devices', async (req, res) => {
  try {
    const drives = await drivelist.list()
    const devices = drives
      .filter(drive => drive.isUSB || drive.isRemovable)
      .map((drive, index) => ({
        id: drive.device || `usb${index}`,
        name: drive.description || drive.model || 'Unknown USB Device',
        size: formatBytes(drive.size || 0),
        free: 'Unknown', // drivelist doesn't provide free space
        mountPoint: drive.mountpoints[0]?.path || null,
        vendor: drive.enumerator || null,
        model: drive.model || null,
        isRemovable: drive.isRemovable,
        isUSB: drive.isUSB
      }))

    res.json({ devices })
  } catch (error) {
    console.error('Devices error:', error)
    res.status(500).json({ error: 'Failed to get devices' })
  }
})

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

router.post('/export', async (req, res) => {
  try {
    const deviceId = assertString(req.body.deviceId, 'deviceId', { min: 1, max: 80 })
    const playlistIds = assertArray(req.body.playlistIds, 'playlistIds', { min: 1, max: 50 })
    const format = assertEnum(req.body.format, 'format', ['m3u', 'csv', 'xml'])
    const deviceType = assertEnum(req.body.deviceType, 'deviceType', ['cdj', 'denon', 'generic'])

    for (const playlistId of playlistIds) {
      assertUUID(playlistId, 'playlistId')
    }

    const jobId = uuidv4()

    activeJobs.set(jobId, {
      id: jobId,
      userId: req.user.id,
      status: 'processing',
      progress: 0,
      stage: 'preparing',
      deviceId,
      playlistIds,
      format,
      deviceType,
    })

    exportToUSB(jobId, req.app.locals.db, req.app.locals.runtime.uploadsDir)

    res.json({ jobId })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Export start error:', error)
    res.status(500).json({ error: 'Failed to start export' })
  }
})

async function exportToUSB(jobId, db, uploadsDir) {
  const job = activeJobs.get(jobId)
  if (!job) return

  const startTime = Date.now()
  let tracks = []
  let playlists = []
  let mountPoint = null
  let exportDir = null

  try {
    // ─── Stage 1: Find USB device ───────────────────────────────────────────
    updateJob(jobId, { stage: 'preparing', progress: 5 })

    const drives = await drivelist.list()
    const drive = drives.find(d => d.device === job.deviceId || d.mountpoints.some(m => m.path === job.deviceId))

    if (!drive) {
      throw new Error(`USB device "${job.deviceId}" not found. Ensure it is plugged in and mounted.`)
    }

    mountPoint = drive.mountpoints[0]?.path
    if (!mountPoint) {
      throw new Error('USB device has no mount point. Ensure it is formatted and mounted.')
    }

    // Verify writable
    try {
      const testFile = path.join(mountPoint, `.kre8_write_test_${Date.now()}`)
      await fs.writeFile(testFile, 'test')
      await fs.remove(testFile)
    } catch (writeErr) {
      throw new Error(`USB device is not writable: ${writeErr.message}`)
    }

    updateJob(jobId, { stage: 'preparing', progress: 10 })

    // ─── Stage 2: Load playlists & tracks from DB ───────────────────────────
    playlists = []
    const allTrackIds = new Set()
    const trackIdToPlaylists = new Map()

    for (const playlistId of job.playlistIds) {
      const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, job.userId)
      if (!playlist) {
        console.warn(`Playlist ${playlistId} not found for user ${job.userId}`)
        continue
      }

      const ptRows = await db.prepare(
        `SELECT t.*, pt.position
         FROM tracks t
         JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ? AND t.user_id = ?
         ORDER BY pt.position`
      ).all(playlistId, job.userId)

      playlist.tracks = ptRows
      playlists.push(playlist)

      for (const track of ptRows) {
        allTrackIds.add(track.id)
        if (!trackIdToPlaylists.has(track.id)) {
          trackIdToPlaylists.set(track.id, [])
        }
        trackIdToPlaylists.get(track.id).push(playlist.name)
      }
    }

    if (playlists.length === 0) {
      throw new Error('No valid playlists found to export.')
    }

    // Deduplicate tracks for copying
    const trackMap = new Map()
    for (const playlist of playlists) {
      for (const track of playlist.tracks) {
        if (!trackMap.has(track.id)) {
          trackMap.set(track.id, track)
        }
      }
    }
    tracks = Array.from(trackMap.values())

    if (tracks.length === 0) {
      throw new Error('Selected playlists contain no tracks.')
    }

    // Verify source files exist
    for (const track of tracks) {
      const srcPath = path.join(uploadsDir, 'tracks', track.filename)
      const exists = await fs.pathExists(srcPath)
      if (!exists) {
        throw new Error(`Source file not found for track "${track.title || track.original_name}": ${track.filename}`)
      }
    }

    updateJob(jobId, { stage: 'preparing', progress: 15 })

    // ─── Stage 3: Check disk space ──────────────────────────────────────────
    const totalBytes = await calculateTotalSize(tracks, uploadsDir)
    const statfs = await fs.statfs(mountPoint)
    const availableBytes = statfs.bavail * statfs.bsize

    if (totalBytes > availableBytes) {
      throw new Error(
        `Not enough free space on USB. Need ${formatBytes(totalBytes)}, available ${formatBytes(availableBytes)}.`
      )
    }

    updateJob(jobId, { stage: 'preparing', progress: 20 })

    // ─── Stage 4: Create export directory structure ─────────────────────────
    const exportName = `KRE8_Export_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`

    if (job.deviceType === 'cdj') {
      exportDir = mountPoint
      await fs.ensureDir(path.join(exportDir, 'PIONEER'))
      await fs.ensureDir(path.join(exportDir, 'Contents'))
    } else if (job.deviceType === 'denon') {
      exportDir = mountPoint
      await fs.ensureDir(path.join(exportDir, 'Engine Library'))
      await fs.ensureDir(path.join(exportDir, 'Engine Library', 'Music'))
      await fs.ensureDir(path.join(exportDir, 'Engine Library', 'Database2'))
    } else {
      exportDir = path.join(mountPoint, exportName)
      await fs.ensureDir(exportDir)
    }

    updateJob(jobId, { stage: 'copying', progress: 20 })

    // ─── Stage 5: Copy tracks ───────────────────────────────────────────────
    const copiedTracks = []
    const totalTracks = tracks.length

    for (let i = 0; i < totalTracks; i++) {
      const track = tracks[i]
      const srcPath = path.join(uploadsDir, 'tracks', track.filename)

      let destPath
      if (job.deviceType === 'cdj') {
        // Organize by Artist / Album for CDJ
        const artistDir = sanitizeDirName(track.artist || 'Unknown Artist')
        const albumDir = sanitizeDirName(track.album || 'Unknown Album')
        const destDir = path.join(exportDir, 'Contents', artistDir, albumDir)
        await fs.ensureDir(destDir)
        destPath = path.join(destDir, track.filename)
      } else if (job.deviceType === 'denon') {
        const destDir = path.join(exportDir, 'Engine Library', 'Music')
        await fs.ensureDir(destDir)
        destPath = path.join(destDir, track.filename)
      } else {
        destPath = path.join(exportDir, track.filename)
      }

      await fs.copy(srcPath, destPath, { overwrite: true, preserveTimestamps: true })

      copiedTracks.push({
        ...track,
        destPath,
        usbRelativePath: path.relative(exportDir, destPath),
      })

      const progress = 20 + Math.round(((i + 1) / totalTracks) * 55)
      updateJob(jobId, { stage: 'copying', progress })
    }

    // ─── Stage 6: Write metadata / playlists ────────────────────────────────
    updateJob(jobId, { stage: 'writing', progress: 78 })

    if (job.deviceType === 'cdj') {
      await writePioneerMetadata(exportDir, playlists, copiedTracks, job.format)
    } else if (job.deviceType === 'denon') {
      await writeDenonMetadata(exportDir, playlists, copiedTracks, job.format)
    } else {
      await writeGenericMetadata(exportDir, playlists, copiedTracks, job.format)
    }

    updateJob(jobId, { stage: 'writing', progress: 90 })

    // ─── Stage 7: Log export to database ────────────────────────────────────
    for (const playlist of playlists) {
      await db.prepare(
        `INSERT INTO usb_exports (id, user_id, playlist_id, device_name, status)
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuidv4(), job.userId, playlist.id, drive.description || drive.model || job.deviceId, 'completed')
    }

    updateJob(jobId, {
      stage: 'finalizing',
      progress: 100,
      status: 'completed',
      result: {
        exportedTracks: copiedTracks.length,
        exportedPlaylists: playlists.length,
        exportPath: exportDir,
        deviceName: drive.description || drive.model || job.deviceId,
        durationMs: Date.now() - startTime,
      }
    })
  } catch (error) {
    console.error('Export error:', error)

    // Log failed export attempts
    try {
      for (const playlist of playlists) {
        if (playlist?.id) {
          await db.prepare(
            `INSERT INTO usb_exports (id, user_id, playlist_id, device_name, status)
             VALUES (?, ?, ?, ?, ?)`
          ).run(uuidv4(), job.userId, playlist.id, job.deviceId, 'failed')
        }
      }
    } catch (logErr) {
      console.error('Failed to log export error:', logErr)
    }

    updateJob(jobId, {
      status: 'error',
      stage: 'error',
      progress: job.progress,
      error: error.message,
    })
  }
}

function updateJob(jobId, updates) {
  const job = activeJobs.get(jobId)
  if (!job) return
  Object.assign(job, updates)
  activeJobs.set(jobId, job)
}

async function calculateTotalSize(tracks, uploadsDir) {
  let total = 0
  for (const track of tracks) {
    try {
      const stat = await fs.stat(path.join(uploadsDir, 'tracks', track.filename))
      total += stat.size
    } catch {
      // skip missing files, will be caught later
    }
  }
  return total
}

function sanitizeDirName(name) {
  return (name || 'Unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Unknown'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pioneer CDJ / rekordbox metadata
// ═══════════════════════════════════════════════════════════════════════════════

async function writePioneerMetadata(exportDir, playlists, tracks, format) {
  // Write rekordbox XML (can be imported into rekordbox software)
  const xmlContent = generateRekordboxXml(playlists, tracks)
  await fs.writeFile(path.join(exportDir, 'rekordbox.xml'), xmlContent, 'utf-8')

  // Also write a simple playlist in the requested format as fallback
  if (format === 'm3u') {
    for (const playlist of playlists) {
      const content = generateM3U(playlist, playlist.tracks, exportDir)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, `${safeName}.m3u`), content, 'utf-8')
    }
  } else if (format === 'csv') {
    for (const playlist of playlists) {
      const content = generateCSV(playlist.tracks)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, `${safeName}.csv`), content, 'utf-8')
    }
  }
}

function generateRekordboxXml(playlists, tracks) {
  const trackMap = new Map(tracks.map(t => [t.id, t]))

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<DJ_PLAYLISTS Version="1.0.0">\n'
  xml += '  <PRODUCT Name="rekordbox" Version="6.0.0" Company="Pioneer DJ"/>\n'
  xml += `  <COLLECTION Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    const trackNum = index + 1
    const location = `file://localhost/${encodeURIComponent(track.usbRelativePath).replace(/%2F/g, '/')}`
    xml += `    <TRACK TrackID="${trackNum}" Name="${escapeXml(track.title || '')}" Artist="${escapeXml(track.artist || '')}" Album="${escapeXml(track.album || '')}" TotalTime="${formatDuration(track.duration)}"\n`
    if (track.bpm) {
      xml += `           Tempo="${Math.round(track.bpm)}"\n`
    }
    if (track.key) {
      xml += `           Tonality="${escapeXml(track.key)}"\n`
    }
    xml += `           Location="${location}">\n`
    xml += `    </TRACK>\n`
  })

  xml += '  </COLLECTION>\n'
  xml += '  <PLAYLISTS>\n'
  xml += '    <NODE Type="0" Name="ROOT" Count="1">\n'

  playlists.forEach((playlist) => {
    xml += `      <NODE Name="${escapeXml(playlist.name)}" Type="1" KeyType="0" Entries="${playlist.tracks.length}">\n`
    playlist.tracks.forEach((track) => {
      const globalIndex = tracks.findIndex(t => t.id === track.id)
      if (globalIndex !== -1) {
        xml += `        <TRACK Key="${globalIndex + 1}"/>\n`
      }
    })
    xml += '      </NODE>\n'
  })

  xml += '    </NODE>\n'
  xml += '  </PLAYLISTS>\n'
  xml += '</DJ_PLAYLISTS>\n'

  return xml
}

// ═══════════════════════════════════════════════════════════════════════════════
// Denon Engine DJ metadata
// ═══════════════════════════════════════════════════════════════════════════════

async function writeDenonMetadata(exportDir, playlists, tracks, format) {
  // Engine DJ uses an SQLite database. We create a minimal one.
  const dbPath = path.join(exportDir, 'Engine Library', 'Database2', 'm.db')

  // If sqlite3 is available, try to create a real Engine DB
  try {
    const sqlite3Module = await import('sqlite3')
    const sqlite3 = sqlite3Module.default || sqlite3Module
    await createEngineDatabase(sqlite3, dbPath, playlists, tracks)
  } catch (err) {
    console.warn('Could not create Engine DJ SQLite DB, falling back to metadata files:', err.message)
    // Fallback: write a JSON metadata file and standard playlists
    const metadata = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      playlists: playlists.map(p => ({
        name: p.name,
        tracks: p.tracks.map(t => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          bpm: t.bpm,
          key: t.key,
          duration: t.duration,
          filename: t.filename,
        })),
      })),
    }
    await fs.writeFile(
      path.join(exportDir, 'Engine Library', 'kre8_metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    )
  }

  // Also write standard playlists in the Music folder
  if (format === 'm3u') {
    for (const playlist of playlists) {
      const content = generateM3U(playlist, playlist.tracks, path.join(exportDir, 'Engine Library', 'Music'))
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, 'Engine Library', 'Music', `${safeName}.m3u`), content, 'utf-8')
    }
  } else if (format === 'csv') {
    for (const playlist of playlists) {
      const content = generateCSV(playlist.tracks)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, 'Engine Library', 'Music', `${safeName}.csv`), content, 'utf-8')
    }
  }
}

function createEngineDatabase(sqlite3, dbPath, playlists, tracks) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath)

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS Track (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        title TEXT,
        artist TEXT,
        album TEXT,
        genre TEXT,
        bpm REAL,
        key TEXT,
        duration REAL,
        bitrate INTEGER,
        sampleRate INTEGER,
        comment TEXT
      )`)

      db.run(`CREATE TABLE IF NOT EXISTS Playlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parentId INTEGER,
        isFolder INTEGER DEFAULT 0
      )`)

      db.run(`CREATE TABLE IF NOT EXISTS PlaylistTrack (
        playlistId INTEGER NOT NULL,
        trackId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlistId, trackId)
      )`)

      const trackStmt = db.prepare(`INSERT INTO Track (path, title, artist, album, genre, bpm, key, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

      const trackIdMap = new Map()

      tracks.forEach((track, idx) => {
        trackStmt.run(
          track.usbRelativePath,
          track.title || '',
          track.artist || '',
          track.album || '',
          track.genre || '',
          track.bpm || 0,
          track.key || '',
          track.duration || 0,
          function () {
            trackIdMap.set(track.id, this.lastID)
          }
        )
      })

      trackStmt.finalize(() => {
        const playlistStmt = db.prepare('INSERT INTO Playlist (name, parentId, isFolder) VALUES (?, ?, ?)')
        const plTrackStmt = db.prepare('INSERT INTO PlaylistTrack (playlistId, trackId, position) VALUES (?, ?, ?)')

        // Create root folder
        playlistStmt.run('ROOT', null, 1, function () {
          const rootId = this.lastID

          playlists.forEach((playlist, plIdx) => {
            playlistStmt.run(playlist.name, rootId, 0, function () {
              const plId = this.lastID
              playlist.tracks.forEach((track, tIdx) => {
                const trackId = trackIdMap.get(track.id)
                if (trackId) {
                  plTrackStmt.run(plId, trackId, tIdx + 1)
                }
              })
            })
          })
        })

        playlistStmt.finalize(() => {
          plTrackStmt.finalize(() => {
            db.close((err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        })
      })
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generic export metadata
// ═══════════════════════════════════════════════════════════════════════════════

async function writeGenericMetadata(exportDir, playlists, tracks, format) {
  if (format === 'm3u') {
    for (const playlist of playlists) {
      const content = generateM3U(playlist, playlist.tracks, exportDir)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, `${safeName}.m3u`), content, 'utf-8')
    }
  } else if (format === 'csv') {
    for (const playlist of playlists) {
      const content = generateCSV(playlist.tracks)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, `${safeName}.csv`), content, 'utf-8')
    }
  } else if (format === 'xml') {
    for (const playlist of playlists) {
      const content = generateGenericXml(playlist, playlist.tracks)
      const safeName = sanitizeDirName(playlist.name)
      await fs.writeFile(path.join(exportDir, `${safeName}.xml`), content, 'utf-8')
    }
  }

  // Write a README
  const readme = `KRE8 USB Export
Generated: ${new Date().toISOString()}
Playlists: ${playlists.length}
Tracks: ${tracks.length}
Format: ${format.toUpperCase()}

This export contains your playlists and tracks exported from KRE8.
Import the playlist files into your DJ software.
`
  await fs.writeFile(path.join(exportDir, 'README.txt'), readme, 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared generators
// ═══════════════════════════════════════════════════════════════════════════════

function generateM3U(playlist, tracks, baseDir) {
  let content = '#EXTM3U\n'
  content += `#PLAYLIST:${playlist.name}\n`

  tracks.forEach((track) => {
    const duration = track.duration ? Math.round(track.duration) : -1
    const title = track.title || 'Unknown Title'
    const artist = track.artist || 'Unknown Artist'
    content += `#EXTINF:${duration},${artist} - ${title}\n`
    content += `${track.filename}\n`
  })

  return content
}

function generateCSV(tracks) {
  let content = 'Position,Title,Artist,Album,BPM,Key,Duration,Filename\n'

  tracks.forEach((track, index) => {
    const row = [
      index + 1,
      `"${(track.title || '').replace(/"/g, '""')}"`,
      `"${(track.artist || '').replace(/"/g, '""')}"`,
      `"${(track.album || '').replace(/"/g, '""')}"`,
      track.bpm || '',
      track.key || '',
      track.duration || '',
      track.filename,
    ].join(',')

    content += `${row}\n`
  })

  return content
}

function generateGenericXml(playlist, tracks) {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n'
  content += '<DJ_PLAYLISTS Version="1.0.0">\n'
  content += '  <PRODUCT Name="KRE8" Version="1.0.0" Company="KRE8"/>\n'
  content += `  <COLLECTION Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    content += `    <TRACK TrackID="${index + 1}" Name="${escapeXml(track.title || '')}" Artist="${escapeXml(track.artist || '')}" Album="${escapeXml(track.album || '')}" TotalTime="${formatDuration(track.duration)}"\n`
    if (track.bpm) {
      content += `           Tempo="${Math.round(track.bpm)}"\n`
    }
    if (track.key) {
      content += `           Tonality="${escapeXml(track.key)}"\n`
    }
    content += `           Location="file://localhost/${encodeURIComponent(track.filename)}"/>\n`
  })

  content += '  </COLLECTION>\n'
  content += '  <PLAYLISTS>\n'
  content += '    <NODE Type="0" Name="ROOT" Count="1">\n'
  content += `      <NODE Name="${escapeXml(playlist.name)}" Type="1" KeyType="0" Entries="${tracks.length}">\n`

  tracks.forEach((track, index) => {
    content += `        <TRACK Key="${index + 1}"/>\n`
  })

  content += '      </NODE>\n'
  content += '    </NODE>\n'
  content += '  </PLAYLISTS>\n'
  content += '</DJ_PLAYLISTS>\n'

  return content
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDuration(seconds) {
  if (!seconds) return '00:00:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/status/:jobId', (req, res) => {
  try {
    assertUUID(req.params.jobId, 'jobId')

    const jobId = req.params.jobId
    const job = activeJobs.get(jobId)

    if (!job || job.userId !== req.user.id) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json({
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      error: job.error,
      result: job.result,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Status error:', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

router.get('/history', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const history = await db.prepare(
      `SELECT ue.*, p.name as playlist_name
       FROM usb_exports ue
       LEFT JOIN playlists p ON ue.playlist_id = p.id
       WHERE ue.user_id = ?
       ORDER BY ue.export_date DESC
       LIMIT 50`
    ).all(userId)

    res.json({ history })
  } catch (error) {
    console.error('History error:', error)
    res.status(500).json({ error: 'Failed to get export history' })
  }
})

export default router
