import express from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import musicMetadata from 'music-metadata'

import { createFileFilter, createUploadScanner } from '../security/uploadSecurity.js'
import { sendValidationError } from '../security/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/mp4']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/mixes_public')
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

const scanMixUpload = createUploadScanner({
  fieldName: 'mix',
  allowedMagicMime: AUDIO_MIME_TYPES,
})

router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db
    const mixes = await db
      .prepare(
        `SELECT m.*, u.dj_name, u.name as user_name 
         FROM dj_mixes m
         LEFT JOIN users u ON m.user_id = u.id
         ORDER BY m.created_at DESC`
      )
      .all()
    
    res.json(mixes)
  } catch (error) {
    console.error('Failed to fetch mixes:', error)
    res.status(500).json({ error: 'Failed to fetch mixes' })
  }
})

router.post('/upload', upload.single('mix'), scanMixUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No mix file uploaded' })
    }

    const { title, genre, description } = req.body
    if (!title) {
       return res.status(400).json({ error: 'Title is required' })
    }

    const db = req.app.locals.db
    const userId = req.user.id
    const filePath = `/uploads/mixes_public/${req.file.filename}`

    // Fetch user's real name since JWT only carries { id }
    const userRow = await db.prepare('SELECT name, dj_name FROM users WHERE id = ?').get(userId)
    const artistName = userRow?.dj_name || userRow?.name || 'Unknown DJ'

    // Calculate duration
    let duration = 0
    try {
      const metadata = await musicMetadata.parseFile(req.file.path)
      duration = metadata.format.duration || 0
    } catch (e) {
      console.error('Metadata parse error', e)
    }

    const mixId = uuidv4()

    await db
      .prepare(
        `INSERT INTO dj_mixes (id, user_id, title, artist, description, file_path, duration, genre)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mixId,
        userId,
        title,
        artistName,
        description || '',
        filePath,
        duration,
        genre || 'Electronic'
      )

    res.json({ success: true, mixId })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload mix' })
  }
})

export default router
