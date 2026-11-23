import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const logsDir = path.join(__dirname, '../../logs')

fs.ensureDirSync(logsDir)

const securityLogPath = path.join(logsDir, 'security.log')
const auditLogPath = path.join(logsDir, 'audit.log')

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function writeJsonLine(filePath, payload) {
  fs.appendFile(filePath, `${JSON.stringify(payload)}\n`).catch(() => {
    // Avoid blocking request flow on logging failures.
  })
}

export function addRequestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now()

  res.on('finish', () => {
    writeJsonLine(auditLogPath, {
      type: 'api_request',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: getClientIp(req),
      userId: req.user?.id || null,
      userAgent: req.headers['user-agent'] || null,
    })
  })

  next()
}

export function logSecurityEvent(type, details = {}, req = null) {
  writeJsonLine(securityLogPath, {
    type,
    timestamp: new Date().toISOString(),
    requestId: req?.requestId || null,
    ip: req ? getClientIp(req) : null,
    userId: req?.user?.id || null,
    ...details,
  })
}

export function getLogPaths() {
  return {
    securityLogPath,
    auditLogPath,
  }
}
