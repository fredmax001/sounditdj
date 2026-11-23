const buckets = new Map()
const minuteTraffic = []

let baselineRpm = 0
let protectionModeUntil = 0

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function cleanupExpiredBuckets(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.windowEnd) {
      buckets.delete(key)
    }
  }
}

function updateTrafficAnomaly(now) {
  const minute = Math.floor(now / 60000)
  const latest = minuteTraffic[minuteTraffic.length - 1]

  if (!latest || latest.minute !== minute) {
    minuteTraffic.push({ minute, count: 1 })
    if (minuteTraffic.length > 60) {
      minuteTraffic.shift()
    }
  } else {
    latest.count += 1
  }

  const previous = minuteTraffic.slice(-11, -1)
  if (previous.length < 5) return

  const avg = previous.reduce((sum, row) => sum + row.count, 0) / previous.length
  baselineRpm = Math.round(avg)

  const current = minuteTraffic[minuteTraffic.length - 1]?.count || 0
  if (avg > 0 && current > avg * 3) {
    protectionModeUntil = now + 5 * 60 * 1000
  }
}

function createLimiter({ windowMs, maxPerWindow, keyPrefix }) {
  return (req, res, next) => {
    const now = Date.now()
    const ip = getClientIp(req)
    cleanupExpiredBuckets(now)
    updateTrafficAnomaly(now)

    const strictMode = protectionModeUntil > now
    const effectiveLimit = strictMode ? Math.max(10, Math.floor(maxPerWindow / 2)) : maxPerWindow

    const bucketKey = `${keyPrefix}:${ip}`
    const existing = buckets.get(bucketKey)

    if (!existing || now > existing.windowEnd) {
      buckets.set(bucketKey, {
        count: 1,
        windowEnd: now + windowMs,
      })
      return next()
    }

    existing.count += 1
    buckets.set(bucketKey, existing)

    if (existing.count > effectiveLimit) {
      const retryAfterSeconds = Math.ceil((existing.windowEnd - now) / 1000)
      res.setHeader('Retry-After', retryAfterSeconds)
      return res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds,
        protectionMode: strictMode,
      })
    }

    return next()
  }
}

export const globalRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  maxPerWindow: Number(process.env.RATE_LIMIT_PER_MINUTE || 100),
  keyPrefix: 'global',
})

export const authRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  maxPerWindow: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE || 30),
  keyPrefix: 'auth',
})

const internalUploadRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  maxPerWindow: Number(process.env.UPLOAD_RATE_LIMIT_PER_MINUTE || 20),
  keyPrefix: 'upload',
})

export const uploadRateLimiter = (req, res, next) => {
  if (req.method === 'GET') {
    return next()
  }
  return internalUploadRateLimiter(req, res, next)
}

export const integrationRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  maxPerWindow: Number(process.env.INTEGRATION_RATE_LIMIT_PER_MINUTE || 20),
  keyPrefix: 'integration',
})

export function getRateLimitStatus() {
  return {
    baselineRpm,
    protectionMode: protectionModeUntil > Date.now(),
    protectionModeUntil,
  }
}
