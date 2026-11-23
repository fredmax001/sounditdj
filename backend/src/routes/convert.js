import express from 'express'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import ffmpeg from 'fluent-ffmpeg'

import { createFileFilter, createUploadScanner } from '../security/uploadSecurity.js'
import { ValidationError, assertEnum, assertNumber, assertUUID, sendValidationError } from '../security/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const activeJobs = new Map()

// Configure FFmpeg binary path
const envFfmpegPath = process.env.FFMPEG_PATH
if (envFfmpegPath) {
  ffmpeg.setFfmpegPath(envFfmpegPath)
} else if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) {
  ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg')
}

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/mp4']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/conversions/input')
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

function normalizeConversionOptions({ format, quality }) {
  const normalizedFormat = assertEnum(format, 'format', ['mp3', 'wav', 'flac', 'aac'])

  const numericQuality = assertNumber(quality, 'quality', { min: 0, max: 96000 })

  if (normalizedFormat === 'mp3' || normalizedFormat === 'aac') {
    assertNumber(numericQuality, 'quality', { min: 64, max: 320 })
  } else if (normalizedFormat === 'wav') {
    assertNumber(numericQuality, 'quality', { min: 8000, max: 96000 })
  } else if (normalizedFormat === 'flac') {
    assertNumber(numericQuality, 'quality', { min: 0, max: 8 })
  }

  return { format: normalizedFormat, quality: String(numericQuality) }
}

router.post('/', upload.single('audio'), scanAudioUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { format, quality } = normalizeConversionOptions(req.body)
    const inputPath = req.file.path
    const jobId = uuidv4()
    const outputDir = path.join(__dirname, '../../uploads/conversions/output')
    fs.ensureDirSync(outputDir)

    const outputFileName = `${uuidv4()}.${format}`
    const outputPath = path.join(outputDir, outputFileName)

    activeJobs.set(jobId, {
      id: jobId,
      userId: req.user.id,
      status: 'processing',
      progress: 0,
      inputPath,
      outputPath,
      outputFileName,
    })

    convertAudio(jobId, inputPath, outputPath, format, quality)

    res.json({ jobId })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Conversion start error:', error)
    res.status(500).json({ error: 'Failed to start conversion' })
  }
})

function convertAudio(jobId, inputPath, outputPath, format, quality) {
  const job = activeJobs.get(jobId)
  if (!job) return

  let ffmpegCommand = ffmpeg(inputPath)

  switch (format) {
    case 'mp3':
      ffmpegCommand = ffmpegCommand.audioCodec('libmp3lame').audioBitrate(parseInt(quality, 10))
      break
    case 'wav':
      ffmpegCommand = ffmpegCommand.audioCodec('pcm_s16le').audioFrequency(parseInt(quality, 10))
      break
    case 'flac':
      ffmpegCommand = ffmpegCommand.audioCodec('flac').outputOptions(`-compression_level ${quality}`)
      break
    case 'aac':
      ffmpegCommand = ffmpegCommand.audioCodec('aac').audioBitrate(parseInt(quality, 10))
      break
    default:
      ffmpegCommand = ffmpegCommand.toFormat(format)
  }

  ffmpegCommand
    .on('progress', (progress) => {
      if (progress.percent) {
        job.progress = Math.round(progress.percent)
        activeJobs.set(jobId, job)
      }
    })
    .on('end', () => {
      job.status = 'completed'
      job.progress = 100
      job.downloadUrl = `/uploads/conversions/output/${job.outputFileName}`
      activeJobs.set(jobId, job)

      try {
        fs.unlinkSync(inputPath)
      } catch (err) {
        console.log('Cleanup error:', err.message)
      }
    })
    .on('error', (err) => {
      console.error('Conversion error:', err)
      job.status = 'error'
      job.error = err.message
      activeJobs.set(jobId, job)
    })
    .save(outputPath)
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

export default router
