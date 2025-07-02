export const IPC_CHANNELS = {
  // Project generation
  GENERATE_PROJECT: 'generation:generate-project',
  CANCEL_GENERATION: 'cancel-generation',
  GENERATION_PROGRESS: 'generation:progress',
  REGENERATE_UI: 'generation:regenerate-ui',
  
  // Project management
  LOAD_PROJECT: 'storage:load-project',
  LIST_PROJECTS: 'storage:list-projects',
  DELETE_PROJECT: 'storage:delete-project',
  EXPORT_PROJECT: 'export-project',
  
  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_RESPONSE: 'chat-response',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  CHAT_STREAM_END: 'chat:stream-end',
  START_PROJECT_CHAT: 'chat:start-project',
  STOP_GENERATION: 'chat:stop-generation',
  
  // UI Chat
  UI_CHAT_MESSAGE: 'ui-chat:message',
  UI_CHAT_STREAM_CHUNK: 'ui-chat:stream-chunk',
  UI_CHAT_STREAM_END: 'ui-chat:stream-end',
  
  // Storage
  GET_APP_PATH: 'get-app-path',
  ENSURE_STORAGE: 'storage:ensure',
  
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
  PREVIEW_GET_URL: 'preview:get-url',
  
  // Chat Window
  OPEN_CHAT_WINDOW: 'chat-window:open',
  CLOSE_CHAT_WINDOW: 'chat-window:close',
  CHAT_WINDOW_MESSAGE: 'chat-window:message',
  CHAT_WINDOW_SYNC: 'chat-window:sync',
  CHAT_WINDOW_READY: 'chat-window:ready',

  // API Key Management
  SAVE_API_KEY: 'save-api-key',
  GET_API_KEY: 'get-api-key',
  DELETE_API_KEY: 'delete-api-key',
  CHECK_API_KEY: 'check-api-key',
  
  // Provider Configuration
  SAVE_PROVIDER_CONFIG: 'save-provider-config',
  GET_PROVIDER_CONFIG: 'get-provider-config',
  DELETE_PROVIDER_CONFIG: 'delete-provider-config',
  CHECK_PROVIDER_CONFIG: 'check-provider-config',
  MIGRATE_API_KEY: 'migrate-api-key',
  GET_OLLAMA_MODELS: 'get-ollama-models',
} as const;

export type IpcChannels = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]; 