import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Disc3, Mail, Lock, User, LogIn, UserPlus, AlertCircle, Sparkles, ArrowRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import useAuthStore from '@store/authStore'
import BrandMark from '@components/BrandMark'

const Auth = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { login, register, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (event) => {
    event.preventDefault()
    clearError()

    try {
      if (mode === 'register') {
        await register({ name, email, password })
        toast.success('Account created successfully!')
      } else {
        await login({ email, password })
        toast.success('Welcome back!')
      }

      navigate(from, { replace: true })
    } catch (submitError) {
      toast.error(submitError.message || 'Authentication failed')
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 mesh-gradient relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-secondary/5 rounded-full blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="bg-background-secondary/80 backdrop-blur-xl border border-create-red/20 rounded-3xl p-8 shadow-elevated">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-create-red to-create-red-dark mx-auto flex items-center justify-center mb-4 shadow-glow"
            >
              <Sparkles className="w-8 h-8 text-black" />
            </motion.div>
            <BrandMark size="lg" centered className="justify-center mb-2" />
            <p className="text-text-secondary">Sign in to your DJ workspace</p>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-background-tertiary rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                clearError()
              }}
              className={`py-3 rounded-xl font-semibold transition-all ${
                mode === 'login' 
                  ? 'bg-create-red text-black' 
                  : 'text-text-secondary hover:text-create-red'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                clearError()
              }}
              className={`py-3 rounded-xl font-semibold transition-all ${
                mode === 'register' 
                  ? 'bg-create-red text-black' 
                  : 'text-text-secondary hover:text-create-red'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative"
                >
                  <User className="w-5 h-5 text-create-red absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Display Name"
                    className="w-full pl-12 pr-4 py-4 bg-background-tertiary border border-create-red/20 rounded-2xl text-white placeholder:text-text-muted focus:outline-none focus:border-create-red/50 focus:ring-2 focus:ring-create-red/20 transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="w-5 h-5 text-create-red absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                className="w-full pl-12 pr-4 py-4 bg-background-tertiary border border-create-red/20 rounded-2xl text-white placeholder:text-text-muted focus:outline-none focus:border-create-red/50 focus:ring-2 focus:ring-create-red/20 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="w-5 h-5 text-create-red absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (min 8 characters)"
                className="w-full pl-12 pr-4 py-4 bg-background-tertiary border border-create-red/20 rounded-2xl text-white placeholder:text-text-muted focus:outline-none focus:border-create-red/50 focus:ring-2 focus:ring-create-red/20 transition-all"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-create-red text-black font-bold hover:shadow-glow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Disc3 className="w-5 h-5" />
                  </motion.div>
                  Please wait...
                </>
              ) : (
                <>
                  {mode === 'register' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {mode === 'register' ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-create-red/10" />
            <span className="text-text-muted text-sm">or continue with</span>
            <div className="flex-1 h-px bg-create-red/10" />
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3 px-4 bg-background-tertiary border border-create-red/20 rounded-xl text-text-secondary hover:text-create-red hover:border-create-red/40 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3 px-4 bg-background-tertiary border border-create-red/20 rounded-xl text-text-secondary hover:text-create-red hover:border-create-red/40 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-6">
          By continuing, you agree to our{' '}
          <a href="#" className="text-create-red hover:underline">Terms</a>
          {' '}and{' '}
          <a href="#" className="text-create-red hover:underline">Privacy Policy</a>
        </p>
      </motion.div>
    </div>
  )
}

export default Auth
