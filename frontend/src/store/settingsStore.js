import { create } from 'zustand'
import axios from '../config/axios.js'

const useSettingsStore = create((set, get) => ({
  // Settings state
  settings: {
    account: {
      name: 'DJ User',
      email: 'user@example.com',
      djName: 'CREATE User',
      bio: 'Professional DJ and music producer',
      profilePhoto: null,
    },
    library: {
      autoAnalyze: true,
      autoExtractMetadata: true,
      defaultSortBy: 'dateAdded',
      itemsPerPage: 50,
    },
    notifications: {
      emailNotifications: true,
      analysisComplete: true,
      exportComplete: true,
      newFeatures: false,
    },
    appearance: {
      theme: 'dark',
      accentColor: 'yellow',
      waveColor: 'yellow',
      showWaveform: true,
    },
    storage: {
      cacheSize: '2.5 GB',
      autoCleanup: true,
      maxCacheAge: 30,
    },
    privacy: {
      shareUsageData: true,
      cloudSync: true,
    },
  },
  
  isLoading: false,
  isSaving: false,
  error: null,

  // Actions
  setSettings: (settings) => set({ settings }),
  
  updateAccount: (account) => set((state) => ({
    settings: { ...state.settings, account: { ...state.settings.account, ...account } }
  })),
  
  updateLibrary: (library) => set((state) => ({
    settings: { ...state.settings, library: { ...state.settings.library, ...library } }
  })),
  
  updateNotifications: (notifications) => set((state) => ({
    settings: { ...state.settings, notifications: { ...state.settings.notifications, ...notifications } }
  })),
  
  updateAppearance: (appearance) => set((state) => ({
    settings: { ...state.settings, appearance: { ...state.settings.appearance, ...appearance } }
  })),
  
  updateStorage: (storage) => set((state) => ({
    settings: { ...state.settings, storage: { ...state.settings.storage, ...storage } }
  })),
  
  updatePrivacy: (privacy) => set((state) => ({
    settings: { ...state.settings, privacy: { ...state.settings.privacy, ...privacy } }
  })),

  // Fetch settings from backend
  fetchSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.get('/api/settings')
      if (response.data.success && response.data.settings?.data) {
        set({ 
          settings: { ...get().settings, ...response.data.settings.data },
          isLoading: false 
        })
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      set({ error: error.message, isLoading: false })
    }
  },

  // Save all settings
  saveSettings: async () => {
    set({ isSaving: true })
    try {
      const { settings } = get()
      await axios.put('/api/settings', settings)
      set({ isSaving: false })
      return true
    } catch (error) {
      console.error('Failed to save settings:', error)
      set({ error: error.message, isSaving: false })
      throw error
    }
  },

  // Save account info
  saveAccount: async (accountData) => {
    try {
      await axios.put('/api/settings/account', accountData)
      set((state) => ({
        settings: { ...state.settings, account: { ...state.settings.account, ...accountData } }
      }))
      return true
    } catch (error) {
      console.error('Failed to save account:', error)
      throw error
    }
  },

  // Upload profile photo
  uploadProfilePhoto: async (file) => {
    const formData = new FormData()
    formData.append('photo', file)
    
    try {
      const response = await axios.post('/api/settings/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      if (response.data.success) {
        set((state) => ({
          settings: { 
            ...state.settings, 
            account: { 
              ...state.settings.account, 
              profilePhoto: response.data.photoUrl 
            } 
          }
        }))
        return response.data.photoUrl
      }
    } catch (error) {
      console.error('Failed to upload photo:', error)
      throw error
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      const response = await axios.post('/api/settings/clear-cache')
      return response.data
    } catch (error) {
      console.error('Failed to clear cache:', error)
      throw error
    }
  },

  // Get storage info
  fetchStorageInfo: async () => {
    try {
      const response = await axios.get('/api/settings/storage')
      if (response.data.success) {
        return response.data.storage
      }
    } catch (error) {
      console.error('Failed to fetch storage info:', error)
    }
  },
}))

export default useSettingsStore
