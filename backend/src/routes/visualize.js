import express from 'express'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import musicMetadata from 'music-metadata'
import { spawn } from 'child_process'

import { createFileFilter, createUploadScanner } from '../security/uploadSecurity.js'
import {
  ValidationError,
  assertEnum,
  assertOptionalString,
  assertString,
  assertUUID,
  sendValidationError,
} from '../security/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const activeJobs = new Map()

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/mp4']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/visualizer')
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

const SUPPORTED_VISUAL_TYPES = [
  'spectrum',
  'particles',
  'waveform',
  'bars',
  'circular',
  'grid',
  'triangles',
  'hexagon',
  'starfield',
  'oscilloscope',
  'spectrum-pro',
  'wave-luxe',
  'radial-pulse',
  'kick-reactor',
  'particle-nebula',
  'aurora-flow',
  'grid-tunnel',
  'prism-bars',
  'vinyl-orbit',
  'minimal-line',
]

const VISUAL_TYPE_ALIASES = {
  'spectrum-pro': 'spectrum',
  'wave-luxe': 'waveform',
  'radial-pulse': 'circular',
  'kick-reactor': 'circular',
  'particle-nebula': 'particles',
  'aurora-flow': 'waveform',
  'grid-tunnel': 'grid',
  'prism-bars': 'bars',
  'vinyl-orbit': 'circular',
  'minimal-line': 'waveform',
}

router.post('/', upload.single('audio'), scanAudioUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    const rawVisualType = req.body.visualType || 'spectrum'
    const visualType = assertEnum(rawVisualType, 'visualType', SUPPORTED_VISUAL_TYPES)
    const rawResolution = req.body.resolution || '1080p'
    const resolution = assertEnum(rawResolution, 'resolution', ['720p', '1080p', '4k', 'portrait', 'square'])
    const quality = assertEnum(req.body.quality || 'high', 'quality', ['low', 'medium', 'high'])
    const primaryColor = assertOptionalString(req.body.primaryColor, 'primaryColor', { max: 16 })
    const secondaryColor = assertOptionalString(req.body.secondaryColor, 'secondaryColor', { max: 16 })
    const customWidth = req.body.width ? Number(req.body.width) : null
    const customHeight = req.body.height ? Number(req.body.height) : null

    let bgPath = null
    const bgData = req.body.background
    if (bgData && bgData.startsWith('data:image/')) {
      try {
        const matches = bgData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64')
          const ext = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1]
          const bgFileName = `${uuidv4()}.${ext}`
          const tempDir = path.join(__dirname, '../../temp')
          fs.ensureDirSync(tempDir)
          bgPath = path.join(tempDir, bgFileName)
          fs.writeFileSync(bgPath, buffer)
        }
      } catch (err) {
        console.error('Failed to decode background image:', err)
      }
    }

    const jobId = uuidv4()

    activeJobs.set(jobId, {
      id: jobId,
      userId: req.user.id,
      status: 'processing',
      progress: 0,
      audioPath: req.file.path,
      visualType,
      resolution,
      quality,
      width: customWidth,
      height: customHeight,
      primaryColor,
      secondaryColor,
      bgPath,
    })

    createVisualization(jobId)

    res.json({ jobId })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Visualization start error:', error)
    res.status(500).json({ error: 'Failed to start visualization' })
  }
})

async function createVisualization(jobId) {
  const job = activeJobs.get(jobId)
  if (!job) return

  try {
    const outputDir = path.join(__dirname, '../../uploads/visualizer/output')
    fs.ensureDirSync(outputDir)
    const outputFileName = `${uuidv4()}.mp4`
    const outputPath = path.join(outputDir, outputFileName)

    // 1. Get audio duration
    let duration = 30 // fallback
    try {
      const metadata = await musicMetadata.parseFile(job.audioPath)
      if (metadata.format.duration) {
        duration = metadata.format.duration
      }
    } catch (err) {
      console.error('Failed to query audio duration:', err.message)
    }

    // 2. Map resolution
    let width = Number(job.width) || 1920
    let height = Number(job.height) || 1080
    if (job.resolution === '720p') {
      width = 1280
      height = 720
    } else if (job.resolution === '4k') {
      width = 3840
      height = 2160
    } else if (job.resolution === 'portrait') {
      width = 1080
      height = 1920
    } else if (job.resolution === 'square') {
      width = 1080
      height = 1080
    }

    // 3. Map color & mode
    const color = (job.primaryColor || '#7c3aed').startsWith('#') ? job.primaryColor : `#${job.primaryColor}`
    const canonicalType = VISUAL_TYPE_ALIASES[job.visualType] || job.visualType
    let mode = 'line'
    if (canonicalType === 'waveform') {
      mode = 'line'
    } else if (canonicalType === 'spectrum') {
      mode = 'cline'
    } else if (canonicalType === 'bars') {
      mode = 'p2p'
    } else {
      mode = 'cline'
    }

    // 4. Determine FFmpeg binary
    let ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'
    if (!process.env.FFMPEG_PATH && fs.existsSync('/opt/homebrew/bin/ffmpeg')) {
      ffmpegPath = '/opt/homebrew/bin/ffmpeg'
    }

    // 5. Construct args
    let args = []
    if (job.bgPath && fs.existsSync(job.bgPath)) {
      args = [
        '-y',
        '-loop', '1',
        '-i', job.bgPath,
        '-i', job.audioPath,
        '-filter_complex', `[1:a]showwaves=s=${width}x${height}:mode=${mode}:colors=${color}[v];[0:v][v]overlay=shortest=1`,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-c:v', 'libx264',
        '-shortest',
        outputPath
      ]
    } else {
      args = [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=black:s=${width}x${height}`,
        '-i', job.audioPath,
        '-filter_complex', `[1:a]showwaves=s=${width}x${height}:mode=${mode}:colors=${color}[v];[0:v][v]overlay=shortest=1`,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-c:v', 'libx264',
        '-shortest',
        outputPath
      ]
    }

    // 6. Spawn FFmpeg
    const proc = spawn(ffmpegPath, args)

    proc.stderr.on('data', (data) => {
      const str = data.toString()
      const match = str.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (match) {
        const hours = parseInt(match[1])
        const minutes = parseInt(match[2])
        const seconds = parseInt(match[3])
        const elapsed = hours * 3600 + minutes * 60 + seconds
        const pct = Math.min(Math.round((elapsed / duration) * 100), 99)
        job.progress = pct
        activeJobs.set(jobId, job)
      }
    })

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`))
        }
      })
      proc.on('error', (err) => {
        reject(err)
      })
    })

    // Cleanup temp background image
    if (job.bgPath) {
      try {
        await fs.unlink(job.bgPath)
      } catch (err) {
        console.error('Failed to cleanup temp background image:', err.message)
      }
    }

    job.status = 'completed'
    job.progress = 100
    job.downloadUrl = `/uploads/visualizer/output/${outputFileName}`
    activeJobs.set(jobId, job)
  } catch (error) {
    console.error('Visualization error:', error)
    
    // Cleanup on error
    if (job.bgPath) {
      try {
        await fs.unlink(job.bgPath)
      } catch (err) {
        // ignore
      }
    }

    job.status = 'error'
    job.error = error.message
    activeJobs.set(jobId, job)
  }
}

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
      downloadUrl: job.downloadUrl,
      error: job.error,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Status error:', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

router.get('/presets', async (req, res) => {
  try {
    const db = req.app.locals.db
    const userId = req.user.id

    const presets = await db
      .prepare('SELECT * FROM visual_presets WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId)

    res.json({
      presets: presets.map((preset) => ({
        ...preset,
        settings: JSON.parse(preset.settings),
      })),
    })
  } catch (error) {
    console.error('Presets error:', error)
    res.status(500).json({ error: 'Failed to get presets' })
  }
})

router.post('/presets', async (req, res) => {
  try {
    const name = assertString(req.body.name, 'name', { min: 1, max: 120 })
    const settings = req.body.settings || {}
    const db = req.app.locals.db
    const userId = req.user.id

    const presetId = uuidv4()
    await db
      .prepare(
        `INSERT INTO visual_presets (id, user_id, name, settings)
         VALUES (?, ?, ?, ?)`
      )
      .run(presetId, userId, name, JSON.stringify(settings))

    const preset = await db.prepare('SELECT * FROM visual_presets WHERE id = ? AND user_id = ?').get(presetId, userId)

    res.json({
      message: 'Preset saved',
      preset: {
        ...preset,
        settings: JSON.parse(preset.settings),
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Save preset error:', error)
    res.status(500).json({ error: 'Failed to save preset' })
  }
})

export default router
