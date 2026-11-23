import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Clock3,
  Disc3,
  Download,
  ExternalLink,
  FileAudio,
  Globe,
  Headphones,
  Link as LinkIcon,
  Loader2,
  Music,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from '../config/axios'

const TABS = [
  { id: 'soundcloud', label: 'SoundCloud', icon: Globe },
  { id: 'spotify', label: 'Spotify', icon: Disc3 },
  { id: 'boomplay', label: 'Boomplay', icon: Music },
  { id: 'audiomack', label: 'Audiomack', icon: Headphones },
  { id: 'recognize', label: 'Recognize', icon: Search },
  { id: 'history', label: 'History', icon: Clock3 },
]

function openExternal(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-14 px-6 bg-background-secondary rounded-2xl border border-brand-accent/10">
      <div className="w-16 h-16 rounded-2xl bg-brand-accent-dim text-brand-accent mx-auto mb-5 flex items-center justify-center">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-white font-display text-xl font-bold mb-2">{title}</h3>
      <p className="text-text-secondary max-w-xl mx-auto">{description}</p>
    </div>
  )
}

function StatusBanner({ tone = 'info', title, description }) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
        : 'border-brand-accent/20 bg-brand-accent-dim text-text-secondary'

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white mb-1">{title}</p>
          <p className="text-sm">{description}</p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-background-secondary rounded-3xl border border-brand-accent/10 p-6 sm:p-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-accent-dim text-brand-accent flex items-center justify-center flex-shrink-0">
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-white font-display text-2xl font-bold tracking-wide">{title}</h2>
          <p className="text-text-secondary mt-1">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

const Integration = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState('soundcloud')
  const [providers, setProviders] = useState(null)

  const [soundCloudQuery, setSoundCloudQuery] = useState('')
  const [soundCloudLoading, setSoundCloudLoading] = useState(false)
  const [soundCloudResult, setSoundCloudResult] = useState(null)

  const [spotifyQuery, setSpotifyQuery] = useState('')
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyResult, setSpotifyResult] = useState(null)

  const [boomplayQuery, setBoomplayQuery] = useState('')
  const [boomplayLoading, setBoomplayLoading] = useState(false)
  const [boomplayResult, setBoomplayResult] = useState(null)

  const [audiomackSongId, setAudiomackSongId] = useState('')
  const [audiomackLoading, setAudiomackLoading] = useState(false)
  const [audiomackResult, setAudiomackResult] = useState(null)

  const [recognizeUrl, setRecognizeUrl] = useState('')
  const [recognizeLoading, setRecognizeLoading] = useState(false)
  const [recognizeResult, setRecognizeResult] = useState(null)

  const [history, setHistory] = useState([])

  // Sync active tab with sidebar navigation
  useEffect(() => {
    if (!initialTab) return
    const tabMap = {
      shazam: 'recognize',
      soundcloud: 'soundcloud',
      spotify: 'spotify',
      audiomack: 'audiomack',
      boomplay: 'boomplay',
      hearthis: 'soundcloud', // fallback since no Hearthis tab exists yet
    }
    const mapped = tabMap[initialTab]
    if (mapped) {
      setActiveTab(mapped)
    }
  }, [initialTab])

  useEffect(() => {
    let cancelled = false

    const loadProviders = async () => {
      try {
        const response = await axios.get('/api/integration/providers')
        if (!cancelled) {
          setProviders(response.data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Provider lookup error:', error)
        }
      }
    }

    loadProviders()

    return () => {
      cancelled = true
    }
  }, [])

  const appendHistory = (entry) => {
    setHistory((current) => [
      {
        id: Date.now() + Math.random(),
        date: new Date().toLocaleString(),
        ...entry,
      },
      ...current,
    ])
  }

  const handleSoundCloudSearch = async () => {
    if (!soundCloudQuery.trim()) {
      toast.error('Paste a SoundCloud track or playlist URL')
      return
    }

    setSoundCloudLoading(true)

    try {
      const response = await axios.get('/api/integration/soundcloud/search', {
        params: { query: soundCloudQuery },
      })

      setSoundCloudResult(response.data)

      if (response.data.hint) {
        toast(response.data.hint, { icon: '💡', duration: 5000 })
      } else {
        appendHistory({
          type: 'SoundCloud',
          title: `Resolved: ${soundCloudQuery}`,
          description: `${response.data.results?.length || 0} items returned`,
        })
        toast.success('SoundCloud resolved!')
      }
    } catch (error) {
      console.error('SoundCloud error:', error)
      toast.error(error.response?.data?.error || 'Failed to resolve SoundCloud URL')
    } finally {
      setSoundCloudLoading(false)
    }
  }

  const handleSoundCloudDownload = async (track) => {
    const loadingToast = toast.loading('Generating direct download link...')
    try {
      // New provider: downloadUrl already resolved at search time
      if (track.downloadUrl) {
        toast.success('Direct download started!', { id: loadingToast })
        const filename = `${track.title || 'SoundCloud-Track'}.mp3`
        window.location.href = `/api/integration/download-file?url=${encodeURIComponent(track.downloadUrl)}&filename=${encodeURIComponent(filename)}`
        return
      }

      // Legacy: resolve via streamId (old provider)
      const progressiveTrack = (track.tracks || []).find(t => t.protocol === 'progressive') || (track.tracks || [])[0]
      if (!progressiveTrack) {
        toast.error('No download stream available for this track', { id: loadingToast })
        return
      }

      const response = await axios.get('/api/integration/soundcloud/download', {
        params: { url: track.permalink },
      })

      if (response.data.downloadUrl) {
        toast.success('Direct download started!', { id: loadingToast })
        const filename = `${track.title || 'SoundCloud-Track'}.mp3`
        window.location.href = `/api/integration/download-file?url=${encodeURIComponent(response.data.downloadUrl)}&filename=${encodeURIComponent(filename)}`
      } else {
        throw new Error('Download URL not returned')
      }
    } catch (err) {
      console.error('Download error:', err)
      toast.error(err.response?.data?.error || 'Failed to generate download link', { id: loadingToast })
    }
  }

  const handleSpotifySearch = async () => {
    if (!spotifyQuery.trim()) {
      toast.error('Enter a search query or URL')
      return
    }

    setSpotifyLoading(true)

    try {
      const response = await axios.get('/api/integration/spotify/search', {
        params: { query: spotifyQuery },
      })

      setSpotifyResult(response.data)
      appendHistory({
        type: 'Spotify search',
        title: `Search: ${spotifyQuery}`,
        description: `${response.data.results?.length || 0} tracks returned`,
      })
      toast.success('Spotify results loaded')
    } catch (error) {
      console.error('Spotify error:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch Spotify search')
    } finally {
      setSpotifyLoading(false)
    }
  }

  const handleBoomplaySearch = async () => {
    if (!boomplayQuery.trim()) {
      toast.error('Enter a search query')
      return
    }

    setBoomplayLoading(true)

    try {
      const response = await axios.get('/api/integration/boomplay/search', {
        params: { query: boomplayQuery },
      })

      setBoomplayResult(response.data)
      appendHistory({
        type: 'Boomplay search',
        title: `Search: ${boomplayQuery}`,
        description: 'Boomplay results loaded',
      })
      toast.success('Boomplay results loaded')
    } catch (error) {
      console.error('Boomplay error:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch Boomplay results')
    } finally {
      setBoomplayLoading(false)
    }
  }

  const handleAudiomackSearch = async () => {
    if (!audiomackSongId.trim()) {
      toast.error('Enter a query or URL')
      return
    }

    setAudiomackLoading(true)

    try {
      const response = await axios.get('/api/integration/audiomack/search', {
        params: { query: audiomackSongId },
      })

      setAudiomackResult(response.data)
      appendHistory({
        type: 'Audiomack search',
        title: `Search: ${audiomackSongId}`,
        description: `${response.data.results?.length || 0} items returned`,
      })
      toast.success('Audiomack results loaded')
    } catch (error) {
      console.error('Audiomack error:', error)
      toast.error(error.response?.data?.error || 'Failed to fetch Audiomack results')
    } finally {
      setAudiomackLoading(false)
    }
  }

  const handleAudiomackDownload = async (track) => {
    const loadingToast = toast.loading('Generating direct download link...')
    try {
      const response = await axios.get(`/api/integration/audiomack/play/${encodeURIComponent(track.id)}`)
      if (response.data.streamUrl) {
        toast.success('Direct download started!', { id: loadingToast })
        const filename = `${track.title || 'Audiomack-Track'}.mp3`
        window.location.href = `/api/integration/download-file?url=${encodeURIComponent(response.data.streamUrl)}&filename=${encodeURIComponent(filename)}`
      } else {
        throw new Error('Stream URL not returned')
      }
    } catch (err) {
      console.error('Download error:', err)
      toast.error(err.response?.data?.error || 'Failed to generate download link', { id: loadingToast })
    }
  }

  const handleFallbackDownload = async (track, platform) => {
    const loadingToast = toast.loading(`Resolving download link... (trying SoundCloud → Audiomack)`)
    try {
      const response = await axios.get('/api/integration/fallback/download', {
        params: {
          title: track.title,
          artist: track.artist,
        },
      })

      if (response.data.downloadUrl) {
        toast.success('Direct download started!', { id: loadingToast })
        const filename = `${track.title || 'Track'}.mp3`
        window.location.href = `/api/integration/download-file?url=${encodeURIComponent(response.data.downloadUrl)}&filename=${encodeURIComponent(filename)}`
      } else {
        throw new Error('Fallback URL not returned')
      }
    } catch (err) {
      console.error(`${platform} download error:`, err)
      toast.error(err.response?.data?.error || 'Failed to download via fallback', { id: loadingToast })
    }
  }

  const handleDownloadAll = async (tracks, platform) => {
    if (!tracks || tracks.length === 0) return
    toast.success(`Starting playlist download for ${tracks.length} tracks...`)
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      if (platform === 'soundcloud') {
        await handleSoundCloudDownload(track)
      } else if (platform === 'audiomack') {
        await handleAudiomackDownload(track)
      } else if (platform === 'spotify') {
        await handleFallbackDownload(track, 'Spotify')
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const handleRecognize = async () => {
    if (!recognizeUrl.trim()) {
      toast.error('Enter a public audio URL')
      return
    }

    setRecognizeLoading(true)

    try {
      const response = await axios.post('/api/integration/recognize', {
        audioUrl: recognizeUrl,
      })

      setRecognizeResult(response.data)
      appendHistory({
        type: 'Track recognition',
        title: response.data.result?.title || 'Recognition result',
        description: response.data.result?.artist || response.data.method,
        link: response.data.result?.shazamUrl || null,
      })
      toast.success('Recognition response received')
    } catch (error) {
      console.error('Recognition error:', error)
      setRecognizeResult({
        success: false,
        error: error.response?.data?.error || 'Failed to recognize track',
        shazamRecognizePath: error.response?.data?.shazamRecognizePath,
      })
      toast.error(error.response?.data?.error || 'Failed to recognize track')
    } finally {
      setRecognizeLoading(false)
    }
  }

  return (
    <div className="h-full bg-background-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-brand-accent/10 bg-background-secondary p-8 sm:p-10 noise">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 via-transparent to-cyan-400/10 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-accent flex items-center justify-center">
                  <Disc3 className="w-7 h-7 text-black" />
                </div>
                <div>
                  <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
                    Music <span className="text-gradient">integrations</span>
                  </h1>
                  <p className="text-text-secondary mt-1">
                    One control surface for SoundCloud, Boomplay, Audiomack downloads, and Shazam track recognition.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-brand-accent/10 bg-background-primary/30 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-accent mb-2">Search & Stream</p>
                  <p className="text-white font-semibold">SoundCloud and Boomplay tracks</p>
                </div>
                <div className="rounded-2xl border border-brand-accent/10 bg-background-primary/30 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-accent mb-2">Metadata</p>
                  <p className="text-white font-semibold">Shazam recognition via URL</p>
                </div>
                <div className="rounded-2xl border border-brand-accent/10 bg-background-primary/30 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-brand-accent mb-2">Playback</p>
                  <p className="text-white font-semibold">Audiomack signed stream URLs</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {!providers?.configured && (
          <div className="mb-8">
            <StatusBanner
              title="RapidAPI key missing"
              description="Set RAPIDAPI_KEY in backend/.env before using these tools."
            />
          </div>
        )}

        <div className="flex gap-2 mb-8 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-accent text-black'
                    : 'bg-background-secondary text-text-secondary hover:text-brand-accent border border-brand-accent/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'soundcloud' && (
            <motion.div
              key="soundcloud"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Globe}
                title="SoundCloud URL Resolver & Downloader"
                description="Paste a SoundCloud track or playlist URL to get a direct download link. For keyword search, use Audiomack or Boomplay."
              >
                {soundCloudResult?.hint && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-200 text-sm flex items-start gap-3">
                    <span className="text-lg">💡</span>
                    <p>{soundCloudResult.hint}</p>
                  </div>
                )}
                <div className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5">
                  <input
                    type="text"
                    value={soundCloudQuery}
                    onChange={(event) => setSoundCloudQuery(event.target.value)}
                    placeholder="https://soundcloud.com/artist/track-name or /sets/playlist-name"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSoundCloudSearch()
                    }}
                    className="w-full px-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                  />
                  <button
                    onClick={handleSoundCloudSearch}
                    disabled={soundCloudLoading}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent rounded-xl text-black font-semibold disabled:opacity-50"
                  >
                    {soundCloudLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Resolve & Download
                  </button>
                </div>

                {soundCloudResult ? (
                  <div>
                    {soundCloudResult.isPlaylist && soundCloudResult.playlist && (
                      <div className="mb-6 relative overflow-hidden rounded-3xl border border-brand-accent/20 bg-background-secondary/80 p-6 sm:p-8 backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 via-transparent to-cyan-400/5 pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center">
                          {soundCloudResult.playlist.artworkUrl ? (
                            <img
                              src={soundCloudResult.playlist.artworkUrl}
                              alt={soundCloudResult.playlist.title}
                              className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brand-accent/20 shadow-lg shadow-brand-accent/10"
                            />
                          ) : (
                            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-brand-accent-dim text-brand-accent flex items-center justify-center border border-brand-accent/20">
                              <Music className="w-12 h-12" />
                            </div>
                          )}
                          <div className="flex-1 text-center sm:text-left">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-brand-accent/15 text-brand-accent border border-brand-accent/20 mb-3">
                              SoundCloud Playlist
                            </span>
                            <h3 className="text-white font-display text-2xl sm:text-3xl font-bold tracking-wide leading-tight mb-2">
                              {soundCloudResult.playlist.title}
                            </h3>
                            <p className="text-text-secondary text-sm sm:text-base">
                              Contains <span className="text-white font-semibold">{soundCloudResult.playlist.trackCount || soundCloudResult.results?.length || 0}</span> tracks
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadAll(soundCloudResult.results, 'soundcloud')}
                            className="w-full sm:w-auto px-6 py-4 bg-brand-accent text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-accent/90 transition-all hover:scale-[1.02] shadow-lg shadow-brand-accent/20"
                          >
                            <Download className="w-5 h-5" />
                            Download All
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-brand-accent/10 bg-background-primary/20 overflow-hidden">
                      <div className="p-5 border-b border-brand-accent/10">
                        <h3 className="text-white text-xl font-display font-bold">Results</h3>
                      </div>
                      <div className="divide-y divide-brand-accent/5 max-h-[520px] overflow-y-auto">
                        {(soundCloudResult.results || []).map((track, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-brand-accent-dim transition-all">
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} className="w-14 h-14 rounded-2xl object-cover" />
                            ) : (
                              <div className="w-14 h-14 bg-background-tertiary rounded-2xl flex items-center justify-center border border-brand-accent/10">
                                <Music className="w-5 h-5 text-brand-accent/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold truncate">{track.title}</h4>
                              <p className="text-text-secondary text-sm truncate">{track.description ? track.description.substring(0, 60) + '...' : ''}</p>
                            </div>
                            <div className="flex gap-2 self-start sm:self-center mt-2 sm:mt-0">
                              {track.permalink && (
                                <button
                                  onClick={() => openExternal(`https://soundcloud.com/${track.permalink}`)}
                                  className="px-4 py-2 bg-background-tertiary rounded-xl text-white border border-brand-accent/10 text-sm hover:text-brand-accent transition-all"
                                >
                                  Open Link
                                </button>
                              )}
                              <button
                                onClick={() => handleSoundCloudDownload(track)}
                                className="px-4 py-2 bg-brand-accent rounded-xl text-black font-semibold text-sm flex items-center gap-1 hover:bg-brand-accent/90 transition-all"
                              >
                                <Download className="w-4 h-4" /> Download MP3
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Globe}
                    title="No results yet"
                    description="Enter a search query or SoundCloud playlist URL."
                  />
                )}
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'spotify' && (
            <motion.div
              key="spotify"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Disc3}
                title="Spotify Downloader"
                description="Search for tracks or resolve playlist URLs on Spotify, downloading via SoundCloud fallback."
              >
                <div className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5">
                  <input
                    type="text"
                    value={spotifyQuery}
                    onChange={(event) => setSpotifyQuery(event.target.value)}
                    placeholder="Enter Spotify track/playlist URL or search query..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSpotifySearch()
                    }}
                    className="w-full px-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                  />
                  <button
                    onClick={handleSpotifySearch}
                    disabled={spotifyLoading}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent rounded-xl text-black font-semibold disabled:opacity-50"
                  >
                    {spotifyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Search / Resolve
                  </button>
                </div>

                {spotifyResult ? (
                  <div>
                    {spotifyResult.isPlaylist && spotifyResult.playlist && (
                      <div className="mb-6 relative overflow-hidden rounded-3xl border border-brand-accent/20 bg-background-secondary/80 p-6 sm:p-8 backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 via-transparent to-cyan-400/5 pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center">
                          {spotifyResult.playlist.artworkUrl ? (
                            <img
                              src={spotifyResult.playlist.artworkUrl}
                              alt={spotifyResult.playlist.title}
                              className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brand-accent/20 shadow-lg shadow-brand-accent/10"
                            />
                          ) : (
                            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-brand-accent-dim text-brand-accent flex items-center justify-center border border-brand-accent/20">
                              <Music className="w-12 h-12" />
                            </div>
                          )}
                          <div className="flex-1 text-center sm:text-left">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-brand-accent/15 text-brand-accent border border-brand-accent/20 mb-3">
                              Spotify Playlist
                            </span>
                            <h3 className="text-white font-display text-2xl sm:text-3xl font-bold tracking-wide leading-tight mb-2">
                              {spotifyResult.playlist.title}
                            </h3>
                            <p className="text-text-secondary text-sm sm:text-base">
                              Contains <span className="text-white font-semibold">{spotifyResult.playlist.trackCount || spotifyResult.results?.length || 0}</span> tracks
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadAll(spotifyResult.results, 'spotify')}
                            className="w-full sm:w-auto px-6 py-4 bg-brand-accent text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-accent/90 transition-all hover:scale-[1.02] shadow-lg shadow-brand-accent/20"
                          >
                            <Download className="w-5 h-5" />
                            Download All
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-brand-accent/10 bg-background-primary/20 overflow-hidden">
                      <div className="p-5 border-b border-brand-accent/10">
                        <h3 className="text-white text-xl font-display font-bold">Results</h3>
                      </div>
                      <div className="divide-y divide-brand-accent/5 max-h-[520px] overflow-y-auto">
                        {(spotifyResult.results || []).map((track, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-brand-accent-dim transition-all">
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} className="w-14 h-14 rounded-2xl object-cover border border-brand-accent/10" />
                            ) : (
                              <div className="w-14 h-14 bg-background-tertiary rounded-2xl flex items-center justify-center border border-brand-accent/10">
                                <Music className="w-5 h-5 text-brand-accent/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold truncate">{track.title}</h4>
                              <p className="text-text-secondary text-sm truncate">{track.artist}</p>
                            </div>
                            <div className="flex gap-2 self-start sm:self-center mt-2 sm:mt-0">
                              {track.permalink && (
                                <button
                                  onClick={() => openExternal(track.permalink)}
                                  className="px-4 py-2 bg-background-tertiary rounded-xl text-white border border-brand-accent/10 text-sm hover:text-brand-accent transition-all"
                                >
                                  Open Link
                                </button>
                              )}
                              <button
                                onClick={() => handleFallbackDownload(track, 'Spotify')}
                                className="px-4 py-2 bg-brand-accent rounded-xl text-black font-semibold text-sm flex items-center gap-1 hover:bg-brand-accent/90 transition-all"
                              >
                                <Download className="w-4 h-4" /> Download MP3
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Disc3}
                    title="No results yet"
                    description="Enter a search query or Spotify playlist URL."
                  />
                )}
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'boomplay' && (
            <motion.div
              key="boomplay"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Music}
                title="Boomplay Search"
                description="Search for artist songs on Boomplay, downloading via SoundCloud fallback."
              >
                <div className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5">
                  <input
                    type="text"
                    value={boomplayQuery}
                    onChange={(event) => setBoomplayQuery(event.target.value)}
                    placeholder="Search artist name or enter Boomplay artist URL..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleBoomplaySearch()
                    }}
                    className="w-full px-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                  />
                  <button
                    onClick={handleBoomplaySearch}
                    disabled={boomplayLoading}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent rounded-xl text-black font-semibold disabled:opacity-50"
                  >
                    {boomplayLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Search
                  </button>
                </div>
                {boomplayResult ? (
                  <div className="rounded-3xl border border-brand-accent/10 bg-background-primary/20 overflow-hidden">
                    <div className="p-5 border-b border-brand-accent/10">
                      <h3 className="text-white text-xl font-display font-bold">Results</h3>
                    </div>
                    <div className="divide-y divide-brand-accent/5 max-h-[520px] overflow-y-auto">
                      {(boomplayResult.results || []).map((track, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-brand-accent-dim transition-all">
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} className="w-14 h-14 rounded-2xl object-cover border border-brand-accent/10" />
                          ) : (
                            <div className="w-14 h-14 bg-background-tertiary rounded-2xl flex items-center justify-center border border-brand-accent/10">
                              <Music className="w-5 h-5 text-brand-accent/60" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold truncate">{track.title}</h4>
                            {track.artist && <p className="text-text-secondary text-sm truncate">{track.artist}</p>}
                          </div>
                          <div className="flex gap-2 self-start sm:self-center mt-2 sm:mt-0">
                            {track.permalink && (
                              <button
                                onClick={() => openExternal(track.permalink)}
                                className="px-4 py-2 bg-background-tertiary rounded-xl text-white border border-brand-accent/10 text-sm hover:text-brand-accent transition-all"
                              >
                                Open Link
                              </button>
                            )}
                            <button
                              onClick={() => handleFallbackDownload(track, 'Boomplay')}
                              className="px-4 py-2 bg-brand-accent rounded-xl text-black font-semibold text-sm flex items-center gap-1 hover:bg-brand-accent/90 transition-all"
                            >
                              <Download className="w-4 h-4" /> Download MP3
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!boomplayResult.results || boomplayResult.results.length === 0) && (
                        <div className="p-5 text-center text-text-secondary">No tracks found.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Music}
                    title="No results yet"
                    description="Search for a track or artist on Boomplay."
                  />
                )}
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'audiomack' && (
            <motion.div
              key="audiomack"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Headphones}
                title="Audiomack Downloader"
                description="Search for tracks or resolve playlist/song URLs on Audiomack."
              >
                <div className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5">
                  <input
                    type="text"
                    value={audiomackSongId}
                    onChange={(event) => setAudiomackSongId(event.target.value)}
                    placeholder="Enter Audiomack search query, song or playlist URL..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAudiomackSearch()
                    }}
                    className="w-full px-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                  />
                  <button
                    onClick={handleAudiomackSearch}
                    disabled={audiomackLoading}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent rounded-xl text-black font-semibold disabled:opacity-50"
                  >
                    {audiomackLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Search / Resolve
                  </button>
                </div>

                {audiomackResult ? (
                  <div>
                    {audiomackResult.isPlaylist && audiomackResult.playlist && (
                      <div className="mb-6 relative overflow-hidden rounded-3xl border border-brand-accent/20 bg-background-secondary/80 p-6 sm:p-8 backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 via-transparent to-cyan-400/5 pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center">
                          {audiomackResult.playlist.artworkUrl ? (
                            <img
                              src={audiomackResult.playlist.artworkUrl}
                              alt={audiomackResult.playlist.title}
                              className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brand-accent/20 shadow-lg shadow-brand-accent/10"
                            />
                          ) : (
                            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-brand-accent-dim text-brand-accent flex items-center justify-center border border-brand-accent/20">
                              <Music className="w-12 h-12" />
                            </div>
                          )}
                          <div className="flex-1 text-center sm:text-left">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-brand-accent/15 text-brand-accent border border-brand-accent/20 mb-3">
                              Audiomack Playlist
                            </span>
                            <h3 className="text-white font-display text-2xl sm:text-3xl font-bold tracking-wide leading-tight mb-2">
                              {audiomackResult.playlist.title}
                            </h3>
                            <p className="text-text-secondary text-sm sm:text-base">
                              Contains <span className="text-white font-semibold">{audiomackResult.playlist.trackCount || audiomackResult.results?.length || 0}</span> tracks
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadAll(audiomackResult.results, 'audiomack')}
                            className="w-full sm:w-auto px-6 py-4 bg-brand-accent text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-accent/90 transition-all hover:scale-[1.02] shadow-lg shadow-brand-accent/20"
                          >
                            <Download className="w-5 h-5" />
                            Download All
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-brand-accent/10 bg-background-primary/20 overflow-hidden">
                      <div className="p-5 border-b border-brand-accent/10">
                        <h3 className="text-white text-xl font-display font-bold">Results</h3>
                      </div>
                      <div className="divide-y divide-brand-accent/5 max-h-[520px] overflow-y-auto">
                        {(audiomackResult.results || []).map((track, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-brand-accent-dim transition-all">
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} className="w-14 h-14 rounded-2xl object-cover border border-brand-accent/10" />
                            ) : (
                              <div className="w-14 h-14 bg-background-tertiary rounded-2xl flex items-center justify-center border border-brand-accent/10">
                                <Music className="w-5 h-5 text-brand-accent/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold truncate">{track.title}</h4>
                              <p className="text-text-secondary text-sm truncate">{track.artist}</p>
                            </div>
                            <div className="flex gap-2 self-start sm:self-center mt-2 sm:mt-0">
                              {track.permalink && (
                                <button
                                  onClick={() => openExternal(track.permalink)}
                                  className="px-4 py-2 bg-background-tertiary rounded-xl text-white border border-brand-accent/10 text-sm hover:text-brand-accent transition-all"
                                >
                                  Open Link
                                </button>
                              )}
                              <button
                                onClick={() => handleAudiomackDownload(track)}
                                className="px-4 py-2 bg-brand-accent rounded-xl text-black font-semibold text-sm flex items-center gap-1 hover:bg-brand-accent/90 transition-all"
                              >
                                <Download className="w-4 h-4" /> Download MP3
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Headphones}
                    title="No results yet"
                    description="Enter a search query or Audiomack song/playlist URL."
                  />
                )}
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'recognize' && (
            <motion.div
              key="recognize"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Search}
                title="Track Recognition"
                description="Submit a public audio file URL to the Shazam provider."
              >
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={recognizeUrl}
                      onChange={(event) => setRecognizeUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleRecognize()
                      }}
                      placeholder="https://example.com/audio-preview.mp3"
                      className="w-full pl-12 pr-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                    />
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-accent" />
                  </div>

                  <button
                    onClick={handleRecognize}
                    disabled={recognizeLoading}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent rounded-xl text-black font-semibold disabled:opacity-50"
                  >
                    {recognizeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Identify Track
                  </button>

                  <StatusBanner
                    tone="info"
                    title="Shazam via RapidAPI"
                    description={`Configured path: ${providers?.shazamRecognizePath || 'recognize/url'}.`}
                  />

                  {recognizeResult ? (
                    recognizeResult.success === false ? (
                      <StatusBanner tone="warning" title="Recognition failed" description={recognizeResult.error} />
                    ) : (
                      <div className="rounded-3xl border border-brand-accent/10 bg-background-primary/20 p-5">
                        <div className="flex flex-col lg:flex-row gap-5">
                          {recognizeResult.result?.artworkUrl ? (
                            <img src={recognizeResult.result.artworkUrl} className="w-28 h-28 rounded-2xl object-cover" />
                          ) : (
                            <div className="w-28 h-28 rounded-2xl bg-brand-accent-dim flex items-center justify-center border border-brand-accent/20">
                              <Music className="w-10 h-10 text-brand-accent" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="text-white text-2xl font-bold">{recognizeResult.result?.title || 'Unknown'}</h3>
                            <p className="text-text-secondary">{recognizeResult.result?.artist || 'Unknown Artist'}</p>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <EmptyState icon={Search} title="No track identified" description="Provide a public URL to identify the song." />
                  )}
                </div>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <SectionCard
                icon={Clock3}
                title="Integration History"
                description="Recent lookups and generated links during this session."
              >
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="p-4 rounded-2xl bg-background-primary/20 border border-brand-accent/10 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-text-muted mb-1">{entry.date} &bull; {entry.type}</p>
                          <p className="text-white font-medium">{entry.title}</p>
                          <p className="text-text-secondary text-sm">{entry.description}</p>
                        </div>
                        {entry.link && (
                          <button
                            onClick={() => openExternal(entry.link)}
                            className="p-3 bg-background-tertiary rounded-xl text-brand-accent"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Clock3} title="No history" description="Actions will appear here." />
                )}
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Integration
