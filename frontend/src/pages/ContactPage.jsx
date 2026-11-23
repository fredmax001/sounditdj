import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MessageSquare, Send, ArrowLeft, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    subject: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const mailtoLink = `mailto:sounditmusic232@gmail.com?subject=${encodeURIComponent(
      formData.subject || 'Contact Form Submission'
    )}&body=${encodeURIComponent(
      `Name: ${formData.fullName}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    )}`
    window.location.href = mailtoLink
    setSubmitted(true)
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-6">
              <MessageSquare className="w-3 h-3" />
              Contact
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Get in <span className="text-brand-accent">Touch</span>
            </h1>
            <p className="text-text-secondary max-w-xl mx-auto">
              Have a question, feedback, or partnership inquiry? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-background-secondary border border-border rounded-2xl p-8">
                <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                  <Mail className="w-6 h-6 text-brand-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">General Inquiries</h3>
                <a
                  href="mailto:sounditmusic232@gmail.com"
                  className="text-brand-accent hover:underline"
                >
                  sounditmusic232@gmail.com
                </a>
              </div>

              <div className="bg-background-secondary border border-border rounded-2xl p-8">
                <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                  <MessageSquare className="w-6 h-6 text-brand-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Technical Support</h3>
                <a
                  href="mailto:support@sounditdj.com"
                  className="text-brand-accent hover:underline"
                >
                  support@sounditdj.com
                </a>
              </div>

              <div className="bg-background-secondary border border-border rounded-2xl p-8">
                <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                  <MapPin className="w-6 h-6 text-brand-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Built by Sound It Muzik</h3>
                <p className="text-text-secondary text-sm">
                  Designed for DJs worldwide. From bedroom DJs to touring professionals.
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-background-secondary border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-6">Send a Message</h3>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-brand-accent" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Opening your email client...</h4>
                  <p className="text-text-secondary text-sm">
                    Your message has been prepared. Send it from your email app to complete.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background-primary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-accent transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background-primary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-accent transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Subject</label>
                    <input
                      type="text"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background-primary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-accent transition-colors"
                      placeholder="How can we help?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Message</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background-primary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-accent transition-colors resize-none"
                      placeholder="Tell us more..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-brand-accent text-brand-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>
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
