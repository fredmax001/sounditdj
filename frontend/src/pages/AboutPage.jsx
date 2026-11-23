import React from 'react'
import { motion } from 'framer-motion'
import { Music, Target, Globe, Award, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AboutPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background-primary/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="./logo.png?v=2" alt="Sound It DJ Logo" className="h-10 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back Home
            </Link>
          </div>
        </div>
      </nav>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="pt-32 pb-20 px-6"
      >
        <div className="max-w-4xl mx-auto">
          {/* About Sound It DJ */}
          <motion.div variants={itemVariants} className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <Globe className="w-3 h-3" />
              About Us
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Built by DJs, <span className="text-brand-accent">For DJs</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Sound It DJ is a professional desktop application built for DJs who want complete control over their music libraries, playlists, and mixes. Created by DJs for DJs, Sound It DJ combines library management, music acquisition tools, playlist conversion, audio intelligence, and mix analysis into a single platform.
            </p>
          </motion.div>

          {/* Mission */}
          <motion.div variants={itemVariants} className="bg-background-secondary border border-border rounded-2xl p-8 md:p-12 mb-16">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center shrink-0">
                <Target className="w-6 h-6 text-brand-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Our Mission</h2>
                <p className="text-text-secondary leading-relaxed">
                  Our mission is simple: help DJs spend less time managing music and more time performing. Whether you're preparing for a club set, organizing thousands of tracks, building playlists, or generating tracklists for recorded mixes, Sound It DJ provides the tools needed to streamline your workflow.
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-background-primary rounded-xl border border-border">
              <blockquote className="text-xl italic text-text-primary leading-relaxed">
                "Technology should help DJs spend less time managing music and more time playing it."
              </blockquote>
              <p className="mt-4 text-brand-accent font-semibold">— Fred Max, Founder</p>
            </div>
          </motion.div>

          {/* Platform Support */}
          <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6 mb-20">
            <div className="bg-background-primary border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                <Music className="w-6 h-6 text-brand-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Platform Support</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                The platform supports major DJ ecosystems including Rekordbox, Serato, Traktor, and VirtualDJ, making it easier to move music between platforms without losing organization.
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                Sound It DJ is currently available for Windows and macOS, with mobile applications planned for future release.
              </p>
            </div>

            <div className="bg-background-primary border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                <Award className="w-6 h-6 text-brand-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Built by Sound It Muzik</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                Designed for DJs worldwide. From bedroom DJs to touring professionals, our tools are built to scale with your career.
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                Every feature is crafted from real-world DJ experience, ensuring the software fits naturally into your workflow.
              </p>
            </div>
          </motion.div>

          {/* Founder Section */}
          <motion.div variants={itemVariants} className="bg-background-secondary border border-border rounded-2xl p-8 md:p-12">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
                <Award className="w-3 h-3" />
                Founder
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Fred Max</h2>
            </div>

            <div className="space-y-6 text-text-secondary leading-relaxed">
              <p>
                Fred Max is a DJ, music curator, event promoter, entrepreneur, and the founder of Sound It DJ.
              </p>
              <p>
                With years of experience working across live events, nightlife, music promotion, and DJ culture, Fred recognized a challenge shared by DJs around the world: managing music libraries, moving playlists between DJ software, discovering tracks efficiently, and creating accurate tracklists for mixes remained unnecessarily difficult and fragmented.
              </p>
              <p>
                After working with thousands of music files, organizing events, promoting artists, and building platforms that support music communities, he envisioned a solution that would simplify the modern DJ workflow.
              </p>
              <p>
                That vision became Sound It DJ.
              </p>
              <p>
                Sound It DJ was created to give DJs a single platform where they can organize their music, analyze mixes, manage playlists, identify tracks, convert audio, and move seamlessly between DJ ecosystems such as Rekordbox, Serato, Traktor, and VirtualDJ.
              </p>
              <p>
                Fred's goal is to build tools that save DJs time, improve organization, and help artists focus on what matters most — creating unforgettable musical experiences.
              </p>
              <p>
                Today, Sound It DJ continues to evolve as a professional desktop application designed for DJs, music collectors, radio presenters, podcast creators, and audio professionals worldwide.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background-secondary text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} Sound It Muzik. All rights reserved.</p>
      </footer>
    </div>
  )
}
