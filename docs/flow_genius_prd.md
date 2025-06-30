# Product Requirements Document (PRD): FlowGenius

## Project Name

**FlowGenius**

---

## Project Description

FlowGenius is a desktop application designed to help AI-first developers transform raw project ideas into complete development blueprints. It automates the planning phase by using LangGraph to orchestrate intelligent, local-first workflows that generate PRDs, checklists, Brainlifts, UI plans, and either v0 prompts or GPT-generated UI code — all within a previewable interface. Inspired by tools like v0, Cursor, and Notion, FlowGenius becomes the starting point for every project.

---

## Target Audience

- Developers using Cursor, v0, ChatGPT, and other AI tooling  
- Indie hackers and solopreneurs  
- Engineers looking to automate project planning and prototyping  

---

## Problem Statement

Many developers rely on a mix of tools (ChatGPT, v0, Cursor, Notion, etc.) to convert ideas into structured work. This creates friction through manual copying, format inconsistencies, and loss of context. There’s no single tool that bridges idea capture, structured planning, and UI prototyping — all with persistent memory and automated workflows.

---

## Goals

- Create a desktop-first tool for planning software projects  
- Automate repeatable steps using LangGraph  
- Provide instant visual feedback via previewable UIs  
- Store and recall past project logic, reasoning, and layouts  

---

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
- Export full project as folder containing PRD, checklist, UI output, and optional v0 prompt  

### Deferred Features

- Stateful UI interaction in preview (for later versions)  
- UI editing via drag-and-drop (WYSIWYG)  
- Webhooks or integrations with third-party tools (GitHub, Figma, Notion)  
- Direct deployment to v0 or Cursor-triggered scaffolding  

---

## LangGraph Workflow Architecture

```
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
  Input: `string`  
  Output: `ProjectIdea { title: string, description: string }`

- **PRDGeneratorNode**  
  Input: `ProjectIdea`  
  Output: `PRD { problem: string, goals: string[], scope: string, constraints: string[], success_criteria: string[] }`

- **ChecklistGeneratorNode**  
  Input: `PRD`  
  Output: `ChecklistItem[]` (with status fields: `todo`, `done`)

- **BrainliftNode** (optional)  
  Input: `PRD`  
  Output: `BrainliftLog { assumptions: string[], decisions: string[], contextLinks: string[] }`

- **UIPlannerNode**  
  Input: `PRD`  
  Output: `UIPlan { components: string[], layout: string, user_interactions: string[] }`

- **UIStrategyDecisionNode**  
  Input: `UIPlan`  
  Output: `"v0" | "gpt"`

- **V0PromptNode**  
  Input: `UIPlan`  
  Output: `v0Prompt { sections: object[] }`

- **GPTUICodeNode**  
  Input: `UIPlan`  
  Output: `tsxCode: string`

- **PreviewRendererNode**  
  Input: `tsxCode`  
  Output: Component render preview (via Sandpack or ReactLive)

---

## UI Layout & Guidelines

### Overview

FlowGenius uses a docked, tabbed layout with a project list on the left and active workspace on the right. Tabs reflect the AI planning pipeline: Idea → PRD → Checklist → UI.

### Main Layout

```
+-------------------------------------------------------------+
| FlowGenius [Logo]                         ◯ ⚙ Light/Dark ⚫ |
+-------------------------------------------------------------+
| Project History |  [ + New Project ]                        |
|-----------------+-------------------------------------------|
| 📁 ai-notes     |  🧠 Project: "Meeting Summarizer App"     |
| 📁 bug-reporter |                                           |
|                 |  Tabs: [📝 Idea] [📜 PRD] [✅ Checklist]   |
|                 |        [🎨 UI: Preview | Code ]           |
|                 +-------------------------------------------+
|                 |                                           |
|                 |   [Tab content appears here...]           |
|                 |                                           |
+-----------------+-------------------------------------------+
```

### Tabs & Behavior

- **Idea Tab**
  - Input: Freeform text box  
  - Action: `[Generate PRD]` button  
  - Shows LangGraph step progress as it generates PRD  

- **PRD Tab**
  - Markdown-rendered PRD  
  - Controls: ♻ Regenerate, 📄 Copy to Clipboard, 🖋️ Edit (disabled in MVP)

- **Checklist Tab**
  - Checklist rendered from PRD  
  - Static markdown with checkbox icons  
  - Controls: 📄 Copy to Clipboard

- **UI Tab**
  - Toggle buttons: `● Preview` | `Code`  
  - Preview = Sandpack or ReactLive rendering of `ui.tsx`  
  - Code = Monaco viewer of `ui.tsx` (read-only)

### Styling & UX

| Element    | Style                                        |
|------------|-----------------------------------------------|
| Fonts      | System sans-serif, Monaco for code            |
| Theme      | Dark mode default, light mode toggle available |
| Layout     | Responsive grid/flex, fixed sidebar            |
| Icons      | Lucide or Tabler for navigation and context   |
| Animations | Fade-in steps, spinner during generation      |

---

## Storage Architecture

### Location

- macOS: `~/Library/Application Support/FlowGenius/`  
- Windows: `%APPDATA%\\FlowGenius\\`  
- Linux: `~/.config/FlowGenius/`  
- Resolved with Electron’s `app.getPath('userData')`

### File System Structure

```
FlowGenius/
├── projects/
│   ├── feedback-dashboard/
│   │   ├── idea.txt
│   │   ├── prd.md
│   │   ├── checklist.md
│   │   ├── brainlift.md
│   │   ├── ui.tsx
│   │   └── v0_prompt.json
├── projects.json
```

### Project Index (`projects.json`)
```json
[
  {
    "id": "feedback-dashboard",
    "title": "Feedback Dashboard",
    "created": "2025-06-30T12:00:00Z",
    "status": "complete",
    "path": "projects/feedback-dashboard/"
  }
]
```

### Behavior

- New project = new folder  
- LangGraph outputs written to discrete files  
- Index is used for project list in sidebar  
- All data is local and offline-capable  

---

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

---

## Sample Project Output

### Input Idea
> “A dashboard that lets users submit and track feedback across teams.”

### Generated PRD
```markdown
## Problem
Teams receive user feedback through various disconnected channels, making it hard to track, categorize, and act on.

## Goals
- Centralize feedback collection
- Track progress of resolutions
- Categorize by team/topic

## Scope
- Feedback submission UI
- Tagging system
- Resolution tracker

## Constraints
- No authentication (MVP)
- Local-only storage

## Success Criteria
- Submit feedback
- Assign tags
- Move items across status columns
```

### Checklist
- [ ] Build feedback form
- [ ] Add tags dropdown
- [ ] Create drag-and-drop board
- [ ] Persist data locally

### UI Plan
- Layout: Header, Sidebar, 3-Column Board  
- Components: `<Form>`, `<TagDropdown>`, `<Card>`, `<Column>`  
- Interactions: Add feedback, drag-and-drop movement, edit tags  

### Strategy
- UI Generation Method: `GPT` (not v0)

---

## Open Questions

### Technical Architecture

- ✅ LangGraph will be used as the core workflow engine  
- ⚠️ Ollama fallback is planned post-MVP  
- ✅ All workflows will run locally inside Electron  
- ✅ No database needed — local file storage used  
- ✅ Project data is saved to user’s `app.getPath('userData')` directory  

### UI & UX

- ✅ Custom UI layout designed for MVP  
- ⚠️ User cannot edit generated code in MVP  
- ✅ Default to OpenAI, API key configuration comes later  
- ⚠️ UI complexity is limited to static layouts only  
- ⚠️ UI previews are non-interactive (mocked with fake data)

### LangGraph Features

- ✅ Node types and schemas are locked in  
- ⚠️ Optional: dev-only debug panel for LangGraph execution graph  
- ✅ Flow is deterministic with no user interruption unless error occurs  

### Export & Project Management

- ✅ Projects are saved locally  
- ⚠️ Export options will be added post-MVP  

### Security

- ✅ No user auth or encryption needed in MVP  
- ⚠️ Future enhancement: support for API key storage and sync  
- ✅ Everything runs and stays on the user’s machine