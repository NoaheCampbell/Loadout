import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage as ChatMessageType } from '../types'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

interface ParsedContent {
  type: 'text' | 'thinking'
  content: string
}

function parseMessageContent(content: string): ParsedContent[] {
  const parts: ParsedContent[] = []
  
  // Regular expression to match thinking tags (including incomplete ones)
  const thinkingRegex = /<think>([\s\S]*?)(<\/think>|$)/g
  let lastIndex = 0
  let match
  
  while ((match = thinkingRegex.exec(content)) !== null) {
    const hasClosingTag = match[0].includes('</think>')
    
    // Add text before the thinking tag
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    
    // Add thinking content
    const thinkingContent = match[1].trim()
    if (thinkingContent || !hasClosingTag) { // Include even if empty when streaming
      parts.push({ type: 'thinking', content: thinkingContent })
    }
    
    // Update lastIndex based on whether we have a closing tag
    if (hasClosingTag) {
      lastIndex = match.index + match[0].length
    } else {
      // If no closing tag (streaming), we've consumed everything
      lastIndex = content.length
    }
  }
  
  // Add any remaining text after the last thinking tag
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex).trim()
    if (remainingContent) {
      parts.push({ type: 'text', content: remainingContent })
    }
  }
  
  // If no thinking tags were found, return the entire content as text
  if (parts.length === 0 && content.trim()) {
    parts.push({ type: 'text', content: content })
  }
  
  return parts
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set())
  const parsedContent = parseMessageContent(message.content)
  
  const toggleThinking = (index: number) => {
    const newExpanded = new Set(expandedThinking)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedThinking(newExpanded)
  }
  
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user' 
              ? 'bg-blue-500' 
              : 'bg-gray-200 dark:bg-gray-700'
          }`}>
            {message.role === 'user' ? (
              <User className="w-5 h-5 text-white" />
            ) : (
              <Brain className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            )}
          </div>
          
          {/* Message Content */}
          <div className="flex-1 space-y-2">
            {parsedContent.map((part, index) => {
              if (part.type === 'thinking') {
                const isExpanded = expandedThinking.has(index)
                return (
                  <div key={index} className="bg-gray-100 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleThinking(index)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Brain className="w-4 h-4" />
                      <span className="font-medium">Thinking process</span>
                      {!isExpanded && (
                        <span className="text-xs ml-auto opacity-60">Click to expand</span>
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1">
                        <div className="prose prose-sm dark:prose-invert max-w-none opacity-80">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              code: ({ className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return match ? (
                                  <pre className="bg-gray-800 dark:bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto my-2">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                ) : (
                                  <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
                                    {children}
                                  </code>
                                )
                              },
                            }}
                          >
                            {part.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              
              // Regular text content
              return (
                <div
                  key={index}
                  className={`px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                          code: ({ className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '')
                            return match ? (
                              <pre className="bg-gray-800 dark:bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto my-2">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            ) : (
                              <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
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
                        {part.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{part.content}</div>
                  )}
                </div>
              )
            })}
            
            {/* Show streaming indicator if this is the last message and we're streaming */}
            {isStreaming && parsedContent.length === 0 && (
              <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 