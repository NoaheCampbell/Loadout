import { config } from 'dotenv'
config({ path: '.env.local' })

import { app, BrowserWindow, shell, ipcMain } from 'electron'
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

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
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

// FlowGenius IPC Handlers
import { IPC_CHANNELS } from '../lib/ipc-channels'
import { storage } from '../lib/storage'
import { runWorkflow } from '../lib/workflow'

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
ipcMain.handle(IPC_CHANNELS.GENERATE_PROJECT, async (event, idea: string) => {
  console.log('IPC: Generate project requested with idea:', idea.substring(0, 50) + '...')
  try {
    const result = await runWorkflow(idea, (node, status, message) => {
      console.log('IPC: Progress update -', node, status, message || '')
      // Send progress updates to renderer
      event.sender.send(IPC_CHANNELS.GENERATION_PROGRESS, {
        node,
        status,
        message
      })
    })
    
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
