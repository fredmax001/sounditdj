import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Download, Monitor, Smartphone, Activity, Cloud, Music, ChevronRight,
  Library, BarChart3, Wrench, Image, Repeat, Search, HelpCircle,
  Mail, MessageSquare, Award, Target, Globe, ArrowRight
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

const features = [
  { icon: Library, title: 'DJ Library Management', desc: 'Import, organize, search, tag, and manage your music collection from one central location.' },
  { icon: Music, title: 'Playlist Management', desc: 'Create playlists, smart playlists, and collections that sync with your DJ workflow.' },
  { icon: BarChart3, title: 'Mix Analyzer', desc: 'Analyze recorded DJ mixes and automatically generate tracklists, BPM information, and timestamps.' },
  { icon: Repeat, title: 'Audio Conversion', desc: 'Convert between MP3, WAV, FLAC, and AAC formats using professional audio processing.' },
  { icon: Search, title: 'Music Discovery', desc: 'Import playlists and discover tracks from supported music sources.' },
  { icon: Activity, title: 'Metadata Editor', desc: 'Edit titles, artists, artwork, genres, ratings, comments, and other track information.' },
  { icon: Wrench, title: 'Duplicate Finder', desc: 'Detect duplicate tracks and clean your library efficiently.' },
  { icon: Search, title: 'Missing Track Recovery', desc: 'Locate missing files and reconnect them to your collection.' },
  { icon: Repeat, title: 'DJ Software Import & Export', desc: 'Transfer playlists and libraries between Rekordbox, Serato, Traktor, and VirtualDJ.' },
  { icon: Image, title: 'Cover Art Creator', desc: 'Create professional artwork for mixes, playlists, podcasts, and promotional releases.' },
  { icon: Cloud, title: 'Cloud Sync & Download', desc: 'Download tracks directly from SoundCloud, and back up your entire library securely to your cloud workspace.' },
  { icon: Activity, title: 'Visualizer Creator', desc: 'Generate stunning, reactive audio-visuals for your sets in real-time. Export high-quality videos instantly.' },
]

const faqs = [
  { q: 'Is Sound It DJ free?', a: 'Sound It DJ offers free and premium plans. Pricing details will be announced on the official website.' },
  { q: 'Does Sound It DJ work on Windows?', a: 'Yes. Sound It DJ supports Windows 10 and Windows 11.' },
  { q: 'Does Sound It DJ work on macOS?', a: 'Yes. Sound It DJ supports both Intel-based Macs and Apple Silicon Macs.' },
  { q: 'Can I import playlists from Rekordbox?', a: 'Yes. Sound It DJ supports importing playlists and collections from supported DJ software.' },
  { q: 'Does Sound It DJ identify songs automatically?', a: 'Yes. The Mix Analyzer can identify tracks within supported DJ mixes.' },
  { q: 'Are mobile apps available?', a: 'Not yet. iOS and Android applications are currently under development.' },
]

const Heartbeat = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-20">
    <motion.svg
      width="800"
      height="200"
      viewBox="0 0 800 200"
      initial={{ x: -800 }}
      animate={{ x: 800 }}
      transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
    >
      <path
        d="M 0 100 L 300 100 L 320 50 L 350 150 L 380 20 L 410 180 L 440 80 L 460 100 L 800 100"
        fill="none"
        stroke="#EDC61E"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 10px #EDC61E)' }}
      />
    </motion.svg>
  </div>
)

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-background-primary text-text-primary overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background-primary/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="./logo.png?v=2" alt="Sound It DJ Logo" className="h-10 w-auto object-contain" />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-text-secondary hover:text-text-primary transition-colors">Features</a>
            <a href="#about" className="text-text-secondary hover:text-text-primary transition-colors">About</a>
            <a href="#faq" className="text-text-secondary hover:text-text-primary transition-colors">FAQ</a>
            <Link to="/guides" className="text-text-secondary hover:text-text-primary transition-colors">Guides</Link>
            <Link to="/contact" className="text-text-secondary hover:text-text-primary transition-colors">Contact</Link>
            <a href="#download" className="px-4 py-2 bg-brand-accent text-brand-primary rounded-lg font-bold text-xs hover:opacity-90 transition-opacity">
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 min-h-[90vh] flex flex-col items-center justify-center text-center">
        <Heartbeat />
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-8">
            <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
            BETA Available Now
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            The Ultimate <span className="text-brand-accent">DJ Toolkit</span> for the Modern Era.
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Unleash your creativity with advanced visualizers, seamless cloud integration, and effortless playlist management. Built natively for Desktop.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#download" className="px-8 py-4 bg-brand-accent text-brand-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
              <Download className="w-5 h-5" />
              Get Sound It DJ
            </a>
            <a href="#features" className="px-8 py-4 bg-background-secondary text-text-primary border border-border rounded-xl font-bold text-sm hover:bg-background-tertiary transition-colors flex items-center gap-2">
              Explore Features
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
          className="relative z-10 mt-20 w-full max-w-5xl aspect-video bg-background-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex items-center justify-center"
        >
          <img src="/app_screenshot.png" className="w-full h-full object-cover" alt="Sound It DJ App Interface" />
          <div className="absolute top-0 w-full h-10 border-b border-border bg-background-tertiary/50 backdrop-blur-sm flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-background-secondary border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Everything you need, <span className="text-brand-accent">nothing you don't.</span>
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Sound It DJ centralizes your workflow, providing the most powerful utility suite directly on your desktop.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-background-primary p-6 rounded-2xl border border-border hover:border-brand-accent/30 transition-colors"
              >
                <div className="w-10 h-10 bg-brand-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-brand-accent" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About / Mission Section */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <Globe className="w-3 h-3" />
              About
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built by DJs, <span className="text-brand-accent">For DJs</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Sound It DJ is a professional desktop application built for DJs who want complete control over their music libraries, playlists, and mixes. Our mission is simple: help DJs spend less time managing music and more time performing.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-background-secondary border border-border rounded-2xl p-8"
            >
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-brand-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Our Mission</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Whether you're preparing for a club set, organizing thousands of tracks, building playlists, or generating tracklists for recorded mixes, Sound It DJ provides the tools needed to streamline your workflow.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-background-secondary border border-border rounded-2xl p-8"
            >
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                <Award className="w-6 h-6 text-brand-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Platform Support</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Supports major DJ ecosystems including Rekordbox, Serato, Traktor, and VirtualDJ. Available for Windows and macOS, with mobile applications planned for future release.
              </p>
            </motion.div>
          </div>

          {/* Founder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background-secondary border border-border rounded-2xl p-8 md:p-12"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">Meet the Founder</h3>
              <p className="text-brand-accent font-semibold text-lg">Fred Max</p>
            </div>
            <div className="space-y-4 text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto text-center">
              <p>
                Fred Max is a DJ, music curator, event promoter, entrepreneur, and the founder of Sound It DJ. With years of experience working across live events, nightlife, music promotion, and DJ culture, he recognized a challenge shared by DJs around the world.
              </p>
              <p>
                Managing music libraries, moving playlists between DJ software, discovering tracks efficiently, and creating accurate tracklists for mixes remained unnecessarily difficult and fragmented.
              </p>
              <p>
                That vision became Sound It DJ — a single platform where DJs can organize their music, analyze mixes, manage playlists, identify tracks, convert audio, and move seamlessly between DJ ecosystems.
              </p>
            </div>
            <div className="mt-8 p-6 bg-background-primary rounded-xl border border-border text-center">
              <blockquote className="text-lg italic text-text-primary leading-relaxed">
                "Technology should help DJs spend less time managing music and more time playing it."
              </blockquote>
              <p className="mt-3 text-brand-accent font-semibold">— Fred Max</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6 bg-background-secondary border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <HelpCircle className="w-3 h-3" />
              FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Frequently Asked <span className="text-brand-accent">Questions</span>
            </h2>
          </motion.div>

          <div className="space-y-3 mb-8">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-background-primary border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-background-primary/80 transition-colors"
                >
                  <span className="font-semibold text-sm pr-4">{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-brand-accent shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-90' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/faq" className="inline-flex items-center gap-2 text-brand-accent font-medium hover:underline">
              View all FAQs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background-secondary border border-border rounded-2xl p-8 md:p-12 text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <Mail className="w-3 h-3" />
              Contact
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Need Help or Have Feedback?</h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-8">
              Our team is here to help. Reach out for support, partnerships, or general inquiries.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a href="mailto:sounditmusic232@gmail.com" className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-accent transition-colors">
                <Mail className="w-4 h-4" />
                sounditmusic232@gmail.com
              </a>
              <a href="mailto:support@sounditdj.com" className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-accent transition-colors">
                <MessageSquare className="w-4 h-4" />
                support@sounditdj.com
              </a>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-accent text-brand-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="w-4 h-4" />
              Contact Us
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24 px-6 bg-background-secondary border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Get Started Today</h2>
          <p className="text-text-secondary mb-12">Experience the full power of Sound It DJ by downloading the native desktop application.</p>

          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <a
              href="/downloads/Sound It DJ 1.0.0.exe"
              className="group p-6 bg-background-primary border border-border rounded-2xl hover:border-brand-accent transition-colors text-left flex items-start gap-4"
            >
              <Monitor className="w-10 h-10 text-brand-accent shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-brand-accent transition-colors">Windows Desktop</h3>
                <p className="text-sm text-text-secondary mb-3">Windows 10/11 (.exe)</p>
                <span className="text-brand-accent text-sm font-medium flex items-center gap-1">Download <ChevronRight className="w-4 h-4" /></span>
              </div>
            </a>

            <div className="p-6 bg-background-primary border border-border rounded-2xl text-left flex items-start gap-4">
              <Monitor className="w-10 h-10 text-brand-accent shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">macOS Desktop</h3>
                <p className="text-sm text-text-secondary mb-4">Requires macOS 10.15+</p>
                <div className="flex flex-col gap-2">
                  <a href="/downloads/Sound It DJ-1.0.0-arm64.dmg" className="w-full text-center py-2 bg-background-secondary border border-border hover:border-brand-accent hover:text-brand-accent rounded-lg text-xs font-medium transition-colors">
                    Download for Apple Silicon
                  </a>
                  <a href="/downloads/Sound It DJ-1.0.0.dmg" className="w-full text-center py-2 bg-background-secondary border border-border hover:border-brand-accent hover:text-brand-accent rounded-lg text-xs font-medium transition-colors">
                    Download for Intel Mac
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-3 px-6 py-4 bg-background-primary border border-border rounded-full">
            <Smartphone className="w-5 h-5 text-text-muted" />
            <span className="text-sm font-medium text-text-secondary">Mobile Apps for iOS & Android are coming soon!</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-background-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="./logo.png?v=2" alt="Sound It DJ Logo" className="h-8 w-auto object-contain" />
              </div>
              <p className="text-text-secondary text-sm">
                Professional DJ Library & Mix Intelligence Platform.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Product</h4>
              <div className="space-y-2 text-sm text-text-secondary">
                <a href="#features" className="block hover:text-brand-accent transition-colors">Features</a>
                <a href="#download" className="block hover:text-brand-accent transition-colors">Download</a>
                <Link to="/guides" className="block hover:text-brand-accent transition-colors">Guides</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <div className="space-y-2 text-sm text-text-secondary">
                <Link to="/about" className="block hover:text-brand-accent transition-colors">About</Link>
                <Link to="/faq" className="block hover:text-brand-accent transition-colors">FAQ</Link>
                <Link to="/contact" className="block hover:text-brand-accent transition-colors">Contact</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Support</h4>
              <div className="space-y-2 text-sm text-text-secondary">
                <a href="mailto:support@sounditdj.com" className="block hover:text-brand-accent transition-colors">support@sounditdj.com</a>
                <a href="mailto:sounditmusic232@gmail.com" className="block hover:text-brand-accent transition-colors">sounditmusic232@gmail.com</a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-text-muted">
            <p>&copy; {new Date().getFullYear()} Sound It Muzik. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
