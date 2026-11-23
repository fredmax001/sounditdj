import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Activity, 
  Clock, 
  Music, 
  Download, 
  Copy, 
  Check,
  AlertCircle,
  X,
  RefreshCw,
  History,
  Disc3,
  Zap,
  Waves,
  Link as LinkIcon,
  ShieldAlert,
  FileAudio
} from 'lucide-react'
import toast from 'react-hot-toast'
import useAnalyzerStore from '@store/analyzerStore'

const analysisStages = {
  uploading: { label: 'Uploading...', icon: Upload },
  analyzing: { label: 'Analyzing audio...', icon: Activity },
  detecting: { label: 'Detecting tracks...', icon: Music },
  generating: { label: 'Generating tracklist...', icon: Music },
}

const Analyzer = () => {
  const [copied, setCopied] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)
  const [mixUrl, setMixUrl] = useState('')
  
  const {
    isAnalyzing,
    analysisProgress,
    analysisStage,
    analysisError,
    tracklist,
    detectedBpm,
    detectedKey,
    segments,
    analysisHistory,
    startAnalysis,
    startAnalysisUrl,
    clearAnalysis,
    exportTracklist,
    updateTrack,
  } = useAnalyzerStore()

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file')
      return
    }

    try {
      await startAnalysis(file)
    } catch (error) {
      console.error('Analysis error:', error)
    }
  }, [startAnalysis])

  const handleUrlAnalysis = async () => {
    if (!mixUrl.trim()) {
      toast.error('Please enter a public audio URL')
      return
    }
    try {
      await startAnalysisUrl(mixUrl)
    } catch (error) {
      console.error('URL Analysis error:', error)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac'],
    },
    maxFiles: 1,
    disabled: isAnalyzing,
  })

  const handleCopyTracklist = () => {
    const text = tracklist
      .map((track) => `${track.timestamp} - ${track.artist} - ${track.title}`)
      .join('\n')
    
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Tracklist copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const CurrentStageIcon = analysisStages[analysisStage]?.icon || Activity

  return (
    <div className="h-full bg-background-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center">
            <Zap className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold text-white">
              Mix <span className="text-gradient">analyzer</span> AI
            </h1>
            <p className="text-text-secondary">Upload your DJ mix and let AI detect tracks and timestamps</p>
          </div>
        </motion.div>

        {/* Upload Area */}
        {!isAnalyzing && tracklist.length === 0 && !analysisError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div
              {...getRootProps()}
              className={`relative p-16 rounded-3xl border-2 border-dashed transition-all cursor-pointer ${
                isDragActive
                  ? 'border-brand-accent bg-brand-accent-dim'
                  : 'border-brand-accent/20 bg-background-secondary hover:border-brand-accent/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-8 relative z-10">
                <motion.div 
                  animate={isDragActive ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                  transition={{ duration: 0.5, repeat: isDragActive ? Infinity : 0 }}
                  className={`w-28 h-28 rounded-3xl flex items-center justify-center transition-colors ${
                    isDragActive ? 'bg-brand-accent' : 'bg-background-tertiary'
                  }`}
                >
                  <Upload className={`w-14 h-14 ${isDragActive ? 'text-black' : 'text-brand-accent'}`} />
                </motion.div>
                <div className="text-center w-full max-w-2xl mx-auto">
                  <p className="text-3xl text-white font-display font-bold mb-3">
                    {isDragActive ? 'Drop your mix here' : 'Upload your DJ mix'}
                  </p>
                  <p className="text-text-secondary text-lg">
                    Drag and drop an audio file or click to browse
                  </p>
                  <p className="text-text-muted text-sm mt-3 mb-6">
                    Supports MP3, WAV, FLAC (max 500MB)
                  </p>
                  
                  <div className="flex items-center gap-4 w-full max-w-md mx-auto relative z-10 my-8" onClick={(e) => e.stopPropagation()}>
                    <div className="h-px bg-brand-accent/20 flex-1"></div>
                    <span className="text-text-muted text-sm uppercase tracking-widest">or</span>
                    <div className="h-px bg-brand-accent/20 flex-1"></div>
                  </div>

                  <div className="flex gap-3 max-w-xl mx-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex-1">
                       <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                       <input 
                         type="url" 
                         placeholder="Paste public audio URL for Shazam" 
                         value={mixUrl}
                         onChange={(e) => setMixUrl(e.target.value)}
                         onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUrlAnalysis()
                         }}
                         className="w-full pl-12 pr-4 py-4 bg-background-primary border-2 border-brand-accent/20 rounded-xl text-white text-base focus:outline-none focus:border-brand-accent focus:shadow-glow transition-all"
                       />
                    </div>
                    <button 
                      onClick={handleUrlAnalysis}
                      disabled={isAnalyzing}
                      className="px-8 py-4 bg-brand-accent rounded-xl text-black font-bold text-base hover:shadow-glow hover:bg-brand-accent-bright transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Analysis Progress */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-background-secondary rounded-3xl border border-brand-accent/20 p-10 text-center">
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-24 h-24 rounded-3xl bg-brand-accent flex items-center justify-center mx-auto mb-8 shadow-glow"
                >
                  <CurrentStageIcon className="w-12 h-12 text-black" />
                </motion.div>

                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  {analysisStages[analysisStage]?.label || 'Processing...'}
                </h3>
                <p className="text-text-secondary mb-8">
                  This may take a few minutes depending on the mix length
                </p>

                {/* Progress Bar */}
                <div className="relative h-4 bg-background-tertiary rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-accent to-brand-accent/70 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${analysisProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-brand-accent font-mono text-lg mt-4">
                  {analysisProgress}%
                </p>

                {/* Stage Indicators */}
                <div className="flex items-center justify-center gap-3 mt-10 flex-wrap">
                  {Object.entries(analysisStages).map(([key, stage]) => {
                    const isActive = analysisStage === key
                    const isComplete = 
                      Object.keys(analysisStages).indexOf(analysisStage) > 
                      Object.keys(analysisStages).indexOf(key)

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
                          isActive
                            ? 'bg-brand-accent text-black font-semibold'
                            : isComplete
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-background-tertiary text-text-muted'
                        }`}
                      >
                        {isComplete ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <stage.icon className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{stage.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {analysisError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-10 text-center">
                <div className="w-24 h-24 rounded-3xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  Analysis Failed
                </h3>
                <p className="text-text-secondary mb-6">{analysisError}</p>
                <button
                  onClick={clearAnalysis}
                  className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-semibold transition-all"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {tracklist.length > 0 && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              {/* Results Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-display font-bold text-white mb-1">
                    Analysis Results
                  </h2>
                  <p className="text-text-secondary">
                    {tracklist.length} tracks detected
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyTracklist}
                    className="flex items-center gap-2 px-5 py-2.5 bg-background-secondary border border-brand-accent/20 rounded-xl text-white hover:border-brand-accent/50 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => exportTracklist('txt')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-background-secondary border border-brand-accent/20 rounded-xl text-white hover:border-brand-accent/50 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    TXT
                  </button>
                  <button
                    onClick={() => exportTracklist('csv')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent rounded-xl text-black font-semibold hover:shadow-glow transition-all"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Detected Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-background-secondary rounded-2xl p-5 border border-brand-accent/10">
                  <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                    <Music className="w-4 h-4 text-brand-accent" />
                    Tracks
                  </div>
                  <p className="text-3xl font-display font-bold text-white">{tracklist.length}</p>
                </div>
                <div className="bg-background-secondary rounded-2xl p-5 border border-brand-accent/10">
                  <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                    <Waves className="w-4 h-4 text-brand-accent" />
                    BPM
                  </div>
                  <p className="text-3xl font-display font-bold text-white">
                    {detectedBpm ? Math.round(detectedBpm) : '--'}
                  </p>
                </div>
                <div className="bg-background-secondary rounded-2xl p-5 border border-brand-accent/10">
                  <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                    <Clock className="w-4 h-4 text-brand-accent" />
                    Duration
                  </div>
                  <p className="text-3xl font-display font-bold text-white">
                    {tracklist.length > 0 && 
                      formatTimestamp(tracklist[tracklist.length - 1]?.timestampSeconds || 0)}
                  </p>
                </div>
                <div className="bg-background-secondary rounded-2xl p-5 border border-brand-accent/10">
                  <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                    <Check className="w-4 h-4 text-brand-accent" />
                    Confidence
                  </div>
                  <p className="text-3xl font-display font-bold text-white">
                    {Math.round(
                      tracklist.reduce((acc, t) => acc + (t.confidence || 0), 0) / 
                      tracklist.length
                    )}%
                  </p>
                </div>
              </div>

              {/* Tracklist */}
              <div className="bg-background-secondary rounded-2xl border border-brand-accent/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-background-tertiary/50 text-brand-accent text-sm font-semibold tracking-wide">
                  <div className="col-span-2">Time</div>
                  <div className="col-span-4">Title</div>
                  <div className="col-span-3">Artist</div>
                  <div className="col-span-2">BPM</div>
                  <div className="col-span-1">Match</div>
                </div>
                <div className="divide-y divide-brand-accent/5">
                  {tracklist.map((track, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-brand-accent-dim transition-colors"
                    >
                      <div className="col-span-2 font-mono text-brand-accent font-semibold">
                        {track.timestamp}
                      </div>
                      <div className="col-span-4 text-white font-medium">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={track.title}
                            onChange={(e) => updateTrack(index, { title: e.target.value })}
                            className="w-full bg-transparent border border-transparent hover:border-brand-accent/30 focus:border-brand-accent rounded px-2 py-1 text-white text-sm focus:outline-none transition-colors"
                            placeholder="Track Title"
                          />
                          {track.hasCopyright && (
                            <span title="Copyright Match Found on YouTube" className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">
                              <ShieldAlert className="w-3 h-3" /> Copyrighted
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3 text-text-secondary">
                        <input
                          type="text"
                          value={track.artist}
                          onChange={(e) => updateTrack(index, { artist: e.target.value })}
                          className="w-full bg-transparent border border-transparent hover:border-brand-accent/30 focus:border-brand-accent rounded px-2 py-1 text-text-secondary focus:text-white text-sm focus:outline-none transition-colors"
                          placeholder="Artist Name"
                        />
                      </div>
                      <div className="col-span-2 font-mono text-text-secondary">
                        {track.bpm ? Math.round(track.bpm) : '--'}
                      </div>
                      <div className="col-span-1">
                        <span
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-bold ${
                            (track.confidence || 0) >= 80
                              ? 'bg-green-500/20 text-green-400'
                              : (track.confidence || 0) >= 50
                              ? 'bg-brand-accent-dim text-brand-accent'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {track.confidence || 0}%
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Analyze Another */}
              <div className="mt-10 text-center">
                <button
                  onClick={clearAnalysis}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-background-secondary border border-brand-accent/20 rounded-xl text-white hover:border-brand-accent/50 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Analyze Another Mix
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Section */}
        {analysisHistory.length > 0 && !isAnalyzing && tracklist.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12"
          >
            <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-brand-accent" />
              Recent Analyses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysisHistory.slice(0, 6).map((analysis, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-background-secondary rounded-2xl p-5 border border-brand-accent/10 hover:border-brand-accent/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center">
                      <FileAudio className="w-6 h-6 text-black" />
                    </div>
                    <span className="text-text-muted text-sm">
                      {new Date(analysis.createdAt || analysis.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-white font-semibold mb-1 truncate">{analysis.fileName || analysis.file_name}</p>
                  <p className="text-text-secondary text-sm">
                    {analysis.tracklist?.length || 0} tracks detected
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Analyzer
