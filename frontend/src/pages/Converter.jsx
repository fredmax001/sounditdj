import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  FileAudio, 
  Settings, 
  Download, 
  Trash2, 
  Check,
  X,
  Music,
  Loader2,
  Repeat,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios, { MEDIA_BASE_URL } from '../config/axios'

const outputFormats = [
  { value: 'mp3', label: 'MP3', description: 'Compressed, widely compatible' },
  { value: 'wav', label: 'WAV', description: 'Uncompressed, high quality' },
  { value: 'flac', label: 'FLAC', description: 'Lossless compression' },
  { value: 'aac', label: 'AAC', description: 'Efficient compression' },
]

const qualityOptions = {
  mp3: [
    { value: '320', label: '320 kbps', description: 'Highest quality' },
    { value: '256', label: '256 kbps', description: 'High quality' },
    { value: '192', label: '192 kbps', description: 'Good quality' },
    { value: '128', label: '128 kbps', description: 'Standard quality' },
  ],
  wav: [
    { value: '44100', label: '44.1 kHz', description: 'CD quality' },
    { value: '48000', label: '48 kHz', description: 'Professional' },
    { value: '96000', label: '96 kHz', description: 'High resolution' },
  ],
  flac: [
    { value: '0', label: 'Fastest', description: 'Quick compression' },
    { value: '5', label: 'Balanced', description: 'Good balance' },
    { value: '8', label: 'Best', description: 'Maximum compression' },
  ],
  aac: [
    { value: '256', label: '256 kbps', description: 'High quality' },
    { value: '192', label: '192 kbps', description: 'Good quality' },
    { value: '128', label: '128 kbps', description: 'Standard quality' },
  ],
}

const Converter = () => {
  const [files, setFiles] = useState([])
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [quality, setQuality] = useState('320')
  const [converting, setConverting] = useState(false)
  const [currentJob, setCurrentJob] = useState(null)

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
      outputUrl: null,
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'],
    },
  })

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const convertFile = async (fileItem) => {
    const formData = new FormData()
    formData.append('audio', fileItem.file)
    formData.append('format', outputFormat)
    formData.append('quality', quality)

    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'converting' } : f
        )
      )

      const response = await axios.post('/api/convert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id ? { ...f, progress: progress * 0.3 } : f
            )
          )
        },
      })

      const { jobId } = response.data
      setCurrentJob(jobId)

      // Poll for conversion status
      const pollStatus = async () => {
        try {
          const statusResponse = await axios.get(`/api/convert/status/${jobId}`)
          const { status, progress, downloadUrl } = statusResponse.data

          if (status === 'completed') {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileItem.id
                  ? { ...f, status: 'completed', progress: 100, outputUrl: downloadUrl }
                  : f
              )
            )
            return
          } else if (status === 'error') {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileItem.id ? { ...f, status: 'error' } : f
              )
            )
            return
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? { ...f, progress: 30 + progress * 0.7 }
                : f
            )
          )

          setTimeout(pollStatus, 1000)
        } catch (error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id ? { ...f, status: 'error' } : f
            )
          )
        }
      }

      pollStatus()
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'error' } : f
        )
      )
      toast.error(`Failed to convert ${fileItem.file.name}`)
    }
  }

  const convertAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) {
      toast.error('No files to convert')
      return
    }

    setConverting(true)
    for (const file of pendingFiles) {
      await convertFile(file)
    }
    setConverting(false)
    toast.success('All conversions completed')
  }

  const downloadFile = (fileItem) => {
    if (fileItem.outputUrl) {
      // Construct full URL from relative path
      const fullUrl = fileItem.outputUrl.startsWith('http') 
        ? fileItem.outputUrl 
        : `${MEDIA_BASE_URL}${fileItem.outputUrl}`
      
      const a = document.createElement('a')
      a.href = fullUrl
      a.download = `${fileItem.file.name.split('.')[0]}.${outputFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

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
            <Repeat className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold text-white">
              Audio <span className="text-gradient">converter</span>
            </h1>
            <p className="text-text-secondary">Convert your audio files between different formats</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Upload Area */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              {...getRootProps()}
              className={`p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer mb-6 ${
                isDragActive
                  ? 'border-brand-accent bg-brand-accent-dim'
                  : 'border-brand-accent/20 bg-background-secondary hover:border-brand-accent/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-5">
                <motion.div
                  animate={isDragActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: isDragActive ? Infinity : 0 }}
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${
                    isDragActive ? 'bg-brand-accent' : 'bg-background-tertiary'
                  }`}
                >
                  <Upload className={`w-10 h-10 ${isDragActive ? 'text-black' : 'text-brand-accent'}`} />
                </motion.div>
                <div className="text-center">
                  <p className="text-white text-xl font-semibold mb-2">
                    {isDragActive ? 'Drop files here' : 'Drag & drop audio files'}
                  </p>
                  <p className="text-text-secondary">
                    or click to browse (MP3, WAV, FLAC, AAC)
                  </p>
                </div>
              </div>
            </motion.div>

            {/* File List */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-background-secondary rounded-2xl border border-brand-accent/10 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 bg-background-tertiary/50">
                    <span className="text-white font-semibold">
                      {files.length} file{files.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setFiles([])}
                      className="text-text-secondary hover:text-red-400 text-sm transition-all"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="divide-y divide-brand-accent/5">
                    {files.map((fileItem) => (
                      <motion.div
                        key={fileItem.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-4 px-6 py-4"
                      >
                        <div className="w-12 h-12 rounded-xl bg-background-tertiary flex items-center justify-center flex-shrink-0 border border-brand-accent/10">
                          <FileAudio className="w-6 h-6 text-brand-accent" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {fileItem.file.name}
                          </p>
                          <p className="text-text-muted text-sm">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                        </div>

                        {/* Progress */}
                        {fileItem.status === 'converting' && (
                          <div className="w-28">
                            <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-brand-accent rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${fileItem.progress}%` }}
                              />
                            </div>
                            <p className="text-brand-accent text-xs mt-1 text-center font-mono">
                              {Math.round(fileItem.progress)}%
                            </p>
                          </div>
                        )}

                        {/* Status */}
                        {fileItem.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-sm font-medium">Done</span>
                            <button
                              onClick={() => downloadFile(fileItem)}
                              className="p-2 rounded-xl bg-brand-accent-dim text-brand-accent hover:bg-brand-accent hover:text-black transition-all"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {fileItem.status === 'error' && (
                          <span className="text-red-400 text-sm font-medium">Failed</span>
                        )}

                        {/* Remove button */}
                        <button
                          onClick={() => removeFile(fileItem.id)}
                          className="p-2 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {/* Convert All Button */}
                  {files.some((f) => f.status === 'pending') && (
                    <div className="p-6 border-t border-brand-accent/10">
                      <button
                        onClick={convertAll}
                        disabled={converting}
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-brand-accent rounded-xl text-black font-semibold hover:shadow-glow transition-all disabled:opacity-50"
                      >
                        {converting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Converting...
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            Convert All Files
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-background-secondary rounded-2xl border border-brand-accent/10 p-6"
          >
            <h3 className="text-lg font-display font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-accent" />
              Conversion Settings
            </h3>

            {/* Output Format */}
            <div className="mb-6">
              <label className="block text-sm text-text-secondary mb-4">
                Output Format
              </label>
              <div className="space-y-3">
                {outputFormats.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => {
                      setOutputFormat(format.value)
                      setQuality(qualityOptions[format.value][0].value)
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      outputFormat === format.value
                        ? 'border-brand-accent bg-brand-accent-dim'
                        : 'border-brand-accent/10 hover:border-brand-accent/30'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        outputFormat === format.value
                          ? 'border-brand-accent'
                          : 'border-brand-accent/30'
                      }`}
                    >
                      {outputFormat === format.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-accent" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">{format.label}</p>
                      <p className="text-text-muted text-xs">{format.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div>
              <label className="block text-sm text-text-secondary mb-4">
                Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-4 py-3 bg-background-tertiary border border-brand-accent/20 rounded-xl text-white text-sm focus:outline-none focus:border-brand-accent/50"
              >
                {qualityOptions[outputFormat]?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Converter
