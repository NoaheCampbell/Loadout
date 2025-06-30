# Product Requirements Document (PRD): FlowGenius

## Project Name

**FlowGenius**

## Project Description

FlowGenius is a desktop application designed to help AI-first developers transform raw project ideas into complete development blueprints. It automates the planning phase by using LangGraph to orchestrate intelligent, local-first workflows that generate PRDs, checklists, Brainlifts, UI plans, and either v0 prompts or GPT-generated UI code — all within a previewable interface. Inspired by tools like v0, Cursor, and Notion, FlowGenius becomes the starting point for every project.

## Target Audience

- Developers using Cursor, v0, ChatGPT, and other AI tooling
- Indie hackers and solopreneurs
- Engineers looking to automate project planning and prototyping

## Problem Statement

Many developers rely on a mix of tools (ChatGPT, v0, Cursor, Notion, etc.) to convert ideas into structured work. This creates friction through manual copying, format inconsistencies, and loss of context. There’s no single tool that bridges idea capture, structured planning, and UI prototyping — all with persistent memory and automated workflows.

## Goals

- Create a desktop-first tool for planning software projects
- Automate repeatable steps using LangGraph
- Provide instant visual feedback via previewable UIs
- Store and recall past project logic, reasoning, and layouts

## MVP Scope (FlowGenius Core)

### Key Features

- Accept raw idea as text input
- Generate PRD using AI
- Generate checklist from PRD
- Generate UI plan and determine best rendering strategy (v0 or GPT)
- Automatically generate either:
  - v0 prompt (for simple layouts)
  - React/Tailwind code with mock data (for complex layouts)
- Display UI output with toggle between code and preview view (static only)
- Save all generated content to disk (not just in memory)
- Export full project as folder containing PRD, checklist, UI output, and optional v0 prompt
- Allow users to cancel long-running generation processes
- Include bundled sample projects for onboarding

### Deferred Features

- Stateful UI interaction in preview (for later versions)
- UI editing via drag-and-drop (WYSIWYG)
- Webhooks or integrations with third-party tools (GitHub, Figma, Notion)
- Direct deployment to v0 or Cursor-triggered scaffolding
- Project metadata refactor to per-folder JSON structure (to prevent index.json scaling issues)

## LangGraph Workflow Architecture

```plaintext
[IdeaInputNode]
   ↓
[PRDGeneratorNode]
   ↓
[ChecklistGeneratorNode]
   ↓
[BrainliftNode] (optional)
   ↓
[UIPlannerNode]
   ↓
[UIStrategyDecisionNode]
   ├──→ [V0PromptNode]
   └──→ [GPTUICodeNode]
   ↓
[PreviewRendererNode]
```

### Node Responsibilities & Types

- **IdeaInputNode**
  - Input: `string`
  - Output: `ProjectIdea { title: string, description: string }`

- **PRDGeneratorNode**
  - Input: `ProjectIdea`
  - Output: `PRD { problem: string, goals: string[], scope: string, constraints: string[], success_criteria: string[] }`

- **ChecklistGeneratorNode**
  - Input: `PRD`
  - Output: `ChecklistItem[]` (with status fields: `todo`, `done`, optional `id`)

- **BrainliftNode** (optional)
  - Input: `PRD`
  - Output: `BrainliftLog { assumptions: string[], decisions: string[], contextLinks: string[] }`

- **UIPlannerNode**
  - Input: `PRD`
  - Output: `UIPlan { components: string[], layout: string, user_interactions: string[] }`

- **UIStrategyDecisionNode**
  - Input: `UIPlan`
  - Output: `"v0" | "gpt"`
  - Criteria:
    - Use **v0** if layout has ≤ 3 components, one main section, no nested views
    - Use **GPT** if there are multiple sections, reusable components, or conditionals

- **V0PromptNode**
  - Input: `UIPlan`
  - Output: `v0Prompt { sections: object[] }`

- **GPTUICodeNode**
  - Input: `UIPlan`
  - Output: `tsxCode: string`

- **PreviewRendererNode**
  - Input: `tsxCode`
  - Output: Component render preview (via Sandpack or ReactLive)

## UI Layout & Guidelines

...[unchanged content from previous UI Layout section]...

## File Output Example

```
projects/
├── youtube-summarizer/
│   ├── prd.md
│   ├── checklist.md
│   ├── brainlift.md
│   ├── ui.tsx
│   └── v0_prompt.json
```

## Sample Project Output

...[unchanged sample output]...

## Storage Architecture

### Local Project Storage (MVP)

All data will be stored **locally on the user's machine** under the following path:

- **macOS**: `~/Library/Application Support/FlowGenius/projects/`
- **Windows**: `%APPDATA%\FlowGenius\projects\`
- **Linux**: `~/.config/FlowGenius/projects/`

Each project gets its own folder:

```
projects/
├── feedback-tool/
│   ├── idea.txt
│   ├── prd.md
│   ├── checklist.md
│   ├── brainlift.md
│   ├── ui.tsx
│   └── v0_prompt.json
```

Additionally, a global index file tracks metadata:

```
projects/
├── index.json
```

Example contents of `index.json`:

```json
[
  {
    "id": "feedback-tool",
    "title": "Feedback Dashboard",
    "created": "2025-06-30T12:00:00Z",
    "status": "complete",
    "version": "0.1.0"
  }
]
```

This local storage model provides easy backup, no cloud dependencies, and direct access to project data. A future enhancement may split this index into per-folder `project.json` files to reduce the risk of corruption.

## Open Questions

### Technical Architecture

- LangGraph will be used for all workflow orchestration
- Fallback to Ollama may be considered post-MVP
- LangGraph will be embedded within Electron, running in the **main process**
  - Communication between React UI and LangGraph will use **IPC (Inter-Process Communication)**
  - Renderer (React) sends input → main process runs LangGraph → results returned to renderer
  - Keeps UI responsive and avoids Node/browser context conflicts
- All generated content is saved to disk, not kept in memory only
- Error handling UI and retry logic will be minimal but in place for MVP (toast, retry button, error banner)
- LangGraph node outputs will be stored as separate files for traceability and debugging
- Cancel button will be available to stop active LangGraph workflows
- Sample projects will be bundled with the app to guide first-time users

### UI & UX

- UI uses tabs: [📝 Idea] [📜 PRD] [✅ Checklist] [🎨 UI: Preview | Code]
- Each tab shows generation progress/status per node
- Regenerate buttons available per step (PRD, Checklist, UI)
- Sandpack or ReactLive renders static UI preview
- Monaco shows readonly generated code
- Cancel button for long LangGraph execution
- Static mock data used in preview rendering
- No WYSIWYG editor or code editing in MVP

### LangGraph Features

- Nodes execute sequentially and deterministically
- Max token length: TBD
- Retry policy: 3 attempts
- Timeout: 30 seconds
- Cancel support via IPC
- Node statuses tracked (`pending`, `in-progress`, `success`, `error`)

### Export and Project Management

- Export each part (PRD, checklist, UI) as individual `.md`/`.tsx`/`.json` files
- Sample project bundles included for onboarding

### Security & API Keys

- No user authentication needed
- All files stored locally
- Future enhancement may support API key configuration UI

## Status

- MVP planned and structured
- LangGraph selected as core architecture
- UI/UX inspired by proven productivity tools
- Implementation ready with fallback plan for future scaling

