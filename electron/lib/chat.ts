import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { ChatMessage } from '../../src/types'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { getApiKey } from './storage'
import { getChatModel } from './chat-providers'

// Store active abort controllers
const activeGenerations = new Map<string, AbortController>()

// Function to stop a generation
export function stopGeneration(generationId: string) {
  const controller = activeGenerations.get(generationId)
  if (controller) {
    console.log('[chat.ts] Stopping generation:', generationId)
    controller.abort()
    activeGenerations.delete(generationId)
    return true
  }
  return false
}

// Function to stop all generations
export function stopAllGenerations() {
  console.log('[chat.ts] Stopping all generations, count:', activeGenerations.size)
  activeGenerations.forEach((controller, id) => {
    controller.abort()
  })
  activeGenerations.clear()
}

// Function to get chat model with current API key
async function getChatModelCompat() {
  // Use the new provider system
  return await getChatModel({ streaming: true })
}

const SYSTEM_PROMPT = `You are a helpful AI assistant specialized in refining and clarifying project ideas for developers. Your goal is to help users think through their project concepts by asking insightful questions and providing constructive suggestions.

When a user presents a project idea, you should:
1. Acknowledge what sounds interesting or promising about their idea
2. Ask clarifying questions about unclear aspects
3. Probe for missing details that would be important for implementation
4. Suggest potential features or improvements if appropriate
5. Help them think about technical requirements and constraints

Be encouraging and constructive. Ask questions that help the user think more deeply about their project, but don't overwhelm them with too many questions at once. Focus on 2-3 key questions or points per response.

Remember, your goal is to help them develop a clear, well-thought-out project concept that can be turned into a comprehensive PRD and implementation plan.`

const UI_CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in UI design and React component development. You have direct access to modify the UI code.

You have access to the actual UI code files, so you can see exactly what has been generated and can make changes when requested.

When a user asks about their UI, you should:
1. Answer questions about the current UI design, components, and structure
2. Reference the actual code when discussing components
3. Help them understand how components work and interact
4. Suggest improvements or alternatives when asked

When a user asks you to make changes (e.g., "change the color to blue", "add a footer", "make it more modern"):
- I will automatically apply the changes you describe
- Be specific about what will be modified
- Explain what changes you're making
- The UI will be regenerated automatically based on your response

For questions (not edits):
- Provide helpful explanations about the UI
- Suggest best practices and modern design patterns
- Reference the actual components and their code
- Help debug issues

Important: You have direct access to modify the code. When users ask for changes, describe what you'll change and the UI will be automatically updated.`

export async function startProjectChat(initialIdea: string, event: Electron.IpcMainInvokeEvent): Promise<void> {
  const generationId = `chat-${Date.now()}`
  const abortController = new AbortController()
  activeGenerations.set(generationId, abortController)
  
  try {
    const chatModel = await getChatModelCompat()
    
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(initialIdea)
    ]

    let fullContent = ''
    const stream = await chatModel.stream(messages, { signal: abortController.signal })
    
    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        console.log('[chat.ts] Generation aborted')
        break
      }
      const content = chunk.content as string
      fullContent += content
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, { content })
    }
    
    if (!abortController.signal.aborted) {
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent })
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('[chat.ts] Generation was aborted')
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent: '', aborted: true })
    } else {
      console.error('Error in startProjectChat:', error)
      throw error
    }
  } finally {
    activeGenerations.delete(generationId)
  }
}

export async function sendChatMessage(content: string, chatHistory: ChatMessage[], event: Electron.IpcMainInvokeEvent): Promise<void> {
  const generationId = `chat-${Date.now()}`
  const abortController = new AbortController()
  activeGenerations.set(generationId, abortController)
  
  try {
    const chatModel = await getChatModelCompat()
    
    const messages = [new SystemMessage(SYSTEM_PROMPT)]
    
    // Convert chat history to LangChain messages
    for (const msg of chatHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new AIMessage(msg.content))
      }
    }
    
    // Add the new message
    messages.push(new HumanMessage(content))

    let fullContent = ''
    const stream = await chatModel.stream(messages, { signal: abortController.signal })
    
    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        console.log('[chat.ts] Generation aborted')
        break
      }
      const content = chunk.content as string
      fullContent += content
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, { content })
    }
    
    if (!abortController.signal.aborted) {
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent })
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('[chat.ts] Generation was aborted')
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent: '', aborted: true })
    } else {
      console.error('Error in sendChatMessage:', error)
      throw error
    }
  } finally {
    activeGenerations.delete(generationId)
  }
}

export async function sendUIChatMessage(
  content: string, 
  chatHistory: ChatMessage[], 
  projectContext: { 
    projectIdea: string; 
    components?: string[]; 
    uiStrategy?: string;
    uiFiles?: any[];
  },
  event: Electron.IpcMainInvokeEvent
): Promise<{ 
  isEditRequest: boolean; 
  editInstructions?: string;
  fullResponse: string;
}> {
  try {
    const chatModel = await getChatModelCompat()
    
    // Build context about the current UI
    let uiContext = `
Current project: ${projectContext.projectIdea}
UI Strategy: ${projectContext.uiStrategy || 'React components'}
Components: ${projectContext.components?.join(', ') || 'No components generated yet'}
    `.trim()
    
    // Add UI file content if available
    if (projectContext.uiFiles && projectContext.uiFiles.length > 0) {
      uiContext += '\n\n=== GENERATED UI FILES ===\n'
      
      // Include a summary of files
      uiContext += `Total files: ${projectContext.uiFiles.length}\n`
      uiContext += 'Files generated:\n'
      projectContext.uiFiles.forEach((file: any) => {
        uiContext += `- ${file.filename} (${file.type})\n`
      })
      
      // Include actual code for key files (limit to prevent token overflow)
      const mainFiles = projectContext.uiFiles.filter((f: any) => 
        f.type === 'main' || 
        f.filename === 'App.js' || 
        f.filename.includes('Navigation') ||
        f.filename.includes('Header')
      ).slice(0, 3) // Limit to first 3 main files
      
      if (mainFiles.length > 0) {
        uiContext += '\n=== KEY FILE CONTENTS ===\n'
        mainFiles.forEach((file: any) => {
          uiContext += `\n--- ${file.filename} ---\n`
          // Truncate very long files to prevent token overflow
          const maxLength = 2000
          const content = file.content.length > maxLength 
            ? file.content.substring(0, maxLength) + '\n... (truncated)'
            : file.content
          uiContext += content + '\n'
        })
      }
      
      // If user mentions a specific component, try to include its code
      const lowerContent = content.toLowerCase()
      const additionalFiles = projectContext.uiFiles.filter((f: any) => {
        const fileName = f.filename.toLowerCase().replace('.js', '')
        return lowerContent.includes(fileName) && !mainFiles.some((mf: any) => mf.filename === f.filename)
      }).slice(0, 2)
      
      if (additionalFiles.length > 0) {
        uiContext += '\n=== MENTIONED COMPONENT FILES ===\n'
        additionalFiles.forEach((file: any) => {
          uiContext += `\n--- ${file.filename} ---\n`
          const maxLength = 2000
          const content = file.content.length > maxLength 
            ? file.content.substring(0, maxLength) + '\n... (truncated)'
            : file.content
          uiContext += content + '\n'
        })
      }
    }
    
    const messages = [
      new SystemMessage(UI_CHAT_SYSTEM_PROMPT),
      new SystemMessage(`Context about the current UI:\n${uiContext}`)
    ]
    
    // Convert chat history to LangChain messages
    for (const msg of chatHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new AIMessage(msg.content))
      }
    }
    
    // Add the new message
    messages.push(new HumanMessage(content))

    let fullContent = ''
    const stream = await chatModel.stream(messages)
    
    for await (const chunk of stream) {
      const content = chunk.content as string
      fullContent += content
      event.sender.send(IPC_CHANNELS.UI_CHAT_STREAM_CHUNK, { content })
    }
    
    event.sender.send(IPC_CHANNELS.UI_CHAT_STREAM_END, { fullContent })
    
    // Analyze if this is an edit request
    const isEditRequest = analyzeIfEditRequest(content, fullContent)
    let editInstructions = undefined
    
    if (isEditRequest) {
      // Extract specific edit instructions from the conversation
      editInstructions = extractEditInstructions(content, fullContent)
    }
    
    return {
      isEditRequest,
      editInstructions,
      fullResponse: fullContent
    }
  } catch (error) {
    console.error('Error in sendUIChatMessage:', error)
    throw error
  }
}

// Helper function to determine if the user wants to edit the UI
function analyzeIfEditRequest(userMessage: string, aiResponse: string): boolean {
  const editKeywords = [
    'change', 'modify', 'update', 'edit', 'make it', 'add', 'remove', 'delete',
    'replace', 'move', 'redesign', 'restyle', 'different', 'instead of',
    'can you make', 'please make', 'i want', "i'd like", 'transform', 'convert',
    'fix', 'adjust', 'set', 'switch', 'turn', 'enable', 'disable', 'improve',
    'enhance', 'bigger', 'smaller', 'larger', 'wider', 'narrower', 'taller',
    'shorter', 'more', 'less', 'better', 'modern', 'simple', 'complex'
  ]
  
  const lowerMessage = userMessage.toLowerCase()
  const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword))
  
  // Also check if the user is giving direct instructions
  const directInstructions = [
    'the button should', 'the header should', 'it should', 'make the',
    'i need', 'we need', 'let\'s', 'please', 'could you', 'can you',
    'would you', 'color', 'background', 'font', 'size', 'margin', 'padding',
    'border', 'layout', 'component', 'section', 'element'
  ]
  
  const hasDirectInstruction = directInstructions.some(instruction => lowerMessage.includes(instruction))
  
  // Check if AI response indicates understanding of changes
  const aiLower = aiResponse.toLowerCase()
  const aiUnderstandsChange = aiLower.includes('will') || aiLower.includes('i\'ll') || 
                              aiLower.includes('changing') || aiLower.includes('updating') ||
                              aiLower.includes('modifying') || aiLower.includes('adding') ||
                              aiLower.includes('removing') || aiLower.includes('let me')
  
  return (hasEditKeyword || hasDirectInstruction) && (aiUnderstandsChange || hasEditKeyword)
}

// Extract specific instructions for UI regeneration
function extractEditInstructions(userMessage: string, aiResponse: string): string {
  // Combine user request with AI's understanding
  const instructions = `
USER REQUEST: ${userMessage}

AI INTERPRETATION AND CHANGES TO MAKE:
${aiResponse}

IMPLEMENTATION NOTES:
- Apply all changes discussed above
- Maintain existing functionality while implementing the requested changes
- Keep the same component structure unless explicitly asked to change it
- Use the currently selected AI model's capabilities
  `.trim()
  
  return instructions
} 