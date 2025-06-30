import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, Send, MessageCircle, ArrowRight } from 'lucide-react'
import { useStore } from '../../store'
import { ipc } from '../../lib/ipc'
import { IPC_CHANNELS } from '../../../electron/lib/ipc-channels'
import toast from 'react-hot-toast'
import { ChatMessage } from '../../types'
import { nanoid } from 'nanoid'
import ReactMarkdown from 'react-markdown'

interface IdeaTabProps {
  isNewProject?: boolean
}

export default function IdeaTab({ isNewProject = false }: IdeaTabProps) {
  const { 
    isGenerating, 
    setGenerating, 
    addProgress, 
    clearProgress, 
    selectProject, 
    setCurrentTab,
    setProjects,
    setProjectData,
    currentProjectData,
    generationProgress 
  } = useStore()
  
  const [idea, setIdea] = useState(currentProjectData?.idea || '')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(currentProjectData?.chatHistory || [])
  const [isInChat, setIsInChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Update idea and chat history when project changes
  useEffect(() => {
    setIdea(currentProjectData?.idea || '')
    setChatMessages(currentProjectData?.chatHistory || [])
    setIsInChat(false)
  }, [currentProjectData])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleStartChat = async () => {
    if (!idea.trim()) {
      toast.error('Please enter a project idea')
      return
    }

    setIsInChat(true)
    
    // Add user's initial idea as first message
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: idea,
      timestamp: new Date().toISOString()
    }
    setChatMessages([userMessage])
    setIsWaitingForResponse(true)

    try {
      // Create a new message that we'll update as chunks arrive
      const assistantMessageId = nanoid()
      let accumulatedContent = ''
      
      // Set up chunk listener
      const unsubscribeChunk = ipc.on(IPC_CHANNELS.CHAT_STREAM_CHUNK, (data: { content: string }) => {
        accumulatedContent += data.content
        setChatMessages(prev => {
          const existing = prev.find(msg => msg.id === assistantMessageId)
          if (existing) {
            return prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          } else {
            return [...prev, {
              id: assistantMessageId,
              role: 'assistant' as const,
              content: accumulatedContent,
              timestamp: new Date().toISOString()
            }]
          }
        })
      })
      
      // Set up end listener
      const unsubscribeEnd = ipc.on(IPC_CHANNELS.CHAT_STREAM_END, () => {
        setIsWaitingForResponse(false)
        unsubscribeChunk()
        unsubscribeEnd()
      })

      // Start the chat session
      await ipc.invoke(IPC_CHANNELS.START_PROJECT_CHAT, { initialIdea: idea })

      return () => {
        unsubscribeChunk()
        unsubscribeEnd()
      }
    } catch (error) {
      console.error('Error starting chat:', error)
      toast.error('Failed to start chat')
      setIsWaitingForResponse(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isWaitingForResponse) return

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    const messageContent = chatInput
    setChatInput('')
    setIsWaitingForResponse(true)

    try {
      // Create a new message that we'll update as chunks arrive
      const assistantMessageId = nanoid()
      let accumulatedContent = ''
      
      // Set up chunk listener
      const unsubscribeChunk = ipc.on(IPC_CHANNELS.CHAT_STREAM_CHUNK, (data: { content: string }) => {
        accumulatedContent += data.content
        setChatMessages(prev => {
          const existing = prev.find(msg => msg.id === assistantMessageId)
          if (existing) {
            return prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          } else {
            return [...prev, {
              id: assistantMessageId,
              role: 'assistant' as const,
              content: accumulatedContent,
              timestamp: new Date().toISOString()
            }]
          }
        })
      })
      
      // Set up end listener
      const unsubscribeEnd = ipc.on(IPC_CHANNELS.CHAT_STREAM_END, () => {
        setIsWaitingForResponse(false)
        unsubscribeChunk()
        unsubscribeEnd()
      })

      // Send message to backend
      await ipc.invoke(IPC_CHANNELS.CHAT_MESSAGE, { 
        content: messageContent,
        chatHistory: chatMessages 
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setIsWaitingForResponse(false)
    }
  }

  const handleGenerate = async () => {
    // Extract the refined idea from chat history
    const refinedIdea = chatMessages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n')

    setGenerating(true)
    clearProgress()

    try {
      // Set up progress listener
      const unsubscribe = ipc.onGenerationProgress((progress) => {
        console.log('Frontend: Received progress update:', progress)
        addProgress(progress)
      })

      // Generate the project with refined idea and chat history
      console.log('Frontend: Calling generate project...')
      const result = await ipc.generateProject(refinedIdea, chatMessages)
      console.log('Frontend: Generation result:', result)

      if (result.success && result.data?.projectId) {
        console.log('Frontend: Project generated successfully')
        toast.success('Project generated successfully!')
        
        // Update projects list if provided
        if (result.data.projects) {
          console.log('Frontend: Updating projects list:', result.data.projects.length, 'projects')
          setProjects(result.data.projects)
        }
        
        // Small delay to ensure files are written
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Load the new project data
        console.log('Frontend: Loading project data for:', result.data.projectId)
        const projectData = await ipc.loadProject(result.data.projectId)
        console.log('Frontend: Project data loaded:', projectData ? 'success' : 'failed')
        
        if (projectData) {
          setProjectData(projectData)
          selectProject(result.data.projectId)
          setCurrentTab('prd')
          
          // Clear the idea input for new projects
          if (isNewProject) {
            setIdea('')
            setChatMessages([])
            setIsInChat(false)
          }
        } else {
          toast.error('Failed to load generated project data')
        }
      } else {
        console.log('Frontend: Generation failed:', result.error)
        toast.error(result.error || 'Failed to generate project')
      }

      // Clean up listener
      unsubscribe()
    } catch (error) {
      console.error('Generation error:', error)
      toast.error('An error occurred while generating the project')
    } finally {
      setGenerating(false)
    }
  }

  // If not in chat mode, show the initial idea input
  if (!isInChat) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {isNewProject ? "What's your project idea?" : "Project Idea"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Describe your project in a few sentences. Our AI will help you refine it before generating the full blueprint.
            </p>
          </div>

          <div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="I want to build a web app that..."
              className="w-full h-64 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isGenerating}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleStartChat}
              disabled={!idea.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-5 h-5" />
              Refine Idea with AI
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Chat interface
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Refining Your Project Idea</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chat with AI to clarify and expand your project concept
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || chatMessages.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Project
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      // Custom component styling
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mb-1">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      code: ({ children, className, ...props }: any) => {
                        const inline = !className || !className.includes('language-')
                        return inline ? (
                          <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-gray-200 dark:bg-gray-700 p-2 rounded text-sm overflow-x-auto" {...props}>
                            {children}
                          </code>
                        )
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
                          {children}
                        </blockquote>
                      ),
                      a: ({ children, href }) => (
                        <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {/* Show typing indicator if this is the last message and we're waiting for response */}
                  {isWaitingForResponse && chatMessages[chatMessages.length - 1]?.id === message.id && (
                    <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-1" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Removed separate loading indicator since we now show streaming content */}
        
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your response..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isWaitingForResponse}
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isWaitingForResponse}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Display */}
      {isGenerating && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <h3 className="font-semibold mb-2">Generation Progress</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
            {generationProgress.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Starting generation...</p>
            ) : (
              generationProgress.map((progress, index) => (
                <div key={`${progress.node}-${index}`} className="flex items-center gap-2 text-sm py-1">
                  {progress.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {progress.status === 'success' && <span className="text-green-600">✓</span>}
                  {progress.status === 'error' && <span className="text-red-600">✗</span>}
                  <span className={progress.status === 'success' ? 'text-gray-600 dark:text-gray-400' : ''}>
                    {progress.node}
                  </span>
                  {progress.message && <span className="text-gray-500 dark:text-gray-400">- {progress.message}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
} 