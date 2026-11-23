import axios from 'axios'

function trimTrailingSlash(value = '') {
  if (!value || value === '/') {
    return value
  }
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function stripApiSuffix(value = '') {
  return value.endsWith('/api') ? value.slice(0, -4) || '' : value
}

export const API_URL = trimTrailingSlash(import.meta.env.VITE_API_URL || 'http://localhost:3001')
export const API_BASE_URL = stripApiSuffix(API_URL)
export const MEDIA_BASE_URL = API_BASE_URL
const TOKEN_KEY = 'fmx_access_token'

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthToken()
    }

    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
