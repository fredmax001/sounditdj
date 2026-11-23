export function secureHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')

  // Keep CSP strict enough for API responses and static assets.
  res.setHeader(
    'Content-Security-Policy',
    "default-src \x27self\x27; img-src \x27self\x27 data: blob:; media-src \x27self\x27 blob:; script-src \x27self\x27; style-src \x27self\x27 \x27unsafe-inline\x27; connect-src \x27self\x27 https:; frame-ancestors \x27none\x27"
  )

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  next()
}

export function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next()
  }
  
  // Skip HTTPS enforcement if explicitly disabled
  if (process.env.ENFORCE_HTTPS === 'false') {
    return next()
  }

  const forwardedProto = req.headers['x-forwarded-proto']
  const isSecure = req.secure || forwardedProto === 'https'

  if (!isSecure) {
    return res.status(400).json({ error: 'HTTPS is required in production' })
  }

  return next()
}
