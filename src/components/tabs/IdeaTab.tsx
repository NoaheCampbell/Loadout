import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, Send, MessageCircle, ArrowRight, ArrowDown, StopCircle } from 'lucide-react'
import { useStore } from '../../store'
import { ipc } from '../../lib/ipc'
import { IPC_CHANNELS } from '../../../electron/lib/ipc-channels'
import toast from 'react-hot-toast'
import { ChatMessage } from '../../types'
import { nanoid } from 'nanoid'
import ModelSelector from '../ModelSelector'
import ChatMessageComponent from '../ChatMessage'

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
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)

  // Update idea and chat history when project changes
  useEffect(() => {
    setIdea(currentProjectData?.idea || '')
    setChatMessages(currentProjectData?.chatHistory || [])
    setIsInChat(Boolean(currentProjectData?.chatHistory && currentProjectData.chatHistory.length > 0))
  }, [currentProjectData])

  // Smart auto-scroll that respects user scrolling
  useEffect(() => {
    if (!isUserScrolling && chatContainerRef.current) {
      // Only scroll if user hasn't manually scrolled up
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isUserScrolling])

  // Check if user is at the bottom of the chat
  const checkIfAtBottom = () => {
    if (!chatContainerRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    // Consider "at bottom" if within 50px of the bottom
    return scrollHeight - scrollTop - clientHeight < 50
  }

  // Handle scroll events to detect if user is scrolling
  const handleScroll = () => {
    if (!chatContainerRef.current) return
    const atBottom = checkIfAtBottom()
    setIsUserScrolling(!atBottom)
  }

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
    
    // Reset scrolling state when starting a new chat
    setIsUserScrolling(false)

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
    
    // Scroll to bottom when user sends a message
    setIsUserScrolling(false)

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
        
        // Play completion sound
        ipc.playCompletionSound()
        
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
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {isNewProject ? "What React app do you want to build?" : "React App Idea"}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Describe your React application in a few sentences. Our AI will help you refine it before generating the complete React component structure.
                </p>
              </div>
              <ModelSelector />
            </div>

            <div>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="I want to build a React app that..."
                className="w-full h-64 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isGenerating}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleStartChat}
                disabled={!idea.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5" />
                Refine Idea with AI
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chat interface
  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Refining Your Project Idea</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chat with AI to clarify and expand your project concept
            </p>
          </div>
          <ModelSelector />
        </div>
      </div>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-scroll p-6"
        onScroll={handleScroll}
      >
        <div className="space-y-4">
          {chatMessages.map((message, index) => (
            <ChatMessageComponent 
              key={message.id} 
              message={message} 
              isStreaming={isWaitingForResponse && index === chatMessages.length - 1 && message.role === 'assistant'}
            />
          ))}
          
          {/* Removed separate loading indicator since we now show streaming content */}
          
          <div ref={chatEndRef} />
        </div>
        
        {/* New messages indicator */}
        {isUserScrolling && isWaitingForResponse && (
          <button
            onClick={() => {
              setIsUserScrolling(false)
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="fixed bottom-24 right-8 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all duration-200 z-10"
          >
            <ArrowDown className="w-4 h-4" />
            New messages
          </button>
        )}
      </div>

      {/* Chat input and Generate button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isWaitingForResponse && handleSendMessage()}
            placeholder="Type your response..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isWaitingForResponse}
          />
          {isWaitingForResponse ? (
            <button
              onClick={async () => {
                try {
                  await ipc.invoke(IPC_CHANNELS.STOP_GENERATION)
                  setIsWaitingForResponse(false)
                  toast('AI response stopped', { icon: '🛑' })
                } catch (error) {
                  console.error('Failed to stop generation:', error)
                  toast.error('Failed to stop generation')
                }
              }}
              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || chatMessages.length < 2}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 