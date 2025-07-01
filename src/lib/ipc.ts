import { IPC_CHANNELS } from '../../electron/lib/ipc-channels';
import { Project, ProjectFiles, GenerationProgress, ChatMessage } from '../types';

// Type-safe IPC communication layer
export const ipc = {
  // Storage operations
  async ensureStorage(): Promise<void> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.ENSURE_STORAGE);
  },

  async listProjects(): Promise<Project[]> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.LIST_PROJECTS);
  },

  async loadProject(projectId: string): Promise<ProjectFiles | null> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.LOAD_PROJECT, projectId);
  },

  async deleteProject(projectId: string): Promise<{ success: boolean; error?: string; projects?: Project[] }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROJECT, projectId);
  },

  // Generation operations
  async generateProject(idea: string, chatHistory?: ChatMessage[]): Promise<{ 
    success: boolean; 
    error?: string; 
    data?: { projectId: string; projects?: Project[] } 
  }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.GENERATE_PROJECT, { idea, chatHistory });
  },

  async cancelGeneration(): Promise<void> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.CANCEL_GENERATION);
  },

  // Chat operations
  async invoke(channel: string, data?: any): Promise<any> {
    return window.ipcRenderer.invoke(channel, data);
  },

  // Preview server operations
  async startPreviewServer(files: any[]): Promise<{ 
    success: boolean; 
    url?: string; 
    port?: number; 
    error?: string 
  }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_START, files);
  },

  async stopPreviewServer(): Promise<{ success: boolean; error?: string }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_STOP);
  },

  async getPreviewUrl(): Promise<{ url: string | null }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_GET_URL);
  },

  // Event listeners
  onGenerationProgress(callback: (progress: GenerationProgress) => void) {
    window.ipcRenderer.on(IPC_CHANNELS.GENERATION_PROGRESS, (_, progress) => {
      callback(progress);
    });

    // Return cleanup function
    return () => {
      window.ipcRenderer.removeAllListeners(IPC_CHANNELS.GENERATION_PROGRESS);
    };
  },

  on(channel: string, callback: (data: any) => void) {
    window.ipcRenderer.on(channel, (_, data) => {
      callback(data);
    });

    // Return cleanup function
    return () => {
      window.ipcRenderer.removeAllListeners(channel);
    };
  },
}; 