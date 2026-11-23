import { create } from 'zustand'
import axios from '../config/axios.js'

function normalizeHistoryEntry(entry) {
  return {
    ...entry,
    fileName: entry.fileName || entry.file_name || 'Untitled analysis',
    createdAt: entry.createdAt || entry.created_at || null,
  }
}

const useAnalyzerStore = create((set, get) => ({
  // Analysis state
  isAnalyzing: false,
  analysisProgress: 0,
  analysisStage: '',
  analysisError: null,
  currentJobId: null,

  // Results
  analysisResults: null,
  tracklist: [],
  detectedBpm: null,
  detectedKey: null,
  segments: [],

  // History
  analysisHistory: [],

  // Actions
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setAnalysisStage: (stage) => set({ analysisStage: stage }),
  setAnalysisError: (error) => set({ analysisError: error }),
  setCurrentJobId: (jobId) => set({ currentJobId: jobId }),

  // Start analysis
  startAnalysis: async (file) => {
    const formData = new FormData()
    formData.append('mix', file)

    set({
      isAnalyzing: true,
      analysisProgress: 0,
      analysisStage: 'uploading',
      analysisError: null,
      analysisResults: null,
      tracklist: [],
    })

    try {
      const response = await axios.post('/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const { jobId } = response.data
      set({ currentJobId: jobId })

      // Start polling for status
      get().pollAnalysisStatus(jobId)

      return jobId
    } catch (error) {
      set({
        isAnalyzing: false,
        analysisError: error.response?.data?.error || error.message,
      })
      throw error
    }
  },

  // Start analysis from URL
  startAnalysisUrl: async (audioUrl) => {
    set({
      isAnalyzing: true,
      analysisProgress: 0,
      analysisStage: 'uploading',
      analysisError: null,
      analysisResults: null,
      tracklist: [],
    })

    try {
      const response = await axios.post('/api/analyze/url', { audioUrl })

      const { jobId } = response.data
      set({ currentJobId: jobId })

      // Start polling for status
      get().pollAnalysisStatus(jobId)

      return jobId
    } catch (error) {
      set({
        isAnalyzing: false,
        analysisError: error.response?.data?.error || error.message,
      })
      throw error
    }
  },

  // Poll analysis status
  pollAnalysisStatus: async (jobId) => {
    const poll = async () => {
      try {
        const response = await axios.get(`/api/analyze/status/${jobId}`)
        const { status, progress, stage, results } = response.data

        set({
          analysisProgress: progress,
          analysisStage: stage,
        })

        if (status === 'completed') {
          set({
            isAnalyzing: false,
            analysisProgress: 100,
            analysisResults: results,
            tracklist: results.tracklist || [],
            detectedBpm: results.bpm,
            detectedKey: results.key,
            segments: results.segments || [],
          })
          // Add to history
          set((state) => ({
            analysisHistory: [results, ...state.analysisHistory].slice(0, 20),
          }))
          return true
        } else if (status === 'error') {
          set({
            isAnalyzing: false,
            analysisError: results?.error || 'Analysis failed',
          })
          return true
        }

        // Continue polling
        setTimeout(poll, 1000)
        return false
      } catch (error) {
        set({
          isAnalyzing: false,
          analysisError: error.message,
        })
        return true
      }
    }

    poll()
  },

  // Clear current analysis
  clearAnalysis: () =>
    set({
      isAnalyzing: false,
      analysisProgress: 0,
      analysisStage: '',
      analysisError: null,
      currentJobId: null,
      analysisResults: null,
      tracklist: [],
      detectedBpm: null,
      detectedKey: null,
      segments: [],
    }),

  // Export tracklist
  exportTracklist: (format = 'txt') => {
    const { tracklist } = get()
    
    let content = ''
    if (format === 'txt') {
      content = tracklist
        .map((track) => `${track.timestamp} - ${track.artist} - ${track.title}`)
        .join('\n')
    } else if (format === 'csv') {
      content = 'Timestamp,Artist,Title,BPM,Confidence\n'
      content += tracklist
        .map(
          (track) =>
            `"${track.timestamp}","${track.artist}","${track.title}","${track.bpm || ''}","${track.confidence || ''}"`
        )
        .join('\n')
    }

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracklist.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  // Fetch analysis history
  fetchHistory: async () => {
    try {
      const response = await axios.get('/api/analyze/history')
      set({
        analysisHistory: (response.data.history || []).map(normalizeHistoryEntry),
      })
    } catch (error) {
      console.error('Failed to fetch analysis history:', error)
    }
  },

  // Update track in tracklist
  updateTrack: (index, updates) => {
    set((state) => ({
      tracklist: state.tracklist.map((track, i) =>
        i === index ? { ...track, ...updates } : track
      ),
    }))
  },
}))

export default useAnalyzerStore
