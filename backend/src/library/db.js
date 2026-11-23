import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'

import {
  CUE_KINDS,
  findTrackMatch,
  summarizeLibrary,
} from './model.js'

/**
 * Add migration-specific columns/tables without touching existing user data.
 * All ALTERs are guarded, so restarts are idempotent.
 */
export async function ensureMigrationSchema(db) {
  const columns = async (table) => {
    const rows = await db.prepare(`PRAGMA table_info(${table})`).all()
    return rows.map((row) => row.name)
  }
  const ensureColumn = async (table, column, definition) => {
    const existing = await columns(table)
    if (!existing.includes(column)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

  await ensureColumn('tracks', 'source', 'TEXT')
  await ensureColumn('tracks', 'source_id', 'TEXT')
  await ensureColumn('tracks', 'comment', 'TEXT')
  await ensureColumn('tracks', 'color', 'TEXT')
  await ensureColumn('tracks', 'year', 'INTEGER')
  await ensureColumn('tracks', 'bitrate', 'INTEGER')
  await ensureColumn('tracks', 'sample_rate', 'INTEGER')
  await ensureColumn('tracks', 'file_size', 'INTEGER')
  await ensureColumn('tracks', 'track_number', 'INTEGER')
  await ensureColumn('tracks', 'disc_number', 'INTEGER')
  await ensureColumn('tracks', 'date_added', 'TEXT')
  await ensureColumn('tracks', 'play_count', 'INTEGER')
  await ensureColumn('tracks', 'missing', 'INTEGER DEFAULT 0')
  await ensureColumn('tracks', 'streaming', 'INTEGER DEFAULT 0')
  await ensureColumn('tracks', 'protected', 'INTEGER DEFAULT 0')
  await ensureColumn('tracks', 'beatgrid', 'TEXT')

  await ensureColumn('cue_points', 'kind', "TEXT DEFAULT 'hot'")
  await ensureColumn('cue_points', 'slot', 'INTEGER')
  await ensureColumn('cue_points', 'comment', 'TEXT')
  await ensureColumn('cue_points', 'source_id', 'TEXT')

  await ensureColumn('playlists', 'source', 'TEXT')
  await ensureColumn('playlists', 'source_id', 'TEXT')
  await ensureColumn('playlist_folders', 'source', 'TEXT')
  await ensureColumn('playlist_folders', 'source_id', 'TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS track_loops (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      user_id TEXT,
      slot INTEGER,
      name TEXT,
      start_position REAL NOT NULL,
      end_position REAL NOT NULL,
      color TEXT,
      locked INTEGER DEFAULT 0,
      source_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS library_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      format TEXT NOT NULL,
      label TEXT,
      path TEXT,
      summary TEXT,
      last_import_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      kind TEXT NOT NULL,
      source TEXT,
      target TEXT,
      status TEXT DEFAULT 'pending',
      stage TEXT,
      progress INTEGER DEFAULT 0,
      stats TEXT,
      report TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      user_id TEXT,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES migration_jobs(id) ON DELETE CASCADE
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_backups (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      label TEXT,
      path TEXT NOT NULL,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path)')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source, source_id)')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_loops_track ON track_loops(track_id)')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_migration_jobs_user ON migration_jobs(user_id)')
}

export function trackColumnPayload(track) {
  return {
    filename: track.filename || path.basename(track.path || '') || 'unknown-audio',
    original_name: track.title || track.filename || 'Unknown Track',
    path: track.path || `streaming://${track.sourceId || uuidv4()}`,
    title: track.title || null,
    artist: track.artist || null,
    album: track.album || null,
    bpm: track.bpm ?? null,
    key: track.key || null,
    duration: track.duration ?? null,
    genre: track.genre || null,
    rating: track.rating ?? 0,
    tags: Array.isArray(track.tags) ? JSON.stringify(track.tags) : track.tags || null,
    metadata: JSON.stringify({
      source: track.sourceMeta || {},
      albumArtist: track.albumArtist || null,
      composer: track.composer || null,
    }),
    source: track.source || null,
    source_id: track.sourceId || null,
    comment: track.comment || null,
    color: track.color || null,
    year: track.year ?? null,
    bitrate: track.bitrate ?? null,
    sample_rate: track.sampleRate ?? null,
    file_size: track.fileSize ?? null,
    track_number: track.trackNumber ?? null,
    disc_number: track.discNumber ?? null,
    date_added: track.dateAdded || null,
    play_count: track.playCount ?? null,
    missing: track.missing ? 1 : 0,
    streaming: track.streaming ? 1 : 0,
    protected: track.protected ? 1 : 0,
    beatgrid: track.beatgrid ? JSON.stringify(track.beatgrid) : null,
  }
}

async function insertTrack(db, userId, track) {
  const payload = trackColumnPayload(track)
  const id = uuidv4()
  const keys = Object.keys(payload)
  const sql = `INSERT INTO tracks (id, user_id, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`
  await db.prepare(sql).run(id, userId, ...keys.map((key) => payload[key]))
  return id
}

async function updateMissingTrackFields(db, existing, track) {
  const payload = trackColumnPayload(track)
  const fillIfEmpty = [
    'title', 'artist', 'album', 'bpm', 'key', 'duration', 'genre', 'comment',
    'color', 'year', 'bitrate', 'sample_rate', 'file_size', 'track_number',
    'disc_number', 'date_added', 'play_count',
  ]
  const assignments = []
  const values = []
  for (const field of fillIfEmpty) {
    if ((existing[field] === null || existing[field] === undefined || existing[field] === '') && payload[field] !== null && payload[field] !== '') {
      assignments.push(`${field} = ?`)
      values.push(payload[field])
    }
  }
  if (track.beatgrid && !existing.beatgrid) {
    assignments.push('beatgrid = ?')
    values.push(payload.beatgrid)
  }
  if (track.missing) {
    assignments.push('missing = 1')
  } else if (existing.missing) {
    assignments.push('missing = 0')
  }
  if (!assignments.length) return
  values.push(existing.id, existing.user_id)
  await db.prepare(`UPDATE tracks SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
}

async function importCues(db, userId, trackId, cues, stats) {
  const existing = await db.prepare('SELECT * FROM cue_points WHERE track_id = ?').all(trackId)
  const existingSlots = new Set(existing.map((cue) => `${cue.kind || 'hot'}:${cue.slot ?? cue.position.toFixed(3)}`))
  for (const cue of cues || []) {
    const kind = cue.kind === CUE_KINDS.MEMORY ? CUE_KINDS.MEMORY : CUE_KINDS.HOT
    const key = `${kind}:${cue.slot ?? Number(cue.position || 0).toFixed(3)}`
    if (existingSlots.has(key)) {
      stats.cuesConflicted += 1
      continue
    }
    await db.prepare(
      `INSERT INTO cue_points (id, track_id, user_id, name, position, color, kind, slot, comment, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      uuidv4(), trackId, userId, cue.name || (kind === 'memory' ? 'Memory Cue' : 'Hot Cue'),
      Number(cue.position || 0), cue.color || '#EDC61E', kind, cue.slot ?? null,
      cue.comment || null, cue.sourceId || null,
    )
    existingSlots.add(key)
    stats.cuesImported += 1
  }
}

async function importLoops(db, userId, trackId, loops, stats) {
  const existing = await db.prepare('SELECT * FROM track_loops WHERE track_id = ?').all(trackId)
  const existingSlots = new Set(existing.map((loop) => `${loop.slot ?? Number(loop.start_position).toFixed(3)}`))
  for (const loop of loops || []) {
    const key = `${loop.slot ?? Number(loop.start || 0).toFixed(3)}`
    if (existingSlots.has(key)) {
      stats.loopsConflicted += 1
      continue
    }
    await db.prepare(
      `INSERT INTO track_loops (id, track_id, user_id, slot, name, start_position, end_position, color, locked, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      uuidv4(), trackId, userId, loop.slot ?? null, loop.name || 'Loop',
      Number(loop.start || 0), Number(loop.end || 0), loop.color || null, loop.locked ? 1 : 0, loop.sourceId || null,
    )
    existingSlots.add(key)
    stats.loopsImported += 1
  }
}

/**
 * Commit a normalized library to the local SQLite library.
 *
 * Safety rules:
 * - Source libraries are never modified (callers only pass parsed data).
 * - Existing metadata is only filled when empty.
 * - Cue/loop collisions are reported, not overwritten.
 * - Everything runs in one transaction; failure rolls back the import.
 */
export async function commitLibraryImport(db, userId, library, options = {}) {
  const stats = {
    tracksSeen: library.tracks?.length || 0,
    tracksCreated: 0,
    tracksMatched: 0,
    tracksSkipped: 0,
    cuesImported: 0,
    cuesConflicted: 0,
    loopsImported: 0,
    loopsConflicted: 0,
    playlistsCreated: 0,
    foldersCreated: 0,
    missingFiles: 0,
    streamingTracks: 0,
    protectedTracks: 0,
    warnings: [],
  }

  const existingTracks = await db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId)
  const candidates = [...existingTracks]
  const trackIdMap = new Map()

  await db.exec('BEGIN IMMEDIATE')
  try {
    for (const track of library.tracks || []) {
      const match = options.createNewTracksOnly
        ? null
        : findTrackMatch(track, candidates, { relink: options.relink || [] })
      let trackId
      if (match) {
        trackId = match.id
        stats.tracksMatched += 1
        await updateMissingTrackFields(db, match, track)
      } else {
        trackId = await insertTrack(db, userId, track)
        stats.tracksCreated += 1
        const inserted = await db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId)
        candidates.push(inserted)
      }
      if (track.missing) stats.missingFiles += 1
      if (track.streaming) stats.streamingTracks += 1
      if (track.protected) stats.protectedTracks += 1
      trackIdMap.set(track.sourceId || track.path, trackId)
      await importCues(db, userId, trackId, track.cues, stats)
      await importLoops(db, userId, trackId, track.loops, stats)
    }

    const folderIdMap = new Map()
    const playlistMap = new Map()
    const allPlaylists = library.playlists || []

    // Folders first, parents before children.
    for (const folder of allPlaylists.filter((playlist) => playlist.isFolder)) {
      const parentDbId = folder.parentId ? folderIdMap.get(folder.parentId) : null
      const folderId = uuidv4()
      await db.prepare(
        `INSERT INTO playlist_folders (id, user_id, parent_id, name, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(folderId, userId, parentDbId, folder.name || 'Folder', library.source || null, folder.sourceId || null)
      folderIdMap.set(folder.sourceId, folderId)
      stats.foldersCreated += 1
    }

    for (const playlist of allPlaylists.filter((playlist) => !playlist.isFolder)) {
      const dbId = uuidv4()
      const folderId = playlist.parentId ? folderIdMap.get(playlist.parentId) || null : null
      await db.prepare(
        `INSERT INTO playlists (id, user_id, name, description, folder_id, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        dbId, userId, playlist.name || 'Imported Playlist',
        `Imported from ${library.source || 'library'} on ${new Date().toISOString()}`,
        folderId, library.source || null, playlist.sourceId || null,
      )

      const refs = playlist.trackIds || playlist.sourceTrackRefs || []
      let position = 1
      const used = new Set()
      for (const ref of refs) {
        const trackId = trackIdMap.get(ref)
        if (!trackId || used.has(trackId)) {
          if (!trackId) stats.warnings.push(`Playlist "${playlist.name}" references an unresolved track`)
          continue
        }
        used.add(trackId)
        await db.prepare(
          'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
        ).run(dbId, trackId, position)
        position += 1
      }
      playlistMap.set(playlist.sourceId, dbId)
      stats.playlistsCreated += 1
    }

    if (options.recordSource !== false) {
      await db.prepare(
        `INSERT INTO library_sources (id, user_id, format, label, path, summary, last_import_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).run(
        uuidv4(), userId, library.source || 'unknown',
        options.sourceLabel || library.source || 'Imported library',
        options.sourcePath || null, JSON.stringify(summarizeLibrary(library)),
      )
    }

    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK').catch(() => {})
    throw error
  }

  return {
    stats,
    trackIdMap,
    playlistIds: [...playlistMap.values()],
    summary: summarizeLibrary(library),
  }
}

export async function backupDatabase(dbPath, backupDir, label = 'manual') {
  if (!(await fs.pathExists(dbPath))) throw new Error('Database file does not exist')
  await fs.ensureDir(backupDir)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(backupDir, `ricks-${timestamp}-${label}.db`)
  await fs.copy(dbPath, destination)
  const stat = await fs.stat(destination)
  return { path: destination, size: stat.size }
}

export async function logMigration(db, jobId, userId, level, message, detail = null) {
  try {
    await db.prepare(
      `INSERT INTO migration_logs (id, job_id, user_id, level, message, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), jobId, userId, level, message, detail ? JSON.stringify(detail) : null)
  } catch (error) {
    console.error('Migration log write failed:', error.message)
  }
}

export async function setJobState(db, jobId, patch = {}) {
  const fields = []
  const values = []
  for (const [field, value] of Object.entries(patch)) {
    if (!['status', 'stage', 'progress', 'stats', 'report', 'error', 'target', 'completed_at'].includes(field)) continue
    fields.push(`${field} = ?`)
    values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
  }
  if (!fields.length) return
  if (['completed', 'error', 'cancelled'].includes(patch.status) && !('completed_at' in patch)) {
    fields.push('completed_at = CURRENT_TIMESTAMP')
  }
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(jobId)
  await db.prepare(`UPDATE migration_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}
