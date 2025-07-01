import { Moon, Sun } from 'lucide-react'
import { useStore } from '../store'

export default function ThemeToggle() {
  const { theme, setTheme } = useStore()

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-200"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
} 