import { create } from 'zustand'

const usePlayerStore = create((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  isMuted: false,
  audioError: null,
  audioEl: null,

  queue: [],
  currentIndex: 0,
  shuffle: false,
  repeat: 'none', // 'none' | 'one' | 'all'

  registerAudioElement: (el) => set({ audioEl: el }),

  setCurrentTrack: (track) => {
    const { queue } = get()
    const idx = track ? queue.findIndex((t) => String(t.id) === String(track.id)) : -1
    set({
      currentTrack: track,
      currentIndex: idx >= 0 ? idx : 0,
      currentTime: 0,
      duration: track?.duration || 0,
      audioError: null,
    })
  },

  playTrack: (track, newQueue = null) => {
    const queue = Array.isArray(newQueue) ? newQueue : get().queue
    const idx = track ? queue.findIndex((t) => String(t.id) === String(track.id)) : -1
    set({
      currentTrack: track,
      queue,
      currentIndex: idx >= 0 ? idx : 0,
      currentTime: 0,
      duration: track?.duration || 0,
      isPlaying: true,
      audioError: null,
    })
  },

  togglePlay: () => {
    const { currentTrack, isPlaying } = get()
    if (!currentTrack) return
    set({ isPlaying: !isPlaying })
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setAudioError: (audioError) => set({ audioError }),

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, Number(volume)))
    const { audioEl } = get()
    if (audioEl) {
      audioEl.volume = clamped
      if (clamped > 0 && audioEl.muted) audioEl.muted = false
    }
    set({ volume: clamped, isMuted: clamped === 0 })
  },

  toggleMute: () => {
    const { isMuted, audioEl } = get()
    const next = !isMuted
    if (audioEl) audioEl.muted = next
    set({ isMuted: next })
  },

  setQueue: (queue) => {
    const { currentTrack } = get()
    const idx = currentTrack ? queue.findIndex((t) => String(t.id) === String(currentTrack.id)) : 0
    set({ queue, currentIndex: idx >= 0 ? idx : 0 })
  },

  addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),

  removeFromQueue: (index) => set((state) => ({
    queue: state.queue.filter((_, i) => i !== index),
  })),

  nextTrack: () => {
    const { queue, currentIndex, shuffle, repeat } = get()
    if (!queue.length) return

    let nextIndex
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else {
      nextIndex = currentIndex + 1
      if (nextIndex >= queue.length) {
        if (repeat === 'all') nextIndex = 0
        else {
          set({ isPlaying: false })
          return
        }
      }
    }

    const next = queue[nextIndex]
    set({
      currentTrack: next,
      currentIndex: nextIndex,
      currentTime: 0,
      duration: next?.duration || 0,
      isPlaying: true,
      audioError: null,
    })
  },

  previousTrack: () => {
    const { queue, currentIndex, currentTime, seek } = get()
    // Standard DJ/player behavior: if >3s into track, restart track first
    if (currentTime > 3) {
      seek(0)
      return
    }
    if (!queue.length) return
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1
    const prev = queue[prevIndex]
    set({
      currentTrack: prev,
      currentIndex: prevIndex,
      currentTime: 0,
      duration: prev?.duration || 0,
      isPlaying: true,
      audioError: null,
    })
  },

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  toggleRepeat: () => set((state) => ({
    repeat: state.repeat === 'none' ? 'all' : state.repeat === 'all' ? 'one' : 'none',
  })),

  seek: (time) => {
    const { audioEl, duration } = get()
    const maxDur = (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0)
      ? audioEl.duration
      : duration || 0
    const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, time) : Math.max(0, time))
    if (audioEl && Number.isFinite(clamped)) {
      try {
        audioEl.currentTime = clamped
      } catch {
        // ignore if media not yet loaded
      }
    }
    set({ currentTime: clamped })
  },
}))

export default usePlayerStore
