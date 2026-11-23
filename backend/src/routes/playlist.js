import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs-extra'

import {
  ValidationError,
  assertArray,
  assertOptionalString,
  assertString,
  assertUUID,
  sendValidationError,
} from '../security/validation.js'

const router = express.Router()

router.post('/create', async (req, res) => {
  try {
    const name = assertString(req.body.name, 'name', { min: 1, max: 120 })
    const description = assertOptionalString(req.body.description, 'description', { max: 400 })
    const folderId = req.body.folderId !== undefined && req.body.folderId !== null
      ? (assertUUID(req.body.folderId, 'folderId'), req.body.folderId)
      : null

    const db = req.app.locals.db
    const userId = req.user.id

    if (folderId) {
      const folder = await db.prepare('SELECT id FROM playlist_folders WHERE id = ? AND user_id = ?').get(folderId, userId)
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' })
      }
    }

    const playlistId = uuidv4()
    await db
      .prepare(
        `INSERT INTO playlists (id, user_id, name, description, folder_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(playlistId, userId, name, description || '', folderId)

    const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId)

    res.json({
      message: 'Playlist created successfully',
      playlist,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Create playlist error:', error)
    res.status(500).json({ error: 'Failed to create playlist' })
  }
})

router.get('/list', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const playlists = await db
      .prepare(
        `SELECT p.*, COUNT(pt.track_id) AS track_count
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
         WHERE p.user_id = ?
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      )
      .all(userId)

    res.json({ playlists })
  } catch (error) {
    console.error('List playlists error:', error)
    res.status(500).json({ error: 'Failed to list playlists' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(id, userId)
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const tracks = await db
      .prepare(
        `SELECT t.*, pt.position
             FROM tracks t
             JOIN playlist_tracks pt ON t.id = pt.track_id
             WHERE pt.playlist_id = ? AND t.user_id = ?
             ORDER BY pt.position`
      )
      .all(id, userId)

    const tracksWithUrls = await Promise.all(tracks.map(async (track) => {
      // prefer uploads path if present
      const uploadsPath = path.join(__dirname, '../../uploads/tracks', track.filename || '')
      const inUploads = await fs.pathExists(uploadsPath)
      if (inUploads) return { ...track, audioUrl: `/uploads/tracks/${track.filename}` }

      if (track.path && (track.path.startsWith('/') || /^[A-Za-z]:\\/.test(track.path))) {
        const exists = await fs.pathExists(track.path)
        if (exists) return { ...track, audioUrl: `/api/media/track/${track.id}` }
      }

      return { ...track, audioUrl: null }
    }))

    res.json({
      playlist: {
        ...playlist,
        tracks: tracksWithUrls,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Get playlist error:', error)
    res.status(500).json({ error: 'Failed to get playlist' })
  }
})

router.put('/update', async (req, res) => {
  try {
    assertUUID(req.body.id, 'id')
    const id = req.body.id
    const name = assertString(req.body.name, 'name', { min: 1, max: 120 })
    const description = assertOptionalString(req.body.description, 'description', { max: 400 })

    const db = req.app.locals.db
    const userId = req.user.id

    const result = await db
      .prepare(
        `UPDATE playlists
         SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .run(name, description || '', id, userId)

    if (!result.changes) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(id, userId)

    res.json({
      message: 'Playlist updated successfully',
      playlist,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Update playlist error:', error)
    res.status(500).json({ error: 'Failed to update playlist' })
  }
})

router.delete('/delete/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const result = await db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(id, userId)

    if (!result.changes) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    res.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Delete playlist error:', error)
    res.status(500).json({ error: 'Failed to delete playlist' })
  }
})

router.post('/add-track', async (req, res) => {
  try {
    assertUUID(req.body.playlistId, 'playlistId')
    assertUUID(req.body.trackId, 'trackId')

    const playlistId = req.body.playlistId
    const trackId = req.body.trackId
    const db = req.app.locals.db
    const userId = req.user.id

    const playlist = await db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId)
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const track = await db.prepare('SELECT id FROM tracks WHERE id = ? AND user_id = ?').get(trackId, userId)
    if (!track) {
      return res.status(404).json({ error: 'Track not found' })
    }

    const result = await db
      .prepare(
        `SELECT MAX(position) AS maxPos
         FROM playlist_tracks
         WHERE playlist_id = ?`
      )
      .get(playlistId)

    const position = (result?.maxPos || 0) + 1

    await db
      .prepare(
        `INSERT INTO playlist_tracks (playlist_id, track_id, position)
         VALUES (?, ?, ?)`
      )
      .run(playlistId, trackId, position)

    res.json({ message: 'Track added to playlist' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Add track error:', error)
    res.status(500).json({ error: 'Failed to add track to playlist' })
  }
})

router.post('/remove-track', async (req, res) => {
  try {
    assertUUID(req.body.playlistId, 'playlistId')
    assertUUID(req.body.trackId, 'trackId')

    const playlistId = req.body.playlistId
    const trackId = req.body.trackId

    const db = req.app.locals.db
    const userId = req.user.id

    const playlist = await db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId)
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    await db
      .prepare(
        `DELETE FROM playlist_tracks
         WHERE playlist_id = ? AND track_id = ?`
      )
      .run(playlistId, trackId)

    res.json({ message: 'Track removed from playlist' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Remove track error:', error)
    res.status(500).json({ error: 'Failed to remove track from playlist' })
  }
})

router.post('/reorder', async (req, res) => {
  try {
    assertUUID(req.body.playlistId, 'playlistId')
    const trackIds = assertArray(req.body.trackIds, 'trackIds', { min: 1, max: 1000 })

    const playlistId = req.body.playlistId
    const db = req.app.locals.db
    const userId = req.user.id

    const playlist = await db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId)
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    for (const id of trackIds) {
      assertUUID(id, 'trackId')
    }

    for (let index = 0; index < trackIds.length; index += 1) {
      await db
        .prepare(
          `UPDATE playlist_tracks
           SET position = ?
           WHERE playlist_id = ? AND track_id = ?`
        )
        .run(index + 1, playlistId, trackIds[index])
    }

    res.json({ message: 'Playlist reordered' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Reorder error:', error)
    res.status(500).json({ error: 'Failed to reorder playlist' })
  }
})

// ─── Playlist Folders ───────────────────────────────────────────────────────

router.post('/folders', async (req, res) => {
  try {
    const name = assertString(req.body.name, 'name', { min: 1, max: 120 })
    const parentId = req.body.parentId !== undefined && req.body.parentId !== null
      ? (assertUUID(req.body.parentId, 'parentId'), req.body.parentId)
      : null

    const db = req.app.locals.db
    const userId = req.user.id

    if (parentId) {
      const parent = await db.prepare('SELECT id FROM playlist_folders WHERE id = ? AND user_id = ?').get(parentId, userId)
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' })
      }
    }

    const folderId = uuidv4()
    await db
      .prepare('INSERT INTO playlist_folders (id, user_id, parent_id, name) VALUES (?, ?, ?, ?)')
      .run(folderId, userId, parentId, name)

    const folder = await db.prepare('SELECT * FROM playlist_folders WHERE id = ? AND user_id = ?').get(folderId, userId)
    res.json({ message: 'Folder created successfully', folder })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Create folder error:', error)
    res.status(500).json({ error: 'Failed to create folder' })
  }
})

router.get('/folders', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const folders = await db
      .prepare('SELECT * FROM playlist_folders WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId)

    res.json({ folders })
  } catch (error) {
    console.error('List folders error:', error)
    res.status(500).json({ error: 'Failed to list folders' })
  }
})

router.put('/folders/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const name = assertOptionalString(req.body.name, 'name', { max: 120 })
    const parentId = req.body.parentId !== undefined && req.body.parentId !== null
      ? (assertUUID(req.body.parentId, 'parentId'), req.body.parentId)
      : undefined

    const db = req.app.locals.db
    const userId = req.user.id

    const existing = await db.prepare('SELECT * FROM playlist_folders WHERE id = ? AND user_id = ?').get(id, userId)
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return res.status(400).json({ error: 'Folder cannot be its own parent' })
      }
      const parent = await db.prepare('SELECT id FROM playlist_folders WHERE id = ? AND user_id = ?').get(parentId, userId)
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' })
      }
    }

    await db
      .prepare('UPDATE playlist_folders SET name = ?, parent_id = ? WHERE id = ? AND user_id = ?')
      .run(name ?? existing.name, parentId ?? existing.parent_id, id, userId)

    const folder = await db.prepare('SELECT * FROM playlist_folders WHERE id = ? AND user_id = ?').get(id, userId)
    res.json({ message: 'Folder updated successfully', folder })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Update folder error:', error)
    res.status(500).json({ error: 'Failed to update folder' })
  }
})

router.delete('/folders/:id', async (req, res) => {
  try {
    assertUUID(req.params.id, 'id')

    const id = req.params.id
    const db = req.app.locals.db
    const userId = req.user.id

    const existing = await db.prepare('SELECT * FROM playlist_folders WHERE id = ? AND user_id = ?').get(id, userId)
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    await db.prepare('UPDATE playlists SET folder_id = NULL WHERE folder_id = ? AND user_id = ?').run(id, userId)
    await db.prepare('DELETE FROM playlist_folders WHERE id = ? AND user_id = ?').run(id, userId)

    res.json({ message: 'Folder deleted successfully' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Delete folder error:', error)
    res.status(500).json({ error: 'Failed to delete folder' })
  }
})

export default router
