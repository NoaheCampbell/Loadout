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
  
  // Chat
  CHAT_MESSAGE: 'chat-message',
  CHAT_RESPONSE: 'chat-response',
  CHAT_STREAM_CHUNK: 'chat-stream-chunk',
  CHAT_STREAM_END: 'chat-stream-end',
  START_PROJECT_CHAT: 'start-project-chat',
  
  // Storage
  GET_APP_PATH: 'get-app-path',
  ENSURE_STORAGE: 'ensure-storage',
  
  // UI
  SHOW_ERROR: 'show-error',
  SHOW_SUCCESS: 'show-success',

  // Storage channels
  STORAGE_GET: 'storage:get',
  STORAGE_SET: 'storage:set',
  STORAGE_DELETE: 'storage:delete',
  STORAGE_CLEAR: 'storage:clear',
  STORAGE_GET_ALL: 'storage:getAll',

  // Chat channels
  CHAT_SEND: 'chat:send',
  CHAT_SEND_REPLY: 'chat:send:reply',

  // Project channels
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_GET: 'project:get',
  PROJECT_LIST: 'project:list',
  PROJECT_LOAD: 'project:load',

  // Workflow channels
  WORKFLOW_GENERATE: 'workflow:generate',
  WORKFLOW_GENERATE_REPLY: 'workflow:generate:reply',
  WORKFLOW_PROGRESS: 'workflow:progress',

  // App update channels
  APP_UPDATE_AVAILABLE: 'app:update:available',
  APP_UPDATE_DOWNLOADED: 'app:update:downloaded',
  APP_UPDATE_PROGRESS: 'app:update:progress',
  APP_UPDATE_ERROR: 'app:update:error',
  APP_UPDATE_DOWNLOAD: 'app:update:download',
  APP_UPDATE_INSTALL: 'app:update:install',
  
  // Preview server channels
  PREVIEW_START: 'preview:start',
  PREVIEW_STOP: 'preview:stop',
  PREVIEW_GET_URL: 'preview:getUrl',
} as const;

export type IpcChannels = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]; 