import React, { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  HardDrive,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Network,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react'
import toast from 'react-hot-toast'

import BrandMark from '@components/BrandMark'
import useAdminStore from '@store/adminStore'

const sectionTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'content', label: 'Content', icon: WalletCards },
  { id: 'operations', label: 'Operations', icon: SlidersHorizontal },
]

const roleCards = [
  { label: 'Super Admin', description: 'Full control over users, settings, and infrastructure.' },
  { label: 'System Admin', description: 'Owns system health, APIs, and operational controls.' },
  { label: 'Moderator', description: 'Manages users, verification, and content oversight.' },
  { label: 'Finance Admin', description: 'Monitors platform analytics, billing signals, and usage.' },
  { label: 'Support Admin', description: 'Handles account incidents, suspensions, and support queues.' },
]

const securityLayers = [
  'Admin login',
  '2FA verification',
  'Role-based permissions',
  'IP monitoring',
]

const toneClasses = {
  primary: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  error: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
}

function formatNumber(value) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US').format(value)
  }
  return value
}

function formatDateTime(value) {
  if (!value) return 'No activity yet'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getToneClass(tone = 'primary') {
  return toneClasses[tone] || toneClasses.primary
}

function StatusPill({ tone = 'primary', children }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${getToneClass(tone)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

function GlassPanel({ children, className = '' }) {
  return (
    <div className={`rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl ${className}`}>
      {children}
    </div>
  )
}

function SectionHeading({ eyebrow, title, description, actions = null }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-300">{description}</p> : null}
      </div>
      {actions}
    </div>
  )
}

function AdminAuthView() {
  const login = useAdminStore((state) => state.login)
  const verifyTwoFactor = useAdminStore((state) => state.verifyTwoFactor)
  const isLoading = useAdminStore((state) => state.isLoading)
  const error = useAdminStore((state) => state.error)
  const clearError = useAdminStore((state) => state.clearError)
  const clearChallenge = useAdminStore((state) => state.clearChallenge)
  const challengeMeta = useAdminStore((state) => state.challengeMeta)

  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@sounditdj.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Admin12345!' : '')
  const [code, setCode] = useState('')

  const handleLogin = async (event) => {
    event.preventDefault()
    clearError()

    try {
      await login({ email, password })
      toast.success('Password verified. Enter the 2FA code.')
    } catch (loginError) {
      toast.error(loginError.message)
    }
  }

  const handleVerify = async (event) => {
    event.preventDefault()
    clearError()

    try {
      await verifyTwoFactor({ code })
      toast.success('Admin access granted.')
    } catch (verifyError) {
      toast.error(verifyError.message)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(135deg,_rgba(8,47,73,0.94),_rgba(2,6,23,1))]" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="flex flex-col justify-between gap-10">
          <div className="space-y-8">
            <BrandMark size="lg" className="h-10" />
            <div className="space-y-5">
              <StatusPill tone="info">Universal Admin Dashboard</StatusPill>
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="max-w-3xl font-display text-5xl leading-[0.96] text-white sm:text-6xl"
              >
                System control for users, security, analytics, and infrastructure.
              </motion.h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                This admin surface is built as a real control plane with password verification, time-based 2FA, role-aware permissions, and IP monitoring before any dashboard data is shown.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <GlassPanel className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl">Security First</h2>
                  <p className="text-sm text-slate-300">Required security layers before dashboard access.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                {securityLayers.map((layer) => (
                  <div key={layer} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                    <span>{layer}</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-100">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl">Admin Roles</h2>
                  <p className="text-sm text-slate-300">Scoped access for different operational owners.</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {roleCards.map((role) => (
                  <div key={role.label} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                    <p className="font-semibold text-white">{role.label}</p>
                    <p className="mt-1 text-sm text-slate-300">{role.description}</p>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </div>

        <div className="flex items-center">
          <GlassPanel className="w-full overflow-hidden">
            <div className="border-b border-white/10 px-8 py-7">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                  {challengeMeta ? <ShieldCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Admin Access</p>
                  <h2 className="mt-1 font-display text-3xl text-white">
                    {challengeMeta ? 'Verify 2FA' : 'Secure Sign In'}
                  </h2>
                </div>
              </div>
            </div>

            <div className="px-8 py-8">
              {challengeMeta ? (
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="rounded-[26px] border border-cyan-400/20 bg-cyan-400/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.26em] text-cyan-200/70">Password Check Complete</p>
                        <h3 className="mt-2 text-xl font-semibold text-white">{challengeMeta.admin?.name || 'Administrator'}</h3>
                        <p className="mt-1 text-sm text-slate-200">{challengeMeta.admin?.roleLabel}</p>
                      </div>
                      <StatusPill tone={challengeMeta.ipMonitoring?.trusted ? 'success' : 'warning'}>
                        {challengeMeta.ipMonitoring?.trusted ? 'Trusted IP' : 'New IP'}
                      </StatusPill>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current IP</p>
                        <p className="mt-2 text-sm text-white">{challengeMeta.ipMonitoring?.currentIp || 'Unknown'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expires</p>
                        <p className="mt-2 text-sm text-white">{formatDateTime(challengeMeta.expiresAt)}</p>
                      </div>
                    </div>
                  </div>

                  {challengeMeta.developmentCode ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
                      <div className="flex items-center gap-2 font-semibold">
                        <Sparkles className="h-4 w-4" />
                        Local development helper
                      </div>
                      <p className="mt-2">Current TOTP code: <span className="font-mono text-base tracking-[0.25em]">{challengeMeta.developmentCode}</span></p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Authenticator code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 font-mono text-2xl tracking-[0.45em] text-white placeholder:text-slate-500"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={clearChallenge}
                      className="flex-1 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-4 font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || code.length !== 6}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-300 px-4 py-4 font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? 'Verifying...' : 'Unlock Dashboard'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                  {import.meta.env.DEV ? (
                    <div className="rounded-[26px] border border-white/10 bg-slate-950/40 p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Local Seed Credentials</p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        Email: <span className="font-medium text-white">admin@sounditdj.com</span>
                        <br />
                        Password: <span className="font-medium text-white">Admin12345!</span>
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Admin email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@sounditdj.com"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter admin password"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-white placeholder:text-slate-500"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-300 px-5 py-4 font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? 'Checking...' : 'Continue to 2FA'}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </form>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ dashboard, onRefresh, isRefreshing }) {
  const widgets = dashboard?.overview?.widgets || []
  const charts = dashboard?.overview?.charts || {}
  const securityEvents = dashboard?.security?.events || []
  const recentUsers = dashboard?.users?.recent || []

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="System Health"
        title="Command overview"
        description="Track live platform health, recent activity, and security posture from one screen."
        actions={(
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh data
          </button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-7">
        {widgets.map((widget) => (
          <GlassPanel key={widget.key} className="p-5 xl:col-span-1">
            <StatusPill tone={widget.tone}>{widget.label}</StatusPill>
            <p className="mt-5 font-display text-3xl text-white">{formatNumber(widget.value)}</p>
          </GlassPanel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassPanel className="p-6 xl:col-span-1">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-cyan-200" />
            <h3 className="font-display text-xl text-white">User growth</h3>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.userGrowth || []}>
                <defs>
                  <linearGradient id="userGrowthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 18 }} />
                <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="url(#userGrowthFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 xl:col-span-1">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-emerald-200" />
            <h3 className="font-display text-xl text-white">Traffic analytics</h3>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.trafficAnalytics || []}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 18 }} />
                <Bar dataKey="requests" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 xl:col-span-1">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-amber-200" />
            <h3 className="font-display text-xl text-white">System load</h3>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.systemLoad || []}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 18 }} />
                <Line type="monotone" dataKey="latency" stroke="#fbbf24" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="requests" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassPanel className="p-6">
          <SectionHeading
            eyebrow="Recent Users"
            title="New registrations"
            description="Quick look at recent account creation and trust status."
          />
          <div className="mt-6 space-y-3">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill tone={user.verified ? 'success' : 'warning'}>
                    {user.verified ? 'Verified' : 'Pending'}
                  </StatusPill>
                  <span className="text-sm text-slate-400">{formatDateTime(user.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <SectionHeading
            eyebrow="Security Feed"
            title="Recent alerts"
            description="Authentication and IP events captured by the control plane."
          />
          <div className="mt-6 space-y-3">
            {securityEvents.map((event) => (
              <div key={`${event.type}-${event.timestamp}`} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{event.type}</p>
                    <p className="mt-1 text-sm text-slate-300">{event.details || 'No extra details recorded.'}</p>
                  </div>
                  <ShieldAlert className="mt-1 h-4 w-4 text-amber-300" />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {event.ip} • {formatDateTime(event.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

function UsersTab({ dashboard, users, isRefreshing }) {
  const suspendUser = useAdminStore((state) => state.suspendUser)
  const verifyUser = useAdminStore((state) => state.verifyUser)
  const deleteUser = useAdminStore((state) => state.deleteUser)
  const admin = useAdminStore((state) => state.admin)

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  const visibleUsers = users.filter((user) => (
    !deferredSearch
      || user.name.toLowerCase().includes(deferredSearch)
      || user.email.toLowerCase().includes(deferredSearch)
      || user.country.toLowerCase().includes(deferredSearch)
  ))

  const canSuspend = admin?.permissions?.includes('users.suspend') || admin?.role === 'super_admin'
  const canVerify = admin?.permissions?.includes('users.verify') || admin?.role === 'super_admin'
  const canDelete = admin?.permissions?.includes('users.delete') || admin?.role === 'super_admin'

  const handleVerify = async (userId, verified) => {
    try {
      await verifyUser(userId, verified)
      toast.success(verified ? 'User verified' : 'User verification removed')
    } catch (error) {
      toast.error(error.message || 'Failed to update verification')
    }
  }

  const handleSuspend = async (userId, suspended) => {
    try {
      await suspendUser(userId, suspended, suspended ? 'Suspended by admin dashboard' : '')
      toast.success(suspended ? 'User suspended' : 'User reactivated')
    } catch (error) {
      toast.error(error.message || 'Failed to update account status')
    }
  }

  const handleDelete = async (userId, email) => {
    const confirmed = window.confirm(`Delete ${email}? This also removes that user's dashboard data.`)
    if (!confirmed) return

    try {
      await deleteUser(userId)
      toast.success('User deleted')
    } catch (error) {
      toast.error(error.message || 'Failed to delete user')
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="User Management"
        title="Platform accounts"
        description="Review account trust signals, recent IP activity, and moderation actions from a single queue."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="p-5">
          <StatusPill tone="primary">Total users</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(dashboard?.users?.totals?.total || 0)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <StatusPill tone="success">Verified users</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(dashboard?.users?.totals?.verified || 0)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <StatusPill tone="warning">Suspended users</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(dashboard?.users?.totals?.suspended || 0)}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="overflow-hidden">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display text-2xl text-white">User directory</h3>
              <p className="mt-1 text-sm text-slate-300">Search by name, email, or country and take moderation actions inline.</p>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 py-3 pl-11 pr-4 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-950/50 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Registered</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id} className="border-t border-white/8 align-top">
                  <td className="px-6 py-5">
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Last active {formatDateTime(user.lastActiveAt)}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">{user.country}</td>
                  <td className="px-6 py-5 text-sm font-mono text-slate-300">{user.ipAddress}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={user.accountStatus === 'suspended' ? 'warning' : 'success'}>
                        {user.accountStatus}
                      </StatusPill>
                      <StatusPill tone={user.isVerified ? 'success' : 'primary'}>
                        {user.isVerified ? 'Verified' : 'Unverified'}
                      </StatusPill>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">{formatDateTime(user.registrationDate)}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerify(user.id, !user.isVerified)}
                        disabled={!canVerify || isRefreshing}
                        className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-40"
                      >
                        {user.isVerified ? 'Unverify' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSuspend(user.id, user.accountStatus !== 'suspended')}
                        disabled={!canSuspend || isRefreshing}
                        className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-400/15 disabled:opacity-40"
                      >
                        {user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={!canDelete || isRefreshing}
                        className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}

function ContentTab({ dashboard }) {
  const content = dashboard?.content || {}
  const totals = content.totals || {}
  const items = content.recent || []

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Content Management"
        title="Platform content"
        description="Monitor the current inventory of tracks, playlists, analyses, and visual presets across the system."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel className="p-5">
          <StatusPill tone="info">Tracks</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(totals.tracks || 0)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <StatusPill tone="primary">Playlists</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(totals.playlists || 0)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <StatusPill tone="warning">Analyses</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(totals.analyses || 0)}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <StatusPill tone="success">Presets</StatusPill>
          <p className="mt-4 font-display text-4xl text-white">{formatNumber(totals.presets || 0)}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6">
        <SectionHeading
          eyebrow="Recent Assets"
          title="Latest content events"
          description="Recent content entering the platform, useful for moderation and operational checks."
        />
        <div className="mt-6 grid gap-3">
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-slate-400">{item.type} • {item.subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill tone="success">{item.status}</StatusPill>
                <span className="text-sm text-slate-400">{formatDateTime(item.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}

function SettingsToggle({ title, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4 text-left transition hover:bg-white/[0.04]"
    >
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${checked ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
        <div className="flex items-center gap-2">
          <ToggleLeft className={`h-4 w-4 ${checked ? '' : 'rotate-180'}`} />
          {checked ? 'On' : 'Off'}
        </div>
      </div>
    </button>
  )
}

function SettingsSelect({ title, description, value, options, onChange }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function OperationsTab({ dashboard, settings }) {
  const updateSettings = useAdminStore((state) => state.updateSettings)
  const isRefreshing = useAdminStore((state) => state.isRefreshing)

  const persistSettings = async (nextSettings) => {
    try {
      await updateSettings(nextSettings)
      toast.success('System settings updated')
    } catch (error) {
      toast.error(error.message || 'Failed to save settings')
    }
  }

  const toggleSetting = (section, key) => {
    const nextSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: !settings[section][key],
      },
    }
    persistSettings(nextSettings)
  }

  const selectSetting = (section, key, value) => {
    const castValue = ['sessionTimeoutMinutes', 'requestsPerMinute', 'slaTargetMinutes'].includes(key)
      ? Number(value)
      : value

    const nextSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: castValue,
      },
    }
    persistSettings(nextSettings)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="System Controls"
        title="Settings, APIs, security, analytics, and infrastructure"
        description="This tab turns the dashboard into an actual control panel: feature flags, service health, security monitoring, and runtime telemetry are all editable or visible here."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-cyan-200" />
            <h3 className="font-display text-2xl text-white">System settings</h3>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SettingsToggle
              title="Require admin 2FA"
              description="Keep two-step verification mandatory for all admin logins."
              checked={settings.security.requireAdmin2fa}
              onChange={() => toggleSetting('security', 'requireAdmin2fa')}
            />
            <SettingsToggle
              title="IP monitoring"
              description="Flag admin logins coming from unfamiliar IP addresses."
              checked={settings.security.ipMonitoring}
              onChange={() => toggleSetting('security', 'ipMonitoring')}
            />
            <SettingsToggle
              title="Open registrations"
              description="Allow new platform users to register normally."
              checked={settings.platform.registrationsOpen}
              onChange={() => toggleSetting('platform', 'registrationsOpen')}
            />
            <SettingsToggle
              title="Maintenance mode"
              description="Pause normal platform operations while maintenance is active."
              checked={settings.platform.maintenanceMode}
              onChange={() => toggleSetting('platform', 'maintenanceMode')}
            />
            <SettingsToggle
              title="Public API enabled"
              description="Expose public API traffic to downstream consumers."
              checked={settings.api.publicApiEnabled}
              onChange={() => toggleSetting('api', 'publicApiEnabled')}
            />
            <SettingsToggle
              title="Priority support queue"
              description="Keep urgent support issues on the fast-response path."
              checked={settings.support.priorityQueue}
              onChange={() => toggleSetting('support', 'priorityQueue')}
            />
            <SettingsSelect
              title="Session timeout"
              description="How long admin sessions should last before reauthentication."
              value={String(settings.security.sessionTimeoutMinutes)}
              options={[15, 30, 45, 60, 90].map((option) => ({ value: String(option), label: `${option} minutes` }))}
              onChange={(value) => selectSetting('security', 'sessionTimeoutMinutes', value)}
            />
            <SettingsSelect
              title="Release channel"
              description="Pick the system release cadence exposed to admins."
              value={settings.platform.releaseChannel}
              options={[
                { value: 'stable', label: 'Stable' },
                { value: 'canary', label: 'Canary' },
              ]}
              onChange={(value) => selectSetting('platform', 'releaseChannel', value)}
            />
            <SettingsSelect
              title="API throughput"
              description="Global request budget reflected in admin settings."
              value={String(settings.api.requestsPerMinute)}
              options={[60, 100, 150, 250, 500].map((option) => ({ value: String(option), label: `${option} req/min` }))}
              onChange={(value) => selectSetting('api', 'requestsPerMinute', value)}
            />
            <SettingsSelect
              title="SLA target"
              description="Target time for support queue response management."
              value={String(settings.support.slaTargetMinutes)}
              options={[15, 30, 45, 60, 90].map((option) => ({ value: String(option), label: `${option} minutes` }))}
              onChange={(value) => selectSetting('support', 'slaTargetMinutes', value)}
            />
          </div>
          {isRefreshing ? <p className="mt-4 text-sm text-slate-400">Saving settings...</p> : null}
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="p-6">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-emerald-200" />
              <h3 className="font-display text-2xl text-white">API services</h3>
            </div>
            <div className="mt-6 space-y-3">
              {(dashboard?.apis || []).map((service) => (
                <div key={service.key} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{service.label}</p>
                      <p className="mt-1 text-sm text-slate-400">{service.route}</p>
                    </div>
                    <StatusPill tone={service.status === 'online' ? 'success' : service.status === 'degraded' ? 'warning' : 'primary'}>
                      {service.status}
                    </StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Requests</p>
                      <p className="mt-1 text-sm text-white">{formatNumber(service.requests)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Error rate</p>
                      <p className="mt-1 text-sm text-white">{service.errorRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Avg duration</p>
                      <p className="mt-1 text-sm text-white">{service.avgDuration} ms</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-200" />
              <h3 className="font-display text-2xl text-white">Security and IP monitoring</h3>
            </div>
            <div className="mt-6 space-y-3">
              {(dashboard?.security?.ipMonitoring || []).map((entry) => (
                <div key={`${entry.ip}-${entry.timestamp}`} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{entry.admin}</p>
                      <p className="mt-1 font-mono text-sm text-slate-400">{entry.ip}</p>
                    </div>
                    <StatusPill tone={entry.trusted ? 'success' : 'warning'}>
                      {entry.trusted ? 'Trusted' : 'Review'}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{formatDateTime(entry.timestamp)}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-sky-200" />
            <h3 className="font-display text-2xl text-white">Analytics</h3>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Success rate</p>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.analytics?.successRate ?? 100}%</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Failure rate</p>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.analytics?.failureRate ?? 0}%</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {(dashboard?.analytics?.topEndpoints || []).map((endpoint) => (
              <div key={endpoint.path} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                <div>
                  <p className="font-semibold text-white">{endpoint.path}</p>
                  <p className="mt-1 text-sm text-slate-400">Top endpoint by traffic</p>
                </div>
                <span className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100">
                  {formatNumber(endpoint.requests)}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-cyan-200" />
            <h3 className="font-display text-2xl text-white">Infrastructure</h3>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-cyan-200" />
                <p className="text-sm text-slate-300">CPU load (1m)</p>
              </div>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.infrastructure?.cpuLoad1m || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-emerald-200" />
                <p className="text-sm text-slate-300">Uptime</p>
              </div>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.infrastructure?.uptimeMinutes || 0}m</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-sky-200" />
                <p className="text-sm text-slate-300">Database size</p>
              </div>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.infrastructure?.databaseSize || '0 B'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-amber-200" />
                <p className="text-sm text-slate-300">Uploads</p>
              </div>
              <p className="mt-3 font-display text-4xl text-white">{dashboard?.infrastructure?.uploadsSize || '0 B'}</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={dashboard?.infrastructure?.rateLimit?.protectionMode ? 'warning' : 'success'}>
                {dashboard?.infrastructure?.rateLimit?.protectionMode ? 'Protection mode enabled' : 'Traffic normal'}
              </StatusPill>
              <p className="text-sm text-slate-300">
                Memory: {dashboard?.infrastructure?.rssMemoryMb || 0} MB RSS / {dashboard?.infrastructure?.heapUsedMb || 0} MB heap
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

function AdminDashboardView() {
  const admin = useAdminStore((state) => state.admin)
  const dashboard = useAdminStore((state) => state.dashboard)
  const users = useAdminStore((state) => state.users)
  const settings = useAdminStore((state) => state.settings)
  const fetchDashboard = useAdminStore((state) => state.fetchDashboard)
  const fetchUsers = useAdminStore((state) => state.fetchUsers)
  const fetchSettings = useAdminStore((state) => state.fetchSettings)
  const logout = useAdminStore((state) => state.logout)
  const error = useAdminStore((state) => state.error)
  const clearError = useAdminStore((state) => state.clearError)
  const isRefreshing = useAdminStore((state) => state.isRefreshing)

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    let cancelled = false

    const loadAdminData = async () => {
      try {
        await Promise.all([fetchDashboard(), fetchUsers(), fetchSettings()])
      } catch (loadError) {
        if (!cancelled) {
          toast.error(loadError.message || 'Failed to load admin dashboard')
        }
      }
    }

    loadAdminData()

    return () => {
      cancelled = true
    }
  }, [fetchDashboard, fetchSettings, fetchUsers])

  const handleRefresh = async () => {
    clearError()

    try {
      await Promise.all([fetchDashboard(), fetchUsers(), fetchSettings()])
      toast.success('Dashboard refreshed')
    } catch (refreshError) {
      toast.error(refreshError.message || 'Failed to refresh dashboard')
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Admin session ended')
  }

  if (!dashboard || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04111f] text-white">
        <div className="text-center">
          <BrandMark size="lg" centered className="justify-center" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-cyan-200/70">Loading Admin Dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_26%),radial-gradient(circle_at_right,_rgba(52,211,153,0.12),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(3,7,18,1))]" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <GlassPanel className="w-full p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[300px]">
          <div className="flex items-center justify-between gap-4">
            <BrandMark size="lg" className="h-9" />
            <StatusPill tone="info">Admin</StatusPill>
          </div>

          <div className="mt-8 rounded-[26px] border border-white/8 bg-slate-950/50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed in as</p>
            <h2 className="mt-3 font-display text-3xl text-white">{admin?.name}</h2>
            <p className="mt-2 text-sm text-slate-300">{admin?.email}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="success">{admin?.roleLabel || admin?.role}</StatusPill>
              <StatusPill tone="primary">{admin?.currentIp || 'Protected session'}</StatusPill>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {sectionTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => startTransition(() => setActiveTab(tab.id))}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-400/20 to-emerald-300/10 text-white'
                      : 'bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-2 ${isActive ? 'bg-cyan-400/15 text-cyan-100' : 'bg-slate-900 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{tab.label}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition ${isActive ? 'translate-x-1 text-cyan-100' : 'text-slate-600'}`} />
                </button>
              )
            })}
          </div>

          <div className="mt-8 rounded-[26px] border border-white/8 bg-slate-950/50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Permissions</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(admin?.permissions || []).slice(0, 8).map((permission) => (
                <span key={permission} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
                  {permission}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 font-semibold text-rose-100 transition hover:bg-rose-400/15"
            >
              <LogOut className="h-4 w-4" />
              End admin session
            </button>
          </div>
        </GlassPanel>

        <div className="flex-1 space-y-6 pb-10">
          <GlassPanel className="p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <StatusPill tone="success">System Control Panel</StatusPill>
                <h1 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
                  Universal admin dashboard for platform command.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Manage platform users, system settings, content, APIs, security, analytics, and infrastructure from a single operational view.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-center gap-3 text-cyan-200">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.2em]">2FA</span>
                  </div>
                  <p className="mt-3 text-sm text-white">Enforced</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-center gap-3 text-emerald-200">
                    <Network className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.2em]">IP</span>
                  </div>
                  <p className="mt-3 text-sm text-white">Monitored</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-center gap-3 text-amber-200">
                    <BadgeCheck className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.2em]">Role</span>
                  </div>
                  <p className="mt-3 text-sm text-white">{admin?.roleLabel || admin?.role}</p>
                </div>
              </div>
            </div>
          </GlassPanel>

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {activeTab === 'overview' ? <OverviewTab dashboard={dashboard} onRefresh={handleRefresh} isRefreshing={isRefreshing} /> : null}
          {activeTab === 'users' ? <UsersTab dashboard={dashboard} users={users} isRefreshing={isRefreshing} /> : null}
          {activeTab === 'content' ? <ContentTab dashboard={dashboard} /> : null}
          {activeTab === 'operations' ? <OperationsTab dashboard={dashboard} settings={settings} /> : null}
        </div>
      </div>
    </div>
  )
}

const AdminControlPanel = () => {
  const isAuthenticated = useAdminStore((state) => state.isAuthenticated)

  return isAuthenticated ? <AdminDashboardView /> : <AdminAuthView />
}

export default AdminControlPanel
