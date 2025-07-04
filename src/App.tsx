import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store'
import { ipc } from './lib/ipc'
import Sidebar from './components/Sidebar'
import Workspace from './components/Workspace'
import ThemeToggle from './components/ThemeToggle'
import ChatWindow from './components/ChatWindow'
import SettingsModal from './components/SettingsModal'
import WorkflowModal from './components/WorkflowModal'
import { GitBranch } from 'lucide-react'
import toast from 'react-hot-toast'
import './App.css'
// Import logo as module to ensure it's bundled correctly
import logoUrl from '/Loadout.png'
function App() {
  const { theme, setProjects } = useStore()
  const [currentRoute, setCurrentRoute] = useState('main')
  const [showSettings, setShowSettings] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)

  // Check route on mount and hash changes
  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash
      if (hash === '#/chat' || hash === '#chat') {
        setCurrentRoute('chat')
      } else {
        setCurrentRoute('main')
      }
    }
    
    checkRoute()
    window.addEventListener('hashchange', checkRoute)
    return () => window.removeEventListener('hashchange', checkRoute)
  }, [])

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Check provider configuration on startup
  useEffect(() => {
    if (currentRoute === 'main') {
      const checkProviderConfig = async () => {
        const hasConfig = await ipc.checkProviderConfig()
        setHasApiKey(hasConfig)
        
        if (!hasConfig) {
          // Show a toast after a short delay to let the app load
          setTimeout(() => {
            toast.error('Please configure an AI provider in Settings', {
              duration: 6000,
              icon: '🔑'
            })
          }, 1000)
        }
      }
      checkProviderConfig()
    }
  }, [currentRoute])

  // Listen for open settings event from ModelSelector
  useEffect(() => {
    const handleOpenSettings = () => {
      setShowSettings(true)
    }
    
    window.addEventListener('open-settings', handleOpenSettings)
    return () => window.removeEventListener('open-settings', handleOpenSettings)
  }, [])

  // Load projects on mount (only for main app)
  useEffect(() => {
    if (currentRoute === 'main') {
      const loadProjects = async () => {
        try {
          await ipc.ensureStorage()
          const projects = await ipc.listProjects()
          setProjects(projects)
        } catch (error) {
          console.error('Failed to load projects:', error)
        }
      }
      loadProjects()
    }
  }, [setProjects, currentRoute])

  // Request notification permissions on app startup
  useEffect(() => {
    if (currentRoute === 'main') {
      ipc.requestNotificationPermission()
    }
  }, [currentRoute])

  // Render chat window if on chat route
  if (currentRoute === 'chat') {
    return <ChatWindow />
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Header - Draggable for window movement */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center h-14 px-4">
          {/* Add padding on macOS to account for traffic lights */}
          <div className={`flex items-center ${typeof window !== 'undefined' && window.electron?.platform === 'darwin' ? 'ml-20' : ''}`}>
            <img 
              src={logoUrl} 
              alt="Loadout" 
              className="h-9 w-auto max-w-none"
              onError={(e) => {
                // Fallback to text if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                console.error('Failed to load logo');
              }}
            />
            <span className="ml-2 text-lg font-semibold">Loadout</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={() => setShowWorkflow(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg transition-all duration-200"
                title="View LangGraph Workflow - See how Loadout generates projects"
              >
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Workflow</span>
              </button>
            </div>
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
        <main className="flex-1 overflow-hidden">
          <Workspace />
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => {
          setShowSettings(false)
          // Re-check API key after closing settings
          ipc.checkApiKey().then(setHasApiKey)
        }} 
      />

      {/* Workflow Modal */}
      <WorkflowModal 
        isOpen={showWorkflow} 
        onClose={() => setShowWorkflow(false)} 
      />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

export default App