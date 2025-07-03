import { useState, useEffect } from 'react'
import { X, Key, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink, Cpu, Cloud, Loader2 } from 'lucide-react'
import { ipc } from '../lib/ipc'
import toast from 'react-hot-toast'
import { ProviderConfig } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    requiresApiKey: true,
    models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'High-quality models from OpenAI',
    apiKeyPlaceholder: 'sk-...'
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    requiresApiKey: true,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Claude models with strong reasoning',
    apiKeyPlaceholder: 'sk-ant-...'
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: '💻',
    requiresApiKey: false,
    models: [], // Dynamically populated
    defaultModel: '',
    apiKeyUrl: '',
    description: 'Free local models, no internet required',
    setupUrl: 'https://ollama.ai',
    setupInstructions: 'Install Ollama and download models locally'
  }
} as const

type Provider = keyof typeof PROVIDER_INFO

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider>('openai')
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: '',
    anthropic: ''
  })
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    openai: 'gpt-4',
    anthropic: 'claude-3-5-sonnet-20241022',
    ollama: ''
  })
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    openai: false,
    anthropic: false
  })
  const [isCheckingOllama, setIsCheckingOllama] = useState(false)
  const [isWarmingUp, setIsWarmingUp] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      // First check for existing provider config
      const providerConfig = await ipc.getProviderConfig()
      
      if (providerConfig) {
        setConfig(providerConfig)
        setSelectedProvider(providerConfig.selectedProvider)
        
        // Set selected models from config
        if (providerConfig.providers.openai?.model) {
          setSelectedModels(prev => ({ ...prev, openai: providerConfig.providers.openai!.model! }))
        }
        if (providerConfig.providers.anthropic?.model) {
          setSelectedModels(prev => ({ ...prev, anthropic: providerConfig.providers.anthropic!.model! }))
        }
        if (providerConfig.providers.ollama?.model) {
          setSelectedModels(prev => ({ ...prev, ollama: providerConfig.providers.ollama!.model }))
        }
              } else {
          // Check for legacy API key
          const hasLegacyKey = await ipc.checkApiKey()
          if (hasLegacyKey) {
            // Migration will happen automatically in backend
            toast('Migrating from OpenAI-only setup...', { icon: 'ℹ️' })
          }
        }
      
      // Check for Ollama models if Ollama is selected
      if (selectedProvider === 'ollama') {
        checkOllamaModels()
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const checkOllamaModels = async () => {
    setIsCheckingOllama(true)
    try {
      const models = await ipc.getOllamaModels()
      setOllamaModels(models)
      
      if (models.length === 0) {
        toast.error('No Ollama models found. Please install Ollama and download models.')
      } else if (!selectedModels.ollama && models.length > 0) {
        // Auto-select first model if none selected
        setSelectedModels(prev => ({ ...prev, ollama: models[0] }))
      }
    } catch (error) {
      console.error('Failed to get Ollama models:', error)
      toast.error('Could not connect to Ollama. Is it running?')
    } finally {
      setIsCheckingOllama(false)
    }
  }

  const handleSave = async () => {
    const provider = PROVIDER_INFO[selectedProvider]
    
    // Validate based on provider
    if (provider.requiresApiKey && !apiKeys[selectedProvider]?.trim()) {
      // Check if we have an existing API key for this provider
      const hasExistingKey = selectedProvider === 'openai' 
        ? !!config?.providers.openai?.apiKey
        : selectedProvider === 'anthropic' 
        ? !!config?.providers.anthropic?.apiKey
        : false
        
      if (!hasExistingKey) {
        toast.error(`Please enter an API key for ${provider.name}`)
        return
      }
    }
    
    if (selectedProvider === 'ollama' && !selectedModels.ollama) {
      toast.error('Please select an Ollama model')
      return
    }

    setIsLoading(true)
    
    // Show warming up message for Ollama
    if (selectedProvider === 'ollama' && selectedModels.ollama) {
      setIsWarmingUp(true)
      toast.loading('Warming up Ollama model...', { 
        id: 'ollama-warmup',
        duration: 5000 
      })
    }
    
    try {
      const newConfig: ProviderConfig = {
        selectedProvider,
        providers: {}
      }
      
      // Save OpenAI config
      if (apiKeys.openai || config?.providers.openai?.apiKey) {
        newConfig.providers.openai = {
          apiKey: apiKeys.openai || config!.providers.openai!.apiKey,
          model: selectedModels.openai
        }
      }
      
      // Save Anthropic config
      if (apiKeys.anthropic || config?.providers.anthropic?.apiKey) {
        newConfig.providers.anthropic = {
          apiKey: apiKeys.anthropic || config!.providers.anthropic!.apiKey,
          model: selectedModels.anthropic
        }
      }
      
      // Save Ollama config
      if (selectedProvider === 'ollama') {
        newConfig.providers.ollama = {
          model: selectedModels.ollama,
          baseUrl: 'http://localhost:11434'
        }
      }
      
      await ipc.saveProviderConfig(newConfig)
      toast.success('Settings saved successfully')
      
      // Dismiss warming up toast if it exists
      if (selectedProvider === 'ollama') {
        toast.dismiss('ollama-warmup')
        toast.success('Ollama model is being warmed up in the background', {
          duration: 3000,
          icon: '🚀'
        })
      }
      
      setConfig(newConfig)
      setApiKeys({ openai: '', anthropic: '' }) // Clear temporary API keys
      onClose()
    } catch (error) {
      toast.error('Failed to save settings')
      console.error('Failed to save config:', error)
    } finally {
      setIsLoading(false)
      setIsWarmingUp(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all provider configurations?')) {
      return
    }

    setIsLoading(true)
    try {
      await ipc.deleteProviderConfig()
      toast.success('Provider configurations deleted')
      setConfig(null)
      setApiKeys({ openai: '', anthropic: '' })
    } catch (error) {
      toast.error('Failed to delete configurations')
      console.error('Failed to delete config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProviderChange = (provider: Provider) => {
    setSelectedProvider(provider)
    if (provider === 'ollama' && ollamaModels.length === 0) {
      checkOllamaModels()
    }
  }

  if (!isOpen) return null

  const currentProviderInfo = PROVIDER_INFO[selectedProvider]
  const hasConfig = config?.providers[selectedProvider]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                AI Provider Settings
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
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select AI Provider
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(PROVIDER_INFO) as Provider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => handleProviderChange(provider)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedProvider === provider
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-1">{PROVIDER_INFO[provider].icon}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {PROVIDER_INFO[provider].name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {PROVIDER_INFO[provider].description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-lg border ${
              hasConfig 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start gap-3">
                {hasConfig ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    hasConfig 
                      ? 'text-green-900 dark:text-green-100' 
                      : 'text-yellow-900 dark:text-yellow-100'
                  }`}>
                    {hasConfig 
                      ? `${currentProviderInfo.name} configured` 
                      : `${currentProviderInfo.name} not configured`}
                  </p>
                  <p className={`text-sm mt-1 ${
                    hasConfig 
                      ? 'text-green-700 dark:text-green-300' 
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {hasConfig 
                      ? 'Your app is ready to generate amazing React projects!' 
                      : currentProviderInfo.requiresApiKey
                        ? `Add your ${currentProviderInfo.name} API key to start creating projects`
                        : 'Select a model to start creating projects offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Provider-specific Configuration */}
            {currentProviderInfo.requiresApiKey ? (
              // API Key Configuration
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentProviderInfo.name} API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys[selectedProvider] ? 'text' : 'password'}
                    value={apiKeys[selectedProvider]}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, [selectedProvider]: e.target.value }))}
                    placeholder={hasConfig ? 'Enter new key to update' : currentProviderInfo.apiKeyPlaceholder}
                    className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, [selectedProvider]: !prev[selectedProvider] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    {showKeys[selectedProvider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Model Selection */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Model
                  </label>
                  <select
                    value={selectedModels[selectedProvider]}
                    onChange={(e) => setSelectedModels(prev => ({ ...prev, [selectedProvider]: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {currentProviderInfo.models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                
                {/* Get API Key Link */}
                <a
                  href={currentProviderInfo.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors mt-2"
                >
                  Get your API key from {currentProviderInfo.name}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              // Ollama Configuration
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Available Models
                  </label>
                  <button
                    onClick={checkOllamaModels}
                    disabled={isCheckingOllama}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50"
                  >
                    {isCheckingOllama ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking...
                      </span>
                    ) : (
                      'Refresh Models'
                    )}
                  </button>
                </div>
                
                {ollamaModels.length > 0 ? (
                  <select
                    value={selectedModels.ollama}
                    onChange={(e) => setSelectedModels(prev => ({ ...prev, ollama: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a model</option>
                    {ollamaModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <Cpu className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No Ollama models found
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Make sure Ollama is running and you have downloaded models
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-sm">
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    Install Ollama
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-gray-400">•</span>
                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    ollama pull llama2
                  </code>
                </div>
                
                {/* Keep-alive info for Ollama */}
                {selectedProvider === 'ollama' && selectedModels.ollama && config?.selectedProvider === 'ollama' && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          Model Keep-Alive Active
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          Your model will stay loaded in memory for instant responses. The app pings it every 4 minutes to prevent unloading.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Security Note */}
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="mt-0.5">🔒</div>
              <p className="flex-1">
                {currentProviderInfo.requiresApiKey 
                  ? 'Your API keys are encrypted and stored locally on your device. They are never sent to our servers.'
                  : 'Ollama runs entirely on your device. Your data never leaves your computer.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex gap-3">
            {config && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete All Configs
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isLoading || (currentProviderInfo.requiresApiKey && !apiKeys[selectedProvider]?.trim() && !hasConfig) || (selectedProvider === 'ollama' && !selectedModels.ollama)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (isWarmingUp ? 'Warming up model...' : 'Saving...') : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 