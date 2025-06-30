import { IPC_CHANNELS } from '../../electron/lib/ipc-channels';
import { Project, ProjectFiles, GenerationProgress } from '../types';

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

  // Generation operations
  async generateProject(idea: string): Promise<{ success: boolean; error?: string; data?: any }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.GENERATE_PROJECT, idea);
  },

  async cancelGeneration(): Promise<void> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.CANCEL_GENERATION);
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
}; 