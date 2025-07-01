import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store'
import { ipc } from './lib/ipc'
import Sidebar from './components/Sidebar'
import Workspace from './components/Workspace'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

function App() {
  const { theme, setProjects } = useStore()

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Load projects on mount
  useEffect(() => {
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
  }, [setProjects])

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <img src="/favicon.ico" alt="FlowGenius" className="w-8 h-8" />
          <h1 className="text-xl font-semibold">FlowGenius</h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Workspace />
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

export default App