const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export function isValidUUID(value) {
  return UUID_V4_REGEX.test(String(value || ''))
}

export function assertUUID(value, field) {
  if (!isValidUUID(value)) {
    throw new ValidationError(`${field} must be a valid UUID`, field)
  }
}

export function sanitizeString(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim()
}

export function assertString(value, field, { min = 0, max = 255 } = {}) {
  const sanitized = sanitizeString(value)
  if (sanitized.length < min) {
    throw new ValidationError(`${field} must be at least ${min} characters`, field)
  }
  if (sanitized.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`, field)
  }
  return sanitized
}

export function assertOptionalString(value, field, options = {}) {
  if (value === undefined || value === null || value === '') return null
  return assertString(value, field, options)
}

export function assertNumber(value, field, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${field} must be a number`, field)
  }
  if (parsed < min || parsed > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`, field)
  }
  return parsed
}

export function assertOptionalNumber(value, field, options = {}) {
  if (value === undefined || value === null || value === '') return null
  return assertNumber(value, field, options)
}

export function assertEnum(value, field, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowedValues.join(', ')}`, field)
  }
  return value
}

export function assertArray(value, field, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`, field)
  }
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${field} length must be between ${min} and ${max}`, field)
  }
  return value
}

export function assertEmail(value, field = 'email') {
  const sanitized = sanitizeString(value).toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized)) {
    throw new ValidationError(`${field} is invalid`, field)
  }
  if (sanitized.length > 254) {
    throw new ValidationError(`${field} is too long`, field)
  }
  return sanitized
}

export function assertUrl(value, field = 'url') {
  const sanitized = sanitizeString(value)
  let parsed
  try {
    parsed = new URL(sanitized)
  } catch {
    throw new ValidationError(`${field} must be a valid URL`, field)
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new ValidationError(`${field} protocol must be http or https`, field)
  }

  if (parsed.hostname.length > 253) {
    throw new ValidationError(`${field} hostname is too long`, field)
  }

  return sanitized
}

export function sendValidationError(res, error) {
  const payload = {
    error: error.message || 'Invalid request',
  }
  if (error.field) {
    payload.field = error.field
  }
  return res.status(400).json(payload)
}

export function validateRequest(validator) {
  return (req, res, next) => {
    try {
      validator(req)
      return next()
    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, error)
      }
      return next(error)
    }
  }
}
