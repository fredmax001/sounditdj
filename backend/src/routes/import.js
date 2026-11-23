import express from 'express'
import os from 'os'
import multer from 'multer'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'
import { parseSeratoCrate as parseSeratoCrateBinary } from '../library/formats/serato.js'
import { parseAppleMusicXml } from '../library/formats/appleMusic.js'
import { createFileFilter } from '../security/uploadSecurity.js'
import { ValidationError, assertString, sendValidationError } from '../security/validation.js'
import musicMetadata from 'music-metadata'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const IMPORT_MIME_TYPES = [
  'audio/x-mpegurl', 'application/x-mpegurl', 'text/plain',
  'text/csv', 'application/csv',
  'application/xml', 'text/xml',
  'application/json', 'text/json',
  'application/octet-stream',
  '', // Some browsers send empty mimetype for unknown file types like .crate
]
const IMPORT_EXTENSIONS = ['.m3u', '.m3u8', '.csv', '.xml', '.json', '.nml', '.crate', '.zip']

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: createFileFilter({
    allowedMimeTypes: IMPORT_MIME_TYPES,
    allowedExtensions: IMPORT_EXTENSIONS,
  }),
})

// In-memory import jobs (use Redis in production)
const importJobs = new Map()

function createJob(userId, source) {
  const jobId = uuidv4()
  const job = {
    id: jobId,
    userId,
    source,
    status: 'pending',
    stages: [
      { name: 'parse', label: 'Parsing file', status: 'pending', progress: 0 },
      { name: 'match', label: 'Matching tracks', status: 'pending', progress: 0 },
      { name: 'save', label: 'Saving playlist', status: 'pending', progress: 0 },
    ],
    result: null,
    error: null,
    createdAt: Date.now(),
  }
  importJobs.set(jobId, job)
  return job
}

function updateJobStage(jobId, stageName, status, progress) {
  const job = importJobs.get(jobId)
  if (!job) return
  const stage = job.stages.find(s => s.name === stageName)
  if (stage) {
    stage.status = status
    stage.progress = progress
  }
}

function setJobStatus(jobId, status, result = null, error = null) {
  const job = importJobs.get(jobId)
  if (!job) return
  job.status = status
  if (result) job.result = result
  if (error) job.error = error
}

// Cleanup old jobs every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, job] of importJobs.entries()) {
    if (job.createdAt < cutoff) importJobs.delete(id)
  }
}, 10 * 60 * 1000)

// GET /api/import/progress/:jobId
router.get('/progress/:jobId', async (req, res) => {
  try {
    const job = importJobs.get(req.params.jobId)
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' })
    }
    if (job.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }
    res.json({
      id: job.id,
      status: job.status,
      stages: job.stages,
      result: job.result,
      error: job.error,
    })
  } catch (error) {
    console.error('Progress error:', error)
    res.status(500).json({ error: 'Failed to get progress' })
  }
})

async function scanDirForExts(dirPath, extensions, maxDepth = 2, currentDepth = 0) {
  const results = []
  try {
    const exists = await fs.pathExists(dirPath)
    if (!exists) return results

    const items = await fs.readdir(dirPath, { withFileTypes: true })
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        if (currentDepth < maxDepth) {
          const subResults = await scanDirForExts(fullPath, extensions, maxDepth, currentDepth + 1)
          results.push(...subResults)
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (extensions.includes(ext)) {
          const stats = await fs.stat(fullPath)
          results.push({
            name: path.basename(item.name, ext),
            path: fullPath,
            size: stats.size,
            lastModified: stats.mtimeMs,
          })
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err)
  }
  return results
}

// GET /api/import/discover/:source
router.get('/discover/:source', async (req, res) => {
  try {
    const source = assertString(req.params.source, 'source')
    const home = os.homedir()
    let results = []

    switch (source) {
      case 'serato': {
        const seratoDir = path.join(home, 'Music', '_Serato_')
        const seen = new Set()
        for (const sub of ['Subcrates', 'SubCrates', 'Crates']) {
          const found = await scanDirForExts(path.join(seratoDir, sub), ['.crate'], 1)
          for (const item of found) {
            const key = item.path.toLowerCase()
            if (!seen.has(key)) {
              seen.add(key)
              results.push(item)
            }
          }
        }
        break
      }
      case 'itunes': {
        const dirs = [
          path.join(home, 'Music', 'iTunes'),
          path.join(home, 'Music', 'Music'),
          path.join(home, 'Music'),
        ]
        for (const dir of dirs) {
          results.push(...(await scanDirForExts(dir, ['.xml'], 2)))
        }
        break
      }
      case 'engine-dj': {
        const engineDir = path.join(home, 'Music', 'Engine Library')
        results = await scanDirForExts(engineDir, ['.db', '.m3u', '.m3u8'], 2)
        break
      }
      case 'djay-pro': {
        const djayDir = path.join(home, 'Music', 'djay')
        results = await scanDirForExts(djayDir, ['.xml', '.m3u', '.m3u8'], 2)
        break
      }
      case 'djxml': {
        for (const dir of [path.join(home, 'Music'), path.join(home, 'Documents'), path.join(home, 'Downloads')]) {
          results.push(...(await scanDirForExts(dir, ['.xml'], 2)))
        }
        break
      }
      case 'traktor': {
        const traktorDir = path.join(home, 'Documents', 'Native Instruments')
        results = await scanDirForExts(traktorDir, ['.nml'], 2)
        break
      }
      case 'virtualdj': {
        const vdjDir = path.join(home, 'Documents', 'VirtualDJ')
        results = await scanDirForExts(vdjDir, ['.xml', '.m3u', '.m3u8'], 2)
        break
      }
      case 'rekordbox': {
        const docsDir = path.join(home, 'Documents')
        const musicDir = path.join(home, 'Music')
        const pioDir = path.join(home, 'Music', 'PioneerDJ')
        const libPioDir = path.join(home, 'Library', 'Pioneer', 'rekordbox')
        
        const docsXml = await scanDirForExts(docsDir, ['.xml'], 1)
        const musicXml = await scanDirForExts(musicDir, ['.xml'], 1)
        const pioXml = await scanDirForExts(pioDir, ['.xml'], 2)
        const libPioXml = await scanDirForExts(libPioDir, ['.xml'], 2)
        
        results = [...docsXml, ...musicXml, ...pioXml, ...libPioXml].filter(item => {
          const lower = item.name.toLowerCase()
          return lower.includes('rekordbox') || lower.includes('collection') || lower.includes('playlist') || lower.includes('smartlist')
        })
        break
      }
      case 'm3u':
      case 'csv':
      case 'json': {
        const ext = '.' + source
        const musicDir = path.join(home, 'Music')
        const docsDir = path.join(home, 'Documents')
        const downDir = path.join(home, 'Downloads')
        
        const musicFiles = await scanDirForExts(musicDir, [ext], 2)
        const docsFiles = await scanDirForExts(docsDir, [ext], 2)
        const downFiles = await scanDirForExts(downDir, [ext], 2)
        
        results = [...musicFiles, ...docsFiles, ...downFiles]
        break
      }
      default:
        return res.status(400).json({ error: 'Unsupported discovery source' })
    }

    results.sort((a, b) => a.name.localeCompare(b.name))
    res.json(results)
  } catch (error) {
    console.error('Discovery error:', error)
    res.status(500).json({ error: 'Failed to discover local files' })
  }
})

// POST /api/import/playlist — existing file upload endpoint (backward compatible)
router.post('/playlist', upload.single('playlist'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No playlist file uploaded' })
    }

    const playlistName = assertString(req.body.name || path.parse(req.file.originalname).name, 'name', { min: 1, max: 120 })
    const db = req.app.locals.db
    const userId = req.user.id

    const ext = path.extname(req.file.originalname).toLowerCase()
    const buffer = req.file.buffer
    let tracks = []

    switch (ext) {
      case '.m3u':
      case '.m3u8':
        tracks = parseM3U(buffer.toString('utf-8'))
        break
      case '.csv':
        tracks = parseCSV(buffer.toString('utf-8'))
        break
      case '.xml':
        tracks = parseRekordboxXML(buffer.toString('utf-8'))
        break
      case '.json':
        tracks = parseJSON(buffer.toString('utf-8'))
        break
      default:
        return res.status(400).json({ error: 'Unsupported file format' })
    }

    const result = await processImport(db, userId, playlistName, tracks, `Imported from ${req.file.originalname}`)
    res.json(result)
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }
    console.error('Import error:', error)
    res.status(500).json({ error: 'Failed to import playlist' })
  }
})

// POST /api/import/dj-software — new unified DJ software import with progress tracking
router.post('/dj-software', upload.single('file'), async (req, res) => {
  try {
    const source = assertString(req.body.source || 'file', 'source')
    const localPath = req.body.localPath ? assertString(req.body.localPath, 'localPath') : null

    let file = req.file
    if (!file && localPath) {
      const exists = await fs.pathExists(localPath)
      if (!exists) {
        return res.status(404).json({ error: 'Local file not found' })
      }
      const buffer = await fs.readFile(localPath)
      file = {
        originalname: path.basename(localPath),
        buffer
      }
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded or local path provided' })
    }

    const playlistName = assertString(req.body.name || path.parse(file.originalname).name, 'name', { min: 1, max: 120 })
    const db = req.app.locals.db
    const userId = req.user.id

    const job = createJob(userId, source)

    // Start async processing
    processDJSoftwareImport(job, db, userId, source, file, playlistName)
      .then(result => {
        setJobStatus(job.id, 'complete', result)
      })
      .catch(error => {
        console.error('DJ software import error:', error)
        setJobStatus(job.id, 'error', null, error.message || 'Import failed')
      })

    res.json({ jobId: job.id, message: 'Import started' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }
    console.error('Import error:', error)
    res.status(500).json({ error: 'Failed to start import' })
  }
})

async function processDJSoftwareImport(job, db, userId, source, file, playlistName) {
  const ext = path.extname(file.originalname).toLowerCase()
  const buffer = file.buffer
  let tracks = []

  updateJobStage(job.id, 'parse', 'running', 0)

  switch (source) {
    case 'traktor':
      tracks = parseTraktorNML(buffer.toString('utf-8'))
      break
    case 'virtualdj':
      tracks = parseVirtualDJ(buffer.toString('utf-8'))
      break
    case 'serato':
      tracks = await parseSeratoCrate(buffer)
      break
    case 'rekordbox-xml':
    case 'rekordbox':
      tracks = parseRekordboxXML(buffer.toString('utf-8'))
      break
    case 'itunes': {
      const lib = parseAppleMusicXml(buffer.toString('utf-8'))
      tracks = (lib.tracks || []).map((t) => ({
        title: t.title || '',
        artist: t.artist || '',
        album: t.album || '',
        bpm: t.bpm || null,
        key: t.key || '',
        filePath: t.path || '',
        duration: t.duration || 0,
      }))
      break
    }
    case 'ultramixer':
    case 'm3u':
      tracks = parseM3U(buffer.toString('utf-8'))
      break
    case 'csv':
      tracks = parseCSV(buffer.toString('utf-8'))
      break
    case 'json':
      tracks = parseJSON(buffer.toString('utf-8'))
      break
    default:
      // Auto-detect by extension
      if (ext === '.nml') tracks = parseTraktorNML(buffer.toString('utf-8'))
      else if (ext === '.xml') tracks = parseRekordboxXML(buffer.toString('utf-8'))
      else if (ext === '.csv') tracks = parseCSV(buffer.toString('utf-8'))
      else if (ext === '.m3u' || ext === '.m3u8') tracks = parseM3U(buffer.toString('utf-8'))
      else if (ext === '.json') tracks = parseJSON(buffer.toString('utf-8'))
      else if (ext === '.crate') tracks = await parseSeratoCrate(buffer)
      else throw new Error('Unsupported file format')
  }

  updateJobStage(job.id, 'parse', 'complete', 100)
  updateJobStage(job.id, 'match', 'running', 0)

  const result = await processImport(db, userId, playlistName, tracks, `Imported from ${source || file.originalname}`, job)

  updateJobStage(job.id, 'match', 'complete', 100)
  updateJobStage(job.id, 'save', 'complete', 100)

  return result
}

async function processImport(db, userId, playlistName, tracks, description, job = null) {
  const existingTracks = await db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId)
  const matched = []
  const unmatched = []
  const createdTrackIds = []

  for (let i = 0; i < tracks.length; i++) {
    const imported = tracks[i]

    if (job && i % 10 === 0) {
      updateJobStage(job.id, 'match', 'running', Math.round((i / tracks.length) * 100))
    }

    let match = existingTracks.find(et => {
      if (imported.filePath && et.path) {
        const importedBase = path.basename(imported.filePath)
        const existingBase = path.basename(et.path)
        return importedBase === existingBase
      }
      return false
    })

    if (!match && imported.title && imported.artist) {
      match = existingTracks.find(et =>
        (et.title?.toLowerCase() === imported.title.toLowerCase()) &&
        (et.artist?.toLowerCase() === imported.artist.toLowerCase())
      )
    }

    if (match) {
      matched.push({ ...imported, trackId: match.id })
    } else {
      unmatched.push(imported)
    }
  }

  if (job) updateJobStage(job.id, 'save', 'running', 0)

  // Create library entries for unmatched tracks so they appear in the playlist
  for (const imported of unmatched) {
    const trackId = uuidv4()
    const fileName = imported.filePath
      ? path.basename(imported.filePath)
      : `${imported.title || 'Unknown'} - ${imported.artist || 'Unknown'}.mp3`
    const filePath = imported.filePath || `imported://${fileName}`

    let bpm = imported.bpm || null
    let key = imported.key || ''
    let duration = imported.duration || 0
    let title = imported.title || ''
    let artist = imported.artist || ''
    let album = imported.album || ''
    let artwork = null
    let genre = null
    let metadataJson = null

    if (imported.filePath && !imported.filePath.startsWith('imported://')) {
      try {
        const exists = await fs.pathExists(imported.filePath)
        if (exists) {
          const parsed = await musicMetadata.parseFile(imported.filePath)
          const common = parsed.common
          
          title = common.title || title || path.basename(imported.filePath, path.extname(imported.filePath))
          artist = common.artist || artist || ''
          album = common.album || album || ''
          bpm = common.bpm || bpm || null
          key = common.key || key || ''
          duration = parsed.format.duration || duration || 0
          
          if (common.genre) {
            genre = Array.isArray(common.genre) ? common.genre[0] : common.genre
          }
          
          metadataJson = JSON.stringify(common)

          if (common.picture && common.picture.length > 0) {
            const picture = common.picture[0]
            const artworkPath = path.join(__dirname, '../../uploads/artwork', `${uuidv4()}.jpg`)
            await fs.ensureDir(path.dirname(artworkPath))
            await fs.writeFile(artworkPath, picture.data)
            artwork = `/uploads/artwork/${path.basename(artworkPath)}`
          }
        }
      } catch (err) {
        console.log(`Metadata extraction failed for ${imported.filePath}:`, err.message)
      }
    }

    await db
      .prepare(`INSERT INTO tracks (id, user_id, filename, original_name, path, title, artist, album, bpm, key, duration, artwork, metadata, genre)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        trackId,
        userId,
        fileName,
        imported.title || fileName,
        filePath,
        title,
        artist,
        album,
        bpm,
        key,
        duration,
        artwork,
        metadataJson,
        genre
      )

    createdTrackIds.push(trackId)
  }

  const playlistId = uuidv4()
  await db
    .prepare('INSERT INTO playlists (id, user_id, name, description) VALUES (?, ?, ?, ?)')
    .run(playlistId, userId, playlistName, description)

  // Add matched tracks to playlist
  for (let i = 0; i < matched.length; i++) {
    await db
      .prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)')
      .run(playlistId, matched[i].trackId, i + 1)
  }

  // Add newly created tracks to playlist (after matched tracks)
  for (let i = 0; i < createdTrackIds.length; i++) {
    await db
      .prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)')
      .run(playlistId, createdTrackIds[i], matched.length + i + 1)
  }

  // Save cue points from imported tracks
  async function saveCues(trackId, cues) {
    if (!cues || cues.length === 0) return
    for (const cue of cues) {
      const cueId = uuidv4()
      await db
        .prepare('INSERT INTO cue_points (id, track_id, user_id, name, position, color) VALUES (?, ?, ?, ?, ?, ?)')
        .run(cueId, trackId, userId, cue.name || 'Cue', cue.position || 0, cue.color || '#EDC61E')
    }
  }

  for (const item of matched) {
    if (item.cues && item.cues.length > 0) {
      await saveCues(item.trackId, item.cues)
    }
  }

  for (let i = 0; i < unmatched.length; i++) {
    if (unmatched[i].cues && unmatched[i].cues.length > 0) {
      await saveCues(createdTrackIds[i], unmatched[i].cues)
    }
  }

  const playlist = await db.prepare('SELECT * FROM playlists WHERE id = ?').get(playlistId)
  const playlistTracks = await db
    .prepare(
      `SELECT t.* FROM tracks t
       JOIN playlist_tracks pt ON t.id = pt.track_id
       WHERE pt.playlist_id = ? ORDER BY pt.position`
    )
    .all(playlistId)

  return {
    message: 'Playlist imported successfully',
    playlist: { ...playlist, tracks: playlistTracks, track_count: playlistTracks.length },
    stats: {
      totalInFile: tracks.length,
      matched: matched.length,
      unmatched: unmatched.length,
      created: createdTrackIds.length,
      unmatchedTracks: unmatched.slice(0, 20),
    },
  }
}

// ============ PARSERS ============

function safeDecode(str) {
  if (!str) return str
  try {
    return decodeURIComponent(str.replace(/\+/g, '%20'))
  } catch (e) {
    return str
  }
}

function parseM3U(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)
  const tracks = []
  let currentInfo = null

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:(-?\d+),(.*)/)
      if (match) {
        const parts = match[2].split(' - ')
        currentInfo = {
          duration: parseInt(match[1]) || 0,
          artist: parts[0]?.trim() || '',
          title: parts[1]?.trim() || '',
        }
      }
    } else if (!line.startsWith('#')) {
      tracks.push({
        title: safeDecode(currentInfo?.title || path.basename(line, path.extname(line))),
        artist: safeDecode(currentInfo?.artist || ''),
        filePath: safeDecode(line),
        duration: currentInfo?.duration || 0,
      })
      currentInfo = null
    }
  }

  return tracks
}

function parseCSV(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  const tracks = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    tracks.push({
      title: safeDecode(row.title || row.name || row.track || ''),
      artist: safeDecode(row.artist || row.artistname || ''),
      album: safeDecode(row.album || ''),
      bpm: row.bpm ? parseFloat(row.bpm) : null,
      key: row.key || row.tonality || '',
      filePath: safeDecode(row.filename || row.file || row.location || row.path || ''),
      duration: row.duration ? parseFloat(row.duration) : 0,
    })
  }

  return tracks
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseRekordboxXML(content) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: false,
    })
    const data = parser.parse(content)
    const tracks = []

    const collection = data.DJ_PLAYLISTS?.COLLECTION?.TRACK || []
    const trackArray = Array.isArray(collection) ? collection : [collection].filter(Boolean)

    for (const track of trackArray) {
      const name = track.Name || ''
      const artist = track.Artist || ''
      const album = track.Album || ''
      const totalTime = track.TotalTime || ''
      const tempo = track.Tempo || ''
      const tonality = track.Tonality || ''
      const location = track.Location || ''

      let duration = 0
      if (totalTime) {
        if (totalTime.includes(':')) {
          const parts = totalTime.split(':').map(Number)
          if (parts.length === 3) {
            duration = parts[0] * 3600 + parts[1] * 60 + parts[2]
          } else if (parts.length === 2) {
            duration = parts[0] * 60 + parts[1]
          }
        } else {
          duration = parseFloat(totalTime) || 0
        }
      }

      let filePath = ''
      if (location) {
        filePath = safeDecode(location.replace('file://localhost', '').replace('file://', ''))
      }

      // Extract cue points from POSITION_MARK elements
      const cues = []
      const positionMarks = track.POSITION_MARK || []
      const markArray = Array.isArray(positionMarks) ? positionMarks : [positionMarks].filter(Boolean)
      for (const mark of markArray) {
        const start = parseFloat(mark.Start)
        if (!isNaN(start)) {
          cues.push({
            name: mark.Name || `Cue ${mark.Num || cues.length + 1}`,
            position: start,
            color: mark.Red === '1' ? '#FF0000' : mark.Blue === '1' ? '#0000FF' : mark.Green === '1' ? '#00FF00' : '#EDC61E',
          })
        }
      }

      tracks.push({
        title: safeDecode(name),
        artist: safeDecode(artist),
        album: safeDecode(album),
        bpm: tempo ? parseFloat(tempo) : null,
        key: tonality,
        filePath,
        duration,
        cues,
      })
    }

    return tracks
  } catch (err) {
    console.error('XML parse error:', err)
    return []
  }
}

function parseJSON(content) {
  try {
    const data = JSON.parse(content)
    const tracks = Array.isArray(data) ? data : (data.tracks || data.playlist?.tracks || [])
    return tracks.map(t => ({
      title: safeDecode(t.title || t.name || ''),
      artist: safeDecode(t.artist || ''),
      album: safeDecode(t.album || ''),
      bpm: t.bpm || null,
      key: t.key || '',
      filePath: safeDecode(t.filePath || t.path || t.location || ''),
      duration: t.duration || 0,
    }))
  } catch (err) {
    console.error('JSON parse error:', err)
    return []
  }
}

// ============ NEW DJ SOFTWARE PARSERS ============

function parseTraktorNML(content) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: false,
    })
    const data = parser.parse(content)
    const tracks = []

    const entries = data.NML?.COLLECTION?.ENTRY || []
    const entryArray = Array.isArray(entries) ? entries : [entries].filter(Boolean)

    for (const entry of entryArray) {
      const location = entry.LOCATION || {}
      const info = entry.INFO || {}
      const tempo = entry.TEMPO || {}
      const album = entry.ALBUM || {}

      const dir = safeDecode(location.DIR || '')
      const file = safeDecode(location.FILE || '')
      const filePath = dir && file ? path.posix.join(dir, file) : (file || '')

      let duration = 0
      if (info.PLAYTIME) {
        duration = parseFloat(info.PLAYTIME)
      } else if (info.PLAYTIME_FLOAT) {
        duration = parseFloat(info.PLAYTIME_FLOAT)
      }

      // Extract cue points from CUE_V2 elements
      const cues = []
      const cueElements = entry.CUE_V2 || []
      const cueArray = Array.isArray(cueElements) ? cueElements : [cueElements].filter(Boolean)
      const cueColors = ['#EDC61E', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFA500', '#FFFFFF']
      for (let i = 0; i < cueArray.length; i++) {
        const cue = cueArray[i]
        const start = parseFloat(cue.START)
        if (!isNaN(start)) {
          cues.push({
            name: cue.NAME || `Hot Cue ${i + 1}`,
            position: start,
            color: cueColors[i % cueColors.length],
          })
        }
      }

      tracks.push({
        title: safeDecode(entry.TITLE || ''),
        artist: safeDecode(entry.ARTIST || ''),
        album: safeDecode(album.TITLE || ''),
        bpm: tempo.BPM ? parseFloat(tempo.BPM) : null,
        key: info.KEY || '',
        filePath,
        duration,
        cues,
      })
    }

    return tracks
  } catch (err) {
    console.error('Traktor NML parse error:', err)
    return []
  }
}

function parseVirtualDJ(content) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: false,
    })
    const data = parser.parse(content)
    const tracks = []

    const songs = data.VirtualDJ_Database?.Song || data.VirtualDJ_Database?.song || []
    const songArray = Array.isArray(songs) ? songs : [songs].filter(Boolean)

    for (const song of songArray) {
      const tags = song.Tags || song.tags || {}
      const infos = song.Infos || song.infos || {}
      const scan = song.Scan || song.scan || {}

      tracks.push({
        title: safeDecode(tags.Title || tags.title || ''),
        artist: safeDecode(tags.Author || tags.author || ''),
        album: safeDecode(tags.Album || tags.album || ''),
        bpm: tags.Bpm ? parseFloat(tags.Bpm) : (scan.Bpm ? parseFloat(scan.Bpm) : null),
        key: tags.Key || tags.key || (scan.Key || scan.key) || '',
        filePath: safeDecode(song.FilePath || song.filePath || ''),
        duration: infos.SongLength ? parseFloat(infos.SongLength) : 0,
      })
    }

    return tracks
  } catch (err) {
    console.error('VirtualDJ parse error:', err)
    return []
  }
}

async function parseSeratoCrate(buffer) {
  try {
    const songPaths = parseSeratoCrateBinary(buffer)

    return songPaths.map((filePath) => {
      const decodedPath = safeDecode(filePath)
      return {
        title: path.basename(decodedPath, path.extname(decodedPath)),
        artist: '',
        filePath: decodedPath,
        duration: 0,
      }
    })
  } catch (err) {
    console.error('Serato crate parse error:', err)
    return []
  }
}

export default router
