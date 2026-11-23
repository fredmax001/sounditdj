import express from 'express'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import sqlite3 from 'sqlite3'
import { v4 as uuidv4 } from 'uuid'

import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import libraryRoutes from './routes/library.js'
import playlistRoutes from './routes/playlist.js'
import analyzeRoutes from './routes/analyze.js'
import convertRoutes from './routes/convert.js'
import visualizeRoutes from './routes/visualize.js'
import usbRoutes from './routes/usb.js'
import exportRoutes from './routes/export.js'
import importRoutes from './routes/import.js'
import integrationRoutes from './routes/integration.js'
import settingsRoutes from './routes/settings.js'
import agentRoutes from './routes/agent.js'
import mixesRoutes from './routes/mixes.js'
import transferRoutes from './routes/transfer.js'
import mediaRoutes from './routes/media.js'
import { ensureMigrationSchema } from './library/db.js'

import { authenticateToken } from './security/auth.js'
import { enforceHttps, secureHeaders } from './security/hardening.js'
import { addRequestContext, getLogPaths, requestLogger } from './security/logging.js'
import {
  authRateLimiter,
  getRateLimitStatus,
  globalRateLimiter,
  integrationRateLimiter,
  uploadRateLimiter,
} from './security/rateLimit.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env')

try {
  process.loadEnvFile(envPath)
} catch (error) {
  if (error?.code !== 'ENOENT') {
    console.warn(`Failed to load environment file at ${envPath}:`, error.message)
  }
}

const app = express()
const PORT = process.env.PORT || 3001

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'ricks-dj-secret-key')) {
  throw new Error('JWT_SECRET must be set to a strong value in production')
}

app.disable('x-powered-by')
app.set('trust proxy', 1)

function normalizeOrigin(origin = '') {
  return String(origin || '').trim().replace(/\/+$/, '')
}

function getSameOriginFromRequest(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
  if (!forwardedHost) {
    return null
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim()
  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
}

const configuredCorsOrigins = (
  process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://sounditmuzik.com',
      'https://www.sounditmuzik.com',
    ]
)
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean)

app.use(
  cors((req, callback) => {
    const requestOrigin = normalizeOrigin(req.headers.origin)
    const sameOrigin = getSameOriginFromRequest(req)
    const isAllowed = !requestOrigin
      || configuredCorsOrigins.includes(requestOrigin)
      || (sameOrigin && requestOrigin === sameOrigin)

    callback(isAllowed ? null : new Error('CORS origin denied'), {
      origin: isAllowed,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  })
)

app.use(addRequestContext)
app.use(secureHeaders)
app.use(enforceHttps)
app.use(requestLogger)

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }))
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }))

const uploadsDir = path.join(__dirname, '../uploads')
const tempDir = path.join(__dirname, '../temp')
fs.ensureDirSync(uploadsDir)
fs.ensureDirSync(tempDir)

app.use('/uploads', express.static(uploadsDir))

const dbPath = path.join(__dirname, '../database/ricks.db')
fs.ensureDirSync(path.dirname(dbPath))

const db = new sqlite3.Database(dbPath)

const dbWrapper = {
  prepare(sql) {
    return {
      get(...params) {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) reject(err)
            else resolve(row)
          })
        })
      },
      run(...params) {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function onRun(err) {
            if (err) reject(err)
            else resolve({ lastID: this.lastID, changes: this.changes })
          })
        })
      },
      all(...params) {
        return new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
          })
        })
      },
    }
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  },
}

async function getTableColumns(tableName) {
  const rows = await dbWrapper.prepare(`PRAGMA table_info(${tableName})`).all()
  return rows.map((row) => row.name)
}

async function ensureColumn(tableName, columnName, definition) {
  const columns = await getTableColumns(tableName)
  if (!columns.includes(columnName)) {
    await dbWrapper.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

async function ensureDefaultAdmin() {
  const existingAdmin = await dbWrapper.prepare('SELECT id FROM admin_users LIMIT 1').get()
  if (existingAdmin) {
    return
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const defaultEmail = process.env.ADMIN_EMAIL || (isProduction ? null : 'admin@sounditdj.com')
  const defaultPassword = process.env.ADMIN_PASSWORD || (isProduction ? null : 'Admin12345!')
  const defaultName = process.env.ADMIN_NAME || 'Sound It DJ Super Admin'
  const defaultRole = process.env.ADMIN_ROLE || 'super_admin'
  const defaultTotpSecret = process.env.ADMIN_TOTP_SECRET || (isProduction ? null : '3132333435363738393031323334353637383930')

  if (!defaultEmail || !defaultPassword || !defaultTotpSecret) {
    console.warn('No admin seed credentials found. Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_TOTP_SECRET to create one.')
    return
  }

  const hashedPassword = await bcrypt.hash(defaultPassword, 12)

  await dbWrapper
    .prepare(
      `INSERT INTO admin_users (id, email, password, name, role, account_status, two_factor_secret)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(uuidv4(), defaultEmail.toLowerCase(), hashedPassword, defaultName, defaultRole, defaultTotpSecret)

  console.log(`Seeded default admin account for ${defaultEmail}`)
}

async function ensureDefaultAdminSettings() {
  const existingSettings = await dbWrapper.prepare('SELECT id FROM admin_system_settings LIMIT 1').get()
  if (existingSettings) {
    return
  }

  const defaultSettings = {
    security: {
      requireAdmin2fa: true,
      ipMonitoring: true,
      sessionTimeoutMinutes: 30,
    },
    platform: {
      registrationsOpen: true,
      maintenanceMode: false,
      releaseChannel: 'stable',
    },
    api: {
      publicApiEnabled: true,
      webhookDelivery: true,
      requestsPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 100),
    },
    support: {
      priorityQueue: true,
      incidentMode: false,
      slaTargetMinutes: 45,
    },
  }

  await dbWrapper
    .prepare(
      `INSERT INTO admin_system_settings (id, settings, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`
    )
    .run(uuidv4(), JSON.stringify(defaultSettings))
}

async function initDatabase() {
  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      dj_name TEXT,
      bio TEXT,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      bpm REAL,
      key TEXT,
      duration REAL,
      artwork TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT,
      track_id TEXT,
      position INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS cue_points (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT,
      position REAL NOT NULL,
      color TEXT DEFAULT '#EDC61E',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS playlist_folders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      parent_id TEXT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES playlist_folders(id) ON DELETE CASCADE
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      bpm REAL,
      key TEXT,
      duration REAL,
      tracklist TEXT,
      segments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS usb_exports (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      playlist_id TEXT,
      device_name TEXT,
      export_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (playlist_id) REFERENCES playlists(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS visual_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      settings TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      settings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS dj_mixes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      duration REAL,
      artwork TEXT,
      genre TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await ensureColumn('users', 'country', 'TEXT')
  await ensureColumn('users', 'account_status', "TEXT DEFAULT 'active'")
  await ensureColumn('users', 'is_verified', 'INTEGER DEFAULT 0')
  await ensureColumn('users', 'verified_at', 'DATETIME')
  await ensureColumn('users', 'last_login_ip', 'TEXT')
  await ensureColumn('users', 'last_login_at', 'DATETIME')
  await ensureColumn('users', 'suspended_at', 'DATETIME')
  await ensureColumn('users', 'suspended_reason', 'TEXT')

  // Mixo-style track columns
  await ensureColumn('tracks', 'tags', 'TEXT')
  await ensureColumn('tracks', 'genre', 'TEXT')
  await ensureColumn('tracks', 'rating', 'INTEGER DEFAULT 0')

  // Mixo-style playlist folders
  await ensureColumn('playlists', 'folder_id', 'TEXT')

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      account_status TEXT DEFAULT 'active',
      two_factor_secret TEXT NOT NULL,
      last_login_at DATETIME,
      last_login_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS admin_system_settings (
      id TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id)')
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id)')
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis_results(user_id)')
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)')
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)')

  await ensureDefaultAdmin()
  await ensureDefaultAdminSettings()

  console.log('Database initialized successfully')
}

app.locals.db = dbWrapper
app.locals.runtime = {
  dbPath,
  uploadsDir,
  tempDir,
  startedAt: Date.now(),
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rateLimit: getRateLimitStatus(),
  })
})

app.use('/api', globalRateLimiter)
app.use('/api/auth', authRateLimiter, authRoutes)
app.use('/api/admin', adminRoutes)

// All non-auth API routes require JWT auth.
app.use('/api/library', authenticateToken, uploadRateLimiter, libraryRoutes)
app.use('/api/playlist', authenticateToken, playlistRoutes)
app.use('/api/analyze', authenticateToken, uploadRateLimiter, analyzeRoutes)
app.use('/api/convert', authenticateToken, uploadRateLimiter, convertRoutes)
app.use('/api/visualize', authenticateToken, uploadRateLimiter, visualizeRoutes)
app.use('/api/usb', authenticateToken, usbRoutes)
app.use('/api/export', authenticateToken, exportRoutes)
app.use('/api/import', authenticateToken, uploadRateLimiter, importRoutes)
app.use('/api/integration', authenticateToken, integrationRateLimiter, integrationRoutes)
app.use('/api/settings', authenticateToken, settingsRoutes)
app.use('/api/agent', authenticateToken, agentRoutes)
app.use('/api/mixes', authenticateToken, uploadRateLimiter, mixesRoutes)
app.use('/api/transfer', authenticateToken, transferRoutes)
app.use('/api/media', authenticateToken, mediaRoutes)

app.use((err, req, res, next) => {
  console.error('Error:', err)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    requestId: req.requestId,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
})

const candidateDistPaths = [
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../frontend/dist'),
]

const distPath = candidateDistPaths.find((candidatePath) => fs.existsSync(candidatePath))

if (distPath) {
  app.use(express.static(distPath))

  app.get('/', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
      res.sendFile(path.join(distPath, 'index.html'))
      return
    }
    res.status(404).json({ error: 'Endpoint not found', path: req.path })
  })
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path })
  })
}

initDatabase()
  .then(async () => {
    await ensureMigrationSchema(dbWrapper)
    const logPaths = getLogPaths()
    app.listen(PORT, () => {
      console.log(`RICKS DJ Backend running on port ${PORT}`)
      console.log(`Uploads directory: ${uploadsDir}`)
      console.log(`Database: ${dbPath}`)
      console.log(`Security log: ${logPaths.securityLogPath}`)
      console.log(`Audit log: ${logPaths.auditLogPath}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })

export default app
