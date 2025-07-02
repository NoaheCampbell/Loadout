import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { getProviderConfig, migrateApiKeyToProviderConfig, ProviderConfig } from './storage'
import axios from 'axios'

export interface ChatModelConfig {
  modelName: string
  temperature: number
  streaming: boolean
}

// Get available Ollama models
export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await axios.get('http://localhost:11434/api/tags')
    return response.data.models?.map((model: any) => model.name) || []
  } catch (error) {
    console.log('Ollama not running or no models found:', error)
    return []
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