import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage } from '@langchain/core/messages'
import { getProviderConfig, migrateApiKeyToProviderConfig, ProviderConfig } from './storage'
import axios from 'axios'

export interface ChatModelConfig {
  modelName: string
  temperature: number
  streaming: boolean
}

// Store active keep-alive interval
let keepAliveInterval: NodeJS.Timeout | null = null

// Get available Ollama models
export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    if (!response.ok) {
      throw new Error('Failed to fetch Ollama models')
    }
    
    const data = await response.json()
    return data.models?.map((model: any) => model.name) || []
  } catch (error) {
    console.error('Error fetching Ollama models:', error)
    return []
  }
}

// Warm up Ollama model by loading it into memory
export async function warmUpOllamaModel(modelName: string): Promise<void> {
  try {
    console.log(`[chat-providers] Warming up Ollama model: ${modelName}`)
    
    const chatModel = new ChatOllama({
      model: modelName,
      baseUrl: 'http://localhost:11434',
      temperature: 0.7
    })
    
    // Send a minimal message to load the model into memory
    const warmUpMessage = new HumanMessage('Hi')
    await chatModel.invoke([warmUpMessage])
    
    console.log(`[chat-providers] Successfully warmed up Ollama model: ${modelName}`)
  } catch (error) {
    console.error(`[chat-providers] Failed to warm up Ollama model ${modelName}:`, error)
    // Don't throw - warming up is optional optimization
  }
}

// Keep Ollama model warm with periodic pings
export function startOllamaKeepAlive(modelName: string, intervalMs: number = 4 * 60 * 1000): void {
  // Stop any existing keep-alive
  stopOllamaKeepAlive()
  
  console.log(`[chat-providers] Starting keep-alive for Ollama model: ${modelName} (interval: ${intervalMs}ms)`)
  
  // Initial warm-up
  warmUpOllamaModel(modelName).catch(error => {
    console.error('[chat-providers] Initial warm-up failed:', error)
  })
  
  // Set up periodic warm-up
  keepAliveInterval = setInterval(() => {
    console.log(`[chat-providers] Keep-alive ping for model: ${modelName}`)
    warmUpOllamaModel(modelName).catch(error => {
      console.error('[chat-providers] Keep-alive ping failed:', error)
    })
  }, intervalMs)
}

// Stop the keep-alive mechanism
export function stopOllamaKeepAlive(): void {
  if (keepAliveInterval) {
    console.log('[chat-providers] Stopping Ollama keep-alive')
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

// Warm up the currently selected model if it's Ollama
export async function warmUpSelectedModel(): Promise<void> {
  try {
    const config = await getProviderConfig()
    
    if (config?.selectedProvider === 'ollama' && config.providers.ollama?.model) {
      const modelName = config.providers.ollama.model
      
      // Check if Ollama is running first
      const models = await getOllamaModels()
      if (models.includes(modelName)) {
        // Start keep-alive instead of just warming up once
        startOllamaKeepAlive(modelName)
      }
    } else {
      // Stop keep-alive if not using Ollama
      stopOllamaKeepAlive()
    }
  } catch (error) {
    console.error('[chat-providers] Failed to check for model warm-up:', error)
  }
}

// Create chat model based on provider config
export async function getChatModel(config?: Partial<ChatModelConfig>): Promise<BaseChatModel> {
  // First, try to migrate old API key if needed
  await migrateApiKeyToProviderConfig()
  
  const providerConfig = await getProviderConfig()
  
  if (!providerConfig) {
    throw new Error('No AI provider configured. Please configure a provider in settings.')
  }
  
  const defaultConfig: ChatModelConfig = {
    modelName: '',
    temperature: 0.7,
    streaming: true,
    ...config
  }
  
  switch (providerConfig.selectedProvider) {
    case 'openai': {
      const openaiConfig = providerConfig.providers.openai
      if (!openaiConfig?.apiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.')
      }
      
      return new ChatOpenAI({
        modelName: defaultConfig.modelName || openaiConfig.model || 'gpt-4',
        temperature: defaultConfig.temperature,
        openAIApiKey: openaiConfig.apiKey,
        streaming: defaultConfig.streaming,
      })
    }
    
    case 'anthropic': {
      const anthropicConfig = providerConfig.providers.anthropic
      if (!anthropicConfig?.apiKey) {
        throw new Error('Anthropic API key not configured. Please set your API key in settings.')
      }
      
      return new ChatAnthropic({
        modelName: defaultConfig.modelName || anthropicConfig.model || 'claude-3-5-sonnet-20241022',
        temperature: defaultConfig.temperature,
        anthropicApiKey: anthropicConfig.apiKey,
        streaming: defaultConfig.streaming,
      })
    }
    
    case 'ollama': {
      const ollamaConfig = providerConfig.providers.ollama
      if (!ollamaConfig?.model) {
        throw new Error('No Ollama model selected. Please select a model in settings.')
      }
      
      // Check if Ollama is running
      try {
        await axios.get(ollamaConfig.baseUrl || 'http://localhost:11434/api/tags')
      } catch (error) {
        throw new Error('Ollama is not running. Please start Ollama to use local models.')
      }
      
      return new ChatOllama({
        model: ollamaConfig.model,
        temperature: defaultConfig.temperature,
        baseUrl: ollamaConfig.baseUrl || 'http://localhost:11434',
        streaming: defaultConfig.streaming,
      } as any)
    }
    
    default:
      throw new Error(`Unknown provider: ${providerConfig.selectedProvider}`)
  }
}

// Provider metadata
export const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    requiresApiKey: true,
    models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'High-quality models from OpenAI'
  },
  anthropic: {
    name: 'Anthropic',
    requiresApiKey: true,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Claude models with strong reasoning'
  },
  ollama: {
    name: 'Ollama (Local)',
    requiresApiKey: false,
    models: [], // Dynamically populated
    defaultModel: '',
    apiKeyUrl: '',
    description: 'Free local models, no internet required'
  }
} 