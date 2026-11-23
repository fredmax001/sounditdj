import React, { useState } from 'react'
import { Loader2, Cloud, CloudOff, X, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import useLibraryStore from '@store/libraryStore'
import useAuthStore from '@store/authStore'

const tabs = [
  { id: 'library', label: 'Library' },
  { id: 'settings', label: 'Settings' },
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'tools', label: 'Tools' },
  { id: 'integration', label: 'Integration' },
]

function TopNav({ activeTab, onTabChange, onOpenImportProgress }) {
  const isMacDesktop = window.electronAPI?.isMac
  const importProgress = useLibraryStore((s) => s.importProgress)
  const { user, isCloudConnected, isLoading, login, register, logout } = useAuthStore()

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authErr, setAuthErr] = useState('')

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthErr('')
    try {
      if (authMode === 'login') {
        await login({ email: email.trim(), password })
        toast.success('Connected online to Sound It DJ Cloud!')
      } else {
        await register({ name: name.trim(), email: email.trim(), password })
        toast.success('Account created & connected to Sound It DJ Cloud!')
      }
      setShowAuthModal(false)
      setPassword('')
    } catch (err) {
      setAuthErr(err.message || 'Authentication failed')
    }
  }

  return (
    <>
      <div
        className="relative h-14 bg-background-primary border-b border-border flex items-center justify-between shrink-0 select-none"
        style={{
          WebkitAppRegion: 'drag',
          paddingLeft: isMacDesktop ? '84px' : '16px',
          paddingRight: '16px',
        }}
      >
        {/* Left: Brand Emblem + Live Analysis Indicator */}
        <div className="flex items-center gap-3 min-w-[200px]" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="flex items-center gap-2">
            <img
              src="./brandmark.jpg"
              alt="Sound It DJ Emblem"
              className="h-7 w-7 rounded-md object-cover border border-brand-accent/30 pointer-events-none"
            />
            <span className="text-[12px] font-bold tracking-wider text-brand-accent uppercase hidden lg:inline">
              Sound It DJ
            </span>
          </div>

          {importProgress?.active && (
            <button
              onClick={() => {
                onTabChange('import')
                onOpenImportProgress?.()
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background-secondary border border-brand-accent/30 hover:border-brand-accent text-[11px] font-mono text-brand-accent transition-colors"
              title="View Import Progress"
            >
              <Loader2 className="w-3 h-3 animate-spin text-brand-sky" />
              <span>
                {importProgress.total > 0
                  ? `Analysing ${importProgress.analyzed}/${importProgress.total}`
                  : 'Importing...'}
              </span>
            </button>
          )}
        </div>

        {/* Center: MIXO-style Segmented Top Tabs */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-background-secondary p-1 rounded-lg border border-border/60 shadow-xs"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative px-4 py-1 text-[13px] font-medium rounded-md transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-accent text-brand-primary shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                }`}
              >
                {tab.label}
                {tab.id === 'import' && importProgress?.active && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-sky animate-pulse" />
                )}
              </button>
            )
          })}
        </div>

        {/* Right: Online Cloud Status Pill + Wordmark */}
        <div className="flex items-center justify-end gap-3 min-w-[200px]" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
              isCloudConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-brand-sky-dim text-brand-sky border-brand-sky/40 hover:bg-brand-sky hover:text-brand-primary'
            }`}
            title={isCloudConnected ? `Signed in as ${user?.email || user?.name}` : 'Sign in to sounditdj.cloud for Mix Analyzer & online APIs'}
          >
            {isCloudConnected ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
            <span>{isCloudConnected ? (user?.name || 'Online') : 'Sign In Online'}</span>
          </button>

          <img
            src="./logo.png"
            alt="Sound It DJ"
            className="h-6 w-auto object-contain pointer-events-none hidden xl:block"
          />
        </div>
      </div>

      {/* Sound It DJ Cloud Sign-In Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-background-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-brand-accent" />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Sound It DJ Cloud
                </h2>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isCloudConnected ? (
              <div className="p-5 space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3.5 text-xs">
                  <div className="font-semibold text-emerald-300">Connected to sounditdj.cloud</div>
                  <div className="text-text-secondary mt-1">
                    Signed in as <span className="text-text-primary font-mono">{user?.email || user?.name}</span>. Mix Analyzer, Shazam, SoundCloud, Audiomack, and Cloud Sync are active.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await logout()
                    toast('Signed out of Sound It DJ Cloud')
                    setShowAuthModal(false)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="p-5 space-y-3.5">
                <p className="text-xs text-text-secondary">
                  Sign in with your <span className="text-brand-sky font-mono">sounditdj.cloud</span> account to connect online for Mix Analyzer, Shazam, SoundCloud, Audiomack, and Boomplay APIs.
                </p>

                {authErr && (
                  <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                    {authErr}
                  </div>
                )}

                {authMode === 'register' && (
                  <div>
                    <label className="block text-[11px] text-text-muted uppercase mb-1">DJ Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="DJ Fred Max"
                      className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-text-muted uppercase mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-text-muted uppercase mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-50 text-brand-primary text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  {isLoading ? 'Connecting...' : authMode === 'login' ? 'Sign In & Connect Online' : 'Create Account & Connect'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login')
                      setAuthErr('')
                    }}
                    className="text-[11px] text-brand-sky hover:underline"
                  >
                    {authMode === 'login' ? 'Need an account? Register on sounditdj.cloud' : 'Already have an account? Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default TopNav
