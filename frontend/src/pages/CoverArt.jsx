import React, { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Image as ImageIcon, 
  Type, 
  Download, 
  Palette,
  Layers,
  Grid3X3,
  Youtube,
  Instagram,
  Square,
  Plus,
  Trash2,
  Upload,
  Disc3,
  Brush,
  Move,
  RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'

const templates = [
  { id: 'square', label: 'Album Cover', icon: Square, width: 1080, height: 1080 },
  { id: 'youtube', label: 'YouTube Thumbnail', icon: Youtube, width: 1280, height: 720 },
  { id: 'instagram', label: 'Instagram Post', icon: Instagram, width: 1080, height: 1350 },
  { id: 'story', label: 'Instagram Story', icon: Instagram, width: 1080, height: 1920 },
]

const gradients = [
  { id: 'yellow', colors: ['#FFFF00', '#000000'] },
  { id: 'gold', colors: ['#FFD700', '#000000'] },
  { id: 'orange', colors: ['#FFA500', '#000000'] },
  { id: 'dark', colors: ['#1a1a25', '#000000'] },
  { id: 'neon', colors: ['#FFFF00', '#1a1a1a'] },
  { id: 'fire', colors: ['#FF4500', '#000000'] },
  { id: 'purple', colors: ['#9400D3', '#000000'] },
]

const fontOptions = [
  { id: 'orbitron', label: 'Orbitron', value: 'Orbitron' },
  { id: 'inter', label: 'Inter', value: 'Inter' },
  { id: 'mono', label: 'Mono', value: 'JetBrains Mono' },
]

const CoverArt = () => {
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const bgImageRef = useRef(null)
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0])
  const [selectedGradient, setSelectedGradient] = useState(gradients[0])
  const [elements, setElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [textColor, setTextColor] = useState('#FFFF00')
  const [fontSize, setFontSize] = useState(48)
  const [selectedFont, setSelectedFont] = useState(fontOptions[0])
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = selectedTemplate.width
    canvas.height = selectedTemplate.height

    drawCanvas()
  }, [selectedTemplate])

  // Redraw when elements change
  useEffect(() => {
    drawCanvas()
  }, [elements, selectedGradient, backgroundImage])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    if (bgImageRef.current) {
      const img = bgImageRef.current
      // Draw image to cover canvas
      const scale = Math.max(width / img.width, height / img.height)
      const x = (width - img.width * scale) / 2
      const y = (height - img.height * scale) / 2
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      
      // Add dark overlay for better text readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, width, height)
      
      drawElements(ctx)
    } else {
      // Draw gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, selectedGradient.colors[0])
      gradient.addColorStop(1, selectedGradient.colors[1])
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      drawElements(ctx)
    }
  }, [selectedGradient, elements])

  const drawElements = (ctx) => {
    elements.forEach((element) => {
      if (element.type === 'text') {
        ctx.font = `bold ${element.fontSize}px ${element.fontFamily || 'Orbitron'}`
        ctx.fillStyle = element.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Add text shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 10
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        ctx.fillText(element.text, element.x, element.y)
        
        // Reset shadow
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }
    })
  }

  const handleAddText = () => {
    if (!textInput.trim()) return

    const canvas = canvasRef.current
    const newElement = {
      id: Date.now().toString(),
      type: 'text',
      text: textInput,
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: textColor,
      fontSize: fontSize,
      fontFamily: selectedFont.value,
    }

    setElements([...elements, newElement])
    setTextInput('')
    toast.success('Text added')
  }

  const handleDeleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter((e) => e.id !== selectedElement))
      setSelectedElement(null)
      toast.success('Element deleted')
    }
  }

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Check if clicked on an element
    const clickedElement = elements.find((element) => {
      if (element.type === 'text') {
        const ctx = canvas.getContext('2d')
        ctx.font = `bold ${element.fontSize}px ${element.fontFamily || 'Orbitron'}`
        const metrics = ctx.measureText(element.text)
        const textWidth = metrics.width
        const textHeight = element.fontSize
        return (
          x >= element.x - textWidth / 2 &&
          x <= element.x + textWidth / 2 &&
          y >= element.y - textHeight / 2 &&
          y <= element.y + textHeight / 2
        )
      }
      return false
    })

    if (clickedElement) {
      setSelectedElement(clickedElement.id)
    } else {
      setSelectedElement(null)
    }
  }

  const handleMouseDown = (e) => {
    if (!selectedElement) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const element = elements.find((el) => el.id === selectedElement)
    if (element) {
      setIsDragging(true)
      setDragOffset({
        x: x - element.x,
        y: y - element.y,
      })
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedElement) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setElements((prev) =>
      prev.map((el) =>
        el.id === selectedElement
          ? { ...el, x: x - dragOffset.x, y: y - dragOffset.y }
          : el
      )
    )
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `fmx-cover-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('Cover art downloaded')
  }

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target.result
      setBackgroundImage(dataUrl)
      // Preload image
      const img = new window.Image()
      img.onload = () => {
        bgImageRef.current = img
        drawCanvas()
      }
      img.src = dataUrl
      toast.success('Background image added')
    }
    reader.readAsDataURL(file)
  }

  const handleClearBackground = () => {
    bgImageRef.current = null
    setBackgroundImage(null)
    toast.success('Background cleared')
  }

  const handleClearAll = () => {
    setElements([])
    setSelectedElement(null)
    bgImageRef.current = null
    setBackgroundImage(null)
    toast.success('Canvas cleared')
  }

  const updateSelectedElement = (updates) => {
    if (!selectedElement) return
    
    setElements((prev) =>
      prev.map((el) =>
        el.id === selectedElement ? { ...el, ...updates } : el
      )
    )
  }

  const selectedElementData = elements.find((el) => el.id === selectedElement)

  return (
    <div className="min-h-screen bg-black hex-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-create-red flex items-center justify-center">
              <Brush className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold text-white">
                Cover art <span className="text-gradient">creator</span>
              </h1>
              <p className="text-text-secondary">Design professional cover art for your mixes</p>
            </div>
          </div>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Clear All
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Tools */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Templates */}
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-create-red" />
                Template
              </h3>
              <div className="space-y-2">
                {templates.map((template) => {
                  const Icon = template.icon
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        selectedTemplate.id === template.id
                          ? 'bg-create-red text-black font-semibold'
                          : 'text-text-secondary hover:text-create-red hover:bg-create-red-dim'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{template.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Gradients */}
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-create-red" />
                Background
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {gradients.map((gradient) => (
                  <button
                    key={gradient.id}
                    onClick={() => {
                      bgImageRef.current = null
                      setSelectedGradient(gradient)
                      setBackgroundImage(null)
                    }}
                    className={`w-10 h-10 rounded-lg transition-all ${
                      selectedGradient.id === gradient.id && !backgroundImage
                        ? 'ring-2 ring-create-red scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${gradient.colors[0]}, ${gradient.colors[1]})`,
                    }}
                  />
                ))}
              </div>
              
              {backgroundImage && (
                <div className="mt-4 p-3 bg-create-red-dim rounded-xl border border-create-red/30">
                  <p className="text-create-red text-sm font-medium mb-2">Custom Image</p>
                  <button
                    onClick={handleClearBackground}
                    className="text-xs text-text-secondary hover:text-red-400"
                  >
                    Remove image
                  </button>
                </div>
              )}
              
              <label className="mt-4 flex items-center justify-center gap-2 w-full p-3 bg-background-tertiary rounded-xl text-text-secondary hover:text-create-red cursor-pointer transition-all border border-create-red/10 hover:border-create-red/30">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload Image</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Text Tool */}
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                <Type className="w-4 h-4 text-create-red" />
                Add Text
              </h3>
              <input
                type="text"
                placeholder="Enter text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-background-tertiary border border-create-red/10 rounded-xl text-white text-sm mb-3 focus:outline-none focus:border-create-red/50"
              />
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border border-create-red/20"
                />
                <input
                  type="range"
                  min="12"
                  max="120"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-text-muted text-xs w-10 font-mono">{fontSize}px</span>
              </div>
              <select
                value={selectedFont.id}
                onChange={(e) => setSelectedFont(fontOptions.find(f => f.id === e.target.value))}
                className="w-full px-3 py-2 bg-background-tertiary border border-create-red/10 rounded-lg text-white text-sm mb-3"
              >
                {fontOptions.map((font) => (
                  <option key={font.id} value={font.id}>{font.label}</option>
                ))}
              </select>
              <button
                onClick={handleAddText}
                disabled={!textInput.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-create-red rounded-xl text-black text-sm font-semibold hover:shadow-glow transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Text
              </button>
            </div>

            {/* Selected Element Controls */}
            {selectedElementData && (
              <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
                <h3 className="text-sm font-display font-bold text-white mb-4">
                  Edit Element
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted">Color</label>
                    <input
                      type="color"
                      value={selectedElementData.color}
                      onChange={(e) => updateSelectedElement({ color: e.target.value })}
                      className="w-full h-10 rounded-lg bg-transparent cursor-pointer border border-create-red/20 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Size</label>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={selectedElementData.fontSize}
                      onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) })}
                      className="w-full mt-1"
                    />
                  </div>
                  <button
                    onClick={handleDeleteElement}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2"
          >
            <div className="relative bg-background-secondary rounded-2xl border border-create-red/10 p-6">
              <div 
                className="relative mx-auto overflow-hidden rounded-xl bg-black"
                style={{ 
                  maxWidth: '100%',
                  aspectRatio: `${selectedTemplate.width} / ${selectedTemplate.height}`
                }}
              >
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="w-full h-full cursor-move"
                  style={{ objectFit: 'contain' }}
                />
              </div>

              {/* Canvas Info */}
              <div className="mt-4 flex items-center justify-between text-text-muted text-sm">
                <span className="font-mono">
                  {selectedTemplate.width} x {selectedTemplate.height}px
                </span>
                <span>{elements.length} elements</span>
              </div>
            </div>
          </motion.div>

          {/* Layers & Export */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Layers */}
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-create-red" />
                Layers
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {elements.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-4">
                    No elements yet
                  </p>
                ) : (
                  elements.map((element, index) => (
                    <div
                      key={element.id}
                      onClick={() => setSelectedElement(element.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedElement === element.id
                          ? 'bg-create-red-dim border border-create-red/30'
                          : 'hover:bg-background-tertiary'
                      }`}
                    >
                      <span className="text-text-muted text-xs font-mono">{index + 1}</span>
                      {element.type === 'text' ? (
                        <Type className="w-4 h-4 text-create-red" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-create-red" />
                      )}
                      <span className="text-white text-sm truncate flex-1">
                        {element.type === 'text'
                          ? element.text
                          : 'Image'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Export */}
            <div className="bg-background-secondary rounded-2xl border border-create-red/10 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-4">
                Export
              </h3>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-create-red rounded-xl text-black font-semibold hover:shadow-glow transition-all"
              >
                <Download className="w-5 h-5" />
                Download PNG
              </button>
            </div>

            {/* Tips */}
            <div className="bg-create-red-dim rounded-2xl border border-create-red/20 p-5">
              <h3 className="text-sm font-display font-bold text-white mb-2">
                Tips
              </h3>
              <ul className="text-text-secondary text-sm space-y-1">
                <li>• Click text to select and drag</li>
                <li>• Use high contrast for readability</li>
                <li>• Keep text minimal and bold</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default CoverArt
