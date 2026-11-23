import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'

import { createFileFilter, createUploadScanner } from '../security/uploadSecurity.js'
import { ValidationError, assertEmail, assertOptionalString, sendValidationError } from '../security/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/profiles')
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: createFileFilter({
    allowedMimeTypes: IMAGE_MIME_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
  }),
})

const scanProfilePhoto = createUploadScanner({
  fieldName: 'photo',
  allowedMagicMime: IMAGE_MIME_TYPES,
})

router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    let settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId)

    if (!settings) {
      const settingsId = uuidv4()
      await db
        .prepare(
          `INSERT INTO user_settings (id, user_id, settings)
           VALUES (?, ?, ?)`
        )
        .run(settingsId, userId, JSON.stringify({}))

      settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId)
    }

    res.json({
      success: true,
      settings: {
        ...settings,
        data: JSON.parse(settings.settings || '{}'),
      },
    })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
})

router.put('/', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id
    const { account, library, notifications, appearance, storage: storageSettings, privacy } = req.body

    const settingsData = JSON.stringify({
      account,
      library,
      notifications,
      appearance,
      storage: storageSettings,
      privacy,
    })

    await db
      .prepare(
        `INSERT INTO user_settings (id, user_id, settings, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           settings = excluded.settings,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run(uuidv4(), userId, settingsData)

    res.json({
      success: true,
      message: 'Settings saved successfully',
    })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

router.post('/upload-photo', upload.single('photo'), scanProfilePhoto, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const db = req.app.locals.db
    const userId = req.user.id

    const photoUrl = `/uploads/profiles/${req.file.filename}`

    await db
      .prepare(
        `UPDATE users
         SET profile_photo = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(photoUrl, userId)

    res.json({
      success: true,
      photoUrl,
      message: 'Profile photo uploaded successfully',
    })
  } catch (error) {
    console.error('Upload photo error:', error)
    res.status(500).json({ error: 'Failed to upload photo' })
  }
})

router.put('/account', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const name = assertOptionalString(req.body.name, 'name', { min: 1, max: 80 })
    const email = req.body.email ? assertEmail(req.body.email) : null
    const djName = assertOptionalString(req.body.djName, 'djName', { max: 80 })
    const bio = assertOptionalString(req.body.bio, 'bio', { max: 400 })

    await db
      .prepare(
        `UPDATE users
         SET name = ?,
             email = COALESCE(?, email),
             dj_name = ?,
             bio = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(name, email, djName, bio, userId)

    res.json({
      success: true,
      message: 'Account updated successfully',
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Update account error:', error)
    res.status(500).json({ error: 'Failed to update account' })
  }
})

router.post('/clear-cache', async (req, res) => {
  try {
    const tempDir = path.join(__dirname, '../../temp')
    await fs.ensureDir(tempDir)
    const files = await fs.readdir(tempDir)

    let deletedCount = 0
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file))
      deletedCount += 1
    }

    res.json({
      success: true,
      message: `Cache cleared successfully. ${deletedCount} files removed.`,
    })
  } catch (error) {
    console.error('Clear cache error:', error)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

router.get('/storage', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const tracks = await db.prepare('SELECT path FROM tracks WHERE user_id = ?').all(userId)

    let uploadsSize = 0
    for (const track of tracks) {
      try {
        const stats = await fs.stat(track.path)
        if (stats.isFile()) {
          uploadsSize += stats.size
        }
      } catch {
        // ignore missing files
      }
    }

    const tempDir = path.join(__dirname, '../../temp')
    let tempSize = 0
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        const stats = await fs.stat(path.join(tempDir, file))
        if (stats.isFile()) {
          tempSize += stats.size
        }
      }
    } catch {
      tempSize = 0
    }

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }

    res.json({
      success: true,
      storage: {
        uploads: formatBytes(uploadsSize),
        cache: formatBytes(tempSize),
        total: formatBytes(uploadsSize + tempSize),
      },
    })
  } catch (error) {
    console.error('Get storage error:', error)
    res.status(500).json({ error: 'Failed to get storage info' })
  }
})

export default router
