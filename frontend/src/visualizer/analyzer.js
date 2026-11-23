/**
 * Band-aware FFT analyzer for the visualizer.
 *
 * Frequency bands (as requested):
 * - bass: 20–250 Hz
 * - mid:  250–4000 Hz
 * - high: 4000–20000 Hz
 *
 * Also provides smoothed energy, a simple spectral-flux kick/onset detector,
 * and normalized values suitable for 60 FPS rendering.
 */

export const SMOOTHING_PRESETS = {
  fast: { label: 'Fast', analyser: 0.45, energy: 0.35 },
  medium: { label: 'Medium', analyser: 0.7, energy: 0.55 },
  smooth: { label: 'Smooth', analyser: 0.82, energy: 0.72 },
  ultra: { label: 'Ultra Smooth', analyser: 0.92, energy: 0.86 },
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function averageRange(data, start, end) {
  const from = Math.max(0, Math.floor(start))
  const to = Math.min(data.length, Math.ceil(end))
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i += 1) sum += data[i]
  return sum / (to - from)
}

export class AudioBandAnalyzer {
  constructor() {
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.audioElement = null
    this.frequencyData = null
    this.timeData = null
    this.previousBass = 0
    this.bassEnergy = 0
    this.midEnergy = 0
    this.highEnergy = 0
    this.overallEnergy = 0
    this.kick = 0
    this.lastKickAt = 0
    this.frame = 0
    this.energySmoothing = 0.55
  }

  async attach(audioElement, preset = 'medium') {
    if (!audioElement) return this
    if (this.audioContext && this.source && this.audioElement === audioElement) {
      this.setSmoothingPreset(preset)
      return this
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!this.audioContext) {
      this.audioContext = new AudioContextClass()
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser()
      // 2048 gives 1024 bins: good balance for band separation and 60 FPS work.
      this.analyser.fftSize = 2048
      this.analyser.connect(this.audioContext.destination)
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeData = new Uint8Array(this.analyser.fftSize)
    }
    if (this.source) {
      try { this.source.disconnect() } catch {}
      this.source = null
    }
    try {
      this.source = this.audioContext.createMediaElementSource(audioElement)
      this.source.connect(this.analyser)
      this.audioElement = audioElement
    } catch (e) {
      console.warn('Audio analyzer attach warning:', e.message)
    }
    this.setSmoothingPreset(preset)
    return this
  }

  setSmoothingPreset(preset) {
    const config = SMOOTHING_PRESETS[preset] || SMOOTHING_PRESETS.medium
    if (this.analyser) this.analyser.smoothingTimeConstant = config.analyser
    this.energySmoothing = config.energy
  }

  get sampleRate() {
    return this.audioContext?.sampleRate || 44100
  }

  hzToIndex(hz) {
    const nyquist = this.sampleRate / 2
    const binCount = this.frequencyData?.length || 1
    return clamp((hz / nyquist) * binCount, 0, binCount - 1)
  }

  readBands(now = performance.now()) {
    if (!this.analyser || !this.frequencyData) {
      return {
        bass: 0, mid: 0, high: 0, overall: 0, kick: 0,
        frequencyData: null, timeData: null, waveform: null,
      }
    }

    this.analyser.getByteFrequencyData(this.frequencyData)
    this.analyser.getByteTimeDomainData(this.timeData)

    const bassStart = this.hzToIndex(20)
    const bassEnd = this.hzToIndex(250)
    const midEnd = this.hzToIndex(4000)
    const highEnd = this.hzToIndex(20000)

    const bassRaw = averageRange(this.frequencyData, bassStart, bassEnd) / 255
    const midRaw = averageRange(this.frequencyData, bassEnd, midEnd) / 255
    const highRaw = averageRange(this.frequencyData, midEnd, highEnd) / 255
    const overallRaw = averageRange(this.frequencyData, bassStart, highEnd) / 255

    const smooth = this.energySmoothing
    const follow = 1 - smooth
    this.bassEnergy = this.bassEnergy * smooth + bassRaw * follow
    this.midEnergy = this.midEnergy * smooth + midRaw * follow
    this.highEnergy = this.highEnergy * smooth + highRaw * follow
    this.overallEnergy = this.overallEnergy * smooth + overallRaw * follow

    // Spectral-flux style onset on bass: a rising edge above recent energy.
    const delta = bassRaw - this.previousBass
    const threshold = 0.08 + this.bassEnergy * 0.35
    const cooldown = 140
    let kick = this.kick * 0.82
    if (delta > threshold && bassRaw > 0.18 && now - this.lastKickAt > cooldown) {
      kick = clamp(delta * 2.4 + bassRaw * 0.6, 0, 1)
      this.lastKickAt = now
    }
    this.kick = kick
    this.previousBass = bassRaw
    this.frame += 1

    return {
      bass: this.bassEnergy,
      mid: this.midEnergy,
      high: this.highEnergy,
      overall: this.overallEnergy,
      kick: this.kick,
      bassRaw,
      midRaw,
      highRaw,
      frequencyData: this.frequencyData,
      timeData: this.timeData,
    }
  }

  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  destroy() {
    try { this.source?.disconnect() } catch {}
    try { this.analyser?.disconnect() } catch {}
    try { this.audioContext?.close() } catch {}
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.audioElement = null
    this.frequencyData = null
    this.timeData = null
  }
}
