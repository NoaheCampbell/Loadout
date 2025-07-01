import { useState, useEffect } from 'react'
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

  // Request notification permissions on app startup
  useEffect(() => {
    ipc.requestNotificationPermission()
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center h-14 px-4">
          <div className="flex items-center">
            <img src="/favicon.ico" alt="Loadout" className="h-12 w-auto max-w-none" />
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
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