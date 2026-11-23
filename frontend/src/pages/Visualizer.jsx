import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Download,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Music,
  Pause,
  Play,
  Settings,
  Sparkles,
  Type,
  Upload,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useVisualizerStore from '@store/visualizerStore'
import { MEDIA_BASE_URL } from '@config/axios'
import {
  BACKGROUNDS,
  BRAND_PALETTES,
  EXPORT_PRESETS,
  RENDERERS,
  VISUALIZER_COLLECTIONS,
  drawBackground,
  drawTextLayers,
} from '../visualizer/renderers'
import { SMOOTHING_PRESETS } from '../visualizer/analyzer'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Visualizer() {
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const frameRef = useRef(null)
  const logoImgRef = useRef(null)
  const bgImgRef = useRef(null)
  const renderStateRef = useRef({})
  const [showSettings, setShowSettings] = useState(true)

  const {
    visualType,
    setVisualType,
    primaryColor,
    secondaryColor,
    highlightColor,
    backgroundStyle,
    setBackgroundStyle,
    paletteId,
    setPalette,
    sensitivity,
    setSensitivity,
    smoothingPreset,
    setSmoothingPreset,
    audioFile,
    audioUrl,
    isPlaying,
    setIsPlaying,
    initAudio,
    updateBands,
    resumeAudio,
    setAudioFile,
    backgroundImage,
    setBackgroundImage,
    logoImage,
    setLogoImage,
    logoPosition,
    setLogoPosition,
    logoSize,
    setLogoSize,
    textLayers,
    setTextLayer,
    addTextLayer,
    removeTextLayer,
    exportPresetId,
    setExportPresetId,
    exportQuality,
    setExportQuality,
    isExporting,
    exportProgress,
    exportVideo,
  } = useVisualizerStore()

  const exportPreset = EXPORT_PRESETS.find((p) => p.id === exportPresetId) || EXPORT_PRESETS[2]
  const collections = useMemo(() => {
    const groups = new Map()
    for (const item of VISUALIZER_COLLECTIONS) {
      if (!groups.has(item.collection)) groups.set(item.collection, [])
      groups.get(item.collection).push(item)
    }
    return [...groups.entries()]
  }, [])

  const onAudioDrop = useCallback((accepted) => {
    const file = accepted[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file')
      return
    }
    setAudioFile(file)
    toast.success('Audio loaded')
  }, [setAudioFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onAudioDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.aiff'] },
    maxFiles: 1,
  })

  const onLogoDrop = useCallback(async (accepted) => {
    const file = accepted[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const img = new Image()
    img.onload = () => { logoImgRef.current = img }
    img.src = dataUrl
    setLogoImage(dataUrl)
  }, [setLogoImage])

  const onBgDrop = useCallback(async (accepted) => {
    const file = accepted[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const img = new Image()
    img.onload = () => { bgImgRef.current = img }
    img.src = dataUrl
    setBackgroundImage(dataUrl)
  }, [setBackgroundImage])

  const logoDrop = useDropzone({ onDrop: onLogoDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'] }, maxFiles: 1 })
  const bgDrop = useDropzone({ onDrop: onBgDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1 })

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
    }
  }, [audioUrl])

  useEffect(() => {
    if (logoImage) {
      const img = new Image()
      img.onload = () => { logoImgRef.current = img }
      img.src = logoImage
    } else {
      logoImgRef.current = null
    }
  }, [logoImage])

  useEffect(() => {
    if (backgroundImage) {
      const img = new Image()
      img.onload = () => { bgImgRef.current = img }
      img.src = backgroundImage
    } else {
      bgImgRef.current = null
    }
  }, [backgroundImage])

  const drawFrame = useCallback((time = performance.now()) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const bands = isPlaying ? updateBands() : { bass: 0, mid: 0, high: 0, overall: 0, kick: 0, frequencyData: null, timeData: null }
    const palette = {
      primary: primaryColor,
      secondary: secondaryColor,
      highlight: highlightColor,
      background: '#00101D',
    }

    ctx.clearRect(0, 0, width, height)
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, width, height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(0, 0, width, height)
    } else {
      drawBackground(ctx, width, height, palette, backgroundStyle, time, bands)
    }

    const renderer = RENDERERS[visualType] || RENDERERS['spectrum-pro']
    renderer({
      ctx,
      width,
      height,
      bands,
      palette,
      sensitivity,
      time,
      frequencyData: bands.frequencyData,
      timeData: bands.timeData,
      state: renderStateRef.current,
    })

    const enabledText = textLayers.filter((layer) => layer.enabled && layer.text)
    drawTextLayers(ctx, width, height, enabledText, bands)

    if (logoImgRef.current) {
      const size = (Math.min(width, height) * logoSize) / 100
      const x = (width * logoPosition.x) / 100 - size / 2
      const y = (height * logoPosition.y) / 100 - size / 2
      ctx.save()
      ctx.globalAlpha = 0.98
      ctx.drawImage(logoImgRef.current, x, y, size, size)
      ctx.restore()
    }

    // subtle frame polish
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.22)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
  }, [isPlaying, updateBands, primaryColor, secondaryColor, highlightColor, backgroundStyle, visualType, sensitivity, textLayers, logoPosition, logoSize])

  useEffect(() => {
    let active = true
    const loop = (time) => {
      if (!active) return
      drawFrame(time)
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [drawFrame])

  const handlePlay = async () => {
    if (!audioRef.current || !audioFile) return
    try {
      await initAudio(audioRef.current)
      await resumeAudio()
      await audioRef.current.play()
      setIsPlaying(true)
    } catch (error) {
      console.error(error)
      toast.error('Could not start audio playback')
    }
  }

  const handlePause = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  const handleExport = async () => {
    if (!audioFile) {
      toast.error('Load an audio file first')
      return
    }
    try {
      const downloadUrl = await exportVideo()
      const fullUrl = downloadUrl?.startsWith('http') ? downloadUrl : `${MEDIA_BASE_URL}${downloadUrl}`
      const link = document.createElement('a')
      link.href = fullUrl
      link.download = `${audioFile.name.replace(/\.[^.]+$/, '')}-${visualType}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Export completed (server-rendered with selected settings)')
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || error.message || 'Export failed')
    }
  }

  return (
    <div className="h-full overflow-auto bg-background-primary">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Visualizer Studio</h1>
            <p className="text-sm text-text-muted mt-1">
              Band-aware FFT (bass 20–250Hz, mid 250–4kHz, high 4–20kHz), kick detection, premium renderers, overlays and social export presets.
            </p>
          </div>
          <button onClick={() => setShowSettings((v) => !v)} className="px-3 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary flex items-center gap-2">
            <Settings className="w-4 h-4" /> {showSettings ? 'Hide' : 'Show'} controls
          </button>
        </div>

        <div className="grid xl:grid-cols-[1.35fr_1fr] gap-5">
          <div className="space-y-4">
            <div className="bg-background-secondary border border-border rounded-xl p-4">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-[#00101D] border border-border">
                {!audioFile ? (
                  <div {...getRootProps()} className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'bg-brand-accent/10' : ''}`}>
                    <input {...getInputProps()} />
                    <Upload className="w-10 h-10 text-brand-accent mb-3" />
                    <div className="text-text-primary font-medium">Drop audio to start</div>
                    <div className="text-text-muted text-sm mt-1">MP3, WAV, FLAC, AAC, M4A, OGG, AIFF</div>
                  </div>
                ) : (
                  <>
                    <canvas ref={canvasRef} width={exportPreset.ratio === '16:9' ? 1920 : exportPreset.width} height={exportPreset.ratio === '16:9' ? 1080 : exportPreset.height} className="w-full h-full object-contain" />
                    <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={isPlaying ? handlePause : handlePlay} className="w-11 h-11 rounded-full bg-brand-accent text-brand-primary flex items-center justify-center shrink-0">
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>
                        <div className="min-w-0">
                          <div className="text-sm text-text-primary truncate">{audioFile.name}</div>
                          <div className="text-[11px] text-text-muted">Target {exportPreset.label} · {exportPreset.ratio} · 60 FPS render target</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-text-muted bg-black/40 px-2 py-1 rounded">Bass/Mid/High + Kick reactive</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary"><Sparkles className="w-4 h-4 text-brand-accent" /> Premium collections</div>
              {collections.map(([collection, items]) => (
                <div key={collection}>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">{collection}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <button key={item.id} onClick={() => setVisualType(item.id)} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${visualType === item.id ? 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent' : 'bg-background-primary border-border text-text-secondary hover:text-text-primary'}`}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showSettings && (
            <div className="space-y-4">
              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="text-sm font-medium text-text-primary">Audio reaction</div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-text-muted">Smoothing</label>
                  <select value={smoothingPreset} onChange={(e) => setSmoothingPreset(e.target.value)} className="mt-1 w-full bg-background-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                    {Object.entries(SMOOTHING_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-text-muted">Sensitivity: {Number(sensitivity).toFixed(2)}</label>
                  <input type="range" min="0.4" max="2.5" step="0.05" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} className="w-full mt-1" />
                </div>
                <div className="text-[12px] text-text-muted">Bands: bass 20–250Hz, mid 250–4kHz, high 4–20kHz. Kick/onset detection drives pulses and impacts.</div>
              </div>

              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2"><Layers className="w-4 h-4 text-brand-accent" /> Palette & background</div>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_PALETTES.map((palette) => (
                    <button key={palette.id} onClick={() => setPalette(palette.id)} className={`rounded-lg p-2 border text-left ${paletteId === palette.id ? 'border-brand-accent/40' : 'border-border'}`}>
                      <div className="h-8 rounded mb-2" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }} />
                      <div className="text-xs text-text-primary">{palette.label}</div>
                    </button>
                  ))}
                </div>
                <select value={backgroundStyle} onChange={(e) => setBackgroundStyle(e.target.value)} className="w-full bg-background-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                  {BACKGROUNDS.map((bg) => <option key={bg.id} value={bg.id}>{bg.label} (animated)</option>)}
                </select>
                <div {...bgDrop.getRootProps()} className="border border-dashed border-border rounded-lg p-3 text-sm text-text-secondary cursor-pointer">
                  <input {...bgDrop.getInputProps()} />
                  <div className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {backgroundImage ? 'Replace background image' : 'Upload custom background image'}</div>
                </div>
                {backgroundImage && <button onClick={() => setBackgroundImage(null)} className="text-xs text-text-muted hover:text-text-primary">Remove background image</button>}
              </div>

              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2"><ImagePlus className="w-4 h-4 text-brand-accent" /> Logo overlay</div>
                <div {...logoDrop.getRootProps()} className="border border-dashed border-border rounded-lg p-3 text-sm text-text-secondary cursor-pointer">
                  <input {...logoDrop.getInputProps()} />
                  {logoImage ? 'Replace logo image' : 'Upload logo/image overlay'}
                </div>
                {logoImage && (
                  <div className="space-y-2">
                    <label className="text-[11px] text-text-muted">X {logoPosition.x}%</label>
                    <input type="range" min="0" max="100" value={logoPosition.x} onChange={(e) => setLogoPosition({ ...logoPosition, x: Number(e.target.value) })} className="w-full" />
                    <label className="text-[11px] text-text-muted">Y {logoPosition.y}%</label>
                    <input type="range" min="0" max="100" value={logoPosition.y} onChange={(e) => setLogoPosition({ ...logoPosition, y: Number(e.target.value) })} className="w-full" />
                    <label className="text-[11px] text-text-muted">Size {logoSize}%</label>
                    <input type="range" min="5" max="40" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full" />
                    <button onClick={() => setLogoImage(null)} className="text-xs text-text-muted hover:text-text-primary">Remove logo</button>
                  </div>
                )}
              </div>

              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-text-primary flex items-center gap-2"><Type className="w-4 h-4 text-brand-accent" /> Text layers</div>
                  <button onClick={addTextLayer} className="text-xs px-2 py-1 border border-border rounded text-text-secondary">Add</button>
                </div>
                {textLayers.map((layer) => (
                  <div key={layer.id} className="border border-border rounded-lg p-3 space-y-2 bg-background-primary">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={layer.enabled} onChange={(e) => setTextLayer(layer.id, { enabled: e.target.checked })} />
                      <input value={layer.text} onChange={(e) => setTextLayer(layer.id, { text: e.target.value })} className="flex-1 bg-background-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary" placeholder="Text" />
                      {layer.id.startsWith('text-') && <button onClick={() => removeTextLayer(layer.id)} className="text-xs text-text-muted">Remove</button>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" value={layer.x} onChange={(e) => setTextLayer(layer.id, { x: Number(e.target.value) })} className="bg-background-secondary border border-border rounded px-2 py-1 text-xs text-text-primary" placeholder="X%" />
                      <input type="number" value={layer.y} onChange={(e) => setTextLayer(layer.id, { y: Number(e.target.value) })} className="bg-background-secondary border border-border rounded px-2 py-1 text-xs text-text-primary" placeholder="Y%" />
                      <input type="number" value={layer.size} onChange={(e) => setTextLayer(layer.id, { size: Number(e.target.value) })} className="bg-background-secondary border border-border rounded px-2 py-1 text-xs text-text-primary" placeholder="Size" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={layer.color || '#FFFFFF'} onChange={(e) => setTextLayer(layer.id, { color: e.target.value })} />
                      <label className="text-xs text-text-muted flex items-center gap-1"><input type="checkbox" checked={Boolean(layer.uppercase)} onChange={(e) => setTextLayer(layer.id, { uppercase: e.target.checked })} /> Uppercase</label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2"><Video className="w-4 h-4 text-brand-accent" /> Export presets</div>
                <select value={exportPresetId} onChange={(e) => setExportPresetId(e.target.value)} className="w-full bg-background-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                  {EXPORT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label} ({preset.width}×{preset.height}, {preset.ratio})</option>)}
                </select>
                <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value)} className="w-full bg-background-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary">
                  <option value="high">High quality</option>
                  <option value="medium">Medium quality</option>
                  <option value="low">Low quality</option>
                </select>
                <button onClick={handleExport} disabled={!audioFile || isExporting} className="w-full px-4 py-2.5 bg-brand-accent text-brand-primary rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> {isExporting ? `Exporting ${exportProgress}%` : 'Export video'}
                </button>
                <div className="text-[11px] text-text-muted">
                  Preview renders locally at animation-frame rate (60 FPS target). Server export receives the selected visual/preset/overlay settings; final encode quality/FPS depends on backend renderer capabilities.
                </div>
              </div>

              {!audioFile && (
                <div className="bg-background-secondary border border-border rounded-xl p-4 text-sm text-text-muted flex items-center gap-2">
                  <Music className="w-4 h-4" /> Load an audio file to enable band analysis, kick detection and export.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
