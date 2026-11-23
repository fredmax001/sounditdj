import express from 'express'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import musicMetadata from 'music-metadata'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'

import { createFileFilter, createUploadScanner } from '../security/uploadSecurity.js'
import {
  ValidationError,
  assertArray,
  assertNumber,
  assertOptionalNumber,
  assertOptionalString,
  assertString,
  assertUUID,
  sendValidationError,
} from '../security/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

async function resolveAudioUrl(track) {
  try {
    const uploadsPath = path.join(__dirname, '../../uploads/tracks', track.filename || '')
    const inUploads = await fs.pathExists(uploadsPath)
    if (inUploads) return `/uploads/tracks/${track.filename}`

    // If track.path points to an absolute/local file and exists, expose via media endpoint
    if (track.path && (track.path.startsWith('/') || /^[A-Za-z]:\\/.test(track.path))) {
      const exists = await fs.pathExists(track.path)
      if (exists) return `/api/media/track/${track.id}`
    }

    return null
  } catch (err) {
    console.error('resolveAudioUrl error:', err)
    return null
  }
}

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/mp4']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/tracks')
    fs.ensureDirSync(uploadsDir)
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`
    cb(null, uniqueName)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: createFileFilter({
    allowedMimeTypes: AUDIO_MIME_TYPES,
    allowedExtensions: AUDIO_EXTENSIONS,
  }),
})

const scanAudioUpload = createUploadScanner({
  fieldName: 'audio',
  allowedMagicMime: AUDIO_MIME_TYPES,
})

router.post('/upload', upload.single('audio'), scanAudioUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const db = req.app.locals.db
    const filePath = req.file.path
    const userId = req.user.id

    let metadata = {}
    let bpm = null
    let key = null
    let duration = null
    let artwork = null
    let genre = null

    try {
      const parsed = await musicMetadata.parseFile(filePath)
      metadata = parsed.common
      duration = parsed.format.duration || null

      if (parsed.common.bpm) {
        bpm = parsed.common.bpm
      }

      if (parsed.common.key) {
        key = parsed.common.key
      }

      if (parsed.common.genre) {
        genre = Array.isArray(parsed.common.genre) ? parsed.common.genre[0] : parsed.common.genre
      }

      if (parsed.common.picture && parsed.common.picture.length > 0) {
        const picture = parsed.common.picture[0]
        const artworkPath = path.join(__dirname, '../../uploads/artwork', `${uuidv4()}.jpg`)
        fs.ensureDirSync(path.dirname(artworkPath))
        await fs.writeFile(artworkPath, picture.data)
        artwork = `/uploads/artwork/${path.basename(artworkPath)}`
      }
    } catch (err) {
      console.log('Metadata extraction failed:', err.message)
    }

    const trackId = uuidv4()
    await db
      .prepare(
        `INSERT INTO tracks (
          id, user_id, filename, original_name, path, title, artist, album, bpm, key, duration, artwork, metadata, genre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        trackId,
        userId,
        req.file.filename,
        req.file.originalname,
        filePath,
        metadata.title || null,
        metadata.artist || null,
        metadata.album || null,
        bpm,
        key,
        duration,
        artwork,
        JSON.stringify(metadata),
        genre
      )

    const track = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
    const audioUrl = await resolveAudioUrl(track)
    res.json({
      message: 'Track uploaded successfully',
      track: {
        ...track,
        audioUrl,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload track' })
  }
})

router.get('/missing-files', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const tracks = await db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId)

    const missing = []
    for (const track of tracks) {
      const exists = await fs.pathExists(track.path)
      if (!exists) {
        const audioUrl = await resolveAudioUrl(track)
        missing.push({
          ...track,
          audioUrl: audioUrl || `/uploads/tracks/${track.filename}`,
        })
      }
    }

    res.json({ missing })
  } catch (error) {
    console.error('Missing files error:', error)
    res.status(500).json({ error: 'Failed to check missing files' })
  }
})

router.get('/list', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const tracks = await db
      .prepare(
        `SELECT * FROM tracks
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId)
    const tracksWithAudioCheck = await Promise.all(
      tracks.map(async (track) => {
        const audioUrl = await resolveAudioUrl(track)
        const hasAudioFile = !!audioUrl
        return {
          ...track,
          audioUrl,
          hasAudioFile,
        }
      })
    )

    res.json({ tracks: tracksWithAudioCheck })
  } catch (error) {
    console.error('List tracks error:', error)
    res.status(500).json({ error: 'Failed to list tracks' })
  }
})

router.put('/update/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const title = assertOptionalString(req.body.title, 'title', { max: 160 })
    const artist = assertOptionalString(req.body.artist, 'artist', { max: 160 })
    const album = assertOptionalString(req.body.album, 'album', { max: 160 })
    const bpm = assertOptionalNumber(req.body.bpm, 'bpm', { min: 0, max: 400 })
    const key = assertOptionalString(req.body.key, 'key', { max: 32 })
    const genre = assertOptionalString(req.body.genre, 'genre', { max: 80 })
    const tags = req.body.tags || null
    const rating = req.body.rating !== undefined ? assertOptionalNumber(req.body.rating, 'rating', { min: 0, max: 5 }) : null

    const db = req.app.locals.db
    const userId = req.user.id

    const result = await db
      .prepare(
        `UPDATE tracks
         SET title = ?, artist = ?, album = ?, bpm = ?, key = ?, genre = ?, tags = ?, rating = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(title, artist, album, bpm, key, genre, tags ? JSON.stringify(tags) : null, rating, id, userId)

    if (!result.changes) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const track = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, userId)
    const audioUrl = await resolveAudioUrl(track)

    res.json({
      message: 'Track updated successfully',
      track: {
        ...track,
        audioUrl,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Update track error:', error)
    res.status(500).json({ error: 'Failed to update track' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const track = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, userId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    try {
      fs.unlinkSync(track.path)
      if (track.artwork) {
        const artworkPath = path.join(__dirname, '../..', track.artwork.replace(/^\/+/, ''))
        fs.unlinkSync(artworkPath)
      }
    } catch (err) {
      console.log('File deletion error:', err.message)
    }

    await db.prepare('DELETE FROM tracks WHERE id = ? AND user_id = ?').run(id, userId)
    await db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?').run(id)

    res.json({ message: 'Track deleted successfully' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Delete track error:', error)
    res.status(500).json({ error: 'Failed to delete track' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const track = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, userId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const audioUrl = await resolveAudioUrl(track)

    res.json({
      track: {
        ...track,
        audioUrl,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Get track error:', error)
    res.status(500).json({ error: 'Failed to get track' })
  }
})

// ─── Cue Points ─────────────────────────────────────────────────────────────

router.get('/cues/:trackId', async (req, res) => {
  try {
    assertUUID(req.params.trackId, 'trackId')

    const db = req.app.locals.db
    const userId = req.user.id
    const trackId = req.params.trackId

    const track = await db.prepare('SELECT id FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const cues = await db
      .prepare('SELECT * FROM cue_points WHERE track_id = ? AND user_id = ? ORDER BY position ASC')
      .all(trackId, userId)

    res.json({ cues })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('List cues error:', error)
    res.status(500).json({ error: 'Failed to list cue points' })
  }
})

router.post('/cues', async (req, res) => {
  try {
    assertUUID(req.body.trackId, 'trackId')
    const name = assertOptionalString(req.body.name, 'name', { max: 120 })
    const position = assertNumber(req.body.position, 'position', { min: 0 })
    const color = assertOptionalString(req.body.color, 'color', { max: 32 })

    const db = req.app.locals.db
    const userId = req.user.id
    const trackId = req.body.trackId

    const track = await db.prepare('SELECT id FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const cueId = uuidv4()
    await db
      .prepare(
        'INSERT INTO cue_points (id, track_id, user_id, name, position, color) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(cueId, trackId, userId, name, position, color || '#EDC61E')

    const cue = await db.prepare('SELECT * FROM cue_points WHERE id = ?').get(cueId)
    res.json({ message: 'Cue point created', cue })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Create cue error:', error)
    res.status(500).json({ error: 'Failed to create cue point' })
  }
})

router.put('/cues/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const name = assertOptionalString(req.body.name, 'name', { max: 120 })
    const position = assertOptionalNumber(req.body.position, 'position', { min: 0 })
    const color = assertOptionalString(req.body.color, 'color', { max: 32 })

    const db = req.app.locals.db
    const userId = req.user.id

    const existing = await db.prepare('SELECT * FROM cue_points WHERE id = ? AND user_id = ?').get(id, userId)
    if (!existing) {
      return res.status(404).json({ error: 'Cue point not found' })
    }

    await db
      .prepare('UPDATE cue_points SET name = ?, position = ?, color = ? WHERE id = ? AND user_id = ?')
      .run(name ?? existing.name, position ?? existing.position, color ?? existing.color, id, userId)

    const cue = await db.prepare('SELECT * FROM cue_points WHERE id = ?').get(id)
    res.json({ message: 'Cue point updated', cue })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Update cue error:', error)
    res.status(500).json({ error: 'Failed to update cue point' })
  }
})

router.delete('/cues/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const result = await db.prepare('DELETE FROM cue_points WHERE id = ? AND user_id = ?').run(id, userId)
    if (!result.changes) {
      return res.status(404).json({ error: 'Cue point not found' })
    }

    res.json({ message: 'Cue point deleted' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Delete cue error:', error)
    res.status(500).json({ error: 'Failed to delete cue point' })
  }
})

// ─── Find & Replace ─────────────────────────────────────────────────────────

router.post('/bulk-replace', async (req, res) => {
  try {
    const field = assertString(req.body.field, 'field', { min: 1, max: 40 })
    const search = assertString(req.body.search, 'search', { min: 1, max: 255 })
    const replace = assertOptionalString(req.body.replace, 'replace', { max: 255 }) || ''

    if (!['title', 'artist', 'album', 'genre'].includes(field)) {
      throw new ValidationError("field must be one of: 'title', 'artist', 'album', 'genre'", 'field')
    }

    const db = req.app.locals.db
    const userId = req.user.id

    let trackIds = null
    if (req.body.trackIds !== undefined) {
      trackIds = assertArray(req.body.trackIds, 'trackIds', { min: 1, max: 10000 })
      for (const id of trackIds) {
        assertUUID(id, 'trackId')
      }
    }

    let tracks
    if (trackIds) {
      const placeholders = trackIds.map(() => '?').join(',')
      tracks = await db
        .prepare(`SELECT * FROM tracks WHERE user_id = ? AND id IN (${placeholders})`)
        .all(userId, ...trackIds)
    } else {
      tracks = await db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId)
    }

    let updatedCount = 0
    for (const track of tracks) {
      const currentValue = track[field] || ''
      if (currentValue.includes(search)) {
        const newValue = currentValue.split(search).join(replace)
        await db.prepare(`UPDATE tracks SET ${field} = ? WHERE id = ? AND user_id = ?`).run(newValue, track.id, userId)
        updatedCount += 1
      }
    }

    res.json({ message: 'Bulk replace completed', updatedCount })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Bulk replace error:', error)
    res.status(500).json({ error: 'Failed to perform bulk replace' })
  }
})

// ─── Related Tracks ─────────────────────────────────────────────────────────

function parseMusicalKey(key) {
  const match = String(key || '').trim().match(/^(\d{1,2})([A-B])$/i)
  if (!match) return null
  return { number: parseInt(match[1], 10), letter: match[2].toUpperCase() }
}

function isCompatibleKey(key1, key2) {
  const k1 = parseMusicalKey(key1)
  const k2 = parseMusicalKey(key2)
  if (!k1 || !k2) return false
  if (k1.letter !== k2.letter) return false
  const diff = Math.abs(k1.number - k2.number)
  return diff === 0 || diff === 1 || diff === 11
}

router.get('/related/:trackId', async (req, res) => {
  try {
    assertUUID(req.params.trackId, 'trackId')

    const db = req.app.locals.db
    const userId = req.user.id
    const trackId = req.params.trackId

    const source = await db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
    if (!source) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const tracks = await db.prepare('SELECT * FROM tracks WHERE user_id = ? AND id != ?').all(userId, trackId)

    const scored = await Promise.all(tracks.map(async (track) => {
      let score = 0
      if (source.artist && track.artist && track.artist.toLowerCase() === source.artist.toLowerCase()) {
        score += 4
      }
      if (source.key && track.key && isCompatibleKey(source.key, track.key)) {
        score += 3
      }
      if (source.bpm && track.bpm) {
        const diff = Math.abs(source.bpm - track.bpm) / source.bpm
        if (diff <= 0.05) {
          score += 2
        }
      }
      if (source.genre && track.genre && track.genre.toLowerCase() === source.genre.toLowerCase()) {
        score += 1
      }
      const audioUrl = await resolveAudioUrl(track)
      return { ...track, score, audioUrl }
    }))
    scored.sort((a, b) => b.score - a.score)

    const sourceAudio = await resolveAudioUrl(source)

    const relatedTracks = scored.filter((t) => t.score > 0)
    res.json({
      source: {
        ...source,
        audioUrl: sourceAudio,
      },
      related: relatedTracks,
      tracks: relatedTracks, // legacy key for frontend compatibility
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Related tracks error:', error)
    res.status(500).json({ error: 'Failed to get related tracks' })
  }
})

export default router
