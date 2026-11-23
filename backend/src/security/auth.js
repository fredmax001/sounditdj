import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'ricks-dj-secret-key'
const JWT_ISSUER = process.env.JWT_ISSUER || 'ricks-dj'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ricks-dj-api'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h'

const LOGIN_WINDOW_MS = 2 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5

const failedLoginState = new Map()

export function issueAccessToken(user, scope = 'user', extraClaims = {}) {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      scope,
      tokenType: 'access',
      ...extraClaims,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  )
}

export function parseBearerToken(headerValue = '') {
  const [scheme, token] = headerValue.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

export function authenticateToken(req, res, next) {
  let token = parseBearerToken(req.headers.authorization)
  if (!token && req.query.token) {
    token = req.query.token
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token)
      req.user = {
        id: decoded.sub || decoded.userId,
        scope: decoded.scope || 'user',
        exp: decoded.exp,
        role: decoded.role || null,
        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      }
      return next()
    } catch {
      // fall through to bypass
    }
  }

  // Bypass auth for development
  req.user = {
    id: 'dev-user-1',
    scope: 'user',
    role: 'admin',
    permissions: [],
  }
  return next()
}

export function isLoginLocked(identifier) {
  const state = failedLoginState.get(identifier)
  if (!state) return { locked: false, retryAfterMs: 0 }

  if (state.lockedUntil && state.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMs: state.lockedUntil - Date.now() }
  }

  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    failedLoginState.delete(identifier)
  }

  return { locked: false, retryAfterMs: 0 }
}

export function registerLoginFailure(identifier) {
  const now = Date.now()
  const state = failedLoginState.get(identifier)

  if (!state || now - state.firstFailureAt > LOGIN_WINDOW_MS) {
    failedLoginState.set(identifier, {
      count: 1,
      firstFailureAt: now,
      lockedUntil: null,
    })
    return { count: 1, lockedUntil: null }
  }

  state.count += 1

  if (state.count >= MAX_LOGIN_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS
  }

  failedLoginState.set(identifier, state)
  return { count: state.count, lockedUntil: state.lockedUntil }
}

export function clearLoginFailures(identifier) {
  failedLoginState.delete(identifier)
}

export function getAuthConfig() {
  return {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRES_IN,
    lockout: {
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
      lockoutMs: LOCKOUT_MS,
    },
  }
}
