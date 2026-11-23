import React, { useEffect } from 'react'
import { User, LogOut, Lock, CreditCard, Trash2, Music, HardDrive, Disc3, Cloud, ChevronRight as ChevronRightIcon, BarChart2, Settings2, Download, History, HelpCircle, Keyboard, RefreshCcw, AlertTriangle, ExternalLink, Folder } from 'lucide-react'
import useSettingsStore from '@store/settingsStore'
import useLibraryStore from '@store/libraryStore'
import useAuthStore from '@store/authStore'
import toast from 'react-hot-toast'

function SettingsView({ activeSubItem = 'account' }) {
  const { settings, fetchSettings } = useSettingsStore()
  const { tracks, playlists, fetchTracks, fetchPlaylists } = useLibraryStore()
  const { user, logout } = useAuthStore()

  useEffect(() => {
    fetchSettings()
    fetchTracks()
    fetchPlaylists()
  }, [fetchSettings, fetchTracks, fetchPlaylists])

  const account = settings?.account || {}
  const totalPlaylistTracks = playlists.reduce((sum, p) => sum + (p.track_count || 0), 0)

  const handleNotImplemented = () => {
    toast('This feature is coming soon!', { icon: '🚧' })
  }

  const handleOpenFolder = (type) => {
    if (window.electronAPI && window.electronAPI.openFolder) {
      window.electronAPI.openFolder(type)
      toast.success('Folder opened')
    } else {
      toast.error('Electron API not available')
    }
  }

  const renderContent = () => {
    switch (activeSubItem) {
      case 'account':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">ACCOUNT</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* User Card */}
              <div className="bg-background-secondary border border-border rounded-lg p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-background-tertiary rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">USER</h3>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">Name:</span>
                    <span className="text-[12px] text-text-primary flex items-center gap-1 cursor-pointer hover:text-brand-accent">
                      {account.name || user?.name || 'DJ User'} <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">Email:</span>
                    <span className="text-[12px] text-text-primary flex items-center gap-1 cursor-pointer hover:text-brand-accent">
                      {account.email || user?.email || 'user@sounditdj.com'} <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">DJ Name:</span>
                    <span className="text-[12px] text-text-primary">
                      {account.djName || 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">Subscription:</span>
                    <span className="text-[12px] text-brand-accent font-medium uppercase">PREMIUM</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-text-secondary" />
                    Change Password
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </button>
                
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-text-secondary" />
                    Billing
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </button>

                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 text-text-secondary" />
                    Log Out
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border">
              <button className="flex items-center gap-2 text-[12px] text-error hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            </div>
          </>
        )

      case 'stats':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">STATS</h1>
            <div className="bg-background-secondary border border-border rounded-lg p-5 max-w-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-background-tertiary rounded-lg flex items-center justify-center">
                  <Music className="w-5 h-5 text-text-secondary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">LIBRARY</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Tracks:</span>
                  <span className="text-[12px] text-text-primary font-mono">{tracks.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Playlists:</span>
                  <span className="text-[12px] text-text-primary font-mono">{playlists.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Playlist Tracks:</span>
                  <span className="text-[12px] text-text-primary font-mono">{totalPlaylistTracks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Cues/Loops:</span>
                  <span className="text-[12px] text-text-primary font-mono">0</span>
                </div>
              </div>
            </div>
          </>
        )

      case 'downloads':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">DOWNLOADS</h1>
            <div className="max-w-2xl">
              <p className="text-[12px] text-text-secondary mb-6">Total downloaded tracks: 0</p>
              
              <div className="space-y-2">
                <button onClick={() => handleOpenFolder('downloads')} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Open Download Folder</span>
                  <Folder className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Check Downloads</span>
                  <RefreshCcw className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Delete Orphaned Downloads</span>
                  <Trash2 className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Flatten Download Folders</span>
                  <Disc3 className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              <div className="mt-8 text-[11px] text-text-muted">
                (No downloads in progress)
              </div>
            </div>
          </>
        )

      case 'backups':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">BACKUPS</h1>
            <div className="max-w-3xl">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-2 text-[12px] text-text-secondary">
                  <p><strong className="text-text-primary uppercase">IMPORTS:</strong> Backups are saved for all XML and NML files you import.</p>
                  <p><strong className="text-text-primary uppercase">EXPORTS:</strong> Due to overwriting existing files, backups are also saved for Serato and VDJ exports, so that you can restore your old library if you need to.</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded text-[11px] text-text-primary hover:bg-background-tertiary transition-colors shrink-0">
                  Backups Guide <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4 text-[12px] text-text-primary">
                <span>Number of backups (per app):</span>
                <select className="bg-background-tertiary border border-border rounded px-2 py-1 outline-none">
                  <option>5</option>
                  <option>10</option>
                  <option>20</option>
                  <option>50</option>
                </select>
              </div>
              <p className="text-[12px] text-text-secondary mb-6">Total size of backups folder: <span className="font-mono text-text-primary">0.00 GB</span></p>

              <button onClick={() => handleOpenFolder('backups')} className="w-64 flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors mb-10">
                <span className="font-medium">Open Backup Folder</span>
                <Folder className="w-4 h-4 text-text-muted" />
              </button>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-2">SOUND IT DJ - BACKUP AND RESTORE</h3>
                <p className="text-[12px] text-text-secondary mb-4 max-w-xl">Use this feature to backup your library regularly. If you accidentally Reset SOUND IT DJ or your library becomes corrupted, you can restore to a previous state.</p>
                
                <button onClick={handleNotImplemented} className="w-64 flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors mb-6">
                  <span className="font-medium">Create New Backup</span>
                  <History className="w-4 h-4 text-text-muted" />
                </button>

                <p className="text-[12px] text-text-muted">No backups found</p>
              </div>
            </div>
          </>
        )

      case 'support':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">SUPPORT</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <HelpCircle className="w-4 h-4 text-text-muted" />
                <span className="font-medium">Email Us</span>
              </button>
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <HelpCircle className="w-4 h-4 text-text-muted" />
                <span className="font-medium">FAQs</span>
              </button>
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <AlertTriangle className="w-4 h-4 text-text-muted" />
                <span className="font-medium">Report a Bug</span>
              </button>
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <ExternalLink className="w-4 h-4 text-text-muted" />
                <span className="font-medium">Instagram</span>
              </button>
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <ExternalLink className="w-4 h-4 text-text-muted" />
                <span className="font-medium">Facebook</span>
              </button>
              <button className="flex items-center gap-3 px-5 py-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                <ExternalLink className="w-4 h-4 text-text-muted" />
                <span className="font-medium">Reddit</span>
              </button>
            </div>
          </>
        )

      case 'keyboard':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">KEYBOARD SHORTCUTS</h1>
            <div className="max-w-3xl space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4">TRACK LIST</h3>
                <div className="space-y-2">
                  {[
                    ['Focus search', 'Cmd + F'],
                    ['Toggle select all tracks', 'Cmd + A'],
                    ['Deselect all tracks', 'Esc'],
                    ['Delete selected tracks', 'Del'],
                    ['Toggle track info for selected', 'Cmd + I'],
                    ['Save track info', 'Cmd + S'],
                    ['New Playlist', 'Cmd + N'],
                    ['Add selected to playlist', 'Cmd + P'],
                    ['Add Tags to selected', 'Cmd + T'],
                    ['Select track above', '↑'],
                    ['Select track below', '↓'],
                    ['Play selected track', 'Enter']
                  ].map(([label, shortcut], i) => (
                    <div key={i} className="flex justify-between items-center text-[12px]">
                      <span className="text-text-secondary flex items-center gap-2">
                        <Search className="w-3.5 h-3.5" /> {label}
                      </span>
                      <span className="font-mono text-text-primary bg-background-secondary px-2 py-1 rounded">{shortcut}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4">PLAYER</h3>
                <div className="space-y-2">
                  {[
                    ['Toggle track info for track', 'Cmd + i'],
                    ['Play/Add cue points 1-8', '1 - 8'],
                    ['Delete cue points 1-8', 'Cmd + 1-8'],
                    ['Play/Pause track', 'Space'],
                    ['Next track', '▶▶'],
                    ['Previous track', '◀◀'],
                    ['Waveform zoom in', 'Cmd + +'],
                    ['Waveform zoom out', 'Cmd + -'],
                    ['Rate track (1-star increments)', 'R']
                  ].map(([label, shortcut], i) => (
                    <div key={i} className="flex justify-between items-center text-[12px]">
                      <span className="text-text-secondary flex items-center gap-2">
                        <Play className="w-3.5 h-3.5" /> {label}
                      </span>
                      <span className="font-mono text-text-primary bg-background-secondary px-2 py-1 rounded">{shortcut}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )

      case 'reset-tools':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">RESET TOOLS</h1>
            <div className="max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button onClick={() => window.confirm('Are you sure you want to reset everything?')} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <AlertTriangle className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Reset Everything</span>
                </button>
                <button onClick={() => window.confirm('Are you sure you want to reset local library?')} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <AlertTriangle className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Reset Local Library</span>
                </button>
                <button onClick={handleNotImplemented} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <RefreshCcw className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Clear Cache</span>
                </button>
                <button onClick={handleNotImplemented} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <Trash2 className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Delete Upload Queue</span>
                </button>
                <button onClick={handleNotImplemented} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <Trash2 className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Delete Old Artwork</span>
                </button>
                <button onClick={handleNotImplemented} className="flex items-center gap-3 px-4 py-5 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <Trash2 className="w-4 h-4 text-text-muted" />
                  <span className="font-medium">Delete Old Waveforms</span>
                </button>
              </div>

              <p className="text-[12px] text-text-secondary mb-4">To resolve any issues that might occur after updating, you can completely reset your local copy of SOUND IT DJ by deleting the contents of the AppData folder.</p>
              
              <div className="space-y-2 max-w-sm">
                <button className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Delete AppData Guide</span>
                  <ExternalLink className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={() => handleOpenFolder('appdata')} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Open AppData Folder</span>
                  <Folder className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={() => handleOpenFolder('logs')} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors">
                  <span className="font-medium">Open Logs Folder</span>
                  <Folder className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={handleNotImplemented} className="w-full flex items-center justify-between px-4 py-3 bg-background-secondary hover:bg-background-tertiary border border-border rounded-lg text-[13px] text-text-primary transition-colors opacity-50 cursor-not-allowed">
                  <span className="font-medium text-text-secondary">Re-Sync This Library</span>
                  <RefreshCcw className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>
          </>
        )

      case 'advanced':
      case 'cloud':
        return (
          <>
            <h1 className="text-xl font-bold text-text-primary uppercase mb-6 tracking-wide">{activeSubItem}</h1>
            <div className="bg-background-secondary border border-border rounded-lg p-5">
              <p className="text-sm text-text-muted">Settings for {activeSubItem} will appear here.</p>
            </div>
          </>
        )

      default:
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-text-primary capitalize mb-2">{activeSubItem.replace('-', ' ')}</h2>
              <p className="text-sm text-text-muted">Settings for {activeSubItem} will appear here.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {renderContent()}

        <div className="mt-8 text-center text-[11px] text-text-muted pb-8">
          Version: 1.0.0
        </div>
      </div>
    </div>
  )
}

function ChevronRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default SettingsView
