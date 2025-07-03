import { useState, useEffect } from 'react'
import { ChevronDown, Cpu, Cloud, Brain, Bot, Check } from 'lucide-react'
import { ipc } from '../lib/ipc'
import { ProviderConfig } from '../types'
import toast from 'react-hot-toast'

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    icon: Bot,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    models: {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo-preview': 'GPT-4 Turbo',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
    }
  },
  anthropic: {
    name: 'Anthropic',
    icon: Brain,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    models: {
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku'
    }
  },
  ollama: {
    name: 'Ollama',
    icon: Cpu,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    models: {} // Dynamically populated
  }
} as const

type Provider = keyof typeof PROVIDER_INFO

interface ModelSelectorProps {
  variant?: 'default' | 'compact'
  className?: string
  onModelChange?: (provider: Provider, model: string) => void
}

export default function ModelSelector({ variant = 'default', className = '', onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<Record<string, string>>({})

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const providerConfig = await ipc.getProviderConfig()
      setConfig(providerConfig)
      
      // Load Ollama models if available or if Ollama is selected
      if (providerConfig && (providerConfig.selectedProvider === 'ollama' || providerConfig.providers.ollama)) {
        try {
          const models = await ipc.getOllamaModels()
          const modelMap: Record<string, string> = {}
          models.forEach(model => {
            // Extract base model name for display
            const displayName = model.split(':')[0]
            modelMap[model] = displayName.charAt(0).toUpperCase() + displayName.slice(1)
          })
          setOllamaModels(modelMap)
        } catch (error) {
          // Silently fail - user will see empty Ollama section
          console.log('Could not load Ollama models:', error)
        }
      }
    } catch (error) {
      console.error('Failed to load provider config:', error)
    }
  }

  const handleSelectModel = async (provider: Provider, model: string) => {
    if (!config) return
    
    setIsLoading(true)
    try {
      const newConfig = { ...config }
      newConfig.selectedProvider = provider
      
      // Update the model for the selected provider
      if (provider === 'openai' && newConfig.providers.openai) {
        newConfig.providers.openai.model = model
      } else if (provider === 'anthropic' && newConfig.providers.anthropic) {
        newConfig.providers.anthropic.model = model
      } else if (provider === 'ollama') {
        if (!newConfig.providers.ollama) {
          newConfig.providers.ollama = { model, baseUrl: 'http://localhost:11434' }
        } else {
          newConfig.providers.ollama.model = model
        }
      }
      
      await ipc.saveProviderConfig(newConfig)
      setConfig(newConfig)
      setIsOpen(false)
      
      if (onModelChange) {
        onModelChange(provider, model)
      }
      
      toast.success(`Switched to ${PROVIDER_INFO[provider].name} - ${getModelDisplayName(provider, model)}`)
      
      // Show keep-alive message for Ollama
      if (provider === 'ollama') {
        toast.success('Model will be kept warm for instant responses', {
          icon: '🔥',
          duration: 2000
        })
      }
    } catch (error) {
      toast.error('Failed to switch model')
      console.error('Failed to switch model:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getModelDisplayName = (provider: Provider, model: string): string => {
    if (provider === 'ollama') {
      return ollamaModels[model] || model
    }
    return PROVIDER_INFO[provider].models[model as keyof typeof PROVIDER_INFO[typeof provider]['models']] || model
  }

  const getCurrentModelInfo = () => {
    if (!config) return null
    
    const provider = config.selectedProvider
    let model = ''
    
    if (provider === 'openai' && config.providers.openai) {
      model = config.providers.openai.model || 'gpt-4'
    } else if (provider === 'anthropic' && config.providers.anthropic) {
      model = config.providers.anthropic.model || 'claude-3-5-sonnet-20241022'
    } else if (provider === 'ollama' && config.providers.ollama) {
      model = config.providers.ollama.model
    }
    
    return { provider, model }
  }

  const currentModel = getCurrentModelInfo()
  const Icon = currentModel ? PROVIDER_INFO[currentModel.provider].icon : Cloud

  if (!config) {
    return (
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
        className={`model-selector-button flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors ${className}`}
      >
        <Cloud className="w-4 h-4 text-gray-500" />
        <span className="text-gray-600 dark:text-gray-400">No AI Provider</span>
      </button>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="relative">
              <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`model-selector-button flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors ${className}`}
      >
          <Icon className={`w-3.5 h-3.5 ${currentModel ? PROVIDER_INFO[currentModel.provider].color : 'text-gray-500'}`} />
          <span className="font-medium">
            {currentModel ? getModelDisplayName(currentModel.provider, currentModel.model) : 'Select Model'}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        
        {isOpen && (
          <ModelDropdown
            config={config}
            ollamaModels={ollamaModels}
            currentModel={currentModel}
            onSelect={handleSelectModel}
            onClose={() => setIsOpen(false)}
            variant="compact"
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`model-selector-button flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors ${className}`}
      >
        <Icon className={`w-4 h-4 ${currentModel ? PROVIDER_INFO[currentModel.provider].color : 'text-gray-500'}`} />
        <span>
          {currentModel ? (
            <>
              <span className="font-medium">{PROVIDER_INFO[currentModel.provider].name}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                {getModelDisplayName(currentModel.provider, currentModel.model)}
              </span>
            </>
          ) : (
            'Select Model'
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      
      {isOpen && (
        <ModelDropdown
          config={config}
          ollamaModels={ollamaModels}
          currentModel={currentModel}
          onSelect={handleSelectModel}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

interface ModelDropdownProps {
  config: ProviderConfig
  ollamaModels: Record<string, string>
  currentModel: { provider: Provider; model: string } | null
  onSelect: (provider: Provider, model: string) => void
  onClose: () => void
  variant?: 'default' | 'compact'
}

function ModelDropdown({ config, ollamaModels, currentModel, onSelect, onClose, variant = 'default' }: ModelDropdownProps) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.model-dropdown') && !target.closest('.model-selector-button')) {
        onClose()
      }
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const isCompact = variant === 'compact'
  
  return (
    <div className={`model-dropdown absolute ${isCompact ? 'top-full mt-1' : 'top-full mt-2'} right-0 ${isCompact ? 'w-48' : 'w-64'} bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-96 overflow-y-auto`}>
      {/* OpenAI Models */}
      {config.providers.openai && (
        <div className={isCompact ? 'mb-1' : 'mb-2'}>
          <div className={`px-3 ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2`}>
            <Bot className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
            OpenAI
          </div>
          {Object.entries(PROVIDER_INFO.openai.models).map(([modelKey, modelName]) => (
            <button
              key={modelKey}
              onClick={() => onSelect('openai', modelKey)}
              className={`w-full text-left px-3 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group`}
            >
              <span>{modelName}</span>
              {currentModel?.provider === 'openai' && currentModel.model === modelKey && (
                <Check className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} text-green-600 dark:text-green-400`} />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Anthropic Models */}
      {config.providers.anthropic && (
        <div className={isCompact ? 'mb-1' : 'mb-2'}>
          <div className={`px-3 ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2`}>
            <Brain className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
            Anthropic
          </div>
          {Object.entries(PROVIDER_INFO.anthropic.models).map(([modelKey, modelName]) => (
            <button
              key={modelKey}
              onClick={() => onSelect('anthropic', modelKey)}
              className={`w-full text-left px-3 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group`}
            >
              <span>{modelName}</span>
              {currentModel?.provider === 'anthropic' && currentModel.model === modelKey && (
                <Check className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} text-green-600 dark:text-green-400`} />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Ollama Models */}
      {Object.keys(ollamaModels).length > 0 && (
        <div>
          <div className={`px-3 ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2`}>
            <Cpu className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
            Ollama (Local)
          </div>
          {Object.entries(ollamaModels).map(([modelKey, modelName]) => (
            <button
              key={modelKey}
              onClick={() => onSelect('ollama', modelKey)}
              className={`w-full text-left px-3 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group`}
            >
              <span>{modelName}</span>
              {currentModel?.provider === 'ollama' && currentModel.model === modelKey && (
                <Check className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} text-green-600 dark:text-green-400`} />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Settings Link */}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
        <button
          onClick={() => {
            onClose()
            window.dispatchEvent(new CustomEvent('open-settings'))
          }}
          className={`w-full text-left px-3 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          Configure AI Providers...
        </button>
      </div>
    </div>
  )
} 