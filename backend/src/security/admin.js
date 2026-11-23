import { parseBearerToken, verifyAccessToken } from './auth.js'

export const ADMIN_ROLES = ['super_admin', 'system_admin', 'moderator', 'finance_admin', 'support_admin']

export const ADMIN_ROLE_LABELS = {
  super_admin: 'Super Admin',
  system_admin: 'System Admin',
  moderator: 'Moderator',
  finance_admin: 'Finance Admin',
  support_admin: 'Support Admin',
}

export const ADMIN_PERMISSIONS = {
  super_admin: [
    'dashboard.read',
    'users.read',
    'users.verify',
    'users.suspend',
    'users.delete',
    'content.read',
    'content.manage',
    'settings.read',
    'settings.write',
    'apis.read',
    'security.read',
    'analytics.read',
    'infrastructure.read',
  ],
  system_admin: [
    'dashboard.read',
    'users.read',
    'users.verify',
    'users.suspend',
    'users.delete',
    'content.read',
    'content.manage',
    'settings.read',
    'settings.write',
    'apis.read',
    'security.read',
    'analytics.read',
    'infrastructure.read',
  ],
  moderator: [
    'dashboard.read',
    'users.read',
    'users.verify',
    'users.suspend',
    'content.read',
    'content.manage',
    'security.read',
    'analytics.read',
  ],
  finance_admin: [
    'dashboard.read',
    'users.read',
    'settings.read',
    'apis.read',
    'analytics.read',
    'infrastructure.read',
  ],
  support_admin: [
    'dashboard.read',
    'users.read',
    'users.verify',
    'users.suspend',
    'content.read',
    'settings.read',
    'security.read',
    'analytics.read',
  ],
}

export function getAdminPermissions(role) {
  return ADMIN_PERMISSIONS[role] || []
}

export function isAdminScope(scope = '') {
  return typeof scope === 'string' && scope.startsWith('admin')
}

export function requireAdminAuth(req, res, next) {
  const token = parseBearerToken(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    const decoded = verifyAccessToken(token)

    if (!isAdminScope(decoded.scope)) {
      return res.status(403).json({ error: 'Admin token required' })
    }

    const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : getAdminPermissions(decoded.role)

    req.admin = {
      id: decoded.sub || decoded.userId || decoded.adminId,
      scope: decoded.scope,
      role: decoded.role || null,
      permissions,
      exp: decoded.exp,
      email: decoded.email || null,
      name: decoded.name || null,
    }

    if (!req.admin.id || !req.admin.role) {
      return res.status(401).json({ error: 'Invalid admin token payload' })
    }

    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired admin token' })
  }
}

export function requireAdminPermission(permission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin authentication required' })
    }

    if (req.admin.role === 'super_admin' || req.admin.permissions.includes(permission)) {
      return next()
    }

    return res.status(403).json({ error: 'Insufficient admin permissions' })
  }
}
