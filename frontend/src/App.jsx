import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import TopNav from '@components/TopNav'
import Sidebar from '@components/Sidebar'
import GlobalAudioPlayer from '@components/GlobalAudioPlayer'
import LibraryView from '@pages/LibraryView'
import ImportView from '@pages/ImportView'
import ExportView from '@pages/ExportView'
import ToolsView from '@pages/ToolsView'
import IntegrationView from '@pages/IntegrationView'
import SettingsView from '@pages/SettingsView'
import Auth from '@pages/Auth'
import AdminControlPanel from '@pages/AdminControlPanel'
import LandingPage from '@pages/LandingPage'
import AboutPage from '@pages/AboutPage'
import FAQPage from '@pages/FAQPage'
import ContactPage from '@pages/ContactPage'
import GuidesPage from '@pages/GuidesPage'

import useAuthStore from '@store/authStore'
import useAdminStore from '@store/adminStore'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('UI ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen bg-[#00101D] text-[#e8e8e8] flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="text-lg font-bold text-[#FAE1AF] uppercase tracking-wider">
            Something went wrong in this view
          </div>
          <div className="max-w-lg text-xs font-mono bg-[#051626] border border-[#1a3a5c] rounded-lg p-3 text-red-300 break-all">
            {this.state.error?.message || 'Unexpected UI error'}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-5 py-2 rounded-lg bg-[#FAE1AF] text-[#00101D] text-xs font-bold uppercase tracking-wider"
          >
            Recover View
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function FullScreenLoader({ label = 'LOADING SOUND IT DJ' }) {
  const [showLabel, setShowLabel] = React.useState(false)
  
  React.useEffect(() => {
    const t = setTimeout(() => setShowLabel(true), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="h-screen w-screen bg-[#00101D] flex flex-col items-center justify-center gap-6 select-none">
      <div className="flex flex-col items-center gap-4">
        <img 
          src="./brandmark.png" 
          alt="Sound It DJ Emblem" 
          className="h-24 w-auto object-contain animate-pulse drop-shadow-[0_0_20px_rgba(250,225,175,0.35)]" 
        />
        <img 
          src="./logo.png" 
          alt="SOUND IT DJ" 
          className="h-7 w-auto object-contain" 
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FAE1AF] animate-ping" />
        <div className={`text-[#FAE1AF] font-mono text-[11px] tracking-[0.35em] uppercase font-semibold transition-opacity duration-700 ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
          {label}
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('library')
  const [activeSubItem, setActiveSubItem] = useState('all-tracks')
  const [importSection, setImportSection] = useState('serato')
  const [showHealthPanel, setShowHealthPanel] = useState(false)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    switch (tab) {
      case 'library':
        if (!activeSubItem || ['converter', 'shazam', 'account'].includes(activeSubItem)) {
          setActiveSubItem('all-tracks')
        }
        break
      case 'import':
        break
      case 'export':
        break
      case 'tools':
        setActiveSubItem('converter')
        break
      case 'integration':
        setActiveSubItem('shazam')
        break
      case 'settings':
        setActiveSubItem('account')
        break
    }
  }

  const handleSidebarSubItem = (subItem) => {
    setActiveSubItem(subItem)
    if (activeTab === 'import' || activeTab === 'export') {
      setActiveTab('library')
    }
  }

  const renderMainContent = () => {
    switch (activeTab) {
      case 'library':
        return (
          <LibraryView
            activeSubItem={activeSubItem}
            showHealthPanel={showHealthPanel}
            onCloseHealth={() => setShowHealthPanel(false)}
          />
        )
      case 'import':
        return (
          <ImportView
            initialSection={importSection}
            onGoToLibrary={() => {
              setActiveSubItem('all-tracks')
              setActiveTab('library')
            }}
          />
        )
      case 'export':
        return <ExportView />
      case 'tools':
        return <ToolsView activeSubItem={activeSubItem} />
      case 'integration':
        return <IntegrationView activeSubItem={activeSubItem} />
      case 'settings':
        return <SettingsView activeSubItem={activeSubItem} />
      default:
        return <LibraryView activeSubItem={activeSubItem} />
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background-primary overflow-hidden">
      <GlobalAudioPlayer />
      <TopNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenImportProgress={() => setImportSection('progress')}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          activeTab={activeTab}
          activeSubItem={activeSubItem}
          onSubItemChange={handleSidebarSubItem}
          onHealthClick={() => {
            setActiveTab('library')
            setShowHealthPanel(true)
          }}
        />

        <main className="flex-1 min-w-0 overflow-hidden">
          {renderMainContent()}
        </main>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  const { isAuthenticated, isInitializing, initializeAuth } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    isInitializing: state.isInitializing,
    initializeAuth: state.initializeAuth,
  }))

  const isAdminAuthenticated = useAdminStore((state) => state.isAuthenticated)
  const isAdminInitializing = useAdminStore((state) => state.isInitializing)
  const initializeAdmin = useAdminStore((state) => state.initializeAdmin)

  useEffect(() => {
    initializeAuth()
    initializeAdmin()
  }, [initializeAuth, initializeAdmin])

  if (isAdminRoute) {
    if (isAdminInitializing) {
      return <FullScreenLoader label="ADMIN" />
    }

    return (
      <>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1f3a',
              color: '#fff',
              border: '1px solid rgba(237, 198, 30, 0.2)',
            },
          }}
        />
        <Routes>
          <Route path="/admin/*" element={<AdminControlPanel key={isAdminAuthenticated ? 'admin-authenticated' : 'admin-guest'} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </>
    )
  }

  if (isInitializing) {
    return <FullScreenLoader />
  }

  const isDesktop = window.electronAPI?.isElectron

  if (!isDesktop) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#051626',
              color: '#FAE1AF',
              border: '1px solid rgba(250, 225, 175, 0.25)',
            },
            success: {
              iconTheme: {
                primary: '#FAE1AF',
                secondary: '#00101D',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#00101D',
              },
            },
          }}
        />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Navigate to="/auth" replace state={{ from: location.pathname }} />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#051626',
            color: '#FAE1AF',
            border: '1px solid rgba(250, 225, 175, 0.25)',
          },
          success: {
            iconTheme: {
              primary: '#FAE1AF',
              secondary: '#00101D',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#00101D',
            },
          },
        }}
      />
      <AppErrorBoundary>
        <MainApp />
      </AppErrorBoundary>
    </>
  )
}

export default App
