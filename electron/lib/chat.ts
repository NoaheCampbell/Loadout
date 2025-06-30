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