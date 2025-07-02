import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { ChatMessage } from '../../src/types'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'

const chatModel = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true,
})

const SYSTEM_PROMPT = `You are a helpful AI assistant specialized in refining and clarifying project ideas for developers. Your goal is to help users think through their project concepts by asking insightful questions and providing constructive suggestions.

When a user presents a project idea, you should:
1. Acknowledge what sounds interesting or promising about their idea
2. Ask clarifying questions about unclear aspects
3. Probe for missing details that would be important for implementation
4. Suggest potential features or improvements if appropriate
5. Help them think about technical requirements and constraints

Be encouraging and constructive. Ask questions that help the user think more deeply about their project, but don't overwhelm them with too many questions at once. Focus on 2-3 key questions or points per response.

Remember, your goal is to help them develop a clear, well-thought-out project concept that can be turned into a comprehensive PRD and implementation plan.`

const UI_CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in UI design and React component development. You help users understand and modify their generated UI components.

When a user asks about their UI, you should:
1. Answer questions about the current UI design, components, and structure
2. Help them understand how components work and interact
3. Suggest improvements or alternatives when asked
4. Identify when they want to make specific changes to the UI

When responding to edit requests:
- Clearly acknowledge what changes they want
- Be specific about what will be modified
- If the request is unclear, ask for clarification
- Always end edit requests with: "Would you like me to regenerate the UI with these changes?"

For questions (not edits):
- Provide helpful explanations about the UI
- Suggest best practices and modern design patterns
- Reference the actual components in their project
- Do NOT end with regeneration prompts unless they explicitly ask for changes

Remember: You're helping them understand and improve their UI. Be encouraging and constructive.`

export async function startProjectChat(initialIdea: string, event: Electron.IpcMainInvokeEvent): Promise<void> {
  try {
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(initialIdea)
    ]

    let fullContent = ''
    const stream = await chatModel.stream(messages)
    
    for await (const chunk of stream) {
      const content = chunk.content as string
      fullContent += content
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, { content })
    }
    
    event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent })
  } catch (error) {
    console.error('Error in startProjectChat:', error)
    throw error
  }
}

export async function sendChatMessage(content: string, chatHistory: ChatMessage[], event: Electron.IpcMainInvokeEvent): Promise<void> {
  try {
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
    const stream = await chatModel.stream(messages)
    
    for await (const chunk of stream) {
      const content = chunk.content as string
      fullContent += content
      event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, { content })
    }
    
    event.sender.send(IPC_CHANNELS.CHAT_STREAM_END, { fullContent })
  } catch (error) {
    console.error('Error in sendChatMessage:', error)
    throw error
  }
}

export async function sendUIChatMessage(
  content: string, 
  chatHistory: ChatMessage[], 
  projectContext: { 
    projectIdea: string; 
    components?: string[]; 
    uiStrategy?: string 
  },
  event: Electron.IpcMainInvokeEvent
): Promise<{ 
  isEditRequest: boolean; 
  editInstructions?: string;
  fullResponse: string;
}> {
  try {
    // Build context about the current UI
    const uiContext = `
Current project: ${projectContext.projectIdea}
UI Strategy: ${projectContext.uiStrategy || 'React components'}
Components: ${projectContext.components?.join(', ') || 'No components generated yet'}
    `.trim()
    
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
    'can you make', 'please make', 'i want', "i'd like", 'transform', 'convert'
  ]
  
  const lowerMessage = userMessage.toLowerCase()
  const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword))
  
  // Check if AI response indicates it understood an edit request
  const aiConfirmsEdit = aiResponse.toLowerCase().includes('regenerate the ui with these changes')
  
  return hasEditKeyword || aiConfirmsEdit
}

// Extract specific instructions for UI regeneration
function extractEditInstructions(userMessage: string, aiResponse: string): string {
  // Combine user request with AI's understanding
  const instructions = `
USER REQUEST: ${userMessage}

AI INTERPRETATION: ${aiResponse}

SPECIFIC CHANGES TO IMPLEMENT:
- Focus on the user's specific requests mentioned above
- Maintain existing functionality while implementing the requested changes
- Keep the same component structure unless explicitly asked to change it
  `.trim()
  
  return instructions
} 