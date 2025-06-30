# FlowGenius Setup Guide

## ✅ Prerequisites Checklist

### 1. Environment Variables
Create a `.env.local` file in your project root:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Install Required Dependencies

Run the following command to install all necessary packages:

```bash
npm install --save \
  @langchain/langgraph \
  @langchain/openai \
  @langchain/core \
  dotenv \
  react-markdown \
  remark-gfm \
  @monaco-editor/react \
  @codesandbox/sandpack-react \
  @codesandbox/sandpack-themes \
  react-hot-toast \
  lucide-react \
  clsx \
  zustand \
  date-fns \
  nanoid
```

### 3. Configure Electron Main Process for Environment Variables

Update `electron/main/index.ts` to load environment variables at the top:
```typescript
// Add at the very top of the file
import { config } from 'dotenv';
config({ path: '.env.local' });
```

### 4. TypeScript Configuration

Create type definitions for our project at `src/types/index.ts`:
```typescript
export interface ProjectIdea {
  title: string;
  description: string;
}

export interface PRD {
  problem: string;
  goals: string[];
  scope: string;
  constraints: string[];
  success_criteria: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface UIPlan {
  components: string[];
  layout: string;
  user_interactions: string[];
}

export interface Project {
  id: string;
  title: string;
  created: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  path: string;
}

export type NodeStatus = 'pending' | 'in-progress' | 'success' | 'error';

export interface GenerationProgress {
  node: string;
  status: NodeStatus;
  message?: string;
}
```

### 5. Create Project Directory Structure

Create the following directories:
```bash
mkdir -p src/components
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/store
mkdir -p electron/lib
```

### 6. Update Tailwind Configuration

Ensure your `tailwind.config.js` includes all necessary paths:
```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 7. IPC Type Safety

Create IPC channel definitions at `electron/lib/ipc-channels.ts`:
```typescript
export const IPC_CHANNELS = {
  GENERATE_PROJECT: 'generate-project',
  CANCEL_GENERATION: 'cancel-generation',
  GENERATION_PROGRESS: 'generation-progress',
  LOAD_PROJECT: 'load-project',
  LIST_PROJECTS: 'list-projects',
  EXPORT_PROJECT: 'export-project',
} as const;
```

## 🚀 Quick Verification

After setup, verify everything works:

1. **Check dependencies**: `npm list @langchain/langgraph`
2. **Check env**: Add this to `electron/main/index.ts` temporarily:
   ```typescript
   console.log('API Key loaded:', !!process.env.OPENAI_API_KEY);
   ```
3. **Run dev server**: `npm run dev`

## 📝 Notes

- The `.env.local` file should NOT be committed to git
- Make sure your OpenAI API key has sufficient credits
- We're using the main process for LangGraph to avoid browser limitations
- All file I/O will happen in the main process via IPC

## Next Steps

Once setup is complete, we can start with:
1. Basic IPC setup and testing
2. Main UI layout implementation
3. First LangGraph node (IdeaInputNode)
4. Storage system setup 