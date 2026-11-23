import { create } from 'zustand'

import adminApi, { clearAdminToken, getAdminToken, setAdminToken } from '@config/adminAxios'

const initialState = {
  admin: null,
  token: getAdminToken(),
  isAuthenticated: Boolean(getAdminToken()),
  isInitializing: true,
  isLoading: false,
  isRefreshing: false,
  error: null,
  challengeToken: null,
  challengeMeta: null,
  dashboard: null,
  users: [],
  settings: null,
}

const useAdminStore = create((set, get) => ({
  ...initialState,

  initializeAdmin: async () => {
    const token = getAdminToken()

    if (!token) {
      set({
        admin: null,
        token: null,
        isAuthenticated: false,
        isInitializing: false,
      })
      return
    }

    set({ isInitializing: true, error: null })

    try {
      const response = await adminApi.get('/api/admin/profile')
      set({
        admin: response.data.admin,
        token,
        isAuthenticated: true,
        isInitializing: false,
      })
    } catch (error) {
      clearAdminToken()
      set({
        admin: null,
        token: null,
        isAuthenticated: false,
        isInitializing: false,
        challengeToken: null,
        challengeMeta: null,
        error: error.response?.data?.error || 'Admin session expired',
      })
    }
  },

  login: async ({ email, password }) => {
    set({ isLoading: true, error: null })

    try {
      const response = await adminApi.post('/api/admin/login', { email, password })
      set({
        isLoading: false,
        challengeToken: response.data.challengeToken,
        challengeMeta: {
          admin: response.data.admin,
          expiresAt: response.data.expiresAt,
          developmentCode: response.data.developmentCode || null,
          ipMonitoring: response.data.ipMonitoring,
        },
      })
      return response.data
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to login as admin'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  verifyTwoFactor: async ({ code }) => {
    const challengeToken = get().challengeToken

    if (!challengeToken) {
      const message = 'Admin challenge missing. Login again.'
      set({ error: message })
      throw new Error(message)
    }

    set({ isLoading: true, error: null })

    try {
      const response = await adminApi.post('/api/admin/verify-2fa', {
        challengeToken,
        code,
      })

      setAdminToken(response.data.token)

      set({
        admin: response.data.admin,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
        challengeToken: null,
        challengeMeta: null,
        error: null,
      })

      return response.data.admin
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to verify admin code'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  fetchDashboard: async () => {
    set({ isRefreshing: true, error: null })

    try {
      const response = await adminApi.get('/api/admin/dashboard')
      set({
        dashboard: response.data,
        settings: response.data.settings || get().settings,
        isRefreshing: false,
      })
      return response.data
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load admin dashboard'
      set({ isRefreshing: false, error: message })
      if (error.response?.status === 401) {
        get().logout()
      }
      throw new Error(message)
    }
  },

  fetchUsers: async (search = '') => {
    set({ isRefreshing: true, error: null })

    try {
      const response = await adminApi.get('/api/admin/users', {
        params: search ? { search } : undefined,
      })
      set({
        users: response.data.users || [],
        isRefreshing: false,
      })
      return response.data.users || []
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load platform users'
      set({ isRefreshing: false, error: message })
      throw new Error(message)
    }
  },

  fetchSettings: async () => {
    set({ isRefreshing: true, error: null })

    try {
      const response = await adminApi.get('/api/admin/settings')
      set({
        settings: response.data.settings,
        isRefreshing: false,
      })
      return response.data.settings
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load system settings'
      set({ isRefreshing: false, error: message })
      throw new Error(message)
    }
  },

  updateSettings: async (nextSettings) => {
    set({ isRefreshing: true, error: null })

    try {
      const response = await adminApi.put('/api/admin/settings', nextSettings)
      set((state) => ({
        settings: response.data.settings,
        dashboard: state.dashboard
          ? {
              ...state.dashboard,
              settings: response.data.settings,
            }
          : state.dashboard,
        isRefreshing: false,
      }))
      return response.data.settings
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save system settings'
      set({ isRefreshing: false, error: message })
      throw new Error(message)
    }
  },

  suspendUser: async (userId, suspended, reason = '') => {
    await adminApi.put(`/api/admin/users/${userId}/suspend`, {
      suspended,
      reason,
    })

    set((state) => ({
      users: state.users.map((user) => (
        user.id === userId
          ? { ...user, accountStatus: suspended ? 'suspended' : 'active' }
          : user
      )),
      dashboard: state.dashboard
        ? {
            ...state.dashboard,
            users: {
              ...state.dashboard.users,
              totals: {
                ...state.dashboard.users.totals,
                suspended: Math.max(
                  0,
                  (state.dashboard.users.totals?.suspended || 0) + (suspended ? 1 : -1)
                ),
              },
            },
          }
        : state.dashboard,
    }))
  },

  verifyUser: async (userId, verified = true) => {
    await adminApi.put(`/api/admin/users/${userId}/verify`, {
      verified,
    })

    set((state) => ({
      users: state.users.map((user) => (
        user.id === userId
          ? { ...user, isVerified: verified }
          : user
      )),
    }))
  },

  deleteUser: async (userId) => {
    await adminApi.delete(`/api/admin/users/${userId}`)

    set((state) => ({
      users: state.users.filter((user) => user.id !== userId),
      dashboard: state.dashboard
        ? {
            ...state.dashboard,
            users: {
              ...state.dashboard.users,
              totals: {
                ...state.dashboard.users.totals,
                total: Math.max(0, (state.dashboard.users.totals?.total || 0) - 1),
              },
              recent: (state.dashboard.users.recent || []).filter((user) => user.id !== userId),
            },
          }
        : state.dashboard,
    }))
  },

  clearError: () => set({ error: null }),

  clearChallenge: () => set({ challengeToken: null, challengeMeta: null, error: null }),

  logout: () => {
    clearAdminToken()
    set({
      ...initialState,
      token: null,
      isAuthenticated: false,
      isInitializing: false,
    })
  },
}))

export default useAdminStore
