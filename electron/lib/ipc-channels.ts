export const IPC_CHANNELS = {
  // Project generation
  GENERATE_PROJECT: 'generate-project',
  CANCEL_GENERATION: 'cancel-generation',
  GENERATION_PROGRESS: 'generation-progress',
  
  // Project management
  LOAD_PROJECT: 'load-project',
  LIST_PROJECTS: 'list-projects',
  DELETE_PROJECT: 'delete-project',
  EXPORT_PROJECT: 'export-project',
  
  // Storage
  GET_APP_PATH: 'get-app-path',
  ENSURE_STORAGE: 'ensure-storage',
  
  // UI
  SHOW_ERROR: 'show-error',
  SHOW_SUCCESS: 'show-success',
} as const;

export type IpcChannels = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]; 