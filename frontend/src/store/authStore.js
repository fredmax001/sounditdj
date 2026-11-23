import { create } from 'zustand'
import axios, { clearAuthToken, getAuthToken, setAuthToken } from '../config/axios.js'

const useAuthStore = create((set) => ({
  user: { id: 'local-dj', name: 'DJ User', email: '' },
  token: getAuthToken() || null,
  isAuthenticated: true, // Always allow local DJ library access offline
  isCloudConnected: false, // True when signed in with a verified sounditdj.cloud JWT
  isInitializing: false,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    const savedToken = getAuthToken()
    if (!savedToken || savedToken === 'dev-token') {
      if (savedToken === 'dev-token') clearAuthToken()
      set({
        user: { id: 'local-dj', name: 'DJ User', email: '' },
        token: null,
        isAuthenticated: true,
        isCloudConnected: false,
        isInitializing: false,
      })
      return
    }

    try {
      const response = await axios.get('/api/auth/me', { timeout: 6000 })
      const user = response.data?.user || response.data
      if (user?.id) {
        set({
          user,
          token: savedToken,
          isAuthenticated: true,
          isCloudConnected: true,
          isInitializing: false,
        })
        return
      }
    } catch {
      // Token expired or offline — stay usable locally
    }

    set({
      user: { id: 'local-dj', name: 'DJ User', email: '' },
      token: null,
      isAuthenticated: true,
      isCloudConnected: false,
      isInitializing: false,
    })
  },

  login: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.post('/api/auth/login', { email, password }, { timeout: 12000 })
      const { token, user } = response.data
      setAuthToken(token)
      set({
        user,
        token,
        isAuthenticated: true,
        isCloudConnected: true,
        isLoading: false,
        error: null,
      })
      return user
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to sign in to sounditdj.cloud'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  register: async ({ name, email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.post('/api/auth/register', { name, email, password }, { timeout: 12000 })
      const { token, user } = response.data
      setAuthToken(token)
      set({
        user,
        token,
        isAuthenticated: true,
        isCloudConnected: true,
        isLoading: false,
        error: null,
      })
      return user
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to create account'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  logout: async () => {
    try {
      await axios.post('/api/auth/logout')
    } catch {
      // ignore
    }
    clearAuthToken()
    set({
      user: { id: 'local-dj', name: 'DJ User', email: '' },
      token: null,
      isAuthenticated: true,
      isCloudConnected: false,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
}))

export default useAuthStore
