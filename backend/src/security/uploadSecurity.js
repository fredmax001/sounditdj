import fs from 'fs-extra'
import path from 'path'
import { spawn } from 'child_process'
import { open } from 'fs/promises'

const FORBIDDEN_EXTENSIONS = new Set(['.exe', '.sh', '.js', '.php', '.bat', '.cmd', '.scr'])

const EICAR_STRING = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

const MAGIC_MIME_BY_SIGNATURE = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/gif', test: (b) => b.slice(0, 6).toString('ascii') === 'GIF87a' || b.slice(0, 6).toString('ascii') === 'GIF89a' },
  { mime: 'image/webp', test: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'audio/mpeg', test: (b) => b.slice(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { mime: 'audio/wav', test: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE' },
  { mime: 'audio/flac', test: (b) => b.slice(0, 4).toString('ascii') === 'fLaC' },
  { mime: 'audio/ogg', test: (b) => b.slice(0, 4).toString('ascii') === 'OggS' },
  { mime: 'audio/mp4', test: (b) => b.slice(4, 8).toString('ascii') === 'ftyp' },
  { mime: 'audio/aac', test: (b) => b[0] === 0xff && (b[1] & 0xf0) === 0xf0 },
]

function safeUnlink(filePath) {
  try {
    fs.removeSync(filePath)
  } catch {
    // ignore cleanup failures
  }
}

export function sanitizeFileName(originalName) {
  return path
    .basename(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

export function isAllowedFileType(file, { allowedMimeTypes, allowedExtensions }) {
  const ext = path.extname(file.originalname || '').toLowerCase()

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return false
  }

  const hasAllowedExt = allowedExtensions.includes(ext)
  const hasAllowedMime = allowedMimeTypes.includes(file.mimetype)
  return hasAllowedExt && hasAllowedMime
}

function runClamScan(filePath) {
  return new Promise((resolve) => {
    const clamscanProcess = spawn('clamscan', ['--no-summary', filePath], {
      stdio: 'ignore',
    })

    clamscanProcess.on('error', () => resolve({ scanned: false, infected: false }))

    clamscanProcess.on('close', (code) => {
      if (code === 1) {
        resolve({ scanned: true, infected: true })
        return
      }

      if (code === 0) {
        resolve({ scanned: true, infected: false })
        return
      }

      resolve({ scanned: false, infected: false })
    })
  })
}

async function hasMaliciousSignature(filePath) {
  const buffer = await fs.readFile(filePath)
  const content = buffer.toString('utf8')

  if (content.includes(EICAR_STRING)) {
    return true
  }

  return false
}

async function detectMimeByMagic(filePath) {
  const descriptor = await open(filePath, 'r')
  const buffer = Buffer.alloc(16)

  try {
    await descriptor.read(buffer, 0, 16, 0)
  } finally {
    await descriptor.close()
  }

  for (const rule of MAGIC_MIME_BY_SIGNATURE) {
    if (rule.test(buffer)) {
      return rule.mime
    }
  }

  return null
}

export async function scanUploadedFile(filePath, { allowedMagicMime = [] } = {}) {
  if (await hasMaliciousSignature(filePath)) {
    return { safe: false, reason: 'Malware signature detected' }
  }

  try {
    const detectedMime = await detectMimeByMagic(filePath)
    if (detectedMime && allowedMagicMime.length > 0 && !allowedMagicMime.includes(detectedMime)) {
      return { safe: false, reason: 'File content does not match allowed type' }
    }
  } catch {
    // Signature parsing failure is non-fatal.
  }

  const clamResult = await runClamScan(filePath)
  if (clamResult.infected) {
    return { safe: false, reason: 'ClamAV detected malware' }
  }

  return { safe: true, scanned: clamResult.scanned }
}

export function createUploadScanner({ fieldName = 'file', allowedMagicMime = [] } = {}) {
  return async (req, res, next) => {
    try {
      const uploadedFile = fieldName ? req.file : null
      if (!uploadedFile) {
        return next()
      }

      const result = await scanUploadedFile(uploadedFile.path, { allowedMagicMime })
      if (!result.safe) {
        safeUnlink(uploadedFile.path)
        return res.status(400).json({ error: result.reason || 'Uploaded file is not allowed' })
      }

      return next()
    } catch (error) {
      if (req.file?.path) {
        safeUnlink(req.file.path)
      }
      return next(error)
    }
  }
}

export function createFileFilter({ allowedMimeTypes, allowedExtensions }) {
  return (req, file, cb) => {
    if (!isAllowedFileType(file, { allowedMimeTypes, allowedExtensions })) {
      cb(new Error('Invalid or forbidden file type'))
      return
    }
    cb(null, true)
  }
}

export { FORBIDDEN_EXTENSIONS }
