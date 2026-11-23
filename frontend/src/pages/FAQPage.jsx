import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const faqs = [
  {
    question: 'Is Sound It DJ free?',
    answer: 'Sound It DJ offers free and premium plans. Pricing details will be announced on the official website.'
  },
  {
    question: 'Does Sound It DJ work on Windows?',
    answer: 'Yes. Sound It DJ supports Windows 10 and Windows 11.'
  },
  {
    question: 'Does Sound It DJ work on macOS?',
    answer: 'Yes. Sound It DJ supports both Intel-based Macs and Apple Silicon Macs.'
  },
  {
    question: 'Is Linux supported?',
    answer: 'Not at this time.'
  },
  {
    question: 'Can I import playlists from Rekordbox?',
    answer: 'Yes. Sound It DJ supports importing playlists and collections from supported DJ software.'
  },
  {
    question: 'Can I export playlists to Serato?',
    answer: 'Yes. Playlist export tools are included.'
  },
  {
    question: 'Does Sound It DJ identify songs automatically?',
    answer: 'Yes. The Mix Analyzer can identify tracks within supported DJ mixes.'
  },
  {
    question: 'Is an internet connection required?',
    answer: 'Some features work offline while others require an internet connection.'
  },
  {
    question: 'Are mobile apps available?',
    answer: 'Not yet. iOS and Android applications are currently under development.'
  },
  {
    question: 'Where can I get support?',
    answer: 'Support is available through the Contact page.'
  }
]

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null)

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index)
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-32 pb-20 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <HelpCircle className="w-3 h-3" />
              FAQ
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Frequently Asked <span className="text-brand-accent">Questions</span>
            </h1>
            <p className="text-text-secondary max-w-xl mx-auto">
              Everything you need to know about Sound It DJ. Can't find the answer you're looking for? Reach out on our Contact page.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-background-secondary border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-background-primary/50 transition-colors"
                >
                  <span className="font-semibold text-base pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-brand-accent shrink-0 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-text-secondary leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background-secondary text-center text-sm text-text-muted">
        <p>&copy; {new Date().getFullYear()} Sound It Muzik. All rights reserved.</p>
      </footer>
    </div>
  )
}
