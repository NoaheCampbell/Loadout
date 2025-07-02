import { useState, useEffect } from 'react'
import { X, Key, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { ipc } from '../lib/ipc'
import toast from 'react-hot-toast'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (isOpen) {
      checkApiKey()
    }
  }, [isOpen])

  const checkApiKey = async () => {
    const hasKey = await ipc.checkApiKey()
    setHasApiKey(hasKey)
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setIsLoading(true)
    try {
      await ipc.saveApiKey(apiKey.trim())
      toast.success('API key saved successfully')
      setApiKey('')
      setHasApiKey(true)
      onClose()
    } catch (error) {
      toast.error('Failed to save API key')
      console.error('Failed to save API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your API key?')) {
      return
    }

    setIsLoading(true)
    try {
      await ipc.deleteApiKey()
      toast.success('API key deleted')
      setHasApiKey(false)
      setApiKey('')
    } catch (error) {
      toast.error('Failed to delete API key')
      console.error('Failed to delete API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Card */}
          <div className={`p-4 rounded-lg border ${
            hasApiKey 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-start gap-3">
              {hasApiKey ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  hasApiKey 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-yellow-900 dark:text-yellow-100'
                }`}>
                  {hasApiKey ? 'API key configured' : 'No API key configured'}
                </p>
                <p className={`text-sm mt-1 ${
                  hasApiKey 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {hasApiKey 
                    ? 'Your app is ready to generate amazing React projects!' 
                    : 'Add your OpenAI API key to start creating projects'}
                </p>
              </div>
            </div>
          </div>

          {/* API Key Input Section */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? 'Enter new key to update' : 'sk-...'}
                className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Help Text */}
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <p className="flex-1">
                Your API key is encrypted and stored locally on your device. It's never sent to our servers.
              </p>
            </div>
            
            {/* Get API Key Link */}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              Get your API key from OpenAI
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex gap-3">
            {hasApiKey && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Key
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isLoading || !apiKey.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? 'Saving...' : hasApiKey ? 'Update API Key' : 'Save API Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 