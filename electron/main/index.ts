import { config } from 'dotenv'
config({ path: '.env.local' })

import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

// In production, disable web security to allow file:// to load http://localhost
const isProduction = !process.env.VITE_DEV_SERVER_URL
if (isProduction) {
  app.commandLine.appendSwitch('disable-web-security')
  app.commandLine.appendSwitch('allow-file-access-from-files')
  app.commandLine.appendSwitch('disable-site-isolation-trials')
  app.commandLine.appendSwitch('allow-running-insecure-content')
  app.commandLine.appendSwitch('ignore-certificate-errors')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let chatWin: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Loadout',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    frame: false,
    titleBarStyle: 'hiddenInset',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    acceptFirstMouse: true,
    webPreferences: {
      preload,
      webSecurity: false, // Allow loading local content in iframes
      webviewTag: true, // Enable webview tags for better iframe handling
      allowRunningInsecureContent: true, // Allow http content from file://
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })
  


  // Configure CSP to allow loading scripts from CDNs for UI preview
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Remove all CSP headers to allow iframe embedding
    const responseHeaders = { ...details.responseHeaders }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    delete responseHeaders['x-frame-options']
    delete responseHeaders['X-Frame-Options']
    
    callback({ responseHeaders })
  })
  
  // For production builds, also intercept requests to bypass CORS
  if (!VITE_DEV_SERVER_URL) {
    // Allow all protocols including file:// to load http://localhost
    win.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['http://localhost:*/*', 'file://*'] },
      (details, callback) => {
        const requestHeaders = { ...details.requestHeaders }
        // Remove security headers that might block the request
        delete requestHeaders['origin']
        delete requestHeaders['referer']
        callback({ requestHeaders })
      }
    )
  }

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(async () => {
  createWindow()
  
  // Warm up Ollama model in the background if selected
  try {
    const { warmUpSelectedModel } = await import('../lib/chat-providers')
    warmUpSelectedModel() // Don't await - let it run in background
  } catch (error) {
    console.error('Failed to initiate model warm-up:', error)
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  // Stop Ollama keep-alive when app is quitting
  try {
    const { stopOllamaKeepAlive } = await import('../lib/chat-providers')
    stopOllamaKeepAlive()
  } catch (error) {
    console.error('Failed to stop Ollama keep-alive:', error)
  }
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// Window control handlers
ipcMain.on('window-close', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) window.close()
})

ipcMain.on('window-minimize', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) window.minimize()
})

ipcMain.on('window-maximize', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  }
})

// Chat window handlers
function createChatWindow() {
  if (chatWin) {
    chatWin.focus()
    return
  }

  chatWin = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    titleBarStyle: 'hiddenInset',
    resizable: true,
    minimizable: false,
    maximizable: false,
    parent: win || undefined,
    modal: false,
    show: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  // Ensure window buttons are visible on macOS
  if (process.platform === 'darwin') {
    chatWin.setWindowButtonVisibility(true)
  }
  
  // Show window after setup
  chatWin.once('ready-to-show', () => {
    if (chatWin && !chatWin.isDestroyed()) {
      chatWin.show()
    }
  })

  // Load chat window HTML
  if (VITE_DEV_SERVER_URL) {
    chatWin.loadURL(`${VITE_DEV_SERVER_URL}#/chat`)
  } else {
    chatWin.loadFile(indexHtml, { hash: 'chat' })
  }

  chatWin.on('closed', () => {
    chatWin = null
    // Notify main window that chat is closed
    if (win) {
      win.webContents.send('chat-window-closed')
    }
  })
  

}

ipcMain.on(IPC_CHANNELS.OPEN_CHAT_WINDOW, (event, data) => {
  createChatWindow()
  
  // Wait for chat window to be ready, then send initial data
  if (chatWin) {
    chatWin.webContents.once('did-finish-load', () => {
      if (chatWin) {
        chatWin.webContents.send(IPC_CHANNELS.CHAT_WINDOW_SYNC, data)
      }
    })
  }
})

ipcMain.on(IPC_CHANNELS.CLOSE_CHAT_WINDOW, () => {
  if (chatWin) {
    chatWin.close()
  }
})

// Forward messages between main window and chat window
ipcMain.on(IPC_CHANNELS.CHAT_WINDOW_MESSAGE, (event, data) => {
  // If message is from chat window, forward to main window
  if (event.sender === chatWin?.webContents) {
    win?.webContents.send(IPC_CHANNELS.CHAT_WINDOW_MESSAGE, data)
  } 
  // If message is from main window, forward to chat window
  else if (event.sender === win?.webContents) {
    chatWin?.webContents.send(IPC_CHANNELS.CHAT_WINDOW_MESSAGE, data)
  }
})

// ==========================================
// Loadout IPC Handlers
// ==========================================

import { IPC_CHANNELS } from '../lib/ipc-channels'
import { storage } from '../lib/storage'
import { runWorkflow, visualizeWorkflow, getWorkflowDebugInfo, regenerateUI } from '../lib/workflow'
import { startProjectChat, sendChatMessage, sendUIChatMessage } from '../lib/chat'
import { startPreviewServer, stopPreviewServer } from '../lib/preview-server'

// Storage handlers
ipcMain.handle(IPC_CHANNELS.ENSURE_STORAGE, async () => {
  await storage.ensureStorage()
})

ipcMain.handle(IPC_CHANNELS.LIST_PROJECTS, async () => {
  return await storage.listProjects()
})

ipcMain.handle(IPC_CHANNELS.LOAD_PROJECT, async (_, projectId: string) => {
  return await storage.loadProject(projectId)
})

ipcMain.handle(IPC_CHANNELS.DELETE_PROJECT, async (_, projectId: string) => {
  try {
    await storage.deleteProject(projectId)
    const projects = await storage.listProjects()
    return { success: true, projects }
  } catch (error) {
    console.error('Failed to delete project:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete project' }
  }
})

// Generate project using workflow
ipcMain.handle(IPC_CHANNELS.GENERATE_PROJECT, async (event, data: { idea: string, chatHistory?: any[] }) => {
  const { idea, chatHistory } = data
  console.log('IPC: Generate project requested with idea:', idea.substring(0, 50) + '...')
  if (chatHistory) {
    console.log('IPC: Chat history provided with', chatHistory.length, 'messages')
  }
  
  try {
    const result = await runWorkflow(idea, (node, status, message, isParent, parentNode) => {
      console.log('IPC: Progress update -', node, status, message || '', isParent ? '(parent)' : '', parentNode || '')
      // Send progress updates to renderer with hierarchical info
      event.sender.send(IPC_CHANNELS.GENERATION_PROGRESS, {
        node,
        status,
        message,
        isParent,
        parentNode
      })
    }, chatHistory)
    
    if (result.success && result.projectId) {
      // Reload projects list
      const projects = await storage.listProjects()
      console.log('IPC: Project generation successful, returning:', { projectId: result.projectId, projectCount: projects.length })
      return { success: true, data: { projectId: result.projectId, projects } }
    } else {
      console.log('IPC: Project generation failed:', result.error)
      return { success: false, error: result.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('Project generation error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate project' 
    }
  }
})

// Regenerate UI for existing project
ipcMain.handle(IPC_CHANNELS.REGENERATE_UI, async (event, data: { projectId: string, editInstructions?: string }) => {
  const { projectId, editInstructions } = typeof data === 'string' ? { projectId: data, editInstructions: undefined } : data
  console.log('IPC: Regenerate UI requested for project:', projectId, editInstructions ? 'with instructions' : 'without instructions')
  
  try {
    const result = await regenerateUI(projectId, (node, status, message, isParent, parentNode) => {
      console.log('IPC: UI Regen Progress -', node, status, message || '')
      // Send progress updates to renderer
      event.sender.send(IPC_CHANNELS.GENERATION_PROGRESS, {
        node,
        status,
        message,
        isParent,
        parentNode
      })
    }, editInstructions)
    
    if (result.success) {
      // Load the updated project data
      const projectData = await storage.loadProject(projectId)
      console.log('IPC: UI regeneration successful')
      
      // Play completion sound
      event.sender.send('play-completion-sound')
      
      return { success: true, data: projectData }
    } else {
      console.log('IPC: UI regeneration failed:', result.error)
      return { success: false, error: result.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('UI regeneration error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to regenerate UI' 
    }
  }
})

// Chat handlers

ipcMain.handle(IPC_CHANNELS.START_PROJECT_CHAT, async (event, data: { initialIdea: string }) => {
  try {
    await startProjectChat(data.initialIdea, event)
    return { success: true }
  } catch (error) {
    console.error('Failed to start chat:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to start chat' }
  }
})

ipcMain.handle(IPC_CHANNELS.CHAT_MESSAGE, async (event, data: { content: string, chatHistory: any[] }) => {
  try {
    await sendChatMessage(data.content, data.chatHistory, event)
    return { success: true }
  } catch (error) {
    console.error('Failed to send chat message:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' }
  }
})

// UI Chat handler
ipcMain.handle(IPC_CHANNELS.UI_CHAT_MESSAGE, async (event, data: { 
  content: string, 
  chatHistory: any[], 
  projectContext: { projectIdea: string; components?: string[]; uiStrategy?: string; uiFiles?: any[] } 
}) => {
  try {
    const result = await sendUIChatMessage(data.content, data.chatHistory, data.projectContext, event)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send UI chat message:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' }
  }
})

// Stop generation handler
ipcMain.handle(IPC_CHANNELS.STOP_GENERATION, async () => {
  try {
    const { stopAllGenerations } = await import('../lib/chat')
    stopAllGenerations()
    console.log('Stopping all active generations')
    return { success: true }
  } catch (error) {
    console.error('Failed to stop generation:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to stop generation' }
  }
})

// Preview server handlers
let previewUrl: string | null = null

ipcMain.handle(IPC_CHANNELS.PREVIEW_START, async (_, files: any[]) => {
  try {
    const result = await startPreviewServer(files)
    previewUrl = result.url
    return { success: true, url: result.url, port: result.port }
  } catch (error) {
    console.error('Failed to start preview server:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to start preview server' }
  }
})

ipcMain.handle(IPC_CHANNELS.PREVIEW_STOP, async () => {
  try {
    await stopPreviewServer()
    previewUrl = null
    return { success: true }
  } catch (error) {
    console.error('Failed to stop preview server:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to stop preview server' }
  }
})

ipcMain.handle(IPC_CHANNELS.PREVIEW_GET_URL, async () => {
  return { url: previewUrl }
})

// Stop preview server when app quits
app.on('before-quit', async () => {
  await stopPreviewServer()
})

// Get workflow visualization
ipcMain.handle('workflow:visualize', async () => {
  try {
    const mermaidDiagram = visualizeWorkflow()
    const debugInfo = getWorkflowDebugInfo()
    return { 
      success: true, 
      diagram: mermaidDiagram,
      debugInfo 
    }
  } catch (error) {
    console.error('Failed to visualize workflow:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to visualize workflow' 
    }
  }
  })

  // API Key Management
  ipcMain.handle(IPC_CHANNELS.SAVE_API_KEY, async (_event, apiKey: string) => {
    const { saveApiKey } = await import('../lib/storage')
    await saveApiKey(apiKey)
  })

  ipcMain.handle(IPC_CHANNELS.GET_API_KEY, async () => {
    const { getApiKey } = await import('../lib/storage')
    const apiKey = await getApiKey()
    // Return true/false for check, not the actual key for security
    return !!apiKey
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_API_KEY, async () => {
    const { deleteApiKey } = await import('../lib/storage')
    await deleteApiKey()
  })

  ipcMain.handle(IPC_CHANNELS.CHECK_API_KEY, async () => {
    const { getApiKey } = await import('../lib/storage')
    const apiKey = await getApiKey()
    return !!apiKey
  })

  // Provider Configuration Management
  ipcMain.handle(IPC_CHANNELS.SAVE_PROVIDER_CONFIG, async (_event, config) => {
    const { saveProviderConfig } = await import('../lib/storage')
    await saveProviderConfig(config)
    
    // Start keep-alive for Ollama model if selected
    const { startOllamaKeepAlive, stopOllamaKeepAlive, getOllamaModels } = await import('../lib/chat-providers')
    
    if (config.selectedProvider === 'ollama' && config.providers.ollama?.model) {
      const models = await getOllamaModels()
      if (models.includes(config.providers.ollama.model)) {
        startOllamaKeepAlive(config.providers.ollama.model)
      }
    } else {
      // Stop keep-alive if switching away from Ollama
      stopOllamaKeepAlive()
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_PROVIDER_CONFIG, async () => {
    const { getProviderConfig, migrateApiKeyToProviderConfig } = await import('../lib/storage')
    await migrateApiKeyToProviderConfig()
    return await getProviderConfig()
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_PROVIDER_CONFIG, async () => {
    const { deleteProviderConfig } = await import('../lib/storage')
    await deleteProviderConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CHECK_PROVIDER_CONFIG, async () => {
    const { getProviderConfig, migrateApiKeyToProviderConfig } = await import('../lib/storage')
    await migrateApiKeyToProviderConfig()
    const config = await getProviderConfig()
    return !!config
  })

  ipcMain.handle(IPC_CHANNELS.GET_OLLAMA_MODELS, async () => {
    const { getOllamaModels } = await import('../lib/chat-providers')
    return await getOllamaModels()
  })

function setupIpcHandlers(win: BrowserWindow) {
  const handleChatMessage = async (event: Electron.IpcMainInvokeEvent, message: string, chatHistory: any[]) => {
    try {
      await sendChatMessage(message, chatHistory, event)
    } catch (error) {
      console.error('Error handling chat message:', error)
      throw error
    }
  }

  const handleSendUIChatMessage = async (event: Electron.IpcMainInvokeEvent, message: string, chatHistory: any[], projectContext: any) => {
    try {
      return await sendUIChatMessage(message, chatHistory, projectContext, event)
    } catch (error) {
      console.error('Error handling UI chat message:', error)
      throw error
    }
  }

  // API Key Management
  ipcMain.handle(IPC_CHANNELS.SAVE_API_KEY, async (_event, apiKey: string) => {
    const { saveApiKey } = await import('../lib/storage')
    await saveApiKey(apiKey)
  })

  ipcMain.handle(IPC_CHANNELS.GET_API_KEY, async () => {
    const { getApiKey } = await import('../lib/storage')
    const apiKey = await getApiKey()
    // Return true/false for check, not the actual key for security
    return !!apiKey
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_API_KEY, async () => {
    const { deleteApiKey } = await import('../lib/storage')
    await deleteApiKey()
  })

  ipcMain.handle(IPC_CHANNELS.CHECK_API_KEY, async () => {
    const { getApiKey } = await import('../lib/storage')
    const apiKey = await getApiKey()
    return !!apiKey
  })
}
