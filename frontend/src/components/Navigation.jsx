import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Music, 
  Activity, 
  Video, 
  Repeat, 
  Image, 
  Usb, 
  Settings,
  Menu,
  X,
  Download,
  User,
  ChevronDown,
  LogOut,
  Heart,
  Folder,
  Home,
  Radio
} from 'lucide-react'
import useSettingsStore from '@store/settingsStore'
import useAuthStore from '@store/authStore'
import BrandMark from '@components/BrandMark'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/library', label: 'Library', icon: Music },
  { path: '/analyzer', label: 'Analyzer', icon: Activity },
  { path: '/visualizer', label: 'Visualizer', icon: Video },
  { path: '/converter', label: 'Converter', icon: Repeat },
  { path: '/cover-art', label: 'Cover Art', icon: Image },
  { path: '/usb-export', label: 'USB Export', icon: Usb },
  { path: '/integration', label: 'Downloads', icon: Download },
  { path: '/dj-mixes', label: 'DJ Mixes', icon: Radio },
]

const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef(null)
  
  const { settings } = useSettingsStore()
  const authUser = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const account = {
    ...settings?.account,
    name: authUser?.name || settings?.account?.name,
    djName: authUser?.djName || settings?.account?.djName || authUser?.name,
    email: authUser?.email || settings?.account?.email,
    profilePhoto: authUser?.profile_photo || settings?.account?.profilePhoto,
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsProfileOpen(false)
    navigate('/auth', { replace: true })
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-black/90 backdrop-blur-xl border-b border-create-red/20'
          : 'bg-transparent'
      }`}
    >
      <nav className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group flex-shrink-0">
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }} 
              transition={{ duration: 0.2 }}
            >
              <BrandMark size="lg" />
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-1 flex-1 justify-center mx-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative px-1 py-2 group"
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap ${
                      isActive
                        ? 'bg-create-red text-black font-semibold'
                        : 'text-text-secondary hover:text-create-red hover:bg-create-red-dim'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </motion.div>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-1 left-4 right-4 h-0.5 bg-create-red rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Settings Link */}
            <Link
              to="/settings"
              className="hidden sm:flex p-2.5 rounded-xl text-text-secondary hover:text-create-red hover:bg-create-red-dim transition-all"
            >
              <Settings className="w-5 h-5" />
            </Link>

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 rounded-2xl hover:bg-create-red-dim transition-all border border-transparent hover:border-create-red/20"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-create-red to-create-red-dark flex items-center justify-center overflow-hidden">
                  {account.profilePhoto ? (
                    <img 
                      src={account.profilePhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-black" />
                  )}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-white font-medium text-sm">{account.djName || account.name || 'DJ User'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-full mt-2 w-60 bg-background-secondary rounded-2xl border border-create-red/20 shadow-elevated overflow-hidden"
                  >
                    <div className="p-4 border-b border-create-red/10">
                      <p className="text-white font-semibold">{account.djName || account.name || 'DJ User'}</p>
                      <p className="text-text-muted text-sm">{account.email || 'user@create.app'}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          navigate('/settings')
                          setIsProfileOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-secondary hover:text-create-red hover:bg-create-red-dim transition-all"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/library')
                          setIsProfileOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-secondary hover:text-create-red hover:bg-create-red-dim transition-all"
                      >
                        <Folder className="w-4 h-4" />
                        <span className="text-sm">My Library</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/settings')
                          setIsProfileOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-secondary hover:text-create-red hover:bg-create-red-dim transition-all"
                      >
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">Liked Tracks</span>
                      </button>
                      <div className="border-t border-create-red/10 my-2" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2.5 rounded-xl text-text-secondary hover:text-create-red hover:bg-create-red-dim transition-all"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="xl:hidden bg-black/95 backdrop-blur-xl border-b border-create-red/20"
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item, index) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                
                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-create-red text-black font-semibold'
                          : 'text-text-secondary hover:text-create-red hover:bg-create-red-dim'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

export default Navigation
