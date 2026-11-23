/**
 * Premium visualizer renderers.
 *
 * Each renderer receives a draw context with canvas, ctx, audio bands,
 * palette, sensitivity and time so visuals stay deterministic per frame.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex, fallback = [255, 212, 0]) {
  const match = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i)
  if (!match) return fallback
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ]
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function withAlpha(color, alpha) {
  if (/^#/.test(color)) return rgba(color, alpha)
  return color
}

export const VISUALIZER_COLLECTIONS = [
  { id: 'spectrum-pro', label: 'Spectrum Pro', collection: 'Club' },
  { id: 'wave-luxe', label: 'Wave Luxe', collection: 'Club' },
  { id: 'radial-pulse', label: 'Radial Pulse', collection: 'Club' },
  { id: 'kick-reactor', label: 'Kick Reactor', collection: 'Club' },
  { id: 'particle-nebula', label: 'Particle Nebula', collection: 'Atmosphere' },
  { id: 'aurora-flow', label: 'Aurora Flow', collection: 'Atmosphere' },
  { id: 'grid-tunnel', label: 'Grid Tunnel', collection: 'Futurist' },
  { id: 'prism-bars', label: 'Prism Bars', collection: 'Futurist' },
  { id: 'vinyl-orbit', label: 'Vinyl Orbit', collection: 'Signature' },
  { id: 'minimal-line', label: 'Minimal Line', collection: 'Signature' },
]

function createParticles(width, height, count = 140) {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    size: 0.8 + Math.random() * 2.4,
    seed: index * 13.37,
  }))
}

function ensureState(state, width, height) {
  if (!state.particles || state.w !== width || state.h !== height) {
    state.particles = createParticles(width, height)
    state.w = width
    state.h = height
  }
  return state
}

export function drawSpectrumPro({ ctx, width, height, bands, palette, sensitivity, frequencyData }) {
  const data = frequencyData || new Uint8Array(0)
  const bars = 96
  const barWidth = width / bars
  for (let i = 0; i < bars; i += 1) {
    const idx = Math.floor((i / bars) * data.length)
    const sample = (data[idx] || 0) / 255
    const bandBoost = i < bars * 0.3 ? bands.bass : i < bars * 0.75 ? bands.mid : bands.high
    const value = clamp(sample * 0.7 + bandBoost * 0.6, 0, 1)
    const barHeight = value * height * 0.75 * sensitivity
    const x = i * barWidth
    const y = height - barHeight
    const gradient = ctx.createLinearGradient(0, height, 0, y)
    gradient.addColorStop(0, palette.primary)
    gradient.addColorStop(0.55, palette.secondary)
    gradient.addColorStop(1, palette.highlight || '#FFFFFF')
    ctx.fillStyle = gradient
    ctx.shadowColor = withAlpha(palette.primary, 0.35)
    ctx.shadowBlur = 12 + bands.kick * 18
    ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight)
  }
  ctx.shadowBlur = 0
}

export function drawWaveLuxe({ ctx, width, height, bands, palette, sensitivity, timeData }) {
  const data = timeData || new Uint8Array(0)
  const centerY = height * 0.55
  const amplitude = height * (0.18 + bands.mid * 0.18 + bands.kick * 0.12) * sensitivity
  for (let layer = 0; layer < 3; layer += 1) {
    ctx.beginPath()
    const color = [palette.primary, palette.secondary, palette.highlight || '#FFFFFF'][layer]
    ctx.strokeStyle = withAlpha(color, 0.9 - layer * 0.2)
    ctx.lineWidth = 4 - layer
    for (let x = 0; x <= width; x += 4) {
      const idx = Math.floor((x / width) * (data.length - 1 || 1))
      const sample = ((data[idx] || 128) - 128) / 128
      const y = centerY + sample * amplitude * (1 - layer * 0.18) + Math.sin(x * 0.012 + layer) * bands.bass * 18
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const glow = ctx.createRadialGradient(width / 2, centerY, 10, width / 2, centerY, height * 0.35)
  glow.addColorStop(0, withAlpha(palette.primary, 0.12 + bands.kick * 0.2))
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
}

export function drawRadialPulse({ ctx, width, height, bands, palette, sensitivity, frequencyData }) {
  const data = frequencyData || new Uint8Array(0)
  const cx = width / 2
  const cy = height / 2
  const base = Math.min(width, height) * (0.14 + bands.kick * 0.05)
  const bars = 140
  for (let i = 0; i < bars; i += 1) {
    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2
    const idx = Math.floor((i / bars) * data.length)
    const value = (data[idx] || 0) / 255
    const len = (value * 0.6 + (i < bars / 3 ? bands.bass : i < (bars * 2) / 3 ? bands.mid : bands.high) * 0.5) * Math.min(width, height) * 0.22 * sensitivity
    const x1 = cx + Math.cos(angle) * base
    const y1 = cy + Math.sin(angle) * base
    const x2 = cx + Math.cos(angle) * (base + len)
    const y2 = cy + Math.sin(angle) * (base + len)
    ctx.strokeStyle = i % 2 === 0 ? withAlpha(palette.primary, 0.85) : withAlpha(palette.secondary, 0.85)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, base * (0.85 + bands.bass * 0.2), 0, Math.PI * 2)
  ctx.strokeStyle = withAlpha(palette.highlight || '#FFFFFF', 0.45)
  ctx.lineWidth = 2
  ctx.stroke()
}

export function drawKickReactor({ ctx, width, height, bands, palette, sensitivity, time }) {
  const cx = width / 2
  const cy = height / 2
  const pulse = bands.bass * 0.5 + bands.kick
  const rings = 10
  for (let i = 0; i < rings; i += 1) {
    const phase = (time * 0.00025 + i / rings) % 1
    const radius = phase * Math.max(width, height) * 0.55
    const alpha = (1 - phase) * (0.12 + pulse * 0.5)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(i % 2 === 0 ? palette.primary : palette.secondary, alpha)
    ctx.lineWidth = 2 + pulse * 8 * sensitivity
    ctx.stroke()
  }
  const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.45)
  flash.addColorStop(0, withAlpha(palette.highlight || '#FFFFFF', 0.04 + bands.kick * 0.2))
  flash.addColorStop(1, 'transparent')
  ctx.fillStyle = flash
  ctx.fillRect(0, 0, width, height)
}

export function drawParticleNebula({ ctx, width, height, bands, palette, sensitivity, state }) {
  const s = ensureState(state, width, height)
  const energy = bands.overall * 0.6 + bands.high * 0.4
  for (const p of s.particles) {
    p.x += p.vx * (1 + energy * 8 * sensitivity) + Math.sin(p.seed + bands.mid * 4) * 0.2
    p.y += p.vy * (1 + bands.bass * 8 * sensitivity) + Math.cos(p.seed + bands.mid * 4) * 0.2
    if (p.x < -20) p.x = width + 20
    if (p.x > width + 20) p.x = -20
    if (p.y < -20) p.y = height + 20
    if (p.y > height + 20) p.y = -20
    const size = p.size * (1 + energy * 2.8 + bands.kick * 2)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4)
    g.addColorStop(0, withAlpha(palette.primary, 0.8))
    g.addColorStop(0.5, withAlpha(palette.secondary, 0.35))
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawAuroraFlow({ ctx, width, height, bands, palette, sensitivity, time }) {
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    const baseY = height * (0.25 + i * 0.12)
    for (let x = 0; x <= width; x += 12) {
      const y =
        baseY +
        Math.sin(x * 0.004 + time * 0.0006 + i) * height * (0.03 + bands.mid * 0.08 * sensitivity) +
        Math.sin(x * 0.009 - time * 0.0004) * height * bands.high * 0.04
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = withAlpha(i % 2 === 0 ? palette.primary : palette.secondary, 0.22 + bands.overall * 0.25)
    ctx.lineWidth = 40 - i * 5 + bands.bass * 12
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

export function drawGridTunnel({ ctx, width, height, bands, palette, sensitivity, time }) {
  const cx = width / 2
  const cy = height * 0.55
  const horizon = height * 0.35
  ctx.strokeStyle = withAlpha(palette.secondary, 0.25)
  ctx.lineWidth = 1
  for (let i = 0; i < 18; i += 1) {
    const y = horizon + ((height - horizon) * (i / 17)) * (1 + bands.bass * 0.1)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  const cols = 24
  for (let i = -cols; i <= cols; i += 1) {
    const xBottom = cx + i * (width / cols) * 1.6
    ctx.beginPath()
    ctx.moveTo(cx, horizon)
    ctx.lineTo(xBottom, height)
    ctx.strokeStyle = withAlpha(palette.primary, 0.12 + bands.mid * 0.2)
    ctx.stroke()
  }
  const sunR = Math.min(width, height) * (0.12 + bands.kick * 0.04 * sensitivity)
  const sun = ctx.createRadialGradient(cx, horizon - sunR * 0.3, 0, cx, horizon, sunR)
  sun.addColorStop(0, withAlpha(palette.highlight || '#FFFFFF', 0.8))
  sun.addColorStop(1, withAlpha(palette.primary, 0.05))
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(cx, horizon - sunR * 0.1, sunR, Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = withAlpha(palette.highlight || '#FFFFFF', 0.18 + bands.high * 0.3)
  for (let i = 0; i < 7; i += 1) {
    const y = horizon - sunR * 0.2 + i * (sunR / 4) + Math.sin(time * 0.002 + i) * 2
    ctx.beginPath()
    ctx.moveTo(cx - sunR, y)
    ctx.lineTo(cx + sunR, y)
    ctx.stroke()
  }
}

export function drawPrismBars({ ctx, width, height, bands, palette, sensitivity, frequencyData }) {
  const data = frequencyData || new Uint8Array(0)
  const bars = 72
  const gap = 4
  const barWidth = (width - gap * (bars - 1)) / bars
  for (let i = 0; i < bars; i += 1) {
    const idx = Math.floor((i / bars) * data.length)
    const sample = (data[idx] || 0) / 255
    const h = sample * height * 0.7 * sensitivity + bands.overall * height * 0.15
    const x = i * (barWidth + gap)
    const y = (height - h) / 2
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, palette.highlight || '#FFFFFF')
    g.addColorStop(0.5, palette.secondary)
    g.addColorStop(1, palette.primary)
    ctx.fillStyle = g
    ctx.fillRect(x, y, barWidth, h)
  }
}

export function drawVinylOrbit({ ctx, width, height, bands, palette, sensitivity, time }) {
  const cx = width / 2
  const cy = height / 2
  const r = Math.min(width, height) * 0.18
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + i * 22 + bands.bass * 30 * sensitivity, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(i % 2 ? palette.secondary : palette.primary, 0.2 + bands.mid * 0.25)
    ctx.lineWidth = 2
    ctx.stroke()
  }
  const dots = 64
  for (let i = 0; i < dots; i += 1) {
    const angle = (i / dots) * Math.PI * 2 + time * 0.0005
    const orbit = r * 2.2 + (i % 3) * 26 + bands.high * 40
    const x = cx + Math.cos(angle) * orbit
    const y = cy + Math.sin(angle) * orbit
    ctx.fillStyle = withAlpha(palette.highlight || '#FFFFFF', 0.35 + bands.overall * 0.5)
    ctx.beginPath()
    ctx.arc(x, y, 2 + bands.kick * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = withAlpha(palette.primary, 0.9)
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

export function drawMinimalLine({ ctx, width, height, bands, palette, sensitivity, timeData }) {
  const data = timeData || new Uint8Array(0)
  const y = height * 0.62
  ctx.beginPath()
  for (let x = 0; x <= width; x += 3) {
    const idx = Math.floor((x / width) * (data.length - 1 || 1))
    const sample = ((data[idx] || 128) - 128) / 128
    const yy = y + sample * height * 0.18 * sensitivity + Math.sin(x * 0.01) * bands.mid * 12
    if (x === 0) ctx.moveTo(x, yy)
    else ctx.lineTo(x, yy)
  }
  ctx.strokeStyle = palette.primary
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = withAlpha(palette.secondary, 0.12 + bands.bass * 0.2)
  ctx.fillRect(0, height * 0.78, width * clamp(0.1 + bands.overall * 1.2, 0, 1), 3)
}

export const RENDERERS = {
  'spectrum-pro': drawSpectrumPro,
  'wave-luxe': drawWaveLuxe,
  'radial-pulse': drawRadialPulse,
  'kick-reactor': drawKickReactor,
  'particle-nebula': drawParticleNebula,
  'aurora-flow': drawAuroraFlow,
  'grid-tunnel': drawGridTunnel,
  'prism-bars': drawPrismBars,
  'vinyl-orbit': drawVinylOrbit,
  'minimal-line': drawMinimalLine,
}

export const BACKGROUNDS = [
  { id: 'midnight', label: 'Midnight', colors: ['#00101D', '#03162A'] },
  { id: 'ember', label: 'Ember', colors: ['#120800', '#2A1200'] },
  { id: 'aurora', label: 'Aurora', colors: ['#00101D', '#00364A'] },
  { id: 'studio', label: 'Studio', colors: ['#0A0F14', '#151A20'] },
  { id: 'neon-noir', label: 'Neon Noir', colors: ['#020308', '#12001F'] },
]

export const EXPORT_PRESETS = [
  { id: 'instagram-reel', label: 'Instagram Reel', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'youtube', label: 'YouTube', width: 1920, height: 1080, ratio: '16:9' },
  { id: 'youtube-shorts', label: 'YouTube Shorts', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'square', label: 'Square Post', width: 1080, height: 1080, ratio: '1:1' },
]

export const BRAND_PALETTES = [
  { id: 'soundit-gold', label: 'Sound It Gold', primary: '#EDC61E', secondary: '#FAE1AF', highlight: '#FFD400', background: '#00101D' },
  { id: 'neon-sky', label: 'Neon Sky', primary: '#95CDFB', secondary: '#FFD400', highlight: '#FAE1AF', background: '#00101D' },
  { id: 'midnight-gold', label: 'Midnight Gold', primary: '#FFD400', secondary: '#EDC61E', highlight: '#FFFFFF', background: '#00101D' },
  { id: 'electric', label: 'Electric', primary: '#00E5FF', secondary: '#FF3DF5', highlight: '#FFFFFF', background: '#050814' },
]

export function drawBackground(ctx, width, height, palette, background, time, bands) {
  const bg = BACKGROUNDS.find((item) => item.id === background) || BACKGROUNDS[0]
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, bg.colors[0] || palette.background || '#00101D')
  gradient.addColorStop(1, bg.colors[1] || '#03162A')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Animated ambient layer for motion at 60 FPS target.
  const orb = ctx.createRadialGradient(
    width * (0.5 + Math.sin(time * 0.0003) * 0.15),
    height * (0.45 + Math.cos(time * 0.00025) * 0.1),
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * (0.45 + bands.bass * 0.08),
  )
  orb.addColorStop(0, withAlpha(palette.primary, 0.12 + bands.overall * 0.12))
  orb.addColorStop(0.6, withAlpha(palette.secondary, 0.06))
  orb.addColorStop(1, 'transparent')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, width, height)
}

export function drawTextLayers(ctx, width, height, textLayers = [], bands = {}) {
  for (const layer of textLayers) {
    if (!layer?.text) continue
    const size = Number(layer.size || 48)
    const weight = layer.weight || 700
    const font = layer.font || 'Inter, system-ui, sans-serif'
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    ctx.font = `${weight} ${size}px ${font}`
    ctx.fillStyle = layer.color || '#FFFFFF'
    ctx.textAlign = layer.align || 'center'
    ctx.textBaseline = 'middle'
    if (layer.shadow !== false) {
      ctx.shadowColor = withAlpha(layer.shadowColor || '#000000', 0.5)
      ctx.shadowBlur = 18 + (bands.kick || 0) * 10
      ctx.shadowOffsetY = 2
    }
    const x = ((layer.x ?? 50) / 100) * width
    const y = ((layer.y ?? 85) / 100) * height
    if (layer.uppercase) ctx.fillText(String(layer.text).toUpperCase(), x, y)
    else ctx.fillText(String(layer.text), x, y)
    ctx.restore()
  }
}
