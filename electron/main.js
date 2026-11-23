const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')
const { Readable } = require('stream')
const isDev = require('electron-is-dev')
const fs = require('fs-extra')
const os = require('os')

// Register custom local-media streaming scheme BEFORE app is ready so HTML5 <audio>
// and Web Audio API (AudioContext.decodeAudioData) can stream and seek local audio files with CORS.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'soundit-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

const AUDIO_MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
}

function registerLocalMediaProtocol() {
  protocol.handle('soundit-media', async (request) => {
    try {
      const urlObj = new URL(request.url)
      const filePath = urlObj.searchParams.get('path')
      if (!filePath || !(await fs.pathExists(filePath))) {
        return new Response('Audio file not found', { status: 404 })
      }
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        return new Response('Not a file', { status: 400 })
      }
      const totalSize = stat.size
      const ext = path.extname(filePath).toLowerCase()
      const contentType = AUDIO_MIME_BY_EXT[ext] || 'application/octet-stream'
      const baseHeaders = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      }

      const rangeHeader = request.headers.get('range') || request.headers.get('Range')
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0
          const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1
          if (start >= totalSize || start > end) {
            return new Response(null, {
              status: 416,
              headers: { ...baseHeaders, 'Content-Range': `bytes */${totalSize}` },
            })
          }
          const chunkSize = end - start + 1
          const stream = fs.createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream), {
            status: 206,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': String(chunkSize),
            },
          })
        }
      }

      const stream = fs.createReadStream(filePath)
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(totalSize),
        },
      })
    } catch (err) {
      return new Response(`Media error: ${err.message}`, { status: 500 })
    }
  })
}

let mainWindow
let activeImportCancelled = false

function resolveBackendPath(relPath) {
  const prodPath = path.join(__dirname, 'backend', 'src', relPath)
  const devPath = path.join(__dirname, '..', 'backend', 'src', relPath)
  return fs.existsSync(prodPath) ? prodPath : devPath
}

const moduleCache = new Map()
function loadBackendModule(relPath) {
  if (!moduleCache.has(relPath)) {
    const finalPath = resolveBackendPath(relPath)
    moduleCache.set(
      relPath,
      import(pathToFileURL(finalPath).href).catch((err) => {
        console.warn(`Could not load ${relPath}:`, err.message)
        return null
      }),
    )
  }
  return moduleCache.get(relPath)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: isDev,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#00101D',
  })

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, 'frontend-dist/index.html')}`

  mainWindow.loadURL(startUrl)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  registerLocalMediaProtocol()

  // Ensure packaged file:// requests to sounditdj.cloud pass same-origin CORS checks
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://sounditdj.cloud/*', 'https://www.sounditdj.cloud/*', 'http://31.97.116.21/*'] },
    (details, callback) => {
      details.requestHeaders.Origin = 'https://sounditdj.cloud'
      details.requestHeaders.Referer = 'https://sounditdj.cloud/'
      callback({ requestHeaders: details.requestHeaders })
    },
  )

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, 'build/icon.png')
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath)
    }
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// ── File Dialogs & Basic FS ──────────────────────────────────────────────────

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'aiff', 'aif', 'alac'],
      },
    ],
  })
  return result.filePaths || []
})

ipcMain.handle('select-import-files', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    defaultPath: options.defaultPath || undefined,
    filters: options.filters || [
      { name: 'DJ Library & Playlist Files', extensions: ['crate', 'xml', 'nml', 'm3u', 'm3u8', 'csv', 'json', 'db', 'plist'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.filePaths || []
})

ipcMain.handle('select-directory', async (_event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || undefined,
  })
  return result.filePaths?.[0] || null
})

ipcMain.handle('save-file', async (_event, options) => {
  return dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath,
    filters: options.filters,
  })
})

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const data = await fs.readFile(filePath)
    return { success: true, data: data.toString('base64') }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (_event, filePath, data) => {
  try {
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, Buffer.from(data, 'base64'))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-path', async (_event, targetPath) => {
  if (!targetPath) return false
  try {
    const exists = await fs.pathExists(targetPath)
    if (!exists) return false
    const stats = await fs.stat(targetPath)
    if (stats.isDirectory()) {
      await shell.openPath(targetPath)
    } else {
      shell.showItemInFolder(targetPath)
    }
    return true
  } catch {
    return false
  }
})

// ── Library Discovery ────────────────────────────────────────────────────────

async function scanDirForExts(dirPath, extensions, maxDepth = 2, currentDepth = 0) {
  const results = []
  try {
    if (!(await fs.pathExists(dirPath))) return results
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
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
            fileName: item.name,
            path: fullPath,
            size: stats.size,
            lastModified: stats.mtimeMs,
          })
        }
      }
    }
  } catch (err) {
    console.warn(`Error scanning ${dirPath}:`, err.message)
  }
  return results
}

function countSeratoOtrk(buffer) {
  let count = 0
  let offset = 0
  while (offset + 8 <= buffer.length) {
    const tag = buffer.subarray(offset, offset + 4).toString('ascii')
    const len = buffer.readUInt32BE(offset + 4)
    if (tag === 'otrk') count += 1
    if (len < 0 || offset + 8 + len > buffer.length + 1) break
    offset += 8 + len
  }
  return count
}

function dedupeByPath(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = String(item.path || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function getDefaultPaths(source) {
  const home = os.homedir()
  const isWin = process.platform === 'win32'
  switch (source) {
    case 'serato':
      return {
        rootDir: path.join(home, 'Music', '_Serato_'),
        exportDir: path.join(home, 'Music', '_Serato_', 'Subcrates'),
      }
    case 'rekordbox':
    case 'rekordbox-xml':
      return {
        rootDir: isWin
          ? path.join(home, 'AppData', 'Roaming', 'Pioneer', 'rekordbox')
          : path.join(home, 'Library', 'Pioneer', 'rekordbox'),
        exportDir: path.join(home, 'Music', 'PioneerDJ'),
      }
    case 'traktor':
      return {
        rootDir: path.join(home, 'Documents', 'Native Instruments'),
        exportDir: path.join(home, 'Documents', 'Native Instruments'),
      }
    case 'virtualdj':
      return {
        rootDir: path.join(home, 'Documents', 'VirtualDJ'),
        exportDir: path.join(home, 'Documents', 'VirtualDJ'),
      }
    case 'engine-dj':
      return {
        rootDir: path.join(home, 'Music', 'Engine Library'),
        exportDir: path.join(home, 'Music', 'Engine Library'),
      }
    case 'djay-pro':
      return {
        rootDir: path.join(home, 'Music', 'djay'),
        exportDir: path.join(home, 'Music', 'djay'),
      }
    case 'itunes':
      return {
        rootDir: path.join(home, 'Music', 'iTunes'),
        exportDir: path.join(home, 'Music', 'iTunes'),
      }
    default:
      return {
        rootDir: path.join(home, 'Music'),
        exportDir: path.join(home, 'Music', 'SoundItDJ Exports'),
      }
  }
}

ipcMain.handle('get-default-paths', (_event, source) => getDefaultPaths(source))

ipcMain.handle('discover-libraries', async (_event, source, customDir = null) => {
  const home = os.homedir()
  const isWin = process.platform === 'win32'
  let results = []
  let meta = { source, detectedDir: null, hasDatabase: false }

  try {
    switch (source) {
      case 'serato': {
        const seratoDir = customDir || path.join(home, 'Music', '_Serato_')
        meta.detectedDir = seratoDir
        meta.hasDatabase = await fs.pathExists(path.join(seratoDir, 'database V2'))
        const found = []
        for (const sub of ['Subcrates', 'SubCrates', 'Crates']) {
          const subDir = path.join(seratoDir, sub)
          if (await fs.pathExists(subDir)) {
            found.push(...(await scanDirForExts(subDir, ['.crate'], 1)))
          }
        }
        // Also scan directly if user selected a custom crate folder
        if (customDir && !found.length) {
          found.push(...(await scanDirForExts(customDir, ['.crate'], 2)))
        }
        const unique = dedupeByPath(found)
        results = await Promise.all(
          unique.map(async (item) => {
            let trackCount = 0
            try {
              const buf = await fs.readFile(item.path)
              trackCount = countSeratoOtrk(buf)
            } catch {
              trackCount = 0
            }
            const parts = item.name.split('%%').map((p) => p.trim()).filter(Boolean)
            const displayName = parts[parts.length - 1] || item.name
            const folderPath = parts.length > 1 ? parts.slice(0, -1).join(' / ') : ''
            return {
              ...item,
              displayName,
              folderPath,
              trackCount,
            }
          }),
        )
        results.sort((a, b) => a.name.localeCompare(b.name))
        break
      }
      case 'rekordbox-xml':
      case 'rekordbox': {
        const dirs = customDir
          ? [customDir]
          : [
              path.join(home, 'Music', 'PioneerDJ'),
              isWin
                ? path.join(home, 'AppData', 'Roaming', 'Pioneer', 'rekordbox')
                : path.join(home, 'Library', 'Pioneer', 'rekordbox'),
              path.join(home, 'Documents'),
              path.join(home, 'Music'),
              path.join(home, 'Downloads'),
            ]
        meta.detectedDir = dirs[0]
        const found = []
        for (const dir of dirs) {
          const depth = dir === path.join(home, 'Documents') || dir === path.join(home, 'Downloads') ? 1 : 2
          found.push(...(await scanDirForExts(dir, ['.xml'], depth)))
        }
        const filtered = dedupeByPath(found).filter((item) => {
          if (customDir) return true
          const lower = item.path.toLowerCase()
          return lower.includes('rekordbox') || lower.includes('pioneer') || lower.includes('collection') || lower.includes('export')
        })
        results = filtered.map((item) => ({ ...item, displayName: item.name, folderPath: path.dirname(item.path) }))
        break
      }
      case 'traktor': {
        const traktorDir = customDir || path.join(home, 'Documents', 'Native Instruments')
        meta.detectedDir = traktorDir
        const found = await scanDirForExts(traktorDir, ['.nml'], 3)
        results = dedupeByPath(found).map((item) => ({
          ...item,
          displayName: item.name,
          folderPath: path.relative(traktorDir, path.dirname(item.path)) || 'Native Instruments',
        }))
        break
      }
      case 'virtualdj': {
        const vdjDir = customDir || path.join(home, 'Documents', 'VirtualDJ')
        meta.detectedDir = vdjDir
        const found = await scanDirForExts(vdjDir, ['.xml', '.m3u', '.m3u8'], 2)
        results = dedupeByPath(found).map((item) => ({
          ...item,
          displayName: item.name,
          folderPath: path.relative(vdjDir, path.dirname(item.path)) || 'VirtualDJ',
        }))
        break
      }
      case 'engine-dj': {
        const engineDir = customDir || path.join(home, 'Music', 'Engine Library')
        meta.detectedDir = engineDir
        const found = await scanDirForExts(engineDir, ['.db', '.m3u', '.m3u8', '.xml'], 3)
        results = dedupeByPath(found).map((item) => ({
          ...item,
          displayName: item.name,
          folderPath: path.relative(engineDir, path.dirname(item.path)) || 'Engine Library',
        }))
        break
      }
      case 'djay-pro': {
        const djayDir = customDir || path.join(home, 'Music', 'djay')
        meta.detectedDir = djayDir
        const found = await scanDirForExts(djayDir, ['.xml', '.m3u', '.m3u8', '.csv'], 3)
        results = dedupeByPath(found).map((item) => ({
          ...item,
          displayName: item.name,
          folderPath: path.relative(djayDir, path.dirname(item.path)) || 'djay',
        }))
        break
      }
      case 'itunes': {
        const dirs = customDir
          ? [customDir]
          : [
              path.join(home, 'Music', 'iTunes'),
              path.join(home, 'Music', 'Music'),
              path.join(home, 'Music'),
            ]
        meta.detectedDir = dirs[0]
        const found = []
        for (const dir of dirs) {
          found.push(...(await scanDirForExts(dir, ['.xml'], 2)))
        }
        results = dedupeByPath(found)
          .filter((item) => {
            if (customDir) return true
            const lower = item.name.toLowerCase()
            return lower.includes('itunes') || lower.includes('library') || lower.includes('music')
          })
          .map((item) => ({ ...item, displayName: item.name, folderPath: path.dirname(item.path) }))
        break
      }
      case 'djxml': {
        const dirs = customDir ? [customDir] : [path.join(home, 'Music'), path.join(home, 'Documents'), path.join(home, 'Downloads')]
        meta.detectedDir = dirs[0]
        const found = []
        for (const dir of dirs) {
          found.push(...(await scanDirForExts(dir, ['.xml'], 2)))
        }
        results = dedupeByPath(found).map((item) => ({ ...item, displayName: item.name, folderPath: path.dirname(item.path) }))
        break
      }
      case 'm3u':
      case 'ultramixer': {
        const dirs = customDir ? [customDir] : [path.join(home, 'Music'), path.join(home, 'Documents'), path.join(home, 'Downloads')]
        meta.detectedDir = dirs[0]
        const found = []
        for (const dir of dirs) {
          found.push(...(await scanDirForExts(dir, ['.m3u', '.m3u8'], 2)))
        }
        results = dedupeByPath(found).map((item) => ({ ...item, displayName: item.name, folderPath: path.dirname(item.path) }))
        break
      }
      case 'csv':
      case 'json': {
        const ext = '.' + source
        const dirs = customDir ? [customDir] : [path.join(home, 'Music'), path.join(home, 'Documents'), path.join(home, 'Downloads')]
        const found = []
        for (const dir of dirs) {
          found.push(...(await scanDirForExts(dir, [ext], 2)))
        }
        results = dedupeByPath(found).map((item) => ({ ...item, displayName: item.name, folderPath: path.dirname(item.path) }))
        break
      }
    }
  } catch (error) {
    console.error('Discover error:', error)
  }

  return { files: results, meta }
})

// ── Local DJ Import & Real-Time Analysis ─────────────────────────────────────

function sendProgress(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

ipcMain.handle('cancel-local-import', () => {
  activeImportCancelled = true
  return { cancelled: true }
})

ipcMain.handle('parse-and-analyze-local-import', async (_event, payload = {}) => {
  activeImportCancelled = false
  const { source, filePaths = [], folderPath = null, seratoDir = null, analyzeAudio = true } = payload
  const startedAt = Date.now()

  const logsDir = path.join(app.getPath('userData'), 'logs')
  await fs.ensureDir(logsDir)
  const logFile = path.join(logsDir, `import-${Date.now()}.log`)
  const logLines = []
  const writeLog = (line) => {
    const entry = `[${new Date().toISOString()}] ${line}`
    logLines.push(entry)
  }

  try {
    const formatsMod = await loadBackendModule('library/formats/index.js')
    const seratoMod = await loadBackendModule('library/formats/serato.js')
    const simpleMod = await loadBackendModule('library/formats/simple.js')

    if (!formatsMod) {
      throw new Error('Local library parser module could not be loaded.')
    }

    sendProgress('local-import-progress', {
      stage: 'parse',
      status: 'running',
      message: `Reading ${source} library files...`,
      analyzed: 0,
      total: 0,
      failed: 0,
      speed: 0,
      etaSeconds: null,
      recentTracks: [],
    })

    const combinedTracks = []
    const combinedPlaylists = []
    const combinedFolders = []
    const warnings = []
    const trackKeyMap = new Map()

    const addTrackDeduped = (track) => {
      const key = (track.path || `${track.artist || ''}-${track.title || ''}`).toLowerCase()
      if (trackKeyMap.has(key)) {
        return trackKeyMap.get(key)
      }
      const id = track.id || `local-${Date.now()}-${combinedTracks.length + 1}-${Math.random().toString(36).slice(2, 7)}`
      const normalized = {
        id,
        sourceId: track.sourceId || id,
        title: track.title || path.basename(track.path || 'Unknown', path.extname(track.path || '')),
        artist: track.artist || '',
        album: track.album || '',
        genre: track.genre || '',
        comment: track.comment || '',
        bpm: track.bpm ? Number(track.bpm) : null,
        key: track.key || '',
        duration: track.duration ? Number(track.duration) : 0,
        year: track.year || null,
        rating: track.rating || 0,
        path: track.path || '',
        filename: track.filename || (track.path ? path.basename(track.path) : ''),
        cues: track.cues || [],
        loops: track.loops || [],
        beatgrid: track.beatgrid || null,
        tags: track.tags || [],
        missing: Boolean(track.missing),
        created_at: new Date().toISOString(),
        source,
      }
      trackKeyMap.set(key, normalized)
      combinedTracks.push(normalized)
      return normalized
    }

    const mergeParsedLibrary = (lib) => {
      if (!lib) return
      const localIdMap = new Map()
      for (const t of lib.tracks || []) {
        const merged = addTrackDeduped(t)
        if (t.sourceId) localIdMap.set(String(t.sourceId), merged.id)
      }
      const folderIdMap = new Map()
      for (const pl of lib.playlists || []) {
        if (pl.isFolder) {
          const fid = `folder-${Date.now()}-${combinedFolders.length + 1}-${Math.random().toString(36).slice(2, 6)}`
          folderIdMap.set(String(pl.sourceId), fid)
          combinedFolders.push({
            id: fid,
            name: pl.name,
            parent_id: pl.parentId ? folderIdMap.get(String(pl.parentId)) || null : null,
          })
        }
      }
      // Second pass for parent_id links if folders appeared out of order
      for (const pl of lib.playlists || []) {
        if (!pl.isFolder) continue
        const fid = folderIdMap.get(String(pl.sourceId))
        const folderObj = combinedFolders.find((f) => f.id === fid)
        if (folderObj && pl.parentId && folderIdMap.has(String(pl.parentId))) {
          folderObj.parent_id = folderIdMap.get(String(pl.parentId))
        }
      }
      for (const pl of lib.playlists || []) {
        if (pl.isFolder) continue
        const pid = `pl-${Date.now()}-${combinedPlaylists.length + 1}-${Math.random().toString(36).slice(2, 6)}`
        const mappedTrackIds = (pl.trackIds || [])
          .map((tid) => localIdMap.get(String(tid)))
          .filter(Boolean)
        combinedPlaylists.push({
          id: pid,
          name: pl.name,
          folder_id: pl.parentId ? folderIdMap.get(String(pl.parentId)) || null : null,
          trackIds: mappedTrackIds,
          track_count: mappedTrackIds.length,
          source,
          created_at: new Date().toISOString(),
        })
      }
      if (Array.isArray(lib.warnings)) warnings.push(...lib.warnings)
    }

    if (source === 'serato' && seratoMod) {
      const rootDir = seratoDir || path.join(os.homedir(), 'Music', '_Serato_')
      writeLog(`Loading Serato library from ${rootDir} (${filePaths.length} crate(s) selected)`)
      const lib = await seratoMod.loadSeratoLibrary(rootDir, {
        cratePaths: filePaths.length ? filePaths : undefined,
        enrichTags: false,
      })
      mergeParsedLibrary(lib)
    } else if (source === 'tracks') {
      const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.aiff', '.aif', '.ogg', '.alac', '.opus'])
      if (folderPath) {
        writeLog(`Scanning audio folder: ${folderPath}`)
        const bySubdir = new Map()
        const walkAudio = async (dir) => {
          let entries = []
          try {
            entries = await fs.readdir(dir, { withFileTypes: true })
          } catch {
            return
          }
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              await walkAudio(full)
            } else if (entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
              const relDir = path.relative(folderPath, dir).replace(/\\/g, '/')
              if (!bySubdir.has(relDir)) bySubdir.set(relDir, [])
              bySubdir.get(relDir).push(full)
            }
          }
        }
        await walkAudio(folderPath)

        const rootName = path.basename(folderPath) || 'Imported Folder'
        const preserveSubs = payload.preserveSubfolders !== false && bySubdir.size > 1
        if (preserveSubs) {
          const rootFolderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          combinedFolders.push({ id: rootFolderId, name: rootName, parent_id: null })
          for (const [relDir, files] of bySubdir.entries()) {
            const trackIds = []
            for (const fp of files) {
              const t = addTrackDeduped({
                title: path.basename(fp, path.extname(fp)),
                path: fp,
                filename: path.basename(fp),
                missing: false,
              })
              trackIds.push(t.id)
            }
            const plName = relDir ? relDir.split('/').join(' / ') : rootName
            combinedPlaylists.push({
              id: `pl-${Date.now()}-${combinedPlaylists.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
              name: plName,
              folder_id: rootFolderId,
              trackIds,
              track_count: trackIds.length,
              source: 'tracks',
              created_at: new Date().toISOString(),
            })
          }
        } else {
          const allTrackIds = []
          for (const files of bySubdir.values()) {
            for (const fp of files) {
              const t = addTrackDeduped({
                title: path.basename(fp, path.extname(fp)),
                path: fp,
                filename: path.basename(fp),
                missing: false,
              })
              allTrackIds.push(t.id)
            }
          }
          if (allTrackIds.length) {
            combinedPlaylists.push({
              id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: rootName,
              folder_id: null,
              trackIds: allTrackIds,
              track_count: allTrackIds.length,
              source: 'tracks',
              created_at: new Date().toISOString(),
            })
          }
        }
      } else if (filePaths.length) {
        const trackIds = []
        for (const fp of filePaths) {
          const t = addTrackDeduped({
            title: path.basename(fp, path.extname(fp)),
            path: fp,
            filename: path.basename(fp),
            missing: false,
          })
          trackIds.push(t.id)
        }
        combinedPlaylists.push({
          id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Imported Tracks (${new Date().toLocaleDateString()})`,
          folder_id: null,
          trackIds,
          track_count: trackIds.length,
          source: 'tracks',
          created_at: new Date().toISOString(),
        })
      }
    } else {
      for (const fp of filePaths) {
        if (activeImportCancelled) break
        writeLog(`Parsing ${source} file: ${fp}`)
        try {
          const lib = await formatsMod.importLibraryPath(fp, { readMetadata: false, enrichTags: false })
          mergeParsedLibrary(lib)
        } catch (err) {
          warnings.push(`Failed to parse ${path.basename(fp)}: ${err.message}`)
          writeLog(`ERROR parsing ${fp}: ${err.message}`)
        }
      }
    }

    const total = combinedTracks.length
    writeLog(`Parsed ${total} unique track(s) across ${combinedPlaylists.length} playlist(s)`)

    sendProgress('local-import-progress', {
      stage: 'save',
      status: 'complete',
      message: `Saved ${total} tracks and ${combinedPlaylists.length} playlists`,
      analyzed: 0,
      total,
      failed: 0,
      speed: 0,
      etaSeconds: null,
      recentTracks: [],
    })

    // Analyze local audio metadata (BPM, Key, Duration, Artist, Album, Genre, Year)
    let analyzed = 0
    let failed = 0
    const recentTracks = []
    let musicMetadata = null
    if (analyzeAudio && total > 0) {
      try {
        musicMetadata = await import('music-metadata')
      } catch (err) {
        writeLog(`music-metadata unavailable: ${err.message}`)
      }
    }

    const analysisStart = Date.now()
    if (analyzeAudio && musicMetadata && total > 0) {
      const BATCH_SIZE = 12
      for (let i = 0; i < combinedTracks.length; i += BATCH_SIZE) {
        if (activeImportCancelled) {
          writeLog('Import cancelled by user during analysis.')
          break
        }
        const batch = combinedTracks.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async (track) => {
            if (!track.path) {
              analyzed += 1
              return
            }
            try {
              const exists = await fs.pathExists(track.path)
              track.missing = !exists
              if (!exists) {
                analyzed += 1
                return
              }
              // Read full ID3/native tags (including TKEY/TBPM/initialkey) + Serato GEOB beatgrid/cues
              const needsTags = !track.bpm || !track.duration || !track.artist || !track.key
              if (needsTags) {
                const parsed = await musicMetadata.parseFile(track.path, { skipCovers: true })
                const c = parsed.common || {}
                if (!track.title && c.title) track.title = c.title
                if (!track.artist && c.artist) track.artist = c.artist
                if (!track.album && c.album) track.album = c.album
                if (!track.genre && c.genre?.length) track.genre = c.genre[0]
                if (!track.year && c.year) track.year = c.year
                if (!track.duration && parsed.format?.duration) track.duration = Math.round(parsed.format.duration)

                // Extract BPM from common or native TBPM/BPM frames
                let rawBpm = c.bpm
                let rawKey = c.key
                if (parsed.native) {
                  for (const frames of Object.values(parsed.native)) {
                    if (!Array.isArray(frames)) continue
                    for (const frame of frames) {
                      const fid = String(frame.id || '').toUpperCase()
                      if (!rawBpm && (fid === 'TBPM' || fid === 'BPM' || fid === 'TMPO')) {
                        const n = parseFloat(String(frame.value || ''))
                        if (Number.isFinite(n) && n > 30 && n < 260) rawBpm = n
                      }
                      if (!rawKey && (fid === 'TKEY' || fid === 'INITIALKEY' || fid === 'KEY' || fid === 'TXXX:INITIALKEY' || fid === 'TXXX:KEY')) {
                        const v = typeof frame.value === 'string' ? frame.value.trim() : ''
                        if (v) rawKey = v
                      }
                    }
                  }
                }
                if (!track.bpm && rawBpm) track.bpm = Math.round(Number(rawBpm) * 10) / 10
                if (!track.key && rawKey) track.key = rawKey
              }

              // Read Serato embedded BeatGrid & Hot Cues/Loops if available (MP3/AIFF)
              if (seratoMod?.readSeratoPerformanceTags && (!track.bpm || !track.cues?.length)) {
                try {
                  const ext = path.extname(track.path).toLowerCase()
                  if (['.mp3', '.aiff', '.aif'].includes(ext)) {
                    const perf = await seratoMod.readSeratoPerformanceTags(track.path)
                    if (perf) {
                      if (perf.beatgrid?.bpm && !track.bpm) {
                        track.bpm = Math.round(Number(perf.beatgrid.bpm) * 10) / 10
                      }
                      if (perf.beatgrid) track.beatgrid = perf.beatgrid
                      if (perf.cues?.length && !track.cues?.length) track.cues = perf.cues
                      if (perf.loops?.length && !track.loops?.length) track.loops = perf.loops
                    }
                  }
                } catch {
                  // non-fatal
                }
              }
              analyzed += 1
              recentTracks.unshift(track.title || track.filename)
              if (recentTracks.length > 25) recentTracks.length = 25
            } catch (err) {
              failed += 1
              analyzed += 1
              writeLog(`Analysis failed for ${track.path}: ${err.message}`)
            }
          }),
        )

        const elapsedMin = Math.max((Date.now() - analysisStart) / 60000, 0.01)
        const speed = Math.round(analyzed / elapsedMin)
        const remaining = total - analyzed
        const etaSeconds = speed > 0 ? Math.round((remaining / speed) * 60) : null

        sendProgress('local-import-progress', {
          stage: 'analyze',
          status: 'running',
          analyzed,
          total,
          failed,
          speed,
          etaSeconds,
          recentTracks: [...recentTracks],
        })
      }
    }

    await fs.writeFile(logFile, logLines.join('\n'), 'utf8')

    sendProgress('local-import-progress', {
      stage: 'complete',
      status: activeImportCancelled ? 'cancelled' : 'complete',
      analyzed,
      total,
      failed,
      speed: 0,
      etaSeconds: 0,
      recentTracks: [...recentTracks],
      logFile,
    })

    return {
      success: !activeImportCancelled,
      cancelled: activeImportCancelled,
      tracks: combinedTracks,
      playlists: combinedPlaylists,
      folders: combinedFolders,
      warnings,
      stats: {
        tracks: combinedTracks.length,
        playlists: combinedPlaylists.length,
        folders: combinedFolders.length,
        analyzed,
        failed,
        durationMs: Date.now() - startedAt,
        logFile,
      },
    }
  } catch (error) {
    writeLog(`FATAL: ${error.message}`)
    await fs.writeFile(logFile, logLines.join('\n'), 'utf8').catch(() => {})
    sendProgress('local-import-progress', {
      stage: 'error',
      status: 'error',
      error: error.message,
      logFile,
    })
    return { success: false, error: error.message, logFile }
  }
})

// ── Local Library Persistence (Offline + Instant Load) ───────────────────────

function getLocalLibraryFile() {
  return path.join(app.getPath('userData'), 'sounditdj-library.json')
}

ipcMain.handle('load-local-library', async () => {
  try {
    const file = getLocalLibraryFile()
    if (!(await fs.pathExists(file))) {
      return { tracks: [], playlists: [], folders: [] }
    }
    const data = await fs.readJson(file)
    return {
      tracks: Array.isArray(data?.tracks) ? data.tracks : [],
      playlists: Array.isArray(data?.playlists) ? data.playlists : [],
      folders: Array.isArray(data?.folders) ? data.folders : [],
    }
  } catch (err) {
    console.warn('Failed to load local library:', err.message)
    return { tracks: [], playlists: [], folders: [] }
  }
})

ipcMain.handle('save-local-library', async (_event, data) => {
  try {
    const file = getLocalLibraryFile()
    await fs.ensureDir(path.dirname(file))
    await fs.writeJson(file, {
      tracks: data?.tracks || [],
      playlists: data?.playlists || [],
      folders: data?.folders || [],
      updatedAt: new Date().toISOString(),
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── Audio Folder Scanner & Missing Track Relocation ──────────────────────────

const SCAN_AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.aiff', '.aif', '.ogg', '.alac', '.opus'])

ipcMain.handle('scan-audio-folder', async (_event, folderPath) => {
  if (!folderPath || !(await fs.pathExists(folderPath))) {
    return { totalFiles: 0, subfolders: 0, sampleFiles: [] }
  }
  const subdirs = new Set()
  const sampleFiles = []
  let totalFiles = 0

  const walk = async (dir) => {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && SCAN_AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
        totalFiles += 1
        subdirs.add(path.relative(folderPath, dir))
        if (sampleFiles.length < 10) sampleFiles.push(entry.name)
      }
    }
  }
  await walk(folderPath)
  return { totalFiles, subfolders: subdirs.size, sampleFiles }
})

async function listSystemVolumeRoots() {
  const roots = []
  if (process.platform === 'darwin') {
    try {
      const names = await fs.readdir('/Volumes')
      for (const n of names) {
        if (!n || n.startsWith('.')) continue
        const full = path.join('/Volumes', n)
        try {
          const st = await fs.lstat(full)
          if (st.isDirectory() && !st.isSymbolicLink()) roots.push(full)
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  } else if (process.platform === 'win32') {
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      const d = `${letter}:\\`
      if (await fs.pathExists(d)) roots.push(d)
    }
  }
  return roots
}

ipcMain.handle('recheck-local-tracks', async (_event, tracks = []) => {
  const volumeRoots = await listSystemVolumeRoots()
  const updated = []
  let relinkedCount = 0
  let missingCount = 0

  for (const t of tracks) {
    if (!t?.path || t.path.startsWith('http') || t.path.startsWith('/uploads/')) {
      updated.push(t)
      continue
    }
    if (await fs.pathExists(t.path)) {
      updated.push({ ...t, missing: false })
      continue
    }
    // Try auto-resolving Serato/external-volume relative path across all mounted drives!
    const rel = String(t.path).replace(/^[\\/]+/, '')
    let foundPath = null
    for (const root of volumeRoots) {
      const candidate = path.join(root, rel)
      if (await fs.pathExists(candidate)) {
        foundPath = candidate
        break
      }
    }
    if (foundPath) {
      relinkedCount += 1
      updated.push({ ...t, path: foundPath, missing: false })
    } else {
      missingCount += 1
      updated.push({ ...t, missing: true })
    }
  }
  return { tracks: updated, relinkedCount, missingCount }
})

ipcMain.handle('relocate-missing-tracks', async (_event, { tracks = [], searchDir }) => {
  if (!searchDir || !(await fs.pathExists(searchDir))) {
    return { success: false, error: 'Selected search folder does not exist.' }
  }
  // Build fast lowercase filename -> fullPath index inside searchDir
  const fileIndex = new Map()
  const walk = async (dir) => {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && SCAN_AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
        const key = entry.name.toLowerCase()
        if (!fileIndex.has(key)) fileIndex.set(key, full)
      }
    }
  }
  await walk(searchDir)

  let relinkedCount = 0
  let stillMissingCount = 0
  const updated = []

  for (const t of tracks) {
    if (!t.missing && t.path && (await fs.pathExists(t.path))) {
      updated.push(t)
      continue
    }
    const base = path.basename(t.path || t.filename || '').toLowerCase()
    const match = base ? fileIndex.get(base) : null
    if (match) {
      relinkedCount += 1
      updated.push({ ...t, path: match, filename: path.basename(match), missing: false })
    } else {
      stillMissingCount += 1
      updated.push({ ...t, missing: true })
    }
  }

  return {
    success: true,
    tracks: updated,
    relinkedCount,
    stillMissingCount,
    indexedFiles: fileIndex.size,
  }
})

// ── Local Exports (DJ Software & USB Drives) ─────────────────────────────────

function sanitizeFileName(name) {
  return String(name || 'Playlist').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Playlist'
}

function buildPlaylistPathPrefix(playlist, foldersById) {
  const segments = []
  let current = playlist.folder_id || playlist.parentId
  let guard = 0
  while (current && foldersById.has(String(current)) && guard < 10) {
    const folder = foldersById.get(String(current))
    segments.unshift(folder.name)
    current = folder.parent_id || folder.parentId
    guard += 1
  }
  segments.push(playlist.name || 'Playlist')
  return segments.join('%%')
}

function normalizeLibraryForExport(payload) {
  const tracks = (payload.tracks || []).map((t) => ({
    ...t,
    sourceId: String(t.sourceId || t.id),
    id: String(t.id || t.sourceId),
    path: t.path || t.filePath || '',
    filename: t.filename || (t.path ? path.basename(t.path) : `${t.title || 'Track'}.mp3`),
    cues: t.cues || [],
    loops: t.loops || [],
    beatgrid: t.beatgrid || (t.bpm ? { bpm: Number(t.bpm), anchor: 0 } : null),
  }))

  const folders = (payload.folders || []).map((f) => ({
    sourceId: String(f.id),
    id: String(f.id),
    name: f.name,
    parentId: f.parent_id ? String(f.parent_id) : null,
    isFolder: true,
    trackIds: [],
    children: [],
  }))

  const playlists = (payload.playlists || []).map((p) => ({
    sourceId: String(p.id),
    id: String(p.id),
    name: p.name,
    parentId: p.folder_id ? String(p.folder_id) : null,
    folder_id: p.folder_id ? String(p.folder_id) : null,
    isFolder: false,
    trackIds: (p.trackIds || []).map(String),
    children: [],
  }))

  return {
    source: 'sounditdj',
    tracks,
    playlists: [...folders, ...playlists],
    rawFolders: payload.folders || [],
    rawPlaylists: playlists,
    warnings: [],
  }
}

function generateSimpleM3u(tracks) {
  const lines = ['#EXTM3U']
  for (const t of tracks) {
    lines.push(`#EXTINF:${Math.round(Number(t.duration || 0))},${t.artist || 'Unknown'} - ${t.title || t.filename || 'Track'}`)
    if (t.path) lines.push(t.path)
  }
  return `${lines.join('\n')}\n`
}

ipcMain.handle('export-local-software', async (_event, payload = {}) => {
  const { target, outputDir, options = {} } = payload
  const lib = normalizeLibraryForExport(payload)
  const targetDir = outputDir || getDefaultPaths(target).exportDir

  try {
    await fs.ensureDir(targetDir)
    sendProgress('local-export-progress', { stage: 'preparing', progress: 10, message: `Preparing ${target} export...` })

    let outputPath = targetDir
    let filesWritten = 0
    const warnings = []

    if (target === 'serato') {
      const seratoMod = await loadBackendModule('library/formats/serato.js')
      if (!seratoMod) throw new Error('Serato format exporter unavailable')
      const foldersById = new Map((lib.rawFolders || []).map((f) => [String(f.id), f]))
      const trackById = new Map(lib.tracks.map((t) => [String(t.id), t]))
      const playlistsToWrite = lib.rawPlaylists.length
        ? lib.rawPlaylists
        : [{ id: 'all', name: 'Sound It DJ Library', trackIds: lib.tracks.map((t) => t.id) }]

      for (let i = 0; i < playlistsToWrite.length; i += 1) {
        const pl = playlistsToWrite[i]
        const resolvedIds = Array.isArray(pl.trackIds) && pl.trackIds.length
          ? pl.trackIds
          : (playlistsToWrite.length === 1 ? lib.tracks.map((t) => t.id) : [])
        const paths = resolvedIds
          .map((id) => trackById.get(String(id))?.path)
          .filter(Boolean)
          .map((p) => (process.platform === 'darwin' ? p.replace(/^\/+/, '') : p))
        const crateName = options.preserveHierarchy !== false
          ? buildPlaylistPathPrefix(pl, foldersById)
          : pl.name
        const fileName = `${sanitizeFileName(crateName)}.crate`
        await fs.writeFile(path.join(targetDir, fileName), seratoMod.generateSeratoCrate(paths))
        filesWritten += 1
        sendProgress('local-export-progress', {
          stage: 'writing',
          progress: 15 + Math.round(((i + 1) / playlistsToWrite.length) * 75),
          message: `Wrote ${fileName} (${paths.length} tracks)`,
        })
      }

      if (options.writeSeratoTags) {
        for (const track of lib.tracks) {
          if (!track.path || !(await fs.pathExists(track.path))) continue
          try {
            await seratoMod.writeSeratoTags(track.path, track)
          } catch (err) {
            warnings.push(`Tag write skipped for ${track.filename}: ${err.message}`)
          }
        }
      }
      outputPath = targetDir
    } else if (target === 'rekordbox-xml' || target === 'rekordbox' || target === 'djxml') {
      const rbMod = await loadBackendModule('library/formats/rekordboxXml.js')
      if (!rbMod) throw new Error('Rekordbox XML exporter unavailable')
      const fileName = target === 'djxml' ? 'sounditdj-djxml.xml' : 'rekordbox.xml'
      outputPath = path.join(targetDir, fileName)
      await fs.writeFile(outputPath, rbMod.generateRekordboxXml(lib), 'utf8')
      filesWritten = 1
    } else if (target === 'traktor') {
      const simpleMod = await loadBackendModule('library/formats/simple.js')
      if (!simpleMod?.generateTraktorNml) throw new Error('Traktor NML exporter unavailable')
      outputPath = path.join(targetDir, 'collection.nml')
      await fs.writeFile(outputPath, simpleMod.generateTraktorNml(lib), 'utf8')
      filesWritten = 1
    } else if (target === 'virtualdj') {
      const vdjMod = await loadBackendModule('library/formats/virtualdj.js')
      if (!vdjMod) throw new Error('VirtualDJ exporter unavailable')
      outputPath = path.join(targetDir, 'database.xml')
      await fs.writeFile(outputPath, vdjMod.generateVirtualDjXml(lib), 'utf8')
      filesWritten = 1
    } else if (target === 'itunes') {
      const appleMod = await loadBackendModule('library/formats/appleMusic.js')
      if (!appleMod?.generateAppleMusicXml) throw new Error('Apple Music / iTunes exporter unavailable')
      outputPath = path.join(targetDir, 'iTunes Music Library.xml')
      await fs.writeFile(outputPath, appleMod.generateAppleMusicXml(lib), 'utf8')
      filesWritten = 1
    } else if (target === 'engine-dj' || target === 'djay-pro') {
      const trackById = new Map(lib.tracks.map((t) => [String(t.id), t]))
      const playlistsToWrite = lib.rawPlaylists.length
        ? lib.rawPlaylists
        : [{ id: 'all', name: 'Sound It DJ Library', trackIds: lib.tracks.map((t) => t.id) }]
      for (const pl of playlistsToWrite) {
        const plTracks = (pl.trackIds || []).map((id) => trackById.get(String(id))).filter(Boolean)
        const fileName = `${sanitizeFileName(pl.name)}.m3u8`
        await fs.writeFile(path.join(targetDir, fileName), generateSimpleM3u(plTracks), 'utf8')
        filesWritten += 1
      }
      // Also write a Rekordbox-compatible XML sidecar (Engine DJ & djay Pro both import it natively!)
      const rbMod = await loadBackendModule('library/formats/rekordboxXml.js')
      if (rbMod) {
        await fs.writeFile(path.join(targetDir, 'SoundItDJ-Library.xml'), rbMod.generateRekordboxXml(lib), 'utf8')
        filesWritten += 1
      }
      outputPath = targetDir
    } else if (target === 'track-tags') {
      const seratoMod = await loadBackendModule('library/formats/serato.js')
      if (!seratoMod) throw new Error('Track tag writer unavailable')
      for (let i = 0; i < lib.tracks.length; i += 1) {
        const track = lib.tracks[i]
        if (!track.path || !(await fs.pathExists(track.path))) continue
        try {
          const ok = await seratoMod.writeSeratoTags(track.path, track)
          if (ok) filesWritten += 1
        } catch (err) {
          warnings.push(`${track.filename}: ${err.message}`)
        }
        sendProgress('local-export-progress', {
          stage: 'writing',
          progress: 15 + Math.round(((i + 1) / Math.max(lib.tracks.length, 1)) * 80),
          message: `Writing tags: ${track.title || track.filename}`,
        })
      }
    } else {
      outputPath = path.join(targetDir, 'sounditdj-export.m3u8')
      await fs.writeFile(outputPath, generateSimpleM3u(lib.tracks), 'utf8')
      filesWritten = 1
    }

    sendProgress('local-export-progress', { stage: 'complete', progress: 100, message: 'Export complete!' })
    return {
      success: true,
      target,
      outputPath,
      filesWritten,
      trackCount: lib.tracks.length,
      playlistCount: lib.rawPlaylists.length,
      warnings,
    }
  } catch (error) {
    sendProgress('local-export-progress', { stage: 'error', progress: 0, error: error.message })
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-local-usb', async (_event, payload = {}) => {
  const { target = 'rekordbox-usb', mountPoint, options = {} } = payload
  if (!mountPoint) return { success: false, error: 'Please select a destination USB drive or folder.' }

  try {
    if (!(await fs.pathExists(mountPoint))) {
      return { success: false, error: `Destination path does not exist: ${mountPoint}` }
    }

    // Verify destination is writable (catches macOS read-only NTFS drives immediately)
    try {
      await fs.access(mountPoint, fs.constants.W_OK)
    } catch {
      return {
        success: false,
        error: `Destination "${mountPoint}" is read-only (for example, an NTFS drive on macOS). Format as FAT32/exFAT or choose another writable drive/folder.`,
      }
    }

    const usbMod = await loadBackendModule('library/pioneer/usbExport.js')
    if (!usbMod) throw new Error('USB export engine could not be loaded.')

    const lib = normalizeLibraryForExport(payload)
    if (!lib.tracks.length) {
      return { success: false, error: 'No tracks selected for export.' }
    }

    const profileMap = {
      'rekordbox-usb': 'rekordbox-usb',
      'engine-dj-usb': 'generic-usb',
      'engine-dj': 'generic-usb',
      'virtualdj-usb': 'generic-usb',
      virtualdj: 'generic-usb',
      serato: 'generic-usb',
      traktor: 'generic-usb',
      'generic-usb': 'generic-usb',
      'standard-usb': 'generic-usb',
    }
    const profile = profileMap[target] || 'rekordbox-usb'

    const folderMap = {
      'artist-album': 'artist-album-title',
      'artist-album-title': 'artist-album-title',
      playlist: 'artist-title',
      'artist-title': 'artist-title',
      flat: 'flat',
      title: 'title',
    }
    const resolvedStructure = folderMap[options.folderStructure] || 'artist-album-title'

    sendProgress('local-export-progress', {
      stage: 'planning',
      progress: 5,
      message: `Planning ${target} export to ${mountPoint}...`,
    })

    const report = await usbMod.exportLibraryToUsb(lib, mountPoint, {
      profile,
      folderStructure: resolvedStructure,
      duplicatePolicy: options.duplicatePolicy || 'skip',
      backup: Boolean(options.backup),
      onProgress: (event) => {
        const pct = event.phase === 'copy' && event.total
          ? 10 + Math.round(((event.index + 1) / event.total) * 65)
          : event.phase === 'analysis'
            ? 80
            : event.phase === 'database'
              ? 92
              : 15
        sendProgress('local-export-progress', {
          stage: event.phase,
          progress: Math.min(98, pct),
          currentFile: event.entry?.title || event.file || '',
          completed: (event.index || 0) + (event.phase === 'copy' ? 1 : 0),
          total: event.total || lib.tracks.length,
          message: event.phase === 'copy'
            ? `Copying ${(event.index || 0) + 1}/${event.total || lib.tracks.length}: ${event.entry?.title || ''}`
            : event.phase === 'analysis'
              ? 'Generating Pioneer ANLZ waveform & beatgrid files...'
              : 'Writing DJ hardware database...',
        })
      },
    })

    // Build USB-rewritten library (with paths pointing to copied audio files on USB!)
    const copiedMap = new Map()
    for (const entry of report.tracks || []) {
      if (entry.destination && (entry.status === 'copied' || entry.status === 'exported')) {
        copiedMap.set(String(entry.id), entry.destination)
      }
    }
    const usbLib = {
      ...lib,
      tracks: lib.tracks
        .filter((t) => copiedMap.has(String(t.id)))
        .map((t) => ({ ...t, path: copiedMap.get(String(t.id)) })),
    }

    // Write target-specific USB database / crates / playlists onto the USB drive
    let extraFiles = 0
    if (usbLib.tracks.length > 0) {
      if (target === 'virtualdj-usb' || target === 'virtualdj') {
        const vdjMod = await loadBackendModule('library/formats/virtualdj.js')
        if (vdjMod) {
          const vdjDir = path.join(mountPoint, 'VirtualDJ')
          await fs.ensureDir(vdjDir)
          await fs.writeFile(path.join(vdjDir, 'database.xml'), vdjMod.generateVirtualDjXml(usbLib), 'utf8')
          extraFiles += 1
        }
      } else if (target === 'engine-dj-usb' || target === 'engine-dj') {
        const rbMod = await loadBackendModule('library/formats/rekordboxXml.js')
        const engineDir = path.join(mountPoint, 'Engine Library')
        await fs.ensureDir(engineDir)
        if (rbMod) {
          await fs.writeFile(path.join(engineDir, 'SoundItDJ-Engine.xml'), rbMod.generateRekordboxXml(usbLib), 'utf8')
          extraFiles += 1
        }
        await fs.writeFile(path.join(engineDir, 'SoundItDJ-Playlist.m3u8'), generateSimpleM3u(usbLib.tracks), 'utf8')
        extraFiles += 1
      } else if (target === 'serato') {
        const seratoMod = await loadBackendModule('library/formats/serato.js')
        if (seratoMod) {
          const cratesDir = path.join(mountPoint, '_Serato_', 'Subcrates')
          await fs.ensureDir(cratesDir)
          const relPaths = usbLib.tracks.map((t) => path.relative(mountPoint, t.path).replace(/\\/g, '/'))
          await fs.writeFile(path.join(cratesDir, 'Sound It DJ Export.crate'), seratoMod.generateSeratoCrate(relPaths))
          extraFiles += 1
        }
      } else if (target === 'traktor') {
        const simpleMod = await loadBackendModule('library/formats/simple.js')
        if (simpleMod?.generateTraktorNml) {
          const trDir = path.join(mountPoint, 'Traktor')
          await fs.ensureDir(trDir)
          await fs.writeFile(path.join(trDir, 'collection.nml'), simpleMod.generateTraktorNml(usbLib), 'utf8')
          extraFiles += 1
        }
      }
    }

    const copiedCount = report?.counts?.copied || 0
    const missingCount = (report?.tracks || []).filter((t) => t.status === 'missing').length
    const firstErr = report?.errors?.[0]?.error || report?.errors?.[0]?.message || null

    if (!report?.ok || (copiedCount === 0 && lib.tracks.length > 0)) {
      const errMsg = firstErr
        || (missingCount > 0
          ? `0 of ${lib.tracks.length} tracks could be exported because ${missingCount} source audio file(s) were not found on disk. Make sure the original audio files exist on your Mac or external drive.`
          : `0 of ${lib.tracks.length} tracks were copied to ${mountPoint}.`)
      sendProgress('local-export-progress', { stage: 'error', progress: 0, error: errMsg })
      return {
        success: false,
        error: errMsg,
        report,
        outputPath: mountPoint,
      }
    }

    sendProgress('local-export-progress', {
      stage: 'complete',
      progress: 100,
      message: `Exported ${copiedCount} track(s) to ${mountPoint}!`,
    })

    return {
      success: true,
      report,
      filesWritten: copiedCount + extraFiles,
      outputPath: mountPoint,
      warnings: report.warnings || [],
    }
  } catch (error) {
    sendProgress('local-export-progress', { stage: 'error', progress: 0, error: error.message })
    return { success: false, error: error.message }
  }
})

// ── USB Device Detection & Browsing ──────────────────────────────────────────

async function getDevicesModule() {
  const mod = await loadBackendModule('library/devices.js')
  return mod || {
    listDevices: async () => [],
    browseDevice: async () => [],
    browseDeviceTracks: async () => [],
    inspectDeviceLibrary: async () => ({ detected: [], markers: [] }),
    ejectDevice: async () => ({ ejected: true }),
    startDeviceWatcher: () => () => {},
  }
}

ipcMain.handle('get-usb-devices', async () => {
  try {
    const { listDevices } = await getDevicesModule()
    return await listDevices()
  } catch (error) {
    console.error('USB enumeration failed:', error)
    return []
  }
})

ipcMain.handle('browse-usb-device', async (_event, mountPoint, relativePath = '') => {
  const { browseDevice } = await getDevicesModule()
  return browseDevice(mountPoint, relativePath)
})

ipcMain.handle('browse-usb-device-tracks', async (_event, mountPoint) => {
  const { browseDeviceTracks } = await getDevicesModule()
  return browseDeviceTracks(mountPoint)
})

ipcMain.handle('inspect-usb-device', async (_event, mountPoint) => {
  const { inspectDeviceLibrary } = await getDevicesModule()
  return inspectDeviceLibrary(mountPoint)
})

ipcMain.handle('eject-usb-device', async (_event, identifier) => {
  const { ejectDevice } = await getDevicesModule()
  return ejectDevice(identifier)
})

let stopDeviceWatcher = null
app.whenReady().then(async () => {
  try {
    const { startDeviceWatcher } = await getDevicesModule()
    stopDeviceWatcher = startDeviceWatcher((devices, error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-devices-changed', {
          devices,
          error: error ? error.message : null,
        })
      }
    })
  } catch (error) {
    console.error('USB watcher failed to start:', error)
  }
})

app.on('before-quit', () => {
  if (stopDeviceWatcher) stopDeviceWatcher()
})

// ── System Folders & App Info ────────────────────────────────────────────────

ipcMain.handle('open-folder', (_event, folderType) => {
  let targetPath = app.getPath('userData')
  switch (folderType) {
    case 'logs':
      targetPath = path.join(app.getPath('userData'), 'logs')
      break
    case 'downloads':
      targetPath = path.join(app.getPath('downloads'), 'SoundItDJ')
      break
    case 'backups':
      targetPath = path.join(app.getPath('userData'), 'backups')
      break
    case 'appdata':
    default:
      targetPath = app.getPath('userData')
      break
  }
  fs.ensureDirSync(targetPath)
  shell.openPath(targetPath)
  return targetPath
})

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)

ipcMain.on('drag-start', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: path.join(__dirname, 'build/icon.png'),
  })
})
