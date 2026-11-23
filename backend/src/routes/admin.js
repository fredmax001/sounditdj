import crypto from 'crypto'
import os from 'os'

import bcrypt from 'bcryptjs'
import express from 'express'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'

import { issueAccessToken } from '../security/auth.js'
import {
  ADMIN_ROLE_LABELS,
  getAdminPermissions,
  requireAdminAuth,
  requireAdminPermission,
} from '../security/admin.js'
import { getLogPaths, logSecurityEvent } from '../security/logging.js'
import { authRateLimiter, getRateLimitStatus } from '../security/rateLimit.js'
import {
  ValidationError,
  assertEmail,
  assertOptionalString,
  assertString,
  assertUUID,
  sendValidationError,
} from '../security/validation.js'

const router = express.Router()

const pendingAdminChallenges = new Map()
const CHALLENGE_TTL_MS = 5 * 60 * 1000
const DEVELOPMENT_TOTP_SECRET = '3132333435363738393031323334353637383930'

const DEFAULT_SYSTEM_SETTINGS = {
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
    requestsPerMinute: 100,
  },
  support: {
    priorityQueue: true,
    incidentMode: false,
    slaTargetMinutes: 45,
  },
}

const API_GROUPS = [
  { key: 'auth', prefix: '/api/auth', label: 'Authentication API' },
  { key: 'library', prefix: '/api/library', label: 'Library API' },
  { key: 'analysis', prefix: '/api/analyze', label: 'Analyzer API' },
  { key: 'integration', prefix: '/api/integration', label: 'Integration API' },
  { key: 'settings', prefix: '/api/settings', label: 'Settings API' },
  { key: 'admin', prefix: '/api/admin', label: 'Admin API' },
]

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function cleanupExpiredChallenges() {
  const now = Date.now()
  for (const [challengeToken, challenge] of pendingAdminChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      pendingAdminChallenges.delete(challengeToken)
    }
  }
}

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS))
}

function hotp(secretHex, counter) {
  const normalizedSecret = String(secretHex || '').trim() || DEVELOPMENT_TOTP_SECRET
  const key = Buffer.from(normalizedSecret, 'hex')
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = crypto.createHmac('sha1', key).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binaryCode = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  )

  return String(binaryCode % 1_000_000).padStart(6, '0')
}

function generateTotpCode(secretHex, stepOffset = 0) {
  const counter = Math.floor(Date.now() / 30000) + stepOffset
  return hotp(secretHex, counter)
}

function verifyTotpCode(secretHex, submittedCode) {
  const sanitizedCode = String(submittedCode || '').replace(/\D/g, '')
  if (sanitizedCode.length !== 6) {
    return false
  }

  for (let offset = -1; offset <= 1; offset += 1) {
    if (generateTotpCode(secretHex, offset) === sanitizedCode) {
      return true
    }
  }

  return false
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** unitIndex)
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

async function getDirectorySize(targetPath) {
  const exists = await fs.pathExists(targetPath)
  if (!exists) {
    return 0
  }

  const stats = await fs.stat(targetPath)
  if (stats.isFile()) {
    return stats.size
  }

  if (!stats.isDirectory()) {
    return 0
  }

  const entries = await fs.readdir(targetPath)
  const sizes = await Promise.all(entries.map((entry) => getDirectorySize(`${targetPath}/${entry}`)))
  return sizes.reduce((total, size) => total + size, 0)
}

async function readJsonLines(filePath) {
  const exists = await fs.pathExists(filePath)
  if (!exists) {
    return []
  }

  const fileContents = await fs.readFile(filePath, 'utf8')
  return fileContents
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function getLastSevenDays() {
  const days = []
  const now = new Date()
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - index)
    days.push(date.toISOString().slice(0, 10))
  }
  return days
}

function getLastTwentyFourHours() {
  const buckets = []
  const now = new Date()
  now.setUTCMinutes(0, 0, 0)
  for (let index = 23; index >= 0; index -= 1) {
    const date = new Date(now)
    date.setUTCHours(now.getUTCHours() - index)
    buckets.push(date.toISOString().slice(11, 16))
  }
  return buckets
}

function summarizeByDay(rows, field) {
  const base = Object.fromEntries(getLastSevenDays().map((day) => [day, 0]))
  for (const row of rows) {
    if (row?.bucket && row.bucket in base) {
      base[row.bucket] = Number(row[field] || 0)
    }
  }
  return getLastSevenDays().map((day) => ({
    label: day.slice(5),
    value: base[day],
  }))
}

function summarizeTrafficByDay(auditEntries) {
  const base = Object.fromEntries(getLastSevenDays().map((day) => [day, 0]))
  for (const entry of auditEntries) {
    const bucket = String(entry.timestamp || '').slice(0, 10)
    if (bucket in base) {
      base[bucket] += 1
    }
  }
  return getLastSevenDays().map((day) => ({
    label: day.slice(5),
    requests: base[day],
  }))
}

function summarizeSystemLoad(auditEntries) {
  const buckets = Object.fromEntries(
    getLastTwentyFourHours().map((hour) => [hour, { requests: 0, durationTotal: 0, errors: 0 }])
  )

  for (const entry of auditEntries) {
    const hour = String(entry.timestamp || '').slice(11, 16)
    const bucket = buckets[hour]
    if (!bucket) continue
    bucket.requests += 1
    bucket.durationTotal += Number(entry.durationMs || 0)
    if (Number(entry.statusCode || 0) >= 500) {
      bucket.errors += 1
    }
  }

  return getLastTwentyFourHours().map((hour) => {
    const bucket = buckets[hour]
    return {
      hour,
      requests: bucket.requests,
      latency: bucket.requests ? Math.round(bucket.durationTotal / bucket.requests) : 0,
      errors: bucket.errors,
    }
  })
}

function buildTopEndpoints(auditEntries) {
  const counts = new Map()
  for (const entry of auditEntries) {
    const path = String(entry.path || '')
    const normalized = path.split('?')[0].split('/').slice(0, 4).join('/') || path
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([path, requests]) => ({ path, requests }))
}

function buildApiHealth(auditEntries) {
  return API_GROUPS.map((group) => {
    const records = auditEntries.filter((entry) => String(entry.path || '').startsWith(group.prefix))
    const errors = records.filter((entry) => Number(entry.statusCode || 0) >= 500).length
    const avgDuration = records.length
      ? Math.round(records.reduce((total, entry) => total + Number(entry.durationMs || 0), 0) / records.length)
      : 0

    const latestStatus = records.length ? Number(records[records.length - 1].statusCode || 0) : 0
    const status = !records.length
      ? 'idle'
      : latestStatus >= 500
        ? 'degraded'
        : 'online'

    return {
      key: group.key,
      label: group.label,
      route: group.prefix,
      status,
      requests: records.length,
      errorRate: records.length ? Math.round((errors / records.length) * 100) : 0,
      avgDuration,
      lastStatusCode: latestStatus || null,
    }
  })
}

function normalizeSystemSettings(payload = {}, currentSettings = cloneDefaultSettings()) {
  const nextSettings = cloneDefaultSettings()

  nextSettings.security.requireAdmin2fa = typeof payload?.security?.requireAdmin2fa === 'boolean'
    ? payload.security.requireAdmin2fa
    : currentSettings.security.requireAdmin2fa
  nextSettings.security.ipMonitoring = typeof payload?.security?.ipMonitoring === 'boolean'
    ? payload.security.ipMonitoring
    : currentSettings.security.ipMonitoring
  nextSettings.security.sessionTimeoutMinutes = Number.isFinite(Number(payload?.security?.sessionTimeoutMinutes))
    ? Math.min(Math.max(Number(payload.security.sessionTimeoutMinutes), 5), 240)
    : currentSettings.security.sessionTimeoutMinutes

  nextSettings.platform.registrationsOpen = typeof payload?.platform?.registrationsOpen === 'boolean'
    ? payload.platform.registrationsOpen
    : currentSettings.platform.registrationsOpen
  nextSettings.platform.maintenanceMode = typeof payload?.platform?.maintenanceMode === 'boolean'
    ? payload.platform.maintenanceMode
    : currentSettings.platform.maintenanceMode
  nextSettings.platform.releaseChannel = ['stable', 'canary'].includes(payload?.platform?.releaseChannel)
    ? payload.platform.releaseChannel
    : currentSettings.platform.releaseChannel

  nextSettings.api.publicApiEnabled = typeof payload?.api?.publicApiEnabled === 'boolean'
    ? payload.api.publicApiEnabled
    : currentSettings.api.publicApiEnabled
  nextSettings.api.webhookDelivery = typeof payload?.api?.webhookDelivery === 'boolean'
    ? payload.api.webhookDelivery
    : currentSettings.api.webhookDelivery
  nextSettings.api.requestsPerMinute = Number.isFinite(Number(payload?.api?.requestsPerMinute))
    ? Math.min(Math.max(Number(payload.api.requestsPerMinute), 20), 1000)
    : currentSettings.api.requestsPerMinute

  nextSettings.support.priorityQueue = typeof payload?.support?.priorityQueue === 'boolean'
    ? payload.support.priorityQueue
    : currentSettings.support.priorityQueue
  nextSettings.support.incidentMode = typeof payload?.support?.incidentMode === 'boolean'
    ? payload.support.incidentMode
    : currentSettings.support.incidentMode
  nextSettings.support.slaTargetMinutes = Number.isFinite(Number(payload?.support?.slaTargetMinutes))
    ? Math.min(Math.max(Number(payload.support.slaTargetMinutes), 5), 240)
    : currentSettings.support.slaTargetMinutes

  return nextSettings
}

async function ensureSystemSettings(db) {
  const existing = await db.prepare('SELECT id, settings FROM admin_system_settings LIMIT 1').get()
  if (existing) {
    try {
      return {
        id: existing.id,
        settings: normalizeSystemSettings(JSON.parse(existing.settings || '{}'), cloneDefaultSettings()),
      }
    } catch {
      return {
        id: existing.id,
        settings: cloneDefaultSettings(),
      }
    }
  }

  const settingsId = uuidv4()
  const settings = cloneDefaultSettings()
  await db
    .prepare(
      `INSERT INTO admin_system_settings (id, settings, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`
    )
    .run(settingsId, JSON.stringify(settings))

  return { id: settingsId, settings }
}

async function buildDashboardData(db, runtime) {
  const { auditLogPath, securityLogPath } = getLogPaths()

  const [
    totalUsersRow,
    newRegistrationsRow,
    verifiedUsersRow,
    suspendedUsersRow,
    totalTracksRow,
    totalPlaylistsRow,
    totalAnalysesRow,
    totalPresetsRow,
    recentTracks,
    recentPlaylists,
    recentUsers,
    userGrowthRows,
    auditEntries,
    securityEntries,
    settingsState,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM users').get(),
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE created_at >= datetime('now', '-7 days')").get(),
    db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_verified = 1').get(),
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE account_status = 'suspended'").get(),
    db.prepare('SELECT COUNT(*) AS count FROM tracks').get(),
    db.prepare('SELECT COUNT(*) AS count FROM playlists').get(),
    db.prepare('SELECT COUNT(*) AS count FROM analysis_results').get(),
    db.prepare('SELECT COUNT(*) AS count FROM visual_presets').get(),
    db
      .prepare(
        `SELECT tracks.id, tracks.title, tracks.artist, tracks.created_at, users.name AS owner_name
         FROM tracks
         LEFT JOIN users ON users.id = tracks.user_id
         ORDER BY tracks.created_at DESC
         LIMIT 4`
      )
      .all(),
    db
      .prepare(
        `SELECT playlists.id, playlists.name, playlists.created_at, users.name AS owner_name
         FROM playlists
         LEFT JOIN users ON users.id = playlists.user_id
         ORDER BY playlists.created_at DESC
         LIMIT 4`
      )
      .all(),
    db
      .prepare(
        `SELECT id, name, email, created_at, account_status, is_verified
         FROM users
         ORDER BY created_at DESC
         LIMIT 5`
      )
      .all(),
    db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS bucket, COUNT(*) AS total
         FROM users
         WHERE created_at >= datetime('now', '-6 days')
         GROUP BY substr(created_at, 1, 10)
         ORDER BY bucket ASC`
      )
      .all(),
    readJsonLines(auditLogPath),
    readJsonLines(securityLogPath),
    ensureSystemSettings(db),
  ])

  const now = Date.now()
  const last24Hours = auditEntries.filter((entry) => now - Date.parse(entry.timestamp || 0) <= 24 * 60 * 60 * 1000)
  const last30Minutes = auditEntries.filter((entry) => now - Date.parse(entry.timestamp || 0) <= 30 * 60 * 1000)
  const securityLast24Hours = securityEntries.filter(
    (entry) => now - Date.parse(entry.timestamp || 0) <= 24 * 60 * 60 * 1000
  )

  const activeSessions = new Set(
    last30Minutes
      .filter((entry) => entry.userId || entry.ip)
      .map((entry) => entry.userId || entry.ip)
  ).size

  const apiRequests = last24Hours.length
  const systemErrors = last24Hours.filter((entry) => Number(entry.statusCode || 0) >= 500).length
  const securityAlerts = securityLast24Hours.filter(
    (entry) => String(entry.type || '').includes('failed') || String(entry.type || '').includes('detected')
  ).length

  const recentContent = [
    ...recentTracks.map((track) => ({
      id: track.id,
      type: 'Track',
      title: track.title || 'Untitled Track',
      subtitle: track.artist || track.owner_name || 'Unknown Artist',
      createdAt: track.created_at,
      status: 'Live',
    })),
    ...recentPlaylists.map((playlist) => ({
      id: playlist.id,
      type: 'Playlist',
      title: playlist.name || 'Untitled Playlist',
      subtitle: playlist.owner_name || 'Unknown Owner',
      createdAt: playlist.created_at,
      status: 'Published',
    })),
  ]
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
    .slice(0, 6)

  const recentSecurityEvents = securityEntries
    .slice(-6)
    .reverse()
    .map((entry) => ({
      type: entry.type,
      timestamp: entry.timestamp,
      ip: entry.ip || 'unknown',
      details: [
        entry.email,
        entry.reason,
        entry.role ? ADMIN_ROLE_LABELS[entry.role] || entry.role : null,
      ]
        .filter(Boolean)
        .join(' | '),
    }))

  const adminIpHistory = securityEntries
    .filter((entry) => entry.type === 'admin_login_success')
    .slice(-6)
    .reverse()
    .map((entry) => ({
      timestamp: entry.timestamp,
      ip: entry.ip || 'unknown',
      admin: entry.email || entry.adminId || 'admin',
      trusted: Boolean(entry.trustedIp),
    }))

  const topEndpoints = buildTopEndpoints(last24Hours)
  const apiHealth = buildApiHealth(last24Hours)
  const systemLoad = summarizeSystemLoad(last24Hours)

  const [dbStats, uploadsSize, tempSize] = await Promise.all([
    fs.stat(runtime.dbPath).catch(() => ({ size: 0 })),
    getDirectorySize(runtime.uploadsDir),
    getDirectorySize(runtime.tempDir),
  ])

  const memoryUsage = process.memoryUsage()
  const rateLimitStatus = getRateLimitStatus()

  return {
    overview: {
      widgets: [
        { key: 'totalUsers', label: 'Total Users', value: Number(totalUsersRow?.count || 0), tone: 'primary' },
        { key: 'activeSessions', label: 'Active Sessions', value: activeSessions, tone: 'info' },
        {
          key: 'serverStatus',
          label: 'Server Status',
          value: rateLimitStatus.protectionMode ? 'Protected' : 'Operational',
          tone: rateLimitStatus.protectionMode ? 'warning' : 'success',
        },
        { key: 'apiRequests', label: 'API Requests / 24h', value: apiRequests, tone: 'info' },
        { key: 'newRegistrations', label: 'New Registrations', value: Number(newRegistrationsRow?.count || 0), tone: 'success' },
        { key: 'systemErrors', label: 'System Errors / 24h', value: systemErrors, tone: systemErrors ? 'error' : 'success' },
        { key: 'securityAlerts', label: 'Security Alerts', value: securityAlerts, tone: securityAlerts ? 'warning' : 'success' },
      ],
      charts: {
        userGrowth: summarizeByDay(userGrowthRows, 'total'),
        trafficAnalytics: summarizeTrafficByDay(last24Hours.filter((entry) => String(entry.path || '').startsWith('/api/'))),
        systemLoad,
      },
    },
    users: {
      totals: {
        total: Number(totalUsersRow?.count || 0),
        verified: Number(verifiedUsersRow?.count || 0),
        suspended: Number(suspendedUsersRow?.count || 0),
      },
      recent: recentUsers.map((user) => ({
        id: user.id,
        name: user.name || 'Unnamed User',
        email: user.email,
        createdAt: user.created_at,
        status: user.account_status,
        verified: Boolean(user.is_verified),
      })),
    },
    content: {
      totals: {
        tracks: Number(totalTracksRow?.count || 0),
        playlists: Number(totalPlaylistsRow?.count || 0),
        analyses: Number(totalAnalysesRow?.count || 0),
        presets: Number(totalPresetsRow?.count || 0),
      },
      recent: recentContent,
    },
    settings: settingsState.settings,
    apis: apiHealth,
    security: {
      events: recentSecurityEvents,
      ipMonitoring: adminIpHistory,
    },
    analytics: {
      topEndpoints,
      failureRate: apiRequests ? Math.round((systemErrors / apiRequests) * 100) : 0,
      successRate: apiRequests ? Math.max(0, 100 - Math.round((systemErrors / apiRequests) * 100)) : 100,
    },
    infrastructure: {
      uptimeMinutes: Math.round(process.uptime() / 60),
      cpuLoad1m: Number(os.loadavg()[0].toFixed(2)),
      rssMemoryMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      databaseSize: formatBytes(dbStats.size || 0),
      uploadsSize: formatBytes(uploadsSize),
      tempSize: formatBytes(tempSize),
      rateLimit: rateLimitStatus,
    },
  }
}

router.post('/login', authRateLimiter, async (req, res) => {
  cleanupExpiredChallenges()

  try {
    const email = assertEmail(req.body.email)
    const password = assertString(req.body.password, 'password', { min: 8, max: 128 })
    const db = req.app.locals.db
    const ipAddress = getClientIp(req)

    const admin = await db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email)

    if (!admin) {
      logSecurityEvent('admin_failed_login', { email, reason: 'admin_not_found' }, req)
      return res.status(401).json({ error: 'Invalid admin credentials' })
    }

    if (admin.account_status === 'suspended') {
      logSecurityEvent('admin_failed_login', { adminId: admin.id, email, reason: 'admin_suspended' }, req)
      return res.status(403).json({ error: 'Admin account is suspended' })
    }

    const isValidPassword = await bcrypt.compare(password, admin.password)
    if (!isValidPassword) {
      logSecurityEvent('admin_failed_login', { adminId: admin.id, email, reason: 'invalid_password' }, req)
      return res.status(401).json({ error: 'Invalid admin credentials' })
    }

    const challengeToken = crypto.randomUUID()
    const expiresAt = Date.now() + CHALLENGE_TTL_MS
    pendingAdminChallenges.set(challengeToken, {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      ipAddress,
      expiresAt,
    })

    logSecurityEvent('admin_password_verified', { adminId: admin.id, email, role: admin.role }, req)

    res.json({
      requiresTwoFactor: true,
      challengeToken,
      expiresAt: new Date(expiresAt).toISOString(),
      admin: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roleLabel: ADMIN_ROLE_LABELS[admin.role] || admin.role,
      },
      ipMonitoring: {
        currentIp: ipAddress,
        lastIp: admin.last_login_ip || null,
        trusted: !admin.last_login_ip || admin.last_login_ip === ipAddress,
      },
      developmentCode: process.env.NODE_ENV === 'production'
        ? undefined
        : generateTotpCode(admin.two_factor_secret || DEVELOPMENT_TOTP_SECRET),
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Admin login error:', error)
    return res.status(500).json({ error: 'Failed to login as admin' })
  }
})

router.post('/verify-2fa', authRateLimiter, async (req, res) => {
  cleanupExpiredChallenges()

  try {
    const challengeToken = assertString(req.body.challengeToken, 'challengeToken', { min: 8, max: 200 })
    const code = assertString(req.body.code, 'code', { min: 6, max: 6 })
    const challenge = pendingAdminChallenges.get(challengeToken)

    if (!challenge || challenge.expiresAt <= Date.now()) {
      pendingAdminChallenges.delete(challengeToken)
      return res.status(401).json({ error: '2FA challenge expired. Please login again.' })
    }

    const ipAddress = getClientIp(req)
    if (challenge.ipAddress !== ipAddress) {
      pendingAdminChallenges.delete(challengeToken)
      logSecurityEvent('admin_challenge_ip_mismatch', { adminId: challenge.adminId, expectedIp: challenge.ipAddress }, req)
      return res.status(401).json({ error: 'IP changed during admin verification. Please login again.' })
    }

    const db = req.app.locals.db
    const admin = await db.prepare('SELECT * FROM admin_users WHERE id = ?').get(challenge.adminId)

    if (!admin) {
      pendingAdminChallenges.delete(challengeToken)
      return res.status(404).json({ error: 'Admin account not found' })
    }

    const isValidCode = verifyTotpCode(admin.two_factor_secret || DEVELOPMENT_TOTP_SECRET, code)
    if (!isValidCode) {
      logSecurityEvent('admin_failed_2fa', { adminId: admin.id, email: admin.email, role: admin.role }, req)
      return res.status(401).json({ error: 'Invalid verification code' })
    }

    pendingAdminChallenges.delete(challengeToken)

    const permissions = getAdminPermissions(admin.role)
    const trustedIp = !admin.last_login_ip || admin.last_login_ip === ipAddress

    await db
      .prepare(
        `UPDATE admin_users
         SET last_login_at = CURRENT_TIMESTAMP,
             last_login_ip = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(ipAddress, admin.id)

    if (!trustedIp) {
      logSecurityEvent('admin_new_ip_detected', { adminId: admin.id, email: admin.email, role: admin.role }, req)
    }

    logSecurityEvent(
      'admin_login_success',
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        trustedIp,
      },
      req
    )

    const token = issueAccessToken(
      { id: admin.id },
      'admin',
      {
        adminId: admin.id,
        role: admin.role,
        permissions,
        email: admin.email,
        name: admin.name,
      }
    )

    return res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roleLabel: ADMIN_ROLE_LABELS[admin.role] || admin.role,
        permissions,
        lastLoginAt: new Date().toISOString(),
        currentIp: ipAddress,
        trustedIp,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Admin verify 2FA error:', error)
    return res.status(500).json({ error: 'Failed to verify admin code' })
  }
})

router.get('/profile', requireAdminAuth, async (req, res) => {
  try {
    const db = req.app.locals.db
    const admin = await db
      .prepare(
        `SELECT id, name, email, role, last_login_at, last_login_ip, created_at
         FROM admin_users
         WHERE id = ?`
      )
      .get(req.admin.id)

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' })
    }

    return res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roleLabel: ADMIN_ROLE_LABELS[admin.role] || admin.role,
        permissions: req.admin.permissions,
        lastLoginAt: admin.last_login_at,
        lastLoginIp: admin.last_login_ip,
        currentIp: getClientIp(req),
        createdAt: admin.created_at,
      },
    })
  } catch (error) {
    console.error('Admin profile error:', error)
    return res.status(500).json({ error: 'Failed to load admin profile' })
  }
})

router.get('/dashboard', requireAdminAuth, requireAdminPermission('dashboard.read'), async (req, res) => {
  try {
    const payload = await buildDashboardData(req.app.locals.db, req.app.locals.runtime)
    return res.json(payload)
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return res.status(500).json({ error: 'Failed to load admin dashboard' })
  }
})

router.get('/users', requireAdminAuth, requireAdminPermission('users.read'), async (req, res) => {
  try {
    const db = req.app.locals.db
    const searchTerm = assertOptionalString(req.query.search, 'search', { max: 80 })
    const searchValue = searchTerm ? `%${searchTerm.toLowerCase()}%` : null

    const users = searchValue
      ? await db
          .prepare(
            `SELECT id, name, email, country, account_status, is_verified, created_at, last_login_ip, last_login_at
             FROM users
             WHERE lower(email) LIKE ? OR lower(COALESCE(name, '')) LIKE ?
             ORDER BY created_at DESC`
          )
          .all(searchValue, searchValue)
      : await db
          .prepare(
            `SELECT id, name, email, country, account_status, is_verified, created_at, last_login_ip, last_login_at
             FROM users
             ORDER BY created_at DESC`
          )
          .all()

    const auditEntries = await readJsonLines(getLogPaths().auditLogPath)
    const activityMap = new Map()

    for (const entry of auditEntries) {
      if (!entry?.userId) continue
      const existing = activityMap.get(entry.userId)
      if (!existing || Date.parse(existing.timestamp || 0) < Date.parse(entry.timestamp || 0)) {
        activityMap.set(entry.userId, {
          timestamp: entry.timestamp,
          ip: entry.ip,
        })
      }
    }

    return res.json({
      users: users.map((user) => {
        const activity = activityMap.get(user.id)
        return {
          id: user.id,
          name: user.name || 'Unnamed User',
          email: user.email,
          country: user.country || 'Unknown',
          ipAddress: user.last_login_ip || activity?.ip || 'Unknown',
          accountStatus: user.account_status || 'active',
          isVerified: Boolean(user.is_verified),
          registrationDate: user.created_at,
          lastActiveAt: user.last_login_at || activity?.timestamp || null,
        }
      }),
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Admin users error:', error)
    return res.status(500).json({ error: 'Failed to load platform users' })
  }
})

router.put('/users/:id/suspend', requireAdminAuth, requireAdminPermission('users.suspend'), async (req, res) => {
  try {
    const userId = req.params.id
    assertUUID(userId, 'id')

    const db = req.app.locals.db
    const user = await db.prepare('SELECT id, email, account_status FROM users WHERE id = ?').get(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const suspended = typeof req.body.suspended === 'boolean'
      ? req.body.suspended
      : user.account_status !== 'suspended'
    const reason = assertOptionalString(req.body.reason, 'reason', { max: 160 })

    await db
      .prepare(
        `UPDATE users
         SET account_status = ?,
             suspended_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
             suspended_reason = CASE WHEN ? THEN ? ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(suspended ? 'suspended' : 'active', suspended ? 1 : 0, suspended ? 1 : 0, reason, userId)

    logSecurityEvent(
      suspended ? 'admin_user_suspended' : 'admin_user_reactivated',
      {
        adminId: req.admin.id,
        targetUserId: userId,
        email: user.email,
        reason,
      },
      req
    )

    return res.json({
      success: true,
      userId,
      accountStatus: suspended ? 'suspended' : 'active',
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Suspend user error:', error)
    return res.status(500).json({ error: 'Failed to update user status' })
  }
})

router.put('/users/:id/verify', requireAdminAuth, requireAdminPermission('users.verify'), async (req, res) => {
  try {
    const userId = req.params.id
    assertUUID(userId, 'id')

    const verified = typeof req.body.verified === 'boolean' ? req.body.verified : true
    const db = req.app.locals.db

    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await db
      .prepare(
        `UPDATE users
         SET is_verified = ?,
             verified_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(verified ? 1 : 0, verified ? 1 : 0, userId)

    logSecurityEvent(
      verified ? 'admin_user_verified' : 'admin_user_unverified',
      {
        adminId: req.admin.id,
        targetUserId: userId,
        email: user.email,
      },
      req
    )

    return res.json({
      success: true,
      userId,
      isVerified: verified,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Verify user error:', error)
    return res.status(500).json({ error: 'Failed to update verification status' })
  }
})

router.delete('/users/:id', requireAdminAuth, requireAdminPermission('users.delete'), async (req, res) => {
  try {
    const userId = req.params.id
    assertUUID(userId, 'id')

    const db = req.app.locals.db
    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await db.prepare('DELETE FROM playlist_tracks WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)').run(userId)
    await db.prepare('DELETE FROM usb_exports WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM analysis_results WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM visual_presets WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM tracks WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM playlists WHERE user_id = ?').run(userId)
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    logSecurityEvent('admin_user_deleted', { adminId: req.admin.id, targetUserId: userId, email: user.email }, req)

    return res.json({
      success: true,
      userId,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Delete user error:', error)
    return res.status(500).json({ error: 'Failed to delete user' })
  }
})

router.get('/settings', requireAdminAuth, requireAdminPermission('settings.read'), async (req, res) => {
  try {
    const { settings } = await ensureSystemSettings(req.app.locals.db)
    return res.json({ settings })
  } catch (error) {
    console.error('Admin settings error:', error)
    return res.status(500).json({ error: 'Failed to load system settings' })
  }
})

router.put('/settings', requireAdminAuth, requireAdminPermission('settings.write'), async (req, res) => {
  try {
    const db = req.app.locals.db
    const existing = await ensureSystemSettings(db)
    const nextSettings = normalizeSystemSettings(req.body, existing.settings)

    await db
      .prepare(
        `UPDATE admin_system_settings
         SET settings = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(JSON.stringify(nextSettings), existing.id)

    logSecurityEvent('admin_settings_updated', { adminId: req.admin.id, role: req.admin.role }, req)

    return res.json({
      success: true,
      settings: nextSettings,
    })
  } catch (error) {
    console.error('Update admin settings error:', error)
    return res.status(500).json({ error: 'Failed to save system settings' })
  }
})

export default router
