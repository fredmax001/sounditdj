import { create } from 'zustand'
import axios from '../config/axios.js'
import { AudioBandAnalyzer, SMOOTHING_PRESETS } from '../visualizer/analyzer.js'
import { BACKGROUNDS, BRAND_PALETTES, EXPORT_PRESETS, VISUALIZER_COLLECTIONS } from '../visualizer/renderers.js'

function defaultTextLayers() {
  return [
    {
      id: 'title',
      text: '',
      x: 50,
      y: 82,
      size: 56,
      weight: 700,
      color: '#FAE1AF',
      align: 'center',
      opacity: 1,
      uppercase: false,
      enabled: true,
    },
    {
      id: 'subtitle',
      text: 'Sound It DJ',
      x: 50,
      y: 90,
      size: 28,
      weight: 500,
      color: '#95CDFB',
      align: 'center',
      opacity: 0.95,
      uppercase: true,
      enabled: true,
    },
  ]
}

const analyzer = new AudioBandAnalyzer()

const useVisualizerStore = create((set, get) => ({
  // Premium visual config
  visualType: 'spectrum-pro',
  collectionId: 'club',
  paletteId: 'soundit-gold',
  primaryColor: BRAND_PALETTES[0].primary,
  secondaryColor: BRAND_PALETTES[0].secondary,
  highlightColor: BRAND_PALETTES[0].highlight,
  backgroundStyle: 'midnight',
  backgroundImage: null,
  logoImage: null,
  logoPosition: { x: 50, y: 18 },
  logoSize: 14,
  sensitivity: 1,
  smoothingPreset: 'medium',
  textLayers: defaultTextLayers(),
  exportPresetId: 'youtube',
  exportResolution: '1080p',
  exportQuality: 'high',
  targetFps: 60,

  // Audio/runtime
  audioFile: null,
  audioUrl: null,
  isPlaying: false,
  analyzer,
  bands: { bass: 0, mid: 0, high: 0, overall: 0, kick: 0 },

  // Export
  isExporting: false,
  exportProgress: 0,
  presets: [],

  // Catalogs
  collections: VISUALIZER_COLLECTIONS,
  palettes: BRAND_PALETTES,
  backgrounds: BACKGROUNDS,
  exportPresets: EXPORT_PRESETS,
  smoothingPresets: SMOOTHING_PRESETS,

  setVisualType: (visualType) => set({ visualType }),
  setPalette: (paletteId) => {
    const palette = BRAND_PALETTES.find((item) => item.id === paletteId) || BRAND_PALETTES[0]
    set({
      paletteId: palette.id,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      highlightColor: palette.highlight,
    })
  },
  setPrimaryColor: (primaryColor) => set({ primaryColor }),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),
  setHighlightColor: (highlightColor) => set({ highlightColor }),
  setBackgroundStyle: (backgroundStyle) => set({ backgroundStyle }),
  setBackgroundImage: (backgroundImage) => set({ backgroundImage }),
  setLogoImage: (logoImage) => set({ logoImage }),
  setLogoPosition: (logoPosition) => set({ logoPosition }),
  setLogoSize: (logoSize) => set({ logoSize }),
  setSensitivity: (sensitivity) => set({ sensitivity: Number(sensitivity) || 1 }),
  setSmoothingPreset: (smoothingPreset) => {
    analyzer.setSmoothingPreset(smoothingPreset)
    set({ smoothingPreset })
  },
  setSmoothing: (value) => {
    const numeric = Number(value)
    let preset = 'medium'
    if (numeric >= 0.88) preset = 'ultra'
    else if (numeric >= 0.78) preset = 'smooth'
    else if (numeric >= 0.6) preset = 'medium'
    else preset = 'fast'
    analyzer.setSmoothingPreset(preset)
    set({ smoothingPreset: preset })
  },
  setTextLayer: (id, patch) =>
    set((state) => ({
      textLayers: state.textLayers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    })),
  addTextLayer: () =>
    set((state) => ({
      textLayers: [
        ...state.textLayers,
        {
          id: `text-${Date.now()}`,
          text: 'New text',
          x: 50,
          y: 50,
          size: 36,
          weight: 600,
          color: '#FFFFFF',
          align: 'center',
          opacity: 1,
          uppercase: false,
          enabled: true,
        },
      ],
    })),
  removeTextLayer: (id) =>
    set((state) => ({ textLayers: state.textLayers.filter((layer) => layer.id !== id) })),

  setExportPresetId: (exportPresetId) => {
    const preset = EXPORT_PRESETS.find((item) => item.id === exportPresetId)
    set({
      exportPresetId,
      exportResolution: preset?.ratio === '16:9' ? '1080p' : 'portrait',
    })
  },
  setExportResolution: (exportResolution) => set({ exportResolution }),
  setExportQuality: (exportQuality) => set({ exportQuality }),

  setAudioFile: (file) => {
    const previous = get().audioUrl
    if (previous) URL.revokeObjectURL(previous)
    const audioUrl = file ? URL.createObjectURL(file) : null
    const title = file?.name ? file.name.replace(/\.[^.]+$/, '') : ''
    set((state) => ({
      audioFile: file,
      audioUrl,
      isPlaying: false,
      textLayers: state.textLayers.map((layer) =>
        layer.id === 'title' && !layer.text ? { ...layer, text: title } : layer.id === 'title' && title ? { ...layer, text: layer.text || title } : layer,
      ),
    }))
  },

  initAudio: async (audioElement) => {
    await analyzer.attach(audioElement, get().smoothingPreset)
    set({ bands: analyzer.readBands() })
    return analyzer
  },

  updateBands: () => {
    const bands = analyzer.readBands()
    set({ bands })
    return bands
  },

  resumeAudio: async () => {
    await analyzer.resume()
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  exportVideo: async (options = {}) => {
    const state = get()
    if (!state.audioFile) throw new Error('No audio file selected')
    set({ isExporting: true, exportProgress: 0 })
    try {
      const exportPreset = EXPORT_PRESETS.find((item) => item.id === state.exportPresetId)
      const formData = new FormData()
      formData.append('audio', state.audioFile)
      formData.append('visualType', state.visualType)
      formData.append('resolution', options.resolution || state.exportResolution)
      formData.append('quality', options.quality || state.exportQuality)
      formData.append('primaryColor', state.primaryColor)
      formData.append('secondaryColor', state.secondaryColor)
      formData.append('highlightColor', state.highlightColor)
      formData.append('backgroundStyle', state.backgroundStyle)
      formData.append('smoothingPreset', state.smoothingPreset)
      formData.append('sensitivity', String(state.sensitivity))
      formData.append('fps', String(state.targetFps))
      if (exportPreset) {
        formData.append('exportPreset', exportPreset.id)
        formData.append('width', String(exportPreset.width))
        formData.append('height', String(exportPreset.height))
      }
      const enabledLayers = state.textLayers.filter((layer) => layer.enabled && layer.text)
      if (enabledLayers.length) formData.append('textLayers', JSON.stringify(enabledLayers))
      if (state.backgroundImage) formData.append('background', state.backgroundImage)
      if (state.logoImage) formData.append('logo', state.logoImage)

      const response = await axios.post('/api/visualize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || 1
          set({ exportProgress: Math.round((progressEvent.loaded * 30) / total) })
        },
      })
      const { jobId } = response.data
      const pollExport = async () => {
        const statusResponse = await axios.get(`/api/visualize/status/${jobId}`)
        const { status, progress, downloadUrl, error } = statusResponse.data
        if (status === 'completed') {
          set({ isExporting: false, exportProgress: 100 })
          return downloadUrl
        }
        if (status === 'error') {
          throw new Error(error || 'Export failed')
        }
        set({ exportProgress: 30 + Math.round((Number(progress) || 0) * 0.7) })
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return pollExport()
      }
      return await pollExport()
    } catch (error) {
      set({ isExporting: false, exportProgress: 0 })
      throw error
    }
  },

  fetchPresets: async () => {
    try {
      const response = await axios.get('/api/visualize/presets')
      set({ presets: response.data.presets || [] })
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  },

  reset: () => {
    const previous = get().audioUrl
    if (previous) URL.revokeObjectURL(previous)
    set({
      visualType: 'spectrum-pro',
      paletteId: 'soundit-gold',
      primaryColor: BRAND_PALETTES[0].primary,
      secondaryColor: BRAND_PALETTES[0].secondary,
      highlightColor: BRAND_PALETTES[0].highlight,
      backgroundStyle: 'midnight',
      backgroundImage: null,
      logoImage: null,
      logoPosition: { x: 50, y: 18 },
      logoSize: 14,
      sensitivity: 1,
      smoothingPreset: 'medium',
      textLayers: defaultTextLayers(),
      exportPresetId: 'youtube',
      exportResolution: '1080p',
      exportQuality: 'high',
      audioFile: null,
      audioUrl: null,
      isPlaying: false,
      isExporting: false,
      exportProgress: 0,
      bands: { bass: 0, mid: 0, high: 0, overall: 0, kick: 0 },
    })
  },
}))

export default useVisualizerStore
