import { IPC_CHANNELS } from '../../electron/lib/ipc-channels';
import { Project, ProjectFiles, GenerationProgress, ChatMessage } from '../types';

// Sound notification utility
const playCompletionSound = () => {
  try {
    // Create a pleasant completion sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a chord progression for a pleasant "ding" sound
    const playTone = (frequency: number, duration: number, delay: number = 0) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Create a pleasant envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      }, delay);
    };
    
    // Play a pleasant completion chord (C major triad)
    playTone(523.25, 0.3, 0);    // C5
    playTone(659.25, 0.4, 100);  // E5
    playTone(783.99, 0.5, 200);  // G5
    
  } catch (error) {
    // Fallback to system beep if Web Audio API fails
    console.log('Web Audio API not available, using system beep');
    // Try to trigger system notification sound
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Generation Complete!', {
        body: 'Your React app has been generated successfully!',
        silent: false
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Request permission and then show notification
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Generation Complete!', {
            body: 'Your React app has been generated successfully!',
            silent: false
          });
        }
      });
    }
  }
};

// Request notification permissions on app initialization
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.log('Notification permission request failed:', error);
    }
  }
};

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

  // Sound notifications
  playCompletionSound,
  requestNotificationPermission,

  // Regenerate UI only for existing project
  async regenerateUI(projectId: string, editInstructions?: string): Promise<{ 
    success: boolean; 
    error?: string; 
    data?: ProjectFiles | null 
  }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.REGENERATE_UI, { projectId, editInstructions });
  },

  // UI Chat
  async sendUIChatMessage(content: string, chatHistory: ChatMessage[], projectContext: {
    projectIdea: string;
    components?: string[];
    uiStrategy?: string;
    uiFiles?: any[];
  }): Promise<{
    success: boolean;
    error?: string;
    data?: {
      isEditRequest: boolean;
      editInstructions?: string;
      fullResponse: string;
    };
  }> {
    return window.ipcRenderer.invoke(IPC_CHANNELS.UI_CHAT_MESSAGE, { content, chatHistory, projectContext });
  },
  
  // API Key Management
  saveApiKey: (apiKey: string) => ipc.invoke(IPC_CHANNELS.SAVE_API_KEY, apiKey),
  checkApiKey: () => ipc.invoke(IPC_CHANNELS.CHECK_API_KEY),
  deleteApiKey: () => ipc.invoke(IPC_CHANNELS.DELETE_API_KEY),
}; 