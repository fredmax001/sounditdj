import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Music, 
  Activity, 
  Video, 
  Repeat, 
  Image, 
  Usb,
  ArrowRight,
  Disc3,
  Zap,
  Radio,
  Headphones,
  Play,
  Wand2,
  Share2,
  Database
} from 'lucide-react'
import BrandMark from '@components/BrandMark'

const features = [
  {
    icon: Music,
    title: 'Library Manager',
    description: 'Import and organize tracks from all major formats. Extract metadata, BPM, key, and artwork automatically.',
    link: '/library',
    color: 'from-create-red to-create-red-light',
  },
  {
    icon: Activity,
    title: 'Mix Analyzer AI',
    description: 'AI detects tracks, timestamps, BPM, and generates accurate tracklists from your mixes.',
    link: '/analyzer',
    color: 'from-accent-secondary to-accent-purple',
  },
  {
    icon: Video,
    title: 'Visualizer Creator',
    description: 'Create stunning audio-reactive videos with particles, waveforms, and spectrum effects.',
    link: '/visualizer',
    color: 'from-accent-purple to-accent-orange',
  },
  {
    icon: Repeat,
    title: 'Playlist Converter',
    description: 'Convert playlists between Rekordbox, Serato, Traktor, Virtual DJ, and more.',
    link: '/converter',
    color: 'from-accent-orange to-create-red',
  },
  {
    icon: Image,
    title: 'Cover Art Creator',
    description: 'Design professional cover art for your mixes and releases with multiple templates.',
    link: '/cover-art',
    color: 'from-create-red-light to-accent-secondary',
  },
  {
    icon: Usb,
    title: 'USB Export',
    description: 'Export playlists directly to USB drives formatted for Pioneer CDJs and DJ equipment.',
    link: '/usb-export',
    color: 'from-accent-secondary to-accent-purple',
  },
]

const stats = [
  { value: '50K+', label: 'Tracks Analyzed' },
  { value: '10+', label: 'DJ Platforms' },
  { value: 'AI', label: 'Powered' },
]

const highlights = [
  { icon: Wand2, title: 'AI-Powered', desc: 'Smart analysis' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Quick processing' },
  { icon: Share2, title: 'Universal', desc: 'All platforms' },
  { icon: Database, title: 'Organized', desc: 'Smart library' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

const Home = () => {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-gradient">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient Orbs */}
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-create-red/10 rounded-full blur-[150px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 0],
              y: [0, 50, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-accent-secondary/5 rounded-full blur-[180px]"
          />
          <motion.div
            animate={{
              x: [0, 50, 0],
              y: [0, 100, 0],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-[120px]"
          />
          
          {/* Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(9,216,124,0.5) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(9,216,124,0.5) 1px, transparent 1px)`,
              backgroundSize: '80px 80px',
            }}
          />

          {/* Floating Icons */}
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 right-1/5 opacity-10"
          >
            <Disc3 className="w-40 h-40 text-create-red" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute bottom-1/3 left-1/6 opacity-10"
          >
            <Headphones className="w-32 h-32 text-create-red" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute top-1/3 left-1/4 opacity-5"
          >
            <Radio className="w-48 h-48 text-accent-secondary" />
          </motion.div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center"
          >
            {/* Logo */}
            <motion.div variants={itemVariants} className="mb-6">
              <img 
                src="./logo.png?v=2" 
                alt="SOUND IT DJ"
                className="h-40 sm:h-48 w-auto mx-auto object-contain"
              />
            </motion.div>

            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-8">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-create-red-dim border border-create-red/30 text-create-red text-sm font-medium">
                <Zap className="w-4 h-4" />
                Now with AI Mix Analysis
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight"
            >
              <span className="block">Create your</span>
              <span className="block text-gradient">sound</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={itemVariants}
              className="text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              The complete DJ toolkit for modern creators. Import, analyze, and export 
              your music across all platforms with AI-powered intelligence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link
                to="/library"
                className="group relative px-8 py-4 bg-create-red rounded-2xl font-bold text-black overflow-hidden transition-all hover:shadow-glow-lg"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              
              <Link
                to="/analyzer"
                className="group px-8 py-4 rounded-2xl font-semibold text-white border border-create-red/30 hover:border-create-red hover:bg-create-red-dim transition-all flex items-center gap-2"
              >
                <Zap className="w-5 h-5 text-create-red" />
                Try Mix Analyzer
              </Link>
            </motion.div>

            {/* Highlights */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap"
            >
              {highlights.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={index} className="flex items-center gap-3 text-text-secondary">
                    <div className="w-10 h-10 rounded-xl bg-create-red-dim flex items-center justify-center">
                      <Icon className="w-5 h-5 text-create-red" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-semibold text-sm">{item.title}</div>
                      <div className="text-xs">{item.desc}</div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-create-red/30 flex items-start justify-center p-2"
          >
            <motion.div className="w-1 h-2 bg-create-red rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
              Everything you <span className="text-gradient">need</span>
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              A complete suite of tools for professional DJs. From library management 
              to mix analysis and visual creation.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                >
                  <Link
                    to={feature.link}
                    className="group block h-full p-8 rounded-3xl bg-background-primary border border-create-red/10 hover:border-create-red/40 transition-all card-hover"
                  >
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-all shadow-lg`}>
                      <Icon className="w-8 h-8 text-black" />
                    </div>
                    
                    <h3 className="text-2xl font-display font-bold text-white mb-3 group-hover:text-create-red transition-colors">
                      {feature.title}
                    </h3>
                    
                    <p className="text-text-secondary leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-create-red opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                      <span className="text-sm font-semibold tracking-wide">Explore</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-create-red/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
              How it <span className="text-gradient">works</span>
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Get started in minutes with our simple workflow
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Import Your Music',
                description: 'Drag and drop your audio files or import from Spotify, SoundCloud, and other platforms.',
                icon: Music,
              },
              {
                step: '02',
                title: 'Analyze & Organize',
                description: 'Our AI extracts metadata, detects BPM and key, and helps you organize your library.',
                icon: Disc3,
              },
              {
                step: '03',
                title: 'Export Anywhere',
                description: 'Export to any DJ software, USB drives, or create stunning visualizers for your mixes.',
                icon: Zap,
              },
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Connector line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-16 left-full w-full h-px bg-gradient-to-r from-create-red/50 to-transparent" />
                  )}
                  
                  <div className="text-8xl font-display font-bold text-create-red/10 absolute -top-4 -left-2 select-none">
                    {item.step}
                  </div>
                  <div className="relative pt-8">
                    <div className="w-20 h-20 rounded-2xl bg-create-red flex items-center justify-center mb-6 shadow-glow">
                      <Icon className="w-10 h-10 text-black" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-white mb-3">
                      {item.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center p-8 rounded-3xl bg-background-primary border border-create-red/10"
              >
                <div className="text-5xl sm:text-6xl font-display font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-text-secondary tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-create-red-dim to-transparent border border-create-red/30 p-12 md:p-20 text-center"
          >
            {/* Background effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-create-red/10 rounded-full blur-[200px]" />
            <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-accent-secondary/5 rounded-full blur-[100px]" />
            
            <div className="relative z-10">
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
                Ready to <span className="text-gradient">create</span>?
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-10">
                Join thousands of DJs who use CREATE to manage their music, 
                analyze mixes, and create stunning visuals.
              </p>
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-10 py-5 bg-create-red rounded-2xl font-bold text-black hover:shadow-glow-lg transition-all text-lg"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-create-red/10 bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <BrandMark size="md" />
            
            <p className="text-text-muted text-sm">
              © 2026 CREATE. All rights reserved.
            </p>
            
            <div className="flex items-center gap-8">
              <Link to="/library" className="text-text-secondary hover:text-create-red text-sm transition-colors">
                Library
              </Link>
              <Link to="/analyzer" className="text-text-secondary hover:text-create-red text-sm transition-colors">
                Analyzer
              </Link>
              <Link to="/visualizer" className="text-text-secondary hover:text-create-red text-sm transition-colors">
                Visualizer
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
