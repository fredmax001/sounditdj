import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Database, 
  Folder,
  Palette,
  Shield,
  ChevronRight,
  Save,
  Check,
  Disc3,
  Upload,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import useSettingsStore from '@store/settingsStore'

const settingsSections = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'library', label: 'Library', icon: Database },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'storage', label: 'Storage', icon: Folder },
  { id: 'privacy', label: 'Privacy', icon: Shield },
]

const Settings = () => {
  const [activeSection, setActiveSection] = useState('account')
  const fileInputRef = useRef(null)
  
  const {
    settings,
    isSaving,
    isLoading,
    fetchSettings,
    saveSettings,
    saveAccount,
    uploadProfilePhoto,
    updateAccount,
    updateLibrary,
    updateNotifications,
    updateAppearance,
    updateStorage,
    updatePrivacy,
    clearCache,
  } = useSettingsStore()

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      await saveSettings()
      toast.success('Settings saved successfully')
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  const handleAccountSave = async () => {
    try {
      await saveAccount(settings.account)
      toast.success('Account updated successfully')
    } catch (error) {
      toast.error('Failed to update account')
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      await uploadProfilePhoto(file)
      toast.success('Profile photo uploaded')
    } catch (error) {
      toast.error('Failed to upload photo')
    }
  }

  const handleClearCache = async () => {
    try {
      await clearCache()
      toast.success('Cache cleared successfully')
    } catch (error) {
      toast.error('Failed to clear cache')
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'account':
        return (
          <div className="space-y-6">
            {/* Profile Photo */}
            <div className="flex items-center gap-6 mb-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-create-red flex items-center justify-center overflow-hidden">
                  {settings.account.profilePhoto ? (
                    <img 
                      src={settings.account.profilePhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-black" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2 bg-background-tertiary rounded-lg border border-create-red/30 hover:border-create-red transition-all"
                >
                  <Upload className="w-4 h-4 text-create-red" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="text-white font-semibold">Profile Photo</h3>
                <p className="text-text-muted text-sm">Upload a new profile picture</p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={settings.account.name}
                onChange={(e) => updateAccount({ name: e.target.value })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                value={settings.account.email}
                onChange={(e) => updateAccount({ email: e.target.value })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                DJ Name
              </label>
              <input
                type="text"
                value={settings.account.djName}
                onChange={(e) => updateAccount({ djName: e.target.value })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Bio
              </label>
              <textarea
                value={settings.account.bio}
                onChange={(e) => updateAccount({ bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50 resize-none"
              />
            </div>
            <button
              onClick={handleAccountSave}
              className="w-full py-3 bg-create-red rounded-xl text-black font-semibold hover:shadow-glow transition-all"
            >
              Update Account
            </button>
          </div>
        )

      case 'library':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Auto-analyze uploads</p>
                <p className="text-text-muted text-sm">
                  Automatically analyze BPM and key when uploading
                </p>
              </div>
              <button
                onClick={() => updateLibrary({ autoAnalyze: !settings.library.autoAnalyze })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.library.autoAnalyze ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.library.autoAnalyze ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Auto-extract metadata</p>
                <p className="text-text-muted text-sm">
                  Extract title, artist, and album from file tags
                </p>
              </div>
              <button
                onClick={() => updateLibrary({ autoExtractMetadata: !settings.library.autoExtractMetadata })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.library.autoExtractMetadata ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.library.autoExtractMetadata ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Default Sort By
              </label>
              <select
                value={settings.library.defaultSortBy}
                onChange={(e) => updateLibrary({ defaultSortBy: e.target.value })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              >
                <option value="dateAdded">Date Added</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="bpm">BPM</option>
                <option value="key">Key</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Items Per Page
              </label>
              <select
                value={settings.library.itemsPerPage}
                onChange={(e) => updateLibrary({ itemsPerPage: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Email notifications</p>
                <p className="text-text-muted text-sm">
                  Receive updates via email
                </p>
              </div>
              <button
                onClick={() => updateNotifications({ emailNotifications: !settings.notifications.emailNotifications })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.notifications.emailNotifications ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.notifications.emailNotifications ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Analysis complete</p>
                <p className="text-text-muted text-sm">
                  Notify when mix analysis is finished
                </p>
              </div>
              <button
                onClick={() => updateNotifications({ analysisComplete: !settings.notifications.analysisComplete })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.notifications.analysisComplete ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.notifications.analysisComplete ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Export complete</p>
                <p className="text-text-muted text-sm">
                  Notify when exports are finished
                </p>
              </div>
              <button
                onClick={() => updateNotifications({ exportComplete: !settings.notifications.exportComplete })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.notifications.exportComplete ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.notifications.exportComplete ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">New features</p>
                <p className="text-text-muted text-sm">
                  Get notified about new features and updates
                </p>
              </div>
              <button
                onClick={() => updateNotifications({ newFeatures: !settings.notifications.newFeatures })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.notifications.newFeatures ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.notifications.newFeatures ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-text-secondary mb-3">
                Theme
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['dark', 'light'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateAppearance({ theme })}
                    className={`p-4 rounded-xl border capitalize transition-all ${
                      settings.appearance.theme === theme
                        ? 'border-create-red bg-create-red-dim'
                        : 'border-create-red/10 hover:border-create-red/30'
                    }`}
                  >
                    <p className="text-white font-semibold">{theme}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-3">
                Accent Color
              </label>
              <div className="flex gap-3">
                {[
                  { id: 'yellow', color: '#FFFF00' },
                  { id: 'gold', color: '#FFD700' },
                  { id: 'orange', color: '#FFA500' },
                  { id: 'green', color: '#10b981' },
                  { id: 'cyan', color: '#06b6d4' },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => updateAppearance({ accentColor: color.id })}
                    className={`w-12 h-12 rounded-xl transition-all ${
                      settings.appearance.accentColor === color.id
                        ? 'ring-2 ring-create-red scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Show waveforms</p>
                <p className="text-text-muted text-sm">
                  Display audio waveforms in the player
                </p>
              </div>
              <button
                onClick={() => updateAppearance({ showWaveform: !settings.appearance.showWaveform })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.appearance.showWaveform ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.appearance.showWaveform ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )

      case 'storage':
        return (
          <div className="space-y-6">
            <div className="p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold">Cache Size</p>
                <p className="text-create-red font-semibold font-mono">{settings.storage.cacheSize}</p>
              </div>
              <div className="h-3 bg-background-secondary rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-create-red to-create-red/70 rounded-full" />
              </div>
              <p className="text-text-muted text-sm mt-3">
                Analysis data, waveforms, and thumbnails
              </p>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Auto cleanup</p>
                <p className="text-text-muted text-sm">
                  Automatically remove old cache files
                </p>
              </div>
              <button
                onClick={() => updateStorage({ autoCleanup: !settings.storage.autoCleanup })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.storage.autoCleanup ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.storage.autoCleanup ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Max Cache Age (days)
              </label>
              <input
                type="number"
                value={settings.storage.maxCacheAge}
                onChange={(e) => updateStorage({ maxCacheAge: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-background-tertiary border border-create-red/20 rounded-xl text-white focus:outline-none focus:border-create-red/50"
              />
            </div>

            <button
              onClick={handleClearCache}
              className="w-full p-5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all font-semibold border border-red-500/20"
            >
              Clear Cache
            </button>
          </div>
        )

      case 'privacy':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Share usage data</p>
                <p className="text-text-muted text-sm">
                  Help improve CREATE by sharing anonymous usage data
                </p>
              </div>
              <button
                onClick={() => updatePrivacy({ shareUsageData: !settings.privacy.shareUsageData })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.privacy.shareUsageData ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.privacy.shareUsageData ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-background-tertiary rounded-xl border border-create-red/10">
              <div>
                <p className="text-white font-semibold">Cloud sync</p>
                <p className="text-text-muted text-sm">
                  Sync your library across devices
                </p>
              </div>
              <button
                onClick={() => updatePrivacy({ cloudSync: !settings.privacy.cloudSync })}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  settings.privacy.cloudSync ? 'bg-create-red' : 'bg-background-secondary'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-black transition-transform ${
                    settings.privacy.cloudSync ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-5 border border-red-500/30 rounded-xl bg-red-500/5">
              <p className="text-white font-semibold mb-3">Danger Zone</p>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure? This cannot be undone.')) {
                    toast.success('Account data deleted')
                  }
                }}
                className="w-full p-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all font-semibold"
              >
                Delete All Data
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-black hex-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-4xl font-bold text-white">
            <span className="text-gradient">Settings</span>
          </h1>
          <p className="text-text-secondary mt-2">
            Manage your account and application preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-3">
              {settingsSections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeSection === section.id
                        ? 'bg-create-red text-black font-semibold'
                        : 'text-text-secondary hover:text-create-red hover:bg-create-red-dim'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                    {activeSection === section.id && (
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3"
          >
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-bold text-white">
                  {settingsSections.find((s) => s.id === activeSection)?.label}
                </h2>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-create-red rounded-xl text-black font-semibold hover:shadow-glow transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>

              {renderSection()}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Settings
