import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Radio,
  Podcast,
  Disc3,
  Search,
  Play,
  Heart,
  Share2,
  ExternalLink,
  Info,
  FileAudio
} from 'lucide-react'
import toast from 'react-hot-toast'
import usePlayerStore from '@store/playerStore'

import axios from '../config/axios'

const SoundItDJMixes = () => {
  const [activeTab, setActiveTab] = useState('explore')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [mixTitle, setMixTitle] = useState('')
  const [mixes, setMixes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  const { setCurrentTrack, setIsPlaying } = usePlayerStore()

  const fetchMixes = async () => {
    try {
      const response = await axios.get('/api/mixes')
      setMixes(response.data)
    } catch (error) {
      console.error('Error fetching mixes:', error)
      toast.error('Failed to load DJ Mixes')
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchMixes()
  }, [])

  const handlePlayMix = (mix) => {
    setCurrentTrack({
      id: `mix-${mix.id}`,
      title: mix.title,
      artist: mix.artist,
      duration: mix.duration,
      audioUrl: mix.file_path,
      artwork: mix.artwork || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop'
    })
    setIsPlaying(true)
    toast.success(`Playing ${mix.title}`)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (!uploadFile) {
      toast.error('Please select an audio file to upload.')
      return
    }
    if (!mixTitle.trim()) {
      toast.error('Please provide a title for your mix.')
      return
    }
    setIsUploading(true)
    const formData = new FormData()
    formData.append('mix', uploadFile)
    formData.append('title', mixTitle)
    formData.append('genre', 'Electronic')
    formData.append('description', '')

    axios.post('/api/mixes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then(() => {
      toast.success('Mix uploaded successfully!')
      setUploadFile(null)
      setMixTitle('')
      fetchMixes()
      setActiveTab('explore')
    })
    .catch((error) => {
      toast.error('Failed to upload mix.')
    })
    .finally(() => {
      setIsUploading(false)
    })
  }

  return (
    <div className="h-full bg-background-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-brand-accent/10 bg-background-secondary p-8 sm:p-10 noise">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 via-transparent to-brand-accent/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-accent flex items-center justify-center">
                    <Radio className="w-7 h-7 text-black" />
                  </div>
                  <div>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
                      Sound It <span className="text-gradient">DJ Mixes</span>
                    </h1>
                    <p className="text-text-secondary mt-2">
                      Powered by Hearthis. Explore community mixes, upload your own, and syndicate directly to Apple, Spotify, and Deezer podcasts.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-6 py-3 bg-brand-accent text-black font-semibold rounded-xl hover:shadow-glow transition-all flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload Mix
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-brand-accent/10 pb-4 overflow-x-auto">
          {[
            { id: 'explore', label: 'Explore Mixes', icon: Disc3 },
            { id: 'upload', label: 'Upload & Distribute', icon: Upload },
            { id: 'podcasts', label: 'Podcast Connections', icon: Podcast },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/30'
                    : 'text-text-secondary hover:text-white hover:bg-background-tertiary'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {activeTab === 'explore' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-2xl font-display font-bold text-white">Featured DJ Mixes</h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search genres, DJs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-background-secondary border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-brand-accent/50"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                 <div className="col-span-full text-center py-20 text-text-secondary">Loading Mixes...</div>
              ) : mixes.length === 0 ? (
                 <div className="col-span-full text-center py-20 text-text-secondary">No mixes available. Upload one!</div>
              ) : (
                mixes.map((mix) => (
                  <div key={mix.id} className="bg-background-secondary rounded-3xl border border-brand-accent/10 overflow-hidden hover:border-brand-accent/30 transition-all group">
                    <div className="relative aspect-square">
                      <img src={mix.artwork || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80"} alt={mix.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <button
                        onClick={() => handlePlayMix(mix)}
                        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-brand-accent text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <Play className="w-5 h-5 ml-1" />
                      </button>
                      <div className="absolute bottom-4 left-4">
                        <span className="px-3 py-1 bg-background-primary/50 backdrop-blur-md rounded-lg text-xs font-mono text-white border border-white/10">
                          {mix.duration ? Math.round(mix.duration / 60) + ' min' : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-white mb-1 truncate">{mix.title}</h3>
                      <p className="text-text-secondary text-sm mb-4">{mix.artist || mix.user_name}</p>
                      <div className="flex items-center gap-4 text-text-muted text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <Play className="w-4 h-4" />
                          0
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-red-400 cursor-pointer transition-colors">
                          <Heart className="w-4 h-4" />
                          0
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto hover:text-white cursor-pointer transition-colors">
                          <Share2 className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'upload' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
            <div className="bg-background-secondary rounded-3xl border border-brand-accent/10 p-8">
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                <Upload className="w-6 h-6 text-brand-accent" />
                Upload to Hearthis
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Mix Title</label>
                  <input
                    type="text"
                    value={mixTitle}
                    onChange={(e) => setMixTitle(e.target.value)}
                    placeholder="e.g. Summer Sunset Sessions Vol 1"
                    className="w-full px-4 py-4 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:border-brand-accent/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Audio File</label>
                  <div className="border-2 border-dashed border-brand-accent/20 rounded-2xl p-8 text-center hover:border-brand-accent/50 transition-colors bg-background-tertiary">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="mix-upload"
                    />
                    <label htmlFor="mix-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-brand-accent/10 flex items-center justify-center mb-4">
                        <FileAudio className="w-8 h-8 text-brand-accent" />
                      </div>
                      <span className="text-white font-medium mb-1">
                        {uploadFile ? uploadFile.name : 'Click to select mix file'}
                      </span>
                      <span className="text-text-muted text-sm">MP3, WAV, FLAC (Max 500MB)</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full py-4 bg-brand-accent text-black font-bold rounded-xl hover:shadow-glow transition-all disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload & Distribute'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'podcasts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl">
            <div className="bg-background-secondary rounded-3xl border border-brand-accent/10 p-8">
              <div className="flex items-start gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
                  <Podcast className="w-6 h-6 text-brand-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-white mb-2">Podcast Syndication</h2>
                  <p className="text-text-secondary">
                    Your mixes are automatically packaged into an RSS feed compatible with major podcast networks via Hearthis. Use these links to submit your DJ podcast.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-background-primary/40 border border-brand-accent/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-white font-semibold mb-1">RSS Feed URL</h4>
                    <p className="text-text-secondary text-sm font-mono bg-background-tertiary px-3 py-1 rounded inline-block">
                      https://hearthis.at/soundit/podcast/rss
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-background-tertiary text-white rounded-lg hover:bg-brand-accent/20 hover:text-brand-accent transition-colors text-sm font-medium">
                    Copy Link
                  </button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 pt-4">
                  {[
                    { name: 'Apple Podcasts', status: 'Not Submitted', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    { name: 'Spotify Podcasts', status: 'Active', color: 'text-green-400', bg: 'bg-green-400/10' },
                    { name: 'Deezer', status: 'Pending', color: 'text-blue-400', bg: 'bg-blue-400/10' }
                  ].map(network => (
                    <div key={network.name} className="p-5 rounded-2xl border border-brand-accent/10 bg-background-tertiary">
                      <h4 className="text-white font-semibold mb-3">{network.name}</h4>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${network.bg} ${network.color}`}>
                          {network.status}
                        </span>
                      </div>
                      <button className="w-full py-2 text-sm text-text-secondary border border-brand-accent/20 rounded-lg hover:text-white hover:border-brand-accent/50 transition-colors flex items-center justify-center gap-2">
                        Configure <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3 text-blue-200 text-sm">
                  <Info className="w-5 h-5 flex-shrink-0" />
                  <p>When you upload a new mix to Hearthis via the Sound It DJ Mixes panel, it will automatically sync to your connected podcast networks within 24 hours.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}

export default SoundItDJMixes
