import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, ArrowLeft, ChevronRight, Download, Library, BarChart3, Import, Wrench, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

const guides = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Play,
    items: [
      'Installing Sound It DJ',
      'Creating your account',
      'Importing your first tracks'
    ]
  },
  {
    id: 'library-management',
    title: 'Library Management',
    icon: Library,
    items: [
      'Organizing tracks',
      'Editing metadata',
      'Creating playlists'
    ]
  },
  {
    id: 'mix-analyzer',
    title: 'Mix Analyzer',
    icon: BarChart3,
    items: [
      'Uploading a mix',
      'Generating tracklists',
      'Exporting results'
    ]
  },
  {
    id: 'import-export',
    title: 'Import & Export',
    icon: Import,
    items: [
      'Rekordbox import',
      'Serato import',
      'Traktor import',
      'VirtualDJ import'
    ]
  },
  {
    id: 'audio-tools',
    title: 'Audio Tools',
    icon: Wrench,
    items: [
      'Audio conversion',
      'Cover art creation',
      'Duplicate detection'
    ]
  }
]

export default function GuidesPage() {
  const [activeGuide, setActiveGuide] = useState('getting-started')

  const currentGuide = guides.find(g => g.id === activeGuide)

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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-32 pb-20 px-6"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <BookOpen className="w-3 h-3" />
              Documentation
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Sound It DJ <span className="text-brand-accent">Guides</span>
            </h1>
            <p className="text-text-secondary max-w-xl mx-auto">
              Learn how to get the most out of Sound It DJ with our step-by-step guides and documentation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {guides.map((guide) => {
              const Icon = guide.icon
              const isActive = activeGuide === guide.id
              return (
                <button
                  key={guide.id}
                  onClick={() => setActiveGuide(guide.id)}
                  className={`text-left p-6 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-brand-accent/10 border-brand-accent/40'
                      : 'bg-background-secondary border-border hover:border-brand-accent/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                    isActive ? 'bg-brand-accent/20' : 'bg-background-primary'
                  }`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-brand-accent' : 'text-text-secondary'}`} />
                  </div>
                  <h3 className={`font-semibold mb-1 ${isActive ? 'text-brand-accent' : ''}`}>
                    {guide.title}
                  </h3>
                  <p className="text-text-muted text-xs">{guide.items.length} topics</p>
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            {currentGuide && (
              <motion.div
                key={currentGuide.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-background-secondary border border-border rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-brand-accent/10 rounded-lg flex items-center justify-center">
                    <currentGuide.icon className="w-5 h-5 text-brand-accent" />
                  </div>
                  <h2 className="text-2xl font-bold">{currentGuide.title}</h2>
                </div>

                <div className="space-y-3">
                  {currentGuide.items.map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="flex items-center gap-4 p-4 bg-background-primary border border-border rounded-xl hover:border-brand-accent/30 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 bg-background-secondary rounded-lg flex items-center justify-center text-sm font-bold text-brand-accent shrink-0">
                        {index + 1}
                      </div>
                      <span className="flex-1 font-medium text-sm">{item}</span>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-accent transition-colors" />
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-background-primary rounded-xl border border-border flex items-center gap-4">
                  <Download className="w-5 h-5 text-brand-accent shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Need more help?</p>
                    <p className="text-xs text-text-secondary">
                      Visit our <Link to="/contact" className="text-brand-accent hover:underline">Contact page</Link> for personalized support.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background-secondary text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} Sound It Muzik. All rights reserved.</p>
      </footer>
    </div>
  )
}
