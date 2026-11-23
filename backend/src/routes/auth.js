import express from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

import {
  authenticateToken,
  clearLoginFailures,
  getAuthConfig,
  isLoginLocked,
  issueAccessToken,
  registerLoginFailure,
} from '../security/auth.js'
import { logSecurityEvent } from '../security/logging.js'
import { ValidationError, assertEmail, assertOptionalString, assertString, sendValidationError } from '../security/validation.js'

const router = express.Router()

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function getLoginKey(email, req) {
  return `${email}:${getClientIp(req)}`
}

// Register
router.post('/register', async (req, res) => {
  try {
    const email = assertEmail(req.body.email)
    const password = assertString(req.body.password, 'password', { min: 8, max: 128 })
    const name = assertOptionalString(req.body.name, 'name', { min: 1, max: 80 })

    const db = req.app.locals.db

    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const userId = uuidv4()

    await db
      .prepare(
        `INSERT INTO users (id, email, password, name)
         VALUES (?, ?, ?, ?)`
      )
      .run(userId, email, hashedPassword, name)

    const token = issueAccessToken({ id: userId }, 'user')

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        accountStatus: 'active',
        isVerified: false,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Register error:', error)
    res.status(500).json({ error: 'Failed to register' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const email = assertEmail(req.body.email)
    const password = assertString(req.body.password, 'password', { min: 8, max: 128 })
    const loginKey = getLoginKey(email, req)

    const lockState = isLoginLocked(loginKey)
    if (lockState.locked) {
      const retryAfterSeconds = Math.ceil(lockState.retryAfterMs / 1000)
      res.setHeader('Retry-After', retryAfterSeconds)
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed logins',
        retryAfterSeconds,
      })
    }

    const db = req.app.locals.db
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email)

    if (!user) {
      const state = registerLoginFailure(loginKey)
      logSecurityEvent(
        'auth_failed_login',
        {
          email,
          reason: 'user_not_found',
          attemptCount: state.count,
          locked: Boolean(state.lockedUntil),
        },
        req
      )
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (user.account_status === 'suspended') {
      logSecurityEvent(
        'auth_failed_login',
        {
          email,
          userId: user.id,
          reason: 'user_suspended',
        },
        req
      )
      return res.status(403).json({ error: 'Account suspended. Contact support.' })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      const state = registerLoginFailure(loginKey)
      logSecurityEvent(
        'auth_failed_login',
        {
          email,
          userId: user.id,
          reason: 'invalid_password',
          attemptCount: state.count,
          locked: Boolean(state.lockedUntil),
        },
        req
      )

      if (state.lockedUntil) {
        const retryAfterSeconds = Math.ceil((state.lockedUntil - Date.now()) / 1000)
        res.setHeader('Retry-After', retryAfterSeconds)
        return res.status(423).json({
          error: 'Account temporarily locked due to repeated failed logins',
          retryAfterSeconds,
        })
      }

      return res.status(401).json({ error: 'Invalid credentials' })
    }

    clearLoginFailures(loginKey)
    const token = issueAccessToken({ id: user.id }, 'user')
    const loginIp = getClientIp(req)

    await db
      .prepare(
        `UPDATE users
         SET last_login_at = CURRENT_TIMESTAMP,
             last_login_ip = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(loginIp, user.id)

    logSecurityEvent('auth_login_success', { email, userId: user.id }, req)

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        djName: user.dj_name,
        bio: user.bio,
        accountStatus: user.account_status || 'active',
        isVerified: Boolean(user.is_verified),
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendValidationError(res, error)
    }

    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to login' })
  }
})

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db

    const user = await db
      .prepare(
        `SELECT id, email, name, dj_name, bio, profile_photo, account_status, is_verified, country, last_login_at
         FROM users
         WHERE id = ?`
      )
      .get(req.user.id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user profile' })
  }
})

router.get('/config', (req, res) => {
  res.json({
    auth: getAuthConfig(),
  })
})

// Logout (JWT invalidation should be handled with token revocation list if needed)
router.post('/logout', authenticateToken, (req, res) => {
  logSecurityEvent('auth_logout', { userId: req.user.id }, req)
  res.json({ message: 'Logged out successfully' })
})

export default router
